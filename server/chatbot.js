const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_QUESTION_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 12;

const SYSTEM_PROMPT = `You are Krishak AI, a friendly, clear, multilingual informational assistant for farmers, students, and general learners.
Respond naturally to greetings, casual conversation, general educational and study questions, general knowledge questions, and agricultural questions. You can explain cultivation, sowing, irrigation, fertilizer concepts, soil, pests, crop diseases, weather-related farming considerations, crop planning, agricultural technology, IoT concepts, and general agricultural practices.
Prioritize practical agricultural usefulness when a question is farming-related, but do not behave like a keyword-only agriculture bot. If the user asks a normal greeting such as Hi, Hello, or How are you?, reply naturally and briefly. If the user asks a general educational question such as photosynthesis, explain it clearly at an appropriate level and connect it to farming only when relevant.
Reply in the language and style of the user's question where practical: English in English, Hindi in Hindi, and Hinglish in natural Hinglish. Do not unnecessarily switch languages.
Do not claim to be a certified agricultural expert. Remind users to independently verify important decisions with local agricultural experts, laboratories, extension services, or product labels.
Do not claim access to live weather, soil sensors, IoT devices, laboratory results, disease models, intrusion cameras, account data, or field images unless that data is explicitly included in the request.
Do not fabricate measurements, diagnoses, local forecasts, product recommendations, live data, or certainty when the information is insufficient. Clearly distinguish general guidance from verified local information.
When a question requires diagnosis or professional judgement, explain the limitation and recommend appropriate local verification.`;

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
    .filter((item) => item.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content.trim().slice(0, MAX_QUESTION_LENGTH) }],
    }));
}

function readProviderError(payload) {
  return payload?.error?.message || "The Gemini provider returned an error.";
}

function readGeminiAnswer(payload) {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function createFarmerChatResponse({ question, history = [] }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const error = new Error("AI service is not configured yet.");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [...sanitizeHistory(history), { role: "user", parts: [{ text: question }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(readProviderError(payload));
      error.code = response.status === 429 ? "AI_RATE_LIMIT" : "AI_PROVIDER_ERROR";
      throw error;
    }

    const answer = readGeminiAnswer(payload);
    if (!answer) {
      const error = new Error("The Gemini provider returned an unexpected response.");
      error.code = "AI_MALFORMED_RESPONSE";
      throw error;
    }
    return answer;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("The AI service took too long to respond.");
      timeoutError.code = "AI_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleChatRequest(req, res) {
  if (!req.body || typeof req.body.question !== "string" || !req.body.question.trim()) {
    return res.status(400).json({ error: "Ask a question before sending." });
  }
  if (req.body.question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: `Keep your question under ${MAX_QUESTION_LENGTH} characters.` });
  }

  try {
    const answer = await createFarmerChatResponse({ question: req.body.question.trim(), history: req.body.history });
    return res.json({ answer });
  } catch (error) {
    const status = error?.code === "AI_NOT_CONFIGURED" ? 503 : error?.code === "AI_RATE_LIMIT" ? 429 : 502;
    const message = error?.code === "AI_NOT_CONFIGURED"
      ? "AI service is not configured yet. Add the server-side Gemini key to enable live responses."
      : error?.code === "AI_TIMEOUT"
        ? "The AI service took too long to respond. Please try again."
        : error?.code === "AI_RATE_LIMIT"
          ? "The AI service is busy or over its current quota. Please try again later."
          : "Unable to reach the AI service. Please try again.";
    return res.status(status).json({ error: message });
  }
}
