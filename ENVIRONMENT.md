# Krishak environment contract

Copy `.env.example` to `.env` locally and provide only the integrations you use. `.env` is ignored and must never be archived or committed.

## Server-only variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL community, sessions, complaints, and Admin data |
| `ADMIN_SETUP_SECRET` | Timing-safe secret for `POST /api/community/auth/admin-bootstrap` |
| `KINDWISE_API_KEY` | Primary Crop Health inference |
| `GEMINI_API_KEY` | Chatbot, planner explanation, optional Disease image gate, and Soil Analysis image observations |
| `GEMINI_MODEL` | Optional model override; default `gemini-2.5-flash` |
| `DISEASE_IMAGE_GATE_MODEL` | Optional Disease-gate model override |
| `BUILT_IN_FORGE_API_KEY` | Optional built-in LLM fallback for the Disease image gate |
| `DATA_GOV_API_KEY` | Optional Agmarknet market-price boundary |
| `PORT` | Listen port; default `3000` |

## Public client endpoint variables

| Variable | Default/behavior |
|---|---|
| `VITE_WEATHER_API_URL` | `/api/weather` |
| `VITE_DISEASE_DETECTION_API_URL` | `/api/disease-detection` |
| `VITE_SOIL_ANALYSIS_API_URL` | `/api/soil-analysis` |
| `VITE_COMMUNITY_API_URL` | `/api/community` |
| `VITE_COMMUNITY_SOCKET_URL` | Same origin |

Never put credentials, database URLs, setup secrets, or Admin passwords in a `VITE_*` variable. The app does not generate substitute Disease, weather, soil, intrusion, or chatbot results when a provider is unavailable.
