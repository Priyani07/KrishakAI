import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { DiseaseActionGuidance } from "../client/src/components/DiseaseActionGuidance.jsx";
import { UNREVIEWED_PROVIDER_GUIDANCE_CAUTION, getDiseaseGuidance } from "../client/src/services/diseaseGuidance.js";

const detectedButUnreviewed = {
  provider: "crop.health",
  providerType: "kindwise-crop-health",
  status: "valid_leaf",
  crop: "potato",
  diagnosisId: "unreviewed_provider_condition",
  diagnosis: "late blight",
  confidence: 0.88,
  uncertain: false,
  guidanceStatus: "unavailable",
  note: UNREVIEWED_PROVIDER_GUIDANCE_CAUTION,
};

describe("Kindwise unreviewed-condition guidance", () => {
  it("preserves the detected condition but suppresses disease-specific treatment and source claims", () => {
    const guidance = getDiseaseGuidance(detectedButUnreviewed);
    expect(guidance).toMatchObject({ hasVerifiedGuidance: false, source: null });
    expect(guidance.caution).toContain("No disease-specific treatment guidance is shown");
    expect(guidance.treatment).toContain("not available from a verified source");
  });

  it("renders the generic safety path without a fabricated source-backed guidance section", () => {
    const markup = renderToStaticMarkup(createElement(DiseaseActionGuidance, { result: detectedButUnreviewed, onCheckAnother: () => {} }));
    expect(markup).toContain("No disease-specific treatment guidance is shown");
    expect(markup).toContain("Treatment details are not available from a verified source");
    expect(markup).not.toContain("VISIBLE SYMPTOMS");
    expect(markup).not.toContain("Verified source:");
  });
});
