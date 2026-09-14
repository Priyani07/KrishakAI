import { DISEASE_KNOWLEDGE_BASE, DISEASE_RESULT_STATUS, getDiseaseKnowledge, getDiseaseKnowledgeByModelLabel, TOMATO_EARLY_BLIGHT_SOURCE, VERIFIED_TREATMENT_UNAVAILABLE } from "../../../shared/diseaseTaxonomy.js";

export const VERIFIED_GUIDANCE_DIAGNOSES = DISEASE_KNOWLEDGE_BASE.flatMap((entry) => entry.acceptedModelLabels.map((label) => label.trim().toLowerCase()));

const UNKNOWN_RESULT_CAUTION = "This image could not be matched confidently to a supported disease. Please treat this as an initial indication and verify the condition with an agricultural expert or laboratory before treatment.";
const UNCERTAIN_RESULT_CAUTION = "Uncertain result — treat this as an initial indication and verify the condition with an agricultural expert or laboratory before treatment.";
const UNREVIEWED_PROVIDER_GUIDANCE_CAUTION = "Disease detected, but detailed treatment guidance from a verified agricultural source is not yet available for this condition. Please consult an agricultural expert or laboratory before treatment.";

function getKnowledgeForResult(result) {
  if (typeof result?.diagnosisId === "string") return getDiseaseKnowledge(result.diagnosisId);
  return getDiseaseKnowledgeByModelLabel(result?.diagnosis);
}

function safeOutcomeGuidance(result) {
  const status = result?.status;
  if (status === DISEASE_RESULT_STATUS.NOT_A_PLANT_IMAGE) {
    return {
      hasVerifiedGuidance: false,
      caution: "This image does not appear to contain a crop or plant. Please upload a clear photo of the plant or affected plant part.",
      visibleSymptoms: [],
      affectedPlantParts: [],
      progression: "",
      whatToDoNow: ["Check another image that clearly shows the crop or affected plant part."],
      whatToAvoid: ["Avoid applying disease-specific treatment when the uploaded image does not show a crop or plant."],
      prevention: [],
      treatment: VERIFIED_TREATMENT_UNAVAILABLE,
      monitor: [],
      expertReferral: "Seek local agricultural support if the crop has symptoms that cannot be captured clearly in an image.",
      source: null,
    };
  }
  const evidenceIsInsufficient = result?.diagnosticEvidence === "INSUFFICIENT" || result?.diagnosticEvidence === "UNKNOWN";
  if (evidenceIsInsufficient) {
    return {
      hasVerifiedGuidance: false,
      caution: "There is not enough visible evidence to identify the crop condition reliably. Please upload a clearer photo of the affected part, ideally showing the symptoms close-up.",
      visibleSymptoms: [],
      affectedPlantParts: [],
      progression: "",
      whatToDoNow: ["Upload a clearer photo of the affected part in good natural light, with enough of the plant visible to identify the crop."],
      whatToAvoid: ["Avoid applying disease-specific treatment when the visible evidence is insufficient for a reliable assessment."],
      prevention: [],
      treatment: VERIFIED_TREATMENT_UNAVAILABLE,
      monitor: [],
      expertReferral: "Consult a local agricultural expert or laboratory before applying treatment when a clear symptom image is not available.",
      source: null,
    };
  }
  if (status === DISEASE_RESULT_STATUS.VALID_LEAF && result?.guidanceStatus === "unavailable" && result?.uncertain !== true) {
    return {
      hasVerifiedGuidance: false,
      caution: "No disease-specific treatment guidance is shown for this detected condition because a verified agricultural source has not yet been reviewed in Krishak.",
      visibleSymptoms: [],
      affectedPlantParts: [],
      progression: "",
      whatToDoNow: ["Consult an agricultural expert or laboratory before deciding on treatment for this detected condition."],
      whatToAvoid: ["Avoid applying disease-specific treatment based only on this image result."],
      prevention: [],
      treatment: VERIFIED_TREATMENT_UNAVAILABLE,
      monitor: [],
      expertReferral: "Consult a local agricultural expert or laboratory before applying treatment.",
      source: null,
    };
  }
  const outcome = {
    [DISEASE_RESULT_STATUS.HEALTHY_OR_NO_VISIBLE_DISEASE]: {
      caution: "No visible disease was identified in this image. Continue routine monitoring; an image alone cannot confirm plant health.",
      nextSteps: ["Continue routine crop monitoring and recheck if visible symptoms appear or change."],
      expertReferral: "Seek local agricultural support if symptoms appear, spread, or affect plant growth despite this result.",
    },
    [DISEASE_RESULT_STATUS.LOW_QUALITY]: {
      caution: "The image quality is not sufficient for reliable diagnosis. Please upload a clearer photo in good lighting.",
      nextSteps: ["Retake the photo in natural light, keep the affected part in focus, and include both symptoms and surrounding plant context."],
      expertReferral: "Seek an agricultural expert or laboratory if a clearer image is not available and the condition is affecting the crop.",
    },
    [DISEASE_RESULT_STATUS.NOT_A_PLANT_IMAGE]: {
      caution: "This image does not appear to contain a crop or plant. Please upload a clear photo of the plant or affected plant part.",
      nextSteps: ["Check another image that clearly shows the crop or affected plant part."],
      expertReferral: "Seek local agricultural support if the crop has symptoms that cannot be captured clearly in an image.",
    },
    [DISEASE_RESULT_STATUS.UNSUPPORTED]: {
      caution: "The visible condition is outside the application’s supported disease taxonomy. Do not treat this as a confirmed diagnosis.",
      nextSteps: ["Check another image if it can show clearer symptoms, and seek an agricultural expert or laboratory before treatment."],
      expertReferral: "Consult a local agricultural expert or laboratory before applying treatment.",
    },
    [DISEASE_RESULT_STATUS.UNKNOWN]: {
      caution: UNKNOWN_RESULT_CAUTION,
      nextSteps: ["Upload another clear image if symptoms change, and verify the condition before treatment."],
      expertReferral: "Consult a local agricultural expert or laboratory before applying treatment.",
    },
  }[status] || {
    caution: result?.uncertain === true ? UNCERTAIN_RESULT_CAUTION : UNKNOWN_RESULT_CAUTION,
    nextSteps: ["Upload another clear image if symptoms change, and verify the condition before treatment."],
    expertReferral: "Consult a local agricultural expert or laboratory before applying treatment.",
  };

  return {
    hasVerifiedGuidance: false,
    caution: result?.uncertain === true && status === DISEASE_RESULT_STATUS.VALID_LEAF ? UNCERTAIN_RESULT_CAUTION : outcome.caution,
    visibleSymptoms: [],
    affectedPlantParts: [],
    progression: "",
    whatToDoNow: outcome.nextSteps,
    whatToAvoid: ["Avoid applying disease-specific treatment based only on this image result."],
    prevention: [],
    treatment: VERIFIED_TREATMENT_UNAVAILABLE,
    monitor: [],
    expertReferral: outcome.expertReferral,
    source: null,
  };
}

export function getDiseaseGuidance(result) {
  const knowledge = getKnowledgeForResult(result);
  if (result?.status !== DISEASE_RESULT_STATUS.VALID_LEAF || result?.uncertain === true || !knowledge) return safeOutcomeGuidance(result);

  return {
    hasVerifiedGuidance: true,
    caution: "",
    visibleSymptoms: knowledge.visibleSymptoms,
    affectedPlantParts: knowledge.affectedPlantParts,
    progression: knowledge.progression,
    whatToDoNow: knowledge.whatToDoNow,
    whatToAvoid: knowledge.whatToAvoid,
    prevention: knowledge.prevention,
    treatment: knowledge.treatmentGuidance,
    monitor: knowledge.monitoring,
    expertReferral: knowledge.expertReferral,
    source: knowledge.source,
  };
}

export { TOMATO_EARLY_BLIGHT_SOURCE, VERIFIED_TREATMENT_UNAVAILABLE, UNKNOWN_RESULT_CAUTION, UNCERTAIN_RESULT_CAUTION, UNREVIEWED_PROVIDER_GUIDANCE_CAUTION };
