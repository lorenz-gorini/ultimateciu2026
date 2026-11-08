/** Last recorded goal at or before the cursor; equal minutes select the latest goal. */
export function lastGoalIndex(positions, cursor) {
  return positions.findLastIndex((position) => position <= cursor + 1e-6);
}

/** Delegated chart-wide cursor, touch and keyboard interaction; no additional reads. */
export function bindScoreTooltips(root) {
  let point = null, tooltip = null, guide = null, hideTimer;
  const document = root.ownerDocument;

  function close() {
    clearTimeout(hideTimer);
    if (tooltip) tooltip.hidden = true;
    guide?.setAttribute("hidden", "");
    point?.classList.remove("goal-active");
    point = tooltip = guide = null;
  }

  function show(target, cursor = null) {
    clearTimeout(hideTimer);
    const card = document.getElementById(target.dataset.scoreTarget);
    const chart = target.closest("[data-score-chart]"), svg = target.closest("svg");
    if (!card || !chart || !svg) return;
    if (target !== point) close();
    point = target; tooltip = card;
    card.hidden = false;
    target.classList.add("goal-active");
    guide = svg.querySelector("[data-score-crosshair]");
    const position = cursor ?? Number(target.dataset.scoreX);
    guide.setAttribute("x1", position); guide.setAttribute("x2", position);
    guide.removeAttribute("hidden");
    const frame = chart.getBoundingClientRect(), anchor = target.getBoundingClientRect();
    const svgFrame = svg.getBoundingClientRect();
    const centre = cursor === null ? anchor.left + anchor.width / 2
      : svgFrame.left + cursor / svg.viewBox.baseVal.width * svgFrame.width;
    const left = Math.max(8, Math.min(frame.width - card.offsetWidth - 8,
      centre - frame.left - card.offsetWidth / 2));
    const above = anchor.top - frame.top - card.offsetHeight - 8;
    const top = anchor.bottom + card.offsetHeight + 8 > document.defaultView.innerHeight && above >= 0
      ? above : anchor.bottom - frame.top + 8;
    card.style.left = `${left}px`; card.style.top = `${top}px`;
  }

  function contains(target) {
    return target && (point?.contains(target) || tooltip?.contains(target));
  }

  function leave() {
    clearTimeout(hideTimer);
    if (document.activeElement !== point) hideTimer = setTimeout(close, 150);
  }

  function track(event) {
    const chart = event.target.closest("[data-score-chart]");
    if (!chart || tooltip?.contains(event.target)) return;
    const svg = chart.querySelector("[data-score-svg]");
    const bounds = svg.querySelector("[data-score-bounds]");
    const coordinate = svg.createSVGPoint();
    coordinate.x = event.clientX; coordinate.y = event.clientY;
    const local = coordinate.matrixTransform(svg.getScreenCTM().inverse());
    const left = bounds.x.baseVal.value, right = left + bounds.width.baseVal.value;
    const top = bounds.y.baseVal.value, bottom = top + bounds.height.baseVal.value;
    if (local.x < left || local.x > right || local.y < top || local.y > bottom) {
      const target = event.target.closest("[data-score-target]");
      if (target) show(target);
      else leave();
      return;
    }
    const points = [...svg.querySelectorAll("[data-score-target]")];
    const index = lastGoalIndex(points.map((target) => Number(target.dataset.scoreX)), local.x);
    if (index >= 0) show(points[index], local.x);
  }

  root.addEventListener("pointermove", (event) => { if (event.pointerType !== "touch") track(event); });
  root.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    if (event.target.closest("[data-score-chart]") === point?.closest("[data-score-chart]")) clearTimeout(hideTimer);
  });
  root.addEventListener("pointerout", (event) => {
    if (event.pointerType === "touch") return;
    const chart = point?.closest("[data-score-chart]");
    if (chart?.contains(event.target) && !chart.contains(event.relatedTarget)) leave();
  });
  root.addEventListener("focusin", (event) => {
    const target = event.target.closest("[data-score-target]");
    if (target) show(target);
  });
  root.addEventListener("focusout", (event) => {
    if (contains(event.target) && !contains(event.relatedTarget)) close();
  });
  root.addEventListener("click", (event) => {
    const target = event.target.closest("[data-score-target]");
    if (target) show(target);
    else track(event);
  });
  root.addEventListener("keydown", (event) => {
    const target = event.target.closest("[data-score-target]");
    if (!target) return;
    if (["Enter", " "].includes(event.key)) { event.preventDefault(); show(target); }
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const points = [...target.closest("svg").querySelectorAll("[data-score-target]:not([data-score-origin])")];
      const index = points.indexOf(target);
      const next = event.key === "Home" ? 0 : event.key === "End" ? points.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + points.length) % points.length;
      points[next].focus({ preventScroll: true });
      points[next].scrollIntoView({ block: "nearest", inline: "nearest" });
      show(points[next]);
    }
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  document.addEventListener("pointerdown", (event) => { if (!contains(event.target)) close(); });
  root.addEventListener("scroll", () => {
    if (point && document.activeElement === point) show(point);
    else close();
  }, true);
  document.defaultView.addEventListener("resize", close);
  return { close };
}
