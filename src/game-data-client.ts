import type { CreatorGameData, PlayerDirectoryCard } from "./game-types";

const DATA="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-game-data";
const MEMBER_CARD="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-member-card";
const OWNER_KEY="mumei-unified-owner-token";
const MEMBER_KEY="mumei-note-insight:member";
const DEVICE_KEY="mumei-note-insight:device";

function authHeaders(){
 const headers:Record<string,string>={"Content-Type":"application/json"};
 const owner=localStorage.getItem(OWNER_KEY)||"";
 const member=localStorage.getItem(MEMBER_KEY)||"";
 const device=localStorage.getItem(DEVICE_KEY)||"";
 if(owner)headers["X-Owner-Token"]=owner;
 else if(member&&device){headers["X-Insight-Member"]=member;headers["X-Insight-Device"]=device;}
 return headers;
}

export async function loadCreatorGame(){
 const headers=authHeaders();
 const hasAuth=Boolean(headers["X-Owner-Token"]||(headers["X-Insight-Member"]&&headers["X-Insight-Device"]));
 if(!hasAuth)return {data:{opponents:[],creators:[]} as CreatorGameData,player:null as PlayerDirectoryCard|null,playerIcon:null as string|null,error:"GAME_LOGIN_REQUIRED"};

 const response=await fetch(DATA,{method:"POST",headers,body:"{}",cache:"no-store"});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)return {data:{opponents:[],creators:[]} as CreatorGameData,player:null as PlayerDirectoryCard|null,playerIcon:null as string|null,error:String(payload?.error||"GAME_DATA_ERROR")};

 let player:PlayerDirectoryCard|null=null;
 try{
  const r=await fetch(MEMBER_CARD,{method:"POST",headers,body:JSON.stringify({action:"me"}),cache:"no-store"});
  const p=await r.json().catch(()=>({})),s=p?.submission;
  if(r.ok&&s){
   player={id:String(s.id),note_id:String(s.note_id),display_name:String(s.display_name||s.note_id),status:String(s.status||"pending"),cards:Array.isArray(s.cards)?s.cards:[]};
  }
 }catch{}

 const approvedCards=player&&player.status==="approved"?player.cards.filter(x=>x.url).sort((a,b)=>a.position-b.position):[];
 const serverCreator=Array.isArray(payload?.creators)?payload.creators.find((x:any)=>String(x?.note_id||"")===player?.note_id):null;
 const ownCreator=player&&approvedCards.length?{
  id:player.id,
  note_id:player.note_id,
  display_name:player.display_name,
  status:player.status,
  images:approvedCards.map(x=>({position:x.position,url:x.url})),
 }:serverCreator??null;
 const opponents=Array.isArray(payload?.opponents)?payload.opponents:[];
 const data:CreatorGameData={opponents:ownCreator?opponents:[],creators:ownCreator?[ownCreator]:[]};
 return {data,player,playerIcon:null as string|null,error:ownCreator?null:"GAME_CARD_REQUIRED"};
}
