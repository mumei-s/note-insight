# Card tool 18.8.10: resume against the current draft

## Report

The user has already inserted all 310 thin images. Version 18.8.9 stops at
147/310 with a mismatch between its local card journal and the editor document.
The screenshot proves the failed preflight, but does not distinguish a missing
card from changed attributes on a reopened card. Neither image insertion nor
resetting the article is an appropriate recovery action.

## Change

- Compare each tracked card key and article against the current editor document.
  Reuse surviving cards. Recreate only journal entries whose cards are absent.
  Preserve an audit summary of the reconciliation in `cardRecovery`.
- Accept the exact `https://note.com/embed/notes/{noteKey}` source format that
  note's published `parseDOM` uses when a figure has no `data-src`. Continue
  requiring a native embed key and note embed HTML. Reject other origins or
  mismatched article keys; do not silently discard conflicting cards.
- Finish/recover an outstanding native conversion first, then fill missing
  dataset rows. Place only newly created/recovered cards before the next
  surviving tool card. Verify final dataset order and confirmation marker.
- Save through note's native save flow every 10 completed cards, confirming the
  response against the current article and body. Record `savedCardCount` only
  after success. Mark `cards_ready` only after final save confirmation.
- Show image completion and notification-card progress separately. Update the
  installer instructions for the user's already-completed images.

No automatic reset, image reinsertion, body replacement, publishing, or card
deletion is part of recovery. Ambiguous duplicate keys, unknown same-article
cards, and conflicting tracked card content stop without modifying the body.

## Verification

The original implementation fails the new 147/310 reopen, missing-middle-card,
iframe-source, intermediate-save-failure and final-save-failure regressions.
The updated safety suite covers those cases, preserving original text, images,
existing cards, and an identical URL in the original body. It also tests a
completed pending card after a missing batch, rejection of a foreign domain,
and no duplicate generation when resuming after save failure.

Additional local integration runs execute the published note URL conversion
command from editor chunk `57-2ae1cd5058b7ac1f.js`, actual ProseMirror state and
transactions, and an ID-assignment plugin. One starts with 147 local records
and zero corresponding document cards; another keeps 74 interleaved cards.
Both reach 310 ordered cards while preserving original text and all 310 images;
the latter creates only the missing 236 cards. Native card responses and draft
save responses are simulated. This does not establish success on the user's
Android browser or actual note servers.

## User flow

Save the existing draft, update the userscript, reopen the editor, confirm
`v18.8.10`, then press `送`. For already-completed images, `画`, `初期化`,
`宵空セット`, and `削` are unnecessary. Completion requires the on-screen
notification-card count and confirmed final save.
