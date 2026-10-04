import { FormEvent, useEffect, useState } from "react";
import {
  INSIGHT_TOKEN_KEY,
  consumeAccessIntent,
  forgetMemberSession,
  getStoredInsightAccount,
  readStoredInsightAccounts,
  rememberApplicant,
  rememberApplication,
  rememberMemberSession,
} from "./insight-account-store";
import "./access-portal-v2.css";

const ACCESS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
const CODE_LOGIN = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-code-login";
const OWNER_VIEW_KEY = "mumei-owner-insight-view";
const JOIN_NOTE_KEY = "mumei-insight-current-join-v5";

type Application = {
  id: string;
  noteId: string;
  displayName: string | null;
  imageUrl: string | null;
  status: "pending" | "approved" | "active" | "rejected" | "revoked";
  verificationCode?: string | null;
};

type Stage = "loading" | "home" | "apply" | "pending" | "approved" | "recovery";

function errorText(code: string) {
  const messages: Record<string, string> = {
    NOTE_ID_INVALID: "note IDまたはクリエイターページURLを確認してください。",
    NOTE_ACCOUNT_NOT_FOUND: "そのnoteクリエイターを確認できませんでした。",
    APPLICATION_EXISTS: "このnote IDはすでに申請されています。",
    ALREADY_ACTIVE: "このnote IDはすでに参加済みです。",
    PROFILE_CODE_NOT_FOUND: "自己紹介欄に認証コードがまだ確認できません。保存後にもう一度押してください。",
    LOGIN_INVALID: "ログイン情報を確認できませんでした。",
    LOGIN_CODE_INVALID: "再ログインコードの形式を確認してください。",
    LOGIN_CODE_CONFLICT: "コードが重複しています。OWNER側で再発行が必要です。",
    INSIGHT_SESSION_INVALID: "保存済みログインが失効しています。",
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

export function AccessPortalV5() {
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

  function currentJoinAccount() {
    const noteId = (localStorage.getItem(JOIN_NOTE_KEY) || "").trim().toLowerCase();
    return noteId ? getStoredInsightAccount(noteId) : null;
  }

  async function resumeCurrentJoin() {
    const account = currentJoinAccount();
    if (!account?.applicantToken) return false;
    try {
      const payload = await callAccess("application-status", {}, { "X-Insight-Applicant": account.applicantToken });
      const app = payload.application as Application;
      rememberApplication(app, app.verificationCode || account.passcode);
      setApplication(app);
      if (app.verificationCode) setPasscode(app.verificationCode);
      if (app.status === "approved") setStage("approved");
      else if (app.status === "pending") setStage("pending");
      else if (app.status === "active") {
        localStorage.removeItem(JOIN_NOTE_KEY);
        setStage("home");
      } else {
        localStorage.removeItem(JOIN_NOTE_KEY);
        setStage("apply");
      }
      return true;
    } catch {
      return false;
    }
  }

  async function bootstrap() {
    sessionStorage.removeItem(OWNER_VIEW_KEY);
    const intent = consumeAccessIntent();
    const memberToken = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";

    if (memberToken) {
      try {
        const payload = await callAccess("session", {}, { "X-Insight-Token": memberToken });
        const stored = readStoredInsightAccounts().find((item) => item.memberToken === memberToken);
        rememberMemberSession(payload.application, memberToken, stored?.passcode);
        if (intent === "apply") {
          setStage("apply");
          return;
        }
        goDashboard();
        return;
      } catch (reason) {
        const code = reason instanceof Error ? reason.message : "ACCESS_ERROR";
        if (authFailure(code)) {
          const stored = readStoredInsightAccounts().find((item) => item.memberToken === memberToken);
          if (stored) forgetMemberSession(stored.noteId);
          else localStorage.removeItem(INSIGHT_TOKEN_KEY);
        }
      }
    }

    if (intent === "apply") {
      setStage("apply");
      return;
    }

    if (await resumeCurrentJoin()) return;
    setStage("home");
  }

  useEffect(() => { void bootstrap(); }, []);

  async function apply(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = await callAccess("apply", { noteInput });
      rememberApplicant(payload.application, payload.applicantToken);
      localStorage.setItem(JOIN_NOTE_KEY, String(payload.application.noteId || "").toLowerCase());
      setApplication(payload.application);
      setNoteInput("");
      setStage("pending");
      setMessage("参加申請を送信しました。承認されたら、このまま本人確認へ進めます。");
    } catch (reason) {
      setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR"));
    } finally {
      setSaving(false);
    }
  }

  async function refreshStatus() {
    const account = currentJoinAccount();
    if (!account?.applicantToken) {
      setError("申請情報を確認できません。もう一度参加画面から開いてください。");
      setStage("home");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = await callAccess("application-status", {}, { "X-Insight-Applicant": account.applicantToken });
      const app = payload.application as Application;
      rememberApplication(app, app.verificationCode || account.passcode);
      setApplication(app);
      if (app.verificationCode) setPasscode(app.verificationCode);
      if (app.status === "approved") setStage("approved");
      else if (app.status === "pending") {
        setStage("pending");
        setMessage("まだ承認待ちです。承認後にここから本人確認へ進めます。");
      } else if (app.status === "active") {
        localStorage.removeItem(JOIN_NOTE_KEY);
        setStage("home");
        setMessage("このnote IDは参加済みです。");
      } else {
        localStorage.removeItem(JOIN_NOTE_KEY);
        setStage("apply");
      }
    } catch (reason) {
      setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR"));
    } finally {
      setSaving(false);
    }
  }

  async function verifyProfile() {
    const account = currentJoinAccount();
    if (!account?.applicantToken) {
      setError("申請情報を確認できません。もう一度参加画面から開いてください。");
      setStage("home");
      return;
    }
    const savedCode = application?.verificationCode || account.passcode || passcode;
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = await callAccess("verify-profile", {}, { "X-Insight-Applicant": account.applicantToken });
      rememberMemberSession(payload.application, payload.memberToken, savedCode);
      localStorage.removeItem(JOIN_NOTE_KEY);
      goDashboard();
    } catch (reason) {
      setError(errorText(reason instanceof Error ? reason.message : "ACCESS_ERROR"));
    } finally {
      setSaving(false);
    }
  }

  async function recover(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const normalized = passcode.trim().toUpperCase();
      const payload = await loginByCode(normalized);
      rememberMemberSession(payload.application, payload.memberToken, normalized);
      setPasscode("");
      goDashboard();
    } catch (reason) {
      setError(errorText(reason instanceof Error ? reason.message : "LOGIN_INVALID"));
    } finally {
      setSaving(false);
    }
  }

  const code = application?.verificationCode || passcode;

  return <div className="access2"><main className="access2-main">
    <a href="#" className="access2-back">← TOP</a>
    <header className="access2-head"><small>INSIGHT MEMBER</small><h1>INSIGHT 参加</h1><p>初回だけ本人確認。完了後はこの端末でログイン状態を保持します。</p></header>

    {error ? <div className="access2-alert">{error}</div> : null}
    {message ? <div className="access2-message">{message}</div> : null}

    {stage === "loading" ? <section className="access2-card">参加状態を確認しています…</section> : null}

    {stage === "home" ? <section className="access2-card">
      <h2>INSIGHTを使う</h2>
      <p>初めての方は「参加する」だけで進めます。申請後はOWNER承認 → note自己紹介欄で本人確認 → 利用開始です。</p>
      <div className="access2-actions">
        <button type="button" className="access2-btn" onClick={() => { setError(""); setMessage(""); setStage("apply"); }}>INSIGHTに参加する</button>
        <button type="button" className="access2-btn ghost" onClick={() => { setError(""); setMessage(""); setPasscode(""); setStage("recovery"); }}>機種変更・再ログイン</button>
      </div>
    </section> : null}

    {stage === "apply" ? <section className="access2-card">
      <small className="access2-note">STEP 1 / 2</small>
      <h2>参加申請</h2>
      <p>自分のnote ID、またはクリエイターページURLを入れてください。</p>
      <form onSubmit={apply}>
        <input className="access2-input" value={noteInput} onChange={(event) => setNoteInput(event.target.value)} placeholder="note ID または https://note.com/..." autoComplete="off" required />
        <div className="access2-actions"><button className="access2-btn" disabled={saving}>{saving ? "申請中…" : "参加申請する"}</button></div>
      </form>
    </section> : null}

    {stage === "pending" && application ? <section className="access2-card">
      <small className="access2-note">OWNER APPROVAL</small>
      <h2>承認待ち</h2>
      <Identity app={application} />
      <p>申請は届いています。OWNER承認後、次の本人確認へ進みます。</p>
      <div className="access2-actions"><button className="access2-btn" disabled={saving} onClick={() => void refreshStatus()}>{saving ? "確認中…" : "承認状態を確認"}</button></div>
    </section> : null}

    {stage === "approved" && application ? <section className="access2-card">
      <small className="access2-note">STEP 2 / 2</small>
      <h2>note自己紹介欄で本人確認</h2>
      <Identity app={application} />
      <p>下のコードを一時的にnoteの自己紹介欄へ入れて保存してください。認証後は削除して元に戻せます。ここで参加は完了です。</p>
      <code className="access2-code">{code}</code>
      <div className="access2-actions">
        <button className="access2-btn secondary" onClick={() => { if (code) void navigator.clipboard?.writeText(code); }}>コードをコピー</button>
        <a className="access2-btn secondary" href={`https://note.com/${application.noteId}`} target="_blank" rel="noreferrer" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>自分のnoteプロフィールを開く ↗</a>
        <button className="access2-btn" disabled={saving} onClick={() => void verifyProfile()}>{saving ? "本人確認中…" : "保存したので本人確認する"}</button>
      </div>
    </section> : null}

    {stage === "recovery" ? <section className="access2-card">
      <small className="access2-note">RECOVERY</small>
      <h2>機種変更・再ログイン</h2>
      <p>これは通常の参加では使いません。本人確認済みなのに、この端末のログイン情報が無い場合だけ使います。</p>
      <form onSubmit={recover}>
        <input className="access2-input" value={passcode} onChange={(event) => setPasscode(event.target.value.toUpperCase())} placeholder="INSIGHT-XXXXXXXX" autoComplete="current-password" required />
        <div className="access2-actions">
          <button className="access2-btn" disabled={saving}>{saving ? "確認中…" : "再ログインする"}</button>
          <button type="button" className="access2-btn ghost" onClick={() => { setPasscode(""); setError(""); setStage("home"); }}>戻る</button>
        </div>
      </form>
    </section> : null}
  </main></div>;
}
