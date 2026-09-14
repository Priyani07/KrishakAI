import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const immutableAssets = Object.freeze({
  "krishak-mark_b9b95f65.webp": "7c22d7213b1815cb77affc365089f91652e14115135307cd2ca79ef143b84c0c",
  "krishak-hub-hero_83017072.webp": "b1cbba8cc4cc885738b493677575c83d2e663ae7230eb3fb777882c3a3d06571",
  "krishak-field-detail_05c7e3a9.webp": "621e450a84d79f6ec446f573e7efb73e9b32b9be9d6173de47e0811210b35a7c",
  "krishak-network-texture_7aee977c.webp": "5de9ddaf50db452616bc3af4a4abec726e03b00fdbac410b4514c591072176d9",
});

const appSource = readFileSync(new URL("../client/src/App.jsx", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
const storageProxySource = readFileSync(new URL("./_core/storageProxy.ts", import.meta.url), "utf8");
const viteConfigSource = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("immutable original Manus image assets", () => {
  it("preserves every uploaded image byte-for-byte", () => {
    for (const [fileName, expectedHash] of Object.entries(immutableAssets)) {
      const bytes = readFileSync(new URL(`../client/public/manus-storage/${fileName}`, import.meta.url));
      expect(sha256(bytes), fileName).toBe(expectedHash);
    }
  });

  it("keeps the original Manus component mapping", () => {
    expect(indexSource).toContain('/manus-storage/krishak-mark_b9b95f65.webp');
    expect(appSource).toContain('const heroImage = "/manus-storage/krishak-hub-hero_83017072.webp";');
    expect(appSource).toContain('const fieldImage = "/manus-storage/krishak-field-detail_05c7e3a9.webp";');
    expect(appSource).toContain('const networkTexture = "/manus-storage/krishak-network-texture_7aee977c.webp";');
    expect(appSource).toContain('style={{ backgroundImage: `linear-gradient(90deg, rgba(7, 35, 19, .96), rgba(10, 56, 30, .87)), url(${networkTexture})` }}');
    expect(appSource).toContain('className="hub-feature-image" style={{ backgroundImage: `url(${fieldImage})` }}');
    expect(appSource).toContain('className="hub-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(5, 26, 18, .76), rgba(5, 26, 18, .32)), url(${heroImage})` }}');
  });

  it("serves the four UI images locally instead of proxying them to Manus", () => {
    for (const fileName of Object.keys(immutableAssets)) {
      expect(storageProxySource).toContain(`"${fileName}"`);
    }
    expect(storageProxySource).toContain("res.sendFile(localAsset)");
    expect(viteConfigSource).not.toContain('target: "https://manus.im"');
  });
});
