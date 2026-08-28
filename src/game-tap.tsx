import { useEffect, useRef, useState } from "react";
import { percent } from "./game-types";
import type { BattleResult } from "./game-types";

export function TapRushBattle({onFinish}:{onFinish?:(result:BattleResult,score:number)=>void}={}) {
  const [active, setActive] = useState(false);
  const [time, setTime] = useState(10);
  const [enemyHp, setEnemyHp] = useState(100);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const started=useRef(false),sent=useRef(false);

  useEffect(() => {if (!active) return;const timer = window.setInterval(() => {setTime((value) => {const next = Math.max(0, +(value - 0.1).toFixed(1));if (next === 0) setActive(false);return next;});}, 100);return () => window.clearInterval(timer);}, [active]);
  useEffect(()=>{if(!started.current||active||sent.current||!(enemyHp===0||time===0))return;sent.current=true;const result:BattleResult=enemyHp===0?"win":"lose";onFinish?.(result,score)},[active,enemyHp,time,score,onFinish]);

  function start() {started.current=true;sent.current=false;setTime(10);setEnemyHp(100);setScore(0);setCombo(0);setActive(true);}
  function tap() {if (!active) return;setCombo((value) => value + 1);setScore((value) => value + 10 + combo);setEnemyHp((value) => {const next = Math.max(0, value - 3);if (next === 0) setActive(false);return next;});}
  return <div className="tap-game"><div className="mini-hud"><b>{time.toFixed(1)}s</b><span>SCORE {score}</span><strong>COMBO ×{combo}</strong></div><div className="tap-enemy-hp"><i style={{ width: percent(enemyHp) }} /></div><button className={`tap-core ${active ? "live" : ""}`} onPointerDown={tap}><span>{active ? "TAP!" : "READY"}</span><small>{enemyHp} HP</small></button><p>{enemyHp === 0 ? "BREAK!! ENEMY DOWN" : time === 0 ? "TIME UP" : "連続タップでコアを破壊"}</p>{!active ? <button className="game-retry" onClick={start}>{score || time === 0 ? "RETRY" : "START"}</button> : null}</div>;
}
