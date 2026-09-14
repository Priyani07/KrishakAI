/* Krishak Market Price Service — thin client boundary.
   Calls /api/market-prices which requires DATA_GOV_API_KEY on the server.
   Returns structured records or throws an error with code. */

const BASE = "/api/market-prices";

export async function fetchMarketPrices({ commodity = "", state = "", district = "", limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (commodity) params.set("commodity", commodity);
  if (state) params.set("state", state);
  if (district) params.set("district", district);
  params.set("limit", String(limit));

  const response = await fetch(`${BASE}?${params.toString()}`);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.message || `Market price service returned status ${response.status}.`);
    error.code = data?.code || "SERVICE_ERROR";
    throw error;
  }
  return data; // { records, total, fetched_at }
}
