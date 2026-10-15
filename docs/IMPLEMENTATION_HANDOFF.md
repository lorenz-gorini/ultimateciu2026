# Ultimate CIU 2026 implementation handoff

Prepared 13 October 2026; local implementation, validation and authorized publication completed on the same date. Live website: [CIU Mixed 2026](https://lorenz-gorini.github.io/ultimateciu2026/). Lorenzo inspected the preview and authorized repository creation, the checkpoint/push, and GitHub Pages publication. The original local-only implementation brief below records the initial scope; the later publication authorization supersedes its stop-before-publication instruction. The publication entry at the end records access scope and verification.

## Start here

**Current state: published and verified on 15 October 2026.** Both Mixed divisions, match-specific Valuta links and the teal Divisione control at the start of the filter row are live at runtime checkpoint `a59ce3b6377695ce71709ed2f404e4672dbee019`. See [Filter-row correction and authorized publication](#filter-row-correction-and-authorized-publication--15-october-2026) for the latest deployment/access evidence and remaining source limitations. Earlier local-only states and checkpoint proposals below are historical and superseded by Lorenzo's publication authorization.

**Latest UI correction:** Divisione is first in the filter row below team search, highlighted in teal; the header contains branding/navigation/freshness. [Single team shortcuts](#single-team-shortcuts--14-october-2026) remains authoritative for the team picker.

The completed plans are [Periodic data refresh](#periodic-data-refresh-handoff--13-october-2026) and [Team selection and remembered preferences](#team-selection-and-remembered-preferences--13-october-2026). The combined checkpoint is published. Two successful scheduled build/deploy runs of the revised policy have also been observed; no setup or user action is required.

Work in `/Users/lorenzogorini/Library/CloudStorage/OneDrive-UniversitàCommercialeLuigiBocconi/PhD/Coding/ultimateciu2026`.

Read `AGENTS.md`, `README.md`, and this handoff. Implement and verify locally, prepare the GitHub Pages workflow, and stop with a reviewable result for Lorenzo. Do not publish during this first implementation pass. Do not modify the professional homepage repository, its DNS, or its deployment settings. Do not edit the source spreadsheet or submit its SOTG forms.

The project folder was initially empty. The local implementation ended without a Git repository; the authorized publication pass initialized the project's own repository on `main`, created its separate GitHub remote and pushed the implementation. The live-import/test/build/deploy workflow has succeeded on GitHub. GitHub CLI `gh` was unavailable in the preparation shell; a temporary official CLI is now authenticated. API and SSH both verified `lorenz-gorini`.

## Product requirements

Default interface language: Italian, appropriate to the source and competition. This is a design default, not a confirmed user preference. The 15 October division selector extends the original Serie A requirements below to both Mixed divisions, with the accurate active-division title and source-specific competition format.

1. **Partite is the landing page.** Show all scheduled and completed fixtures, grouped by date and sorted by time, with team names or unresolved qualification slots, score or status, city, field, and phase. Keep the schedule prominent rather than adding a large hero. Filters: team search, date, phase and status, with clear reset and empty states. Initial view includes all fixtures; offer a jump to the next scheduled date. Preserve filters when returning from a detail view.
2. **Team page.** Search/select a team, then see upcoming games and recorded results separately, with dates, times, cities and fields. Include pool membership, available team statistics and player data. Link every resolved team name from pool tables and match details to this same page. Searching should ignore case and accents without changing canonical source names.
3. **Match detail.** Clicking a match opens its score, scheduling details, teams and phase, then SOTG and player statistics where available. SOTG means Spirit of the Game: show who evaluated whom, the five category scores, total and comment. Team player lists must be labelled as team lists, not a verified match roster. Keep unavailable features visible with precise messages such as “Valutazioni non ancora pubblicate” or “Roster non disponibile nella fonte”.
4. **Gironi e fasi.** Show first-round pools X/Y, second-round high/middle/low pools, final-round progression, and final classification when populated. Team entries are links. Display unresolved slots such as `1X` and `WQ1` as placeholders, not invented teams. Do not qualify teams from the initial zero-point standings.
5. **Freshness controls.** Always show the last successful data download, the spreadsheet's reported update timestamp when available, and an “Aggiorna” button. Retain the last valid data on network/import failure and explain its age. A failure is not an empty competition.
6. **Source access.** Provide a subtle “Apri foglio originale” link, optionally linking details to the relevant sheet/range. No editor or score-entry controls are needed.

Use a warm white background, dark navy text, one restrained teal accent, thin borders and ample spacing. Use a system sans-serif stack and tabular score/time numerals. Compact fixture rows on desktop become readable cards on mobile. Use semantic links/buttons, visible keyboard focus, labelled controls, sufficient contrast, and text as well as color for statuses. Avoid stock photos, large gradients, decorative dashboards and excessive animation. No account system or backend database is required.

## Verified source inventory

Authoritative spreadsheet: [Schedule CIU Mixed Serie A 2026](https://docs.google.com/spreadsheets/d/1k_xJctOAUqizJW00395YIvDwC5gDZKek2R26UpJ_HUQ/edit?gid=2075572219#gid=2075572219).

Inspected anonymously on 13 October 2026 using the Google Sheets UI and an Excel export. The workbook reports `11/10/2026 16:15:23` at `Partite!D1`. This is a source-reported timestamp, not independently verified edit metadata. A frozen public export is included at `tests/fixtures/source-2026-10-13.xlsx`. Treat it as immutable test evidence, never as a permanent live data source.

| Sheet | Observed content | State at inspection |
| --- | --- | --- |
| Classifiche e format | 12 teams, affiliation/province, pools, standings, advancement rules | Standings start at zero; later qualifiers unresolved |
| Partite | 56 uniquely identified fixtures: 30 first phase, 12 second phase, 14 finals | No recorded match scores; 6 additional inherited-result rows are not new games |
| Valutazioni SOTG | Paired evaluation rows per match, category headings and form links | No category scores, totals or comments populated |
| Statistiche | Team, surname, given name, ten match slots, assist/goal totals | No populated player rows; no separate roster sheet |

Fixtures run from 25 October to 22 November 2026. First-day pools play in Parma and Milano; later fixtures are in Padova. The source provides cities and some field numbers, not verified street addresses. Display “Campo da definire” for missing fields; do not fabricate a venue or a precise map pin.

### Layout and parsing contract

These cell positions describe the inspected snapshot. Validate headers, section labels and identifiers before relying on positions. If the schema changes, fail the import with a useful diagnostic and keep the previously published dataset. Row counts below belong to the fixture tests, not permanent hard limits for live imports.

**Classifiche e format**

- Rows 5–16: seed B, team C, affiliation D, province J.
- Pool X: rows 21–26; pool Y: rows 29–34. Slot B, team C, points D, goals for E, goals against F.
- Second-phase slots: H21:H24, H27:H30 and H33:H36; adjacent names/metrics may populate later. Inspect their actual cells before coding that mapping.
- Final placement starts in column N. Do not treat the bare placement numbers as populated final standings.
- Format/rules are in B39 onward and N39 onward. Use source standings order; do not invent tie-break rules or independently reorder tied teams.
- Points rule stated in source: a win by at least 4 goals gives 3/0 points; a margin at most 3 gives 2/1. In phase two, teams carry forward their previous encounter and play only the other pool's qualifiers. Finals follow the source slots, not a generic bracket template.

**Partite**

- First-phase fixture rows: 5–19 and 22–36. Second phase: 43–46, 51–54, 59–62. Finals: 67–80.
- Columns: B stage/tappa, C city, D date, E start, G scheduled end, H field, I match ID, J side A slot, K side A team, O side B team, P side B slot, Q inherited marker, U evaluation link label. L:N is the score area and R:T the SOTG summary area. Exact score/summary positions and their semantics need visual/formula verification before enabling completed-result parsing; all are blank in this snapshot.
- Columns W:AA contain parallel standings, not extra fixtures.
- Match IDs are stable source keys: `X_1`…`X_15`, `Y_1`…`Y_15`, `P_1`…`P_12`, `Q1`…`Q4`, `S1`…`S4`, `F1`…`F6`.
- The six rows marked `ereditata` have no match IDs: 41–42, 49–50, 57–58. Represent them as carry-over references in pools if useful; never add them to the schedule or team game totals.
- Many date/city/tappa cells are merged. Expand actual Excel merge ranges to their anchor values in memory. Do not globally forward-fill blanks, which would leak across section breaks or invent missing fields. Never fill scores, names or SOTG values by carrying previous values forward.
- Distinguish `X1` (initial team slot) from `1X` (eventual first-place qualifier). Preserve unresolved participants as separate slot objects. Do not infer participants from current standings until the source resolves them.
- Dates are Excel date values in the export. Preserve ISO local date and HH:mm time separately; display and compare in `Europe/Rome`, including daylight-saving changes. Do not parse Italian dates with JavaScript's ambiguous `Date(string)`.

**Valutazioni SOTG**

- A match ID, B date, C evaluating team, D evaluated team, E evaluation-form link, G:K five categories, L total, M comment.
- Match ID/date span each pair of opposing evaluations through merged cells. Expand merges, then join by match ID and evaluation direction; never by row order against `Partite`.
- Empty scores stay null. Zero is a valid supplied score. A form link labelled `valuta` is not an existing evaluation. Lorenzo's 14 October request authorizes external navigation through a Valuta button using the exact E-column hyperlink; the site must never submit a form itself. See the latest Valuta entry for the prefill contract and source warnings.

**Statistiche**

- Row 1 labels A team, B surname, C given name, D:M per-match “assist | mete”, N total assists, O total goals, P combined total. Row 2 labels slots `1a` through `10a`.
- There are no player records yet. Later populated rows can support a team player list and season totals, but are not proof of the complete registered roster or match attendance.
- The numbered match slots are not source match IDs. Do not map “1a” to an arbitrary chronological game without verified semantics. Initially expose published team/player totals and mark per-match player statistics unavailable until that relationship is established. Keep the parser extensible and document the unresolved mapping.

Preserve source spelling, including `360 Mlano`. Stable team IDs should be explicitly mapped from initial source slots, with collision checks; do not use fuzzy name matching for joins. Retain provenance (`sheet`, source row/range, match ID) on normalized records. Escape spreadsheet content as text and allow only expected HTTPS links.

## Data updates and architecture

**Recommended baseline:** a static frontend plus a scheduled GitHub Actions importer. Use Vite with TypeScript and React if comfortable, or an equally small static implementation; no server framework is needed. A Python importer with `openpyxl` is suitable for reading cached cell values and merge ranges. Keep parsing independent from UI code. Pin dependencies and document reproducible commands.

The following endpoint returned HTTP 200 without credentials and produced a valid four-sheet workbook during preparation:

`https://docs.google.com/spreadsheets/d/1k_xJctOAUqizJW00395YIvDwC5gDZKek2R26UpJ_HUQ/export?format=xlsx`

Download with timeouts, size limits and bounded retries; validate that the response is an XLSX archive rather than a login/error page. Parse cached formula values, not formulas as strings, and never recalculate or modify the organizer's workbook. Reject missing required cached results when needed for correct interpretation.

Importer output: one versioned JSON document with source URL, source-reported timestamp, fetched-at UTC timestamp, schema version, teams, matches, pools, phase slots, SOTG evaluations, player records and explicit availability flags. Nullable values must survive serialization. Validate unique match IDs, team references, evaluation directions, dates, and finite numeric scores. A past scheduled date without a valid score means “Risultato non disponibile”, not “Giocata”; a partial score needs an explicit incomplete-result state. Future scheduled fixtures remain distinct from unresolved scheduling and cancellations if those appear later.

Deploy the frontend and JSON together as one Pages artifact only after import and tests pass. A failed refresh must not replace the previous deployment. Keep the last valid browser dataset during request failures. Initially a bundled validated snapshot may power local preview, labelled with its actual download date.

| Update method | Behavior | Recommendation |
| --- | --- | --- |
| Scheduled Actions import | Downloads workbook, validates JSON, rebuilds/deploys site; no browser CORS dependency | Baseline; start with a 15-minute requested cadence during the competition |
| Browser refresh and polling | Reads the latest deployed JSON on load, on “Aggiorna”, and periodically while tab is visible | Include; polling every 60–120 seconds is sufficient for the deployed snapshot |
| Direct browser Google read | Can reduce deployment delay if a reliable endpoint works from the actual site origin | Optional upgrade only after data fidelity and cross-origin tests |
| Small read-only proxy | Fetches/caches the workbook on demand; browser refresh can get fresher source data | Later option if faster results justify another service |
| Manual workflow dispatch | Maintainer requests a fresh import/deploy through GitHub | Include as operational fallback |

GitHub's scheduler is best-effort: 15 minutes is a requested interval, not a freshness guarantee. Delays/dropped runs and automatic schedule disabling after inactivity can occur. Use an offset cron such as `7,22,37,52 * * * *`, document UTC scheduling, and revisit/disable the schedule after the event. Do not claim instant updates. Show both download age and source timestamp so stale results remain evident.

“Aggiorna” should issue a fresh request for the deployed JSON and preserve filters; it cannot make a static GitHub Pages server execute the importer. It must not contain a GitHub token or attempt unauthenticated workflow dispatch. After a manual workflow finishes, refreshing retrieves its new published data. Keep this explanation short and user-facing where relevant.

One Google query endpoint was tested:

`https://docs.google.com/spreadsheets/d/1k_xJctOAUqizJW00395YIvDwC5gDZKek2R26UpJ_HUQ/gviz/tq?tqx=out:csv&sheet=Partite&headers=0`

It returned CSV but lost mixed-type values such as the source update timestamp and some header text, and omitted a blank row. Thus its row numbers are not Excel row numbers. The inspected response did not establish browser CORS support. Do not make this the primary ingestion path or assume a successful shell request proves browser access. Google's documented Visualization query transport is another option, but its inferred types still need validation against the workbook.

## GitHub Pages deployment plan

Create a separate project repository named `ultimateciu2026` only during the later authorized deployment step. Its default URL would be `https://<verified-owner>.github.io/ultimateciu2026/`. The suggested `lorenzgorini` spelling is unverified. Inspect existing custom-domain behavior before promising the final URL; leave the professional site and domain settings alone.

Configure the Vite base path as `/ultimateciu2026/` and use hash routes such as `#/team/x1` and `#/match/X_1` so direct reloads work without a server rewrite. Use base-aware asset and data URLs. Do not use the special `<owner>.github.io` repository for this project.

Prepare workflows for push, manual dispatch and the scheduled data refresh. Use the official Pages artifact upload/deploy mechanism, least necessary permissions, environment configuration and deployment concurrency. Resolve supported action versions from current official documentation during implementation. Avoid automatic source commits solely to persist JSON; the deployment artifact can contain it. Never expose credentials in frontend code, workflow logs or source files.

## Implementation sequence and acceptance checks

1. **Source adapter first.** Parse the frozen workbook, normalize merges, document score-cell uncertainty, and generate validated JSON. Read a fresh export and confirm the same structural assumptions. Keep one authoritative importer.
2. **Main interface.** Implement schedule, team lookup/detail, match detail and pools/phases against that JSON. Add honest SOTG/roster/statistics empty states. Support loading, unknown route, no filter matches, and failed refresh.
3. **Refresh and packaging.** Add timestamps, refresh, stale-data retention and the static deployment workflows. Document the precise behavior of refresh and the maintainer's manual update procedure.
4. **Verify.** Run focused parser tests and browser checks at mobile and desktop sizes under the `/ultimateciu2026/` base path. Record commands and evidence here, including limitations. Do not edit the live sheet to create test scores.
5. **Handoff for review.** Update README with exact install/test/build/preview commands and this document with completed work, tests and remaining issues. Provide a local preview. Propose a scoped checkpoint commit according to Lorenzo's Git rules; do not commit without authorization.

Required checks:

- Frozen export produces 12 teams and exactly 56 unique scheduled matches: 30 + 12 + 14. The six inherited rows produce zero extra schedule entries. All 56 currently have no recorded result.
- Each team has five resolved first-phase games. `BFD Redshot` versus `VOLADORA` is `X_1`, Parma, 25 October 2026 at 09:00; its field is missing. `X_7` is Padova, 7 November at 10:30, campo 2. `Y_13` is Padova, 8 November at 10:30, campo 1. `F1` is 22 November at 15:00, campo 1, with slots WS1/WS2.
- Date/city inheritance respects actual merged ranges. Heading rows and side standings never become games. Team slots and qualifier slots are distinct.
- Synthetic isolated fixtures verify a legitimate zero score, missing/partial scores, a past unreported result, two opposite SOTG evaluations, inherited results, malformed schema and unresolved qualifiers. Label synthetic data and keep it out of the published dataset.
- Blank player rows produce no fake roster; no SOTG values become zeros. Unsupported match-statistics mapping stays unavailable.
- Search, team links from pools, match detail, back navigation and direct hash-route reload work. Dates do not shift across browser time zones. Keyboard navigation and mobile layouts remain usable.
- In a simulated failed refresh, existing results remain with a clear error/freshness indicator. On a valid changed dataset, updates appear without resetting the selected team. Invalid JSON/schema does not replace good data.
- Build works at the project subpath. Source attribution is visible. No secrets, form submissions, homepage changes or invented venue addresses exist.

## References and remaining decisions

- [GitHub Pages site types](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages): static project sites use a repository subpath.
- [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule): scheduling constraints and manual workflow alternatives.
- [Google spreadsheet query documentation](https://developers.google.com/chart/interactive/docs/spreadsheets): query parameters and public/private access behavior.

No user decision was needed for local implementation. Before publication verify the GitHub owner and actual Pages URL. L/N score positions have now been inspected visually and through number formats; the blank SOTG summary cells remain unused. Player match-slot semantics and a complete roster are not established by the current data. These limit specific detail features, not the schedule/team/pools implementation.

## Implementation and verification — 13 October 2026

**Local-pass checkpoint: ready for review, initially unpublished.** Starting state had no Git repository, branch or commit. The implementation is a small Vite/JavaScript static frontend with a Python adapter; React/TypeScript were unnecessary for this scope. This initial local pass created no repository, remote, commit or push. The subsequent authorized publication is recorded separately below. The professional homepage, DNS/settings, workbook and evaluation forms were untouched.

### Completed behavior and source decisions

- Italian schedule landing page with all fixtures, date/time grouping, team/slot search, date/phase/status filters, reset, empty states and a jump to the next scheduled date. Detail navigation preserves the in-memory filters. Responsive fixture cards/rows link to match details and resolved teams.
- Searchable team directory and one team-detail route, with separate upcoming, recorded and missing/incomplete results; published pool statistics and team player totals. Team lists are explicitly distinguished from match attendance/registered rosters.
- Match detail shows scheduling, score/status and directional SOTG categories, total and comment when populated. Unavailable roster/statistics/evaluations remain visible with precise explanations. Source text is escaped; form submission links are not imported or exposed.
- Five source-ordered pool tables, six carry-over references, source-defined Q/S/F progression and final classification when populated. Qualifiers are never guessed from standings. Initial `X1` and rank qualifier `1X` remain distinct.
- The only XLSX adapter is `importer/workbook.py`; download/atomic output orchestration is in `importer/__main__.py`. It checks required sheets/headings, expands actual merge ranges in memory, reads cached values, rejects Excel errors/missing cached formulas, and validates shape, identifiers, team joins, evaluation directions, timestamps and finite numeric scores. The shared JSON schema is `src/data.schema.json`; source locations are retained on records.
- `Partite!L/N` align with the left/right team scores in the read-only sheet UI, and both have integer score formatting in the frozen XLSX. `M` accepts only an empty cell or a score separator. No score was populated in either real export; synthetic tests verify legitimate zero/partial/complete values. R:T is deliberately unused: directional SOTG comes only from `Valutazioni SOTG!G:M`.
- Second-phase standings use H slots, I names and J:L points/metes. Final placements read N20:N31 and published team names from O20:O31; bare placement numbers remain empty classifications. A synthetic O20 team tests populated placement behavior.
- Statistics expose only source-published team/player totals and retain raw numbered match slots internally. They are never associated with arbitrary chronological games. No verified roster or individual match statistics are claimed.
- Downloader uses a 20-second socket timeout, a 10 MiB compressed / 80 MiB expanded size limit, XLSX archive checks and at most three network attempts with short backoff. JSON is fully validated and encoded before atomic replacement. An import failure leaves the previous JSON file intact.
- Browser requests the base-aware JSON URL with `no-store`, a 12-second request timeout and cache busting. It polls every 90 seconds while visible and refreshes on tab visibility. Failure retains the same last valid object, with download age/error; localStorage recovery is optional and validated. Older downloads cannot replace a newer browser copy. Unchanged JSON does not rebuild the main view during polling, preserving keyboard focus.
- Static hash routes and `/ultimateciu2026/` asset/data URLs support direct detail reloads. No frontend credentials, score-entry controls, invented addresses, independent qualification logic or source writes exist.

### Source comparison and quantitative evidence

Fresh anonymous import completed **13 October 2026 at 12:33:19 Europe/Rome** (`2026-10-13T10:33:19.513105+00:00`). The source still reported **11 October 2026 at 16:15:23 Europe/Rome**. The new JSON is `sourceMode: live`; the frozen workbook is never a release input.

| Check | Frozen export | Fresh export |
| --- | ---: | ---: |
| Teams | 12 | 12 |
| Unique scheduled fixtures | 56 | 56 |
| First / second / final phase fixtures | 30 / 12 / 14 | 30 / 12 / 14 |
| Carry-over rows, excluded from fixture totals | 6 | 6 |
| Resolved first-phase games per team | 5 | 5 |
| Complete or partial recorded results | 0 | 0 |
| SOTG direction rows / populated evaluations | 112 / 0 | 112 / 0 |
| Player records / populated final placements | 0 / 0 | 0 / 0 |

All normalized source content agreed, excluding fetch timestamp, source mode and workbook archive hash. Archive hashes can differ even when cell content agrees. Frozen XLSX SHA-256 remained `ac0cb86496f3d60c43e26e00cfaf773cafb1f11c97d23c248a5de66bd4ac5a1f`; fresh workbook hash recorded in the JSON is `521d39fc9884aec180532a133077bbff2d39d5501491bfcb714b7b708c4403ef`.

### Verification performed

| Verification | Outcome |
| --- | --- |
| `conda run -n general python -m unittest discover -s tests -p 'test_*.py' -v` | 17 tests passed; frozen counts, reference fixtures, merges, qualifiers, zero/partial results, two SOTG directions, player totals/final placement, schema/cached-formula failures, bounded retries and previous-file retention |
| `npm test` | 10 tests passed; shape/joins, search/filters, status, DST/date formatting, invalid HTTP/JSON/schema, changed snapshots, zero scores and older-snapshot retention |
| `TZ=Pacific/Honolulu npm test`, `TZ=Asia/Tokyo npm test` | Both passed; shared date/status logic does not depend on process timezone (not browser timezone emulation) |
| `npm ci --offline --cache /private/tmp/ultimateciu2026-npm-cache` | Clean reinstall from lock succeeded; npm reported zero vulnerabilities after patched Vite/Ajv pins |
| `uv pip install … --require-hashes -r requirements.lock --dry-run` | All seven locked Python packages matched the `general` environment; no changes required |
| `REQUIRE_LIVE_DATA=1 npm run build` | Passed; static artifact built with live JSON and the project subpath |
| `actionlint 1.7.12 -shellcheck= …` | Both workflow files passed; official release checksum verified. ShellCheck was unavailable; hosted execution remains untested |
| HTTP and browser preview | HTTP 200 at `http://127.0.0.1:4173/ultimateciu2026/`; real browser rendered the production artifact |

Manual browser checks used the Codex in-app browser. Desktop preview was 1280×720; mobile was 390×844, with an additional narrow 320×760 check. Verified search (including `cus pádova`), combined filters and no-match reset, match back-navigation/filter retention, all five pool tables, a pool-to-team link, five games on BFD Redshot’s page, team and F1 direct hash-route reloads, WS1/WS2 placeholders, honest feature empty states and unknown-route fallback. Keyboard Tab reached a labelled dropdown with a visible 3px outline; the skip link focused the main content without changing routes; next-date jump retained all 56 fixtures. A mobile status dropdown layout issue was corrected and visually rechecked. At 320px, schedule controls stayed within the page; pools had no horizontal page overflow or duplicate element IDs. The final browser state contained all 56 live fixtures and no console errors.

For actual failure recovery, the local server was stopped: “Aggiorna” kept the selected team and five existing games, showing “Dati conservati” and a network error. Invalid JSON/schema also retained the match details. The server was restarted with an isolated **SYNTHETIC** dataset: a 0–15 score, two opposite SOTG evaluations and one team player record appeared without resetting the selected team. A literal `<script>` comment rendered as text, with zero script elements in the content. These synthetic values were written only into ignored verification files and the temporary local `dist/data.json`, never into `public/data.json` or the source workbook. The served JSON was restored byte-for-byte from the live import and browser-refreshed to empty real scores/SOTG before handoff.

Local screenshots are in ignored `work/verification/`: [desktop](../work/verification/desktop.jpg), [mobile](../work/verification/mobile.jpg), [invalid refresh](../work/verification/invalid-refresh.jpg), [network failure](../work/verification/network-failure.jpg), and [synthetic score/SOTG](../work/verification/SYNTHETIC-result-sotg.jpg). They are session evidence, not tracked release assets. `SYNTHETIC-frozen-check.json` uses a deterministic test timestamp because the frozen download’s exact time was not recorded; it is not live data.

### Prepared workflows and remaining limits

`verify.yml` is the single shared install/test/live-import/build procedure, callable by Pages and on pull requests. `pages.yml` supports `main` push, manual dispatch and offset 15-minute UTC scheduling. **Its build is gated by the repository variable `PAGES_ENABLED == 'true'`, which has not been enabled.** Deploy depends on the entire successful verification/build, uses the `github-pages` environment, and has separate minimal deployment permissions/concurrency. A failed refresh does not deploy or commit partial data.

Action versions were resolved from official [Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [checkout releases](https://github.com/actions/checkout/releases), [setup-node](https://github.com/actions/setup-node), and [setup-python](https://github.com/actions/setup-python): checkout/setup-node/setup-python v7; configure-pages v5; upload-pages-artifact/deploy-pages v4. No GitHub workflow or real deployment ran in this local pass. The account, environment protection and actual Pages/custom-domain URL require checks during the separately authorized publication step. Manual update instructions are maintained in README.

**Limitations, not local blockers:**

1. Real score/SOTG/player/final-placement imports cannot be compared against populated organizer cells yet. Current source fields are empty; synthetic tests cover rendering and validation. Recheck the first real published records against the sheet.
2. Workbook anchors/headings are intentionally schema-specific. A layout change, unknown team spelling, uncached formula, new cancellation marker or unsupported result format fails the import, preserving prior data. Extend the one adapter after inspecting any new semantics; do not silently reinterpret them.
3. R:T SOTG summary semantics, a complete registered roster, player match-slot meaning and precise venue addresses remain unsupported/unverified. These do not stop schedule, pools, team lists or directional SOTG.
4. Browser checks covered the in-app browser, not real iOS/Android devices or a full screen-reader/contrast audit. Browser CORS access to Google was not added or claimed. Scheduled deployment latency remains best effort.
5. `public/data.json`, `dist/` and verification artifacts are generated/ignored. A new checkout must import fresh data before frontend tests/build. The preview process must stay running; README gives restart commands.

### Review and checkpoint

At the end of the initial local pass, the next step was a separate implementation review. Lorenzo then inspected the preview and requested repository creation, push and publication. See the current publication entry below; no source repair is required.

Checkpoint subject: **`Implement read-only CIU viewer and validated Pages pipeline`**. The subsequent publication request authorizes staging/committing the following exact changed/new implementation paths:

```text
.gitignore
README.md
docs/IMPLEMENTATION_HANDOFF.md
index.html
package.json
package-lock.json
vite.config.js
pyproject.toml
requirements.lock
importer/__init__.py
importer/__main__.py
importer/workbook.py
src/main.js
src/data.js
src/data.schema.json
src/style.css
scripts/check-data.mjs
tests/test_importer.py
tests/frontend.test.mjs
.github/workflows/verify.yml
.github/workflows/pages.yml
```

An initial repository baseline must also preserve the existing unchanged `AGENTS.md` and `tests/fixtures/source-2026-10-13.xlsx`. Exclude generated JSON/builds, dependencies, temporary binaries and `work/`. The commit body should note the 17 parser + 10 frontend tests, browser checks, source limitations and AI-assisted implementation.

## Publication — 13 October 2026

**Authorization:** Lorenzo requested creation of the separate GitHub repository, pushing this implementation and publishing it through GitHub Pages. This authorizes the previously proposed scoped checkpoint and deployment, without changing the professional homepage repository, DNS or settings.

**Current state: published and verified.** The separate local Git repository is on `main`, and [lorenz-gorini/ultimateciu2026](https://github.com/lorenz-gorini/ultimateciu2026) is its public remote. Local `origin`: `git@github.com:lorenz-gorini/ultimateciu2026.git`. Implementation checkpoint **`eeea1eb5785a77d0bbd750a52a6f807affdfafaa`** contains the 23 scoped baseline files, including the unchanged instructions/frozen fixture and excluding generated data/builds/credentials. It was pushed to `origin/main` under Lorenzo's authorization.

Lorenzo completed the official CLI/browser sign-in; API and SSH authentication both identify `lorenz-gorini`. A checksum-verified official GitHub CLI 2.102.0 is available temporarily at `/private/tmp/ciu-gh/gh_2.102.0_macOS_arm64/bin/gh`. No credential or token was written to the project or chat. Authentication was performed by Lorenzo, with the existing SSH key retained.

**Access scope:** Lorenzo explicitly limited this access to pushing this project's changes and publishing its website under his personal GitHub Pages domain. Account verification, creation/configuration of `ultimateciu2026`, its checkpoint/push, workflow execution and Pages deployment are within scope. Read-only inspection confirmed the existing `lorenz-gorini.github.io` homepage has no custom domain (`cname: null`), uses the `master` branch and the legacy Pages build type. Its repository, content, DNS and deployment settings must not be changed. No organization, gist, issue, pull-request or other repository writes are authorized. The CLI credential is account-wide and persistent; the observed OAuth scopes are `gist`, `read:org`, `repo` and `workflow`. The gist/organization scopes have not been used. Technical capability does not grant permission to use the credential for unrelated work.

The fresh public workbook was imported again before publication; 12 teams, 56 fixtures and six carry-overs still validate. All ten frontend tests and the live-data production build passed again. The 17 parser tests from the implementation pass remain applicable because importer code and the frozen fixture are unchanged.

### Exact changes made with GitHub access

1. Created the public repository `lorenz-gorini/ultimateciu2026` with its project description, connected only this local project, and pushed the authorized `main` checkpoint. No other repository received a push.
2. Configured this repository's Pages build type as `workflow`, with no custom domain. The returned URL is `https://lorenz-gorini.github.io/ultimateciu2026/`; HTTPS is enforced.
3. Created/configured its `github-pages` environment with custom deployment branch policies and the single allowed branch `main`. No reviewers/secrets/accounts were added.
4. Set only this repository's `PAGES_ENABLED` variable to `true`, enabling the prepared push/manual/scheduled deployments, and manually dispatched `pages.yml` on `main`. Its requested 15-minute UTC refresh cadence is active but remains best effort. Scheduled jobs use their own repository-scoped GitHub Actions token; no CLI credential is shipped in the website or workflow artifact.
5. Read the account identity/OAuth scope header and the existing homepage's Pages metadata to establish identity/domain behavior, then re-read the homepage metadata after deployment. Its `cname: null`, legacy build type and `master` source remained identical. No homepage content, DNS, Pages configuration, organization, gist, issue or pull-request writes were made.

### Hosted verification and outcome

The initial push run was intentionally skipped while `PAGES_ENABLED` was absent. After configuration, [manual deployment run 38390133808](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38390133808) succeeded for checkpoint `eeea1eb`: dependency installation, all 17 parser and 10 frontend tests, anonymous live workbook import, production build, Pages artifact upload and deployment all passed. Deployment completed **13 October 2026 at 13:27 Europe/Rome**.

The public HTML and JSON returned successful HTTP responses. The published JSON passed the shared validator: 12 teams, 56 fixtures, six carry-overs, `sourceMode: live`, download timestamp **13 October 2026 at 13:26:36 Europe/Rome** (`2026-10-13T11:26:36.822502+00:00`) and the unchanged source-reported timestamp of 11 October at 16:15:23. Published browser checks confirmed all 56 fixtures, BFD Redshot search returning five matches, X_1 detail reload at the project subpath, honest SOTG empty state, successful “Aggiorna” with no error and zero console errors. [Published screenshot](../work/verification/published-desktop.jpg) is local ignored evidence.

A final documentation-only checkpoint records these deployment/access facts in `README.md` and this handoff. Its commit uses `[skip ci]` because it changes no runtime/static site inputs; the tested/deployed application remains checkpoint `eeea1eb`. The directive skips only that push's workflow, not future scheduled/manual refreshes.

**Remaining limits:** source roster/player-match mapping, initial zero standings and empty real scores/SOTG remain as documented above. Hosted execution is now verified; no publication blocker remains. The local preview continues to work.

**Next owner/action:** Lorenzo can open/share the live website; no further setup is required. Revisit/disable the scheduled refresh after the championship. Future unrelated GitHub operations require their own authorization; the persistent CLI sign-in does not expand this project's approved scope.

## Visual refinement — 13 October 2026

Lorenzo requested a less minimal version with small drawings while keeping the schedule compact. Starting from `main` at `0e761c5` with a clean worktree, the site now has a small original vector disc mark in the header and a disc-in-flight illustration beside the Partite heading. A thin accent on the filters, date markers and gentle card feedback carry that visual language through the page. No competition facts, importer behavior, workflow, source spreadsheet, homepage or DNS settings changed. The SVG is authored in this project and contains no external asset or credential.

Validation: `git diff --check`, all ten frontend tests and a production build using live JSON passed. The local browser preview showed the schedule at desktop, 390px and 320px widths; at 320px the document width equalled the viewport width, and browser error logs were empty. The date counts, filters and data remained visible. The previous Python importer tests remain applicable because importer code and its fixture were not changed. Mobile checks used browser viewport emulation, not physical devices. The local preview is available at the README's URL.

Owned paths for this change: `index.html`, `src/main.js`, `src/style.css`, `src/assets/disc-flight.svg` and this handoff. Checkpoint `802ec7194fd5e6e21174696d80e017aa40826542` was pushed only to `lorenz-gorini/ultimateciu2026`. [Pages run 38399589087](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38399589087) passed its fixture tests, fresh live import, frontend tests, build, artifact and deployment. The public project URL showed the new artwork, all 56 fixtures and zero browser errors. Its live download timestamp was 13 October 2026 at 14:46:05 Europe/Rome. GitHub emitted non-blocking notices about Node 20 based actions running under Node 24 and an upcoming `ubuntu-latest` image migration; this deployment succeeded. No other GitHub repository was changed. No action is required from Lorenzo to use the revised website.

## Visual refinement, second pass — 13 October 2026

Starting from clean `main` at `4e7823e`, Lorenzo requested a whiter background, subtle card depth, darker tabs and match banner, and the download/source update times plus “Aggiorna” beside the header navigation. He offered a foggy ultimate-field image with no foreground people and explicitly allowed realistic AI generation. The schedule now uses a shallow photograph-style banner; the page and cards are white with light shadows; darker navigation and button colors improve emphasis. The two timestamps and refresh control moved into the header on all routes. A compact disclosure preserves the exact explanation that “Aggiorna” reads the latest published JSON while the spreadsheet import runs separately. The footer identifies the banner as AI-generated illustration so it cannot be mistaken for a verified competition venue.

The banner was generated with the built-in `image_gen` tool, then resized to a project-owned 1800×673 WebP (`src/assets/foggy-ultimate-field.webp`, 122 KiB). The source PNG remains in Codex generated images; the deployable WebP is tracked locally. Prompt: “Photorealistic, extra-wide shallow website banner of an empty dew-covered ultimate frisbee playing field at dawn; subtle white sidelines and a few orange boundary cones, low fog, distant trees, cool teal-green grass and blue-gray mist, slight warm sunrise. Quiet left-side space for a white heading. No people, faces, silhouettes, soccer goals, stadiums, branding, text, watermarks or heavy HDR.” This is decorative generated imagery, not a photograph of the source’s Parma, Milano or Padova fields. The previous project-drawn `disc-flight.svg` is retired because the photo replaces its title illustration.

Local checks passed: `git diff --check`, all 10 frontend tests, production build against validated live JSON (12 teams, 56 fixtures), and browser review at desktop, 390px and 320px. The 320px page showed no horizontal overflow. Header refresh and its disclosure worked, all fixtures remained after refresh, the team route showed 12 cards, and browser error logs were empty. The importer and workflows were unchanged, so the Python parser tests remain applicable; device-width checks used browser emulation, not physical phones. Owned paths: `index.html`, `src/main.js`, `src/style.css`, `src/assets/disc-flight.svg` (deletion), `src/assets/foggy-ultimate-field.webp` (addition), and this handoff.

Checkpoint `f5bc904b89d50a85d66bee87331f04d0b8231b0b` was pushed only to `lorenz-gorini/ultimateciu2026`. [Pages run 38401918375](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38401918375) passed the frozen fixture tests, fresh public workbook import, frontend tests, build, upload and deployment. The public page served the new WebP banner and header controls, displayed 56 fixtures, and logged no browser errors. Its new live download time was 13 October 2026 at 15:03:52 Europe/Rome. [Published screenshot](../work/verification/published-foggy-banner.jpg) is ignored local evidence. GitHub repeated non-blocking Node 20 deprecation and `ubuntu-latest` migration notices; this deployment succeeded. No homepage repository, DNS, spreadsheet, form, or other GitHub repository was changed. No action is required from Lorenzo to use the revised site.

## Manual refresh feedback — 13 October 2026

Starting from clean `main` at `8d74d0b`, Lorenzo asked whether the design task was complete and reported that “Aggiorna” appeared inactive. The design had already been deployed successfully. Clicking the public button completed without browser errors but left both data timestamps unchanged and gave no success feedback because the served copy was unchanged. A manual click now shows a persistent, accessible status with the check time and distinguishes a newly loaded copy, no newer published copy, and failure. Data timestamps retain their actual meaning, and automated polls do not rewrite the manual result. The stable status node sits outside the dynamically rebuilt controls so assistive technology can announce the result. No credential or workflow trigger is exposed in the browser.

Validation: ten frontend tests (including last-valid-data failures and changed data), production build against 12 teams/56 fixtures, and `git diff --check` passed. Local browser checks confirmed a timestamped no-new-copy message, preservation of the BFD Redshot filter and its five fixtures, zero browser errors, and readable feedback without horizontal overflow at 320px. The original importer and workflow logic are unchanged. GitHub API reports `pages.yml` as active; its declared cron remains `7,22,37,52 * * * *`. No scheduled runs appeared in the inspected run history at this point. Push/manual imports are verified; the scheduled cadence is configured but its actual execution is still unverified and must not be described as guaranteed. Owned paths: `index.html`, `src/main.js`, `src/style.css`, `README.md`, and this handoff. Next step: push the project-only checkpoint and verify its fresh import, Pages deployment and live manual feedback.

Checkpoint `d5438757bdcc5bb5913f26897b55d9fb32e67aaf` was pushed only to the project repository. [Pages run 38405245338](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38405245338) succeeded. Lorenzo then requested the background refinement below while deployment was running; final public verification will cover both the refresh feedback and that revision together.

## Quiet sunrise background — 13 October 2026

Lorenzo clarified that the image should read as a cool sunrise with low morning mist, and should be a subdued background rather than a prominent banner. Starting from `d543875`, the built-in `image_gen` tool edited the previous project image into `src/assets/sunrise-ultimate-field.webp` (1800×673, about 132 KB). The original generated PNGs remain in Codex's generated-images directory; the current optimized WebP is the sole active website photo. The retired `foggy-ultimate-field.webp` is removed from the checkout and remains recoverable in Git history.

Edit prompt: “Change the supplied empty ultimate field to unmistakably cool early morning sunrise: soft pale blue-gray sky, silver low morning fog over dew-covered grass, distant trees softly emerging from mist. Remove the strong orange sun and golden evening mood; retain only faint rosy-pearl dawn light near the horizon. Preserve the empty field, white sidelines, small orange cones and wide composition. Photorealistic and uncluttered; no people, faces, silhouettes, football goals, buildings, text, logos or watermarks. Use as a quiet page background behind opaque white cards.” The generated scene is decorative and does not identify a competition venue; the footer continues to disclose its AI origin.

The image is now a fixed decorative page backdrop with an 80% white overlay (86% on mobile), while fixture, team and pool cards stay opaque. The compact Partite heading uses a white panel instead of a photo banner. A solid dark header, pale active tab and refresh button separate navigation from the background. This avoids making imagery or scroll animation the main focus. No importer or workflow logic changed.

Validation: ten frontend tests, production build and `git diff --check` passed. Browser review covered schedule, team cards, pools and X_1 details; the 390px view had matching document/viewport width and no horizontal overflow. Refresh feedback remained visible in the new header; browser error logs were empty. The preceding 320px refresh check remains applicable to the unchanged message logic. Owned paths: `index.html`, `src/style.css`, `src/assets/foggy-ultimate-field.webp` (deletion), `src/assets/sunrise-ultimate-field.webp` (addition), and this handoff. Next step: project-only checkpoint/push and combined public verification.

**Published and jointly verified:** background checkpoint `b09f71ca6f5d5ec4b09ecdcaf4939279cecdeb5b` was pushed only to `lorenz-gorini/ultimateciu2026`. [Pages run 38406172468](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38406172468) passed the parser checks, fresh import, frontend tests/build, artifact and deployment. The public browser showed the sunrise WebP with the 80% white overlay, dark header and 56 fixtures, with no console errors. Live import timestamp: 13 October 2026 at 15:36:01 Europe/Rome. Manual clicks displayed “Verificato alle 15:36:51: nessuna nuova copia pubblicata” and later “Verificato alle 15:37:11: nessuna nuova copia pubblicata”; the data timestamps stayed unchanged because the published copy had not changed. The second click preserved the BFD Redshot search and its five fixtures. Filters were then reset. [Final public screenshot](../work/verification/published-sunrise-refresh.jpg) is ignored local evidence.

The previous design task, refresh feedback fix and background refinement are all complete. A final documentation-only `[skip ci]` checkpoint records this verification without rebuilding unchanged assets. The remaining operational limit is the configured but as-yet unverified scheduled execution noted above; push/manual imports and manual browser checks are verified. No homepage, DNS, spreadsheet/form or other repository writes occurred. Lorenzo can review the public site immediately; no setup action is needed.

## Periodic data refresh handoff — 13 October 2026

### Objective, evidence and decision

**Status: ready for implementation by the next model.** This research/documentation pass started on clean `main` at `8118f33`. Lorenzo requested a viable automatic refresh approach and a handoff, with special attention to match weekends and avoiding a publicly exposed Raspberry Pi. Only this handoff was edited; no workflow, runtime, GitHub configuration or Pi changes were made, and no deployment was triggered in this pass.

**Decision:** retain GitHub Pages and the existing scheduled GitHub Actions importer. No new API, server, Google credential or public inbound connection is required. Data flows from the public Google XLSX export → GitHub-hosted importer/validation/build → Pages artifact → browser JSON fetch. Browser “Aggiorna” and the existing visible-tab polling then retrieve that published copy. A browser check cannot make the organizer enter scores or force an import.

Verified in this pass:

- `.github/workflows/pages.yml` already requests `7,22,37,52 * * * *` (every 15 minutes, UTC), supports push/manual triggers, and calls the shared `verify.yml` procedure. GitHub API returned `state: active`.
- The API request `GET repos/lorenz-gorini/ultimateciu2026/actions/workflows/pages.yml/runs?event=schedule&per_page=5` returned `total_count: 0`. There is no observed scheduled execution yet. This newly created repository's missing runs do not establish a root cause. Manual/push deployments are proven by the preceding entries.
- Local validated JSON has match dates 25 October, 7–8 November and 21–22 November 2026. Do not freeze these into importer constraints; they are planning evidence and may change in the source.
- The current build imports fresh data and validates/tests it before deployment. Failure leaves the previous Pages deployment intact. Concurrency is already serialized with `cancel-in-progress: false`.

GitHub documents that scheduled events can be delayed or dropped under load, execute on the default branch, and are disabled after 60 days without repository activity in public repositories. Therefore this is a best-effort refresh target, not a real-time guarantee. Sources: [schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [workflow troubleshooting](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows). A manual run passing is not evidence that cron delivery works.

### Concrete implementation plan

1. **Inspect before editing.** Read `AGENTS.md`, `README.md`, this section and applicable Git/Python rules. Inspect worktree and remote status. Recheck workflow state, `PAGES_ENABLED`, default branch, deployed workflow contents and recent runs filtered by `event=schedule`. Distinguish missing events from skipped builds and failed imports. Remove the obsolete comment saying publication authorization is pending; publication was authorized and completed. Do not rebuild the importer or introduce a second deployment workflow.

2. **Use a simple season schedule.** Proposed default: every 15 minutes throughout Saturday/Sunday and hourly Monday–Friday, through 23 November 2026 inclusive in `Europe/Rome`. Covering all weekends avoids fragile hardcoded match-date logic and includes rescheduling within the season. Use these UTC cron expressions in the existing `pages.yml`:

   ```yaml
   schedule:
     - cron: "7,22,37,52 * * * 0,6"
     - cron: "7 * * * 1-5"
   ```

   This requests 312 runs/week rather than the current 672, before delays/skips. It is intentionally all-day UTC on weekends: during these competition dates Rome is UTC+1 after the 25 October clock change, so late Sunday local coverage is included; Saturday's first local hour remains hourly. No fixture relies on that midnight boundary. Do not claim the cron expressions follow Rome wall time. Retain push and manual dispatch regardless of calendar date.

3. **End frequent imports explicitly.** Add a small tested schedule-policy helper (suggested `scripts/refresh_policy.py`) and an inexpensive decision job before the reusable build. For scheduled events only, compare an aware current time in `Europe/Rome` against an explicit season-end date; output whether to build. Push/manual events bypass this season cutoff, while `PAGES_ENABLED` remains the overall deployment switch. Pass the decision through job outputs, so a skipped build also skips deployment. Use standard-library `zoneinfo`; do not install application dependencies merely to evaluate the gate. Expose the end date in one authoritative place and document how to extend it for postponed matches. After the cutoff, scheduled decision jobs may still start but must skip import/build/deploy; removing the cron later stops those small runs entirely. Do not imply this gate disables the GitHub workflow itself.

4. **Make stale publication visible.** Preserve both existing data timestamps and manual check feedback. Add a restrained Italian warning when a scheduled match is today in `Europe/Rome` and `fetchedAt` is more than 60 minutes old: e.g. “La copia pubblicata risale a più di un’ora fa. Consulta il foglio originale per eventuali aggiornamenti.” Base this on downloaded age, not `sourceReportedAt`: the organizer's timestamp may stay unchanged even after a successful check. Use the existing source link. This warns about freshness; it cannot prove the scheduler failed. Do not advertise “live” scores or guaranteed 15-minute delivery. Preserve filters, cached validated data and accessible status announcements.

5. **Keep security and failure behavior.** Continue anonymous read-only XLSX downloads on GitHub-hosted runners, bounded retries/timeouts, schema validation and atomic publication. Keep `contents: read` and deployment-only `pages: write`/`id-token: write`; do not introduce a personal token into Actions or browser code. No browser-accessible dispatch endpoint, automatic data commits, self-hosted runner, port forwarding, Tailscale Funnel, router changes or Pi service. Keep the professional homepage/DNS and source spreadsheet/forms untouched. A failed source import must never publish empty or synthetic data.

6. **Update the existing README and this record.** Explain automatic import versus browser refresh, actual cadence and UTC semantics, the cutoff, manual recovery, and verified versus pending scheduled execution. Keep this file authoritative; do not create another competing refresh-status document. Changing the fetch timestamp on a successful unchanged import is correct: it records a new validated download. Keep deploying those successful copies initially; a content-hash optimization that suppresses publication would make that freshness timestamp misleading unless separately designed.

### Tests and operational acceptance

- Unit-test the schedule gate with injected times: scheduled before/after cutoff, Rome date around UTC midnight, manual and push after cutoff. Test stale-warning behavior before/after 60 minutes, a Rome match day versus an ordinary day, and unchanged organizer timestamp with fresh `fetchedAt`. Synthetic timestamps/data stay in tests.
- Run the existing parser/frontend suites and production build using the README commands after a fresh validated import. Validate workflow YAML/job outputs and conditional dependencies; check `git diff --check`. Browser-check warning/readability, “Aggiorna”, filter preservation and last-valid-data behavior. Never simulate source failure by modifying the organizer's sheet or breaking production.
- After a reviewed project-only deployment, use one manual workflow run to verify the import/build/deploy path and fetch the public JSON with caching disabled. Record run URL, conclusion and `fetchedAt`. Preserve the current separate `sourceReportedAt` meaning; source scores need not change for this test.
- **Scheduled verification remains a separate acceptance item:** collect at least two successful runs whose event is actually `schedule`, with run URLs/times and the public JSON timestamp after each. Two runs prove execution was observed, not reliability or a timing guarantee. If there are no events after a 24-hour observation window, record this as an unresolved scheduler-delivery issue and investigate GitHub's workflow status/default-branch/settings before proposing a fallback. Do not keep rewriting cron blindly or mark scheduling complete because a manual run succeeds. An observation window does not require holding an agent turn open; Lorenzo can request a later check.
- Before the first match weekend, verify a recent scheduled successful deployment. During matches, more than 60 minutes of published-data age is the practical signal for a manual recovery check. GitHub failed-run notifications do not detect an event that was never created; do not treat them as a missing-run monitor.

Run from this project folder on the Mac (use installed `gh`, or the temporary CLI path recorded above if still present):

```sh
# Read-only diagnosis.
gh api repos/lorenz-gorini/ultimateciu2026/actions/workflows/pages.yml --jq '{state,path}'
gh run list --repo lorenz-gorini/ultimateciu2026 --workflow pages.yml --event schedule --limit 10
gh variable get PAGES_ENABLED --repo lorenz-gorini/ultimateciu2026

# Routine recovery: explicitly request a fresh import/deployment on main.
gh workflow run pages.yml --repo lorenz-gorini/ultimateciu2026 --ref main
gh run list --repo lorenz-gorini/ultimateciu2026 --workflow pages.yml --event workflow_dispatch --limit 3
# Inspect/watch the newly created run ID, then press Aggiorna on the public site.
gh run watch RUN_ID --repo lorenz-gorini/ultimateciu2026
```

The same recovery is available at **Actions → Refresh data and deploy Pages → Run workflow → main**. If the import fails, inspect the failing log and source layout; the public site continues serving its previous valid data. Do not overwrite that copy to make a check pass.

### Fallback only if scheduling is inadequate

An external scheduler can send an authenticated outbound HTTPS `workflow_dispatch` request to the same GitHub workflow. The website and its data still remain public on Pages. A Pi acting solely as that outbound timer needs no public listener and no change to Tailscale access, but introduces uptime/credential maintenance. It is optional, not the recommended first implementation; this handoff does not authorize Pi changes or creation of an external service account.

If later approved, prefer a repository-restricted fine-grained token with **Actions: write** and an expiry, stored only in the scheduler's secret storage, or a suitably scoped GitHub App token. Actions-write still permits more than a single dispatch; it is not a harmless public key. Never reuse the broad Mac CLI credential, place a token in a URL/static asset, or expose an unauthenticated dispatch API. Restrict dispatches to this repository, `pages.yml`, `main`, apply a cooldown and check current runs to avoid duplicates. A hosted scheduler avoids Pi exposure too, but requires separate provider/cost/security review. [GitHub dispatch API and permission requirements](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event).

**Next owner/action:** the smaller model implements steps 1–6 and records tests plus remaining hosted acceptance. The present request is for a handoff; no runtime changes were applied here. Proposed documentation checkpoint: `Document periodic refresh implementation handoff` (only `docs/IMPLEMENTATION_HANDOFF.md`). Review before committing this checkpoint. For the implementation handoff, Lorenzo can send: “Read AGENTS.md, README.md and the Periodic data refresh handoff section in docs/IMPLEMENTATION_HANDOFF.md. Implement the recommended GitHub Actions approach, test locally, and report the exact changes and hosted checks still pending. Keep the Raspberry Pi and other repositories untouched. Prepare the result for my review before pushing scheduling changes.”

## Team selection and remembered preferences — 13 October 2026

The 14 October [UI correction](#single-team-shortcuts--14-october-2026) supersedes this section's visual layout and shortcut-click behavior: one combined toggle-button group replaces separate selected chips/recent shortcuts, visible redundant captions are removed, and clicking the input opens the chooser. Storage, team-OR/secondary-AND filtering and failure behavior still apply.

### Objective and interaction contract

**Status: ready for implementation, alongside periodic refresh above.** Lorenzo requested this addition to the handoff, not a UI implementation in this turn. Inspecting `src/main.js` confirms the current schedule has one free-text search and three single-value secondary filters, all in one form; no team preference is currently persisted. The existing data cache is separate. The starting checkout is still `main` at `8118f33`, with the preceding handoff edits preserved.

**Decision:** make team selection the dominant control, support choosing several teams, and remember preferences with browser `localStorage`. This is small enough to implement without a server or cookie. It remembers this browser profile on this device, not a person across devices; private browsing, clearing site data or unavailable storage can remove persistence. Do not add analytics, accounts or device identifiers.

1. **Primary row:** use the full available width for a visibly larger “Squadre” label and search input, with placeholder “Cerca una squadra o uno slot…”. Prefer a clean underline, generous padding and clear focus treatment on the existing opaque white filter panel. Add concise helper text: “Digita per cercare, oppure seleziona una o più squadre.” Keep the real label visible; an underscore character or placeholder alone is not a label. The underline must retain adequate contrast and the input must look interactive.
2. **Team options:** focusing/clicking the control opens the available team list; typing narrows options with the existing case/accent-insensitive normalization. Use an accessible searchable chooser with labelled checkbox options and removable selected-team chips. The entire row should be easy to tap. Do not use a native multi-select requiring Ctrl/Cmd clicks. Every chosen team uses its canonical source ID and displayed source name.
3. **Exact filtering semantics:** selected teams are combined with OR: a fixture matches when either resolved participant is any selected team; show each fixture once, including when both selected teams play each other. Date, phase and status combine with this result using AND. With no teams selected, typing continues the existing live text/slot filtering of fixtures, so selecting an option is optional. With selected teams, text narrows the available choices only; fixture results remain based on selected IDs. Show “Filtra le squadre da aggiungere” as the input hint in this state, so an extra query cannot silently hide the selected team's matches. Selecting a team clears the typed query. Empty selection plus empty query means all teams. Unresolved slots remain searchable as text but are not stored as invented team IDs.
4. **Recent shortcuts:** below the primary input, show “Recenti” and up to three distinct team buttons, newest first. Record an explicit selection from the chooser or a recent shortcut; do not record keystrokes, automatic restoration, deselection, refreshes or incidental team-detail navigation. Clicking a recent shortcut selects/adds that team without removing other selections and moves it to the front; a selected shortcut can show its selected state, with removal handled by the chip or checkbox. Hide this row until history exists. Re-selecting a team must never create a duplicate.
5. **Remember choices:** persist the last explicit selected ID set and the three recent IDs under a project-specific versioned key, e.g. `ultimateciu2026-team-preferences-v1`, separate from `ciu2026-data-v1`. On a later visit, restore the selected set once validated source data is available. Show the chips immediately with “Selezione ricordata su questo browser” and a clear way to return to all teams. Persist an explicitly cleared selection as empty; do not auto-select the newest recent team after the user chose all teams. Do not persist unfinished search text, date, phase or status across visits. Within the current visit, preserve all filters during data refresh and detail-route navigation as today.
6. **Secondary row:** move “Data”, “Fase” and “Stato” below team search/history, with smaller visual emphasis, compact native dropdowns and an underline treatment consistent with the main input. Keep native dropdown indicators and visible labels; “multiple choices” for these controls means their normal menu of options, not an added multi-select requirement. Keep them single-value for this pass. On narrow screens wrap naturally without horizontal scrolling, retaining comfortable touch targets (aim for at least 44px height). Place “Azzera filtri” here. It clears current query, selected teams, date, phase and status, and saves the empty team selection, but retains recent history. Offer a discreet “Cancella recenti” action that erases only history.

### Implementation boundaries and failure behavior

- Extend `filterMatches` in `src/data.js` without breaking callers that pass only `{}` or `{ phase: "finals" }`. Implement pure selection/history normalization helpers where useful and test behavior rather than CSS structure. Update the schedule renderer/event handlers in `src/main.js` and responsive rules in `src/style.css`. The separate “Squadre” directory can retain its existing text search; do not expand the task into a route redesign.
- Validate saved values as untrusted input: expected version/object, arrays of strings, unique IDs, maximum three recents, and IDs present in current validated data. Discard malformed preferences safely and prune removed teams. Resolve names from current data so renamed teams display correctly. Unknown IDs must not produce a permanently empty schedule. On data refresh, reconcile IDs without replacing the user's active choices with an older stored value.
- Wrap storage reads/writes in error handling. If storage is blocked/full, filtering and recent shortcuts still work in memory for the visit. Store IDs only, not source data, tokens, personal details or search history. `localStorage` shares the GitHub Pages origin with other subpaths, so use this project's distinct key and never call `localStorage.clear()` or modify unrelated keys.
- Preserve focus/caret and open chooser state during typing; do not rebuild the focused input on every keystroke. Support keyboard navigation to options, Space to toggle a checkbox, Escape to close, and normal Tab order. Give chip-removal buttons labels such as “Rimuovi BFD Redshot”. Keep result counts announced politely; avoid announcing a whole re-rendered page. Maintain readable contrast against the decorative background.
- Inspect the existing “Prossima data” action: if it clears team selection to reveal the next date, apply the same explicit reset/persistence semantics, update all visible chips/controls and preserve history. Do not leave UI and filtering state inconsistent. Update its helper text if needed to explain that it displays all teams.
- The initial brief's all-fixtures default now applies to first visits and empty saved selections; restoring an explicitly chosen team set on repeat visits is the requested exception. Do not change importer, source schema, scores, assets or deployment logic for this UI task.

### Acceptance checks and handoff delivery

1. Test no selection, one/two/three selected teams, both selected teams in the same fixture (no duplication), text-only name/slot search, accent/case matching, and conjunction with each secondary filter. Check that typing to add a team does not unexpectedly hide matches already selected.
2. Test recent ordering/deduplication/three-item limit, clear-history versus reset-filters behavior, selection restoration including an explicitly empty set, malformed/unknown IDs, renamed/removed teams and denied storage. Use clearly synthetic preferences; never alter the frozen fixture.
3. Browser-check a first visit, selection then reload, returning from team/match details, “Aggiorna”, automatic data refresh, reset and next-date navigation. Verify keyboard operation, focus retention while typing, selected-chip removal and no overflow at 320px/390px. The team search must be visually more prominent than date/phase/status at both desktop and mobile widths.
4. Run relevant frontend tests, production build and `git diff --check`; run the broader checks required by any simultaneously changed scheduling code. Record actual results and remaining limitations here. No importer rerun/test expansion is needed solely for CSS or preference changes unless data-related code is also changed.

**Next owner/action:** the smaller model should implement both requested handoff sections and prepare a local preview for Lorenzo's review before pushing. Use this combined prompt instead of the earlier refresh-only prompt:

> Read AGENTS.md, README.md, and the “Periodic data refresh handoff” and “Team selection and remembered preferences” sections in docs/IMPLEMENTATION_HANDOFF.md. Implement both: the GitHub Actions refresh plan, and prominent multi-team search with three recent shortcuts, locally remembered selection and smaller secondary filters. Follow the specified selection/reset semantics, test the behavior and provide a working local preview. Record verification and pending hosted checks in the same handoff. Keep the Raspberry Pi, source spreadsheet and other repositories untouched. Stop for my review before pushing these changes.

Documentation-only verification for this turn: inspected the existing filter implementation and preserved the earlier refresh handoff; `git diff --check` passed. Runtime/tests were not changed or run. The combined documentation checkpoint now consists only of `docs/IMPLEMENTATION_HANDOFF.md`, with proposed subject `Document refresh and team selection implementation plans`; it remains uncommitted for review.

## Local implementation results — 13 October 2026

**Status: complete locally, awaiting Lorenzo's review before push.** Starting branch/commit: `main` / `8118f33`. The only pre-existing change was this handoff's two implementation plans; these were preserved. The instruction to stop before pushing these changes supersedes the earlier publication scope for this review pass. No GitHub write or Raspberry Pi/homepage/DNS/source-spreadsheet change occurred. GitHub access in this pass was read-only inspection of this project's metadata/runs and the official actionlint release.

### Completed behavior

- Partite now puts a larger labelled, underlined team search in its own primary row. Its chooser uses native checkboxes, can select several teams, and displays removable chips. Recent shortcuts contain up to three explicit choices. Text-only name/slot search still filters fixtures; with selected teams, text narrows additional choices and selected IDs determine fixtures. Selected teams use OR, secondary filters use AND, and fixtures never duplicate.
- `src/preferences.js` validates versioned stored preferences, removes unknown/duplicate IDs and caps history. Names resolve from the current dataset. It restores an explicit selection once per visit; later data refresh reconciles current memory rather than reloading old preferences. Reset/next-date save an empty selection and retain history; clear-history preserves selection. Storage failure leaves the controls working in memory and explains that persistence is unavailable. No credentials/cookies/identity tracking were added.
- Typing updates options/results without replacing the input, preserving caret/focus. ArrowDown enters the first visible checkbox, Tab/Space operate native controls, and Escape closes the chooser. Changed-data refresh captures focus after its request, so ongoing typing/navigation is preserved. Refresh check feedback and both existing timestamps retain their meanings.
- `.github/workflows/pages.yml` now has the proposed weekend/weekday UTC cron expressions and a lightweight policy job before the existing shared build. `scripts/refresh_policy.py` is dependency-free, emits `refresh=true/false` as a job output, and skips scheduled import/build/deployment after 23 November 2026 in Rome. Push/manual requests bypass the cutoff; `PAGES_ENABLED` remains the overall switch. No duplicate importer/deployment path or new service was introduced. The obsolete pending-publication comment was removed.
- A stable warning above content appears on a Rome match day if published download age exceeds 60 minutes, linking to the original spreadsheet. Fresh downloads do not warn merely because the organizer timestamp is old. README describes selection/storage/reset, schedule UTC boundaries, cutoff extension and deployed versus pending state.

### Verification evidence

| Check | Result |
| --- | --- |
| Python suite: `conda run -n general python -m unittest discover -s tests -p 'test_*.py' -v` | 20 passed: 17 existing parser checks + 3 refresh-policy tests; synthetic cutoff/midnight/DST inputs, manual/push bypass and invalid inputs |
| Frontend suite: `npm test` | 15 passed: 10 existing + 5 selection/preferences/stale-warning checks, including denied/full storage and explicit empty restoration |
| Fresh import: `conda run -n general python -m importer` | Valid live download, 12 teams, 56 fixtures, 6 carry-overs; fetched `2026-10-13T21:40:49.435474+00:00` (23:40:49 Rome); unchanged organizer timestamp 11 October 16:15:23 |
| Production build: `npm run build` | Passed at `/ultimateciu2026/` using validated live data; generated data/build remain ignored |
| Workflow static check: actionlint 1.7.12 | Passed on pages.yml and verify.yml, including output/needs/conditional wiring; shellcheck/pyflakes integrations disabled (neither installed) |
| Diff check: `git diff --check` | Passed |

Official actionlint Darwin arm64 archive was downloaded only to `/private/tmp/ciu-actionlint` and checked against its published SHA256 (`aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f`). No runtime dependency/lock was changed. A first browser pass exposed a typo in the new stale predicate; it was fixed, covered by the new test and rebuilt. That intermediate error is resolved, not a remaining limitation.

Browser verification used the production preview with actual live JSON: text search, unresolved slot search, one/multiple selections, recent ordering/deduplication/three-item cap, reset then reload (56/56 restored), remembered selection then reload, chip removal, clear-history, next-date reset, return from match/team details, keyboard selection and input caret retention. With three teams selected, 12 unique fixtures were displayed; typing another name did not alter these results. A changed local import loaded via Aggiorna while preserving four selected teams and the date filter (7/56 fixtures); its status confirmed a new copy. A later unchanged check preserved query/selection and showed successful no-new-copy feedback. Fresh final-preview console checks found no application errors.

Responsive checks at 320px and 390px found no horizontal overflow: document client/scroll widths were respectively 305/305 and 375/375 (15px scrollbar reserved). These are browser viewport tests, not physical-device or screen-reader audits. The controls use labels, native checkboxes/selects, visible focus, accessible removal names and polite result counts; full assistive-technology testing remains outside this validation.

An isolated copy under ignored `work/verification/stale-preview/` used clearly marked synthetic dates/timestamps (never public/data.json, main dist or a deployment artifact). The stale warning was visible/readable, and stopping that test server then pressing Aggiorna produced “Ultimi dati validi conservati” while retaining 56 fixtures. The test server was stopped and its tab closed. Automated failure tests additionally cover HTTP, invalid JSON/schema and older snapshots. The primary preview remains running at [localhost:4173](http://127.0.0.1:4173/ultimateciu2026/).

The same isolated preview was restarted for a final changed-data automatic-poll check after a temporary usage-limit interruption. With BFD Redshot selected and query `one` being typed, the test-only JSON download timestamp advanced to `2026-10-13T21:51:08.616Z`. The normal 90-second browser poll loaded it without a manual click: the stale warning disappeared, the selected team's five fixtures remained, the chooser stayed open, and input focus/query/caret (`search`, `one`, position 3) were preserved. Console errors were empty. The temporary test server/tab were stopped/closed again. The policy CLI was also executed locally with `workflow_dispatch` and emitted `refresh=true` to its output file. The final main preview showed three remembered teams and recent shortcuts, 12 unique fixtures and no console errors. [Final local screenshot](../work/verification/team-selection-local.png) is ignored review evidence; temporary viewport overrides were reset.

### Hosted evidence, pending checks and checkpoint

**New evidence supersedes the earlier zero-run observation:** the read-only GitHub inspection now found one completed successful `schedule` run, [38447169780](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38447169780), created 13 October at 20:29:31 Rome and updated at 20:31:01. It ran the existing deployed workflow at `8118f33`; it does not verify the revised policy. API also confirmed default branch `main`, workflow `active`, and `PAGES_ENABLED=true`. The deployed workflow blob matched the pre-edit local workflow. Scheduling has been observed once; timing/reliability is not guaranteed by this evidence.

After Lorenzo approves the local preview: review the scoped diff, checkpoint/push only this project, verify a manual full import/deploy plus public JSON, then collect at least two successful scheduled executions of the new workflow with URLs and public timestamps as specified in the acceptance plan. If no scheduled events appear in a 24-hour observation window, investigate before considering the optional external dispatcher. No Pi or external scheduler configuration is required now.

Proposed checkpoint subject: **`Add remembered team selection and seasonal data refresh`**. Exact owned paths (including the existing handoff plans):

```text
.github/workflows/pages.yml
README.md
docs/IMPLEMENTATION_HANDOFF.md
index.html
scripts/refresh_policy.py
src/data.js
src/main.js
src/preferences.js
src/style.css
tests/frontend.test.mjs
tests/test_refresh_policy.py
```

No stage/commit/push was made. Generated live JSON, dist, synthetic preview copies, screenshots, dependencies and temporary validation binaries stay excluded. Lorenzo's next action is to review the local preview; after approval, the agent can stage/commit exactly these paths and publish the project-only update. Suggested resume message: “The local preview is approved. Commit and push the scoped team-selection and seasonal-refresh changes, verify the deployment, and report which scheduled-run checks remain pending.”

## Single team shortcuts — 14 October 2026

**Status: corrected locally, pending review before publication.** Lorenzo's annotated screenshot and direct instructions rejected the duplicated selected-team and recent-team rows, requested one group of buttons beside the input, and removed the repeated visible Squadre/Data/Fase/Stato captions. Starting branch remains `main` at `8118f33`; all prior uncommitted implementation was retained.

The primary input now opens the chooser on both focus and click (including another click after Escape); it remains editable and filters choices. A small arrow inside the underline can open/close it. The single shortcut group displays the union of up to three recent IDs and all selected IDs, each once. Teal/check means included; white/plus means available. Each button toggles inclusion in either direction, including by keyboard Space. Selecting promotes recent history; deselecting does not. A selected team outside the three recent IDs remains visible; removing such a button restores focus to the search input. This avoids hidden selections when more than three teams are chosen.

The shortcut group sits beside the search on desktop and wraps underneath on narrow screens. Separate selected chips, visible Recenti headings, normal persistence notes and the old “Scegli squadre” caption are removed. Labels/helper text remain visually hidden for accessibility. The secondary dropdowns display just their chosen values (such as “Tutte le date”); their accessible names remain Data/Fase/Stato. “Cancella recenti” is available inside the open chooser, and keeps selected teams visible in the single group. Blocked-storage feedback remains visible when relevant.

Lorenzo then requested an even smaller secondary row. Its dropdowns now use 0.76rem text, at most 170px width per desktop control, 36px desktop height and reduced vertical spacing; the reset button follows that scale. Mobile controls retain 44px touch heights. A mobile date choice still reduced Redshot's five fixtures to the two on 25 October, and returning to all dates restored five. The final layout has no repeated visible captions.

Preference writes now occur only on explicit choices/reset/history-clear actions, not incidental redraws. This avoids an older tab replacing a newer saved selection merely by navigating or polling. A two-tab browser check confirmed this: the older tab retained its empty in-memory selection (56 fixtures), while the main tab's newer Redshot choice still restored five fixtures after reload. The temporary second tab was closed.

Owned revision paths: `src/main.js`, `src/preferences.js`, `src/style.css`, `tests/frontend.test.mjs`, `README.md`, and this handoff. No importer, schema, fixture, scheduling or deployment change was needed for this correction. The complete pending checkpoint is still the exact 11-file scope listed above, with subject `Add remembered team selection and seasonal data refresh`.

Verification: **16 frontend tests passed** (including a new shortcut-union/toggle test), production build passed with 12 teams/56 live fixtures, and `git diff --check` passed. Browser checks verified toggling on/off, active color and `aria-pressed`, restoration after reload, input click/typing/reopening after Escape, checkbox/shortcut keyboard operation, four selected teams displayed once each, and focus recovery when removing a selected team outside recent history. With two BFD teams selected, 9 fixtures appeared; removing Mix White left the five Redshot fixtures. Narrow layouts had no horizontal overflow at 320px (client/scroll 305/305) and 390px (375/375). Labels remain accessible while visual captions are absent. The prior 20 Python tests and workflow validation remain applicable to their unchanged code. Final screenshot: [simplified local filters](../work/verification/team-shortcuts-local.png). No commit, push or publication was made. Next action: Lorenzo reviews the revised local preview; hosted checks remain as listed above.

## Publication of team selection and seasonal refresh — 14 October 2026

**Authorization:** Lorenzo requested removal of the photographed “Partite / Prossima data” upper panel, a more visible background, and then commit/push/publication. This approves the whole pending 11-file project checkpoint and supersedes the preceding stop-before-push instruction. Only `lorenz-gorini/ultimateciu2026` is within the write scope; homepage/DNS, source spreadsheet/forms, Raspberry Pi and other repositories remain untouched.

The schedule now starts directly with the team filters. The unused next-date button/handler and schedule-panel CSS are retired; an invisible H1 preserves the page's accessible heading. The background's white overlay is reduced from 80% to 60% on desktop and 86% to 68% on mobile; cards stay opaque white. This final cleanup adds no file to the previously reviewed checkpoint scope.

Local verification: 16 frontend tests, production build using validated live data and `git diff --check` passed. actionlint 1.7.12 passed the two workflows. The local browser showed no upper panel/next-date button, all 56 fixtures and zero console errors. At 320px, client/scroll widths were both 305px; the viewport override was reset. Existing 20 Python checks remain applicable and will run again in the deployment workflow. GitHub remote main was checked read-only at `8118f33`, matching local HEAD before the checkpoint.

Checkpoint **`149b58a9ef8833a01d7350f7098c784122d7ed89`**, subject `Improve team filters and schedule seasonal data refresh`, was committed and pushed only to `lorenz-gorini/ultimateciu2026`. Exact scope: `.github/workflows/pages.yml`, `README.md`, `docs/IMPLEMENTATION_HANDOFF.md`, `index.html`, `scripts/refresh_policy.py`, `src/data.js`, `src/main.js`, `src/preferences.js`, `src/style.css`, `tests/frontend.test.mjs`, `tests/test_refresh_policy.py`. Generated data/builds/screenshots/test previews and temporary tools remain excluded.

**Hosted verification completed:** [push deployment 38482722562](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38482722562) and [manual refresh/deployment 38482933806](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38482933806) both succeeded at this checkpoint. The new policy job admitted each trigger, all 20 Python and 16 frontend tests passed, and the anonymous live workbook import, build, artifact and deployment passed. The manual run completed 14 October at 01:14:57 Europe/Rome. Its published JSON passed the shared validator: 12 teams, 56 fixtures, six carry-overs, `sourceMode: live`, fetched `2026-10-13T23:14:37.623875+00:00` (14 October 01:14:37 Rome). The organizer timestamp remains 11 October at 16:15:23. Before the manual run, the push copy had fetched at 01:12:48 Rome; both copies validated.

The public browser showed the removed upper panel, stronger dawn background, compact secondary controls and one unique team-shortcut group. Selecting/unselecting teams then reloading retained Redshot and its five fixtures. At 01:15:33, public Aggiorna displayed “nuova copia caricata”, loaded the manual-run timestamp and preserved that selection. Console errors were empty. [Published screenshot](../work/verification/published-final-filters.png) is ignored local evidence. GitHub's Node 20 action-runtime notices and upcoming Ubuntu-image migration notices did not prevent either deployment.

**Access scope:** this pass wrote only the authorized project commits/pushes and dispatched one manual project refresh; the push triggered the other deployment. No new repository, credential, secret, service, environment permission, homepage/DNS change, source/form submission or Raspberry Pi change was made. A final documentation-only `[skip ci]` checkpoint records these verified results without rebuilding unchanged runtime assets.

**Remaining observation:** the revised cron is active/configured, but two actual `schedule` runs of the new policy have not yet been observed. This is a future operational verification, not a publication blocker. Push and manual refresh are proven. GitHub scheduling remains best effort; no exact update latency is promised. Before the first match weekend, inspect the scheduled-run history as described above. Lorenzo can use/share the public website now; no setup or server action is required.

The final read-only workflow inspection returned `active`. Scheduled-run history now includes [38482158621](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38482158621), created 14 October at 01:06:22 Rome, and the preceding [38447169780](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38447169780); both succeeded on the old `8118f33` workflow. Neither counts as observation of the revised cadence.

## Match-specific Valuta links — 14 October 2026

**Status: implemented and verified locally; checkpoint/publication pending.** Starting checkout was clean on `main` at `c89f802606350778a586f198bce54256e962ef2f`. Lorenzo requested a Valuta button on each match detail, using the Link column in Valutazioni SOTG. This supersedes the initial exclusion of external form links; the prohibition on spreadsheet edits and automated form submissions remains. No GitHub write or source/form submission occurred in this feature pass.

**Source inspection:** an anonymous fresh XLSX import at `2026-10-14T16:00:37.947554+00:00` (18:00:37 Rome) validated 12 teams, 56 fixtures and six carry-overs. The source still reports 11 October 16:15:23. `Valutazioni SOTG!E1` is `LINK`; E2:E113 contain 112 hyperlinks for all 56 matches, two directional rows per match. They use one shared Google Form, with distinct match/team prefills rather than separate form documents. There are 86 distinct exact URLs: 30 resolved matches have two directional links each; 26 unresolved matches have identical paired URLs, deduplicated into one link per detail page.

The importer preserves actual hyperlink targets, including merged-cell anchors, rather than using the display label or reconstructing URLs. Optional `formUrl` and `formTeamsMatch` fields extend SOTG records in schema version 1. Both Python and browser validation require approved HTTPS Google Form view URLs and exactly one matching `entry.1623410474` match ID. Team prefills (`entry.1084977692` evaluating, `entry.839559032` evaluated) are checked against source team names: true if consistent, false if inconsistent, null if teams are unresolved. A nonempty link label without a hyperlink fails the import; a genuinely absent link remains unavailable. Invalid URLs or wrong match IDs fail before atomic replacement, retaining prior valid data. Old validated browser caches without the additive fields remain readable; buttons appear after a fresh published copy is loaded.

**UI:** Valuta sits beside the SOTG heading. Two distinct URLs open a keyboard-operable chooser labelled “Quale squadra sta valutando?”, with `evaluating → evaluated` links. One unique URL opens directly. External links use a new tab and `noopener noreferrer`. Missing links have an explicit unavailable message. Form links do not count as published evaluations; empty scores and comments remain empty. The site never enters or submits an evaluation.

**WARNING — organizer prefill inconsistencies:** 10 of 112 hyperlinks have correct match IDs but wrong team names relative to the sheet's C/D columns. These affect five matches: X_2 (E4:E5), X_3 (E6:E7), Y_8 (E40:E41), Y_9 (E42:E43), Y_10 (E44:E45). Each affected page warns users to check/correct the team fields themselves before submitting. Exact organizer URLs are preserved; no corrected link is invented and no source cell is edited. Source correction belongs to the organizer; a subsequent validated import will remove the warning automatically when the prefills match.

| Verification | Result |
| --- | --- |
| Python unittest suite | 22 passed; frozen hyperlink/direction checks, wrong-team detection, absent/invalid/wrong-match links, existing atomic failure retention and refresh-policy cases |
| Frontend suite | 17 passed; distinct directions, unresolved-link deduplication, warnings, unsafe/wrong-match rejection and old-cache compatibility alongside existing coverage |
| Production build | Passed with freshly validated live JSON at the project subpath |
| Git diff check | Passed; only the nine feature/documentation/test paths below are changed |
| Local browser X_1 | Valuta opens by click and Enter; both source links and direction labels verified |
| Local browser X_2 / F1 | Wrong-prefill warning present / one direct Valuta link with F1 ID and blank unresolved teams |
| 320px menu | Client and scroll widths both 305px; no horizontal overflow; temporary viewport reset |
| Browser console | No warnings/errors in inspected local pages |
| External Google Form | Exact X_1 link opens “Modulo Valutazione SOTG - CIU 2026”, then “Accedi per continuare”; no sign-in or submission attempted |

Local [preview](http://127.0.0.1:4173/ultimateciu2026/#/match/X_1) and [screenshot](../work/verification/valuta-local.jpg) show the result. Evidence, fresh workbook, JSON and build remain ignored; the frozen workbook is unchanged. Workflows need no change: their existing fresh import/test/build steps will include these fields after publication.

**Limits and next action:** authenticated form fields and submission were not inspected because the form requires Google sign-in; URL parameters and the source mapping were verified. Lorenzo must sign in if he wants to complete an evaluation. Future source form IDs/entry mappings or worksheet layout changes require inspecting and adapting the single importer, rather than silently rewriting links. Existing seasonal scheduler observation remains separate. The public site still runs the previous checkpoint.

**Checkpoint for review:** proposed subject `Add match-specific SOTG form links`. Exact scope: `README.md`, `docs/IMPLEMENTATION_HANDOFF.md`, `importer/workbook.py`, `src/data.js`, `src/data.schema.json`, `src/main.js`, `src/style.css`, `tests/frontend.test.mjs`, `tests/test_importer.py`. Lorenzo can request “Commit and publish the Valuta update” after inspecting the preview; stage only those nine paths, inspect the cached diff, then commit/push solely to `lorenz-gorini/ultimateciu2026` and verify the resulting Pages deployment.

## Mixed Serie B division selector — 15 October 2026

**Status: complete locally, awaiting review and publication authorization for this checkpoint.** Starting branch/HEAD: `main` / `c89f802606350778a586f198bce54256e962ef2f`. The nine uncommitted Valuta paths from 14 October were inspected and preserved; this extension intentionally overlaps their importer, schema, UI, tests and documentation. No commit, push, deployment, GitHub settings/access change, spreadsheet edit or form submission occurred. Homepage/DNS and Raspberry Pi are untouched.

**Request:** add Mixed Serie B to the existing viewer with the same presentation and interactions. The [federation championship page](https://flyingdisc.it/campionati-2026/) explicitly links the [provided Serie B spreadsheet](https://docs.google.com/spreadsheets/d/1ghPcgKXs1r-Dy22BBVRFrVVcB-N7WNBOfHmlNm1a1Go/edit). Inspection confirms the same four-sheet data model, with different team counts, row anchors and competition format. One shared importer and frontend serve both divisions; no second website or backend is introduced.

### Source evidence and mapping

The first anonymous Serie B export completed **15 October at 15:17:57 Rome** (`2026-10-15T13:17:57.146200+00:00`). Its unchanged bytes are now the immutable fixture `tests/fixtures/source-mixed-b-2026-10-15.xlsx`, 144,480 bytes, SHA-256 `4d94dfca2318d3cdad0d14a6f04472148b812c08c67fedb7e0a2d3d931d53356`. The original Serie A fixture remains byte-identical to HEAD (Git blob `c0e9ea0587bf233c7936e028005026ef5304cee6`).

| Data | Serie A fresh import | Serie B fresh import |
| --- | ---: | ---: |
| Teams | 12 | 18 |
| Fixtures (first / second / knockout) | 56 (30 / 12 / 14) | 63 (45 / 18 / 0) |
| Initial groups / second-phase pools | 2 / 3 | 3 / 6 |
| Inherited rows, excluded from fixtures | 6 | 0 |
| SOTG links / incorrect team prefills | 112 / 10 | 126 / 0 |
| Published scores / SOTG / players / final placements | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Actual download, 15 October Rome | 15:22:25 | 15:22:27 |
| Organizer-reported timestamp, 11 October Rome | 16:15:23 | 16:15:21 |

Fresh live timestamps: A `2026-10-15T13:22:25.708769+00:00`; B `2026-10-15T13:22:27.624074+00:00`. Both production JSON files are equal to their validated live inputs; no synthetic data is present in either build artifact.

Serie B layout, validated before extraction:

- `Classifiche e format`: team seeds/names/affiliations/provinces B5:L22. First phase heading B25, initial pool headers B26/B34/B42 and entries B27:F32/B35:F40/B43:F48 (X/Y/Z, six each). Second phase H25, placement-pool headers H26/H31/H36/H41/H46/H51 and three-entry blocks immediately below (1°–3° through 16°–18°). Final placement numbers N26:N43 with names in O; rules start B57/N57. The source prose contains “3 gironi (X e Y)”; the UI derives X/Y/Z from verified pool data and preserves quoted source prose unchanged.
- `Partite`: first phase J3, header rows 4/21/38, X/Y/Z fixtures at 5:19/22:36/39:53. Second phase J56, full header row 57 and shorter repeated headers 62/67/72/77/82; three fixtures per power-pool block at 58:60, 63:65, 68:70, 73:75, 78:80, 83:85. Column meanings remain identical to Serie A. Matches are `X_1…X_15`, `Y_1…Y_15`, `Z_1…Z_15`, `P_1…P_18`; qualifiers `1Z…6Z` remain unresolved. No carry-over or elimination phase exists. The browser verified that gid `1898128397` opens Serie B's Partite grid, so existing range links remain valid with the correct workbook ID.
- `Valutazioni SOTG`: identical headers, merged ID/date pairs and directional links in E2:E127; all 126 link division/match prefills agree, and all known team prefills agree. The exact URLs include `Mixed Serie B`; they are preserved, never reconstructed.
- `Statistiche`: same ten numbered slots and seasonal-total columns, with no populated player rows. Match roster/individual match-slot semantics remain unavailable.

### Implementation and operation

`src/divisions.json` is the shared registry for IDs, labels, source URLs and JSON filenames. Python reads it directly; JavaScript imports it. Explicit inspected row-layout configurations feed the single workbook parser. The schema accepts an additive `division` field and pool Z; semantic validators reject unknown identities or a division/source mismatch. Existing deployed Serie A cache objects without the field remain accepted only as Serie A.

The header selector offers Mixed Serie A/B and retains the existing style, navigation, filters, team/match detail, Valuta links and empty states. It remembers the last division locally. `?division=mixed-a` or `?division=mixed-b` takes precedence over storage and remains in internal/shareable URLs. Changing the selector opens that division's schedule, resets date/phase/status/search and restores its saved teams. Browser back/forward synchronizes division and route. Team selections/recents and cached data use separate keys; Serie A keeps its original keys. Source links, page title and freshness timestamps follow the active division. A division revision check ignores responses from earlier selections, including switching A→B→A while an old A request remains in flight.

Pool counts and present phase choices come from each dataset. Serie A retains its carry-overs and knockout progression. Serie B shows three groups, six placement pools and final classification without a fabricated bracket or an empty inherited-games control. Its published rules explain promotion; zero standings do not assign qualifiers.

`python -m importer` now imports both live divisions by default. Both are downloaded/validated before either output is written, then each JSON is replaced atomically. `--division mixed-a` / `mixed-b` target one division; local `--input`/custom `--output` require a single division. The build checks both datasets and requires `sourceMode: live` in CI. The existing shared workflow therefore refreshes both spreadsheets and deploys them together on its unchanged cadence; a download/validation/test failure prevents deployment and retains the last successful public version. Atomicity is per file; a local disk-write failure between replacements is not a filesystem transaction. This does not permit a partial Pages deployment because the job fails before upload/deploy.

### Verification and remaining limits

- **27 Python tests passed**, including Serie B fixture counts, all teams' five first-phase games, Z/placement references, form division/direction, wrong source/division, changed headings, removed IDs and a simulated B failure that replaces neither output. Existing Serie A, Valuta, atomic-output and season-policy tests pass.
- **21 frontend tests passed**: both live datasets, wrong-division rejection, legacy A cache compatibility, explicit/saved/invalid division choices, denied storage, isolated recent/selected IDs, failed refresh retention and all previous checks.
- Production build and live-data validation passed for both files; `dist` equals each live normalized input. actionlint 1.7.12 passes both workflows; `git diff --check` passes.
- Browser: A shows 56 fixtures, B 63. Searching/selecting MIXBAOBAB shows its five fixtures; A→B switching and reload retain distinct histories/selections. B X_1 opens the correct teams, schedule/source URL and both directional Valuta links. The team page shows its source affiliation/province. Pools show X/Y/Z and all six power pools, with no knockout/inherited section. Browser Back from A returns to the correct B match detail. Aggiorna reports a successful unchanged-copy check while retaining B's five selected fixtures; console warnings/errors are empty in the regular preview.
- A separate local verification server delayed only A JSON by ten seconds. After starting an A refresh and immediately switching to B, B remained selected with 63 fixtures after the late A response completed. The temporary server/tab were stopped; only ignored verification code remains.
- At 320px, B's pool page had client/scroll widths both 305px and a readable selector; the temporary viewport was reset. The regular preview remains on port 4173. [Desktop evidence](../work/verification/mixed-b-selector-desktop.jpg) shows the selector and all-63 schedule state.

**Limitations:** real populated result/SOTG/player/final-placement records still cannot be checked against organizer cells; synthetic tests cover those existing paths. The five Serie A form-prefill warnings remain; none were found in Serie B. Google Form authentication/submission remains untested and no form was submitted. The seasonal cutoff (23 November Rome) covers both divisions' last current fixture date (22 November); future postponements require updating that policy. No hosted deployment or new scheduled execution was performed for this feature.

**Next action / checkpoint:** Lorenzo can inspect [Serie B locally](http://127.0.0.1:4173/ultimateciu2026/?division=mixed-b#/) and switch back to A. Proposed subject: `Add Mixed Serie B selection and match evaluation links`, superseding the previous nine-file Valuta-only proposal. Offer to stage/commit the following **19 exact paths** after review, then push/deploy only on Lorenzo's instruction:

```text
.github/workflows/verify.yml
.gitignore
AGENTS.md
README.md
docs/IMPLEMENTATION_HANDOFF.md
importer/__main__.py
importer/workbook.py
index.html
scripts/check-data.mjs
src/data.js
src/data.schema.json
src/divisions.js
src/divisions.json
src/main.js
src/preferences.js
src/style.css
tests/frontend.test.mjs
tests/test_importer.py
tests/fixtures/source-mixed-b-2026-10-15.xlsx
```

Generated data, build files, screenshots, raw verification downloads and delayed-server experiments remain ignored. To proceed, Lorenzo can say **“Commit and publish the division selector and Valuta update.”** Inspect the staged diff before committing and verify the resulting two-division Pages deployment. No Pi/server setup is needed.

## Filter-row correction and authorized publication — 15 October 2026

**Authorization:** Lorenzo approved committing and pushing both pending features (Mixed Serie B and Valuta), including this final UI correction. This supersedes the preceding review-only checkpoint instructions. The write scope remains solely `lorenz-gorini/ultimateciu2026`; no homepage/DNS, spreadsheet/form, Pi, credential or access-setting changes are authorized or needed.

Divisione now appears first in the filter row immediately below team search, followed by date, phase, status and reset. It has a teal background/white text, rounded border and explicit selected text (“Divisione: Mixed Serie B”), distinguishing it from the quieter underline filters. The header selector and its obsolete responsive styling are removed. On mobile, Divisione takes a full row while the remaining filters stay compact. The native two-option select is keyboard accessible; focus returns to it after changing divisions. It is also available in the missing/loading-data state, allowing recovery by choosing the other division. On detail/team/pool pages, return to Partite to change division.

The existing project-scoped localStorage preference remembers the last explicit selection. Verification confirmed A→B switches show 56→63 fixtures, focus remains on Divisione, and a fresh visit to the root URL (without a division parameter) restores B. Explicit shared division URLs retain precedence. Separate team histories/caches and the Valuta mapping remain intact.

**Pre-publication verification:** 21 frontend tests, both-live-data build, actionlint on both workflows and `git diff --check` passed after the UI correction. The unchanged importer remains covered by the preceding 27 passing Python tests; the shared deployment job will rerun all 27. At 320px, the schedule's client/scroll widths both equal 305px, Divisione is the first filter and the full label is readable; viewport restored. [Mobile evidence](../work/verification/division-filter-mobile.jpg) is ignored local evidence. GitHub main was checked read-only at `c89f802606350778a586f198bce54256e962ef2f`, equal to local HEAD.

**Checkpoint scope:** the same 19 exact paths listed in the preceding entry, including the preserved Valuta changes and new frozen Serie B fixture. Subject: `Add Mixed Serie B selection and match evaluation links`. Generated JSON/builds/evidence stay excluded. Commit/push and Pages verification are now authorized and in progress; deployment results will be recorded here after completion.


**Publication completed:** runtime checkpoint **`a59ce3b6377695ce71709ed2f404e4672dbee019`**, subject `Add Mixed Serie B selection and match evaluation links`, was committed and pushed to this project's `main`. [Push deployment 38746020883](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38746020883) succeeded; the Pages deploy reported success on **15 October at 15:51:31 Rome**. GitHub reran all **27 Python tests and 21 frontend tests**, freshly imported both public workbooks, validated/built both live datasets, uploaded the artifact and deployed it successfully. Existing Node-action-runtime/Ubuntu-image notices were nonblocking.

Published JSON was independently downloaded and passed the shared validator with the expected division/source identity: A has 12 teams, 56 fixtures and 112 form links, downloaded `2026-10-15T13:51:05.440479+00:00` (15:51:05 Rome); B has 18 teams, 63 fixtures and 126 links, downloaded `2026-10-15T13:51:08.063436+00:00` (15:51:08 Rome). Both have `sourceMode: live`; organizer timestamps remain 11 October at 16:15:23 / 16:15:21 respectively. The ten inconsistent A prefills/five affected matches remain warned; B has no detected team-prefill mismatch.

The public browser verified the teal Divisione control first in the filter row and absent from the header, B's 63 fixtures, restored A team selection (Redshot's five of 56 fixtures), and both directional X_1 Valuta links in each division. Switching back to B then visiting the bare root restored B automatically. No console warnings/errors were found. [Published evidence](../work/verification/published-division-valuta.jpg) is local/ignored; the public site is [CIU Mixed 2026](https://lorenz-gorini.github.io/ultimateciu2026/).

**Scheduled-run observation resolved:** [38681672377](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38681672377) (15 October 06:28:50 Rome) and [38715763802](https://github.com/lorenz-gorini/ultimateciu2026/actions/runs/38715763802) (11:49:22 Rome) both ran as `schedule` on `c89f802`, containing the revised cadence/policy, with successful policy, build/verify and deploy jobs. This supersedes the earlier pending two-run observation. These weekday runs establish scheduled execution, not a precise latency guarantee or direct timing evidence for the weekend cadence. They preceded this two-division release; the new combined import is verified by the successful push run above.

**Access and final checkpoint:** only the authorized 19-file project commit/push and the following documentation-only verification checkpoint were written to GitHub. The push invoked the existing deployment; no manual dispatch, permissions/settings, credential, homepage/DNS, source-sheet/form or Pi changes occurred. The documentation checkpoint touches only `README.md` and this handoff, with `[skip ci]` because runtime assets remain unchanged. All prior local-review publication instructions are superseded for this delivered checkpoint.

**Remaining limits / next step:** the existing source gaps and five A form-prefill warnings remain documented above; no evaluation was submitted and authenticated form completion is untested. Scheduling is best effort, and postponements beyond 23 November require updating the cutoff. Lorenzo can use/share the site now; no user decision or rerun is required. Reload an already-open tab to obtain the new interface.
