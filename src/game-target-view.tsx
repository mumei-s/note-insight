import { useEffect, useState } from "react";
import { randomInt } from "./game-types";

type Target={id:number;x:number;y:number;size:number};

export function TargetRushBattle(){
 const[active,setActive]=useState(false),[time,setTime]=useState(15),[score,setScore]=useState(0),[combo,setCombo]=useState(0),[targets,setTargets]=useState<Target[]>([]);
 useEffect(()=>{
  if(!active)return;
  let serial=0;
  const spawn=window.setInterval(()=>{serial+=1;setTargets(v=>[...v.slice(-4),{id:Date.now()+serial,x:randomInt(7,84),y:randomInt(8,75),size:randomInt(42,68)}])},520);
  const clock=window.setInterval(()=>setTime(v=>{const next=Math.max(0,+(v-.1).toFixed(1));if(next===0)setActive(false);return next}),100);
  return()=>{clearInterval(spawn);clearInterval(clock)};
 },[active]);
 function start(){setScore(0);setCombo(0);setTargets([]);setTime(15);setActive(true)}
 function hit(id:number){if(!active)return;setTargets(v=>v.filter(x=>x.id!==id));setCombo(v=>v+1);setScore(v=>v+100+combo*15)}
 return <div className="shoot-game">
  <div className="mini-hud"><b>{time.toFixed(1)}s</b><span>SCORE {score}</span><strong>COMBO ×{combo}</strong></div>
  <div className="shoot-field">{active?targets.map(t=><button key={t.id} onPointerDown={()=>hit(t.id)} style={{left:`${t.x}%`,top:`${t.y}%`,width:t.size,height:t.size}}><i/><span>✦</span></button>):<div className="shoot-ready"><b>{time===0?"MISSION COMPLETE":"STAR SHOOTER"}</b><small>飛来する標的をタップして撃ち抜け</small></div>}</div>
  {!active?<button className="game-retry" onClick={start}>{score?"RETRY":"START MISSION"}</button>:null}
 </div>;
}
