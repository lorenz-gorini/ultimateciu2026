import { formatDate } from "./data.js";
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

const matchHref = (id) => `#/match/${encodeURIComponent(id)}`;
const referenceText = (slot) => {
  const reference = /^([WL])(.+)$/.exec(slot);
  if (reference) return `${reference[1] === "W" ? "Vincente" : "Perdente"} ${reference[2]}`;
  const rank = /^(\d+)P$/.exec(slot);
  return rank ? `${rank[1]}ª dopo la seconda fase` : slot;
};

function participantMarkup(side, data, matches) {
  const resolved = bracketParticipant(side, matches);
  const name = data.teams.find((team) => team.id === resolved.teamId)?.name;
  const reference = /^([WL])(.+)$/.exec(side.slot);
  const source = reference && matches.some((match) => match.id === reference[2])
    ? `<a href="${matchHref(reference[2])}">${escape(referenceText(side.slot))}</a>`
    : escape(referenceText(side.slot));
  return `<div class="bracket-team">${name ? `<a class="bracket-team-name" href="#/team/${encodeURIComponent(resolved.teamId)}">${escape(name)}</a>` : `<span class="bracket-team-name">${source}</span>`}${name ? `<span class="bracket-origin">${source}${resolved.derived ? " · da risultato ufficiale" : ""}</span>` : ""}</div>`;
}

function matchCard(match, data, matches, edges, resultMarkup) {
  const destinations = edges.filter((edge) => edge.from === match.id);
  const date = formatDate(match.date, true);
  return `<article class="bracket-match" id="bracket-${escape(match.id)}" tabindex="-1" aria-label="${escape(match.id)}${placement[match.id] ? `, ${placement[match.id]}` : ""}">
    <div class="bracket-match-heading"><a href="${matchHref(match.id)}" aria-label="Dettagli partita ${escape(match.id)}">${escape(match.id)} ↗</a>${placement[match.id] ? `<strong>${placement[match.id]}</strong>` : ""}</div>
    <div class="bracket-contest">${participantMarkup(match.a, data, matches)}<div class="bracket-result" data-result="${escape(match.id)}">${resultMarkup(match)}</div>${participantMarkup(match.b, data, matches)}</div>
    <p class="bracket-time">${escape(date)} · ${escape(match.start || "Orario da definire")} · ${escape(match.field || "Campo da definire")}</p>
    ${destinations.length ? `<div class="bracket-next" aria-label="Percorso dopo ${escape(match.id)}">${destinations.map((edge) => `<button type="button" data-bracket-jump="${escape(edge.to)}">${edge.outcome === "W" ? "Vince" : "Perde"} → ${escape(edge.to)}${placement[edge.to] ? ` <span>(${placement[edge.to]})</span>` : ""}</button>`).join("")}</div>` : ""}
  </article>`;
}

/** The source's two six-team paths include byes and distinct winner/loser crossovers. */
export function finalBracket(data, resultMarkup) {
  const matches = data.matches.filter((match) => match.phase === "finals");
  if (!matches.length) return "";
  const edges = bracketEdges(matches);
  const groups = [
    { title: "Dal 1° al 6° posto", intro: "Le prime due della seconda fase entrano direttamente in semifinale. Le perdenti dei quarti giocano per il 5° posto.", rounds: [["Quarti", ["Q2", "Q1"]], ["Semifinali · 1°–4°", ["S1", "S2"]], ["Finali", ["F1", "F2", "F3"]]] },
    { title: "Dal 7° al 12° posto", intro: "Le vincenti dei quarti giocano per il 7° posto. Le perdenti incontrano l’undicesima e la dodicesima della seconda fase.", rounds: [["Quarti", ["Q4", "Q3"]], ["Semifinali · 9°–12°", ["S3", "S4"]], ["Finali", ["F4", "F5", "F6"]]] },
  ];
  const displayed = new Set(groups.flatMap((group) => group.rounds.flatMap(([, ids]) => ids)));
  const additional = matches.filter((match) => !displayed.has(match.id));
  return `<section class="final-bracket" id="final-bracket" tabindex="-1"><h2><span class="phase-number">03</span> Tabellone finale</h2><p>Seleziona <strong>Vince</strong> o <strong>Perde</strong> per seguire il percorso di una squadra.</p>
  ${groups.map((group) => `<section class="bracket-path"><h3>${group.title}</h3><p>${group.intro}</p><p class="bracket-scroll-hint">Scorri in orizzontale per seguire i turni →</p><div class="bracket-scroll" tabindex="0" role="region" aria-label="Tabellone ${group.title.toLowerCase()}"><div class="bracket-rounds">${group.rounds.map(([title, ids]) => `<div class="bracket-round"><h4>${title}</h4>${ids.map((id) => matches.find((match) => match.id === id)).filter(Boolean).map((match) => matchCard(match, data, matches, edges, resultMarkup)).join("")}</div>`).join("")}</div></div></section>`).join("")}${additional.length ? `<section class="bracket-path"><h3>Altri incontri della fase finale</h3><div class="bracket-additional">${additional.map((match) => matchCard(match, data, matches, edges, resultMarkup)).join("")}</div></section>` : ""}</section>`;
}

export function bindBracketNavigation(root) {
  root.querySelectorAll("[data-bracket-jump]").forEach((button) => button.addEventListener("click", () => {
    const target = root.querySelector(`#bracket-${CSS.escape(button.dataset.bracketJump)}`);
    target?.scrollIntoView({ block: "nearest", inline: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    target?.focus({ preventScroll: true });
  }));
}
