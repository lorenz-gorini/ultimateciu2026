import "./style.css";
import {
  PHASES,
  STATES,
  filterMatches,
  formatDate,
  matchState,
  normalizeSearch,
  requestData,
  validateData,
} from "./data.js";

const content = document.querySelector("#content");
const freshness = document.querySelector("#freshness");
const filters = { search: "", date: "", phase: "", status: "" };
const CACHE_KEY = "ciu2026-data-v1";
let data = null;
let error = null;
let busy = false;
let teamQuery = "";
let lastRoute = "";

const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const empty = (text) => `<div class="empty">${escape(text)}</div>`;
const team = (id) => data.teams.find((candidate) => candidate.id === id);
const teamLink = (id) =>
  `<a href="#/team/${encodeURIComponent(id)}">${escape(team(id).name)}</a>`;
const participant = (side) =>
  side.teamId
    ? teamLink(side.teamId)
    : `<span class="slot" title="Qualificazione non ancora risolta">${escape(side.slot)}</span>`;
const shown = (value) => (value === null ? "—" : escape(value));
const score = (match) =>
  `${shown(match.score.a)} <span aria-hidden="true">–</span> ${shown(match.score.b)}`;
const location = (match) =>
  `${escape(match.city || "Luogo da definire")} · ${escape(match.field || "Campo da definire")}`;
const timestamp = (iso) =>
  iso
    ? new Intl.DateTimeFormat("it-IT", {
        timeZone: "Europe/Rome",
        dateStyle: "short",
        timeStyle: "medium",
      }).format(new Date(iso))
    : "Non indicato nella fonte";

function ageText() {
  if (!data) return "";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(data.fetchedAt)) / 60000),
  );
  return minutes < 1
    ? "meno di un minuto fa"
    : minutes < 60
      ? `${minutes} min fa`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} ore fa`
        : `${Math.floor(minutes / 1440)} giorni fa`;
}

function renderFreshness() {
  const restoreFocus = document.activeElement?.id === "refresh";
  const restoreInfo = freshness.querySelector(".refresh-info")?.open;
  freshness.innerHTML = `<div class="freshness-meta"><p class="download">${data ? `Download: <strong>${escape(timestamp(data.fetchedAt))}</strong> <span class="age">· ${ageText()}</span>` : "Nessun download disponibile"}</p>
    <p class="source-updated">Foglio: <strong>${escape(timestamp(data?.sourceReportedAt))}</strong>${data?.sourceMode === "frozen" ? " · Copia locale" : ""}</p>
    <details class="refresh-info" ${restoreInfo ? "open" : ""}><summary>Come funziona Aggiorna</summary><p>Aggiorna legge l’ultima copia pubblicata. Il foglio viene importato separatamente; gli aggiornamenti possono arrivare in ritardo.</p></details>
    ${error ? `<p role="alert" class="error">Aggiornamento non riuscito. ${data ? `Dati conservati (${ageText()}).` : "Riprova con Aggiorna."} <span class="muted">${escape(error)}</span></p>` : ""}</div>
    <button id="refresh" ${busy ? "disabled" : ""}>${busy ? "Aggiornamento…" : "Aggiorna"}</button>`;
  document.querySelector("#refresh").addEventListener("click", refresh);
  if (restoreFocus)
    document.querySelector("#refresh").focus({ preventScroll: true });
}

function fixture(match) {
  const state = matchState(match);
  return `<article class="fixture" data-match="${escape(match.id)}">
    <div class="fixture-time"><time>${escape(match.start || "Da definire")}</time><span>${escape(match.end || "")}</span></div>
    <div class="fixture-teams">${participant(match.a)}<span class="versus">vs</span>${participant(match.b)}</div>
    <div class="fixture-result"><strong class="score">${score(match)}</strong><span class="status ${state}">${STATES[state]}</span></div>
    <div class="fixture-place"><span>${location(match)}</span><span>${PHASES[match.phase]}${match.pool ? ` · ${escape(data.pools.find((pool) => pool.id === match.pool)?.name || match.pool)}` : ""}</span></div>
    <a class="detail-link" href="#/match/${encodeURIComponent(match.id)}" aria-label="Dettagli ${escape(match.id)}">${escape(match.id)} <span aria-hidden="true">↗</span></a>
  </article>`;
}

function fixtureGroups(matches, anchors = false) {
  if (!matches.length) return empty("Nessuna partita da mostrare.");
  const groups = new Map();
  for (const match of matches) {
    const key = match.date || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  }
  return [...groups]
    .map(
      ([date, fixtures]) =>
        `<section class="date-group" ${anchors ? `id="date-${date || "unknown"}"` : ""}><h2>${escape(formatDate(date))}<span>${fixtures.length} ${fixtures.length === 1 ? "partita" : "partite"}</span></h2><div class="fixtures">${fixtures.map(fixture).join("")}</div></section>`,
    )
    .join("");
}

function options(values, selected) {
  return Object.entries(values)
    .map(
      ([value, label]) =>
        `<option value="${escape(value)}" ${value === selected ? "selected" : ""}>${escape(label)}</option>`,
    )
    .join("");
}

function schedule() {
  const dates = [
    ...new Set(data.matches.map((match) => match.date).filter(Boolean)),
  ].sort();
  const next = filterMatches(data, {}).find(
    (match) => matchState(match) === "scheduled",
  );
  content.innerHTML = `<div class="page-title schedule-title"><div><p class="eyebrow">Il campionato, partita per partita</p><h1>Partite</h1></div>${next ? `<button class="text-button" id="next-date">Prossima data: ${escape(formatDate(next.date, true))} ↓</button>` : ""}</div>
    <form class="filters" aria-label="Filtra partite" onsubmit="return false">
      <label class="search-label">Cerca squadra<input id="search" type="search" placeholder="Nome squadra o slot…" value="${escape(filters.search)}" /></label>
      <label>Data<select id="date">${options({ "": "Tutte le date", ...Object.fromEntries(dates.map((date) => [date, formatDate(date, true)])) }, filters.date)}</select></label>
      <label>Fase<select id="phase">${options({ "": "Tutte le fasi", ...PHASES }, filters.phase)}</select></label>
      <label>Stato<select id="status">${options({ "": "Tutti gli stati", ...STATES }, filters.status)}</select></label>
      <button type="button" id="reset" class="secondary">Azzera filtri</button>
    </form><p id="match-count" class="list-count" aria-live="polite"></p><div id="match-list"></div>`;
  for (const key of Object.keys(filters)) {
    document
      .querySelector(`#${key}`)
      .addEventListener(key === "search" ? "input" : "change", (event) => {
        filters[key] = event.target.value;
        updateMatches();
      });
  }
  document.querySelector("#reset").addEventListener("click", () => {
    for (const key of Object.keys(filters)) {
      filters[key] = "";
      document.querySelector(`#${key}`).value = "";
    }
    updateMatches();
  });
  document.querySelector("#next-date")?.addEventListener("click", () => {
    for (const key of Object.keys(filters)) {
      filters[key] = "";
      document.querySelector(`#${key}`).value = "";
    }
    updateMatches();
    document
      .querySelector(`#date-${next.date}`)
      ?.scrollIntoView({ block: "start" });
  });
  updateMatches();
}

function updateMatches() {
  const matches = filterMatches(data, filters);
  document.querySelector("#match-count").textContent =
    `${matches.length} di ${data.matches.length} partite · Gli slot indicano qualificazioni ancora da risolvere.`;
  document.querySelector("#match-list").innerHTML = matches.length
    ? fixtureGroups(matches, true)
    : empty("Nessuna partita corrisponde ai filtri. Prova ad azzerarli.");
}

function teamsPage() {
  content.innerHTML = `<div class="page-title"><div><p class="eyebrow">Le protagoniste del campionato</p><h1>Squadre</h1></div><span class="count-pill">${data.teams.length} squadre</span></div>
    <label class="team-search">Cerca una squadra<input type="search" id="team-search" placeholder="Nome della squadra…" value="${escape(teamQuery)}" /></label><div class="team-grid" id="team-list"></div>`;
  document.querySelector("#team-search").addEventListener("input", (event) => {
    teamQuery = event.target.value;
    updateTeams();
  });
  updateTeams();
}

function updateTeams() {
  const teams = data.teams.filter((team) =>
    normalizeSearch(team.name).includes(normalizeSearch(teamQuery)),
  );
  document.querySelector("#team-list").innerHTML = teams.length
    ? teams
        .map(
          (team) =>
            `<a class="team-card" href="#/team/${encodeURIComponent(team.id)}"><span class="eyebrow">Girone ${escape(team.pool)} · ${escape(team.slot)}</span><h2>${escape(team.name)}</h2><p>${escape(team.province)} <span aria-hidden="true">↗</span></p></a>`,
        )
        .join("")
    : empty("Nessuna squadra trovata.");
}

function playersTable(players) {
  return players.length
    ? `<div class="table-scroll"><table><caption>Giocatori pubblicati nella fonte · totali stagionali</caption><thead><tr><th>Giocatore</th><th>Assist</th><th>Mete</th><th>Totale</th></tr></thead><tbody>${players.map((player) => `<tr><td>${escape(player.givenName)} ${escape(player.surname)}</td><td>${shown(player.assists)}</td><td>${shown(player.goals)}</td><td>${shown(player.total)}</td></tr>`).join("")}</tbody></table></div>`
    : empty("Nessun giocatore ancora pubblicato nella fonte.");
}

function teamPage(id) {
  const selected = team(id);
  if (!selected) return unknown();
  const matches = filterMatches(data, {}).filter(
    (match) => match.a.teamId === id || match.b.teamId === id,
  );
  const entries = data.pools.flatMap((pool) =>
    pool.entries
      .filter((entry) => entry.teamId === id)
      .map((entry) => ({ ...entry, name: pool.name })),
  );
  content.innerHTML = `<a class="back" href="#/teams">← Tutte le squadre</a><div class="page-title"><div><p class="eyebrow">Girone ${selected.pool} · Slot ${selected.slot}</p><h1>${escape(selected.name)}</h1><p>${escape(selected.affiliation)} · ${escape(selected.province)}</p></div></div>
    <section><h2>Statistiche dei gironi</h2><div class="stats-line">${entries.map((entry) => `<div><strong>${escape(entry.name)}</strong><p>${shown(entry.points)} punti · ${shown(entry.goalsFor)} mete fatte · ${shown(entry.goalsAgainst)} subite</p></div>`).join("")}</div><p class="muted">Ordine e valori dal foglio; i punti iniziali a zero non determinano qualificazioni.</p></section>
    <section><h2>In programma</h2>${fixtureGroups(matches.filter((match) => ["scheduled", "unresolved"].includes(matchState(match))))}</section>
    <section><h2>Risultati registrati</h2>${fixtureGroups(matches.filter((match) => matchState(match) === "complete"))}</section>
    <section><h2>Risultati incompleti o non disponibili</h2>${fixtureGroups(matches.filter((match) => ["partial", "unreported"].includes(matchState(match))))}</section>
    <section><h2>Giocatori e statistiche</h2><p class="muted">Elenco della squadra pubblicato nella fonte, non roster verificato di una partita.</p>${playersTable(data.players.filter((player) => player.teamId === id))}<p>Roster non disponibile nella fonte. Statistiche individuali per partita non disponibili: gli slot numerati non sono associati agli ID delle partite.</p></section>`;
}

function slotMeaning(slot) {
  const rank = slot.match(/^([1-6])([XY])$/);
  if (rank) return `${rank[1]}ª classificata del girone ${rank[2]}`;
  const phase = slot.match(/^(\d+)P$/);
  if (phase)
    return `${phase[1]}ª nella classifica parziale dopo la seconda fase`;
  const outcome = slot.match(/^([WL])([QS])(\d+)$/);
  if (outcome)
    return `${outcome[1] === "W" ? "Vincente" : "Perdente"} ${outcome[2] === "Q" ? "quarto" : "semifinale"} ${outcome[2]}${outcome[3]}`;
  return slot;
}

function matchPage(id) {
  const match = data.matches.find((candidate) => candidate.id === id);
  if (!match) return unknown();
  const state = matchState(match);
  const evaluations = data.sotg.filter(
    (evaluation) =>
      evaluation.matchId === id &&
      [...evaluation.categories, evaluation.total, evaluation.comment].some(
        (value) => value !== null,
      ),
  );
  content.innerHTML = `<a class="back" href="#/">← Torna alle partite</a><p class="eyebrow">${escape(id)} · ${PHASES[match.phase]}</p><h1 class="match-heading">${participant(match.a)}<span>vs</span>${participant(match.b)}</h1>
    <div class="match-summary"><strong class="big-score">${score(match)}</strong><div><p class="status ${state}">${STATES[state]}</p><p>${escape(formatDate(match.date))} · ${escape(match.start || "Orario da definire")}${match.end ? `–${escape(match.end)}` : ""}</p><p>${location(match)}</p></div></div>
    ${[match.a, match.b]
      .filter((side) => !side.teamId)
      .map(
        (side) =>
          `<p class="muted">${escape(side.slot)}: ${escape(slotMeaning(side.slot))}. La fonte non ha ancora indicato la squadra.</p>`,
      )
      .join("")}
    <section><h2>Spirit of the Game <span class="muted">SOTG</span></h2><p>Valutazione dello spirito sportivo: ogni squadra valuta l’avversaria in cinque categorie.</p>
      ${evaluations.length ? evaluations.map((evaluation) => `<article class="evaluation"><h3>${teamLink(evaluation.evaluatingTeamId)} valuta ${teamLink(evaluation.evaluatedTeamId)}</h3><dl>${data.sotgCategories.map((category, index) => `<div><dt>${escape(category)}</dt><dd>${shown(evaluation.categories[index])}</dd></div>`).join("")}<div class="total"><dt>Totale</dt><dd>${shown(evaluation.total)}</dd></div></dl><p>${evaluation.comment === null ? "Commento non pubblicato" : escape(evaluation.comment)}</p></article>`).join("") : empty("Valutazioni non ancora pubblicate")}
      ${evaluations.length === 1 ? '<p class="muted">L’altra valutazione non è ancora pubblicata.</p>' : ""}</section>
    <section><h2>Giocatori della partita</h2>${empty("Roster non disponibile nella fonte")}<p>Statistiche individuali per questa partita non disponibili. Gli elenchi e i totali stagionali delle squadre sono consultabili nelle pagine ${
      [match.a, match.b]
        .filter((side) => side.teamId)
        .map((side) => teamLink(side.teamId))
        .join(" e ") || "delle squadre, quando risolte"
    }.</p></section>
    <p class="muted">Fonte: ${escape(match.provenance.sheet)}!${escape(match.provenance.range)} · <a href="${data.sourceUrl}?gid=1898128397&range=${encodeURIComponent(match.provenance.range)}" target="_blank" rel="noopener noreferrer">Vedi nel foglio ↗</a></p>`;
}

function poolTable(pool) {
  return `<section class="pool-card"><h3>${escape(pool.name)}</h3><div class="table-scroll"><table><caption class="sr-only">${escape(pool.name)} nell’ordine del foglio</caption><thead><tr><th>Squadra / slot</th><th>Pt.</th><th>M.f.</th><th>M.s.</th></tr></thead><tbody>${pool.entries.map((entry) => `<tr><td>${participant(entry)}${entry.teamId ? `<span class="small-slot">${escape(entry.slot)}</span>` : ""}</td><td>${shown(entry.points)}</td><td>${shown(entry.goalsFor)}</td><td>${shown(entry.goalsAgainst)}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function poolsPage() {
  content.innerHTML = `<div class="page-title"><div><p class="eyebrow">Dal primo girone alle finali</p><h1>Gironi e fasi</h1></div></div><p class="muted">Ordine del foglio originale. Pt. = punti, M.f. = mete fatte, M.s. = mete subite. “—” indica un valore non pubblicato.</p>
    <section><h2><span class="phase-number">01</span> Prima fase</h2><p>Due gironi da sei squadre. Ogni squadra incontra le altre cinque del proprio girone.</p><div class="pool-grid">${data.pools
      .filter((pool) => pool.phase === "first")
      .map(poolTable)
      .join(
        "",
      )}</div><p class="muted">Le classifiche iniziali a zero non assegnano le qualificazioni: X1 è uno slot iniziale, 1X è la futura prima classificata.</p></section>
    <section><h2><span class="phase-number">02</span> Seconda fase</h2><p>Tre pool. Si ereditano gli incontri già giocati e si affrontano solo le squadre dell’altro girone.</p><div class="pool-grid">${data.pools
      .filter((pool) => pool.phase === "second")
      .map(poolTable)
      .join("")}</div>
    <details><summary>Incontri ereditati (${data.carryovers.length}, esclusi dal calendario)</summary>${data.carryovers.map((carry) => `<p>${escape(data.pools.find((pool) => pool.id === carry.pool)?.name || carry.pool)}: ${participant(carry.a)} – ${participant(carry.b)} <span class="muted">${shown(carry.score.a)} – ${shown(carry.score.b)}</span></p>`).join("")}</details></section>
    <section><h2><span class="phase-number">03</span> Fase finale</h2><p>Progressione riportata nel foglio: W = vincente, L = perdente, Q = quarto, S = semifinale. Gli slot P indicano la classifica parziale dopo la seconda fase.</p>
      ${["Q", "S", "F"].map((prefix) => `<h3>${{ Q: "Quarti di finale", S: "Semifinali", F: "Finali di piazzamento" }[prefix]}</h3>${fixtureGroups(filterMatches(data, { phase: "finals" }).filter((match) => match.id.startsWith(prefix)))}`).join("")}</section>
    <section><h2>Classifica finale</h2>${data.finalClassification.length ? `<ol class="classification">${data.finalClassification.map((entry) => `<li value="${entry.position}">${teamLink(entry.teamId)}</li>`).join("")}</ol>` : empty("Classifica finale non ancora pubblicata")}</section>
    <details class="rules"><summary>Format e regolamento dalla fonte</summary>${data.rules.map((rule) => `<p>${escape(rule.text)}</p>`).join("")}</details>`;
}

function unknown() {
  content.innerHTML = `<h1>Pagina non trovata</h1><p>La squadra o la partita richiesta non è presente nei dati.</p><a href="#/">Torna alle partite</a>`;
}

function render({ navigation = false } = {}) {
  const route = locationHash();
  const active =
    route === "/" || route.startsWith("/match/")
      ? "schedule"
      : route.startsWith("/team")
        ? "teams"
        : "pools";
  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.dataset.nav === active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (!data) {
    content.innerHTML = `<h1>Partite</h1>${empty("Dati non disponibili. Usa Aggiorna per riprovare.")}`;
    return;
  }
  if (route === "/") schedule();
  else if (route === "/teams") teamsPage();
  else if (route === "/pools") poolsPage();
  else if (/^\/team\/[^/]+$/.test(route))
    teamPage(decodeURIComponent(route.split("/")[2]));
  else if (/^\/match\/[^/]+$/.test(route))
    matchPage(decodeURIComponent(route.split("/")[2]));
  else unknown();
  if (navigation && route !== lastRoute) {
    content.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  lastRoute = route;
}

function locationHash() {
  try {
    decodeURIComponent(window.location.hash);
    return window.location.hash.slice(1) || "/";
  } catch {
    return "/invalid";
  }
}

async function refresh() {
  if (busy) return;
  busy = true;
  const focusedId = document.activeElement?.id;
  const selection =
    document.activeElement instanceof HTMLInputElement
      ? document.activeElement.selectionStart
      : null;
  renderFreshness();
  const result = await requestData(
    `${import.meta.env.BASE_URL}data.json`,
    data,
  );
  // Avoid replacing focused links/controls on a poll of an unchanged deployment.
  const changed =
    result.data && JSON.stringify(result.data) !== JSON.stringify(data);
  data = result.data;
  error = result.error;
  busy = false;
  if (changed) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      /* In-memory data still works when storage is denied/full. */
    }
    render();
    const focus = document.getElementById(focusedId);
    if (focus) {
      focus.focus({ preventScroll: true });
      if (selection !== null && focus instanceof HTMLInputElement)
        focus.setSelectionRange(selection, selection);
    }
  } else if (!data) render();
  renderFreshness();
  if (focusedId === "refresh")
    document.querySelector("#refresh").focus({ preventScroll: true });
}

try {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) data = validateData(JSON.parse(cached));
} catch {
  /* An invalid cache must not stop a fresh network load. */
}
window.addEventListener("hashchange", () => render({ navigation: true }));
document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  content.focus();
  content.scrollIntoView({ block: "start" });
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refresh();
});
setInterval(() => {
  if (!document.hidden) refresh();
}, 90000);
setInterval(() => {
  if (!document.hidden) renderFreshness();
}, 60000);
if (data) render();
refresh();
