package com.smarttrip.backend.controller;

import com.smarttrip.backend.ai.AiTripRequest;
import com.smarttrip.backend.ai.GeminiService;
import com.smarttrip.backend.ai.GroqService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class AiController {

    private final GroqService groqService;
    private final GeminiService geminiService;

    public AiController(GroqService groqService,
                        GeminiService geminiService) {
        this.groqService = groqService;
        this.geminiService = geminiService;
    }

    @PostMapping("/itinerary")
    public ResponseEntity<String> generateItinerary(
            @RequestBody(required = false) AiTripRequest request) {

        String requestId = UUID.randomUUID().toString().substring(0, 8);

        if (request == null
                || request.getDestination() == null
                || request.getDestination().isBlank()
                || request.getDays() < 1
                || request.getDays() > 30
                || request.getBudget() == null
                || request.getBudget() < 0) {

            System.err.println("[SMARTTRIP] [" + requestId + "] Invalid request payload received.");
            return ResponseEntity.badRequest().body(
                    "Please provide a destination, a trip duration from 1 to 30 days, and a valid non-negative budget."
            );
        }

        if (request.getCurrency() == null || request.getCurrency().isBlank()) {
            request.setCurrency("INR");
        }

        System.out.println("==================================================");
        System.out.println("[SMARTTRIP] [" + requestId + "] INCOMING ITINERARY REQUEST");
        System.out.println("[SMARTTRIP] [" + requestId + "] Destination: " + request.getDestination());
        System.out.println("[SMARTTRIP] [" + requestId + "] Requested days: " + request.getDays());
        System.out.println("[SMARTTRIP] [" + requestId + "] Budget: " + request.getBudget() + " " + request.getCurrency());
        System.out.println("==================================================");

        // 1. Try Groq (Primary Provider)
        long groqStart = System.currentTimeMillis();
        System.out.println("[SMARTTRIP] [" + requestId + "] 1. Trying Groq AI (Primary)...");

        String groqError = "unknown";
        try {
            String groqResult = groqService.generateItinerary(request);
            long groqDuration = System.currentTimeMillis() - groqStart;

            System.out.println("[SMARTTRIP] [" + requestId + "] Groq SUCCESS in " + groqDuration + " ms.");
            System.out.println("==================================================");
            return ResponseEntity.ok(groqResult);

        } catch (Exception groqException) {
            long groqDuration = System.currentTimeMillis() - groqStart;
            groqError = groqException.getMessage();
            System.err.println("[SMARTTRIP] [" + requestId + "] Groq failed in " + groqDuration + " ms: "
                    + groqException.getClass().getSimpleName() + " - " + groqError);
        }

        // 2. Trigger Gemini Fallback
        long geminiStart = System.currentTimeMillis();
        System.out.println("==================================================");
        System.out.println("[SMARTTRIP] [" + requestId + "] 2. Switching to Gemini AI (Fallback)...");

        String geminiError = "unknown";
        try {
            String geminiResult = geminiService.generateItinerary(request);
            long geminiDuration = System.currentTimeMillis() - geminiStart;

            System.out.println("[SMARTTRIP] [" + requestId + "] Gemini SUCCESS in " + geminiDuration + " ms.");
            System.out.println("==================================================");
            return ResponseEntity.ok(geminiResult);

        } catch (Exception geminiException) {
            long geminiDuration = System.currentTimeMillis() - geminiStart;
            geminiError = geminiException.getMessage();
            System.err.println("[SMARTTRIP] [" + requestId + "] Gemini fallback failed in " + geminiDuration + " ms: "
                    + geminiException.getClass().getSimpleName() + " - " + geminiError);
        }

        // 3. Both Providers Failed
        System.err.println("==================================================");
        System.err.println("[SMARTTRIP] [" + requestId + "] Both AI providers failed to generate a complete "
                + request.getDays() + "-day itinerary.");
        System.err.println("==================================================");

        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(
                "Unable to generate a complete " + request.getDays()
                        + "-day itinerary with all required daily costs. Both AI providers were unable to fulfill the request. (Groq: " + groqError
                        + " | Gemini: " + geminiError + "). Please try again."
        );
    }
}
