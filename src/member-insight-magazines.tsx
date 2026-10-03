import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CreatorAvatar, creatorNoteId } from "./creator-avatar";
import "./member-insight-magazines.css";

type Row = Record<string, any>;
type SearchState = { day: string; query: string; rows: Row[]; searched: boolean; busy: boolean; error: string; signature: string; total?: number };
const blank = (): SearchState => ({ day: "", query: "", rows: [], searched: false, busy: false, error: "", signature: "" });
const keyOf = (r: Row) => String(r.key || r.magazineKey || r.magazine_key || String(r.url || "").match(/\/m\/([^/?#]+)/)?.[1] || r.url || "");
const number = (v: any) => Number(v || 0).toLocaleString("ja-JP");
const date = (v: any) => { const d = new Date(String(v || "")); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }); };
const dayOf = (v: any) => { const d = new Date(String(v || "")); if (Number.isNaN(d.getTime())) return ""; const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).map(x => [x.type, x.value])); return `${parts.year}-${parts.month}-${parts.day}`; };
function localMatches(rows: Row[], day: string, query: string) { const q = query.trim().toLowerCase(); return rows.filter(a => (!day || dayOf(a.publishAt || a.publish_at) === day) && (!q || [a.title, a.author?.nickname, a.author?.urlname].some(v => String(v || "").toLowerCase().includes(q)))); }

function SearchProgress({ count }: { count: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { const start = Date.now(), timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000); return () => window.clearInterval(timer); }, []);
  return <div className="mimag-progress" role="status"><i aria-hidden="true" /><div><b>{count ? `${number(count)}件を先に表示 · 追加確認中` : "マガジンの記事を検索しています"}</b><small>{seconds >= 8 ? `確認中 ${seconds}秒 · 中止しても表示済みの記事は残ります` : "記事タイトル・投稿者・日本時間の日付を確認中"}</small></div><span aria-hidden="true">{seconds}s</span></div>;
}

export function MemberInsightMagazines({ revision, accountKey, history, search, cached }: {
  revision: number; accountKey: string; history: () => Promise<any>; search: (params: Record<string, unknown>, signal: AbortSignal) => Promise<any>; cached?: any;
}) {
  const [rows, setRows] = useState<Row[]>(cached?.rows || []), [refreshed, setRefreshed] = useState(cached?.refreshedAt || ""), [loading, setLoading] = useState(!cached?.rows?.length);
  const [mode, setMode] = useState("all"), [query, setQuery] = useState(""), [open, setOpen] = useState<string | null>(null), [states, setStates] = useState<Record<string, SearchState>>({}), [loadError, setLoadError] = useState("");
  const id = useId().replace(/:/g, ""), run = useRef(0), activeRequest = useRef<AbortController | null>(null), activeKey = useRef<string | null>(null);
  const resultCache = useRef(new Map<string, { at: number; rows: Row[]; total: number }>());
  const patch = (key: string, change: Partial<SearchState>) => setStates(old => ({ ...old, [key]: { ...(old[key] || blank()), ...change } }));
  useEffect(() => {
    let live = true;
    void history().then(x => { if (live) { setRows(x.rows || []); setRefreshed(x.refreshedAt || ""); setLoadError(""); } }).catch(() => { if (live) setLoadError("マガジンの更新を確認できませんでした。表示済みの情報は引き続き使えます。"); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [revision, history, accountKey]);
  useEffect(() => () => { run.current++; activeRequest.current?.abort(); }, [accountKey]);
  const visible = useMemo(() => rows.filter(r => {
    const ownerId = creatorNoteId(r.owner), me = String(r.meNoteId || accountKey).toLowerCase(), owned = r.relation ? r.relation === "owner" : ownerId === me;
    if (mode === "owner" && !owned || mode === "member" && owned) return false;
    const q = query.trim().toLowerCase();
    return !q || [r.title, ownerId, r.owner?.nickname].some(v => String(v || "").toLowerCase().includes(q));
  }), [rows, mode, query, accountKey]);
  function stop() {
    run.current++; activeRequest.current?.abort(); activeRequest.current = null;
    if (activeKey.current) patch(activeKey.current, { busy: false });
    activeKey.current = null;
  }
  function toggle(key: string) { stop(); setOpen(old => old === key ? null : key); }
  async function searchArticles(r: Row, day: string, queryValue: string) {
    const key = keyOf(r); if (!key) return;
    stop();
    const currentRun = ++run.current, controller = new AbortController(), q = queryValue.trim(), signature = JSON.stringify([accountKey, key, day, q.toLowerCase()]);
    activeRequest.current = controller; activeKey.current = key;
    const local = localMatches(r.recentArticles || [], day, q), saved = resultCache.current.get(signature);
    patch(key, { day, query: queryValue, rows: saved?.rows || local, searched: true, signature, error: "", busy: !saved || Date.now() - saved.at > 60000, total: saved?.total });
    if (saved && Date.now() - saved.at <= 60000) { activeRequest.current = null; activeKey.current = null; return; }
    try {
      const range = day ? { dateFrom: `${day}T00:00:00+09:00`, dateTo: new Date(Date.parse(`${day}T00:00:00+09:00`) + 86400000).toISOString() } : { dateFrom: null, dateTo: null };
      const x = await search({ magazineKey: key, query: q, ...range }, controller.signal);
      if (currentRun !== run.current || controller.signal.aborted) return;
      const merged = new Map<string, Row>();
      // Keep local hits only from this magazine and these exact criteria.
      for (const a of [...local, ...localMatches(x.rows || [], day, q)]) merged.set(String(a.url || a.key), a);
      const result = [...merged.values()].sort((a, b) => (Date.parse(b.publishAt || b.publish_at) || 0) - (Date.parse(a.publishAt || a.publish_at) || 0));
      const total = Math.max(result.length, Number(x.total || 0));
      resultCache.current.set(signature, { at: Date.now(), rows: result, total });
      patch(key, { rows: result, total, error: x.__offlineCache ? "保存済みの検索結果です。最新確認は再検索できます。" : "" });
    } catch {
      if (currentRun === run.current && !controller.signal.aborted) patch(key, { error: "追加確認が完了しませんでした。表示済みの記事は残しています。再検索できます。" });
    } finally {
      if (currentRun === run.current) { patch(key, { busy: false }); activeRequest.current = null; activeKey.current = null; }
    }
  }
  return <section className="miu-panel mimag"><header className="miu-section-head"><div><small>MAGAZINES</small><h2>共同マガジン</h2></div><strong>{number(visible.length)} / {number(rows.length)}誌</strong></header>
    <div className="miu-tools"><div className="miu-tabs">{[["all", "すべて"], ["owner", "自分がオーナー"], ["member", "参加中"]].map(([key, label]) => <button key={key} className={mode === key ? "active" : ""} aria-pressed={mode === key} onClick={() => { stop(); setMode(key); setOpen(null); }}>{label}</button>)}</div><input value={query} onChange={e => { stop(); setOpen(null); setQuery(e.target.value); }} placeholder="マガジン名・オーナー" aria-label="マガジン名・オーナー" /></div>
    {refreshed ? <p className="miu-source">最終同期 {date(refreshed)}</p> : null}{loadError ? <p className="miu-error">{loadError}</p> : null}
    {loading && !rows.length ? <div className="miu-load-scene"><b>マガジンを確認中</b><i /></div> : visible.length ? <div className="miu-mag-grid">{visible.map((r, index) => {
      const key = keyOf(r), state = states[key] || blank(), expanded = open === key, members = Array.isArray(r.members) ? r.members : [], owner = r.owner || {}, panelId = `${id}-magazine-${index}`;
      const list: Row[] = state.searched ? state.rows : (r.recentArticles || []).slice(0, 12);
      return <article key={key} data-magazine-key={key}><div><b>{r.title || "共同マガジン"}</b>{r.description ? <small>{r.description}</small> : null}</div>
        <a className="mimag-owner" href={owner.profileUrl || (creatorNoteId(owner) ? `https://note.com/${creatorNoteId(owner)}` : undefined)} target="_blank" rel="noreferrer"><CreatorAvatar person={owner} name={owner.nickname || owner.urlname || "オーナー"} className="miu-avatar" /><span><small>{r.relation === "owner" ? "自分がオーナー" : "オーナー"}</small><b>{owner.nickname || owner.urlname || "オーナー不明"}</b></span></a>
        <div className="miu-mag-stats"><span><b>{number(r.memberCount ?? members.length)}</b><small>参加人数</small></span><span><b>{number(r.followerCount)}</b><small>フォロワー</small></span><span><b>{number(r.noteCount)}</b><small>記事数</small></span></div>
        {members.length ? <div className="miu-member-faces" aria-label="参加クリエイター">{members.slice(0, 8).map((m: Row, i: number) => <a key={m.id || m.urlname || i} href={m.profileUrl || (creatorNoteId(m) ? `https://note.com/${creatorNoteId(m)}` : undefined)} target="_blank" rel="noreferrer" title={m.nickname || m.urlname}><CreatorAvatar person={m} name={m.nickname || m.urlname} className="miu-avatar" /></a>)}</div> : null}
        <div className="miu-mag-actions"><button className={expanded ? "active" : ""} aria-expanded={expanded} aria-controls={panelId} onClick={() => toggle(key)}>{expanded ? "検索を閉じる ↑" : "記事検索 ↓"}</button><a href={r.url} target="_blank" rel="noreferrer">noteで開く ↗</a></div>
        {expanded ? <div id={panelId} className="miu-mag-search"><div className="miu-calendar-tools"><label><span>記事日</span><input type="date" value={state.day} onChange={e => { const value = e.target.value; patch(key, { day: value }); void searchArticles(r, value, state.query); }} /></label><input value={state.query} onChange={e => patch(key, { query: e.target.value })} onKeyDown={e => { if (e.key === "Enter") void searchArticles(r, state.day, state.query); }} placeholder="記事タイトル・投稿者" aria-label="記事タイトル・投稿者" /><button disabled={state.busy} onClick={() => void searchArticles(r, state.day, state.query)}>{state.busy ? "検索中…" : "検索"}</button>{state.busy ? <button onClick={stop}>中止</button> : null}</div>
          {state.busy ? <SearchProgress key={state.signature} count={list.length} /> : <p className="mimag-result-status" role="status">{state.searched ? `検索結果 ${number(list.length)}件${state.total && state.total > list.length ? ` / ${number(state.total)}件` : ""}` : `最近の記事 ${number(list.length)}件`}<small>{state.searched ? "このマガジン内の検索結果" : "日付を選ぶと自動検索"}</small></p>}
          {state.error ? <p className="miu-error" role="status">{state.error}</p> : null}
          <div className="miu-mag-articles">{list.map(a => <a key={a.key || a.url} href={a.url} target="_blank" rel="noreferrer"><time>{date(a.publishAt || a.publish_at)}</time><b>{a.title}</b><span className="mimag-author"><CreatorAvatar person={a.author} name={a.author?.nickname || a.author?.urlname} className="miu-avatar" /><small>{a.author?.nickname || a.author?.urlname || "投稿者"}</small></span></a>)}</div>
          {!state.busy && !state.error && !list.length ? <p className="miu-source">条件に合う記事はありません。日付は日本時間で検索します。</p> : null}
        </div> : null}
      </article>;
    })}</div> : <p className="miu-empty">条件に合うマガジンはありません。</p>}
  </section>;
}
