# Card tool 18.8.18 — Android status-0 confirmation

Base main: `f8196cdc93bdd2606b9db05e7033a22e92fcf153`.

The Android screenshot on 2026-09-24 showed v18.8.17 loaded and a persistent hold saying the HTTP status could not be observed. The previous probe treated status 0 as an immediate persistent stop even though native browser uploads can expose status 0 for transient, opaque, or aborted requests before the editor outcome is known.

Changes are limited to the card tool and installer. INSIGHT and prepared target data are unchanged.

- HTTP 401/403/429 still enter the persistent hold immediately.
- HTTP status 0 is diagnostic only at request end. It becomes a persistent hold only after the note editor also fails to produce the expected remote image, shows an upload failure, or the image wait times out.
- If the remote image appears successfully, a transient status 0 no longer poisons the remaining batch.
- Legacy v18.8.17 status-0 holds have no confirmation marker and are discarded on v18.8.18 load. Explicit HTTP holds are preserved.
- No automatic retry is added. A confirmed failure still stops the batch and preserves body, images, cards and progress.
