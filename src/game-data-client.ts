import type { CreatorGameData } from "./game-types";

const DATA="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-game-data";
const ICONS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-icons";

export async function loadCreatorGame(){
 const response=await fetch(DATA,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
 const payload=await response.json();
 if(!response.ok)throw new Error(payload?.error??"GAME DATA ERROR");
 const data:CreatorGameData={opponents:payload.opponents??[],creators:payload.creators??[]};
 let playerIcon:string|null=null;
 const id=data.creators[0]?.note_id;
 if(id){const r=await fetch(ICONS,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({noteIds:[id]})});const p=await r.json().catch(()=>({}));playerIcon=p?.items?.[0]?.image??null;}
 return {data,playerIcon};
}
