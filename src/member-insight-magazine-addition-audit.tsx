import { useEffect, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import "./member-insight-magazine-addition-audit.css";

type Notice = Record<string, any>;
const FEED = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-feed-final";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const jstDay = (value: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
const jstTime = (value: unknown) => {
  const d = new Date(String(value || ""));
  return Number.isNaN(d.getTime()) ? "時刻不明" : new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
};
function magazineKeyIn(url: unknown): string {
  try {
    const u = new URL(String(url || ""));
    if (u.protocol !== "https:" || u.hostname !== "note.com") return "";
    return u.pathname.match(/^\/[^/]+\/m\/([A-Za-z0-9_-]+)/)?.[1] || "";
  } catch { return ""; }
}
function belongsToMagazine(r: Notice, key: string): boolean {
  return [r.target_url, r.source_url, r.meta?.magazine_url, r.meta?.magazineUrl, r.meta?.all_area_url, r.meta?.featured_area_url]
    .some(url => magazineKeyIn(url) === key);
}
function noticeIdentity(r: Notice): string {
  const id = String(r.meta?.event_identity || "");
  return id.startsWith("notice:") ? id : String(r.id || "") || [r.occurred_at, r.actor_url, r.raw_text].join("|");
}

export function MemberInsightMagazineAdditionAudit({ magazineKey, selectedDay }: { magazineKey: string; selectedDay: string }) {
  const [day, setDay] = useState(selectedDay || jstDay(new Date()));
  const [events, setEvents] = useState<Notice[]>([]);
  const [checkedDay, setCheckedDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState(false);
  const current = useRef<AbortController | null>(null);
  useEffect(() => {
    current.current?.abort();
    setDay(selectedDay || jstDay(new Date()));
    setEvents([]);
    setCheckedDay("");
    setError("");
    setBusy(false);
    setPartial(false);
  }, [magazineKey, selectedDay]);
  useEffect(() => () => current.current?.abort(), []);

  async function check() {
    current.current?.abort();
    const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
    if (!token) { setError("INSIGHTへのログインを確認してください。"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { setError("日付を選択してください。"); return; }
    const controller = new AbortController();
    current.current = controller;
    setBusy(true); setError(""); setCheckedDay(""); setEvents([]); setPartial(false);
    const found = new Map<string, Notice>();
    try {
      let truncated = false;
      for (let page = 1; page <= MAX_PAGES; page++) {
        const response = await fetch(FEED, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Insight-Token": token },
          body: JSON.stringify({ kind: "magazine_article_added", day, handlingStatus: "all", page, pageSize: PAGE_SIZE }),
          cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || data?.ok !== true || !Array.isArray(data.rows)) throw new Error(String(data?.error || "通知履歴を取得できませんでした"));
        if (localStorage.getItem(INSIGHT_TOKEN_KEY) !== token) throw new Error("アカウントが切り替わりました。");
        for (const row of data.rows) {
          if (!belongsToMagazine(row, magazineKey)) continue;
          const id = noticeIdentity(row);
          if (!found.has(id)) found.set(id, row);
        }
        const total = Number(data.total || 0);
        if (page * PAGE_SIZE >= total || data.rows.length < PAGE_SIZE) break;
        if (page === MAX_PAGES) truncated = true;
      }
      if (controller.signal.aborted) return;
      setEvents([...found.values()].sort((a, b) => Date.parse(b.occurred_at || b.captured_at || "") - Date.parse(a.occurred_at || a.captured_at || "")));
      setCheckedDay(day);
      setPartial(truncated);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "通知履歴を確認できませんでした。");
    } finally {
      if (current.current === controller) { current.current = null; setBusy(false); }
    }
  }
  return <details className="mimag-audit">
    <summary>追加した日を確認する <small>🔔通知記録</small></summary>
    <div className="mimag-audit-body">
      <p>記事の「投稿日」と、マガジンへの「追加通知日」は別です。追加日を指定して、通知に記録された操作を照合します。</p>
      <div className="mimag-audit-controls">
        <label>追加通知日 <input type="date" value={day} onChange={e => { setDay(e.target.value); setCheckedDay(""); }} /></label>
        <button type="button" disabled={busy} onClick={() => void check()}>{busy ? "照合中…" : "通知を照合"}</button>
        {busy ? <button type="button" onClick={() => current.current?.abort()}>中止</button> : null}
      </div>
      {error ? <p role="alert" className="mimag-audit-error">{error}</p> : null}
      {checkedDay ? <>
        <strong className="mimag-audit-count">{checkedDay.replaceAll("-", "/")} の追加通知：{events.length}件{partial ? "（一部のみ）" : ""}</strong>
        {events.length ? <ul>{events.map(r => <li key={noticeIdentity(r)}><time>{jstTime(r.occurred_at || r.captured_at)}</time><b>{String(r.actor_name || "投稿者不明")}</b><span>{String(r.raw_text || "追加通知")}</span>{r.target_url ? <a href={String(r.target_url)} target="_blank" rel="noreferrer">マガジン ↗</a> : null}</li>)}</ul> : <p>この日の該当マガジンの追加通知は、保存済み履歴内で確認できませんでした。</p>}
        <p className="mimag-audit-warning">通知は複数人・複数記事を1件にまとめる場合があります。通知件数＝追加記事数ではありません。個別の記事IDと実際の追加時刻が確認できないものは、1日1件ルールの違反と断定しません。通知を取得できなかった期間も対象外です。</p>
      </> : null}
    </div>
  </details>;
}
