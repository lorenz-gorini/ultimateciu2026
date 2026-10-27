import { canonicalReportTeam, inReportWindow, parseCsv, parseReportIdentity,
  readReportRanges, reportContext, REPORT_INTERVAL } from "./reports.js";

const RANGES = [
  ["Foglio di gara (LIVE)", "C4:C7"],
  ["Roster squadra A (LIVE)", "B2:B3"],
  ["Roster squadra A (LIVE)", "G2:J100", "1"],
  ["Roster squadra B (LIVE)", "B2:B3"],
  ["Roster squadra B (LIVE)", "G2:J100", "1"],
  ["Statistiche (LIVE)", "A1:G100", "1"],
];

function require(condition, message) {
  if (!condition) throw new Error(message);
}

const nameText = (text) => text?.trim() ? text : null;
const key = (surname, givenName) => JSON.stringify([nameText(surname), nameText(givenName)]);
const label = (text) => text.replace(/\s+/g, " ").trim();

function count(text) {
  if (!text) return null;
  require(/^\d+$/.test(text) && Number.isSafeInteger(+text), "Statistiche partita: valore non intero o negativo");
  return +text;
}

/** Match-specific roster and statistics, joined by exact team/name keys only. */
export function parseMatchPlayers(csvs, match, teams, aliases = {}) {
  require(csvs.length === RANGES.length, "Fogli del report incompleti");
  const identity = parseReportIdentity(csvs[0], match, teams, aliases);
  const rosters = [0, 1].map((side) => {
    const metadata = parseCsv(csvs[1 + 2 * side]);
    const teamId = identity.teamIds[side];
    const name = teams.find((team) => team.id === teamId).name;
    require(metadata.length === 2 && metadata.every((row) => row.length === 1)
      && metadata[0][0] === "ROSTER" && canonicalReportTeam(metadata[1][0], aliases) === name,
    "Roster: squadra diversa da quella della partita");
    const rows = parseCsv(csvs[2 + 2 * side]);
    require(rows.every((row) => row.length === 4)
      && rows[0].map(label).join("|") === "N° divisa|Presenza alla partita|Cognome|Nome",
    "Colonne del roster cambiate");
    const seen = new Set();
    const players = rows.slice(1).filter((row) => row.some(Boolean)).map((row) => {
      require(row[1] === "" || row[1] === "X", "Roster: indicatore di presenza sconosciuto");
      const identity = key(row[2], row[3]);
      require(!seen.has(identity), "Roster: nomi duplicati, associazione statistiche ambigua");
      seen.add(identity);
      return { surname: nameText(row[2]), givenName: nameText(row[3]), number: row[0] || null,
        present: row[1] === "X" ? true : null, assists: null, goals: null, total: null, hasStats: false, mvp: false };
    });
    return { teamId, players };
  });
  const rows = parseCsv(csvs[5]);
  require(rows.every((row) => row.length === 7)
    && rows[0].slice(0, 6).map(label).join("|") === "SQUADRA|COGNOME|NOME|tot. assist|tot. mete|TOTALE"
    && ["", "MVP"].includes(label(rows[0][6]).toUpperCase()),
  "Colonne delle statistiche partita cambiate");
  const seen = new Set();
  for (const row of rows.slice(1).filter((row) => row.some(Boolean))) {
    const teamName = canonicalReportTeam(row[0], aliases);
    const roster = rosters.find((roster) => teams.find((team) => team.id === roster.teamId).name === teamName);
    require(roster, "Statistiche partita: squadra diversa dal report");
    const identity = key(row[1], row[2]);
    const player = roster.players.find((player) => key(player.surname, player.givenName) === identity);
    require(player, "Statistiche partita: giocatore non associabile al roster");
    const compound = `${roster.teamId}:${identity}`;
    require(!seen.has(compound), "Statistiche partita duplicate per lo stesso giocatore");
    seen.add(compound);
    const [assists, goals, total] = row.slice(3, 6).map(count);
    const marker = row[6].trim().toLowerCase();
    require(marker === "" || marker === "mvp", "Contrassegno MVP non riconosciuto nel report");
    require([assists, goals, total].some((value) => value === null) || total === assists + goals,
      "Statistiche partita: totale diverso da assist + mete");
    Object.assign(player, { assists, goals, total, mvp: marker === "mvp",
      hasStats: [assists, goals, total].some((value) => value !== null) });
  }
  return { rosters };
}

/** Fetch safe public columns only: no membership IDs, birth dates or registration status. */
export async function requestMatchPlayers(match, teams, previous = null,
  { fetcher = fetch, clock = Date.now, aliases = {} } = {}) {
  const context = reportContext(match, teams, aliases);
  const attemptedAt = clock();
  if (previous?.context !== context) previous = null;
  try {
    const csvs = await readReportRanges(match.reportUrl, RANGES, { fetcher, now: attemptedAt });
    return { data: parseMatchPlayers(csvs, match, teams, aliases), checkedAt: clock(), attemptedAt, context, error: null };
  } catch (error) {
    return { data: previous?.data || null, checkedAt: previous?.checkedAt || null, attemptedAt, context,
      error: error instanceof Error ? error.message : "Roster e statistiche non raggiungibili" };
  }
}

/** Called only for an open detail: one initial read; automatic repeats within ±2 hours. */
export function shouldCheckMatchPlayers(match, entry, scoreEntry, now = new Date(), force = false) {
  if (!match.reportUrl) return false;
  if (force || !entry) return true;
  return match.resultState !== "complete" && !scoreEntry?.report?.end && inReportWindow(match, now)
    && +now - entry.attemptedAt >= REPORT_INTERVAL;
}
