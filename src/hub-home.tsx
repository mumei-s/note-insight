import { useEffect, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./access-portal";
import "./hub-home.css";

const ACCESS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
const OWNER_KEY = "mumei-unified-owner-token";
type RailPerson = { id: string; noteId: string; name: string; image: string | null; profileUrl: string };

function Initial({ name }: { name: string }) { return <span className="hub-person-fallback">{[...name].slice(0, 1).join("") || "n"}</span>; }

function ParticipantRail({ people, loading }: { people: RailPerson[]; loading: boolean }) {
  return <section className="hub-participants is-insight" aria-label="INSIGHT参加クリエイター">
    <div className="hub-participant-heading"><strong>INSIGHT参加クリエイター <b>{loading ? "—" : people.length}名</b></strong><small>タップ→本人note</small></div>
    {loading ? <div className="hub-participant-loading"><i /><i /><i /></div> : people.length ? <div className="hub-participant-rail">{people.map(person => <a className="hub-person" key={person.id} href={person.profileUrl} target="_blank" rel="noreferrer" title={`${person.name}のnote`}>{person.image ? <img src={person.image} alt="" referrerPolicy="no-referrer" /> : <Initial name={person.name} />}<span>{person.name}</span></a>)}</div> : <p className="hub-participant-empty">本人認証済みの参加クリエイターがここに並びます。</p>}
  </section>;
}

export function HubHome() {
  const [people, setPeople] = useState<RailPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const memberReady = Boolean(localStorage.getItem(INSIGHT_TOKEN_KEY));
  const ownerReady = Boolean(localStorage.getItem(OWNER_KEY));

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch(ACCESS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "public-participants" }), cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        const rows = response.ok && Array.isArray(payload?.participants) ? payload.participants : [];
        if (live) setPeople(rows.map((person: any) => ({ id: String(person.member_id || person.id), noteId: String(person.note_id || ""), name: String(person.display_name || `@${person.note_id}`), image: typeof person.image_url === "string" ? person.image_url : null, profileUrl: `https://note.com/${person.note_id}` })));
      } catch { if (live) setPeople([]); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, []);

  const primaryHref = ownerReady || memberReady ? "#dashboard" : "#access/insight";
  const primaryLabel = ownerReady || memberReady ? "自分のINSIGHTを開く →" : "参加申請・ログイン →";

  return <div className="hub-page"><header className="hub-header"><div className="hub-wrap"><a href="#"><span>無名S note</span>INSIGHT</a>{ownerReady ? <a href="#manage" style={{ marginLeft: "auto", color: "#ffcf69", fontSize: 12 }}>管理ページ</a> : null}</div></header><main>
    <section className="hub-hero hub-wrap"><p>NOTE CREATOR ANALYTICS</p><h1>無名S note<br />INSIGHT</h1><span>noteの反応を「誰が・どの記事に・どれだけ応援しているか」まで蓄積して見る、参加制のクリエイター分析ツール。</span></section>

    <section className="hub-wrap" style={{ paddingBottom: 16 }}><article className="hub-entrance" style={{ maxWidth: 900, margin: "0 auto", minHeight: 0, borderColor: "#486522" }}><small style={{ color: "#b6ff38" }}>PAID MEMBER ACCESS</small><h2>INSIGHT</h2><p>購入者は参加申請後、OWNER承認とnote自己紹介欄を使った本人確認を行います。認証後は共通パスワードなしで本人専用INSIGHTを利用できます。</p><ParticipantRail people={people} loading={loading}/><a className="hub-open" href={primaryHref} style={{ background: "#b6ff38" }}>{primaryLabel}</a></article></section>

    <section className="hub-wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10, padding: "8px 0 24px" }}>
      {[['01','購入・参加申請','販売用URLは固定。購入者が自分のnote IDで参加申請します。'],['02','OWNER承認','申請はINSIGHT専用管理ページに届き、OWNERが購入者を承認します。'],['03','noteで本人確認','発行コードを自己紹介欄へ一時掲載して保存し、INSIGHT側で確認します。'],['04','利用開始','確認後は自己紹介を元に戻せます。本人アイコンがTOP参加者一覧へ追加されます。']].map(([no,title,copy]) => <article key={no} style={{ border: "1px solid #273446", borderRadius: 16, background: "#0d141d", padding: 16 }}><small style={{ color: "#b6ff38", fontWeight: 950 }}>{no}</small><strong style={{ display: "block", margin: "5px 0", fontSize: 16 }}>{title}</strong><p style={{ color: "#8d9caf", fontSize: 12, lineHeight: 1.7, margin: 0 }}>{copy}</p></article>)}
    </section>

    <section className="hub-wrap" style={{ padding: "8px 0 115px" }}><article style={{ border: "1px solid #28394c", borderRadius: 18, background: "#0d141d", padding: 18 }}><small style={{ color: "#8feaff", fontWeight: 950 }}>CROSS PLATFORM</small><h2 style={{ margin: "5px 0" }}>端末・ブラウザを固定しない</h2><p style={{ color: "#8d9caf", lineHeight: 1.75, marginBottom: 0 }}>初回認証後に発行されたnote ID＋パスコードで、別のスマホ・PC・ブラウザからも同じ固定URLへログインできます。参加者画面には「アプリ更新」を用意し、URLを変更せず最新版へ更新できます。</p></article></section>
  </main></div>;
}
