# Card tool 18.8.20 — hosted recovery for final prepared additions

The Android editor reached 310/313 on v18.8.19 and the next native note image upload still failed with an unobservable HTTP status. The existing body, 310 images and progress are preserved.

This release adds a narrow recovery path for the five prepared addition PNGs only.

- Exact prepared PNG bytes are also published under `/card-fallback-18820/<sha256>.png`.
- Missing prepared addition rows can be inserted from those HTTPS copies without another note image-upload request.
- The existing image-node schema, verified creator caption and article link are preserved.
- After insertion, the normal note draft save runs and the saved draft is read back. Card creation continues only when the readback matches the editor document.
- A persisted HTTP status-0 hold may be released only when a missing prepared row has one of these exact hosted copies.
- HTTP 401/403/429 are not released or bypassed by this recovery path.
- Existing body, images, cards, target ordering, final confirmation image and progress are not reset.
