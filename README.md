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
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install --with-deps chromium webkit
node tests/browser-smoke.mjs
node tests/pwa.mjs
python -m http.server --directory dist 8080
```

Serve the packaged `dist` folder over localhost or HTTPS. The raw service-worker source contains build placeholders; preview the packaged output to test offline behaviour.

The dependency-free regression suite executes the same scripts in HTML order with deterministic storage and clock stand-ins. Browser tests serve the packaged app at a GitHub Pages-style subpath in Chromium and WebKit. They cover existing history, edited programmes, unfinished workouts, offline close/reopen and logging, install metadata, an A→B update, save failures during an update, other open tabs, and rejection of an incomplete release. WebKit offline tests stop the origin server because Playwright’s offline-emulation switch has a known service-worker navigation bug (microsoft/playwright#42775); Chromium also runs with the browser offline. Real iPhone Home Screen behaviour is still worth checking on device.

## Deployment

The GitHub Actions workflow tests before deploying `main`. Packaging copies only the app, icons and metadata to `dist`, pins scripts/styles and the cached shell to a commit SHA, and redirects the legacy HTML URL to the maintained app. No app logic is patched during deployment.

Set the repository's Pages Source to **GitHub Actions** so the old branch publisher does not compete with this workflow. Older patch scripts remain in the repository for history and are not executed by deployment.
