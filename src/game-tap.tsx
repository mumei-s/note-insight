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

type Target = { x: number; y: number; size: number; serial: number };
type Burst = { x: number; y: number; serial: number; label: string };
const newTarget = (serial = Date.now()): Target => ({
  x: randomInt(14, 86),
  y: randomInt(18, 78),
  size: randomInt(62, 92),
  serial,
});

export function TapRushBattle(props: GameSessionProps) {
  const { phase, restartPrelude } = useBattlePrelude();
  const [time, setTime] = useState(10);
  const [enemyHp, setEnemyHp] = useState(100);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [target, setTarget] = useState<Target>(() => newTarget());
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [outcome, setOutcome] = useState<GameResult | null>(null);
  const [shake, setShake] = useState(false);
  const hpRef = useRef(enemyHp);
  const scoreRef = useRef(score);
  const comboRef = useRef(combo);
  const fever = combo >= 12;

  useEffect(() => { hpRef.current = enemyHp; }, [enemyHp]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { comboRef.current = combo; }, [combo]);

  function end(result?: GameResult) {
    if (outcome) return;
    const hp = hpRef.current;
    setOutcome(result ?? (hp <= 0 ? "win" : hp <= 18 ? "draw" : "lose"));
  }

  useEffect(() => {
    if (phase !== "live" || outcome) return;
    const clock = window.setInterval(() => {
      setTime((value) => {
        const next = Math.max(0, +(value - 0.1).toFixed(1));
        if (next === 0) end();
        return next;
      });
    }, 100);
    return () => window.clearInterval(clock);
  }, [phase, outcome]);

  useEffect(() => {
    if (phase !== "live" || outcome) return;
    const move = window.setInterval(() => {
      setTarget(newTarget());
      setCombo(0);
    }, fever ? 580 : 820);
    return () => window.clearInterval(move);
  }, [phase, outcome, fever]);

  function miss() {
    if (phase !== "live" || outcome) return;
    setCombo(0);
  }

  function hit(event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (phase !== "live" || outcome) return;
    const nextCombo = comboRef.current + 1;
    const isFever = nextCombo >= 12;
    const perfect = target.size <= 74 || Math.random() < 0.22;
    const damage = isFever ? (perfect ? 7 : 5) : perfect ? 5 : 3;
    const nextHp = Math.max(0, hpRef.current - damage);
    const gain = Math.round((140 + nextCombo * 28) * (isFever ? 2 : 1) * (perfect ? 1.45 : 1));
    const nextScore = scoreRef.current + gain;
    const burst: Burst = { x: target.x, y: target.y, serial: Date.now(), label: perfect ? "PERFECT" : `+${gain}` };
    hpRef.current = nextHp;
    scoreRef.current = nextScore;
    comboRef.current = nextCombo;
    setEnemyHp(nextHp);
    setScore(nextScore);
    setCombo(nextCombo);
    setBursts((value) => [...value.slice(-4), burst]);
    setTarget(newTarget(target.serial + 1));
    setShake(true);
    window.setTimeout(() => setShake(false), 120);
    window.setTimeout(() => setBursts((value) => value.filter((item) => item.serial !== burst.serial)), 520);
    if (nextHp <= 0) end("win");
  }

  function reset() {
    hpRef.current = 100;
    scoreRef.current = 0;
    comboRef.current = 0;
    setTime(10);
    setEnemyHp(100);
    setScore(0);
    setCombo(0);
    setTarget(newTarget());
    setBursts([]);
    setOutcome(null);
    setShake(false);
    restartPrelude();
  }

  const gauge = Math.min(100, combo * 8.34);
  return (
    <div className={`g4-game g4-tap ${fever ? "is-fever" : ""} ${shake ? "is-hit" : ""}`}>
      <PreludeOverlay phase={phase} playerName={props.playerName} enemyName={props.enemyName} />
      <div className="g4-tap-top">
        <span><small>TIME</small><b>{time.toFixed(1)}</b></span>
        <strong>TAP RUSH</strong>
        <span><small>SCORE</small><b>{score.toLocaleString()}</b></span>
      </div>
      <HpBar value={enemyHp} enemy />
      <div className="g4-tap-field" onPointerDown={miss}>
        {props.enemyArt ? <img className="g4-tap-card" src={props.enemyArt} alt={`${props.enemyName}のカード`} /> : null}
        <div className="g4-tap-vignette" />
        <div className="g4-combo"><small>COMBO</small><strong>×{combo}</strong>{fever ? <em>FEVER!</em> : null}</div>
        {phase === "live" && !outcome ? (
          <button
            className="g4-reflex-target"
            style={{ left: `${target.x}%`, top: `${target.y}%`, width: target.size, height: target.size }}
            onPointerDown={hit}
            aria-label="発光ターゲットをタップ"
          >
            <i /><i /><span>TAP</span>
          </button>
        ) : null}
        {bursts.map((burst) => <span className="g4-tap-burst" key={burst.serial} style={{ left: `${burst.x}%`, top: `${burst.y}%` }}>{burst.label}</span>)}
        <div className="g4-speed-lines" />
      </div>
      <div className="g4-fever-meter"><span>FEVER GAUGE</span><i><b style={{ width: `${gauge}%` }} /></i><strong>{fever ? "MAX" : `${Math.round(gauge)}%`}</strong></div>
      <p className="g4-help">移動する光点を追ってタップ。外すとコンボが0に戻ります。</p>
      {outcome ? <GameResultOverlay result={outcome} score={score} exp={resultExp(outcome, score)} onComplete={props.onComplete} onRetry={reset} /> : null}
    </div>
  );
}
