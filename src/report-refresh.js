import { OVERVIEW_REPORT_INTERVAL, REPORT_INTERVAL, shouldCheckReport } from "./reports.js";
import { shouldCheckMatchPlayers } from "./match-players.js";

/** Plan against the entire division, independently of the visible team/date/status filters. */
export function planReportChecks(data, { openId = null, manual = false, now = new Date(),
  scoreFor = () => null, playersFor = () => null } = {}) {
  return data.matches.map((match) => {
    const detail = match.id === openId;
    const score = scoreFor(match);
    return { match, interval: detail ? REPORT_INTERVAL : OVERVIEW_REPORT_INTERVAL,
      scores: shouldCheckReport(match, score, now, { force: manual, detail }),
      players: detail && shouldCheckMatchPlayers(match, playersFor(match), score, now, manual) };
  }).filter((task) => task.scores || task.players);
}

/** Wake at an exact due time; check at least once a minute for newly eligible fixtures. */
export function nextReportCheckDelay(data, options = {}) {
  const now = +(options.now || new Date());
  const tasks = planReportChecks(data, { ...options, manual: false, now: new Date(now + OVERVIEW_REPORT_INTERVAL) });
  const delays = tasks.flatMap((task) => {
    const entries = [];
    if (task.scores) entries.push([options.scoreFor?.(task.match), task.interval]);
    if (task.players) entries.push([options.playersFor?.(task.match), REPORT_INTERVAL]);
    return entries.map(([entry, interval]) => entry ? Math.max(1000, entry.attemptedAt + interval - now) : REPORT_INTERVAL);
  });
  return Math.min(REPORT_INTERVAL, ...delays);
}

/** Share in-flight reads and four workers across manual, timer and navigation batches. */
export function createReportQueue() {
  const pending = new Map();
  const waiting = [];
  let active = 0;
  function drain() {
    while (active < 4 && waiting.length) {
      const { key, task, check, isCurrent, resolve } = waiting.shift();
      if (!isCurrent()) {
        pending.delete(key);
        resolve({ skipped: true, failed: false });
        continue;
      }
      active++;
      Promise.resolve().then(() => check(task)).then(
        (failed) => resolve({ skipped: false, failed: Boolean(failed) }),
        () => resolve({ skipped: false, failed: true }),
      ).finally(() => {
        active--;
        pending.delete(key);
        drain();
      });
    }
  }
  return async (tasks, { keyFor, check, isCurrent = () => true, onProgress = () => {} }) => {
    let count = 0, failed = 0;
    await Promise.all(tasks.map((task) => {
      const key = keyFor(task);
      let promise = pending.get(key);
      if (!promise) {
        promise = new Promise((resolve) => waiting.push({ key, task, check, isCurrent, resolve }));
        pending.set(key, promise);
        drain();
      }
      return promise.then((outcome) => {
        if (!outcome.skipped) { count++; failed += Number(outcome.failed); }
        if (isCurrent()) onProgress({ count, failed, total: tasks.length });
      });
    }));
    return { count, failed };
  };
}
