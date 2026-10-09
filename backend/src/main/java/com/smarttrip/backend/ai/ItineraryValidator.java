package com.smarttrip.backend.ai;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ItineraryValidator {

    /**
     * Matches day headings in varied Markdown and plain text formats:
     * Examples:
     * - ## Day 1 - Theme
     * - ### Day 1: Arrival
     * - Day 1: Exploring Rome
     * - **Day 1: Arrival**
     * - # Day 1
     */
    private static final Pattern DAY_HEADING_PATTERN = Pattern.compile(
            "(?im)^(?:#{1,4}\\s*|\\*{0,2})Day\\s+(\\d+)\\b[:\\s\\-–—]*(.*?)(?:\\*{0,2})?$"
    );

    public record ValidationResult(boolean valid, String message, int daysFound, List<Integer> dayNumbers) {
        public static ValidationResult success(int daysFound, List<Integer> dayNumbers) {
            return new ValidationResult(true, "Validation passed", daysFound, dayNumbers);
        }

        public static ValidationResult failure(String message, int daysFound, List<Integer> dayNumbers) {
            return new ValidationResult(false, message, daysFound, dayNumbers);
        }
    }

    public static ValidationResult validate(String text, int requestedDays) {
        if (text == null || text.isBlank()) {
            return ValidationResult.failure("Itinerary text is null or blank", 0, List.of());
        }

        String trimmed = text.trim();
        String lower = trimmed.toLowerCase(Locale.ROOT);

        // Reject explicit error outputs or server error codes
        if (lower.startsWith("groq error:")
                || lower.startsWith("gemini error:")
                || lower.startsWith("unable to generate")
                || lower.contains("resource_exhausted")
                || lower.contains("http status: 5")
                || lower.contains("http status: 4")) {
            return ValidationResult.failure("Provider returned an error message instead of an itinerary", 0, List.of());
        }

        Matcher matcher = DAY_HEADING_PATTERN.matcher(trimmed);
        List<Integer> dayNumbers = new ArrayList<>();
        List<Integer> headingStartPositions = new ArrayList<>();

        while (matcher.find()) {
            try {
                int dayNum = Integer.parseInt(matcher.group(1));
                dayNumbers.add(dayNum);
                headingStartPositions.add(matcher.start());
            } catch (NumberFormatException ignored) {
                // Ignore invalid numbers
            }
        }

        if (dayNumbers.isEmpty()) {
            return ValidationResult.failure("No valid day headings found in itinerary", 0, List.of());
        }

        if (dayNumbers.size() != requestedDays) {
            return ValidationResult.failure(
                    "Requested " + requestedDays + " days but received " + dayNumbers.size() + " days",
                    dayNumbers.size(),
                    dayNumbers
            );
        }

        // Verify day numbers are strictly 1, 2, ..., requestedDays
        for (int i = 0; i < requestedDays; i++) {
            int expected = i + 1;
            int actual = dayNumbers.get(i);
            if (actual != expected) {
                return ValidationResult.failure(
                        "Day numbering mismatch: expected Day " + expected + " but found Day " + actual,
                        dayNumbers.size(),
                        dayNumbers
                );
            }
        }

        // Find where the budget section starts (if present)
        int budgetStart = lower.indexOf("## estimated trip budget");
        if (budgetStart < 0) {
            budgetStart = lower.indexOf("estimated trip budget");
        }
        if (budgetStart < 0) {
            budgetStart = lower.indexOf("## trip budget");
        }
        if (budgetStart < 0) {
            budgetStart = lower.indexOf("## estimated expenses");
        }

        // Validate the content of each day: a heading alone must not count as a valid day
        for (int i = 0; i < requestedDays; i++) {
            int start = headingStartPositions.get(i);
            int end = (i + 1 < headingStartPositions.size())
                    ? headingStartPositions.get(i + 1)
                    : (budgetStart > start ? budgetStart : trimmed.length());

            if (end <= start) {
                return ValidationResult.failure("Day " + (i + 1) + " has empty content range", dayNumbers.size(), dayNumbers);
            }

            String dayContent = trimmed.substring(start, end).trim();

            // A valid day must contain substantial content (at least 60 characters)
            if (dayContent.length() < 60) {
                return ValidationResult.failure("Day " + (i + 1) + " contains only a heading or insufficient content", dayNumbers.size(), dayNumbers);
            }

            String dayLower = dayContent.toLowerCase(Locale.ROOT);

            // Verify the day contains activity descriptions or time sections
            boolean hasActivities = dayLower.contains("morning")
                    || dayLower.contains("afternoon")
                    || dayLower.contains("evening")
                    || dayLower.contains("getting around")
                    || dayLower.contains("visit")
                    || dayLower.contains("explore")
                    || dayLower.contains("- ")
                    || dayLower.contains("* ");

            if (!hasActivities) {
                return ValidationResult.failure("Day " + (i + 1) + " lacks activity recommendations", dayNumbers.size(), dayNumbers);
            }

            // Verify the day contains cost estimation lines
            boolean hasCost = dayLower.contains("cost")
                    || dayLower.contains("subtotal")
                    || dayLower.contains("transport")
                    || dayLower.contains("food")
                    || dayLower.contains("budget");

            if (!hasCost) {
                return ValidationResult.failure("Day " + (i + 1) + " lacks daily cost estimates", dayNumbers.size(), dayNumbers);
            }
        }

        // Check for budget section with total
        boolean hasBudgetSection = (budgetStart >= 0)
                || lower.contains("estimated total")
                || lower.contains("total trip cost")
                || lower.contains("trip budget");

        if (!hasBudgetSection) {
            return ValidationResult.failure("Itinerary is missing final budget section or estimated total", dayNumbers.size(), dayNumbers);
        }

        return ValidationResult.success(dayNumbers.size(), dayNumbers);
    }
}
