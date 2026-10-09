/**
 * SmartTrip Currency & Exchange Rate Utility
 *
 * Provides reputable exchange rate fetching, in-memory caching,
 * explicit conversion from a base currency, and formatted display.
 */

// In-memory cache for exchange rates: baseCurrency -> { rates: { [code]: number }, timestamp: number }
const ratesCache = new Map();
const CACHE_TTL_MS = 3600 * 1000; // 1 hour TTL

/**
 * Parses numeric monetary values from strings (e.g., "$25", "1,500 INR", "5k", "Free").
 */
export const parseMoneyAmount = (input) => {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (input == null) return null;
  const text = String(input).trim();
  if (!text) return null;
  if (/\bfree\b/i.test(text)) return 0;

  const match = text.replace(/,/g, "").match(/[-+]?\d+(?:\.\d+)?\s*[kKmM]?/);
  if (!match) return null;
  const token = match[0].replace(/\s/g, "");
  const suffix = token.slice(-1).toLowerCase();
  let value = Number(/[km]$/.test(token) ? token.slice(0, -1) : token);
  if (!Number.isFinite(value)) return null;
  if (suffix === "k") value *= 1000;
  if (suffix === "m") value *= 1000000;
  return value;
};

/**
 * Formats a numeric amount into a localized currency string.
 */
export const formatMoney = (amount, currency = "INR") => {
  if (amount == null || amount === "") return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";

  const safeCurrency = (currency || "INR").toUpperCase();
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${safeCurrency} ${value.toFixed(2)}`;
  }
};

/**
 * Fetches exchange rates for a given base currency using open, reputable exchange rate APIs.
 * Checks memory cache first.
 */
export const fetchExchangeRates = async (baseCurrency = "INR") => {
  const base = (baseCurrency || "INR").toUpperCase();
  const cached = ratesCache.get(base);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.rates;
  }

  // 1. Try ExchangeRate-API (reputable open rates)
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates === "object") {
        ratesCache.set(base, { rates: data.rates, timestamp: now });
        return data.rates;
      }
    }
  } catch (err) {
    console.warn(`[SmartTrip] Exchange rate fetch from open.er-api failed for ${base}:`, err);
  }

  // 2. Try European Central Bank (Frankfurter) fallback
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${base}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates) {
        const rates = { ...data.rates, [base]: 1.0 };
        ratesCache.set(base, { rates, timestamp: now });
        return rates;
      }
    }
  } catch (err) {
    console.warn(`[SmartTrip] Frankfurter fallback rate fetch failed for ${base}:`, err);
  }

  // If network unavailable, return cached rates even if expired
  if (cached) {
    return cached.rates;
  }

  return null;
};

/**
 * Converts an amount from base currency to target currency using provided rates.
 * Returns { amount, converted: boolean, error?: string }
 */
export const convertCurrency = (amount, fromCurrency = "INR", toCurrency = "INR", rates = null) => {
  const numeric = parseMoneyAmount(amount);
  if (numeric == null || !Number.isFinite(numeric)) {
    return { amount: null, converted: false };
  }

  const from = (fromCurrency || "INR").toUpperCase();
  const to = (toCurrency || "INR").toUpperCase();

  if (from === to) {
    return { amount: numeric, converted: true };
  }

  if (rates && rates[to] && typeof rates[to] === "number") {
    const rate = rates[to];
    const convertedValue = Math.round(numeric * rate * 100) / 100;
    return { amount: convertedValue, converted: true };
  }

  return { amount: numeric, converted: false, error: "Exchange rate unavailable" };
};
