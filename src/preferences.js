/** Browser-local preferences; IDs are reconciled against validated source teams. */
export const PREFERENCES_KEY = "ultimateciu2026-team-preferences-v1";
export const preferencesKey = (division) => !division || division === "mixed-a"
  ? PREFERENCES_KEY : `${PREFERENCES_KEY}-${division}`;
const emptyPreferences = () => ({ version: 1, selected: [], recent: [] });

export function normalizePreferences(value, teams) {
  if (!value || value.version !== 1 ||
      !Array.isArray(value.selected) || !Array.isArray(value.recent) ||
      ![...value.selected, ...value.recent].every((id) => typeof id === "string")) {
    return emptyPreferences();
  }
  const known = new Set(teams.map((team) => team.id));
  const ids = (values) => [...new Set(values)].filter((id) => known.has(id));
  return { version: 1, selected: ids(value.selected), recent: ids(value.recent).slice(0, 3) };
}

/** A selected team is promoted only on explicit choice, never during restoration. */
export function selectTeam(preferences, id) {
  return {
    version: 1,
    selected: [...new Set([...preferences.selected, id])],
    recent: [id, ...preferences.recent.filter((previous) => previous !== id)].slice(0, 3),
  };
}

/** One shortcut per team: retain selected teams even outside the last three choices. */
export function shortcutTeamIds(preferences) {
  return [...new Set([...preferences.recent, ...preferences.selected])];
}

export function toggleTeam(preferences, id) {
  return preferences.selected.includes(id)
    ? { ...preferences, selected: preferences.selected.filter((selected) => selected !== id) }
    : selectTeam(preferences, id);
}

export function readPreferences(storage, teams, division) {
  try {
    return normalizePreferences(JSON.parse(storage.getItem(preferencesKey(division))), teams);
  } catch {
    return emptyPreferences();
  }
}

/** Return storage availability so the UI can describe persistence honestly. */
export function savePreferences(storage, preferences, division) {
  try {
    storage.setItem(preferencesKey(division), JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}
