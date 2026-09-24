# Card tool 18.8.16 — save/resume and stopped attempts

Base: main `6b66ac23` (18.8.15). Scope is the standalone card tool and its installation page; INSIGHT source, notification tools, backend are unchanged. Prepared data gains the two requested people.

## Observations and limits

- The user's earlier bottom-card screenshot matched source row 148 (`n317e9819caf5`); after saving, the next screenshot matched row 167 (タンポポはる), preceded by row 166 (いがらしゆきえ). This establishes a changed visible bottom, not that every preceding row is present or saved. Resume fills earlier gaps, so a stationary last card does not prove that work stopped.
- The user subsequently clarified that entering through INSIGHT still shows the older position at さち, and Edge saving has not been confirmed. Do not describe row 167 as persisted or ask for an editor reload before preserving/exporting the current unsaved draft.
- The user reports continuing 403s in a different browser and secondary account, but can open note from INSIGHT. The exact successful destination and failed request are not yet established. INSIGHT has ordinary note links; card registration uses note's native `/v1/embed` client and returned `/embed/notes/…` iframe. Ordinary-page access does not verify card registration/display access. Do not diagnose an account or IP ban from these observations.
- This release does not clear or bypass a server denial. Keep card runs stopped while 403 persists. Existing 401/403/429/network-failure holds, Retry-After handling and zero automatic iframe reloads remain. We cannot inspect the user's authenticated private draft from this workspace.
- Prepared data becomes 313 rows, including all 42 hashtag articles at the start, with 実績の算数 last. Actual device completion, saved draft contents and notification receipt are not verified.

## Requested additions

- はな (`ai_hana_yocchi`): `na47008a9a553`, fixed-article fallback (no article today/yesterday).
- しろのある (`shirono_aru`): `n7b84d948964f`, published 2026-09-23.
- Both profile descriptions match the supplied screenshots. The public article API confirms each author. Existing 311 rows and image bytes remain; append the two verified 860×140 thumbnails before the final marker. The existing additions mechanism imports only missing people while preserving the dataset ID, images, pending work and card keys.

## Changes

- Native autosave can assign new block IDs while an embed request is pending. Object-identity matching previously discarded a valid response and waited until timeout. Accept an ID-only change to the whole document, then verify the original work paragraph position and exact URL. Preserve edits to text, links, images, order and non-ID attributes by refusing the replacement.
- Cancel the active attempt on errors/timeouts. A delayed embed response must not keep editing after the stop message. Pending work is retained for explicit resume.
- On resume, save existing recovered cards before waiting for iframe display confirmation. Display confirmation remains required before further work or completion.
- Show source row/name and saved-card count on relevant progress/errors. Do not clip the error text.
- During an existing job, hide initial setup, reset and completed-image upload controls. Keep continuation, bulk deletion, stop and audit. Show image additions only when needed. Automatic backups are unchanged; recovery/export access remains visible during errors or a network hold.
- Publish as self-contained 18.8.16 without `@require`; regenerate from source modules.

## Validation

- The autosave-ID and post-timeout-write regressions were reproduced before the fix and passed afterwards.
- Full card suite: 110 passed, 0 failed (147.5 seconds). The final error/403 backup-visibility refinement also passed its targeted DOM test; the release pipeline reruns the full suite.
- Extracted native note ProseMirror schema, serializer/parser and embed-client integration fixture: 3-card creation/display/save/bulk deletion preserves original text, images, captions and links. The same fixture passed with native block IDs replaced during the pending embed response. HTTP responses were simulated in these fixtures; this is not production transport or user-device verification.
- Bundle/source equality, JavaScript syntax and whitespace checks pass. Each public source change is committed separately to respect the repository feature-boundary rule. Verify the final push's workflow and deployed bytes before reporting publication complete.
