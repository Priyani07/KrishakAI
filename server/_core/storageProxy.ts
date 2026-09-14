import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "./env";

const LOCAL_IMMUTABLE_ASSETS = new Set([
  "krishak-mark_b9b95f65.webp",
  "krishak-hub-hero_83017072.webp",
  "krishak-field-detail_05c7e3a9.webp",
  "krishak-network-texture_7aee977c.webp",
]);

function findLocalImmutableAsset(key: string) {
  if (!LOCAL_IMMUTABLE_ASSETS.has(key)) return null;

  const assetRoots = ENV.isProduction
    ? [
        path.resolve(process.cwd(), "dist/public/manus-storage"),
        path.resolve(import.meta.dirname, "public/manus-storage"),
      ]
    : [
        path.resolve(process.cwd(), "client/public/manus-storage"),
        path.resolve(import.meta.dirname, "../../client/public/manus-storage"),
      ];

  return assetRoots
    .map((root) => path.join(root, key))
    .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    const localAsset = findLocalImmutableAsset(key);
    if (localAsset) {
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      res.type("image/webp");
      res.sendFile(localAsset);
      return;
    }

    // These four UI assets must never fall through to Forge or an external Manus host.
    if (LOCAL_IMMUTABLE_ASSETS.has(key)) {
      res.status(404).send("Local immutable asset missing");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
