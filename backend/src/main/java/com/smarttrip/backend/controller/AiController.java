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
        // 1. TRY GEMINI FIRST
        // ============================================

        System.out.println("TRYING GEMINI AI...");

        String geminiResult =
                geminiService.generateItinerary(request);

        if (geminiResult != null
                && !geminiResult.startsWith("GEMINI ERROR:")
                && !geminiResult.contains("RESOURCE_EXHAUSTED")) {

            System.out.println("======================================");
            System.out.println("GEMINI SUCCESS");
            System.out.println("======================================");

            return geminiResult;
        }

        // ============================================
        // 2. GEMINI FAILED → TRY GROQ
        // ============================================

        System.out.println("======================================");
        System.out.println("GEMINI FAILED");
        System.out.println("SWITCHING TO GROQ AI...");
        System.out.println("======================================");

        String groqResult =
                groqService.generateItinerary(request);

        if (groqResult != null
                && !groqResult.startsWith("GROQ ERROR:")
                && !groqResult.contains("HTTP Status:")) {

            System.out.println("======================================");
            System.out.println("GROQ SUCCESS");
            System.out.println("======================================");

            return groqResult;
        }

        // ============================================
        // 3. BOTH AI SERVICES FAILED
        // ============================================

        System.out.println("======================================");
        System.out.println("GEMINI FAILED");
        System.out.println("GROQ FAILED");
        System.out.println("RETURNING GEMINI ERROR TO FRONTEND");
        System.out.println("FRONTEND LOCAL FALLBACK CAN HANDLE THIS");
        System.out.println("======================================");

        return geminiResult;
    }
}