# Ultimate CIU 2026 implementation handoff

## Current state and next action

**27 October 2026: refresh repair, ±2-hour live polling, match rosters/statistics, elected MVPs and white player cards reviewed locally; split commits and publication authorized, in progress.** Initial 26 October checkout: clean `main` at `d4a6fc1` (last runtime release `a59ce3b`). The 27 October refinements preserve and extend the pending refresh/live-score/player-card worktree. The public site is [CIU Mixed 2026](https://lorenz-gorini.github.io/ultimateciu2026/). Its published data was still dated 21 October when inspected on 26 October, and the latest 27 October scheduled run still uses the older code; this local repair has not been committed, pushed or deployed.

Lorenzo reviewed the local refinements and explicitly authorized splitting the changes into commits and publishing on 27 October. He also authorized future project-local checkpoint commits after each completed verified request/feature; pushes and publication remain explicitly requested actions. This standing local-commit policy is recorded in AGENTS.md. The previous executable briefs are superseded by this coherent current record; their full historical evidence remains in Git at `d4a6fc1`. Use README for the single setup/import/test/build/preview procedure.

### Request, decisions and boundaries

Lorenzo requested repair of Aggiorna, live score reads and match-specific rosters/statistics from each exact `Partite!Q` report. He subsequently requested totals sorted descending and elected MVPs highlighted per team. Confirmed user decisions:

- Poll live reports **every 60 seconds only within ±2 hours of the scheduled start** while the website tab is visible. Opening a historical/future match still reads its roster/statistics once; manual Aggiorna is an explicit out-of-window read.
- “L-N ... is the ‘finished’ result ... filled up ONLY when the match is over.” Both main-sheet scores therefore define the final result and always override a report partial.
- Explicitly reconcile **360 Mlano → 360 Milano** in Serie A reports. This is a user-approved spelling alias, not fuzzy matching. Other identity mismatches remain rejected.
- Sort all player statistics by total descending; missing totals last, original source order at ties. Highlight only source-elected MVP marks, never infer an election from statistics.
- Preserve the existing design, two-division selection, remembered team choices and directional Valuta links.

The viewer remains read-only. Never edit organizer sheets, submit SOTG forms, fabricate scores/qualifiers/rosters/addresses, or expose credentials in static assets. Keep the professional homepage, DNS/settings and Pi untouched. No backend, API key, new permissions or server exposure is required. This release's commits/push/publication are now explicitly authorized. For future work, make scoped local commits after each verified requested feature; obtain an explicit request before a new push/publication or settings change.

## Work packages and acceptance

| Package | Implementation / evidence | Decision or deliverable | State |
| --- | --- | --- | --- |
| Repair final-result imports | Distinguish Q report hyperlinks from inherited rows; preserve unnamed statistic rows | New L/N scores reach the normalized datasets without relaxing score validation | Verified locally |
| Read live reports | Named LIVE sheet, two bounded CSV ranges, exact identity/date/orientation and goal checks | Provisional scores cannot replace main-sheet finals or contaminate stored data | Verified with real reports and synthetic live transitions |
| Match players and MVPs | Exact Q-linked LIVE rosters/statistics, presence markers and elected MVPs; total-descending tables | Display actual game data separately from seasonal totals, without inferring attendance or elections | Source/parser/browser checks passed, including all 30 completed reports |
| Browser refresh | 60-second checks only within ±2 hours, manual/detail exceptions, separate success timestamps | Distinguish final/live/stale scores while avoiding background reads of past/future games | Boundary/DST/midnight tests pass; no real ongoing match observed |
| Release | Shared existing import/test/build/Pages workflow | Publish both divisions only after all validation succeeds | Authorized; in progress |

Definition of done for implementation: both live imports and frozen regressions pass; real final/blank reports parse; browser CORS reads work; final precedence, failures, date/team mismatch, reversed sides, zero and stale states are tested; production build succeeds; scoped changes/evidence/limits are documented. Hosted repair is complete only after a separately authorized push and successful deployment, then independent public JSON/browser verification.

## Product and source contract

Italian static Vite/vanilla-JavaScript site under `/ultimateciu2026/`, with hash routes. The landing page shows fixtures/results by date; team pages separate scheduled, report partials, final and missing/incomplete results; pool pages follow the organizer's format and unresolved slots. White readable cards sit over a quiet dawn-field background. Player/statistic sections on team and match pages include their heading, description and table/empty state in the same opaque white card, with the shared border/shadow and horizontal table scrolling. This incorporates Lorenzo's screenshot feedback about player names becoming hard to read over the field image. No large introductory hero. Divisione is teal and first in the compact secondary filter row below the primary team search.

Team search opens on click and filters while typing. Selected/recent teams appear once as toggle shortcuts, beside search on desktop and below it on mobile. Multi-team selection uses OR, not duplicate fixtures. Up to three recent teams and all selected teams are saved in localStorage per division. Date/phase/status are compact secondary single-choice filters. Division is remembered separately; an explicit `?division=mixed-a|mixed-b` overrides storage. Switching restores that division's teams, resets secondary filters, and ignores old asynchronous responses.

Valuta uses the exact `Valutazioni SOTG!E` Google Form hyperlinks. Two different directional links offer the evaluating-team choice; identical unresolved-team URLs appear once. Validate HTTPS Google Form destinations and match prefills; warn on inconsistent team prefills, never rewrite the organizer's URL. The site never submits forms. Google sign-in is required for actual evaluation. Main-sheet team player totals remain team lists, not verified match rosters; numbered player match slots have no established match-ID mapping. The separate report adapter now supplies actual match presences/statistics instead; do not use numbered seasonal slots as a substitute. All player tables sort totals descending with missing last and stable ties. Elected MVPs are highlighted from the explicit report mark.

### Competition workbooks

`src/divisions.json` is the shared source/label/output registry and holds the one approved report-name alias. The federation [championship page](https://flyingdisc.it/campionati-2026/) links both sources:

| Division | Source | Frozen test evidence / competition structure |
| --- | --- | --- |
| Mixed Serie A | [Organizer sheet](https://docs.google.com/spreadsheets/d/1k_xJctOAUqizJW00395YIvDwC5gDZKek2R26UpJ_HUQ/edit) | `tests/fixtures/source-2026-10-13.xlsx`; 12 teams, 56 fixtures = 30 first + 12 second + 14 finals; 6 inherited results excluded from fixtures |
| Mixed Serie B | [Organizer sheet](https://docs.google.com/spreadsheets/d/1ghPcgKXs1r-Dy22BBVRFrVVcB-N7WNBOfHmlNm1a1Go/edit) | `tests/fixtures/source-mixed-b-2026-10-15.xlsx`; 18 teams, 63 fixtures = 45 first + 18 second; no inherited/knockout games |

Frozen counts describe test snapshots, not live hard limits. Initial frozen results/SOTG/player records were blank. Do not overwrite these files or publish synthetic test mutations.

The single Python/openpyxl adapter downloads public XLSX exports with bounded timeout/retries/size, validates archive/layout/cached formula values, expands actual merges in memory, and normalizes all four sheets. Both divisions must validate before replacing either output; each replacement is atomic. A local write failure between files is not a multi-file transaction, but a failed build cannot deploy a partial Pages artifact. Python/jsonschema and browser/Ajv share `src/data.schema.json`; schema version 1 has additive optional division/form/report fields for legacy Serie A cache compatibility.

Source layout anchors remain explicitly configured in `importer/workbook.py`, with no fuzzy row/name joins:

- `Classifiche e format`: A teams B5:L16, initial pools B21:F26 / B29:F34, second pools H21 onward / H27 onward / H33 onward, final placement N20 onward. B teams B5:L22, initial entries B27:F32 / B35:F40 / B43:F48, six three-team power pools below H26/H31/H36/H41/H46/H51, final placement N26 onward. Validate headings before relying on positions. Preserve source standings order and unresolved qualifier slots; initial zero standings do not qualify teams.
- `Partite`: B stage, C city, D date, E scheduled start, G scheduled end, H field, I match ID, J/K side A slot/name, **L score A / M separator / N score B**, O/P side B name/slot, **Q report hyperlink or ereditata marker**. Main score validation accepts explicit zero, rejects negative/nonintegral values, and preserves missing/one-sided results. Only ereditata rows without fixture IDs become carry-overs. Unknown markers and report labels without safe Google Sheets hyperlinks fail loudly. R:T summary values remain unused.
- A first-phase rows 5:19 / 22:36; second phase 43:46 / 51:54 / 59:62; finals 67:80. B first phase 5:19 / 22:36 / 39:53; second-phase three-row blocks starting 58,63,68,73,78,83. Merge expansion supplies real date/city inheritance; side standings are not fixtures.
- `Valutazioni SOTG`: A match ID, B date, C evaluating team, D evaluated team, E exact form hyperlink, G:K five categories, L total, M comment. Validate pair direction, team references, dates and category sums. Link availability does not imply a submitted evaluation.
- `Statistiche`: A team, B surname, C given name, D:M ten numbered match slots, N assists, O goals, P total. Preserve nonblank rows with nullable names; show an explicit missing-name label. Unknown teams, bad types and uncached required formulas still fail.

`fetchedAt` means actual download time; `sourceReportedAt` comes from `Partite!D1`, not independently verified edit metadata. Each normalized record carries source-sheet/range provenance. No source recalculation or write occurs.

### Live report contract

`src/reports.js` is the sole browser adapter for match reports. The match's exact validated Q hyperlink associates the report with the fixture. The URL's gid is not a reliable LIVE-sheet selector: the supplied example's gid `735281267` opens the original archived `Foglio di gara`; the LIVE tab has a different gid.

Use anonymous CORS CSV requests to the same workbook's `/gviz/tq`, explicitly setting `sheet=Foglio di gara (LIVE)`, `headers=0`, `tqx=out:csv` and `tq=select *`. Read **C4:C7** separately from **E12:G200**. A whole-grid query was observed to discard mixed-type metadata; a CSV export with only a sheet name can silently select a roster tab. Neither is an acceptable fallback.

- Metadata must have the expected title/competition, an Italian calendar date equal to the fixture date, and both exact team names (or the approved alias). Reversed sides are explicitly reordered. Unknown spellings/date mismatches reject the overlay.
- Body headers must be assist/meta/parziale. Read cumulative scores from G and identify footer rows by labels, not row number. Goal increments must be coherent. A populated final-summary score must agree with the goal sequence. Actual start/end fields are in E beside halftime/final labels in F. Empty future templates can omit the hours/minutes colon. A label called risultato finale alone does not establish that the match ended.
- Requests omit credentials, use a 12-second timeout and 128 KiB response/CSV bounds. At most four match reports are in flight, with duplicate suppression. No JavaScript evaluation or persistent report-player cache. Aliases apply only to report identity; source names and evaluation URLs remain untouched. Scores and player data share this HTTP/identity boundary.
- Automatic score reads are limited to ±2 hours from the scheduled start, every 60 seconds while visible, until main L/N is complete or a report has an actual end. Outside the window, even a previously failed read is not automatically retried. Opening a match reads its roster/statistics once regardless of date; repeats of those data are limited to the same window. Aggiorna explicitly forces the open detail read and checks other due scores. Returning to visibility resumes only eligible checks. A changed division/date/participants/link/alias context cannot reuse older data. Europe/Rome instants handle midnight and daylight-saving changes.

| Display | Required evidence |
| --- | --- |
| Risultato finale | Both main-sheet L/N values; always wins, regardless of report score/error |
| LIVE · parziale dal report | Valid explicit score, actual start reached, no actual end, inside ±2-hour window, successful check within 125 seconds |
| Report terminato · da confermare | Actual report end and score, no main-sheet final |
| Ultimo parziale · non live | Last valid partial after failure, expired ongoing check or leaving the ±2-hour window |
| No report score | Blank report or validation failure with no valid previous partial; retain main schedule/result state |

Report overlays are in memory only: never modify main JSON/cache, standings, SOTG or statistics. Show the last successful report check separately from the main download/source timestamp; an attempted failed check must not advance it. Preserve controls, filter selection and open Valuta menus during score updates. Report polling does not imply Google's own IMPORTRANGE/LIVE cells refresh within 60 seconds.

### Match roster/statistic/MVP contract

`src/match-players.js` uses the exact report URL associated with each match, sharing CSV/HTTP, date, team identity and cache-context validation with `src/reports.js`. **A X_3 and the supplied example are different reports:** X_3 is [BFD Mix White–360 Milano](https://docs.google.com/spreadsheets/d/1IAsRafQ_5mbTLsokAWyJc2Zz4qonUylAsxDtu-mmKVg/edit); the supplied [VOLADORA–360 Milano report](https://docs.google.com/spreadsheets/d/1mRXK6wdXiCci96pbv-8za14tZfhPbyqBH2tIE_qj5iE/edit) is X_6. Never attach an example URL to unrelated match IDs.

Six bounded CSV reads load metadata C4:C7, B2:B3 and G2:J100 in each **Roster squadra A/B (LIVE)**, and A1:G100 in **Statistiche (LIVE)**. Headers and roster identities are validated before matching exact team/surname/given-name keys. G in Statistiche is the inspected MVP note column (blank header, literal ` mvp` values; surrounding whitespace/case is normalized). No mark means no election reported. The two roster sources need not match calendar-side order; shared identity validation resolves orientation. Duplicate player keys, unknown attendance markers, invalid numeric totals or unjoinable statistics are explicit errors, retaining the previous valid data.

Roster G=jersey (preserve text/zero), H=X-marked presence, I=surname, J=given name. The main tables include only X-marked entries; other names stay under “presenza non segnata”, which is not an assertion of absence. Explicit zero statistics remain zero; missing values remain dashes. A single unnamed roster entry per team can match a single unnamed statistics entry without inventing a name; multiple ambiguous missing identities fail rather than merge. Statistic total must equal assists+goals when all three are populated. `sortPlayersByTotal` owns the shared display sort; ties retain source order and null is below zero. The MVP flag never changes that order. Each team has an MVP summary and highlighted source-marked rows; an unmarked team shows “MVP non indicato nel report”.

Opening a match requests these data once, even for past/future fixtures. Automatic rereads require the ±2-hour window, no final main result/report end, a visible tab, and a 60-second interval. Old failed details outside the window wait for manual Aggiorna. Source errors preserve successful previous details with a warning and unchanged success time. The player data are in memory only and do not overwrite main-sheet seasonal totals or its availability flags. Request only the above columns: no membership IDs, birth dates, registration status or other unused roster attributes. White player cards and horizontal table scrolling remain in place.

## Update and deployment procedure

Follow README's local setup/import/test/build/preview commands. Do not introduce another active workflow or a browser GitHub token.

- Published JSON is checked without cache on load, every 90 seconds while visible, on return to the tab, and on Aggiorna. Final results require a successful main-workbook import/deployment; Aggiorna cannot execute the importer on static Pages. Explain this in the refresh disclosure.
- `.github/workflows/verify.yml` is the shared install → frozen/synthetic Python tests → both live imports → frontend tests → live-data build → optional artifact upload procedure. `.github/workflows/pages.yml` invokes it and deploys only successful artifacts.
- Current cron: UTC weekends at minutes 7/22/37/52; weekdays at minute 7. GitHub scheduling is best effort, not a freshness guarantee. `scripts/refresh_policy.py` allows scheduled imports through 23 November 2026 inclusive in Rome; postponed games beyond that need an explicit cutoff update. Push/manual dispatch bypass the date cutoff.
- `PAGES_ENABLED=true` gates deployment. Pages uses HTTPS, project subpath and the github-pages environment restricted to main. No generated JSON commits. Failed imports/tests leave the last successful public deployment intact. Main-sheet match-day downloads older than one hour show a stale-copy warning.
- After an authorized release, a maintainer can refresh in GitHub: Actions → Refresh data and deploy Pages → Run workflow on main; wait for success, then Aggiorna. For failures, inspect the job error, repair the adapter against actual source evidence, rerun its regressions and publish a reviewed fix. Never bypass validation to force deployment.

## Verification evidence — 26–27 October 2026

**Cause confirmed:** [scheduled run 40367355501](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/40367355501) failed with `IMPORT FAILED — previous output preserved: Partite!Q5: unknown carry-over/status marker`. The source now uses Q for report links. The old parser treated every nonempty Q as an inherited marker, stopping new finals from reaching Pages. After accepting the inspected report marker/link contract, Serie B exposed one statistic row with both names missing (`Statistiche!B123:C123`), which also needed nullable-name handling.

| Current live import | Serie A | Serie B |
| --- | ---: | ---: |
| Teams / fixtures | 12 / 56 | 18 / 63 |
| Finished L/N results | 12 | 18 |
| Report links | 56 | 63 |
| Team player-stat rows / unnamed | 165 / 0 | 205 / 1 |
| SOTG team-prefill warnings | 10 links / 5 matches | 0 |
| Download UTC | 27 Oct 10:30:10.967794 | 27 Oct 10:30:13.151837 |
| Organizer timestamp, Rome | 25 Oct 22:43:30 | 25 Oct 22:56:24 |

The inspected older public snapshots both had zero finished scores, with downloads `2026-10-21T18:35:05.081294+00:00` / `2026-10-21T18:35:07.608687+00:00`. Fresh live workbook hashes are A `72b460d6ceccd1ed0b4c0db5898d659e1d307cbcbef07a36fe818b8a907c5507`, B `b14d9ff695d14fc90a3c0a8f59c69a052639c3eaa8717130a49cd74cbb876f65`.

Current local verification (Python checks unchanged from 26 October; live imports/frontend/browser checks repeated 27 October):

- Python suite: **29 passing on 26 October** (unchanged Python/schema paths in the 27 October refinement), covering report hyperlinks with finished zero scores, unsafe/missing report links, inherited-row separation, unnamed-player retention, old failure preservation and both frozen fixtures.
- Frontend suite: **40 passing on 27 October**, discovered through `tests/*.test.mjs`, including the separate match-player source-contract suite. Covers final precedence, live/ended/stale states, reversed orientation, date/identity rejection, approved-only alias, goal progression, blank/zero reports, 60-second eligibility, no credentials, malformed/HTML/HTTP/network failures, changed-fixture retention, live status filtering and earlier division/team/form checks.
- Fresh anonymous `python -m importer` validates both divisions. `REQUIRE_LIVE_DATA=1 npm run build` passes at the project subpath. Both production JSON files equal their validated live inputs. `git diff --check` passes; workflow files and frozen fixtures are unchanged.
- Initial score reads: **6/6 reports validate**: A X_1 15–9, A X_6 14–10 with the approved spelling alias, B X_1 13–10, B X_6 15–6, plus valid blank A/B X_7 future reports. The A X_6 main-sheet final and report both read 14–10.
- Browser: public Google CSV access works from localhost; A X_6 shows 14–10 as final, B X_1 13–10 as final, and B X_7 remains scheduled with no invented score and an explicit not-started report message. Manual Aggiorna reports 1/1 report reads and keeps the Valuta menu open. Inspected console warnings/errors are empty. At 320px, client/scroll widths both equal 320px; viewport restored. The report panel uses a white card for readable text over the field background. [Final screenshot](../work/verification/2026-10-26/local-refresh-report.png) and the running preview are available for review.
- Player readability review: the shared white-card styling now wraps both team and match player sections, including headings and explanatory text. Browser checks confirm opaque `rgb(255, 255, 255)` backgrounds on A team x6 and match X_6; all 14 team-player rows remain visible with their source values. Production build and diff checks pass. This presentation-only revision changes `src/main.js`, `src/style.css` and this handoff, preserving the pending refresh/live-score implementation. [Player-card screenshot](../work/verification/2026-10-26/players-white-card.png).
- Match data source checks: **30/30 completed reports** (12 A, 18 B) have readable rosters/statistics; summed individual goals match both main-sheet final scores in all 30. X_3 uses its own Q link and has 18/18 marked presences, X_6 has 21/18. Four B reports (Y_3, Y_6, Z_1, Z_5) have a single unnamed roster entry, now retained with jersey/presence/statistics rather than blocking the report. A future A X_7 report correctly produces two empty rosters.
- MVP source checks: all 30 completed Statistiche LIVE sheets use the observed literal ` mvp` marker in G. **41 elected MVP marks / 60 team-match observations**; 19 have no mark. X_3 elects Margherita Giovannini and Chiara Alberga; X_6 elects Federico Pickthall and Luca Veroni; B X_1 elects Luigi Geremia and Mattia Tassinato. No winner is inferred for missing marks.
- Final browser checks: A X_3's two tables have descending totals and the correct highlighted MVPs, including an elected zero-total player. B X_1 displays 11/16 marked presences and both source MVPs. A X_7 shows empty rosters and no inferred MVPs. X_3's historical roster check remained unchanged for more than 60 seconds across automatic cycles; manual refresh remains available. At 320px, page client/scroll widths are both 305px and the first roster table fits its 231px container; viewport restored. Inspected console warnings/errors are empty. [Roster/MVP screenshot](../work/verification/2026-10-27/match-roster-mvp.png).
- Hosted status checked read-only: [run 40468881156](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/40468881156), 27 October 07:43:58 UTC, still ran `d4a6fc1` and failed at `Partite!Q5: unknown carry-over/status marker`. The repaired local fresh import passes; publication is still needed to replace the old hosted importer. No dispatch/deployment/settings change was performed.


Raw verification downloads, logs, report checks, screenshots and generated build/data remain ignored under `work/verification/2026-10-26`, `work/verification/2026-10-27`, `public/` and `dist/`. They are local evidence, not release inputs. Frozen XLSX fixtures remain unchanged. No synthetic score or personal roster identifier is added to public assets.

### Remaining limitations

1. No real ongoing match was observed on 26–27 October. Synthetic reports and controlled clocks verify live transitions and final precedence; actual event-day update latency remains unobserved. Browser timers pause in hidden tabs and resume on visibility. Google CSV/CORS, schema and its own LIVE-sheet propagation can change or fail; the fallback is an explicit unavailable/stale state and the original report link.
2. Finished results still depend on the main-sheet import/deployment cadence. The repair must be published before hosted imports can succeed. No new hosted run/publication has been performed in this session.
3. Only the confirmed 360 Mlano alias is allowed. Any further name/layout discrepancy is flagged rather than guessed. The five existing A form-prefill issues remain source warnings; users should check fields in Google Forms. No form submission or authenticated form completion was tested.
4. Report rosters and individual match statistics are now supported; seasonal numbered player-slot mapping remains unestablished and unused. Four completed B reports have an unnamed roster entry; retain the known jersey, presence and statistics with an explicit missing-name label. MVP is not indicated for 19 of 60 inspected team-match observations; never infer a winner. Last-successful check times do not prove organizer edit times.

### Authorized release and checkpoint policy

Split the release into two feature commits: **`Fix live workbook imports for reports and unnamed players`**, then **`Add match rosters, elected MVPs and bounded live scores`**. A final documentation-only commit will record the hosted verification. Push the feature commits together so the existing Pages workflow tests/deploys their final state once.

Exact release scope (15 files, including the authorized standing commit policy):

```text
AGENTS.md
README.md
docs/IMPLEMENTATION_HANDOFF.md
importer/workbook.py
package.json
src/data.js
src/data.schema.json
src/divisions.json
src/main.js
src/match-players.js
src/reports.js
src/style.css
tests/frontend.test.mjs
tests/match-players.test.mjs
tests/test_importer.py
```

Lorenzo requested **“Fai commit (magari dividi le modifiche se possibile) e pubblica gli aggiornamenti.”** Stage only the exact related files/hunks, inspect each cached diff, commit/push solely to `lorenz-gorini/ultimateciu2026`, and verify the shared import/test/build/Pages run plus independent public JSON/browser reads. No settings/access changes are necessary. Publication evidence will replace this in-progress status after completion.

Diagnostic GitHub access before publication on 26–27 October was read-only: inspect this repository's recent run statuses and failed workflow logs (official checksum-verified temporary gh CLI, existing sign-in). Public organizer exports and reports were read anonymously. At the diagnostic boundary there had been no remote write. The newly authorized writes are limited to these project commits and their push-triggered Pages deployment. Do not change repository settings/permissions, source sheets/forms, homepage/DNS or Pi.

## Historical publication evidence (non-executable)

- Initial project publication authorized 13 October; later team-picker/background/seasonal-refresh refinements reviewed and released. Earlier designs and local-only plans are preserved in Git history, not active alternatives.
- Two successful scheduled executions of the revised seasonal policy on 15 October: [38681672377](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38681672377), [38715763802](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38715763802). They establish execution, not guaranteed weekend latency.
- Last runtime release: `a59ce3b6377695ce71709ed2f404e4672dbee019`, Mixed Serie B, directional Valuta and filter-row division selector. Authorized [push deployment 38746020883](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38746020883) succeeded 15 October at 15:51:31 Rome; 27 Python and 21 frontend tests passed then. Documentation checkpoint `d4a6fc1` followed with skip-ci. The 27 October release has its own explicit authorization above.
