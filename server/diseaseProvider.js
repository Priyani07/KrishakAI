import { invokeLLM } from "./_core/llm";

export const GEMINI_DISEASE_PROVIDER = "gemini-vision-llm";
export const ACTIVE_DISEASE_PROVIDER = "kindwise-crop-health";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 20_000;

export class DiseaseVisionProviderError extends Error {
  constructor(code, message) { super(message); this.name = "DiseaseVisionProviderError"; this.code = code; }
}

export function isDiseaseImageGateConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.BUILT_IN_FORGE_API_KEY);
}

function parseDataUrl(value) {
  const match = String(value || "").match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new DiseaseVisionProviderError("invalid_image", "Disease image gate received an invalid image.");
  return { mimeType: match[1], data: match[2] };
}

async function invokeGeminiVision({ model, imageUrl, systemPrompt, userPrompt, responseFormat, fetchImpl = fetch }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new DiseaseVisionProviderError("missing_api_key", "Gemini image gate is not configured.");
  const image = parseDataUrl(imageUrl);
  let response;
  try {
    response = await fetchImpl(`${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }, { inlineData: image }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1200,
          responseMimeType: "application/json",
          ...(responseFormat?.json_schema?.schema ? { responseSchema: responseFormat.json_schema.schema } : {}),
        },
      }),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") throw new DiseaseVisionProviderError("timeout", "Gemini image gate timed out.");
    throw new DiseaseVisionProviderError("network_error", "Gemini image gate could not be reached.");
  }
  if (response.status === 401 || response.status === 403) throw new DiseaseVisionProviderError("authentication_failed", "Gemini image gate authentication failed.");
  if (response.status === 429) throw new DiseaseVisionProviderError("rate_limited", "Gemini image gate quota is unavailable.");
 if (!response.ok) {
  const errorBody = await response.text();
  console.error("[Gemini image gate]", response.status, errorBody);
  throw new DiseaseVisionProviderError("provider_error", "Gemini image gate returned an error.");
}
  let payload;
  try { payload = await response.json(); } catch { throw new DiseaseVisionProviderError("malformed_response", "Gemini image gate returned an invalid response."); }
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!text) throw new DiseaseVisionProviderError("malformed_response", "Gemini image gate returned an empty response.");
  return { choices: [{ message: { content: text } }] };
}

export async function classifyDiseaseImageWithVisionLLM(args) {
  if (process.env.GEMINI_API_KEY) return invokeGeminiVision(args);
  if (!process.env.BUILT_IN_FORGE_API_KEY) throw new DiseaseVisionProviderError("missing_api_key", "Gemini image gate is not configured.");
  return invokeLLM({
    model: args.model,
    maxTokens: 1200,
    messages: [
      { role: "system", content: args.systemPrompt },
      { role: "user", content: [{ type: "text", text: args.userPrompt }, { type: "image_url", image_url: { url: args.imageUrl, detail: "high" } }] },
    ],
    response_format: args.responseFormat,
  });
}

export { invokeGeminiVision };
