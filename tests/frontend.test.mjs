import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  filterMatches,
  evaluationFormOptions,
  formatDate,
  matchState,
  normalizeSearch,
  publicationIsStale,
  requestData,
  romeNow,
  sortPlayersByTotal,
  validateData,
} from "../src/data.js";
import { PREFERENCES_KEY, normalizePreferences, readPreferences, savePreferences, selectTeam, shortcutTeamIds, toggleTeam } from "../src/preferences.js";
import { DIVISIONS, DIVISION_KEY, cacheKey, initialDivision } from "../src/divisions.js";
import { parseCsv, parseReport, reportView, requestReport, shouldCheckReport, inReportWindow, REPORT_INTERVAL } from "../src/reports.js";

const published = JSON.parse(readFileSync("public/data.json", "utf8"));
const publishedB = JSON.parse(readFileSync("public/data-mixed-b.json", "utf8"));
// SYNTHETIC in-memory baseline: future live scores must not break missing-result tests.
// No synthetic values are written to public/ or to a deployment artifact.
const data = structuredClone(published);
data.fetchedAt = "2026-10-13T00:00:00Z";
for (const match of data.matches) {
  match.score = { a: null, b: null };
  match.resultState = "none";
}
for (const evaluation of data.sotg) {
  evaluation.categories = [null, null, null, null, null];
  evaluation.total = null;
  evaluation.comment = null;
}
const now = new Date("2026-10-13T10:00:00Z");
const first = {
  ...data.matches.find((match) => match.id === "X_1"),
  date: "2026-10-25",
  start: "09:00",
  end: "10:20",
};
const clone = () => structuredClone(data);

// SYNTHETIC score reports only; no real player data and no writes to public/.
const reportMatch = { ...first, a: { teamId: "a" }, b: { teamId: "b" },
  reportUrl: "https://docs.google.com/spreadsheets/d/SYNTHETIC/edit?gid=999#gid=999" };
const reportTeams = [{ id: "a", name: "Team A" }, { id: "b", name: "Team B" }];
const csv = (rows) => rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
const reportMetadata = csv([["FOGLIO DI GARA"], ["CAMPIONATI ITALIANI ULTIMATE MIXED"], ["Team A vs. Team B"], ["25 ottobre 2026"]]);
function reportScores(end = "", final = "2 - 1") {
  return csv([["assist", "meta", "parziale"], ["", "", "1 - 0"], ["", "", "1 - 1"], ["", "", "2 - 1"],
    ["orario inizio:     09 : 03", "punteggio half-time:", ""],
    [`orario fine:     ${end || " : "}`, "risultato finale:", final]]);
}
const liveTime = new Date("2026-10-25T08:10:00Z");
const liveEntry = () => ({ report: parseReport(reportMetadata, reportScores(), reportMatch, reportTeams),
  checkedAt: +liveTime, attemptedAt: +liveTime, error: null, url: reportMatch.reportUrl });

test("SYNTHETIC report distinguishes live, ended, stale and authoritative final results", () => {
  const entry = liveEntry();
  assert.deepEqual(reportView(reportMatch, entry, liveTime), { score: { a: 2, b: 1 }, state: "live" });
  assert.equal(reportView(reportMatch, entry, new Date(+liveTime + 126000)).state, "report-stale");
  assert.equal(reportView(reportMatch, entry, new Date("2026-10-26T08:00:00Z")).state, "report-stale");
  assert.equal(reportView(reportMatch, { ...entry, error: "offline" }, liveTime).state, "report-stale");
  entry.report.end = "10:15";
  assert.equal(reportView(reportMatch, entry, new Date(+liveTime + 600000)).state, "provisional");
  const final = { ...reportMatch, score: { a: 0, b: 15 }, resultState: "complete" };
  assert.deepEqual(reportView(final, entry, liveTime), { score: final.score, state: "complete" });
  assert.equal(reportMatch.resultState, "none");
});

test("SYNTHETIC report validates date, exact identity, reversed sides and score progression", () => {
  const reversed = reportMetadata.replace("Team A vs. Team B", "Team B vs. Team A");
  assert.deepEqual(parseReport(reversed, reportScores("10 : 15"), reportMatch, reportTeams).score, { a: 1, b: 2 });
  for (const metadata of [reportMetadata.replace("25 ottobre", "26 ottobre"),
    reportMetadata.replace("Team A vs.", "Different vs."), reportMetadata.replace("ottobre", "unknown"),
    reportMetadata.replace("25 ottobre", "32 ottobre")]) {
    assert.throws(() => parseReport(metadata, reportScores(), reportMatch, reportTeams));
  }
  for (const body of [reportScores().replace('"1 - 1"', '"0 - 1"'), reportScores("", "3 - 1"),
    reportScores().replace("09 : 03", " : "), reportScores().replace("09 : 03", "29 : 03"),
    reportScores().replace("parziale", "changed")]) {
    assert.throws(() => parseReport(reportMetadata, body, reportMatch, reportTeams));
  }
});

test("SYNTHETIC reports keep explicit zero scores and do not invent a score for blank reports", () => {
  const body = (value) => csv([["assist", "meta", "parziale"],
    ["orario inizio: 09 : 03", "punteggio half-time:", ""], ["orario fine: :", "risultato finale:", value]]);
  assert.deepEqual(parseReport(reportMetadata, body("0 - 0"), reportMatch, reportTeams).score, { a: 0, b: 0 });
  assert.equal(parseReport(reportMetadata, body(""), reportMatch, reportTeams).score, null);
  const upcoming = body("").replace("09 : 03", "").replace("orario fine: :", "orario fine:");
  assert.deepEqual(parseReport(reportMetadata, upcoming, reportMatch, reportTeams),
    { score: null, start: null, end: null, date: reportMatch.date });
});

test("CSV parsing handles escaped quotes/newlines and rejects malformed or oversized responses", () => {
  assert.deepEqual(parseCsv(csv([['a, b', 'a"b', 'a\nb']])), [['a, b', 'a"b', 'a\nb']]);
  for (const body of ['"unfinished', '"x"extra', '<html>login</html>', 'x'.repeat(131073)]) {
    if (body.startsWith("<")) assert.throws(() => parseReport(body, reportScores(), reportMatch, reportTeams));
    else assert.throws(() => parseCsv(body));
  }
});

test("report polling uses 60 seconds only within ±2 hours, with an explicit manual exception", () => {
  const entry = liveEntry();
  assert.equal(REPORT_INTERVAL, 60000);
  assert.equal(shouldCheckReport(reportMatch, null, liveTime), true);
  assert.equal(shouldCheckReport(reportMatch, entry, new Date(+liveTime + 59999)), false);
  assert.equal(shouldCheckReport(reportMatch, entry, new Date(+liveTime + 60000)), true);
  assert.equal(shouldCheckReport(reportMatch, entry, liveTime, true), true);
  assert.equal(shouldCheckReport({ ...reportMatch, start: "16:00" }, null, liveTime), false);
  assert.equal(shouldCheckReport(reportMatch, null, new Date("2026-10-26T08:00:00Z")), false);
  assert.equal(shouldCheckReport(reportMatch, null, new Date("2026-10-26T08:00:00Z"), true), true);
  assert.equal(shouldCheckReport({ ...reportMatch, resultState: "complete" }, entry, new Date(+liveTime + 60000)), false);
  assert.equal(shouldCheckReport(reportMatch, { ...entry, report: { ...entry.report, end: "10:20" } },
    new Date(+liveTime + 60000)), false);
});

test("±2-hour window respects exact boundaries, Rome midnight and winter/summer time", () => {
  for (const [date, instant] of [["2026-10-25", "2026-10-25T08:00:00Z"],
    ["2026-10-24", "2026-10-24T07:00:00Z"]]) {
    const match = { ...reportMatch, date, start: "09:00" };
    const middle = Date.parse(instant);
    for (const delta of [-120, -60, 0, 60, 120])
      assert.equal(inReportWindow(match, new Date(middle + delta * 60000)), true);
    for (const delta of [-120 * 60000 - 1, 120 * 60000 + 1])
      assert.equal(inReportWindow(match, new Date(middle + delta)), false);
  }
  assert.equal(inReportWindow({ ...reportMatch, date: "2026-10-27", start: "00:30" },
    new Date("2026-10-26T22:00:00Z")), true);
  assert.equal(inReportWindow({ ...reportMatch, start: null }, liveTime), false);
  const outside = new Date("2026-10-25T12:00:00Z");
  assert.equal(shouldCheckReport(reportMatch, { ...liveEntry(), error: "offline" }, outside), false);
  assert.equal(reportView(reportMatch, { ...liveEntry(), checkedAt: +outside }, outside).state, "report-stale");
  const midnight = new Date("2026-10-26T23:10:00Z");
  const nightMatch = { ...reportMatch, date: "2026-10-26", start: "23:30" };
  const nightReport = { ...liveEntry(), checkedAt: +midnight,
    report: { ...liveEntry().report, date: "2026-10-26", start: "23:35" } };
  assert.equal(reportView(nightMatch, nightReport, midnight).state, "live");
});

test("report download requests LIVE by name without credentials and preserves data on failure", async () => {
  let calls = 0;
  const fetcher = async (url, options) => {
    const params = new URL(url).searchParams;
    assert.equal(params.get("sheet"), "Foglio di gara (LIVE)");
    assert.equal(params.get("gid"), null);
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    calls++;
    return new Response(params.get("range") === "C4:C7" ? reportMetadata : reportScores(),
      { headers: { "content-type": "text/csv" } });
  };
  const times = [+liveTime, +liveTime + 1000];
  const loaded = await requestReport(reportMatch, reportTeams, null, { fetcher, clock: () => times.shift() });
  assert.equal(calls, 2);
  assert.equal(loaded.error, null);
  assert.equal(loaded.attemptedAt, +liveTime);
  assert.equal(loaded.checkedAt, +liveTime + 1000);
  const failed = await requestReport(reportMatch, reportTeams, loaded,
    { fetcher: async () => { throw new Error("offline"); }, clock: () => +liveTime + 60000 });
  assert.equal(failed.report, loaded.report);
  assert.equal(failed.checkedAt, loaded.checkedAt);
  assert.equal(failed.error, "offline");
  const postponed = await requestReport({ ...reportMatch, date: "2026-11-07" }, reportTeams, loaded,
    { fetcher: async () => { throw new Error("offline"); } });
  assert.equal(postponed.report, null);
  for (const response of [new Response("denied", { status: 403 }),
    new Response("<html>login</html>", { headers: { "content-type": "text/html" } })]) {
    assert.ok((await requestReport(reportMatch, reportTeams, null, { fetcher: async () => response })).error);
  }
  let contacted = false;
  assert.ok((await requestReport({ ...reportMatch, reportUrl: "https://evil.test/report" }, reportTeams,
    null, { fetcher: async () => { contacted = true; } })).error);
  assert.equal(contacted, false);
});

test("only explicitly approved division aliases reconcile report spellings", () => {
  const metadata = reportMetadata.replace("Team B", "360 Mlano");
  const teams = [reportTeams[0], { id: "b", name: "360 Milano" }];
  assert.throws(() => parseReport(metadata, reportScores(), reportMatch, teams));
  assert.deepEqual(parseReport(metadata, reportScores(), reportMatch, teams,
    DIVISIONS["mixed-a"].reportTeamAliases).score, { a: 2, b: 1 });
  assert.throws(() => parseReport(metadata.replace("360 Mlano", "360 Milno"), reportScores(), reportMatch, teams,
    DIVISIONS["mixed-a"].reportTeamAliases));
});

test("SYNTHETIC live status filtering uses the overlay without changing the main dataset", () => {
  const entry = liveEntry();
  const sample = { ...data, teams: reportTeams, matches: [reportMatch] };
  const stateFor = (match, date) => reportView(match, entry, date).state;
  assert.deepEqual(filterMatches(sample, { status: "live" }, liveTime, stateFor), [reportMatch]);
  assert.deepEqual(filterMatches(sample, { status: "complete" }, liveTime, stateFor), []);
  assert.equal(sample.matches[0].resultState, "none");
  assert.deepEqual(sample.matches[0].score, { a: null, b: null });
});

test("published dataset validates without imposing frozen row counts", () => {
  assert.equal(validateData(published), published);
  assert.ok(published.teams.length > 0);
  assert.ok(published.matches.length > 0);
});

test("player totals sort descending without mutation, retaining source order at ties and missing last", () => {
  const players = [{ id: "missing", total: null }, { id: "zero", total: 0 },
    { id: "high", total: 8 }, { id: "tie-a", total: 3 }, { id: "tie-b", total: 3 }];
  const sorted = sortPlayersByTotal(players);
  assert.deepEqual(sorted.map((player) => player.id), ["high", "tie-a", "tie-b", "zero", "missing"]);
  assert.equal(players[0].id, "missing");
});

test("case and accent-insensitive search preserves canonical spelling", () => {
  assert.equal(normalizeSearch("MÌLÀNO"), "milano");
  for (const [query, id] of [
    ["bfd REDSHOT", "x1"],
    [data.teams.find((team) => team.id === "x6").name, "x6"],
  ]) {
    assert.deepEqual(
      filterMatches(data, { search: query }, now)
        .map((match) => match.id)
        .sort(),
      data.matches
        .filter((match) => [match.a.teamId, match.b.teamId].includes(id))
        .map((match) => match.id)
        .sort(),
    );
  }
  assert.equal(
    filterMatches(data, { search: "1X" }, now).every((match) =>
      [match.a.slot, match.b.slot].includes("1X"),
    ),
    true,
  );
});

test("combined filters, reset and empty states", () => {
  assert.equal(filterMatches(data, {}, now).length, data.matches.length);
  assert.equal(
    filterMatches(
      data,
      { date: "2026-10-25", phase: "first", status: "scheduled" },
      now,
    ).length,
    data.matches.filter(
      (match) =>
        match.date === "2026-10-25" &&
        match.phase === "first" &&
        matchState(match, now) === "scheduled",
    ).length,
  );
  assert.equal(filterMatches(data, { search: "not a team" }, now).length, 0);
});

test("SYNTHETIC zero, partial, past-unreported and unresolved schedules", () => {
  assert.equal(matchState(first, now), "scheduled");
  assert.equal(
    matchState(first, new Date("2026-10-25T10:00:00Z")),
    "unreported",
  );
  assert.equal(
    matchState(
      { ...first, score: { a: 0, b: 15 }, resultState: "complete" },
      now,
    ),
    "complete",
  );
  assert.equal(
    matchState(
      { ...first, score: { a: 0, b: null }, resultState: "partial" },
      now,
    ),
    "partial",
  );
  assert.equal(matchState({ ...first, date: null }, now), "unresolved");
});

test("Rome date and DST transition use local competition time", () => {
  assert.deepEqual(romeNow(new Date("2026-10-24T22:30:00Z")), {
    date: "2026-10-25",
    time: "00:30",
  });
  assert.deepEqual(romeNow(new Date("2026-10-25T08:00:00Z")), {
    date: "2026-10-25",
    time: "09:00",
  });
  assert.match(formatDate("2026-10-25"), /25 ottobre 2026/);
});

test("SYNTHETIC malformed shapes, impossible dates and joins are rejected", () => {
  for (const mutate of [
    (value) => {
      value.schemaVersion = 999;
    },
    (value) => {
      value.matches[0].date = "2026-02-30";
    },
    (value) => {
      value.matches[0].a.teamId = "missing";
    },
    (value) => {
      value.matches[0].score.a = -1;
    },
    (value) => {
      value.matches.push(value.matches[0]);
    },
  ]) {
    const value = clone();
    mutate(value);
    assert.throws(() => validateData(value));
  }
});

test("SYNTHETIC failed HTTP/network/invalid JSON/schema keeps the same last valid object", async () => {
  for (const fetcher of [
    async () => {
      throw new Error("offline");
    },
    async () => ({ ok: false, status: 503 }),
    async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("invalid JSON");
      },
    }),
    async () => ({ ok: true, json: async () => ({ schemaVersion: 9 }) }),
  ]) {
    const result = await requestData(
      "/ultimateciu2026/data.json",
      data,
      fetcher,
    );
    assert.equal(result.data, data);
    assert.ok(result.error);
  }
});

test("SYNTHETIC changed valid data appears, with no mutation of previous data", async () => {
  const next = clone();
  next.fetchedAt = "2026-11-23T10:00:00Z";
  next.matches.find((match) => match.id === "X_1").score = { a: 0, b: 15 };
  next.matches.find((match) => match.id === "X_1").resultState = "complete";
  let request;
  const result = await requestData(
    "/ultimateciu2026/data.json",
    data,
    async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => next };
    },
  );
  assert.equal(result.error, null);
  assert.equal(
    result.data.matches.find((match) => match.id === "X_1").score.a,
    0,
  );
  assert.equal(first.score.a, null);
  assert.match(request.url, /^\/ultimateciu2026\/data.json\?v=/);
  assert.equal(request.options.cache, "no-store");
});

test("SYNTHETIC older deployed snapshot cannot overwrite a newer browser copy", async () => {
  const older = clone();
  older.fetchedAt = "2026-01-01T00:00:00Z";
  const result = await requestData("/data.json", data, async () => ({
    ok: true,
    json: async () => older,
  }));
  assert.equal(result.data, data);
  assert.ok(result.error);
});

test("SYNTHETIC opposite SOTG directions and zero values remain distinct", () => {
  const next = clone();
  const evaluations = next.sotg.filter(
    (evaluation) => evaluation.matchId === "X_1",
  );
  evaluations.forEach((evaluation) => {
    evaluation.categories = [0, 0, 0, 0, 0];
    evaluation.total = 0;
  });
  assert.equal(validateData(next), next);
  assert.notEqual(
    evaluations[0].evaluatingTeamId,
    evaluations[1].evaluatingTeamId,
  );
  evaluations[1].evaluatingTeamId = evaluations[0].evaluatingTeamId;
  assert.throws(() => validateData(next));
});

test("multi-team selection uses OR without duplicates and secondary filters use AND", () => {
  for (const teamIds of [[], ["x1"], ["x1", "x5"], ["x1", "x5", "y1"]]) {
    const result = filterMatches(data, { teamIds }, now);
    const expected = data.matches.filter((match) => !teamIds.length ||
      [match.a.teamId, match.b.teamId].some((id) => teamIds.includes(id)));
    assert.deepEqual(new Set(result.map((match) => match.id)), new Set(expected.map((match) => match.id)));
    assert.equal(new Set(result.map((match) => match.id)).size, result.length);
    for (const secondary of [
      { date: "2026-10-25" }, { phase: "second" }, { status: "scheduled" },
      { date: "2026-10-25", phase: "first", status: "scheduled" },
    ]) {
      assert.deepEqual(
        filterMatches(data, { teamIds, ...secondary }, now),
        filterMatches({ ...data, matches: expected }, secondary, now),
      );
    }
  }
  assert.equal(filterMatches(data, { teamIds: ["x1", "x5"] }, now).filter((match) => match.id === "X_1").length, 1);
  assert.deepEqual(filterMatches(data, { teamIds: ["x1"], search: "does not match" }, now), filterMatches(data, { teamIds: ["x1"] }, now));
  const accented = clone();
  accented.teams.find((team) => team.id === "x1").name = "BFD Rédshot";
  assert.equal(filterMatches(accented, { search: "bfd REDSHOT" }, now).length, 5);
});

test("SYNTHETIC preferences reconcile IDs, version, duplicates, removals and renamed teams", () => {
  const value = { version: 1, selected: ["x1", "x1", "missing"], recent: ["x5", "x1", "y1", "x2", "x5"] };
  const normalized = normalizePreferences(value, data.teams);
  assert.deepEqual(normalized, { version: 1, selected: ["x1"], recent: ["x5", "x1", "y1"] });
  const renamed = data.teams.map((team) => ({ ...team, name: "SYNTHETIC renamed" }));
  assert.deepEqual(normalizePreferences(normalized, renamed), normalized);
  assert.deepEqual(normalizePreferences(normalized, data.teams.filter((team) => team.id !== "x1")).selected, []);
  for (const malformed of [null, [], { version: 2, selected: [], recent: [] }, { version: 1, selected: "x1", recent: [] }, { version: 1, selected: [1], recent: [] }]) {
    assert.deepEqual(normalizePreferences(malformed, data.teams), { version: 1, selected: [], recent: [] });
  }
});

test("SYNTHETIC recent choices promote explicitly, cap at three, and reset independently", () => {
  let preferences = { version: 1, selected: [], recent: [] };
  for (const id of ["x1", "x5", "y1", "x2", "x5"]) preferences = selectTeam(preferences, id);
  assert.deepEqual(preferences.recent, ["x5", "x2", "y1"]);
  assert.deepEqual(preferences.selected, ["x1", "x5", "y1", "x2"]);
  assert.deepEqual(normalizePreferences(preferences, data.teams), preferences); // restoration doesn't promote
  const reset = { ...preferences, selected: [] };
  assert.deepEqual(normalizePreferences(reset, data.teams).recent, preferences.recent);
  const cleared = { ...preferences, recent: [] };
  assert.deepEqual(normalizePreferences(cleared, data.teams).selected, preferences.selected);
});

test("one shortcut set toggles selection and keeps selected teams outside recent history", () => {
  let preferences = { version: 1, selected: ["x1", "x2", "x5", "y1"], recent: ["y1", "x5", "x2"] };
  assert.deepEqual(shortcutTeamIds(preferences), ["y1", "x5", "x2", "x1"]);
  preferences = toggleTeam(preferences, "x5");
  assert.deepEqual(preferences.selected, ["x1", "x2", "y1"]);
  assert.deepEqual(preferences.recent, ["y1", "x5", "x2"]);
  assert.equal(shortcutTeamIds(preferences).filter((id) => id === "x5").length, 1);
  preferences = toggleTeam(preferences, "x5");
  assert.ok(preferences.selected.includes("x5"));
  assert.deepEqual(preferences.recent, ["x5", "y1", "x2"]);
  assert.deepEqual(shortcutTeamIds({ ...preferences, recent: [] }), preferences.selected);
});

test("SYNTHETIC storage restores explicit empty selections and tolerates denied/full storage", () => {
  const values = new Map([["unrelated-key", "preserved"]]);
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const preferences = { version: 1, selected: ["x1"], recent: ["x1"] };
  assert.equal(savePreferences(storage, preferences), true);
  assert.deepEqual(readPreferences(storage, data.teams), preferences);
  savePreferences(storage, { ...preferences, selected: [] });
  assert.deepEqual(readPreferences(storage, data.teams), { ...preferences, selected: [] });
  assert.equal(values.get("unrelated-key"), "preserved");
  values.set(PREFERENCES_KEY, "bad JSON");
  assert.deepEqual(readPreferences(storage, data.teams).selected, []);
  const denied = { getItem: () => { throw Error("denied"); }, setItem: () => { throw Error("full"); } };
  assert.deepEqual(readPreferences(denied, data.teams).selected, []);
  assert.equal(savePreferences(denied, preferences), false);
  assert.deepEqual(selectTeam(readPreferences(denied, data.teams), "x1").selected, ["x1"]);
  assert.equal(savePreferences(undefined, preferences), false);
});

test("SYNTHETIC stale publication warning follows Rome match day and download age", () => {
  const synthetic = { ...data, fetchedAt: "2026-10-24T21:30:00Z", sourceReportedAt: "2026-01-01T00:00:00Z" };
  assert.equal(publicationIsStale(synthetic, new Date("2026-10-24T22:30:00Z")), false); // exactly 60min
  assert.equal(publicationIsStale(synthetic, new Date("2026-10-24T22:30:01Z")), true); // Rome Oct 25
  assert.equal(publicationIsStale(synthetic, new Date("2026-10-26T10:00:00Z")), false);
  assert.equal(publicationIsStale({ ...synthetic, fetchedAt: "2026-10-25T09:59:00Z" }, new Date("2026-10-25T10:00:00Z")), false);
  assert.equal(publicationIsStale(null, now), false);
});

test("SYNTHETIC form links keep both directions, deduplicate unresolved links and reject bad targets", () => {
  const next = clone();
  const url = (id, from, to) => `https://docs.google.com/forms/d/e/SYNTHETIC/viewform?entry.1623410474=${id}&entry.1084977692=${encodeURIComponent(from)}&entry.839559032=${encodeURIComponent(to)}`;
  for (const evaluation of next.sotg) {
    evaluation.formUrl = null;
    evaluation.formTeamsMatch = null;
  }
  const names = new Map(next.teams.map((team) => [team.id, team.name]));
  const first = next.sotg.filter((evaluation) => evaluation.matchId === "X_1");
  for (const evaluation of first) {
    evaluation.formUrl = url("X_1", names.get(evaluation.evaluatingTeamId), names.get(evaluation.evaluatedTeamId));
    evaluation.formTeamsMatch = true;
  }
  assert.equal(evaluationFormOptions(validateData(next), "X_1").length, 2);
  first[0].formUrl = url("X_1", "Wrong", "Teams");
  first[0].formTeamsMatch = false;
  assert.equal(evaluationFormOptions(validateData(next), "X_1")[0].warning, true);
  const final = next.sotg.filter((evaluation) => evaluation.matchId === "F1");
  for (const evaluation of final) evaluation.formUrl = url("F1", "", "");
  assert.equal(evaluationFormOptions(validateData(next), "F1").length, 1);
  assert.equal(evaluationFormOptions(next, "missing").length, 0);
  for (const target of ["javascript:alert(1)", "https://example.com/viewform", url("X_2", "", "")]) {
    const invalid = structuredClone(next);
    invalid.sotg[0].formUrl = target;
    assert.throws(() => validateData(invalid));
  }
  const legacy = clone();
  for (const evaluation of legacy.sotg) {
    delete evaluation.formUrl;
    delete evaluation.formTeamsMatch;
  }
  assert.equal(evaluationFormOptions(validateData(legacy), "X_1").length, 0);
});

test("both published division datasets validate with their own source and identity", () => {
  assert.equal(validateData(published, "mixed-a"), published);
  assert.equal(validateData(publishedB, "mixed-b"), publishedB);
  assert.throws(() => validateData(publishedB, "mixed-a"));
  assert.throws(() => validateData({...publishedB, sourceUrl: published.sourceUrl}));
  assert.throws(() => validateData({...publishedB, division: "unknown"}));
  const legacyA = structuredClone(published);
  delete legacyA.division;
  assert.equal(validateData(legacyA, "mixed-a"), legacyA);
  assert.throws(() => validateData(legacyA, "mixed-b"));
  assert.ok(publishedB.teams.some((team) => team.pool === "Z"));
  assert.equal(evaluationFormOptions(publishedB, "X_1").length, 2);
  for (const link of evaluationFormOptions(publishedB, "X_1")) {
    assert.equal(new URL(link.url).searchParams.get("entry.1017677778"), "Mixed Serie B");
  }
});

test("SYNTHETIC division choice uses explicit URLs before saved preferences and tolerates denied storage", () => {
  const saved = {getItem: () => "mixed-b"};
  assert.equal(initialDivision("", saved), "mixed-b");
  assert.equal(initialDivision("?division=mixed-a", saved), "mixed-a");
  assert.equal(initialDivision("?division=unknown", saved), "mixed-a");
  assert.equal(initialDivision("", {getItem: () => {throw new Error("blocked");}}), "mixed-a");
  assert.equal(initialDivision("", {getItem: () => "constructor"}), "mixed-a");
  assert.notEqual(cacheKey("mixed-a"), cacheKey("mixed-b"));
  assert.equal(cacheKey("mixed-a"), "ciu2026-data-v1");
  assert.ok(DIVISION_KEY);
  assert.equal(DIVISIONS["mixed-b"].dataFile, "data-mixed-b.json");
});

test("SYNTHETIC overlapping team IDs retain independent recent/selected teams per division", () => {
  const values = new Map();
  const storage = {getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value)};
  const chosenA = {version: 1, selected: ["x1"], recent: ["x1", "y1"]};
  const chosenB = {version: 1, selected: ["z1", "x3"], recent: ["x3", "z1"]};
  assert.ok(savePreferences(storage, chosenA, "mixed-a"));
  assert.deepEqual(readPreferences(storage, publishedB.teams, "mixed-b").selected, []);
  assert.ok(savePreferences(storage, chosenB, "mixed-b"));
  assert.deepEqual(readPreferences(storage, published.teams, "mixed-a"), chosenA);
  assert.deepEqual(readPreferences(storage, publishedB.teams, "mixed-b"), chosenB);
  assert.equal(values.get(PREFERENCES_KEY), JSON.stringify(chosenA));
});

test("SYNTHETIC cross-division refresh rejects wrong data and keeps only that division's prior snapshot", async () => {
  const rejected = await requestData("/data-mixed-b.json", publishedB,
    async () => ({ok: true, json: async () => published}), "mixed-b");
  assert.equal(rejected.data, publishedB);
  assert.ok(rejected.error);
  const olderB = {...publishedB, fetchedAt: "2000-01-01T00:00:00Z"};
  const accepted = await requestData("/data-mixed-b.json", null,
    async () => ({ok: true, json: async () => olderB}), "mixed-b");
  assert.equal(accepted.data, olderB);
  assert.equal(accepted.error, null);
  const failed = await requestData("/data-mixed-b.json", publishedB,
    async () => {throw new Error("synthetic network failure");}, "mixed-b");
  assert.equal(failed.data, publishedB);
});
