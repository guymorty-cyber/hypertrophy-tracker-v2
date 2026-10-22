# Phase 9 reliability audit

The release retains the existing origin, `htData_v1` storage key, saved history, programme snapshots and optional user metadata. Tests use synthetic data; this audit cannot inspect the user's phone storage.

| Impact | Concrete finding | Smallest applied correction | Acceptance |
|---|---|---|---|
| High | Checking/unchecking a set mutated the live completion flag before a save succeeded. Completion and its rest deadline also required separate primary writes. | Commit a cloned active session and timer deadline together; start the runtime timer only after success. | Quota/stale-tab failures retain the previous completion state; one primary write saves completion and its deadline; reopening restores both. |
| High | An ordinary export after a corrupt load exported default fallback data rather than the original unreadable store. An empty stored string was treated as a fresh install. | Route blocked normal exports through recovery export, distinguish missing from empty storage, and preserve empty bytes with nullish fallback. | Corrupt and empty stored strings remain untouched and export byte-for-byte; explicit recovery import repairs the store. |
| High | Earlier asynchronous file reads could finish after a newer selection or after a workout was edited/started/finished. | Give selections a generation number and compare the in-memory state captured at selection before replacing it. | Out-of-order callbacks/errors cannot commit or clear a newer selection; edits during loading invalidate the replacement; existing quota, cancellation and stale-tab guards still apply. |
| Medium | Repeated unchanged saves rotated the previous snapshot to the current state, making Restore previous save unhelpful after retries or update saves. | Rotate the backup only when the validated serialized state changes; retain the primary write and its failure check. | Repeated saves preserve a useful previous snapshot; optional backup-write failure does not prevent the primary save. |
| Medium | Start/extend/Skip changed the visible timer before their state could save. | Commit deadline changes before changing runtime state; stop an expired runtime once if cleanup cannot save. | Failed timer actions retain the saved deadline; retry works; expired recovery does not restart an elapsed timer. |
| Medium | Validation allowed duplicate current slot IDs, duplicate active log IDs and fractional/zero rep prescriptions that the editor/coaching could not address consistently. | Reject these ambiguous live identities and invalid ranges before replacement. | Malformed imports cannot replace current data; repeated historical movement entries remain supported. |
| Medium | A future-dated historical entry could drive today's previous-performance lookup and advance the programme sequence. | Limit those two lookups to workouts dated today or earlier. | Future records remain editable and retain all-time records, but do not supply today's coaching or next-day sequence. |
| Low | A reminder could retain incorrect date/name metadata despite referring to a valid workout. | Derive date, name and ID from the referenced workout while preserving other fields. | Corrected dates and names stay consistent; dangling reminders are removed. |

## Acceptance gates

- 144 dependency-free logic checks, including a matrix of 432 coaching combinations: eight weeks × three categories × three set/rep prescriptions × three increments × two external loads.
- The matrix checks prescription length, integer rep bounds, finite non-negative loads, target totals, deload, bodyweight zero, equipment increments and read-only computation.
- Chromium and WebKit exercise actual entry, failed completion/timer actions, retry, restore, recovery-file download/import, delayed/out-of-order reads, stale tabs, malformed imports and saved-data recovery.
- All earlier coaching, logging, History edit/delete/Undo, shared Progress, programme, personalisation, mobile and PWA suites remain required. Browser-test execution is bounded to five minutes.
- Publication checks the live version, immutable asset path, worker build and manifest start URL against the deployed commit.

## Practical limits

- Data remains local to the browser or installed app. The rolling previous-save snapshot is not a versioned or cloud backup; normal JSON exports remain important.
- The stale-tab check compares storage before writing. It is not a cross-process transaction lock, so truly simultaneous writes are not proven serializable. This release tests deterministic conflicts rather than claiming complete multi-writer support.
- Writing the backup and primary keys is not a multi-key transaction. The primary remains intact if its replacement fails; a failed attempt may have refreshed the rolling backup to that same primary state.
- Device/OS storage removal, hardware failure and actual iOS keyboard, Home Screen and backgrounding behaviour cannot be established by headless tests. The on-device check from Phase 8 remains outstanding.
- Coaching follows explicit programme rules and logged evidence. These checks verify implementation consistency; they do not establish a physiological or clinical outcome.
