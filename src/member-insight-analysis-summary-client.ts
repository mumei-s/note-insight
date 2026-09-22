import { INSIGHT_TOKEN_KEY } from './insight-account-store';
const ENDPOINT='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-analysis-summary';
const cache=new Map<number,{at:number;data:any}>();
const pending=new Map<number,Promise<any>>();
let owner='';
export function loadNotificationSummary(period=0,force=false):Promise<any>{
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||'';
  if(!token)return Promise.reject(new Error('INSIGHT_LOGIN_REQUIRED'));
  if(owner!==token){owner=token;cache.clear();pending.clear()}
  const existing=pending.get(period);if(existing)return existing;
  const saved=cache.get(period);if(!force&&saved&&Date.now()-saved.at<30000)return Promise.resolve(saved.data);
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),30000);
  const request=(async()=>{
    try{
      const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','X-Insight-Token':token},body:JSON.stringify({period}),cache:'no-store',signal:controller.signal});
      const p=await r.json().catch(()=>({}));
      if(!r.ok||p?.ok===false)throw new Error(p?.error||'本人通知分析を取得できませんでした');
      if(owner!==token||localStorage.getItem(INSIGHT_TOKEN_KEY)!==token)throw new Error('アカウントが切り替わりました');
      cache.set(period,{at:Date.now(),data:p});return p;
    }catch(e){if(e instanceof Error&&e.name==='AbortError')throw new Error('読込が30秒以内に完了しませんでした。再読込してください。');throw e}
    finally{window.clearTimeout(timer);if(owner===token)pending.delete(period)}
  })();
  pending.set(period,request);return request;
}
