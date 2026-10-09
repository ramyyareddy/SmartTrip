package com.smarttrip.backend.ai;

import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class GeminiService {

    private final String apiKey;
    private final String model;

    public GeminiService(
            @Value("${gemini.api.key:}") String apiKey,
            @Value("${gemini.model:gemini-2.5-flash}") String model) {

        this.apiKey = apiKey;
        this.model = (model == null || model.isBlank()) ? "gemini-2.5-flash" : model.trim();
    }

    public String generateItinerary(AiTripRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Trip request is missing.");
        }
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("GEMINI_API_KEY is not configured.");
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
        System.out.println("[SMARTTRIP] [Gemini] Calling Gemini API (model: " + model
                + ") for destination: " + destination + ", requested days: " + requestedDays
                + ", currency: " + currency);

        try {
            Client client = Client.builder().apiKey(apiKey).build();
            GenerateContentResponse response = client.models.generateContent(
                    model,
                    prompt,
                    null
            );

            String result = response.text();
            long duration = System.currentTimeMillis() - startTime;

            if (result == null || result.isBlank()) {
                throw new IllegalStateException("Gemini returned an empty response.");
            }

            result = result.trim();
            System.out.println("[SMARTTRIP] [Gemini] Response received in " + duration + " ms. Validating...");

            ItineraryValidator.ValidationResult validation = ItineraryValidator.validate(result, requestedDays);
            if (!validation.valid()) {
                System.err.println("[SMARTTRIP] [Gemini] Validation failed: " + validation.message());
                throw new IllegalStateException("Gemini validation failed: " + validation.message());
            }

            System.out.println("[SMARTTRIP] [Gemini] Validation successful. Generated " + validation.daysFound() + " days.");
            return result;

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            System.err.println("[SMARTTRIP] [Gemini] Error after " + duration + " ms: "
                    + e.getClass().getSimpleName() + " - " + e.getMessage());
            throw (e instanceof RuntimeException re ? re : new RuntimeException(e.getMessage(), e));
        }
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