# Krishak Agricultural Platform

Krishak is a React/Express agricultural platform designed to provide farmers with practical tools for crop health, soil analysis, irrigation planning, weather information, market prices, farmer guidance, community interaction, complaints, and AI-assisted support.

## Features

* **Disease Detection** — Crop image analysis using the server-side Kindwise Crop Health integration, with optional Gemini image triage and Local38 secondary validation where applicable.
* **Soil Analysis** — Upload a soil image for AI-assisted visual observations. It does not replace laboratory soil testing or provide unsupported exact pH/NPK measurements.
* **Irrigation Planner** — Deterministic irrigation planning based on the verified inputs available to the planner, with optional Gemini explanation.
* **Weather** — Weather search, current-location support, and coordinate-based weather lookup through the server weather boundary.
* **Animal/Farm Intrusion** — Browser-based image and camera monitoring using COCO-SSD.
* **Farmer's Guide** — Agricultural guidance and supporting tools.
* **Market Prices** — Agmarknet/data.gov.in integration boundary for agricultural market information.
* **Community** — Discussions, comments, chat, events, authentication, and complaint management.
* **Chatbot** — Server-side Gemini-powered agricultural information assistant.
* **Admin Dashboard** — Role-protected dashboard for complaint and farmer management.

## Honest Provider Behavior

Krishak does not fabricate AI, sensor, laboratory, or live-data results.

* Disease Detection requires a server-side `KINDWISE_API_KEY`. Gemini image triage is optional and does not replace the primary disease provider.
* Local38 is used only where its verified model/assets and supported diagnosis conditions allow it.
* Chatbot and irrigation-plan AI explanations require server-side `GEMINI_API_KEY`. If unavailable, the application shows an unavailable state instead of inventing an answer.
* Weather uses the server-side `/api/weather` boundary and selected search/GPS/map coordinates.
* Soil Analysis validates JPG, PNG, and WEBP uploads and uses the server-side Gemini provider when configured. Image analysis is observational and does not substitute for laboratory measurements.
* Intrusion detection runs COCO-SSD locally in the browser for image and supported camera workflows. Model-loading failures are shown as errors.
* Community and Admin functionality requires the configured MySQL database and applied migrations.
* No registry entry, mock result, or source-level test count is treated as proof of live provider capability.
* The repository does not claim verified live Disease Detection coverage for 50+ crops based on registry size alone.

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

See `ENVIRONMENT.md` for environment configuration.

For Admin provisioning and configuration, see `ADMIN_SETUP.md`.

**Never commit `.env` or expose server-side API keys through client-side `VITE_*` variables.**

## Main Routes

| Route                | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `/`                  | Krishak agricultural platform home                             |
| `/planner`           | Deterministic irrigation planning with optional AI explanation |
| `/weather`           | Weather search, location, and coordinate-based weather flow    |
| `/disease-detection` | Crop disease image analysis                                    |
| `/animal-intrusion`  | Animal/farm intrusion image and camera monitoring              |
| `/soil-analysis`     | Soil-image analysis and agricultural observations              |
| `/guide/*`           | Farmer's Guide tools                                           |
| `/community/*`       | Discussions, comments, chat, complaints, and events            |
| `/chatbot`           | Agricultural information assistant                             |
| `/admin`             | Protected Admin dashboard                                      |
| `/market-prices`     | Agricultural market-price integration boundary                 |

## Community API

Community endpoints are available under:

```text
/api/community
```

### Authentication

* `POST /auth/signup`
* `POST /auth/login`
* `POST /auth/logout`
* `GET /users/me`

### Admin

* `POST /auth/admin-bootstrap`
* `GET /admin/stats`
* `GET /admin/farmers`
* `GET /admin/farmers/:farmerId/complaints`

### Complaints

* `POST /complaints`
* `GET /complaints/mine`
* `GET /complaints`
* `GET|PATCH|DELETE /complaints/:id`

### Discussions

* `GET|POST /discussions`
* `GET /discussions/:id`
* Discussion comment routes under `/discussions/:id/comments`
* `GET|PATCH|DELETE /comments/:id`

Authentication, authorization, and complaint ownership are enforced server-side.

## Environment Variables

Client-side configuration uses only non-secret `VITE_*` service endpoints.

Server-side configuration contains database credentials, authentication secrets, and provider API keys.

See:

* `ENVIRONMENT.md`
* `.env.example`
* `ADMIN_SETUP.md`

Do not place private API keys or database credentials in client-side environment variables.

## Security

* Passwords use scrypt with random salts.
* Community sessions are stored server-side and revoked on logout.
* Authentication and authorization are enforced by the server.
* Admin-only operations require the authenticated Admin role.
* Complaint ownership is enforced server-side.
* Admin provisioning uses a protected setup mechanism.
* Setup secrets and provider API keys remain server-side.
* Secrets must never be committed to GitHub.

## Data and AI Transparency

Krishak distinguishes between:

* **Verified provider output**
* **Deterministic application logic**
* **Optional AI explanations**
* **Unavailable/unconfigured services**
* **Insufficient or uncertain data**

When the required data or provider is unavailable, the application reports the limitation rather than presenting fabricated measurements, predictions, or recommendations.

## Development Status

Krishak combines deterministic agricultural workflows with optional external AI and data providers. Provider availability depends on the corresponding server-side configuration, API quotas, database configuration, and external service availability.

The application should not be interpreted as a replacement for professional agricultural, laboratory, veterinary, or other domain-specific services where verified measurements or expert assessment are required.
