import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  INSIGHT_TOKEN_KEY,
  activateStoredInsightAccount,
  consumeAccessIntent,
  forgetMemberSession,
  getStoredInsightAccount,
  readStoredInsightAccounts,
  rememberApplicant,
  rememberApplication,
  rememberMemberSession,
} from "./insight-account-store";
import type { StoredInsightAccount } from "./insight-account-store";
import "./access-portal-v2.css";

const ACCESS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
const REACTIVATE = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access-reactivate";
const RECOVERY = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-recovery";
const OWNER_VIEW_KEY = "mumei-owner-insight-view";
const JOIN_NOTE_KEY = "mumei-insight-current-join-v5";
const RECOVERY_TOKEN_KEY = "mumei-insight-recovery-token-v1";

type Application = {
  id: string;
  noteId: string;
  displayName: string | null;
  imageUrl: string | null;
  status: "pending" | "approved" | "active" | "rejected" | "revoked";
  verificationCode?: string | null;
  verifiedAt?: string | null;
};
type Stage = "loading" | "accounts" | "apply" | "pending" | "approved" | "recovery" | "recovery-check";

function errorText(code: string) {
  const messages: Record<string, string> = {
    NOTE_ID_INVALID: "note IDまたはクリエイターページURLを確認してください。",
    NOTE_ACCOUNT_NOT_FOUND: "そのnoteクリエイターを確認できませんでした。",
    APPLICATION_EXISTS: "このnote IDはすでに申請されています。",
    ALREADY_ACTIVE: "このnote IDはすでに参加済みです。再ログインから本人確認してください。",
    PROFILE_CODE_NOT_FOUND: "自己紹介欄に確認コードがまだ見つかりません。保存後にもう一度押してください。",
    INSIGHT_SESSION_INVALID: "この端末の保存済みログインは失効しています。再ログインしてください。",
    INSIGHT_MEMBER_INACTIVE: "この参加権は現在利用できません。",
    INSIGHT_MEMBER_NOT_ACTIVE: "このnote IDは参加済みアカウントとして確認できません。",
    RECOVERY_TOKEN_INVALID: "再ログイン確認が失効しました。最初からやり直してください。",
    RECOVERY_NOT_READY: "再ログイン確認を最初からやり直してください。",
    WAITING_OWNER_APPROVAL: "OWNER承認待ちです。",
    REACTIVATION_NOT_ALLOWED: "この参加履歴はそのまま再開できません。参加申請から進めてください。",
    IDENTITY_REVERIFY_REQUIRED: "本人確認が未完了です。初回本人確認へ進んでください。",
  };
  return messages[code] ?? code ?? "処理できませんでした。";
}
function authFailure(code: string) { return /INSIGHT_SESSION_INVALID|INSIGHT_MEMBER_INACTIVE|INSIGHT_LOGIN_REQUIRED/.test(code); }

async function post(endpoint: string, action: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const response = await fetch(endpoint, {
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

function AccountList({ accounts, currentToken, busy, onUse }: { accounts: StoredInsightAccount[]; currentToken: string; busy: boolean; onUse: (account: StoredInsightAccount) => void }) {
  if (!accounts.length) return null;
  return <div className="access2-saved">{accounts.map((account) => {
    const current = Boolean(account.memberToken && account.memberToken === currentToken);
    return <button type="button" className="access2-account" disabled={busy || current} key={account.noteId} onClick={() => onUse(account)}>
      {account.imageUrl ? <img src={account.imageUrl} alt="" referrerPolicy="no-referrer" /> : <span>{[...(account.displayName || account.noteId)][0]}</span>}
      <span><b>{account.displayName || `@${account.noteId}`}</b><small>@{account.noteId}</small></span>
      <em>{current ? "使用中" : "切替"}</em>
    </button>;
  })}</div>;
}

export function AccessPortalV6() {
  const [stage, setStage] = useState<Stage>("loading");
  const [application, setApplication] = useState<Application | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const currentToken = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
  const memberAccounts = useMemo(() => readStoredInsightAccounts().filter((item) => item.memberToken && item.status === "active"), [version]);

  function refresh() { setVersion((value) => value + 1); }
  function goDashboard() { sessionStorage.removeItem(OWNER_VIEW_KEY); window.location.hash = "dashboard"; }
  function currentJoinAccount() {
    const noteId = (localStorage.getItem(JOIN_NOTE_KEY) || "").trim().toLowerCase();
    return noteId ? getStoredInsightAccount(noteId) : null;
  }

  async function hydrateCurrentMember() {
    const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
    if (!token) return false;
    try {
      const payload = await post(ACCESS, "session", {}, { "X-Insight-Token": token });
      const stored = readStoredInsightAccounts().find((item) => item.memberToken === token);
      rememberMemberSession(payload.application, token, stored?.passcode);
      refresh();
      return true;
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "ACCESS_ERROR";
      if (authFailure(code)) {
        const stored = readStoredInsightAccounts().find((item) => item.memberToken === token);
        if (stored) forgetMemberSession(stored.noteId);
        else localStorage.removeItem(INSIGHT_TOKEN_KEY);
        refresh();
      }
      return false;
    }
  }

  async function reactivateReturning(account: StoredInsightAccount) {
    if (!account.applicantToken) return false;
    const payload = await post(REACTIVATE, "resume", {}, { "X-Insight-Applicant": account.applicantToken });
    rememberMemberSession(payload.application, payload.memberToken, account.passcode);
    localStorage.removeItem(JOIN_NOTE_KEY);
    setVerificationCode("");
    refresh();
    goDashboard();
    return true;
  }

  async function resumeCurrentJoin() {
    const account = currentJoinAccount();
    if (!account?.applicantToken) return false;
    try {
      const payload = await post(ACCESS, "application-status", {}, { "X-Insight-Applicant": account.applicantToken });
      const app = payload.application as Application;
      rememberApplication(app, app.verificationCode || account.passcode);
      setApplication(app);
      if (app.verificationCode) setVerificationCode(app.verificationCode);
      if ((app.status === "approved" || app.status === "active") && app.verifiedAt) return reactivateReturning(account);
      if (app.status === "approved") setStage("approved");
      else if (app.status === "pending") setStage("pending");
      else {
        localStorage.removeItem(JOIN_NOTE_KEY);
        setStage("accounts");
      }
      return true;
    } catch { return false; }
  }

  async function bootstrap() {
    sessionStorage.removeItem(OWNER_VIEW_KEY);
    const intent = consumeAccessIntent();
    const hasMember = await hydrateCurrentMember();

    if (intent === "apply") { setStage("apply"); return; }
    if (intent === "switch" || intent === "login") { setStage("accounts"); return; }
    if (hasMember) { goDashboard(); return; }
    if (await resumeCurrentJoin()) return;
    setStage("accounts");
  }

  useEffect(() => { void bootstrap(); }, []);
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("mumei-insight-accounts", handler);
    return () => window.removeEventListener("mumei-insight-accounts", handler);
  }, []);

  async function switchAccount(account: StoredInsightAccount) {
    if (!account.memberToken) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = await post(ACCESS, "session", {}, { "X-Insight-Token": account.memberToken });
      activateStoredInsightAccount(account.noteId);
      rememberMemberSession(payload.application, account.memberToken, account.passcode);
      goDashboard();
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "ACCESS_ERROR";
      if (authFailure(code)) forgetMemberSession(account.noteId);
      setError(errorText(code));
      refresh();
    } finally { setSaving(false); }
  }

  async function apply(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const payload = await post(ACCESS, "apply", { noteInput });
      rememberApplicant(payload.application, payload.applicantToken);
      localStorage.setItem(JOIN_NOTE_KEY, String(payload.application.noteId || "").toLowerCase());
      setApplication(payload.application); setNoteInput(""); setStage("pending");
      setMessage("参加申請を送信しました。OWNER承認後、このまま続けられます。本人確認済みの再参加者は承認後に自動再開します。");
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function refreshStatus() {
    const account = currentJoinAccount();
    if (!account?.applicantToken) { setError("申請情報を確認できません。参加申請からやり直してください。"); setStage("accounts"); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = await post(ACCESS, "application-status", {}, { "X-Insight-Applicant": account.applicantToken });
      const app = payload.application as Application;
      rememberApplication(app, app.verificationCode || account.passcode);
      setApplication(app);
      if (app.verificationCode) setVerificationCode(app.verificationCode);
      if ((app.status === "approved" || app.status === "active") && app.verifiedAt) {
        setMessage("本人確認済みの参加履歴を再開しています…");
        await reactivateReturning(account);
      } else if (app.status === "approved") setStage("approved");
      else if (app.status === "pending") setMessage("まだ承認待ちです。承認後に本人確認へ進みます。");
      else { localStorage.removeItem(JOIN_NOTE_KEY); setStage("accounts"); }
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function verifyProfile() {
    const account = currentJoinAccount();
    if (!account?.applicantToken) { setError("申請情報を確認できません。参加申請からやり直してください。"); setStage("accounts"); return; }
    setSaving(true); setError("");
    try {
      const payload = await post(ACCESS, "verify-profile", {}, { "X-Insight-Applicant": account.applicantToken });
      rememberMemberSession(payload.application, payload.memberToken);
      localStorage.removeItem(JOIN_NOTE_KEY);
      setVerificationCode("");
      goDashboard();
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function startRecovery(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const payload = await post(RECOVERY, "start", { noteInput });
      localStorage.setItem(RECOVERY_TOKEN_KEY, payload.recoveryToken);
      setApplication(payload.application);
      setVerificationCode(payload.verificationCode || "");
      setNoteInput("");
      setStage("recovery-check");
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function verifyRecovery() {
    const token = localStorage.getItem(RECOVERY_TOKEN_KEY) || "";
    if (!token) { setError("再ログイン確認を最初からやり直してください。"); setStage("recovery"); return; }
    setSaving(true); setError("");
    try {
      const payload = await post(RECOVERY, "verify", {}, { "X-Insight-Recovery": token });
      rememberMemberSession(payload.application, payload.memberToken);
      localStorage.removeItem(RECOVERY_TOKEN_KEY);
      setVerificationCode("");
      goDashboard();
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  return <div className="access2"><main className="access2-main">
    <a href="#" className="access2-back">← TOP</a>
    <header className="access2-head"><small>INSIGHT MEMBER</small><h1>INSIGHT</h1><p>初回の本人確認後はログイン状態を保持。認証済みアカウントはタップだけで切り替えられます。</p></header>
    {error ? <div className="access2-alert">{error}</div> : null}
    {message ? <div className="access2-message">{message}</div> : null}
    {stage === "loading" ? <section className="access2-card">参加状態を確認しています…</section> : null}

    {stage === "accounts" ? <section className="access2-card">
      <h2>{memberAccounts.length ? "アカウント切替" : "INSIGHTを使う"}</h2>
      {memberAccounts.length ? <><p>本人確認済みのアカウントだけ表示します。タップで切り替えられます。</p><AccountList accounts={memberAccounts} currentToken={currentToken} busy={saving} onUse={(account) => void switchAccount(account)} /></> : <p>初めての方は参加申請から進めます。</p>}
      <div className="access2-actions">
        <button type="button" className="access2-btn" onClick={() => { setError(""); setMessage(""); setStage("apply"); }}>＋ 新しく参加する</button>
        <button type="button" className="access2-btn ghost" onClick={() => { setError(""); setMessage(""); setNoteInput(""); setStage("recovery"); }}>機種変更・再ログイン</button>
      </div>
    </section> : null}

    {stage === "apply" ? <section className="access2-card"><small className="access2-note">STEP 1 / 2</small><h2>参加申請</h2><p>自分のnote ID、またはクリエイターページURLを入れてください。</p><form onSubmit={apply}><input className="access2-input" value={noteInput} onChange={(event) => setNoteInput(event.target.value)} placeholder="note ID または https://note.com/..." autoComplete="off" required /><div className="access2-actions"><button className="access2-btn" disabled={saving}>{saving ? "申請中…" : "参加申請する"}</button><button type="button" className="access2-btn ghost" onClick={() => setStage("accounts")}>戻る</button></div></form></section> : null}

    {stage === "pending" && application ? <section className="access2-card"><small className="access2-note">OWNER APPROVAL</small><h2>承認待ち</h2><Identity app={application} /><p>申請は届いています。OWNER承認後、初参加なら本人確認、本人確認済みの再参加ならそのまま自動再開します。</p><div className="access2-actions"><button className="access2-btn" disabled={saving} onClick={() => void refreshStatus()}>{saving ? "確認中…" : "承認状態を確認"}</button><button type="button" className="access2-btn ghost" onClick={() => setStage("accounts")}>あとで続ける</button></div></section> : null}

    {stage === "approved" && application ? <section className="access2-card"><small className="access2-note">STEP 2 / 2</small><h2>note自己紹介欄で本人確認</h2><Identity app={application} /><p>下の確認コードを一時的にnote自己紹介欄へ入れて保存してください。認証後は削除して元に戻せます。コードをログイン欄へ入力する必要はありません。</p><code className="access2-code">{verificationCode}</code><div className="access2-actions"><button className="access2-btn secondary" onClick={() => { if (verificationCode) void navigator.clipboard?.writeText(verificationCode); }}>コードをコピー</button><a className="access2-btn secondary" href={`https://note.com/${application.noteId}`} target="_blank" rel="noreferrer" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>自分のnoteプロフィールを開く ↗</a><button className="access2-btn" disabled={saving} onClick={() => void verifyProfile()}>{saving ? "本人確認中…" : "保存したので本人確認する"}</button></div></section> : null}

    {stage === "recovery" ? <section className="access2-card"><small className="access2-note">RE-VERIFY</small><h2>機種変更・再ログイン</h2><p>コード入力は不要です。現在参加中のnote IDを入れると、新しい本人確認コードを発行します。退会・利用停止中のアカウントは先に参加申請とOWNER承認が必要です。</p><form onSubmit={startRecovery}><input className="access2-input" value={noteInput} onChange={(event) => setNoteInput(event.target.value)} placeholder="note ID または https://note.com/..." autoComplete="off" required /><div className="access2-actions"><button className="access2-btn" disabled={saving}>{saving ? "確認中…" : "本人確認コードを発行"}</button><button type="button" className="access2-btn ghost" onClick={() => setStage("accounts")}>戻る</button></div></form></section> : null}

    {stage === "recovery-check" && application ? <section className="access2-card"><small className="access2-note">RE-VERIFY</small><h2>自己紹介欄で再確認</h2><Identity app={application} /><p>下の新しい確認コードを一時的に自己紹介欄へ入れて保存してください。確認できたら、この端末のログインを発行します。</p><code className="access2-code">{verificationCode}</code><div className="access2-actions"><button className="access2-btn secondary" onClick={() => { if (verificationCode) void navigator.clipboard?.writeText(verificationCode); }}>コードをコピー</button><a className="access2-btn secondary" href={`https://note.com/${application.noteId}`} target="_blank" rel="noreferrer" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>自分のnoteプロフィールを開く ↗</a><button className="access2-btn" disabled={saving} onClick={() => void verifyRecovery()}>{saving ? "本人確認中…" : "保存したので本人確認する"}</button></div></section> : null}
  </main></div>;
}
