# Hypertrophy Tracker

A mobile workout tracker with installation support and an offline app shell. The HTML entry point, CSS and feature JavaScript are maintained separately. The unfinished React migration remains on its own branch.

## Structure

- `index.html`: app shell and ordered deferred scripts. No workout state or migration is embedded here.
- `css/app.css`: layout and styles.
- `js/data.js`, `storage.js`, `backup.js`: programme defaults, existing saved-data validation, persistence, import and export.
- `js/helpers.js`, `coaching.js`: history lookups, analytics and progression recommendations.
- `js/views/`: Home, Train, Progress, History and More screens.
- `js/workouts.js`, `timer.js`, `programme.js`, `tracking.js`, `history.js`: feature actions.
- `js/ui.js`, `events.js`, `app.js`: shared UI, events and startup.
- `js/pwa.js`, `manifest.webmanifest`, `sw.js`: installation, offline setup and updates.

The scripts deliberately share the existing app state through an explicit load order. This is an incremental refactor; it adds no runtime framework or build dependencies.

## Data and daily use

The app keeps the same origin and `htData_v1` localStorage schema. An update does not reset or migrate history, programme edits, bodyweight, nutrition or an unfinished workout. The service worker only caches app files; it never stores or clears workout data.

Workouts and notes save on input. Finish, deletion, Undo and set changes only report success after persistence succeeds. A stale tab refuses to overwrite a newer snapshot. Invalid stored data is preserved and normal writes are blocked until explicit recovery, import or reset. More provides JSON exports and Restore previous save; the latter is one previous snapshot, not a long-term backup.

Use last session fills only empty fields from completed sets of the matching exercise. Set changes affect the current workout only. Completed sets cannot be removed, and entered values require confirmation before removal.

Open online once and wait for **Ready for offline use**. You can then reopen, log and finish workouts without a connection. On iPhone use Safari → Share → Add to Home Screen; Android/desktop browsers may offer an install prompt. Keep using your existing browser or Home Screen app for its saved history. Export before moving between browser profiles, devices or installation contexts. Browser storage can be removed by the user or OS; offline caching is not a cloud backup.

Updates download a complete new shell and offer **Update app**. The app saves before activating it. Other open tabs are not forcibly reloaded. An incomplete download cannot replace the working shell. Versioned scripts and CSS prevent a cached screen loading another release's code. Cache cleanup is scoped to this app and retains the previous shell.

## Build and checks

Requires Python 3 and Node 22. Build with a full commit SHA:

```sh
python scripts/build_pages.py --build FULL_40_CHARACTER_COMMIT_SHA
node tests/regression.cjs
node tests/coaching.cjs
node tests/logging.cjs
node tests/history.cjs
node tests/progress.cjs
node tests/programme.cjs
node tests/adaptive.cjs
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install --with-deps chromium webkit
node tests/browser-smoke.mjs
node tests/coaching-browser.mjs
node tests/logging-browser.mjs
node tests/history-browser.mjs
node tests/progress-browser.mjs
node tests/programme-browser.mjs
node tests/adaptive-browser.mjs
node tests/pwa.mjs
python -m http.server --directory dist 8080
```

Serve the packaged `dist` folder over localhost or HTTPS. The raw service-worker source contains build placeholders; preview the packaged output to test offline behaviour.

The dependency-free regression suite executes the same scripts in HTML order with deterministic storage and clock stand-ins. Browser tests serve the packaged app at a GitHub Pages-style subpath in Chromium and WebKit. They cover existing history, edited programmes, unfinished workouts, offline close/reopen and logging, install metadata, an A→B update, save failures during an update, other open tabs, and rejection of an incomplete release. WebKit offline tests stop the origin server because Playwright’s offline-emulation switch has a known service-worker navigation bug (microsoft/playwright#42775); Chromium also runs with the browser offline. Real iPhone Home Screen behaviour is still worth checking on device.

## Deployment

The GitHub Actions workflow tests before deploying `main`. Packaging copies only the app, icons and metadata to `dist`, pins scripts/styles and the cached shell to a commit SHA, and redirects the legacy HTML URL to the maintained app. No app logic is patched during deployment.

Set the repository's Pages Source to **GitHub Actions** so the old branch publisher does not compete with this workflow. Older patch scripts remain in the repository for history and are not executed by deployment.

## Phased development

See `ROADMAP.md` for the agreed ten development phases and acceptance evidence. Phase 1 coaching uses each exercise's programmed increment, explicit per-set targets, phase/category RIR and approximate RPE guidance, reduced deload set counts, and conservative handling of incomplete or mixed-load history. Effort targets are guidance; the app does not infer actual RIR/RPE from reps alone. The saved workout's starting week is used after recovery. Programme exercise selection itself is reviewed in Phase 5.

Phase 2 protects active workouts from programme edits using saved exercise settings; changes in the editor apply to future workouts. Swapping requires no entered sets, and finishing an incomplete workout requires confirmation. Invalid numeric edits uncheck the affected set rather than retaining an older value. Existing history remains under the same storage key and URL.

Phase 3 adds saved-workout corrections from History/details, search by names/dates/notes, same-day ordering and repeated deletion Undo until reload. History edits stay in a separate draft until Save succeeds. Totals and PR badges refresh from valid completed sets, with variations kept separate. Correcting historical performance affects the next coaching recommendation. Export/import uses the existing JSON format and storage key.

Phase 4 compares completed workouts and provides per-session load, reps, volume and estimated-1RM charts with date ranges. Variations and removed exercises retain separate records. Weekly training totals and bodyweight averages use calendar weeks, with missing observations handled explicitly. Analytics read saved logs without rewriting them, and reflect History corrections immediately. Estimated 1RM is a formula estimate; recorded-volume charts include external load only.

Phase 5 expands More → Programme Builder to manage training/rest days and exercise order, copies and removal. The exercise editor supports category, optional RIR, tempo, per-leg reps and alternatives alongside sets/reps/rest/increments. Blank RIR follows the phase; explicit targets apply outside deload, which retains 3–4 RIR. Changes affect future workouts, and existing session snapshots/history remain intact. Copied exercises retain new programme-slot IDs; Phase 7 links records for matching movement names. Personal exercise-plan changes require reviewing the actual programme and current physio instructions separately; this release does not replace the user's saved training plan.

Phase 6 adds explainable checks for comparable-workout stalls/declines plus optional workout readiness and final-planned-set RIR. Missing feedback is not inferred. Lower readiness holds progression today; repeated comparable effort misses without rep progress can use one programmed reduction. Deload retains its own rules. History can correct these reports, and analytics/coaching recompute from saved logs. Thresholds are explicit app heuristics, not a recovery measurement or medical assessment.

Phase 7 adds a personalised Home with active-workout continuation, a Monday–Sunday training summary, an optional weekly goal, configurable summary cards, evidence-based training priorities and working quick logging links. Progress now shares charts and records for the same exercise name across days (ignoring case and whitespace). Different movement names stay separate. Each day retains its own prescription and coaching target. Saved history and IDs are not migrated or renamed.
