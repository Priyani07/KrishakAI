import Busboy from "busboy";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_STATUSES = new Set(["soil_image", "not_soil_image", "low_quality", "uncertain"]);
const RESPONSE_KEYS = new Set([
  "imageStatus",
  "likelySoilType",
  "visibleCharacteristics",
  "suitableCrops",
  "irrigationAdvice",
  "managementAdvice",
  "note",
]);
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 20_000;
const FORBIDDEN_MEASUREMENT_TERMS = /(?:\bp\s*h\b|\bn\s*p\s*k\b|\bnitrogen\b|\bphosph(?:orus|orous)\b|\bpotassium\b|\belectrical\s+conductivity\b|\bec\b|\btemperature\b|\bmoisture\s+percentage\b|\bparts?\s+per\s+million\b|\bppm\b|\blaboratory\s+(?:value|reading|result)\b|\bsensor\s+(?:value|reading|result)\b)/i;

export class SoilAnalysisError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SoilAnalysisError";
    this.code = code;
  }
}

export function isSupportedSoilImageSignature(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/webp") {
    return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

function normalizeText(value, field, maxLength = 320) {
  if (typeof value !== "string" || !value.trim()) {
    throw new SoilAnalysisError("malformed_response", `Soil image analysis returned an invalid ${field}.`);
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > maxLength) {
    throw new SoilAnalysisError("malformed_response", `Soil image analysis returned an invalid ${field}.`);
  }
  return normalized;
}

function normalizeList(value, field) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) {
    throw new SoilAnalysisError("malformed_response", `Soil image analysis returned invalid ${field}.`);
  }
  return value.map((item) => normalizeText(item, field, 240));
}

function hasUnsafeMeasurementClaim(values) {
  const text = values.flat(Infinity).filter(Boolean).join(" ");
  return FORBIDDEN_MEASUREMENT_TERMS.test(text) || /\d/.test(text);
}

export function normalizeSoilAnalysisResult(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new SoilAnalysisError("malformed_response", "Soil image analysis returned an invalid response.");
  }
  if (Object.keys(payload).some((key) => !RESPONSE_KEYS.has(key))) {
    throw new SoilAnalysisError("unsafe_response", "Soil image analysis returned unsupported fields.");
  }
  if (!IMAGE_STATUSES.has(payload.imageStatus)) {
    throw new SoilAnalysisError("malformed_response", "Soil image analysis returned an invalid image status.");
  }

  const note = normalizeText(payload.note, "note", 400);
  if (payload.imageStatus !== "soil_image") {
    if (hasUnsafeMeasurementClaim([note])) {
      throw new SoilAnalysisError("unsafe_response", "Soil image analysis returned unsupported measurement claims.");
    }
    return {
      imageStatus: payload.imageStatus,
      likelySoilType: null,
      visibleCharacteristics: [],
      suitableCrops: [],
      irrigationAdvice: [],
      managementAdvice: [],
      note,
    };
  }

  const likelySoilType = normalizeText(payload.likelySoilType, "likely soil type", 120);
  const visibleCharacteristics = normalizeList(payload.visibleCharacteristics, "visible characteristics");
  const suitableCrops = normalizeList(payload.suitableCrops, "potentially suitable crops");
  const irrigationAdvice = normalizeList(payload.irrigationAdvice, "irrigation guidance");
  const managementAdvice = normalizeList(payload.managementAdvice, "soil-management guidance");

  if (hasUnsafeMeasurementClaim([likelySoilType, visibleCharacteristics, suitableCrops, irrigationAdvice, managementAdvice, note])) {
    throw new SoilAnalysisError("unsafe_response", "Soil image analysis returned unsupported measurement claims.");
  }

  return {
    imageStatus: payload.imageStatus,
    likelySoilType,
    visibleCharacteristics,
    suitableCrops,
    irrigationAdvice,
    managementAdvice,
    note,
  };
}

function parseGeminiResult(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim();
  if (!text) throw new SoilAnalysisError("malformed_response", "Soil image analysis returned an empty response.");

  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/gi, ""));
  } catch {
    throw new SoilAnalysisError("malformed_response", "Soil image analysis returned an invalid response.");
  }
  return normalizeSoilAnalysisResult(parsed);
}

export async function analyzeSoilImage(buffer, mimeType, { fetchImpl = fetch } = {}) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new SoilAnalysisError("AI_NOT_CONFIGURED", "Soil image analysis is not configured.");
  }
  if (!ALLOWED_IMAGE_TYPES.has(mimeType) || !isSupportedSoilImageSignature(buffer, mimeType)) {
    throw new SoilAnalysisError("invalid_image", "The uploaded file content is not a valid JPG, PNG, or WEBP image.");
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "You are a conservative agricultural image analyst. First decide whether the upload clearly shows a usable close view of exposed soil. Return not_soil_image when soil is not the main visible subject, low_quality when blur, lighting, distance, obstruction, or resolution prevents assessment, and uncertain when the visible evidence cannot support a cautious soil-type observation. Only for soil_image, provide a likely soil type, visible texture or surface characteristics, potentially suitable crops, qualitative irrigation guidance, and basic qualitative soil-management guidance. Treat all outputs as image-based observations, not measurements. Never provide or infer pH, NPK, nutrient concentrations, moisture percentages, electrical conductivity, temperature, laboratory values, sensor readings, chemical composition, fertilizer dosage, numerical schedules, or numerical quantities. Do not claim certainty, regional suitability, profitability, or laboratory accuracy. Keep every guidance item short and qualitative. For any status other than soil_image, use an empty likelySoilType string, empty guidance arrays, and explain what the user should improve in note.",
          }],
        },
        contents: [{
          role: "user",
          parts: [
            { text: "Analyze only what is visibly supported by this soil image and return the requested structured fields." },
            { inlineData: { mimeType, data: buffer.toString("base64") } },
          ],
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1200,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              imageStatus: { type: "string", enum: [...IMAGE_STATUSES] },
              likelySoilType: { type: "string" },
              visibleCharacteristics: { type: "array", items: { type: "string" } },
              suitableCrops: { type: "array", items: { type: "string" } },
              irrigationAdvice: { type: "array", items: { type: "string" } },
              managementAdvice: { type: "array", items: { type: "string" } },
              note: { type: "string" },
            },
            required: ["imageStatus", "likelySoilType", "visibleCharacteristics", "suitableCrops", "irrigationAdvice", "managementAdvice", "note"],
          },
        },
      }),
    });
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new SoilAnalysisError("AI_TIMEOUT", "Soil image analysis took too long to respond.");
    }
    throw new SoilAnalysisError("AI_NETWORK_ERROR", "Soil image analysis could not reach the configured AI provider.");
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new SoilAnalysisError("AI_AUTHENTICATION_FAILED", "The configured AI provider rejected its server credentials.");
  }
  if (response.status === 429) {
    throw new SoilAnalysisError("AI_RATE_LIMIT", "The configured AI provider is over its current quota.");
  }
  if (!response.ok) {
    throw new SoilAnalysisError("AI_PROVIDER_ERROR", "The configured AI provider returned an error.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new SoilAnalysisError("malformed_response", "Soil image analysis returned an invalid response.");
  }

  return { ...parseGeminiResult(payload), provider: "Gemini", model };
}

function safeProviderError(error) {
  if (error instanceof SoilAnalysisError && error.code === "AI_NOT_CONFIGURED") {
    return { status: 503, code: error.code, message: "Soil image analysis is not configured. Add GEMINI_API_KEY to the server environment to enable real image analysis." };
  }
  if (error instanceof SoilAnalysisError && error.code === "AI_RATE_LIMIT") {
    return { status: 429, code: error.code, message: "Soil image analysis is temporarily unavailable because the configured AI provider is over quota." };
  }
  if (error instanceof SoilAnalysisError && error.code === "AI_TIMEOUT") {
    return { status: 504, code: error.code, message: "Soil image analysis took too long to respond. Please try again." };
  }
  if (error instanceof SoilAnalysisError) {
    return { status: 502, code: error.code, message: "Soil image analysis is temporarily unavailable. No result was generated." };
  }
  return { status: 502, code: "AI_PROVIDER_ERROR", message: "Soil image analysis is temporarily unavailable. No result was generated." };
}

export function registerSoilAnalysisRoutes(app) {
  app.post("/api/soil-analysis", (req, res) => {
    const contentType = String(req.headers["content-type"] || "");
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      res.status(400).json({ error: "Upload the soil image as multipart form data." });
      return;
    }

    let fileBuffer = [];
    let fileType = "";
    let fileSeen = false;
    let fileTooLarge = false;
    let tooManyFiles = false;
    let settled = false;

    const finishWithError = (status, message, details = {}) => {
      if (settled) return;
      settled = true;
      res.status(status).json({ error: message, ...details });
    };

    let parser;
    try {
      parser = Busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_IMAGE_BYTES } });
    } catch {
      finishWithError(400, "The soil image upload could not be read.");
      return;
    }

    parser.on("file", (fieldName, file, info) => {
      if (fieldName !== "image") {
        file.resume();
        return;
      }
      fileSeen = true;
      fileType = info.mimeType;
      file.on("data", (chunk) => fileBuffer.push(chunk));
      file.on("limit", () => { fileTooLarge = true; });
    });
    parser.on("filesLimit", () => { tooManyFiles = true; });
    parser.on("error", () => finishWithError(400, "The soil image upload could not be read."));
    parser.on("finish", async () => {
      if (settled) return;
      if (tooManyFiles) return finishWithError(400, "Upload exactly one soil image.");
      if (!fileSeen) return finishWithError(400, "Choose a soil image before starting the analysis.");
      if (fileTooLarge) return finishWithError(413, "Choose a soil image smaller than 8 MB.");
      if (!ALLOWED_IMAGE_TYPES.has(fileType)) return finishWithError(415, "Use a JPG, PNG, or WEBP soil image.");

      const buffer = Buffer.concat(fileBuffer);
      if (!buffer.length) return finishWithError(400, "The selected soil image is empty.");
      if (!isSupportedSoilImageSignature(buffer, fileType)) {
        return finishWithError(415, "The uploaded file content is not a valid JPG, PNG, or WEBP image.");
      }

      try {
        const result = await analyzeSoilImage(buffer, fileType);
        if (settled) return;
        settled = true;
        res.json(result);
      } catch (error) {
        const safeError = safeProviderError(error);
        finishWithError(safeError.status, safeError.message, { code: safeError.code });
      }
    });

    req.pipe(parser);
  });
}

export { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES, safeProviderError };
