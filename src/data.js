import Ajv from "ajv";
import schema from "./data.schema.json" with { type: "json" };
import { DEFAULT_DIVISION, DIVISIONS } from "./divisions.js";

const checkShape = new Ajv({ allErrors: true, strict: true }).compile(schema);
export const PHASES = {
  first: "Prima fase",
  second: "Seconda fase",
  finals: "Fase finale",
};
export const STATES = {
  scheduled: "In programma",
  complete: "Risultato registrato",
  partial: "Risultato incompleto",
  unreported: "Risultato non disponibile",
  unresolved: "Programmazione da definire",
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** Shared schema checks shape; additional checks protect joins and status semantics. */
export function validateData(data, expectedDivision = null) {
  invariant(
    checkShape(data),
    `Formato dati non valido: ${checkShape.errors?.[0]?.instancePath || "/"} ${checkShape.errors?.[0]?.message || ""}`,
  );
  const division = data.division ?? DEFAULT_DIVISION;
  invariant(Object.hasOwn(DIVISIONS, division) && data.sourceUrl === DIVISIONS[division].sourceUrl,
    "Divisione e foglio sorgente non corrispondono");
  invariant(!expectedDivision || division === expectedDivision, "Dati di un’altra divisione");
  const teams = new Map(data.teams.map((team) => [team.id, team]));
  const matches = new Map(data.matches.map((match) => [match.id, match]));
  invariant(
    teams.size === data.teams.length && teams.size > 0,
    "Squadre duplicate o mancanti",
  );
  invariant(
    matches.size === data.matches.length && matches.size > 0,
    "Partite duplicate o mancanti",
  );
  for (const field of ["fetchedAt", "sourceReportedAt"]) {
    if (data[field] !== null)
      invariant(
        /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(data[field]) &&
          Number.isFinite(Date.parse(data[field])),
        "Timestamp non valido",
      );
  }
  const sides = data.matches
    .flatMap((match) => [match.a, match.b])
    .concat(
      data.pools.flatMap((pool) => pool.entries),
      data.phaseSlots,
      data.carryovers.flatMap((carry) => [carry.a, carry.b]),
    );
  for (const side of sides)
    invariant(
      side.teamId === null || teams.has(side.teamId),
      "Riferimento squadra sconosciuto",
    );
  for (const match of data.matches) {
    if (match.date !== null)
      invariant(
        new Date(`${match.date}T12:00:00Z`).toISOString().slice(0, 10) ===
          match.date,
        "Data partita non valida",
      );
    const values = Object.values(match.score);
    const expected = values.every((value) => value === null)
      ? "none"
      : values.every((value) => value !== null)
        ? "complete"
        : "partial";
    invariant(match.resultState === expected, "Stato risultato incoerente");
    invariant(
      expected !== "complete" ||
        (match.a.teamId !== null && match.b.teamId !== null),
      "Risultato senza squadre risolte",
    );
    invariant(
      match.a.teamId === null || match.a.teamId !== match.b.teamId,
      "Squadra contro se stessa",
    );
  }
  const directions = new Set();
  for (const evaluation of data.sotg) {
    const match = matches.get(evaluation.matchId);
    invariant(
      match && match.date === evaluation.date,
      "Partita/data SOTG sconosciuta",
    );
    const { evaluatingTeamId: from, evaluatedTeamId: to } = evaluation;
    if (evaluation.formUrl != null) {
      const parameters = new URL(evaluation.formUrl).searchParams;
      invariant(parameters.getAll("entry.1623410474").length === 1 &&
        parameters.get("entry.1623410474") === evaluation.matchId,
        "Link modulo riferito a una partita diversa");
      const expected = from === null || to === null ? null :
        parameters.getAll("entry.1084977692").length === 1 &&
        parameters.getAll("entry.839559032").length === 1 &&
        parameters.get("entry.1084977692") === teams.get(from)?.name &&
        parameters.get("entry.839559032") === teams.get(to)?.name;
      invariant(evaluation.formTeamsMatch === expected, "Verifica squadre del modulo incoerente");
    } else {
      invariant(evaluation.formTeamsMatch == null, "Verifica squadre senza modulo");
    }
    const populated = [
      ...evaluation.categories,
      evaluation.total,
      evaluation.comment,
    ].some((value) => value !== null);
    if (from !== null || to !== null || populated) {
      invariant(
        from !== null &&
          to !== null &&
          from !== to &&
          [match.a.teamId, match.b.teamId].includes(from) &&
          [match.a.teamId, match.b.teamId].includes(to),
        "Direzione SOTG non valida",
      );
      const key = `${evaluation.matchId}/${from}/${to}`;
      invariant(!directions.has(key), "Valutazione SOTG duplicata");
      directions.add(key);
    }
    if (
      evaluation.total !== null &&
      evaluation.categories.every((value) => value !== null)
    )
      invariant(
        evaluation.categories.reduce((sum, value) => sum + value, 0) ===
          evaluation.total,
        "Totale SOTG incoerente",
      );
  }
  invariant(
    data.players.every((player) => teams.has(player.teamId)),
    "Squadra giocatore sconosciuta",
  );
  invariant(
    data.finalClassification.every((entry) => teams.has(entry.teamId)),
    "Squadra classifica sconosciuta",
  );
  return data;
}

/** Deduplicate identical unresolved-team links; keep both evaluation directions. */
export function evaluationFormOptions(data, matchId) {
  const names = new Map(data.teams.map((team) => [team.id, team.name]));
  const options = new Map();
  for (const evaluation of data.sotg.filter((entry) => entry.matchId === matchId && entry.formUrl)) {
    const existing = options.get(evaluation.formUrl);
    const label = evaluation.evaluatingTeamId && evaluation.evaluatedTeamId
      ? `${names.get(evaluation.evaluatingTeamId)} → ${names.get(evaluation.evaluatedTeamId)}`
      : "Valuta";
    options.set(evaluation.formUrl, {
      url: evaluation.formUrl,
      label,
      warning: existing?.warning || evaluation.formTeamsMatch === false,
    });
  }
  return [...options.values()];
}

export function normalizeSearch(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it");
}

/** Compare local calendar/time strings in Rome, independent of browser timezone. */
export function romeNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function matchState(match, now = new Date()) {
  if (match.resultState !== "none") return match.resultState;
  if (!match.date || !match.start) return "unresolved";
  const local = romeNow(now);
  return match.date < local.date ||
    (match.date === local.date && (match.end || match.start) <= local.time)
    ? "unreported"
    : "scheduled";
}

export function formatDate(iso, short = false) {
  if (!iso) return "Data da definire";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC",
    weekday: short ? undefined : "long",
    day: "numeric",
    month: short ? "short" : "long",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00Z`));
}

export function filterMatches(data, filters, now = new Date()) {
  const names = new Map(data.teams.map((team) => [team.id, team.name]));
  const selected = new Set(filters.teamIds || []);
  const query = normalizeSearch(filters.search || "");
  return data.matches
    .filter(
      (match) =>
        (!filters.date || match.date === filters.date) &&
        (!filters.phase || match.phase === filters.phase) &&
        (!filters.status || matchState(match, now) === filters.status) &&
        [match.a, match.b].some((side) =>
          selected.size
            ? selected.has(side.teamId)
            : normalizeSearch(names.get(side.teamId) || side.slot).includes(query),
        ),
    )
    .sort((a, b) =>
      `${a.date || "9999"} ${a.start || "99:99"} ${a.id}`.localeCompare(
        `${b.date || "9999"} ${b.start || "99:99"} ${b.id}`,
        "it",
        { numeric: true },
      ),
    );
}

/** Download age on an actual Rome match day; sourceReportedAt is not fetch age. */
export function publicationIsStale(data, now = new Date()) {
  const today = romeNow(now).date;
  return Boolean(data &&
    now.getTime() - Date.parse(data.fetchedAt) > 60 * 60 * 1000 &&
    data.matches.some((match) => match.date === today));
}

/** On failure the caller's last validated object remains available unchanged. */
export async function requestData(url, previous, fetcher = fetch, division = DEFAULT_DIVISION) {
  try {
    const response = await fetcher(`${url}?v=${Date.now()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    invariant(response.ok, `HTTP ${response.status}`);
    const data = validateData(await response.json(), division);
    invariant(
      !previous || Date.parse(data.fetchedAt) >= Date.parse(previous.fetchedAt),
      "La copia pubblicata è precedente ai dati conservati",
    );
    return { data, error: null };
  } catch (error) {
    return {
      data: previous,
      error: error instanceof Error ? error.message : "Errore di rete",
    };
  }
}
