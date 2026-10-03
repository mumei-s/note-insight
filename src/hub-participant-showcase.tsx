import { useEffect, useState, type CSSProperties } from "react";
import { CreatorAvatar } from "./creator-avatar";
import { useVisibleMotion } from "./insight-visible-motion";
import "./hub-participant-showcase.css";

type Person = { id: string; noteId: string; name: string; image: string | null; profileUrl: string };
export function ParticipantShowcase({ people }: { people: Person[] }) {
  const { ref, motion } = useVisibleMotion(), [index, setIndex] = useState(0), [paused, setPaused] = useState(false), [hover, setHover] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null), active = people.length ? index % people.length : 0, person = people[active];
  useEffect(() => {
    if (!motion || paused || hover || people.length < 2) return;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % people.length), 5800);
    return () => window.clearInterval(timer);
  }, [motion, paused, hover, people.length]);
  function move(step: number) { setPaused(true); setIndex(i => (i + step + people.length) % people.length); }
  const satellites = people.length <= 5 ? people : Array.from({ length: 5 }, (_, slot) => people[(active + slot + people.length - 2) % people.length]);
  if (!person) return null;
  return <div ref={ref} className="hub-showcase" data-motion={motion ? "on" : "off"} aria-label="参加クリエイターの光のレール">
    <div className="hub-showcase-stage" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocusCapture={() => setPaused(true)} onPointerDown={e => setStart({ x: e.clientX, y: e.clientY })} onPointerUp={e => {
      if (start) { const dx = e.clientX - start.x, dy = e.clientY - start.y; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) move(dx < 0 ? 1 : -1); } setStart(null);
    }} onPointerCancel={() => setStart(null)}>
      <div className="hub-showcase-rails" aria-hidden="true"><i/><i/><i/></div>
      <div className="hub-showcase-satellites">{satellites.map((p, slot) => <button key={p.id} className={p.id === person.id ? "selected" : ""} style={{ "--x": `${satellites.length === 1 ? 50 : 12 + slot * 76 / (satellites.length - 1)}%`, "--y": `${54 - slot * 9}px` } as CSSProperties} onClick={() => { setPaused(true); setIndex(people.findIndex(x => x.id === p.id)); }} aria-label={`${p.name}を表示`} aria-pressed={p.id === person.id}><CreatorAvatar person={p} name={p.name} className="hub-showcase-satellite-avatar"/><span>{p.name}</span></button>)}</div>
      <div className="hub-showcase-plane" aria-hidden="true"/>
      <a key={person.id} className="hub-showcase-focus" href={person.profileUrl} target="_blank" rel="noreferrer" title={`${person.name}のnote`}>
        <div className="hub-showcase-portrait"><CreatorAvatar person={person} name={person.name} className="hub-showcase-avatar" eager/><i aria-hidden="true"/></div>
        <div className="hub-showcase-identity"><small>CREATOR SPOTLIGHT</small><b>{person.name}</b><span>@{person.noteId}</span><em>本人のnoteへ ↗</em></div>
      </a>
      <div key={`particles-${person.id}`} className="hub-showcase-particles" aria-hidden="true">{Array.from({length:7},(_,i)=><i key={i} style={{"--p":i} as CSSProperties}/>)}</div>
    </div>
    <div className="hub-showcase-controls"><button disabled={people.length < 2} onClick={() => move(-1)} aria-label="前のクリエイター">←</button><button disabled={people.length < 2} onClick={() => setPaused(v => !v)} aria-pressed={paused}>{paused ? "▶ 再生" : "Ⅱ 停止"}</button><span aria-live={paused ? "polite" : "off"}>{active + 1} / {people.length}</span><button disabled={people.length < 2} onClick={() => move(1)} aria-label="次のクリエイター">→</button></div>
    <section className="hub-showcase-all" aria-label="参加クリエイター全員"><header>参加クリエイター全員 <span>{people.length}名</span></header><div>{people.map(p => <a key={p.id} href={p.profileUrl} target="_blank" rel="noreferrer"><CreatorAvatar person={p} name={p.name} className="hub-showcase-list-avatar"/><span>{p.name}</span></a>)}</div></section>
  </div>;
}
