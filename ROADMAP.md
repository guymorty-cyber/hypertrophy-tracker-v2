# Agreed app development phases

The original ten-phase roadmap remains the organising plan. Work already shipped is reused; each phase is accepted on behaviour and tests before the next phase's remaining work begins. Reliability checks accompany every release.

| Phase | Scope | Current position |
|---|---|---|
| 1. Coaching foundation | Last performance, specific weight/rep targets, double progression, effort guidance, exercise increments, explanations and missing-data handling | Implemented with unit and browser acceptance checks in this release |
| 2. Workout logging | Fast entry, editable sets, rest timers, notes, finishing and recovery | Next acceptance audit; substantial existing functionality is already shipped |
| 3. History & data | History/details, search, edit/delete/Undo and data integrity | Existing foundation; full phase acceptance remains |
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
