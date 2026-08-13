import { useEffect, useMemo, useState } from "react";

const OWNER_ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/unified-owner-access";
const CATALOG_ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-world";
const OWNER_KEY = "mumei-unified-owner-token";
const MEMBER_KEY = "mumei-note-insight:member";

type Submission = { id: string; note_id: string; display_name: string; status: string; job: string; rarity: string; created_at: string };

async function ownerCall(action: string, extra: Record<string, unknown> = {}) {
  const response = await fetch(OWNER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Owner-Token": localStorage.getItem(OWNER_KEY) ?? "" },
    body: JSON.stringify({ action, ...extra }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error ?? "管理者認証に失敗しました。");
  return payload;
}
async function catalogCall(action: string, extra: Record<string, unknown> = {}) {
  const response = await fetch(CATALOG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Owner-Token": localStorage.getItem(OWNER_KEY) ?? "" },
    body: JSON.stringify({ action, ...extra }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error ?? "名鑑管理を読み込めませんでした。");
  return payload;
}

const card = { border: "1px solid #273244", borderRadius: 20, background: "linear-gradient(180deg,#101722,#0b1017)", padding: 20 } as const;

export function ManagementPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const pending = useMemo(() => submissions.filter((x) => x.status === "pending"), [submissions]);
  const active = useMemo(() => submissions.filter((x) => x.status === "approved"), [submissions]);

  async function loadCatalogAdmin() {
    try {
      const payload = await catalogCall("owner-list");
      setSubmissions(payload.submissions ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "名鑑管理を読み込めませんでした。");
    }
  }

  useEffect(() => {
    if (!localStorage.getItem(OWNER_KEY)) return;
    ownerCall("status")
      .then((p) => {
        if (p.authenticated) {
          setAuthenticated(true);
          void loadCatalogAdmin();
        }
      })
      .catch(() => {});
  }, []);

  async function start() {
    setBusy(true); setMessage("");
    try {
      const p = await ownerCall("start");
      setChallengeId(p.challengeId);
      setCode(p.code);
    } catch (e) { setMessage(e instanceof Error ? e.message : "認証コードを発行できませんでした。"); }
    finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setMessage("");
    try {
      const p = await ownerCall("verify", { challengeId });
      localStorage.setItem(OWNER_KEY, p.ownerToken);
      setAuthenticated(true);
      setCode(""); setChallengeId("");
      setMessage("管理者本人を確認しました。プロフィールから一時コードを削除して大丈夫です。");
      await loadCatalogAdmin();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "確認できませんでした。";
      setMessage(msg === "PROFILE_CODE_NOT_FOUND" ? "noteプロフィールに一時コードがまだ確認できません。保存後にもう一度押してください。" : msg);
    } finally { setBusy(false); }
  }

  async function catalogAction(id: string, next: string) {
    setBusy(true); setMessage("");
    try {
      await catalogCall("owner-action", { id, next });
      await loadCatalogAdmin();
    } catch (e) { setMessage(e instanceof Error ? e.message : "変更できませんでした。"); }
    finally { setBusy(false); }
  }

  async function logout() {
    try { await ownerCall("logout"); } catch {}
    localStorage.removeItem(OWNER_KEY);
    setAuthenticated(false);
    setSubmissions([]);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#070a0f", color: "#f7f9fc", padding: "22px 14px 60px" }}>
      <div style={{ width: "min(1050px,100%)", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <a href="#" style={{ color: "#ffcf5a", textDecoration: "none", fontWeight: 900 }}>← TOP</a>
          {authenticated ? <button onClick={() => void logout()} style={{ background: "transparent", color: "#9ca9bb", border: "1px solid #344156", borderRadius: 10, padding: "8px 11px" }}>管理ログアウト</button> : null}
        </div>

        <header style={{ margin: "48px 0 24px" }}>
          <small style={{ color: "#ffcf5a", fontWeight: 900, letterSpacing: ".14em" }}>OWNER CONTROL</small>
          <h1 style={{ fontSize: "clamp(38px,7vw,62px)", margin: "8px 0" }}>管理ページ</h1>
          <p style={{ color: "#9ca9bb", lineHeight: 1.7 }}>固定の「管理者パスワード」は使いません。管理者noteプロフィールへの一時コード掲載で本人確認し、その後は長期セッションを保持します。</p>
        </header>

        {message ? <div style={{ ...card, marginBottom: 16, color: "#ffcf5a" }}>{message}</div> : null}

        {!authenticated ? (
          <section style={card}>
            <h2 style={{ marginTop: 0 }}>管理者本人を確認</h2>
            {!code ? (
              <>
                <p style={{ color: "#9ca9bb", lineHeight: 1.7 }}>「コードを発行」を押すと、管理者noteプロフィールに一時掲載するコードが表示されます。</p>
                <button disabled={busy} onClick={() => void start()} style={{ border: 0, borderRadius: 12, background: "#ffcf5a", color: "#171000", padding: "12px 18px", fontWeight: 900 }}>{busy ? "発行中…" : "本人確認コードを発行"}</button>
              </>
            ) : (
              <>
                <p style={{ color: "#9ca9bb" }}>このコードを <b>無名S note（@ss_yr）</b> のプロフィールへ一時掲載して保存します。</p>
                <code style={{ display: "block", padding: 16, borderRadius: 12, background: "#05080c", color: "#ffcf5a", fontSize: 21, fontWeight: 950, letterSpacing: ".05em" }}>{code}</code>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <a href="https://note.com/ss_yr" target="_blank" rel="noreferrer" style={{ color: "#54d8ff", fontWeight: 800 }}>noteプロフィールを開く ↗</a>
                  <button disabled={busy} onClick={() => void verify()} style={{ border: 0, borderRadius: 12, background: "#ffcf5a", color: "#171000", padding: "10px 16px", fontWeight: 900 }}>{busy ? "確認中…" : "管理者として確認"}</button>
                </div>
              </>
            )}
          </section>
        ) : (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              <article style={card}>
                <small style={{ color: "#b6ff38", fontWeight: 900 }}>自分で使う</small>
                <h2>自分のINSIGHT</h2>
                <p style={{ color: "#9ca9bb", lineHeight: 1.6 }}>参加者として自分自身の分析画面を開きます。</p>
                <a href={localStorage.getItem(MEMBER_KEY) ? "#dashboard" : "#access/insight"} style={{ color: "#b6ff38", fontWeight: 900 }}>開く →</a>
              </article>
              <article style={card}>
                <small style={{ color: "#54d8ff", fontWeight: 900 }}>自分で使う</small>
                <h2>自分のクリエイター名鑑</h2>
                <p style={{ color: "#9ca9bb", lineHeight: 1.6 }}>OWNERは参加申請なしで名鑑利用対象になります。</p>
                <a href="#catalog" style={{ color: "#54d8ff", fontWeight: 900 }}>開く →</a>
              </article>
              <article style={card}>
                <small style={{ color: "#b6ff38", fontWeight: 900 }}>管理する</small>
                <h2>INSIGHT管理</h2>
                <p style={{ color: "#9ca9bb", lineHeight: 1.6 }}>参加申請・承認・退会・利用状態を管理します。</p>
                <a href={localStorage.getItem(MEMBER_KEY) ? "#member" : "#access/insight"} style={{ color: "#b6ff38", fontWeight: 900 }}>INSIGHT管理へ →</a>
              </article>
              <article style={card}>
                <small style={{ color: "#ffcf5a", fontWeight: 900 }}>管理する</small>
                <h2>クリエイター名鑑管理</h2>
                <p style={{ color: "#9ca9bb", lineHeight: 1.6 }}>名鑑参加申請・承認・掲載状態をこのページ下部で管理します。</p>
                <a href="#catalog-admin" style={{ color: "#ffcf5a", fontWeight: 900 }}>申請一覧へ ↓</a>
              </article>
            </section>

            <section id="catalog-admin" style={{ marginTop: 34, ...card }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end" }}>
                <div><small style={{ color: "#ffcf5a", fontWeight: 900 }}>CREATOR DIRECTORY ADMIN</small><h2 style={{ fontSize: 30, margin: "5px 0" }}>クリエイター名鑑管理</h2></div>
                <strong>承認待ち {pending.length} / 参加中 {active.length}</strong>
              </div>
              <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
                {submissions.map((s) => (
                  <article key={s.id} style={{ border: "1px solid #2d394c", borderRadius: 14, padding: 14, display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
                    <div><strong>{s.display_name || `@${s.note_id}`}</strong><div style={{ color: "#7f8da1", fontSize: 13 }}>@{s.note_id} · {s.status}</div></div>
                    {s.note_id === "ss_yr" ? <span style={{ color: "#ffcf5a", fontWeight: 900 }}>OWNER</span> : (
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                        {s.status !== "approved" ? <button disabled={busy} onClick={() => void catalogAction(s.id, "approved")} style={{ border: 0, borderRadius: 9, background: "#b6ff38", padding: "8px 10px", fontWeight: 900 }}>承認</button> : null}
                        {s.status === "approved" ? <button disabled={busy} onClick={() => void catalogAction(s.id, "unpublished")} style={{ border: "1px solid #445166", borderRadius: 9, background: "transparent", color: "#fff", padding: "7px 10px" }}>非公開</button> : null}
                        <button disabled={busy} onClick={() => void catalogAction(s.id, "withdrawn")} style={{ border: "1px solid #74404a", borderRadius: 9, background: "transparent", color: "#ffb0b8", padding: "7px 10px" }}>退会</button>
                      </div>
                    )}
                  </article>
                ))}
                {!submissions.length ? <p style={{ color: "#8f9caf" }}>名鑑申請はまだありません。</p> : null}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
