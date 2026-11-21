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

const columns = [20, 350, 680];
const width = 190;
const teamOffset = { a: 16, b: 64 };
const layouts = [
  { title: "Dal 1° al 6° posto", nodes: { Q2: [0, 80], Q1: [0, 240], S1: [1, 80], S2: [1, 240], F1: [2, 80], F2: [2, 240], F3: [2, 440] } },
  { title: "Dal 7° al 12° posto", relegation: true, nodes: { Q4: [0, 80], Q3: [0, 240], S3: [1, 80], S4: [1, 240], F4: [2, 440], F5: [2, 80], F6: [2, 240] } },
];

function participantMarkup(side, data, matches, position) {
  const resolved = bracketParticipant(side, matches);
  const name = data.teams.find((team) => team.id === resolved.teamId)?.name;
  const label = name || referenceText(side.slot) || "Squadra da definire";
  const provenance = name ? ` · ${referenceText(side.slot)}${resolved.derived ? " · da risultato ufficiale" : ""}` : "";
  return `<div class="bracket-team bracket-team-${position}" data-bracket-side="${position}" title="${escape(label + provenance)}">${name ? `<a href="#/team/${encodeURIComponent(resolved.teamId)}">${escape(name)}</a>` : `<span>${escape(label)}</span>`}</div>`;
}

function matchNode(match, data, matches, scoreMarkup, point) {
  const style = point ? ` style="left:${columns[point[0]]}px;top:${point[1]}px"` : "";
  return `<article class="bracket-match" id="bracket-${escape(match.id)}"${style} aria-label="${escape(match.id)}${placement[match.id] ? `, ${placement[match.id]}` : ""}"><div class="bracket-match-label">${escape(match.id)}${placement[match.id] ? ` · ${placement[match.id]}` : ""}</div>${participantMarkup(match.a, data, matches, "a")}<div class="bracket-result" data-bracket-result="${escape(match.id)}">${scoreMarkup(match)}</div>${participantMarkup(match.b, data, matches, "b")}</article>`;
}

/** Elbows occupy gutters; quarter-to-final paths bypass semifinals below. */
function connection(edge, nodes) {
  const from = nodes[edge.from];
  const to = nodes[edge.to];
  const x1 = columns[from[0]] + width;
  const y1 = from[1] + (edge.outcome === "W" ? 34 : 46);
  const x2 = columns[to[0]];
  const y2 = to[1] + teamOffset[edge.side];
  if (to[0] - from[0] > 1) {
    const lane = edge.side === "a" ? 390 : 410;
    const exit = edge.side === "a" ? 230 : 245;
    const entry = edge.side === "a" ? 650 : 665;
    return `M ${x1} ${y1} H ${exit} V ${lane} H ${entry} V ${y2} H ${x2}`;
  }
  const rail = x1 + (edge.outcome === "W" ? 50 : 78) + (from[1] > 100 ? 14 : 0);
  return `M ${x1} ${y1} H ${rail} V ${y2} H ${x2}`;
}

function diagram(group, data, matches, edges, scoreMarkup) {
  const nodes = Object.fromEntries(Object.entries(group.nodes).filter(([id]) => matches.some((match) => match.id === id)));
  const groupEdges = edges.filter((edge) => nodes[edge.from] && nodes[edge.to]);
  const paths = groupEdges.map((edge) => {
    const d = connection(edge, nodes);
    const label = `${edge.outcome === "W" ? "Vincente" : "Perdente"} ${edge.from} → ${edge.to}, squadra ${edge.side.toUpperCase()}`;
    return `<g class="bracket-connection bracket-connection-${edge.outcome}" data-bracket-edge="${escape(edge.from)}:${escape(edge.to)}:${edge.side}:${edge.outcome}"><title>${escape(label)}</title><path class="bracket-wire-halo" d="${d}"/><path class="bracket-wire" d="${d}"/></g>`;
  }).join("");
  const accessiblePaths = groupEdges.map((edge) => `<li>${edge.outcome === "W" ? "Vincente" : "Perdente"} ${escape(edge.from)} → ${escape(edge.to)}, squadra ${edge.side.toUpperCase()}</li>`).join("");
  return `<section class="bracket-path"><h3>${group.title}</h3><p class="bracket-scroll-hint">Scorri in orizzontale per seguire i turni →</p><div class="bracket-scroll" tabindex="0" role="region" aria-label="Tabellone ${group.title.toLowerCase()}"><div class="bracket-diagram"><svg class="bracket-connections" viewBox="0 0 900 540" aria-hidden="true">${paths}</svg>${["Quarti", "Semifinali", "Finali"].map((title, i) => `<h4 class="bracket-round-label" style="left:${columns[i]}px">${title}</h4>`).join("")}${Object.entries(nodes).map(([id, point]) => matchNode(matches.find((match) => match.id === id), data, matches, scoreMarkup, point)).join("")}</div></div><ul class="bracket-accessible-paths visually-hidden">${accessiblePaths}</ul>${group.relegation ? `<p class="bracket-relegation">L’11ª e la 12ª classificata retrocedono in Serie B.</p>` : ""}</section>`;
}

/** Render the organizer's actual trees, including all winner/loser bypasses. */
export function finalBracket(data, scoreMarkup) {
  const matches = data.matches.filter((match) => match.phase === "finals");
  if (!matches.length) return "";
  const edges = bracketEdges(matches);
  const known = new Set(layouts.flatMap((group) => Object.keys(group.nodes)));
  const additional = matches.filter((match) => !known.has(match.id));
  return `<section class="final-bracket" id="final-bracket" tabindex="-1"><h2><span class="phase-number">03</span> Tabellone finale</h2><p class="bracket-legend"><span><i class="bracket-key"></i> Vincente (W)</span><span><i class="bracket-key bracket-key-loser"></i> Perdente (L)</span></p>${layouts.map((group) => diagram(group, data, matches, edges, scoreMarkup)).join("")}${additional.length ? `<section class="bracket-path"><h3>Altri incontri della fase finale</h3><div class="bracket-additional">${additional.map((match) => matchNode(match, data, matches, scoreMarkup)).join("")}</div></section>` : ""}</section>`;
}
