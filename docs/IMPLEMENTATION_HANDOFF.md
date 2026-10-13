# Ultimate CIU 2026 implementation handoff

Prepared 13 October 2026; local implementation, validation and authorized publication completed on the same date. Live website: [CIU Mixed Serie A 2026](https://lorenz-gorini.github.io/ultimateciu2026/). Lorenzo inspected the preview and authorized repository creation, the checkpoint/push, and GitHub Pages publication. The original local-only implementation brief below records the initial scope; the later publication authorization supersedes its stop-before-publication instruction. The publication entry at the end records access scope and verification.

## Start here

Work in `/Users/lorenzogorini/Library/CloudStorage/OneDrive-UniversitàCommercialeLuigiBocconi/PhD/Coding/ultimateciu2026`.

Read `AGENTS.md`, `README.md`, and this handoff. Implement and verify locally, prepare the GitHub Pages workflow, and stop with a reviewable result for Lorenzo. Do not publish during this first implementation pass. Do not modify the professional homepage repository, its DNS, or its deployment settings. Do not edit the source spreadsheet or submit its SOTG forms.

The project folder was initially empty. The local implementation ended without a Git repository; the authorized publication pass initialized the project's own repository on `main`, created its separate GitHub remote and pushed the implementation. The live-import/test/build/deploy workflow has succeeded on GitHub. GitHub CLI `gh` was unavailable in the preparation shell; a temporary official CLI is now authenticated. API and SSH both verified `lorenz-gorini`.

## Product requirements

Default interface language: Italian, appropriate to the source and competition. This is a design default, not a confirmed user preference. Use the accurate title “CIU Mixed Serie A 2026”.

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
- Empty scores stay null. Zero is a valid supplied score. A form link labelled `valuta` is not an existing evaluation and must not become a submission action in this read-only site.

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

Local checks passed: `git diff --check`, all 10 frontend tests, production build against validated live JSON (12 teams, 56 fixtures), and browser review at desktop, 390px and 320px. The 320px page showed no horizontal overflow. Header refresh and its disclosure worked, all fixtures remained after refresh, the team route showed 12 cards, and browser error logs were empty. The importer and workflows were unchanged, so the Python parser tests remain applicable; device-width checks used browser emulation, not physical phones. Owned paths: `index.html`, `src/main.js`, `src/style.css`, `src/assets/disc-flight.svg` (deletion), `src/assets/foggy-ultimate-field.webp` (addition), and this handoff. The authorized next step is a scoped project-only checkpoint/push and verification of the Pages deployment.
