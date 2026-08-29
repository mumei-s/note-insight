import { FormEvent, useEffect, useState } from "react";
import { hasEntrySession, hasMemberSession } from "./api";

type Target = "insight" | "catalog";
const OWNER_KEY = "mumei-unified-owner-token";
const OWNER_RETURN_KEY = "mumei-owner-return";
const OWNER_ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/unified-owner-access";
type MemberPayload = {
  member: {
    id: string;
    role: "owner" | "member";
    status: "pending" | "active" | "removed";
    noteUrlname: string | null;
    noteNickname: string | null;
  };
};

const box = { border: "1px solid #273244", borderRadius: 20, background: "#0e151f", padding: 22 } as const;
const input = { width: "100%", boxSizing: "border-box" as const, minHeight: 48, borderRadius: 12, border: "1px solid #344257", background: "#080c12", color: "#fff", padding: "0 14px", fontSize: 16 };
const btn = { width: "100%", minHeight: 48, border: 0, borderRadius: 12, background: "#b6ff38", color: "#101600", fontWeight: 900, cursor: "pointer" } as const;

export function AccessPortal({ target }: { target: Target }) {
  const [stage, setStage] = useState<"entry" | "member" | "loading">("loading");
  const [password, setPassword] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [member, setMember] = useState<MemberPayload["member"] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const title = target === "insight" ? "INSIGHT" : "クリエイター名鑑";

  function goService() {
    window.location.hash = target === "insight" ? "dashboard" : "catalog";
  }

  function goOwnerAccess() {
    sessionStorage.setItem(OWNER_RETURN_KEY, target === "insight" ? "dashboard" : "catalog");
    window.location.hash = "owner";
  }

  async function hasVerifiedOwnerSession() {
    const token = localStorage.getItem(OWNER_KEY) || "";
    if (!token) return false;
    try {
      const response = await fetch(OWNER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Owner-Token": token },
        body: JSON.stringify({ action: "status" }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.authenticated === true) return true;
      localStorage.removeItem(OWNER_KEY);
    } catch { /* Keep the session during a temporary network failure. */ }
    return false;
  }

  async function loadMember() {
    if (await hasVerifiedOwnerSession()) {
      goService();
      return;
    }
    if (!hasEntrySession()) {
      setStage("entry");
      return;
    }
    if (!hasMemberSession()) {
      setStage("member");
      return;
    }
    setStage("loading");
    try {
      const response = await fetch("/api/member/me", { cache: "no-store" });
      if (!response.ok) throw new Error("会員情報を確認できませんでした。");
      const payload = (await response.json()) as MemberPayload;
      setMember(payload.member);
      if (payload.member.status === "active") goService();
      else setStage("member");
    } catch {
      setStage("member");
    }
  }

  useEffect(() => { void loadMember(); }, [target]);

  async function entryLogin(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/access/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "入口パスワードが違います。");
      setPassword("");
      await loadMember();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ログインできませんでした。");
    } finally { setSaving(false); }
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/member/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteInput }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "参加申請できませんでした。");
      setMember(payload.member ?? null);
      if (payload.member?.status === "active") goService();
    } catch (e) {
      setError(e instanceof Error ? e.message : "参加申請できませんでした。");
    } finally { setSaving(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#070a0f", color: "#f6f8fb", padding: "24px 14px 60px" }}>
      <div style={{ width: "min(680px,100%)", margin: "0 auto" }}>
        <a href="#" style={{ color: "#b6ff38", textDecoration: "none", fontWeight: 900 }}>← TOP</a>
        <div style={{ margin: "46px 0 24px" }}>
          <small style={{ color: "#b6ff38", fontWeight: 900, letterSpacing: ".14em" }}>COMMON LOGIN</small>
          <h1 style={{ fontSize: 42, margin: "8px 0" }}>{title}</h1>
          <p style={{ color: "#9ba8bb", lineHeight: 1.7 }}>INSIGHTとクリエイター名鑑は同じログインを使います。認証済みなら、次回からこの画面を飛ばして利用画面へ進みます。</p>
        </div>

        {error ? <div style={{ ...box, borderColor: "#7d3d45", color: "#ffb0b8", marginBottom: 14 }}>{error}</div> : null}

        {stage === "loading" ? <div style={box}>ログイン状態を確認しています…</div> : null}

        {stage === "entry" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <section style={{ ...box, borderColor: "#6b5725", background: "#17140c" }}>
              <small style={{ color: "#ffcf5a", fontWeight: 950 }}>OWNER</small>
              <h2>OWNERはパスワード不要</h2>
              <p style={{ color: "#b9ad8d", lineHeight: 1.7 }}>管理者noteプロフィールへ一時コードを掲載する本人認証で入れます。</p>
              <button type="button" onClick={goOwnerAccess} style={{ ...btn, background: "#ffcf5a" }}>OWNER本人認証で入る</button>
            </section>
            <form onSubmit={entryLogin} style={box}>
              <h2 style={{ marginTop: 0 }}>参加者の共通入口</h2>
              <p style={{ color: "#9ba8bb" }}>参加者へ案内された共通パスワードを入力します。</p>
              <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              <button style={{ ...btn, marginTop: 12 }} disabled={saving}>{saving ? "確認中…" : "次へ"}</button>
            </form>
          </div>
        ) : null}

        {stage === "member" && member?.status === "pending" && member.noteUrlname ? (
          <div style={box}>
            <small style={{ color: "#ffcf5a", fontWeight: 900 }}>承認待ち</small>
            <h2>{member.noteNickname ?? `@${member.noteUrlname}`}</h2>
            <p style={{ color: "#9ba8bb", lineHeight: 1.7 }}>管理者の認証後に利用できます。承認後は同じログインのまま{title}へ入れます。</p>
          </div>
        ) : null}

        {stage === "member" && (!member || !member.noteUrlname) ? (
          <form onSubmit={register} style={box}>
            <h2 style={{ marginTop: 0 }}>{title} 参加申請</h2>
            <p style={{ color: "#9ba8bb", lineHeight: 1.7 }}>note IDまたはクリエイターページURLを登録します。管理者が認証した方だけ利用できます。</p>
            <input style={input} value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="note ID または https://note.com/..." autoComplete="off" required />
            <button style={{ ...btn, marginTop: 12 }} disabled={saving}>{saving ? "申請中…" : `${title}の参加申請`}</button>
          </form>
        ) : null}

        {stage === "member" && member?.status === "removed" ? (
          <div style={box}><h2>利用停止中</h2><p style={{ color: "#9ba8bb" }}>このアカウントは現在利用できません。</p></div>
        ) : null}
      </div>
    </div>
  );
}
