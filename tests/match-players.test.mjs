import assert from "node:assert/strict";
import test from "node:test";
import { parseMatchPlayers, requestMatchPlayers, shouldCheckMatchPlayers } from "../src/match-players.js";

// SYNTHETIC public-column responses only. Never written to a deployment dataset.
const teams = [{ id: "a", name: "Team A" }, { id: "b", name: "Team B" }];
const match = { id: "SYNTHETIC", date: "2026-10-25", start: "09:00", resultState: "none",
  a: { teamId: "a" }, b: { teamId: "b" }, reportUrl: "https://docs.google.com/spreadsheets/d/SYNTHETIC/edit" };
const now = new Date("2026-10-25T08:10:00Z");
const csv = (rows) => rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
const fields = ["N°\ndivisa", "Presenza\nalla partita", "Cognome", "Nome"];
const statsFields = ["SQUADRA", "COGNOME", "NOME", "tot. assist", "tot. mete", "TOTALE", ""];
function source() {
  return [
    [["FOGLIO DI GARA"], ["CAMPIONATI ITALIANI ULTIMATE MIXED"], ["Team A vs. Team B"], ["25 ottobre 2026"]],
    [["ROSTER"], ["Team A"]],
    [fields, ["00", "X", "D’Àngelo", "Alba"], ["12", "", "Test", "Bruno"]],
    [["ROSTER"], ["Team B"]],
    [fields, ["7", "X", "Test", "Carla"]],
    [statsFields, ["Team A", "D’Àngelo", "Alba", "0", "2", "2", " mvp"], ["Team B", "Test", "Carla", "1", "0", "1", ""]],
  ];
}
const parse = (rows = source(), fixture = match, names = teams, aliases) =>
  parseMatchPlayers(rows.map(csv), fixture, names, aliases);

test("match rosters preserve attendance, numbers, exact names and game-specific statistics", () => {
  const result = parse();
  assert.equal(result.rosters.length, 2);
  assert.deepEqual(result.rosters[0].players[0], { surname: "D’Àngelo", givenName: "Alba",
    number: "00", present: true, assists: 0, goals: 2, total: 2, hasStats: true, mvp: true });
  const unmarked = result.rosters[0].players[1];
  assert.equal(unmarked.present, null);
  assert.equal(unmarked.assists, null);
  assert.equal(unmarked.hasStats, false);
  assert.equal(result.rosters[1].players[0].goals, 0);
});

test("blank future rosters and missing game statistics remain genuinely missing", () => {
  const rows = source();
  rows[2] = [fields]; rows[4] = [fields]; rows[5] = [statsFields];
  assert.equal(parse(rows).rosters.flatMap((roster) => roster.players).length, 0);
  const missing = source(); missing[5][1] = ["Team A", "D’Àngelo", "Alba", "", "", "", ""];
  assert.equal(parse(missing).rosters[0].players[0].total, null);
  assert.equal(parse(missing).rosters[0].players[0].hasStats, false);
});

test("one unnamed source player retains jersey, presence and statistics without guessing a name", () => {
  const rows = source();
  rows[2][1] = ["9", "X", "", ""];
  rows[5][1] = ["Team A", "", "", "3", "0", "3", ""];
  const unnamed = parse(rows).rosters[0].players[0];
  assert.equal(unnamed.surname, null); assert.equal(unnamed.givenName, null);
  assert.equal(unnamed.number, "9"); assert.equal(unnamed.present, true);
  assert.equal(unnamed.assists, 3); assert.equal(unnamed.total, 3);
  rows[2].push(["51", "X", "", ""]);
  assert.throws(() => parse(rows)); // Two missing identities cannot be joined unambiguously.
});

test("MVP is the elected source mark, including a zero-total player, never an inferred top scorer", () => {
  const rows = source();
  rows[5][1] = ["Team A", "D’Àngelo", "Alba", "0", "0", "0", " MVP "];
  rows[5][2] = ["Team B", "Test", "Carla", "9", "9", "18", ""];
  const result = parse(rows);
  assert.equal(result.rosters[0].players[0].mvp, true);
  assert.equal(result.rosters[1].players[0].mvp, false);
  rows[5][1][6] = "top scorer";
  assert.throws(() => parse(rows));
});

test("identity checks protect the match, roster sides and explicitly approved aliases", () => {
  const reversed = { ...match, a: match.b, b: match.a };
  assert.equal(parse(source(), reversed).rosters[0].teamId, "a");
  const renamed = [{ ...teams[0], name: "Team A renamed" }, teams[1]];
  assert.throws(() => parse(source(), match, renamed));
  assert.equal(parse(source(), match, renamed, { "Team A": "Team A renamed" }).rosters[0].teamId, "a");
  for (const mutate of [
    (rows) => { rows[0][3][0] = "26 ottobre 2026"; },
    (rows) => { rows[1][1][0] = "Team B"; },
    (rows) => { rows[3][1][0] = "Unknown"; },
    (rows) => { rows[5][1][0] = "Unknown"; },
  ]) {
    const rows = source(); mutate(rows); assert.throws(() => parse(rows));
  }
});

test("ambiguous names, unrecognized presence and unmatched/duplicate statistics fail visibly", () => {
  for (const mutate of [
    (rows) => { rows[2].push(rows[2][1]); },
    (rows) => { rows[2][1][1] = "?"; },
    (rows) => { rows[2][1][2] = ""; },
    (rows) => { rows[5].push(rows[5][1]); },
    (rows) => { rows[5][1][1] = "Not in roster"; },
    (rows) => { rows[2][0] = ["changed", "presence", "surname", "name"]; },
    (rows) => { rows[5][0] = ["changed"]; },
  ]) {
    const rows = source(); mutate(rows); assert.throws(() => parse(rows));
  }
});

test("individual game totals validate nonnegative integers and assist/goal sums", () => {
  for (const value of ["-1", "1.5", "NaN", "9007199254740992"]) {
    const rows = source(); rows[5][1][3] = value; assert.throws(() => parse(rows));
  }
  const rows = source(); rows[5][1][5] = "99"; assert.throws(() => parse(rows));
});

test("only safe named-sheet columns are requested, with failure and changed-match isolation", async () => {
  const rows = source().map(csv);
  let calls = 0;
  const fetcher = async (url, options) => {
    assert.equal(options.credentials, "omit"); assert.equal(options.cache, "no-store");
    const params = new URL(url).searchParams;
    const name = params.get("sheet"), range = params.get("range");
    let index;
    if (name === "Foglio di gara (LIVE)") { assert.equal(range, "C4:C7"); index = 0; }
    else if (name === "Statistiche (LIVE)") { assert.equal(range, "A1:G100"); index = 5; }
    else {
      assert.ok(["Roster squadra A (LIVE)", "Roster squadra B (LIVE)"].includes(name));
      assert.ok(["B2:B3", "G2:J100"].includes(range));
      index = (name.includes(" A ") ? 1 : 3) + (range === "G2:J100" ? 1 : 0);
    }
    calls++;
    return new Response(rows[index], { headers: { "content-type": "text/csv" } });
  };
  const loaded = await requestMatchPlayers(match, teams, null, { fetcher, clock: () => +now });
  assert.equal(calls, 6); assert.equal(loaded.error, null); assert.ok(loaded.data);
  assert.equal(JSON.stringify(loaded.data).includes("tessera"), false);
  const offline = { fetcher: async () => { throw new Error("offline"); }, clock: () => +now + 60000 };
  const failed = await requestMatchPlayers(match, teams, loaded, offline);
  assert.equal(failed.data, loaded.data); assert.equal(failed.checkedAt, loaded.checkedAt);
  assert.equal(failed.error, "offline");
  const changed = await requestMatchPlayers({ ...match, date: "2026-11-07" }, teams, loaded, offline);
  assert.equal(changed.data, null);
  assert.ok((await requestMatchPlayers(match, teams, null,
    { fetcher: async () => new Response("denied", { status: 403 }) })).error);
});

test("opening a past detail reads once; automatic player refresh is restricted to ±2 hours", () => {
  const previous = { attemptedAt: +now, data: parse() };
  const past = new Date("2026-10-27T08:00:00Z");
  assert.equal(shouldCheckMatchPlayers(match, null, null, past), true);
  assert.equal(shouldCheckMatchPlayers(match, previous, null, past), false);
  assert.equal(shouldCheckMatchPlayers(match, { ...previous, error: "offline" }, null, past), false);
  assert.equal(shouldCheckMatchPlayers(match, previous, null, past, true), true);
  assert.equal(shouldCheckMatchPlayers(match, previous, null, new Date(+now + 59999)), false);
  assert.equal(shouldCheckMatchPlayers(match, previous, null, new Date(+now + 60000)), true);
  assert.equal(shouldCheckMatchPlayers({ ...match, resultState: "complete" }, previous, null,
    new Date(+now + 60000)), false);
  assert.equal(shouldCheckMatchPlayers(match, previous, { report: { end: "10:30" } },
    new Date(+now + 60000)), false);
});
