import { CreatorAvatar } from "./creator-avatar";
import { useEffect, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY, currentStoredInsightAccount } from "./insight-account-store";
import { CURRENT_DM_VERSION, fetchInsightRelease, versionDiffers } from "./insight-release";
import { fetchInsightResource } from "./insight-view-lifecycle";
import "./member-insight-dm.css";

const API="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dm-feed";
const PAIR="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dm-import-token";
const DM_TOOL_KEY="mumei-dm-tool-version";
type Row=Record<string,any>;
async function post(endpoint:string,body:Record<string,unknown>,signal?:AbortSignal,token=localStorage.getItem(INSIGHT_TOKEN_KEY)||""){
  if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
  if(token!==(localStorage.getItem(INSIGHT_TOKEN_KEY)||""))throw new Error("アカウントが切り替わりました");
  try{
    const r=await fetchInsightResource(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify(body),cache:"no-store",signal});
    const p=await r.json().catch(()=>{throw new Error(r.ok?"DM_RESPONSE_INVALID":`HTTP_${r.status}`)});if(!r.ok||p?.ok===false)throw new Error(p?.error||"DM_API_ERROR");
    if(p?.ok!==true)throw new Error("DM_RESPONSE_INVALID");
    if(body.action==="people"&&(!Array.isArray(p.rows)||p.rows.some((row:Row)=>!row?.person_key)))throw new Error("DM_RESPONSE_INVALID");
    if(body.action==="person_messages"&&(!Array.isArray(p.rows)||!Number.isSafeInteger(p.total)||p.total<0||p.total<p.rows.length||p.rows.some((row:Row)=>!row||!String(row.message_key||row.id||""))))throw new Error("DM_RESPONSE_INVALID");
    if(body.action==="summary"&&(!Number.isSafeInteger(p.messages)||p.messages<0||(p.readerStatus!==undefined&&!Array.isArray(p.readerStatus))))throw new Error("DM_RESPONSE_INVALID");
    if(body.action==="stats"&&typeof p.paired!=="boolean")throw new Error("DM_RESPONSE_INVALID");
    if(localStorage.getItem(INSIGHT_TOKEN_KEY)!==token)throw new Error("アカウントが切り替わりました");return p;
  }catch(e){if(e instanceof Error&&e.name==='TimeoutError')throw new Error('DMの読込が30秒以内に完了しませんでした');throw e}
}
const feed=(action:string,extra:Record<string,unknown>={},signal?:AbortSignal,token?:string)=>post(API,{action,...extra},signal,token);
const pair=(action:string,extra:Record<string,unknown>={},signal?:AbortSignal,token?:string)=>post(PAIR,{action,...extra},signal,token);
const fmt=(v:any)=>{if(!v)return"—";const d=new Date(String(v));return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)};
function Avatar({row}:{row:Row}){return <CreatorAvatar person={row} name={String(row.peer_name||row.sender_name||row.peer_note_id||"DM")} className="midm-avatar"/>}
function validPerson(r:Row){const name=String(r.peer_name||"").trim();return Boolean(r.peer_note_id||r.peer_url||r.peer_image_url||(name&&name!=="DM相手"))}
export function MemberInsightDm({revision=0,active=true}:{revision?:number;active?:boolean}){
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"",accountNoteId=String(currentStoredInsightAccount()?.noteId||"").toLowerCase();
  const[summary,setSummary]=useState<any>(null),[people,setPeople]=useState<Row[]>([]),[selected,setSelected]=useState<Row|null>(null),[messages,setMessages]=useState<Row[]>([]),[pairState,setPairState]=useState<any>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
  const[toolVersion,setToolVersion]=useState(()=>String(localStorage.getItem(DM_TOOL_KEY)||"")),[latestDmVersion,setLatestDmVersion]=useState(CURRENT_DM_VERSION),[releaseChecked,setReleaseChecked]=useState(false);
  const[reader,setReader]=useState<any>(null),messageRequest=useRef(0),messageFlight=useRef<string>(""),messageView=useRef<string>(""),listRequest=useRef(0),listFlight=useRef<AbortController|null>(null),messageController=useRef<AbortController|null>(null),mounted=useRef(true),activeRef=useRef(active);activeRef.current=active;
  const[messageOwner,setMessageOwner]=useState(""),[messagesLoading,setMessagesLoading]=useState(false);
  const[viewToken,setViewToken]=useState(token),[summaryReadState,setSummaryReadState]=useState<"checking"|"ready"|"error">("checking"),[messageReadError,setMessageReadError]=useState(""),[peopleVerified,setPeopleVerified]=useState(false);
  const accountRequest=useRef(token),verifiedMessageView=useRef(""),[accountRevision,setAccountRevision]=useState(0);
  const accountChanged=viewToken!==token,currentSelected=accountChanged?null:selected;
  function pauseReads(){listRequest.current++;messageRequest.current++;listFlight.current?.abort();messageController.current?.abort();listFlight.current=null;messageController.current=null;messageFlight.current=""}
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;pauseReads()}},[]);
  useEffect(()=>{
    pauseReads();accountRequest.current=token;messageView.current="";verifiedMessageView.current="";
    setViewToken(token);setSummary(null);setSummaryReadState("checking");setPeople([]);setPeopleVerified(false);setSelected(null);setMessages([]);setMessageOwner("");setReader(null);setPairState(null);setNotice("");setError("");setMessageReadError("");setBusy(false);
  },[token]);
  useEffect(()=>{
    const changed=()=>{if((localStorage.getItem(INSIGHT_TOKEN_KEY)||"")!==accountRequest.current)setAccountRevision(value=>value+1)};
    window.addEventListener("mumei-insight-accounts",changed);window.addEventListener("storage",changed);window.addEventListener("focus",changed);window.addEventListener("pageshow",changed);
    return()=>{window.removeEventListener("mumei-insight-accounts",changed);window.removeEventListener("storage",changed);window.removeEventListener("focus",changed);window.removeEventListener("pageshow",changed)};
  },[]);
  useEffect(()=>{if(!active){pauseReads();setLoading(false);setMessagesLoading(false)}},[active]);
  useEffect(()=>{const id=accountNoteId;if(!id||!active)return;
    const receive=(event:MessageEvent)=>{if(token===(localStorage.getItem(INSIGHT_TOKEN_KEY)||"")&&event.source===window&&event.origin===location.origin&&event.data?.source==="mumei-dm-status-bridge"&&event.data?.noteId===id)setReader(event.data.status||null)};
    const ask=()=>{if(document.visibilityState==="visible")window.postMessage({source:"mumei-dm-status-ui",type:"read",noteId:id},location.origin)};
    window.addEventListener("message",receive);ask();const timer=window.setInterval(ask,1000);
    return()=>{window.clearInterval(timer);window.removeEventListener("message",receive)};
  },[active,accountNoteId,token]);
  async function load(silent=false,force=false){
    if(!activeRef.current||document.visibilityState!=="visible"||token!==(localStorage.getItem(INSIGHT_TOKEN_KEY)||""))return;
    if(listFlight.current){if(!force)return;listFlight.current.abort()}
    const id=++listRequest.current,controller=new AbortController();listFlight.current=controller;
    const valid=()=>mounted.current&&activeRef.current&&!controller.signal.aborted&&document.visibilityState==="visible"&&id===listRequest.current&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token;
    if(!silent)setLoading(true);setError("");setSummaryReadState("checking");
    try{
      const results=await Promise.allSettled([
        feed("summary",{},controller.signal,token).then(s=>{if(valid()){setSummary(s);setSummaryReadState("ready")}return s}).catch(e=>{if(valid())setSummaryReadState("error");throw e}),
        feed("people",{},controller.signal,token).then(p=>{if(valid()){const filtered=p.rows.filter(validPerson);setPeople(filtered);setPeopleVerified(true);setSelected(prev=>prev?filtered.find((x:Row)=>x.person_key===prev.person_key)||null:null);setLoading(false)}return p}),
        pair("stats",{},controller.signal,token).then(st=>{if(valid())setPairState(st);return st})
      ]);
      if(!valid())return;
      const failed=results.find(x=>x.status==="rejected");if(failed?.status==="rejected")setError(failed.reason instanceof Error?failed.reason.message:"DM読込失敗");
    }catch(e){if(valid())setError(e instanceof Error?e.message:"DM読込失敗")}finally{if(listFlight.current===controller)listFlight.current=null;if(valid()&&!silent)setLoading(false)}
  }
  async function loadMessages(person:Row|null,silent=false,force=false){
    if(person&&(!activeRef.current||document.visibilityState!=="visible"))return;
    if(token!==(localStorage.getItem(INSIGHT_TOKEN_KEY)||""))return;
    const key=person?`${token}|${person.person_key}`:'';
    if(key&&messageFlight.current===key&&!force)return;
    const seq=++messageRequest.current;messageController.current?.abort();
    if(!person){messageFlight.current='';messageView.current='';verifiedMessageView.current='';setMessages([]);setMessageOwner('');setMessageReadError('');setMessagesLoading(false);return}
    const controller=new AbortController();messageController.current=controller;
    const changed=messageView.current!==key;
    messageFlight.current=key;if(!silent||changed)setMessagesLoading(true);
    setMessageReadError('');
    if(changed){messageView.current=key;setMessages([]);setMessageOwner(person.person_key)}
    const retained=verifiedMessageView.current===key;
    const current=()=>mounted.current&&activeRef.current&&!controller.signal.aborted&&document.visibilityState==="visible"&&seq===messageRequest.current&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token;
    const publish=(rows:Row[])=>{if(!current())return;const seen=new Set<string>();setMessages(rows.filter(r=>{const k=String(r.message_key||r.id||'');if(!k||seen.has(k))return false;seen.add(k);return true}).slice().reverse())};
    try{
      const first=await feed("person_messages",{personKey:person.person_key,page:1,pageSize:500},controller.signal,token);if(!current())return;
      let rows=[...first.rows];if(!retained)publish(rows);
      const expected=Number(first.total),pages=Math.ceil(expected/500);
      for(let page=2;page<=pages&&current();page++){
        const x=await feed("person_messages",{personKey:person.person_key,page,pageSize:500},controller.signal,token);if(!current())return;
        if(!x.rows.length)throw new Error("DM_HISTORY_INCOMPLETE");rows.push(...x.rows);if(!retained)publish(rows);
      }
      if(new Set(rows.map(row=>String(row.message_key||row.id))).size!==expected)throw new Error("DM_HISTORY_INCOMPLETE");
      publish(rows);verifiedMessageView.current=key;
    }catch(e){if(current()){const message=e instanceof Error?e.message:"DM本文の読込に失敗しました";setError(message);setMessageReadError(message)}}
    finally{if(current())setMessagesLoading(false);if(messageController.current===controller){messageController.current=null;if(messageFlight.current===key)messageFlight.current=''}}
  }
  async function startPair(){
    if(busy)return;setBusy(true);setError("");setNotice("");
    try{
      const x=await pair("pair-start");
      const url=String(x.noteUrl||"");if(!url)throw new Error("DM_PAIR_URL_MISSING");
      setNotice("noteのDMを開くと、自動で本文を保存します。");
      window.open(url,"_blank","noopener,noreferrer")
    }catch(e){setError(e instanceof Error?e.message:"DM連携を開始できませんでした")}finally{setBusy(false)}
  }
  useEffect(()=>{if(active)void load(false,true)},[revision,active,token,accountRevision]);
  useEffect(()=>{if(active)void loadMessages(currentSelected,true,true)},[currentSelected?.person_key,revision,active,token,accountRevision]);
  useEffect(()=>{
    if(!active)return;
    const refresh=()=>{if(document.visibilityState!=="visible"){pauseReads();setLoading(false);setMessagesLoading(false);return}void load(true);if(currentSelected)void loadMessages(currentSelected,true)};
    const timer=window.setInterval(refresh,2500);
    window.addEventListener("focus",refresh);window.addEventListener("pageshow",refresh);document.addEventListener("visibilitychange",refresh);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("pageshow",refresh);document.removeEventListener("visibilitychange",refresh)}
  },[currentSelected?.person_key,active,token]);
  useEffect(()=>{
    if(!active)return;
    let dead=false;
    const on=()=>{if(document.visibilityState!=="visible")return;const installed=String(localStorage.getItem(DM_TOOL_KEY)||"");setToolVersion(installed);void fetchInsightRelease().then(x=>{if(dead)return;setLatestDmVersion(String(x.dmVersion||CURRENT_DM_VERSION));setReleaseChecked(true)}).catch(()=>{if(!dead){setLatestDmVersion(CURRENT_DM_VERSION);setReleaseChecked(true)}})};
    on();
    window.addEventListener("mumei-dm-version-changed",on);window.addEventListener("focus",on);window.addEventListener("pageshow",on);document.addEventListener("visibilitychange",on);
    return()=>{dead=true;window.removeEventListener("mumei-dm-version-changed",on);window.removeEventListener("focus",on);window.removeEventListener("pageshow",on);document.removeEventListener("visibilitychange",on)}
  },[active]);
  const visibleMessages=messageOwner===selected?.person_key?messages:[];
  const serverErrors=(summary?.readerStatus||[]).filter((x:Row)=>x.error),lastBodySave=(summary?.readerStatus||[]).find((x:Row)=>Number(x.saved)>0);
  const lastMessageSavedAt=Number(summary?.messages)>0&&typeof summary?.lastMessageSavedAt==="string"&&!Number.isNaN(Date.parse(summary.lastMessageSavedAt))?summary.lastMessageSavedAt:null;
  const installHref="./dm-browser-install.html?return="+encodeURIComponent(location.href);
  const dmMissing=Boolean(releaseChecked&&latestDmVersion&&!toolVersion),dmUpdateAvailable=Boolean(latestDmVersion&&toolVersion&&versionDiffers(toolVersion,latestDmVersion));
  if(accountChanged)return <section id="midm" className="midm"><h2>DM</h2><p className="midm-empty">DM履歴を読み込み中…</p></section>;
  return <section id="midm" className="midm">
    <header className="midm-head"><div><small>PRIVATE DIRECT MESSAGES</small><h2>DM</h2><p>通常のnote DM画面はそのまま。裏で各ルームを同期し、相手ごとにまとめます。</p></div></header>
    <div className="midm-control">
      <div className="midm-control-state">
        <strong className={pairState?.paired?"ok":""}>{pairState?.paired?"✓ DM連携済み":"DM連携 未設定"}</strong>
        <span><b>{peopleVerified?Number(people.length).toLocaleString():"—"}</b>人</span>
        <span><b>{summary?Number(summary.messages).toLocaleString():"—"}</b>件</span>
        <span className="last">本文保存 {summary?(lastMessageSavedAt?fmt(lastMessageSavedAt):lastBodySave?fmt(lastBodySave.checked_at):Number(summary.messages)>0?"保存済み":"未確認"):summaryReadState==="checking"?"確認中":"確認できず"}{summary&&summaryReadState!=="ready"?(summaryReadState==="checking"?"・保存先を確認中":"・保存先の再確認失敗"):""}</span>
      </div>
      <div className="midm-control-main">
        {dmUpdateAvailable?<a className="midm-update-now" href={installHref}>⬆ DM同期 v{latestDmVersion}へ更新</a>:dmMissing?<a className="midm-update-now" href={installHref}>＋ DM同期ツールを入れる</a>:<a href="https://note.com/messages/rooms" target="_blank" rel="noreferrer">noteのDMを開く ↗</a>}
        {dmUpdateAvailable?<span className="midm-update-required">現在 v{toolVersion} → v{latestDmVersion}</span>:!pairState?.paired?<button disabled={busy||!toolVersion} onClick={()=>void startPair()}>連携する</button>:null}
      </div>
      <details>
        <summary><span>⚙ 設定・状態</span><b>開く / 閉じる ▾</b></summary>
        <div className="midm-control-detail">
          <span className="midm-version-state">{toolVersion?`DM同期 v${toolVersion}`:"DM同期ツール未導入"}{dmUpdateAvailable?` / 最新 v${latestDmVersion}`:""}</span>
          <button disabled={busy||!toolVersion} onClick={()=>void startPair()}>{pairState?.paired?"DM連携を再設定":"DMを連携"}</button>
          <button type="button" disabled={loading} onClick={()=>{void load(true,true);if(currentSelected)void loadMessages(currentSelected,true,true)}}>保存先を再確認</button>
        </div>
      </details>
    </div>
    {reader?<p className="midm-read-status" role="status"><b>{reader.lastError?"途中保存・自動再試行待ち":reader.lastRunComplete?(reader.scope==="all"?"✓ 全会話保存完了・新着待ち":"✓ この会話の全件保存完了・新着待ち"):"過去の本文を取得中"}</b><span>{reader.scope==="all"?`完了 ${Number(reader.currentThread||0)} / ${Number(reader.threadCount||0)}人 · `:""}本文保存 {Number(reader.storedMessageCount||0)}件</span>{reader.lastError?<small>{String(reader.lastError)}</small>:null}</p>:null}
    {summaryReadState==="ready"&&summary?.messages===0&&people.length>0?<p className="midm-read-status" role="status"><b>相手一覧のみ取得・本文は未保存</b><span>人数の取得はDM本文の保存完了を意味しません。</span></p>:null}
    {serverErrors.length?<details className="midm-read-status"><summary>本文を取得できていない相手 {serverErrors.length}人</summary>{serverErrors.map((x:Row)=><p key={x.threadKey}>{x.peerName||"相手"}：{x.error==="DM_ROOM_REDIRECTED"?"会話画面を開けませんでした":x.error==="DM_CONVERSATION_NOT_FOUND"?"会話本文の表示待ちで停止":x.error==="DM_PAGINATION_UNVERIFIED"?"本文は途中保存・過去分の確認待ち":x.error} · {fmt(x.checked_at)}</p>)}</details>:null}
    {notice?<p className="midm-notice">{notice}</p>:null}
    {error?<p className="midm-error">⚠ {error}</p>:null}
    {loading&&!people.length?<p className="midm-empty">DM履歴を読み込み中…</p>:!peopleVerified?<p className="midm-empty">保存先のDM相手一覧を確認できませんでした。</p>:<details className="midm-history-panel">
      <summary><span>DM履歴</span><b>{Number(people.length||0).toLocaleString()}人</b><small>タップして開く</small></summary>
      <div className={"midm-layout "+(selected?"is-person":"is-list")}>
        {!selected?<aside className="midm-threads">{people.map(r=><button key={r.person_key} onClick={()=>{messageRequest.current++;setMessages([]);setSelected(r)}}><Avatar row={r}/><span><b>{r.peer_name||r.peer_note_id||"DM相手"}</b><small>{Number(r.room_count||1)>1?String(r.room_count)+"ルーム統合 · ":""}{fmt(r.last_message_at)}</small></span></button>)}</aside>:null}
        {selected?<div className="midm-person-view">
          <button className="midm-back-list" onClick={()=>{setSelected(null);setMessages([])}}>← DM履歴一覧</button>
          <div className="midm-messages"><div className="midm-room-head"><Avatar row={selected}/><div><b>{selected.peer_name||selected.peer_note_id||"DM相手"}</b>{selected.peer_url?<a href={selected.peer_url} target="_blank" rel="noreferrer">プロフィール ↗</a>:null}<small>{Number(selected.room_count||1)>1?String(selected.room_count)+"ルームを1人分として統合":"この人とのDM履歴"}</small></div></div>{visibleMessages.length?visibleMessages.map(m=><article key={m.message_key} className={"midm-message "+(m.direction||"unknown")}><small>{m.direction==="outbound"?"あなた":m.sender_name||selected.peer_name||"相手"} · {fmt(m.sent_at||m.captured_at)}</small>{m.body?<p>{m.body}</p>:null}{m.attachment_url?<a href={m.attachment_url} target="_blank" rel="noreferrer">{m.attachment_name||"添付ファイル"} ↗</a>:null}</article>):<p className="midm-empty">{messagesLoading?"DM本文を読み込み中…":messageReadError?"保存先のDM本文を確認できませんでした。":"この人との保存済みDMはありません。"}</p>}</div>
        </div>:null}
      </div>
    </details>}
  </section>
}
