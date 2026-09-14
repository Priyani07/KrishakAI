import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SoilAnalysisError,
  analyzeSoilImage,
  isSupportedSoilImageSignature,
  normalizeSoilAnalysisResult,
} from "./soilAnalysis.js";

const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const validProviderResult = {
  imageStatus: "soil_image",
  likelySoilType: "Likely sandy loam",
  visibleCharacteristics: ["Loose, granular surface", "Light brown appearance"],
  suitableCrops: ["Millet", "Groundnut"],
  irrigationAdvice: ["Use lighter irrigation and check drainage locally"],
  managementAdvice: ["Add locally appropriate organic matter after verification"],
  note: "This is a cautious visual observation from the uploaded image.",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Soil Analysis image boundary", () => {
  it("accepts only supported image signatures", () => {
    expect(isSupportedSoilImageSignature(pngBuffer, "image/png")).toBe(true);
    expect(isSupportedSoilImageSignature(Buffer.from("not an image"), "image/png")).toBe(false);
    expect(isSupportedSoilImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg")).toBe(true);
    expect(isSupportedSoilImageSignature(Buffer.from("RIFFxxxxWEBP"), "image/webp")).toBe(true);
  });

  it("normalizes only the supported qualitative result fields", () => {
    expect(normalizeSoilAnalysisResult(validProviderResult)).toEqual(validProviderResult);
    expect(normalizeSoilAnalysisResult({
      imageStatus: "not_soil_image",
      likelySoilType: "",
      visibleCharacteristics: [],
      suitableCrops: [],
      irrigationAdvice: [],
      managementAdvice: [],
      note: "The soil surface is not the main visible subject.",
    })).toMatchObject({ imageStatus: "not_soil_image", likelySoilType: null, suitableCrops: [] });
  });

  it("rejects laboratory, sensor, numerical, and unexpected result claims", () => {
    expect(() => normalizeSoilAnalysisResult({ ...validProviderResult, note: "The pH appears suitable." })).toThrow(SoilAnalysisError);
    expect(() => normalizeSoilAnalysisResult({ ...validProviderResult, irrigationAdvice: ["Apply twenty millimetres every 2 days"] })).toThrow(SoilAnalysisError);
    expect(() => normalizeSoilAnalysisResult({ ...validProviderResult, soilMoisture: 44 })).toThrow(SoilAnalysisError);
  });

  it("reports an honest unconfigured state without calling a provider", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchImpl = vi.fn();
    await expect(analyzeSoilImage(pngBuffer, "image/png", { fetchImpl })).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the validated image to the configured server-side Gemini boundary", async () => {
    vi.stubEnv("GEMINI_API_KEY", "server-only-test-key");
    vi.stubEnv("GEMINI_MODEL", "configured-vision-model");
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(validProviderResult) }] } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await analyzeSoilImage(pngBuffer, "image/png", { fetchImpl });

    expect(result).toMatchObject({ imageStatus: "soil_image", provider: "Gemini", model: "configured-vision-model" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toContain("configured-vision-model:generateContent");
    const body = JSON.parse(request.body);
    expect(body.contents[0].parts[1].inlineData).toEqual({ mimeType: "image/png", data: pngBuffer.toString("base64") });
    expect(JSON.stringify(body)).toContain("Never provide or infer pH");
  });
});
