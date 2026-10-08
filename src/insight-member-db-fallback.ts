import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import { fetchInsightResource } from "./insight-view-lifecycle";

const REST="https://xxhaerjvrgmnadxjqetz.supabase.co/rest/v1/rpc/";
const ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aGFlcmp2cmdtbmFkeGpxZXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNTMxMTQsImV4cCI6MjEwMTYyOTExNH0.DtoUvuMTrW7rA3jLThLD4zijvluuTB_LmEBIjWJs-jA";

function sourceOf(endpoint:string){
  try{return new URL(endpoint).pathname.split("/").filter(Boolean).at(-1)||""}catch{return""}
}
async function rpc(name:string,body:Record<string,unknown>){
  const r=await fetchInsightResource(REST+name,{method:"POST",headers:{"Content-Type":"application/json","apikey":ANON,"Authorization":`Bearer ${ANON}`},body:JSON.stringify(body),cache:"no-store"},15_000);
  const p=await r.json().catch(()=>null);
  if(!r.ok||!p||p?.ok===false)throw new Error(String(p?.message||p?.error||`DB_FALLBACK_${r.status}`));
  return {...p,__dbFallback:true};
}
export function memberReadAuthFailure(message:string){
  return /INSIGHT_SESSION_INVALID|INSIGHT_LOGIN_REQUIRED|INSIGHT_MEMBER_INACTIVE|HTTP_401|HTTP_403/i.test(message);
}
export async function memberDbReadFallback(endpoint:string,body:Record<string,unknown>,token=localStorage.getItem(INSIGHT_TOKEN_KEY)||""){
  if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
  if(localStorage.getItem(INSIGHT_TOKEN_KEY)!==token)throw new Error("INSIGHT_ACCOUNT_CHANGED");
  const source=sourceOf(endpoint),action=String(body.action||"");
  let pending:Promise<any>;
  if(source==="insight-comment-events")pending=rpc("insight_comment_events_fallback",{p_token:token,p_extra:body});
  else if(source==="insight-favorite-groups"){
    if(action!=="list")throw new Error("FALLBACK_WRITE_NOT_ALLOWED");
    pending=rpc("insight_favorite_groups_fallback",{p_token:token});
  }
  else if(source==="insight-social-events"){
    if(!["comparison","people","events","investigation"].includes(action))throw new Error("FALLBACK_ACTION_UNSUPPORTED");
    pending=rpc("insight_social_events_fallback",{p_token:token,p_action:action,p_extra:body});
  }
  else pending=rpc("insight_member_read_fallback",{p_token:token,p_source:source,p_action:action,p_extra:body});
  const payload=await pending;
  if(localStorage.getItem(INSIGHT_TOKEN_KEY)!==token)throw new Error("INSIGHT_ACCOUNT_CHANGED");
  return payload;
}
