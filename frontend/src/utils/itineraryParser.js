import { parseMoneyAmount } from "./currency.js";

/**
 * Text cleanup utilities
 */
export const cleanText = (text) =>
  String(text || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

export const cleanHeading = (text) =>
  cleanText(String(text || "").replace(/^#{1,6}\s*/, ""));

export const removeListMarker = (text) =>
  String(text || "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
    .trim();

export const normalizeKey = (text) =>
  cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/**
 * Detects if a line is a cost item under Estimated Day Cost or similar
 */
export const parseCostLine = (plainLine) => {
  const line = removeListMarker(plainLine);

  // Subtotal / Daily total
  const subtotalMatch = line.match(
    /^(?:day\s*subtotal|daily\s*total|estimated\s*daily\s*total|day\s*total|subtotal|total)\s*:\s*(.+)$/i
  );
  if (subtotalMatch) {
    return { type: "subtotal", amount: parseMoneyAmount(subtotalMatch[1]), raw: subtotalMatch[1] };
  }

  // Accommodation
  const accomMatch = line.match(/^(?:accommodation|hotel|stay|lodging)\s*:\s*(.+)$/i);
  if (accomMatch) {
    return { type: "accommodation", amount: parseMoneyAmount(accomMatch[1]), raw: accomMatch[1] };
  }

  // Food
  const foodMatch = line.match(/^(?:food|meals?|dining)\s*:\s*(.+)$/i);
  if (foodMatch) {
    return { type: "food", amount: parseMoneyAmount(foodMatch[1]), raw: foodMatch[1] };
  }

  // Transport
  const transportMatch = line.match(/^(?:local\s*transport(?:ation)?|transport(?:ation)?|transit)\s*:\s*(.+)$/i);
  if (transportMatch) {
    return { type: "transport", amount: parseMoneyAmount(transportMatch[1]), raw: transportMatch[1] };
  }

  // Activities & Attractions
  const actMatch = line.match(/^(?:activities\s*and\s*attractions|attractions\s*and\s*activities|activities|attractions|sightseeing)\s*:\s*(.+)$/i);
  if (actMatch) {
    return { type: "activities", amount: parseMoneyAmount(actMatch[1]), raw: actMatch[1] };
  }

  // Other
  const otherMatch = line.match(/^(?:other\s*(?:applicable\s*)?expenses|other|miscellaneous|contingency)\s*:\s*(.+)$/i);
  if (otherMatch) {
    return { type: "other", amount: parseMoneyAmount(otherMatch[1]), raw: otherMatch[1] };
  }

  return null;
};

/**
 * Heading detection
 */
export const isDayHeading = (line) => {
  const text = cleanHeading(line)
    .replace(/^[^\w#*]+/, "")
    .replace(/^\*+|\*+$/g, "")
    .trim();

  return text.match(/^(?:#{1,4}\s*)?Day\s+(\d+)\b[:\s\-–—]*(.*)$/i);
};

export const isCostHeading = (line) => {
  if (!line) return false;
  const text = cleanHeading(line).toLowerCase().trim();
  return /^(?:estimated\s*day\s*costs?|daily\s*costs?|day\s*costs?|estimated\s*daily\s*expenses|estimated\s*day\s*expenses|daily\s*expenses)$/i.test(text);
};

export const isTimeHeading = (line) => {
  if (!line) return null;
  const trimmed = line.trim();

  // Bullets and numbered list items are NEVER time headings
  if (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
    return null;
  }

  // Horizontal rules / dividers are NEVER time headings
  if (/^[-*_]{3,}$/.test(trimmed)) {
    return null;
  }

  // Cost headings or cost lines are NEVER time headings
  if (isCostHeading(trimmed) || parseCostLine(trimmed)) {
    return null;
  }

  const text = cleanHeading(trimmed)
    .replace(/^[^\w#*]+/, "")
    .replace(/^\*+|\*+$/g, "")
    .replace(/:$/, "")
    .trim();

  return text.match(
    /^(Morning|Afternoon|Evening|Night|Activities|Activity|Shopping|Getting Around)$/i
  );
};

export const isSummaryHeading = (line) => {
  const text = cleanHeading(line).toLowerCase();
  return (
    text.includes("trip budget") ||
    text.includes("budget summary") ||
    text.includes("expense summary") ||
    text.includes("estimated expenses") ||
    text.includes("cost summary") ||
    text.includes("final budget") ||
    text.includes("total cost") ||
    text.includes("estimated total")
  );
};

export const isTipsHeading = (line) => {
  const text = cleanHeading(line).toLowerCase();
  return (
    text.includes("smarttrip tips") ||
    text.includes("travel tips") ||
    text === "tips" ||
    text.includes("tips &") ||
    text.includes("practical travel tips")
  );
};

/**
 * Detects if a text string represents a monetary cost, price, or fee rather than a place
 */
export const isMoneyOrCost = (str) => {
  if (!str) return false;
  const s = String(str).trim();
  if (!s) return false;

  // Currency symbols: $, €, £, ₹, ¥, ₩
  if (/^[₹$€£¥₩]/.test(s)) return true;

  // Currency codes
  if (/\b(?:usd|inr|eur|gbp|jpy|aud|cad|chf|cny|sgd|hkd|nzd|krw)\b/i.test(s)) return true;

  // Cost/price labels and prefixes
  if (/^(?:cost|approx\.?\s*cost|price|fee|admission|ticket|subtotal|total|budget)\b/i.test(s)) return true;
  if (/\b(?:per\s*person|per\s*day|per\s*ticket|entry\s*fee|admission\s*fee|ticket\s*price)\b/i.test(s)) return true;
  if (/^(?:free|free\s*admission|free\s*entry|no\s*cost)$/i.test(s)) return true;

  // Numbers only, with commas, decimals, or 'k'/'m' suffixes (e.g. 25, 1,500, 50k, 25.00)
  if (/^[-+]?[\d,]+(?:\.\d+)?\s*[kKmM]?$/.test(s)) return true;

  // Price ranges like 10 - 20 or $10 - $25
  if (/^[-+]?[\d,]+(?:\.\d+)?\s*[-–—]\s*[-+]?[\d,]+(?:\.\d+)?$/i.test(s)) return true;

  return false;
};

/**
 * Place extraction helper
 */
export const inferPlaceFromActivity = (activity) => {
  let text = cleanText(activity);
  if (!text) return "";

  // Strip leading time prefixes or activity markers
  text = text.replace(/^(?:morning|afternoon|evening|night|activity)\s*:?\s*/i, "").trim();

  const patterns = [
    /^(?:visit|visiting|explore|exploring|see|seeing|tour|touring|discover|discovering|experience|experiencing|head to|go to|travel to|stop at|stop by)\s+(.+)$/i,
    /^(?:walk\s+(?:through|around|along)|stroll\s+(?:through|around|along)|wander\s+(?:through|around|in)|hike\s+(?:up|to|around)?|climb|check\s+out|spend\s+(?:time\s+)?at|day\s+trip\s+to|take\s+(?:a\s+)?(?:ferry|boat|cruise|cable\s*car|tram)\s+(?:to|along|at)?)\s+(.+)$/i,
    /^(?:breakfast|lunch|dinner|meal|coffee|tea|snacks?)\s+(?:at|in|near)\s+(.+)$/i,
    /^(?:have|enjoy|grab|get)\s+(?:breakfast|lunch|dinner|coffee|tea|snacks?)\s+(?:at|in|near)\s+(.+)$/i,
    /^(?:shop|shopping)\s+(?:at|in|near)\s+(.+)$/i,
    /^(?:relax|relaxing)\s+(?:at|in|near)\s+(.+)$/i,
    /^(?:photograph|photography|photos?|sunset)\s+(?:at|in|near)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let candidate = cleanText(
        match[1].replace(
          /\s+(?:for|during|in the|at the)\s+(?:morning|afternoon|evening|night).*$/i,
          ""
        )
      );
      candidate = candidate.split(/\s+[—–-]\s+/)[0];
      candidate = candidate.replace(/\s+(?:and\s+(?:have|enjoy|eat|grab|shop|relax|dine)).*$/i, "");
      candidate = candidate.replace(/[,;.]\s*$/, "").trim();
      if (candidate && !isMoneyOrCost(candidate)) {
        return candidate;
      }
    }
  }

  // Landmark noun detection heuristic (e.g., "Louvre Museum", "Eiffel Tower", "Senso-ji Temple")
  if (
    /\b(?:museum|tower|temple|fort|palace|park|shrine|market|bridge|garden|gardens|square|cathedral|castle|beach|falls|monument|statue|sanctuary|lake|island|aquarium|zoo|gallery|bazaar)\b/i.test(text)
  ) {
    const landmark = text.split(/\s+[—–-]\s+/)[0].replace(/[,;.]\s*$/, "").trim();
    if (landmark && landmark.split(/\s+/).length <= 6 && !isMoneyOrCost(landmark)) {
      return landmark;
    }
  }

  return "";
};

export const createEmptyDay = (number, title = "") => ({
  number: String(number),
  title: cleanHeading(title) || "",
  sections: [],
  costBreakdown: {
    accommodation: null,
    food: null,
    transport: null,
    activities: null,
    other: null,
    subtotal: null,
    isComplete: true,
  },
  total: "",
  places: [],
  food: [],
});

export const getOrCreateSection = (day, title) => {
  const cleanTitle = cleanHeading(title);
  let section = day.sections.find(
    (item) => item.title.toLowerCase() === cleanTitle.toLowerCase()
  );

  if (!section) {
    section = {
      key: normalizeKey(cleanTitle),
      title: cleanTitle,
      items: [],
    };
    day.sections.push(section);
  }

  return section;
};

export const addPlaceToDay = (day, place) => {
  if (!place || !day) return;
  const name = cleanText(place);
  if (!name || name.length <= 1) return;

  // Never add money, prices, or generic non-place labels
  if (isMoneyOrCost(name)) return;
  if (
    /^(?:hotel|accommodation|lodging|airport|flight|breakfast|lunch|dinner|meal|meals|free\s*time|leisure|rest|transit|day\s*\d+|morning|afternoon|evening|night|activities|subtotal|total)$/i.test(
      name
    )
  ) {
    return;
  }

  if (!day.places.some((p) => p.toLowerCase() === name.toLowerCase())) {
    day.places.push(name);
  }
};

/**
 * Split activity line into activity, place, notes, cost
 */
export const splitActivityLine = (rawLine) => {
  const emptyResult = { activity: "", place: "", notes: "", cost: "" };
  if (!rawLine) return emptyResult;

  let text = cleanText(rawLine);
  text = removeListMarker(text);
  text = text.replace(/^\*{1,2}|\*{1,2}$/g, "").trim();

  // Strip explicit Activity: prefix
  text = text
    .replace(/^(?:activity|activities)\s*:\s*/i, "")
    .replace(/\s+place\s*:\s*/i, " — ");

  let place = "";
  let cost = "";
  let notes = "";

  // Check explicit place marker: "Place: Eiffel Tower"
  const placeMatch = text.match(/\bplace\s*:\s*(.+)$/i);
  if (placeMatch) {
    const candidate = cleanText(placeMatch[1]);
    if (!isMoneyOrCost(candidate)) {
      place = candidate;
    }
    text = text.slice(0, placeMatch.index).trim().replace(/[—–-]\s*$/, "").trim();
  }

  // Check dash separated: "Tour Museum — Louvre" or "Visit Eiffel Tower — $30"
  const parts = text.split(/\s+[—–-]\s+/).map(cleanText).filter(Boolean);
  let activity = "";

  if (parts.length >= 2) {
    activity = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (isMoneyOrCost(part)) {
        if (!cost) cost = part;
      } else if (!place) {
        place = part;
      } else if (!notes) {
        notes = part;
      } else {
        notes += " — " + part;
      }
    }
  } else {
    activity = parts[0] || text;
  }

  // If place was not provided or was accidentally money, infer from activity
  if (!place || isMoneyOrCost(place)) {
    place = inferPlaceFromActivity(activity);
  }
  if (isMoneyOrCost(place)) {
    place = "";
  }

  const normalized = activity.toLowerCase();
  if (
    !normalized ||
    /^(activity|activities|place|notes?|cost|approx\.?\s*cost)$/.test(normalized) ||
    /^[-*_]{2,}$/.test(normalized) ||
    /^(?:estimated\s*day\s*cost|daily\s*expenses)$/i.test(normalized)
  ) {
    return emptyResult;
  }

  return { activity, place, notes, cost };
};



/**
 * Main itinerary parser
 */
export const parseItinerary = (
  raw,
  fallbackDestination,
  fallbackDays,
  fallbackBudget,
  fallbackInterests
) => {
  const parsed = {
    title: fallbackDestination || "Your SmartTrip Journey",
    overview: [],
    meta: {
      budget: fallbackBudget ? String(fallbackBudget) : "",
      interests: fallbackInterests || "",
      currency: "",
      transport: "",
    },
    days: [],
    budgetSummary: [],
    finalTotal: "",
    finalTips: [],
  };

  const lines = String(raw || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim());

  let currentDay = null;
  let currentSection = null;
  let mode = "overview";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || /^[-*_]{3,}$/.test(line.trim())) continue;

    // 1. Day Heading Check
    const dayMatch = isDayHeading(line);
    if (dayMatch) {
      currentDay = createEmptyDay(dayMatch[1], dayMatch[2]);
      parsed.days.push(currentDay);
      currentSection = null;
      mode = "day";
      continue;
    }

    // 2. Tips Heading Check
    if (isTipsHeading(line)) {
      mode = "tips";
      currentSection = null;
      continue;
    }

    // 3. Summary Heading Check
    if (isSummaryHeading(line)) {
      mode = "summary";
      currentSection = null;
      continue;
    }

    // 4. Cost Heading Check e.g. **Estimated Day Cost**
    if (isCostHeading(line)) {
      currentSection = null;
      continue;
    }

    // 5. Time Section Check
    const timeMatch = isTimeHeading(line);
    if (timeMatch && currentDay) {
      const sectionName = cleanHeading(timeMatch[1]);
      currentSection = getOrCreateSection(currentDay, sectionName);
      mode = "day";
      continue;
    }

    const plainLine = cleanText(line);

    // 6. Metadata Check (only before days start)
    if (!currentDay) {
      const metadataMatch = plainLine.match(
        /^(?:[-•*]\s*)?(Budget|Interests|Currency|Transport)\s*:?\s*(.+)$/i
      );
      if (metadataMatch) {
        const key = metadataMatch[1].toLowerCase();
        parsed.meta[key] = cleanText(metadataMatch[2]);
        continue;
      }
    }

    // 7. Day Content Parsing
    if (currentDay && mode === "day") {
      // Check if this line is an itemized cost line
      const costItem = parseCostLine(plainLine);
      if (costItem) {
        if (costItem.type === "subtotal") {
          currentDay.costBreakdown.subtotal = costItem.amount;
          currentDay.total = costItem.amount != null ? String(costItem.amount) : costItem.raw;
        } else {
          currentDay.costBreakdown[costItem.type] = costItem.amount;
        }
        continue;
      }

      // Explicit Places line: "- Place: Eiffel Tower" or "Places: Louvre, Tuileries"
      const strippedPlace = removeListMarker(plainLine);
      if (/^places?\s*:/i.test(strippedPlace)) {
        const places = strippedPlace
          .replace(/^places?\s*:/i, "")
          .split(/[,•]/)
          .map(cleanText)
          .filter((p) => p && !isMoneyOrCost(p));
        places.forEach((p) => addPlaceToDay(currentDay, p));

        // If an explicit Place line follows an activity item, attach the explicit place
        if (currentSection && currentSection.items.length > 0 && places.length > 0) {
          const lastItem = currentSection.items[currentSection.items.length - 1];
          lastItem.place = places[0];
        }
        continue;
      }

      // Explicit Food line
      if (/^food\s*:/i.test(plainLine)) {
        const foods = plainLine
          .replace(/^food\s*:/i, "")
          .split(/[,•]/)
          .map(cleanText)
          .filter(Boolean);
        currentDay.food.push(...foods);
        continue;
      }

      // Bullet Activity
      const isBullet = /^[-*•]\s+/.test(line);
      if (isBullet) {
        const stripped = removeListMarker(line);
        const activity = splitActivityLine(stripped);
        if (activity.activity) {
          const section = currentSection || getOrCreateSection(currentDay, "Activities");
          section.items.push(activity);
          if (activity.place) addPlaceToDay(currentDay, activity.place);
        }
        continue;
      }

      // Non-bullet Activity fallback
      if (
        plainLine &&
        !/^[-*_]{2,}$/.test(plainLine) &&
        !/^(?:activity|activities|notes?|cost|place|places|food|transport|morning|afternoon|evening|night|getting around|estimated\s*day\s*cost)\s*:?$/i.test(plainLine)
      ) {
        const activity = splitActivityLine(plainLine);
        if (activity.activity) {
          const section = currentSection || getOrCreateSection(currentDay, "Activities");
          section.items.push(activity);
          if (activity.place) addPlaceToDay(currentDay, activity.place);
        }
      }
    }

    // 7. Summary Mode Parsing
    if (mode === "summary") {
      const summaryLine = removeListMarker(plainLine);
      if (!summaryLine) continue;

      const totalMatch = summaryLine.match(
        /^(?:estimated\s*total|total\s*trip\s*cost|final\s*total|total)\s*:\s*(.+)$/i
      );
      if (totalMatch) {
        parsed.finalTotal = cleanText(totalMatch[1]);
        continue;
      }

      const colonMatch = summaryLine.match(/^(.+?)\s*:\s*(.+)$/);
      if (colonMatch) {
        const itemLabel = cleanText(colonMatch[1]);
        const itemVal = cleanText(colonMatch[2]);
        if (
          itemLabel &&
          itemVal &&
          !/^(?:approx|item|amount|day|assumptions?)$/i.test(itemLabel)
        ) {
          parsed.budgetSummary.push({ item: itemLabel, amount: itemVal });
        }
      }
    }

    // 8. Tips Mode Parsing
    if (mode === "tips") {
      const tip = removeListMarker(plainLine);
      if (tip && !/^smarttrip tips$/i.test(tip)) {
        parsed.finalTips.push(tip);
      }
    }

    // 9. Overview Mode Parsing
    if (mode === "overview" && !currentDay) {
      const heading = cleanHeading(line);
      if (
        heading &&
        !heading.toUpperCase().startsWith("YOUR SMARTTRIP") &&
        !heading.toUpperCase().startsWith("SMARTTRIP")
      ) {
        if (!heading.match(/^(Budget|Interests|Currency|Transport|Estimated|Final|Tips)/i)) {
          parsed.overview.push(heading);
        }
      }
    }
  }

  // =========================================================================
  // POST-PROCESSING & BUDGET RECONCILIATION
  // =========================================================================

  let calculatedTripTotal = 0;
  let allDaysHaveTotals = parsed.days.length > 0;

  parsed.days.forEach((day) => {
    // Infer places for any activity missing place
    day.sections.forEach((sec) => {
      sec.items.forEach((item) => {
        if (!item.place && item.activity) {
          const inf = inferPlaceFromActivity(item.activity);
          if (inf) item.place = inf;
        }
        if (item.place) addPlaceToDay(day, item.place);
      });
    });

    // If day subtotal was missing, compute from category breakdown
    const cb = day.costBreakdown;
    const catSum =
      (cb.accommodation || 0) +
      (cb.food || 0) +
      (cb.transport || 0) +
      (cb.activities || 0) +
      (cb.other || 0);

    if (cb.subtotal != null && Number.isFinite(cb.subtotal)) {
      day.total = String(cb.subtotal);
      day.dayTotal = cb.subtotal;
      calculatedTripTotal += cb.subtotal;
    } else if (catSum > 0) {
      cb.subtotal = catSum;
      day.total = String(catSum);
      day.dayTotal = catSum;
      calculatedTripTotal += catSum;
    } else {
      const parsedTotal = parseMoneyAmount(day.total);
      if (parsedTotal != null && Number.isFinite(parsedTotal)) {
        day.dayTotal = parsedTotal;
        calculatedTripTotal += parsedTotal;
      } else {
        day.dayTotal = null;
        allDaysHaveTotals = false;
        cb.isComplete = false;
      }
    }
  });

  // Reconcile Final Total:
  // Must reconcile with daily totals and prevent double counting.
  // One-time expenses (such as intercity travel or contingency) can be included from budgetSummary.
  const parsedFinalTotal = parseMoneyAmount(parsed.finalTotal);

  if (allDaysHaveTotals) {
    // Check if there are legitimate one-time expenses (intercity travel)
    let oneTimeExpenses = 0;
    parsed.budgetSummary.forEach((row) => {
      if (/intercity|flights?|trains?|flights?\s*and\s*trains?/i.test(row.item)) {
        const val = parseMoneyAmount(row.amount);
        if (val != null && Number.isFinite(val)) {
          oneTimeExpenses += val;
        }
      }
    });

    const reconciledTotal = calculatedTripTotal + oneTimeExpenses;

    if (parsedFinalTotal == null || Math.abs(parsedFinalTotal - reconciledTotal) > 0.01) {
      // Use reconciled total to guarantee exact mathematical alignment across all days
      parsed.finalTotal = String(reconciledTotal);
    }
  } else if (parsedFinalTotal == null && calculatedTripTotal > 0) {
    parsed.finalTotal = String(calculatedTripTotal);
  }

  // Populate budgetSummary fallback if missing
  if (parsed.budgetSummary.length === 0 && parsed.days.length > 0) {
    let sumAccom = 0;
    let sumFood = 0;
    let sumTrans = 0;
    let sumAct = 0;
    let sumOther = 0;

    parsed.days.forEach((day) => {
      const cb = day.costBreakdown;
      if (cb.accommodation) sumAccom += cb.accommodation;
      if (cb.food) sumFood += cb.food;
      if (cb.transport) sumTrans += cb.transport;
      if (cb.activities) sumAct += cb.activities;
      if (cb.other) sumOther += cb.other;
    });

    if (sumAccom > 0) parsed.budgetSummary.push({ item: "Accommodation", amount: String(sumAccom) });
    if (sumFood > 0) parsed.budgetSummary.push({ item: "Food & Dining", amount: String(sumFood) });
    if (sumTrans > 0) parsed.budgetSummary.push({ item: "Local Transport", amount: String(sumTrans) });
    if (sumAct > 0) parsed.budgetSummary.push({ item: "Activities & Attractions", amount: String(sumAct) });
    if (sumOther > 0) parsed.budgetSummary.push({ item: "Other Expenses", amount: String(sumOther) });
  }

  // Filter out completely empty ghost days
  parsed.days = parsed.days.filter(
    (day) =>
      day.title ||
      day.sections.length ||
      day.total ||
      day.places.length ||
      day.food.length
  );

  parsed.calculatedTotalCost = calculatedTripTotal;
  parsed.reconciledTotal = parseMoneyAmount(parsed.finalTotal);

  return parsed;
};
