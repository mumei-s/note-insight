import { useEffect, useMemo, useState } from "react";

const ACCESS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
const OWNER_ACCESS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/unified-owner-access";
const OWNER_KEY = "mumei-unified-owner-token";

type Status = "pending" | "approved" | "active" | "rejected" | "revoked";
type Application = {
  id: string;
  noteId: string;
  displayName: string | null;
  imageUrl: string | null;
  status: Status;
  verificationCode?: string | null;
  approvedAt?: string | null;
  verifiedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const card = { border: "1px solid #29384b", borderRadius: 18, background: "linear-gradient(180deg,#101722,#0a1018)", padding: 18 } as const;
const button = { minHeight: 40, borderRadius: 10, padding: "0 12px", fontWeight: 950, cursor: "pointer" } as const;

async function ownerStatus() {
  const token = localStorage.getItem(OWNER_KEY) || "";
  if (!token) return false;
  const response = await fetch(OWNER_ACCESS, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Owner-Token": token },
    body: JSON.stringify({ action: "status" }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  return Boolean(response.ok && payload?.authenticated);
}

async function call(action: string, extra: Record<string, unknown> = {}) {
  const response = await fetch(ACCESS, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Owner-Token": localStorage.getItem(OWNER_KEY) || "" },
    body: JSON.stringify({ action, ...extra }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "OWNER_REQUEST_FAILED");
  return payload;
}

function fmt(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function Avatar({ app }: { app: Application }) {
  const name = app.displayName || app.noteId || "n";
  return app.imageUrl ? <img src={app.imageUrl} alt="" referrerPolicy="no-referrer" style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", border: "1px solid #43627d" }} /> : <span style={{ width: 50, height: 50, borderRadius: "50%", display: "grid", placeItems: "center", background: "#1a2939", color: "#8feaff", fontWeight: 950 }}>{[...name][0]}</span>;
}

const statusLabel: Record<Status, string> = { pending: "承認待ち", approved: "本人認証待ち", active: "利用中", rejected: "却下", revoked: "利用停止" };
const statusColor: Record<Status, string> = { pending: "#ffcf69", approved: "#8feaff", active: "#9cffae", rejected: "#ff9aa8", revoked: "#ff9aa8" };

export function ManagementPage() {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => ({
    pending: items.filter(x => x.status === "pending").length,
    approved: items.filter(x => x.status === "approved").length,
    active: items.filter(x => x.status === "active").length,
    inactive: items.filter(x => x.status === "rejected" || x.status === "revoked").length,
  }), [items]);

  async function load() {
    setError("");
    try {
      const payload = await call("owner-list");
      setItems(Array.isArray(payload.applications) ? payload.applications : []);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "OWNER_REQUEST_FAILED";
      if (code === "OWNER_LOGIN_REQUIRED") {
        localStorage.removeItem(OWNER_KEY);
        window.location.hash = "owner";
        return;
      }
      setError(code);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      try {
        const authenticated = await ownerStatus();
        if (!live) return;
        if (!authenticated) {
          localStorage.removeItem(OWNER_KEY);
          window.location.hash = "owner";
          return;
        }
        await load();
      } catch {
        if (!live) return;
        localStorage.removeItem(OWNER_KEY);
        window.location.hash = "owner";
      }
    })();
    return () => { live = false; };
  }, []);

  async function action(app: Application, actionName: "owner-approve" | "owner-reissue" | "owner-reject" | "owner-revoke") {
    if (actionName === "owner-reissue" && app.status === "active" && !window.confirm("パスコードを再発行すると、現在の全端末ログインを無効化し、本人認証をやり直します。続けますか？")) return;
    if (actionName === "owner-revoke" && !window.confirm(`${app.displayName || app.noteId} のINSIGHT利用を停止しますか？`)) return;
    setBusyId(app.id); setError(""); setMessage("");
    try {
      const payload = await call(actionName, { id: app.id });
      const next = payload.application as Application;
      setMessage(actionName === "owner-approve" ? `${next.displayName || next.noteId} を承認しました。本人確認コードを発行しました。` : actionName === "owner-reissue" ? "本人確認コードを再発行しました。旧セッションは無効です。" : actionName === "owner-reject" ? "申請を却下しました。" : "利用を停止しました。");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "変更できませんでした。"); }
    finally { setBusyId(null); }
  }

  async function copyCode(code: string) {
    try { await navigator.clipboard.writeText(code); setMessage("本人確認コードをコピーしました。"); }
    catch { setMessage(`本人確認コード: ${code}`); }
  }

  async function logout() {
    const token = localStorage.getItem(OWNER_KEY) || "";
    try {
      await fetch(OWNER_ACCESS, { method: "POST", headers: { "Content-Type": "application/json", "X-Owner-Token": token }, body: JSON.stringify({ action: "logout" }), cache: "no-store" });
    } catch { /* local logout still proceeds */ }
    localStorage.removeItem(OWNER_KEY);
    sessionStorage.removeItem("mumei-owner-insight-view");
    window.location.hash = "owner";
  }

  return <div style={{ minHeight: "100vh", background: "#070a0f", color: "#f5f8fb", padding: "22px 13px 70px" }}><main style={{ width: "min(1080px,100%)", margin: "0 auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}><a href="#owner-insight" style={{ color: "#8feaff", textDecoration: "none", fontWeight: 950 }}>← OWNER INSIGHTへ戻る</a><button onClick={() => void logout()} style={{ ...button, border: "1px solid #3a4658", background: "transparent", color: "#a9b6c7" }}>管理ログアウト</button></div>

    <header style={{ padding: "42px 0 20px" }}><small style={{ color: "#ffcf69", fontWeight: 950, letterSpacing: ".14em" }}>INSIGHT SALES ADMIN / OWNER ONLY</small><h1 style={{ fontSize: "clamp(38px,7vw,62px)", margin: "7px 0" }}>INSIGHT 管理ページ</h1><p style={{ color: "#94a3b7", lineHeight: 1.75, maxWidth: 760 }}>ここはOWNER専用です。参加者INSIGHTから管理ページへの導線はありません。購入者の参加申請・承認・本人認証状態・利用停止だけを管理します。</p></header>

    {message ? <div style={{ ...card, marginBottom: 12, borderColor: "#426329", color: "#c8ff84" }}>{message}</div> : null}
    {error ? <div style={{ ...card, marginBottom: 12, borderColor: "#773f4a", color: "#ffadb8" }}>{error}</div> : null}

    <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginBottom: 14 }}>
      {[["承認待ち", counts.pending, "#ffcf69"],["本人認証待ち", counts.approved, "#8feaff"],["利用中", counts.active, "#9cffae"],["停止・却下", counts.inactive, "#ff9aa8"]].map(([label,n,color]) => <article key={String(label)} style={{ ...card, padding: "14px 8px", textAlign: "center" }}><small style={{ color: String(color), fontWeight: 900 }}>{label}</small><strong style={{ display: "block", fontSize: 30, marginTop: 3 }}>{Number(n)}</strong></article>)}
    </section>

    <section style={{ ...card, padding: 14, marginBottom: 14, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}><div><strong>販売用固定URL</strong><div style={{ color: "#8da0b5", fontSize: 12, marginTop: 3 }}>https://mumei-s.github.io/note-insight/</div></div><button onClick={() => void load()} style={{ ...button, border: "1px solid #395068", background: "#111c29", color: "#8feaff" }}>申請一覧を更新</button></section>

    {loading ? <section style={card}>OWNERセッションと申請一覧を確認しています…</section> : <section style={{ display: "grid", gap: 10 }}>
      {items.map(app => <article key={app.id} style={{ ...card, padding: 15, display: "grid", gridTemplateColumns: "50px minmax(0,1fr) auto", gap: 12, alignItems: "center", borderColor: app.status === "pending" ? "#5a4d2c" : app.status === "approved" ? "#31576a" : app.status === "active" ? "#315b3b" : "#493139" }}>
        <Avatar app={app}/><div style={{ minWidth: 0 }}><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong style={{ fontSize: 17 }}>{app.displayName || `@${app.noteId}`}</strong><span style={{ color: statusColor[app.status], fontSize: 11, fontWeight: 950 }}>{statusLabel[app.status]}</span></div><a href={`https://note.com/${app.noteId}`} target="_blank" rel="noreferrer" style={{ color: "#69ccff", textDecoration: "none", fontSize: 12 }}>@{app.noteId} ↗</a><div style={{ color: "#718399", fontSize: 11, marginTop: 5 }}>申請 {fmt(app.createdAt)}　承認 {fmt(app.approvedAt)}　本人認証 {fmt(app.verifiedAt)}</div>{app.status === "approved" && app.verificationCode ? <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 9, background: "#05090e", color: "#b6ff38", fontFamily: "monospace", fontWeight: 950, overflowWrap: "anywhere" }}>{app.verificationCode} <button onClick={() => void copyCode(app.verificationCode!)} style={{ marginLeft: 7, border: 0, borderRadius: 7, background: "#183044", color: "#9fe9ff", padding: "5px 8px", fontWeight: 900 }}>コピー</button></div> : null}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 240 }}>
          {app.status === "pending" || app.status === "rejected" || app.status === "revoked" ? <button disabled={busyId === app.id} onClick={() => void action(app, "owner-approve")} style={{ ...button, border: 0, background: "#b6ff38", color: "#111600" }}>承認</button> : null}
          {app.status === "approved" || app.status === "active" ? <button disabled={busyId === app.id} onClick={() => void action(app, "owner-reissue")} style={{ ...button, border: "1px solid #38566f", background: "#101d2a", color: "#8feaff" }}>コード再発行</button> : null}
          {app.status === "pending" ? <button disabled={busyId === app.id} onClick={() => void action(app, "owner-reject")} style={{ ...button, border: "1px solid #69404a", background: "transparent", color: "#ffabb5" }}>却下</button> : null}
          {app.status === "approved" || app.status === "active" ? <button disabled={busyId === app.id} onClick={() => void action(app, "owner-revoke")} style={{ ...button, border: "1px solid #69404a", background: "transparent", color: "#ffabb5" }}>利用停止</button> : null}
        </div>
      </article>)}
      {!items.length ? <article style={card}><strong>現在、参加申請はありません。</strong><p style={{ color: "#8999ad", marginBottom: 0 }}>購入者が固定URLから申請すると、ここに表示されます。</p></article> : null}
    </section>}
  </main>
  <style>{`@media(max-width:650px){main>section:nth-of-type(1){grid-template-columns:repeat(2,minmax(0,1fr))!important}}`}</style>
  </div>;
}
