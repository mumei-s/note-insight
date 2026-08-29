import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  GameResultOverlay,
  HpBar,
  PreludeOverlay,
  resultExp,
  useBattlePrelude,
  type GameResult,
  type GameSessionProps,
} from "./game-ui";
import { randomInt } from "./game-types";

type Target = { id: number; x: number; y: number; size: number; critical: boolean };
type Hit = { id: number; x: number; y: number; text: string };

export function TargetRushBattle(props: GameSessionProps) {
  const { phase, restartPrelude } = useBattlePrelude();
  const [time, setTime] = useState(18);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bossHp, setBossHp] = useState(100);
  const [ultimate, setUltimate] = useState(0);
  const [targets, setTargets] = useState<Target[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [aim, setAim] = useState({ x: 50, y: 52 });
  const [nova, setNova] = useState(false);
  const [outcome, setOutcome] = useState<GameResult | null>(null);
  const refs = useRef({ hp: 100, score: 0, combo: 0 });

  function conclude(result?: GameResult) {
    if (outcome) return;
    setOutcome(result ?? (refs.current.hp <= 0 ? "win" : refs.current.hp <= 20 ? "draw" : "lose"));
  }

  useEffect(() => {
    if (phase !== "live" || outcome) return;
    let serial = 0;
    const spawn = window.setInterval(() => {
      serial += 1;
      setTargets((value) => [...value.slice(-5), {
        id: Date.now() + serial,
        x: randomInt(8, 88), y: randomInt(12, 79), size: randomInt(42, 76), critical: Math.random() < 0.27,
      }]);
    }, combo >= 10 ? 340 : 500);
    const clock = window.setInterval(() => setTime((value) => {
      const next = Math.max(0, +(value - 0.1).toFixed(1));
      if (next === 0) conclude();
      return next;
    }), 100);
    return () => { window.clearInterval(spawn); window.clearInterval(clock); };
  }, [phase, outcome, combo >= 10]);

  function moveAim(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setAim({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
  }

  function miss(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || phase !== "live" || outcome) return;
    refs.current.combo = 0;
    setCombo(0);
  }

  function hit(event: ReactPointerEvent<HTMLButtonElement>, target: Target) {
    event.stopPropagation();
    if (phase !== "live" || outcome) return;
    const nextCombo = refs.current.combo + 1;
    const critical = target.critical || target.size < 52;
    const damage = critical ? 8 : 4;
    const hp = Math.max(0, refs.current.hp - damage);
    const gain = Math.round((220 + nextCombo * 45) * (critical ? 2 : 1));
    const nextScore = refs.current.score + gain;
    refs.current = { hp, score: nextScore, combo: nextCombo };
    setTargets((value) => value.filter((item) => item.id !== target.id));
    setBossHp(hp);
    setScore(nextScore);
    setCombo(nextCombo);
    setUltimate((value) => Math.min(100, value + (critical ? 18 : 11)));
    const marker = { id: Date.now(), x: target.x, y: target.y, text: critical ? `CRITICAL ${gain}` : `+${gain}` };
    setHits((value) => [...value.slice(-5), marker]);
    window.setTimeout(() => setHits((value) => value.filter((item) => item.id !== marker.id)), 620);
    if (hp <= 0) conclude("win");
  }

  function fireUltimate() {
    if (ultimate < 100 || phase !== "live" || outcome) return;
    const hp = Math.max(0, refs.current.hp - 30);
    const nextScore = refs.current.score + 6200;
    refs.current.hp = hp;
    refs.current.score = nextScore;
    setBossHp(hp);
    setScore(nextScore);
    setUltimate(0);
    setTargets([]);
    setNova(true);
    window.setTimeout(() => setNova(false), 720);
    if (hp <= 0) conclude("win");
  }

  function reset() {
    refs.current = { hp: 100, score: 0, combo: 0 };
    setTime(18);
    setScore(0);
    setCombo(0);
    setBossHp(100);
    setUltimate(0);
    setTargets([]);
    setHits([]);
    setAim({ x: 50, y: 52 });
    setNova(false);
    setOutcome(null);
    restartPrelude();
  }

  return (
    <div className={`g4-game g4-shooter ${nova ? "is-nova" : ""}`}>
      <PreludeOverlay phase={phase} playerName={props.playerName} enemyName={props.enemyName} />
      <div className="g4-shooter-top"><span>SCORE <b>{score.toLocaleString()}</b></span><strong>STAR SHOOTER</strong><span>COMBO <b>×{combo}</b></span></div>
      <div className="g4-boss-hud"><div><small>BOSS CARD</small><strong>{props.enemyName}</strong></div><HpBar value={bossHp} enemy /></div>
      <div className="g4-shoot-field" onPointerMove={moveAim} onPointerDown={miss}>
        {props.enemyArt ? <img className="g4-boss-card" src={props.enemyArt} alt={`${props.enemyName}のボスカード`} /> : null}
        <div className="g4-space-depth" />
        {phase === "live" && !outcome ? targets.map((target) => (
          <button key={target.id} className={target.critical ? "critical" : ""} style={{ left: `${target.x}%`, top: `${target.y}%`, width: target.size, height: target.size }} onPointerDown={(event) => hit(event, target)} aria-label="ターゲットを射撃">
            <i /><span>{target.critical ? "★" : "✦"}</span>
          </button>
        )) : null}
        <div className="g4-crosshair" style={{ left: `${aim.x}%`, top: `${aim.y}%` }}><i /><i /><b /></div>
        {hits.map((item) => <strong className="g4-shot-hit" key={item.id} style={{ left: `${item.x}%`, top: `${item.y}%` }}>{item.text}</strong>)}
        {nova ? <div className="g4-nova"><strong>NOVA BURST</strong><i /></div> : null}
      </div>
      <div className="g4-shoot-controls"><span>TIME <b>{time.toFixed(1)}</b></span><div><small>ULTIMATE</small><i><b style={{ width: `${ultimate}%` }} /></i></div><button className={ultimate >= 100 ? "ready" : ""} disabled={ultimate < 100 || Boolean(outcome)} onClick={fireUltimate}>✦ NOVA</button></div>
      <p className="g4-help">照準を動かしてターゲットを射撃。小さい星はCRITICAL。</p>
      {outcome ? <GameResultOverlay result={outcome} score={score} exp={resultExp(outcome, score)} onComplete={props.onComplete} onRetry={reset} /> : null}
    </div>
  );
}
