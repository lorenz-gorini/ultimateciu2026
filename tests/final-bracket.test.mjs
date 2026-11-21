import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bracketEdges, bracketParticipant, finalBracket } from "../src/final-bracket.js";

const data = JSON.parse(readFileSync("public/data.json", "utf8"));
const finals = data.matches.filter((match) => match.phase === "finals");
const result = (match) => `<a href="#/match/${match.id}">${match.score.a ?? "—"}–${match.score.b ?? "—"}</a>`;

test("SYNTHETIC winner and loser paths follow the published slot references", () => {
  const previous = { id: "Q4", a: { slot: "8P" }, b: { slot: "9P" } };
  const semi = { id: "S3", a: { slot: "LQ4" }, b: { slot: "12P" } };
  const final = { id: "F4", a: { slot: "WQ3" }, b: { slot: "WQ4" } };
  assert.deepEqual(bracketEdges([previous, semi, final]), [
    { from: "Q4", to: "S3", side: "a", outcome: "L" },
    { from: "Q4", to: "F4", side: "b", outcome: "W" },
  ]);
});

test("tabellone includes every official fixture, score, team route and outgoing path once", () => {
  const markup = finalBracket(data, result);
  for (const match of finals) {
    assert.equal(markup.split(`id="bracket-${match.id}"`).length - 1, 1);
    assert.equal(markup.split(`data-bracket-result="${match.id}"`).length - 1, 1);
    assert.ok(markup.includes(result(match)));
    for (const side of [match.a, match.b]) if (side.teamId) {
      assert.ok(markup.includes(`href="#/team/${side.teamId}"`));
      assert.ok(markup.includes(data.teams.find((team) => team.id === side.teamId).name));
    }
  }
  assert.equal((markup.match(/data-bracket-edge=/g) || []).length, 16);
  for (const edge of bracketEdges(finals)) {
    assert.ok(markup.includes(`data-bracket-edge="${edge.from}:${edge.to}:${edge.side}:${edge.outcome}"`));
  }
  assert.ok(!markup.includes("data-bracket-jump"));
  assert.ok(!markup.includes("bracket-time"));
  assert.ok(!markup.includes("<button"));
  assert.equal(markup.split("L’11ª e la 12ª classificata retrocedono in Serie B.").length - 1, 1);
  for (let place = 1; place <= 11; place += 2) assert.ok(markup.includes(`${place}°–${place + 1}° posto`));

});

test("SYNTHETIC slot resolution requires an official completed, non-tied predecessor", () => {
  const previous = { id: "Q1", a: { slot: "3P", teamId: "x3" }, b: { slot: "6P", teamId: "y5" }, score: { a: 0, b: 15 }, resultState: "complete" };
  const side = { slot: "WQ1", teamId: null };
  assert.deepEqual(bracketParticipant(side, [previous]), { ...side, teamId: "y5", derived: true });
  assert.equal(bracketParticipant({ ...side, slot: "LQ1" }, [previous]).teamId, "x3");
  for (const change of [{ resultState: "partial" }, { resultState: "none" }, { score: { a: null, b: 15 } }, { score: { a: 15, b: 15 } }]) {
    assert.equal(bracketParticipant(side, [{ ...previous, ...change }]).teamId, null);
  }
  assert.equal(bracketParticipant(side, []).teamId, null);
  assert.equal(bracketParticipant({ ...side, teamId: "x2" }, [previous]).teamId, "x2");
  assert.equal(side.teamId, null);
});

test("SYNTHETIC incomplete chain and cycles cannot invent a named participant", () => {
  const cycle = { id: "Q1", a: { slot: "WQ1", teamId: null }, b: { slot: "6P", teamId: "y5" }, score: { a: 15, b: 0 }, resultState: "complete" };
  assert.equal(bracketParticipant({ slot: "WQ1", teamId: null }, [cycle]).teamId, null);
});

test("Serie B retains its genuine power-pool competition without a knockout bracket", () => {
  const serieB = JSON.parse(readFileSync("public/data-mixed-b.json", "utf8"));
  assert.equal(finalBracket(serieB, result), "");
  assert.equal(serieB.pools.filter((pool) => pool.phase === "second").length, 6);
});

test("SYNTHETIC source names and unresolved references are escaped", () => {
  const synthetic = structuredClone(data);
  synthetic.teams[0].name = '<img src=x onerror="bad">';
  synthetic.matches.find((match) => match.id === "Q1").a.teamId = synthetic.teams[0].id;
  synthetic.matches.find((match) => match.id === "F1").a.slot = '<script>bad</script>';
  const markup = finalBracket(synthetic, result);
  assert.ok(markup.includes('&lt;img src=x onerror=&quot;bad&quot;&gt;'));
  assert.ok(markup.includes('&lt;script&gt;bad&lt;/script&gt;'));
  assert.ok(!markup.includes('<script>'));
});

test("SYNTHETIC newly published final-phase IDs remain accessible without inventing a path", () => {
  const synthetic = structuredClone(data);
  const extra = { ...structuredClone(finals[0]), id: "Q5" };
  synthetic.matches.push(extra);
  const markup = finalBracket(synthetic, result);
  assert.ok(markup.includes("Altri incontri della fase finale"));
  assert.equal(markup.split('id="bracket-Q5"').length - 1, 1);
  assert.ok(markup.includes('href="#/match/Q5"'));
  assert.ok(!finalBracket(data, result).includes("Altri incontri della fase finale"));
});


test("diagram bypasses lead directly to the source-prescribed final participant", () => {
  const markup = finalBracket(data, result);
  for (const [id, path] of [
    ["Q1:F3:a:L", "M 210 286 H 230 V 390 H 650 V 456 H 680"],
    ["Q2:F3:b:L", "M 210 126 H 245 V 410 H 665 V 504 H 680"],
    ["Q3:F4:a:W", "M 210 274 H 230 V 390 H 650 V 456 H 680"],
    ["Q4:F4:b:W", "M 210 114 H 245 V 410 H 665 V 504 H 680"],
  ]) {
    const connector = markup.split(`data-bracket-edge="${id}"`)[1]?.split("</g>")[0];
    assert.ok(connector?.includes(`d="${path}"`), id);
  }
  assert.equal((markup.match(/class="bracket-wire-halo"/g) || []).length, 16);
  assert.equal((markup.match(/class="bracket-accessible-paths visually-hidden"/g) || []).length, 2);
});

test("only the Serie A placement diagram explains relegation", () => {
  const note = "L’11ª e la 12ª classificata retrocedono in Serie B.";
  const serieB = JSON.parse(readFileSync("public/data-mixed-b.json", "utf8"));
  assert.equal(finalBracket(data, result).split(note).length - 1, 1);
  assert.ok(!finalBracket(serieB, result).includes(note));
});
