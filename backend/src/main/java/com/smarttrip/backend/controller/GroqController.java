package com.smarttrip.backend.controller;

import com.smarttrip.backend.ai.AiTripRequest;
import com.smarttrip.backend.ai.GroqService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/groq")
@CrossOrigin(origins = "*")
public class GroqController {

    private final GroqService groqService;

    public GroqController(GroqService groqService) {
        this.groqService = groqService;
    }

    @PostMapping("/itinerary")
    public String generateItinerary(
            @RequestBody AiTripRequest request) {

        return groqService.generateItinerary(request);
    }
}