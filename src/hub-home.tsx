import { useEffect, useState, type CSSProperties } from "react";

const DIRECTORY_ENDPOINT="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-directory-data";
const ICON_ENDPOINT="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-icons";
const PARTICIPANTS_ENDPOINT="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-participants";
const MEMBER_ORIGIN="https://note-like-tracker.sabosan0404.chatgpt.site";
const OWNER_KEY="mumei-unified-owner-token",MEMBER_KEY="mumei-note-insight:member",DEVICE_KEY="mumei-note-insight:device";

type Creator={id:string;note_id:string;display_name:string};
type Icon={noteId:string;image:string|null;profileUrl:string};
type Participant={id:string;noteUrlname:string;noteNickname:string;noteImageUrl:string|null;role:string;profileUrl:string};
type DisplayPerson={id:string;name:string;image:string|null;profileUrl:string};

const page:CSSProperties={minHeight:"100vh",background:"#070a0f",color:"#f7f9fc",fontFamily:"system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"};
const wrap:CSSProperties={width:"min(1180px,calc(100% - 28px))",margin:"0 auto"};
const card:CSSProperties={border:"1px solid #253042",borderRadius:24,background:"linear-gradient(180deg,#101722,#0b1017)",padding:24,boxShadow:"0 18px 55px rgba(0,0,0,.25)"};
const button:CSSProperties={display:"inline-flex",alignItems:"center",justifyContent:"center",minHeight:50,borderRadius:14,padding:"0 18px",fontWeight:950,textDecoration:"none"};

function ParticipantRow({title,people,accent}:{title:string;people:DisplayPerson[];accent:string}){
 return <div style={{marginTop:18,paddingTop:14,borderTop:"1px solid #263446"}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:9}}><strong style={{fontSize:12}}>{title}</strong><span style={{fontSize:11,color:accent,fontWeight:950}}>{people.length}名</span></div>{people.length?<div style={{display:"flex",gap:9,overflowX:"auto",padding:"2px 1px 8px",scrollbarWidth:"none"}}>{people.map(p=><a key={p.id} href={p.profileUrl} target="_blank" rel="noreferrer" title={p.name} style={{width:58,flex:"0 0 58px",display:"grid",justifyItems:"center",gap:4,color:"#dce8f7",textDecoration:"none"}}>{p.image?<img src={p.image} alt="" referrerPolicy="no-referrer" style={{width:42,height:42,borderRadius:"50%",objectFit:"cover",border:`2px solid ${accent}88`,background:"#172431"}}/>:<span style={{width:42,height:42,borderRadius:"50%",display:"grid",placeItems:"center",border:`2px solid ${accent}88`,background:"#172431",fontWeight:950}}>{[...p.name][0]||"n"}</span>}<small style={{width:58,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textAlign:"center",fontSize:8,color:"#9baabc"}}>{p.name}</small></a>)}</div>:<div style={{minHeight:54,display:"grid",placeItems:"center",border:"1px dashed #334155",borderRadius:11,color:"#718096",fontSize:10}}>参加者を読み込み中</div>}</div>
}

function Entrance({title,label,copy,href,accent,participantsTitle,participants}:{title:string;label:string;copy:string;href:string;accent:string;participantsTitle?:string;participants?:DisplayPerson[]}){
 return <article style={{...card,display:"flex",flexDirection:"column",minHeight:330,borderColor:`${accent}55`}}><small style={{color:accent,fontWeight:950,letterSpacing:".14em"}}>{label}</small><h2 style={{fontSize:32,margin:"12px 0 10px"}}>{title}</h2><p style={{color:"#aab6c8",lineHeight:1.78,margin:0}}>{copy}</p>{participantsTitle?<ParticipantRow title={participantsTitle} people={participants??[]} accent={accent}/>:null}<a href={href} style={{...button,marginTop:"auto",background:accent,color:"#071016"}}>開く →</a></article>
}

async function syncInsightParticipantsIfOwner(){
 const owner=localStorage.getItem(OWNER_KEY)||"",member=localStorage.getItem(MEMBER_KEY)||"",device=localStorage.getItem(DEVICE_KEY)||"";
 if(!owner||!member||!device)return;
 try{
  const r=await fetch(`${MEMBER_ORIGIN}/api/member/me`,{headers:{Accept:"application/json","X-Insight-Member":member,"X-Insight-Device":device},cache:"no-store"});
  const p=await r.json().catch(()=>({}));
  if(!r.ok||!p?.isOwner||!Array.isArray(p?.members))return;
  const members=p.members.filter((x:any)=>x&&(x.role==="owner"||x.status==="active"));
  await fetch(PARTICIPANTS_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","X-Owner-Token":owner},body:JSON.stringify({action:"sync",members}),cache:"no-store"});
 }catch{}
}

export function HubHome(){
 const[insightPeople,setInsightPeople]=useState<DisplayPerson[]>([]),[directoryPeople,setDirectoryPeople]=useState<DisplayPerson[]>([]);
 useEffect(()=>{void(async()=>{
  await syncInsightParticipantsIfOwner();
  try{
   const r=await fetch(PARTICIPANTS_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"public"}),cache:"no-store"});
   const p=await r.json().catch(()=>({}));
   const rows:Participant[]=Array.isArray(p?.items)?p.items:[];
   setInsightPeople(rows.map(x=>({id:x.id,name:x.noteNickname||`@${x.noteUrlname}`,image:x.noteImageUrl||null,profileUrl:x.profileUrl||`https://note.com/${x.noteUrlname}`})));
  }catch{}
  try{
   const r=await fetch(DIRECTORY_ENDPOINT,{method:"POST",cache:"no-store"}),p=await r.json();
   if(!r.ok||!p?.ok)return;
   const rows:Creator[]=Array.isArray(p.creators)?p.creators:[];
   if(!rows.length){setDirectoryPeople([]);return}
   const ir=await fetch(ICON_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({noteIds:rows.map(x=>x.note_id)}),cache:"no-store"}),ip=await ir.json().catch(()=>({})),items:Icon[]=Array.isArray(ip?.items)?ip.items:[];
   const iconMap=Object.fromEntries(items.map(x=>[x.noteId,x]));
   setDirectoryPeople(rows.map(c=>{const i=iconMap[c.note_id] as Icon|undefined;return{id:c.id,name:c.display_name||`@${c.note_id}`,image:i?.image||null,profileUrl:i?.profileUrl||`https://note.com/${c.note_id}`}}));
  }catch{}
 })()},[]);
 return <div style={page}><header style={{borderBottom:"1px solid #202938",background:"rgba(7,10,15,.95)"}}><div style={{...wrap,minHeight:68,display:"flex",alignItems:"center"}}><a href="#" style={{color:"#fff",textDecoration:"none",fontWeight:950,fontSize:18}}><span style={{display:"block",color:"#b6ff38",fontSize:11,letterSpacing:".16em"}}>無名S note</span>CREATOR HUB</a></div></header><main><section style={{...wrap,padding:"54px 0 28px"}}><p style={{color:"#b6ff38",fontWeight:950,letterSpacing:".15em",margin:0}}>MUMEI S NOTE CREATOR SYSTEM</p><h1 style={{fontSize:"clamp(40px,7vw,76px)",lineHeight:1.05,margin:"14px 0 18px"}}>無名S note CREATOR HUB</h1><p style={{maxWidth:760,color:"#aab6c8",lineHeight:1.85}}>参加しているクリエイターを見ながら、INSIGHT・名鑑・ゲームへ進めます。</p></section><section style={{...wrap,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:18,paddingBottom:110}}><Entrance title="INSIGHT" label="ANALYTICS" copy="note活動を確認・管理・分析します。" href="#access/insight" accent="#b6ff38" participantsTitle="INSIGHT参加クリエイター" participants={insightPeople}/><Entrance title="クリエイター名鑑" label="CREATOR DIRECTORY" copy="参加クリエイターのカードや紹介をアルバムのように見る場所です。" href="#catalog" accent="#54d8ff" participantsTitle="名鑑参加クリエイター" participants={directoryPeople}/><Entrance title="ゲームセンター" label="CREATOR WORLD" copy="名鑑に登録したカードで遊ぶゲームエリアです。" href="#battle" accent="#ffd76b"/></section><section style={{borderTop:"1px solid #202938",background:"#080b10"}}><div style={{...wrap,padding:"84px 0 150px"}}><article style={{...card,borderColor:"#4d4326",display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:24,alignItems:"center"}}><div><small style={{color:"#ffcf5a",fontWeight:950,letterSpacing:".14em"}}>OWNER ONLY</small><h2 style={{fontSize:30,margin:"8px 0"}}>管理ページ</h2><p style={{color:"#9ca9bb",lineHeight:1.75,margin:0}}>OWNER専用の管理機能。</p></div><a href="#owner" style={{...button,background:"#ffcf5a",color:"#171000",minWidth:180}}>管理ページへ →</a></article></div></section></main></div>
}
