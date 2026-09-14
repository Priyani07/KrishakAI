import { classifyDiseaseImageWithVisionLLM } from "./diseaseProvider.js";
import { DIAGNOSTIC_EVIDENCE_STATUS, DISEASE_IMAGE_STATUS, PLANT_PARTS, SYMPTOM_EVIDENCE_STATUS } from "../shared/diseaseTaxonomy.js";

export const DISEASE_IMAGE_GATE_MODEL = process.env.DISEASE_IMAGE_GATE_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";

const IMAGE_CATEGORIES = Object.values(DISEASE_IMAGE_STATUS);
const EVIDENCE_STATUSES = Object.values(DIAGNOSTIC_EVIDENCE_STATUS);
const SYMPTOM_EVIDENCE_STATUSES = Object.values(SYMPTOM_EVIDENCE_STATUS);

export class DiseaseImageGateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DiseaseImageGateError";
    this.code = code;
  }
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((part) => part?.type === "text").map((part) => part.text).join("\n");
}

function validProbability(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function normalizeParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0 || parts.some((part) => !PLANT_PARTS.includes(part))) {
    throw new DiseaseImageGateError("malformed_response", "Disease image gate returned invalid plant parts.");
  }
  return [...new Set(parts)];
}

function safeGateResult({ imageStatus = DISEASE_IMAGE_STATUS.AMBIGUOUS_IMAGE, diagnosticEvidence = DIAGNOSTIC_EVIDENCE_STATUS.UNKNOWN, symptomEvidence = SYMPTOM_EVIDENCE_STATUS.UNCLEAR, note = "There is not enough visible evidence to identify the crop condition reliably. Please upload a clearer photo of the affected part, ideally showing the symptoms close-up." } = {}) {
  return {
    imageStatus,
    crop: "unknown",
    cropConfidence: 0,
    plantParts: ["unknown"],
    diagnosticEvidence,
    symptomEvidence,
    uncertain: true,
    note,
  };
}

export function parseDiseaseImageGateResponse(response) {
  const content = extractText(response?.choices?.[0]?.message?.content);
  if (!content) throw new DiseaseImageGateError("malformed_response", "Disease image gate returned an empty response.");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new DiseaseImageGateError("malformed_response", "Disease image gate returned an invalid response.");
  }

  if (!parsed || !IMAGE_CATEGORIES.includes(parsed.imageStatus) || !EVIDENCE_STATUSES.includes(parsed.diagnosticEvidence) || !SYMPTOM_EVIDENCE_STATUSES.includes(parsed.symptomEvidence) || typeof parsed.crop !== "string" || !validProbability(parsed.cropConfidence) || typeof parsed.uncertain !== "boolean" || typeof parsed.note !== "string") {
    throw new DiseaseImageGateError("malformed_response", "Disease image gate returned an invalid response.");
  }

  const plantParts = normalizeParts(parsed.plantParts);
  const crop = parsed.crop.trim().toLowerCase().replace(/\s+/g, " ") || "unknown";

  if (parsed.imageStatus !== DISEASE_IMAGE_STATUS.PLANT_IMAGE && parsed.uncertain !== true) {
    return safeGateResult({ imageStatus: parsed.imageStatus, diagnosticEvidence: parsed.diagnosticEvidence, symptomEvidence: parsed.symptomEvidence, note: parsed.note.trim() || undefined });
  }
  if (parsed.imageStatus === DISEASE_IMAGE_STATUS.LOW_QUALITY_IMAGE && parsed.diagnosticEvidence === DIAGNOSTIC_EVIDENCE_STATUS.SUFFICIENT) {
    return safeGateResult({ imageStatus: DISEASE_IMAGE_STATUS.LOW_QUALITY_IMAGE, diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.INSUFFICIENT, symptomEvidence: parsed.symptomEvidence, note: parsed.note.trim() || undefined });
  }
  if (parsed.imageStatus === DISEASE_IMAGE_STATUS.AMBIGUOUS_IMAGE && parsed.diagnosticEvidence === DIAGNOSTIC_EVIDENCE_STATUS.SUFFICIENT) {
    return safeGateResult({ imageStatus: DISEASE_IMAGE_STATUS.AMBIGUOUS_IMAGE, diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.UNKNOWN, symptomEvidence: parsed.symptomEvidence, note: parsed.note.trim() || undefined });
  }

  return {
    imageStatus: parsed.imageStatus,
    crop,
    cropConfidence: parsed.cropConfidence,
    plantParts,
    diagnosticEvidence: parsed.diagnosticEvidence,
    symptomEvidence: parsed.symptomEvidence,
    uncertain: parsed.uncertain,
    note: parsed.note.trim() || "There is not enough visible evidence to identify the crop condition reliably. Please upload a clearer photo of the affected part, ideally showing the symptoms close-up.",
  };
}

export async function evaluateDiseaseImageGate({ imageBuffer, mimeType, visionClassifier = classifyDiseaseImageWithVisionLLM }) {
  const imageUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
  const response = await visionClassifier({
    model: DISEASE_IMAGE_GATE_MODEL,
    imageUrl,
    systemPrompt: "You are a conservative agricultural image-triage gate. Do not diagnose a disease and do not give farm advice. Accept broad coherent crop views, including leaf, stem, branch, flower, fruit, tuber, seed, pod, cob, whole plant, or several visible parts of the same plant. Classify the image as PLANT_IMAGE only when a crop/plant is visibly present; NON_PLANT_IMAGE when it is not; LOW_QUALITY_IMAGE when blur, exposure, scale, darkness, or subject visibility prevents reliable inspection; and AMBIGUOUS_IMAGE when plant identity or the intended specimen is unclear, including unrelated crops. Identify only visibly supported plant parts. Set diagnosticEvidence SUFFICIENT only when a coherent crop view contains visible, localizable condition evidence suitable for a specialist classifier. Whole plants and non-leaf parts are allowed, but set INSUFFICIENT when the crop is visible without enough condition detail, and UNKNOWN when this cannot be judged safely. Set symptomEvidence to VISIBLE_SYMPTOMS only when visible symptom evidence is actually present, NO_VISIBLE_SYMPTOMS when a usable crop image shows no visible symptom evidence, and UNCLEAR otherwise. Use crop unknown rather than guessing. Return the structured fields only.",
    userPrompt: "Perform broad crop-image triage. Preserve uncertainty and never force a disease label.",
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "crop_image_triage",
        strict: true,
        schema: {
          type: "object",
          properties: {
            imageStatus: { type: "string", enum: IMAGE_CATEGORIES },
            crop: { type: "string" },
            cropConfidence: { type: "number", minimum: 0, maximum: 1 },
            plantParts: { type: "array", minItems: 1, items: { type: "string", enum: PLANT_PARTS } },
            diagnosticEvidence: { type: "string", enum: EVIDENCE_STATUSES },
            symptomEvidence: { type: "string", enum: SYMPTOM_EVIDENCE_STATUSES },
            uncertain: { type: "boolean" },
            note: { type: "string" },
          },
          required: ["imageStatus", "crop", "cropConfidence", "plantParts", "diagnosticEvidence", "symptomEvidence", "uncertain", "note"],
        },
      },
    },
  });
  return parseDiseaseImageGateResponse(response);
}

export { safeGateResult };
