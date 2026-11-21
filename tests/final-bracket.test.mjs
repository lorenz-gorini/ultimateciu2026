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


test("pyramids center their final and expose every direct seed on its exact participant side", () => {
  const markup = finalBracket(data, result);
  for (const [id, side, seed] of [["S1", "a", "1P"], ["S2", "a", "2P"], ["S3", "b", "12P"], ["S4", "b", "11P"]]) {
    assert.ok(markup.includes(`data-bracket-entry="${id}:${side}" data-bracket-slot="${seed}"`));
    assert.ok(markup.includes(`data-bracket-direct="${id}:${side}"`));
    assert.ok(markup.includes(`Accesso diretto · ${seed.slice(0, -1)}ª`));
  }
  const top = (id) => Number(markup.match(new RegExp(`id="bracket-${id}" style="left:\\d+px;top:(\\d+)px"`))[1]);
  assert.equal(top("F1"), (top("S1") + top("S2")) / 2);
  assert.equal(top("F5"), (top("S3") + top("S4")) / 2);
  assert.equal(top("F4"), (top("Q3") + top("Q4")) / 2);
});

test("placement transfers preserve exact W/L relationships without long bypass wires", () => {
  const markup = finalBracket(data, result);
  for (const id of ["Q1:F3:a:L", "Q2:F3:b:L", "S1:F2:a:L", "S2:F2:b:L", "Q4:S3:a:L", "Q3:S4:a:L", "S3:F6:a:L", "S4:F6:b:L"]) {
    const connector = markup.split(`data-bracket-edge="${id}"`)[1]?.split("</g>")[0];
    assert.ok(connector?.includes('data-bracket-transfer="true"'), id);
  }
  for (const id of ["Q3:F4:a:W", "Q4:F4:b:W"]) {
    const connector = markup.split(`data-bracket-edge="${id}"`)[1]?.split("</g>")[0];
    assert.ok(connector && !connector.includes("data-bracket-transfer"), id);
  }
  // Every connector has a single vertical segment; no loop or cross-lane bypass.
  const paths = [...markup.matchAll(/class="bracket-wire" d="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(paths.length, 20); // 16 source W/L relationships plus 4 direct entries.
  for (const path of paths) assert.equal((path.match(/ V /g) || []).length, 1);
  assert.equal((markup.match(/class="bracket-accessible-paths visually-hidden"/g) || []).length, 6);
});

test("only the Serie A placement diagram explains relegation", () => {
  const note = "L’11ª e la 12ª classificata retrocedono in Serie B.";
  const serieB = JSON.parse(readFileSync("public/data-mixed-b.json", "utf8"));
  assert.equal(finalBracket(data, result).split(note).length - 1, 1);
  assert.ok(!finalBracket(serieB, result).includes(note));
});


test("standalone view has one page heading while embedded view retains its phase heading", () => {
  const standalone = finalBracket(data, result, true);
  assert.ok(standalone.includes("<h1>Tabellone finale</h1>"));
  assert.ok(!standalone.includes('phase-number'));
  assert.ok(finalBracket(data, result).includes('<h2><span class="phase-number">03</span> Tabellone finale</h2>'));
});


test("entry and match connectors meet participant underlines and direct access has a distinct key", () => {
  const markup = finalBracket(data, result);
  const direct = markup.split('data-bracket-direct="S1:a"')[1].split("</g>")[0];
  assert.ok(direct.includes('d="M 202 102 H 242 V 126 H 282"'));
  const quarter = markup.split('data-bracket-edge="Q2:S1:b:W"')[1].split("</g>")[0];
  assert.ok(quarter.includes('d="M 202 196 H 242 V 174 H 282"'));
  assert.ok(markup.includes('bracket-key-direct'));
  assert.equal((markup.match(/bracket-connection-D/g) || []).length, 4);
  const synthetic = structuredClone(data);
  synthetic.matches.find((match) => match.id === "F2").a.teamId = null;
  const entry = finalBracket(synthetic, result).split('data-bracket-entry="F2:a"')[1].split('</div></div>')[0];
  assert.equal((entry.match(/Perdente S1/g) || []).length, 1);
  assert.ok(entry.includes('Squadra da definire'));
});
