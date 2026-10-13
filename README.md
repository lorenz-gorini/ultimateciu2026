# Ultimate CIU 2026

A read-only, mobile-friendly Italian viewer for CIU Mixed Serie A 2026: fixtures/results, searchable team pages, pools and final progression, with Spirit of the Game (SOTG) evaluations and team player totals when published.

Website: [CIU Mixed Serie A 2026](https://lorenz-gorini.github.io/ultimateciu2026/). Source repository: [lorenz-gorini/ultimateciu2026](https://github.com/lorenz-gorini/ultimateciu2026).

## Implementation entry point

Read [the implementation handoff](docs/IMPLEMENTATION_HANDOFF.md) for the verified source schema, product specification, update strategy and acceptance checks. It is the authoritative task record and current implementation status. Read [AGENTS.md](AGENTS.md) before editing.

The source is the [organizer's Google spreadsheet](https://docs.google.com/spreadsheets/d/1k_xJctOAUqizJW00395YIvDwC5gDZKek2R26UpJ_HUQ/edit?gid=2075572219#gid=2075572219). The frozen export at `tests/fixtures/source-2026-10-13.xlsx` is test evidence. Its source-reported update timestamp is 11 October 2026 at 16:15:23; it was downloaded on 13 October 2026. Live data must come from a new validated download.

## Local setup and use

Run these commands **from this project folder**. Local validation used Node 26.0.0 and Python 3.13.2 in the existing Conda `general` environment. Node ≥22.12 and Python 3.13 are recommended; the prepared CI uses Node 24 and Python 3.13.

1. **One-time dependency installation.** Use the existing compatible Conda environment, with uv for Python packages. The two generated locks pin the dependency trees; `pyproject.toml` and `package.json` are their authoritative inputs.

   ```sh
   npm ci
   ciu_python="$(conda run -n general python -c 'import sys; print(sys.executable)')"
   uv pip install --python "$ciu_python" --require-hashes -r requirements.lock
   ```

2. **Import fresh source data.** This anonymously downloads the XLSX, validates the source layout and normalized data, and atomically replaces `public/data.json`. Any failure leaves the previous file intact. The source spreadsheet is never modified. This is required on a fresh checkout because generated JSON is ignored by Git.

   ```sh
   conda run -n general python -m importer
   ```

3. **Test and build.** Parser tests read the immutable workbook and mutate copies in memory. Frontend tests validate the current JSON and use clearly identified synthetic copies for results/failure tests. Only the Python frozen-fixture tests impose the historical 12-team/56-match counts.

   ```sh
   conda run -n general python -m unittest discover -s tests -p 'test_*.py' -v
   npm test
   npm run build
   ```

4. **Preview the production build.** Keep this process running while reviewing; stop it with Ctrl+C. Open [the local preview](http://127.0.0.1:4173/ultimateciu2026/). Direct details use hash routes, for example `#/match/X_1` and `#/team/x1`.

   ```sh
   npm run preview
   ```

   For edits, `npm run dev` serves the same subpath with automatic source updates. A production preview needs another `npm run build` followed by a browser reload after source changes. A fresh importer run also needs a rebuild to replace the preview’s JSON.

## Refresh and deployment

Lorenzo authorized publication of the team-picker and season scheduling update on 14 October 2026. Deployment results and any remaining hosted checks are recorded in the [handoff](docs/IMPLEMENTATION_HANDOFF.md).

On Partite, clicking the primary search input opens the team chooser; typing filters its options and, with no teams selected, the fixtures themselves. Recent and selected teams appear once in a single shortcut group beside the input (below it on mobile). Clicking a shortcut toggles inclusion: teal with a check means selected, white with a plus means available. A fixture involving any selected team is shown once; with selected teams, typing searches for additional choices. All selected teams remain accessible even if more than three are selected, while recent history contains at most three choices. Data, Fase and Stato remain compact single-value secondary filters, labelled accessibly without repeated visible captions. The last selection and history are saved only in this browser profile using project-specific localStorage, on explicit actions rather than background redraws. “Azzera filtri” restores all teams while retaining recent shortcuts; “Cancella recenti”, inside the chooser, clears only history. An explicitly empty selection stays empty on reload. Blocked storage leaves preferences usable for the visit; no cookie, account or server is required.

Each manual “Aggiorna” check reports its completion time and whether a newer published copy was loaded. The download and spreadsheet timestamps describe the data itself, so they stay unchanged when no new copy is available. An unsuccessful check reports failure and retains the last valid data.

Vite builds a static site at `/ultimateciu2026/`. Python/openpyxl is the single source adapter; `src/data.schema.json` is the shared output schema used by Python/jsonschema and browser/Ajv validation. There is no server framework or account system.

“Aggiorna” re-fetches the served JSON with caching disabled. It preserves the current team and filters, retains the last validated data on network/schema failure, and shows both download age and the source-reported update timestamp. The browser also polls every 90 seconds while visible and refreshes when the tab becomes visible. Validated data is cached in localStorage when available, so a previously loaded browser can recover its copy after a failed load. A first visit without working JSON has a retry state, not an empty competition. Browser refresh cannot execute the importer or fetch newer workbook data by itself.

The workflows share one verification/build procedure. The Pages workflow requests UTC weekend imports at `7,22,37,52 * * * 0,6` and weekday imports at `7 * * * 1-5` (312 requested runs/week). `scripts/refresh_policy.py` admits scheduled imports through **23 November 2026 inclusive in Europe/Rome**; extend its `SEASON_END` if fixtures are postponed. After that, small policy jobs can still start but skip import/build/deploy. Remove the cron triggers later to stop those jobs entirely. Pushes to `main` and manual dispatch bypass the date cutoff. The UTC weekend boundary differs from Rome midnight; on competition weekends after the clock change, Saturday's first local hour remains hourly and Sunday evening is covered. **`PAGES_ENABLED` is currently `true`; set it to `false` to stop all deployments.** A failed import or test leaves the last successful deployment in place. JSON travels in the Pages artifact; no automated data commits or frontend credentials are used.

On a Rome match day, a copy downloaded more than 60 minutes ago shows a warning linking to the original sheet. This measures published-copy age, not a proven scheduler failure or the organizer's last edit. The unchanged organizer timestamp does not make a freshly downloaded copy stale.

The site was published on 13 October 2026 from its separate public project repository. Pages uses GitHub Actions, HTTPS is enforced, and the `github-pages` environment allows deployments only from `main`. The professional homepage remains unchanged. To request a source update: open **Actions → Refresh data and deploy Pages → Run workflow** on `main`, wait for success, then use “Aggiorna”. Scheduling is best effort, not a 15-minute guarantee. One successful scheduled run of the existing deployed workflow was observed on 13 October; the revised policy requires hosted verification after review/publication. See the [handoff](docs/IMPLEMENTATION_HANDOFF.md) for run evidence, recovery commands and remaining checks.

## Project map

- `importer/`: bounded public download, merge-aware workbook parsing, validation, atomic JSON output.
- `src/`: static interface, shared data schema, browser validation/search/time/refresh functions.
- `tests/`: immutable workbook and isolated synthetic checks.
- `.github/workflows/`: shared verification and gated Pages refresh/deployment.
- `public/data.json`, `dist/`, `work/`: generated local data, builds and verification evidence; excluded from Git.

The frozen source is preserved. The professional homepage, its DNS/settings, the organizer’s workbook and SOTG forms were untouched.

Lorenzo authorized repository creation, the Git checkpoint/push, and GitHub Pages publication on 13 October 2026 after inspecting the local preview. GitHub API and SSH authentication both identify `lorenz-gorini`. This authorization covers only this project and its publication at `/ultimateciu2026/`; the professional homepage, DNS and other repositories remain outside the write scope. Current deployment status is maintained in the handoff.
