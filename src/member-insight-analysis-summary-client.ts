import { INSIGHT_TOKEN_KEY } from './insight-account-store';
import { fetchInsightResource } from './insight-view-lifecycle';
const ENDPOINT='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-analysis-summary';
const cache=new Map<number,{at:number;data:any}>();
type Pending={request:Promise<any>;controller:AbortController;revision?:number;next?:Promise<any>;nextRevision?:number};
const pending=new Map<number,Pending>();
let owner='',ownerGeneration=0;
function waitForConsumer(request:Promise<any>,signal?:AbortSignal):Promise<any>{
  if(!signal)return request;
  if(signal.aborted)return Promise.reject(Object.assign(new Error('通信を中断しました'),{name:'AbortError'}));
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(Object.assign(new Error('通信を中断しました'),{name:'AbortError'}));
    signal.addEventListener('abort',abort,{once:true});
    request.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
export function loadNotificationSummary(period=0,force=false,signal?:AbortSignal,revision?:number):Promise<any>{
  if(signal?.aborted)return waitForConsumer(Promise.resolve(null),signal);
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||'';
  if(!token)return Promise.reject(new Error('INSIGHT_LOGIN_REQUIRED'));
  if(owner!==token){for(const entry of pending.values())entry.controller.abort();owner=token;ownerGeneration++;cache.clear();pending.clear()}
  const generation=ownerGeneration,current=()=>generation===ownerGeneration&&owner===token&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token;
  const existing=pending.get(period);
  if(existing){
    if(!force||(revision!==undefined&&existing.revision!==undefined&&existing.revision>=revision))return waitForConsumer(existing.request,signal);
    // A revision received during an older read needs one new read after it,
    // while concurrent consumers share that queued verification.
    existing.nextRevision=Math.max(existing.nextRevision||0,revision||0)||undefined;
    if(!existing.next)existing.next=existing.request.catch(()=>null).then(()=>{
      if(!current())throw new Error('アカウントが切り替わりました');
      return loadNotificationSummary(period,true,undefined,existing.nextRevision);
    });
    return waitForConsumer(existing.next,signal);
  }
  const saved=cache.get(period);if(!force&&saved&&Date.now()-saved.at<30000)return Promise.resolve(saved.data);
  const controller=new AbortController();
  const entry={} as Pending;
  const request=(async()=>{
    try{
      const r=await fetchInsightResource(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','X-Insight-Token':token},body:JSON.stringify({period}),cache:'no-store',signal:controller.signal});
      const p=await r.json().catch(()=>({}));
      if(!r.ok||p?.ok===false)throw new Error(p?.error||'本人通知分析を取得できませんでした');
      if(!current())throw new Error('アカウントが切り替わりました');
      cache.set(period,{at:Date.now(),data:p});return p;
    }catch(e){if(!current())throw new Error('アカウントが切り替わりました');if(e instanceof Error&&e.name==='TimeoutError')throw new Error('読込が30秒以内に完了しませんでした。再読込してください。');throw e}
    finally{if(pending.get(period)===entry)pending.delete(period)}
  })();
  Object.assign(entry,{request,controller,revision:force?revision:undefined});pending.set(period,entry);
  return waitForConsumer(request,signal);
}
