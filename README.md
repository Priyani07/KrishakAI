# Krishak Agricultural Platform

Krishak is the existing React/Express agricultural application in this repository. It includes deterministic irrigation planning, Open-Meteo weather, Kindwise Crop Health integration, browser COCO-SSD intrusion monitoring, server-side Gemini soil image analysis, Farmer guidance, community/authentication, complaints, and a designated Admin dashboard.

## Honest provider behavior

- Disease Detection requires server-only `KINDWISE_API_KEY`. Gemini is an optional image-triage gate; it is skipped when unconfigured. Local38 is secondary and reports unavailable if its verified assets cannot load.
- Chatbot and planner explanation require server-only `GEMINI_API_KEY` and otherwise show unavailable states.
- Weather uses the same-origin `/api/weather` server boundary and exact search/GPS/map coordinates.
- Soil Analysis validates uploaded JPG, PNG, or WEBP images and uses the server-side Gemini provider when configured; it never substitutes laboratory or sensor measurements.
- Intrusion upload and live camera monitoring run COCO-SSD locally in the browser. A model-load failure is shown as an error.
- Community/Admin require `DATABASE_URL` and applied MySQL migrations.

No registry entry, mock, or source-level test counts as live Disease verification. The retained evidence documents three historically live-reviewed crops (Tomato, Potato, Corn); 50+ has not been established by this repository alone.

## Setup

```bash
cp .env.example .env
pnpm install
pnpm db:push
pnpm check
pnpm test
pnpm build
pnpm dev
```

See `ENVIRONMENT.md` for configuration and `ADMIN_SETUP.md` for secure Admin provisioning. Never commit or archive `.env`.

## Main routes

| Path | Existing workflow |
|---|---|
| `/` | Six implementation-accurate feature cards |
| `/planner` | Deterministic irrigation plan, optional AI explanation, session task list |
| `/weather` | Simple search, GPS, or optional map-point weather flow |
| `/disease-detection` | Kindwise-primary crop image analysis; no location input |
| `/animal-intrusion` | Browser COCO-SSD image and camera monitoring |
| `/soil-analysis` | Validated soil-image upload and server-side AI observations |
| `/guide/*` | Existing Farmer Guide tools |
| `/community/*` | Discussions, comments, chat, complaints, events |
| `/chatbot` | Server-side Gemini information assistant |
| `/admin` | Designated Admin complaint dashboard |
| `/market-prices` | Optional data.gov.in Agmarknet boundary |

## Community API

All paths below are prefixed with `/api/community`.

- Auth: `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /users/me`
- Secure Admin bootstrap: `POST /auth/admin-bootstrap` with `setupSecret`
- Complaints: `POST /complaints`, `GET /complaints/mine`, `GET /complaints`, `GET|PATCH|DELETE /complaints/:id`
- Admin: `GET /admin/stats`, `GET /admin/farmers`, `GET /admin/farmers/:farmerId/complaints`
- Discussions: `GET|POST /discussions`, `GET /discussions/:id`, comment routes under `/discussions/:id/comments` and `/comments/:id`

Public signup always creates a Farmer. Admin-only APIs require both role `admin` and the fixed email `admin@gmail.com`. Complaint ownership is enforced server-side.

## Security

Passwords use scrypt with random salts. Community sessions are opaque UUIDs stored in `community_sessions`; they are not client-generated JWTs. Logout revokes the stored session. Credentials stay server-side. The bootstrap secret is compared in constant time, the Admin password must contain at least 12 characters, and only one Admin row is permitted.
