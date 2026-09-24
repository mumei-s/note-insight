# Card tool 18.8.17 — combined addition and continuation

Base main: `a2867de799cdd03f9ab75b3aa26793e7106f2c89`.

The latest device screenshot confirms 18.8.16 is installed. It reports image upload stopped at 310/313 with a generic communication error and the obsolete instruction to use 「画」. Those are image counts, not the number of notification cards. The user separately confirmed saving through タンポポはる. No authenticated device draft has been independently inspected.

The user requested additions and card continuation together, with unnecessary/older image controls removed. Changes are confined to the card tool. INSIGHT and the 313-row prepared data are unchanged.

- For the prepared batch, 「追加＋カード続き」 merges missing requested people, recovers pending image work, adds only missing images, confirms links and saving, then continues cards. The existing link/save guard stays in the path. An image failure or user stop prevents the card phase. A changed article/dataset prevents continuation. Repeated clicks share the guard lock.
- Hide the separate image/addition buttons for the prepared job; retain bulk card deletion, stop, audit and error recovery. The hidden legacy image handler remains an implementation dependency, not a second running upload queue.
- Report the known image-reception/image-transfer phase, host and actual HTTP code, or explicitly state that no HTTP status was observable. Do not turn status 0 into a guessed 403; never display signed query strings. Propagate the final image error to the visible panel instead of leaving the generic stop text.
- Image 0/401/403/429 failures now use the same persistent network hold as card/save failures and respect Retry-After. No automatic release. Remove timer-triggered pending-image recovery and link saves; the combined user action performs these steps.
- Preserve the exact 18.8.16 `@name` as the installation identity and increment only `@version` to 18.8.17. The historical number in that identity is deliberately not updated. The on-page version is 18.8.17. Earlier changing names may leave separate installations; actual duplicates on this user's device are unverified.
- Wrap the standalone bundle in a single runtime owner. Re-evaluating the same wrapper does not register another set of handlers. If an older tool initialized first, stop and report that condition instead of assembling a mixed runtime. If older code replaces key exported components later, reject network operations. Existing older entries can be disabled in Tampermonkey; no deletion of drafts, site data or saved tool progress is needed.

Validation includes combined image success/failure with an existing owned card, preservation of its key and body, no card requests after image failure, no retry during a hold, retargeting during an awaited addition, concurrent clicks, status-zero diagnostics without query leakage, duplicate initialization and late component replacement. The full card safety suite and release workflow also verify 313-card creation/save/bulk deletion and content preservation.

This release does not claim to fix or bypass the server-side cause of the user's 403 or unobservable upload response. That cause, completion on Android, and receipt of publication notifications remain unverified. Keep failed operations stopped until the affected operation is available again.
