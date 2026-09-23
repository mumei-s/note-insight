# Card tool 18.8.15

The device showed CloudFront 403 both in a card iframe and on note.com, then a backup dialog whose buttons were invisible. The exact server-side cause is unknown. This release does not bypass or clear a note access denial.

- Stop the card tool's save/read/registration work after 401, 403, 429 or an unreadable network failure. Read status before parsing an HTML error response. Preserve a network hold across reloads; honor Retry-After. Manual release does not trigger requests or background link saving.
- Observe only the current draft's relevant native traffic; do not block or modify unrelated site requests. Keep backup capture, local export, close and restore available while held. A missing iframe display response is not classified as a known HTTP error and never triggers an automatic iframe reload.
- Space confirmed card creation by three seconds. Keep progress dependent on actual official card identity, display response and draft-save verification. Completed images alone cannot mark notification cards complete.
- Give backup buttons explicit visible styles independent of the note theme. Show export/restore errors inside the dialog. Show wrapped errors in the minimized panel.
- Add 月ノ宮闇 (`ann43tsukinomiya`), verified against the public article `n5ff19bc6726a`, published 2026-09-23 19:20:48 JST. The prepared set now has 311 rows: the existing 42 hashtag articles first and 実績の算数 last. Keep the old prepared base and apply the inline additions idempotently.
- The new 追加分 action uses the existing missing-image insertion path. It keeps the 310 image records and all completed/pending card keys, adds only absent images, and invalidates earlier completion proofs. Send/audit cannot report completion against the old 310-row set. Place a newly added card before the existing final card, then verify its display at the final position. Bulk deletion still removes only the recorded tool cards and preserves body, captions, images, links and original cards.

Validation covers HTML 403, Retry-After, reload persistence, CORS/offline failure, native-save and embed rejection, zero iframe reloads, visible backup export while blocked, 310-to-311 metadata merge, image addition with cards already present, completed-set card insertion/order/deletion, 311-card display/save/bulk deletion and 500-card pacing. Tests use simulated transport; they do not prove delivery to recipients or completion on the user's Android device. The extracted native note schema, serializer, parser, block-ID plugin and embed API client also pass the three-card integration fixture with simulated HTTP.

No INSIGHT source, configuration or backend changes.
