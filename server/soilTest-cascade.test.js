import { describe, expect, it } from "vitest";
import { createSoilTestRequestGuard, resetSoilTestCascade } from "../client/src/soilTestCascade.js";
import { chooseLatestSoilYear } from "../client/src/soilTestingExperience.js";
import { parseSoilTestResponse } from "../client/src/services/soilTestService.js";

describe("Soil Testing cascade safety", () => {
  it("clears all downstream selections and options when a parent changes", () => {
    const state = { state: "Madhya Pradesh", stateCode: "23", district: "Agar-Malwa", districtCode: "999", block: "Agar", blockCode: "1", village: "Village", villageCode: "2", year: "2024-25", yearCode: "2024-25" };
    const options = { state: [{ value: "23", label: "Madhya Pradesh" }], district: [{ value: "999", label: "Agar-Malwa" }], block: [{ value: "1", label: "Agar" }], village: [{ value: "2", label: "Village" }], year: [{ value: "2024-25", label: "2024-25" }] };
    expect(resetSoilTestCascade(state, options, "state", "Gujarat")).toEqual({
      location: { state: "Gujarat", stateCode: "Gujarat", district: "", districtCode: "", block: "", blockCode: "", village: "", villageCode: "", year: "", yearCode: "" },
      options: { state: [{ value: "23", label: "Madhya Pradesh" }], district: [], block: [], village: [], year: [] },
    });
  });

  it("selects the latest year from source-shaped options", () => {
    expect(chooseLatestSoilYear([{ value: "2023-24", label: "2023-24" }, { value: "2024-25", label: "2024-25" }])).toBe("2024-25");
    expect(chooseLatestSoilYear(["2023-24", "2024-25"])).toBe("2024-25");
  });

  it("accepts only the newest request for a cascade level", () => {
    const guard = createSoilTestRequestGuard();
    const first = guard.next("district");
    const second = guard.next("district");
    expect(guard.isCurrent("district", first)).toBe(false);
    expect(guard.isCurrent("district", second)).toBe(true);
    guard.invalidate("district");
    expect(guard.isCurrent("district", second)).toBe(false);
  });

  it("normalizes source-preserved category values without inventing units", () => {
    const result = parseSoilTestResponse({ status: "success", result: { nutrients: [{ name: "Nitrogen", level: "Low", value: "35", unit: "Number/Count" }] }, source: "India Data Portal" });
    expect(result.result.nutrients).toEqual([{ name: "Nitrogen", level: "Low", value: 35, unit: "Number/Count" }]);
  });

  it("keeps no-data and malformed responses distinct", () => {
    expect(parseSoilTestResponse({ status: "no_result", message: "No Soil Health Card reference data is available for this selection." }).status).toBe("no_result");
    expect(() => parseSoilTestResponse({ status: "success", result: { nutrients: [{ name: "Nitrogen", level: "Low", value: null, unit: "Number/Count" }] } })).toThrow("invalid response");
  });
});
