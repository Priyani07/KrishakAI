/* Krishak Market Prices — data.gov.in Agmarknet API boundary.
   Real data requires DATA_GOV_API_KEY (server-side only, never exposed to client).
   Without the key, returns 503 with an honest unconfigured state. */

const AGMARKNET_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const AGMARKNET_BASE = "https://api.data.gov.in/resource";
const REQUEST_TIMEOUT_MS = 12000;

function normaliseRecord(raw) {
  return {
    commodity: raw.commodity || raw.Commodity || raw.commodityName || "",
    variety: raw.variety || raw.Variety || "",
    state: raw.state || raw.State || raw.stateName || "",
    district: raw.district || raw.District || raw.districtName || "",
    market: raw.market || raw.Market || raw.marketName || raw.apmc || "",
    minPrice: Number(raw.min_price ?? raw.minPrice ?? raw.MinPrice ?? NaN),
    maxPrice: Number(raw.max_price ?? raw.maxPrice ?? raw.MaxPrice ?? NaN),
    modalPrice: Number(raw.modal_price ?? raw.modalPrice ?? raw.ModalPrice ?? NaN),
    arrivalDate: raw.arrival_date || raw.arrivalDate || raw.ArrivalDate || "",
  };
}

export function registerMarketPriceRoutes(app) {
  app.get("/api/market-prices", async (req, res) => {
    const key = process.env.DATA_GOV_API_KEY;
    if (!key) {
      return res.status(503).json({
        code: "NOT_CONFIGURED",
        message: "Market price data is not configured on this server. Add DATA_GOV_API_KEY to enable live Agmarknet data.",
      });
    }

    const { commodity, state, district, limit = "20" } = req.query;
    const params = new URLSearchParams({
      "api-key": key,
      format: "json",
      limit: String(Math.min(Number(limit) || 20, 100)),
      offset: "0",
    });
    if (commodity) params.set("filters[commodity]", commodity);
    if (state) params.set("filters[state]", state);
    if (district) params.set("filters[district]", district);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(
        `${AGMARKNET_BASE}/${AGMARKNET_RESOURCE_ID}?${params.toString()}`,
        { signal: controller.signal, headers: { Accept: "application/json" } }
      );
      clearTimeout(timeout);

      if (!response.ok) {
        return res.status(502).json({ code: "UPSTREAM_ERROR", message: `Agmarknet API returned status ${response.status}.` });
      }

      const data = await response.json();
      const records = Array.isArray(data?.records) ? data.records.map(normaliseRecord) : [];
      return res.json({ records, total: data?.total ?? records.length, fetched_at: new Date().toISOString() });
    } catch (error) {
      clearTimeout(timeout);
      if (error?.name === "AbortError") {
        return res.status(504).json({ code: "TIMEOUT", message: "Market price service timed out." });
      }
      console.error("[MarketPrices] Upstream error:", error.message);
      return res.status(502).json({ code: "NETWORK_ERROR", message: "Could not reach the market price service." });
    }
  });
}
