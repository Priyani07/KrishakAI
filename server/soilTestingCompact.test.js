import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { getMissingHindiTranslationKeys, translateUiText } from "../client/src/i18n/translations.js";

const appSource = fs.readFileSync(new URL("../client/src/App.jsx", import.meta.url), "utf8");
const pageStart = appSource.indexOf("function SoilTestingPage() {");
const pageEnd = appSource.indexOf("\nfunction LegacySoilTestingPage()", pageStart);
const primaryPage = appSource.slice(pageStart, pageEnd);

const simpleSoilKeys = [
  "01 / INTERACTIVE TOOLS",
  "Interactive Tools",
  "Select Soil Type",
  "Select Crop Type",
  "02 / RECOMMENDATION",
  "Fertilizer Recommendations",
  "Based on the selected soil and crop type.",
  "No verified fertilizer recommendation is available for this soil and crop combination.",
  "03 / NUTRIENTS",
  "Nitrogen (N)",
  "Phosphorus (P)",
  "Potassium (K)",
  "Nutrient Levels Chart",
  "Reference recommendation — not a laboratory soil test.",
  "These values describe the existing local fertilizer reference composition. They are not measured soil nutrient concentrations and have no physical unit.",
];

describe("simple Soil Testing primary-flow contract", () => {
  it("renders the Soil + Crop context, recommendation, compact N/P/K chart, and resources in that order", () => {
    const order = ["soil-context-panel", "soil-analysis-panel", "soil-primary-nutrients", "soil-resources-panel"];
    expect(pageStart).toBeGreaterThan(-1);
    expect(pageEnd).toBeGreaterThan(pageStart);
    for (let index = 1; index < order.length; index += 1) {
      expect(primaryPage.indexOf(order[index])).toBeGreaterThan(primaryPage.indexOf(order[index - 1]));
    }
    expect(primaryPage).toContain('id="soil-reference-type"');
    expect(primaryPage).toContain('id="crop-reference-type"');
    expect(primaryPage).toContain('item.soil === soil && (item.crop === crop || item.crop === "All crops")');
    expect(primaryPage).toContain('fertilizerRecommendation ? [{ name: "Nitrogen (N)", value: fertilizerRecommendation.n }, { name: "Phosphorus (P)", value: fertilizerRecommendation.p }, { name: "Potassium (K)", value: fertilizerRecommendation.k }] : []');
    expect(primaryPage).toContain('chartWidth(item.value, nutrientMax)');
    expect(primaryPage).toContain('chartAnimationStyle(index, motionReduced)');
    expect(primaryPage).toContain('prefers-reduced-motion: reduce');
    expect(primaryPage).toContain('Reference recommendation — not a laboratory soil test.');
    expect(primaryPage).toContain('not measured soil nutrient concentrations and have no physical unit.');
  });

  it("does not mount GPS, map, location cascade, SHC lookup, year, or photo work in the primary page", () => {
    [
      "soil-location-panel",
      "soil-manual-details",
      "soil-photo-section",
      "SoilLocationPicker",
      "getSoilReferenceOptions",
      "getSoilTest(location",
      "navigator.geolocation",
      "loadMapScript()",
      "Upload Soil / Land Photo",
    ].forEach((forbidden) => expect(primaryPage).not.toContain(forbidden));
  });

  it("keeps save-context validation independent of all location and SHC state", () => {
    expect(primaryPage).toContain('if (!soil || !crop)');
    expect(primaryPage).toContain('Select both soil type and crop type before saving.');
    expect(primaryPage).toContain('setSavedContext({ soil, crop })');
    expect(primaryPage).not.toContain('location.state');
  });

  it("provides centralized Hindi coverage for the simplified primary experience", () => {
    expect(getMissingHindiTranslationKeys(simpleSoilKeys)).toEqual([]);
    expect(translateUiText("Interactive Tools", "hi")).toBe("इंटरैक्टिव उपकरण");
    expect(translateUiText("02 / RECOMMENDATION", "hi")).toBe("02 / सिफारिश");
    expect(translateUiText("Nitrogen (N)", "hi")).toBe("नाइट्रोजन (N)");
    expect(translateUiText("Reference recommendation — not a laboratory soil test.", "hi")).toBe("संदर्भ सिफारिश — यह प्रयोगशाला मिट्टी परीक्षण नहीं है।");
    expect(translateUiText("Interactive Tools", "en")).toBe("Interactive Tools");
  });
});
