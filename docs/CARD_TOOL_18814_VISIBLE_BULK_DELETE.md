# Card tool 18.8.14 — visible native cards and complete bulk deletion

## Scope and evidence

User screenshot 1000015232 shows v18.8.13, a 128/310 conversion-wait status,
and a raw URL at the bottom. The user reports that no cards appeared. That
screenshot cannot establish how many cards exist elsewhere in the document.
The old status used the next attempt number, and its completion check accepted
an embed node/key/HTML without confirming the corresponding displayed iframe.

Inspection of note's downloaded production editor code found its native URL
command's height-measurement promise accepts any `height::...` message from
note.com, without checking the source iframe or requested article. A replay
of that exact function accepted an unrelated iframe's height 0 and passed it
to the embed registration. This is a reproduced code defect, not proof that
it was the sole cause on the user's device. The previous tests stubbed that
measurement step and therefore did not exercise this failure.

The user subsequently instructed **do not modify INSIGHT** and requested
card bulk deletion too. No INSIGHT page, reader, backend, or data is changed.

## Insertion and verification

- Use note's existing authenticated `13550.MI` API client, whose published
  implementation posts FormData to `/v1/embed`. Supply the current article
  key, exact target URL, Note type, and a nonzero initial height of 360.
  Keep note's returned embed key, identifier, service and iframe. No invented
  embed keys, screenshot substitutions, direct draft POSTs or automatic publishing.
- Validate the response article identifier/service/key and its actual note.com
  iframe URL before inserting into the one exact work paragraph. Reject stale
  paragraph references, a different article, disconnected views and cancelled
  attempts. Cache an in-flight result so retries do not issue concurrent registrations.
- Preserve existing cards, body, image captions, image links and image order.
  Repair a zero-height tool-owned iframe in place without changing its native key.
- Require both actual editor DOM geometry and a positive height response from
  **that iframe's own contentWindow**, from the note.com origin. Other frame
  messages, zero heights, absent DOM and an empty iframe box do not pass.
  If an old frame's message was missed, reload only that preview once after ten
  seconds. Stop after 45 seconds, retain its pending record, and resume without
  reinserting a card that already exists. Show elapsed wait seconds.
- Keep the 1.2 second interval and ten-card save checkpoints. Display completed
  count separately from the currently attempted number. Full audit includes
  displayed count, current/saved card count, missing entries and duplicates.

## Bulk deletion

The visible `削` action now uses the source-picker deletion routine, including
both recorded native keys and a single verifiable unrecorded pending card.
It also removes only the extra pending work URL (when ownership is provable),
leaving an identical URL in the original body. Cancel outstanding callbacks so
a late successful registration cannot reinsert a deleted card. Preserve the
original baseline cards and all images/captions/links. Save the resulting draft,
read it back, require full document equality and absence of every removed key,
and only then clear the run's card records. A failed save/readback keeps the
records for retry. It does not publish the deletion.

## Verification

- 95-test safety suite passed before the final iframe-response guard; the final
  focused tests also cover empty iframe boxes, incorrect origins and unrelated
  frame messages. Final release CI runs the entire updated suite.
- 310-card DOM simulation: all targets inserted and saved, then bulk deleted;
  original body, identical original URL, 310 linked images and a baseline native
  card survive. The simulated server is explicitly not the user's note account.
- Pending invisible card resumes without another registration; pending card and
  pending raw URL can be deleted; late API response after deletion stays cancelled.
- Wrong API response fails closed. A zero-height owned card is repaired with no
  registration. A stale saved draft prevents deletion completion until retried.
- Separate integration uses note's published schema/serializer/parser, actual
  ProseMirror transactions and block-ID assignment, and its extracted API client
  with simulated HTTP responses. Insertion, native HTML round-trip, saved audit
  and bulk removal preserve body, captions, images and links.

The user's Android editor session and recipient notification delivery have not
been verified. Runtime checks determine completion on that device; passing
simulations must not be reported as device completion.
