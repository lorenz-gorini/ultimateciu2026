import { escapeHtml as escape } from "./html.js";

const placement = { F1: "1°–2° posto", F2: "3°–4° posto", F3: "5°–6° posto", F4: "7°–8° posto", F5: "9°–10° posto", F6: "11°–12° posto" };

/** Dependencies come from the organizer's W/L slots, never from a conventional bracket. */
export function bracketEdges(matches) {
  const ids = new Set(matches.map((match) => match.id));
  return matches.flatMap((match) => ["a", "b"].flatMap((side) => {
    const reference = /^([WL])(.+)$/.exec(match[side].slot);
    return reference && ids.has(reference[2])
      ? [{ from: reference[2], to: match.id, side, outcome: reference[1] }]
      : [];
  }));
}

/** Resolve only an empty W/L slot with an official, non-tied predecessor result. */
export function bracketParticipant(side, matches) {
  if (side.teamId) return { ...side, derived: false };
  const reference = /^([WL])(.+)$/.exec(side.slot);
  if (!reference) return { ...side, derived: false };
  const previous = matches.find((match) => match.id === reference[2]);
  if (!previous || previous.resultState !== "complete" || !Number.isFinite(previous.score.a)
    || !Number.isFinite(previous.score.b) || previous.score.a === previous.score.b) return { ...side, derived: false };
  const winner = previous.score.a > previous.score.b ? "a" : "b";
  const selected = reference[1] === "W" ? winner : winner === "a" ? "b" : "a";
  const teamId = previous[selected].teamId;
  return { ...side, teamId, derived: Boolean(teamId) };
}

const referenceText = (slot) => {
  const reference = /^([WL])(.+)$/.exec(slot);
  if (reference) return `${reference[1] === "W" ? "Vincente" : "Perdente"} ${reference[2]}`;
  const rank = /^(\d+)P$/.exec(slot);
  return rank ? `${rank[1]}ª dopo la seconda fase` : slot;
};

const columns = [12, 282, 552];
const width = 190;
const teamOffset = { a: 32, b: 80 };
// Each lane is a real source-prescribed tree. Transfers avoid long cross-tree wires.
const layouts = [
  { title: "Dal 1° al 6° posto", lanes: [
    { title: "Per il 1°–2° posto", rounds: ["Accessi e quarti", "Semifinali", "Finale"], height: 470,
      nodes: { Q2: [0, 140], Q1: [0, 360], S1: [1, 94], S2: [1, 314], F1: [2, 204] },
      entries: [{ to: "S1", side: "a", point: [0, 70] }, { to: "S2", side: "a", point: [0, 290] }] },
    { title: "Per il 3°–4° posto", rounds: ["Dalle semifinali", "Finale"], height: 220,
      nodes: { F2: [1, 86] }, entries: [{ to: "F2", side: "a", point: [0, 70] }, { to: "F2", side: "b", point: [0, 150] }] },
    { title: "Per il 5°–6° posto", rounds: ["Dai quarti", "Finale"], height: 220,
      nodes: { F3: [1, 86] }, entries: [{ to: "F3", side: "a", point: [0, 70] }, { to: "F3", side: "b", point: [0, 150] }] },
  ] },
  { title: "Dal 7° al 12° posto", relegation: true, lanes: [
    { title: "Per il 7°–8° posto", note: "Le vincenti di Q3 e Q4 accedono direttamente a questa finale.", rounds: ["Quarti", "Finale"], height: 360,
      nodes: { Q3: [0, 70], Q4: [0, 250], F4: [1, 160] }, entries: [] },
    { title: "Per il 9°–10° posto", rounds: ["Accessi e perdenti dei quarti", "Semifinali", "Finale"], height: 460,
      nodes: { S3: [1, 86], S4: [1, 306], F5: [2, 196] },
      entries: [{ to: "S3", side: "a", point: [0, 70] }, { to: "S3", side: "b", point: [0, 150] },
        { to: "S4", side: "a", point: [0, 290] }, { to: "S4", side: "b", point: [0, 370] }] },
    { title: "Per l’11°–12° posto", rounds: ["Dalle semifinali", "Finale"], height: 220,
      nodes: { F6: [1, 86] }, entries: [{ to: "F6", side: "a", point: [0, 70] }, { to: "F6", side: "b", point: [0, 150] }] },
  ] },
];

function participantMarkup(side, data, matches, position, unknownLabel = null) {
  const resolved = bracketParticipant(side, matches);
  const name = data.teams.find((team) => team.id === resolved.teamId)?.name;
  const label = name || unknownLabel || referenceText(side.slot) || "Squadra da definire";
  const provenance = name ? ` · ${referenceText(side.slot)}${resolved.derived ? " · da risultato ufficiale" : ""}` : "";
  return `<div class="bracket-team bracket-team-${position}" data-bracket-side="${position}" title="${escape(label + provenance)}">${name ? `<a href="#/team/${encodeURIComponent(resolved.teamId)}">${escape(name)}</a>` : `<span>${escape(label)}</span>`}</div>`;
}

function matchNode(match, data, matches, scoreMarkup, point) {
  const style = point ? ` style="left:${columns[point[0]]}px;top:${point[1]}px"` : "";
  return `<article class="bracket-match" id="bracket-${escape(match.id)}"${style} aria-label="${escape(match.id)}${placement[match.id] ? `, ${placement[match.id]}` : ""}"><div class="bracket-match-label">${escape(match.id)}${placement[match.id] ? ` · ${placement[match.id]}` : ""}</div>${participantMarkup(match.a, data, matches, "a")}<div class="bracket-result" data-bracket-result="${escape(match.id)}">${scoreMarkup(match)}</div>${participantMarkup(match.b, data, matches, "b")}</article>`;
}

/** All connectors run forward through the gutter into the exact participant row. */
function connection(from, to, side, outcome, entry = false) {
  const x1 = columns[from[0]] + width;
  const y1 = from[1] + (entry ? 32 : 56);
  const x2 = columns[to[0]];
  const y2 = to[1] + teamOffset[side];
  const rail = x1 + (outcome === "L" ? 50 : 40);
  return `M ${x1} ${y1} H ${rail} V ${y2} H ${x2}`;
}

function wire(from, to, side, outcome, label, attributes = "", entry = false) {
  const d = connection(from, to, side, outcome, entry);
  return `<g class="bracket-connection bracket-connection-${outcome}" ${attributes}><title>${escape(label)}</title><path class="bracket-wire-halo" d="${d}"/><path class="bracket-wire" d="${d}"/></g>`;
}

function entryMarkup(entry, match, data, matches) {
  const side = match[entry.side];
  const transfer = /^([WL])(.+)$/.exec(side.slot);
  const rank = /^(\d+)P$/.exec(side.slot);
  const caption = transfer ? referenceText(side.slot) : `Accesso diretto${rank ? ` · ${rank[1]}ª` : ""}`;
  return `<div class="bracket-entry${transfer ? ` bracket-entry-${transfer[1]}` : " bracket-entry-direct"}" style="left:${columns[entry.point[0]]}px;top:${entry.point[1]}px" data-bracket-entry="${escape(match.id)}:${entry.side}" data-bracket-slot="${escape(side.slot)}"><span class="bracket-entry-label">${escape(caption)}</span>${participantMarkup(side, data, matches, "a", transfer ? "Squadra da definire" : null)}</div>`;
}

function laneDiagram(lane, data, matches, edges, scoreMarkup) {
  const nodes = Object.fromEntries(Object.entries(lane.nodes).filter(([id]) => matches.some((match) => match.id === id)));
  const entries = lane.entries.filter((entry) => nodes[entry.to]);
  const localEdges = edges.filter((edge) => nodes[edge.from] && nodes[edge.to]);
  const transferred = entries.map((entry) => edges.find((edge) => edge.to === entry.to && edge.side === entry.side)).filter(Boolean);
  const laneEdges = [...localEdges, ...transferred];
  const edgeId = (edge) => `data-bracket-edge="${escape(edge.from)}:${escape(edge.to)}:${edge.side}:${edge.outcome}"`;
  const edgeLabel = (edge) => `${edge.outcome === "W" ? "Vincente" : "Perdente"} ${edge.from} → ${edge.to}, squadra ${edge.side.toUpperCase()}`;
  const paths = localEdges.map((edge) => wire(nodes[edge.from], nodes[edge.to], edge.side, edge.outcome, edgeLabel(edge), edgeId(edge))).join("")
    + entries.map((entry) => {
      const edge = transferred.find((candidate) => candidate.to === entry.to && candidate.side === entry.side);
      return wire(entry.point, nodes[entry.to], entry.side, edge?.outcome || "D", edge ? edgeLabel(edge) : `Accesso diretto → ${entry.to}, squadra ${entry.side.toUpperCase()}`, edge ? `${edgeId(edge)} data-bracket-transfer="true"` : `data-bracket-direct="${escape(entry.to)}:${entry.side}"`, true);
    }).join("");
  const diagramWidth = columns[lane.rounds.length - 1] + width + 12;
  return `<div class="bracket-lane"><h4>${lane.title}</h4>${lane.note ? `<p class="bracket-lane-note">${lane.note}</p>` : ""}<div class="bracket-scroll" tabindex="0" role="region" aria-label="Tabellone ${lane.title.toLowerCase()}"><div class="bracket-diagram" style="width:${diagramWidth}px;height:${lane.height}px"><svg class="bracket-connections" viewBox="0 0 ${diagramWidth} ${lane.height}" aria-hidden="true">${paths}</svg>${lane.rounds.map((title, i) => `<h5 class="bracket-round-label" style="left:${columns[i]}px">${title}</h5>`).join("")}${entries.map((entry) => entryMarkup(entry, matches.find((match) => match.id === entry.to), data, matches)).join("")}${Object.entries(nodes).map(([id, point]) => matchNode(matches.find((match) => match.id === id), data, matches, scoreMarkup, point)).join("")}</div></div><ul class="bracket-accessible-paths visually-hidden">${laneEdges.map((edge) => `<li>${escape(edgeLabel(edge))}</li>`).join("")}</ul></div>`;
}

function diagram(group, data, matches, edges, scoreMarkup) {
  return `<section class="bracket-path"><h3>${group.title}</h3><p class="bracket-scroll-hint">Scorri in orizzontale per seguire i turni →</p>${group.lanes.map((lane) => laneDiagram(lane, data, matches, edges, scoreMarkup)).join("")}${group.relegation ? `<p class="bracket-relegation">L’11ª e la 12ª classificata retrocedono in Serie B.</p>` : ""}</section>`;
}

/** Render the organizer's actual trees, including all winner/loser bypasses. */
export function finalBracket(data, scoreMarkup, standalone = false) {
  const matches = data.matches.filter((match) => match.phase === "finals");
  if (!matches.length) return "";
  const edges = bracketEdges(matches);
  const known = new Set(layouts.flatMap((group) => group.lanes.flatMap((lane) => Object.keys(lane.nodes))));
  const additional = matches.filter((match) => !known.has(match.id));
  return `<section class="final-bracket" id="final-bracket" tabindex="-1">${standalone ? "<h1>Tabellone finale</h1>" : '<h2><span class="phase-number">03</span> Tabellone finale</h2>'}<p class="bracket-legend"><span><i class="bracket-key"></i> Vincente (W)</span><span><i class="bracket-key bracket-key-loser"></i> Perdente (L)</span><span><i class="bracket-key bracket-key-direct"></i> Accesso diretto</span></p>${layouts.map((group) => diagram(group, data, matches, edges, scoreMarkup)).join("")}${additional.length ? `<section class="bracket-path"><h3>Altri incontri della fase finale</h3><div class="bracket-additional">${additional.map((match) => matchNode(match, data, matches, scoreMarkup)).join("")}</div></section>` : ""}</section>`;
}
