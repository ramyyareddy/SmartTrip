package com.smarttrip.backend.controller;

import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/gemini-test")
@CrossOrigin(origins = "*")
public class GeminiTestController {

    private final Client client;

    public GeminiTestController(
            @Value("${gemini.api.key}") String apiKey) {

        this.client = Client.builder()
                .apiKey(apiKey)
                .build();
    }

    @GetMapping
    public String testGemini() {

        try {

            GenerateContentResponse response =
                    client.models.generateContent(
                            "gemini-3.8-flash",
                            "Say exactly: SmartTrip Gemini connection is working!",
                            null
                    );

            return response.text();

        } catch (Exception e) {

            return "GEMINI TEST FAILED: "
                    + e.getClass().getSimpleName()
                    + " - "
                    + e.getMessage();
        }
    }
}