# Card tool 18.8.11: native save ID normalization

## Observed failure

The user's v18.8.10 screenshot shows all 310 images complete and notification
cards stopped at 10/310: `保存確認中に本文が変わりました`.
The first intermediate save introduced in 18.8.10 exposes a save-guard bug.

## Cause and correction

The published note editor's native draft-save callback in
`334-c27037139defc1b5.js` runs `lrP(view.state)` and dispatches its transaction
before serializing the document and sending the draft-save request.
`lrP` is exported as `e5` by `57-2ae1cd5058b7ac1f.js`; it assigns IDs to blocks
with missing or duplicate IDs. Text, image sources and links, embed keys, and
node order are unchanged by that operation.

The tool's visible-save-button path stopped immediately when the immutable
document object changed. Unlike the registered native callback path, it had no
promise indicating that the save was still pending. Thus ID normalization
before a delayed HTTP response produced the reported error.

The save guard now compares documents excluding only node `attrs.id` when the
document object changes. All other attributes, text, marks, child order, image
links, embed keys, and the title remain checked. An equivalent document updates
the expected reference and continues waiting within the existing deadline.
ID normalization itself does not establish success: existing native-save
response/UI confirmation rules still apply. A save without success proof times
out; an unsaved meaningful edit still stops.

## Verification

- Before the fix, the new full-send regression reproduces the exact 10/310
  message. The save-button ID-normalization and equivalent-document regressions
  also fail on 18.8.10.
- After the fix, all 310 cards complete through 31 intermediate saves with ID
  normalization and delayed success responses. A second send adds no cards.
- Separate tests keep body edits, image source/link edits, embed-key changes,
  and title changes from being accepted based solely on a save notification.
  ID-only changes without a success response time out rather than succeed.
- A local integration run executes the published note URL conversion and `e5`
  ID-normalization code with actual ProseMirror state/transactions. Starting
  from 10 existing cards and 310 images, it creates exactly 300 additional
  cards, completes 31 confirmed saves, preserves original text and all images,
  and verifies article order.

The integration run simulates network responses and does not establish success
on the user's Android device or actual note draft-save endpoint. The required
device completion indicator remains `通知カード 310/310 完成・保存`.

## Update

Save the current draft, install v18.8.11, reopen the editor, confirm the footer
version, and press `送`. Existing images and completed notification cards are
retained. Do not initialize the article or reinsert the images for this fix.
