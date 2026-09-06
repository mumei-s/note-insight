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
const RECOVERY_STATE_KEY = "mumei-insight-recovery-state-v2";

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
type RecoveryState = { noteId: string; token: string; application: Application; verificationCode: string; at: number };

function cleanId(value: unknown) { return String(value || "").trim().replace(/^@/, "").toLowerCase(); }
function errorText(code: string) {
  const messages: Record<string, string> = {
    NOTE_ID_INVALID: "note IDまたはクリエイターページURLを確認してください。",
    NOTE_ACCOUNT_NOT_FOUND: "そのnoteクリエイターを確認できませんでした。",
    APPLICATION_EXISTS: "このnote IDはすでに申請されています。承認待ち状態を確認してください。",
    ALREADY_ACTIVE: "このnote IDは参加中です。新規申請ではなく再ログインしてください。",
    PROFILE_CODE_NOT_FOUND: "自己紹介欄に確認コードがまだ見つかりません。保存後にもう一度押してください。",
    INSIGHT_SESSION_INVALID: "この端末の保存済みログインは失効しています。再ログインしてください。",
    INSIGHT_MEMBER_INACTIVE: "この参加権は現在利用できません。",
    INSIGHT_MEMBER_NOT_ACTIVE: "このnote IDは現在の参加中アカウントとして確認できません。利用停止中なら参加申請から進めてください。",
    RECOVERY_TOKEN_INVALID: "再ログイン確認が失効しました。もう一度コードを発行してください。",
    RECOVERY_NOT_READY: "再ログイン確認が完了済み、または失効しています。もう一度コードを発行してください。",
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

function readRecoveryState(): RecoveryState | null {
  try {
    const value = JSON.parse(localStorage.getItem(RECOVERY_STATE_KEY) || "null") as RecoveryState | null;
    if (!value?.token || !value?.application?.noteId || Date.now() - Number(value.at || 0) > 2 * 60 * 60 * 1000) {
      localStorage.removeItem(RECOVERY_STATE_KEY);
      return null;
    }
    return value;
  } catch {
    localStorage.removeItem(RECOVERY_STATE_KEY);
    return null;
  }
}
function saveRecoveryState(state: RecoveryState) {
  localStorage.setItem(RECOVERY_STATE_KEY, JSON.stringify(state));
  localStorage.setItem(RECOVERY_TOKEN_KEY, state.token);
}
function clearRecoveryState() {
  localStorage.removeItem(RECOVERY_STATE_KEY);
  localStorage.removeItem(RECOVERY_TOKEN_KEY);
}

function Identity({ app }: { app: Pick<Application, "noteId" | "displayName" | "imageUrl"> }) {
  return <div className="access2-identity">
    {app.imageUrl ? <img src={app.imageUrl} alt="" referrerPolicy="no-referrer" /> : <span className="access2-avatar">{[...(app.displayName || app.noteId || "n")][0]}</span>}
    <div><strong>{app.displayName || `@${app.noteId}`}</strong><small>@{app.noteId}</small></div>
  </div>;
}

function AccountList({ accounts, currentToken, busy, onUse, onRecover }: { accounts: StoredInsightAccount[]; currentToken: string; busy: boolean; onUse: (account: StoredInsightAccount) => void; onRecover: (account: StoredInsightAccount) => void }) {
  if (!accounts.length) return null;
  return <div className="access2-saved">{accounts.map((account) => {
    const current = Boolean(account.memberToken && account.memberToken === currentToken);
    const canSwitch = Boolean(account.memberToken);
    return <button type="button" className="access2-account" disabled={busy || current} key={account.noteId} onClick={() => canSwitch ? onUse(account) : onRecover(account)}>
      {account.imageUrl ? <img src={account.imageUrl} alt="" referrerPolicy="no-referrer" /> : <span>{[...(account.displayName || account.noteId)][0]}</span>}
      <span><b>{account.displayName || `@${account.noteId}`}</b><small>@{account.noteId}</small></span>
      <em>{current ? "使用中" : canSwitch ? "切替" : "再ログイン"}</em>
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
  const storedAccounts = useMemo(() => readStoredInsightAccounts().filter((item) => item.noteId), [version]);

  function refresh() { setVersion((value) => value + 1); }
  function goDashboard() { sessionStorage.removeItem(OWNER_VIEW_KEY); window.location.hash = "dashboard"; }
  function currentJoinAccount() {
    const noteId = cleanId(localStorage.getItem(JOIN_NOTE_KEY) || "");
    return noteId ? getStoredInsightAccount(noteId) : null;
  }
  function openRecoveryFor(account: StoredInsightAccount) {
    setError(""); setMessage("この端末の参加履歴から再ログインします。"); setNoteInput(account.noteId); setStage("recovery");
  }

  async function hydrateCurrentMember() {
    const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
    if (!token) return false;
    try {
      const payload = await post(ACCESS, "session", {}, { "X-Insight-Token": token });
      const stored = readStoredInsightAccounts().find((item) => item.memberToken === token);
      rememberMemberSession(payload.application, token, stored?.passcode);
      clearRecoveryState();
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
    clearRecoveryState();
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
    const recovery = readRecoveryState();
    if (recovery) {
      setApplication(recovery.application);
      setVerificationCode(recovery.verificationCode);
      setStage("recovery-check");
      return;
    }
    setStage("accounts");
  }

  useEffect(() => { void bootstrap(); }, []);
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("mumei-insight-accounts", handler);
    return () => window.removeEventListener("mumei-insight-accounts", handler);
  }, []);

  async function switchAccount(account: StoredInsightAccount) {
    if (!account.memberToken) { openRecoveryFor(account); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = await post(ACCESS, "session", {}, { "X-Insight-Token": account.memberToken });
      activateStoredInsightAccount(account.noteId);
      rememberMemberSession(payload.application, account.memberToken, account.passcode);
      clearRecoveryState();
      goDashboard();
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "ACCESS_ERROR";
      if (authFailure(code)) {
        forgetMemberSession(account.noteId);
        setNoteInput(account.noteId);
        setMessage("保存済みログインが失効していたため、再ログインへ切り替えました。");
        setStage("recovery");
      } else setError(errorText(code));
      refresh();
    } finally { setSaving(false); }
  }

  async function apply(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const attempted = noteInput;
    try {
      const payload = await post(ACCESS, "apply", { noteInput: attempted });
      rememberApplicant(payload.application, payload.applicantToken);
      localStorage.setItem(JOIN_NOTE_KEY, String(payload.application.noteId || "").toLowerCase());
      setApplication(payload.application); setNoteInput(""); setStage("pending");
      setMessage("参加申請を送信しました。OWNER承認後、このまま続けられます。本人確認済みの再参加者は承認後に自動再開します。");
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "ACCESS_ERROR";
      if (code === "ALREADY_ACTIVE") {
        setError(""); setMessage("このnote IDはすでに参加中です。新規申請ではなく再ログインへ切り替えました。"); setNoteInput(attempted); setStage("recovery");
      } else setError(errorText(code));
    } finally { setSaving(false); }
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
      clearRecoveryState();
      setVerificationCode("");
      goDashboard();
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function startRecovery(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const payload = await post(RECOVERY, "start", { noteInput });
      const app = payload.application as Application;
      const state: RecoveryState = { noteId: cleanId(app.noteId), token: String(payload.recoveryToken || ""), application: app, verificationCode: String(payload.verificationCode || ""), at: Date.now() };
      saveRecoveryState(state);
      setApplication(app);
      setVerificationCode(state.verificationCode);
      setNoteInput("");
      setStage("recovery-check");
      setMessage("再ログイン情報をこの端末に保持しました。noteへ移動して戻ってもこの続きから再開できます。");
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function verifyRecovery() {
    const state = readRecoveryState();
    const token = state?.token || localStorage.getItem(RECOVERY_TOKEN_KEY) || "";
    if (!token) { setError("再ログイン情報を確認できません。もう一度コードを発行してください。"); setStage("recovery"); return; }
    setSaving(true); setError("");
    try {
      const payload = await post(RECOVERY, "verify", {}, { "X-Insight-Recovery": token });
      rememberMemberSession(payload.application, payload.memberToken);
      clearRecoveryState();
      setVerificationCode("");
      setMessage("");
      goDashboard();
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "ACCESS_ERROR";
      if (code === "RECOVERY_TOKEN_INVALID" || code === "RECOVERY_NOT_READY") clearRecoveryState();
      setError(errorText(code));
      if (code === "RECOVERY_TOKEN_INVALID" || code === "RECOVERY_NOT_READY") setStage("recovery");
    } finally { setSaving(false); }
  }

  return <div className="access2"><main className="access2-main">
    <a href="#" className="access2-back">← TOP</a>
    <header className="access2-head"><small>INSIGHT MEMBER</small><h1>INSIGHT</h1><p>初回の本人確認後はログイン状態を保持。認証済みアカウントはタップだけで切り替えられます。</p></header>
    {error ? <div className="access2-alert">{error}</div> : null}
    {message ? <div className="access2-message">{message}</div> : null}
    {stage === "loading" ? <section className="access2-card">参加状態を確認しています…</section> : null}

    {stage === "accounts" ? <section className="access2-card">
      <h2>{storedAccounts.length ? "アカウント切替・再ログイン" : "INSIGHTを使う"}</h2>
      {storedAccounts.length ? <><p>この端末に保存されている本人確認履歴です。有効なログインはタップで切替、失効済みは再ログインへ進みます。</p><AccountList accounts={storedAccounts} currentToken={currentToken} busy={saving} onUse={(account) => void switchAccount(account)} onRecover={openRecoveryFor} /></> : <p>この端末に保存済みアカウントはありません。参加中の方は「機種変更・再ログイン」、初めての方だけ「新しく参加する」から進めます。</p>}
      <div className="access2-actions">
        <button type="button" className="access2-btn" onClick={() => { setError(""); setMessage(""); setStage("apply"); }}>＋ 新しく参加する</button>
        <button type="button" className="access2-btn ghost" onClick={() => { setError(""); setMessage(""); setNoteInput(""); setStage("recovery"); }}>機種変更・再ログイン</button>
      </div>
    </section> : null}

    {stage === "apply" ? <section className="access2-card"><small className="access2-note">STEP 1 / 2</small><h2>参加申請</h2><p>自分のnote ID、またはクリエイターページURLを入れてください。すでに参加中なら自動で再ログインへ案内します。</p><form onSubmit={apply}><input className="access2-input" value={noteInput} onChange={(event) => setNoteInput(event.target.value)} placeholder="note ID または https://note.com/..." autoComplete="off" required /><div className="access2-actions"><button className="access2-btn" disabled={saving}>{saving ? "申請中…" : "参加申請する"}</button><button type="button" className="access2-btn ghost" onClick={() => setStage("accounts")}>戻る</button></div></form></section> : null}

    {stage === "pending" && application ? <section className="access2-card"><small className="access2-note">OWNER APPROVAL</small><h2>承認待ち</h2><Identity app={application} /><p>申請は届いています。OWNER承認後、初参加なら本人確認、本人確認済みの再参加ならそのまま自動再開します。</p><div className="access2-actions"><button className="access2-btn" disabled={saving} onClick={() => void refreshStatus()}>{saving ? "確認中…" : "承認状態を確認"}</button><button type="button" className="access2-btn ghost" onClick={() => setStage("accounts")}>あとで続ける</button></div></section> : null}

    {stage === "approved" && application ? <section className="access2-card"><small className="access2-note">STEP 2 / 2</small><h2>note自己紹介欄で本人確認</h2><Identity app={application} /><p>下の確認コードを一時的にnote自己紹介欄へ入れて保存してください。認証後は削除して元に戻せます。コードをログイン欄へ入力する必要はありません。</p><code className="access2-code">{verificationCode}</code><div className="access2-actions"><button className="access2-btn secondary" onClick={() => { if (verificationCode) void navigator.clipboard?.writeText(verificationCode); }}>コードをコピー</button><a className="access2-btn secondary" href={`https://note.com/${application.noteId}`} target="_blank" rel="noreferrer" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>自分のnoteプロフィールを開く ↗</a><button className="access2-btn" disabled={saving} onClick={() => void verifyProfile()}>{saving ? "本人確認中…" : "保存したので本人確認する"}</button></div></section> : null}

    {stage === "recovery" ? <section className="access2-card"><small className="access2-note">RE-VERIFY</small><h2>機種変更・再ログイン</h2><p>参加中のnote IDまたはクリエイターページURLを入れてください。新しい本人確認コードを発行し、この端末に続きの状態を保持します。</p><form onSubmit={startRecovery}><input className="access2-input" value={noteInput} onChange={(event) => setNoteInput(event.target.value)} placeholder="note ID または https://note.com/..." autoComplete="off" required /><div className="access2-actions"><button className="access2-btn" disabled={saving}>{saving ? "確認中…" : "本人確認コードを発行"}</button><button type="button" className="access2-btn ghost" onClick={() => setStage("accounts")}>戻る</button></div></form></section> : null}

    {stage === "recovery-check" && application ? <section className="access2-card"><small className="access2-note">RE-VERIFY</small><h2>自己紹介欄で再確認</h2><Identity app={application} /><p>下の新しい確認コードを一時的に自己紹介欄へ入れて保存してください。noteへ移動して戻っても、この画面の続きは保持されます。</p><code className="access2-code">{verificationCode}</code><div className="access2-actions"><button className="access2-btn secondary" onClick={() => { if (verificationCode) void navigator.clipboard?.writeText(verificationCode); }}>コードをコピー</button><a className="access2-btn secondary" href={`https://note.com/${application.noteId}`} target="_blank" rel="noreferrer" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>自分のnoteプロフィールを開く ↗</a><button className="access2-btn" disabled={saving} onClick={() => void verifyRecovery()}>{saving ? "本人確認中…" : "保存したので本人確認する"}</button></div></section> : null}
  </main></div>;
}
