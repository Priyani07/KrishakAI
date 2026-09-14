import { describe, expect, it } from "vitest";
import {
  chooseLatestSoilYear,
  chartMax,
  chartWidth,
  normalizeCoordinates,
  observationIsSafe,
  summarizeSoilPhotoPixels,
  validateSoilPhotoFile,
} from "../client/src/soilTestingExperience.js";

describe("Soil Testing location, photo, and chart helpers", () => {
  it("normalizes only valid geographic coordinates", () => {
    expect(normalizeCoordinates("22.9734", "78.6569")).toEqual({ lat: 22.9734, lng: 78.6569 });
    expect(normalizeCoordinates(91, 78)).toBeNull();
    expect(normalizeCoordinates("not-a-number", 78)).toBeNull();
  });

  it("selects the newest available SHC year without inventing one", () => {
    expect(chooseLatestSoilYear(["2023-24", "2024-25", "2022-23"])).toBe("2024-25");
    expect(chooseLatestSoilYear([])).toBe("");
  });

  it("accepts supported photo files and rejects unsupported or oversized files", () => {
    expect(validateSoilPhotoFile({ name: "field.JPG", type: "image/jpeg", size: 100 })).toMatchObject({ valid: true });
    expect(validateSoilPhotoFile({ name: "field.gif", type: "image/gif", size: 100 }).valid).toBe(false);
    expect(validateSoilPhotoFile({ name: "field.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 }).valid).toBe(false);
  });

  it("returns only a visual observation and never chemical measurements", () => {
    const result = summarizeSoilPhotoPixels({ width: 640, height: 480, pixels: new Uint8ClampedArray([60, 45, 30, 255, 70, 55, 40, 255]) });
    expect(result.status).toBe("success");
    expect(result.observation.color).toBe("dark brown");
    expect(observationIsSafe(result.observation)).toBe(true);
    expect(result.observation).not.toHaveProperty("nitrogen");
    expect(observationIsSafe({ nitrogen: 42 })).toBe(false);
    expect(summarizeSoilPhotoPixels({ width: 100, height: 100, pixels: [1, 2, 3] }).status).toBe("error");
  });

  it("scales source-backed chart bars against the largest returned value", () => {
    const max = chartMax([{ value: 10 }, { value: 40 }, { value: 20 }]);
    expect(max).toBe(40);
    expect(chartWidth(20, max)).toBe("50%");
    expect(chartWidth(100, max)).toBe("100%");
  });
});
