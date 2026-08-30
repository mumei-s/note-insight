import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { balanceRatio, vibrate } from "./game-card-engine";
import {
  GameAtmosphere,
  GameResultOverlay,
  GameTopControls,
  HpBar,
  PauseOverlay,
  PreludeOverlay,
  SkillCutIn,
  resultExp,
  useBattlePrelude,
  type GameResult,
  type GameSessionProps,
} from "./game-ui";
import { randomInt } from "./game-types";

type Target = { id: number; x: number; y: number; size: number; critical: boolean; bornAt: number; ttl: number; dx: number; dy: number };
type Hit = { id: number; x: number; y: number; text: string };
const SECONDS = 24;

function spawnTarget(speed: number, serial: number): Target {
  return {
    id: Date.now() + serial,
    x: randomInt(10, 84), y: randomInt(15, 78), size: randomInt(43, 72),
    critical: Math.random() < 0.25,
    bornAt: performance.now(),
    ttl: Math.max(820, 1500 - (speed - 72) * 10),
    dx: randomInt(-16, 16), dy: randomInt(-10, 10),
  };
}

export function TargetRushBattle(props: GameSessionProps) {
  const { phase, paused, togglePause, restartPrelude } = useBattlePrelude();
  const ratio = useMemo(() => balanceRatio(props.playerStats, props.enemyStats, "shoot"), [props.enemyStats, props.playerStats]);
  const [time, setTime] = useState(SECONDS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bossHp, setBossHp] = useState(100);
  const [shield, setShield] = useState(100);
  const [ultimate, setUltimate] = useState(0);
  const [targets, setTargets] = useState<Target[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [aim, setAim] = useState({ x: 50, y: 52 });
  const [nova, setNova] = useState(false);
  const [shots, setShots] = useState(0);
  const [landed, setLanded] = useState(0);
  const [outcome, setOutcome] = useState<GameResult | null>(null);
  const refs = useRef({ hp: 100, shield: 100, score: 0, combo: 0, shots: 0, landed: 0, ended: false });
  const serial = useRef(0);
  const active = phase === "live" && !paused && !outcome;

  function conclude(result?: GameResult) {
    if (refs.current.ended) return;
    refs.current.ended = true;
    setOutcome(result ?? (refs.current.hp <= 0 ? "win" : refs.current.shield <= 0 ? "lose" : refs.current.hp <= 18 ? "draw" : "lose"));
  }

  function applyEscapes(count: number) {
    if (!count || refs.current.ended) return;
    const damage = Math.max(5, Math.round((7 + count * 2) * (props.enemyStats.power / 86) * (86 / props.playerStats.guard)));
    const nextShield = Math.max(0, refs.current.shield - damage);
    refs.current.shield = nextShield;
    refs.current.combo = 0;
    setShield(nextShield); setCombo(0);
    vibrate(34);
    if (nextShield <= 0) conclude("lose");
  }

  useEffect(() => {
    if (!active) return;
    const spawn = window.setInterval(() => {
      serial.current += 1;
      setTargets((value) => value.length >= 5 ? value : [...value, spawnTarget(props.enemyStats.speed, serial.current)]);
    }, combo >= 10 ? 340 : 470);
    const clock = window.setInterval(() => {
      setTime((value) => {
        const next = Math.max(0, +(value - 0.05).toFixed(2));
        if (next === 0) conclude();
        return next;
      });
      const now = performance.now();
      setTargets((value) => {
        const escaped = value.filter((item) => now - item.bornAt >= item.ttl).length;
        if (escaped) queueMicrotask(() => applyEscapes(escaped));
        return value.filter((item) => now - item.bornAt < item.ttl);
      });
    }, 50);
    return () => { window.clearInterval(spawn); window.clearInterval(clock); };
  }, [active, combo >= 10, props.enemyStats.speed]);

  function moveAim(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setAim({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
  }

  function miss(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || !active) return;
    refs.current.combo = 0; refs.current.shots += 1;
    setCombo(0); setShots(refs.current.shots); vibrate(12);
  }

  function hit(event: ReactPointerEvent<HTMLButtonElement>, target: Target) {
    event.stopPropagation();
    if (!active || refs.current.ended) return;
    const nextCombo = refs.current.combo + 1;
    const lifetime = (performance.now() - target.bornAt) / target.ttl;
    const critical = target.critical || target.size < 52 || lifetime < 0.28;
    const damage = Math.max(3, Math.round((critical ? 8 : 4.5) * ratio));
    const hp = Math.max(0, refs.current.hp - damage);
    const gain = Math.round((240 + nextCombo * 52) * (critical ? 2.15 : 1) * ratio);
    const nextScore = refs.current.score + gain;
    refs.current = { ...refs.current, hp, score: nextScore, combo: nextCombo, shots: refs.current.shots + 1, landed: refs.current.landed + 1 };
    setTargets((value) => value.filter((item) => item.id !== target.id));
    setBossHp(hp); setScore(nextScore); setCombo(nextCombo);
    setShots(refs.current.shots); setLanded(refs.current.landed);
    setUltimate((value) => Math.min(100, value + (critical ? 17 : 10)));
    const marker = { id: Date.now() + Math.random(), x: target.x, y: target.y, text: critical ? `CRITICAL ${gain}` : `+${gain}` };
    setHits((value) => [...value.slice(-6), marker]);
    vibrate(critical ? [18, 12, 28] : 14);
    window.setTimeout(() => setHits((value) => value.filter((item) => item.id !== marker.id)), 650);
    if (hp <= 0) conclude("win");
  }

  function fireUltimate() {
    if (ultimate < 100 || !active) return;
    const hp = Math.max(0, refs.current.hp - Math.round(30 * ratio));
    const nextScore = refs.current.score + 6800;
    refs.current.hp = hp; refs.current.score = nextScore;
    setBossHp(hp); setScore(nextScore); setUltimate(0); setTargets([]); setNova(true);
    vibrate([45, 25, 90]);
    window.setTimeout(() => setNova(false), 820);
    if (hp <= 0) conclude("win");
  }

  function reset() {
    refs.current = { hp: 100, shield: 100, score: 0, combo: 0, shots: 0, landed: 0, ended: false };
    serial.current = 0;
    setTime(SECONDS); setScore(0); setCombo(0); setBossHp(100); setShield(100);
    setUltimate(0); setTargets([]); setHits([]); setAim({ x: 50, y: 52 });
    setNova(false); setShots(0); setLanded(0); setOutcome(null); restartPrelude();
  }

  const accuracy = shots ? Math.round((landed / shots) * 100) : 100;
  return (
    <div className={`g4-game g4-shooter g5-shooter ${nova ? "is-nova" : ""}`}>
      <GameAtmosphere mode="shoot" playerArt={props.playerArt} enemyArt={props.enemyArt} />
      <PreludeOverlay phase={phase} playerName={props.playerName} enemyName={props.enemyName} playerArt={props.playerArt} enemyArt={props.enemyArt} mode="shoot" />
      <PauseOverlay paused={paused} onResume={togglePause} />
      <GameTopControls paused={paused} onPause={togglePause} />
      <SkillCutIn active={nova} art={props.playerArt} title="NOVA BURST" kicker="LOCK-ON COMPLETE" tone="cyan" />
      <div className="g4-shooter-top"><span>SCORE <b>{score.toLocaleString()}</b></span><strong>STAR SHOOTER</strong><span>COMBO <b>×{combo}</b></span></div>
      <div className="g4-boss-hud"><div><small>BOSS CARD · ACC {accuracy}%</small><strong>{props.enemyName}</strong></div><HpBar value={bossHp} enemy /></div>
      <div className="g5-pilot-shield"><small>PILOT SHIELD</small><i><b style={{ width: `${shield}%` }} /></i><strong>{shield}</strong></div>
      <div className="g4-shoot-field" onPointerMove={moveAim} onPointerDown={miss}>
        {props.enemyArt ? <img className="g4-boss-card" src={props.enemyArt} alt={`${props.enemyName}のボスカード`} /> : <div className="g5-demo-backdrop"><b>STAR CORE</b></div>}
        <div className="g4-space-depth" />
        {active ? targets.map((target) => <button key={target.id} className={target.critical ? "critical" : ""} style={({ left: `${target.x}%`, top: `${target.y}%`, width: target.size, height: target.size, animationDuration: `${target.ttl}ms`, "--drift-x": `${target.dx}px`, "--drift-y": `${target.dy}px` } as CSSProperties)} onPointerDown={(event) => hit(event, target)} aria-label="移動ターゲットを射撃"><i /><span>{target.critical ? "★" : "✦"}</span></button>) : null}
        <div className="g4-crosshair" style={{ left: `${aim.x}%`, top: `${aim.y}%` }}><i /><i /><b /></div>
        {hits.map((item) => <strong className="g4-shot-hit" key={item.id} style={{ left: `${item.x}%`, top: `${item.y}%` }}>{item.text}</strong>)}
        {nova ? <div className="g4-nova"><strong>NOVA BURST</strong><i /></div> : null}
      </div>
      <div className="g4-shoot-controls"><span>TIME <b>{time.toFixed(2)}</b></span><div><small>ULTIMATE</small><i><b style={{ width: `${ultimate}%` }} /></i></div><button className={ultimate >= 100 ? "ready" : ""} disabled={ultimate < 100 || !active} onClick={fireUltimate}>✦ NOVA</button></div>
      <p className="g4-help">流れる照準で星を撃つ。小型/高速ターゲットはCRITICAL。逃すとSHIELDが減少。</p>
      {outcome ? <GameResultOverlay result={outcome} score={score} exp={resultExp(outcome, score)} onComplete={props.onComplete} onRetry={reset} ranked={props.ranked} playerArt={props.playerArt} enemyArt={props.enemyArt} playerName={props.playerName} enemyName={props.enemyName} mode="shoot" /> : null}
    </div>
  );
}
