# Agreed app development phases

The original ten-phase roadmap remains the organising plan. Work already shipped is reused; each phase is accepted on behaviour and tests before the next phase's remaining work begins. Reliability checks accompany every release.

| Phase | Scope | Current position |
|---|---|---|
| 1. Coaching foundation | Last performance, specific weight/rep targets, double progression, effort guidance, exercise increments, explanations and missing-data handling | Implemented with unit and browser acceptance checks in this release |
| 2. Workout logging | Fast entry, editable sets, rest timers, notes, finishing and recovery | Implemented with logging, recovery and edit-safety acceptance checks in this release |
| 3. History & data | History/details, search, edit/delete/Undo and data integrity | Implemented with correction, search, deletion/Undo and data-integrity acceptance checks in this release |
| 4. Progress & analytics | Weight/reps/volume/strength trends, PRs, bodyweight and charts | Existing basic views; full phase acceptance remains |
| 5. Programme builder | Custom exercises/days, sets, rep ranges, increments, RIR/tempo and programme structure | Existing editor; final exercise programme still needs reconciliation |
| 6. Advanced coaching | Adapt recommendations to logged performance and recovery | Not accepted yet |
| 7. Dashboard & personalisation | Tailored overview and training priorities | Existing dashboard; full phase acceptance remains |
| 8. PWA / iPhone experience | Installation, offline loading and phone experience | PWA baseline shipped; real iPhone Home Screen check remains |
| 9. Reliability & testing | Persistence, recovery, coaching, migration, deployment and mobile checks | Ongoing across releases; broader acceptance remains |
| 10. Future expansion | Potential accounts, cloud sync and further features | Deferred |

## Phase 1 acceptance evidence

- Last-session weights and reps remain visible.
- Each exercise has a concrete per-set prescription and explanation.
- Calibration, overload, deload, intensification and peak use the existing programme's effort guidance, expressed as RIR and approximate RPE. Only the final Peak isolation set can have a 0 RIR target; failure-based partial cues are suppressed in other phases.
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
