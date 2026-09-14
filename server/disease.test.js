import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

const invokeLLM = vi.fn();
vi.mock("./_core/llm", () => ({ invokeLLM }));
const { inferDiseaseWithVisionLLM, isSupportedImageSignature, parseInferenceResponse, registerDiseaseRoutes } = await import("./disease.js");
const { detectDisease } = await import("../client/src/services/phase3Services.js");

afterEach(() => { invokeLLM.mockReset(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function multipartImage(bytes, mimeType = "image/png") {
  const boundary = "----disease-test-boundary";
  return {
    boundary,
    body: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="leaf.png"\r\nContent-Type: ${mimeType}\r\n\r\n`),
      Buffer.from(bytes),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}

async function callRoute(bytes, mimeType = "image/png") {
  const app = { post: vi.fn() }; registerDiseaseRoutes(app); const handler = app.post.mock.calls[0][1];
  const { boundary, body } = multipartImage(bytes, mimeType);
  const req = Readable.from([body]); req.headers = { "content-type": `multipart/form-data; boundary=${boundary}` };
  const json = vi.fn(); const res = { status: vi.fn().mockReturnThis(), json };
  const done = new Promise((resolve) => json.mockImplementation((payload) => resolve(payload)));
  handler(req, res); return { payload: await done, res };
}

describe("Disease controlled response contract", () => {
  it("normalizes a supported legacy vision result", () => {
    const result = parseInferenceResponse({ choices: [{ message: { content: JSON.stringify({ status: "valid_leaf", crop: "tomato", diagnosisId: "tomato_early_blight", diagnosis: "Tomato early blight", confidence: 0.84, uncertain: false, note: "Review with an expert." }) } }] });
    expect(result).toMatchObject({ status: "valid_leaf", crop: "tomato", diagnosisId: "tomato_early_blight", diagnosis: "Tomato Early Blight", confidence: 0.84 });
    expect(result.provider).toBe("gemini-2.5-flash");
  });

  it("uses the corrected default model through the configured built-in provider", async () => {
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "test-only");
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ status: "unknown", crop: "unknown", diagnosisId: "unknown", diagnosis: "Unknown condition", confidence: 0.31, uncertain: true, note: "Not enough evidence." }) } }] });
    await inferDiseaseWithVisionLLM(Buffer.from("image"), "image/png");
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-2.5-flash" }));
  });

  it("validates actual JPEG, PNG, and WEBP signatures", () => {
    expect(isSupportedImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe(true);
    expect(isSupportedImageSignature(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), "image/png")).toBe(true);
    expect(isSupportedImageSignature(Buffer.from("RIFFxxxxWEBP"), "image/webp")).toBe(true);
    expect(isSupportedImageSignature(Buffer.from("not-an-image"), "image/png")).toBe(false);
  });
});

describe("Disease client boundary", () => {
  it("sends only the uploaded image multipart field", async () => {
    vi.stubEnv("VITE_DISEASE_DETECTION_API_URL", "/api/test-disease");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ diagnosis: "Leaf spot", confidence: 0.8 }), { status: 200, headers: { "content-type": "application/json" } }));
    const file = new File([new Uint8Array([0x89,0x50,0x4e,0x47])], "leaf.png", { type: "image/png" });
    await detectDisease(file);
    const form = fetchMock.mock.calls[0][1].body;
    expect([...form.keys()]).toEqual(["image"]);
    expect(form.get("image").name).toBe("leaf.png");
  });

  it("rejects a malformed success response", async () => {
    vi.stubEnv("VITE_DISEASE_DETECTION_API_URL", "/api/test-disease");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ label: "unknown" }), { status: 200 }));
    await expect(detectDisease(new File(["x"], "leaf.png", { type: "image/png" }))).rejects.toThrow("invalid response");
  });
});

describe("Disease upload route validation", () => {
  it("returns an honest unconfigured response for a valid image when Kindwise is absent", async () => {
    vi.stubEnv("KINDWISE_API_KEY", "");
    const { payload, res } = await callRoute([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(payload).toMatchObject({ code: "NOT_CONFIGURED" });
  });

  it("rejects MIME-spoofed non-image bytes before inference", async () => {
    vi.stubEnv("KINDWISE_API_KEY", "test-only");
    const { payload, res } = await callRoute(Buffer.from("not an image"));
    expect(res.status).toHaveBeenCalledWith(415);
    expect(payload.error).toContain("file content is not a valid");
  });
});
