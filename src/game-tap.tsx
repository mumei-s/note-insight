import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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

type Grade = "PERFECT" | "GREAT" | "GOOD" | "MISS";
type Target = { x: number; y: number; size: number; serial: number; bornAt: number; ttl: number };
type Burst = { x: number; y: number; serial: number; label: Grade; points: number };
const SECONDS = 18;

function newTarget(speed: number, combo: number, serial = Date.now()): Target {
  const ttl = Math.max(430, 930 - (speed - 72) * 5 - Math.min(250, combo * 14));
  return {
    x: randomInt(13, 87),
    y: randomInt(20, 80),
    size: Math.max(48, randomInt(70, 96) - Math.min(22, combo)),
    serial,
    bornAt: performance.now(),
    ttl,
  };
}

export function TapRushBattle(props: GameSessionProps) {
  const { phase, paused, togglePause, restartPrelude } = useBattlePrelude();
  const ratio = useMemo(() => balanceRatio(props.playerStats, props.enemyStats, "tap"), [props.enemyStats, props.playerStats]);
  const [time, setTime] = useState(SECONDS);
  const [enemyHp, setEnemyHp] = useState(100);
  const [sync, setSync] = useState(100);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [target, setTarget] = useState<Target>(() => newTarget(props.playerStats.speed, 0));
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [outcome, setOutcome] = useState<GameResult | null>(null);
  const [shake, setShake] = useState(false);
  const [hits, setHits] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [lastGrade, setLastGrade] = useState<Grade | null>(null);
  const [feverCut, setFeverCut] = useState(false);
  const refs = useRef({ hp: 100, sync: 100, score: 0, combo: 0, hits: 0, attempts: 0, ended: false });
  const targetRef = useRef(target);
  const active = phase === "live" && !paused && !outcome;
  const fever = combo >= 10;

  useEffect(() => { targetRef.current = target; }, [target]);

  function conclude(result?: GameResult) {
    if (refs.current.ended) return;
    refs.current.ended = true;
    const resolved = result ?? (refs.current.hp <= 0 ? "win" : refs.current.sync <= 0 ? "lose" : refs.current.hp <= 16 ? "draw" : "lose");
    setOutcome(resolved);
  }

  function missAt(x = targetRef.current.x, y = targetRef.current.y) {
    if (!active || refs.current.ended) return;
    const nextSync = Math.max(0, refs.current.sync - (fever ? 15 : 11));
    refs.current.sync = nextSync;
    refs.current.combo = 0;
    refs.current.attempts += 1;
    setSync(nextSync); setCombo(0); setAttempts(refs.current.attempts); setLastGrade("MISS");
    const burst: Burst = { x, y, serial: Date.now() + Math.random(), label: "MISS", points: 0 };
    setBursts((value) => [...value.slice(-5), burst]);
    const nextTarget = newTarget(props.playerStats.speed, 0, targetRef.current.serial + 1);
    targetRef.current = nextTarget;
    setTarget(nextTarget);
    vibrate(32);
    window.setTimeout(() => setBursts((value) => value.filter((item) => item.serial !== burst.serial)), 620);
    if (nextSync <= 0) conclude("lose");
  }

  useEffect(() => {
    if (!active) return;
    const clock = window.setInterval(() => {
      setTime((value) => {
        const next = Math.max(0, +(value - 0.05).toFixed(2));
        if (next === 0) conclude();
        return next;
      });
      const current = targetRef.current;
      if (performance.now() - current.bornAt >= current.ttl) missAt(current.x, current.y);
    }, 50);
    return () => window.clearInterval(clock);
  }, [active, fever]);

  function miss(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    missAt();
  }

  function hit(event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!active || refs.current.ended) return;
    const current = targetRef.current;
    const reaction = Math.max(0, performance.now() - current.bornAt) / current.ttl;
    const timingError = Math.abs(reaction - 0.7);
    const grade: Grade = timingError <= 0.12 ? "PERFECT" : timingError <= 0.27 ? "GREAT" : "GOOD";
    const nextCombo = refs.current.combo + 1;
    const isFever = nextCombo >= 10;
    const gradePower = grade === "PERFECT" ? 1.7 : grade === "GREAT" ? 1.3 : 1;
    const damage = Math.max(2, Math.round((2.8 + nextCombo * 0.16) * gradePower * (isFever ? 1.42 : 1) * ratio));
    const nextHp = Math.max(0, refs.current.hp - damage);
    const gain = Math.round((180 + nextCombo * 42) * gradePower * (isFever ? 1.7 : 1) * ratio);
    const nextScore = refs.current.score + gain;
    const nextSync = Math.min(100, refs.current.sync + (grade === "PERFECT" ? 3 : 1));
    const burst: Burst = { x: current.x, y: current.y, serial: Date.now() + Math.random(), label: grade, points: gain };
    refs.current = { ...refs.current, hp: nextHp, sync: nextSync, score: nextScore, combo: nextCombo, hits: refs.current.hits + 1, attempts: refs.current.attempts + 1 };
    setEnemyHp(nextHp); setSync(nextSync); setScore(nextScore); setCombo(nextCombo);
    setHits(refs.current.hits); setAttempts(refs.current.attempts); setLastGrade(grade);
    setBursts((value) => [...value.slice(-5), burst]);
    if (nextCombo === 10) {
      setFeverCut(true);
      window.setTimeout(() => setFeverCut(false), 760);
    }
    const nextTarget = newTarget(props.playerStats.speed, nextCombo, current.serial + 1);
    targetRef.current = nextTarget;
    setTarget(nextTarget);
    setShake(true);
    vibrate(grade === "PERFECT" ? [16, 12, 24] : 14);
    window.setTimeout(() => setShake(false), 110);
    window.setTimeout(() => setBursts((value) => value.filter((item) => item.serial !== burst.serial)), 620);
    if (nextHp <= 0) conclude("win");
  }

  function reset() {
    refs.current = { hp: 100, sync: 100, score: 0, combo: 0, hits: 0, attempts: 0, ended: false };
    setTime(SECONDS); setEnemyHp(100); setSync(100); setScore(0); setCombo(0);
    const nextTarget = newTarget(props.playerStats.speed, 0);
    targetRef.current = nextTarget;
    setTarget(nextTarget); setBursts([]); setOutcome(null);
    setShake(false); setHits(0); setAttempts(0); setLastGrade(null); setFeverCut(false); restartPrelude();
  }

  const gauge = Math.min(100, combo * 10);
  const accuracy = attempts ? Math.round((hits / attempts) * 100) : 100;
  return (
    <div className={`g4-game g4-tap g5-tap ${fever ? "is-fever" : ""} ${shake ? "is-hit" : ""}`}>
      <GameAtmosphere mode="tap" playerArt={props.playerArt} enemyArt={props.enemyArt} />
      <PreludeOverlay phase={phase} playerName={props.playerName} enemyName={props.enemyName} playerArt={props.playerArt} enemyArt={props.enemyArt} mode="tap" />
      <PauseOverlay paused={paused} onResume={togglePause} />
      <GameTopControls paused={paused} onPause={togglePause} />
      <SkillCutIn active={feverCut} art={props.playerArt} title="FEVER DRIVE" kicker="RHYTHM LINK ×10" tone="violet" />
      <div className="g4-tap-top"><span><small>TIME</small><b>{time.toFixed(2)}</b></span><strong>TAP RUSH</strong><span><small>SCORE</small><b>{score.toLocaleString()}</b></span></div>
      <div className="g5-dual-meter"><div><small>SYNC</small><HpBar value={sync} /></div><div><small>RIVAL CORE</small><HpBar value={enemyHp} enemy /></div></div>
      <div className="g4-tap-field" onPointerDown={miss}>
        {props.enemyArt ? <img className="g4-tap-card" src={props.enemyArt} alt={`${props.enemyName}のカード`} /> : <div className="g5-demo-backdrop"><b>RIVAL CORE</b></div>}
        <div className="g4-tap-vignette" />
        <div className="g4-combo"><small>COMBO</small><strong>×{combo}</strong>{fever ? <em>FEVER!</em> : null}</div>
        <div className="g5-accuracy"><span>ACC {accuracy}%</span><b>{lastGrade || "READY"}</b></div>
        {active ? <button key={target.serial} className="g4-reflex-target g5-beat-target" style={{ left: `${target.x}%`, top: `${target.y}%`, width: target.size, height: target.size, animationDuration: `${target.ttl}ms` }} onPointerDown={hit} aria-label="収縮する発光ターゲットをタップ"><i /><i /><span>TAP</span></button> : null}
        {bursts.map((burst) => <span className={`g4-tap-burst is-${burst.label.toLowerCase()}`} key={burst.serial} style={{ left: `${burst.x}%`, top: `${burst.y}%` }}>{burst.label}<small>{burst.points ? `+${burst.points}` : ""}</small></span>)}
        <div className="g4-speed-lines" />
      </div>
      <div className="g4-fever-meter"><span>FEVER GAUGE</span><i><b style={{ width: `${gauge}%` }} /></i><strong>{fever ? "MAX" : `${Math.round(gauge)}%`}</strong></div>
      <p className="g4-help">輪が縮むほど高評価。PERFECTをつなぎ、FEVER中にRIVAL COREを破壊。</p>
      {outcome ? <GameResultOverlay result={outcome} score={score} exp={resultExp(outcome, score)} onComplete={props.onComplete} onRetry={reset} ranked={props.ranked} playerArt={props.playerArt} enemyArt={props.enemyArt} playerName={props.playerName} enemyName={props.enemyName} mode="tap" /> : null}
    </div>
  );
}
