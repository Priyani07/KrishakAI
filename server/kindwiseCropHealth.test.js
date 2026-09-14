import { afterEach, describe, expect, it, vi } from "vitest";
import { KindwiseCropHealthError, classifyKindwiseCropHealthImage, parseKindwiseCropHealthResponse } from "./kindwiseCropHealth.js";

const validPayload = {
  result: {
    is_plant: { binary: true, probability: 0.99 },
    crop: { suggestions: [{ id: "crop-1", name: "tomato", scientific_name: "Solanum lycopersicum", probability: 0.9 }] },
    disease: { suggestions: [{ id: "disease-1", name: "leaf condition", scientific_name: "Example", probability: 0.8 }] },
  },
};

afterEach(() => vi.unstubAllEnvs());

describe("Kindwise crop.health adapter", () => {
  it("sends one multipart image with the server-only Api-Key header and normalizes the required response fields", async () => {
    vi.stubEnv("KINDWISE_API_KEY", "test-key");
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(validPayload), { status: 201 }));

    const result = await classifyKindwiseCropHealthImage({ imageBuffer: Buffer.from("image"), mimeType: "image/png", fetchImpl });

    expect(result).toEqual({
      isPlant: true,
      isPlantProbability: 0.99,
      crop: { id: "crop-1", name: "tomato", scientificName: "Solanum lycopersicum", probability: 0.9 },
      disease: { id: "disease-1", name: "leaf condition", scientificName: "Example", probability: 0.8 },
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://crop.kindwise.com/api/v1/identification", expect.objectContaining({
      method: "POST",
      headers: { "Api-Key": "test-key" },
      body: expect.any(FormData),
      signal: expect.any(AbortSignal),
    }));
    expect(fetchImpl.mock.calls[0][1].body.get("image").type).toBe("image/png");
  });

  it("rejects missing credentials without initiating a provider request", async () => {
    vi.stubEnv("KINDWISE_API_KEY", "");
    const fetchImpl = vi.fn();
    await expect(classifyKindwiseCropHealthImage({ imageBuffer: Buffer.from("image"), mimeType: "image/png", fetchImpl })).rejects.toMatchObject({ code: "missing_api_key" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [400, "bad_request"],
    [401, "unauthorized"],
    [403, "unauthorized"],
    [429, "rate_limited"],
    [500, "provider_unavailable"],
  ])("maps provider status %i to safe adapter code %s", async (status, code) => {
    vi.stubEnv("KINDWISE_API_KEY", "test-key");
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status }));
    await expect(classifyKindwiseCropHealthImage({ imageBuffer: Buffer.from("image"), mimeType: "image/png", fetchImpl })).rejects.toMatchObject({ code });
  });

  it("maps timeout and malformed provider data without exposing a raw response", async () => {
    vi.stubEnv("KINDWISE_API_KEY", "test-key");
    const timeout = Object.assign(new Error("request timed out"), { name: "TimeoutError" });
    await expect(classifyKindwiseCropHealthImage({ imageBuffer: Buffer.from("image"), mimeType: "image/png", fetchImpl: vi.fn().mockRejectedValue(timeout) })).rejects.toMatchObject({ code: "timeout" });
    await expect(classifyKindwiseCropHealthImage({ imageBuffer: Buffer.from("image"), mimeType: "image/png", fetchImpl: vi.fn().mockResolvedValue(new Response("not-json", { status: 201 })) })).rejects.toMatchObject({ code: "malformed_response" });
    expect(() => parseKindwiseCropHealthResponse({ result: { is_plant: { binary: true, probability: 0.9 }, disease: { suggestions: [{ name: "missing id", probability: 0.8 }] } } })).toThrow(KindwiseCropHealthError);
    expect(() => parseKindwiseCropHealthResponse({ result: { is_plant: { binary: true, probability: 0.9 }, disease: { suggestions: [{ id: "disease", name: "missing confidence" }] } } })).toThrow(KindwiseCropHealthError);
  });

  it("accepts a verified non-plant provider shape without requiring a disease label", () => {
    expect(parseKindwiseCropHealthResponse({ result: { is_plant: { binary: false, probability: 0.82 } } })).toEqual({ isPlant: false, isPlantProbability: 0.82 });
  });
});
