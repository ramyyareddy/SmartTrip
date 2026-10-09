import { useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import "./App.css";
import TripMap from "./components/TripMap";

/* =========================================================
   SMARTTRIP BACKEND
========================================================= */

const BACKEND_URL = "https://smarttrips.up.railway.app";

/* =========================================================
   TRIP STYLES
========================================================= */

const tripStyles = [
  {
    id: "No Filter",
    emoji: "🧭",
    description:
      "Let SmartTrip create a balanced itinerary without a specific travel style",
  },
  {
    id: "Packed Explorer",
    emoji: "⚡",
    description: "See and experience as much as possible",
  },
  {
    id: "Slow Travel",
    emoji: "🌴",
    description: "Relaxed pace with plenty of free time",
  },
  {
    id: "Smart Saver",
    emoji: "💰",
    description: "Get the most value from your budget",
  },
  {
    id: "Comfort First",
    emoji: "✨",
    description: "Prioritize convenience and comfort",
  },
  {
    id: "Instagram Trip",
    emoji: "📸",
    description: "Focus on beautiful and photogenic places",
  },
  {
    id: "Local Experience",
    emoji: "🍜",
    description: "Discover authentic local experiences",
  },
];

/* =========================================================
   TEXT HELPERS
========================================================= */

const cleanText = (text) =>
  String(text || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const cleanHeading = (text) =>
  cleanText(String(text || "").replace(/^#{1,6}\s*/, ""));

const removeListMarker = (text) =>
  String(text || "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
    .trim();

const normalizeKey = (text) =>
  cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const parseTableRow = (line) => {
  if (!line || !line.includes("|")) {
    return null;
  }

  let cells = line
    .split("|")
    .map((cell) => cell.trim());

  if (cells[0] === "") {
    cells.shift();
  }

  if (cells[cells.length - 1] === "") {
    cells.pop();
  }

  return cells;
};

const isTableSeparator = (line) => {
  const cells = parseTableRow(line);

  if (!cells || !cells.length) {
    return false;
  }

  return cells.every((cell) =>
    /^:?-{2,}:?$/.test(
      cell.replace(/\s/g, "")
    )
  );
};

const isDayHeading = (line) => {
  const text = cleanHeading(line);

  return text.match(
    /^Day\s+(\d+)\s*(?:[-–—:]\s*)?(.*)$/i
  );
};

const isTimeHeading = (line) => {
  const text = cleanHeading(line);

  return text.match(
    /^(Morning|Afternoon|Evening|Shopping|Transport|Food|Meals?)$/i
  );
};

const isSummaryHeading = (line) => {
  const text = cleanHeading(line).toLowerCase();

  return (
    text.includes("estimated expenses") ||
    text.includes("expense summary") ||
    text.includes("budget summary") ||
    text.includes("cost summary") ||
    text.includes("final budget") ||
    text.includes("total cost") ||
    text.includes("estimated total")
  );
};

const isTipsHeading = (line) => {
  const text = cleanHeading(line).toLowerCase();

  return (
    text.includes("smarttrip tips") ||
    text.includes("travel tips") ||
    text === "tips" ||
    text.includes("tips &")
  );
};

/* =========================================================
   COST HELPERS
========================================================= */

const extractCost = (text) => {
  const value = cleanText(text);

  if (!value) {
    return "";
  }

  const parenthetical = value.match(
    /\(([^)]*(?:\d[\d.,]*\s*[kKmM]?|free)[^)]*)\)\s*$/i
  );

  if (parenthetical) {
    return cleanText(parenthetical[1]);
  }

  const direct = value.match(
    /(?:≈|~|about|approx\.?)?\s*(?:₹|\$|€|£)?\s*\d[\d.,]*\s*(?:k|K|m|M|[A-Z]{2,4})?\b/
  );

  if (direct) {
    return cleanText(direct[0]);
  }

  if (/^free$/i.test(value)) {
    return "Free";
  }

  return "";
};

/* =========================================================
   PLACE HELPERS
========================================================= */

/*
 * If the AI gives:
 *
 * Visit Charminar
 * Explore Golconda Fort
 * Lunch at Paradise
 *
 * but does not use "Activity — Place", this helper
 * tries to extract the actual place name.
 */
const inferPlaceFromActivity = (activity) => {
  const text = cleanText(activity);

  if (!text) {
    return "";
  }

  const patterns = [
    /^(?:visit|visiting|explore|exploring|see|seeing|tour|touring|discover|discovering|experience|experiencing|head to|go to|travel to|stop at|stop by)\s+(.+)$/i,

    /^(?:breakfast|lunch|dinner|meal|coffee|tea|snacks?)\s+(?:at|in|near)\s+(.+)$/i,

    /^(?:have|enjoy|grab|get)\s+(?:breakfast|lunch|dinner|coffee|tea|snacks?)\s+(?:at|in|near)\s+(.+)$/i,

    /^(?:shop|shopping)\s+(?:at|in|near)\s+(.+)$/i,

    /^(?:relax|relaxing)\s+(?:at|in|near)\s+(.+)$/i,

    /^(?:photograph|photography|photos?|sunset)\s+(?:at|in|near)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      return cleanText(
        match[1]
          .replace(
            /\s+(?:for|during|in the|at the)\s+(?:morning|afternoon|evening|night).*$/i,
            ""
          )
      );
    }
  }

  return "";
};

const addPlaceToDay = (day, place) => {
  const cleanPlace = cleanText(place);

  if (!day || !cleanPlace) {
    return;
  }

  const exists = day.places.some(
    (item) =>
      item.toLowerCase() ===
      cleanPlace.toLowerCase()
  );

  if (!exists) {
    day.places.push(cleanPlace);
  }
};

/* =========================================================
   ACTIVITY PARSER
========================================================= */

const splitActivityLine = (rawText) => {
  let text = removeListMarker(rawText);
  text = cleanText(text);

  if (!text) {
    return {
      activity: "",
      place: "",
      notes: "",
      cost: "",
    };
  }

  let notes = "";
  let cost = "";

  const costMarker = text.match(
    /(?:—|-)?\s*Approx\.?\s*Cost\s*:\s*(.*)$/i
  );

  if (costMarker) {
    const beforeCost = text
      .slice(0, costMarker.index)
      .replace(/[—-]\s*$/, "")
      .trim();

    notes = cleanText(
      costMarker[1]
    );

    const extractedCost =
      extractCost(notes);

    if (extractedCost) {
      cost = extractedCost;

      const escapedCost =
        extractedCost.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

      notes = notes
        .replace(
          new RegExp(
            `\\s*\\(${escapedCost}\\)\\s*$`,
            "i"
          ),
          ""
        )
        .trim();
    }

    text = beforeCost;
  }

  const parts = text
    .split(/\s+[—–-]\s+/)
    .map((part) => cleanText(part))
    .filter(Boolean);

  let activity = "";
  let place = "";

  if (parts.length >= 2) {
    activity = parts[0];
    place = parts[1];

    if (parts.length > 2) {
      notes = notes
        ? `${parts.slice(2).join(" — ")} ${notes}`
        : parts.slice(2).join(" — ");
    }
  } else {
    activity = parts[0] || text;

    /*
     * If there was no explicit "Activity — Place"
     * structure, try to infer the place from the
     * activity wording.
     */
    place = inferPlaceFromActivity(
      activity
    );
  }

  if (!cost && notes) {
    const foundCost =
      extractCost(notes);

    if (foundCost) {
      cost = foundCost;
    }
  }

  const normalized =
    activity.toLowerCase();

  if (
    normalized === "activity" ||
    normalized.includes(
      "activity — place"
    ) ||
    normalized.includes(
      "activity - place"
    ) ||
    normalized === "place" ||
    normalized === "approx. cost"
  ) {
    return {
      activity: "",
      place: "",
      notes: "",
      cost: "",
    };
  }

  return {
    activity,
    place,
    notes,
    cost,
  };
};

/* =========================================================
   DAY / SECTION HELPERS
========================================================= */

const createEmptySection = (title) => ({
  key: normalizeKey(title),
  title,
  items: [],
});

const createEmptyDay = (
  number,
  title = ""
) => ({
  number: String(number),
  title:
    cleanHeading(title) || "",
  sections: [],
  total: "",
  places: [],
  food: [],
});

const getOrCreateSection = (
  day,
  title
) => {
  const cleanTitle =
    cleanHeading(title);

  let section = day.sections.find(
    (item) =>
      item.title.toLowerCase() ===
      cleanTitle.toLowerCase()
  );

  if (!section) {
    section =
      createEmptySection(
        cleanTitle
      );

    day.sections.push(section);
  }

  return section;
};

const findColumnIndex = (
  headers,
  names
) => {
  const normalizedHeaders =
    headers.map((header) =>
      normalizeKey(header)
    );

  for (const name of names) {
    const target =
      normalizeKey(name);

    const exact =
      normalizedHeaders.indexOf(
        target
      );

    if (exact !== -1) {
      return exact;
    }
  }

  return -1;
};

/* =========================================================
   TABLE ROW PARSER
========================================================= */

const addTableRowToDay = (
  day,
  headers,
  cells,
  fallbackSection
) => {
  if (!cells || !cells.length) {
    return;
  }

  const segmentIndex =
    findColumnIndex(headers, [
      "segment",
      "time",
      "period",
      "when",
    ]);

  const activityIndex =
    findColumnIndex(headers, [
      "activity",
      "activities",
      "what",
      "experience",
    ]);

  const placeIndex =
    findColumnIndex(headers, [
      "place",
      "location",
      "where",
      "destination",
    ]);

  const notesIndex =
    findColumnIndex(headers, [
      "notes",
      "note",
      "details",
      "description",
    ]);

  const costIndex =
    findColumnIndex(headers, [
      "approx cost",
      "approx. cost",
      "cost",
      "price",
      "estimated cost",
      "budget",
    ]);

  const segment =
    segmentIndex >= 0
      ? cleanText(
          cells[segmentIndex]
        )
      : "";

  const activity =
    activityIndex >= 0
      ? cleanText(
          cells[activityIndex]
        )
      : cleanText(cells[0]);

  const place =
    placeIndex >= 0
      ? cleanText(
          cells[placeIndex]
        )
      : inferPlaceFromActivity(
          activity
        );

  const notes =
    notesIndex >= 0
      ? cleanText(
          cells[notesIndex]
        )
      : "";

  const cost =
    costIndex >= 0
      ? cleanText(
          cells[costIndex]
        )
      : "";

  const lowerActivity =
    activity.toLowerCase();

  const lowerSegment =
    segment.toLowerCase();

  if (
    lowerSegment.includes(
      "total"
    ) ||
    lowerActivity.includes(
      "daily total"
    ) ||
    lowerActivity.includes(
      "estimated daily total"
    ) ||
    lowerActivity === "total"
  ) {
    const totalValue =
      cost ||
      notes ||
      cells[cells.length - 1] ||
      "";

    if (totalValue) {
      day.total =
        cleanText(totalValue);
    }

    return;
  }

  if (
    lowerActivity ===
      "activity" ||
    lowerActivity.includes(
      "activity — place"
    ) ||
    lowerActivity.includes(
      "activity - place"
    )
  ) {
    return;
  }

  if (
    !activity &&
    !place &&
    !notes &&
    !cost
  ) {
    return;
  }

  let targetSection =
    segment;

  if (!targetSection) {
    targetSection =
      fallbackSection ||
      "Activities";
  }

  const knownSection = [
    "morning",
    "afternoon",
    "evening",
    "shopping",
    "transport",
    "food",
    "meals",
  ].find((item) =>
    targetSection
      .toLowerCase()
      .includes(item)
  );

  if (knownSection) {
    targetSection =
      knownSection
        .charAt(0)
        .toUpperCase() +
      knownSection.slice(1);
  }

  const section =
    getOrCreateSection(
      day,
      targetSection
    );

  section.items.push({
    activity,
    place,
    notes,
    cost,
  });

  addPlaceToDay(
    day,
    place
  );
};

/* =========================================================
   ITINERARY PARSER
========================================================= */

const parseItinerary = (
  raw,
  fallbackDestination,
  fallbackDays,
  fallbackBudget,
  fallbackInterests
) => {
  const parsed = {
    title:
      fallbackDestination ||
      "Your SmartTrip Journey",

    overview: [],

    meta: {
      budget: fallbackBudget
        ? String(fallbackBudget)
        : "",

      interests:
        fallbackInterests || "",

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
    .map((line) =>
      line.trim()
    );

  let currentDay = null;
  let currentSection = null;
  let mode = "overview";

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    const originalLine =
      lines[i];

    if (!originalLine) {
      continue;
    }

    const line =
      originalLine.trim();

    const dayMatch =
      isDayHeading(line);

    if (dayMatch) {
      const dayNumber =
        dayMatch[1];

      const dayTitle =
        dayMatch[2];

      currentDay =
        createEmptyDay(
          dayNumber,
          dayTitle
        );

      parsed.days.push(
        currentDay
      );

      currentSection = null;
      mode = "day";

      continue;
    }

    if (isTipsHeading(line)) {
      mode = "tips";
      currentSection = null;
      continue;
    }

    if (
      isSummaryHeading(line)
    ) {
      mode = "summary";
      currentSection = null;
      continue;
    }

    /* =====================================================
       MARKDOWN TABLE
    ===================================================== */

    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(
        lines[i + 1]
      )
    ) {
      const headers =
        parseTableRow(line);

      if (
        headers &&
        headers.length
      ) {
        i += 2;

        while (
          i < lines.length &&
          lines[i] &&
          lines[i].includes("|") &&
          !isDayHeading(
            lines[i]
          )
        ) {
          const cells =
            parseTableRow(
              lines[i]
            );

          if (cells) {
            if (currentDay) {
              addTableRowToDay(
                currentDay,
                headers,
                cells,
                currentSection?.title ||
                  "Activities"
              );
            } else {
              const rowLabel =
                cleanText(
                  cells[0] || ""
                );

              const rowValue =
                cleanText(
                  cells[
                    cells.length - 1
                  ] || ""
                );

              if (
                rowLabel &&
                rowValue &&
                rowLabel.toLowerCase() !==
                  "item"
              ) {
                parsed.budgetSummary.push(
                  {
                    item: rowLabel,
                    amount:
                      rowValue,
                    usd: "",
                  }
                );
              }
            }
          }

          i++;
        }

        i--;
        continue;
      }
    }

    /* =====================================================
       TIME SECTION
    ===================================================== */

    const timeMatch =
      isTimeHeading(line);

    if (
      timeMatch &&
      currentDay
    ) {
      currentSection =
        getOrCreateSection(
          currentDay,
          timeMatch[1]
        );

      mode = "day";

      continue;
    }

    const cleaned =
      cleanText(line);

    /* =====================================================
       METADATA
    ===================================================== */

    const metadataMatch =
      cleaned.match(
        /^(?:[-•*]\s*)?(Budget|Interests|Currency|Transport)\s*:?\s*(.+)$/i
      );

    if (metadataMatch) {
      const key =
        metadataMatch[1].toLowerCase();

      parsed.meta[key] =
        cleanText(
          metadataMatch[2]
        );

      continue;
    }

    const inlineMeta =
      cleaned.match(
        /^(Budget|Interests|Currency|Transport)\s+(.+)$/i
      );

    if (inlineMeta) {
      const key =
        inlineMeta[1].toLowerCase();

      parsed.meta[key] =
        cleanText(
          inlineMeta[2]
        );

      continue;
    }

    /* =====================================================
       OVERVIEW
    ===================================================== */

    if (
      mode === "overview" &&
      !currentDay
    ) {
      const heading =
        cleanHeading(line);

      if (
        heading &&
        !heading.startsWith(
          "YOUR SMARTTRIP PLAN"
        ) &&
        !heading.startsWith(
          "SMARTTRIP"
        )
      ) {
        if (
          !heading.match(
            /^(Budget|Interests|Currency|Transport)/i
          ) &&
          !heading.match(
            /^(Estimated|Final|Tips)/i
          )
        ) {
          parsed.overview.push(
            heading
          );
        }
      }

      continue;
    }

    /* =====================================================
       DAY CONTENT
    ===================================================== */

    if (
      currentDay &&
      mode === "day"
    ) {
      const plainLine =
        cleanText(line);

      const totalMatch =
        plainLine.match(
          /^(?:Approx\.?\s*Cost|Estimated Daily Total|Daily Total|Total)\s*:?\s*(.+)$/i
        );

      if (totalMatch) {
        currentDay.total =
          cleanText(
            totalMatch[1]
          );

        continue;
      }

      /* ===================================================
         EXPLICIT PLACES
      =================================================== */

      if (
        /^places?\s*:/i.test(
          plainLine
        )
      ) {
        const places =
          plainLine
            .replace(
              /^places?\s*:/i,
              ""
            )
            .split(/[,•]/)
            .map((item) =>
              cleanText(item)
            )
            .filter(Boolean);

        places.forEach(
          (place) =>
            addPlaceToDay(
              currentDay,
              place
            )
        );

        continue;
      }

      /* ===================================================
         FOOD
      =================================================== */

      if (
        /^food\s*:/i.test(
          plainLine
        )
      ) {
        const foods =
          plainLine
            .replace(
              /^food\s*:/i,
              ""
            )
            .split(/[,•]/)
            .map((item) =>
              cleanText(item)
            )
            .filter(Boolean);

        currentDay.food.push(
          ...foods
        );

        continue;
      }

      /* ===================================================
         BULLET ACTIVITY
      =================================================== */

      const isBullet =
        /^[-*•]\s+/.test(line);

      if (isBullet) {
        const activity =
          splitActivityLine(
            line
          );

        if (
          activity.activity &&
          !activity.activity
            .toLowerCase()
            .includes(
              "approx. cost"
            )
        ) {
          const section =
            currentSection ||
            getOrCreateSection(
              currentDay,
              "Activities"
            );

          section.items.push(
            activity
          );

          addPlaceToDay(
            currentDay,
            activity.place
          );
        }

        continue;
      }

      /* ===================================================
         NON-BULLET ACTIVITY
      =================================================== */

      if (
        plainLine.includes(
          "Approx. Cost"
        ) ||
        plainLine.includes(
          " — "
        )
      ) {
        const activity =
          splitActivityLine(
            plainLine
          );

        if (
          activity.activity
        ) {
          const section =
            currentSection ||
            getOrCreateSection(
              currentDay,
              "Activities"
            );

          section.items.push(
            activity
          );

          addPlaceToDay(
            currentDay,
            activity.place
          );

          continue;
        }
      }

      /* ===================================================
         STANDALONE COST
      =================================================== */

      const standaloneCost =
        plainLine.match(
          /^(?:Approx\.?\s*Cost(?:\s*\([^)]*\))?)\s*:?\s*(.+)$/i
        );

      if (standaloneCost) {
        currentDay.total =
          cleanText(
            standaloneCost[1]
          );

        continue;
      }
    }

    /* =====================================================
       SUMMARY
    ===================================================== */

    if (mode === "summary") {
      const summaryLine =
        removeListMarker(
          cleanText(line)
        );

      if (!summaryLine) {
        continue;
      }

      const totalMatch =
        summaryLine.match(
          /^(?:Total|Estimated Total|Final Total)\s*:?\s*(.+)$/i
        );

      if (totalMatch) {
        parsed.finalTotal =
          cleanText(
            totalMatch[1]
          );

        continue;
      }

      if (
        /^(?:Approx\.?\s*Cost|Amount|Item|Day)$/i.test(
          summaryLine
        )
      ) {
        continue;
      }

      const daySummary =
        summaryLine.match(
          /^(Day\s*\d+)\s*:?\s*(.+)$/i
        );

      if (daySummary) {
        parsed.budgetSummary.push(
          {
            item: cleanText(
              daySummary[1]
            ),
            amount: cleanText(
              daySummary[2]
            ),
            usd: "",
          }
        );

        continue;
      }

      if (
        /^(?:≈|~|₹|\$|€|£)?\s*\d[\d.,]*\s*[kKmM]?(?:\s*[A-Z]{2,4})?$/i.test(
          summaryLine
        )
      ) {
        parsed.budgetSummary.push(
          {
            item: "",
            amount:
              summaryLine,
            usd: "",
          }
        );

        continue;
      }

      const colonSummary =
        summaryLine.match(
          /^(.+?)\s*:\s*(.+)$/
        );

      if (colonSummary) {
        parsed.budgetSummary.push(
          {
            item: cleanText(
              colonSummary[1]
            ),
            amount: cleanText(
              colonSummary[2]
            ),
            usd: "",
          }
        );
      }

      continue;
    }

    /* =====================================================
       TIPS
    ===================================================== */

    if (mode === "tips") {
      const tip =
        removeListMarker(
          cleanText(line)
        );

      if (
        tip &&
        !tip.match(
          /^SmartTrip Tips$/i
        )
      ) {
        parsed.finalTips.push(
          tip
        );
      }
    }
  }

  /* =======================================================
     FALLBACK BUDGET SUMMARY
  ======================================================= */

  if (
    parsed.budgetSummary.length ===
      0 &&
    parsed.days.length > 0
  ) {
    parsed.days.forEach(
      (day) => {
        if (day.total) {
          parsed.budgetSummary.push(
            {
              item: `Day ${day.number}`,
              amount:
                day.total,
              usd: "",
            }
          );
        }
      }
    );
  }

  /* =======================================================
     FALLBACK DAYS
  ======================================================= */

  if (
    parsed.days.length ===
      0 &&
    Number(fallbackDays) > 0
  ) {
    for (
      let i = 1;
      i <= Number(fallbackDays);
      i++
    ) {
      parsed.days.push(
        createEmptyDay(i)
      );
    }
  }

  /* =======================================================
     REMOVE COMPLETELY EMPTY DAYS
  ======================================================= */

  parsed.days =
    parsed.days.filter(
      (day) =>
        day.title ||
        day.sections.length ||
        day.total ||
        day.places.length ||
        day.food.length
    );

  return parsed;
};

/* =========================================================
   INLINE TEXT RENDERER
========================================================= */

const renderInlineText = (
  text
) => {
  const value =
    String(text || "");

  const parts =
    value.split(
      /(\*\*[^*]+\*\*|\*[^*]+\*)/g
    );

  return parts.map(
    (part, index) => {
      if (
        part.startsWith(
          "**"
        ) &&
        part.endsWith(
          "**"
        )
      ) {
        return (
          <strong key={index}>
            {part.slice(
              2,
              -2
            )}
          </strong>
        );
      }

      if (
        part.startsWith(
          "*"
        ) &&
        part.endsWith(
          "*"
        )
      ) {
        return (
          <em key={index}>
            {part.slice(
              1,
              -1
            )}
          </em>
        );
      }

      return (
        <span key={index}>
          {part}
        </span>
      );
    }
  );
};

/* =========================================================
   ITINERARY CARD COMPONENTS
========================================================= */

const ActivityRow = ({
  item,
}) => {
  return (
    <div className="structured-activity">
      <div className="structured-activity-main">
        <div className="activity-field">
          <span className="activity-field-label">
            ACTIVITY
          </span>

          <strong>
            {renderInlineText(
              item.activity ||
                "Activity"
            )}
          </strong>
        </div>

        {item.place && (
          <div className="activity-field">
            <span className="activity-field-label">
              PLACE
            </span>

            <span className="activity-place">
              📍{" "}
              {renderInlineText(
                item.place
              )}
            </span>
          </div>
        )}

        {item.notes && (
          <div className="activity-field activity-notes">
            <span className="activity-field-label">
              NOTES
            </span>

            <p>
              {renderInlineText(
                item.notes
              )}
            </p>
          </div>
        )}
      </div>

      {item.cost && (
        <div className="activity-cost">
          <span>
            COST
          </span>

          <strong>
            {item.cost}
          </strong>
        </div>
      )}
    </div>
  );
};

const TimeSection = ({
  section,
}) => {
  if (
    !section ||
    !section.items.length
  ) {
    return null;
  }

  const title =
    section.title.toLowerCase();

  const icon =
    title.includes("morning")
      ? "🌅"
      : title.includes(
          "afternoon"
        )
      ? "☀️"
      : title.includes(
          "evening"
        )
      ? "🌙"
      : title.includes(
          "shopping"
        )
      ? "🛍️"
      : title.includes(
          "transport"
        )
      ? "🚕"
      : "✨";

  return (
    <div className="time-card">
      <div className="time-card-header">
        <div className="time-icon">
          {icon}
        </div>

        <div>
          <span className="time-card-kicker">
            {section.title.toUpperCase()}
          </span>

          <h4>
            {section.title}
          </h4>
        </div>
      </div>

      <div className="time-card-body">
        {section.items.map(
          (
            item,
            index
          ) => (
            <ActivityRow
              key={`${section.key}-${index}`}
              item={item}
            />
          )
        )}
      </div>
    </div>
  );
};

const DayCard = ({
  day,
}) => {
  return (
    <article className="day-card timeline-day-card">
      <div className="day-card-header">
        <div className="day-pill">
          DAY {day.number}
        </div>

        <div className="day-heading-content">
          <span className="day-label">
            SMARTTRIP ITINERARY
          </span>

          <h3>
            {day.title ||
              `Day ${day.number}`}
          </h3>
        </div>
      </div>

      <div className="day-card-body">
        {day.sections.map(
          (
            section,
            index
          ) => (
            <TimeSection
              key={`${day.number}-${index}`}
              section={section}
            />
          )
        )}

        {day.places.length >
          0 && (
          <div className="side-block">
            <div className="side-block-title">
              📍 PLACES
            </div>

            <div className="side-block-content">
              {day.places.map(
                (
                  place,
                  index
                ) => (
                  <span
                    key={index}
                  >
                    {place}
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {day.food.length >
          0 && (
          <div className="side-block">
            <div className="side-block-title">
              🍜 FOOD
            </div>

            <div className="side-block-content">
              {day.food.map(
                (
                  food,
                  index
                ) => (
                  <span
                    key={index}
                  >
                    {food}
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {day.total && (
          <div className="day-total-card">
            <div>
              <span>
                ESTIMATED DAY TOTAL
              </span>

              <strong>
                Day{" "}
                {day.number}
              </strong>
            </div>

            <div className="day-total-amount">
              {day.total}
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

const BudgetSummary = ({
  summary,
  finalTotal,
}) => {
  if (
    (!summary ||
      !summary.length) &&
    !finalTotal
  ) {
    return null;
  }

  return (
    <div className="final-budget-card">
      <div className="final-budget-header">
        <div className="budget-icon">
          💰
        </div>

        <div>
          <span className="budget-kicker">
            BUDGET OVERVIEW
          </span>

          <h3>
            Estimated Expenses
          </h3>
        </div>
      </div>

      {summary &&
        summary.length > 0 && (
          <div className="budget-summary-list">
            {summary.map(
              (
                row,
                index
              ) => (
                <div
                  className="budget-summary-row"
                  key={index}
                >
                  <span>
                    {row.item ||
                      `Expense ${
                        index +
                        1
                      }`}
                  </span>

                  <strong>
                    {row.amount}
                  </strong>
                </div>
              )
            )}
          </div>
        )}

      {finalTotal && (
        <div className="budget-final-total">
          <div>
            <span>
              ESTIMATED TOTAL
            </span>

            <strong>
              Total trip cost
            </strong>
          </div>

          <strong>
            {finalTotal}
          </strong>
        </div>
      )}
    </div>
  );
};

const TipsCard = ({
  tips,
}) => {
  if (
    !tips ||
    !tips.length
  ) {
    return null;
  }

  return (
    <div className="smarttrip-tip-box">
      <div className="tip-box-header">
        <span className="tip-icon">
          ✨
        </span>

        <div>
          <span>
            SMARTTRIP
          </span>

          <h3>
            Tips for your trip
          </h3>
        </div>
      </div>

      <div className="tip-list">
        {tips.map(
          (
            tip,
            index
          ) => (
            <div
              className="tip-item"
              key={index}
            >
              <span>
                ✓
              </span>

              <p>
                {renderInlineText(
                  tip
                )}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

/* =========================================================
   FULL ITINERARY RENDERER
========================================================= */

const FormattedItinerary = ({
  rawItinerary,
  destination,
  startPoint,
  days,
  budget,
  interests,
}) => {
  const parsed = useMemo(
    () =>
      parseItinerary(
        rawItinerary,
        destination,
        days,
        budget,
        interests
      ),
    [
      rawItinerary,
      destination,
      days,
      budget,
      interests,
    ]
  );

  const mapPlaces =
    useMemo(
      () =>
        parsed.days.flatMap(
          (day) =>
            day.places ||
            []
        ),
      [parsed.days]
    );

  console.log(
    "SmartTrip parsed days:",
    parsed.days
  );

  console.log(
    "SmartTrip map places:",
    mapPlaces
  );

  const displayDays =
    days ||
    parsed.days.length ||
    "";

  return (
    <div className="formatted-itinerary">
      {/* INTERACTIVE MAP */}

      <TripMap
        destination={
          destination
        }
        startPoint={
          startPoint
        }
        places={
          mapPlaces
        }
      />

      {/* ITINERARY OVERVIEW */}

      <div className="itinerary-overview">
        <div className="overview-top">
          <div>
            <span className="overview-kicker">
              🌴 YOUR SMARTTRIP PLAN
            </span>

            <h3>
              {parsed.title ||
                destination}
            </h3>
          </div>

          <div className="overview-destination">
            📍{" "}
            {destination}
          </div>
        </div>

        <div className="overview-meta">
          {startPoint && (
            <div className="overview-meta-item">
              <span>
                🚩
              </span>

              <div>
                <small>
                  START POINT
                </small>

                <strong>
                  {startPoint}
                </strong>
              </div>
            </div>
          )}

          <div className="overview-meta-item">
            <span>
              📅
            </span>

            <div>
              <small>
                DURATION
              </small>

              <strong>
                {displayDays
                  ? `${displayDays} Days`
                  : "Custom Plan"}
              </strong>
            </div>
          </div>

          <div className="overview-meta-item">
            <span>
              💰
            </span>

            <div>
              <small>
                BUDGET
              </small>

              <strong>
                {parsed.meta
                  .budget ||
                  budget}
              </strong>
            </div>
          </div>

          <div className="overview-meta-item">
            <span>
              ❤️
            </span>

            <div>
              <small>
                INTERESTS
              </small>

              <strong>
                {parsed.meta
                  .interests ||
                  interests}
              </strong>
            </div>
          </div>

          {parsed.meta
            .currency && (
            <div className="overview-meta-item">
              <span>
                💱
              </span>

              <div>
                <small>
                  CURRENCY
                </small>

                <strong>
                  {
                    parsed
                      .meta
                      .currency
                  }
                </strong>
              </div>
            </div>
          )}

          {parsed.meta
            .transport && (
            <div className="overview-meta-item">
              <span>
                🚕
              </span>

              <div>
                <small>
                  TRANSPORT
                </small>

                <strong>
                  {
                    parsed
                      .meta
                      .transport
                  }
                </strong>
              </div>
            </div>
          )}
        </div>

        {parsed.overview
          .length > 0 && (
          <div className="overview-notes">
            {parsed.overview.map(
              (
                item,
                index
              ) => (
                <p
                  key={
                    index
                  }
                >
                  {renderInlineText(
                    item
                  )}
                </p>
              )
            )}
          </div>
        )}
      </div>

      {/* DAY-BY-DAY TIMELINE */}

      <div className="itinerary-days">
        {parsed.days.map(
          (
            day,
            index
          ) => (
            <DayCard
              key={index}
              day={day}
            />
          )
        )}
      </div>

      {/* BUDGET SUMMARY */}

      <BudgetSummary
        summary={
          parsed.budgetSummary
        }
        finalTotal={
          parsed.finalTotal
        }
      />

      {/* TRAVEL TIPS */}

      <TipsCard
        tips={
          parsed.finalTips
        }
      />

      {/* FALLBACK */}

      {parsed.days.length ===
        0 &&
        !parsed.finalTips
          .length && (
          <div className="itinerary-fallback">
            <p>
              {renderInlineText(
                cleanText(
                  rawItinerary
                )
              )}
            </p>
          </div>
        )}
    </div>
  );
};

/* =========================================================
   MAIN APP
========================================================= */

function App() {
  /* =======================================================
     PLANNER STATE
  ======================================================= */

  const [
    destination,
    setDestination,
  ] = useState("");

  const [
    startPoint,
    setStartPoint,
  ] = useState("");

  const [days, setDays] =
    useState("");

  const [
    budget,
    setBudget,
  ] = useState("");

  const [
    interests,
    setInterests,
  ] = useState("");

  const [
    tripStyle,
    setTripStyle,
  ] = useState(
    "No Filter"
  );

  const [
    itinerary,
    setItinerary,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     SAVED TRIPS STATE
  ======================================================= */

  const [
    savedTrips,
    setSavedTrips,
  ] = useState([]);

  const [
    savingTrip,
    setSavingTrip,
  ] = useState(false);

  const [
    tripsLoading,
    setTripsLoading,
  ] = useState(false);

  const [
    tripsError,
    setTripsError,
  ] = useState("");

  /* =======================================================
     AUTH STATE
  ======================================================= */

  const [
    authMode,
    setAuthMode,
  ] = useState(null);

  const [
    authLoading,
    setAuthLoading,
  ] = useState(false);

  const [
    authError,
    setAuthError,
  ] = useState("");

  const [
    authSuccess,
    setAuthSuccess,
  ] = useState("");

  const [
    authName,
    setAuthName,
  ] = useState("");

  const [
    authEmail,
    setAuthEmail,
  ] = useState("");

  const [
    authPassword,
    setAuthPassword,
  ] = useState("");

  const [
    isLoggedIn,
    setIsLoggedIn,
  ] = useState(
    !!localStorage.getItem(
      "smarttripToken"
    )
  );

  /* =======================================================
     CURRENT USER
  ======================================================= */

  const [
    currentUser,
    setCurrentUser,
  ] = useState(() => {
    const savedUser =
      localStorage.getItem(
        "smarttripUser"
      );

    if (!savedUser) {
      return null;
    }

    try {
      return JSON.parse(
        savedUser
      );
    } catch {
      return null;
    }
  });

  const [
    userMenuOpen,
    setUserMenuOpen,
  ] = useState(false);

  /* =======================================================
     AUTH MODAL
  ======================================================= */

  const openAuth = (
    mode
  ) => {
    setAuthMode(mode);
    setAuthError("");
    setAuthSuccess("");
    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
  };

  const closeAuth = () => {
    setAuthMode(null);
    setAuthError("");
    setAuthSuccess("");
    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthLoading(false);
  };

  /* =======================================================
     LOAD SAVED TRIPS
  ======================================================= */

  const loadSavedTrips =
    async () => {
      const token =
        localStorage.getItem(
          "smarttripToken"
        );

      if (!token) {
        setSavedTrips([]);
        return;
      }

      setTripsLoading(true);
      setTripsError("");

      try {
        const response =
          await fetch(
            `${BACKEND_URL}/api/trips`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            "Unable to load your saved trips."
          );
        }

        const data =
          await response.json();

        setSavedTrips(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (err) {
        console.error(
          "Load trips error:",
          err
        );

        setTripsError(
          err.message ||
            "Unable to load saved trips."
        );
      } finally {
        setTripsLoading(
          false
        );
      }
    };

  /* =======================================================
     SAVE TRIP
  ======================================================= */

  const saveTrip = async () => {
    const token =
      localStorage.getItem(
        "smarttripToken"
      );

    if (!token) {
      openAuth("login");
      return;
    }

    if (!itinerary) {
      setError(
        "Generate an itinerary before saving your trip."
      );

      return;
    }

    setSavingTrip(true);
    setError("");

    try {
      const response =
        await fetch(
          `${BACKEND_URL}/api/trips`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization: `Bearer ${token}`,
            },

            body: JSON.stringify(
              {
                destination,
                startDate:
                  null,
                endDate: null,
                budget:
                  Number(budget),
                interests,
                itinerary,
              }
            ),
          }
        );

      const data =
        await response.text();

      if (!response.ok) {
        throw new Error(
          data ||
            "Unable to save your trip."
        );
      }

      await loadSavedTrips();

      alert(
        "✨ Trip saved successfully!"
      );

      document
        .getElementById(
          "my-trips"
        )
        ?.scrollIntoView({
          behavior: "smooth",
        });
    } catch (err) {
      console.error(
        "Save trip error:",
        err
      );

      setError(
        err.message ||
          "Unable to save your trip."
      );
    } finally {
      setSavingTrip(false);
    }
  };

  /* =======================================================
     DELETE TRIP
  ======================================================= */

  const deleteTrip =
    async (tripId) => {
      const token =
        localStorage.getItem(
          "smarttripToken"
        );

      if (!token) {
        openAuth("login");
        return;
      }

      const confirmed =
        window.confirm(
          "Are you sure you want to delete this saved trip?"
        );

      if (!confirmed) {
        return;
      }

      try {
        const response =
          await fetch(
            `${BACKEND_URL}/api/trips/${tripId}`,
            {
              method: "DELETE",

              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            "Unable to delete this trip."
          );
        }

        setSavedTrips(
          (
            currentTrips
          ) =>
            currentTrips.filter(
              (trip) =>
                trip.id !==
                tripId
            )
        );
      } catch (err) {
        console.error(
          "Delete trip error:",
          err
        );

        setTripsError(
          err.message ||
            "Unable to delete this trip."
        );
      }
    };

  /* =======================================================
     LOGIN / SIGNUP
  ======================================================= */

  const handleAuth =
    async (e) => {
      e.preventDefault();

      setAuthError("");
      setAuthSuccess("");
      setAuthLoading(true);

      try {
        /* SIGN UP */

        if (
          authMode ===
          "signup"
        ) {
          if (
            !authName ||
            !authEmail ||
            !authPassword
          ) {
            throw new Error(
              "Please fill in all the fields."
            );
          }

          const response =
            await fetch(
              `${BACKEND_URL}/api/auth/register`,
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify(
                  {
                    name: authName,
                    email:
                      authEmail,
                    password:
                      authPassword,
                  }
                ),
              }
            );

          const data =
            await response.text();

          if (!response.ok) {
            throw new Error(
              data ||
                "Unable to create your account."
            );
          }

          setAuthSuccess(
            "Account created successfully! You can now log in. ✨"
          );

          setAuthMode(
            "login"
          );

          setAuthPassword(
            ""
          );

          setAuthLoading(
            false
          );

          return;
        }

        /* LOGIN */

        if (
          authMode ===
          "login"
        ) {
          if (
            !authEmail ||
            !authPassword
          ) {
            throw new Error(
              "Please enter your email and password."
            );
          }

          const response =
            await fetch(
              `${BACKEND_URL}/api/auth/login`,
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify(
                  {
                    email:
                      authEmail,
                    password:
                      authPassword,
                  }
                ),
              }
            );

          const responseText =
            await response.text();

          let data = null;

          try {
            data =
              JSON.parse(
                responseText
              );
          } catch {
            data = null;
          }

          if (!response.ok) {
            throw new Error(
              data?.message ||
                data?.error ||
                responseText ||
                "Invalid email or password."
            );
          }

          const token =
            data?.token ||
            responseText.trim();

          if (!token) {
            throw new Error(
              "Login succeeded, but no authentication token was returned."
            );
          }

          localStorage.setItem(
            "smarttripToken",
            token
          );

          const user = {
            id:
              data?.id ||
              null,

            name:
              data?.name ||
              "Traveler",

            email:
              data?.email ||
              authEmail,
          };

          localStorage.setItem(
            "smarttripUser",
            JSON.stringify(
              user
            )
          );

          setCurrentUser(
            user
          );

          setIsLoggedIn(
            true
          );

          setUserMenuOpen(
            false
          );

          await loadSavedTrips();

          closeAuth();
        }
      } catch (err) {
        console.error(
          "Authentication error:",
          err
        );

        setAuthError(
          err.message ||
            "Something went wrong. Please try again."
        );
      } finally {
        setAuthLoading(
          false
        );
      }
    };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const logout = () => {
    localStorage.removeItem(
      "smarttripToken"
    );

    localStorage.removeItem(
      "smarttripUser"
    );

    setIsLoggedIn(false);
    setCurrentUser(null);
    setUserMenuOpen(false);
    setSavedTrips([]);
    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
  };

  /* =======================================================
     GENERATE ITINERARY
  ======================================================= */

  const generateItinerary =
    async () => {
      if (!isLoggedIn) {
        setError(
          "Please log in or create an account to generate your itinerary."
        );

        openAuth("login");

        return;
      }

      if (
        !destination ||
        !days ||
        !budget ||
        !interests
      ) {
        setError(
          "Please fill in all the travel details."
        );

        return;
      }

      setLoading(true);
      setError("");
      setItinerary("");

      try {
        const token =
          localStorage.getItem(
            "smarttripToken"
          );

        const aiInterests = `${interests}. Trip Style: ${tripStyle}. Start Point: ${
          startPoint ||
          "Not specified"
        }.

If Trip Style is "No Filter", do not apply any special travel-style constraints. Create a balanced itinerary based on the destination, budget, interests, trip duration, and start point.`;

        const response =
          await fetch(
            `${BACKEND_URL}/api/ai/itinerary`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                ...(token
                  ? {
                      Authorization: `Bearer ${token}`,
                    }
                  : {}),
              },

              body: JSON.stringify(
                {
                  destination,
                  days:
                    Number(days),
                  budget:
                    Number(budget),
                  interests:
                    aiInterests,
                }
              ),
            }
          );

        const data =
          await response.text();

        if (!response.ok) {
          throw new Error(
            `Backend error (${response.status}): ${
              data ||
              "One quick step before you continue!"
            }`
          );
        }

        setItinerary(data);

        setTimeout(
          () => {
            document
              .getElementById(
                "itinerary-result"
              )
              ?.scrollIntoView({
                behavior:
                  "smooth",
                block: "start",
              });
          },
          100
        );
      } catch (err) {
        console.error(
          "Itinerary error:",
          err
        );

        setError(
          err.message ||
            "Unable to generate itinerary."
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="app">
      {/* ===================================================
          NAVBAR
      =================================================== */}

      <nav className="navbar">
        <div className="logo">
          <span className="logo-icon">
            ✈
          </span>

          <span>
            Smart
            <span>
              Trip
            </span>
          </span>
        </div>

        <div className="nav-links">
          <a href="#planner">
            Planner
          </a>

          {isLoggedIn && (
            <a href="#my-trips">
              My Trips
            </a>
          )}

          <a href="#features">
            Features
          </a>

          <a href="#about">
            About
          </a>
        </div>

        <div className="navbar-auth">
          {!isLoggedIn ? (
            <>
              <button
                className="login-button"
                onClick={() =>
                  openAuth(
                    "login"
                  )
                }
              >
                Login
              </button>

              <button
                className="nav-button signup-nav-button"
                onClick={() =>
                  openAuth(
                    "signup"
                  )
                }
              >
                Sign Up
              </button>
            </>
          ) : (
            <div className="user-menu">
              <button
                className="user-menu-button"
                onClick={() =>
                  setUserMenuOpen(
                    (current) =>
                      !current
                  )
                }
                aria-expanded={
                  userMenuOpen
                }
              >
                <span className="user-avatar">
                  👤
                </span>

                <span className="user-menu-text">
                  <strong>
                    Hi,{" "}
                    {currentUser?.name ||
                      "Traveler"}
                  </strong>

                  <small>
                    {currentUser?.email ||
                      ""}
                  </small>
                </span>

                <span className="user-chevron">
                  {userMenuOpen
                    ? "⌃"
                    : "⌄"}
                </span>
              </button>

              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-avatar">
                      👤
                    </div>

                    <div>
                      <strong>
                        {currentUser?.name ||
                          "Traveler"}
                      </strong>

                      <span>
                        {currentUser?.email ||
                          ""}
                      </span>
                    </div>
                  </div>

                  <div className="user-dropdown-divider" />

                  <button
                    onClick={() => {
                      setUserMenuOpen(
                        false
                      );

                      document
                        .getElementById(
                          "my-trips"
                        )
                        ?.scrollIntoView({
                          behavior:
                            "smooth",
                        });
                    }}
                  >
                    🧳 My Trips
                  </button>

                  <button
                    onClick={
                      logout
                    }
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* ===================================================
          HERO
      =================================================== */}

      <section className="hero">
        <div className="hero-content">
          <div className="badge">
            ✨ AI-Powered Travel Planning
          </div>

          <h1>
            Your next adventure
            <br />
            <span>
              starts here.
            </span>
          </h1>

          <p>
            Tell us where you want
            to go, what you love,
            and your budget.
            SmartTrip creates a
            personalized itinerary
            for you.
          </p>

          <button
            className="hero-button"
            onClick={() =>
              document
                .getElementById(
                  "planner"
                )
                ?.scrollIntoView({
                  behavior:
                    "smooth",
                })
            }
          >
            Start Planning
            <span>
              →
            </span>
          </button>
        </div>

        <div className="hero-visual">
          <div className="floating-card card-one">
            <span>
              📍
            </span>

            <div>
              <strong>
                Explore
              </strong>

              <small>
                New destinations
              </small>
            </div>
          </div>

          <div className="travel-circle">
            <div className="circle-content">
              <span>
                🌍
              </span>

              <strong>
                TRAVEL
              </strong>

              <small>
                WITHOUT LIMITS
              </small>
            </div>
          </div>

          <div className="floating-card card-two">
            <span>
              ✨
            </span>

            <div>
              <strong>
                AI Planned
              </strong>

              <small>
                Just for you
              </small>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          PLANNER
      =================================================== */}

      <section
        className="planner-section"
        id="planner"
      >
        <div className="section-heading">
          <div className="section-label">
            PLAN YOUR JOURNEY
          </div>

          <h2>
            Where will you
            <span>
              {" "}
              go next?
            </span>
          </h2>

          <p>
            Give us a few details
            and let SmartTrip build
            your perfect adventure.
          </p>
        </div>

        <div className="planner-card">
          <div className="input-group destination-input">
            <label>
              📍 DESTINATION
            </label>

            <input
              type="text"
              placeholder="e.g. Paris, Tokyo, Bali..."
              value={
                destination
              }
              onChange={(e) =>
                setDestination(
                  e.target.value
                )
              }
            />
          </div>

          <div className="input-group">
            <label>
              🚩 START POINT
            </label>

            <input
              type="text"
              placeholder="e.g. Hyderabad, Delhi, Mumbai..."
              value={
                startPoint
              }
              onChange={(e) =>
                setStartPoint(
                  e.target.value
                )
              }
            />

            <small className="start-point-helper">
              Optional — tell
              SmartTrip where
              your journey begins.
            </small>
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>
                📅 DAYS
              </label>

              <input
                type="number"
                min="1"
                placeholder="5"
                value={days}
                onChange={(e) =>
                  setDays(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="input-group">
              <label>
                💰 BUDGET
              </label>

              <input
                type="number"
                min="1"
                placeholder="50000"
                value={budget}
                onChange={(e) =>
                  setBudget(
                    e.target.value
                  )
                }
              />
            </div>
          </div>

          <div className="input-group">
            <label>
              ❤️ INTERESTS
            </label>

            <input
              type="text"
              placeholder="Food, beaches, history, shopping..."
              value={
                interests
              }
              onChange={(e) =>
                setInterests(
                  e.target.value
                )
              }
            />
          </div>

          {/* =================================================
              TRIP STYLE
          ================================================= */}

          <div className="trip-style-group">
            <label>
              TRIP STYLE
            </label>

            <p className="trip-style-subtitle">
              How do you want
              your trip to feel?
            </p>

            <div className="trip-style-grid">
              {tripStyles.map(
                (style) => (
                  <button
                    key={
                      style.id
                    }
                    type="button"
                    className={`trip-style-card ${
                      tripStyle ===
                      style.id
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      setTripStyle(
                        style.id
                      )
                    }
                  >
                    <span className="trip-style-emoji">
                      {
                        style.emoji
                      }
                    </span>

                    <span className="trip-style-content">
                      <strong>
                        {
                          style.id
                        }
                      </strong>

                      <small>
                        {
                          style.description
                        }
                      </small>
                    </span>

                    {tripStyle ===
                      style.id && (
                      <span className="trip-style-check">
                        ✓
                      </span>
                    )}
                  </button>
                )
              )}
            </div>
          </div>

          <button
            className="generate-button"
            onClick={
              generateItinerary
            }
            disabled={
              loading
            }
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Creating your
                itinerary...
              </>
            ) : (
              <>
                ✨ Generate My
                Itinerary
                <span>
                  →
                </span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="error-box">
            <span>
              ⚠️
            </span>

            <div>
              <strong>
                Something went
                wrong
              </strong>

              <p>
                {error}
              </p>
            </div>
          </div>
        )}

        {itinerary && (
          <div
            className="result-section"
            id="itinerary-result"
          >
            <div className="result-header">
              <div>
                <div className="section-label">
                  YOUR PERSONALIZED
                  PLAN
                </div>

                <h2>
                  Your{" "}
                  <span>
                    Itinerary
                  </span>{" "}
                  🗺️
                </h2>
              </div>

              <div className="trip-summary">
                <span>
                  📍{" "}
                  {destination}
                </span>

                <span>
                  📅 {days} days
                </span>

                <span>
                  {
                    tripStyles.find(
                      (
                        style
                      ) =>
                        style.id ===
                        tripStyle
                    )?.emoji
                  }{" "}
                  {tripStyle}
                </span>
              </div>
            </div>

            <div className="itinerary-card">
              <FormattedItinerary
                rawItinerary={
                  itinerary
                }
                destination={
                  destination
                }
                startPoint={
                  startPoint
                }
                days={days}
                budget={
                  budget
                }
                interests={
                  interests
                }
              />
            </div>

            <div className="save-trip-container">
              <button
                className="save-trip-button"
                onClick={
                  saveTrip
                }
                disabled={
                  savingTrip
                }
              >
                {savingTrip ? (
                  <>
                    <span className="spinner"></span>
                    Saving Trip...
                  </>
                ) : (
                  <>
                    💾 Save This
                    Trip
                    <span>
                      →
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ===================================================
          MY TRIPS
      =================================================== */}

      {isLoggedIn && (
        <section
          className="my-trips-section"
          id="my-trips"
        >
          <div className="section-heading">
            <div className="section-label">
              YOUR TRAVEL
              COLLECTION
            </div>

            <h2>
              My{" "}
              <span>
                Trips
              </span>{" "}
              🧳
            </h2>

            <p>
              Your saved adventures,
              all in one place.
            </p>
          </div>

          {tripsLoading ? (
            <div className="my-trips-message">
              <span className="spinner"></span>
              Loading your
              trips...
            </div>
          ) : tripsError ? (
            <div className="error-box">
              <span>
                ⚠️
              </span>

              <div>
                <strong>
                  Couldn't load
                  your trips
                </strong>

                <p>
                  {tripsError}
                </p>

                <button
                  className="retry-trips-button"
                  onClick={
                    loadSavedTrips
                  }
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : savedTrips.length ===
            0 ? (
            <div className="empty-trips-card">
              <div className="empty-trips-icon">
                🌍
              </div>

              <h3>
                No saved trips
                yet
              </h3>

              <p>
                Generate an
                itinerary and
                save it here for
                your next
                adventure.
              </p>

              <button
                className="hero-button"
                onClick={() =>
                  document
                    .getElementById(
                      "planner"
                    )
                    ?.scrollIntoView({
                      behavior:
                        "smooth",
                    })
                }
              >
                Create My
                First Trip
                <span>
                  →
                </span>
              </button>
            </div>
          ) : (
            <div className="saved-trips-grid">
              {savedTrips.map(
                (trip) => (
                  <article
                    className="saved-trip-card"
                    key={
                      trip.id
                    }
                  >
                    <div className="saved-trip-top">
                      <div className="saved-trip-icon">
                        📍
                      </div>

                      <button
                        className="delete-trip-button"
                        onClick={() =>
                          deleteTrip(
                            trip.id
                          )
                        }
                        title="Delete trip"
                      >
                        🗑️
                      </button>
                    </div>

                    <span className="saved-trip-label">
                      SAVED ADVENTURE
                    </span>

                    <h3>
                      {
                        trip.destination
                      }
                    </h3>

                    <div className="saved-trip-details">
                      <span>
                        💰{" "}
                        {
                          trip.budget
                        }
                      </span>

                      <span>
                        ❤️{" "}
                        {
                          trip.interests
                        }
                      </span>
                    </div>

                    {trip.itinerary && (
                      <details className="saved-trip-itinerary">
                        <summary>
                          <span>
                            🗺️ View
                            itinerary
                          </span>

                          <span>
                            +
                          </span>
                        </summary>

                        <div className="saved-trip-content">
                          <FormattedItinerary
                            rawItinerary={
                              trip.itinerary
                            }
                            destination={
                              trip.destination
                            }
                            days=""
                            budget={
                              trip.budget
                            }
                            interests={
                              trip.interests
                            }
                          />
                        </div>
                      </details>
                    )}
                  </article>
                )
              )}
            </div>
          )}
        </section>
      )}

      {/* ===================================================
          FEATURES
      =================================================== */}

      <section
        className="features-section"
        id="features"
      >
        <div className="section-heading">
          <div className="section-label">
            WHY SMARTTRIP?
          </div>

          <h2>
            Travel planning,
            <span>
              {" "}
              simplified.
            </span>
          </h2>

          <p>
            Everything you need
            to turn your travel
            ideas into memorable
            adventures.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              🤖
            </div>

            <h3>
              AI-Powered
            </h3>

            <p>
              Get personalized
              travel plans
              generated around
              your interests and
              preferences.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              💰
            </div>

            <h3>
              Budget Friendly
            </h3>

            <p>
              Plan your
              adventure around
              the budget you
              actually want to
              spend.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              🗺️
            </div>

            <h3>
              Day-by-Day Plans
            </h3>

            <p>
              Get organized
              morning, afternoon
              and evening
              activities for every
              day.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              ❤️
            </div>

            <h3>
              Made for You
            </h3>

            <p>
              Your interests and
              trip style shape the
              experience, making
              every trip uniquely
              yours.
            </p>
          </div>
        </div>
      </section>

      {/* ===================================================
          ABOUT
      =================================================== */}

      <section
        className="about-section"
        id="about"
      >
        <div className="about-content">
          <div className="section-label">
            ABOUT SMARTTRIP
          </div>

          <h2>
            Less planning.
            <br />

            <span>
              More exploring.
            </span>
          </h2>

          <p>
            SmartTrip uses
            artificial intelligence
            to make travel planning
            simple. Instead of
            spending hours
            researching
            destinations, tell us
            what you want and we'll
            help turn it into a
            journey.
          </p>
        </div>

        <div className="about-stats">
          <div>
            <strong>
              AI
            </strong>

            <span>
              Powered Planning
            </span>
          </div>

          <div>
            <strong>
              24/7
            </strong>

            <span>
              Travel Inspiration
            </span>
          </div>

          <div>
            <strong>
              ∞
            </strong>

            <span>
              Possible Adventures
            </span>
          </div>
        </div>
      </section>

      {/* ===================================================
          FOOTER
      =================================================== */}

      <footer>
        <div className="logo">
          <span className="logo-icon">
            ✈
          </span>

          <span>
            Smart
            <span>
              Trip
            </span>
          </span>
        </div>

        <p>
          AI-powered travel
          planning for curious
          explorers.
        </p>

        <span className="copyright">
          © 2026 SmartTrip
        </span>
      </footer>

      {/* ===================================================
          AUTH MODAL
      =================================================== */}

      {authMode && (
        <div
          className="auth-overlay"
          onClick={
            closeAuth
          }
        >
          <div
            className="auth-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <button
              className="auth-close"
              onClick={
                closeAuth
              }
            >
              ×
            </button>

            <div className="auth-icon">
              {authMode ===
              "login"
                ? "👋"
                : "✨"}
            </div>

            <div className="auth-heading">
              <div className="section-label">
                {authMode ===
                "login"
                  ? "WELCOME BACK"
                  : "JOIN SMARTTRIP"}
              </div>

              <h2>
                {authMode ===
                "login" ? (
                  <>
                    Welcome{" "}
                    <span>
                      back.
                    </span>
                  </>
                ) : (
                  <>
                    Start your{" "}
                    <span>
                      journey.
                    </span>
                  </>
                )}
              </h2>

              <p>
                {authMode ===
                "login"
                  ? "Log in to continue planning your next adventure."
                  : "Create your account and start planning amazing trips."}
              </p>
            </div>

            <form
              onSubmit={
                handleAuth
              }
            >
              {authMode ===
                "signup" && (
                <div className="auth-input-group">
                  <label>
                    👤 NAME
                  </label>

                  <input
                    type="text"
                    placeholder="Your name"
                    value={
                      authName
                    }
                    onChange={(
                      e
                    ) =>
                      setAuthName(
                        e.target
                          .value
                      )
                    }
                  />
                </div>
              )}

              <div className="auth-input-group">
                <label>
                  📧 EMAIL
                </label>

                <input
                  type="email"
                  placeholder="you@example.com"
                  value={
                    authEmail
                  }
                  onChange={(
                    e
                  ) =>
                    setAuthEmail(
                      e.target
                        .value
                    )
                  }
                />
              </div>

              <div className="auth-input-group">
                <label>
                  🔒 PASSWORD
                </label>

                <input
                  type="password"
                  placeholder="Enter your password"
                  value={
                    authPassword
                  }
                  onChange={(
                    e
                  ) =>
                    setAuthPassword(
                      e.target
                        .value
                    )
                  }
                />
              </div>

              {authError && (
                <div className="auth-error">
                  ⚠️{" "}
                  {authError}
                </div>
              )}

              {authSuccess && (
                <div className="auth-success">
                  ✅{" "}
                  {
                    authSuccess
                  }
                </div>
              )}

              <button
                type="submit"
                className="auth-submit"
                disabled={
                  authLoading
                }
              >
                {authLoading ? (
                  <>
                    <span className="spinner"></span>
                    Please wait...
                  </>
                ) : authMode ===
                  "login" ? (
                  <>
                    🔐 Login
                    <span>
                      →
                    </span>
                  </>
                ) : (
                  <>
                    ✨ Create
                    Account
                    <span>
                      →
                    </span>
                  </>
                )}
              </button>
            </form>

            <div className="auth-switch">
              {authMode ===
              "login" ? (
                <>
                  Don't have an
                  account?

                  <button
                    type="button"
                    onClick={() =>
                      openAuth(
                        "signup"
                      )
                    }
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an
                  account?

                  <button
                    type="button"
                    onClick={() =>
                      openAuth(
                        "login"
                      )
                    }
                  >
                    Login
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;