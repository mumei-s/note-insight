# Card tool 18.8.12–18.8.13: paced insertion and saved-draft audit

## User report

The v18.8.11 screenshot is in the pre-send image-link save phase, labelled
`全310件の🔗を保存中…`. This count does not prove that all notification cards
exist. The user reports intermittent timeouts, needs assurance that every
target article is included, and suspects insertion is too fast for the phone.
The screenshot alone does not establish the particular timeout or its cause.

## Changes

- After note confirms a native embed, wait 1.2 seconds before proceeding to
  the next card (previously 60 ms). Keep a single outstanding conversion and
  the ten-card save checkpoints. Display conversion-wait seconds; allow up
  to 90 seconds and preserve the pending record on timeout/stop.
- Allow up to 60 seconds for native save confirmation (previously 15 seconds).
  Initiate the save only once. Display wait seconds and, when the response
  probe has not established success, read the current article's saved draft
  with credentials, cache bypass, and a ten-second abort for that read.
- Accept readback as proof only for the exact article, matching title and
  body. Reconstruct saved HTML with note's actual schema/parser and embedded
  content hydration. When comparing parsed documents, parse current editor
  HTML through the same path so native defaults (image width, nullable embed
  attributes) are compared consistently. Ignore node IDs only.
- Add a `全件確認` button. It reads but never changes the editor document.
  Audit each target URL against current and saved image sources/links,
  genuine native embed URLs/keys, and recorded tool ownership. Detect
  missing/duplicate entries, untracked cards, incorrect order, and an
  incorrect final confirmation article. Store a per-URL `run.cardAudit`.
- Require that audit after the final save before marking `cards_ready`.
  All images, cards, recorded keys, and saved items must cover every target;
  the entire saved document must match. Report image/card/saved counts
  separately. An unreadable saved draft remains `保存 未確認`, never success.
- Rename the pre-send save label so its image-link count cannot be confused
  with the notification-card completion count.

Existing text, images, completed cards, and pending conversion records are
retained. There is no automatic reset, deletion, publishing, or image reinsertion.
The audit does not establish that recipients have received note notifications.

## Verification

New regressions fail on the prior version for a missed save-response probe
and a response arriving after 15 seconds. Updated tests cover readback proof,
wrong article/title/body rejection, native parser defaults, save checkpoints,
the 1.2-second per-card interval, and final saved-draft omissions. A missing
saved card prevents completion even when all cards remain visible locally.
Read-only audits distinguish image-only documents, duplicates, missing
ownership records, and incorrect order.

Local integration runs use the published note editor URL command and ID
normalizer with actual ProseMirror transactions: ten existing cards are kept,
only the remaining 300 are created, and all 310 images/original text survive.
A separate DOM round-trip uses note's published schema, serializer, parser,
and embed hydration to validate saved linked images/cards both with inline
embed HTML and with HTML supplied by the embedded-content metadata. That
round-trip exposed and verified the native-default comparison correction.

These tests simulate network responses. They do not demonstrate completion
on the user's Android device or delivery of notifications to recipients.

## Recovery flow

Save the current draft, install 18.8.13, reopen the editor, verify the footer,
and press `全件確認`. It reports current and saved counts. Press `送` to resume
missing/unconfirmed work. Completion requires all 310 targets and saved
content to match with zero missing or duplicate entries. Do not reinsert the
310 completed images or initialize the article for this update.

## Final readback contradiction correction (18.8.13)

A fresh readback that disagrees with the editor invalidates an older save-response
proof for that same document. Otherwise a subsequent send could skip the actual
resave and repeatedly fail the audit. The saved-card omission regression now
continues by resuming, verifies one real resave and zero extra card insertions,
and reaches a complete saved audit.
