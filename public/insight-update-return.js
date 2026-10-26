(function(){
'use strict';
if(window.MumeiInsightUpdateReturn)return;
const ROOT='/note-insight/',ACTIVE='mumei-insight-active-account-v3',PREFIX='mumei-insight-update-pending-v1:',MAX_AGE=60*60*1000;
const modes=new Set(['normal','comments','favorites','social','notifications','analysis']),tabs=new Set(['likes','supporters','comments','commentRanking','magazines','favorites','social','notifications','dm','articles']),panels=new Set(['menu','normal','dashboard','notifications','verdict']);
const setup=/^(?:notification-(?:browser-install|connection|install|import|update(?:-[a-z0-9]+)?|setup(?:-[a-z0-9]+)?)|dashboard-setup(?:-v2)?|dm-browser-install|tool-setup)\.html$/i;
const id=v=>/^[a-z0-9_-]+$/i.test(String(v||'').replace(/^@/,''))?String(v).replace(/^@/,'').toLowerCase():'';
const version=v=>/^\d+(?:\.\d+){1,3}$/.test(String(v||''))?String(v):'';
function compare(a,b){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]||0)-(y[i]||0);if(d)return Math.sign(d)}return 0}
function appUrl(raw){
 let value=String(raw||'');if(!value.trim())return null;
 for(let depth=0;depth<8;depth++){
  let u;try{u=new URL(value,location.href)}catch{return null}
  if(u.origin!==location.origin||u.username||u.password)return null;
  if(u.pathname===ROOT||u.pathname===ROOT+'index.html')return u;
  if(!u.pathname.startsWith(ROOT)||!setup.test(u.pathname.slice(ROOT.length)))return null;
  value=u.searchParams.get('return')||'';if(!value)return null;
 }
 return null;
}
function resolve(raw,options={}){
 const original=appUrl(raw),u=new URL(original?.pathname||ROOT,location.origin),query=original?.searchParams;
 let mode=query?.get('insightMode')||'',tab=query?.get('insightTab')||'';
 if(mode==='dm'){mode='normal';tab='dm'}
 const explicitMode=modes.has(mode);
 if(!modes.has(mode))mode=modes.has(options.fallbackMode)?options.fallbackMode:'normal';
 if(!tabs.has(tab))tab=explicitMode?(['comments','favorites','social','notifications'].includes(mode)?mode:''):tabs.has(options.fallbackTab)?options.fallbackTab:'';
 u.searchParams.set('insightMode',mode);if(tab)u.searchParams.set('insightTab',tab);
 const panel=query?.get('analysisPanel');if(mode==='analysis'&&panels.has(panel))u.searchParams.set('analysisPanel',panel);
 for(const key of ['notificationAccount','account']){const account=id(query?.get(key));if(account)u.searchParams.set(key,account)}
 const account=id(options.account);if(account){const present=['notificationAccount','account'].filter(key=>u.searchParams.has(key));for(const key of present.length?present:[mode==='notifications'?'notificationAccount':'account'])u.searchParams.set(key,account)}
 u.hash=original?.hash==='#owner-insight'?'owner-insight':'dashboard';
 return u.href;
}
function capture(options={}){
 const state=history.state||{},mode=modes.has(options.mode)?options.mode:modes.has(state.insightMode)?state.insightMode:undefined,tab=tabs.has(options.tab)?options.tab:tabs.has(state.insightPendingTab)?state.insightPendingTab:tabs.has(state.insightTab)?state.insightTab:undefined;
 const u=new URL(resolve(location.href,{fallbackMode:mode,fallbackTab:tab,account:options.account}));
 if(mode)u.searchParams.set('insightMode',mode);if(tab)u.searchParams.set('insightTab',tab);
 if(u.searchParams.get('insightMode')!=='analysis')u.searchParams.delete('analysisPanel');
 return u.href;
}
function live(tool){if(!['notification','dashboard','dm'].includes(tool))return'';const root=document.documentElement;return version(root?.getAttribute('data-mumei-'+tool+'-live-version'))||(tool==='dashboard'?version(root?.getAttribute('data-mumei-dashboard-bridge')):'')}
function create(options){
 const tool=options?.tool;if(!['notification','dashboard','dm'].includes(tool))throw new Error('UNKNOWN_INSIGHT_TOOL');
 const key=PREFIX+tool,account=id(options.account),returnTo=resolve(options.returnTo,{fallbackMode:options.fallbackMode,fallbackTab:options.fallbackTab,account});let finished=false,selfReloading=false;
 const status=value=>options.onStatus?.(value);
 const active=()=>{try{return id(localStorage.getItem(ACTIVE))}catch{return''}};
 const put=value=>{try{sessionStorage.setItem(key,JSON.stringify(value));return true}catch{status('storage-unavailable');return false}};
 function cancel(){try{sessionStorage.removeItem(key);return true}catch{status('storage-unavailable');return false}}
 function pending(){
  let p;try{p=JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}
  if(!p)return null;const age=Date.now()-Number(p.at);
  if(p.tool!==tool||typeof p.id!=='string'||!p.id||!Number.isFinite(age)||age<0||age>MAX_AGE||typeof p.returnTo!=='string'||!appUrl(p.returnTo)||p.returnTo!==resolve(p.returnTo)||typeof p.account!=='string'||id(p.account)!==p.account||typeof p.activeAccount!=='string'||id(p.activeAccount)!==p.activeAccount||p.targetVersion!==''&&!version(p.targetVersion)){cancel();return null}
  return p;
 }
 const sameScope=p=>(!account||p.account===account)&&active()===p.activeAccount;
 const cycle=p=>Number.isSafeInteger(p.awayCycle)&&p.awayCycle>=0?p.awayCycle:0;
 const lastReload=p=>Number.isSafeInteger(p.lastReloadCycle)&&p.lastReloadCycle>=-1?p.lastReloadCycle:p.reloaded?cycle(p):-1;
 function markAway(){const p=pending();if(selfReloading||!p||p.away||!sameScope(p))return;put({...p,away:true,awayCycle:cycle(p)+1,lastReloadCycle:lastReload(p),reloaded:false})}
 function resume(){if(document.visibilityState==='hidden')return;selfReloading=false;const p=pending();if(p?.away&&sameScope(p))put({...p,away:false})}
 window.addEventListener('blur',markAway);window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')markAway();else resume()});
 function begin(targetVersion=''){
  if(targetVersion&&!version(targetVersion))return false;finished=false;selfReloading=false;
  const nonce=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
  return put({id:nonce,tool,at:Date.now(),targetVersion:version(targetVersion),account:account||active(),activeAccount:active(),returnTo,reloaded:false,away:false,awayCycle:0,lastReloadCycle:-1});
 }
 function finish(latestVersion){
  if(finished||!version(latestVersion))return false;const p=pending();if(!p)return false;
  if((account&&p.account!==account)||active()!==p.activeAccount){status('account-changed');return false}
  const current=live(tool);if(!current||compare(current,latestVersion)<0||p.targetVersion&&compare(current,p.targetVersion)<0)return false;
  if(!cancel())return false;finished=true;status('confirmed');(options.navigate||((href)=>location.replace(href)))(p.returnTo);return true;
 }
 function reload(){const p=pending();if(!p||p.away||document.visibilityState==='hidden'||!sameScope(p)||lastReload(p)===cycle(p))return false;const saved=put({...p,reloaded:true,lastReloadCycle:cycle(p)});if(saved)selfReloading=true;return saved}
 return{begin,pending,finish,reload,cancel};
}
window.MumeiInsightUpdateReturn=Object.freeze({resolve,capture,live,create,version,compare});
})();
