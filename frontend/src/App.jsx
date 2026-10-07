import { useState } from "react";
import "./App.css";

function App() {
  // =========================
  // BACKEND URL
  // =========================

  const BACKEND_URL = "https://smarttrip-production-7935.up.railway.app";

  // =========================
  // PLANNER STATE
  // =========================

  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("");
  const [budget, setBudget] = useState("");
  const [interests, setInterests] = useState("");
  const [itinerary, setItinerary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // =========================
  // AUTH STATE
  // =========================

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

  // =========================
  // OPEN AUTH MODAL
  // =========================

  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthError("");
    setAuthSuccess("");
    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
  };

  // =========================
  // CLOSE AUTH MODAL
  // =========================

  const closeAuth = () => {
    setAuthMode(null);
    setAuthError("");
    setAuthSuccess("");
    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthLoading(false);
  };

  // =========================
  // LOGIN / SIGNUP
  // =========================

  const handleAuth = async (e) => {
    e.preventDefault();

    setAuthError("");
    setAuthSuccess("");
    setAuthLoading(true);

    try {
      // -------------------------
      // SIGN UP
      // -------------------------

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
        setAuthLoading(false);

        return;
      }

      // -------------------------
      // LOGIN
      // -------------------------

      if (authMode === "login") {
        if (!authEmail || !authPassword) {
          throw new Error("Please enter your email and password.");
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

        // Your backend currently returns JWT as plain text
        const token = await response.text();

        if (!response.ok) {
          throw new Error(
            token || "Invalid email or password."
          );
        }

        // Save JWT
        localStorage.setItem("smarttripToken", token);

        // Save basic user information
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
        err.message || "Something went wrong. Please try again."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  // =========================
  // LOGOUT
  // =========================

  const logout = () => {
    localStorage.removeItem("smarttripToken");
    localStorage.removeItem("smarttripUser");

    setIsLoggedIn(false);

    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
  };

  // =========================
  // GENERATE ITINERARY
  // =========================

  const generateItinerary = async () => {
    if (!destination || !days || !budget || !interests) {
      setError("Please fill in all the travel details.");
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
        err.message || "Unable to generate itinerary."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // PAGE
  // =========================

  return (
    <div className="app">

      {/* =========================
          NAVBAR
      ========================= */}

      <nav className="navbar">

        <div className="logo">
          <span className="logo-icon">✈</span>
          <span>
            Smart<span>Trip</span>
          </span>
        </div>

        <div className="nav-links">
          <a href="#planner">Planner</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
        </div>

        <div className="navbar-auth">

          {!isLoggedIn ? (
            <>
              <button
                className="login-button"
                onClick={() => openAuth("login")}
              >
                Login
              </button>

              <button
                className="nav-button signup-nav-button"
                onClick={() => openAuth("signup")}
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

      {/* =========================
          HERO
      ========================= */}

      <section className="hero">

        <div className="hero-content">

          <div className="badge">
            ✨ AI-Powered Travel Planning
          </div>

          <h1>
            Your next adventure
            <br />
            <span>starts here.</span>
          </h1>

          <p>
            Tell us where you want to go, what you love,
            and your budget. SmartTrip creates a personalized
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
            <span>→</span>
          </button>

        </div>

        <div className="hero-visual">

          <div className="floating-card card-one">
            <span>📍</span>

            <div>
              <strong>Explore</strong>
              <small>New destinations</small>
            </div>
          </div>

          <div className="travel-circle">

            <div className="circle-content">
              <span>🌍</span>
              <strong>TRAVEL</strong>
              <small>WITHOUT LIMITS</small>
            </div>

          </div>

          <div className="floating-card card-two">
            <span>✨</span>

            <div>
              <strong>AI Planned</strong>
              <small>Just for you</small>
            </div>
          </div>

        </div>

      </section>

      {/* =========================
          PLANNER
      ========================= */}

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
            <span> go next?</span>
          </h2>

          <p>
            Give us a few details and let SmartTrip build
            your perfect adventure.
          </p>

        </div>

        <div className="planner-card">

          <div className="input-group destination-input">

            <label>📍 DESTINATION</label>

            <input
              type="text"
              placeholder="e.g. Paris, Tokyo, Bali..."
              value={destination}
              onChange={(e) =>
                setDestination(e.target.value)
              }
            />

          </div>

          <div className="input-row">

            <div className="input-group">

              <label>📅 DAYS</label>

              <input
                type="number"
                min="1"
                placeholder="5"
                value={days}
                onChange={(e) =>
                  setDays(e.target.value)
                }
              />

            </div>

            <div className="input-group">

              <label>💰 BUDGET</label>

              <input
                type="number"
                min="1"
                placeholder="50000"
                value={budget}
                onChange={(e) =>
                  setBudget(e.target.value)
                }
              />

            </div>

          </div>

          <div className="input-group">

            <label>❤️ INTERESTS</label>

            <input
              type="text"
              placeholder="Food, beaches, history, shopping..."
              value={interests}
              onChange={(e) =>
                setInterests(e.target.value)
              }
            />

          </div>

          <button
            className="generate-button"
            onClick={generateItinerary}
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
                <span>→</span>
              </>
            )}

          </button>

        </div>

        {/* ERROR */}

        {error && (
          <div className="error-box">

            <span>⚠️</span>

            <div>
              <strong>Something went wrong</strong>

              <p>{error}</p>
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
                  Your <span>Itinerary</span> 🗺️
                </h2>

              </div>

              <div className="trip-summary">
                <span>📍 {destination}</span>
                <span>📅 {days} days</span>
              </div>

            </div>

            <div className="itinerary-card">
              <pre>{itinerary}</pre>
            </div>

          </div>
        )}

      </section>

      {/* =========================
          FEATURES
      ========================= */}

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
            <span> simplified.</span>
          </h2>

          <p>
            Everything you need to turn your travel ideas
            into memorable adventures.
          </p>

        </div>

        <div className="features-grid">

          <div className="feature-card">

            <div className="feature-icon">
              🤖
            </div>

            <h3>AI-Powered</h3>

            <p>
              Get personalized travel plans generated
              around your interests and preferences.
            </p>

          </div>

          <div className="feature-card">

            <div className="feature-icon">
              💰
            </div>

            <h3>Budget Friendly</h3>

            <p>
              Plan your adventure around the budget
              you actually want to spend.
            </p>

          </div>

          <div className="feature-card">

            <div className="feature-icon">
              🗺️
            </div>

            <h3>Day-by-Day Plans</h3>

            <p>
              Get organized morning, afternoon and
              evening activities for every day.
            </p>

          </div>

          <div className="feature-card">

            <div className="feature-icon">
              ❤️
            </div>

            <h3>Made for You</h3>

            <p>
              Your interests shape the experience,
              making every trip uniquely yours.
            </p>

          </div>

        </div>

      </section>

      {/* =========================
          ABOUT
      ========================= */}

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
            <span>More exploring.</span>
          </h2>

          <p>
            SmartTrip uses artificial intelligence to make
            travel planning simple. Instead of spending hours
            researching destinations, tell us what you want
            and we'll help turn it into a journey.
          </p>

        </div>

        <div className="about-stats">

          <div>
            <strong>AI</strong>
            <span>Powered Planning</span>
          </div>

          <div>
            <strong>24/7</strong>
            <span>Travel Inspiration</span>
          </div>

          <div>
            <strong>∞</strong>
            <span>Possible Adventures</span>
          </div>

        </div>

      </section>

      {/* =========================
          FOOTER
      ========================= */}

      <footer>

        <div className="logo">

          <span className="logo-icon">
            ✈
          </span>

          <span>
            Smart<span>Trip</span>
          </span>

        </div>

        <p>
          AI-powered travel planning for curious explorers.
        </p>

        <span className="copyright">
          © 2026 SmartTrip
        </span>

      </footer>

      {/* =========================
          AUTH MODAL
      ========================= */}

      {authMode && (
        <div
          className="auth-overlay"
          onClick={closeAuth}
        >

          <div
            className="auth-modal"
            onClick={(e) => e.stopPropagation()}
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
              {authMode === "login" ? "👋" : "✨"}
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
                    Welcome <span>back.</span>
                  </>
                ) : (
                  <>
                    Start your <span>journey.</span>
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

                  <label>👤 NAME</label>

                  <input
                    type="text"
                    placeholder="Your name"
                    value={authName}
                    onChange={(e) =>
                      setAuthName(e.target.value)
                    }
                  />

                </div>
              )}

              <div className="auth-input-group">

                <label>📧 EMAIL</label>

                <input
                  type="email"
                  placeholder="you@example.com"
                  value={authEmail}
                  onChange={(e) =>
                    setAuthEmail(e.target.value)
                  }
                />

              </div>

              <div className="auth-input-group">

                <label>🔒 PASSWORD</label>

                <input
                  type="password"
                  placeholder="Enter your password"
                  value={authPassword}
                  onChange={(e) =>
                    setAuthPassword(e.target.value)
                  }
                />

              </div>

              {/* ERROR */}

              {authError && (
                <div className="auth-error">
                  ⚠️ {authError}
                </div>
              )}

              {/* SUCCESS */}

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
                    <span>→</span>
                  </>
                ) : (
                  <>
                    ✨ Create Account
                    <span>→</span>
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
                    onClick={() => openAuth("signup")}
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?

                  <button
                    type="button"
                    onClick={() => openAuth("login")}
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