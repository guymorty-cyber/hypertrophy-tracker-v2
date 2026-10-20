# Hypertrophy Tracker

A mobile workout tracker built as a self-contained HTML app. The maintained source is `index.html`; the unfinished React migration is on a separate branch.

## Daily use

- Start or resume a workout in Train. Weight, reps, exercise notes and workout notes save on input.
- Completing a valid set starts its exercise rest timer. Timers use a finish timestamp and recover after reopening.
- Finish only reports success after the completed workout is saved.
- History deletes by session ID. Undo restores the most recently deleted workout until the page is reloaded.
- More provides JSON export/import and Restore previous save. Data remains local to this browser and origin; export regularly and before changing devices.
- Save failures stay visible. A tab with an outdated snapshot refuses to overwrite data saved by another tab. Export any unsaved edits, then reload that tab.
- Invalid stored data is preserved and normal writes are blocked. Export recovery data before restoring, importing a valid backup or explicitly resetting.
- Previous-save recovery is one snapshot, not a long-term backup or sync service.

## Checks

Run `node tests/regression.cjs` with Node 22. The dependency-free harness executes the actual inline app script with deterministic storage, clock and DOM stand-ins; it tests state changes rather than layout.

For mobile browser smoke tests:

```sh
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install --with-deps chromium webkit
node tests/browser-smoke.mjs
```

Browser checks cover logging, notes and timer recovery, finishing, deletion, Undo and stale-tab protection in Chromium and WebKit. An actual iPhone Home Screen/background check is still useful before a release.

## Deployment

The Pages workflow runs both test suites before deploying main. It packages only `dist` using `scripts/build_pages.py`. Build packaging substitutes the commit SHA, writes `version.json`, and redirects the legacy HTML URL to the maintained app. No runtime code is patched during deployment.

The app checks for a newer build when it opens or becomes visible. Update app saves current state before navigating to a URL versioned with the new SHA. An old page predating this update mechanism may need a manual refresh once.

The older patch scripts are retained for history; the deployment workflow no longer executes them.
