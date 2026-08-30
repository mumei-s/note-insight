import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import "./hub-home.css";

const DIRECTORY_ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-directory-data";
const ICON_ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-icons";
const INSIGHT_PARTICIPANTS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-participants";
const MEMBER_ORIGIN = "https://note-like-tracker.sabosan0404.chatgpt.site";
const OWNER_KEY = "mumei-unified-owner-token", MEMBER_KEY = "mumei-note-insight:member", DEVICE_KEY = "mumei-note-insight:device";

type Creator = { id: string; note_id: string; display_name: string };
type Icon = { noteId: string; image: string | null; profileUrl: string };
type InsightCreator = { id: string; note_id: string; display_name: string; image_url: string | null };
type LegacyInsightCreator = { id: string; noteUrlname: string; noteNickname: string; noteImageUrl: string | null };
type RailPerson = { id: string; noteId: string; name: string; image: string | null; profileUrl: string };

async function syncInsightParticipantsIfOwner() {
  const owner = localStorage.getItem(OWNER_KEY) || "", member = localStorage.getItem(MEMBER_KEY) || "", device = localStorage.getItem(DEVICE_KEY) || "";
  if (!owner || !member || !device) return;
  try {
    const response = await fetch(`${MEMBER_ORIGIN}/api/member/me`, { headers: { Accept: "application/json", "X-Insight-Member": member, "X-Insight-Device": device }, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.isOwner || !Array.isArray(payload?.members)) return;
    const members = payload.members.filter((value: any) => value && (value.role === "owner" || value.status === "active"));
    await fetch(INSIGHT_PARTICIPANTS, { method: "POST", headers: { "Content-Type": "application/json", "X-Owner-Token": owner }, body: JSON.stringify({ action: "sync", members }), cache: "no-store" });
  } catch { /* Public TOP remains available from the last successful sync. */ }
}

function Initial({ name }: { name: string }) { return <span className="hub-person-fallback">{[...name].slice(0, 1).join("") || "n"}</span>; }

function ParticipantRail({ kind, people, loading }: { kind: "insight" | "catalog"; people: RailPerson[]; loading: boolean }) {
  const title = kind === "insight" ? "INSIGHT参加クリエイター" : "名鑑参加クリエイター";
  return <section className={`hub-participants is-${kind}`} aria-label={title}>
    <div className="hub-participant-heading"><strong>{title} <b>{loading ? "—" : people.length}名</b></strong><small>{kind === "catalog" ? "アイコン→名鑑詳細" : "タップ→note"}</small></div>
    {loading ? <div className="hub-participant-loading"><i /><i /><i /></div> : people.length ? <div className="hub-participant-rail">{people.map((person) => kind === "insight" ? (
      <a className="hub-person" key={person.id} href={person.profileUrl} target="_blank" rel="noreferrer" title={`${person.name}のnote`}>
        {person.image ? <img src={person.image} alt="" referrerPolicy="no-referrer" /> : <Initial name={person.name} />}
        <span>{person.name}</span>
      </a>
    ) : (
      <div className="hub-person catalog-person" key={person.id}>
        <a className="hub-person-detail" href={`#catalog/${encodeURIComponent(person.noteId)}`} title={`${person.name}の名鑑詳細`}>
          {person.image ? <img src={person.image} alt="" referrerPolicy="no-referrer" /> : <Initial name={person.name} />}
          <span>{person.name}</span>
        </a>
        <a className="hub-note-link" href={person.profileUrl} target="_blank" rel="noreferrer" aria-label={`${person.name}のnoteを開く`}>note ↗</a>
      </div>
    ))}</div> : <p className="hub-participant-empty">現在、公開中の参加者はいません。</p>}
  </section>;
}

function Entrance({ title, label, copy, href, accent, children }: { title: string; label: string; copy: string; href: string; accent: string; children?: ReactNode }) {
  return <article className="hub-entrance" style={{ "--hub-accent": accent } as CSSProperties}>
    <small>{label}</small><h2>{title}</h2><p>{copy}</p>{children}<a className="hub-open" href={href}>開く →</a>
  </article>;
}

export function HubHome() {
  const [directory, setDirectory] = useState<RailPerson[]>([]);
  const [insight, setInsight] = useState<RailPerson[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [loadingInsight, setLoadingInsight] = useState(true);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch(DIRECTORY_ENDPOINT, { method: "POST", cache: "no-store" });
        const payload = await response.json();
        const creators: Creator[] = response.ok && payload?.ok && Array.isArray(payload.creators) ? payload.creators : [];
        let icons: Record<string, Icon> = {};
        if (creators.length) {
          const iconResponse = await fetch(ICON_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteIds: creators.map((creator) => creator.note_id) }), cache: "no-store" });
          const iconPayload = await iconResponse.json().catch(() => ({}));
          const items: Icon[] = Array.isArray(iconPayload?.items) ? iconPayload.items : [];
          icons = Object.fromEntries(items.map((item) => [item.noteId, item]));
        }
        if (live) setDirectory(creators.map((creator) => ({ id: creator.id, noteId: creator.note_id, name: creator.display_name || `@${creator.note_id}`, image: icons[creator.note_id]?.image ?? null, profileUrl: icons[creator.note_id]?.profileUrl ?? `https://note.com/${creator.note_id}` })));
      } catch { if (live) setDirectory([]); }
      finally { if (live) setLoadingDirectory(false); }
    })();
    void (async () => {
      try {
        await syncInsightParticipantsIfOwner();
        const response = await fetch(INSIGHT_PARTICIPANTS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "public" }), cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        const legacy: LegacyInsightCreator[] = response.ok && Array.isArray(payload?.items) ? payload.items : [];
        const rows: InsightCreator[] = response.ok && Array.isArray(payload?.participants) ? payload.participants : legacy.map((person) => ({ id: person.id, note_id: person.noteUrlname, display_name: person.noteNickname, image_url: person.noteImageUrl }));
        if (live) setInsight(rows.map((person) => ({ id: person.id, noteId: person.note_id, name: person.display_name || `@${person.note_id}`, image: person.image_url, profileUrl: `https://note.com/${person.note_id}` })));
      } catch { if (live) setInsight([]); }
      finally { if (live) setLoadingInsight(false); }
    })();
    return () => { live = false; };
  }, []);

  return <div className="hub-page"><header className="hub-header"><div className="hub-wrap"><a href="#"><span>無名S note</span>CREATOR HUB</a></div></header><main>
    <section className="hub-hero hub-wrap"><p>MUMEI S NOTE CREATOR SYSTEM</p><h1>無名S note<br />CREATOR HUB</h1><span>INSIGHT・名鑑・ゲームをここから切り替えます。</span></section>
    <section className="hub-grid hub-wrap">
      <Entrance title="INSIGHT" label="ANALYTICS" copy="note活動を確認・管理・分析します。" href="#access/insight" accent="#b6ff38"><ParticipantRail kind="insight" people={insight} loading={loadingInsight} /></Entrance>
      <Entrance title="クリエイター名鑑" label="CREATOR DIRECTORY" copy="参加クリエイターのカードや紹介をアルバムのように見る場所です。" href="#catalog" accent="#54d8ff"><ParticipantRail kind="catalog" people={directory} loading={loadingDirectory} /></Entrance>
      <Entrance title="ゲームセンター" label="CREATOR WORLD" copy="名鑑に登録した承認済みカードで遊ぶ、4つのスマホゲーム。" href="#battle" accent="#ffd76b" />
    </section>
  </main></div>;
}
