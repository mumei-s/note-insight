# Outgoing comment capture: staged, not enabled

Checked 2026-10-23 against main 97157a727 (PR77 incorporated). Local draft only; no production or credential changes.

## Verified public frontend contract

Source page: https://note.com/ss_yr/n/n15700f2773c6

- https://frontend.st-note.com/next/_next/static/chunks/36277-aee22199e0ca5dae.js module 26530 defines createNoteCommentV3: POST `/v3/notes/${noteKey}/note_comments`, snake-cases request fields, camelizes response JSON.
- https://frontend.st-note.com/next/_next/static/chunks/20548-d7cd80d68ca27a18.js calls that method with `{comment: richText, acknowledgement, parentKey}`. On success its consumer constructs the entity from `response.data`. Legacy comments use a different `/comments` route; this staged observer deliberately excludes that route.
- https://frontend.st-note.com/next/_next/static/chunks/92726-82fd9bef443c461e.js module 90824's comment entity reads key, noteKey, createdAt, user, comment.children, isRoot. The response JSON therefore uses snake_case with a `data` object. The same chunk's module 99054 proves recursive snake/camel conversion.
- Public GET `https://note.com/api/v3/notes/n15700f2773c6/note_comments?order=oldest&per_page=1&page=1` confirms `key`, `note_key`, `created_at`, `parent_key`, `is_root`, `user.urlname`, `comment.type=root`, paragraph children and text value shape. No real POST was sent.
- The actual client module 50111 calls `(config.fetch || fetch)` and rejects non-success status. No request alteration or posting automation is required.
- Existing notification network file has installFetch/installXHR definitions but no calls installing them. It only handles notices and session-gated capture. Do not quietly repurpose that dormant notification hook.

## Staged implementation

The draft Reader loader references `public/note-insight-outgoing-comment-capture-v1.js` and `public/note-insight-outgoing-comment-reader-v1.js`; neither is published yet. It exports an observer factory and IndexedDB store. Explicit activation defaults false. It observes only same-origin exact v3 note-comment POST with verified JSON request shape; checks successful status, strict response article/self/parent identity; retains no request draft/body/headers/tokens; saves normalized successful response text. Original promise and native response are unchanged. No timers, crawling, replayed posts, or network logging.

IndexedDB writes use one stable key per account/article/comment, transactional put-if-absent, and preserve captured text on duplicates. The Reader upload adapter submits bounded records to `insight-outgoing-comment-ingest` and requires an exact persisted-ID acknowledgement; missing/wrong acknowledgements keep the queue pending. Opt-out stops new capture and uploads, retains prior saved/pending data, and does not erase history. No retries on an interval: the Reader drains on successful capture, explicit resume and online/reopen, with single-flight. A permanently rejected record stays pending but does not block later valid records; network/auth failure stops the trigger to avoid a request storm. Native note app and other browsers without the installed script cannot be captured. Browser storage loss before server ack is not recoverable by this module.

Focused Node tests cover selective capture, failures/cancel, account switch, promise preservation, exact key dedup, parent mismatch, ack/retry and opt-out. Separate fake-indexeddb 6.2.4 verification passed simultaneous writers, replay preservation, account isolation and durable ack; that temporary dev tool was not added to repository dependencies. Real browser userscript install/page-world access and actual successful-post observation remain unverified.

## Existing server storage verified read-only

`insight_outgoing_activity` has member_id, event_key, event_type, actor fields, subject fields, message text, occurred_at, source, raw_data JSONB. Unique `(member_id,event_key)`, member/time index. RLS enabled, no policies and no anon/authenticated grants; service_role access only. No new table/grant needed to store outgoing own comments.

Suggested row mapping: event_type `commented`; event_key `note-comment:<articleKey>:<commentKey>`; subject_key article; message response text; raw_data contains exact comment/parent IDs and original account/source, not credentials or whole responses. Auth-derived member_id only. Do not overwrite existing captured text on conflict. Verify persisted row then ACK exact client ID. Replies join by exact article/root/parent keys, not name/time or synthetic notifications.

## Authorization choice A (implemented locally, not published)

Existing paired token purpose is `note_notification_auto_sync`, not permission to archive arbitrary comments. Never silently expand all existing tokens or update them through administrative SQL.

1. INSIGHT shows optional default-off permission and disclosure listing own successful comment body, article/comment/parent IDs, account and post time, destination private INSIGHT history, browser limitation. User explicitly chooses enable.
2. Signed-in INSIGHT session creates a short-lived, single-use scope-upgrade consent through the existing pairing-code mechanism, with a distinct purpose. This code alone must not authorize another member or bulk token upgrade.
3. Current Reader device presents that consent plus its existing paired token. Server verifies consent account == token account == active verified note identity and existing purpose. Only that token ID gains `note_notification_and_own_comment_sync`; do not generate a new long-lived secret. Atomically consume consent and upgrade the one token. A separate server-only RPC migration implements this atomically; no client SQL grants. Account snapshots are added as nullable columns on both consent codes and ingest tokens. Old rows and purposes are untouched.
4. New `insight-outgoing-comment-ingest` accepts only the expanded purpose, rejects revoked/expired tokens and account/ID mismatch, validates bounded payload, writes existing activity table, returns exact ack. Legacy notification auth/stats continue accepting old purpose, and explicitly allow the expanded purpose without making ordinary pairing opt in.
5. Scope downgrade can use current token to reduce its own capability back to notifications-only. Stop capture/drain immediately; keep historical data. No retroactive deletion. Re-enabling again requires explicit consent.

No re-pairing secret replacement is needed; one explicit permission/consent handoff is needed to bind the current browser. A shorter flow based only on a token self-asserting consent is weaker: do not publish it without security review. Do not expose INSIGHT session credentials to note.com or GM storage.

Permission wording:
「このブラウザで投稿に成功した自分のコメント本文・記事ID・コメントID・返信先ID・投稿日時を、INSIGHTの自分専用履歴へ自動保存します。下書き・失敗した投稿・他人の操作は保存しません。noteアプリからの投稿は対象外です。現在の連携にこの保存権限を追加してよいですか？」

## Authorization choice B (no expanded Reader token)

Keep successful-post records in per-account shared userscript storage, and transfer only those bounded records when the signed-in INSIGHT page opens. INSIGHT uses its existing session locally to call a session-authenticated archive endpoint; session token never crosses origins. No iframe/background hidden app and no page-supplied arbitrary commands. Requires a reviewed record-only cross-origin bridge and transaction-safe shared queue (the current note-origin IndexedDB cannot itself be read on INSIGHT origin). Server backup is delayed until opening INSIGHT; browser loss before that loses the pending capture. This is more complex and less automatic than A.

## Outstanding before publication

User permission for publication and reviewed SQL/security changes; device-specific in-browser capability consent; final independent review; loader installation in actual supported Android browser and a real successful-post observation without an unsolicited external test comment. Local code now covers transactional consent, ingest, scoped history/chat panel, notification-purpose compatibility and bounded event-triggered drain. Chromium screenshot QA could not start in the executor sandbox, so DOM/mock integration tests are not claimed as real-browser verification. Native app capture and unknown past unnotified comment discovery are not provided.


## Local integration and release reservation

- Reader 3.6.42 and app 2026.10.23.3 reserved locally only.
- History panel is closed by default and makes zero requests on mount. Opening reads one bounded list page; previous account/session-scoped display is immediate. Details show saved exact-thread messages, not an external article crawl. Reply absence is never inferred from missing records.
- Reader adds no account/status requests at all on never-opted-in installations. Existing grants/connect domains are unchanged. Browser consent is unchecked by default; permission is reread before each write/upload, and GM remote value-change listener stops other tabs promptly.
- The consent code is 32 hex characters from 16 random bytes. The signed-in INSIGHT step cannot itself enable a device; current Reader must present its own existing token and the code after explicit checkbox/button consent.
- Scope-stop keeps existing history and pending records, disables capture immediately, and retries unfinished server capability reduction on later startup. Queued data is not silently deleted.
- Migration is separate and unapplied; both new endpoints and altered existing pairing endpoint remain undeployed.
