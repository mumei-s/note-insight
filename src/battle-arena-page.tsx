import { useEffect, useState } from "react";
import { CommandBattle } from "./game-command";
import { MatchBattle } from "./game-match-view";
import { TapRushBattle } from "./game-tap";
import { TargetRushBattle } from "./game-target-view";
import { loadCreatorGame } from "./game-data-client";
import type { CreatorGameData, GameMode } from "./game-types";

const games=[
 ["choice","COMMAND","攻撃・防御・スキルを読むカードバトル"],
 ["tap","TAP RUSH","反射神経とコンボで押し切る10秒勝負"],
 ["puzzle","ARCANE PUZZLE","盤面をつないで連鎖ダメージを狙う"],
 ["shoot","STAR SHOOTER","照準を合わせてターゲットを撃ち抜く"],
] as const;

function Art({src,label}:{src?:string|null;label:string}){return src?<img src={src} alt=""/>:<span className="concept-art-fallback">{label}</span>}

function GameConcept({mode,title,desc,playerArt,enemyArt,onPlay}:{mode:GameMode;title:string;desc:string;playerArt?:string|null;enemyArt?:string|null;onPlay:()=>void}){
 const gems=["◆","●","✦","▲","✦","◆","●","▲","●","✦","◆","●","▲","◆","✦","▲"];
 return <button className={`game-concept concept-${mode}`} onClick={onPlay}>
  <div className="concept-caption"><small>GAME PREVIEW</small><strong>{title}</strong><span>{desc}</span></div>
  {mode==="choice"?<div className="concept-screen command"><div className="concept-hud"><b>ENEMY HP</b><i/><span>ROUND 03</span></div><div className="concept-duel"><div className="concept-card enemy"><Art src={enemyArt} label="ENEMY"/></div><b>VS</b><div className="concept-card you"><Art src={playerArt} label="YOU"/></div></div><div className="concept-actions"><em>⚔<small>ATTACK</small></em><em>⬡<small>DEFEND</small></em><em>✦<small>SKILL</small></em></div></div>:null}
  {mode==="tap"?<div className="concept-screen tap"><div className="concept-hud"><b>10.0 SEC</b><span>COMBO ×24</span></div><div className="concept-tap-stage"><div className="concept-card tap-card"><Art src={enemyArt||playerArt} label="CARD"/></div><div className="tap-ring"><b>TAP!</b><span>×24</span></div><i className="tap-spark s1"/><i className="tap-spark s2"/><i className="tap-spark s3"/></div><div className="concept-meter"><i/></div></div>:null}
  {mode==="puzzle"?<div className="concept-screen puzzle"><div className="concept-hud"><b>CHAIN 08</b><span>ARCANE BURST</span></div><div className="puzzle-top"><div className="concept-card mini"><Art src={playerArt} label="YOU"/></div><strong>2,840</strong><div className="concept-card mini enemy"><Art src={enemyArt} label="ENEMY"/></div></div><div className="concept-gems">{gems.map((g,i)=><i key={i} className={`g${i%4}`}>{g}</i>)}</div></div>:null}
  {mode==="shoot"?<div className="concept-screen shoot"><div className="concept-hud"><b>SCORE 12,480</b><span>COMBO ×09</span></div><div className="shoot-sky"><div className="concept-card shoot-card"><Art src={enemyArt||playerArt} label="TARGET"/></div><i className="target t1"/><i className="target t2"/><i className="target t3"/><div className="crosshair"><span/><span/></div><b className="perfect">PERFECT!</b></div></div>:null}
  <span className="concept-enter">PLAY →</span>
 </button>
}

export function BattleArenaPage(){
 const[data,setData]=useState<CreatorGameData>({opponents:[],creators:[]});
 const[mode,setMode]=useState<GameMode|null>(null);
 const[enemy,setEnemy]=useState(0);
 useEffect(()=>{void loadCreatorGame().then(x=>setData(x.data))},[]);
 const foe=data.opponents[enemy];
 const player=data.creators[0];
 const playerArt=player?.images?.[0]?.url??null;
 return <div className="creator-world"><link rel="stylesheet" href={`${import.meta.env.BASE_URL}creator-world.css`}/><main>
  <header className="world-hero"><small>BATTLE ARENA</small><h1>CREATOR <span>WORLD</span></h1><p>登録した名鑑カードで挑む4つのゲームフィールド。</p></header>
  <section><div className="world-heading"><div><small>SELECT ENEMY</small><h2>対戦カード</h2></div></div><div className="enemy-strip">{data.opponents.map((x,i)=><button key={x.id} className={enemy===i?"active":""} onClick={()=>setEnemy(i)}>{x.image_url?<img src={x.image_url} alt=""/>:<span/>}<b>{x.name}</b><small>{x.rarity}</small></button>)}</div></section>
  {!mode?<section className="mode-select"><div className="world-heading"><div><small>SELECT GAME</small><h2>ゲーム完成イメージ</h2><p>4モードは見た目だけでなく、操作そのものが別ゲームになる設計です。</p></div></div><div className="concept-grid">{games.map(g=><GameConcept key={g[0]} mode={g[0]} title={g[1]} desc={g[2]} playerArt={playerArt} enemyArt={foe?.image_url} onPlay={()=>setMode(g[0])}/>)}</div></section>:null}
  {mode&&foe?<section className="active-game"><button className="mode-back" onClick={()=>setMode(null)}>← MODE SELECT</button><div className="versus-stage"><article className="fighter-card">{playerArt?<img src={playerArt} alt=""/>:<div>名鑑カード未登録</div>}<footer>{player?.display_name||player?.note_id||"CREATOR"}</footer></article><b className="vs-mark">VS</b><article className="fighter-card">{foe.image_url?<img src={foe.image_url} alt=""/>:<div>ENEMY</div>}<footer>{foe.name}</footer></article></div><div className="game-console" key={`${mode}-${foe.id}`}>{mode==="choice"?<CommandBattle/>:mode==="tap"?<TapRushBattle/>:mode==="puzzle"?<MatchBattle/>:<TargetRushBattle/>}</div></section>:null}
 </main></div>;
}
