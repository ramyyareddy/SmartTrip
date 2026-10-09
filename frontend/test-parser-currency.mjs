import assert from "node:assert";
import { parseItinerary } from "./src/utils/itineraryParser.js";
import { convertCurrency, formatMoney, parseMoneyAmount } from "./src/utils/currency.js";

console.log("--- RUNNING FRONTEND PARSER & CURRENCY TEST SUITE ---");

// Test 1: Currency amount parsing
assert.strictEqual(parseMoneyAmount(120), 120);
assert.strictEqual(parseMoneyAmount("$250"), 250);
assert.strictEqual(parseMoneyAmount("₹1,500.50"), 1500.5);
assert.strictEqual(parseMoneyAmount("FREE"), 0);
assert.strictEqual(parseMoneyAmount("Free of charge"), 0);
assert.strictEqual(parseMoneyAmount("5k"), 5000);
assert.strictEqual(parseMoneyAmount(null), null);
assert.strictEqual(parseMoneyAmount("invalid"), null);
console.log("✓ Test 1 Passed: parseMoneyAmount handles formats, symbols, k/m suffixes, and Free");

// Test 2: Currency formatting
assert.ok(formatMoney(100, "USD").includes("100"));
assert.ok(formatMoney(2500, "INR").includes("2,500") || formatMoney(2500, "INR").includes("2500"));
assert.strictEqual(formatMoney(null, "USD"), "—");
console.log("✓ Test 2 Passed: formatMoney formats values cleanly");

// Test 3: Currency conversion
const sampleRates = { USD: 1.0, EUR: 0.92, INR: 86.5 };
const convertedEur = convertCurrency(100, "USD", "EUR", sampleRates);
assert.strictEqual(convertedEur.converted, true);
assert.strictEqual(convertedEur.amount, 92);

const sameCurrency = convertCurrency(500, "INR", "INR", sampleRates);
assert.strictEqual(sameCurrency.converted, true);
assert.strictEqual(sameCurrency.amount, 500);

const missingRate = convertCurrency(100, "USD", "XYZ", sampleRates);
assert.strictEqual(missingRate.converted, false);
assert.strictEqual(missingRate.amount, 100);
console.log("✓ Test 3 Passed: convertCurrency converts with rates and safeguards against false conversions");

// Test 4: Parse 7-day itinerary
const sample7DayMarkdown = `
# 7-Day Trip to Tokyo

### Day 1: Arrival & Shinjuku
- Morning: Land at Narita Airport and transfer to hotel. Cost: $40.
- Afternoon: Explore Shinjuku Gyoen National Garden. Cost: $10.
- Evening: Dinner at Omoide Yokocho. Cost: $25.
- Accommodation: $120.
- Food: $45.
- Transportation: $40.
- Activities: $10.
- Day Subtotal: $215.

### Day 2: Shibuya & Harajuku
- Morning: Shibuya Crossing & Hachiko. Cost: Free.
- Afternoon: Meiji Shrine and Takeshita Street. Cost: $15.
- Evening: Shibuya Sky observatory. Cost: $22.
- Accommodation: $120.
- Food: $50.
- Transportation: $15.
- Activities: $37.
- Day Subtotal: $222.

### Day 3: Asakusa & Akihabara
- Morning: Senso-ji Temple. Cost: Free.
- Afternoon: Akihabara electronics district. Cost: $30.
- Evening: Tokyo Skytree view. Cost: $25.
- Accommodation: $120.
- Food: $45.
- Transportation: $15.
- Activities: $55.
- Day Subtotal: $235.

### Day 4: Day Trip to Kamakura
- Morning: Enoden train to Great Buddha. Cost: $20.
- Afternoon: Hase-dera temple and Yuigahama beach. Cost: $15.
- Evening: Return to Tokyo for ramen dinner. Cost: $18.
- Accommodation: $120.
- Food: $40.
- Transportation: $35.
- Activities: $35.
- Day Subtotal: $230.

### Day 5: Tsukiji & Ginza
- Morning: Tsukiji Outer Market breakfast. Cost: $35.
- Afternoon: Art Aquarium Museum in Ginza. Cost: $20.
- Evening: Dinner in Ginza. Cost: $50.
- Accommodation: $120.
- Food: $85.
- Transportation: $12.
- Activities: $20.
- Day Subtotal: $237.

### Day 6: Odaiba & TeamLab Planets
- Morning: TeamLab Planets immersive digital art. Cost: $38.
- Afternoon: Odaiba Seaside Park and Gundam statue. Cost: Free.
- Evening: Rainbow Bridge sunset and dining. Cost: $40.
- Accommodation: $120.
- Food: $55.
- Transportation: $15.
- Activities: $38.
- Day Subtotal: $228.

### Day 7: Ueno & Departure
- Morning: Ueno Park & Tokyo National Museum. Cost: $10.
- Afternoon: Souvenir shopping at Ameyoko Market. Cost: $30.
- Evening: Narita Express to airport. Cost: $30.
- Accommodation: $0.
- Food: $40.
- Transportation: $30.
- Activities: $40.
- Day Subtotal: $110.

## Estimated Trip Budget
- Accommodation: $720
- Food: $360
- Local Transportation: $162
- Activities & Attractions: $235
- Total Estimated Cost: $1477
`;

const parsed = parseItinerary(sample7DayMarkdown);
assert.strictEqual(parsed.days.length, 7, "Should have exactly 7 parsed days");
assert.strictEqual(parsed.days[0].number, "1");
assert.strictEqual(parsed.days[6].number, "7");

// Verify Day 1 breakdown
const day1 = parsed.days[0];
assert.strictEqual(day1.costBreakdown.accommodation, 120);
assert.strictEqual(day1.costBreakdown.food, 45);
assert.strictEqual(day1.costBreakdown.transport, 40);
assert.strictEqual(day1.costBreakdown.activities, 10);
assert.strictEqual(day1.dayTotal, 215);

// Verify Day Total calculation matches sum of category costs
const sumCategoriesDay1 = 120 + 45 + 40 + 10;
assert.strictEqual(day1.dayTotal, sumCategoriesDay1);

// Verify total budget reconciliation: sum of all days
const expectedSumDays = parsed.days.reduce((acc, d) => acc + (d.dayTotal || 0), 0);
assert.strictEqual(parsed.calculatedTotalCost, expectedSumDays);
console.log(`✓ Test 4 Passed: 7 days parsed accurately. Daily totals sum to ${parsed.calculatedTotalCost}, perfectly reconciling.`);

// Test 5: Reconciled final total vs AI total
assert.strictEqual(parsed.reconciledTotal, parsed.calculatedTotalCost);
console.log("✓ Test 5 Passed: Reconciled total successfully prevents double counting and discrepancies.");

console.log("\nALL FRONTEND UNIT TESTS PASSED SUCCESSFULLY! ✨");
