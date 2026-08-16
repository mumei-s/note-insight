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

function Entrance({
  title,
  label,
  copy,
  href,
  accent,
}: {
  title: string;
  label: string;
  copy: string;
  href: string;
  accent: string;
}) {
  return (
    <article
      style={{
        ...card,
        display: "flex",
        flexDirection: "column",
        minHeight: 285,
        borderColor: `${accent}55`,
      }}
    >
      <small
        style={{
          color: accent,
          fontWeight: 950,
          letterSpacing: ".14em",
        }}
      >
        {label}
      </small>
      <h2 style={{ fontSize: 32, margin: "12px 0 10px" }}>{title}</h2>
      <p
        style={{
          color: "#aab6c8",
          lineHeight: 1.78,
          margin: 0,
          flex: 1,
        }}
      >
        {copy}
      </p>
      <a
        href={href}
        style={{
          ...button,
          marginTop: 24,
          background: accent,
          color: "#071016",
          boxShadow: `0 10px 30px ${accent}22`,
        }}
      >
        開く →
      </a>
    </article>
  );
}

export function HubHome() {
  return (
    <div style={page}>
      <header
        style={{
          borderBottom: "1px solid #202938",
          background: "rgba(7,10,15,.95)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            ...wrap,
            minHeight: 68,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <a
            href="#"
            style={{
              color: "#fff",
              textDecoration: "none",
              fontWeight: 950,
              fontSize: 18,
            }}
          >
            <span
              style={{
                display: "block",
                color: "#b6ff38",
                fontSize: 11,
                letterSpacing: ".16em",
              }}
            >
              無名S note
            </span>
            CREATOR HUB
          </a>
          <span style={{ color: "#7f8ba0", fontSize: 12 }}>
            INSIGHT × 名鑑 × GAME CENTER
          </span>
        </div>
      </header>

      <main>
        <section style={{ ...wrap, padding: "72px 0 38px" }}>
          <p
            style={{
              color: "#b6ff38",
              fontWeight: 950,
              letterSpacing: ".15em",
              margin: 0,
            }}
          >
            MUMEI S NOTE CREATOR SYSTEM
          </p>
          <h1
            style={{
              fontSize: "clamp(38px,7vw,78px)",
              lineHeight: 1.04,
              margin: "14px 0 18px",
              maxWidth: 980,
            }}
          >
            分析する。つながる。遊ぶ。
            <br />
            <span style={{ color: "#b6ff38" }}>3つの入口を、ひとつの場所に。</span>
          </h1>
          <p
            style={{
              maxWidth: 800,
              color: "#aab6c8",
              lineHeight: 1.85,
              fontSize: 16,
            }}
          >
            noteの活動分析はINSIGHT、カードを保存して眺める場所はクリエイター名鑑、
            カードで遊ぶ場所はゲームセンター。利用する機能をここから直接選びます。
          </p>
        </section>

        <section
          style={{
            ...wrap,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
            gap: 18,
            paddingBottom: 76,
          }}
        >
          <Entrance
            title="INSIGHT"
            label="ANALYTICS"
            copy="スキ、コメント、返信、フォロー・フォロワー、マガジン、本人通知、ダッシュボード資料をまとめて確認・分析します。"
            href="#access/insight"
            accent="#b6ff38"
          />
          <Entrance
            title="クリエイター名鑑"
            label="CREATOR DIRECTORY"
            copy="参加クリエイターが自分のカード、紹介文、おすすめ記事をアルバムのように保存・公開する名鑑です。"
            href="#catalog"
            accent="#54d8ff"
          />
          <Entrance
            title="ゲームセンター"
            label="CREATOR WORLD"
            copy="名鑑に登録したカードを使って、選択式・タップ・パズル・シューティングなどのゲームへ進みます。"
            href="#battle"
            accent="#ffd76b"
          />
        </section>

        <section
          style={{
            borderTop: "1px solid #202938",
            background:
              "radial-gradient(circle at 50% 100%,rgba(255,207,90,.08),transparent 55%)",
          }}
        >
          <div style={{ ...wrap, padding: "70px 0 76px" }}>
            <article
              style={{
                ...card,
                borderColor: "#4d4326",
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) auto",
                gap: 24,
                alignItems: "center",
              }}
            >
              <div>
                <small
                  style={{
                    color: "#ffcf5a",
                    fontWeight: 950,
                    letterSpacing: ".14em",
                  }}
                >
                  OWNER ONLY
                </small>
                <h2 style={{ fontSize: 30, margin: "8px 0" }}>管理ページ</h2>
                <p style={{ color: "#9ca9bb", lineHeight: 1.75, margin: 0 }}>
                  INSIGHT参加管理、名鑑申請管理、対戦カード管理など、OWNER専用操作はこちらから。
                </p>
              </div>
              <a
                href="#owner"
                style={{
                  ...button,
                  background: "#ffcf5a",
                  color: "#171000",
                  minWidth: 180,
                }}
              >
                管理ページへ →
              </a>
            </article>
          </div>
        </section>
      </main>

      <footer
        style={{
          borderTop: "1px solid #202938",
          padding: "26px 0",
          color: "#7f8ba0",
        }}
      >
        <div style={wrap}>無名S note CREATOR HUB</div>
      </footer>
    </div>
  );
}
