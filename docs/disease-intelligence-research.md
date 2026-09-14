# Disease inference evidence and limits

## Runtime architecture

1. Optional Gemini image triage when `GEMINI_API_KEY` or the built-in server LLM connection is configured.
2. Kindwise Crop Health as the primary disease/crop provider.
3. Existing Kindwise class-ID mappings and normalization.
4. PlantVillage Local38 as a secondary consistency check only for comparable reviewed classes.

The Gemini gate is not a replacement Disease classifier. When it is absent, Kindwise still runs. The browser never receives provider credentials.

## Evidence tiers

- `VERIFIED_LIVE`: requires a real crop image through the production endpoint with recorded provider output.
- `INFERENCE_ENABLED`: accepted for Kindwise inference but not proven by a real image in this audit.
- `DOCUMENTED_ONLY`: provider/dataset documentation only.
- `UNSUPPORTED`: rejected or not represented by a configured provider.

The repository contains four reviewed disease mappings covering three distinct historically live-reviewed crops: Tomato, Potato, and Corn. It does **not** establish 50+ `VERIFIED_LIVE` crops. Registry or alias counts must never be reported as live verification.

## Local38 availability

The code retains the expected 38-class MobileNetV2 manifest, label, shard-integrity, preprocessing, and reconciliation architecture. If those exact assets are absent or fail integrity checks, the UI reports the secondary validator as unavailable and keeps the Kindwise-primary result. It never invents a secondary result.

## Safety behavior

The endpoint validates MIME type plus JPEG/PNG/WEBP signatures, file size, empty uploads, provider errors, non-plant results, confidence rules, crop aliases, and optional gate conflicts. Treatment guidance remains unavailable for unreviewed provider classes rather than being fabricated.
