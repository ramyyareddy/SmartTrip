package com.smarttrip.backend.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

@Service
public class GroqService {

    private final String apiKey;

    private final HttpClient httpClient;

    private final ObjectMapper objectMapper;

    public GroqService(
            @Value("${groq.api.key}") String apiKey) {

        this.apiKey = apiKey;
        this.httpClient = HttpClient.newHttpClient();
        this.objectMapper = new ObjectMapper();
    }

    public String generateItinerary(AiTripRequest request) {

        String prompt = """
                Create a detailed travel itinerary for a traveler.

                Destination: %s
                Number of days: %d
                Budget: %.2f
                Interests: %s

                Create a practical day-by-day travel itinerary.

                For every day include:
                - Morning activities
                - Afternoon activities
                - Evening activities
                - Food recommendations
                - Places to visit
                - Estimated expenses

                Consider the traveler's budget and interests.

                Make the itinerary specific to the destination.

                Format the response clearly with headings for each day.
                """.formatted(
                request.getDestination(),
                request.getDays(),
                request.getBudget(),
                request.getInterests()
        );

        try {

            String jsonBody = """
                    {
                      "model": "openai/gpt-oss-20b",
                      "messages": [
                        {
                          "role": "system",
                          "content": "You are SmartTrip, an expert AI travel planner."
                        },
                        {
                          "role": "user",
                          "content": %s
                        }
                      ],
                      "temperature": 0.7
                    }
                    """.formatted(
                    objectMapper.writeValueAsString(prompt)
            );

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(
                            "https://api.groq.com/openai/v1/chat/completions"
                    ))
                    .header(
                            "Authorization",
                            "Bearer " + apiKey
                    )
                    .header(
                            "Content-Type",
                            "application/json"
                    )
                    .POST(
                            HttpRequest.BodyPublishers.ofString(jsonBody)
                    )
                    .build();

            System.out.println("======================================");
            System.out.println("SENDING REQUEST TO GROQ");
            System.out.println("Destination: " + request.getDestination());
            System.out.println("Days: " + request.getDays());
            System.out.println("Budget: " + request.getBudget());
            System.out.println("Interests: " + request.getInterests());
            System.out.println("======================================");

            HttpResponse<String> response =
                    httpClient.send(
                            httpRequest,
                            HttpResponse.BodyHandlers.ofString()
                    );

            System.out.println("======================================");
            System.out.println("GROQ HTTP STATUS: " + response.statusCode());
            System.out.println("======================================");

            if (response.statusCode() < 200 ||
                response.statusCode() >= 300) {

                System.out.println("GROQ ERROR RESPONSE:");
                System.out.println(response.body());

                return "GROQ ERROR:\n\nHTTP Status: "
                        + response.statusCode()
                        + "\n\n"
                        + response.body();
            }

            JsonNode root =
                    objectMapper.readTree(response.body());

            JsonNode content =
                    root.path("choices")
                        .path(0)
                        .path("message")
                        .path("content");

            if (content.isMissingNode() ||
                content.asText().isBlank()) {

                return "GROQ RETURNED AN EMPTY RESPONSE.";
            }

            String result = content.asText();

            System.out.println("======================================");
            System.out.println("GROQ RESPONSE RECEIVED");
            System.out.println("======================================");

            return result;

        } catch (Exception e) {

            System.out.println("======================================");
            System.out.println("GROQ ERROR");
            System.out.println("======================================");

            System.out.println(
                    "Error type: "
                    + e.getClass().getSimpleName()
            );

            System.out.println(
                    "Error message: "
                    + e.getMessage()
            );

            System.out.println("======================================");

            return "GROQ ERROR:\n\n"
                    + e.getClass().getSimpleName()
                    + "\n\n"
                    + e.getMessage();
        }
    }
}