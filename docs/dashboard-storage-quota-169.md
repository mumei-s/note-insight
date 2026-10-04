# Dashboard 1.6.9: storage quota and pause

Device evidence: Dashboard 1.6.8 fails at the durable-save queue `localStorage.setItem` with `QuotaExceededError`, retaining 289 collected articles and 28 daily dates. These counts come from the screenshot; they are not a server-save confirmation. No live device DOM was available.

The save queue previously required successful note.com local storage writes before it sent a snapshot or confirmed its server result. Post-confirmation metadata writes could also turn a successful save into an error.

- Keep the normal origin-storage path when available. On a failed write, retain the current value in memory and use the userscript's granted modern or legacy GM storage. Serialize/coalesce asynchronous writes, including snapshot IDs received before a failed save confirmation.
- Restore fallback queue entries on later note pages, scoped by paired account/token hash and checked against the actual note login before sending. Connection tokens are not copied into queue bodies or checkpoints.
- Preserve captured progress/checkpoints in the same fallback store. Migrate only each affected dashboard storage key after its extension write succeeds; never clear note data, other tools, or unrelated accounts.
- Local storage failures in the saved-data hash, last-save timestamp and completion message cannot block successful server-save reporting. Existing snapshot-count/value verification remains required.
- With no GM storage API, use the in-memory queue to finish a current-page save and confirmation. This mode cannot promise recovery after a full page/browser close if origin storage is also unavailable.
- Label the in-progress button 一時停止; after pressing it, show 一時停止中 while outstanding requests/save verification finish. Keep explicit 読み込み for manual continuation and the existing compact panel/progress animation.

Regressions reproduce full origin storage, modern/legacy extension fallback, save confirmation retry after a page change, concurrent requests, network failure, account mismatch, checkpoint coalescing, full-reader completion and unchanged-value deduplication. Existing pause/navigation/manual-read behavior and visible-tab tests remain required. Physical Android confirmation remains pending.
