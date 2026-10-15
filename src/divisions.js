import divisions from "./divisions.json" with { type: "json" };

export const DIVISIONS = divisions;
export const DEFAULT_DIVISION = "mixed-a";
export const DIVISION_KEY = "ultimateciu2026-division-v1";

export function initialDivision(search, storage) {
  const explicit = new URLSearchParams(search).get("division");
  if (explicit !== null) return Object.hasOwn(DIVISIONS, explicit) ? explicit : DEFAULT_DIVISION;
  try {
    const saved = storage?.getItem(DIVISION_KEY);
    return Object.hasOwn(DIVISIONS, saved) ? saved : DEFAULT_DIVISION;
  } catch {
    return DEFAULT_DIVISION;
  }
}

/** Keep the existing Serie A cache; scope Serie B even when match/team IDs overlap. */
export function cacheKey(division) {
  return division === DEFAULT_DIVISION ? "ciu2026-data-v1" : `ciu2026-data-v1-${division}`;
}
