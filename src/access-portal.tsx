import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  APPLICANT_KEY,
  INSIGHT_TOKEN_KEY,
  PASSCODE_KEY,
  activateStoredInsightAccount,
  consumeAccessIntent,
  currentStoredInsightAccount,
  forgetMemberSession,
  readStoredInsightAccounts,
  rememberApplicant,
  rememberApplication,
  rememberMemberSession,
} from "./insight-account-store";
import type { StoredInsightAccount } from "./insight-account-store";
import "./access-portal-v2.css";

export { INSIGHT_TOKEN_KEY } from "./insight-account-store";

const ACCESS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
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

function errorText(code: string) {
  const messages: Record<string, string> = {
    NOTE_ID_INVALID: "note IDまたはクリエイターページURLを確認してください。",
    NOTE_ACCOUNT_NOT_FOUND: "そのnoteクリエイターを確認できませんでした。",
    APPLICATION_EXISTS: "このnote IDは申請済みです。保存済みアカウントから続きへ戻れます。",
    ALREADY_ACTIVE: "このnote IDは参加中です。ログイン画面から切り替えてください。",
    PROFILE_CODE_NOT_FOUND: "自己紹介欄に認証コードがまだ確認できません。保存後にもう一度押してください。",
    LOGIN_INVALID: "note IDまたはパスコードが違います。",
    INSIGHT_SESSION_INVALID: "このINSIGHTログインは失効しています。再ログインしてください。",
    INSIGHT_MEMBER_INACTIVE: "この参加権は現在利用できません。",
    LOGIN_FIELDS_REQUIRED: "note IDとパスコードを入力してください。",
  };
  return messages[code] ?? code ?? "処理できませんでした。";
}

function authFailure(code: string) {
  return /INSIGHT_SESSION_INVALID|INSIGHT_MEMBER_INACTIVE|INSIGHT_LOGIN_REQUIRED/.test(code);
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

function Identity({ app }: { app: Pick<Application, "noteId" | "displayName" | "imageUrl"> }) {
  return <div className="access2-identity">
    {app.imageUrl ? <img src={app.imageUrl} alt="" referrerPolicy="no-referrer" /> : <span className="access2-avatar">{[...(app.displayName || app.noteId || "n")][0]}</span>}
    <div><strong>{app.displayName || `@${app.noteId}`}</strong><small>@{app.noteId}</small></div>
  </div>;
}

function SavedAccounts({ accounts, onUse }: { accounts: StoredInsightAccount[]; onUse: (account: StoredInsightAccount) => void }) {
  if (!accounts.length) return null;
  return <div className="access2-saved">{accounts.map((account) => <button type="button" className="access2-account" key={account.noteId} onClick={() => onUse(account)}>
    {account.imageUrl ? <img src={account.imageUrl} alt="" referrerPolicy="no-referrer" /> : <span>{[...(account.displayName || account.noteId)][0]}</span>}
    <span><b>{account.displayName || `@${account.noteId}`}</b><small>@{account.noteId}</small></span>
    <em>{account.memberToken ? "切替" : account.applicantToken ? "続き" : "ログイン"}</em>
  </button>)}</div>;
}

export function AccessPortal({ target: _target }: { target?: "insight" | "catalog" }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [application, setApplication] = useState<Application | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [accountsVersion, setAccountsVersion] = useState(0);
  const accounts = useMemo(() => readStoredInsightAccounts(), [accountsVersion]);

  function refreshAccounts() { setAccountsVersion((value) => value + 1); }
  function goDashboard() { sessionStorage.removeItem(OWNER_VIEW_KEY); window.location.hash = "dashboard"; }

  async function openSaved(account: StoredInsightAccount) {
    setSaving(true); setError(""); setMessage("");
    activateStoredInsightAccount(account.noteId);
    setNoteInput(account.noteId); setPasscode(account.passcode || "");
    try {
      if (account.memberToken) {
        const p = await call("session", {}, { "X-Insight-Token": account.memberToken });
        rememberMemberSession(p.application, account.memberToken, account.passcode);
        setApplication(p.application); setStage("active");
        setMessage(`@${p.application.noteId} に切り替えました。ほかの保存済みアカウントのログインは維持されています。`);
      } else if (account.applicantToken) {
        const p = await call("application-status", {}, { "X-Insight-Applicant": account.applicantToken });
        const app = p.application as Application;
        rememberApplication(app, app.verificationCode || account.passcode);
        setApplication(app);
        if (app.verificationCode) setPasscode(app.verificationCode);
        if (app.status === "approved") setStage("approved");
        else if (app.status === "pending") setStage("pending");
        else if (app.status === "active") setStage("login");
        else setStage("apply");
      } else setStage("login");
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "ACCESS_ERROR";
      if (account.memberToken && authFailure(code)) forgetMemberSession(account.noteId);
      setError(authFailure(code) ? errorText(code) : "通信確認に失敗しました。保存済みログイン情報は消していません。もう一度お試しください。");
      setStage("login");
    } finally { refreshAccounts(); setSaving(false); }
  }

  async function checkExisting() {
    sessionStorage.removeItem(OWNER_VIEW_KEY);
    const intent = consumeAccessIntent();
    if (intent === "apply") { setStage("apply"); return; }
    if (intent === "login" || intent === "switch") { setStage("login"); return; }

    const member = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
    if (member) {
      try {
        const p = await call("session", {}, { "X-Insight-Token": member });
        rememberMemberSession(p.application, member, currentStoredInsightAccount()?.passcode);
        setApplication(p.application); setStage("active"); refreshAccounts(); return;
      } catch (reason) {
        const code = reason instanceof Error ? reason.message : "ACCESS_ERROR";
        const stored = readStoredInsightAccounts().find((item) => item.memberToken === member);
        if (authFailure(code)) {
          if (stored) forgetMemberSession(stored.noteId); else localStorage.removeItem(INSIGHT_TOKEN_KEY);
        } else if (stored) {
          setApplication({ id: stored.noteId, noteId: stored.noteId, displayName: stored.displayName, imageUrl: stored.imageUrl, status: "active" });
          setStage("active"); setMessage("通信確認ができませんでしたが、長期ログイン情報は保持しています。"); return;
        }
      }
    }

    const applicant = localStorage.getItem(APPLICANT_KEY) || "";
    if (applicant) {
      try {
        const p = await call("application-status", {}, { "X-Insight-Applicant": applicant });
        const app = p.application as Application;
        setApplication(app); rememberApplication(app, app.verificationCode || undefined);
        if (app.verificationCode) setPasscode(app.verificationCode);
        if (app.status === "approved") setStage("approved");
        else if (app.status === "pending") setStage("pending");
        else if (app.status === "active") setStage("login");
        else setStage("apply");
        refreshAccounts(); return;
      } catch { /* Keep stored applicant account instead of deleting it on a transient failure. */ }
    }
    setStage(accounts.length ? "login" : "apply");
  }

  useEffect(() => { void checkExisting(); }, []);
  useEffect(() => {
    const refresh = () => refreshAccounts();
    window.addEventListener("mumei-insight-accounts", refresh);
    return () => window.removeEventListener("mumei-insight-accounts", refresh);
  }, []);

  async function apply(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const p = await call("apply", { noteInput });
      rememberApplicant(p.application, p.applicantToken);
      setApplication(p.application); setNoteInput(""); setStage("pending"); refreshAccounts();
      setMessage("参加申請を送信しました。OWNER承認後、この画面から本人確認へ進めます。");
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function refreshStatus() {
    const applicant = localStorage.getItem(APPLICANT_KEY) || "";
    if (!applicant) { setStage("apply"); return; }
    setSaving(true); setError("");
    try {
      const p = await call("application-status", {}, { "X-Insight-Applicant": applicant });
      const app = p.application as Application; setApplication(app);
      rememberApplication(app, app.verificationCode || undefined);
      if (app.verificationCode) setPasscode(app.verificationCode);
      if (app.status === "approved") setStage("approved");
      else if (app.status === "pending") setStage("pending");
      else if (app.status === "active") setStage("login");
      else setStage("apply");
      refreshAccounts();
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function verifyProfile() {
    const applicant = localStorage.getItem(APPLICANT_KEY) || "";
    const savedCode = passcode || localStorage.getItem(PASSCODE_KEY) || "";
    setSaving(true); setError(""); setMessage("");
    try {
      const p = await call("verify-profile", {}, { "X-Insight-Applicant": applicant });
      rememberMemberSession(p.application, p.memberToken, savedCode);
      setApplication(p.application); setStage("active"); refreshAccounts();
      setMessage("本人確認が完了しました。自己紹介欄は元に戻して大丈夫です。この端末のログインは長期保持されます。");
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function login(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const p = await call("login", { noteInput, passcode });
      rememberMemberSession(p.application, p.memberToken, passcode);
      setApplication(p.application); setStage("active"); refreshAccounts();
      setMessage(`@${p.application.noteId} へ切り替えました。ほかの保存済みアカウントはログアウトしていません。`);
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  function switchAccount() {
    setError(""); setMessage(""); setNoteInput(""); setPasscode(""); setStage("login");
  }

  async function refreshApp() {
    try {
      if ("caches" in window) await Promise.all((await caches.keys()).filter((key) => key.startsWith("mumei-note-insight")).map((key) => caches.delete(key)));
      if ("serviceWorker" in navigator) await Promise.all((await navigator.serviceWorker.getRegistrations()).filter((registration) => registration.scope.startsWith(location.origin)).map((registration) => registration.unregister()));
    } finally {
      const url = new URL(location.href); url.searchParams.set("refresh", String(Date.now())); url.hash = "access/insight"; location.replace(url.toString());
    }
  }

  const code = application?.verificationCode || passcode;
  return <div className="access2"><main className="access2-main">
    <a href="#" className="access2-back">← TOP</a>
    <header className="access2-head"><small>MEMBER ACCESS</small><h1>INSIGHT 参加・ログイン</h1><p>参加申請、本人確認、ログイン、保存済みアカウントの切り替えをここで行います。note.comのログインCookieとは別に管理します。</p></header>
    {error ? <div className="access2-alert">{error}</div> : null}
    {message ? <div className="access2-message">{message}</div> : null}
    {stage === "loading" ? <section className="access2-card">参加状態を確認しています…</section> : null}

    {stage === "apply" ? <section className="access2-card"><h2>参加申請</h2><p>参加するnote IDまたはクリエイターページURLを入力してください。申請はOWNER専用管理ページへ届きます。</p><form onSubmit={apply}><input className="access2-input" value={noteInput} onChange={(event) => setNoteInput(event.target.value)} placeholder="note ID または https://note.com/..." autoComplete="off" required /><div className="access2-actions"><button className="access2-btn" disabled={saving}>{saving ? "申請中…" : "参加申請を送る"}</button><button type="button" className="access2-btn secondary" onClick={() => setStage("login")}>ログイン / アカウント切替</button></div></form></section> : null}

    {stage === "pending" && application ? <section className="access2-card"><small className="access2-note">OWNER APPROVAL</small><h2>承認待ち</h2><Identity app={application} /><p>OWNERの承認後、本人確認用コードが表示されます。別アカウントへ切り替えても、この申請の続きは端末に保存されます。</p><div className="access2-actions"><button className="access2-btn" disabled={saving} onClick={() => void refreshStatus()}>{saving ? "確認中…" : "承認状態を更新"}</button><button className="access2-btn secondary" onClick={switchAccount}>別アカウントへ切替</button></div></section> : null}

    {stage === "approved" && application ? <section className="access2-card"><small className="access2-note">PROFILE CHECK</small><h2>note自己紹介欄で本人確認</h2><Identity app={application} /><p>下のコードを一時的にnoteの自己紹介欄へ入れて保存してください。認証後は削除して元へ戻せます。</p><code className="access2-code">{code}</code><div className="access2-actions"><button className="access2-btn secondary" onClick={() => { if (code) void navigator.clipboard?.writeText(code); }}>コードをコピー</button><a className="access2-btn secondary" href={`https://note.com/${application.noteId}`} target="_blank" rel="noreferrer" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>申請したnoteプロフィールを開く ↗</a><button className="access2-btn" disabled={saving} onClick={() => void verifyProfile()}>{saving ? "本人確認中…" : "保存したのでINSIGHTで認証"}</button><button className="access2-btn ghost" onClick={switchAccount}>別アカウントへ切替</button></div><p className="access2-note">自己紹介を編集する時だけ、申請した @{application.noteId} のnoteアカウントでログイン中か確認してください。</p></section> : null}

    {stage === "login" ? <section className="access2-card"><h2>ログイン / アカウント切替</h2><p>保存済みアカウントはワンタップで切り替えます。切替元をログアウトしないので、途中の申請・本人確認も保持されます。</p><SavedAccounts accounts={accounts} onUse={(account) => void openSaved(account)} /><form onSubmit={login}><input className="access2-input" value={noteInput} onChange={(event) => setNoteInput(event.target.value)} placeholder="note ID" required /><input className="access2-input" value={passcode} onChange={(event) => setPasscode(event.target.value)} placeholder="INSIGHT-XXXXXXXX" autoComplete="current-password" required /><div className="access2-actions"><button className="access2-btn" disabled={saving}>{saving ? "確認中…" : "INSIGHTへログイン"}</button><button type="button" className="access2-btn secondary" onClick={() => setStage("apply")}>新しく参加申請する</button></div></form></section> : null}

    {stage === "active" ? <section className="access2-card access2-active"><small>ACCESS ACTIVE</small><h2>INSIGHT利用可能</h2>{application ? <Identity app={application} /> : null}<p>{message || "この端末は参加者として認証済みです。利用のたびに有効期限を延長し、可能な限りログイン状態を保持します。"}</p><div className="access2-actions"><button className="access2-btn" onClick={goDashboard}>INSIGHTを開く →</button><button className="access2-btn secondary" onClick={switchAccount}>ログイン / アカウント切替</button><button className="access2-btn ghost" onClick={() => void refreshApp()}>アプリを最新版に更新</button></div></section> : null}
  </main></div>;
}
