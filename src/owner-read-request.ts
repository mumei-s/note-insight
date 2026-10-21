// Fresh owner reads only: no persisted privileged data or automatic auth bypass.
export function ownerReadDenied(error: unknown) {
 const e=error as {status?:number;message?:string};
 return e?.status===401||e?.status===403||/^(OWNER_LOGIN_REQUIRED|OWNER_SESSION_INVALID)$/.test(e?.message||"");
}
export async function ownerReadRequest(url:string,token:string,body:Record<string,unknown>,headers:Record<string,string>={},signal?:AbortSignal){
 const controller=new AbortController(),abort=()=>controller.abort();
 if(signal?.aborted)controller.abort();else signal?.addEventListener("abort",abort,{once:true});
 const timer=setTimeout(abort,30_000);
 let rejectAbort:(error:Error)=>void=()=>{};
 const interrupted=new Promise<never>((_,reject)=>{rejectAbort=reject});
 const onAbort=()=>rejectAbort(Object.assign(new Error("Owner read aborted"),{name:"AbortError"}));
 controller.signal.addEventListener("abort",onAbort,{once:true});if(controller.signal.aborted)onAbort();
 try{
  return await Promise.race([interrupted,(async()=>{
   const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","X-Owner-Token":token,...headers},body:JSON.stringify(body),cache:"no-store",signal:controller.signal});
   const payload=await response.json().catch((error:unknown)=>{if(!response.ok)throw Object.assign(new Error("OWNER_REQUEST_FAILED"),{status:response.status});throw error});
   if(controller.signal.aborted)throw Object.assign(new Error("Owner read aborted"),{name:"AbortError"});
   if(!response.ok||payload?.ok===false)throw Object.assign(new Error(payload?.error||"OWNER_REQUEST_FAILED"),{status:response.status});
   return payload;
  })()]);
 }finally{clearTimeout(timer);signal?.removeEventListener("abort",abort);controller.signal.removeEventListener("abort",onAbort)}
}
