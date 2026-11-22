import { validateData } from "./data.js";
import { DEFAULT_DIVISION, DIVISIONS } from "./divisions.js";
import { canonicalReportTeam, parseCsv, readReportRanges } from "./reports.js";

const MATCH_ID = /^(?:[XYZP]_\d+|[QSF]\d+)$/;
const SECTIONS = new Set(["PRIMA FASE A GIRONI", "SECONDA FASE A GIRONI", "FASE FINALE"]);
const MARKERS = new Set(["", "report", "ereditata", "tavolino", "annullata"]);
const SEPARATORS = new Set(["", "-", "–", ":"]);

function require(condition, message) {
  if (!condition) throw new Error(message);
}

function scoreCell(value) {
  if (value === "") return null;
  require(/^\d+$/.test(value) && Number.isSafeInteger(Number(value)), "Punteggio del calendario non valido");
  return Number(value);
}

function indexCalendar(csv, division) {
  const fixtures = new Map();
  const sections = new Set();
  let hasUnidentifiedFixture = false;
  for (const row of parseCsv(csv)) {
    require(row.length === 9, "Colonne del calendario cambiate");
    const [id, aSlot, aName, aValue, separator, bValue, bName, bSlot, marker] = row;
    if (!id && row.slice(2).every((value) => value === "")
      && (SECTIONS.has(aSlot) || aSlot === "PARTITE" || !aSlot)) {
      sections.add(aSlot);
      continue;
    }
    require(SEPARATORS.has(separator), "Separatore del punteggio non riconosciuto");
    // Inherited rows can repeat a first-phase ID. They are not fixtures.
    if (marker === "ereditata") {
      require(division === "mixed-a" && (!id || /^[XY]_\d+$/.test(id)),
        "Risultato ereditato non valido");
      continue;
    }
    if (!MATCH_ID.test(id)) {
      hasUnidentifiedFixture = true;
      continue;
    }
    require(!fixtures.has(id), `Partita ripetuta nel calendario: ${id}`);
    fixtures.set(id, { aSlot, aName, bSlot, bName, marker, score: { a: scoreCell(aValue), b: scoreCell(bValue) } });
  }
  require(sections.has("PARTITE") && sections.has("PRIMA FASE A GIRONI")
    && sections.has("SECONDA FASE A GIRONI") && sections.has("FASE FINALE") === (division === "mixed-a")
    && fixtures.size > 0, "Intestazioni del calendario non riconosciute");
  return { fixtures, hasUnidentifiedFixture };
}

/** Overlay official fixture cells keyed by match ID. Snapshot times, standings and links retain their XLSX provenance. */
export function applyCalendar(data, csv) {
  const division = data.division ?? DEFAULT_DIVISION;
  const aliases = DIVISIONS[division].reportTeamAliases;
  const { fixtures, hasUnidentifiedFixture } = indexCalendar(csv, division);
  const teamIds = new Map(data.teams.map((team) => [team.name, team.id]));
  const resolveTeam = (name) => name === "" ? null : teamIds.get(canonicalReportTeam(name, aliases));
  const matchIds = new Set(data.matches.map((match) => match.id));
  // Check every source fixture before trusting a batch. A truncated CSV must not clear official scores.
  if (hasUnidentifiedFixture || data.matches.some((match) => !fixtures.has(match.id))) {
    return { data, changed: 0, requiresImport: true, error: "Nel foglio mancano partite o codici della copia pubblicata" };
  }

  const evaluations = new Map();
  for (const entry of data.sotg) {
    if (entry.evaluatingTeamId === null && entry.evaluatedTeamId === null) continue;
    if (!evaluations.has(entry.matchId)) evaluations.set(entry.matchId, new Set());
    evaluations.get(entry.matchId).add(entry.evaluatingTeamId);
    evaluations.get(entry.matchId).add(entry.evaluatedTeamId);
  }
  let requiresImport = [...fixtures.keys()].some((id) => !matchIds.has(id));
  let changed = 0;
  const officialSlots = new Map();
  const matches = data.matches.map((match) => {
    const official = fixtures.get(match.id);
    // An unfamiliar organizer note belongs to this fixture, not to every other game.
    if (!MARKERS.has(official.marker)) {
      requiresImport = true;
      return match;
    }
    const aTeam = resolveTeam(official.aName);
    const bTeam = resolveTeam(official.bName);
    const teams = new Set([aTeam, bTeam]);
    const sameSlots = official.aSlot === match.a.slot && official.bSlot === match.b.slot;
    if (match.phase === "first") {
      require(sameSlots && aTeam === match.a.teamId && bTeam === match.b.teamId,
        "Squadre iniziali del calendario diverse dalla copia pubblicata");
    }
    if (!sameSlots || teams.has(undefined) || (aTeam !== null && aTeam === bTeam)
      || [...(evaluations.get(match.id) || [])].some((teamId) => !teams.has(teamId))) {
      requiresImport = true;
      return match;
    }
    for (const [slot, teamId] of [[official.aSlot, aTeam], [official.bSlot, bTeam]]) {
      require(!officialSlots.has(slot) || officialSlots.get(slot) === teamId,
        `Squadra del calendario incoerente per il posto ${slot}`);
      officialSlots.set(slot, teamId);
    }
    const { marker, score } = official;
    const resultState = score.a === null && score.b === null ? "none"
      : score.a === null || score.b === null ? "partial" : "complete";
    const cancelled = marker === "annullata";
    const forfeit = marker === "tavolino";
    require((!cancelled || resultState === "none") && (!forfeit || resultState === "complete")
      && (resultState !== "complete" || (aTeam !== null && bTeam !== null)),
    `Risultato del calendario incoerente: ${match.id}`);

    const reportUrl = marker === "report" ? match.reportUrl : null;
    // GViz exports the label, not the hyperlink. The importer supplies any new URL.
    if (marker === "report" && !reportUrl) requiresImport = true;
    if (match.a.teamId === aTeam && match.b.teamId === bTeam && match.score.a === score.a
      && match.score.b === score.b && Boolean(match.cancelled) === cancelled
      && Boolean(match.forfeit) === forfeit && (match.reportUrl ?? null) === (reportUrl ?? null)) {
      return match;
    }
    changed++;
    const { cancelled: oldCancellation, forfeit: oldForfeit, ...publishedFields } = match;
    return { ...publishedFields, a: { slot: match.a.slot, teamId: aTeam },
      b: { slot: match.b.slot, teamId: bTeam }, score, resultState, reportUrl,
      ...(cancelled ? { cancelled: true } : {}), ...(forfeit ? { forfeit: true } : {}) };
  });
  return { data: changed ? validateData({ ...data, matches }, division) : data, changed, requiresImport, error: null };
}

/** Direct and read-only. On failure return the caller's last valid view. */
export async function requestCalendar(data, { fetcher = fetch, now = Date.now() } = {}) {
  const previous = { data, checkedAt: null, changed: 0, requiresImport: false, error: null };
  if (data?.sourceMode !== "live") return previous;
  try {
    const [csv] = await readReportRanges(data.sourceUrl, [["Partite", "I3:Q200"]], { fetcher, now });
    const result = applyCalendar(data, csv);
    return { ...result, checkedAt: result.error ? null : Number(now) };
  } catch (error) {
    return { ...previous, error: error instanceof Error ? error.message : "Calendario non raggiungibile" };
  }
}
