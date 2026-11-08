import assert from "node:assert/strict";
import test from "node:test";
import { createReportQueue, nextReportCheckDelay, planReportChecks } from "../src/report-refresh.js";
import { inReportRecoveryWindow, OVERVIEW_REPORT_INTERVAL, reportView, requestReport } from "../src/reports.js";

// SYNTHETIC fixtures and reports only: never written to public/ or the source sheets.
const now = new Date("2026-11-08T13:30:00Z"); // 14:30 Rome.
const teams = [{ id: "a", name: "Team A" }, { id: "b", name: "Team B" }];
const game = (id, changes = {}) => ({ id, date: "2026-11-08", start: "13:00", end: "14:20",
  a: { teamId: "a", slot: "X1" }, b: { teamId: "b", slot: "X2" }, resultState: "none",
  reportUrl: `https://docs.google.com/spreadsheets/d/SYNTHETIC_${id}/edit`,
  score: { a: null, b: null }, ...changes });
const recent = (changes = {}) => ({ attemptedAt: +now, checkedAt: +now, error: null,
  report: { score: { a: 2, b: 1 }, date: "2026-11-08", start: "13:05", end: null }, ...changes });
const taskIds = (tasks) => tasks.filter((task) => task.scores).map((task) => task.match.id);

test("manual overview forces every eligible missing result, including late and ended games", () => {
  const data = { matches: [game("live"), game("late", { start: "09:00" }), game("ended"),
    game("next", { start: "16:30" }), game("too-late", { start: "16:31" }),
    game("yesterday", { date: "2026-11-07" }), game("final", { resultState: "complete" }),
    game("no-link", { reportUrl: null }), game("untimed", { start: null })] };
  const options = { now, scoreFor: (match) => ["next", "untimed"].includes(match.id) ? null
    : recent({ url: match.reportUrl, ...(match.id === "ended" ? { report: { end: "14:10" } } : {}) }) };
  assert.deepEqual(taskIds(planReportChecks(data, options)), ["next", "untimed"]);
  const tasks = planReportChecks(data, { ...options, manual: true });
  assert.deepEqual(taskIds(tasks), ["live", "late", "ended", "next", "untimed"]);
  assert.ok(tasks.every((task) => !task.players && task.interval === 300000));
});

test("automatic overview is five minutes; the open detail stays at sixty seconds", () => {
  assert.equal(OVERVIEW_REPORT_INTERVAL, 300000);
  const data = { matches: [game("open"), game("other")] };
  const options = { openId: "open", scoreFor: (match) => recent({ url: match.reportUrl }),
    playersFor: () => recent() };
  assert.deepEqual(taskIds(planReportChecks(data, { ...options, now: new Date(+now + 59999) })), []);
  const oneMinute = planReportChecks(data, { ...options, now: new Date(+now + 60000) });
  assert.deepEqual(taskIds(oneMinute), ["open"]);
  assert.equal(oneMinute[0].players, true);
  assert.deepEqual(taskIds(planReportChecks(data, { ...options, now: new Date(+now + 299999) })), ["open"]);
  assert.deepEqual(taskIds(planReportChecks(data, { ...options, now: new Date(+now + 300000) })), ["open", "other"]);
  const past = game("past", { date: "2026-10-25", resultState: "complete" });
  assert.deepEqual(taskIds(planReportChecks({ matches: [past] }, { now, manual: true })), []);
  const detail = planReportChecks({ matches: [past] }, { now, manual: true, openId: "past" });
  assert.deepEqual(taskIds(detail), ["past"]);
  assert.equal(detail[0].players, true);
});

test("Rome day recovery includes late games and crosses midnight only within two hours", () => {
  assert.equal(inReportRecoveryWindow(game("late", { start: "09:00" }), now), true);
  assert.equal(inReportRecoveryWindow(game("tomorrow", { date: "2026-11-09", start: "00:30" }),
    new Date("2026-11-08T22:45:00Z")), true);
  assert.equal(inReportRecoveryWindow(game("yesterday", { date: "2026-11-07", start: "23:30" }),
    new Date("2026-11-07T23:30:00Z")), true);
  assert.equal(inReportRecoveryWindow(game("old", { date: "2026-11-07", start: "20:00" }),
    new Date("2026-11-07T23:30:00Z")), false);
});

test("timer wakes when reports become due even between JSON polls", () => {
  const data = { matches: [game("open"), game("other")] };
  const options = { now: new Date(+now + 299000), scoreFor: (match) => recent({ url: match.reportUrl }) };
  assert.equal(nextReportCheckDelay(data, options), 1000);
  assert.equal(nextReportCheckDelay(data, { ...options, now: new Date(+now + 17000), openId: "open",
    playersFor: () => recent() }), 43000);
});

test("overview freshness uses its polling interval and preserves final precedence", () => {
  const match = game("live");
  const entry = recent({ interval: OVERVIEW_REPORT_INTERVAL });
  assert.equal(reportView(match, entry, new Date(+now + 299999)).state, "live");
  assert.equal(reportView(match, entry, new Date(+now + 605001)).state, "report-stale");
  assert.equal(reportView(match, { ...entry, error: "offline" }, now).state, "report-stale");
  assert.equal(reportView(match, recent({ report: { ...entry.report, end: "14:15" } }), now).state, "provisional");
  const final = game("final", { resultState: "complete", score: { a: 15, b: 10 } });
  assert.deepEqual(reportView(final, entry, now), { score: final.score, state: "complete" });
});

test("homepage batch reads real adapter ranges and updates every result independently", async () => {
  const matches = [game("ongoing"), game("finished", { start: "09:00" }), game("broken")];
  const entries = new Map();
  const data = { teams, matches };
  const csv = (rows) => rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  const metadata = csv([["FOGLIO DI GARA"], ["CAMPIONATI ITALIANI ULTIMATE MIXED"], ["Team A vs. Team B"], ["8 novembre 2026"]]);
  const calls = [];
  const fetcher = async (url, options) => {
    const query = new URL(url);
    calls.push(query);
    assert.equal(options.credentials, "omit");
    assert.equal(query.searchParams.get("sheet"), "Foglio di gara (LIVE)");
    if (query.pathname.includes("broken")) throw new Error("SYNTHETIC offline report");
    const ended = query.pathname.includes("finished");
    const body = csv([["assist", "meta", "parziale"], ["", "", "1 - 0"],
      ["orario inizio: 09 : 03", "punteggio half-time:", ""],
      [`orario fine: ${ended ? "10 : 15" : " : "}`, "risultato finale:", "1 - 0"]].map((row, index) => ["", index === 0 ? "squadra" : "", ...row, ""]));
    return new Response(query.searchParams.get("range") === "C4:C7" ? metadata : body,
      { headers: { "Content-Type": "text/csv" } });
  };
  const queue = createReportQueue();
  const tasks = planReportChecks(data, { now, manual: true });
  const result = await queue(tasks, { keyFor: ({ match }) => match.id,
    check: async ({ match, interval }) => {
      const entry = await requestReport(match, teams, entries.get(match.id), { fetcher, clock: () => +now, interval });
      entries.set(match.id, entry);
      return entry.error;
    } });
  assert.deepEqual(result, { count: 3, failed: 1 });
  assert.equal(calls.length, 6);
  assert.equal(reportView(matches[0], entries.get("ongoing"), now).state, "live");
  assert.equal(reportView(matches[1], entries.get("finished"), now).state, "provisional");
  assert.equal(entries.get("broken").report, null);
  assert.ok(matches.every((match) => match.score.a === null));
});

test("overlapping batches share reads and a global limit of four report workers", async () => {
  const queue = createReportQueue();
  const tasks = Array.from({ length: 12 }, (_, id) => ({ id }));
  let active = 0, maximum = 0, calls = 0;
  const options = { keyFor: ({ id }) => String(id), check: async () => {
    calls++; maximum = Math.max(maximum, ++active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
  } };
  const [first, second] = await Promise.all([queue(tasks, options), queue(tasks, options)]);
  assert.equal(calls, 12);
  assert.equal(maximum, 4);
  assert.deepEqual(first, { count: 12, failed: 0 });
  assert.deepEqual(second, first);
});

test("queued reads from a previous division are skipped, and failed tasks release workers", async () => {
  const queue = createReportQueue();
  let calls = 0;
  const tasks = Array.from({ length: 9 }, (_, id) => ({ id }));
  const skipped = await queue(tasks, { keyFor: ({ id }) => String(id), isCurrent: () => false,
    check: async () => { calls++; } });
  assert.deepEqual(skipped, { count: 0, failed: 0 });
  assert.equal(calls, 0);
  const failed = await queue(tasks, { keyFor: ({ id }) => String(id), check: async () => { throw new Error("SYNTHETIC failure"); } });
  assert.deepEqual(failed, { count: 9, failed: 9 });
  assert.deepEqual(await queue(tasks, { keyFor: ({ id }) => String(id), check: async () => {} }), { count: 9, failed: 0 });
});
