# Agreed app development phases

The original ten-phase roadmap remains the organising plan. Work already shipped is reused; each phase is accepted on behaviour and tests before the next phase's remaining work begins. Reliability checks accompany every release.

| Phase | Scope | Current position |
|---|---|---|
| 1. Coaching foundation | Last performance, specific weight/rep targets, double progression, effort guidance, exercise increments, explanations and missing-data handling | Implemented with unit and browser acceptance checks in this release |
| 2. Workout logging | Fast entry, editable sets, rest timers, notes, finishing and recovery | Implemented with logging, recovery and edit-safety acceptance checks in this release |
| 3. History & data | History/details, search, edit/delete/Undo and data integrity | Implemented with correction, search, deletion/Undo and data-integrity acceptance checks in this release |
| 4. Progress & analytics | Weight/reps/volume/strength trends, PRs, bodyweight and charts | Implemented with workout-level comparisons, chart/range controls, weekly training and bodyweight acceptance checks in this release |
| 5. Programme builder | Custom exercises/days, sets, rep ranges, increments, RIR/tempo and programme structure | Builder implemented with day/exercise and effort/tempo acceptance checks; personal exercise-plan reconciliation remains |
| 6. Advanced coaching | Adapt recommendations to logged performance and recovery | Implemented with explicit performance/effort/readiness rules and acceptance checks in this release |
| 7. Dashboard & personalisation | Tailored overview and training priorities | Implemented with personalised Home, shared-movement analytics and dashboard acceptance checks |
| 8. PWA / iPhone experience | Installation, offline loading and phone experience | Phone improvements implemented and automated acceptance added; actual iPhone acceptance remains |
| 9. Reliability & testing | Persistence, recovery, coaching, migration, deployment and mobile checks | Reliability audit implemented with targeted fixes, fault-injection and coaching matrix acceptance; device check and documented limits remain |
| 10. Future expansion | Potential accounts, cloud sync and further features | Deferred |

## Phase 1 acceptance evidence

- Last-session weights and reps remain visible.
- Each exercise has a concrete per-set prescription and explanation.
- Calibration, overload, deload, intensification and peak use the existing programme's effort guidance, expressed as RIR and approximate RPE. With default phase guidance, only the final Peak isolation set can have a 0 RIR target; Phase 5 adds explicit user-set RIR overrides outside deload; failure-based partial cues are suppressed in other phases.
- 40 kg × 8/8/7 holds 40 kg and targets 9/8/7; 40 kg × 9/9/8 still holds 40 kg; 40 kg × 10/10/10 increases by the exercise's increment and returns to the lower rep target.
- Incomplete or mixed-load histories never trigger an invented median-load increase. Additional optional sets do not alter the planned-set progression test.
- A single poor workout does not trigger an automatic reduction; a repeated comparable shortfall can use the exercise's increment to reduce load.
- Bodyweight zero and zero/fractional increments are handled explicitly.
- Deload creates fewer working sets for a new workout without changing the saved programme. Existing sessions and historical records are not rewritten.
- A recovered workout keeps its starting training week and chosen exercise variation. Calendar-week calculation is unaffected by UK daylight-saving changes.
- `tests/coaching.cjs` checks the decision paths. `tests/coaching-browser.mjs` proves the complete previous performance → recommendation → workout → logged sets → next recommendation loop in Chromium and WebKit.

The engine implements transparent programme rules. It does not claim to measure effort, know equipment availability or replace the user's exercise technique and recovery judgement.

## Phase 2 acceptance evidence

- Weight/reps and both note fields save during entry. Existing add/remove-set and copy-last controls remain available, without changing programme set counts.
- New workouts snapshot their exercise definitions. Programme edits, reordering, additions and deletions apply to future workouts without shortening, renaming or hiding active logged sets. Legacy unfinished workouts acquire definitions in memory when loaded, with no immediate storage rewrite.
- Exercise swaps require empty, unchecked sets so existing performance cannot be relabelled as another movement. Swaps and programme edits report success only after persistence.
- Invalid weight/rep edits clear the affected saved field and uncheck completion, preventing an older valid value from being silently logged.
- Finishing with unfinished sets requires confirmation; only completed sets enter totals. Cancelling that prompt retains the workout. Failed finish retains the active session and retry creates one historical record.
- Rest timers use wall-clock deadlines; extension, skip and recovery are checked alongside notes and completed-set recovery.
- `tests/logging.cjs` adds ten logic checks; `tests/logging-browser.mjs` exercises real entry, editing, swaps, notes, reopening, timers, cancellation, finishing and the next workout in Chromium and WebKit. Existing workout, coaching and offline/update suites remain required.
- Actual iPhone Home Screen testing remains part of Phase 8; automated WebKit checks do not replace an on-device check.

## Phase 3 acceptance evidence

- History orders by date, start time and a stable ID tie-breaker. Search covers workout/exercise names, ISO or displayed dates, workout notes and exercise notes, with a visible result count.
- Edit workout is available from History and workout details. It edits the date, workout/exercise notes, weights, reps and completion flags in a separate draft. Cancel does not change the record; Save validates before committing.
- Edits preserve workout ID, timestamps, duration, exercise identity/variation, knee checks and exercise definitions. Unrelated workouts' logs, the active workout, programme, nutrition and bodyweight remain intact. Reminder dates track corrected dates.
- Totals and PR badges are derived from valid completed sets, in chronological order, with separate exercise variations. Corrections, new workouts, deletion, Undo and imports refresh derived values. Viewing History does not rewrite storage.
- Multiple deletions can be undone one at a time in reverse order until reload. Failed deletion/Undo retains both the record and remaining Undo entries. Import, restore and reset clear the in-memory Undo list.
- Invalid values, storage-full errors and stale tabs cannot replace historical records. Save errors retain the editor and its entered draft for retry.
- JSON export/import retains corrected logs; import validates and refreshes summaries. Read errors allow selecting the file again.
- `tests/history.cjs` adds thirteen logic checks. `tests/history-browser.mjs` checks actual search, editing, Cancel, invalid inputs, quota failure/retry, reload, derived PRs, detail deletion, repeated Undo, JSON download/import and stale-tab rejection in Chromium and WebKit. Existing logging, coaching and offline/update checks remain required.

## Phase 4 acceptance evidence

- Latest and previous compare separate completed workouts, ordered by date/start time, rather than two sets within one workout or lexicographic session IDs. Best set uses highest estimated 1RM; bodyweight-only ties use reps.
- Exercise/variation identity stays separate across Progress, PR lists and historical badges. Removed exercises and earlier names/variations remain available without offering a target for a movement outside the current programme.
- Per-workout charts cover top load, most reps in a set, recorded volume and estimated 1RM; all-history/90-day/30-day ranges share explicit labels. All-time records remain clearly separate from date-filtered comparisons. Charts have numeric/date labels, accessible titles and empty/single/flat handling.
- Valid completed sets include zero external load; unfinished/invalid sets do not inflate analytics. Bodyweight-only training has reps and set records without a fabricated external-load 1RM. Volume sums recorded kg × reps; it does not add bodyweight.
- Weekly training uses Monday–Sunday buckets, counts finished lifting workouts and completed sets, and fills unlogged weeks with zero volume. Partial boundary/current weeks are labelled. Rest and active sessions are excluded.
- Bodyweight shows actual observations and measured-day weekly averages. Duplicate imported dates use the final entry, daylight-saving boundaries do not change calendar weeks, and rates account for elapsed weeks when observations are missing. Missing weigh-ins are not invented.
- History corrections, deletion and Undo immediately update charts and records. Viewing/filtering analytics does not write saved state.
- `tests/progress.cjs` adds twelve logic checks. `tests/progress-browser.mjs` checks comparisons, four metrics, ranges, variations, archived/bodyweight history, search, mobile overflow, read-only state and the correction/delete/Undo loop in Chromium and WebKit. Earlier phase and PWA checks remain required.
- Deployment verification now uses a fresh query on each request and allows a longer propagation window after a transient CDN 404 observed in Phase 3. The deploy job reuses the successful check job's artifact name when only deployment is retried.

## Phase 5 builder acceptance evidence

- More → Programme Builder creates, renames, copies, reorders and removes training/rest days. Day selection follows the selected ID across reordering. At least one day is retained, and an active workout's day cannot be removed.
- Exercise controls add, edit, copy, reorder and remove definitions. Copies receive new slot IDs; Phase 7 shares movement records when their names match, while coaching prescriptions remain per slot. Removing a definition preserves active snapshots, History and archived Progress records.
- Strict numeric entry rejects empty/fractional set or rep counts, invalid ranges and invalid rest/increment values. Zero rest/increments and fractional weight increments are preserved.
- Category, optional 0–5 RIR, tempo, per-leg reps, alternatives and notes are editable. Blank RIR retains phase defaults; explicit RIR reaches new-session coaching, including approximate RPE. Deload retains 3–4 RIR and disables failure-based partial cues. Existing optional partial cues remain subject to Peak/isolation/effort conditions.
- New workouts snapshot these settings; edits do not rename or truncate active or historical sets. Tempo is shown in Train, and imported backups validate optional RIR/tempo fields.
- Rest days cannot silently erase exercises during conversion; empty training days cannot start an unusable workout. With multiple rest days, logging uses the chosen day rather than the first rest day. Removing an open rest day clears its screen.
- Storage errors, stale tabs and outdated editor drafts do not commit programme changes. Programme export/import retains builder settings and original historical logs.
- `tests/programme.cjs` adds thirteen checks. `tests/programme-browser.mjs` tests actual day/exercise creation, copying/reordering/removal, strict input, effort/tempo display, active recovery, archived analytics, selected rest-day logging and mobile overflow in Chromium/WebKit. Earlier phase and PWA suites remain required.
- Personal programme review remains separate: the default template has not been replaced, and the user's device-local exercise edits are not accessible here. The exact lower-day exercise list and current physio instructions are still needed before reconciling pin squats and ham/glute versus quad emphasis.

## Phase 6 acceptance evidence

- The base double-progression rules remain. Up to three recent comparable workouts are inspected by date/start time and exercise ID/name. Loads, complete planned sets, rep range, category, RIR override, rest, tempo and per-leg settings must match. Deload, lower-readiness history, changed conditions and gaps over 28 days reset comparisons.
- Three non-improving totals below the rep ceiling identify a stall; two successive drops across three workouts totalling at least 12% (minimum two reps) identify a decline. These patterns hold progression and explain the totals, without reducing load from the trend alone. Repeated rep-ceiling performances still permit normal progression.
- Optional reported RIR refers to the final planned working set and is entered only after all planned sets are completed. Blank feedback is not inferred. One miss below its historical target holds progression; two comparable misses without rep progress may reduce one positive programmed increment. Bodyweight zero and zero increments cannot manufacture a load change.
- Optional workout readiness offers Usual / Lower than usual. Lower readiness pauses increases today, uses at least 2 RIR and disables failure-based partial cues. It does not persist as the next workout's readiness. Scheduled deload keeps 3–4 RIR and its reduced set count. This is a transparent app policy, not a physiological recovery measurement or medical assessment.
- A changed prescription or last matching log older than 28 days holds progression for a fresh baseline. Rules do not rewrite the programme, recorded weights or historical effort.
- Readiness/RIR save with the active session, recover after reopening, appear in History details, and can be corrected in the History editor. Corrections and deletion/Undo immediately affect evidence. Export/import retains optional feedback; older data loads without inferred entries or an immediate storage rewrite.
- Failed feedback saves roll back the visible control to the saved value; full storage and stale-tab guards remain in force. Revised action text removes an obsolete increase explanation whenever a hold/reduction overrides it.
- `tests/adaptive.cjs` adds fifteen checks. `tests/adaptive-browser.mjs` checks stall explanations, readiness, gated effort entry, storage-full rollback, reopening, next-workout adaptation and a History feedback correction in Chromium/WebKit. Earlier phase and PWA suites remain required.

## Phase 7 acceptance evidence

- Progress groups exact movement names across all programme days and saved history, ignoring case and repeated/edge whitespace. Dumbbell Shoulder Press now has one combined chart and PR entry. Different equipment/variation names remain separate; no fuzzy matching or log migration occurs. Every matching log within a workout contributes valid sets once.
- Next targets remain labelled by day and retain that slot’s sets, rep range and coaching evidence. This prevents a heavy 6–10 day from overwriting an 8–12 day’s prescription. Workout-level rows identify their source day. History PR badges use the same shared movement identity; corrections, deletion and Undo refresh the combined records.
- Home prioritises a recovered active workout with completed-set counts and Continue. Otherwise it shows the next programme day, its real rest-day name and a phase-aware duration estimate. The last-workout card excludes rest logs.
- This week counts finished lifting workouts and valid completed sets from Monday through today. An optional weekly goal is a presentation preference, not a changed training schedule. Active/rest/future workouts cannot inflate it.
- Personalise Home saves an optional name, weekly goal and visibility of bodyweight, nutrition and training priorities. Old backups need no preferences or storage rewrite; JSON backup/import preserves and validates new preferences. Cancel, invalid input, quota failures and stale tabs retain saved preferences and training data.
- Training priorities expose existing logged-performance stall/decline/reduction evidence for the next or active day, plus active lower-readiness guidance. Missing evidence produces no invented alerts. Home quick actions reach Progress, History and the actual bodyweight/nutrition input; the old nutrition-summary Log no-op is fixed. Measurement saves commit atomically and retain entered fields on failure.
- Logic and Chromium/WebKit dashboard acceptance suites cover shared duplicate exercises, separate day targets, variants, duplicate logs, read-only rendering, correction/delete/Undo, preferences/reload, tracking links, quota failure/retry and mobile overflow. Earlier phase and PWA suites remain required.

## Phase 8 acceptance evidence and device check

- All entry inputs use at least 16px text, without disabling pinch zoom. Primary small controls use 44px touch heights; completion checkboxes have a 44px label hit area. Set rows use flexible columns at narrow phone widths.
- A touch entry toolbar moves between visible editable fields within the current screen or dialog, and provides Done for numeric keyboards. Previous/Next/Done never complete a set, change a prescription or bypass validation; ordinary input events retain existing save semantics. Textarea Return still inserts newlines.
- Visual viewport changes position the entry toolbar and dialogs above a keyboard. Normal navigation remains usable when no keyboard is detected. Rest bars are lifted above entry controls and content has bottom clearance; hidden bars do not stop the deadline-based timer. Pinch zoom is not treated as a keyboard. Dialogs manage focus, Escape/Tab and return focus on close.
- More → App & offline displays browser/Home Screen mode, offline readiness and the app version. Check for updates is explicit, deduplicates simultaneous resume/manual checks and reports offline/unavailable/downloading/current/ready states. Worker and version discovery have bounded waits; a failed check cannot reload or clear data. Existing update activation still requires a successful save and a completely cached shell.
- Installation help recognises an existing installed app, includes Safari Share / Add to Home Screen / Open as Web App guidance and explains backup/import if changing launch contexts exposes a different store. The manifest, origin, storage key and history are retained. Apple guidance: https://support.apple.com/en-gb/guide/iphone/iphea86e5236/ios .
- Logic and Chromium/WebKit mobile acceptance cover phone sizes, touch geometry, entry navigation, simulated keyboard viewport changes, dialogs/focus, launch detection, manual update/offline/failure paths and saved-workout recovery. The full existing logging, history, coaching, shared Progress and PWA/offline/update suites remain required.
- **Actual iPhone acceptance remains:** use the existing Home Screen app (or export before installing); wait for Ready for offline use; enter a real set and use Next/Done with the iPhone keyboard; background/return during a rest; reopen in Airplane Mode and confirm the unfinished workout/history; reconnect and apply any offered update. Do not reset or remove the existing app for this check. Automated WebKit and simulated viewport tests cannot operate the iOS Share sheet, physical keyboard or OS lifecycle.

## Phase 9 acceptance evidence

- Completion and its rest deadline use one primary write. Quota/stale-tab failure leaves the saved and visible completion flag unchanged and does not start an unsaved timer. Manual start, extension and Skip commit before changing the runtime deadline; expiration stops the display once even if clearing an expired deadline cannot save.
- Unchanged saves still verify primary persistence, but do not rotate the previous snapshot. This keeps the useful previous save available after Retry or update-style saves. Failure to write the optional backup does not prevent a successful primary save.
- Normal Export switches to original recovery bytes when loading is blocked. A corrupt store cannot silently export the empty fallback programme as if it were the user’s saved history.
- Only the newest selected import may commit. Superseded callbacks/errors are ignored; edits or finishing a workout during file loading invalidate its stale replacement. Quota, cancelled confirmation and another-tab guards still apply. Recovery import can explicitly repair corrupt storage.
- Validation rejects duplicate IDs across current programme slots, duplicate active exercise IDs, numeric live IDs that cannot be addressed by DOM controls, and zero/fractional rep prescriptions. Historical numeric IDs remain supported. Repeated historical movements, removed exercises, snapshots, optional preferences and unknown saved metadata remain supported. Reminder names/dates come from their referenced workout.
- Future-dated workouts stay in editable History and all-time records, but cannot advance today’s workout sequence or supply previous-performance coaching.
- `tests/reliability.cjs` adds sixteen checks including a 432-case matrix spanning all eight training weeks, categories, rep ranges, set counts, bodyweight and equipment increments. `tests/reliability-browser.mjs` tests real Chromium/WebKit quota failures/retry, timer rollback, backup restore, damaged-byte export/recovery, out-of-order FileReader callbacks, edits during import, stale tabs and malformed imports. All earlier phase/mobile/PWA suites remain required; browser test execution has a five-minute timeout.
- Actual iPhone acceptance from Phase 8 remains outstanding. Local storage is device-local and a previous-save snapshot is not a versioned/cloud backup. The synchronous stale-tab comparison is not a cross-process transaction lock; simultaneous writes cannot be claimed to be serializable. See RELIABILITY.md.


## Coaching clarity acceptance

- Short targets are derived from the final existing prescription. They retain load/effort/readiness/deload overrides and distinguish bodyweight, mixed loads and missing history. Train puts the target before set inputs in DOM/reading order; a closed native disclosure contains full reasoning and set targets.
- Progress verdicts are per day prescription. Three comparable workouts are required for a trend; baseline and deload are explicit states. Declining/stalled totals and justified reductions are explained without diagnosing recovery or automatically rewriting the programme.
- The Home week card keeps workout/set totals and adds unique movement verdicts plus one focus. Monday-through-today finished logs determine inclusion; current per-day prescriptions determine comparability. Multiple slots remain visible, with attention taking priority in the movement count. Removed movements remain represented as baseline. Earlier comparable workouts can provide evidence.
- Review/explanation disclosures support touch and keyboard. Existing coaching visibility hides the Home review. Rendering adds no data writes, schema migration or new persisted metrics. Original storage key, origin, history, active snapshots and progression rules remain.
- Ten logic checks cover final targets, trend gates/resets, shared movements, dates, corrections/deletion/Undo, escaped labels and read-only rendering. The Chromium/WebKit clarity suite covers collapsed/expanded evidence, keyboard activation, target/input order, Progress/Home agreement, readiness overrides, logging/reload, history refresh, preferences and narrow/landscape layout. Existing browser suites now open the explanation before inspecting its details.
