import { useEffect, useState } from "react";
import { CommandBattle } from "./game-command";
import { MatchBattle } from "./game-match-view";
import { TapRushBattle } from "./game-tap";
import { TargetRushBattle } from "./game-target-view";
import { loadCreatorGame } from "./game-data-client";
import type { CreatorGameData, GameMode } from "./game-types";

const games=[
 ["choice","COMMAND","選択式バトル"],
 ["tap","TAP RUSH","タップバトル"],
 ["puzzle","ARCANE PUZZLE","パズルバトル"],
 ["shoot","STAR SHOOTER","シューティング"],
] as const;

export function BattleArenaPage(){
 const[data,setData]=useState<CreatorGameData>({opponents:[],creators:[]});
 const[mode,setMode]=useState<GameMode|null>(null);
 const[enemy,setEnemy]=useState(0);
 const[playerIcon,setPlayerIcon]=useState<string|null>(null);
 useEffect(()=>{void loadCreatorGame().then(x=>{setData(x.data);setPlayerIcon(x.playerIcon)})},[]);
 const foe=data.opponents[enemy];
 const player=data.creators[0];
 const playerArt=player?.images?.[0]?.url??playerIcon;
 return <div className="creator-world"><link rel="stylesheet" href={`${import.meta.env.BASE_URL}creator-world.css`}/><main>
  <nav className="world-nav"><a href="#catalog">← 名鑑</a><b>CREATOR WORLD</b><a href="#">TOP</a></nav>
  <header className="world-hero"><small>BATTLE ARENA</small><h1>CREATOR <span>WORLD</span></h1><p>カードで挑む4つのゲームフィールド。</p></header>
  <section><div className="world-heading"><div><small>SELECT ENEMY</small><h2>対戦カード</h2></div></div><div className="enemy-strip">{data.opponents.map((x,i)=><button key={x.id} className={enemy===i?"active":""} onClick={()=>setEnemy(i)}>{x.image_url?<img src={x.image_url} alt=""/>:<span/>}<b>{x.name}</b><small>{x.rarity}</small></button>)}</div></section>
  {!mode?<section className="mode-select"><div className="world-heading"><div><small>SELECT GAME</small><h2>ゲームモード</h2></div></div><div className="mode-grid">{games.map((g,i)=><button key={g[0]} onClick={()=>setMode(g[0])}><em>0{i+1}</em><small>{g[1]}</small><strong>{g[2]}</strong><span>ENTER →</span></button>)}</div></section>:null}
  {mode&&foe?<section className="active-game"><button className="mode-back" onClick={()=>setMode(null)}>← MODE SELECT</button><div className="versus-stage"><article className="fighter-card">{playerArt?<img src={playerArt} alt=""/>:<div>YOU</div>}<footer>{player?.display_name||player?.note_id||"CREATOR"}</footer></article><b className="vs-mark">VS</b><article className="fighter-card">{foe.image_url?<img src={foe.image_url} alt=""/>:<div>ENEMY</div>}<footer>{foe.name}</footer></article></div><div className="game-console" key={`${mode}-${foe.id}`}>{mode==="choice"?<CommandBattle/>:mode==="tap"?<TapRushBattle/>:mode==="puzzle"?<MatchBattle/>:<TargetRushBattle/>}</div></section>:null}
 </main></div>;
}
