import { useEffect, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import { readSavedInsightView, removeSavedInsightView, writeSavedInsightView } from "./insight-saved-view";
import { fetchInsightResource } from "./insight-view-lifecycle";
import "./member-insight-outgoing-comments.css";

const API = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/";
const PAGE_SIZE = 20;
const SAVED_KIND = "outgoing-comments";
const id = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const record = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const date = (value: string | null) => {
  const time = value ? new Date(value) : null;
  return time && Number.isFinite(time.getTime()) ? time.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "日時未確認";
};

type ArchiveRow = {
  id: string; articleKey: string; commentKey: string; parentKey: string | null;
  bodyPreview: string; body?: string; occurredAt: string | null;
  authorUrl: string | null; articleUrl: string | null; commentUrl: string | null;
};
type Message = { commentKey: string; parentKey: string | null; body: string; author: string | null; occurredAt: string | null; isSelf: boolean };
type Detail = { row: ArchiveRow; messages: Message[] };
type Snapshot = { rows: ArchiveRow[]; details: Record<string, Detail>; hasMore: boolean };
type Permission = { enabled: boolean; activeDeviceCount: number };
const rowKey = (row: Pick<ArchiveRow, "articleKey" | "commentKey">) => `${row.articleKey}:${row.commentKey}`;

function noteUrl(value: unknown, articleKey?: string, commentKey?: string): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.origin !== "https://note.com" || url.username || url.password) return null;
    if (articleKey && !new RegExp(`^/[a-zA-Z0-9_-]+/n/${articleKey}/?$`).test(url.pathname)) return null;
    if (commentKey && url.searchParams.get("c") !== commentKey) return null;
    // Only the known article/comment locator is needed, never arbitrary query data.
    url.search = commentKey ? `?c=${encodeURIComponent(commentKey)}` : "";
    url.hash = "";
    return url.href;
  } catch { return null; }
}
function parseRow(value: unknown, full = false): ArchiveRow | null {
  if (!record(value) || typeof value.id !== "string" || !value.id || !id(value.articleKey) || !id(value.commentKey) || !(value.parentKey === null || id(value.parentKey))) return null;
  if (full ? typeof value.body !== "string" || !value.body.trim() : typeof value.bodyPreview !== "string") return null;
  return {
    id: value.id, articleKey: value.articleKey, commentKey: value.commentKey, parentKey: value.parentKey,
    bodyPreview: full ? value.body.slice(0, 180) : value.bodyPreview.slice(0, 180),
    ...(full ? { body: value.body } : {}), occurredAt: typeof value.occurredAt === "string" ? value.occurredAt : null,
    authorUrl: noteUrl(value.authorUrl), articleUrl: noteUrl(value.articleUrl, value.articleKey),
    commentUrl: noteUrl(value.commentUrl, value.articleKey, value.commentKey),
  };
}
function ownMessage(row: ArchiveRow): Message {
  return { commentKey: row.commentKey, parentKey: row.parentKey, body: row.body || row.bodyPreview, author: "自分", occurredAt: row.occurredAt, isSelf: true };
}
function savedConversation(value: unknown, row: ArchiveRow, account: string): Message[] {
  const fallback = [ownMessage(row)];
  if (!record(value) || value.articleKey !== row.articleKey || !id(value.threadKey) || !Array.isArray(value.messages) || value.messages.length > 500) return fallback;
  const seen = new Set<string>(), messages: Message[] = [];
  for (const message of value.messages) {
    if (!record(message) || /^(?:削除済み|このコメントは削除されました[。.]?|コメントは削除されました[。.]?|削除されたコメント|\[deleted\]|\[removed\])$/i.test(String(message.body || "").trim()) || !id(message.commentKey) || !(message.parentKey === null || id(message.parentKey)) || typeof message.body !== "string" || !message.body.trim() || seen.has(message.commentKey)) continue;
    seen.add(message.commentKey);
    messages.push({ commentKey: message.commentKey, parentKey: message.parentKey, body: message.body,
      author: typeof message.author === "string" ? message.author : null,
      occurredAt: typeof message.occurredAt === "string" ? message.occurredAt : null,
      isSelf: message.commentKey === row.commentKey || (message.isSelf === true && noteUrl(message.authorUrl) === `https://note.com/${account}`) });
  }
  const anchor = messages.find(message => message.commentKey === row.commentKey);
  const root = messages.find(message => message.commentKey === value.threadKey);
  if (!anchor || anchor.parentKey !== row.parentKey || (root && root.parentKey !== null)) return fallback;
  const linked = new Set<string>([value.threadKey]);
  for (let pass = 0; pass < messages.length; pass++) for (const message of messages) if (message.parentKey && linked.has(message.parentKey)) linked.add(message.commentKey);
  if (!linked.has(row.commentKey)) return fallback;
  return messages.filter(message => linked.has(message.commentKey)).map(message => message.commentKey === row.commentKey ? ownMessage(row) : message)
    .sort((a, b) => (Date.parse(a.occurredAt || "") || 0) - (Date.parse(b.occurredAt || "") || 0) || a.commentKey.localeCompare(b.commentKey));
}
function retainConversation(previous: Message[] | undefined, incoming: Message[], row: ArchiveRow) {
  // A deleted or temporarily absent reply must not erase its already verified
  // display copy. Never join messages with a conflicting exact parent identity.
  const merged = new Map((previous || []).map(message => [message.commentKey, message]));
  for (const message of incoming) {
    const saved = merged.get(message.commentKey);
    if (!saved || saved.parentKey === message.parentKey) merged.set(message.commentKey, message);
  }
  merged.set(row.commentKey, ownMessage(row));
  const order = (a: Message, b: Message) => (Date.parse(a.occurredAt || "") || 0) - (Date.parse(b.occurredAt || "") || 0) || a.commentKey.localeCompare(b.commentKey);
  const replies = [...merged.values()].filter(message => message.commentKey !== row.commentKey).sort(order).slice(-499);
  return [ownMessage(row), ...replies].sort(order);
}
function ownedRow(row: ArchiveRow, account: string) {
  return row.id === `${account}:${row.articleKey}:${row.commentKey}` && row.authorUrl === `https://note.com/${account}`;
}
function readSnapshot(account: string, token: string) {
  const saved = readSavedInsightView<Snapshot>(SAVED_KIND, { account, token }), value = saved?.value;
  if (!saved || !value || !Array.isArray(value.rows) || value.rows.length > PAGE_SIZE || typeof value.hasMore !== "boolean") return null;
  const rows = value.rows.map(row => parseRow(row));
  if (rows.some(row => !row || !ownedRow(row, account))) return null;
  const details: Record<string, Detail> = {};
  if (record(value.details)) for (const row of rows as ArchiveRow[]) {
    const item = value.details[rowKey(row)], full = item && parseRow(item.row, true);
    if (full && ownedRow(full, account) && rowKey(full) === rowKey(row) && full.parentKey === row.parentKey && Array.isArray(item.messages)) {
      // Revalidate persisted message links instead of trusting arbitrary cached bodies.
      const root = item.messages.find((message: Message) => message?.parentKey === null);
      const messages = savedConversation({ articleKey: row.articleKey, threadKey: root?.commentKey || row.parentKey || row.commentKey, messages: item.messages.map((message: Message) => ({ ...message, authorUrl: message.isSelf ? `https://note.com/${account}` : null })) }, full, account);
      details[rowKey(row)] = { row: full, messages };
    }
  }
  return { value: { rows: rows as ArchiveRow[], details, hasMore: value.hasMore }, savedAt: saved.savedAt };
}

export function MemberInsightOutgoingComments({ noteId, revision = 0 }: { noteId: string; revision?: number }) {
  const [, changed] = useState(0);
  useEffect(() => {
    const refresh = () => changed(value => value + 1);
    window.addEventListener("storage", refresh);
    window.addEventListener("mumei-insight-accounts", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("mumei-insight-accounts", refresh); };
  }, []);
  const account = String(noteId || "").trim().toLowerCase(), token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
  return <OutgoingArchiveSession key={JSON.stringify([account, token])} account={account} token={token} revision={revision} />;
}

function OutgoingArchiveSession({ account, token, revision }: { account: string; token: string; revision: number }) {
  const [initial] = useState(() => readSnapshot(account, token));
  const [snapshot, setSnapshot] = useState<Snapshot>(initial?.value || { rows: [], details: {}, hasMore: false });
  const snapshotRef = useRef(snapshot); snapshotRef.current = snapshot;
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [checked, setChecked] = useState(false), [permission, setPermission] = useState<Permission | null>(null);
  const [consentBusy, setConsentBusy] = useState(false), [consentError, setConsentError] = useState("");
  const [handoff, setHandoff] = useState<{ url: string; expiresAt: string } | null>(null);
  const rejected = useRef(false);
  const page = useRef(1), alive = useRef(true), listFlight = useRef<AbortController | null>(null), consentFlight = useRef<AbortController | null>(null), consentVersion = useRef(0);
  const detailFlights = useRef(new Map<string, AbortController>()), attemptedDetails = useRef(new Set<string>());
  const [detailBusy, setDetailBusy] = useState<Record<string, boolean>>({}), [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const priorRevision = useRef(revision);
  const currentRevision = useRef(revision), verifiedRevision = useRef<number | null>(null), isOpen = useRef(false);
  currentRevision.current = revision;
  const active = () => !rejected.current && alive.current && Boolean(token && id(account)) && localStorage.getItem(INSIGHT_TOKEN_KEY) === token;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; consentFlight.current?.abort(); listFlight.current?.abort(); for (const controller of detailFlights.current.values()) controller.abort(); };
  }, []);
  useEffect(() => {
    if (priorRevision.current === revision) return;
    priorRevision.current = revision;
    if (open) void loadList(1);
  }, [revision]);

  function save(next: Snapshot) {
    snapshotRef.current = next; setSnapshot(next);
    const rows = next.rows.slice(0, PAGE_SIZE), keys = new Set(rows.map(rowKey));
    writeSavedInsightView(SAVED_KIND, { account, token }, { rows, details: Object.fromEntries(Object.entries(next.details).filter(([key]) => keys.has(key))), hasMore: next.hasMore || next.rows.length > PAGE_SIZE });
  }
  async function request(endpoint: string, body: Record<string, unknown>, signal?: AbortSignal) {
    if (!active()) throw new Error("INSIGHT_ACCOUNT_CHANGED");
    const response = await fetchInsightResource(API + endpoint, { method: "POST", headers: { "Content-Type": "application/json", "X-Insight-Token": token }, body: JSON.stringify(body), cache: "no-store", signal }, 30_000);
    const payload = await response.json();
    if (!active() || signal?.aborted) throw new Error("INSIGHT_ACCOUNT_CHANGED");
    if (!response.ok || payload?.ok !== true) throw Object.assign(new Error("ARCHIVE_READ_FAILED"), { status: response.status });
    if (payload.noteId !== account) throw new Error("INSIGHT_ACCOUNT_MISMATCH");
    return payload;
  }
  function failed(error: unknown) {
    if (record(error) && [401, 403].includes(error.status)) {
      rejected.current = true; listFlight.current?.abort(); for (const controller of detailFlights.current.values()) controller.abort();
      setBusy(false); setDetailBusy({}); closeConsent();
      removeSavedInsightView(SAVED_KIND, { account, token });
      snapshotRef.current = { rows: [], details: {}, hasMore: false }; setSnapshot(snapshotRef.current); setPermission(null);
      const message = "ログイン状態を確認できませんでした。INSIGHTにログインし直してください。";
      setError(message); return message;
    }
    return "履歴を確認できませんでした。保存済みの内容は保持しています。";
  }
  async function loadList(nextPage: number) {
    if (!active() || listFlight.current) return;
    const requestedRevision = currentRevision.current;
    const controller = new AbortController(); listFlight.current = controller; setBusy(true); setError("");
    try {
      const payload = await request("insight-outgoing-comment-history", { action: "list", page: nextPage, pageSize: PAGE_SIZE }, controller.signal);
      if (listFlight.current !== controller) return;
      if (!Array.isArray(payload.rows) || payload.rows.length > PAGE_SIZE || typeof payload.hasMore !== "boolean" || !record(payload.permission) || typeof payload.permission.enabled !== "boolean" || !Number.isSafeInteger(payload.permission.activeDeviceCount) || payload.permission.activeDeviceCount < 0) throw new Error("ARCHIVE_RESPONSE_INVALID");
      const rows = payload.rows.map((row: unknown) => parseRow(row));
      if (rows.some((row: ArchiveRow | null) => !row || !ownedRow(row, account))) throw new Error("ARCHIVE_ROW_INVALID");
      const merged = new Map((nextPage > 1 ? snapshotRef.current.rows : []).map(row => [rowKey(row), row]));
      for (const row of rows as ArchiveRow[]) merged.set(rowKey(row), row);
      page.current = nextPage; save({ rows: [...merged.values()], details: snapshotRef.current.details, hasMore: payload.hasMore });
      if (nextPage === 1) verifiedRevision.current = requestedRevision;
      setPermission(payload.permission); setChecked(true);
    } catch (error) { if (active() && !controller.signal.aborted) setError(failed(error)); }
    finally {
      if (listFlight.current === controller) {
        listFlight.current = null;
        if (active()) {
          setBusy(false);
          // A save completed after this read started. Confirm that revision
          // once, sharing the latest request instead of losing or polling it.
          if (isOpen.current && requestedRevision !== currentRevision.current) void loadList(1);
        }
      }
    }
  }
  async function loadDetail(row: ArchiveRow, explicit = false) {
    const key = rowKey(row);
    if (!active() || detailFlights.current.has(key) || (!explicit && attemptedDetails.current.has(key))) return;
    const controller = new AbortController(); detailFlights.current.set(key, controller); attemptedDetails.current.add(key);
    setDetailBusy(previous => ({ ...previous, [key]: true })); setDetailErrors(previous => ({ ...previous, [key]: "" }));
    try {
      const payload = await request("insight-outgoing-comment-history", { action: "detail", articleKey: row.articleKey, commentKey: row.commentKey }, controller.signal);
      if (detailFlights.current.get(key) !== controller) return;
      const full = parseRow(payload.row, true);
      if (!full || !ownedRow(full, account) || rowKey(full) !== key || full.parentKey !== row.parentKey) throw new Error("ARCHIVE_DETAIL_MISMATCH");
      const detail = { row: full, messages: retainConversation(snapshotRef.current.details[key]?.messages, savedConversation(payload.conversation, full, account), full) };
      save({ ...snapshotRef.current, details: { ...snapshotRef.current.details, [key]: detail } });
    } catch (error) { if (active() && !controller.signal.aborted) setDetailErrors(previous => ({ ...previous, [key]: failed(error) })); }
    finally { if (detailFlights.current.get(key) === controller) { detailFlights.current.delete(key); if (active()) setDetailBusy(previous => ({ ...previous, [key]: false })); } }
  }
  async function startConsent(event: React.MouseEvent<HTMLButtonElement>) {
    // A page-generated click must not create a permission-upgrade handoff.
    if (!event.isTrusted || !active() || consentFlight.current || handoff) return;
    const controller = new AbortController(); consentFlight.current = controller; const version = ++consentVersion.current; setConsentBusy(true); setConsentError("");
    try {
      const payload = await request("insight-notification-import-token", { action: "own-comment-consent-start", consent: true }, controller.signal);
      if (version !== consentVersion.current) return;
      const url = new URL(payload.noteUrl), expiry = Date.parse(payload.expiresAt);
      if (url.origin !== "https://note.com" || url.username || url.password || url.pathname !== `/${account}` || !/^[a-f0-9]{32}$/.test(payload.pairingCode) || url.searchParams.get("mumei_own_comment_scope") !== payload.pairingCode || url.searchParams.get("mumei_account") !== account || url.hash || [...url.searchParams.keys()].some(key => !["mumei_own_comment_scope", "mumei_account"].includes(key)) || !Number.isFinite(expiry) || expiry <= Date.now()) throw new Error("CONSENT_LINK_INVALID");
      setHandoff({ url: url.href, expiresAt: payload.expiresAt });
      // Same-tab navigation needs no popup permission. Retain a safe link if the
      // browser refuses navigation; opening the link still cannot enable Reader.
      try { window.location.assign(url.href); }
      catch { setConsentError("noteへの移動を開始できませんでした。下のボタンから続けてください。まだ連携は完了していません。"); }
    } catch { if (active() && version === consentVersion.current) setConsentError("連携用の案内を確認できませんでした。連携は完了していません。もう一度操作してください。"); }
    finally { if (consentFlight.current === controller) { consentFlight.current = null; if (active()) setConsentBusy(false); } }
  }
  function closeConsent() { consentVersion.current++; consentFlight.current?.abort(); consentFlight.current = null; setConsentBusy(false); setHandoff(null); setConsentError(""); }
  function toggle(next: boolean) {
    isOpen.current = next;
    setOpen(next);
    if (next) { if (!checked || verifiedRevision.current !== currentRevision.current) void loadList(1); }
    else {
      closeConsent(); listFlight.current?.abort(); listFlight.current = null; setBusy(false);
      for (const [key, controller] of detailFlights.current) { controller.abort(); attemptedDetails.current.delete(key); }
      detailFlights.current.clear(); setDetailBusy({});
    }
  }
  return <details className="mioc" onToggle={event => { if (event.target === event.currentTarget) toggle(event.currentTarget.open); }}>
    <summary>自分のコメント履歴 <span>{snapshot.rows.length ? `${snapshot.rows.length}件を表示` : "送信した本文・会話"}</span></summary>
    <div className="mioc-content">
      <p>一度保存できた自分の本文は、noteで削除されても履歴として残ります。記事URLを毎回入力する必要はありません。</p>
      {!token || !id(account) ? <p role="status">INSIGHTにログインすると、本人の保存履歴を確認できます。</p> : <>
        <details className="mioc-permission">
          <summary>自分の投稿を保存する設定</summary>
          <p>初期状態はオフです。同意したReader搭載ブラウザで、noteへの投稿に成功した自分のコメント本文、アカウント・記事・コメント・親コメントのID、投稿日時を、本人用の非公開INSIGHT保存先へ送ります。</p>
          <p>下書き・投稿失敗・旧形式のコメント欄・note公式アプリからの投稿は対象外です。対応する新形式のコメント欄だけを保存します。過去の未保存コメントは復元できません。連携していない端末の投稿も自動保存されません。</p>
          <p className="mioc-permission-status">{permission ? permission.enabled ? `連携済み端末あり（${permission.activeDeviceCount}台）。このブラウザの連携状態は未確認です。` : "保存連携済みの端末はありません。" : "保存連携の状態は未確認です。"}</p>
          <p>初回だけ2操作です。下のボタンで上記データの送信・保存に同意してnoteへ進み、noteでこのブラウザの有効化を確認します。Readerを入れた同じブラウザで操作してください。</p>
          <button type="button" disabled={consentBusy || Boolean(handoff)} onClick={event => void startConsent(event)}>{consentBusy ? "noteへの連携を準備中…" : "同意してnoteへ進む"}</button>
          {consentBusy ? <button type="button" onClick={closeConsent}>設定を中止</button> : null}
          {handoff ? <div className="mioc-handoff" role="status"><p>まだ連携は完了していません。noteで「このブラウザで自動保存を有効にする」を押してください。自動で移動しない場合は下のリンクから続けられます。</p><a href={handoff.url} rel="noreferrer">noteで有効化を続ける</a><small>有効期限：{date(handoff.expiresAt)}</small><p>許可後、この画面の「履歴を更新」で保存先の状態を確認できます。</p><button type="button" onClick={closeConsent}>連携手順を閉じる</button></div> : null}
          {consentError ? <p role="alert">{consentError}</p> : null}
        </details>
        <div className="mioc-toolbar"><button type="button" disabled={busy} onClick={() => void loadList(1)}>履歴を更新</button><small>{busy ? "保存先を確認中…" : checked ? "保存先を確認済み" : initial ? "前回保存分・最新未確認" : "保存先は未確認"}</small></div>
        {error ? <p role="alert">{error}</p> : null}
        {snapshot.rows.length ? <div className="mioc-list">{snapshot.rows.map(row => {
          const key = rowKey(row), detail = snapshot.details[key], full = detail?.row || row, messages = detail?.messages || [ownMessage(row)];
          return <details className="mioc-entry" key={key} onToggle={event => { if (event.currentTarget.open) void loadDetail(row); }}>
            <summary><span>{row.bodyPreview || "保存したコメント"}</span><small>{date(row.occurredAt)} · {row.parentKey ? "返信" : "コメント"}</small></summary>
            <ol className="mioc-conversation" aria-label="保存したコメントの会話">{messages.map(message => <li className={`mioc-message ${message.isSelf ? "self" : "other"}`} key={message.commentKey}><small>{message.isSelf ? "自分" : message.author || "投稿者未確認"} · {date(message.occurredAt)}</small><p>{message.body}</p></li>)}</ol>
            {!detail ? <small>一覧のプレビューです。本文全体は保存先を確認して表示します。</small> : null}
            <p className="mioc-reply-state">返信の取得状況は未確認。表示は保存できた会話だけです。</p>
            {full.commentUrl ? <a href={full.commentUrl} target="_blank" rel="noopener noreferrer">このコメントをnoteで開く ↗</a> : full.articleUrl ? <a href={full.articleUrl} target="_blank" rel="noopener noreferrer">対象記事をnoteで開く ↗</a> : <small>記事のリンクは未確認です。</small>}
            <div className="mioc-entry-actions"><button type="button" disabled={Boolean(detailBusy[key])} onClick={() => void loadDetail(row, true)}>{detailBusy[key] ? "保存した会話を確認中…" : "保存した会話を更新"}</button></div>
            {detailErrors[key] ? <p role="alert">{detailErrors[key]}</p> : null}
          </details>;
        })}</div> : checked && !busy ? <p>保存済みの自分のコメントはまだありません。保存されていない投稿や返信がないことを示すものではありません。</p> : busy ? <p role="status">自分のコメント履歴を確認中…</p> : null}
        {snapshot.hasMore ? <button type="button" disabled={busy} onClick={() => void loadList(page.current + 1)}>続きの履歴を表示</button> : null}
      </>}
    </div>
  </details>;
}
