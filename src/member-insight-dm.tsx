import { useEffect, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import "./member-insight-dm.css";

const API="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dm-feed";
const PAIR="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dm-import-token";
const DM_TOOL_KEY="mumei-dm-tool-version";
type Row=Record<string,any>;
async function post(endpoint:string,body:Record<string,unknown>){
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";
  if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
  const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify(body),cache:"no-store"});
  const p=await r.json().catch(()=>({}));if(!r.ok||p?.ok===false)throw new Error(p?.error||"DM_API_ERROR");return p
}
const feed=(action:string,extra:Record<string,unknown>={})=>post(API,{action,...extra});
const pair=(action:string,extra:Record<string,unknown>={})=>post(PAIR,{action,...extra});
const fmt=(v:any)=>{if(!v)return"—";const d=new Date(String(v));return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)};
function Avatar({row}:{row:Row}){const src=String(row.peer_image_url||row.sender_image_url||"");const name=String(row.peer_name||row.sender_name||row.peer_note_id||"DM");return src?<img className="midm-avatar" src={src} alt="" referrerPolicy="no-referrer"/>:<span className="midm-avatar fallback">{name.slice(0,1)}</span>}
export function MemberInsightDm({revision=0}:{revision?:number}){
  const[summary,setSummary]=useState<any>(null),[people,setPeople]=useState<Row[]>([]),[selected,setSelected]=useState<Row|null>(null),[messages,setMessages]=useState<Row[]>([]),[pairState,setPairState]=useState<any>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
  const[toolVersion,setToolVersion]=useState(()=>String(localStorage.getItem(DM_TOOL_KEY)||""));
  async function load(){
    setLoading(true);setError("");
    try{
      const[s,p,st]=await Promise.all([feed("summary"),feed("people"),pair("stats")]);
      setSummary(s);setPeople(p.rows||[]);setPairState(st);
      setSelected(prev=>prev&&p.rows?.some((x:Row)=>x.person_key===prev.person_key)?prev:p.rows?.[0]||null)
    }catch(e){setError(e instanceof Error?e.message:"DM読込失敗")}finally{setLoading(false)}
  }
  async function loadMessages(person:Row|null){
    if(!person){setMessages([]);return}
    try{const x=await feed("person_messages",{personKey:person.person_key,page:1,pageSize:500});setMessages((x.rows||[]).slice().reverse())}
    catch(e){setError(e instanceof Error?e.message:"DM本文の読込に失敗しました")}
  }
  async function startPair(){
    if(busy)return;setBusy(true);setError("");setNotice("");
    try{
      const x=await pair("pair-start");
      const url=String(x.noteUrl||"");if(!url)throw new Error("DM_PAIR_URL_MISSING");
      setNotice("noteのDMを開きます。開いた時点でDM専用連携→自動同期を開始します。");
      window.open(url,"_blank","noopener,noreferrer")
    }catch(e){setError(e instanceof Error?e.message:"DM連携を開始できませんでした")}finally{setBusy(false)}
  }
  useEffect(()=>{void load()},[revision]);
  useEffect(()=>{void loadMessages(selected)},[selected?.person_key,revision]);
  useEffect(()=>{const on=()=>setToolVersion(String(localStorage.getItem(DM_TOOL_KEY)||""));window.addEventListener("mumei-dm-version-changed",on);window.addEventListener("focus",on);return()=>{window.removeEventListener("mumei-dm-version-changed",on);window.removeEventListener("focus",on)}},[]);
  const installHref="./dm-browser-install.html?return="+encodeURIComponent(location.href);
  return <section id="midm" className="midm">
    <header className="midm-head"><div><small>PRIVATE DIRECT MESSAGES</small><h2>DM</h2><p>DMを開くだけで会話本文まで同期し、相手ごとにまとめます。</p></div></header>
    <div className="midm-control">
      <div className="midm-control-state">
        <strong className={pairState?.paired?"ok":""}>{pairState?.paired?"✓ DM連携済み":"DM連携 未設定"}</strong>
        <span><b>{Number(people.length||0).toLocaleString()}</b>人</span>
        <span><b>{Number(summary?.messages||0).toLocaleString()}</b>件</span>
        <span className="last">最終 {summary?.lastSync?.created_at?fmt(summary.lastSync.created_at):"—"}</span>
      </div>
      <div className="midm-control-main">
        <a href="https://note.com/messages/rooms" target="_blank" rel="noreferrer">DMを開いて同期 ↗</a>
        {!pairState?.paired?<button disabled={busy||!toolVersion} onClick={()=>void startPair()}>連携する</button>:null}
      </div>
      <details>
        <summary>設定・状態</summary>
        <div className="midm-control-detail">
          <a className={toolVersion?"installed":""} href={installHref}>{toolVersion?"同期ツール "+toolVersion+"（更新）":"DM同期ツールをインストール"}</a>
          <button disabled={busy||!toolVersion} onClick={()=>void startPair()}>{pairState?.paired?"DM連携を再設定":"DMを連携"}</button>
          <small>本人通知とは完全に別系統です。通信Readerを優先し、DOM Readerを補助に使います。</small>
        </div>
      </details>
    </div>
    {notice?<p className="midm-notice">{notice}</p>:null}
    {error?<p className="midm-error">⚠ {error}</p>:null}
    {loading&&!people.length?<p className="midm-empty">DM履歴を読み込み中…</p>:<div className="midm-layout">
      <aside className="midm-threads">{people.map(r=><button key={r.person_key} className={selected?.person_key===r.person_key?"active":""} onClick={()=>setSelected(r)}><Avatar row={r}/><span><b>{r.peer_name||r.peer_note_id||"DM相手"}</b><small>{Number(r.room_count||1)>1?String(r.room_count)+"ルーム統合 · ":""}{fmt(r.last_message_at)}</small></span></button>)}</aside>
      <div className="midm-messages">{selected?<><div className="midm-room-head"><Avatar row={selected}/><div><b>{selected.peer_name||selected.peer_note_id||"DM相手"}</b>{selected.peer_url?<a href={selected.peer_url} target="_blank" rel="noreferrer">プロフィール ↗</a>:null}<small>{Number(selected.room_count||1)>1?String(selected.room_count)+"ルームを1人分として統合":"この人とのDM履歴"}</small></div></div>{messages.length?messages.map(m=><article key={m.message_key} className={"midm-message "+(m.direction||"unknown")}><small>{m.direction==="outbound"?"あなた":m.sender_name||selected.peer_name||"相手"} · {fmt(m.sent_at||m.captured_at)}</small>{m.body?<p>{m.body}</p>:null}{m.attachment_url?<a href={m.attachment_url} target="_blank" rel="noreferrer">{m.attachment_name||"添付ファイル"} ↗</a>:null}</article>):<p className="midm-empty">この人との保存済みDMはありません。</p>}</>:<p className="midm-empty">相手を選択してください。</p>}</div>
    </div>}
  </section>
}