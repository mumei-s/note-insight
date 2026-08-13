import { useEffect, useMemo, useState } from "react";

const W=6,H=6,TARGET=1800,SECONDS=45;
const runes=["✦","◆","✧","⬢","✹","◈"];
type Cell={id:string,rune:string};
const make=():Cell=>({id:crypto.randomUUID(),rune:runes[Math.floor(Math.random()*runes.length)]});
function fresh(){return Array.from({length:W*H},make)}
function adjacent(a:number,b:number){return Math.abs(a-b)===W||(Math.abs(a-b)===1&&Math.floor(a/W)===Math.floor(b/W))}
function matches(board:Cell[]){const hit=new Set<number>();for(let y=0;y<H;y++){let s=0;for(let x=1;x<=W;x++){const same=x<W&&board[y*W+x].rune===board[y*W+s].rune;if(!same){if(x-s>=3)for(let k=s;k<x;k++)hit.add(y*W+k);s=x}}}for(let x=0;x<W;x++){let s=0;for(let y=1;y<=H;y++){const same=y<H&&board[y*W+x].rune===board[s*W+x].rune;if(!same){if(y-s>=3)for(let k=s;k<y;k++)hit.add(k*W+x);s=y}}}return hit}
function collapse(board:Cell[],hit:Set<number>){const next=[...board];for(let x=0;x<W;x++){const keep:Cell[]=[];for(let y=H-1;y>=0;y--){const i=y*W+x;if(!hit.has(i))keep.push(next[i])}while(keep.length<H)keep.push(make());for(let y=H-1,k=0;y>=0;y--,k++)next[y*W+x]=keep[k]}return next}
function settle(input:Cell[]){let board=input,removed=0,chain=0;for(let guard=0;guard<12;guard++){const hit=matches(board);if(!hit.size)break;chain++;removed+=hit.size;board=collapse(board,hit)}return{board,removed,chain}}

export function MatchBattle(){
 const seed=useMemo(()=>settle(fresh()).board,[]);
 const[board,setBoard]=useState(seed),[selected,setSelected]=useState<number|null>(null),[score,setScore]=useState(0),[time,setTime]=useState(SECONDS),[combo,setCombo]=useState(0),[state,setState]=useState<"ready"|"live"|"clear"|"over">("ready"),[flash,setFlash]=useState("");
 useEffect(()=>{if(state!=="live")return;const id=window.setInterval(()=>setTime(v=>{const n=Math.max(0,+(v-.1).toFixed(1));if(n===0)setState(score>=TARGET?"clear":"over");return n}),100);return()=>window.clearInterval(id)},[state,score]);
 function start(){setBoard(settle(fresh()).board);setSelected(null);setScore(0);setCombo(0);setTime(SECONDS);setState("live");setFlash("")}
 function choose(i:number){if(state!=="live")return;if(selected===null){setSelected(i);return}if(selected===i){setSelected(null);return}if(!adjacent(selected,i)){setSelected(i);return}const swap=[...board];const temp=swap[selected];swap[selected]=swap[i];swap[i]=temp;const first=matches(swap);if(!first.size){setSelected(null);setFlash("NO MATCH");window.setTimeout(()=>setFlash(""),350);return}const result=settle(swap),gain=result.removed*60+Math.max(0,result.chain-1)*180;setBoard(result.board);setSelected(null);setCombo(result.chain);setScore(v=>{const n=v+gain;if(n>=TARGET)setState("clear");return n});setFlash(result.chain>1?`CHAIN ×${result.chain}`:`+${gain}`);window.setTimeout(()=>setFlash(""),500)}
 const progress=Math.min(100,score/TARGET*100);
 return <div className={`rune-game state-${state}`}>
  <div className="rune-hud"><div><small>TIME</small><b>{time.toFixed(1)}</b></div><div className="rune-score"><small>RUNE ENERGY</small><strong>{score.toLocaleString()} / {TARGET.toLocaleString()}</strong><i><span style={{width:`${progress}%`}}/></i></div><div><small>CHAIN</small><b>×{combo}</b></div></div>
  {state==="ready"?<div className="rune-intro"><span className="rune-orb">✦</span><h3>RUNE BREAK</h3><p>隣り合うルーンを入れ替え、3個以上そろえてエネルギーを集める。45秒以内に目標へ到達。</p><button onClick={start}>START PUZZLE</button></div>:null}
  {state==="live"?<><div className="rune-board">{board.map((x,i)=><button key={x.id} className={selected===i?"selected":""} data-rune={runes.indexOf(x.rune)} onClick={()=>choose(i)}><span>{x.rune}</span></button>)}</div>{flash?<div className="rune-flash">{flash}</div>:null}<p className="rune-help">タップで1つ選択 → 隣のルーンをタップして交換</p></>:null}
  {state==="clear"?<div className="rune-result clear"><small>MISSION COMPLETE</small><h3>RUNE CORE CLEARED</h3><strong>{score.toLocaleString()} pts</strong><div className="reward"><span>✦</span><div><small>REWARD</small><b>ARCANE CHEST ×1</b></div></div><p>目標エネルギー到達。クリア報酬を獲得。</p><button onClick={start}>PLAY AGAIN</button></div>:null}
  {state==="over"?<div className="rune-result"><small>TIME UP</small><h3>CORE NOT FILLED</h3><strong>{score.toLocaleString()} pts</strong><p>あと {Math.max(0,TARGET-score).toLocaleString()} pt。連鎖でボーナスが増える。</p><button onClick={start}>RETRY</button></div>:null}
 </div>;
}
