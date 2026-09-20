import { useEffect, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import "./member-insight-dm.css";

const API="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dm-feed";
type Row=Record<string,any>;
async function post(action:string,extra:Record<string,unknown>={}){
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";
  if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
  const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({action,...extra}),cache:"no-store"});
  const p=await r.json().catch(()=>({}));if(!r.ok||p?.ok===false)throw new Error(p?.error||"DM_READ_ERROR");return p
}
const fmt=(v:any)=>{if(!v)return"—";const d=new Date(String(v));return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)};
function Avatar({row}:{row:Row}){const src=String(row.peer_image_url||row.sender_image_url||"");const name=String(row.peer_name||row.sender_name||row.peer_note_id||"DM");return src?<img className="midm-avatar" src={src} alt="" referrerPolicy="no-referrer"/>:<span className="midm-avatar fallback">{name.slice(0,1)}</span>}
export function MemberInsightDm({revision=0}:{revision?:number}){
  const[summary,setSummary]=useState<any>(null),[threads,setThreads]=useState<Row[]>([]),[selected,setSelected]=useState<Row|null>(null),[messages,setMessages]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  async function loadThreads(){
    setLoading(true);setError("");
    try{
      const[s,t]=await Promise.all([post("summary"),post("threads",{page:1,pageSize:100})]);
      setSummary(s);setThreads(t.rows||[]);
      setSelected(prev=>prev||t.rows?.[0]||null)
    }catch(e){setError(e instanceof Error?e.message:"DM読込失敗")}finally{setLoading(false)}
  }
  async function loadMessages(thread:Row|null){
    if(!thread){setMessages([]);return}
    try{const x=await post("messages",{threadKey:thread.thread_key,page:1,pageSize:200});setMessages((x.rows||[]).slice().reverse())}
    catch(e){setError(e instanceof Error?e.message:"DM本文の読込に失敗しました")}
  }
  useEffect(()=>{void loadThreads()},[revision]);
  useEffect(()=>{void loadMessages(selected)},[selected?.thread_key,revision]);
  return <section id="midm" className="midm">
    <header className="midm-head"><div><small>PRIVATE DIRECT MESSAGES</small><h2>DM</h2><p>noteのメッセージ履歴は本人通知とは完全に別保存です。通知カテゴリには混ざりません。</p></div><a href="https://note.com/messages/rooms" target="_blank" rel="noreferrer">note DMを開いて同期 ↗</a></header>
    <div className="midm-stats"><span><b>{Number(summary?.threads||0).toLocaleString()}</b><small>ルーム</small></span><span><b>{Number(summary?.messages||0).toLocaleString()}</b><small>保存DM</small></span><span><b>{summary?.lastSync?.created_at?fmt(summary.lastSync.created_at):"—"}</b><small>最終同期</small></span></div>
    {error?<p className="midm-error">⚠ {error}</p>:null}
    {loading&&!threads.length?<p className="midm-empty">DM履歴を読み込み中…</p>:<div className="midm-layout">
      <aside className="midm-threads">{threads.map(r=><button key={r.thread_key} className={selected?.thread_key===r.thread_key?"active":""} onClick={()=>setSelected(r)}><Avatar row={r}/><span><b>{r.peer_name||r.peer_note_id||"DMルーム"}</b><small>{fmt(r.last_message_at||r.last_synced_at)}</small></span></button>)}</aside>
      <div className="midm-messages">{selected?<><div className="midm-room-head"><Avatar row={selected}/><div><b>{selected.peer_name||selected.peer_note_id||"DMルーム"}</b>{selected.peer_url?<a href={selected.peer_url} target="_blank" rel="noreferrer">プロフィール ↗</a>:null}</div></div>{messages.length?messages.map(m=><article key={m.message_key} className={`midm-message ${m.direction||"unknown"}`}><small>{m.direction==="outbound"?"あなた":m.sender_name||selected.peer_name||"相手"} · {fmt(m.sent_at||m.captured_at)}</small>{m.body?<p>{m.body}</p>:null}{m.attachment_url?<a href={m.attachment_url} target="_blank" rel="noreferrer">{m.attachment_name||"添付ファイル"} ↗</a>:null}</article>):<p className="midm-empty">このルームの保存済みDMはありません。</p>}</>:<p className="midm-empty">DMルームを選択してください。</p>}</div>
    </div>}
  </section>
}