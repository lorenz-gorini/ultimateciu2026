import { escapeHtml as escape } from "./html.js";

export const MATCH_TABS = { charts: "Andamento", timeline: "Cronaca", players: "Giocatori", spirit: "Spirit of the Game" };
const namesFor = (match, teams) => Object.fromEntries(["a", "b"].map((side) =>
  [side, teams.find((team) => team.id === match[side].teamId)?.name || match[side].slot]));
const minute = (goal) => goal.minute === null ? "Minuto non indicato" : `${goal.minute}′`;
const scoreText = (score) => `${score.a}–${score.b}`;
const breakBadge = (goal) => goal.isBreak ? '<span class="break-badge">BREAK</span>' : "";

function waiting(match, entry) {
  if (!match.reportUrl) return '<div class="empty">Foglio di gara non ancora collegato.</div>';
  if (entry?.error && !entry.report) return '<div class="empty">Andamento non disponibile. Riprova con Aggiorna o apri il foglio di gara.</div>';
  return `<div class="empty">${entry?.report ? "Nessuna meta registrata nel report." : "Caricamento delle mete dal foglio di gara…"}</div>`;
}

export function reportWarnings(match, entry) {
  const report = entry?.report;
  if (!report) return "";
  const messages = [];
  if (entry.error) messages.push("Lettura del report non riuscita: è conservata l’ultima sequenza valida.");
  if (match.resultState === "complete" && report.score && scoreText(match.score) !== scoreText(report.score))
    messages.push(`Il report indica ${scoreText(report.score)}, il calendario ${scoreText(match.score)}. Il risultato ufficiale resta quello del calendario.`);
  if (report.goals.some((goal) => goal.teamMismatch))
    messages.push("Alcuni nomi squadra nelle righe del report non coincidono: i colori seguono gli incrementi del parziale.");
  if (report.goals.some((goal) => goal.breakUnrecognized))
    messages.push("Alcune indicazioni di break non sono riconosciute e non vengono conteggiate.");
  return messages.map((message) => `<p class="form-warning" role="status">${escape(message)}</p>`).join("");
}

export function scoreSequence(match, teams, entry) {
  const report = entry?.report;
  if (!report?.goals.length) return waiting(match, entry);
  const names = namesFor(match, teams);
  return `${reportWarnings(match, entry)}<div class="table-scroll score-sequence" tabindex="0" role="region" aria-label="Progressione meta per meta">
    <table><caption>Meta per meta</caption><thead><tr><th scope="col">Squadra</th>${report.goals.map((goal) =>
      `<th scope="col" ${goal.number === report.halftime ? 'class="half-boundary" title="Ultima meta prima dell’intervallo"' : ""}>${goal.number}</th>`).join("")}<th scope="col">Totale report</th></tr></thead>
    <tbody>${["a", "b"].map((side) => `<tr class="team-${side}"><th scope="row"><span class="team-dot" aria-hidden="true"></span>${escape(names[side])}</th>${report.goals.map((goal) =>
      `<td class="${goal.side === side ? "point-scored" : ""} ${goal.side === side && goal.isBreak ? "point-break" : ""} ${goal.number === report.halftime ? "half-boundary" : ""}" title="Meta ${goal.number}: ${escape(names[goal.side])}, ${minute(goal)}${goal.isBreak ? ', break segnalato' : ''}">${goal.score[side]}${goal.side === side && goal.isBreak ? '<small aria-label="Break segnalato">BR</small>' : ""}</td>`).join("")}<td class="report-total">${report.score[side]}</td></tr>`).join("")}</tbody></table></div>
    <p class="score-legend">Ogni colonna è una meta. <strong>BR</strong> indica un break segnalato nel foglio di gara; la linea verticale separa i tempi quando l’intervallo è indicato.</p>`;
}

/** Time-mode gaps stay disconnected: missing goal minutes are never interpolated. */
export function chartSegments(report, side, axis = "point") {
  const segments = [[{ x: 0, y: 0 }]];
  let previous = { number: 0, score: { a: 0, b: 0 } };
  for (const goal of report.goals) {
    const x = axis === "time" ? goal.minute : goal.number;
    if (x === null) { previous = null; continue; }
    if (!previous) segments.push([{ x, y: goal.score[side] }]);
    else segments.at(-1).push({ x, y: previous.score[side] }, { x, y: goal.score[side] });
    previous = goal;
  }
  return segments;
}

function chart(report, names, matchId, axis) {
  const width = 760, height = 260, left = 44, right = 18, top = 18, bottom = 38;
  const xMax = Math.max(1, ...report.goals.map((goal) => axis === "time" ? goal.minute || 0 : goal.number));
  const yMax = Math.max(1, report.score.a, report.score.b);
  const x = (value) => left + value / xMax * (width - left - right);
  const y = (value) => height - bottom - value / yMax * (height - top - bottom);
  const ticks = Array.from({ length: 6 }, (_, index) => index / 5);
  const grid = [...new Set(ticks.map((fraction) => Math.round(fraction * yMax)))].map((value) => {
    return `<line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}" class="chart-grid"/><text x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${value}</text>`;
  }).join("");
  const labels = [...new Set(ticks.map((fraction) => Math.round(fraction * xMax)))].map((value) =>
    `<text x="${x(value)}" y="${height - bottom + 20}" text-anchor="middle">${value}${axis === "time" ? "′" : ""}</text>`).join("");
  const paths = ["a", "b"].map((side) => chartSegments(report, side, axis).map((segment) =>
    `<path class="team-${side} score-path" d="${segment.map((point, index) => `${index ? "L" : "M"}${x(point.x)},${y(point.y)}`).join(" ")}"/>`).join("")).join("");
  const points = report.goals.filter((goal) => axis !== "time" || goal.minute !== null).map((goal) => {
    const label = `Meta ${goal.number}: ${names[goal.side]}, ${scoreText(goal.score)}, ${minute(goal)}${goal.isBreak ? ", break segnalato" : ""}`;
    return `<g class="team-${goal.side}"><title>${escape(label)}</title><circle class="goal-dot ${goal.isBreak ? 'break-dot' : ''}" cx="${x(axis === "time" ? goal.minute : goal.number)}" cy="${y(goal.score[goal.side])}" r="${goal.isBreak ? 5 : 3}"/></g>`;
  }).join("");
  return `<div class="chart-scroll" tabindex="0" role="region" aria-label="Grafico del punteggio"><svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="progress-title-${escape(matchId)}"><title id="progress-title-${escape(matchId)}">Punteggio di ${escape(names.a)} e ${escape(names.b)} per ${axis === "time" ? 'minuto riportato' : 'numero di meta'}. I break sono cerchiati.</title>${grid}${labels}${paths}${points}<text x="${width / 2}" y="${height - 2}" text-anchor="middle">${axis === "time" ? "Minuto indicato nel report" : "Numero di meta"}</text></svg></div>`;
}

function differenceChart(report, names) {
  const width = 760, height = 175, left = 44, right = 18, top = 16, bottom = 28;
  const maximum = Math.max(1, ...report.goals.map((goal) => Math.abs(goal.score.a - goal.score.b)));
  const middle = (height - bottom + top) / 2;
  const scale = (middle - top) / maximum;
  const band = (width - left - right) / report.goals.length;
  const bars = report.goals.map((goal, index) => {
    const difference = goal.score.a - goal.score.b;
    const h = Math.abs(difference) * scale;
    return `<g class="team-${difference >= 0 ? 'a' : 'b'}"><title>${escape(`Meta ${goal.number}: ${difference > 0 ? names.a : difference < 0 ? names.b : 'Parità'}${difference ? ` avanti di ${Math.abs(difference)}` : ''}`)}</title><rect class="difference-bar" x="${left + index * band + 2}" y="${difference >= 0 ? middle - h : middle}" width="${Math.max(1, band - 4)}" height="${h}" rx="2"/><text x="${left + (index + .5) * band}" y="${height - 8}" text-anchor="middle">${goal.number}</text></g>`;
  }).join("");
  return `<div class="chart-scroll" tabindex="0" role="region" aria-label="Grafico del vantaggio"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Differenza di punteggio dopo ogni meta. Sopra lo zero: ${escape(names.a)}; sotto: ${escape(names.b)}."><line class="chart-grid" x1="${left}" x2="${width - right}" y1="${middle}" y2="${middle}"/><text x="${left - 10}" y="${top + 4}" text-anchor="end">+${maximum}</text><text x="${left - 10}" y="${middle + 4}" text-anchor="end">0</text><text x="${left - 10}" y="${height - bottom + 4}" text-anchor="end">−${maximum}</text>${bars}</svg></div>`;
}

export function scoreCharts(match, teams, entry, axis = "point") {
  const report = entry?.report;
  if (!report?.goals.length) return waiting(match, entry);
  const names = namesFor(match, teams);
  const timed = report.goals.filter((goal) => goal.minute !== null).length;
  const timeAvailable = report.timeOrdered && timed > 0;
  if (!timeAvailable) axis = "point";
  return `<div class="chart-heading"><h2>Andamento del punteggio</h2><div class="chart-axis" role="group" aria-label="Asse orizzontale">${[["point", "Per meta"], ["time", "Per minuto"]].map(([value, label]) =>
    `<button type="button" data-chart-axis="${value}" aria-pressed="${axis === value}" ${value === "time" && !timeAvailable ? "disabled" : ""}>${label}</button>`).join("")}</div></div>
    <p class="chart-key">${["a", "b"].map((side) => `<span class="team-${side}"><span class="team-dot" aria-hidden="true"></span>${escape(names[side])} <small>Break segnalati: ${report.goals.filter((goal) => goal.side === side && goal.isBreak).length}</small></span>`).join("")}</p>
    ${chart(report, names, match.id, axis)}
    <p class="muted chart-note">${axis === "time" ? `${timed}/${report.goals.length} mete hanno un minuto registrato. Le interruzioni della linea indicano tempi mancanti; non vengono stimati.` : "Ogni passo corrisponde a una meta registrata; i cerchi più grandi indicano i break."}${!report.timeOrdered ? " I tempi del report non sono in ordine: il grafico per minuto non è disponibile." : ""}${report.goals.some((goal) => goal.timeUnrecognized) ? " Alcuni tempi non sono interpretabili." : ""}</p>
    <h3>Vantaggio dopo ogni meta</h3><p class="muted chart-note">Sopra lo zero: ${escape(names.a)}. Sotto lo zero: ${escape(names.b)}.</p>${differenceChart(report, names)}`;
}

function credit(value, fallback) {
  if (!value) return `<span class="muted">${fallback}</span>`;
  const parts = value.match(/^(\d+)\s*[-–]\s*(.+)$/);
  return parts ? `<span class="jersey">#${escape(parts[1])}</span> ${escape(parts[2])}` : escape(value);
}

export function gameTimeline(match, teams, entry) {
  const report = entry?.report;
  if (!report?.goals.length) return waiting(match, entry);
  const names = namesFor(match, teams);
  return `<h2>Cronaca della partita</h2><p class="muted">Mete in ordine cronologico. Assist, marcatori, minuti e break sono quelli registrati nel foglio di gara.</p>
    <div class="timeline-teams"><strong class="team-a">${escape(names.a)}</strong><strong class="team-b">${escape(names.b)}</strong></div>
    <ol class="game-timeline"><li class="timeline-boundary">Inizio partita <span>${escape(report.start || "Orario non indicato")}</span></li>${report.goals.map((goal) =>
      `<li class="goal-event team-${goal.side} ${goal.isBreak ? "goal-break" : ""}" data-goal="${goal.number}"><div class="goal-score"><strong>${scoreText(goal.score)}</strong><span>${minute(goal)}</span></div><div class="goal-play"><div class="goal-label"><span>Meta ${goal.number} · ${escape(names[goal.side])}</span>${breakBadge(goal)}</div><p class="goal-credits"><span><small>Assist</small>${credit(goal.assist, "Non indicato")}</span><span class="credit-arrow" aria-hidden="true">→</span><span><small>Meta</small>${credit(goal.scorer, "Non indicata")}</span></p></div></li>${goal.number === report.halftime ? `<li class="timeline-boundary">Intervallo <strong>${scoreText(goal.score)}</strong></li>` : ""}`).join("")}${report.end ? `<li class="timeline-boundary">Fine partita nel report <strong>${scoreText(report.score)}</strong><span>${escape(report.end)}</span></li>` : '<li class="timeline-boundary">Fine partita non ancora indicata nel report</li>'}</ol>`;
}
