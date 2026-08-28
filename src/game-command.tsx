import { useEffect, useRef, useState } from "react";
import { percent, randomInt } from "./game-types";
import type { BattleResult } from "./game-types";

export function CommandBattle({onFinish}:{onFinish?:(result:BattleResult,score:number)=>void}={}) {
  const [playerHp, setPlayerHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(100);
  const [mp, setMp] = useState(30);
  const [turn, setTurn] = useState(1);
  const [log, setLog] = useState("BATTLE START");
  const sent=useRef(false);
  const ended = playerHp <= 0 || enemyHp <= 0;

  useEffect(()=>{if(!ended||sent.current)return;sent.current=true;const result:BattleResult=enemyHp<=0?"win":"lose";const score=result==="win"?1000+playerHp*10+mp*5:Math.max(0,(100-enemyHp)*5);onFinish?.(result,score)},[ended,enemyHp,playerHp,mp,onFinish]);

  function act(kind: "attack" | "guard" | "special") {
    if (ended) return;
    let hit = 0;
    let counter = 0;
    let nextMp = mp;
    if (kind === "attack") {hit = randomInt(14, 22);counter = randomInt(9, 17);nextMp = Math.min(30, mp + 5);setLog(`ATTACK！ ${hit} DAMAGE`);}
    if (kind === "guard") {hit = randomInt(5, 10);counter = randomInt(2, 7);nextMp = Math.min(30, mp + 3);setLog(`GUARD COUNTER！ ${hit} DAMAGE`);}
    if (kind === "special") {if (mp < 10) {setLog("MPが足りない！");return;}hit = randomInt(28, 40);counter = randomInt(11, 20);nextMp = mp - 10;setLog(`SPECIAL ART！ ${hit} DAMAGE`);}
    const nextEnemy = Math.max(0, enemyHp - hit);
    setEnemyHp(nextEnemy);setMp(nextMp);if (nextEnemy > 0) setPlayerHp((value) => Math.max(0, value - counter));setTurn((value) => value + 1);
  }
  function reset() {sent.current=false;setPlayerHp(100);setEnemyHp(100);setMp(30);setTurn(1);setLog("BATTLE START");}
  return <div className="command-game"><div className="battle-hud"><div><span>YOU</span><div className="hp"><i style={{ width: percent(playerHp) }} /></div><b>{playerHp} HP</b></div><strong>TURN {turn}</strong><div><span>ENEMY</span><div className="hp enemy"><i style={{ width: percent(enemyHp) }} /></div><b>{enemyHp} HP</b></div></div><div className="battle-log">{ended ? (enemyHp <= 0 ? "VICTORY — 撃破成功！" : "DEFEAT — 再挑戦せよ") : log}</div><div className="command-buttons"><button onClick={() => act("attack")} disabled={ended}><b>⚔</b><span>ATTACK</span><small>通常攻撃</small></button><button onClick={() => act("guard")} disabled={ended}><b>◆</b><span>GUARD</span><small>被ダメ軽減</small></button><button onClick={() => act("special")} disabled={ended || mp < 10}><b>✦</b><span>SPECIAL</span><small>MP {mp}/30</small></button></div>{ended ? <button className="game-retry" onClick={reset}>RETRY</button> : null}</div>;
}
