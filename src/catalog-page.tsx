import { useEffect, useMemo, useState } from "react";

const ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-world";
const MEMBER_KEY = "mumei-note-insight:member";
const DEVICE_KEY = "mumei-note-insight:device";

type Creator = {
  id: string;
  note_id: string;
  display_name: string;
  intro: string;
  job: string;
  rarity: string;
  article1_url: string;
  article2_url: string;
};
type Submission = Creator & { status: string };

type PublicPayload = {
  series: { id: string; title: string; main_title: string; hashtag: string; announcement: string; recruit_url: string; magazine_url: string }[];
  creators: Creator[];
};

function headers() {
  return {
    "Content-Type": "application/json",
    "X-Insight-Member": localStorage.getItem(MEMBER_KEY) ?? "",
    "X-Insight-Device": localStorage.getItem(DEVICE_KEY) ?? "",
  };
}

async function call(action: string) {
  const response = await fetch(ENDPOINT, { method: "POST", headers: headers(), body: JSON.stringify({ action }) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error ?? "読み込めませんでした。");
  return payload;
}

export function CatalogPage() {
  const [data, setData] = useState<PublicPayload | null>(null);
  const [mine, setMine] = useState<Submission | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const series = data?.series?.[0];
  const creators = useMemo(() => data?.creators ?? [], [data]);

  async function load() {
    setMessage("");
    const response = await call("public");
    setData(response);
    if (localStorage.getItem(MEMBER_KEY)) {
      try {
        const me = await call("me");
        setMine(me.submission ?? null);
      } catch {
        // Public directory remains viewable without participant login.
      }
    }
  }

  useEffect(() => { void load(); }, []);

  async function apply() {
    setBusy(true); setMessage("");
    try {
      if (!localStorage.getItem(MEMBER_KEY)) {
        window.location.hash = "access/catalog";
        return;
      }
      const payload = await call("apply");
      setMine(payload.submission);
      setMessage(payload.submission?.status === "approved" ? "名鑑を利用できます。" : "クリエイター名鑑の参加申請を送りました。");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "申請できませんでした。");
    } finally { setBusy(false); }
  }

  async function withdraw() {
    if (!confirm("クリエイター名鑑から退会しますか？")) return;
    setBusy(true); setMessage("");
    try {
      const payload = await call("withdraw");
      setMine(payload.submission);
      setMessage("クリエイター名鑑から退会しました。");
    } catch (e) { setMessage(e instanceof Error ? e.message : "退会できませんでした。"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#070a0f", color: "#f6f8fb" }}>
      <header style={{ borderBottom: "1px solid #202938", padding: "18px 14px" }}>
        <div style={{ width: "min(1120px,100%)", margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <a href="#" style={{ color: "#fff", textDecoration: "none", fontWeight: 900 }}>無名S note</a>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="#access/catalog" style={{ color: "#54d8ff", textDecoration: "none", fontWeight: 800 }}>ログイン</a>
            <a href="#manage" style={{ color: "#ffcf5a", textDecoration: "none", fontWeight: 800 }}>管理</a>
          </div>
        </div>
      </header>

      <main style={{ width: "min(1120px,calc(100% - 28px))", margin: "0 auto", padding: "56px 0" }}>
        <p style={{ color: "#54d8ff", fontWeight: 900, letterSpacing: ".14em" }}>CREATOR DIRECTORY</p>
        <h1 style={{ fontSize: "clamp(38px,7vw,68px)", margin: "10px 0" }}>{series?.main_title ?? "冒険クリエイター名鑑"}</h1>
        <p style={{ color: "#9ca9bb", lineHeight: 1.8, maxWidth: 760 }}>
          noteクリエイターをカード・紹介・記事・バトルでつなぐ名鑑です。参加申請と退会はINSIGHTとは別に管理します。
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "24px 0 40px" }}>
          {!mine || mine.status === "withdrawn" || mine.status === "unpublished" ? (
            <button disabled={busy} onClick={() => void apply()} style={{ border: 0, borderRadius: 12, background: "#54d8ff", color: "#071016", padding: "12px 18px", fontWeight: 900 }}>参加申請</button>
          ) : null}
          {mine?.status === "pending" ? <span style={{ padding: "12px 16px", borderRadius: 12, background: "#382f17", color: "#ffcf5a", fontWeight: 900 }}>承認待ち</span> : null}
          {mine?.status === "approved" ? (
            <>
              <span style={{ padding: "12px 16px", borderRadius: 12, background: "#163422", color: "#7dffad", fontWeight: 900 }}>参加中</span>
              <button disabled={busy} onClick={() => void withdraw()} style={{ border: "1px solid #3b4658", borderRadius: 12, background: "transparent", color: "#fff", padding: "11px 16px", fontWeight: 800 }}>退会</button>
            </>
          ) : null}
          {series?.recruit_url ? <a href={series.recruit_url} target="_blank" rel="noreferrer" style={{ padding: "12px 16px", borderRadius: 12, background: "#17202d", color: "#fff", textDecoration: "none", fontWeight: 800 }}>募集記事 ↗</a> : null}
          {series?.magazine_url ? <a href={series.magazine_url} target="_blank" rel="noreferrer" style={{ padding: "12px 16px", borderRadius: 12, background: "#17202d", color: "#fff", textDecoration: "none", fontWeight: 800 }}>専用マガジン ↗</a> : null}
        </div>
        {message ? <div style={{ border: "1px solid #334158", borderRadius: 12, padding: 14, marginBottom: 24, color: "#dce4ef" }}>{message}</div> : null}

        <section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "end" }}>
            <div><small style={{ color: "#54d8ff", fontWeight: 900 }}>MEMBERS</small><h2 style={{ fontSize: 34, margin: "5px 0" }}>クリエイター一覧</h2></div>
            <strong>{creators.length}名</strong>
          </div>
          {creators.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 18 }}>
              {creators.map((creator) => (
                <article key={creator.id} style={{ border: "1px solid #253042", borderRadius: 20, background: "linear-gradient(180deg,#101722,#0b1017)", padding: 18, minHeight: 230 }}>
                  <small style={{ color: "#54d8ff", fontWeight: 900 }}>{creator.rarity || "Normal"}</small>
                  <h3 style={{ fontSize: 23, marginBottom: 4 }}>{creator.display_name || `@${creator.note_id}`}</h3>
                  <div style={{ color: "#7f8da1", fontSize: 13 }}>@{creator.note_id}{creator.job ? ` · ${creator.job}` : ""}</div>
                  <p style={{ color: "#aab5c6", lineHeight: 1.65 }}>{creator.intro || "プロフィール準備中"}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                    <a href={`https://note.com/${creator.note_id}`} target="_blank" rel="noreferrer" style={{ color: "#54d8ff" }}>note ↗</a>
                    {creator.article1_url ? <a href={creator.article1_url} target="_blank" rel="noreferrer" style={{ color: "#fff" }}>記事1 ↗</a> : null}
                    {creator.article2_url ? <a href={creator.article2_url} target="_blank" rel="noreferrer" style={{ color: "#fff" }}>記事2 ↗</a> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div style={{ border: "1px dashed #344156", borderRadius: 18, padding: 28, color: "#8f9caf", marginTop: 18 }}>公開中の参加クリエイターはまだありません。</div>
          )}
        </section>

        <section style={{ marginTop: 58, borderTop: "1px solid #202938", paddingTop: 42 }}>
          <small style={{ color: "#ffcf5a", fontWeight: 900 }}>BATTLE</small>
          <h2 style={{ fontSize: 34 }}>クリエイターバトル</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "stretch" }}>
            <div style={{ border: "1px solid #2b4960", borderRadius: 18, padding: 20, background: "#0d1a24" }}><b>CREATOR A</b><p style={{ color: "#9ba8bb" }}>カード・ジョブ・必殺技</p></div>
            <div style={{ display: "grid", placeItems: "center", color: "#ffcf5a", fontWeight: 950 }}>VS</div>
            <div style={{ border: "1px solid #51305a", borderRadius: 18, padding: 20, background: "#1b1020" }}><b>CREATOR B</b><p style={{ color: "#9ba8bb" }}>対戦・勝利数・ランキング</p></div>
          </div>
        </section>
      </main>
    </div>
  );
}
