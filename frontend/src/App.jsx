import { useState } from "react";
import "./App.css";

function App() {
  // ============================================================
  // BACKEND URL
  // ============================================================

  const BACKEND_URL = "https://smarttrips.up.railway.app";

  // ============================================================
  // PLANNER STATE
  // ============================================================

  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("");
  const [budget, setBudget] = useState("");
  const [interests, setInterests] = useState("");

  const [itinerary, setItinerary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ============================================================
  // AUTH STATE
  // ============================================================

  const [authMode, setAuthMode] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [isLoggedIn, setIsLoggedIn] = useState(
    !!localStorage.getItem("smarttripToken")
  );

  // ============================================================
  // AUTH MODAL
  // ============================================================

  const openAuth = (mode) => {
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

  // ============================================================
  // LOGIN / SIGNUP
  // ============================================================

  const handleAuth = async (e) => {
    e.preventDefault();

    setAuthError("");
    setAuthSuccess("");
    setAuthLoading(true);

    try {
      // ----------------------------------------------------------
      // SIGN UP
      // ----------------------------------------------------------

      if (authMode === "signup") {
        if (!authName || !authEmail || !authPassword) {
          throw new Error("Please fill in all the fields.");
        }

        const response = await fetch(
          `${BACKEND_URL}/api/auth/register`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: authName,
              email: authEmail,
              password: authPassword,
            }),
          }
        );

        const data = await response.text();

        if (!response.ok) {
          throw new Error(
            data || "Unable to create your account."
          );
        }

        setAuthSuccess(
          "Account created successfully! You can now log in. ✨"
        );

        setAuthMode("login");
        setAuthPassword("");

        return;
      }

      // ----------------------------------------------------------
      // LOGIN
      // ----------------------------------------------------------

      if (authMode === "login") {
        if (!authEmail || !authPassword) {
          throw new Error(
            "Please enter your email and password."
          );
        }

        const response = await fetch(
          `${BACKEND_URL}/api/auth/login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: authEmail,
              password: authPassword,
            }),
          }
        );

        const token = await response.text();

        if (!response.ok) {
          throw new Error(
            token || "Invalid email or password."
          );
        }

        localStorage.setItem(
          "smarttripToken",
          token
        );

        localStorage.setItem(
          "smarttripUser",
          JSON.stringify({
            email: authEmail,
          })
        );

        setIsLoggedIn(true);
        closeAuth();
      }
    } catch (err) {
      console.error("Authentication error:", err);

      setAuthError(
        err.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const logout = () => {
    localStorage.removeItem("smarttripToken");
    localStorage.removeItem("smarttripUser");

    setIsLoggedIn(false);
    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
  };

  // ============================================================
  // GENERATE ITINERARY
  // ============================================================

  const generateItinerary = async () => {
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
      const response = await fetch(
        `${BACKEND_URL}/api/ai/itinerary`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            destination,
            days: Number(days),
            budget: Number(budget),
            interests,
          }),
        }
      );

      const data = await response.text();

      if (!response.ok) {
        throw new Error(
          `Backend error (${response.status}): ${
            data || "Something went wrong"
          }`
        );
      }

      setItinerary(data);
    } catch (err) {
      console.error("Itinerary error:", err);

      setError(
        err.message ||
          "Unable to generate itinerary."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // TEXT CLEANING
  // ============================================================

  const cleanText = (text) => {
    if (!text) return "";

    return String(text)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .replace(/`/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // ============================================================
  // REMOVE MARKDOWN LIST MARKERS
  // ============================================================

  const removeListMarker = (text) => {
    if (!text) return "";

    return String(text)
      .replace(/^\s*[-•*]\s+/, "")
      .replace(/^\s*\d+\.\s+/, "")
      .trim();
  };

  // ============================================================
  // CLEAN MARKDOWN HEADING
  // ============================================================

  const cleanHeading = (text) => {
    if (!text) return "";

    return String(text)
      .replace(/^#{1,6}\s*/, "")
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .trim();
  };

  // ============================================================
  // INLINE MARKDOWN RENDERER
  // ============================================================

  const renderInlineText = (text) => {
    if (!text) return null;

    const cleaned = String(text)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/`/g, "");

    const parts = cleaned.split(
      /(\*\*[^*]+\*\*|\*[^*]+\*)/g
    );

    return parts.map((part, index) => {
      if (
        part.startsWith("**") &&
        part.endsWith("**")
      ) {
        return (
          <strong key={index}>
            {part.slice(2, -2)}
          </strong>
        );
      }

      if (
        part.startsWith("*") &&
        part.endsWith("*") &&
        part.length > 2
      ) {
        return (
          <em key={index}>
            {part.slice(1, -1)}
          </em>
        );
      }

      return (
        <span key={index}>
          {part}
        </span>
      );
    });
  };

  // ============================================================
  // PARSE TABLE ROW
  // ============================================================

  const parseTableRow = (line) => {
    if (!line || !line.includes("|")) {
      return null;
    }

    const cells = line
      .split("|")
      .map((cell) => cell.trim());

    if (
      cells.length > 0 &&
      cells[0] === ""
    ) {
      cells.shift();
    }

    if (
      cells.length > 0 &&
      cells[cells.length - 1] === ""
    ) {
      cells.pop();
    }

    if (cells.length < 2) {
      return null;
    }

    return cells;
  };

  // ============================================================
  // CHECK MARKDOWN TABLE SEPARATOR
  // ============================================================

  const isTableSeparator = (line) => {
    if (!line || !line.includes("|")) {
      return false;
    }

    const cells = parseTableRow(line);

    if (!cells) return false;

    return cells.every((cell) =>
      /^:?-{2,}:?$/.test(
        cell.replace(/\s/g, "")
      )
    );
  };

  // ============================================================
  // PARSE ITINERARY
  // ============================================================

  const parseItinerary = (text) => {
    const lines = String(text || "")
      .replace(/\r/g, "")
      .split("\n");

    const parsed = {
      days: [],
      tips: [],
      finalTips: [],
      overview: [],
      budgetSummary: [],
      currency: "",
    };

    let currentDay = null;
    let currentTime = null;
    let currentCategory = null;
    let inBudgetSummary = false;
    let inDayTable = false;

    // ----------------------------------------------------------
    // CREATE DAY
    // ----------------------------------------------------------

    const createDay = (number, title) => ({
      number,
      title:
        cleanText(title) ||
        "Your Adventure",
      focus: "",
      morning: [],
      afternoon: [],
      evening: [],
      food: [],
      places: [],
      expenses: [],
    });

    // ----------------------------------------------------------
    // ADD TIME ITEM
    // ----------------------------------------------------------

    const addToCurrentTime = (item) => {
      if (
        !currentDay ||
        !currentTime ||
        !item
      ) {
        return;
      }

      currentDay[currentTime].push(
        cleanText(item)
      );
    };

    // ----------------------------------------------------------
    // ADD SIDE ITEM
    // ----------------------------------------------------------

    const addSideItem = (
      category,
      item
    ) => {
      if (!currentDay || !item) return;

      const cleaned = cleanText(item);

      if (!cleaned) return;

      if (category === "food") {
        currentDay.food.push(cleaned);
      }

      if (category === "places") {
        currentDay.places.push(cleaned);
      }

      if (category === "expenses") {
        currentDay.expenses.push(cleaned);
      }
    };

    // ----------------------------------------------------------
    // DAY HEADING
    // ----------------------------------------------------------

    const getDayHeading = (line) => {
      const cleaned = cleanHeading(line);

      const match = cleaned.match(
        /^Day\s+(\d+)\s*(?:[:\-–—]\s*)?(.*)$/i
      );

      if (!match) {
        return null;
      }

      return {
        number: match[1],
        title:
          cleanText(match[2]) ||
          "Your Adventure",
      };
    };

    // ----------------------------------------------------------
    // TIME SECTION
    // ----------------------------------------------------------

    const getTimeSection = (line) => {
      const cleaned = cleanHeading(line);

      const match = cleaned.match(
        /^(Morning|Afternoon|Evening)\s*(.*)$/i
      );

      if (!match) return null;

      return {
        key: match[1].toLowerCase(),
        title:
          `${match[1]} ${match[2] || ""}`.trim(),
      };
    };

    // ----------------------------------------------------------
    // LABEL
    // ----------------------------------------------------------

    const extractLabel = (line) => {
      let value = removeListMarker(line);

      value = value
        .replace(/^#{1,6}\s*/, "")
        .trim();

      const match = value.match(
        /^(?:\*\*)?([^:]{2,45})(?:\*\*)?\s*:\s*(.*)$/ 
      );

      if (!match) {
        return null;
      }

      const label = cleanText(match[1]);
      const content = cleanText(match[2]);

      const lower = label.toLowerCase();

      const recognized = [
        "focus",
        "places to visit",
        "places",
        "activities",
        "activity",
        "food",
        "food recommendation",
        "food recommendations",
        "estimated expenses",
        "estimated day expenses",
        "expenses",
        "transport",
        "admissions",
        "subtotal",
        "total",
        "accommodation",
        "breakfast",
        "lunch",
        "dinner",
        "afternoon coffee",
        "snack",
        "brunch",
      ];

      const isRecognized =
        recognized.some((item) =>
          lower.startsWith(item)
        );

      if (!isRecognized) {
        return null;
      }

      return {
        label,
        content,
        lower,
      };
    };

    // ----------------------------------------------------------
    // TABLE ROW → DAY DATA
    // ----------------------------------------------------------

    const processTableRow = (cells) => {
      if (!currentDay || !cells) {
        return;
      }

      const segment = cleanText(cells[0] || "");
      const activity = cleanText(cells[1] || "");
      const notes = cleanText(cells[2] || "");
      const cost = cleanText(cells[3] || "");

      if (
        segment.toLowerCase() === "segment"
      ) {
        return;
      }

      if (!segment && !activity) {
        return;
      }

      const combined = [];

      if (activity) {
        combined.push(activity);
      }

      if (notes) {
        combined.push(notes);
      }

      if (cost) {
        combined.push(`Approx. Cost: ${cost}`);
      }

      const item = combined.join(" — ");

      if (!item) return;

      const lowerSegment =
        segment.toLowerCase();

      if (
        lowerSegment.includes("morning")
      ) {
        currentDay.morning.push(item);
      } else if (
        lowerSegment.includes("afternoon")
      ) {
        currentDay.afternoon.push(item);
      } else if (
        lowerSegment.includes("evening")
      ) {
        currentDay.evening.push(item);
      } else if (
        lowerSegment.includes("food")
      ) {
        currentDay.food.push(item);
      } else if (
        lowerSegment.includes("shopping")
      ) {
        currentDay.places.push(item);
      } else if (
        lowerSegment.includes("transport")
      ) {
        currentDay.expenses.push(
          item
        );
      } else if (
        lowerSegment.includes("total")
      ) {
        currentDay.expenses.push(
          `Total: ${item}`
        );
      } else {
        currentDay.morning.push(item);
      }
    };

    // ==========================================================
    // PROCESS EACH LINE
    // ==========================================================

    lines.forEach((rawLine) => {
      const line = rawLine.trim();

      if (!line) {
        return;
      }

      // --------------------------------------------------------
      // HORIZONTAL RULE
      // --------------------------------------------------------

      if (
        /^[-_*]{3,}$/.test(line)
      ) {
        return;
      }

      // --------------------------------------------------------
      // CURRENCY
      // --------------------------------------------------------

      const currencyMatch =
        line.match(
          /^\**Currency\**\s*:\s*(.+)$/i
        );

      if (
        currencyMatch &&
        !parsed.currency
      ) {
        parsed.currency =
          cleanText(
            currencyMatch[1]
          );
      }

      // --------------------------------------------------------
      // FINAL BUDGET SUMMARY
      // --------------------------------------------------------

      if (
        /^#{1,6}\s*.*Final Budget Summary/i.test(
          line
        ) ||
        /^Final Budget Summary/i.test(
          cleanHeading(line)
        ) ||
        /^#{1,6}\s*.*Total .* Cost Summary/i.test(
          line
        )
      ) {
        inBudgetSummary = true;
        inDayTable = false;
        currentTime = null;
        currentCategory = null;
        return;
      }

      // --------------------------------------------------------
      // DAY HEADING
      // --------------------------------------------------------

      const dayHeading =
        getDayHeading(line);

      if (dayHeading) {
        currentDay = createDay(
          dayHeading.number,
          dayHeading.title
        );

        parsed.days.push(
          currentDay
        );

        currentTime = null;
        currentCategory = null;
        inBudgetSummary = false;
        inDayTable = false;

        return;
      }

      // --------------------------------------------------------
      // BUDGET TABLE
      // --------------------------------------------------------

      if (inBudgetSummary) {
        if (
          isTableSeparator(line)
        ) {
          return;
        }

        const tableCells =
          parseTableRow(line);

        if (tableCells) {
          const cleanedCells =
            tableCells.map((cell) =>
              cleanText(cell)
            );

          if (
            cleanedCells[0]
              ?.toLowerCase()
              .includes("item") ||
            cleanedCells[0]
              ?.toLowerCase()
              .includes("category")
          ) {
            return;
          }

          parsed.budgetSummary.push(
            cleanedCells.join(" — ")
          );

          return;
        }

        const budgetLine =
          cleanText(
            removeListMarker(line)
          );

        if (budgetLine) {
          parsed.budgetSummary.push(
            budgetLine
          );
        }

        return;
      }

      // --------------------------------------------------------
      // DAY TABLE
      // --------------------------------------------------------

      if (
        currentDay &&
        line.includes("|")
      ) {
        if (
          isTableSeparator(line)
        ) {
          inDayTable = true;
          return;
        }

        const cells =
          parseTableRow(line);

        if (cells) {
          processTableRow(cells);
          inDayTable = true;
          return;
        }
      }

      // --------------------------------------------------------
      // TIME SECTION
      // --------------------------------------------------------

      const timeSection =
        getTimeSection(line);

      if (
        timeSection &&
        currentDay
      ) {
        currentTime =
          timeSection.key;

        currentCategory = "time";

        return;
      }

      // --------------------------------------------------------
      // BLOCKQUOTE / TIP
      // --------------------------------------------------------

      if (line.startsWith(">")) {
        let tip = line
          .replace(/^>\s*/, "")
          .replace(/^Tip:\s*/i, "")
          .trim();

        tip = cleanText(tip);

        if (tip) {
          if (currentDay) {
            parsed.finalTips.push(
              tip
            );
          } else {
            parsed.tips.push(
              tip
            );
          }
        }

        return;
      }

      // --------------------------------------------------------
      // NUMBERED FINAL TIPS
      // --------------------------------------------------------

      if (
        /^\d+\.\s+/.test(line) &&
        currentDay &&
        parsed.days.length > 0 &&
        !currentTime
      ) {
        parsed.finalTips.push(
          cleanText(
            line.replace(
              /^\d+\.\s+/,
              ""
            )
          )
        );

        return;
      }

      // --------------------------------------------------------
      // LABELS
      // --------------------------------------------------------

      const labelData =
        extractLabel(line);

      if (labelData) {
        const {
          label,
          content,
          lower,
        } = labelData;

        // FOCUS
        if (lower === "focus") {
          if (currentDay) {
            currentDay.focus =
              content;
          }

          return;
        }

        // PLACES
        if (
          lower.includes(
            "places to visit"
          ) ||
          lower === "places"
        ) {
          currentCategory =
            "places";

          if (content) {
            addSideItem(
              "places",
              content
            );
          }

          return;
        }

        // FOOD
        if (
          lower === "food" ||
          lower.includes(
            "food recommendation"
          )
        ) {
          currentCategory =
            "food";

          if (content) {
            addSideItem(
              "food",
              content
            );
          }

          return;
        }

        // EXPENSES
        if (
          lower.includes(
            "estimated expenses"
          ) ||
          lower.includes(
            "estimated day expenses"
          ) ||
          lower === "expenses"
        ) {
          currentCategory =
            "expenses";

          if (content) {
            addSideItem(
              "expenses",
              content
            );
          }

          return;
        }

        // TRANSPORT / ADMISSIONS / ACCOMMODATION
        if (
          lower === "transport" ||
          lower === "admissions" ||
          lower === "accommodation" ||
          lower === "subtotal" ||
          lower === "total"
        ) {
          currentCategory =
            "expenses";

          if (content) {
            addSideItem(
              "expenses",
              `${label}: ${content}`
            );
          }

          return;
        }

        // FOOD DETAILS
        if (
          lower === "breakfast" ||
          lower === "lunch" ||
          lower === "dinner" ||
          lower === "snack" ||
          lower === "brunch" ||
          lower.includes(
            "afternoon coffee"
          )
        ) {
          currentCategory =
            "food";

          if (content) {
            addSideItem(
              "food",
              `${label}: ${content}`
            );
          }

          return;
        }

        // ACTIVITIES
        if (
          lower === "activities" ||
          lower === "activity"
        ) {
          currentCategory =
            "time";

          if (content) {
            addToCurrentTime(
              content
            );
          }

          return;
        }
      }

      // --------------------------------------------------------
      // BULLETS
      // --------------------------------------------------------

      const isBullet =
        /^[-•*]\s+/.test(line) ||
        /^\d+\.\s+/.test(line);

      if (isBullet) {
        let bullet =
          removeListMarker(line);

        const bulletLabel =
          extractLabel(bullet);

        if (bulletLabel) {
          const {
            label,
            content,
            lower,
          } = bulletLabel;

          if (lower === "focus") {
            if (currentDay) {
              currentDay.focus =
                content;
            }

            return;
          }

          if (
            lower.includes(
              "places to visit"
            ) ||
            lower === "places"
          ) {
            currentCategory =
              "places";

            if (content) {
              addSideItem(
                "places",
                content
              );
            }

            return;
          }

          if (
            lower === "food" ||
            lower.includes(
              "food recommendation"
            )
          ) {
            currentCategory =
              "food";

            if (content) {
              addSideItem(
                "food",
                content
              );
            }

            return;
          }

          if (
            lower.includes(
              "estimated expenses"
            ) ||
            lower.includes(
              "estimated day expenses"
            ) ||
            lower === "expenses"
          ) {
            currentCategory =
              "expenses";

            if (content) {
              addSideItem(
                "expenses",
                content
              );
            }

            return;
          }
        }

        bullet = cleanText(bullet);

        if (!bullet) {
          return;
        }

        if (currentDay) {
          if (
            currentCategory ===
            "food"
          ) {
            addSideItem(
              "food",
              bullet
            );
          } else if (
            currentCategory ===
            "places"
          ) {
            addSideItem(
              "places",
              bullet
            );
          } else if (
            currentCategory ===
            "expenses"
          ) {
            addSideItem(
              "expenses",
              bullet
            );
          } else if (currentTime) {
            addToCurrentTime(
              bullet
            );
          } else {
            currentDay.morning.push(
              bullet
            );
          }
        } else {
          if (
            parsed.days.length === 0
          ) {
            parsed.overview.push(
              bullet
            );
          } else {
            parsed.finalTips.push(
              bullet
            );
          }
        }

        return;
      }

      // --------------------------------------------------------
      // MAIN MARKDOWN HEADING
      // --------------------------------------------------------

      if (
        /^#{1,6}\s+/.test(line)
      ) {
        const heading =
          cleanHeading(line);

        if (!heading) {
          return;
        }

        const headingLower =
          heading.toLowerCase();

        if (
          headingLower.includes(
            "personalized plan"
          ) ||
          headingLower.includes(
            "your itinerary"
          ) ||
          headingLower.includes(
            "your smarttrip plan"
          ) ||
          headingLower.includes(
            "smarttrip itinerary"
          )
        ) {
          return;
        }

        if (!currentDay) {
          parsed.overview.push(
            heading
          );
        }

        return;
      }

      // --------------------------------------------------------
      // NORMAL TEXT
      // --------------------------------------------------------

      const normalText =
        cleanText(
          removeListMarker(line)
        );

      if (!normalText) {
        return;
      }

      if (
        /^category\s*$/i.test(
          normalText
        )
      ) {
        return;
      }

      if (
        currentDay
      ) {
        if (
          currentCategory ===
          "food"
        ) {
          addSideItem(
            "food",
            normalText
          );
        } else if (
          currentCategory ===
          "places"
        ) {
          addSideItem(
            "places",
            normalText
          );
        } else if (
          currentCategory ===
          "expenses"
        ) {
          addSideItem(
            "expenses",
            normalText
          );
        } else if (
          currentTime
        ) {
          addToCurrentTime(
            normalText
          );
        } else {
          const focusMatch =
            normalText.match(
              /^Focus\s*:\s*(.*)$/i
            );

          if (
            focusMatch
          ) {
            currentDay.focus =
              cleanText(
                focusMatch[1]
              );
          } else {
            currentDay.morning.push(
              normalText
            );
          }
        }
      } else {
        parsed.overview.push(
          normalText
        );
      }
    });

    return parsed;
  };

  // ============================================================
  // TIME CARD
  // ============================================================

  const renderTimeCard = (
    title,
    items,
    type
  ) => {
    if (
      !items ||
      items.length === 0
    ) {
      return null;
    }

    const icon =
      type === "morning"
        ? "🌅"
        : type === "afternoon"
        ? "☀️"
        : "🌙";

    return (
      <div
        className={`time-card time-card-${type}`}
      >
        <div className="time-card-header">
          <span className="time-card-icon">
            {icon}
          </span>

          <h4>{title}</h4>
        </div>

        <div className="time-card-body">
          {items.map(
            (item, index) => (
              <div
                className="time-item"
                key={index}
              >
                <span className="time-item-dot">
                  •
                </span>

                <p>
                  {renderInlineText(
                    item
                  )}
                </p>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // SIDE PANEL
  // ============================================================

  const renderSideBlock = (
    title,
    icon,
    items,
    className
  ) => {
    if (
      !items ||
      items.length === 0
    ) {
      return null;
    }

    return (
      <div
        className={`side-block ${
          className || ""
        }`}
      >
        <div className="side-block-title">
          <span>{icon}</span>

          <h4>{title}</h4>
        </div>

        <div className="side-block-content">
          {items.map(
            (item, index) => {
              const isTotal =
                /^(total|subtotal)/i.test(
                  item
                ) ||
                /subtotal/i.test(
                  item
                );

              return (
                <div
                  className={
                    isTotal
                      ? "side-item side-item-total"
                      : "side-item"
                  }
                  key={index}
                >
                  <span>•</span>

                  <p>
                    {renderInlineText(
                      item
                    )}
                  </p>
                </div>
              );
            }
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // ITINERARY RENDERER
  // ============================================================

  const renderItinerary = () => {
    if (!itinerary) {
      return null;
    }

    const parsed =
      parseItinerary(itinerary);

    const currency =
      parsed.currency ||
      "Travel Budget";

    return (
      <div className="formatted-itinerary">

        {/* =====================================================
            SMARTTRIP OVERVIEW
        ====================================================== */}

        <div className="itinerary-overview">

          <div className="overview-left">

            <div className="overview-icon">
              🌴
            </div>

            <div className="overview-content">

              <div className="overview-label">
                YOUR SMARTTRIP PLAN
              </div>

              <h3>
                {destination}
              </h3>

              <p>
                📍 {destination}

                <span className="overview-dot">
                  •
                </span>

                📅 {days} Days
              </p>

            </div>

          </div>

          <div className="overview-stats">

            {/* BUDGET */}

            <div className="overview-stat">

              <span className="overview-stat-icon">
                💰
              </span>

              <div>
                <small>
                  BUDGET
                </small>

                <strong>
                  {budget}
                </strong>
              </div>

            </div>

            {/* INTERESTS */}

            <div className="overview-stat">

              <span className="overview-stat-icon">
                ❤️
              </span>

              <div>
                <small>
                  INTERESTS
                </small>

                <strong>
                  {interests}
                </strong>
              </div>

            </div>

            {/* CURRENCY */}

            <div className="overview-stat">

              <span className="overview-stat-icon">
                💱
              </span>

              <div>
                <small>
                  CURRENCY
                </small>

                <strong>
                  {currency}
                </strong>
              </div>

            </div>

          </div>

        </div>

        {/* =====================================================
            SMARTTRIP TIPS
        ====================================================== */}

        {parsed.tips.length > 0 && (
          <div className="smarttrip-tip-box">

            <div className="smarttrip-tip-icon">
              💡
            </div>

            <div className="smarttrip-tip-content">

              <strong>
                Tip:
              </strong>

              <div className="smarttrip-tip-list">

                {parsed.tips.map(
                  (tip, index) => (
                    <span key={index}>
                      •{" "}
                      {renderInlineText(
                        tip
                      )}
                    </span>
                  )
                )}

              </div>

            </div>

          </div>
        )}

        {/* =====================================================
            DAYS
        ====================================================== */}

        <div className="itinerary-days">

          {parsed.days.map(
            (day, index) => (
              <div
                className="day-card"
                key={`${day.number}-${index}`}
              >

                {/* DAY HEADER */}

                <div className="day-card-header">

                  <div className="day-pill">
                    Day {day.number}
                  </div>

                  <div className="day-heading-content">

                    <h3>
                      {day.title}
                    </h3>

                    {day.focus && (
                      <p className="day-focus">
                        <strong>
                          Focus:
                        </strong>{" "}
                        {renderInlineText(
                          day.focus
                        )}
                      </p>
                    )}

                  </div>

                </div>

                {/* DAY BODY */}

                <div className="day-card-body">

                  {/* TIME CARDS */}

                  <div className="day-time-grid">

                    {renderTimeCard(
                      "Morning",
                      day.morning,
                      "morning"
                    )}

                    {renderTimeCard(
                      "Afternoon",
                      day.afternoon,
                      "afternoon"
                    )}

                    {renderTimeCard(
                      "Evening",
                      day.evening,
                      "evening"
                    )}

                  </div>

                  {/* SIDE PANEL */}

                  {(day.food.length > 0 ||
                    day.places.length > 0 ||
                    day.expenses.length > 0) && (

                    <div className="day-side-panel">

                      {renderSideBlock(
                        "Food",
                        "🍴",
                        day.food,
                        "side-food"
                      )}

                      {renderSideBlock(
                        "Places to Visit",
                        "📍",
                        day.places,
                        "side-places"
                      )}

                      {renderSideBlock(
                        "Estimated Expenses",
                        "💰",
                        day.expenses,
                        "side-expenses"
                      )}

                    </div>
                  )}

                </div>

              </div>
            )
          )}

        </div>

        {/* =====================================================
            BUDGET SUMMARY
        ====================================================== */}

        {parsed.budgetSummary.length > 0 && (

          <div className="final-budget-card">

            <div className="final-budget-header">

              <span>
                💰
              </span>

              <div>

                <div className="section-label">
                  FINAL BUDGET
                </div>

                <h3>
                  Budget Summary
                </h3>

              </div>

            </div>

            <div className="final-budget-list">

              {parsed.budgetSummary.map(
                (item, index) => (
                  <div
                    className="final-budget-row"
                    key={index}
                  >
                    <span>
                      {renderInlineText(
                        item
                      )}
                    </span>
                  </div>
                )
              )}

            </div>

          </div>
        )}

        {/* =====================================================
            FINAL TIPS
        ====================================================== */}

        {parsed.finalTips.length > 0 && (

          <div className="smarttrip-tip-box final-tip-box">

            <div className="smarttrip-tip-icon">
              ✨
            </div>

            <div className="smarttrip-tip-content">

              <strong>
                SmartTrip Tips
              </strong>

              <div className="smarttrip-tip-list">

                {parsed.finalTips.map(
                  (tip, index) => (
                    <span key={index}>
                      •{" "}
                      {renderInlineText(
                        tip
                      )}
                    </span>
                  )
                )}

              </div>

            </div>

          </div>
        )}

        {/* =====================================================
            END MESSAGE
        ====================================================== */}

        <div className="itinerary-footer">

          <span>
            ✨
          </span>

          <div>

            <strong>
              Have an amazing trip!
            </strong>

            <p>
              Your SmartTrip itinerary is
              ready. Enjoy your adventure
              in {destination}.
            </p>

          </div>

        </div>

      </div>
    );
  };

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div className="app">

      {/* =====================================================
          NAVBAR
      ====================================================== */}

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
                  openAuth("login")
                }
              >
                Login
              </button>

              <button
                className="nav-button signup-nav-button"
                onClick={() =>
                  openAuth("signup")
                }
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              <span className="welcome-user">
                👋 Welcome
              </span>

              <button
                className="login-button"
                onClick={logout}
              >
                Logout
              </button>
            </>
          )}

        </div>

      </nav>

      {/* =====================================================
          HERO
      ====================================================== */}

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
            Tell us where you want to go,
            what you love, and your budget.
            SmartTrip creates a personalized
            itinerary for you.
          </p>

          <button
            className="hero-button"
            onClick={() =>
              document
                .getElementById("planner")
                ?.scrollIntoView({
                  behavior: "smooth",
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

      {/* =====================================================
          PLANNER
      ====================================================== */}

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
              {" "}go next?
            </span>
          </h2>

          <p>
            Give us a few details and let
            SmartTrip build your perfect
            adventure.
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
              value={destination}
              onChange={(e) =>
                setDestination(
                  e.target.value
                )
              }
            />

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
              value={interests}
              onChange={(e) =>
                setInterests(
                  e.target.value
                )
              }
            />

          </div>

          <button
            className="generate-button"
            onClick={
              generateItinerary
            }
            disabled={loading}
          >

            {loading ? (
              <>
                <span className="spinner"></span>
                Creating your itinerary...
              </>
            ) : (
              <>
                ✨ Generate My Itinerary
                <span>
                  →
                </span>
              </>
            )}

          </button>

        </div>

        {/* ERROR */}

        {error && (

          <div className="error-box">

            <span>
              ⚠️
            </span>

            <div>

              <strong>
                Something went wrong
              </strong>

              <p>
                {error}
              </p>

            </div>

          </div>
        )}

        {/* RESULT */}

        {itinerary && (

          <div className="result-section">

            <div className="result-header">

              <div>

                <div className="section-label">
                  YOUR PERSONALIZED PLAN
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
                  📍 {destination}
                </span>

                <span>
                  📅 {days} days
                </span>

              </div>

            </div>

            {/* FORMATTED ITINERARY */}

            <div className="itinerary-card">
              {renderItinerary()}
            </div>

          </div>
        )}

      </section>

      {/* =====================================================
          FEATURES
      ====================================================== */}

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
              {" "}simplified.
            </span>
          </h2>

          <p>
            Everything you need to turn
            your travel ideas into memorable
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
              Get personalized travel plans
              generated around your interests
              and preferences.
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
              Plan your adventure around the
              budget you actually want to spend.
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
              Get organized morning, afternoon
              and evening activities for every day.
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
              Your interests shape the experience,
              making every trip uniquely yours.
            </p>

          </div>

        </div>

      </section>

      {/* =====================================================
          ABOUT
      ====================================================== */}

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
            SmartTrip uses artificial
            intelligence to make travel
            planning simple. Instead of
            spending hours researching
            destinations, tell us what you
            want and we'll help turn it into
            a journey.
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

      {/* =====================================================
          FOOTER
      ====================================================== */}

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
          AI-powered travel planning for
          curious explorers.
        </p>

        <span className="copyright">
          © 2026 SmartTrip
        </span>

      </footer>

      {/* =====================================================
          AUTH MODAL
      ====================================================== */}

      {authMode && (

        <div
          className="auth-overlay"
          onClick={closeAuth}
        >

          <div
            className="auth-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* CLOSE */}

            <button
              className="auth-close"
              onClick={closeAuth}
            >
              ×
            </button>

            {/* ICON */}

            <div className="auth-icon">
              {authMode === "login"
                ? "👋"
                : "✨"}
            </div>

            {/* TITLE */}

            <div className="auth-heading">

              <div className="section-label">

                {authMode === "login"
                  ? "WELCOME BACK"
                  : "JOIN SMARTTRIP"}

              </div>

              <h2>

                {authMode === "login" ? (
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

                {authMode === "login"
                  ? "Log in to continue planning your next adventure."
                  : "Create your account and start planning amazing trips."}

              </p>

            </div>

            {/* FORM */}

            <form onSubmit={handleAuth}>

              {authMode === "signup" && (

                <div className="auth-input-group">

                  <label>
                    👤 NAME
                  </label>

                  <input
                    type="text"
                    placeholder="Your name"
                    value={authName}
                    onChange={(e) =>
                      setAuthName(
                        e.target.value
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
                  value={authEmail}
                  onChange={(e) =>
                    setAuthEmail(
                      e.target.value
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
                  value={authPassword}
                  onChange={(e) =>
                    setAuthPassword(
                      e.target.value
                    )
                  }
                />

              </div>

              {/* AUTH ERROR */}

              {authError && (

                <div className="auth-error">
                  ⚠️ {authError}
                </div>

              )}

              {/* AUTH SUCCESS */}

              {authSuccess && (

                <div className="auth-success">
                  ✅ {authSuccess}
                </div>

              )}

              {/* BUTTON */}

              <button
                type="submit"
                className="auth-submit"
                disabled={authLoading}
              >

                {authLoading ? (
                  <>
                    <span className="spinner"></span>
                    Please wait...
                  </>
                ) : authMode === "login" ? (
                  <>
                    🔐 Login
                    <span>
                      →
                    </span>
                  </>
                ) : (
                  <>
                    ✨ Create Account
                    <span>
                      →
                    </span>
                  </>
                )}

              </button>

            </form>

            {/* SWITCH */}

            <div className="auth-switch">

              {authMode === "login" ? (
                <>
                  Don't have an account?

                  <button
                    type="button"
                    onClick={() =>
                      openAuth("signup")
                    }
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?

                  <button
                    type="button"
                    onClick={() =>
                      openAuth("login")
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