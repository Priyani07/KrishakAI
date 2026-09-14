export const SOIL_TEST_DOWNSTREAM = Object.freeze({
  state: ["district", "block", "village", "year"],
  district: ["block", "village", "year"],
  block: ["village", "year"],
  village: ["year"],
  year: [],
});

export function resetSoilTestCascade(location, options, key, value, code = value) {
  const nextLocation = { ...location, [key]: value, [`${key}Code`]: code };
  const nextOptions = { ...options };
  for (const child of SOIL_TEST_DOWNSTREAM[key] || []) {
    nextLocation[child] = "";
    nextLocation[`${child}Code`] = "";
    nextOptions[child] = [];
  }
  return { location: nextLocation, options: nextOptions };
}

export function createSoilTestRequestGuard() {
  const latest = {};
  return {
    next(level) {
      latest[level] = (latest[level] || 0) + 1;
      return latest[level];
    },
    invalidate(level) {
      latest[level] = (latest[level] || 0) + 1;
      return latest[level];
    },
    isCurrent(level, requestId) {
      return latest[level] === requestId;
    },
  };
}
