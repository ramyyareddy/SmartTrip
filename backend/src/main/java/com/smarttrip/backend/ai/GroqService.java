package com.smarttrip.backend.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;

@Service
public class GroqService {

    private final String apiKey;
    private final String model;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public GroqService(
            @Value("${groq.api.key:}") String apiKey,
            @Value("${groq.model:openai/gpt-oss-120b}") String model) {

        this.apiKey = apiKey;
        this.model = (model == null || model.isBlank()) ? "openai/gpt-oss-120b" : model.trim();
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
    }

    public String generateItinerary(AiTripRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Trip request is missing.");
        }
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("GROQ_API_KEY is not configured.");
        }

        int requestedDays = request.getDays();
        if (requestedDays < 1 || requestedDays > 30) {
            throw new IllegalArgumentException("Choose between 1 and 30 days.");
        }

        String currency = (request.getCurrency() != null && !request.getCurrency().isBlank())
                ? request.getCurrency().trim().toUpperCase(Locale.ROOT)
                : "INR";

        String destination = safe(request.getDestination());
        String interests = safe(request.getInterests());
        Double budget = request.getBudget() != null ? request.getBudget() : 0.0;

        String prompt = buildPrompt(destination, requestedDays, budget, currency, interests);

        long startTime = System.currentTimeMillis();
        System.out.println("[SMARTTRIP] [Groq] Calling Groq API with model: " + model
                + " for destination: " + destination + ", requested days: " + requestedDays
                + ", currency: " + currency);

        try {
            JsonNode root = callGroq(prompt);

            JsonNode choice = root.path("choices").path(0);
            String finishReason = choice.path("finish_reason").asText("unknown");
            JsonNode message = choice.path("message");
            JsonNode content = message.path("content");

            if (content.isMissingNode() || content.isNull() || content.asText().isBlank()) {
                throw new IllegalStateException("Groq returned empty content (finish_reason: " + finishReason + ")");
            }

            if ("length".equalsIgnoreCase(finishReason)) {
                throw new IllegalStateException("Groq generation was truncated due to token limit (finish_reason=length)");
            }

            String result = content.asText().trim();
            long duration = System.currentTimeMillis() - startTime;
            System.out.println("[SMARTTRIP] [Groq] Response received in " + duration + " ms. Validating...");

            ItineraryValidator.ValidationResult validation = ItineraryValidator.validate(result, requestedDays);
            if (!validation.valid()) {
                System.err.println("[SMARTTRIP] [Groq] Validation failed: " + validation.message());
                throw new IllegalStateException("Groq validation failed: " + validation.message());
            }

            System.out.println("[SMARTTRIP] [Groq] Validation successful. Generated " + validation.daysFound() + " days.");
            return result;

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            System.err.println("[SMARTTRIP] [Groq] Error after " + duration + " ms: "
                    + e.getClass().getSimpleName() + " - " + e.getMessage());
            throw (e instanceof RuntimeException re ? re : new RuntimeException(e.getMessage(), e));
        }
    }

    private JsonNode callGroq(String prompt) throws Exception {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", model);
        body.put("temperature", 0.3);
        body.put("max_tokens", 8192);

        ArrayNode messages = body.putArray("messages");

        ObjectNode systemMessage = messages.addObject();
        systemMessage.put("role", "system");
        systemMessage.put("content",
                "You are SmartTrip, an expert travel planner. Always output complete, detailed itineraries in Markdown. "
                        + "Produce every requested day consecutively from Day 1 to the final day, followed by the trip budget and travel tips. "
                        + "Never truncate or omit days."
        );

        ObjectNode userMessage = messages.addObject();
        userMessage.put("role", "user");
        userMessage.put("content", prompt);

        String jsonBody = objectMapper.writeValueAsString(body);

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create("https://api.groq.com/openai/v1/chat/completions"))
                .timeout(Duration.ofSeconds(60))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Groq HTTP " + response.statusCode() + ": " + response.body());
        }

        JsonNode root = objectMapper.readTree(response.body());

        if (root.has("error")) {
            throw new IllegalStateException("Groq API error: " + root.path("error").toString());
        }

        if (!root.path("choices").isArray() || root.path("choices").isEmpty()) {
            throw new IllegalStateException("Groq response did not contain choices");
        }

        return root;
    }

    private String buildPrompt(
            String destination,
            int days,
            double budget,
            String currency,
            String interests) {

        return """
                You are SmartTrip, a practical, detail-oriented travel planner.

                TRIP DETAILS
                Destination: %s
                Requested days: %d
                Total budget: %.2f %s
                Interests: %s
                Output currency: %s

                NON-NEGOTIABLE REQUIREMENTS
                1. Produce exactly %d itinerary days, numbered consecutively from Day 1 through Day %d.
                2. Write every day before the trip budget and travel tips.
                3. Never omit a day, merge multiple days, or replace days with a summary.
                4. Every day must include all the required time sections and all itemized cost lines specified below.
                5. Include the final Estimated Trip Budget section and an Estimated total.
                6. Use %s for every monetary amount. Do not mix currencies.
                7. Costs must be plausible estimates, not invented guaranteed prices.
                8. Recommend specific, recognizable places for each activity.

                FOR EACH DAY, USE THIS EXACT STRUCTURE:

                ## Day [number] - [Theme or Area]

                **Morning**
                - Activity: Specific attraction or experience and estimated duration.
                - Place: [Name of place]

                **Afternoon**
                - Activity: Specific attraction or experience and lunch suggestion.
                - Place: [Name of place]

                **Evening**
                - Activity: Specific attraction or experience and dinner suggestion.
                - Place: [Name of place]

                **Getting Around**
                - Suggested local transport and travel times.

                **Estimated Day Cost**
                - Accommodation: [amount] %s
                - Food: [amount] %s
                - Local transport: [amount] %s
                - Activities and attractions: [amount] %s
                - Other applicable expenses: [amount] %s
                - Day subtotal: [amount] %s

                Repeat this complete structure for every day from Day 1 to Day %d.

                ## Estimated Trip Budget
                - Accommodation: [amount] %s
                - Food: [amount] %s
                - Local transport: [amount] %s
                - Activities and attractions: [amount] %s
                - Intercity travel: [amount] %s
                - Other expenses & contingency: [amount] %s
                - Estimated total: [amount] %s
                - Assumptions: Itemized estimates for the entire group. Prices are estimates.

                ## Practical Travel Tips
                - Transport advice, timing, and local etiquette.

                Return only the completed itinerary in clean Markdown.
                """.formatted(
                destination,
                days,
                budget,
                currency,
                interests,
                currency,
                days,
                days,
                currency,
                currency,
                currency,
                currency,
                currency,
                currency,
                currency,
                days,
                currency,
                currency,
                currency,
                currency,
                currency,
                currency,
                currency
        );
    }

    private String safe(String value) {
        return (value == null || value.isBlank()) ? "Not specified" : value.trim();
    }
}