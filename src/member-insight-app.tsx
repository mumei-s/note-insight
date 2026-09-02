import { useEffect, useMemo, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";

const API = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-api";

type Person = { key?: string; person_key?: string; name?: string; actor_name?: string; url?: string | null; actor_url?: string | null; image?: string | null; likes?: number; articles?: number; comments?: number; last_seen_at?: string | null };
type Article = { article_key: string; title: string; url: string; publish_at: string | null; like_count: number; comment_count: number };
type Notification = { id: number; notification_type: string; raw_text: string; actor_name: string | null; actor_url: string | null; target_title: string | null; target_url: string | null; occurred_at: string | null; captured_at: string; is_read: boolean };
type Dashboard = {
  member: { id: string; noteId: string; displayName: string; imageUrl: string | null };
  creator: { noteId: string; name: string; image: string | null; followers: number; following: number; notes: number };
  stats: { storedArticles: number; identifiedLikes: number; comments: number; trackedFollowers: number; officialFollowers: number; officialFollowing: number; officialNotes: number };
  articles: Article[];
  notifications: Notification[];
  followers: Person[];
  topSupporters: Person[];
  topCommenters: Person[];
  watch: { initialized: boolean; lastWatchAt: string | null; error: string | null; cursor: number };
};

const panel = { border: "1px solid #263446", borderRadius: 20, background: "linear-gradient(180deg,#0f1722,#0a0f16)", boxShadow: "0 18px 55px rgba(0,0,0,.2)" } as const;

async function api(action: string, extra: Record<string, unknown> = {}) {
  const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
  if (!token) throw new Error("INSIGHT_LOGIN_REQUIRED");
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", "X-Insight-Token": token }, body: JSON.stringify({ action, ...extra }), cache: "no-store", signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "INSIGHT_API_ERROR");
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("INSIGHT_TIMEOUT");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function Avatar({ name, image }: { name: string; image?: string | null }) {
  return image ? <img src={image} alt="" referrerPolicy="no-referrer" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "1px solid #43627d" }} /> : <span style={{ width: 44, height: 44, borderRadius: "50%", display: "grid", placeItems: "center", background: "#192838", color: "#8feaff", fontWeight: 950 }}>{[...name][0] || "n"}</span>;
}

function PersonRow({ person, metric }: { person: Person; metric?: string }) {
  const name = person.name || person.actor_name || "noteユーザー";
  const url = person.url || person.actor_url || null;
  return <article style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1d2a39" }}>
    <Avatar name={name} image={person.image} />
    <div style={{ minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</strong>{url ? <a href={url} target="_blank" rel="noreferrer" style={{ color: "#6bcfff", fontSize: 11, textDecoration: "none" }}>noteを開く ↗</a> : null}</div>
    {metric ? <b style={{ color: "#b6ff38", fontSize: 13 }}>{metric}</b> : null}
  </article>;
}

export function MemberInsightApp() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"home" | "notifications" | "supporters" | "articles">("home");
  const initialSyncStarted = useRef(false);

  async function load(afterSync = false) {
    setError("");
    try {
      const payload = await api("dashboard");
      setData(payload as Dashboard);
      setLoading(false);
      if (!afterSync && !payload.watch?.initialized && !initialSyncStarted.current) {
        initialSyncStarted.current = true;
        setMessage("INSIGHTを表示しました。初回データはバックグラウンドで同期しています。");
        void sync(true);
      }
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "INSIGHT_API_ERROR";
      if (/LOGIN|SESSION|INACTIVE/.test(code)) {
        localStorage.removeItem(INSIGHT_TOKEN_KEY);
        window.location.hash = "access/insight";
        return;
      }
      setError(code === "INSIGHT_TIMEOUT" ? "読み込みが20秒を超えました。下のボタンでもう一度読み込めます。" : code);
    } finally { setLoading(false); }
  }

  async function sync(initial = false) {
    setSyncing(true); setError("");
    if (!initial) setMessage("");
    try {
      const result = await api("sync");
      const next = await api("dashboard");
      setData(next as Dashboard);
      setMessage(initial || result.baseline ? "初回データを保存しました。次回以降、新しい公開反応を差分で通知します。" : `更新完了。新しい公開反応 ${result.newNotifications ?? 0}件`);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "同期できませんでした。";
      setError(code === "INSIGHT_TIMEOUT" ? "同期が20秒を超えたため一度中断しました。画面はそのまま使えます。必要なら「今すぐ同期」で再実行してください。" : code);
      if (initial) setMessage("INSIGHT画面は利用できます。初回同期だけ完了していません。");
    } finally { setSyncing(false); }
  }

  async function markRead() {
    const unread = data?.notifications.filter(item => !item.is_read).map(item => item.id) ?? [];
    if (!unread.length) return;
    try { await api("mark-read", { ids: unread, read: true }); await load(true); } catch {}
  }

  async function refreshApp() {
    setMessage("アプリ更新を確認しています…");
    try {
      if ("caches" in window) for (const key of await caches.keys()) await caches.delete(key);
      if ("serviceWorker" in navigator) for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.update().catch(() => {});
    } catch { /* reload still applies */ }
    const url = new URL(window.location.href); url.searchParams.set("v", Date.now().toString(36)); url.hash = "dashboard"; window.location.replace(url.toString());
  }

  useEffect(() => {
    if (!localStorage.getItem(INSIGHT_TOKEN_KEY)) { window.location.hash = "access/insight"; return; }
    void load();
  }, []);

  const unread = useMemo(() => data?.notifications.filter(item => !item.is_read).length ?? 0, [data]);
  const topArticles = useMemo(() => [...(data?.articles ?? [])].sort((a,b) => (b.like_count + b.comment_count * 2) - (a.like_count + a.comment_count * 2)), [data]);

  if (loading || !data) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#070a0f", color: "#fff", padding: 24 }}><div style={{ width: "min(420px,100%)", textAlign: "center" }}><p>{error || "INSIGHTを読み込んでいます…"}</p>{error ? <button onClick={() => { setLoading(true); void load(); }} style={{ minHeight: 48, width: "100%", border: 0, borderRadius: 12, background: "#b6ff38", color: "#101600", fontWeight: 950 }}>もう一度読み込む</button> : null}</div></div>;

  return <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% -10%,#162333,#070a0f 36%)", color: "#f5f8fb", padding: "18px 12px 100px" }}><main style={{ width: "min(1000px,100%)", margin: "0 auto" }}>
    <header style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "10px 0 20px" }}>
      <Avatar name={data.creator.name} image={data.creator.image || data.member.imageUrl}/><div style={{ minWidth: 0 }}><small style={{ color: "#b6ff38", fontWeight: 950, letterSpacing: ".12em" }}>MY NOTE INSIGHT</small><h1 style={{ margin: "3px 0", fontSize: "clamp(24px,5vw,38px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.creator.name}</h1><a href={`https://note.com/${data.creator.noteId}`} target="_blank" rel="noreferrer" style={{ color: "#6acfff", textDecoration: "none", fontSize: 12 }}>@{data.creator.noteId} ↗</a></div><button onClick={() => void refreshApp()} style={{ minHeight: 42, border: "1px solid #35475c", borderRadius: 12, background: "#111a25", color: "#d9e6f2", padding: "0 12px", fontWeight: 900 }}>アプリ更新</button>
    </header>

    {message ? <div style={{ ...panel, padding: 13, marginBottom: 12, borderColor: "#426329", color: "#c9ff82" }}>{message}</div> : null}
    {error ? <div style={{ ...panel, padding: 13, marginBottom: 12, borderColor: "#743d48", color: "#ffabb6" }}>{error}</div> : null}

    <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
      {[['フォロワー',data.stats.officialFollowers],['記事',data.stats.officialNotes],['確認済スキ',data.stats.identifiedLikes],['コメント',data.stats.comments]].map(([label,value]) => <article key={String(label)} style={{ ...panel, padding: "14px 8px", textAlign: "center" }}><small style={{ color: "#7e91a7", fontSize: 10 }}>{label}</small><strong style={{ display: "block", marginTop: 4, fontSize: "clamp(20px,5vw,31px)" }}>{Number(value).toLocaleString()}</strong></article>)}
    </section>

    <section style={{ ...panel, padding: 16, marginBottom: 12, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center" }}><div><small style={{ color: "#8feaff", fontWeight: 950 }}>PUBLIC REACTION WATCH</small><strong style={{ display: "block", margin: "4px 0" }}>本人通知・公開反応</strong><p style={{ color: "#8fa0b4", margin: 0, fontSize: 12, lineHeight: 1.6 }}>スキ・コメント・フォローを本人専用領域へ保存。最終確認 {fmt(data.watch.lastWatchAt)} / 記事走査位置 {data.watch.cursor}</p></div><button disabled={syncing} onClick={() => void sync()} style={{ minHeight: 46, border: 0, borderRadius: 12, background: "#b6ff38", color: "#111600", padding: "0 16px", fontWeight: 950 }}>{syncing ? "同期中…" : "今すぐ同期"}</button></section>

    <nav style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 12 }}>{([['home','概要'],['notifications',`通知${unread ? ` ${unread}` : ''}`],['supporters','応援者'],['articles','記事']] as const).map(([key,label]) => <button key={key} onClick={() => { setTab(key); if (key === 'notifications') void markRead(); }} style={{ minHeight: 44, border: `1px solid ${tab===key?'#64dfff':'#29384b'}`, borderRadius: 11, background: tab===key?'#142839':'#0e151f', color: tab===key?'#dffbff':'#8ea0b4', fontWeight: 900 }}>{label}</button>)}</nav>

    {tab === "home" ? <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
      <article style={{ ...panel, padding: 18 }}><small style={{ color: "#b6ff38", fontWeight: 950 }}>TOP SUPPORTERS</small><h2 style={{ margin: "6px 0 8px" }}>応援者ランキング</h2>{data.topSupporters.slice(0,8).map((p,i) => <PersonRow key={p.key || i} person={p} metric={`${p.articles ?? 0}記事 / ${p.likes ?? 0}スキ`} />)}{!data.topSupporters.length ? <p style={{ color: "#7e8da1" }}>同期すると応援者データがここに蓄積されます。</p> : null}</article>
      <article style={{ ...panel, padding: 18 }}><small style={{ color: "#8feaff", fontWeight: 950 }}>RECENT REACTIONS</small><h2 style={{ margin: "6px 0 8px" }}>最近の反応</h2>{data.notifications.slice(0,8).map(item => <div key={item.id} style={{ padding: "10px 0", borderBottom: "1px solid #1d2a39" }}><strong style={{ display: "block", fontSize: 13 }}>{item.raw_text}</strong><small style={{ color: "#718298" }}>{fmt(item.occurred_at || item.captured_at)}</small></div>)}{!data.notifications.length ? <p style={{ color: "#7e8da1" }}>初回同期後、新しい公開反応をここへ通知します。</p> : null}</article>
      <article style={{ ...panel, padding: 18 }}><small style={{ color: "#ffcf69", fontWeight: 950 }}>ARTICLE PULSE</small><h2 style={{ margin: "6px 0 8px" }}>反応が強い記事</h2>{topArticles.slice(0,8).map(article => <a key={article.article_key} href={article.url} target="_blank" rel="noreferrer" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, padding: "10px 0", borderBottom: "1px solid #1d2a39", color: "#e8f1f8", textDecoration: "none" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{article.title}</span><b style={{ color: "#ffcf69" }}>♡{article.like_count} / 💬{article.comment_count}</b></a>)}</article>
      <article style={{ ...panel, padding: 18 }}><small style={{ color: "#cf9dff", fontWeight: 950 }}>FOLLOWERS</small><h2 style={{ margin: "6px 0 8px" }}>確認済みフォロワー</h2><strong style={{ fontSize: 34 }}>{data.stats.trackedFollowers.toLocaleString()}</strong><p style={{ color: "#8999ad", lineHeight: 1.7 }}>note公式表示は {data.stats.officialFollowers.toLocaleString()}人。公開一覧から確認できた人物をINSIGHT側へ順次保存します。</p>{data.followers.slice(0,5).map((p,i)=><PersonRow key={p.person_key || i} person={p}/>)}</article>
    </section> : null}

    {tab === "notifications" ? <section style={{ ...panel, padding: 18 }}><h2 style={{ marginTop: 0 }}>本人通知</h2><p style={{ color: "#8596aa", lineHeight: 1.7 }}>標準機能ではnoteの公開情報から確認できるスキ・コメント・フォローを扱います。購入・チップなどログイン本人だけに見える通知は、note側が公開取得手段を提供しないため別の拡張同期扱いです。</p>{data.notifications.map(item => <article key={item.id} style={{ padding: "13px 0", borderBottom: "1px solid #1d2a39", opacity: item.is_read ? .74 : 1 }}><small style={{ color: item.is_read?'#718298':'#b6ff38', fontWeight: 900 }}>{item.notification_type.toUpperCase()} · {fmt(item.occurred_at || item.captured_at)}</small><strong style={{ display: "block", marginTop: 4 }}>{item.raw_text}</strong>{item.target_url ? <a href={item.target_url} target="_blank" rel="noreferrer" style={{ color: "#6acfff", textDecoration: "none", fontSize: 12 }}>対象を開く ↗</a> : null}</article>)}</section> : null}

    {tab === "supporters" ? <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}><article style={{ ...panel, padding: 18 }}><h2 style={{ marginTop: 0 }}>応援者ランキング</h2>{data.topSupporters.map((p,i)=><PersonRow key={p.key || i} person={p} metric={`${p.articles ?? 0}記事 / ${p.likes ?? 0}スキ`}/>)}</article><article style={{ ...panel, padding: 18 }}><h2 style={{ marginTop: 0 }}>コメント参加</h2>{data.topCommenters.map((p,i)=><PersonRow key={p.key || i} person={p} metric={`${p.comments ?? 0}件`}/>)}</article></section> : null}

    {tab === "articles" ? <section style={{ ...panel, padding: 18 }}><h2 style={{ marginTop: 0 }}>記事別INSIGHT</h2>{data.articles.map(article => <a key={article.article_key} href={article.url} target="_blank" rel="noreferrer" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, padding: "13px 0", borderBottom: "1px solid #1d2a39", color: "#eff5fa", textDecoration: "none" }}><div style={{ minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{article.title}</strong><small style={{ color: "#718298" }}>{fmt(article.publish_at)}</small></div><b style={{ color: "#b6ff38" }}>♡ {article.like_count}　💬 {article.comment_count}</b></a>)}</section> : null}
  </main></div>;
}
