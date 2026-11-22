import assert from "node:assert/strict";
import test from "node:test";
import { applyCalendar, requestCalendar } from "../src/calendar-refresh.js";
import { DIVISIONS } from "../src/divisions.js";
import { reportView } from "../src/reports.js";

// SYNTHETIC calendars. No live workbook or deployment asset is modified.
const rowsAsCsv = (rows) => rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
const reportUrl = "https://docs.google.com/spreadsheets/d/SYNTHETIC_report/edit";
const provenance = { sheet: "Partite", range: "B5:U5" };
const now = Date.parse("2026-11-22T14:30:00Z");
const buildMatch = (id, phase, a, b, fields = {}) => ({
  id, phase, pool: null, stage: 1, city: "Milano", date: "2026-11-22",
  start: "09:00", end: "10:20", field: "1", a, b, score: { a: null, b: null },
  resultState: "none", reportUrl, provenance, ...fields,
});
const side = (slot, teamId = null) => ({ slot, teamId });
const buildTeam = (slot, name) => ({
  id: slot.toLowerCase(), name, slot, pool: slot[0], seed: Number(slot[1]),
  affiliation: "SYNTHETIC", province: "SYNTHETIC", provenance,
});
const buildData = (division = "mixed-a") => {
  const isA = division === "mixed-a";
  return {
    schemaVersion: 1, division, sourceUrl: DIVISIONS[division].sourceUrl, sourceMode: "live",
    sourceReportedAt: null, fetchedAt: "2026-11-21T00:00:00Z", workbookSha256: "a".repeat(64),
    teams: isA
      ? [buildTeam("X1", "360 Milano"), buildTeam("X2", "Team Two")]
      : [buildTeam("Z1", "Team Three"), buildTeam("Z2", "Team Four")],
    matches: isA
      ? [buildMatch("X_1", "first", side("X1", "x1"), side("X2", "x2")),
        buildMatch("F1", "finals", side("1P"), side("2P"))]
      : [buildMatch("Z_1", "first", side("Z1", "z1"), side("Z2", "z2")),
        buildMatch("P_1", "second", side("1Z"), side("1X"))],
    phaseSlots: [], carryovers: [], pools: [], finalClassification: [], rules: [], sotg: [], players: [],
    sotgCategories: ["A", "B", "C", "D", "E"],
    availability: { sotg: false, teamPlayers: false, matchPlayers: false, roster: false, sotgSummary: false },
  };
};
const header = (label) => ["", label, "", "", "", "", "", "", ""];
const withSections = (division, rows) => rowsAsCsv([
  header("PRIMA FASE A GIRONI"), header("PARTITE"), header("SECONDA FASE A GIRONI"),
  ...(division === "mixed-a" ? [header("FASE FINALE")] : []), ...rows,
]);
const rowA = (a = "0", b = "15") => ["X_1", "X1", "360 Mlano", a, "-", b, "Team Two", "X2", "report"];
const rowAFinal = (marker = "report") => ["F1", "1P", "Team Two", "", "", "", "360 Milano", "2P", marker];
const rowB = ["Z_1", "Z1", "Team Three", "9", "–", "9", "Team Four", "Z2", "report"];
const rowBSecond = ["P_1", "1Z", "Team Four", "", "", "", "Team Three", "1X", "annullata"];
const csvResponse = (text) => new Response(text, { headers: { "Content-Type": "text/csv" } });

test("Serie A accepts reordered rows, a known alias, official zero and freshly resolved participants", () => {
  const published = buildData();
  const inherited = ["X_1", "1X", "360 Milano", "0", "-", "15", "Team Two", "2X", "ereditata"];
  const csv = withSections("mixed-a", [rowAFinal(), inherited, rowA()]);
  const { data, changed, requiresImport } = applyCalendar(published, csv);
  assert.equal(changed, 2);
  assert.equal(requiresImport, false);
  assert.deepEqual(data.matches.map((match) => match.id), ["X_1", "F1"]);
  assert.deepEqual(data.matches[0].score, { a: 0, b: 15 });
  assert.equal(data.matches[0].resultState, "complete");
  assert.equal(data.matches[1].a.teamId, "x2");
  assert.equal(data.matches[1].b.teamId, "x1");
  assert.equal(data.matches[1].resultState, "none");
  assert.equal(data.matches[0].reportUrl, reportUrl);
  assert.equal(data.matches[0].provenance, published.matches[0].provenance);
  assert.equal(data.fetchedAt, published.fetchedAt);
  assert.equal(data.workbookSha256, published.workbookSha256);
  assert.equal(data.sotg, published.sotg);
  assert.equal(data.pools, published.pools);
  assert.equal(published.matches[0].score.a, null);
  assert.equal(applyCalendar(data, csv).data, data);
});

test("Serie B accepts a tied final and uses the cancellation marker without an old report", () => {
  const { data, changed } = applyCalendar(buildData("mixed-b"), withSections("mixed-b", [rowBSecond, rowB]));
  assert.equal(changed, 2);
  assert.deepEqual(data.matches[0].score, { a: 9, b: 9 });
  assert.equal(data.matches[0].resultState, "complete");
  assert.equal(data.matches[1].cancelled, true);
  assert.equal(data.matches[1].reportUrl, null);
  assert.deepEqual(data.matches[1].score, { a: null, b: null });
  assert.equal(data.matches[1].resultState, "none");
});

test("source corrections replace older final values and one-sided results stay partial", () => {
  const published = buildData();
  const first = applyCalendar(published, withSections("mixed-a", [rowA(), rowAFinal()]));
  const corrected = applyCalendar(first.data, withSections("mixed-a", [rowA("10", "11"), rowAFinal()]));
  assert.deepEqual(corrected.data.matches[0].score, { a: 10, b: 11 });
  const provisional = { report: { score: { a: 7, b: 8 }, end: "12:00" } };
  assert.deepEqual(reportView(corrected.data.matches[0], provisional, new Date(now)),
    { score: { a: 10, b: 11 }, state: "complete" });
  const partial = applyCalendar(corrected.data, withSections("mixed-a", [rowA("0", ""), rowAFinal()]));
  assert.deepEqual(partial.data.matches[0].score, { a: 0, b: null });
  assert.equal(partial.data.matches[0].resultState, "partial");
});

test("a missing or removed fixture ID retains the original view and requests a full import", () => {
  const published = buildData();
  for (const rows of [[rowA()], [rowA(), ["", ...rowAFinal().slice(1)]]]) {
    const missing = applyCalendar(published, withSections("mixed-a", rows));
    assert.equal(missing.data, published);
    assert.equal(missing.requiresImport, true);
    assert.ok(missing.error);
  }
  const newFixture = ["F2", "3P", "", "", "", "", "", "4P", ""];
  const added = applyCalendar(published, withSections("mixed-a", [rowA(), rowAFinal(), newFixture]));
  assert.equal(added.requiresImport, true);
  assert.equal(added.changed, 2);
  assert.equal(added.data.matches.length, 2);
});

test("a changed slot or unknown qualifier does not replace the published fixture", () => {
  const published = buildData();
  for (const replacement of [
    ["F1", "2P", "360 Milano", "15", "-", "0", "Team Two", "1P", "report"],
    ["F1", "1P", "Unknown Team", "15", "-", "0", "360 Milano", "2P", "report"],
  ]) {
    const result = applyCalendar(published, withSections("mixed-a", [rowA(), replacement]));
    assert.equal(result.requiresImport, true);
    assert.equal(result.changed, 1);
    assert.equal(result.data.matches[1], published.matches[1]);
  }
});

test("invalid, empty and cross-division reads retain the last verified view", async () => {
  const published = buildData();
  const wrongIdentity = ["X_1", "X1", "Team Two", "0", "-", "15", "360 Milano", "X2", "report"];
  for (const text of [
    "", withSections("mixed-b", [rowB, rowBSecond]),
    withSections("mixed-a", [rowA(), rowA(), rowAFinal()]),
    withSections("mixed-a", [rowA("3.5"), rowAFinal()]),
    withSections("mixed-a", [wrongIdentity, rowAFinal()]),
    withSections("mixed-a", [rowA(), rowAFinal().slice(0, 8)]),
  ]) {
    const result = await requestCalendar(published, { fetcher: async () => csvResponse(text), now });
    assert.equal(result.data, published);
    assert.equal(result.changed, 0);
    assert.equal(result.checkedAt, null);
    assert.ok(result.error);
  }
});

test("an unfamiliar status in one fixture leaves other official results available", () => {
  const published = buildData();
  const result = applyCalendar(published, withSections("mixed-a", [rowA(), rowAFinal("nuova dicitura")]));
  assert.equal(result.requiresImport, true);
  assert.deepEqual(result.data.matches[0].score, { a: 0, b: 15 });
  assert.equal(result.data.matches[1], published.matches[1]);
});

test("a report label without a published URL requests import and never fabricates a link", () => {
  const published = buildData();
  published.matches[1].reportUrl = null;
  const result = applyCalendar(published, withSections("mixed-a", [rowA(), rowAFinal()]));
  assert.equal(result.requiresImport, true);
  assert.equal(result.data.matches[1].reportUrl, null);
});

test("calendar reads the configured public organizer tab anonymously and skips frozen data", async () => {
  const published = buildData("mixed-b");
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    const query = new URL(url);
    assert.equal(query.origin + query.pathname, published.sourceUrl.replace(/\/edit$/, "/gviz/tq"));
    assert.equal(query.searchParams.get("sheet"), "Partite");
    assert.equal(query.searchParams.get("range"), "I3:Q200");
    assert.equal(query.searchParams.get("v"), String(now));
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    return csvResponse(withSections("mixed-b", [rowB, rowBSecond]));
  };
  assert.equal((await requestCalendar(published, { fetcher, now })).checkedAt, now);
  const frozen = { ...published, sourceMode: "frozen" };
  const frozenResult = await requestCalendar(frozen, { fetcher, now });
  assert.equal(frozenResult.data, frozen);
  assert.equal(frozenResult.checkedAt, null);
  assert.equal(calls, 1);
});
