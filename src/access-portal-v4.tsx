import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  APPLICANT_KEY,
  INSIGHT_TOKEN_KEY,
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

const ACCESS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
const CODE_LOGIN = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-code-login";
const OWNER_VIEW_KEY = "mumei-owner-insight-view";

type Application = {
  id: string;
  noteId: string;
  displayName: string | null;
  imageUrl: string | null;
  status: "pending" | "approved" | "active" | "rejected" | "revoked";
  verificationCode?: string | null;
};
type Stage = "loading" | "accounts" | "apply" | "pending" | "approved";

function errorText(code: string) {
  const messages: Record<string, string> = {
    NOTE_ID_INVALID: "note IDまたはクリエイターページURLを確認してください。",
    NOTE_ACCOUNT_NOT_FOUND: "そのnoteクリエイターを確認できませんでした。",
    APPLICATION_EXISTS: "このnote IDは申請済みです。保存済みアカウントの『参加の続き』から進めてください。",
    ALREADY_ACTIVE: "このnote IDはすでに参加済みです。保存済みアカウントへ追加する場合だけ個別コードを使ってください。",
    PROFILE_CODE_NOT_FOUND: "自己紹介欄に認証コードがまだ確認できません。保存後にもう一度押してください。",
    LOGIN_INVALID: "この個別コードではログインできませんでした。コードを確認してください。",
    LOGIN_CODE_INVALID: "個別コードは INSIGHT-XXXXXXXX の形式で入力してください。",
    LOGIN_CODE_CONFLICT: "同じコードが重複しています。OWNER側でコードを再発行してください。",
    INSIGHT_SESSION_INVALID: "このアカウントの保存済みログインは失効しています。個別コードで再追加してください。",
    INSIGHT_MEMBER_INACTIVE: "この参加権は現在利用できません。",
  };
  return messages[code] ?? code ?? "処理できませんでした。";
}

function authFailure(code: string) {
  return /INSIGHT_SESSION_INVALID|INSIGHT_MEMBER_INACTIVE|INSIGHT_LOGIN_REQUIRED/.test(code);
}

async function callAccess(action: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
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

async function loginByCode(passcode: string) {
  const response = await fetch(CODE_LOGIN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "LOGIN_INVALID");
  return payload;
}

function Identity({ app }: { app: Pick<Application, "noteId" | "displayName" | "imageUrl"> }) {
  return <div className="access2-identity">
    {app.imageUrl ? <img src={app.imageUrl} alt="" referrerPolicy="no-referrer" /> : <span className="access2-avatar">{[...(app.displayName || app.noteId || "n")][0]}</span>}
    <div><strong>{app.displayName || `@${app.noteId}`}</strong><small>@{app.noteId}</small></div>
  </div>;
}

function AccountList({ accounts, busy, onUse }: { accounts: StoredInsightAccount[]; busy: boolean; onUse: (account: StoredInsightAccount) => void }) {
  if (!accounts.length) return <p className="access2-note">この端末に保存済みのアカウントはまだありません。</p>;
  return <div className="access2-saved">{accounts.map((account) => {
    const label = account.memberToken ? "切替" : account.applicantToken ? "参加の続き" : "追加";
    return <button type="button" className="access2-account" disabled={busy} key={account.noteId} onClick={() => onUse(account)}>
      {account.imageUrl ? <img src={account.imageUrl} alt="" referrerPolicy="no-referrer" /> : <span>{[...(account.displayName || account.noteId)][0]}</span>}
      <span><b>{account.displayName || `@${account.noteId}`}</b><small>@{account.noteId}</small></span>
      <em>{label}</em>
    </button>;
  })}</div>;
}

export function AccessPortalV4() {
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

  async function hydrateCurrentMember() {
    const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
    if (!token) return null;
    try {
      const payload = await callAccess("session", {}, { "X-Insight-Token": token });
      const old = readStoredInsightAccounts().find((item) => item.memberToken === token);
      rememberMemberSession(payload.application, token, old?.passcode);
      refreshAccounts();
      return payload.application as Application;
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "ACCESS_ERROR";
      if (authFailure(code)) {
        const old = readStoredInsightAccounts().find((item) => item.memberToken === token);
        if (old) forgetMemberSession(old.noteId);
        else localStorage.removeItem(INSIGHT_TOKEN_KEY);
        refreshAccounts();
      }
      return null;
    }
  }

  async function bootstrap() {
    sessionStorage.removeItem(OWNER_VIEW_KEY);
    await hydrateCurrentMember();
    const intent = consumeAccessIntent();
    if (intent === "apply") { setStage("apply"); return; }
    setStage("accounts");
  }

  useEffect(() => { void bootstrap(); }, []);
  useEffect(() => {
    const refresh = () => refreshAccounts();
    window.addEventListener("mumei-insight-accounts", refresh);
    return () => window.removeEventListener("mumei-insight-accounts", refresh);
  }, []);

  async function openSaved(account: StoredInsightAccount) {
    setSaving(true); setError(""); setMessage("");
    activateStoredInsightAccount(account.noteId);
    try {
      if (account.memberToken) {
        const payload = await callAccess("session", {}, { "X-Insight-Token": account.memberToken });
        rememberMemberSession(payload.application, account.memberToken, account.passcode);
        refreshAccounts();
        setMessage(`@${payload.application.noteId} に切り替えました。`);
        goDashboard();
        return;
      }
      if (account.applicantToken) {
        const payload = await callAccess("application-status", {}, { "X-Insight-Applicant": account.applicantToken });
        const app = payload.application as Application;
        rememberApplication(app, app.verificationCode || account.passcode);
        setApplication(app);
        if (app.verificationCode) setPasscode(app.verificationCode);
        if (app.status === "approved") setStage("approved");
        else if (app.status === "pending") setStage("pending");
        else if (app.status === "active") {
          setStage("accounts");
          setMessage("このアカウントは参加済みです。『既存参加アカウントをこの端末に追加』から個別コードを1回だけ入力してください。");
        } else setStage("apply");
        return;
      }
      setStage("accounts");
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "ACCESS_ERROR";
      if (account.memberToken && authFailure(code)) forgetMemberSession(account.noteId);
      setError(errorText(code));
      setStage("accounts");
    } finally { refreshAccounts(); setSaving(false); }
  }

  async function apply(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const payload = await callAccess("apply", { noteInput });
      rememberApplicant(payload.application, payload.applicantToken);
      setApplication(payload.application); setNoteInput(""); setStage("pending"); refreshAccounts();
      setMessage("参加申請を送信しました。OWNER承認後、このアカウントの『参加の続き』から本人確認へ進めます。");
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function refreshStatus() {
    const account = currentStoredInsightAccount();
    const applicant = account?.applicantToken || "";
    if (!applicant) { setStage("accounts"); return; }
    setSaving(true); setError("");
    try {
      const payload = await callAccess("application-status", {}, { "X-Insight-Applicant": applicant });
      const app = payload.application as Application;
      setApplication(app); rememberApplication(app, app.verificationCode || account?.passcode);
      if (app.verificationCode) setPasscode(app.verificationCode);
      if (app.status === "approved") setStage("approved");
      else if (app.status === "pending") setStage("pending");
      else setStage("accounts");
      refreshAccounts();
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function verifyProfile() {
    const account = currentStoredInsightAccount();
    const applicant = account?.applicantToken || "";
    const savedCode = application?.verificationCode || account?.passcode || passcode;
    if (!applicant) { setError("申請アカウントを選び直してください。"); setStage("accounts"); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = await callAccess("verify-profile", {}, { "X-Insight-Applicant": applicant });
      rememberMemberSession(payload.application, payload.memberToken, savedCode);
      refreshAccounts();
      setMessage(`@${payload.application.noteId} の本人確認が完了しました。今後は保存済みアカウントをタップするだけで切り替えられます。`);
      goDashboard();
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR")); }
    finally { setSaving(false); }
  }

  async function addExisting(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const normalized = passcode.trim().toUpperCase();
      const payload = await loginByCode(normalized);
      rememberMemberSession(payload.application, payload.memberToken, normalized);
      refreshAccounts();
      setPasscode("");
      setMessage(`@${payload.application.noteId} をこの端末へ追加しました。次回からタップだけで切り替えられます。`);
      goDashboard();
    } catch (reason) { setError(errorText(reason instanceof Error ? reason.message : "LOGIN_INVALID")); }
    finally { setSaving(false); }
  }

  const code = application?.verificationCode || passcode;
  return <div className="access2"><main className="access2-main">
    <a href="#" className="access2-back">← TOP</a>
    <header className="access2-head"><small>ACCOUNT SWITCH</small><h1>INSIGHT アカウント</h1><p>参加済みアカウントはタップだけで切替。参加途中のアカウントも同じ一覧から続けられます。</p></header>
    {error ? <div className="access2-alert">{error}</div> : null}
    {message ? <div className="access2-message">{message}</div> : null}
    {stage === "loading" ? <section className="access2-card">保存済みアカウントを確認しています…</section> : null}

    {stage === "accounts" ? <>
      <section className="access2-card"><h2>保存済みアカウント</h2><p>認証済みは「切替」、参加途中は「参加の続き」と表示します。切替元はログアウトしません。</p><AccountList accounts={accounts} busy={saving} onUse={(account) => void openSaved(account)} /><div className="access2-actions"><button type="button" className="access2-btn secondary" onClick={() => { setError(""); setMessage(""); setStage("apply"); }}>＋ 新しく参加する</button></div></section>
      <section className="access2-card"><details><summary style={{ cursor: "pointer", fontWeight: 900, color: "#9edfff" }}>この端末に既存参加アカウントを追加</summary><p>すでに別端末などで本人確認まで完了しているアカウントだけ、個別コードを1回入力します。通常のアカウント切替では使いません。</p><form onSubmit={addExisting}><input className="access2-input" value={passcode} onChange={(event) => setPasscode(event.target.value.toUpperCase())} placeholder="INSIGHT-XXXXXXXX" autoComplete="current-password" required /><div className="access2-actions"><button className="access2-btn" disabled={saving}>{saving ? "追加中…" : "この端末に追加"}</button></div></form></details></section>
    </> : null}

    {stage === "apply" ? <section className="access2-card"><h2>新しく参加する</h2><p>参加するnote IDまたはクリエイターページURLを入力してください。この入力は新規参加の最初の1回だけです。</p><form onSubmit={apply}><input className="access2-input" value={noteInput} onChange={(event) => setNoteInput(event.target.value)} placeholder="note ID または https://note.com/..." autoComplete="off" required /><div className="access2-actions"><button className="access2-btn" disabled={saving}>{saving ? "申請中…" : "参加申請を送る"}</button><button type="button" className="access2-btn ghost" onClick={() => setStage("accounts")}>保存済みアカウントへ戻る</button></div></form></section> : null}

    {stage === "pending" && application ? <section className="access2-card"><small className="access2-note">OWNER APPROVAL</small><h2>承認待ち</h2><Identity app={application} /><p>OWNER承認後、このアカウントの本人確認へ進みます。別アカウントへ切り替えても申請は保持されます。</p><div className="access2-actions"><button className="access2-btn" disabled={saving} onClick={() => void refreshStatus()}>{saving ? "確認中…" : "承認状態を更新"}</button><button className="access2-btn secondary" onClick={() => setStage("accounts")}>保存済みアカウントへ戻る</button></div></section> : null}

    {stage === "approved" && application ? <section className="access2-card"><small className="access2-note">PROFILE CHECK</small><h2>note自己紹介欄で本人確認</h2><Identity app={application} /><p>下のコードを一時的にこのアカウントのnote自己紹介欄へ入れて保存してください。ここが完了すれば、以後この端末ではコード入力なしで切替できます。</p><code className="access2-code">{code}</code><div className="access2-actions"><button className="access2-btn secondary" onClick={() => { if (code) void navigator.clipboard?.writeText(code); }}>コードをコピー</button><a className="access2-btn secondary" href={`https://note.com/${application.noteId}`} target="_blank" rel="noreferrer" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>申請したnoteプロフィールを開く ↗</a><button className="access2-btn" disabled={saving} onClick={() => void verifyProfile()}>{saving ? "本人確認中…" : "保存したのでINSIGHTで認証"}</button><button className="access2-btn ghost" onClick={() => setStage("accounts")}>保存済みアカウントへ戻る</button></div></section> : null}
  </main></div>;
}
