import assert from "node:assert/strict";
import test from "node:test";
import { parseReport, requestReport } from "../src/reports.js";
import { chartSegments, gameTimeline, reportWarnings, scoreCharts, scoreSequence } from "../src/match-timeline.js";
import { lastGoalIndex } from "../src/chart-tooltip.js";
import { planReportChecks } from "../src/report-refresh.js";

// SYNTHETIC goal data only; never added to public inputs or organizer sheets.
const teams = [{ id: "a", name: "Team A" }, { id: "b", name: "Team B" }];
const match = { id: "X_1", date: "2026-10-25", start: "09:00", a: { teamId: "a" }, b: { teamId: "b" },
  reportUrl: "https://docs.google.com/spreadsheets/d/SYNTHETIC/edit", score: { a: null, b: null }, resultState: "none" };
const csv = (rows) => rows.map((row) => row.map((v) => `"${v.replaceAll('"', '""')}"`).join(",")).join("\n");
const metadata = csv([["FOGLIO DI GARA"], ["CAMPIONATI ITALIANI ULTIMATE MIXED"], ["Team A vs. Team B"], ["25 ottobre 2026"]]);
function body() {
  return [["", "squadra", "assist", "meta", "parziale", ""],
    ["2 '", "Team B", "23 - Assist B", "0 - Player B", "0 - 1", " break"],
    ["4 '", "Team A", "11 - Assist A", "4 - Player A", "1 - 1", ""],
    ["", "Team A", "", "7 - Player C", "2 - 1", ""],
    ["9 '", "Team B", "5 - Assist C", "1 - Player D", "2 - 2", "BREAK"],
    ["", "", "orario inizio: 09 : 03", "punteggio half-time:", "2 - 1", ""],
    ["", "", "orario fine: :", "risultato finale:", "2 - 2", ""]];
}
const parse = (rows = body(), header = metadata) => parseReport(header, csv(rows), match, teams);

test("goal sequence keeps actual credits, missing minutes, half-time and source-only break marks", () => {
  const report = parse();
  assert.equal(report.goals.length, 4);
  assert.deepEqual(report.goals.map((g) => g.side), ["b", "a", "a", "b"]);
  assert.deepEqual(report.goals.map((g) => g.isBreak), [true, false, false, true]);
  assert.equal(report.goals[0].scorer, "0 - Player B");
  assert.equal(report.goals[2].assist, null);
  assert.equal(report.goals[2].minute, null);
  assert.equal(report.halftime, 3);
  assert.equal(report.timeOrdered, true);
  const zero = body();zero[1][0] = "0 '";
  assert.equal(parse(zero).goals[0].minute, 0);
});

test("reversed report sides keep scorer, score and break attached to the correct team", () => {
  const report = parse(body().map((row, i) => i > 0 && i < 5 ? [...row.slice(0, 1), row[1] === "Team A" ? "Team B" : "Team A", ...row.slice(2)] : row),
    metadata.replace("Team A vs. Team B", "Team B vs. Team A"));
  assert.deepEqual(report.goals[0].score, { a: 1, b: 0 });
  assert.equal(report.goals[0].side, "a");assert.equal(report.goals[0].isBreak, true);
  assert.equal(report.goals[0].scorer, "0 - Player B");
});

test("time charts leave gaps and never invent times for missing goal entries", () => {
  const report = parse();
  const timed = chartSegments(report, "a", "time");
  assert.equal(timed.length, 2);
  assert.deepEqual(timed[1], [{ x: 9, y: 2 }]);
  assert.equal(chartSegments(report, "a", "point").length, 1);
  const markup = scoreCharts(match, teams, { report }, "time");
  assert.match(markup, /3\/4 mete hanno un minuto/);
  assert.match(markup, /Le interruzioni della linea/);
  const backwards = body();backwards[2][0] = "1 '";
  const invalidTime = parse(backwards);
  assert.equal(invalidTime.timeOrdered, false);
  assert.match(scoreCharts(match, teams, { report: invalidTime }, "time"), /tempi del report non sono in ordine/i);
  assert.deepEqual(invalidTime.score, { a: 2, b: 2 });
});

test("unknown optional labels are explicit warnings without altering validated scores", () => {
  const rows = body();rows[1][0] = "not a time";rows[1][1] = "Wrong team";rows[1][5] = "maybe";
  const report = parse(rows);
  assert.equal(report.goals[0].minute, null);
  assert.equal(report.goals[0].timeUnrecognized, true);
  assert.equal(report.goals[0].breakUnrecognized, true);
  assert.equal(report.goals[0].isBreak, false);
  assert.match(reportWarnings(match, { report }), /non coincidono/);
  assert.match(reportWarnings(match, { report }), /break non sono riconosciute/);
});

test("rendered sequence and timeline escape source text, preserve all goals and mark only column-I breaks", () => {
  const rows = body();rows[1][2] = '<img src=x onerror="bad()">';rows[1][3] = "23 - A & B";
  const report = parse(rows);
  const markup = gameTimeline(match, teams, { report });
  assert.equal((markup.match(/data-goal=/g) || []).length, 4);
  assert.equal((markup.match(/class="break-badge"/g) || []).length, 2);
  assert.match(markup, /&lt;img/);assert.doesNotMatch(markup, /<img/);
  assert.match(markup, /A &amp; B/);assert.match(markup, /Intervallo/);
  assert.match(markup, /Minuto non indicato/);
  assert.match(scoreSequence(match, teams, { report }), /Totale report/);
  assert.match(scoreCharts(match, teams, { report }), /Break segnalati: 2/);
  const official = { ...match, resultState: "complete", score: { a: 15, b: 8 } };
  assert.match(reportWarnings(official, { report }), /risultato ufficiale resta quello del calendario/);
  assert.match(reportWarnings(match, { report, error: "offline" }), /ultima sequenza valida/);
});

test("opening a historical final reads its goal history once and keeps overview polling bounded", () => {
  const final = { ...match, resultState: "complete", score: { a: 15, b: 8 } };
  const data = { teams, matches: [final] };
  const now = new Date("2026-11-08T12:00:00Z");
  const plan = planReportChecks(data, { now, openId: match.id });
  assert.equal(plan[0].scores, true);
  assert.equal(planReportChecks(data, { now }).length, 0);
  assert.equal(planReportChecks(data, { now, openId: match.id,
    scoreFor: () => ({ url: match.reportUrl, attemptedAt: +now }), playersFor: () => ({ attemptedAt: +now }) }).length, 0);
});

test("network query includes the explicit break column and excludes unused gender/roster columns", async () => {
  const queries = [];
  const entry = await requestReport(match, teams, null, { fetcher: async (url, options) => {
    const query = new URL(url).searchParams;queries.push(query);
    assert.equal(options.credentials, "omit");
    return new Response(query.get("range") === "C4:C7" ? metadata : csv(body()), { headers: { "Content-Type": "text/csv" } });
  } });
  assert.equal(entry.error, null);
  assert.equal(queries.length, 2);
  assert.equal(queries[1].get("range"), "C12:I200");
  assert.equal(queries[1].get("tq"), "select C,D,E,F,G,I");
  assert.equal(entry.report.goals[0].isBreak, true);
});


test("goal tooltips expose actual credits, score, minute and source break with safe accessible markup", () => {
  const rows = body();
  rows[1][2] = '23 - Assist <B> & C';
  const markup = scoreCharts(match, teams, { report: parse(rows) });
  assert.equal((markup.match(/role="tooltip"/g) || []).length, 5);
  assert.equal((markup.match(/data-score-target=/g) || []).length, 5);
  assert.match(markup, /role="button" tabindex="0"[^>]*aria-describedby="goal-tooltip-X_1-1"/);
  const first = markup.split('id="goal-tooltip-X_1-1"')[1].split('id="goal-tooltip-X_1-2"')[0];
  assert.match(first, /0–1/);
  assert.match(first, /Meta 1 · 2′/);
  assert.match(first, /Assist &lt;B&gt; &amp; C/);
  assert.match(first, /#0<\/span> Player B/);
  assert.match(first, /BREAK/);
  const missing = markup.split('id="goal-tooltip-X_1-3"')[1].split('id="goal-tooltip-X_1-4"')[0];
  assert.match(missing, /Minuto non indicato/);
  assert.match(missing, /Non indicato/);
  assert.doesNotMatch(missing, /break-badge/);
  assert.doesNotMatch(markup, /Assist <B>/);
});

test("time-axis tooltips include only goals with source minutes, including zero and shared minutes", () => {
  const rows = body();
  rows[1][0] = "0 '";
  rows[2][0] = "0 '";
  const markup = scoreCharts(match, teams, { report: parse(rows) }, "time");
  assert.equal((markup.match(/role="tooltip"/g) || []).length, 4);
  assert.match(markup, /id="goal-tooltip-X_1-1"/);
  assert.match(markup, /id="goal-tooltip-X_1-2"/);
  assert.doesNotMatch(markup, /id="goal-tooltip-X_1-3"/);
});


test("chart-wide cursor selects the last goal, not a future or nearest goal", () => {
  const positions = [0, 4, 8, 8, 15];
  assert.equal(lastGoalIndex(positions, 0), 0);
  assert.equal(lastGoalIndex(positions, 3.9), 0);
  assert.equal(lastGoalIndex(positions, 7.9), 1);
  assert.equal(lastGoalIndex(positions, 8), 3);
  assert.equal(lastGoalIndex(positions, 14.9), 3);
  assert.equal(lastGoalIndex(positions, 15), 4);
});
