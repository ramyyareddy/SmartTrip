package com.smarttrip.backend.ai;

import com.google.genai.Client;
import com.google.genai.errors.ClientException;
import com.google.genai.types.GenerateContentResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class GeminiService {

    private final Client client;

    public GeminiService(@Value("${gemini.api.key}") String apiKey) {
        this.client = Client.builder()
                .apiKey(apiKey)
                .build();
    }

    public String generateItinerary(AiTripRequest request) {

        String prompt = """
                Create a detailed travel itinerary.

                Destination: %s
                Number of days: %d
                Budget: %.2f
                Interests: %s

                Create a day-by-day itinerary.

                For every day include:
                - Morning activities
                - Afternoon activities
                - Evening activities
                - Food recommendations
                - Places to visit
                - Estimated expenses

                Consider the traveler's budget and interests.
                Make the itinerary practical and specific to the destination.

                Format the response clearly and make it easy to read.
                """.formatted(
                request.getDestination(),
                request.getDays(),
                request.getBudget(),
                request.getInterests()
        );

        try {

            System.out.println("======================================");
            System.out.println("SENDING REQUEST TO GEMINI");
            System.out.println("Destination: " + request.getDestination());
            System.out.println("Days: " + request.getDays());
            System.out.println("Budget: " + request.getBudget());
            System.out.println("Interests: " + request.getInterests());
            System.out.println("======================================");

            GenerateContentResponse response =
                    client.models.generateContent(
                            "gemini-3.8-flash",
                            prompt,
                            null
                    );

            String result = response.text();

            System.out.println("======================================");
            System.out.println("GEMINI RESPONSE RECEIVED");
            System.out.println("======================================");

            if (result != null && !result.trim().isEmpty()) {
                return result;
            }

            return "GEMINI RETURNED AN EMPTY RESPONSE.";

        } catch (ClientException e) {

            System.out.println("======================================");
            System.out.println("GEMINI CLIENT ERROR");
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

            return "GEMINI ERROR:\n\n"
                    + e.getClass().getSimpleName()
                    + "\n\n"
                    + e.getMessage();

        } catch (Exception e) {

            System.out.println("======================================");
            System.out.println("GEMINI UNEXPECTED ERROR");
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

            return "GEMINI ERROR:\n\n"
                    + e.getClass().getSimpleName()
                    + "\n\n"
                    + e.getMessage();
        }
    }
}