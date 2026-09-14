import Busboy from "busboy";
import { ACTIVE_DISEASE_PROVIDER, GEMINI_DISEASE_PROVIDER, classifyDiseaseImageWithVisionLLM } from "./diseaseProvider.js";
import { KindwiseCropHealthError, classifyKindwiseCropHealthImage } from "./kindwiseCropHealth.js";
import { DiseaseImageGateError, evaluateDiseaseImageGate } from "./diseaseImageGate.js";
import { DiseaseVisionProviderError, isDiseaseImageGateConfigured } from "./diseaseProvider.js";
import { CROP_ACCEPTANCE_POLICY, canonicalizeCropName, evaluateCropSpecificAcceptance } from "./diseaseAcceptancePolicy.js";
import { DIAGNOSTIC_EVIDENCE_STATUS, DISEASE_IMAGE_STATUS, DISEASE_KNOWLEDGE_BASE, DISEASE_RESULT_STATUS, getAllowedInferenceDiagnosisIds, getAllowedInferenceLabels, getAllowedInferenceStatuses, getDiseaseKnowledge, getDiseaseKnowledgeByModelLabel, getKnownCrops, getSpecialResultByStatus, normalizeDiseaseValue, SYMPTOM_EVIDENCE_STATUS } from "../shared/diseaseTaxonomy.js";
import { KINDWISE_CROP_HEALTH_PROVIDER_NAME, getReviewedKindwiseDiseaseMapping, isVerifiedKindwiseHealthyClassId } from "../shared/kindwiseDiseaseMappings.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DISEASE_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const SUPPORTED_CROPS = getKnownCrops();
const ALLOWED_DIAGNOSIS_IDS = getAllowedInferenceDiagnosisIds();
const ALLOWED_STATUSES = getAllowedInferenceStatuses();
const ALLOWED_LABELS = getAllowedInferenceLabels();

function extractText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((part) => part?.type === "text").map((part) => part.text).join("\n");
}

function safeSpecialResult(status = DISEASE_RESULT_STATUS.UNKNOWN, confidence = 0, metadata = {}) {
  const specialResult = getSpecialResultByStatus(status) || getSpecialResultByStatus(DISEASE_RESULT_STATUS.UNKNOWN);
  return {
    provider: metadata.provider || DISEASE_MODEL,
    providerType: metadata.providerType || GEMINI_DISEASE_PROVIDER,
    status: specialResult.status,
    crop: metadata.crop || "unknown",
    diagnosisId: specialResult.diagnosisId,
    diagnosis: specialResult.displayName,
    confidence,
    uncertain: true,
    note: specialResult.note,
    ...(metadata.providerClassId ? { providerClassId: metadata.providerClassId } : {}),
    ...(metadata.providerClassName ? { providerClassName: metadata.providerClassName } : {}),
    ...(typeof metadata.providerConfidence === "number" ? { providerConfidence: metadata.providerConfidence } : {}),
    ...(metadata.providerCropClassId ? { providerCropClassId: metadata.providerCropClassId } : {}),
    ...(metadata.providerCropName ? { providerCropName: metadata.providerCropName } : {}),
    ...(metadata.guidanceStatus ? { guidanceStatus: metadata.guidanceStatus } : {}),
    ...(typeof metadata.cropConfidence === "number" ? { cropConfidence: metadata.cropConfidence } : {}),
    ...(Array.isArray(metadata.plantParts) ? { plantParts: metadata.plantParts } : {}),
    ...(metadata.diagnosticEvidence ? { diagnosticEvidence: metadata.diagnosticEvidence } : {}),
    ...(metadata.symptomEvidence ? { symptomEvidence: metadata.symptomEvidence } : {}),
    ...(metadata.imageStatus ? { imageStatus: metadata.imageStatus } : {}),
  };
}

function knownOrUnknownCrop(crop) {
  const normalizedCrop = canonicalizeCropName(crop);
  return SUPPORTED_CROPS.includes(normalizedCrop) || CROP_ACCEPTANCE_POLICY[normalizedCrop] ? normalizedCrop : "unknown";
}

export function isSupportedImageSignature(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function supportedTaxonomyPrompt() {
  return DISEASE_KNOWLEDGE_BASE.map((entry) => `${entry.crop} / ${entry.diagnosisId} / labels: ${entry.acceptedModelLabels.map((label) => `"${label}"`).join(" or ")}`).join("; ");
}

function parseInferenceResponse(response) {
  const content = extractText(response?.choices?.[0]?.message?.content);
  if (!content) throw new Error("Disease detection returned an empty response.");
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Disease detection returned an invalid response.");
  }
  if (typeof parsed.status !== "string" || typeof parsed.diagnosis !== "string" || !parsed.diagnosis.trim()) {
    throw new Error("Disease detection returned an invalid response.");
  }
  if (typeof parsed.crop !== "string" || typeof parsed.diagnosisId !== "string") {
    throw new Error("Disease detection returned an invalid response.");
  }
  if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) {
    throw new Error("Disease detection returned an invalid confidence value.");
  }
  if (typeof parsed.uncertain !== "boolean") {
    throw new Error("Disease detection returned an invalid uncertainty value.");
  }
  if (!ALLOWED_STATUSES.includes(parsed.status) || !ALLOWED_DIAGNOSIS_IDS.includes(parsed.diagnosisId) || !ALLOWED_LABELS.includes(parsed.diagnosis)) {
    return safeSpecialResult(DISEASE_RESULT_STATUS.UNKNOWN, parsed.confidence);
  }

  if (parsed.status !== DISEASE_RESULT_STATUS.VALID_LEAF) {
    const specialResult = getSpecialResultByStatus(parsed.status);
    if (!specialResult || parsed.diagnosisId !== specialResult.diagnosisId || parsed.diagnosis !== specialResult.displayName || (specialResult.requiresUncertain && parsed.uncertain !== true) || (parsed.status === DISEASE_RESULT_STATUS.HEALTHY_OR_NO_VISIBLE_DISEASE && parsed.uncertain === true)) {
      return safeSpecialResult(DISEASE_RESULT_STATUS.UNKNOWN, parsed.confidence);
    }
    return {
      provider: DISEASE_MODEL,
      providerType: GEMINI_DISEASE_PROVIDER,
      status: specialResult.status,
      crop: specialResult.allowsKnownCrop ? knownOrUnknownCrop(parsed.crop) : "unknown",
      diagnosisId: specialResult.diagnosisId,
      diagnosis: specialResult.displayName,
      confidence: parsed.confidence,
      uncertain: specialResult.requiresUncertain ? true : false,
      note: specialResult.note,
    };
  }

  const requestedDiagnosis = getDiseaseKnowledge(parsed.diagnosisId);
  const labelDiagnosis = getDiseaseKnowledgeByModelLabel(parsed.diagnosis);
  const cropMatches = requestedDiagnosis && normalizeDiseaseValue(parsed.crop) === requestedDiagnosis.crop;
  if (!requestedDiagnosis || !labelDiagnosis || labelDiagnosis.diagnosisId !== requestedDiagnosis.diagnosisId || !cropMatches) {
    return safeSpecialResult(DISEASE_RESULT_STATUS.UNKNOWN, parsed.confidence);
  }

  return {
    provider: DISEASE_MODEL,
    providerType: GEMINI_DISEASE_PROVIDER,
    status: DISEASE_RESULT_STATUS.VALID_LEAF,
    crop: requestedDiagnosis.crop,
    diagnosisId: requestedDiagnosis.diagnosisId,
    diagnosis: requestedDiagnosis.displayName,
    confidence: parsed.confidence,
    uncertain: parsed.uncertain,
    note: typeof parsed.note === "string" && parsed.note.trim() ? parsed.note.trim() : "AI-based detection is an initial indication, not a substitute for laboratory or expert diagnosis.",
  };
}

export async function inferDiseaseWithVisionLLM(buffer, mimeType) {
  const imageUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
  const response = await classifyDiseaseImageWithVisionLLM({
    model: DISEASE_MODEL,
    imageUrl,
    systemPrompt: `You are a cautious vision LLM providing an initial crop-health indication, not a trained agricultural classifier or a treatment authority. First assess whether the image visibly contains a plant or leaf, whether enough leaf area is visible, whether image quality is usable, and whether visible symptoms are distinguishable. Then return exactly one controlled outcome. The only supported disease records are: ${supportedTaxonomyPrompt()}. Use status "valid_leaf" only when the image is a usable leaf/plant image and one supported disease record matches. Use "healthy_or_no_visible_disease" only when a usable plant/leaf image shows no visible disease and you are not uncertain. Use "low_quality" when leaf detail or image quality is insufficient. Use "not_a_plant_image" when the image does not show a plant/leaf area. Use "unsupported" when the visible condition or crop is outside the supported taxonomy. Use "unknown" when symptoms are ambiguous, evidence is insufficient, or the disease cannot be safely distinguished. Do not force a disease choice. Never invent disease names, guidance, pesticide, or fertilizer instructions.`,
    userPrompt: "Perform the image validity gate and controlled classification. Return only the structured fields.",
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "plant_disease_detection",
        strict: true,
        schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ALLOWED_STATUSES },
            crop: { type: "string", enum: [...SUPPORTED_CROPS, "unknown"] },
            diagnosisId: { type: "string", enum: ALLOWED_DIAGNOSIS_IDS },
            diagnosis: { type: "string", enum: ALLOWED_LABELS },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            uncertain: { type: "boolean" },
            note: { type: "string" },
          },
          required: ["status", "crop", "diagnosisId", "diagnosis", "confidence", "uncertain", "note"],
          additionalProperties: false,
        },
      },
    },
  });
  return parseInferenceResponse(response);
}

export function normalizeKindwiseCropHealthResult(providerResult) {
  const baseMetadata = {
    provider: KINDWISE_CROP_HEALTH_PROVIDER_NAME,
    providerType: ACTIVE_DISEASE_PROVIDER,
  };

  if (!providerResult.isPlant) {
    return safeSpecialResult(DISEASE_RESULT_STATUS.NOT_A_PLANT_IMAGE, providerResult.isPlantProbability, baseMetadata);
  }

  const providerClassId = providerResult.disease.id;
  const providerCropClassId = providerResult.crop?.id;
  const providerCropName = providerResult.crop?.name || "unknown";
  const metadata = {
    ...baseMetadata,
    providerClassId,
    providerClassName: providerResult.disease.name,
    ...(providerCropClassId ? { providerCropClassId } : {}),
    ...(providerCropName !== "unknown" ? { providerCropName } : {}),
    crop: knownOrUnknownCrop(providerCropName),
    ...(typeof providerResult.crop?.probability === "number" ? { cropConfidence: providerResult.crop.probability } : {}),
    imageStatus: DISEASE_IMAGE_STATUS.PLANT_IMAGE,
    diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.SUFFICIENT,
    symptomEvidence: SYMPTOM_EVIDENCE_STATUS.UNCLEAR,
  };

  if (isVerifiedKindwiseHealthyClassId(providerClassId)) {
    const healthy = getSpecialResultByStatus(DISEASE_RESULT_STATUS.HEALTHY_OR_NO_VISIBLE_DISEASE);
    return {
      ...safeSpecialResult(DISEASE_RESULT_STATUS.HEALTHY_OR_NO_VISIBLE_DISEASE, providerResult.disease.probability, metadata),
      uncertain: false,
      note: healthy.note,
    };
  }

  const mapping = getReviewedKindwiseDiseaseMapping({ providerDiseaseClassId: providerClassId, providerCropClassId });
  if (mapping) {
    const knowledge = getDiseaseKnowledge(mapping.canonicalDiagnosisId);
    if (!knowledge) {
      throw new KindwiseCropHealthError("mapping_error", "The reviewed Kindwise mapping is incomplete.");
    }
    return {
      ...metadata,
      status: DISEASE_RESULT_STATUS.VALID_LEAF,
      crop: knowledge.crop,
      diagnosisId: knowledge.diagnosisId,
      diagnosis: knowledge.displayName,
      confidence: providerResult.disease.probability,
      uncertain: false,
      guidanceStatus: "available",
      note: "Kindwise crop.health provided an initial image-based indication. Review the source-backed guidance and seek expert confirmation before treatment.",
    };
  }

  return {
    ...metadata,
    status: DISEASE_RESULT_STATUS.VALID_LEAF,
    diagnosisId: "unreviewed_provider_condition",
    diagnosis: providerResult.disease.name,
    confidence: providerResult.disease.probability,
    uncertain: false,
    guidanceStatus: "unavailable",
    note: "Disease detected, but detailed treatment guidance from a verified agricultural source is not yet available for this condition. Please consult an agricultural expert or laboratory before treatment.",
  };
}

export function normalizeDiseaseImageGateResult({ imageGate, providerResult }) {
  const gateMetadata = {
    crop: knownOrUnknownCrop(imageGate.crop),
    cropConfidence: imageGate.cropConfidence,
    plantParts: imageGate.plantParts,
    diagnosticEvidence: imageGate.diagnosticEvidence,
    symptomEvidence: imageGate.symptomEvidence,
    imageStatus: imageGate.imageStatus,
  };

  if (imageGate.imageStatus === DISEASE_IMAGE_STATUS.NON_PLANT_IMAGE) {
    return { ...safeSpecialResult(DISEASE_RESULT_STATUS.NOT_A_PLANT_IMAGE, 0, gateMetadata), note: "This image does not appear to contain a crop or plant. Please upload a clear photo of the plant or affected plant part." };
  }
  if (imageGate.imageStatus === DISEASE_IMAGE_STATUS.LOW_QUALITY_IMAGE) {
    return { ...safeSpecialResult(DISEASE_RESULT_STATUS.LOW_QUALITY, 0, gateMetadata), note: "The image quality is not sufficient for reliable diagnosis. Please upload a clearer photo in good lighting." };
  }
  if (imageGate.imageStatus === DISEASE_IMAGE_STATUS.AMBIGUOUS_IMAGE) {
    return { ...safeSpecialResult(DISEASE_RESULT_STATUS.UNKNOWN, 0, gateMetadata), note: "There is not enough visible evidence to identify the crop condition reliably. Please upload a clearer photo of the affected part, ideally showing the symptoms close-up." };
  }

  const normalized = normalizeKindwiseCropHealthResult(providerResult);
  const normalizedWithGate = {
    ...normalized,
    plantParts: imageGate.plantParts,
    imageStatus: imageGate.imageStatus,
    diagnosticEvidence: imageGate.diagnosticEvidence,
    symptomEvidence: imageGate.symptomEvidence,
    ...(normalized.crop === "unknown" && knownOrUnknownCrop(imageGate.crop) !== "unknown" ? { crop: knownOrUnknownCrop(imageGate.crop), cropConfidence: imageGate.cropConfidence } : {}),
  };

  if (imageGate.diagnosticEvidence !== DIAGNOSTIC_EVIDENCE_STATUS.SUFFICIENT) {
    return {
      ...safeSpecialResult(DISEASE_RESULT_STATUS.UNKNOWN, normalized.confidence, {
        provider: normalized.provider,
        providerType: normalized.providerType,
        providerClassId: normalized.providerClassId,
        providerClassName: normalized.providerClassName,
        providerCropClassId: normalized.providerCropClassId,
        providerCropName: normalized.providerCropName,
        crop: normalizedWithGate.crop,
        cropConfidence: normalizedWithGate.cropConfidence,
        plantParts: imageGate.plantParts,
        diagnosticEvidence: imageGate.diagnosticEvidence,
        symptomEvidence: imageGate.symptomEvidence,
        imageStatus: imageGate.imageStatus,
      }),
      note: "There is not enough visible evidence to identify the crop condition reliably. Please upload a clearer photo of the affected part, ideally showing the symptoms close-up.",
    };
  }

  const acceptance = evaluateCropSpecificAcceptance({ normalizedResult: normalizedWithGate, imageGate, providerResult });
  if (!acceptance.accepted) {
    return {
      ...safeSpecialResult(DISEASE_RESULT_STATUS.UNKNOWN, 0, {
        provider: normalized.provider,
        providerType: normalized.providerType,
        providerClassId: normalized.providerClassId,
        providerClassName: normalized.providerClassName,
        providerConfidence: normalized.confidence,
        providerCropClassId: normalized.providerCropClassId,
        providerCropName: normalized.providerCropName,
        crop: knownOrUnknownCrop(imageGate.crop),
        cropConfidence: imageGate.cropConfidence,
        plantParts: imageGate.plantParts,
        diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.INSUFFICIENT,
        symptomEvidence: imageGate.symptomEvidence,
        imageStatus: imageGate.imageStatus,
      }),
      note: acceptance.reason,
    };
  }

  return normalizedWithGate;
}

export async function inferDisease(buffer, mimeType, options = {}) {
  const evaluateImageGate = options.evaluateImageGate || evaluateDiseaseImageGate;
  const classifyProvider = options.classifyProvider || classifyKindwiseCropHealthImage;
  const useImageGate = options.useImageGate ?? (Boolean(options.evaluateImageGate) || isDiseaseImageGateConfigured());

  if (!useImageGate) {
    const providerResult = await classifyProvider({ imageBuffer: buffer, mimeType });
    return normalizeKindwiseCropHealthResult(providerResult);
  }

  let imageGate = null;

  try {
    imageGate = await evaluateImageGate({ imageBuffer: buffer, mimeType });
  } catch (error) {
    if (error instanceof DiseaseImageGateError && error.code === "malformed_response") {
      return {
        ...safeSpecialResult(DISEASE_RESULT_STATUS.UNKNOWN, 0, {
          crop: "unknown",
          cropConfidence: 0,
          plantParts: ["unknown"],
          diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.UNKNOWN,
          symptomEvidence: SYMPTOM_EVIDENCE_STATUS.UNCLEAR,
          imageStatus: DISEASE_IMAGE_STATUS.AMBIGUOUS_IMAGE,
        }),
        note: "There is not enough visible evidence to identify the crop condition reliably. Please upload a clearer photo of the affected part, ideally showing the symptoms close-up.",
      };
    }

    if (error instanceof DiseaseVisionProviderError) {
      console.warn("[Disease image gate] Optional gate unavailable; continuing to Kindwise.", error.code);
      imageGate = null;
    } else {
      throw error;
    }
  }

  if (imageGate && imageGate.imageStatus !== DISEASE_IMAGE_STATUS.PLANT_IMAGE) {
    return normalizeDiseaseImageGateResult({ imageGate, providerResult: null });
  }

  const providerResult = await classifyProvider({
    imageBuffer: buffer,
    mimeType,
  });

  if (!imageGate) {
    return normalizeKindwiseCropHealthResult(providerResult);
  }

  return normalizeDiseaseImageGateResult({
    imageGate,
    providerResult,
  });
}

function getSafeProviderError(error) {
  if (error instanceof DiseaseVisionProviderError && error.code === "missing_api_key") {
    return { status: 503, code: error.code, message: "The optional disease image gate is not configured." };
  }
  if (error instanceof DiseaseVisionProviderError) {
    return { status: 502, code: error.code, message: "The optional disease image gate is unavailable. Try again later." };
  }
  if (error instanceof KindwiseCropHealthError && error.code === "missing_api_key") {
    return { status: 503, code: error.code, message: "Disease detection is not configured. Try again later." };
  }
  if (error instanceof KindwiseCropHealthError && error.code === "rate_limited") {
    return { status: 502, code: error.code, message: "Kindwise disease detection quota is unavailable. Please try again later." };
  }
  if (error instanceof KindwiseCropHealthError) {
    return { status: 502, code: error.code, message: "Disease detection service is unavailable. Try again later." };
  }
  return { status: 502, code: "provider_error", message: "Disease detection service is unavailable. Try again later." };
}

export function registerDiseaseRoutes(app) {
  app.post("/api/disease-detection", (req, res) => {
    const contentType = String(req.headers["content-type"] || "");
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      res.status(400).json({ error: "Upload the image as multipart form data." });
      return;
    }

    let fileBuffer = [];
    let fileType = "";
    let fileSeen = false;
    let fileTooLarge = false;
    let fileFieldValid = false;
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
      finishWithError(400, "The image upload could not be read.");
      return;
    }

    parser.on("file", (fieldName, file, info) => {
      if (fieldName !== "image") {
        file.resume();
        return;
      }
      fileSeen = true;
      fileFieldValid = true;
      fileType = info.mimeType;
      file.on("data", (chunk) => fileBuffer.push(chunk));
      file.on("limit", () => { fileTooLarge = true; });
    });

    parser.on("error", () => finishWithError(400, "The image upload could not be read."));
    parser.on("finish", async () => {
      if (settled) return;
      if (!fileSeen || !fileFieldValid) return finishWithError(400, "Choose an image before starting the check.");
      if (fileTooLarge) return finishWithError(413, "Choose an image smaller than 8 MB.");
      if (!ALLOWED_TYPES.has(fileType)) return finishWithError(415, "Use a JPG, PNG, or WEBP image.");
      const buffer = Buffer.concat(fileBuffer);
      if (!buffer.length) return finishWithError(400, "Choose an image before starting the check.");
      if (!isSupportedImageSignature(buffer, fileType)) return finishWithError(415, "The uploaded file content is not a valid JPG, PNG, or WEBP image.");
      if (!process.env.KINDWISE_API_KEY) {
        if (settled) return;
        settled = true;
        return res.status(503).json({
          code: "NOT_CONFIGURED",
          error: "Crop disease analysis is currently unavailable. Add KINDWISE_API_KEY to the server .env file to enable live disease detection.",
        });
      }
      try {
        const result = await inferDisease(buffer, fileType);
        if (settled) return;
        settled = true;
        res.json(result);
      } catch (error) {
        const safeError = getSafeProviderError(error);
        finishWithError(safeError.status, safeError.message, { code: safeError.code });
      }
    });

    req.pipe(parser);
  });
}

export { parseInferenceResponse, safeSpecialResult, getSafeProviderError };
