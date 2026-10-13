import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  filterMatches,
  formatDate,
  matchState,
  normalizeSearch,
  requestData,
  romeNow,
  validateData,
} from "../src/data.js";

const published = JSON.parse(readFileSync("public/data.json", "utf8"));
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

test("published dataset validates without imposing frozen row counts", () => {
  assert.equal(validateData(published), published);
  assert.ok(published.teams.length > 0);
  assert.ok(published.matches.length > 0);
});

test("case and accent-insensitive search preserves canonical spelling", () => {
  assert.equal(normalizeSearch("MÌLÀNO"), "milano");
  for (const [query, id] of [
    ["bfd REDSHOT", "x1"],
    ["360 Mlano", "x6"],
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
