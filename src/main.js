import "./style.css";
import { REPORT_INTERVAL, inReportWindow, reportContext, reportView, requestReport, shouldCheckReport } from "./reports.js";
import { requestMatchPlayers, shouldCheckMatchPlayers } from "./match-players.js";
import { DIVISIONS, DIVISION_KEY, initialDivision, cacheKey } from "./divisions.js";
import {
  PHASES,
  STATES,
  filterMatches,
  evaluationFormOptions,
  formatDate,
  normalizeSearch,
  publicationIsStale,
  requestData,
  sortPlayersByTotal,
  validateData,
} from "./data.js";
import {
  normalizePreferences,
  readPreferences,
  savePreferences,
  selectTeam,
  shortcutTeamIds,
  toggleTeam,
} from "./preferences.js";

const content = document.querySelector("#content");
const freshness = document.querySelector("#freshness-controls");
const refreshStatus = document.querySelector("#refresh-status");
const filters = { search: "", teamIds: [], date: "", phase: "", status: "" };
let division = initialDivision(window.location.search, preferenceStorage());
let divisionRevision = 0;
const snapshots = new Map();
const reports = new Map();
const playerReports = new Map();
const pendingReports = new Set();
let reportTimer;
let data = null;
let error = null;
let busy = false;
let teamQuery = "";
let lastRoute = "";
let preferences = null;
let storageAvailable = true;
let chooserOpen = false;

function preferenceStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function reconcilePreferences() {
  if (!preferences) {
    const storage = preferenceStorage();
    storageAvailable = Boolean(storage);
    preferences = readPreferences(storage, data.teams, division);
  } else {
    preferences = normalizePreferences(preferences, data.teams);
  }
  filters.teamIds = preferences.selected;
}

function persistPreferences() {
  filters.teamIds = preferences.selected;
  storageAvailable = savePreferences(preferenceStorage(), preferences, division);
}

function updateDivisionHeader() {
  const selected = DIVISIONS[division];
  document.querySelector("#competition-title").textContent = `${selected.label} 2026`;
  document.title = `CIU ${selected.label} 2026`;
  document.querySelector(".brand").setAttribute("aria-label", `${document.title}, vai alle partite`);
  document.querySelectorAll("[data-source-link]").forEach((link) => { link.href = selected.sourceUrl; });
}

function restoreDivisionData() {
  data = snapshots.get(division) || null;
  if (!data) {
    try {
      const cached = preferenceStorage()?.getItem(cacheKey(division));
      if (cached) data = validateData(JSON.parse(cached), division);
    } catch {
      /* An invalid or wrong-division cache must not stop a fresh load. */
    }
  }
}

function changeDivision(id, { fromNavigation = false } = {}) {
  if (id === division || !Object.hasOwn(DIVISIONS, id)) return;
  if (data) snapshots.set(division, data);
  division = id;
  divisionRevision++; // A late response from the previous division must not redraw this one.
  busy = false;
  error = null;
  preferences = null;
  teamQuery = "";
  chooserOpen = false;
  Object.assign(filters, { search: "", teamIds: [], date: "", phase: "", status: "" });
  refreshStatus.hidden = true;
  try { preferenceStorage()?.setItem(DIVISION_KEY, division); } catch { /* Visit-only selection. */ }
  if (!fromNavigation) {
    const url = new URL(window.location.href);
    url.searchParams.set("division", division);
    url.hash = "/"; // A selector change starts at the chosen division's schedule.
    window.history.replaceState(null, "", url);
  }
  updateDivisionHeader();
  restoreDivisionData();
  render({ navigation: true });
  refresh();
  if (!fromNavigation) document.querySelector("#division")?.focus({ preventScroll: true });
}

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
const playerName = (player) => [player.givenName, player.surname].filter(Boolean).join(" ") || "Nome non indicato nella fonte";
const reportKey = (match) => `${division}:${match.id}`;
const reportAliases = () => DIVISIONS[division].reportTeamAliases || {};
const currentEntry = (entries, match) => {
  const entry = entries.get(reportKey(match));
  return entry?.context === reportContext(match, data.teams, reportAliases()) ? entry : null;
};
const currentReport = (match) => currentEntry(reports, match);
const currentPlayers = (match) => currentEntry(playerReports, match);
const resultView = (match, now) => reportView(match, currentReport(match), now);
const resultState = (match, now) => resultView(match, now).state;
const score = (match) => {
  const value = resultView(match).score;
  return `${shown(value.a)} <span aria-hidden="true">–</span> ${shown(value.b)}`;
};
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
  document.querySelector("#stale-warning").hidden = !publicationIsStale(data);
  const restoreFocus = document.activeElement?.id === "refresh";
  const restoreInfo = freshness.querySelector(".refresh-info")?.open;
  freshness.innerHTML = `<div class="freshness-meta"><p class="download">${data ? `Download: <strong>${escape(timestamp(data.fetchedAt))}</strong> <span class="age">· ${ageText()}</span>` : "Nessun download disponibile"}</p>
    <p class="source-updated">Foglio: <strong>${escape(timestamp(data?.sourceReportedAt))}</strong>${data?.sourceMode === "frozen" ? " · Copia locale" : ""}</p>
    <details class="refresh-info" ${restoreInfo ? "open" : ""}><summary>Come funziona Aggiorna</summary><p>Aggiorna legge l’ultima copia pubblicata del calendario e ricontrolla il report della partita aperta. GitHub importa il foglio principale ogni 15 minuti nel weekend e ogni ora nei feriali, con possibili ritardi. Il controllo automatico dei report avviene ogni 60 secondi solo tra 2 ore prima e 2 ore dopo l’inizio previsto, mentre questa scheda è visibile, e si ferma a fine partita. Roster e statistiche vengono letti anche all’apertura del dettaglio. Il risultato finale viene dalle colonne L–N di Partite.</p></details>
    ${error ? `<p role="alert" class="error">Aggiornamento non riuscito. ${data ? `Dati conservati (${ageText()}).` : "Riprova con Aggiorna."} <span class="muted">${escape(error)}</span></p>` : ""}</div>
    <button id="refresh" ${busy ? "disabled" : ""}>${busy ? "Aggiornamento…" : "Aggiorna"}</button>`;
  document.querySelector("#refresh").addEventListener("click", () =>
    refresh({ manual: true }),
  );
  if (restoreFocus)
    document.querySelector("#refresh").focus({ preventScroll: true });
}

function fixture(match) {
  return `<article class="fixture" data-match="${escape(match.id)}">
    <div class="fixture-time"><time>${escape(match.start || "Da definire")}</time><span>${escape(match.end || "")}</span></div>
    <div class="fixture-teams">${participant(match.a)}<span class="versus">vs</span>${participant(match.b)}</div>
    <div class="fixture-result" data-result="${escape(match.id)}">${resultMarkup(match)}</div>
    <div class="fixture-place"><span>${location(match)}</span><span>${PHASES[match.phase]}${match.pool ? ` · ${escape(data.pools.find((pool) => pool.id === match.pool)?.name || match.pool)}` : ""}</span></div>
    <a class="detail-link" href="#/match/${encodeURIComponent(match.id)}" aria-label="Dettagli ${escape(match.id)}">${escape(match.id)} <span aria-hidden="true">↗</span></a>
  </article>`;
}

function resultMarkup(match, detail = false) {
  const state = resultState(match);
  const entry = currentReport(match);
  const checked = ["live", "provisional", "report-stale"].includes(state) && entry?.checkedAt
    ? `<small class="report-checked">Report: ${escape(timestamp(entry.checkedAt))}</small>` : "";
  return `<strong class="${detail ? "big-score" : "score"}">${score(match)}</strong><span class="status ${state}">${STATES[state]}</span>${checked}`;
}

function reportMarkup(match) {
  if (!match.reportUrl) return '<p class="muted">Report non ancora disponibile nella fonte.</p>';
  const entry = currentReport(match);
  return `<a class="button-link secondary" href="${escape(match.reportUrl)}" target="_blank" rel="noopener noreferrer">Foglio di gara ↗</a>
    <p class="muted">${match.resultState === "complete" ? "Risultato finale dalle colonne L–N di Partite; il report non lo sostituisce." : "Parziale provvisorio dal Foglio di gara (LIVE). Il risultato è definitivo solo quando compare in Partite."} Controllo automatico ogni 60 secondi nella finestra di ±2 ore dall’inizio previsto, fino a fine partita.</p>
    <p class="muted">${entry?.checkedAt ? `Punteggio nel report verificato: ${escape(timestamp(entry.checkedAt))}.` : entry?.error ? "Nessuna lettura valida del punteggio nel report." : match.resultState === "complete" || !inReportWindow(match) ? "Controllo automatico del punteggio non attivo per questa partita. Puoi richiederlo con Aggiorna." : "Controllo del punteggio nel report…"}${entry?.report && !entry.report.start ? " Il report non indica ancora l’inizio della partita." : ""}</p>
    ${entry?.error ? `<p class="form-warning" role="status">Verifica report non riuscita: ${escape(entry.error)}. ${match.resultState === "complete" ? "Il risultato finale del calendario resta valido." : entry.report?.score ? "Ultimo parziale conservato e indicato come non live." : "Consulta il foglio originale."}</p>` : ""}`;
}

/** Patch score regions only, preserving focused controls and open evaluation menus. */
function updateReportDisplay() {
  if (!data) return;
  const active = content.contains(document.activeElement) ? document.activeElement : null;
  const focusedHref = active?.getAttribute("href");
  if (locationHash() === "/" && filters.status) updateMatches();
  content.querySelectorAll("[data-team-states]").forEach((node) => {
    const states = node.dataset.teamStates.split(",");
    const matches = filterMatches(data, {}).filter((match) => states.includes(resultState(match))
      && [match.a.teamId, match.b.teamId].includes(node.dataset.team));
    const membership = matches.map((match) => match.id).join(",");
    if (node.dataset.members !== membership) {
      node.innerHTML = fixtureGroups(matches);
      node.dataset.members = membership;
    }
  });
  content.querySelectorAll("[data-result]").forEach((node) => {
    const match = data.matches.find((candidate) => candidate.id === node.dataset.result);
    if (match) node.innerHTML = resultMarkup(match, node.dataset.detail === "true");
  });
  const panel = document.querySelector("#match-report");
  if (panel) {
    const match = data.matches.find((candidate) => candidate.id === panel.dataset.match);
    const markup = reportMarkup(match);
    if (panel.innerHTML !== markup) panel.innerHTML = markup;
  }
  const playersPanel = document.querySelector("#match-players");
  if (playersPanel) {
    const match = data.matches.find((candidate) => candidate.id === playersPanel.dataset.match);
    const markup = matchPlayersMarkup(match);
    if (playersPanel.dataset.renderedMarkup !== markup) {
      const openTeams = [...playersPanel.querySelectorAll("details[open]")].map((node) => node.dataset.team);
      const focusedTeam = active?.tagName === "SUMMARY" ? active.parentElement.dataset.team : null;
      playersPanel.innerHTML = markup;
      playersPanel.dataset.renderedMarkup = markup;
      playersPanel.querySelectorAll("details").forEach((node) => { node.open = openTeams.includes(node.dataset.team); });
      if (focusedTeam) [...playersPanel.querySelectorAll("details")].find((node) => node.dataset.team === focusedTeam)
        ?.querySelector("summary").focus({ preventScroll: true });
    }
  }
  if (active && !active.isConnected && focusedHref) {
    [...content.querySelectorAll("a[href]")].find((link) => link.getAttribute("href") === focusedHref)?.focus({ preventScroll: true });
  }
}

async function refreshReports({ manual = false } = {}) {
  if (!data || document.hidden) return { count: 0, failed: 0 };
  const requestedData = data, revision = divisionRevision;
  const openId = locationHash().startsWith("/match/") ? decodeURIComponent(locationHash().split("/")[2]) : null;
  const candidates = data.matches.map((match) => ({ match,
    scores: shouldCheckReport(match, currentReport(match), new Date(), manual && match.id === openId),
    players: match.id === openId && shouldCheckMatchPlayers(match, currentPlayers(match), currentReport(match), new Date(), manual),
  })).filter((task) => !pendingReports.has(reportKey(task.match)) && (task.scores || task.players));
  const keys = candidates.map((task) => reportKey(task.match));
  keys.forEach((key) => pendingReports.add(key));
  const check = async ({ match, scores, players }) => {
    const key = reportKey(match);
    try {
      const options = { aliases: reportAliases() };
      const [scoreEntry, playerEntry] = await Promise.all([
        scores ? requestReport(match, requestedData.teams, currentReport(match), options) : null,
        players ? requestMatchPlayers(match, requestedData.teams, currentPlayers(match), options) : null,
      ]);
      if (revision === divisionRevision && requestedData === data) {
        if (scoreEntry) reports.set(key, scoreEntry);
        if (playerEntry) playerReports.set(key, playerEntry);
      }
      return scoreEntry?.error || playerEntry?.error;
    } finally { pendingReports.delete(key); }
  };
  const outcomes = [];
  let next = 0;
  // At most four reports (eight small CSV requests) in flight at once.
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, async () => {
    while (next < candidates.length && revision === divisionRevision) {
      outcomes.push(await check(candidates[next++]));
    }
  }));
  keys.forEach((key) => pendingReports.delete(key));
  if (revision === divisionRevision) updateReportDisplay();
  clearTimeout(reportTimer);
  if (data && !document.hidden) {
    // Keep each report's 60-second cadence independent of JSON checks/navigation.
    const now = Date.now();
    const nextOpenId = locationHash().startsWith("/match/") ? decodeURIComponent(locationHash().split("/")[2]) : null;
    const later = new Date(now + REPORT_INTERVAL);
    const delays = data.matches.flatMap((match) => {
      const entries = [];
      if (shouldCheckReport(match, currentReport(match), later)) entries.push(currentReport(match));
      if (match.id === nextOpenId && shouldCheckMatchPlayers(match, currentPlayers(match), currentReport(match), later))
        entries.push(currentPlayers(match));
      return entries.map((entry) => entry ? Math.max(1000, entry.attemptedAt + REPORT_INTERVAL - now) : REPORT_INTERVAL);
    });
    reportTimer = setTimeout(() => refreshReports(), Math.min(REPORT_INTERVAL, ...delays));
  }
  return { count: candidates.length, failed: outcomes.filter(Boolean).length };
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

function divisionControl() {
  const labels = Object.fromEntries(Object.entries(DIVISIONS)
    .map(([id, entry]) => [id, `Divisione: ${entry.label}`]));
  return `<label class="division-picker"><span class="visually-hidden">Divisione</span><select id="division">${options(labels, division)}</select></label>`;
}

function schedule() {
  const dates = [
    ...new Set(data.matches.map((match) => match.date).filter(Boolean)),
  ].sort();
  content.innerHTML = `<h1 class="visually-hidden">Partite</h1>
    <form class="filters" aria-label="Filtra partite" onsubmit="return false">
      <div class="team-picker" id="team-picker">
        <div class="team-search-row">
          <div class="team-search-field"><label class="visually-hidden" for="search">Squadre</label>
            <div class="search-underline"><input id="search" type="search" autocomplete="off" placeholder="Cerca squadre o slot…" aria-describedby="team-search-help" aria-controls="team-options" value="${escape(filters.search)}" /><button type="button" id="toggle-teams" class="text-button" aria-label="Mostra o nascondi squadre" aria-expanded="${chooserOpen}" aria-controls="team-options">▾</button></div>
          </div>
          <div id="team-shortcuts" class="team-shortcuts" role="group" aria-label="Squadre recenti e selezionate" hidden></div>
        </div>
        <p id="team-search-help" class="visually-hidden"></p>
        <p id="preference-note" class="filter-help" hidden></p>
        <fieldset id="team-options" class="team-options" ${chooserOpen ? "" : "hidden"}><legend>Seleziona una o più squadre</legend>${data.teams.map((entry) => `<label class="team-option"><input type="checkbox" id="choose-${escape(entry.id)}" value="${escape(entry.id)}" /><span>${escape(entry.name)}</span></label>`).join("")}<p id="no-team-options" class="filter-help" hidden>Nessuna squadra trovata. Gli slot si cercano senza squadre selezionate.</p><div class="picker-footer"><button type="button" id="clear-recents" class="text-button">Cancella recenti</button></div></fieldset>
      </div>
      <div class="secondary-filters">
      ${divisionControl()}
      <label><span class="visually-hidden">Data</span><select id="date">${options({ "": "Tutte le date", ...Object.fromEntries(dates.map((date) => [date, formatDate(date, true)])) }, filters.date)}</select></label>
      <label><span class="visually-hidden">Fase</span><select id="phase">${options({ "": "Tutte le fasi", ...Object.fromEntries(Object.entries(PHASES).filter(([phase]) => data.matches.some((match) => match.phase === phase))) }, filters.phase)}</select></label>
      <label><span class="visually-hidden">Stato</span><select id="status">${options({ "": "Tutti gli stati", ...STATES }, filters.status)}</select></label>
      <button type="button" id="reset" class="secondary">Azzera filtri</button>
      </div>
    </form><p id="match-count" class="list-count" aria-live="polite"></p><div id="match-list"></div>`;
  for (const key of ["date", "phase", "status"]) {
    document
      .querySelector(`#${key}`)
      .addEventListener("change", (event) => {
        filters[key] = event.target.value;
        updateMatches();
      });
  }
  document.querySelector("#reset").addEventListener("click", resetFilters);
  const search = document.querySelector("#search");
  search.addEventListener("focus", () => setChooserOpen(true));
  search.addEventListener("click", () => setChooserOpen(true));
  search.addEventListener("input", () => {
    filters.search = search.value;
    setChooserOpen(true);
    updateTeamOptions();
    updateMatches();
  });
  document.querySelector("#toggle-teams").addEventListener("click", () => setChooserOpen(!chooserOpen));
  document.querySelector("#team-picker").addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      search.focus({ preventScroll: true });
      setChooserOpen(false);
    } else if (event.key === "ArrowDown" && event.target === search) {
      event.preventDefault();
      setChooserOpen(true);
      document.querySelector(".team-option:not([hidden]) input")?.focus();
    }
  });
  document.querySelector("#team-picker").addEventListener("focusout", (event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setChooserOpen(false);
  });
  document.querySelectorAll(".team-option input").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) chooseTeam(checkbox.value);
      else {
        preferences.selected = preferences.selected.filter((id) => id !== checkbox.value);
        selectionChanged();
      }
    });
  });
  document.querySelector("#clear-recents").addEventListener("click", () => {
    preferences.recent = [];
    persistPreferences();
    updateTeamControls();
    search.focus({ preventScroll: true });
  });
  updateTeamControls();
  updateMatches();
}

function setChooserOpen(open) {
  chooserOpen = open;
  document.querySelector("#team-options").hidden = !open;
  document.querySelector("#toggle-teams").setAttribute("aria-expanded", String(open));
}

function updateTeamOptions() {
  const query = normalizeSearch(filters.search);
  let visible = 0;
  document.querySelectorAll(".team-option input").forEach((checkbox) => {
    checkbox.checked = preferences.selected.includes(checkbox.value);
    const show = normalizeSearch(team(checkbox.value).name).includes(query);
    checkbox.closest("label").hidden = !show;
    if (show) visible++;
  });
  document.querySelector("#no-team-options").hidden = visible > 0;
}

function updateTeamControls() {
  const selected = preferences.selected;
  document.querySelector("#search").placeholder = selected.length ? "Aggiungi squadre…" : "Cerca squadre o slot…";
  document.querySelector("#team-search-help").textContent = selected.length
    ? "Le partite includono una qualsiasi delle squadre selezionate. Digita per aggiungerne altre."
    : "Digita per cercare, oppure seleziona una o più squadre.";
  const note = document.querySelector("#preference-note");
  note.hidden = storageAvailable;
  note.textContent = "Salvataggio sul browser non disponibile: preferenze valide solo durante questa visita.";
  const shortcuts = document.querySelector("#team-shortcuts");
  const ids = shortcutTeamIds(preferences);
  shortcuts.hidden = !ids.length;
  shortcuts.innerHTML = ids.map((id) => `<button type="button" class="team-shortcut" id="shortcut-${escape(id)}" data-team="${escape(id)}" aria-pressed="${selected.includes(id)}">${escape(team(id).name)}<span class="selection-mark" aria-hidden="true">${selected.includes(id) ? "✓" : "+"}</span></button>`).join("");
  shortcuts.querySelectorAll("[data-team]").forEach((button) => button.addEventListener("click", () => {
    preferences = toggleTeam(preferences, button.dataset.team);
    filters.search = "";
    document.querySelector("#search").value = "";
    selectionChanged();
    (document.getElementById(button.id) || document.querySelector("#search")).focus({ preventScroll: true });
  }));
  document.querySelector("#clear-recents").hidden = !preferences.recent.length;
  updateTeamOptions();
}

function selectionChanged() {
  persistPreferences();
  updateTeamControls();
  updateMatches();
}

function chooseTeam(id) {
  preferences = selectTeam(preferences, id);
  filters.search = "";
  document.querySelector("#search").value = "";
  selectionChanged();
}

function resetFilters() {
  preferences.selected = [];
  for (const key of ["search", "date", "phase", "status"]) {
    filters[key] = "";
    document.querySelector(`#${key}`).value = "";
  }
  setChooserOpen(false);
  selectionChanged();
}

function updateMatches() {
  const matches = filterMatches(data, filters, new Date(), resultState);
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
    ? `<div class="table-scroll"><table><caption>Giocatori pubblicati nella fonte · totali stagionali</caption><thead><tr><th>Giocatore</th><th>Assist</th><th>Mete</th><th aria-sort="descending">Totale</th></tr></thead><tbody>${sortPlayersByTotal(players).map((player) => `<tr><td>${escape(playerName(player))}</td><td>${shown(player.assists)}</td><td>${shown(player.goals)}</td><td>${shown(player.total)}</td></tr>`).join("")}</tbody></table></div>`
    : empty("Nessun giocatore ancora pubblicato nella fonte.");
}

function matchRosterTable(players, caption) {
  return `<div class="table-scroll"><table class="roster-table"><caption>${escape(caption)}</caption>
    <thead><tr><th scope="col">N°</th><th scope="col">Giocatore</th><th scope="col">Assist</th><th scope="col">Mete</th><th scope="col" aria-sort="descending">Totale</th></tr></thead>
    <tbody>${sortPlayersByTotal(players).map((player) => `<tr${player.mvp ? ' class="mvp-row"' : ""}><td>${shown(player.number)}</td><td>${escape(playerName(player))}${player.mvp ? '<span class="mvp-badge" title="MVP eletto e indicato nel report">MVP</span>' : ""}</td><td>${shown(player.assists)}</td><td>${shown(player.goals)}</td><td>${shown(player.total)}</td></tr>`).join("")}</tbody></table></div>`;
}

function matchPlayersMarkup(match) {
  const heading = "<h2>Giocatori della partita</h2>";
  if (!match.reportUrl) return `${heading}${empty("Roster e statistiche non ancora collegati nella fonte.")}`;
  const entry = currentPlayers(match);
  const status = entry?.checkedAt ? `Roster e statistiche verificati: ${escape(timestamp(entry.checkedAt))}.`
    : entry?.error ? "Nessuna lettura valida di roster e statistiche." : "Caricamento di roster e statistiche dal report…";
  const warning = entry?.error ? `<p class="form-warning" role="status">${escape(entry.error)}. ${entry.data ? "Ultima lettura valida conservata." : "Riprova con Aggiorna o consulta il Foglio di gara."}</p>` : "";
  const rosters = entry?.data?.rosters.map((roster) => {
    const present = roster.players.filter((player) => player.present === true);
    const unmarked = roster.players.filter((player) => player.present !== true);
    const mvps = roster.players.filter((player) => player.mvp);
    return `<article class="match-roster"><h3>${teamLink(roster.teamId)} <span class="muted">${present.length} presenze segnate</span></h3>
      <p class="mvp-summary">${mvps.length ? `<strong>MVP:</strong> ${mvps.map((player) => escape(playerName(player))).join(", ")}` : "MVP non indicato nel report."}</p>
      ${present.length ? matchRosterTable(present, "Presenze segnate nel report · statistiche della partita")
        : empty(roster.players.length ? "Il report non indica ancora le presenze." : "Roster non ancora compilato nel report.")}
      ${unmarked.length ? `<details data-team="${escape(roster.teamId)}"><summary>Altri nomi nel roster: ${unmarked.length} · presenza non segnata</summary>${matchRosterTable(unmarked, "Presenza non segnata nel report")}</details>` : ""}</article>`;
  }).join("") || "";
  return `${heading}<p class="muted">${status}</p>${warning}${rosters}
    ${entry?.data ? '<p class="muted">— = dato non pubblicato. Le presenze sono quelle segnate nel report; i nomi senza segno non sono considerati assenti. Assist, mete e totale si riferiscono a questa partita.</p>' : ""}`;
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
  const group = (states) => {
    const selected = matches.filter((match) => states.includes(resultState(match)));
    return `<div data-team="${escape(id)}" data-team-states="${states.join(",")}" data-members="${selected.map((match) => match.id).join(",")}">${fixtureGroups(selected)}</div>`;
  };
  content.innerHTML = `<a class="back" href="#/teams">← Tutte le squadre</a><div class="page-title"><div><p class="eyebrow">Girone ${selected.pool} · Slot ${selected.slot}</p><h1>${escape(selected.name)}</h1><p>${escape(selected.affiliation)} · ${escape(selected.province)}</p></div></div>
    <section><h2>Statistiche dei gironi</h2><div class="stats-line">${entries.map((entry) => `<div><strong>${escape(entry.name)}</strong><p>${shown(entry.points)} punti · ${shown(entry.goalsFor)} mete fatte · ${shown(entry.goalsAgainst)} subite</p></div>`).join("")}</div><p class="muted">Ordine e valori dal foglio; i punti iniziali a zero non determinano qualificazioni.</p></section>
    <section><h2>In programma</h2>${group(["scheduled", "unresolved"])}</section>
    <section><h2>Parziali dal report</h2>${group(["live", "provisional", "report-stale"])}</section>
    <section><h2>Risultati registrati</h2>${group(["complete"])}</section>
    <section><h2>Risultati incompleti o non disponibili</h2>${group(["partial", "unreported"])}</section>
    <section class="players-section"><h2>Giocatori e statistiche</h2><p class="muted">Elenco della squadra pubblicato nella fonte, non roster verificato di una partita.</p>${playersTable(data.players.filter((player) => player.teamId === id))}<p>Questi sono totali stagionali. Apri una partita per consultare le presenze e le statistiche disponibili nel suo report.</p></section>`;
}

function slotMeaning(slot) {
  const rank = slot.match(/^([1-6])([XYZ])$/);
  if (rank) return `${rank[1]}ª classificata del girone ${rank[2]}`;
  const phase = slot.match(/^(\d+)P$/);
  if (phase)
    return `${phase[1]}ª nella classifica parziale dopo la seconda fase`;
  const outcome = slot.match(/^([WL])([QS])(\d+)$/);
  if (outcome)
    return `${outcome[1] === "W" ? "Vincente" : "Perdente"} ${outcome[2] === "Q" ? "quarto" : "semifinale"} ${outcome[2]}${outcome[3]}`;
  return slot;
}

function evaluationFormControl(forms) {
  if (!forms.length) return "";
  if (forms.length === 1) {
    return `<a class="button-link" href="${escape(forms[0].url)}" target="_blank" rel="noopener noreferrer">Valuta ↗</a>`;
  }
  const links = forms.map((form) =>
    `<a class="evaluation-form-link" href="${escape(form.url)}" target="_blank" rel="noopener noreferrer">${escape(form.label)} ↗</a>`,
  ).join("");
  return `<details class="evaluation-forms"><summary class="button-link">Valuta</summary>
    <div><p>Quale squadra sta valutando?</p>${links}</div></details>`;
}

function matchPage(id) {
  const match = data.matches.find((candidate) => candidate.id === id);
  if (!match) return unknown();
  const forms = evaluationFormOptions(data, id);
  const evaluations = data.sotg.filter(
    (evaluation) =>
      evaluation.matchId === id &&
      [...evaluation.categories, evaluation.total, evaluation.comment].some(
        (value) => value !== null,
      ),
  );
  content.innerHTML = `<a class="back" href="#/">← Torna alle partite</a><p class="eyebrow">${escape(id)} · ${PHASES[match.phase]}</p><h1 class="match-heading">${participant(match.a)}<span>vs</span>${participant(match.b)}</h1>
    <div class="match-summary"><div class="match-result" data-result="${escape(id)}" data-detail="true" aria-live="polite">${resultMarkup(match, true)}</div><div><p>${escape(formatDate(match.date))} · ${escape(match.start || "Orario da definire")}${match.end ? `–${escape(match.end)}` : ""}</p><p>${location(match)}</p></div></div>
    <section id="match-report" data-match="${escape(id)}" aria-label="Aggiornamento report">${reportMarkup(match)}</section>
    ${[match.a, match.b]
      .filter((side) => !side.teamId)
      .map(
        (side) =>
          `<p class="muted">${escape(side.slot)}: ${escape(slotMeaning(side.slot))}. La fonte non ha ancora indicato la squadra.</p>`,
      )
      .join("")}
    <section><div class="section-heading"><h2>Spirit of the Game <span class="muted">SOTG</span></h2>${evaluationFormControl(forms)}</div><p>Valutazione dello spirito sportivo: ogni squadra valuta l’avversaria in cinque categorie.</p>
      ${forms.some((form) => form.warning) ? '<p class="form-warning">Il link originale precompila squadre diverse da quelle di questa partita. Controlla e correggi i campi squadra nel modulo prima di inviarlo.</p>' : ""}
      ${!forms.length ? '<p class="muted">Link di valutazione non disponibile nella fonte.</p>' : ""}
      ${evaluations.length ? evaluations.map((evaluation) => `<article class="evaluation"><h3>${teamLink(evaluation.evaluatingTeamId)} valuta ${teamLink(evaluation.evaluatedTeamId)}</h3><dl>${data.sotgCategories.map((category, index) => `<div><dt>${escape(category)}</dt><dd>${shown(evaluation.categories[index])}</dd></div>`).join("")}<div class="total"><dt>Totale</dt><dd>${shown(evaluation.total)}</dd></div></dl><p>${evaluation.comment === null ? "Commento non pubblicato" : escape(evaluation.comment)}</p></article>`).join("") : empty("Valutazioni non ancora pubblicate")}
      ${evaluations.length === 1 ? '<p class="muted">L’altra valutazione non è ancora pubblicata.</p>' : ""}</section>
    <section class="players-section" id="match-players" data-match="${escape(id)}">${matchPlayersMarkup(match)}</section>
    <p class="muted">Fonte: ${escape(match.provenance.sheet)}!${escape(match.provenance.range)} · <a href="${data.sourceUrl}?gid=1898128397&range=${encodeURIComponent(match.provenance.range)}" target="_blank" rel="noopener noreferrer">Vedi nel foglio ↗</a></p>`;
}

function poolTable(pool) {
  return `<section class="pool-card"><h3>${escape(pool.name)}</h3><div class="table-scroll"><table><caption class="sr-only">${escape(pool.name)} nell’ordine del foglio</caption><thead><tr><th>Squadra / slot</th><th>Pt.</th><th>M.f.</th><th>M.s.</th></tr></thead><tbody>${pool.entries.map((entry) => `<tr><td>${participant(entry)}${entry.teamId ? `<span class="small-slot">${escape(entry.slot)}</span>` : ""}</td><td>${shown(entry.points)}</td><td>${shown(entry.goalsFor)}</td><td>${shown(entry.goalsAgainst)}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function poolsPage() {
  const initialPools = data.pools.filter((pool) => pool.phase === "first");
  const secondPools = data.pools.filter((pool) => pool.phase === "second");
  const hasFinals = data.matches.some((match) => match.phase === "finals");
  content.innerHTML = `<div class="page-title"><div><p class="eyebrow">Dai gironi ai piazzamenti</p><h1>Gironi e fasi</h1></div></div><p class="muted">Ordine del foglio originale. Pt. = punti, M.f. = mete fatte, M.s. = mete subite. “—” indica un valore non pubblicato.</p>
    <section><h2><span class="phase-number">01</span> Prima fase</h2><p>${initialPools.length} gironi: ${initialPools.map((pool) => `${escape(pool.id)} (${pool.entries.length} squadre)`).join(", ")}. Ogni squadra incontra le altre del proprio girone.</p><div class="pool-grid">${initialPools
      .map(poolTable)
      .join(
        "",
      )}</div><p class="muted">Le classifiche iniziali a zero non assegnano le qualificazioni: X1 è uno slot iniziale, 1X è la futura prima classificata.</p></section>
    <section><h2><span class="phase-number">02</span> Seconda fase</h2><p>${secondPools.length} pool. ${data.carryovers.length ? "Si ereditano gli incontri già giocati e si affrontano solo le squadre dell’altro girone." : "Power pool per i piazzamenti finali, secondo gli slot pubblicati nella fonte. Non è prevista una fase a eliminazione diretta."}</p><div class="pool-grid">${secondPools
      .map(poolTable)
      .join("")}</div>
    ${data.carryovers.length ? `<details><summary>Incontri ereditati (${data.carryovers.length}, esclusi dal calendario)</summary>${data.carryovers.map((carry) => `<p>${escape(data.pools.find((pool) => pool.id === carry.pool)?.name || carry.pool)}: ${participant(carry.a)} – ${participant(carry.b)} <span class="muted">${shown(carry.score.a)} – ${shown(carry.score.b)}</span></p>`).join("")}</details>` : ""}</section>
    ${hasFinals ? `<section><h2><span class="phase-number">03</span> Fase finale</h2><p>Progressione riportata nel foglio: W = vincente, L = perdente, Q = quarto, S = semifinale. Gli slot P indicano la classifica parziale dopo la seconda fase.</p>
      ${["Q", "S", "F"].map((prefix) => `<h3>${{ Q: "Quarti di finale", S: "Semifinali", F: "Finali di piazzamento" }[prefix]}</h3>${fixtureGroups(filterMatches(data, { phase: "finals" }).filter((match) => match.id.startsWith(prefix)))}`).join("")}</section>` : ""}
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
    content.innerHTML = `<h1>Partite</h1><div class="secondary-filters">${divisionControl()}</div>${empty(busy ? "Caricamento delle partite…" : "Dati non disponibili. Usa Aggiorna per riprovare.")}`;
    return;
  }
  reconcilePreferences();
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

async function refresh({ manual = false } = {}) {
  if (busy) return;
  const revision = divisionRevision;
  const requestedDivision = division;
  const restoreRefreshFocus = document.activeElement?.id === "refresh";
  busy = true;
  if (manual) {
    refreshStatus.hidden = false;
    refreshStatus.textContent = "Verifica della copia pubblicata…";
  }
  renderFreshness();
  if (!data) render();
  const result = await requestData(
    `${import.meta.env.BASE_URL}${DIVISIONS[requestedDivision].dataFile}`,
    data,
    fetch,
    requestedDivision,
  );
  if (revision !== divisionRevision) return;
  // Avoid replacing focused links/controls on a poll of an unchanged deployment.
  const changed =
    result.data && JSON.stringify(result.data) !== JSON.stringify(data);
  data = result.data;
  error = result.error;
  if (manual) {
    const checkedAt = new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      timeStyle: "medium",
    }).format(new Date());
    refreshStatus.textContent = error
      ? `Verifica non riuscita alle ${checkedAt}. ${data ? "Ultimi dati validi conservati." : "Riprova con Aggiorna."}`
      : `Verificato alle ${checkedAt}: ${changed ? "nuova copia caricata." : "nessuna nuova copia pubblicata."}`;
  }
  if (changed) {
    // Capture focus after the request: the user may have typed or navigated meanwhile.
    const active = document.activeElement;
    const focusedId = active?.id;
    const selection = active instanceof HTMLInputElement && active.selectionStart !== null
      ? [active.selectionStart, active.selectionEnd, active.selectionDirection]
      : null;
    try {
      localStorage.setItem(cacheKey(requestedDivision), JSON.stringify(data));
    } catch {
      /* In-memory data still works when storage is denied/full. */
    }
    render();
    const focus = document.getElementById(focusedId);
    if (focus) {
      focus.focus({ preventScroll: true });
      if (selection !== null && focus instanceof HTMLInputElement)
        focus.setSelectionRange(...selection);
    }
  } else if (!data) render();
  renderFreshness();
  const reportResult = await refreshReports({ manual });
  if (revision !== divisionRevision) return;
  busy = false;
  renderFreshness();
  if (manual && reportResult.count) {
    refreshStatus.textContent += ` Report verificati: ${reportResult.count - reportResult.failed}/${reportResult.count}.${reportResult.failed ? " Alcuni report non sono disponibili: consulta il dettaglio della partita." : ""}`;
  }
  if (restoreRefreshFocus && document.activeElement === document.body)
    document.querySelector("#refresh").focus({ preventScroll: true });
}

content.addEventListener("change", (event) => {
  if (event.target.id === "division") changeDivision(event.target.value);
});
updateDivisionHeader();
restoreDivisionData();
const initialUrl = new URL(window.location.href);
initialUrl.searchParams.set("division", division);
window.history.replaceState(null, "", initialUrl);
function onNavigation() {
  const requested = initialDivision(window.location.search);
  if (requested !== division) changeDivision(requested, { fromNavigation: true });
  else {
    render({ navigation: true });
    refreshReports();
  }
}
window.addEventListener("hashchange", onNavigation);
window.addEventListener("popstate", onNavigation);
document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  content.focus();
  content.scrollIntoView({ block: "start" });
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { updateReportDisplay(); refresh(); }
});
setInterval(() => {
  if (!document.hidden) refresh();
}, 90000);
setInterval(() => {
  if (!document.hidden) { renderFreshness(); updateReportDisplay(); }
}, REPORT_INTERVAL);
if (data) render();
refresh();
