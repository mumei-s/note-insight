import { useEffect, useState } from "react";

const ORIGIN = "https://note-like-tracker.sabosan0404.chatgpt.site";
const PARTICIPANTS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-participants";
const MEMBER = "mumei-note-insight:member", DEVICE = "mumei-note-insight:device", OWNER = "mumei-unified-owner-token";
type M = { id: string; role: string; status: string; noteUrlname: string | null; noteNickname: string | null; noteImageUrl: string | null; joinedAt: string; lastSeenAt: string };
function headers() { return { Accept: "application/json", "Content-Type": "application/json", "X-Insight-Member": localStorage.getItem(MEMBER) || "", "X-Insight-Device": localStorage.getItem(DEVICE) || "" }; }

async function publishParticipants(members: M[]) {
  const owner = localStorage.getItem(OWNER) || "";
  if (!owner) return;
  const publicMembers = members.filter((member) => member.role === "owner" || member.status === "active");
  const response = await fetch(PARTICIPANTS, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Owner-Token": owner },
    body: JSON.stringify({ action: "sync", members: publicMembers }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("TOP_PARTICIPANT_SYNC_FAILED");
}

export function InsightAdminV2() {
  const [rows, setRows] = useState<M[]>([]), [loading, setLoading] = useState(true), [message, setMessage] = useState("");
  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`${ORIGIN}/api/member/me`, { headers: headers(), cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.isOwner) throw new Error(payload?.error || "旧INSIGHTのOWNER会員セッションを確認できません");
      const members: M[] = Array.isArray(payload.members) ? payload.members : [];
      setRows(members);
      await publishParticipants(members).catch(() => {});
    } catch (error) { setMessage(error instanceof Error ? error.message : "参加者一覧を取得できませんでした"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function act(id: string, action: "approve" | "remove") {
    try {
      const response = await fetch(`${ORIGIN}/api/member/admin`, { method: "POST", headers: headers(), body: JSON.stringify({ action, memberId: id }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "変更できませんでした");
      const members: M[] = Array.isArray(payload.members) ? payload.members : [];
      setRows(members);
      await publishParticipants(members).catch(() => {});
    } catch (error) { setMessage(error instanceof Error ? error.message : "変更できませんでした"); }
  }
  return <div style={{ minHeight: "100vh", background: "#070a0f", color: "#f6f8fb", padding: "24px 14px 70px" }}><main style={{ width: "min(920px,100%)", margin: "0 auto" }}><a href="#manage" style={{ color: "#b6ff38", fontWeight: 900, textDecoration: "none" }}>← 管理ハブ</a><header style={{ padding: "44px 0 20px" }}><small style={{ color: "#b6ff38", fontWeight: 950, letterSpacing: ".14em" }}>INSIGHT ADMIN</small><h1 style={{ fontSize: "clamp(38px,7vw,58px)", margin: "8px 0" }}>INSIGHT参加者管理</h1><p style={{ color: "#9ca9bb", lineHeight: 1.7 }}>参加者の承認状態を管理し、TOPの参加者表示も同時に更新します。</p></header>{message ? <section style={{ border: "1px solid #665422", borderRadius: 15, background: "#19150d", padding: 15, color: "#ffcf5a", marginBottom: 14 }}><strong>管理データの接続状態</strong><p style={{ marginBottom: 0 }}>{message}</p></section> : null}{loading ? <p style={{ color: "#b6ff38" }}>参加者一覧を確認中…</p> : rows.length ? <section style={{ display: "grid", gap: 9 }}>{rows.map((member) => <article key={member.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 11, alignItems: "center", border: "1px solid #2c394b", borderRadius: 14, background: "#0e151f", padding: 12 }}>{member.noteImageUrl ? <img src={member.noteImageUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} /> : <span style={{ width: 44, height: 44, borderRadius: "50%", display: "grid", placeItems: "center", background: "#17202d" }}>n</span>}<div><strong>{member.noteNickname || member.noteUrlname || "会員"}</strong><small style={{ display: "block", color: "#8492a5" }}>{member.noteUrlname ? `@${member.noteUrlname}` : "ID未登録"} · {member.status}</small></div>{member.role === "owner" ? <b style={{ color: "#ffcf5a" }}>OWNER</b> : <div style={{ display: "flex", gap: 6 }}>{member.status === "pending" ? <button onClick={() => void act(member.id, "approve")} style={{ border: 0, borderRadius: 8, background: "#b6ff38", padding: "8px 10px", fontWeight: 900 }}>承認</button> : null}<button onClick={() => void act(member.id, "remove")} style={{ border: "1px solid #6b3e48", borderRadius: 8, background: "transparent", color: "#ffadb6", padding: "7px 10px" }}>解除</button></div>}</article>)}</section> : !message ? <p style={{ color: "#8492a5" }}>参加者データはありません。</p> : null}</main></div>;
}
