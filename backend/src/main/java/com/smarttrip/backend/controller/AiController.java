package com.smarttrip.backend.controller;

import com.smarttrip.backend.ai.AiTripRequest;
import com.smarttrip.backend.ai.GeminiService;
import com.smarttrip.backend.ai.GroqService;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class AiController {

    private final GeminiService geminiService;
    private final GroqService groqService;

    public AiController(
            GeminiService geminiService,
            GroqService groqService) {

        this.geminiService = geminiService;
        this.groqService = groqService;
    }

    @PostMapping("/itinerary")
    public String generateItinerary(
            @RequestBody AiTripRequest request) {

        System.out.println("======================================");
        System.out.println("SMARTTRIP AI REQUEST");
        System.out.println("======================================");

        // ============================================
        // 1. TRY GROQ FIRST - PRIMARY AI
        // ============================================

        System.out.println("TRYING GROQ AI (PRIMARY)...");

        String groqResult =
                groqService.generateItinerary(request);

        if (groqResult != null
                && !groqResult.startsWith("GROQ ERROR:")
                && !groqResult.contains("HTTP Status:")) {

            System.out.println("======================================");
            System.out.println("GROQ SUCCESS - PRIMARY AI");
            System.out.println("======================================");

            return groqResult;
        }

        // ============================================
        // 2. GROQ FAILED → TRY GEMINI
        // ============================================

        System.out.println("======================================");
        System.out.println("GROQ FAILED");
        System.out.println("SWITCHING TO GEMINI AI...");
        System.out.println("======================================");

        String geminiResult =
                geminiService.generateItinerary(request);

        if (geminiResult != null
                && !geminiResult.startsWith("GEMINI ERROR:")
                && !geminiResult.contains("RESOURCE_EXHAUSTED")) {

            System.out.println("======================================");
            System.out.println("GEMINI SUCCESS - FALLBACK AI");
            System.out.println("======================================");

            return geminiResult;
        }

        // ============================================
        // 3. BOTH AI SERVICES FAILED
        // ============================================

        System.out.println("======================================");
        System.out.println("GROQ FAILED");
        System.out.println("GEMINI FAILED");
        System.out.println("BOTH AI SERVICES FAILED");
        System.out.println("RETURNING GROQ ERROR TO FRONTEND");
        System.out.println("======================================");

        return groqResult;
    }
}