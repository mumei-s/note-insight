import { useEffect, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import "./member-insight-notifications-final.css";

const FEED="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-feed-final";
const ICON="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-icons";
const PAGE=100;
const CLASSIFIER_VERSION="action-v22-unmatched-safe";
type Row=Record<string,any>;

const CATS=[["all","すべて"],["my_article_magazine_added","自分の記事追加"],["comment_like","コメント♡"],["reply_self","自分の記事返信"],["reply_other","相手の記事返信"],["reply_unknown","返信先確認待ち"],["magazine_follow","マガジンフォロー"],["magazine_article_added","マガジン記事追加"],["magazine_join","マガジン参加"],["membership_board","メンシプ掲示板"],["membership_board_reply","掲示板返信"],["membership_reaction_self","自分のメンシプ反応"],["membership_reaction_joined","参加中のメンシプ反応"],["membership_reaction_unknown","メンシプ所有者確認待ち"],["membership_started","メンシプ開始"],["membership_plan","プラン追加"],["membership_join","メンシプ参加"],["question_box_started","質問箱開始"],["purchase","購入"],["tip","チップ・サポート"],["buzz","話題"],["rating","高評価"],["points","ポイント"],["quote","引用・紹介"],["other","その他・未分類"]] as const;
const LABEL:Record<string,string>=Object.fromEntries(CATS);
const ICON_FALLBACK:Record<string,string>={like:"♥",comment_like:"♡",comment:"💬",reply_self:"↩",reply_other:"↩",reply:"↩",follow:"＋",creator_article_posted:"📝",magazine_follow:"📚",my_article_magazine_added:"📚",magazine_article_added:"📚",magazine_join:"📚",membership_board:"📌",membership_board_reply:"↩",membership_reaction_self:"♥",membership_reaction_joined:"♥",membership_reaction:"♥",membership_started:"🚀",membership_plan:"＋",membership_join:"👤",question_box_started:"？",purchase:"🛒",tip:"🎁",buzz:"🔥",rating:"🏆",points:"P",quote:"↗",other:"🔔"};

async function post(body:Record<string,unknown>,signal?:AbortSignal){const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");const c=new AbortController(),timer=window.setTimeout(()=>c.abort(),45000);const abort=()=>c.abort();signal?.addEventListener("abort",abort,{once:true});try{const r=await fetch(FEED,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify(body),cache:"no-store",signal:c.signal});const p=await r.json().catch(()=>({}));if(!r.ok||p?.ok===false)throw new Error(p?.error||"INSIGHT_API_ERROR");return p}finally{window.clearTimeout(timer);signal?.removeEventListener("abort",abort)}}
const date=(v:any)=>{if(!v)return"—";const d=new Date(String(v));return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)};
const dayLabel=(v:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return"全期間";const[y,m,d]=v.split("-").map(Number);return`${y}/${m}/${d}`};
const canonical=(v:any)=>String(v||"").replace(/保完(?=\s|$)/g," ").replace(/\s+/g," ").replace(/\s(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)$/u,"").trim();
const short=(v:any,n=170)=>{const s=canonical(v);return s.length>n?s.slice(0,n-1)+"…":s};
function noteId(url:any){try{const id=new URL(String(url||"")).pathname.split("/").filter(Boolean)[0]||"";return /^[A-Za-z0-9_-]+$/.test(id)?id.toLowerCase():""}catch{return""}}
function requestedNotificationAccount(){try{return String(new URLSearchParams(window.location.search).get("notificationAccount")||sessionStorage.getItem("mumei-insight-notification-account")||"").trim().replace(/^@/,"").toLowerCase()}catch{return""}}
function creatorTop(url:any,selfId=""){const id=noteId(url);return id&&id!==String(selfId||"").toLowerCase()?`https://note.com/${id}`:""}
function safeActorImage(v:any){const s=String(v||"");return s&&!/magazine_cover|ogp|cover|\/assets\/notices\/|notices\/icon_|icon_(?:comment|magazine|notification|notice)/i.test(s)?s:""}
function richness(r:Row){let n=0;if(r.actor_url)n+=8;if(safeActorImage(r.actor_image_url))n+=8;else if(r.actor_image_url)n+=1;if(r.target_url)n+=4;if(r.occurred_at)n+=2;if(r.target_title)n+=1;return n}
function mergePair(a:Row,b:Row){const p=richness(b)>richness(a)?b:a,o=p===b?a:b,pi=safeActorImage(p.actor_image_url)||safeActorImage(o.actor_image_url)||null;return{...o,...p,actor_name:p.actor_name||o.actor_name||null,actor_url:p.actor_url||o.actor_url||null,actor_image_url:pi,target_url:p.target_url||o.target_url||null,target_title:p.target_title||o.target_title||null,source_url:p.source_url||o.source_url||null,occurred_at:p.occurred_at||o.occurred_at||null,captured_at:p.captured_at||o.captured_at||null}}
function mergeActorIdentity(r:Row,known:Row):Row{return{...r,actor_name:r.actor_name||known.actor_name||null,actor_url:r.actor_url||known.actor_url||null,actor_image_url:safeActorImage(r.actor_image_url)||safeActorImage(known.actor_image_url)||null}}
function mergeMagazineJoinRows(rows:Row[]){const out:Row[]=[],map=new Map<string,number>();for(const r of rows){if(String(r.notification_type||"")!=="magazine_join"){out.push(r);continue}const day=String(r.captured_at||r.occurred_at||"").slice(0,10),k=`magazine_join|${canonical(r.raw_text)}|${day}`;const i=map.get(k);if(i==null){map.set(k,out.length);out.push(r)}else out[i]=mergePair(out[i],r)}return out}
function actorStem(r:Row){const raw=canonical(r.raw_text),type=String(r.notification_type||"");if(type==="my_article_magazine_added"){const end=raw.indexOf("に追加されました");return end>=0?raw.slice(0,end+8):""}if(type==="reply"){const token="さんがあなたのコメントに返信しました",end=raw.indexOf(token);return end>=0?raw.slice(0,end+token.length):""}if(type==="comment"){const token="さんがあなたの記事にコメントしました",end=raw.indexOf(token);return end>=0?raw.slice(0,end+token.length):""}return""}
function eventMs(r:Row){return Date.parse(String(r.captured_at||r.occurred_at||""))||0}
function repairActorRows(rows:Row[]){const work:Row[]=rows.map((r:Row):Row=>({...r,actor_image_url:safeActorImage(r.actor_image_url)||null}));const alias=new Map<string,Row>();for(const r of work){const name=canonical(r.actor_name).toLowerCase();if(name&&r.actor_url){const prev=alias.get(name);if(!prev||richness(r)>richness(prev))alias.set(name,r)}}for(let i=0;i<work.length;i++){let r:Row=work[i];const type=String(r.notification_type||"");if(type==="my_article_magazine_added"&&!r.actor_url){const id=noteId(r.target_url);if(id)r={...r,actor_url:`https://note.com/${id}`,actor_name:r.actor_name||`追加先の運営者 @${id}`}}const name=canonical(r.actor_name).toLowerCase(),known=name?alias.get(name):null;if(known)r=mergeActorIdentity(r,known);const stem=actorStem(r),at=eventMs(r);if(stem){let best:Row|null=null,bestGap=Infinity;for(let j=0;j<work.length;j++){if(i===j)continue;const q=work[j];if(String(q.notification_type||"")!==type||actorStem(q)!==stem)continue;const gap=Math.abs(at-eventMs(q));if(gap<=180000&&gap<bestGap&&(q.actor_url||q.target_url||safeActorImage(q.actor_image_url))){best=q;bestGap=gap}}if(best)r=mergeActorIdentity(r,best)}if(type==="my_article_magazine_added"&&!r.actor_url){const id=noteId(r.target_url);if(id)r={...r,actor_url:`https://note.com/${id}`,actor_name:r.actor_name||`追加先の運営者 @${id}`}}work[i]=r}return work}
async function enrich(rows:Row[]){const ids=[...new Set(rows.filter(r=>!safeActorImage(r.actor_image_url)).map(r=>noteId(r.actor_url)).filter(Boolean))];if(!ids.length)return rows.map(r=>({...r,actor_image_url:safeActorImage(r.actor_image_url)||null}));try{const res=await fetch(ICON,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({noteIds:ids}),cache:"no-store"}),p=await res.json(),m=new Map((p.items||[]).map((x:any)=>[String(x.noteId||"").toLowerCase(),x.image]));return rows.map(r=>({...r,actor_image_url:safeActorImage(r.actor_image_url)||String(m.get(noteId(r.actor_url))||"")||null}))}catch{return rows.map(r=>({...r,actor_image_url:safeActorImage(r.actor_image_url)||null}))}}
function actorName(r:Row){if(r.actor_name)return String(r.actor_name);const m=canonical(r.raw_text).match(/^(.{1,120}?)\s*さん(?:他\d+名)?(?:が|の|から|より|に)/u);return m?.[1]?.trim()||"note通知"}
function displayType(r:Row){return String(r.display_category||r.notification_type||"other")}
function context(r:Row){if(r.context_label)return String(r.context_label);const u=String(r.target_url||r.source_url||"");const id=noteId(u);if(/\/n\//.test(u))return id?`@${id}の記事`:"記事";if(/\/m\//.test(u))return"マガジン";if(/\/membership/.test(u))return"メンシプ";return""}
function presentation(r:Row){const raw=canonical(r.raw_text),type=displayType(r),ctx=context(r);if(type==="magazine_article_added"){const m=raw.match(/^(.+?)さん(?:他(\d+)名)?が\s*(.+?)\s*に新しい記事を(\d+)本追加しました\s*(.*)$/u);if(m)return{title:`新しい記事を${m[4]}本追加`,subject:m[3],detail:short(m[5]||"",120)}}if(type==="my_article_magazine_added")return{title:"自分の記事がマガジンに追加",subject:r.target_title||ctx||"追加先マガジン",detail:short(raw,130)};if(type==="creator_article_posted")return{title:"記事投稿",subject:r.target_title||actorName(r),detail:short(raw,140)};if(type==="follow")return{title:"人物フォロー",subject:actorName(r),detail:short(raw,130)};if(type==="comment_like")return{title:"コメントに♡",subject:ctx||r.target_title||"コメントへのリアクション",detail:short(raw,150)};if(type==="comment")return{title:"コメント",subject:ctx||r.target_title||"記事へのコメント",detail:short(raw,150)};if(type==="reply_self")return{title:"自分の記事返信",subject:ctx||r.target_title||"自分の記事のコメントへの返信",detail:short(raw,150)};if(type==="reply_other")return{title:"相手の記事返信",subject:ctx||r.target_title||"相手の記事で自分のコメントへの返信",detail:short(raw,150)};if(type==="membership_board_reply")return{title:"メンシプ掲示板返信",subject:r.target_title||"メンシプ掲示板",detail:short(raw,150)};if(type==="membership_board")return{title:"メンシプ掲示板",subject:r.target_title||"掲示板への投稿",detail:short(raw,150)};if(type==="membership_reaction_self")return{title:"自分のメンシプ反応",subject:actorName(r),detail:short(raw,150)};if(type==="membership_reaction_joined")return{title:"参加中のメンシプ反応",subject:actorName(r),detail:short(raw,150)};if(type==="membership_join")return{title:"メンシプ参加",subject:actorName(r),detail:short(raw,150)};if(type==="membership_started")return{title:"メンバーシップ開始",subject:r.target_title||actorName(r),detail:short(raw,130)};if(type==="tip")return{title:"チップ・サポート",subject:ctx||r.target_title||actorName(r),detail:short(raw,150)};return{title:LABEL[type]||"通知",subject:ctx||r.target_title||"",detail:short(raw,160)}}
function href(r:Row){return String(r.target_url||r.source_url||r.actor_url||"")}
function targetLabel(r:Row){const u=String(r.target_url||"");if(/\/membership/.test(u))return"メンシプを開く ↗";if(/\/m\//.test(u))return"対象マガジン ↗";if(/\/n\//.test(u))return"対象記事 ↗";return u?"対象ページ ↗":r.actor_url?"相手ページ ↗":""}
function rowKey(r:Row){return`${displayType(r)}|${canonical(r.raw_text)}|${String(r.actor_url||"").split("?")[0]}|${String(r.occurred_at||"")}`}
function Avatar({row,selfId}:{row:Row;selfId:string}){const name=actorName(row),img=String(row.actor_image_url||""),type=displayType(row),top=creatorTop(row.actor_url,selfId),visual=img?<img className="minf-avatar" src={img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>:<span className="minf-avatar fallback">{ICON_FALLBACK[type]||([...(name||"")][0]||"🔔")}</span>;return top?<a href={top} target="_blank" rel="noreferrer" aria-label={`${name}のクリエイターページ`}>{visual}</a>:visual}

export function MemberInsightNotificationsFinal({revision=0,noteId:memberNoteId=""}:{revision?:number;noteId?:string}){
  const[rows,setRows]=useState<Row[]>([]),[kind,setKind]=useState("all"),[selectedDay,setSelectedDay]=useState(""),[page,setPage]=useState(1),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(""),[updatedAt,setUpdatedAt]=useState<string>(""),[checkedAt,setCheckedAt]=useState<Date|null>(null),[syncAt,setSyncAt]=useState<string>("");
  const[serverSync,setServerSync]=useState({received:0,confirmed:0,source:""});
  const request=useRef<{id:number;controller:AbortController|null}>({id:0,controller:null});
  const lastReaderRun=useRef(0);
  const[categoryCounts,setCategoryCounts]=useState<Record<string,number>>({}),[reclassifying,setReclassifying]=useState(false),[repairStatus,setRepairStatus]=useState("");
  const[readerStatus,setReaderStatus]=useState<any>(null);
  async function load(p=1,k=kind,silent=false,day=selectedDay){
    if(silent&&request.current.controller)return;
    request.current.controller?.abort();const controller=new AbortController(),id=++request.current.id;request.current.controller=controller;
    const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"",valid=()=>id===request.current.id&&!controller.signal.aborted&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token;
    if(!silent)setLoading(true);setError("");
    try{const x=await post({kind:k,page:p,pageSize:PAGE,day:day||null},controller.signal);if(!valid())return;
      const feedId=String(x.noteId||"").toLowerCase(),expected=requestedNotificationAccount()||String(memberNoteId||"").toLowerCase();
      if(expected&&feedId!==expected){setRows([]);setTotal(0);setError(`通知アカウント不一致：@${expected} / @${feedId}。アカウント切替を確認してください。`);return}
      const list=await enrich(mergeMagazineJoinRows(repairActorRows(x.rows||[])));if(!valid())return;
      setRows(list);setTotal(Number(x.total||0));setCategoryCounts(x.categoryCounts||{});setPage(p);setCheckedAt(new Date());setUpdatedAt(String(x.lastUpdatedAt||""));setSyncAt(String(x.lastSyncAt||""));setServerSync({received:Number(x.lastSyncReceived||0),confirmed:Number(x.lastSyncConfirmed??x.lastSyncInserted??0),source:String(x.lastSyncSource||"")});
    }catch(e){if(valid())setError(e instanceof Error?e.message:"通知履歴の読込に失敗しました")}
    finally{if(id===request.current.id){request.current.controller=null;setLoading(false)}}
  }
  async function reclassify(auto=false){
    if(reclassifying)return false;
    setReclassifying(true);setRepairStatus(auto?"新しい分類ルールで全履歴を自動再分類中…":"全保存履歴の分類を確認中…");
    const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";let cursor:string|null=null,checked=0,moved=0,pending=0;
    try{
      do{
        if(localStorage.getItem(INSIGHT_TOKEN_KEY)!==token)throw new Error("アカウントが切り替わりました");
        const ac=new AbortController(),timer=window.setTimeout(()=>ac.abort(),45000);let r:Response;
        try{r=await fetch(FEED.replace("feed-final","reclassify"),{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({cursor}),signal:ac.signal})}
        finally{window.clearTimeout(timer)}
        const x=await r.json();if(!r.ok||!x.ok)throw new Error(x.error||"再分類失敗");
        checked+=x.checked||0;moved+=x.moved||0;pending=Number(x.pending||0);cursor=x.nextCursor||null;
        setRepairStatus(`${checked}件確認・${moved}件分類修正・未分類${pending}件`)
      }while(cursor);
      const noteId=(requestedNotificationAccount()||String(memberNoteId||"")).toLowerCase();
      if(noteId)try{localStorage.setItem(`mumei-notification-reclassify-version:${noteId}`,CLASSIFIER_VERSION)}catch{}
      setRepairStatus(`再分類完了：${checked}件確認・${moved}件修正・未分類${pending}件。未分類は「その他・未分類」に残します。`);
      void load(1,kind);
      return true
    }catch(e){
      setRepairStatus(`再分類を再試行できます：${e instanceof Error?e.message:String(e)}`);
      return false
    }finally{setReclassifying(false)}
  }
  useEffect(()=>{setRows([]);setCategoryCounts({});void load(1,kind,false,selectedDay);return()=>{request.current.id++;request.current.controller?.abort();request.current.controller=null}},[kind,selectedDay,revision,memberNoteId]);
  useEffect(()=>{
    const noteId=(requestedNotificationAccount()||String(memberNoteId||"")).toLowerCase();
    if(!noteId||!localStorage.getItem(INSIGHT_TOKEN_KEY))return;
    const key=`mumei-notification-reclassify-version:${noteId}`;
    let done="";
    try{done=localStorage.getItem(key)||""}catch{}
    if(done===CLASSIFIER_VERSION)return;
    const t=window.setTimeout(()=>{void reclassify(true)},700);
    return()=>window.clearTimeout(t)
  },[memberNoteId,revision]);

  useEffect(()=>{const refresh=()=>{if(document.visibilityState==="visible")void load(page,kind,true,selectedDay)},timer=window.setInterval(refresh,2000);window.addEventListener("focus",refresh);window.addEventListener("pageshow",refresh);return()=>{window.clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("pageshow",refresh)}},[kind,selectedDay,page,memberNoteId]);
  useEffect(()=>{
    const noteId=(requestedNotificationAccount()||String(memberNoteId||"")).toLowerCase();
    if(!noteId)return;
    const PAGE_SOURCE="mumei-notification-status-ui-v1",BRIDGE="mumei-notification-status-bridge-v1";
    const receive=(e:MessageEvent)=>{if(e.origin!==location.origin||e.data?.source!==BRIDGE||e.data?.type!=="state"||String(e.data?.noteId||"").toLowerCase()!==noteId)return;const next=e.data?.status||null;setReaderStatus(next);const run=Number(next?.lastRunAt||0);if(run&&run!==lastReaderRun.current){lastReaderRun.current=run;void load(1,kind,true,selectedDay)}};
    const ask=()=>window.postMessage({source:PAGE_SOURCE,type:"read",noteId},location.origin);
    window.addEventListener("message",receive);ask();const timer=window.setInterval(ask,1000);
    return()=>{window.removeEventListener("message",receive);window.clearInterval(timer)}
  },[memberNoteId,revision,kind,selectedDay]);
  useEffect(()=>{const nav=document.querySelector('.miu-nav');if(!nav)return;const buttons=[...nav.querySelectorAll('button')] as HTMLButtonElement[],prev=buttons.find(b=>b.classList.contains('active'))||null,next=buttons.find(b=>b.textContent?.trim()==='通知')||null;if(next){buttons.forEach(b=>b.classList.remove('active'));next.classList.add('active');requestAnimationFrame(()=>next.scrollIntoView({behavior:'auto',block:'nearest',inline:'center'}))}return()=>{if(next)next.classList.remove('active');if(prev)prev.classList.add('active')}} ,[]);
  const pages=Math.max(1,Math.ceil(total/PAGE)),selfId=String(memberNoteId||"").toLowerCase(),latest=syncAt||updatedAt;
  const readerMode=String(readerStatus?.lastRunMode||"");
  const readerLabel=readerMode==="full"?"全履歴完了":readerMode==="delta"?"差分完了":readerMode==="partial"?"途中保存":readerMode==="error"?"読取エラー":readerStatus?.historyComplete?"全履歴確認済み":"端末状態 未確認";
  const readerClass=readerMode==="error"?"error":readerMode==="partial"?"partial":readerMode==="full"||readerMode==="delta"?"done":"idle";
  const serverLabel=syncAt?"サーバー反映済み":"サーバー反映 未確認";
  return <section id="minf-notifications" className="minf">
    <header className="minf-head"><div><small>PRIVATE NOTIFICATION HISTORY</small><h2>本人通知</h2><div className="minf-compact-status"><span>最終保存</span><strong>{latest?date(latest):"確認中…"}</strong><i>自動反映 ON</i></div><p>noteの通知を保存すると、この画面へ自動反映します。通常は1〜2秒で更新します。分類の数字は選択日の本人通知の全件数です。スキ・人物フォロー・通常コメント・記事投稿は各専用画面と公開データ分析で確認できます。</p></div><div className="minf-actions"><a className="minf-note" href="https://note.com/">🔔 note通知</a></div></header>
    <div className={`minf-reader-status ${readerClass}`} role="status">
      <div className="minf-reader-title"><span>🔔 読取・保存・反映状況</span><strong>{readerLabel}</strong></div>
      <div className="minf-reader-server"><b>{serverLabel}</b><span>{syncAt?date(syncAt):"—"}</span></div>
      <dl>
        <div><dt>端末 最終読取</dt><dd>{readerStatus?.lastRunAt?date(new Date(Number(readerStatus.lastRunAt)).toISOString()):"—"}</dd></div>
        <div><dt>今回 読取</dt><dd>{readerStatus?Number(readerStatus.lastRunReadCount||0)+"件":"—"}</dd></div>
        <div><dt>今回 保存確認</dt><dd>{readerStatus?Number(readerStatus.lastRunSavedCount||0)+"件":"—"}</dd></div>
        <div><dt>サーバー 受信</dt><dd>{syncAt?serverSync.received+"件":"—"}</dd></div>
        <div><dt>サーバー 保存確認</dt><dd>{syncAt?serverSync.confirmed+"件":"—"}</dd></div>
      </dl>
      <p className="minf-reader-help">{syncAt?"INSIGHTへの保存反映をサーバー側でも確認済みです。":"まだサーバー側の保存反映を確認できていません。"}</p>
      {readerStatus?.lastError?<p className="minf-reader-error">⚠ {String(readerStatus.lastError)}</p>:null}
    </div>
    <details className="minf-state"><summary>更新状態・精度</summary><div><span>保存データ</span><strong>{updatedAt?date(updatedAt):"確認中…"}</strong><span>画面確認</span><strong>{checkedAt?date(checkedAt.toISOString()):"確認中…"}</strong></div><p>取得条件やnote側表示により欠落・重複・時刻ずれが起こる場合があります。重要な確認はnote本体を優先してください。</p></details>
    <div className="minf-date-filter" aria-label="通知の日付指定"><label><span>📅 表示日</span><input type="date" value={selectedDay} onChange={e=>{setPage(1);setSelectedDay(e.target.value)}}/></label><strong>{selectedDay?`${dayLabel(selectedDay)} の通知`:"全期間"}</strong><button type="button" disabled={!selectedDay} onClick={()=>{setPage(1);setSelectedDay("")}}>全期間に戻す</button><small>この日付は下の全カテゴリ共通です。</small></div>
    <div className="minf-tabs" role="tablist">{CATS.map(([id,label])=><button key={id} className={kind===id?"active":""} onClick={()=>{setPage(1);setKind(id)}}>{label}{categoryCounts[id]!==undefined?<small>{categoryCounts[id]}</small>:null}</button>)}</div>
    <details className="minf-state"><summary>通知の分類を確認・修復</summary><p>「その他」だけでなく、分類済みの通知も全履歴を再確認します。所有者が分からない返信・メンシプ反応は確認待ちに表示します。</p><button disabled={reclassifying} onClick={()=>void reclassify()}>{reclassifying?"再分類中…":"全履歴を再分類"}</button><p role="status">{repairStatus}</p></details>
    {error?<p className="minf-error">{error}</p>:null}
    {loading&&!rows.length?<p className="minf-empty">通知を読み込み中…</p>:rows.length?<div className="minf-list">{rows.map((r,i)=>{const h=href(r),actor=actorName(r),p=presentation(r),type=displayType(r),label=LABEL[type]||"その他",actorTop=creatorTop(r.actor_url,selfId);return <article key={r.id||`${rowKey(r)}-${i}`} className={`type-${type}`}><div className="minf-meta"><span>{label}</span>{r.context_label?<b>{r.context_label}</b>:null}<time>{date(r.occurred_at||r.captured_at)}</time></div><div className="minf-who"><Avatar row={r} selfId={selfId}/><div>{actorTop?<a className="minf-actor" href={actorTop} target="_blank" rel="noreferrer">{actor}</a>:<span className="minf-actor static">{actor}</span>}</div></div>{h?<a className="minf-main" href={h} target="_blank" rel="noreferrer"><strong>{p.title}</strong>{p.subject?<span>{p.subject}</span>:null}{p.detail?<small>{p.detail}</small>:null}</a>:<div className="minf-main static"><strong>{p.title}</strong>{p.subject?<span>{p.subject}</span>:null}{p.detail?<small>{p.detail}</small>:null}</div>}{type==="my_article_magazine_added"?<div className="minf-return-links">{r.meta?.article_url?<a href={r.meta.article_url} target="_blank" rel="noreferrer">追加された自分の記事 ↗</a>:null}{r.meta?.magazine_url?<a href={r.meta.magazine_url} target="_blank" rel="noreferrer">追加先マガジン ↗</a>:null}</div>:null}{targetLabel(r)&&h?<a className="minf-target" href={h} target="_blank" rel="noreferrer">{targetLabel(r)}</a>:null}</article>})}</div>:<p className="minf-empty">{selectedDay?`${dayLabel(selectedDay)} のこの分類には通知がありません。`:"この分類の通知はありません。"}</p>}
    {pages>1?<div className="minf-pager"><button disabled={page<=1||loading} onClick={()=>void load(page-1,kind,false,selectedDay)}>← 前</button><label><span>ページ</span><select value={page} onChange={e=>void load(Number(e.target.value),kind,false,selectedDay)}>{Array.from({length:pages},(_,i)=><option key={i+1} value={i+1}>{i+1} / {pages}</option>)}</select></label><button disabled={page>=pages||loading} onClick={()=>void load(page+1,kind,false,selectedDay)}>次 →</button></div>:null}
    {kind==="other"?<p className="minf-other-note">「その他・未分類」は、現在の既知ルールに一致しなかった通知だけです。生の通知文を保持し、分類ルール更新時に全履歴を自動再分類します。推測だけで別カテゴリには入れません。</p>:null}
  </section>
}
