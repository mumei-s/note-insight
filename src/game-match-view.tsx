import { useState } from "react";

const symbols=["A","B","C","D","E","F","G","H"];
function fresh(){return [...symbols,...symbols].map((symbol,id)=>({id,symbol,done:false})).sort(()=>Math.random()-.5)}

export function MatchBattle(){
 const [tiles,setTiles]=useState(fresh),[first,setFirst]=useState<number|null>(null),[score,setScore]=useState(0);
 function choose(index:number){
  if(tiles[index].done)return;
  if(first===null){setFirst(index);return}
  if(first===index)return;
  if(tiles[first].symbol===tiles[index].symbol){setTiles(v=>v.map((x,i)=>i===first||i===index?{...x,done:true}:x));setScore(v=>v+1)}
  setFirst(null);
 }
 return <div className="puzzle-game"><div className="mini-hud"><b>MATCH {score}/8</b></div><div className="puzzle-board">{tiles.map((x,i)=><button key={x.id} className={x.done||first===i?"open":""} onClick={()=>choose(i)}>{x.done||first===i?x.symbol:"?"}</button>)}</div><p>同じ紋章を2つ揃えて攻撃</p></div>;
}
