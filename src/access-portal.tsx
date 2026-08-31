import { FormEvent, useEffect, useState } from "react";

const ACCESS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
export const INSIGHT_TOKEN_KEY = "mumei-insight-access-token";
const APPLICANT_KEY = "mumei-insight-applicant-token";
const PASSCODE_KEY = "mumei-insight-passcode";
const OWNER_VIEW_KEY = "mumei-owner-insight-view";

type Application = {
  id: string;
  noteId: string;
  displayName: string | null;
  imageUrl: string | null;
  status: "pending" | "approved" | "active" | "rejected" | "revoked";
  verificationCode?: string | null;
  approvedAt?: string | null;
  verifiedAt?: string | null;
};

type Stage = "loading" | "apply" | "pending" | "approved" | "login" | "active";
const box = { border: "1px solid #273244", borderRadius: 20, background: "#0e151f", padding: 22 } as const;
const input = { width: "100%", boxSizing: "border-box" as const, minHeight: 50, borderRadius: 12, border: "1px solid #344257", background: "#080c12", color: "#fff", padding: "0 14px", fontSize: 16 };
const btn = { width: "100%", minHeight: 50, border: 0, borderRadius: 12, background: "#b6ff38", color: "#101600", fontWeight: 950, cursor: "pointer" } as const;

function errorText(code: string) {
  const messages: Record<string, string> = {
    NOTE_ID_INVALID: "note IDまたはクリエイターページURLを確認してください。",
    NOTE_ACCOUNT_NOT_FOUND: "そのnoteクリエイターを確認できませんでした。",
    APPLICATION_EXISTS: "このnote IDはすでに申請済みです。申請したブラウザで承認状態を確認してください。",
    ALREADY_ACTIVE: "このnote IDは参加済みです。『参加済みアカウントでログイン』を使ってください。",
    PROFILE_CODE_NOT_FOUND: "自己紹介欄に認証コードがまだ確認できません。コードを入れて保存してから、もう一度押してください。",
    LOGIN_INVALID: "note IDまたはパスコードが違います。",
    INSIGHT_SESSION_INVALID: "この端末のINSIGHTログイン期限が切れました。パスコードでログインし直してください。",
    INSIGHT_MEMBER_INACTIVE: "この参加権は現在利用できません。",
  };
  return messages[code] ?? code ?? "処理できませんでした。";
}

async function call(action: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const response = await fetch(ACCESS, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ action, ...extra }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "ACCESS_ERROR");
  return payload;
}

function Identity({ app }: { app: Application }) {
  return <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "14px 0" }}>
    {app.imageUrl ? <img src={app.imageUrl} alt="" referrerPolicy="no-referrer" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover" }} /> : <span style={{ width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", background: "#1b2939", color: "#b6ff38", fontWeight: 950 }}>{[...(app.displayName || app.noteId || "n")][0]}</span>}
    <div><strong style={{ display: "block", fontSize: 18 }}>{app.displayName || `@${app.noteId}`}</strong><small style={{ color: "#8492a5" }}>@{app.noteId}</small></div>
  </div>;
}

export function AccessPortal({ target: _target }: { target?: "insight" | "catalog" }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [application, setApplication] = useState<Application | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function goDashboard() {
    sessionStorage.removeItem(OWNER_VIEW_KEY);
    window.location.hash = "dashboard";
  }

  async function checkExisting() {
    sessionStorage.removeItem(OWNER_VIEW_KEY);
    const member = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
    if (member) {
      try {
        const p = await call("session", {}, { "X-Insight-Token": member });
        setApplication(p.application); setStage("active"); return;
      } catch { localStorage.removeItem(INSIGHT_TOKEN_KEY); }
    }
    const applicant = localStorage.getItem(APPLICANT_KEY) || "";
    if (applicant) {
      try {
        const p = await call("application-status", {}, { "X-Insight-Applicant": applicant });
        const app = p.application as Application;
        setApplication(app);
        if (app.verificationCode) {
          localStorage.setItem(PASSCODE_KEY, app.verificationCode);
          setPasscode(app.verificationCode);
        }
        if (app.status === "approved") setStage("approved");
        else if (app.status === "pending") setStage("pending");
        else if (app.status === "active") setStage("login");
        else setStage("apply");
        return;
      } catch { localStorage.removeItem(APPLICANT_KEY); }
    }
    setStage("apply");
  }

  useEffect(() => { void checkExisting(); }, []);

  async function apply(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const p = await call("apply", { noteInput });
      localStorage.setItem(APPLICANT_KEY, p.applicantToken);
      setApplication(p.application); setNoteInput(""); setStage("pending");
      setMessage("参加申請を送信しました。OWNERの承認後、この画面に本人確認コードが表示されます。");
    } catch (e) { setError(errorText(e instanceof Error ? e.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function refreshStatus() {
    const applicant = localStorage.getItem(APPLICANT_KEY) || "";
    if (!applicant) { setStage("apply"); return; }
    setSaving(true); setError("");
    try {
      const p = await call("application-status", {}, { "X-Insight-Applicant": applicant });
      const app = p.application as Application; setApplication(app);
      if (app.verificationCode) {
        localStorage.setItem(PASSCODE_KEY, app.verificationCode);
        setPasscode(app.verificationCode);
      }
      if (app.status === "approved") setStage("approved");
      else if (app.status === "pending") setStage("pending");
      else if (app.status === "active") setStage("login");
      else setStage("apply");
    } catch (e) { setError(errorText(e instanceof Error ? e.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function verifyProfile() {
    const applicant = localStorage.getItem(APPLICANT_KEY) || "";
    setSaving(true); setError(""); setMessage("");
    try {
      const p = await call("verify-profile", {}, { "X-Insight-Applicant": applicant });
      localStorage.setItem(INSIGHT_TOKEN_KEY, p.memberToken);
      setApplication(p.application); setStage("active");
      setMessage("本人確認が完了しました。noteの自己紹介欄は元に戻して大丈夫です。パスコードは別端末ログイン用に保管してください。");
    } catch (e) { setError(errorText(e instanceof Error ? e.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function login(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const p = await call("login", { noteInput, passcode });
      localStorage.setItem(INSIGHT_TOKEN_KEY, p.memberToken);
      localStorage.setItem(PASSCODE_KEY, passcode);
      setApplication(p.application); setStage("active");
      setMessage("このブラウザでは、このnoteアカウントのINSIGHTを利用します。");
    } catch (e) { setError(errorText(e instanceof Error ? e.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function switchAccount() {
    const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
    try { if (token) await call("logout", {}, { "X-Insight-Token": token }); } catch { /* local logout still proceeds */ }
    localStorage.removeItem(INSIGHT_TOKEN_KEY);
    localStorage.removeItem(APPLICANT_KEY);
    localStorage.removeItem(PASSCODE_KEY);
    sessionStorage.removeItem(OWNER_VIEW_KEY);
    setApplication(null); setNoteInput(""); setPasscode(""); setError(""); setMessage(""); setStage("login");
  }

  async function refreshApp() {
    try {
      if ("caches" in window) await Promise.all((await caches.keys()).filter(k => k.startsWith("mumei-note-insight")).map(k => caches.delete(k)));
      if ("serviceWorker" in navigator) await Promise.all((await navigator.serviceWorker.getRegistrations()).filter(r => r.scope.startsWith(location.origin)).map(r => r.unregister()));
    } finally {
      const u = new URL(location.href); u.searchParams.set("refresh", String(Date.now())); u.hash = "access/insight"; location.replace(u.toString());
    }
  }

  const code = application?.verificationCode || passcode;
  return <div style={{ minHeight: "100vh", background: "#070a0f", color: "#f6f8fb", padding: "24px 14px 70px" }}><main style={{ width: "min(720px,100%)", margin: "0 auto" }}>
    <a href="#" style={{ color: "#b6ff38", textDecoration: "none", fontWeight: 900 }}>← INSIGHT TOP</a>
    <header style={{ padding: "46px 0 20px" }}><small style={{ color: "#b6ff38", fontWeight: 950, letterSpacing: ".14em" }}>PAID MEMBER ACCESS</small><h1 style={{ fontSize: "clamp(38px,8vw,58px)", margin: "8px 0" }}>INSIGHT 参加・本人認証</h1><p style={{ color: "#9ba8bb", lineHeight: 1.75 }}>購入後の参加申請から本人確認まで、このページで進めます。参加者画面からOWNER管理ページへは移動できません。</p></header>
    {error ? <section style={{ ...box, borderColor: "#713b45", color: "#ffb0b8", marginBottom: 12 }}>{error}</section> : null}
    {message ? <section style={{ ...box, borderColor: "#41652a", color: "#b6ff38", marginBottom: 12 }}>{message}</section> : null}
    {stage === "loading" ? <section style={box}>参加状態を確認しています…</section> : null}

    {stage === "apply" ? <div style={{ display: "grid", gap: 12 }}>
      <form onSubmit={apply} style={box}><h2 style={{ marginTop: 0 }}>1. 参加申請</h2><p style={{ color: "#9ba8bb", lineHeight: 1.7 }}>購入者本人のnote IDまたはクリエイターページURLを入力してください。申請はOWNER専用管理ページへ届きます。</p><input style={input} value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="note ID または https://note.com/..." autoComplete="off" required /><button style={{ ...btn, marginTop: 12 }} disabled={saving}>{saving ? "申請中…" : "参加申請を送る"}</button></form>
      <button style={{ ...btn, background: "#172434", color: "#a9e9ff", border: "1px solid #3b546d" }} onClick={() => setStage("login")}>参加済みアカウントでログイン</button>
    </div> : null}

    {stage === "pending" && application ? <section style={box}><small style={{ color: "#ffcf5a", fontWeight: 950 }}>OWNER APPROVAL</small><h2>承認待ち</h2><Identity app={application}/><p style={{ color: "#9ba8bb", lineHeight: 1.7 }}>OWNERが購入者として承認すると、本人確認用パスコードが発行されます。</p><button style={btn} disabled={saving} onClick={() => void refreshStatus()}>{saving ? "確認中…" : "承認状態を更新"}</button></section> : null}

    {stage === "approved" && application ? <section style={{ ...box, borderColor: "#536d2a" }}><small style={{ color: "#b6ff38", fontWeight: 950 }}>APPROVED / PROFILE CHECK</small><h2>2. note自己紹介欄で本人確認</h2><Identity app={application}/><p style={{ color: "#9ba8bb", lineHeight: 1.75 }}>下のコードをコピーし、noteの<strong style={{ color: "#fff" }}>クリエイターページTOP → 設定 → 名前の下の自己紹介欄</strong>へ一時的に入れて保存してください。</p><code style={{ display: "block", padding: 16, borderRadius: 12, background: "#05080c", color: "#b6ff38", fontSize: 22, fontWeight: 950, letterSpacing: ".05em", overflowWrap: "anywhere" }}>{code}</code><div style={{ display: "grid", gap: 9, marginTop: 12 }}><button style={{ ...btn, background: "#172434", color: "#8feaff", border: "1px solid #35536d" }} onClick={() => { if (code) void navigator.clipboard?.writeText(code); }}>コードをコピー</button><a href={`https://note.com/${application.noteId}`} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: "none", background: "#172434", color: "#8feaff", border: "1px solid #35536d", boxSizing: "border-box" }}>申請したnoteプロフィールを開く ↗</a><button style={btn} disabled={saving} onClick={() => void verifyProfile()}>{saving ? "本人確認中…" : "保存したのでINSIGHTで認証"}</button></div><p style={{ color: "#ffcf5a", lineHeight: 1.7, marginBottom: 0 }}>重要：note.com側で別アカウントにログイン中でも、INSIGHTからnoteのログイン状態は変更できません。自己紹介を編集する前に、申請した @{application.noteId} でログイン中か確認してください。認証成功後はコードを削除して元の自己紹介へ戻してOKです。</p></section> : null}

    {stage === "login" ? <form onSubmit={login} style={box}><h2 style={{ marginTop: 0 }}>参加済みアカウントでログイン</h2><p style={{ color: "#9ba8bb", lineHeight: 1.7 }}>初回本人確認で発行されたnote ID＋パスコードを使います。INSIGHTのログインはnote.comのログインCookieとは別管理です。</p><input style={input} value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="note ID" required /><input style={{ ...input, marginTop: 9 }} value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="INSIGHT-XXXXXXXX" autoComplete="current-password" required /><button style={{ ...btn, marginTop: 12 }} disabled={saving}>{saving ? "確認中…" : "INSIGHTへログイン"}</button><button type="button" style={{ ...btn, marginTop: 9, background: "transparent", color: "#9eb0c3", border: "1px solid #344257" }} onClick={() => setStage("apply")}>新しく参加申請する</button></form> : null}

    {stage === "active" ? <section style={{ ...box, borderColor: "#397043" }}><small style={{ color: "#88ffad", fontWeight: 950 }}>ACCESS ACTIVE</small><h2>INSIGHT利用可能</h2>{application ? <Identity app={application}/> : null}<p style={{ color: "#9ba8bb", lineHeight: 1.7 }}>{message || "このブラウザは参加者として認証済みです。"}</p><div style={{ display: "grid", gap: 9 }}><button style={btn} onClick={goDashboard}>INSIGHTを開く →</button><button style={{ ...btn, background: "#172434", color: "#a9e9ff", border: "1px solid #3b546d" }} disabled={saving} onClick={() => void switchAccount()}>別のnoteアカウントでログイン</button><button style={{ ...btn, background: "transparent", color: "#9eb0c3", border: "1px solid #344257" }} onClick={() => void refreshApp()}>アプリを最新版に更新</button></div></section> : null}
  </main></div>;
}
