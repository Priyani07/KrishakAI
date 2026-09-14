import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DiseaseActionGuidance } from "../client/src/components/DiseaseActionGuidance.jsx";
import { VERIFIED_TREATMENT_UNAVAILABLE } from "../client/src/services/diseaseGuidance.js";

function renderGuidance(result) {
  return renderToStaticMarkup(React.createElement(DiseaseActionGuidance, { result, onCheckAnother: vi.fn() }));
}

describe("Disease post-result guidance rendering", () => {
  it("renders all required source-backed guidance cards for the verified Tomato early blight canonical result", () => {
    const markup = renderGuidance({ status: "valid_leaf", crop: "tomato", diagnosisId: "tomato_early_blight", diagnosis: "Tomato Early Blight", confidence: 0.84, uncertain: false });
    expect(markup).toContain("Image quality");
    expect(markup).toContain("Valid crop image");
    expect(markup).toContain("What to compare");
    expect(markup).toContain("Affected parts:");
    expect(markup).toContain("What to do now");
    expect(markup).toContain("What to avoid");
    expect(markup).toContain("Reduce future spread");
    expect(markup).toContain("Treatment guidance");
    expect(markup).toContain("Monitor and recheck");
    expect(markup).toContain("When to seek expert help");
    expect(markup).toContain("Next actions");
    expect(markup).toContain("University of Minnesota Extension — Early blight in tomato and potato");
    expect(markup).toContain("reviewed 2024");
    expect(markup).toContain("https://extension.umn.edu/agriculture/specialty-crops/vegetable-farming/disease-management/early-blight-in-tomato-and-potato");
    expect(markup).toContain("Check another image");
  });

  it("renders the required verified-source-unavailable fallback for an unsupported result", () => {
    const markup = renderGuidance({ status: "unsupported", crop: "unknown", diagnosisId: "unsupported", diagnosis: "Unsupported condition", confidence: 0.84, uncertain: true });
    expect(markup).toContain(VERIFIED_TREATMENT_UNAVAILABLE);
    expect(markup).toContain("outside the application’s supported disease taxonomy");
    expect(markup).toContain("Avoid applying disease-specific treatment");
    expect(markup).not.toContain("University of Minnesota Extension — Early blight in tomato and potato");
  });

  it("renders stronger caution and no disease-specific source when the provider marks a result uncertain", () => {
    const markup = renderGuidance({ status: "valid_leaf", crop: "tomato", diagnosisId: "tomato_early_blight", diagnosis: "Tomato Early Blight", confidence: 0.34, uncertain: true });
    expect(markup).toContain("Uncertain result — treat this as an initial indication");
    expect(markup).toContain(VERIFIED_TREATMENT_UNAVAILABLE);
    expect(markup).not.toContain("University of Minnesota Extension — Early blight in tomato and potato");
  });
});
