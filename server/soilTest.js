const RESOURCE_ID = "66860e1a-113a-4ca8-94aa-2418bd462d28";
const DATASET_ID = "66049516-7ae0-47e4-98dc-056bc7a27abc";
const CKAN_ACTION_URL = "https://ckan.indiadataportal.com/api/3/action";
const DATASET_URL = "https://indiadataportal.com/p/soil-health-card/r/moafw-soil_health_card-vl-yr-abc";
const SOURCE_NAME = "India Data Portal — Soil Health Card – Soil Nutrient Analysis";
const NO_DATA_MESSAGE = "No Soil Health Card reference data is available for this selection.";
const SOURCE_UNAVAILABLE_MESSAGE = "Soil Health Card reference data is temporarily unavailable.";
const INVALID_RESPONSE_MESSAGE = "Soil Health Card reference data returned an invalid response.";
const LOCATION_MATCH_MESSAGE = "Unable to match this location to a Soil Health Card reference village. Please select your location manually.";
const REVERSE_GEOCODING_URL = "https://nominatim.openstreetmap.org/reverse";
const FIELD_MAP = Object.freeze({ state: "state_name", district: "district_name", block: "block_name", village: "village_name", year: "year" });
const CODE_FIELD_MAP = Object.freeze({ state: "state_code", district: "district_code", block: "block_code", village: "village_code", year: "year" });
const OPTION_LEVELS = Object.freeze(["state", "district", "block", "village", "year"]);
const cache = { metadata: null, expiresAt: 0 };

function escapeSql(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 180) return null;
  return text.replaceAll("'", "''");
}

function filterValue(filters, key) {
  return filters[`${key}_code`] ?? filters[`${key}Code`] ?? filters[key];
}

function filterColumn(filters, key) {
  return filterValue(filters, key) !== undefined && filterValue(filters, key) !== filters[key]
    ? CODE_FIELD_MAP[key]
    : FIELD_MAP[key];
}

function buildWhere(filters = {}, includeYear = true) {
  const clauses = [];
  for (const key of Object.keys(FIELD_MAP)) {
    if (!includeYear && key === "year") continue;
    const value = escapeSql(filterValue(filters, key));
    if (value) clauses.push(`"${filterColumn(filters, key)}" = '${value}'`);
  }
  return clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, headers: { Accept: "application/json", ...(options.headers || {}) }, signal: controller.signal });
    if (!response.ok) throw new Error(`upstream status ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

async function getMetadata() {
  if (cache.metadata && cache.expiresAt > Date.now()) return cache.metadata;
  const payload = await fetchJson(`${CKAN_ACTION_URL}/package_show?id=${DATASET_ID}`);
  if (!payload?.success || !payload.result) throw new Error("metadata unavailable");
  const resource = (payload.result.resources || []).find((item) => item.id === RESOURCE_ID);
  if (!resource) throw new Error("resource unavailable");
  const metadata = {
    title: resource.name || payload.result.title || "Soil Nutrient Analysis",
    datasetTitle: payload.result.title || "Soil Health Card",
    organization: "Ministry of Agriculture & Farmers Welfare (MoAFW) Soil Health Card Scheme",
    license: payload.result.license_title || payload.result.license_id || "Not specified by live metadata",
    updatedAt: resource.data_last_updated || null,
    metadataModified: resource.metadata_modified || payload.result.metadata_modified || null,
    coverage: resource.years_covered || "Not specified by live metadata",
    granularity: resource.granularity || "Village",
    frequency: resource.frequency || "Yearly",
    format: resource.format || "CSV",
    sizeBytes: Number(resource.size) || null,
    datastoreActive: Boolean(resource.datastore_active),
    sourceUrl: DATASET_URL,
    resourceUrl: resource.url || null,
  };
  cache.metadata = metadata;
  cache.expiresAt = Date.now() + 5 * 60 * 1000;
  return metadata;
}

async function queryDatastore(sql) {
  const payload = await fetchJson(`${CKAN_ACTION_URL}/datastore_search_sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Krishak Soil Testing reference adapter" },
    body: JSON.stringify({ sql }),
  });
  if (!payload?.success || !payload.result) throw new Error("datastore unavailable");
  return payload.result.records || [];
}

function sourceOption(level, record) {
  const label = String(record?.label ?? record?.[FIELD_MAP[level]] ?? "").trim();
  const value = String(record?.value ?? record?.[CODE_FIELD_MAP[level]] ?? label).trim();
  return label && value ? { value, label } : null;
}

function deduplicateSourceOptions(records) {
  const optionsById = new Map();
  for (const record of records) {
    const option = record && typeof record === "object" && "value" in record && "label" in record
      ? { value: String(record.value).trim(), label: String(record.label).trim() }
      : null;
    if (option?.value && option.label && !optionsById.has(option.value)) optionsById.set(option.value, option);
  }
  return [...optionsById.values()].sort((left, right) => left.label.localeCompare(right.label) || left.value.localeCompare(right.value));
}

export async function getSoilHealthOptions(level, filters = {}) {
  if (!OPTION_LEVELS.includes(level)) throw new Error("Unsupported Soil Health Card option level.");
  const nameColumn = FIELD_MAP[level];
  const codeColumn = CODE_FIELD_MAP[level];
  const where = buildWhere(filters, true);
  const records = await queryDatastore(`SELECT "${codeColumn}" AS value,"${nameColumn}" AS label FROM "${RESOURCE_ID}"${where} GROUP BY "${codeColumn}","${nameColumn}" ORDER BY "${nameColumn}"`);
  return deduplicateSourceOptions(records.map((record) => sourceOption(level, record)).filter(Boolean));
}

function referenceResponse(metadata, filters, records) {
  if (!records.length) return { status: "no_result", result: null, source: SOURCE_NAME, sourceUrl: metadata.sourceUrl, measuredAt: null, coverage: metadata.coverage, metadata, message: NO_DATA_MESSAGE };
  const nutrients = records.filter((record) => typeof record.nutrient_name === "string" && Number.isFinite(Number(record.value)) && Number(record.value) >= 0).map((record) => ({ name: record.nutrient_name, level: record.nutrient_level || null, value: Number(record.value), unit: "Number/Count" }));
  if (!nutrients.length) throw new Error(INVALID_RESPONSE_MESSAGE);
  const first = records[0];
  return { status: "success", result: { nutrients, location: { state: first.state_name || filters.state || "", stateCode: first.state_code || filters.state_code || filters.stateCode || "", district: first.district_name || filters.district || "", districtCode: first.district_code || filters.district_code || filters.districtCode || "", block: first.block_name || filters.block || "", blockCode: first.block_code || filters.block_code || filters.blockCode || "", village: first.village_name || filters.village || "", villageCode: first.village_code || filters.village_code || filters.villageCode || "" }, year: first.year || filters.year || "" }, source: SOURCE_NAME, sourceUrl: metadata.sourceUrl, measuredAt: null, coverage: metadata.coverage, metadata, message: null };
}

export async function getSoilHealthReference(filters = {}) {
  const metadata = await getMetadata();
  const required = ["state", "district", "block", "village", "year"];
  if (required.some((key) => !escapeSql(filterValue(filters, key)))) return { status: "no_result", result: null, source: SOURCE_NAME, sourceUrl: metadata.sourceUrl, measuredAt: null, coverage: metadata.coverage, metadata, message: "Select a state, district, block, village, and year before loading reference data." };
  const records = await queryDatastore(`SELECT year,state_name,state_code,district_name,district_code,block_name,block_code,village_name,village_code,nutrient_type,nutrient_name,nutrient_level,value FROM "${RESOURCE_ID}"${buildWhere(filters)} ORDER BY nutrient_type,nutrient_name,nutrient_level LIMIT 500`);
  return referenceResponse(metadata, filters, records);
}

function validateCoordinates(latitude, longitude) {
  const lat = Number(latitude); const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error("Selected coordinates are invalid.");
  return { lat, lng };
}

function reverseAddressCandidates(payload) {
  const address = payload?.address || {};
  return { countryCode: String(address.country_code || "").toLowerCase(), state: String(address.state || ""), district: String(address.district || address.county || address.state_district || ""), block: String(address.block || address.suburb || ""), village: String(address.village || address.town || address.city || "") };
}

async function reverseGeocode(latitude, longitude) {
  const coordinates = validateCoordinates(latitude, longitude);
  return fetchJson(`${REVERSE_GEOCODING_URL}?format=jsonv2&lat=${encodeURIComponent(coordinates.lat)}&lon=${encodeURIComponent(coordinates.lng)}&zoom=10&addressdetails=1`, { headers: { "User-Agent": "Krishak Soil Testing location resolver" } }, 10000);
}

async function matchReverseLocation(candidates) {
  if (candidates.countryCode && candidates.countryCode !== "in") return null;
  if (!candidates.village) return null;
  const attempts = [{ state: candidates.state, district: candidates.district, village: candidates.village }, { state: candidates.state, village: candidates.village }, { village: candidates.village }];
  for (const attempt of attempts) {
    const filterValues = Object.fromEntries(Object.entries(attempt).filter(([, value]) => escapeSql(value)));
    const records = await queryDatastore(`SELECT state_name,state_code,district_name,district_code,block_name,block_code,village_name,village_code FROM "${RESOURCE_ID}"${buildWhere(filterValues, false)} GROUP BY state_name,state_code,district_name,district_code,block_name,block_code,village_name,village_code LIMIT 20`);
    const record = records[0];
    if (record?.state_name && record?.district_name && record?.block_name && record?.village_name) return { state: String(record.state_name), stateCode: String(record.state_code || ""), district: String(record.district_name), districtCode: String(record.district_code || ""), block: String(record.block_name), blockCode: String(record.block_code || ""), village: String(record.village_name), villageCode: String(record.village_code || ""), matched: true };
  }
  return null;
}

export async function getSoilHealthLocation(latitude, longitude) {
  const metadata = await getMetadata();
  const candidates = reverseAddressCandidates(await reverseGeocode(latitude, longitude));
  const matched = await matchReverseLocation(candidates);
  if (!matched) return { status: "partial", location: candidates, matched: false, source: SOURCE_NAME, sourceUrl: metadata.sourceUrl, metadata, message: LOCATION_MATCH_MESSAGE };
  return { status: "success", location: matched, matched: true, source: SOURCE_NAME, sourceUrl: metadata.sourceUrl, metadata, message: null };
}

export function registerSoilTestRoutes(app) {
  app.get("/api/soil-test/options", async (req, res) => { try { res.json({ status: "success", options: await getSoilHealthOptions(String(req.query.level || ""), req.query) }); } catch (_error) { res.status(503).json({ status: "error", message: SOURCE_UNAVAILABLE_MESSAGE }); } });
  app.get("/api/soil-test/location", async (req, res) => { try { res.json(await getSoilHealthLocation(req.query.latitude, req.query.longitude)); } catch (_error) { res.status(502).json({ status: "error", message: LOCATION_MATCH_MESSAGE }); } });
  app.get("/api/soil-test", async (req, res) => { try { res.json(await getSoilHealthReference(req.query)); } catch (_error) { res.status(503).json({ status: "error", result: null, source: SOURCE_NAME, measuredAt: null, message: SOURCE_UNAVAILABLE_MESSAGE }); } });
}

export { CODE_FIELD_MAP, DATASET_URL, FIELD_MAP, LOCATION_MATCH_MESSAGE, NO_DATA_MESSAGE, RESOURCE_ID, SOURCE_NAME, SOURCE_UNAVAILABLE_MESSAGE, buildWhere, deduplicateSourceOptions, getMetadata, reverseAddressCandidates, validateCoordinates };
