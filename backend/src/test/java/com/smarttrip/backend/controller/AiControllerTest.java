package com.smarttrip.backend.controller;

import com.smarttrip.backend.ai.AiTripRequest;
import com.smarttrip.backend.ai.GeminiService;
import com.smarttrip.backend.ai.GroqService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiControllerTest {

    @Mock
    private GroqService groqService;

    @Mock
    private GeminiService geminiService;

    private AiController aiController;

    @BeforeEach
    void setUp() {
        aiController = new AiController(groqService, geminiService);
    }

    private String createValidItinerary(int days) {
        StringBuilder sb = new StringBuilder();
        for (int i = 1; i <= days; i++) {
            sb.append("## Day ").append(i).append(" - Adventure ").append(i).append("\n");
            sb.append("**Morning**\n- Activity: Sightseeing historic locations.\n");
            sb.append("**Estimated Day Cost**\n- Transport: 20 USD\n- Day subtotal: 150 USD\n\n");
        }
        sb.append("## Estimated Trip Budget\n- Estimated total: ").append(150 * days).append(" USD\n");
        return sb.toString();
    }

    @Test
    @DisplayName("Groq success returns 200 and does NOT invoke Gemini fallback")
    void testGroqSuccessDoesNotCallGemini() {
        AiTripRequest request = new AiTripRequest("Tokyo", 3, 1000.0, "Food, anime");
        String validGroqResult = createValidItinerary(3);

        when(groqService.generateItinerary(any())).thenReturn(validGroqResult);

        ResponseEntity<String> response = aiController.generateItinerary(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(validGroqResult, response.getBody());
        verify(groqService, times(1)).generateItinerary(any());
        verify(geminiService, never()).generateItinerary(any());
    }

    @Test
    @DisplayName("Groq failure triggers Gemini fallback and succeeds")
    void testGroqFailureTriggersGeminiFallback() {
        AiTripRequest request = new AiTripRequest("Paris", 5, 2000.0, "Art, cuisine");
        String validGeminiResult = createValidItinerary(5);

        when(groqService.generateItinerary(any())).thenThrow(new IllegalStateException("Groq API rate limit or error"));
        when(geminiService.generateItinerary(any())).thenReturn(validGeminiResult);

        ResponseEntity<String> response = aiController.generateItinerary(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(validGeminiResult, response.getBody());
        verify(groqService, times(1)).generateItinerary(any());
        verify(geminiService, times(1)).generateItinerary(any());
    }

    @Test
    @DisplayName("Both Groq and Gemini fail returns 502 Bad Gateway with clear error")
    void testBothProvidersFailReturns502() {
        AiTripRequest request = new AiTripRequest("London", 7, 3000.0, "History");

        when(groqService.generateItinerary(any())).thenThrow(new IllegalStateException("Groq timeout"));
        when(geminiService.generateItinerary(any())).thenThrow(new IllegalStateException("Gemini quota exceeded"));

        ResponseEntity<String> response = aiController.generateItinerary(request);

        assertEquals(HttpStatus.BAD_GATEWAY, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().contains("Both AI providers were unable to fulfill the request"));
        verify(groqService, times(1)).generateItinerary(any());
        verify(geminiService, times(1)).generateItinerary(any());
    }

    @Test
    @DisplayName("Invalid request payload (zero days) returns 400 Bad Request")
    void testInvalidRequestDays() {
        AiTripRequest request = new AiTripRequest("Rome", 0, 1000.0, "Culture");

        ResponseEntity<String> response = aiController.generateItinerary(request);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(groqService, never()).generateItinerary(any());
        verify(geminiService, never()).generateItinerary(any());
    }

    @Test
    @DisplayName("Invalid request payload (negative budget) returns 400 Bad Request")
    void testNegativeBudget() {
        AiTripRequest request = new AiTripRequest("Rome", 3, -500.0, "Culture");

        ResponseEntity<String> response = aiController.generateItinerary(request);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(groqService, never()).generateItinerary(any());
        verify(geminiService, never()).generateItinerary(any());
    }
}
