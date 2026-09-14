/* Krishak Irrigation AI — Gemini-backed explanation layer.
   This is a SUPPLEMENT to the existing deterministic planner, not a replacement.
   All numeric values come from the verified planner/weather inputs.
   The AI only explains; it never invents measurements or certainty. */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PROMPT = `You are an agricultural assistant helping a farmer understand an irrigation recommendation that was produced by a deterministic calculation engine.
Your job is ONLY to explain what the deterministic plan says in plain, farmer-friendly language.
NEVER invent soil moisture readings, rainfall amounts, sensor values, crop coefficients, or any numbers not provided to you.
NEVER claim certainty beyond what the data supports.
Be concise: 2-4 short sentences max.
Output a JSON object with these exact keys:
  "action": one short sentence (10 words max) describing the recommended next step,
  "why": one or two sentences explaining the reason using only the provided inputs,
  "caution": optional one sentence about a limitation or uncertainty (omit if not useful).
Do NOT include markdown, code fences, or extra text outside the JSON object.`;

export async function createIrrigationExplanation({ plan, weather, fieldInputs }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const error = new Error("AI service is not configured.");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  // Build a compact context string from verified inputs only.
  const weatherSummary = weather
    ? `Current weather: ${weather.current?.temperatureC ?? "unknown"}°C, ${weather.current?.condition ?? "unknown"}, humidity ${weather.current?.humidityPercent ?? "unknown"}%.`
    : "Weather data: not available.";

  const forecastSummary = weather?.forecast?.length
    ? `3-day forecast: ${weather.forecast.map((d) => `${d.date}: ${d.condition}`).join("; ")}.`
    : "";

  const planSummary = `Deterministic plan status: ${plan.status}. Recommendation: ${plan.recommendation}. Reason: ${plan.reason}.`;

  const inputSummary = `Field inputs: crop=${fieldInputs.crop || "not specified"}, soil=${fieldInputs.soil || "not specified"}, area=${fieldInputs.area || "not specified"} acres, last watered=${fieldInputs.lastWatered || "not specified"}, method=${fieldInputs.method || "not specified"}.`;

  const prompt = `${planSummary}\n${inputSummary}\n${weatherSummary}${forecastSummary ? " " + forecastSummary : ""}\n\nExplain this to the farmer in simple, clear language. Remember: only use the data above. Output JSON only.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(
      `${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
  temperature: 0,
  maxOutputTokens: 300,
  responseMimeType: "application/json",
},
        }),
      }
    );
    clearTimeout(timeout);

    const payload = await response.json().catch(() => null);
   if (!response.ok) {
  console.error("[IrrigationAI] Gemini status:", response.status);
  console.error("[IrrigationAI] Gemini response:", JSON.stringify(payload));

  const error = new Error(
    payload?.error?.message || `AI provider returned HTTP ${response.status}.`
  );

  error.code = response.status === 429
    ? "AI_RATE_LIMIT"
    : "AI_PROVIDER_ERROR";

  throw error;
}

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text)
      .filter(Boolean)
      .join("")
      .trim();

    if (!text) throw Object.assign(new Error("AI returned empty response."), { code: "AI_EMPTY" });

    // Parse JSON, strip any accidental markdown fences.
   const clean = text.replace(/^```[\w]*\n?|```$/g, "").trim();

let parsed;

try {
  parsed = JSON.parse(clean);
} catch {
  // Gemini sometimes truncates/misformats JSON.
  // Return a safe explanation instead of marking AI unavailable.
  return {
    action: "Follow the deterministic irrigation plan.",
    why: plan.reason || "The recommendation is based on the verified planner inputs.",
    caution: "AI explanation could not be formatted reliably; use the deterministic plan above.",
  };
}
    if (typeof parsed.action !== "string" || typeof parsed.why !== "string") {
      throw Object.assign(new Error("AI response format unexpected."), { code: "AI_FORMAT" });
    }
    return { action: parsed.action, why: parsed.why, caution: parsed.caution || null };
  } catch (error) {
    clearTimeout(timeout);
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("AI service timed out."), { code: "AI_TIMEOUT" });
    }
    throw error;
  }
}

export function registerIrrigationAiRoutes(app) {
  app.post("/api/irrigation-ai", async (req, res) => {
    try {
      const { plan, weather, fieldInputs } = req.body || {};
      if (!plan || typeof plan.recommendation !== "string") {
        return res.status(400).json({ message: "A valid deterministic plan is required." });
      }
      const result = await createIrrigationExplanation({ plan, weather: weather || null, fieldInputs: fieldInputs || {} });
      return res.json(result);
    } catch (error) {
      if (error.code === "AI_NOT_CONFIGURED") {
        return res.status(503).json({ code: "AI_NOT_CONFIGURED", message: "AI assistance is not configured on this server." });
      }
      if (error.code === "AI_RATE_LIMIT") {
        return res.status(429).json({ code: "AI_RATE_LIMIT", message: "AI service rate limit reached. Try again shortly." });
      }
      console.error("[IrrigationAI] Error:", error.message);
      return res.status(502).json({ code: error.code || "AI_ERROR", message: error.message || "AI assistance temporarily unavailable." });
    }
  });
}
