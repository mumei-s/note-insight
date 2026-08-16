import type { CSSProperties } from "react";

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#070a0f",
  color: "#f7f9fc",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const wrap: CSSProperties = {
  width: "min(1180px, calc(100% - 28px))",
  margin: "0 auto",
};

const card: CSSProperties = {
  border: "1px solid #253042",
  borderRadius: 24,
  background: "linear-gradient(180deg,#101722,#0b1017)",
  padding: 24,
  boxShadow: "0 18px 55px rgba(0,0,0,.25)",
};

const button: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 50,
  borderRadius: 14,
  padding: "0 18px",
  fontWeight: 950,
  textDecoration: "none",
};

function Entrance({ title, label, copy, href, accent }: { title: string; label: string; copy: string; href: string; accent: string }) {
  return (
    <article style={{ ...card, display: "flex", flexDirection: "column", minHeight: 270, borderColor: `${accent}55` }}>
      <small style={{ color: accent, fontWeight: 950, letterSpacing: ".14em" }}>{label}</small>
      <h2 style={{ fontSize: 32, margin: "12px 0 10px" }}>{title}</h2>
      <p style={{ color: "#aab6c8", lineHeight: 1.78, margin: 0, flex: 1 }}>{copy}</p>
      <a href={href} style={{ ...button, marginTop: 24, background: accent, color: "#071016" }}>開く →</a>
    </article>
  );
}

export function HubHome() {
  return (
    <div style={page}>
      <header style={{ borderBottom: "1px solid #202938", background: "rgba(7,10,15,.95)" }}>
        <div style={{ ...wrap, minHeight: 68, display: "flex", alignItems: "center" }}>
          <a href="#" style={{ color: "#fff", textDecoration: "none", fontWeight: 950, fontSize: 18 }}>
            <span style={{ display: "block", color: "#b6ff38", fontSize: 11, letterSpacing: ".16em" }}>無名S note</span>
            CREATOR HUB
          </a>
        </div>
      </header>

      <main>
        <section style={{ ...wrap, padding: "66px 0 34px" }}>
          <p style={{ color: "#b6ff38", fontWeight: 950, letterSpacing: ".15em", margin: 0 }}>MUMEI S NOTE CREATOR SYSTEM</p>
          <h1 style={{ fontSize: "clamp(40px,7vw,76px)", lineHeight: 1.05, margin: "14px 0 18px" }}>
            無名S note CREATOR HUB
          </h1>
          <p style={{ maxWidth: 760, color: "#aab6c8", lineHeight: 1.85 }}>
            使いたい機能を選択してください。
          </p>
        </section>

        <section style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 18, paddingBottom: 100 }}>
          <Entrance title="INSIGHT" label="ANALYTICS" copy="note活動を確認・管理・分析します。" href="#access/insight" accent="#b6ff38" />
          <Entrance title="クリエイター名鑑" label="CREATOR DIRECTORY" copy="参加クリエイターのカードや紹介をアルバムのように見る場所です。" href="#catalog" accent="#54d8ff" />
          <Entrance title="ゲームセンター" label="CREATOR WORLD" copy="名鑑に登録したカードで遊ぶゲームエリアです。" href="#battle" accent="#ffd76b" />
        </section>

        <section style={{ borderTop: "1px solid #202938", background: "#080b10" }}>
          <div style={{ ...wrap, padding: "76px 0 84px" }}>
            <article style={{ ...card, borderColor: "#4d4326", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 24, alignItems: "center" }}>
              <div>
                <small style={{ color: "#ffcf5a", fontWeight: 950, letterSpacing: ".14em" }}>OWNER ONLY</small>
                <h2 style={{ fontSize: 30, margin: "8px 0" }}>管理ページ</h2>
                <p style={{ color: "#9ca9bb", lineHeight: 1.75, margin: 0 }}>OWNER専用の管理機能はこちら。</p>
              </div>
              <a href="#owner" style={{ ...button, background: "#ffcf5a", color: "#171000", minWidth: 180 }}>管理ページへ →</a>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
