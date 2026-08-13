import { useEffect, useState } from "react";

const DIRECTORY_ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-world";
const ICON_ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-icons";

type Creator = { id: string; note_id: string };
type Icon = { noteId: string; image: string | null; profileUrl: string };
type Series = { main_title: string; recruit_url: string; magazine_url: string };

export function CatalogIconsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [icons, setIcons] = useState<Record<string, Icon>>({});
  const [series, setSeries] = useState<Series | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch(DIRECTORY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "public" }),
      });
      const payload = await response.json();
      const nextCreators = Array.isArray(payload?.creators) ? payload.creators : [];
      setCreators(nextCreators);
      setSeries(Array.isArray(payload?.series) ? payload.series[0] ?? null : null);
      if (!nextCreators.length) return;
      const iconResponse = await fetch(ICON_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteIds: nextCreators.map((item: Creator) => item.note_id) }),
      });
      const iconPayload = await iconResponse.json().catch(() => ({}));
      const items: Icon[] = Array.isArray(iconPayload?.items) ? iconPayload.items : [];
      setIcons(Object.fromEntries(items.map((item) => [item.noteId, item])));
    })();
  }, []);

  return (
    <div className="catalog-icons-page">
      <style>{`
        .catalog-icons-page{min-height:100vh;background:#070a0f;color:#f6f8fb;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .catalog-icons-head{border-bottom:1px solid #202938;padding:18px 14px}
        .catalog-icons-head>div,.catalog-icons-main{width:min(1120px,calc(100% - 28px));margin:0 auto}
        .catalog-icons-head>div{display:flex;justify-content:space-between;align-items:center;gap:12px}
        .catalog-icons-main{padding:52px 0 64px}
        .catalog-icons-page a{text-decoration:none}
        .catalog-icons-back{color:#fff;font-weight:900}.catalog-icons-login{color:#54d8ff;font-weight:900}
        .catalog-icons-kicker{color:#54d8ff;font-weight:900;letter-spacing:.14em}
        .catalog-icons-title{font-size:clamp(38px,7vw,68px);margin:8px 0 12px}
        .catalog-icons-copy{color:#9ca9bb;line-height:1.8;max-width:760px}
        .catalog-icons-actions{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0 42px}
        .catalog-icons-actions a{padding:11px 15px;border-radius:12px;background:#17202d;color:#fff;font-weight:800}
        .catalog-icons-actions a:first-child{background:#54d8ff;color:#071016}
        .catalog-icon-heading{display:flex;justify-content:space-between;align-items:end;gap:12px}
        .catalog-icon-heading h2{font-size:32px;margin:5px 0}.catalog-icon-heading strong{color:#dbe5f2}
        .catalog-icon-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-top:20px}
        .catalog-icon{display:block;aspect-ratio:1;border-radius:50%;padding:3px;background:linear-gradient(145deg,#54d8ff,#263549 52%,#ffcf5a);box-shadow:0 8px 24px rgba(0,0,0,.28)}
        .catalog-icon:active{transform:scale(.94)}
        .catalog-icon img,.catalog-icon span{width:100%;height:100%;display:grid;place-items:center;border-radius:50%;object-fit:cover;background:#17202d;color:#54d8ff;font-size:24px;font-weight:950;border:2px solid #070a0f}
        .catalog-battle{margin-top:58px;border-top:1px solid #202938;padding-top:42px}.catalog-battle small{color:#ffcf5a;font-weight:900}.catalog-battle h2{font-size:32px}
        .catalog-vs{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:stretch}.catalog-vs>div{border:1px solid #2b4960;border-radius:18px;padding:20px;background:#0d1a24}.catalog-vs>strong{display:grid;place-items:center;color:#ffcf5a}
        @media(min-width:720px){.catalog-icon-grid{grid-template-columns:repeat(10,minmax(0,1fr));gap:18px}}
      `}</style>
      <header className="catalog-icons-head"><div><a className="catalog-icons-back" href="#">無名S note</a><a className="catalog-icons-login" href="#access/catalog">ログイン・参加</a></div></header>
      <main className="catalog-icons-main">
        <p className="catalog-icons-kicker">CREATOR DIRECTORY</p>
        <h1 className="catalog-icons-title">{series?.main_title ?? "冒険クリエイター名鑑"}</h1>
        <p className="catalog-icons-copy">参加クリエイターはアイコン一覧で表示します。アイコンをタップすると、その人のnoteクリエイターページへ移動します。</p>
        <div className="catalog-icons-actions">
          <a href="#access/catalog">ログイン・参加申請</a>
          {series?.recruit_url ? <a href={series.recruit_url} target="_blank" rel="noreferrer">募集記事 ↗</a> : null}
          {series?.magazine_url ? <a href={series.magazine_url} target="_blank" rel="noreferrer">専用マガジン ↗</a> : null}
        </div>
        <section>
          <div className="catalog-icon-heading"><div><p className="catalog-icons-kicker">MEMBERS</p><h2>参加クリエイター</h2></div><strong>{creators.length}名</strong></div>
          <div className="catalog-icon-grid">
            {creators.map((creator) => {
              const icon = icons[creator.note_id];
              return <a key={creator.id} className="catalog-icon" href={icon?.profileUrl ?? `https://note.com/${creator.note_id}`} target="_blank" rel="noreferrer" aria-label={`@${creator.note_id} のnoteページを開く`}>
                {icon?.image ? <img src={icon.image} alt="" referrerPolicy="no-referrer" /> : <span>n</span>}
              </a>;
            })}
          </div>
        </section>
        <section className="catalog-battle"><small>BATTLE</small><h2>クリエイターバトル</h2><div className="catalog-vs"><div>CREATOR CARD</div><strong>VS</strong><div>CREATOR CARD</div></div></section>
      </main>
    </div>
  );
}
