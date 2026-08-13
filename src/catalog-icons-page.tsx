import { useEffect, useState } from "react";

const DIRECTORY_ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-world";
const ICON_ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-icons";
const GAME_ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-game-data";

type Creator = { id: string; note_id: string };
type Icon = { noteId: string; image: string | null; profileUrl: string };
type Series = { main_title: string; recruit_url: string; magazine_url: string };
type GameCard = { id: string; name: string; rarity: string; image_url: string | null };

export function CatalogIconsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [icons, setIcons] = useState<Record<string, Icon>>({});
  const [series, setSeries] = useState<Series | null>(null);
  const [gameCards, setGameCards] = useState<GameCard[]>([]);

  useEffect(() => {
    void (async () => {
      const [response, gameResponse] = await Promise.all([
        fetch(DIRECTORY_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "public" }) }),
        fetch(GAME_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }),
      ]);
      const payload = await response.json();
      const gamePayload = await gameResponse.json().catch(() => ({}));
      const nextCreators = Array.isArray(payload?.creators) ? payload.creators : [];
      setCreators(nextCreators);
      setSeries(Array.isArray(payload?.series) ? payload.series[0] ?? null : null);
      setGameCards(Array.isArray(gamePayload?.opponents) ? gamePayload.opponents.slice(0, 3) : []);
      if (!nextCreators.length) return;
      const iconResponse = await fetch(ICON_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteIds: nextCreators.map((item: Creator) => item.note_id) }) });
      const iconPayload = await iconResponse.json().catch(() => ({}));
      const items: Icon[] = Array.isArray(iconPayload?.items) ? iconPayload.items : [];
      setIcons(Object.fromEntries(items.map((item) => [item.noteId, item])));
    })();
  }, []);

  return <div className="catalog-icons-page">
    <style>{`
      .catalog-icons-page{min-height:100vh;background:#070a0f;color:#f6f8fb;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.catalog-icons-head{border-bottom:1px solid #202938;padding:18px 14px}.catalog-icons-head>div,.catalog-icons-main{width:min(1120px,calc(100% - 28px));margin:0 auto}.catalog-icons-head>div{display:flex;justify-content:space-between;align-items:center;gap:12px}.catalog-icons-main{padding:52px 0 64px}.catalog-icons-page a{text-decoration:none}.catalog-icons-back{color:#fff;font-weight:900}.catalog-icons-login{color:#54d8ff;font-weight:900}.catalog-icons-kicker{color:#54d8ff;font-weight:900;letter-spacing:.14em}.catalog-icons-title{font-size:clamp(38px,7vw,68px);margin:8px 0 12px}.catalog-icons-copy{color:#9ca9bb;line-height:1.8;max-width:760px}.catalog-icons-actions{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0 42px}.catalog-icons-actions a{padding:11px 15px;border-radius:12px;background:#17202d;color:#fff;font-weight:800}.catalog-icons-actions a:first-child{background:#54d8ff;color:#071016}.catalog-icon-heading{display:flex;justify-content:space-between;align-items:end;gap:12px}.catalog-icon-heading h2{font-size:32px;margin:5px 0}.catalog-icon-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-top:20px}.catalog-icon{display:block;aspect-ratio:1;border-radius:50%;padding:3px;background:linear-gradient(145deg,#54d8ff,#263549 52%,#ffcf5a);box-shadow:0 8px 24px rgba(0,0,0,.28)}.catalog-icon img,.catalog-icon span{width:100%;height:100%;display:grid;place-items:center;border-radius:50%;object-fit:cover;background:#17202d;color:#54d8ff;font-size:24px;font-weight:950;border:2px solid #070a0f}.world-gate{margin-top:68px;border-top:1px solid #202938;padding-top:48px}.world-gate-inner{border:1px solid #493b6b;border-radius:26px;background:radial-gradient(circle at 50% 0,#2a1d41,#0c1119 58%);padding:24px;overflow:hidden}.world-gate-head small{color:#ffd76b;font-weight:950;letter-spacing:.16em}.world-gate-head h2{font-size:clamp(36px,7vw,64px);margin:5px 0}.world-gate-head p{color:#a5b0c1}.world-card-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:22px 0}.world-card{position:relative;aspect-ratio:3/4;border:1px solid #4c4765;border-radius:16px;overflow:hidden;background:#131824}.world-card img{width:100%;height:100%;object-fit:cover}.world-card div{position:absolute;left:8px;right:8px;bottom:8px;padding:8px;border-radius:9px;background:rgba(4,6,10,.8)}.world-card small{color:#ffd76b;font-weight:900}.world-card b{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.world-enter{display:flex;justify-content:center;align-items:center;min-height:54px;border-radius:14px;background:#ffd76b;color:#160e00;font-weight:950;font-size:18px}.world-modes{text-align:center;color:#8f9caf;font-size:12px;margin-top:10px}@media(min-width:720px){.catalog-icon-grid{grid-template-columns:repeat(10,minmax(0,1fr));gap:18px}.world-gate-inner{padding:34px}.world-card-row{width:min(700px,100%);margin:26px auto}}
    `}</style>
    <header className="catalog-icons-head"><div><a className="catalog-icons-back" href="#">無名S note</a><a className="catalog-icons-login" href="#access/catalog">ログイン・参加</a></div></header>
    <main className="catalog-icons-main">
      <p className="catalog-icons-kicker">CREATOR DIRECTORY</p><h1 className="catalog-icons-title">{series?.main_title ?? "冒険クリエイター名鑑"}</h1><p className="catalog-icons-copy">参加クリエイターはアイコン一覧で表示。タップすると本人のnoteクリエイターページへ移動します。</p>
      <div className="catalog-icons-actions"><a href="#access/catalog">ログイン・参加申請</a>{series?.recruit_url?<a href={series.recruit_url} target="_blank" rel="noreferrer">募集記事 ↗</a>:null}{series?.magazine_url?<a href={series.magazine_url} target="_blank" rel="noreferrer">専用マガジン ↗</a>:null}</div>
      <section><div className="catalog-icon-heading"><div><p className="catalog-icons-kicker">MEMBERS</p><h2>参加クリエイター</h2></div><strong>{creators.length}名</strong></div><div className="catalog-icon-grid">{creators.map((creator)=>{const icon=icons[creator.note_id];return <a key={creator.id} className="catalog-icon" href={icon?.profileUrl??`https://note.com/${creator.note_id}`} target="_blank" rel="noreferrer" aria-label={`@${creator.note_id} のnoteページを開く`}>{icon?.image?<img src={icon.image} alt="" referrerPolicy="no-referrer"/>:<span>n</span>}</a>})}</div></section>
      <section className="world-gate"><div className="world-gate-inner"><div className="world-gate-head"><small>CREATOR WORLD</small><h2>バトル・ゲーム</h2><p>カードを選び、4つのゲームモードへ。</p></div><div className="world-card-row">{gameCards.map(card=><article className="world-card" key={card.id}>{card.image_url?<img src={card.image_url} alt=""/>:null}<div><small>{card.rarity}</small><b>{card.name}</b></div></article>)}</div><a className="world-enter" href="#battle">CREATOR WORLDへ入る →</a><div className="world-modes">COMMAND / TAP RUSH / ARCANE PUZZLE / STAR SHOOTER</div></div></section>
    </main>
  </div>;
}
