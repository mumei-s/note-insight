import { CreatorAvatar } from "./creator-avatar";
import { useEffect, useMemo, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY, currentStoredInsightAccount } from "./insight-account-store";
import { CURRENT_DM_VERSION, fetchInsightRelease, versionDiffers } from "./insight-release";
import { fetchInsightResource, isFreshInsightView } from "./insight-view-lifecycle";
import { readSavedInsightView, writeSavedInsightView, removeSavedInsightView } from "./insight-saved-view";
import "./member-insight-dm.css";
import { captureInsightReturn } from "./insight-update-return";

const API="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dm-feed";
const PAIR="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dm-import-token";
const DM_TOOL_KEY="mumei-dm-tool-version";
type Row=Record<string,any>;
async function post(endpoint:string,body:Record<string,unknown>,signal?:AbortSignal,token=localStorage.getItem(INSIGHT_TOKEN_KEY)||""){
  if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
  if(token!==(localStorage.getItem(INSIGHT_TOKEN_KEY)||""))throw new Error("アカウントが切り替わりました");
  try{
    const r=await fetchInsightResource(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify(body),cache:"no-store",signal});
    const p=await r.json().catch(()=>{throw Object.assign(new Error(r.ok?"DM_RESPONSE_INVALID":`HTTP_${r.status}`),{status:r.status})});if(!r.ok||p?.ok===false)throw Object.assign(new Error(p?.error||"DM_API_ERROR"),{status:r.status});
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
const dateFormat=new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
const fmt=(v:any)=>{if(!v)return"—";const d=new Date(typeof v==="number"?v:String(v));return Number.isNaN(d.getTime())?"—":dateFormat.format(d)};
function Avatar({row}:{row:Row}){return <CreatorAvatar person={row} name={String(row.peer_name||row.sender_name||row.peer_note_id||"DM")} className="midm-avatar"/>}
function validPerson(r:Row){const name=String(r.peer_name||"").trim();return Boolean(r.peer_note_id||r.peer_url||r.peer_image_url||(name&&name!=="DM相手"))}
type VerifiedRead={at:number;revision:number;stamp:string};
type CachedMessagePage=VerifiedRead&{key:string;page:number;messages:Row[];total:number;failed?:boolean;invalidated?:boolean};
const MESSAGE_PAGE_SIZE=500, RECHECK_MS=60_000, MESSAGE_CACHE_PAGES=6;
function sameMessageValue(a:any,b:any):boolean{
  if(a===b)return true;
  if(!a||!b||typeof a!=="object"||typeof b!=="object")return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&sameMessageValue(a[key],b[key]));
}
type SavedDmView={summary:Row|null;people:Row[];selected:Row|null;messages:Row[];messageOwner:string;messageTotal:number;messagePage:number};
function readSavedDmView(account:string,token:string){
  const saved=readSavedInsightView<SavedDmView>("dm",{account,token}),value=saved?.value;
  if(!value||!Array.isArray(value.people)||value.people.some(row=>!row?.person_key)||!Array.isArray(value.messages)||value.messages.length>MESSAGE_PAGE_SIZE||value.messages.some(row=>!row||!String(row.message_key||row.id||""))||!Number.isSafeInteger(value.messageTotal)||value.messageTotal<value.messages.length||!Number.isSafeInteger(value.messagePage)||value.messagePage<1)return null;
  if(value.summary&&(!Number.isSafeInteger(value.summary.messages)||value.summary.messages<0))return null;
  if(value.selected&&(!value.people.some(row=>row.person_key===value.selected?.person_key)||value.messageOwner!==value.selected.person_key))return null;
  return saved;
}
function savedVersion(summary:Row,readerSave:number|null){
  // captured_at is the first save time for retained owner rows, not an edit revision.
  // Save signals can invalidate early; the visible page is still checked every minute.
  if(!Object.prototype.hasOwnProperty.call(summary,"lastMessageSavedAt")||!Object.prototype.hasOwnProperty.call(summary,"lastSync"))return "";
  if(!Number.isSafeInteger(summary.threads)||summary.threads<0)return "";
  const savedAt=summary.lastMessageSavedAt;
  if(summary.messages>0&&(typeof savedAt!=="string"||Number.isNaN(Date.parse(savedAt))))return "";
  const run=summary.lastSync,bodyRun=Number(run?.upserted_count)>0?[run.created_at,run.upserted_count]:null;
  if(bodyRun&&(typeof run.created_at!=="string"||Number.isNaN(Date.parse(run.created_at))))return "";
  const reader=(summary.readerStatus||[]).filter((status:Row)=>Number(status.saved)>0).map((status:Row)=>[status.threadKey,status.checked_at,status.saved,status.stored]).sort((a:any[],b:any[])=>String(a[0]).localeCompare(String(b[0])));
  return JSON.stringify([summary.messages,summary.threads??null,savedAt,bodyRun,reader,readerSave||0]);
}
export function MemberInsightDm({revision=0,active=true}:{revision?:number;active?:boolean}){
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"",accountNoteId=String(currentStoredInsightAccount()?.noteId||"").toLowerCase();
  const saved=useMemo(()=>readSavedDmView(accountNoteId,token),[accountNoteId,token]),initial=saved?.value;
  const[summary,setSummary]=useState<any>(initial?.summary||null),[people,setPeople]=useState<Row[]>(initial?.people||[]),[selected,setSelected]=useState<Row|null>(initial?.selected||null),[messages,setMessages]=useState<Row[]>(initial?.messages||[]),[pairState,setPairState]=useState<any>(null),[loading,setLoading]=useState(!initial),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
  const[toolVersion,setToolVersion]=useState(()=>String(localStorage.getItem(DM_TOOL_KEY)||"")),[latestDmVersion,setLatestDmVersion]=useState(CURRENT_DM_VERSION),[releaseChecked,setReleaseChecked]=useState(false);
  const[reader,setReader]=useState<any>(null),messageRequest=useRef(0),messageFlight=useRef<string>(""),messageView=useRef<string>(initial?.selected?`${token}|${initial.selected.person_key}`:""),listRequest=useRef(0),listFlight=useRef<AbortController|null>(null),messageController=useRef<AbortController|null>(null),mounted=useRef(true),activeRef=useRef(active);activeRef.current=active;
  const[messageOwner,setMessageOwner]=useState(initial?.messageOwner||""),[messagesLoading,setMessagesLoading]=useState(false),[messageTotal,setMessageTotal]=useState(initial?.messageTotal||0),[messagePage,setMessagePage]=useState(initial?.messagePage||1);
  const[viewToken,setViewToken]=useState(token),[viewAccount,setViewAccount]=useState(accountNoteId),[summaryReadState,setSummaryReadState]=useState<"checking"|"ready"|"error">("checking"),[messageReadError,setMessageReadError]=useState(""),[peopleVerified,setPeopleVerified]=useState(Boolean(initial));
  const[previousList,setPreviousList]=useState(Boolean(initial)),[previousMessages,setPreviousMessages]=useState(Boolean(initial?.selected)),[savedAt,setSavedAt]=useState(saved?.savedAt||0);
  const accountRequest=useRef(token),accountIdRequest=useRef(accountNoteId),verifiedMessageView=useRef(initial?.selected?`${token}|${initial.selected.person_key}`:""),[accountRevision,setAccountRevision]=useState(0);
  const accountChanged=viewToken!==token||viewAccount!==accountNoteId,currentSelected=accountChanged?null:selected;
  const selectedRef=useRef(currentSelected);selectedRef.current=currentSelected;
  const requestedPageRef=useRef(1);
  const listVerified=useRef<VerifiedRead|null>(null),listRevision=useRef(revision),messageVerified=useRef<(VerifiedRead&{key:string;page:number})|null>(null),summaryVersion=useRef(""),readerSave=useRef<number|null>(null),pairVerified=useRef(0),summaryVerified=useRef(0);
  const messagePages=useRef(new Map<string,CachedMessagePage>()),messagePageScope=useRef(""),messageFlightVersion=useRef<{stamp:string;summaryKnown:boolean}|null>(null);
  const pageScope=JSON.stringify([accountNoteId,token,revision]);
  if(messagePageScope.current!==pageScope){messagePageScope.current=pageScope;messagePages.current.clear()}
  const lateRestore=useRef<{allowed:boolean;revision:number;summary:Row|null;people:Row[]|null;messages:boolean}>({allowed:!initial,revision,summary:null,people:null,messages:false}),hydratedSelection=useRef("");
  const[historyRestored,setHistoryRestored]=useState(Boolean(initial?.selected));
  if(lateRestore.current.revision!==revision||!active)lateRestore.current.allowed=false;
  function pauseReads(){listRequest.current++;messageRequest.current++;listFlight.current?.abort();messageController.current?.abort();listFlight.current=null;messageController.current=null;messageFlight.current=""}
  function discardDeniedView(error:unknown){
    const status=Number((error as {status?:number})?.status);if(status!==401&&status!==403)return false;
    lateRestore.current.allowed=false;
    messagePages.current.clear();
    removeSavedInsightView("dm",{account:accountNoteId,token});pauseReads();listVerified.current=null;messageVerified.current=null;summaryVerified.current=0;summaryVersion.current="";verifiedMessageView.current="";
    setPeople([]);setSelected(null);setMessages([]);setMessageOwner("");setMessageTotal(0);setMessagePage(1);setSummary(null);setPeopleVerified(false);setPreviousList(false);setPreviousMessages(false);setSavedAt(0);setLoading(false);setMessagesLoading(false);setSummaryReadState("error");setReader(null);setPairState(null);setMessageReadError("");setError(error instanceof Error?error.message:"INSIGHT_LOGIN_REQUIRED");return true;
  }
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;pauseReads()}},[]);
  useEffect(()=>{
    lateRestore.current={allowed:!initial&&activeRef.current,revision,summary:null,people:null,messages:false};hydratedSelection.current="";setHistoryRestored(Boolean(initial?.selected));
    pauseReads();accountRequest.current=token;accountIdRequest.current=accountNoteId;messageView.current=initial?.selected?`${token}|${initial.selected.person_key}`:"";verifiedMessageView.current=messageView.current;
    listVerified.current=null;listRevision.current=revision;messageVerified.current=null;summaryVersion.current="";readerSave.current=null;pairVerified.current=0;summaryVerified.current=0;
    setViewToken(token);setViewAccount(accountNoteId);setSummary(initial?.summary||null);setSummaryReadState("checking");setPeople(initial?.people||[]);setPeopleVerified(Boolean(initial));setSelected(initial?.selected||null);setMessages(initial?.messages||[]);setMessageOwner(initial?.messageOwner||"");setMessageTotal(initial?.messageTotal||0);setMessagePage(initial?.messagePage||1);requestedPageRef.current=1;setPreviousList(Boolean(initial));setPreviousMessages(Boolean(initial?.selected));setSavedAt(saved?.savedAt||0);setLoading(!initial);setReader(null);setPairState(null);setNotice("");setError("");setMessageReadError("");setBusy(false);
  },[token,accountNoteId]);
  // A bounded IndexedDB startup retry can reveal a copy after this scene mounts.
  // Restore only missing display fields; live reads and user navigation own the view.
  useEffect(()=>{
    const restore=()=>{
      const state=lateRestore.current;
      if(!state.allowed||!mounted.current||!activeRef.current||document.visibilityState!=="visible"||state.revision!==revision||accountRequest.current!==token||accountIdRequest.current!==accountNoteId||token!==(localStorage.getItem(INSIGHT_TOKEN_KEY)||"")||String(currentStoredInsightAccount()?.noteId||"").toLowerCase()!==accountNoteId)return;
      const copy=readSavedDmView(accountNoteId,token);if(!copy)return;state.allowed=false;
      const value=copy.value;let restored=false;
      if(!state.summary&&value.summary){setSummary(value.summary);restored=true}
      if(!state.people){setPeople(value.people);setPeopleVerified(true);setPreviousList(true);restored=true}
      const person=value.selected,current=selectedRef.current;
      if(person&&!state.messages&&(!current||current.person_key===person.person_key)&&(!state.people||state.people.some(row=>row.person_key===person.person_key))&&(!state.summary||state.summary.messages>0)){
        const key=`${token}|${person.person_key}`;if(!current)hydratedSelection.current=key;
        selectedRef.current=person;messageView.current=key;verifiedMessageView.current=key;
        setSelected(person);setMessages(value.messages);setMessageOwner(value.messageOwner);setMessageTotal(value.messageTotal);setMessagePage(value.messagePage);setPreviousMessages(true);setHistoryRestored(true);restored=true;
      }
      if(restored)setSavedAt(copy.savedAt);
    };
    window.addEventListener("mumei-insight-storage-hydrated",restore);restore();
    return()=>window.removeEventListener("mumei-insight-storage-hydrated",restore);
  },[token,accountNoteId,revision]);
  useEffect(()=>{
    if(!accountChanged&&!previousList&&!previousMessages&&summaryReadState==="ready"&&listVerified.current&&(!selected||messageVerified.current?.key===`${token}|${selected.person_key}`)){
      const checkedAt=Math.min(listVerified.current.at,summaryVerified.current,selected?messageVerified.current!.at:Infinity);if(checkedAt>0&&Number.isFinite(checkedAt))setSavedAt(checkedAt);
    }
  },[accountChanged,previousList,previousMessages,summaryReadState,summary,people,messages,selected,loading,token]);
  // Persist one visible conversation page, never every room's private message history.
  useEffect(()=>{
    if(accountChanged||!peopleVerified||!summary||!savedAt||token!==(localStorage.getItem(INSIGHT_TOKEN_KEY)||""))return;
    const owner=selected&&messageOwner===selected.person_key&&verifiedMessageView.current===`${token}|${selected.person_key}`?messageOwner:"";
    writeSavedInsightView<SavedDmView>("dm",{account:accountNoteId,token},{summary,people,selected:owner?selected:null,messages:owner?messages.slice(-MESSAGE_PAGE_SIZE):[],messageOwner:owner,messageTotal:owner?messageTotal:0,messagePage:owner?messagePage:1},savedAt);
  },[summary,people,selected,messages,messageOwner,messageTotal,messagePage,peopleVerified,savedAt,accountChanged,accountNoteId,token]);
  useEffect(()=>{
    const changed=()=>{if((localStorage.getItem(INSIGHT_TOKEN_KEY)||"")!==accountRequest.current||String(currentStoredInsightAccount()?.noteId||"").toLowerCase()!==accountIdRequest.current)setAccountRevision(value=>value+1)};
    window.addEventListener("mumei-insight-accounts",changed);window.addEventListener("storage",changed);window.addEventListener("focus",changed);window.addEventListener("pageshow",changed);
    return()=>{window.removeEventListener("mumei-insight-accounts",changed);window.removeEventListener("storage",changed);window.removeEventListener("focus",changed);window.removeEventListener("pageshow",changed)};
  },[]);
  useEffect(()=>{if(!active){pauseReads();setLoading(false);setMessagesLoading(false)}},[active]);
  useEffect(()=>{const id=accountNoteId;if(!id||!active)return;
    const receive=(event:MessageEvent)=>{if(token===(localStorage.getItem(INSIGHT_TOKEN_KEY)||"")&&event.source===window&&event.origin===location.origin&&event.data?.source==="mumei-dm-status-bridge"&&event.data?.noteId===id){const status=event.data.status||null,next=Number(status?.lastSaveAt||0),previous=readerSave.current;setReader(status);readerSave.current=next;if(previous!==null&&next>0&&next!==previous)void load(true,true)}};
    const ask=()=>{if(document.visibilityState==="visible")window.postMessage({source:"mumei-dm-status-ui",type:"read",noteId:id},location.origin)};
    window.addEventListener("message",receive);ask();const timer=window.setInterval(ask,1000);
    return()=>{window.clearInterval(timer);window.removeEventListener("message",receive)};
  },[active,accountNoteId,token,revision]);
  async function load(silent=false,force=false){
    if(!activeRef.current||document.visibilityState!=="visible"||token!==(localStorage.getItem(INSIGHT_TOKEN_KEY)||""))return;
    const revisionChanged=listRevision.current!==revision;
    const freshMessage=!selectedRef.current||(messageVerified.current?.key===`${token}|${selectedRef.current.person_key}`&&messageVerified.current.page===requestedPageRef.current&&messageVerified.current.stamp===summaryVersion.current&&isFreshInsightView(messageVerified.current.at,RECHECK_MS-1));
    if(!force&&!revisionChanged&&listVerified.current&&isFreshInsightView(listVerified.current.at,RECHECK_MS-1)&&isFreshInsightView(summaryVerified.current,RECHECK_MS-1)&&freshMessage)return;
    if(listFlight.current){if(!force&&!revisionChanged)return;listFlight.current.abort()}
    if(force||revisionChanged){messagePages.current.clear();messageRequest.current++;messageController.current?.abort();messageController.current=null;messageFlight.current=""}
    listRevision.current=revision;
    const id=++listRequest.current,controller=new AbortController();listFlight.current=controller;
    const valid=()=>mounted.current&&activeRef.current&&!controller.signal.aborted&&document.visibilityState==="visible"&&id===listRequest.current&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token&&String(currentStoredInsightAccount()?.noteId||"").toLowerCase()===accountNoteId;
    const forced=force||revisionChanged||!listVerified.current||listVerified.current.revision!==revision;
    if(!silent&&forced)setLoading(true);setError("");setSummaryReadState("checking");
    let stamp="",summaryReady=false,bodyTarget="",peopleRows:Row[]|null=null;
    const selectedPerson=()=>{const selected=selectedRef.current;return selected&&peopleRows?peopleRows.find(row=>row.person_key===selected.person_key)||null:selected};
    const readLists=()=>Promise.allSettled([
      feed("people",{},controller.signal,token).then(p=>{if(valid()){const filtered=p.rows.filter(validPerson);lateRestore.current.people=filtered;peopleRows=filtered;setPeople(filtered);setPeopleVerified(true);setPreviousList(false);setSelected(previous=>previous?filtered.find((row:Row)=>row.person_key===previous.person_key)||null:null);setLoading(false)}return p}).catch(error=>{if(valid())discardDeniedView(error);throw error}),
      ...(forced||!isFreshInsightView(pairVerified.current)?[pair("stats",{},controller.signal,token).then(st=>{if(valid()){setPairState(st);pairVerified.current=Date.now()}return st}).catch(error=>{if(valid())discardDeniedView(error);throw error})]:[])
    ]);
    let lists=forced?readLists():null;
    try{
      const errors:unknown[]=[];
      try{const s=await feed("summary",{},controller.signal,token);if(!valid())return;lateRestore.current.summary=s;setSummary(s);setSummaryReadState("ready");summaryReady=true;stamp=savedVersion(s,readerSave.current);summaryVersion.current=stamp;
        // The first summary labels the concurrent initial read; it is not a new save signal.
        if(!summaryVerified.current&&messageFlight.current&&messageFlightVersion.current&&!messageFlightVersion.current.summaryKnown){messageFlightVersion.current.stamp=stamp;messageFlightVersion.current.summaryKnown=true}
        summaryVerified.current=Date.now();
        const saved=listVerified.current;if(!lists&&(!saved||!stamp||saved.stamp!==stamp||!isFreshInsightView(saved.at)||!isFreshInsightView(pairVerified.current)))lists=readLists();
      }catch(e){if(!valid()||discardDeniedView(e))return;setSummaryReadState("error");summaryVerified.current=0;errors.push(e)}
      // A slow people refresh must not hold up the already selected conversation.
      const initialPerson=selectedPerson();if(summaryReady&&initialPerson){bodyTarget=initialPerson.person_key;void loadMessages(initialPerson,true,force||revisionChanged)}
      const results=lists?await lists:[];
      if(!valid())return;
      if(results[0]?.status==="fulfilled")listVerified.current={at:Date.now(),revision,stamp};
      if(results[0]?.status==="rejected")listVerified.current=null;
      if(results[1]?.status==="rejected")pairVerified.current=0;
      for(const result of results)if(result.status==="rejected")errors.push(result.reason);
      if(errors.some(discardDeniedView))return;
      if(errors.length)setError(errors[0] instanceof Error?errors[0].message:"DM読込失敗");
      const latestPerson=selectedPerson();if((summaryReady||forced)&&latestPerson&&latestPerson.person_key!==bodyTarget)void loadMessages(latestPerson,true,force||revisionChanged);
    }catch(e){if(valid())setError(e instanceof Error?e.message:"DM読込失敗")}finally{if(listFlight.current===controller)listFlight.current=null;if(valid()&&!silent)setLoading(false)}
  }
  async function loadMessages(person:Row|null,silent=false,force=false,page=requestedPageRef.current,reuseVerified=false){
    if(person&&(!activeRef.current||document.visibilityState!=="visible"))return;
    if(token!==(localStorage.getItem(INSIGHT_TOKEN_KEY)||""))return;
    const key=person?`${token}|${person.person_key}`:'',flightKey=`${key}|${page}`;
    if(key&&messageFlight.current===flightKey&&messageFlightVersion.current?.stamp===summaryVersion.current&&!force)return;
    if(force)messagePages.current.clear();
    const cached=messagePages.current.get(flightKey),retained=!force&&cached?.revision===revision?cached:null;
    const seq=++messageRequest.current;messageController.current?.abort();
    if(!person){messageFlight.current='';messageView.current='';verifiedMessageView.current='';messageVerified.current=null;setMessages([]);setMessageOwner('');setMessageReadError('');setMessagesLoading(false);setMessageTotal(0);setMessagePage(1);setPreviousMessages(false);return}
    if(retained){
      messagePages.current.delete(flightKey);messagePages.current.set(flightKey,retained);
      // Navigation reuses complete pages without extending their verification clock.
      const fresh=!retained.failed&&!retained.invalidated&&retained.stamp===summaryVersion.current&&(reuseVerified||isFreshInsightView(retained.at,RECHECK_MS-1));
      messageView.current=key;verifiedMessageView.current=key;messageVerified.current=retained;requestedPageRef.current=page;
      setMessages(retained.messages);setMessageOwner(person.person_key);setMessageTotal(retained.total);setMessagePage(page);setMessagesLoading(false);setPreviousMessages(!fresh);setMessageReadError('');setError(previous=>previous===messageReadError?'':previous);
      if(fresh){messageController.current=null;messageFlight.current='';return}
    }
    const controller=new AbortController();messageController.current=controller;
    const changed=messageView.current!==key;
    const capturedVersion={stamp:summaryVersion.current,summaryKnown:summaryVerified.current>0};
    messageFlight.current=flightKey;messageFlightVersion.current=capturedVersion;if(!retained&&(!silent||changed))setMessagesLoading(true);
    setError(previous=>previous===messageReadError?'':previous);setMessageReadError('');
    if(changed){messageView.current=key;verifiedMessageView.current="";setMessages([]);setMessageOwner(person.person_key);setMessageTotal(0);setMessagePage(1);setPreviousMessages(false);page=1}
    requestedPageRef.current=page;
    const current=()=>mounted.current&&activeRef.current&&!controller.signal.aborted&&document.visibilityState==="visible"&&seq===messageRequest.current&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token&&String(currentStoredInsightAccount()?.noteId||"").toLowerCase()===accountNoteId;
    try{
      // The API orders newest first. Fetch only this visible page; older pages are explicit.
      const result=await feed("person_messages",{personKey:person.person_key,page,pageSize:MESSAGE_PAGE_SIZE},controller.signal,token);if(!current())return;
      const total=Number(result.total),expected=Math.min(MESSAGE_PAGE_SIZE,Math.max(0,total-(page-1)*MESSAGE_PAGE_SIZE));
      const seen=new Set<string>(),rows=result.rows.filter((row:Row)=>{const key=String(row.message_key||row.id||'');if(seen.has(key))return false;seen.add(key);return true});
      if(rows.length!==expected)throw new Error("DM_HISTORY_INCOMPLETE");
      if(page>1&&total>0&&expected===0){void loadMessages(person,silent,true,Math.max(1,Math.ceil(total/MESSAGE_PAGE_SIZE)));return}
      if(total===0){page=1;requestedPageRef.current=1}
      lateRestore.current.messages=true;
      const messages=rows.slice().reverse(),verified={key,page,at:Date.now(),revision,stamp:capturedVersion.stamp};
      setMessages(messages);setMessageOwner(person.person_key);setMessageTotal(total);setMessagePage(page);setPreviousMessages(false);
      verifiedMessageView.current=key;messageVerified.current=verified;
      const cacheKey=`${key}|${page}`,previous=messagePages.current.get(cacheKey);
      if(previous&&(previous.total!==total||!sameMessageValue(previous.messages,messages)))for(const[id,saved]of messagePages.current)if(saved.key===key&&id!==cacheKey)messagePages.current.set(id,{...saved,invalidated:true});
      messagePages.current.delete(cacheKey);messagePages.current.set(cacheKey,{...verified,messages,total});
      if(messagePages.current.size>MESSAGE_CACHE_PAGES)messagePages.current.delete(messagePages.current.keys().next().value!);
    }catch(e){if(current()){if(discardDeniedView(e))return;const previous=messagePages.current.get(flightKey);if(previous)messagePages.current.set(flightKey,{...previous,failed:true});messageVerified.current=null;const message=e instanceof Error?e.message:"DM本文の読込に失敗しました";setError(message);setMessageReadError(message)}}
    finally{if(current())setMessagesLoading(false);if(messageController.current===controller){messageController.current=null;if(messageFlight.current===flightKey)messageFlight.current=''}}
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
  useEffect(()=>{if(active)void load(false)},[revision,active,token,accountNoteId,accountRevision]);
  useEffect(()=>{if(hydratedSelection.current){if(hydratedSelection.current===`${token}|${currentSelected?.person_key}`)hydratedSelection.current="";return}if(active&&!accountChanged)void loadMessages(currentSelected,true,false,requestedPageRef.current,true)},[currentSelected?.person_key,token,accountNoteId,accountChanged]);
  useEffect(()=>{
    if(!active)return;
    const refresh=()=>{if(document.visibilityState!=="visible"){pauseReads();setLoading(false);setMessagesLoading(false);return}void load(true)};
    const timer=window.setInterval(refresh,RECHECK_MS);
    window.addEventListener("focus",refresh);window.addEventListener("pageshow",refresh);document.addEventListener("visibilitychange",refresh);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("pageshow",refresh);document.removeEventListener("visibilitychange",refresh)}
  },[active,token,accountNoteId,revision]);
  useEffect(()=>{
    if(!active)return;
    let dead=false;
    const on=()=>{if(document.visibilityState!=="visible")return;const installed=String(localStorage.getItem(DM_TOOL_KEY)||"");setToolVersion(installed);void fetchInsightRelease().then(x=>{if(dead)return;setLatestDmVersion(String(x.dmVersion||CURRENT_DM_VERSION));setReleaseChecked(true)}).catch(()=>{if(!dead){setLatestDmVersion(CURRENT_DM_VERSION);setReleaseChecked(true)}})};
    on();
    window.addEventListener("mumei-dm-version-changed",on);window.addEventListener("focus",on);window.addEventListener("pageshow",on);document.addEventListener("visibilitychange",on);
    return()=>{dead=true;window.removeEventListener("mumei-dm-version-changed",on);window.removeEventListener("focus",on);window.removeEventListener("pageshow",on);document.removeEventListener("visibilitychange",on)}
  },[active]);
  const visibleMessages=messageOwner===selected?.person_key?messages:[];
  const messageElements=useMemo(()=>visibleMessages.map(message=><article key={message.message_key} className={"midm-message "+(message.direction||"unknown")}><small>{message.direction==="outbound"?"あなた":message.sender_name||selected?.peer_name||"相手"} · {fmt(message.sent_at||message.captured_at)}</small>{message.body?<p>{message.body}</p>:null}{message.attachment_url?<a href={message.attachment_url} target="_blank" rel="noreferrer">{message.attachment_name||"添付ファイル"} ↗</a>:null}</article>),[visibleMessages,selected?.peer_name]);
  const serverErrors=(summary?.readerStatus||[]).filter((x:Row)=>x.error),lastBodySave=(summary?.readerStatus||[]).find((x:Row)=>Number(x.saved)>0);
  const lastMessageSavedAt=Number(summary?.messages)>0&&typeof summary?.lastMessageSavedAt==="string"&&!Number.isNaN(Date.parse(summary.lastMessageSavedAt))?summary.lastMessageSavedAt:null;
  const installHref="./dm-browser-install.html?return="+encodeURIComponent(captureInsightReturn({mode:"normal",tab:"dm",account:accountNoteId}))+(accountNoteId?"&account="+encodeURIComponent(accountNoteId):"");
  const dmMissing=Boolean(releaseChecked&&latestDmVersion&&!toolVersion),dmUpdateAvailable=Boolean(latestDmVersion&&toolVersion&&versionDiffers(toolVersion,latestDmVersion));
  if(accountChanged)return <section id="midm" className="midm"><h2>DM</h2><p className="midm-empty">DM履歴を読み込み中…</p></section>;
  return <section id="midm" className="midm" onClickCapture={()=>{lateRestore.current.allowed=false}} onChangeCapture={()=>{lateRestore.current.allowed=false}}>
    <header className="midm-head"><div><small>PRIVATE DIRECT MESSAGES</small><h2>DM</h2><p>通常のnote DM画面はそのまま。裏で各ルームを同期し、相手ごとにまとめます。</p></div></header>
    <div className="midm-control">
      <div className="midm-control-state">
        <strong className={pairState?.paired?"ok":""}>{pairState?.paired?"✓ DM連携済み":pairState?"DM連携 未設定":"DM連携 確認中"}</strong>
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
          <button type="button" disabled={loading} onClick={()=>void load(true,true)}>保存先を再確認</button>
        </div>
      </details>
    </div>
    {reader?<p className="midm-read-status" role="status"><b>{reader.lastError?"途中保存・自動再試行待ち":reader.lastRunComplete?(reader.scope==="all"?"✓ 全会話保存完了・新着待ち":"✓ この会話の全件保存完了・新着待ち"):"過去の本文を取得中"}</b><span>{reader.scope==="all"?`完了 ${Number(reader.currentThread||0)} / ${Number(reader.threadCount||0)}人 · `:""}本文保存 {Number(reader.storedMessageCount||0)}件</span>{reader.lastError?<small>{String(reader.lastError)}</small>:null}</p>:null}
    {summaryReadState==="ready"&&summary?.messages===0&&people.length>0?<p className="midm-read-status" role="status"><b>相手一覧のみ取得・本文は未保存</b><span>人数の取得はDM本文の保存完了を意味しません。</span></p>:null}
    {serverErrors.length?<details className="midm-read-status"><summary>本文を取得できていない相手 {serverErrors.length}人</summary>{serverErrors.map((x:Row)=><p key={x.threadKey}>{x.peerName||"相手"}：{x.error==="DM_ROOM_REDIRECTED"?"会話画面を開けませんでした":x.error==="DM_CONVERSATION_NOT_FOUND"?"会話本文の表示待ちで停止":x.error==="DM_PAGINATION_UNVERIFIED"?"本文は途中保存・過去分の確認待ち":x.error} · {fmt(x.checked_at)}</p>)}</details>:null}
    {notice?<p className="midm-notice">{notice}</p>:null}
    {error?<p className="midm-error">⚠ {error}</p>:null}
    {(previousList||previousMessages)?<p className="midm-read-status midm-previous" role="status">前回表示分・{error||messageReadError?"最新確認できず":"最新確認中"}{savedAt?`（${fmt(savedAt)}）`:""}</p>:null}
    {loading&&!people.length?<p className="midm-empty">DM履歴を読み込み中…</p>:!peopleVerified?<p className="midm-empty">保存先のDM相手一覧を確認できませんでした。</p>:<details className="midm-history-panel" open={historyRestored?true:undefined}>
      <summary><span>DM履歴</span><b>{Number(people.length||0).toLocaleString()}人</b><small>タップして開く</small></summary>
      <div className={"midm-layout "+(selected?"is-person":"is-list")}>
        {!selected?<aside className="midm-threads">{people.map(r=><button key={r.person_key} onClick={()=>{const previous=Array.from(messagePages.current.values()).reverse().find(item=>item.key===`${token}|${r.person_key}`);messageRequest.current++;requestedPageRef.current=previous?.page||1;setMessagePage(previous?.page||1);setMessages([]);setSelected(r)}}><Avatar row={r}/><span><b>{r.peer_name||r.peer_note_id||"DM相手"}</b><small>{Number(r.room_count||1)>1?String(r.room_count)+"ルーム統合 · ":""}{fmt(r.last_message_at)}</small></span></button>)}</aside>:null}
        {selected?<div className="midm-person-view">
          <button className="midm-back-list" onClick={()=>{setSelected(null);setMessages([])}}>← DM履歴一覧</button>
          <div className="midm-messages"><div className="midm-room-head"><Avatar row={selected}/><div><b>{selected.peer_name||selected.peer_note_id||"DM相手"}</b>{selected.peer_url?<a href={selected.peer_url} target="_blank" rel="noreferrer">プロフィール ↗</a>:null}<small>{Number(selected.room_count||1)>1?String(selected.room_count)+"ルームを1人分として統合":"この人とのDM履歴"}</small></div></div>{visibleMessages.length?messageElements:<p className="midm-empty">{messagesLoading?"DM本文を読み込み中…":messageReadError?"保存先のDM本文を確認できませんでした。":"この人との保存済みDMはありません。"}</p>}
          {messageReadError?<button type="button" disabled={messagesLoading} onClick={()=>void loadMessages(selected,false,true)}>DM本文を再確認</button>:null}
          {messageTotal>MESSAGE_PAGE_SIZE?<div className="midm-message-pages"><button type="button" disabled={messagesLoading||messagePage<=1} onClick={()=>void loadMessages(selected,false,false,messagePage-1,true)}>新しいDM</button><span>{messagePage} / {Math.ceil(messageTotal/MESSAGE_PAGE_SIZE)}ページ · 全{messageTotal.toLocaleString()}件</span><button type="button" disabled={messagesLoading||messagePage>=Math.ceil(messageTotal/MESSAGE_PAGE_SIZE)} onClick={()=>void loadMessages(selected,false,false,messagePage+1,true)}>過去のDM</button></div>:null}</div>
        </div>:null}
      </div>
    </details>}
  </section>
}
