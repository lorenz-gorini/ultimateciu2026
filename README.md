# Ultimate CIU 2026

A read-only, mobile-friendly Italian viewer for CIU Mixed Serie A and Serie B 2026: fixtures/results, searchable team pages, pools and final progression, with Spirit of the Game (SOTG) evaluations and team player totals when published.

Website: [CIU Mixed 2026](https://lorenz-gorini.github.io/ultimateciu2026/). Source repository: [lorenz-gorini/ultimateciu2026](https://github.com/lorenz-gorini/ultimateciu2026).

## Implementation entry point

Read [the implementation handoff](docs/IMPLEMENTATION_HANDOFF.md) for the verified source schema, product specification, update strategy and acceptance checks. It is the authoritative task record and current implementation status. Read [AGENTS.md](AGENTS.md) before editing.

The organizer publishes both sources on the [federation's championship page](https://flyingdisc.it/campionati-2026/): [Mixed Serie A spreadsheet](https://docs.google.com/spreadsheets/d/1k_xJctOAUqizJW00395YIvDwC5gDZKek2R26UpJ_HUQ/edit) and [Mixed Serie B spreadsheet](https://docs.google.com/spreadsheets/d/1ghPcgKXs1r-Dy22BBVRFrVVcB-N7WNBOfHmlNm1a1Go/edit). The immutable test exports are `tests/fixtures/source-2026-10-13.xlsx` (A, downloaded 13 October) and `tests/fixtures/source-mixed-b-2026-10-15.xlsx` (B, downloaded 15 October). Their source-reported update times are 11 October 2026 at 16:15:23 and 16:15:21 respectively. Live data must come from new validated downloads. `src/divisions.json` is the shared registry of division labels, source URLs and output filenames.

## Local setup and use

Run these commands **from this project folder**. Local validation used Node 26.0.0 and Python 3.13.2 in the existing Conda `general` environment. Node ≥22.12 and Python 3.13 are recommended; the prepared CI uses Node 24 and Python 3.13.

1. **One-time dependency installation.** Use the existing compatible Conda environment, with uv for Python packages. The two generated locks pin the dependency trees; `pyproject.toml` and `package.json` are their authoritative inputs.

   ```sh
   npm ci
   ciu_python="$(conda run -n general python -c 'import sys; print(sys.executable)')"
   uv pip install --python "$ciu_python" --require-hashes -r requirements.lock
   ```

2. **Import fresh source data.** This anonymously downloads both XLSX workbooks, validates their layouts and normalized data, then atomically replaces each division's JSON (`public/data.json` and `public/data-mixed-b.json`). Both downloads must validate before either output is replaced. The source spreadsheets are never modified. This is required on a fresh checkout because generated JSON is ignored by Git.

   ```sh
   conda run -n general python -m importer
   ```

   For a targeted local refresh, add `--division mixed-a` or `--division mixed-b`; the production build still requires both files. A local workbook requires one division, `--input` and its actual `--fetched-at` timestamp. Builds for publication reject `sourceMode: frozen`.

3. **Test and build.** Parser tests read the immutable workbooks and mutate copies in memory. Frontend tests validate both current datasets and use clearly identified synthetic copies for results/failure tests. Only the Python frozen-fixture tests impose historical counts (A: 12 teams/56 fixtures; B: 18 teams/63 fixtures).

   ```sh
   conda run -n general python -m unittest discover -s tests -p 'test_*.py' -v
   npm test
   npm run build
   ```

4. **Preview the production build.** Keep this process running while reviewing; stop it with Ctrl+C. Open [the local preview](http://127.0.0.1:4173/ultimateciu2026/). Direct details use hash routes, for example `#/match/X_1` and `#/team/x1`.

   ```sh
   npm run preview
   ```

   Use [the Serie B preview](http://127.0.0.1:4173/ultimateciu2026/?division=mixed-b#/) to open that division directly. The explicit `?division=` parameter is preserved in internal links and takes precedence over the browser's remembered choice. A production preview needs another `npm run build` and browser reload after source/data changes; `npm run dev` updates source edits automatically.

## Refresh and deployment

Publication evidence, current deployment status and remaining hosted checks are recorded in the [handoff](docs/IMPLEMENTATION_HANDOFF.md).

The teal Divisione selector is the first control in the filter row below team search, followed by date, phase and status. It keeps the same views and styling for both competitions. It remembers the last choice on this device. Cached JSON, selected teams and recent teams are isolated by division, retaining the existing Serie A preferences. Switching starts at the chosen division's schedule and resets the secondary filters; saved team choices are restored. Late responses from a previous division are ignored. Source links and timestamps follow the active division. Serie B has three initial groups and six placement power pools, with no knockout stage or inherited matches; views use the actual normalized structure rather than copying Serie A's bracket.

On Partite, clicking the primary search input opens the team chooser; typing filters its options and, with no teams selected, the fixtures themselves. Recent and selected teams appear once in a single shortcut group beside the input (below it on mobile). Clicking a shortcut toggles inclusion: teal with a check means selected, white with a plus means available. A fixture involving any selected team is shown once; with selected teams, typing searches for additional choices. All selected teams remain accessible even if more than three are selected, while recent history contains at most three choices. Data, Fase and Stato remain compact single-value secondary filters, labelled accessibly without repeated visible captions. The last selection and history are saved only in this browser profile using project-specific localStorage, on explicit actions rather than background redraws. “Azzera filtri” restores all teams while retaining recent shortcuts; “Cancella recenti”, inside the chooser, clears only history. An explicitly empty selection stays empty on reload. Blocked storage leaves preferences usable for the visit; no cookie, account or server is required.

Each manual “Aggiorna” check reports whether a newer published calendar was loaded and how many requested match reports were checked successfully. Download and spreadsheet timestamps describe the main dataset and stay unchanged when no new copy is available. Each report has a separate last-successful-check timestamp; failures retain valid data and remove the LIVE label from a retained partial score.

Vite builds a static site at `/ultimateciu2026/`. Python/openpyxl is the single source adapter; `src/data.schema.json` is the shared output schema used by Python/jsonschema and browser/Ajv validation. There is no server framework or account system.

Match details now include **Valuta**. It opens the exact Google Form hyperlink from `Valutazioni SOTG!E`, with the match ID already filled. When two directional links exist, choose the evaluating team; identical links for unresolved teams appear once. The website never submits an evaluation. Google currently requires sign-in to access the form. Some organizer links prefill inconsistent team names; affected pages warn users to check/correct the form fields themselves. URLs are preserved, not rewritten. The importer rejects unsafe destinations or a different match ID before replacing valid data. See the [handoff](docs/IMPLEMENTATION_HANDOFF.md#product-and-source-contract) for source findings and verification.

“Aggiorna” re-fetches the served JSON without caching and checks eligible match reports directly. The browser polls the published JSON every 90 seconds while visible and refreshes on returning to the tab. The importer is still the single adapter for the main competition workbooks; clicking Aggiorna cannot start a GitHub Actions import. Final results therefore arrive after the next successful scheduled or maintainer-triggered deployment. Team choices/filters and the last validated JSON survive failed checks; a first visit without usable JSON has a retry state.

**Final versus live scores.** The organizer confirmed that `Partite!L:N` is filled only when a match ends: L is side A, N side B, M the separator. Both populated scores mean **Risultato finale** and always take precedence. Column Q contains each match's report hyperlink (`report`), or an inherited-result marker (`ereditata`) on non-fixture rows. The importer preserves the exact report URL. Team-stat rows with missing names retain their totals and show “Nome non indicato nella fonte”.

`src/reports.js` is the separate, bounded adapter for live reports. It anonymously reads the named **Foglio di gara (LIVE)** sheet through Google's CSV query endpoint, rather than trusting a link's `gid` (which can open an archived sheet). Two small ranges separate header/date from scores/times; a whole-grid query loses mixed-type header values. It validates report date, exact team identities (including only the approved Serie A spelling alias 360 Mlano → 360 Milano), orientation, score progression, and actual start/end fields before displaying a partial score. The HTTP/identity/CSV boundary is shared with the match-player adapter; both omit credentials and reject malformed responses.

While this tab is visible, report scores are checked every **60 seconds only within ±2 hours of the scheduled start in Europe/Rome**. Automatic checks stop when both main-sheet final scores exist or the report has an actual end. Dates crossing midnight and the daylight-saving transition are covered. A match opened outside that window reads its roster/statistics once, rather than entering a polling loop. Aggiorna explicitly rechecks the open match even outside the window. Requests are deduplicated, limited to four match reports in parallel, and isolated by division and fixture identity. No credentials, API key, server or Pi is needed.

**Match players and elected MVPs.** `src/match-players.js` reads the exact match's named LIVE sheets: roster team identity in B2:B3, jersey/presence/surname/name in G2:J100 of each roster, and A1:G100 in Statistiche. Only X-marked presences are in the main match tables; other roster names are accessible under a separate disclosure and are not treated as confirmed absences. Exact team/name keys join individual match statistics; the approved team spelling alias also applies here. Unknown player names remain explicitly unnamed, with jersey/presence/statistics preserved when the join is unambiguous. Membership identifiers, birth dates and registration status are never requested by these browser adapters. Data stay in memory, separate from seasonal team totals and the main JSON cache.

Player tables are sorted by **Totale descending**, with explicit zeros before missing values and source order retained at ties. The elected **MVP** comes only from the organizer's literal MVP mark in Statistiche column G. It is shown beside the team and highlighted in the player's row; it is never inferred from the largest total. A missing mark says “MVP non indicato nel report”. A failed read preserves the previous valid roster/statistics with an explicit warning and its previous check time.

A report with an actual start reached, an explicit score, no actual end, within the ±2-hour window and successfully checked within 125 seconds shows **LIVE · parziale dal report**. An actual end without a main-sheet final shows **Report terminato · da confermare**. Failed checks, an expired check or leaving the window changes an ongoing retained score to **Ultimo parziale · non live**. Score overlays never overwrite the validated JSON/cache, pool standings, SOTG or seasonal player statistics. Score and roster/statistic reads have separate success timestamps. These are read times, not organizer edit times. Google can delay its own LIVE-sheet updates. No real match was in progress during the 26–27 October verification; live/window transitions were tested with synthetic in-memory reports.

The workflows share one verification/build procedure. The Pages workflow requests UTC weekend imports at `7,22,37,52 * * * 0,6` and weekday imports at `7 * * * 1-5` (312 requested runs/week). `scripts/refresh_policy.py` admits scheduled imports through **23 November 2026 inclusive in Europe/Rome**; extend its `SEASON_END` if fixtures are postponed. After that, small policy jobs can still start but skip import/build/deploy. Remove the cron triggers later to stop those jobs entirely. Pushes to `main` and manual dispatch bypass the date cutoff. The UTC weekend boundary differs from Rome midnight; on competition weekends after the clock change, Saturday's first local hour remains hourly and Sunday evening is covered. **`PAGES_ENABLED` is currently `true`; set it to `false` to stop all deployments.** A failed import or test leaves the last successful deployment in place. JSON travels in the Pages artifact; no automated data commits or frontend credentials are used.

On a Rome match day, a copy downloaded more than 60 minutes ago shows a warning linking to the original sheet. This measures published-copy age, not a proven scheduler failure or the organizer's last edit. The unchanged organizer timestamp does not make a freshly downloaded copy stale.

The separate project site uses GitHub Actions for Pages, HTTPS, and the `github-pages` environment restricted to `main`. For a maintainer refresh, open **Actions → Refresh data and deploy Pages → Run workflow** on `main`, wait for success, then use Aggiorna. The scheduler is best effort. An importer failure leaves the older site served; inspect the failing run and repair validation rather than bypassing it. Current verification and publication status are maintained in the [handoff](docs/IMPLEMENTATION_HANDOFF.md).

## Project map

- `importer/`: bounded public download, merge-aware workbook parsing, validation, atomic JSON output.
- `src/`: static interface, shared data schema, browser validation/search/time/refresh functions.
- `tests/`: immutable workbook and isolated synthetic checks.
- `.github/workflows/`: shared verification and gated Pages refresh/deployment.
- `public/data.json`, `public/data-mixed-b.json`, `dist/`, `work/`: generated local data, builds and verification evidence; excluded from Git.

The frozen source is preserved. The professional homepage, its DNS/settings, the organizer’s workbook and SOTG forms were untouched.

Lorenzo authorized repository creation, the Git checkpoint/push, and GitHub Pages publication on 13 October 2026 after inspecting the local preview. GitHub API and SSH authentication both identify `lorenz-gorini`. This authorization covers only this project and its publication at `/ultimateciu2026/`; the professional homepage, DNS and other repositories remain outside the write scope. Current deployment status is maintained in the handoff.
