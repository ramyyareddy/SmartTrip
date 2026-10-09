package com.smarttrip.backend.ai;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ItineraryValidatorTest {

    private String generateSampleItinerary(int days) {
        StringBuilder sb = new StringBuilder();
        sb.append("# Sample Trip to Paris\n\n");
        for (int i = 1; i <= days; i++) {
            sb.append("## Day ").append(i).append(" - Paris Exploration ").append(i).append("\n\n");
            sb.append("**Morning**\n- Activity: Visit Eiffel Tower and Louvre Museum for 3 hours.\n- Place: Eiffel Tower\n\n");
            sb.append("**Afternoon**\n- Activity: Walk along the Seine and have lunch at Le Bistro.\n- Place: Seine River\n\n");
            sb.append("**Evening**\n- Activity: Dinner in Montmartre and sunset view at Sacre-Coeur.\n- Place: Sacre-Coeur\n\n");
            sb.append("**Getting Around**\n- Suggested metro lines 1 and 4, travel time 20 mins.\n\n");
            sb.append("**Estimated Day Cost**\n");
            sb.append("- Accommodation: 120 EUR\n");
            sb.append("- Food: 60 EUR\n");
            sb.append("- Local transport: 15 EUR\n");
            sb.append("- Activities and attractions: 35 EUR\n");
            sb.append("- Other applicable expenses: 10 EUR\n");
            sb.append("- Day subtotal: 240 EUR\n\n");
        }
        sb.append("## Estimated Trip Budget\n");
        sb.append("- Accommodation: ").append(120 * days).append(" EUR\n");
        sb.append("- Food: ").append(60 * days).append(" EUR\n");
        sb.append("- Local transport: ").append(15 * days).append(" EUR\n");
        sb.append("- Activities and attractions: ").append(35 * days).append(" EUR\n");
        sb.append("- Estimated total: ").append(240 * days).append(" EUR\n\n");
        sb.append("## Practical Travel Tips\n- Buy a Paris Visite travel pass.\n");
        return sb.toString();
    }

    @Test
    @DisplayName("3-day request returns exactly 3 complete days and passes validation")
    void testThreeDaysComplete() {
        String itinerary = generateSampleItinerary(3);
        ItineraryValidator.ValidationResult result = ItineraryValidator.validate(itinerary, 3);
        assertTrue(result.valid(), "3-day itinerary should be valid");
        assertEquals(3, result.daysFound());
    }

    @Test
    @DisplayName("5-day request returns exactly 5 complete days and passes validation")
    void testFiveDaysComplete() {
        String itinerary = generateSampleItinerary(5);
        ItineraryValidator.ValidationResult result = ItineraryValidator.validate(itinerary, 5);
        assertTrue(result.valid(), "5-day itinerary should be valid");
        assertEquals(5, result.daysFound());
    }

    @Test
    @DisplayName("7-day request returns exactly 7 complete days and passes validation")
    void testSevenDaysComplete() {
        String itinerary = generateSampleItinerary(7);
        ItineraryValidator.ValidationResult result = ItineraryValidator.validate(itinerary, 7);
        assertTrue(result.valid(), "7-day itinerary should be valid");
        assertEquals(7, result.daysFound());
    }

    @Test
    @DisplayName("Requested 7 days but received only 5 days is rejected")
    void testSevenDaysRequestedFiveReturned() {
        String fiveDaysItinerary = generateSampleItinerary(5);
        ItineraryValidator.ValidationResult result = ItineraryValidator.validate(fiveDaysItinerary, 7);
        assertFalse(result.valid(), "7-day request with 5 days returned must be invalid");
        assertTrue(result.message().contains("Requested 7 days but received 5 days"));
    }

    @Test
    @DisplayName("Missing day heading is detected and rejected")
    void testMissingDayHeading() {
        // Build 3 days but omit Day 2
        String text = """
                ## Day 1 - Arrival
                **Morning**
                - Activity: Visit Museum.
                **Estimated Day Cost**
                - Day subtotal: 100 USD
                
                ## Day 3 - Departure
                **Morning**
                - Activity: Shopping.
                **Estimated Day Cost**
                - Day subtotal: 100 USD
                
                ## Estimated Trip Budget
                - Estimated total: 200 USD
                """;

        ItineraryValidator.ValidationResult result = ItineraryValidator.validate(text, 3);
        assertFalse(result.valid(), "Missing Day 2 should fail validation");
    }

    @Test
    @DisplayName("A heading with no meaningful content is rejected")
    void testEmptyDayHeadingRejected() {
        String text = """
                ## Day 1 - Full Day
                **Morning**
                - Activity: Visit Museum for 2 hours.
                **Estimated Day Cost**
                - Food: 50 USD
                - Day subtotal: 100 USD
                
                ## Day 2 - Nothing here
                
                ## Day 3 - Full Day
                **Morning**
                - Activity: Explore the Castle.
                **Estimated Day Cost**
                - Day subtotal: 100 USD
                
                ## Estimated Trip Budget
                - Estimated total: 300 USD
                """;

        ItineraryValidator.ValidationResult result = ItineraryValidator.validate(text, 3);
        assertFalse(result.valid(), "Empty Day 2 should fail validation");
        assertTrue(result.message().contains("Day 2"));
    }

    @Test
    @DisplayName("Diverse heading formats (Day 1:, **Day 1:**, ### Day 1) are robustly parsed")
    void testDiverseHeadingFormats() {
        String text = """
                Day 1: Arrival and Exploration
                **Morning**
                - Activity: Visit Central Park.
                **Estimated Day Cost**
                - Transport: 10 USD
                - Day subtotal: 100 USD
                
                ### Day 2 - Museum Day
                **Morning**
                - Activity: Visit Metropolitan Museum.
                **Estimated Day Cost**
                - Food: 40 USD
                - Day subtotal: 120 USD
                
                **Day 3:** Scenic Walk
                **Morning**
                - Activity: Walk Brooklyn Bridge.
                **Estimated Day Cost**
                - Activities: 20 USD
                - Day subtotal: 80 USD
                
                ## Estimated Trip Budget
                - Estimated total: 300 USD
                """;

        ItineraryValidator.ValidationResult result = ItineraryValidator.validate(text, 3);
        assertTrue(result.valid(), "Diverse heading formats should be recognized");
        assertEquals(3, result.daysFound());
    }

    @Test
    @DisplayName("Provider error message string is rejected immediately")
    void testProviderErrorRejected() {
        String errorText = "GROQ ERROR: HTTP Status: 500 Internal Server Error";
        ItineraryValidator.ValidationResult result = ItineraryValidator.validate(errorText, 3);
        assertFalse(result.valid(), "Error message must be rejected");
    }

    @Test
    @DisplayName("Missing final budget section is detected and rejected")
    void testMissingBudgetSectionRejected() {
        // Complete 3 days but no budget section
        StringBuilder sb = new StringBuilder();
        for (int i = 1; i <= 3; i++) {
            sb.append("## Day ").append(i).append(" - Theme\n");
            sb.append("**Morning**\n- Activity: Explore city.\n");
            sb.append("**Estimated Day Cost**\n- Day subtotal: 100 USD\n\n");
        }
        ItineraryValidator.ValidationResult result = ItineraryValidator.validate(sb.toString(), 3);
        assertFalse(result.valid(), "Missing budget section must be rejected");
    }
}
