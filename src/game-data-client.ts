import type { CreatorGameData, PlayerDirectoryCard } from "./game-types";

const DATA="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-game-data";
const MEMBER_CARD="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-member-card";
const MEMBER_KEY="mumei-note-insight:member",DEVICE_KEY="mumei-note-insight:device";

export async function loadCreatorGame(){
 const response=await fetch(DATA,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
 const payload=await response.json();
 if(!response.ok)throw new Error(payload?.error??"GAME DATA ERROR");
 const data:CreatorGameData={opponents:payload.opponents??[],creators:payload.creators??[]};
 let player:PlayerDirectoryCard|null=null;
 const member=localStorage.getItem(MEMBER_KEY)||"",device=localStorage.getItem(DEVICE_KEY)||"";
 if(member&&device){
  try{
   const r=await fetch(MEMBER_CARD,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Member":member,"X-Insight-Device":device},body:JSON.stringify({action:"me"})});
   const p=await r.json().catch(()=>({}));
   const s=p?.submission;
   if(r.ok&&s){player={id:String(s.id),note_id:String(s.note_id),display_name:String(s.display_name||s.note_id),status:String(s.status||"pending"),cards:Array.isArray(s.cards)?s.cards:[]};}
  }catch{}
 }
 return {data,player};
}
