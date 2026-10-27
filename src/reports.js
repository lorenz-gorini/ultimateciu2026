import { matchState, romeNow } from "./data.js";

export const REPORT_INTERVAL = 60000;
export const REPORT_WINDOW = 2 * 60 * 60 * 1000;
const MAX_BYTES = 128 * 1024;
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function require(condition, message) {
  if (!condition) throw new Error(message);
}

/** Small bounded RFC 4180 reader. Never evaluate Google's JavaScript response. */
export function parseCsv(text) {
  require(typeof text === "string" && new TextEncoder().encode(text).length <= MAX_BYTES,
    "Report troppo grande");
  const rows = [];
  let row = [], field = "", quoted = false, closed = false;
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === "," || char === "\n") {
      row.push(field); field = ""; closed = false;
      require(row.length <= 10, "Colonne del report inattese");
      if (char === "\n") { rows.push(row); row = []; }
    } else if (char === '"') {
      require(!field && !closed, "CSV del report non valido"); quoted = true;
    } else {
      require(!closed, "CSV del report non valido"); field += char;
    }
  }
  require(!quoted, "CSV del report troncato");
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  require(rows.length > 0 && rows.length <= 200, "Righe del report inattese");
  return rows;
}

function reportDate(text) {
  const parts = text.trim().toLowerCase().match(/^(\d{1,2}) ([a-z]+) (\d{4})$/);
  require(parts && MONTHS.includes(parts[2]), "Data del report non riconosciuta");
  const iso = `${parts[3]}-${String(MONTHS.indexOf(parts[2]) + 1).padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  require(!Number.isNaN(Date.parse(iso)) && new Date(iso).toISOString().slice(0, 10) === iso,
    "Data del report non valida");
  return iso;
}

function reportTime(text, label) {
  // Empty future templates omit the colon between hours and minutes entirely.
  if (text.trim().toLowerCase() === `orario ${label}:`) return null;
  const parts = text.trim().match(new RegExp(`^orario ${label}:\\s*(\\d{1,2})?\\s*:\\s*(\\d{1,2})?\\s*$`, "i"));
  require(parts, `Orario ${label} del report non riconosciuto`);
  if (!parts[1] && !parts[2]) return null;
  require(parts[1] && parts[2] && +parts[1] < 24 && +parts[2] < 60,
    `Orario ${label} del report non valido`);
  return `${parts[1].padStart(2, "0")}:${parts[2].padStart(2, "0")}`;
}

function reportScore(text) {
  if (!text.trim()) return null;
  const parts = text.trim().match(/^(\d{1,3})\s*[-–]\s*(\d{1,3})$/);
  require(parts, "Punteggio del report non riconosciuto");
  return { a: +parts[1], b: +parts[2] };
}

export function canonicalReportTeam(name, aliases = {}) {
  return Object.hasOwn(aliases, name) ? aliases[name] : name;
}

/** Shared identity boundary for score and roster/statistic reads of the exact Q link. */
export function parseReportIdentity(metadataCsv, match, teams, aliases = {}) {
  const metadata = parseCsv(metadataCsv);
  require(metadata.length === 4 && metadata.every((row) => row.length === 1)
    && metadata[0][0] === "FOGLIO DI GARA"
    && metadata[1][0] === "CAMPIONATI ITALIANI ULTIMATE MIXED", "Intestazione del report cambiata");
  require(reportDate(metadata[3][0]) === match.date, "Il report indica una data diversa dalla partita");
  const names = metadata[2][0].split(" vs. ").map((name) => canonicalReportTeam(name, aliases));
  const expected = [match.a, match.b].map((side) => teams.find((team) => team.id === side.teamId)?.name);
  const direct = names.length === 2 && expected.every((name, index) => name && name === names[index]);
  const reversed = names.length === 2 && expected.every((name, index) => name && name === names[1 - index]);
  require(direct || reversed, "I nomi delle squadre nel report non coincidono con il calendario; parziale non applicato");
  return { date: match.date, teamIds: reversed ? [match.b.teamId, match.a.teamId] : [match.a.teamId, match.b.teamId] };
}

/** The exact column-Q link associates a report; names/date verify score orientation. */
export function parseReport(metadataCsv, scoresCsv, match, teams, aliases = {}) {
  const identity = parseReportIdentity(metadataCsv, match, teams, aliases);
  const reversed = identity.teamIds[0] === match.b.teamId;
  const rows = parseCsv(scoresCsv);
  require(rows.every((row) => row.length === 3)
    && rows[0].join("|") === "assist|meta|parziale", "Colonne delle mete cambiate");
  const starts = rows.filter((row) => /^orario inizio:/i.test(row[0]));
  const ends = rows.filter((row) => /^orario fine:/i.test(row[0]));
  require(starts.length === 1 && ends.length === 1 && ends[0][1] === "risultato finale:"
    && starts[0][1] === "punteggio half-time:", "Riepilogo del report cambiato");
  const start = reportTime(starts[0][0], "inizio");
  const end = reportTime(ends[0][0], "fine");
  require(!end || start, "Report con fine partita senza inizio");
  let previous = { a: 0, b: 0 }, hasGoals = false;
  const footer = rows.indexOf(starts[0]);
  require(rows.indexOf(ends[0]) > footer, "Ordine del riepilogo cambiato");
  for (const row of rows.slice(1, footer)) {
    const current = reportScore(row[2]);
    if (!current) continue;
    require((current.a === previous.a + 1 && current.b === previous.b)
      || (current.b === previous.b + 1 && current.a === previous.a), "Progressione delle mete incoerente");
    previous = current; hasGoals = true;
  }
  const final = reportScore(ends[0][2]);
  require(!final || (final.a === previous.a && final.b === previous.b), "Riepilogo e mete del report non coincidono");
  const score = hasGoals ? previous : final;
  require(!score || start, "Punteggio nel report senza orario di inizio");
  return { score: score && (reversed ? { a: score.b, b: score.a } : score), start, end, date: match.date };
}

/** Fetch only explicitly requested public ranges; never a whole roster workbook. */
export async function readReportRanges(reportUrl, ranges, { fetcher = fetch, now = Date.now() } = {}) {
  const url = new URL(reportUrl);
  require(url.origin === "https://docs.google.com"
    && /^\/spreadsheets\/d\/[A-Za-z0-9_-]+\/edit$/.test(url.pathname), "Link report non valido");
  // gid in the organizer's link can refer to the archived tab. Always request LIVE by name.
  const base = `${url.origin}${url.pathname.replace(/\/edit$/, "/gviz/tq")}`;
  const signal = AbortSignal.timeout(12000);
  return Promise.all(ranges.map(async ([sheet, range, headers = "0"]) => {
    const response = await fetcher(`${base}?${new URLSearchParams({
      tqx: "out:csv", sheet, range, headers, tq: "select *", v: String(now),
    })}`, { cache: "no-store", credentials: "omit", signal });
    require(response.ok, `Report HTTP ${response.status}`);
    require(/text\/csv/i.test(response.headers.get("content-type") || ""), "Report non disponibile come CSV pubblico");
    require(Number(response.headers.get("content-length") || 0) <= MAX_BYTES, "Report troppo grande");
    const text = await response.text();
    require(new TextEncoder().encode(text).length <= MAX_BYTES, "Report troppo grande");
    return text;
  }));
}

/** A postponed fixture or changed participants must not reuse an old report overlay. */
export function reportContext(match, teams, aliases = {}) {
  return JSON.stringify([match.reportUrl, match.date, aliases, ...[match.a, match.b].flatMap((side) =>
    [side.teamId, teams.find((team) => team.id === side.teamId)?.name])]);
}

/** Public read-only CORS requests, no credentials, cookies, API key or server. */
export async function requestReport(match, teams, previous = null, { fetcher = fetch, clock = Date.now, aliases = {} } = {}) {
  const attemptedAt = clock();
  const context = reportContext(match, teams, aliases);
  if (previous?.context !== context) previous = null;
  try {
    const responses = await readReportRanges(match.reportUrl,
      [["Foglio di gara (LIVE)", "C4:C7"], ["Foglio di gara (LIVE)", "E12:G200"]], { fetcher, now: attemptedAt });
    return { report: parseReport(...responses, match, teams, aliases), checkedAt: clock(), attemptedAt, error: null, url: match.reportUrl, context };
  } catch (error) {
    return { report: previous?.report || null, checkedAt: previous?.checkedAt || null, attemptedAt,
      error: error instanceof Error ? error.message : "Report non raggiungibile", url: match.reportUrl, context };
  }
}

/** Finished L–N values always win. Unverified/stale reports never get a LIVE label. */
export function reportView(match, entry, now = new Date()) {
  const official = { score: match.score, state: matchState(match, now) };
  if (match.resultState === "complete" || !entry?.report?.score) return official;
  const report = entry.report;
  const stale = entry.error || (!report.end && (!inReportWindow(match, now)
    || now.getTime() - entry.checkedAt > 2 * REPORT_INTERVAL + 5000));
  const local = romeNow(now);
  const started = `${report.date}T${report.start}` <= `${local.date}T${local.time}`;
  return { score: report.score, state: stale ? "report-stale" : report.end ? "provisional"
    : started ? "live" : "report-stale" };
}

/** Scheduled Europe/Rome start converted to an instant, including midnight/DST. */
export function inReportWindow(match, now = new Date()) {
  if (!match.date || !match.start) return false;
  const civil = Date.parse(`${match.date}T${match.start}:00Z`);
  if (!Number.isFinite(civil)) return false;
  let instant = civil;
  for (let step = 0; step < 2; step++) {
    const local = romeNow(new Date(instant));
    instant += civil - Date.parse(`${local.date}T${local.time}:00Z`);
  }
  const local = romeNow(new Date(instant));
  return local.date === match.date && local.time === match.start && Math.abs(+now - instant) <= REPORT_WINDOW;
}

/** Automatic reads only within ±2 hours; manual detail refresh is an explicit exception. */
export function shouldCheckReport(match, entry, now = new Date(), force = false) {
  if (!match.reportUrl) return false;
  if (entry && entry.url !== match.reportUrl) entry = null;
  if (force) return true;
  if (match.resultState === "complete" || entry?.report?.end || !inReportWindow(match, now)) return false;
  if (entry && now.getTime() - entry.attemptedAt < REPORT_INTERVAL) return false;
  return true;
}
