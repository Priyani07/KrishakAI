import { describe, expect, it, vi } from "vitest";
import { deduplicateSourceOptions, getSoilHealthOptions, NO_DATA_MESSAGE, registerSoilTestRoutes, buildWhere } from "./soilTest.js";
import { parseSoilTestResponse } from "../client/src/services/soilTestService.js";
import { translateUiText } from "../client/src/i18n/translations.js";

describe("Soil Health Card reference contract", () => {
  it("preserves a truthful no-data state", () => {
    const response = parseSoilTestResponse({ status: "no_result", result: null, source: "India Data Portal", coverage: "2023 - 2025", message: NO_DATA_MESSAGE });
    expect(response).toMatchObject({ status: "no_result", result: null, coverage: "2023 - 2025", message: NO_DATA_MESSAGE });
  });
  it("preserves source freshness metadata without inventing an update date", () => {
    const response = parseSoilTestResponse({ status: "success", result: { nutrients: [{ name: "Nitrogen", level: "Low", value: 42, unit: "Number/Count" }], year: "2024-25" }, source: "India Data Portal", sourceUrl: "https://indiadataportal.com/", coverage: "2023-2025", metadata: { updatedAt: "2026-08-20", granularity: "Village", license: "Open Government Data" } });
    expect(response).toMatchObject({ coverage: "2023-2025", metadata: { updatedAt: "2026-08-20", granularity: "Village", license: "Open Government Data" }, sourceUrl: "https://indiadataportal.com/" });
  });
  it("does not invent a freshness date when source metadata omits one", () => {
    const response = parseSoilTestResponse({ status: "success", result: { nutrients: [{ name: "Nitrogen", level: "Low", value: 42, unit: "Number/Count" }], year: "2024-25" }, coverage: "2023-2025" });
    expect(response.metadata).toBeNull();
    expect(response).not.toHaveProperty("updatedAt");
  });
  it("keeps freshness labels centralized for English and Hindi", () => {
    expect(translateUiText("Last updated:", "en")).toBe("Last updated:");
    expect(translateUiText("Last updated:", "hi")).toBe("अंतिम अपडेट:");
    expect(translateUiText("Village-level reference data", "hi")).toBe("गांव-स्तरीय संदर्भ डेटा");
    expect(translateUiText("Loading map…", "hi")).toBe("मानचित्र लोड हो रहा है…");
  });
  it("accepts source-preserved category counts without inventing physical units", () => {
    const response = parseSoilTestResponse({ status: "success", result: { nutrients: [{ name: "Nitrogen", level: "Low", value: 42, unit: "Number/Count" }], year: "2023-24" }, source: "India Data Portal", coverage: "2023 - 2025" });
    expect(response.result.nutrients[0]).toEqual({ name: "Nitrogen", level: "Low", value: 42, unit: "Number/Count" });
    expect(response.coverage).toBe("2023 - 2025");
  });
  it("rejects malformed or negative reference values", () => {
    expect(() => parseSoilTestResponse({ status: "success", result: { nutrients: [{ name: "Nitrogen", level: "Low", value: -1, unit: "Number/Count" }] } })).toThrow("invalid response");
  });
  it("retains the legacy measured N/P/K validation contract", () => {
    const response = parseSoilTestResponse({ status: "success", result: { nitrogen: { value: 42, unit: "mg/kg" }, phosphorus: { value: 18, unit: "mg/kg" }, potassium: { value: 210, unit: "mg/kg" } }, source: "Verified soil laboratory", measuredAt: "2026-08-21T00:00:00Z" });
    expect(response.result.potassium).toEqual({ value: 210, unit: "mg/kg" });
  });
  it("uses source identifiers when constructing dependent option filters", () => {
    expect(buildWhere({ state: "Madhya Pradesh", state_code: "23", district: "Bhopal", district_code: "396" })).toBe(" WHERE \"state_code\" = '23' AND \"district_code\" = '396'");
  });
  it("returns complete source-shaped options from grouped SQL rows", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ success: true, result: { records: [{ value: "23", label: "Madhya Pradesh" }, { value: "396", label: "Bhopal" }] } }), { status: 200, headers: { "Content-Type": "application/json" } }));
    try {
      const options = await getSoilHealthOptions("district", { state_code: "23" });
      expect(options).toEqual([{ value: "396", label: "Bhopal" }, { value: "23", label: "Madhya Pradesh" }]);
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("datastore_search_sql"), expect.objectContaining({ method: "POST" }));
    } finally { globalThis.fetch = originalFetch; }
  });
  it("deduplicates options by source identifier while preserving the first canonical label", () => {
    expect(deduplicateSourceOptions([
      { value: "23", label: "Madhya Pradesh" },
      { value: "23", label: "Madhya Pradesh (duplicate row)" },
      { value: "10", label: "Bihar" },
      { value: "", label: "Invalid" },
    ])).toEqual([{ value: "10", label: "Bihar" }, { value: "23", label: "Madhya Pradesh" }]);
  });

  it("does not add an arbitrary SQL limit to grouped cascade options", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (_url, options) => {
      expect(JSON.parse(options.body).sql).not.toContain("LIMIT");
      return new Response(JSON.stringify({ success: true, result: { records: [{ value: "23", label: "Madhya Pradesh" }] } }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    try { await getSoilHealthOptions("state", {}); } finally { globalThis.fetch = originalFetch; }
  });

  it("registers options and query routes", () => {
    const app = { get: vi.fn() };
    registerSoilTestRoutes(app);
    expect(app.get.mock.calls.map(([path]) => path)).toEqual(["/api/soil-test/options", "/api/soil-test/location", "/api/soil-test"]);
  });
});
