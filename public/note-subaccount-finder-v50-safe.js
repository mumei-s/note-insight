(() => {
'use strict';
const K = 'note巡回BOOST_v4';
const JOB = 'autoMagJobV46';
const AUTO = 'autoMagAutoResumeV47';
const COOLDOWN = `${K}:hardCooldownV50`;
const OPEN_SCAN = `${K}:startupScanV50`;
const VER = '5.0.0';
const DAY_LIMIT = 200;
const MIN_API_GAP = 3000;
const PAIR_GAP_MIN = 6000;
const PAIR_GAP_JITTER = 2500;
const HARD_403_MS = 2 * 60 * 60 * 1000;
const DEFAULT_429_MS = 60 * 60 * 1000;
let me = null;
let busy = false;
let starting = false;
let stop = false;
let lastApiAt = 0;
let resumeTimer = 0;
let openedScanDone = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const ak = (id, n) => `${K}:acct:${id}:${n}`;
const al = (id, n, fb) => load(ak(id, n), fb);
const as = (id, n, v) => save(ak(id, n), v);
const settings = () => Object.assign({magHour:20, magDay:DAY_LIMIT, likeHour:18, likeDay:80}, load(`${K}:settings`, {}), {magDay:DAY_LIMIT});
function forceLimits() {
const s = load(`${K}:settings`, {});
if (Number(s.magDay) !== DAY_LIMIT) { s.magDay = DAY_LIMIT; save(`${K}:settings`, s); }
}
function cooldown() {
const c = load(COOLDOWN, null);
if (!c || !Number(c.until)) return null;
if (Date.now() >= Number(c.until)) { try { localStorage.removeItem(COOLDOWN); } catch {} return null; }
return c;
}
function setCooldown(ms, reason, blockedPair=null) {
const until = Date.now() + Math.max(60000, Number(ms)||HARD_403_MS);
save(COOLDOWN, {until, reason:String(reason||'安全冷却'), blockedPair, t:Date.now()});
return until;
}
const fmtTime = t => {
try { return new Date(t).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'}); }
catch { return ''; }
};
function status(msg, bad=false) {
const e = document.querySelector('#nb-v50-status') || document.querySelector('#nb-v46-status');
if (e) {
e.textContent = msg;
e.style.background = bad ? '#fff0f0' : '#f4f6ff';
e.style.color = bad ? '#981b1b' : '#222';
}
}
async function gatedFetch(url, init={}) {
const c = cooldown();
if (c) {
const e = new Error(`安全冷却中（${fmtTime(c.until)}まで）`);
e.status = 0; e.cooldown = true; throw e;
}
const wait = MIN_API_GAP - (Date.now() - lastApiAt);
if (wait > 0) await sleep(wait);
lastApiAt = Date.now();
const headers = Object.assign({accept:'application/json'}, init.headers || {});
const r = await fetch(url, Object.assign({credentials:'include'}, init, {headers}));
const text = await r.text();
let json = {}; try { json = text ? JSON.parse(text) : {}; } catch {}
if (!r.ok) {
const e = new Error(`${r.status} ${r.statusText}`);
e.status = r.status;
e.body = text.slice(0, 500);
const ra = r.headers?.get?.('retry-after');
e.retryAfter = ra ? (/^\d+$/.test(ra) ? Number(ra)*1000 : Math.max(0, Date.parse(ra)-Date.now())) : 0;
throw e;
}
return json;
}
async function who() {
const j = await gatedFetch('/api/v2/current_user');
const d = j?.data ?? j ?? {}, u = d.user || d;
const id = String(u.urlname || u.url_name || u.username || '');
if (!id) throw new Error('noteログイン中アカウントを取得できません');
return {id, name:String(u.nickname || u.name || id)};
}
function hist(id, name='mags') {
const a = al(id, name, []), cut = Date.now() - 48*3600e3;
return Array.isArray(a) ? a.filter(x => x && Number(x.t) >= cut) : [];
}
function usage(id, ms) { const n=Date.now(); return hist(id).filter(x => n-Number(x.t||0) < ms).length; }
function remaining(id, ms, limit) {
const a = hist(id).filter(x => Date.now()-Number(x.t||0) < ms).sort((x,y)=>Number(x.t)-Number(y.t));
return a.length < limit ? 0 : Math.max(0, Number(a[0].t)+ms-Date.now());
}
function safety(id) {
const s = settings(), h = usage(id,3600e3), d = usage(id,86400e3);
if (h >= Number(s.magHour||20)) return {ok:false, wait:remaining(id,3600e3,Number(s.magHour||20)), why:`60分 ${h}/${s.magHour||20}`};
if (d >= DAY_LIMIT) return {ok:false, wait:remaining(id,86400e3,DAY_LIMIT), why:`24時間 ${d}/${DAY_LIMIT}`};
return {ok:true, wait:0, why:''};
}
function record(id, item, target) {
const t=Date.now();
const mh=hist(id); mh.push({t,key:item.key,mag:target.key,urlname:item.urlname,source:'batch-v50'}); as(id,'mags',mh.slice(-800));
const ah=hist(id,'actions'); ah.push({t,type:'mag',key:item.key,mag:target.key,urlname:item.urlname,source:'batch-v50'}); as(id,'actions',ah.slice(-800));
}
function currentJob(id) { return al(id, JOB, null); }
function putJob(id, j) { as(id, JOB, j); }
function autoEnabled(id) { const v=al(id,AUTO,null); return v==null ? true : !!v; }
function setAuto(id,v) { as(id,AUTO,!!v); }
function migrateJob(id, j) {
if (!j || j.complete) return j;
if (Array.isArray(j.targets) && j.targets.length) {
j.itemIndex = Number.isFinite(Number(j.itemIndex)) ? Number(j.itemIndex) : Number(j.index)||0;
j.targetIndex = Number.isFinite(Number(j.targetIndex)) ? Number(j.targetIndex) : 0;
j.index = j.itemIndex;
return j;
}
if (j.magKey) {
j.version = VER;
j.targets = [{key:String(j.magKey), name:String(j.magName||j.magKey), price:Number(j.magPrice)||0}];
j.itemIndex = Number(j.index)||0;
j.targetIndex = 0;
j.index = j.itemIndex;
putJob(id,j);
}
return j;
}
function selectedTargets() {
return [...document.querySelectorAll('.nb-v48-magcheck:checked')].map(ch => {
const label = ch.closest('label');
const text = String(label?.textContent || ch.value).trim();
const name = text.replace(/^\s*[📚💴]\s*/, '').replace(/\s+\d+記事\s*$/,'').trim() || ch.value;
return {key:String(ch.value), name, price:text.includes('💴') ? 1 : 0};
});
}
function queue(id) {
const s=al(id,'session',null), q=Array.isArray(s?.queue)?s.queue:[];
return q.map(x=>({key:String(x?.key||''), id:x?.id??null, urlname:String(x?.urlname||''), name:String(x?.name||x?.urlname||''), title:String(x?.title||x?.key||'')})).filter(x=>x.key&&x.urlname);
}
function render(id) {
const j=migrateJob(id,currentJob(id));
const p=document.querySelector('#nb-v46-progress'), b=document.querySelector('#nb-v46-start');
if (p) {
if (!j) p.innerHTML=`現在の検索結果 <b>${queue(id).length}件</b>｜複数マガジンを選択できます`;
else {
const total=j.items?.length||0, names=(j.targets||[]).map(x=>x.name||x.key).join(' / ');
const state=j.complete?'✅ 完了':busy?'▶ 実行中':'⏸ 待機中';
p.innerHTML=`<b>${state}</b>｜${names}<br>記事 ${Math.min(Number(j.itemIndex)||0,total)}/${total}｜マガジン ${Math.min((Number(j.targetIndex)||0)+1,Math.max(1,j.targets?.length||1))}/${j.targets?.length||1}｜追加 ${j.added||0}｜スキップ ${j.skipped||0}｜失敗 ${j.failed||0}${j.last?`<br><small>${String(j.last)}</small>`:''}`;
}
}
if (b) b.textContent = busy ? '⏸ 一時停止' : (j?.complete ? '▶ 今の検索結果で新しく開始' : (j ? '▶ 続きから再開' : '▶ 今の検索結果を追加'));
const auto=document.querySelector('#nb-v50-auto');
if (auto) { const on=autoEnabled(id); auto.textContent=`🔁 自動再開 ${on?'ON':'OFF'}`; auto.style.background=on?'#e9f8ee':'#f2f2f2'; }
}
async function noteDetail(item) {
try {
const j=await gatedFetch(`/api/v3/notes/${encodeURIComponent(item.key)}`);
const d=j?.data??j??{}, n=d.note||d;
const belongs=d.belonging_magazine_keys||n.belonging_magazine_keys||j?.belonging_magazine_keys||[];
return {id:item.id??n.id??n.note_id??n.noteId??null, belongs:Array.isArray(belongs)?belongs:[]};
} catch(e) {
if (e.status===404) return {skip:true, reason:'記事404'};
throw e;
}
}
async function addPair(id,item,target,detail) {
if (detail.belongs.includes(target.key)) return ['skip',`追加済み：${item.title} → ${target.name}`];
if (target.price>0 && item.urlname!==id) return ['skip',`有料マガジンのため他人記事を除外：${item.title} → ${target.name}`];
if (!detail.id) return ['fail',`記事ID取得失敗：${item.title}`];
try {
await gatedFetch(`/api/v1/our/magazines/${encodeURIComponent(target.key)}/notes`, {
method:'POST', headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},
body:JSON.stringify({note_id:detail.id,note_key:item.key})
});
record(id,item,target);
detail.belongs.push(target.key);
return ['add',`追加：${item.title} → ${target.name}`];
} catch(e) {
if (String(e.body||'').includes('already')) { detail.belongs.push(target.key); return ['skip',`追加済み：${item.title} → ${target.name}`]; }
throw e;
}
}
function advance(j,kind) {
if (kind==='item-skip') {
j.skipped=(j.skipped||0)+Math.max(1,(j.targets?.length||1)-(j.targetIndex||0));
j.itemIndex=(j.itemIndex||0)+1; j.targetIndex=0; j.index=j.itemIndex; return;
}
if (kind==='add') j.added=(j.added||0)+1;
else if (kind==='skip') j.skipped=(j.skipped||0)+1;
else j.failed=(j.failed||0)+1;
j.targetIndex=(j.targetIndex||0)+1;
if (j.targetIndex >= (j.targets?.length||1)) { j.itemIndex=(j.itemIndex||0)+1; j.targetIndex=0; j.index=j.itemIndex; }
}
function scheduleResume(id, ms) {
if (resumeTimer) clearTimeout(resumeTimer);
if (!autoEnabled(id) || ms <= 0) return;
resumeTimer = setTimeout(() => { resumeTimer=0; autoResume('予定時刻'); }, Math.min(ms+1500, 2147480000));
}
async function safeRun({automatic=false}={}) {
if (busy || starting) {
if (busy && !automatic) { stop=true; status('⏸ 現在の1件が終わったら手動停止します'); }
return;
}
starting = true;
const c=cooldown();
if (c) { status(`🛑 403安全冷却中。${fmtTime(c.until)}までは自動アクセスしません`,true); if (me?.id) scheduleResume(me.id,c.until-Date.now()); starting=false; return; }
try {
me=await who();
const id=me.id;
let j=migrateJob(id,currentJob(id));
if (!(j && !j.complete && j.account===id)) {
if (automatic) return;
const targets=selectedTargets(), items=queue(id);
if (!targets.length) return status('追加先マガジンを1つ以上チェックしてください',true);
if (!items.length) return status('現在の検索結果が0件です。先に巡回検索してください',true);
if (!confirm(`現在の検索結果 ${items.length}件を、選択した${targets.length}誌へ順番に追加します。\n403が出た場合は即停止して2時間冷却します。開始しますか？`)) return;
j={version:VER,account:id,targets,items,itemIndex:0,targetIndex:0,index:0,added:0,skipped:0,failed:0,complete:false,last:'開始',updatedAt:Date.now()};
putJob(id,j);
}
if (j.blockedPair) {
const bp=j.blockedPair;
if (Number(j.itemIndex)===Number(bp.itemIndex) && Number(j.targetIndex)===Number(bp.targetIndex)) {
j.failed=(j.failed||0)+1;
j.last='前回403になった組み合わせは再送せずスキップ';
advance(j,'fail');
}
delete j.blockedPair;
putJob(id,j);
}
busy=true; starting=false; stop=false; render(id);
let cachedKey='', detail=null;
while ((j.itemIndex||0) < (j.items?.length||0)) {
if (stop) { j.last='手動で一時停止'; putJob(id,j); break; }
const lim=safety(id);
if (!lim.ok) {
j.last=`安全値で自動停止：${lim.why}`; putJob(id,j);
status(`⏳ ${j.last}｜解除後に自動継続`);
scheduleResume(id,lim.wait); break;
}
const item=j.items[j.itemIndex], target=j.targets[j.targetIndex||0];
if (!item || !target) { j.failed=(j.failed||0)+1; j.itemIndex=(j.itemIndex||0)+1; j.targetIndex=0; j.index=j.itemIndex; putJob(id,j); continue; }
status(`📦 ${j.itemIndex+1}/${j.items.length}｜${item.title} → ${target.name}`);
try {
if (cachedKey!==item.key) { detail=await noteDetail(item); cachedKey=item.key; }
if (detail?.skip) { j.last=`${detail.reason}：${item.title}`; advance(j,'item-skip'); cachedKey=''; detail=null; }
else {
const [kind,msg]=await addPair(id,item,target,detail);
j.last=msg; advance(j,kind);
if ((j.targetIndex||0)===0) { cachedKey=''; detail=null; }
}
j.updatedAt=Date.now(); putJob(id,j); render(id);
} catch(e) {
if (e.cooldown) { j.last='安全冷却中'; putJob(id,j); break; }
if (e.status===403) {
const blockedPair={itemIndex:Number(j.itemIndex)||0,targetIndex:Number(j.targetIndex)||0,itemKey:item.key,magKey:target.key};
const until=setCooldown(HARD_403_MS,'403',blockedPair);
j.blockedPair=blockedPair;
j.last=`403を検出したため全自動処理を停止。${fmtTime(until)}まで再アクセスしません`; putJob(id,j);
status(`🛑 ${j.last}`,true); scheduleResume(id,HARD_403_MS); break;
}
if (e.status===429) {
const wait=Math.max(5*60*1000,Number(e.retryAfter)||DEFAULT_429_MS);
j.last=`429制限。${fmtTime(Date.now()+wait)}ごろ自動再開`; putJob(id,j); status(`⏳ ${j.last}`,true); scheduleResume(id,wait); break;
}
if (e.status===401) { j.last='401認証エラー。自動再開しません'; putJob(id,j); status(`🛑 ${j.last}`,true); break; }
j.failed=(j.failed||0)+1; j.last=`失敗して次へ：${e.message||e}`; advance(j,'fail'); putJob(id,j);
}
if (!busy || stop) break;
await sleep(PAIR_GAP_MIN + Math.floor(Math.random()*PAIR_GAP_JITTER));
}
if ((j.itemIndex||0) >= (j.items?.length||0)) { j.complete=true; j.last=`完了：追加 ${j.added||0} / スキップ ${j.skipped||0} / 失敗 ${j.failed||0}`; putJob(id,j); status(`✅ ${j.last}`); }
} catch(e) {
if (e.status===403) { const until=setCooldown(HARD_403_MS,'403-login'); status(`🛑 403を検出。${fmtTime(until)}までツールの自動アクセスを停止`,true); const id=me?.id||load(`${K}:lastActiveAccount`,''); if(id) scheduleResume(id,HARD_403_MS); }
else if (!e.cooldown) status(`エラー：${e.message||e}`,true);
} finally {
starting=false; busy=false; stop=false; if (me?.id) render(me.id);
}
}
async function autoResume(source='起動') {
if (document.hidden || busy) return;
const c=cooldown();
if (c) { status(`🛑 403安全冷却中。${fmtTime(c.until)}まで待機`,true); scheduleResume(me?.id||'',c.until-Date.now()); return; }
try {
const lastId=load(`${K}:lastActiveAccount`, '');
if (!lastId || !autoEnabled(lastId)) return;
const j=migrateJob(lastId,currentJob(lastId));
if (!j || j.complete || j.account!==lastId) return;
if (/手動で一時停止|401認証|アカウントが .* に変わった/.test(String(j.last||''))) return;
const lim=safety(lastId);
if (!lim.ok) { scheduleResume(lastId,lim.wait); return; }
status(`▶ ${source}：未完了ジョブを自動継続`);
await safeRun({automatic:true});
} catch {}
}
function isPaginationPage() {
try {
const u=new URL(location.href);
const p=Number(u.searchParams.get('page')||u.searchParams.get('p')||0);
return p>1;
} catch { return false; }
}
function installOpenFreshScan() {
const open=document.querySelector('#nb-open');
if (!open || open.dataset.v50scan) return false;
open.dataset.v50scan='1';
open.addEventListener('click', () => {
if (openedScanDone || isPaginationPage()) return;
openedScanDone=true;
const btn=document.querySelector('#nb-run');
if (!btn || btn.disabled) return;
const stamp=load(OPEN_SCAN,0);
if (Date.now()-Number(stamp||0) < 5*60*1000) return;
save(OPEN_SCAN,Date.now());
setTimeout(()=>{ if (!document.hidden && !cooldown()) btn.click(); },600);
}, {passive:true});
return true;
}
function installUI() {
const body=document.querySelector('#nb-v46-body');
const start=document.querySelector('#nb-v46-start');
if (!body || !start || !document.querySelector('#nb-v48-targets')) return false;
start.onclick = e => { e?.preventDefault?.(); safeRun({automatic:false}); };
if (!document.querySelector('#nb-v50-safe')) {
document.querySelector('#nb-v47-auto')?.closest('.v46r')?.remove();
document.querySelector('#nb-v47-auto-status')?.remove();
const row=document.createElement('div'); row.className='v46r'; row.id='nb-v50-safe';
row.innerHTML='<button id="nb-v50-auto" style="flex:1;padding:7px 9px;border:1px solid #bbb;border-radius:8px;font-weight:900">🔁 自動再開 ON</button><span style="align-self:center;font-size:11px;font-weight:800">🛡 403即停止</span>';
const st=document.createElement('div'); st.id='nb-v50-status'; st.style.cssText='font-size:11px;line-height:1.45;padding:6px 7px;margin-top:4px;background:#f4f6ff;border-radius:8px;color:#333';
st.textContent='通常ページでは自動API監視しません。403時は2時間完全冷却します。';
body.append(row,st);
row.querySelector('#nb-v50-auto').onclick=()=>{
const id=me?.id || load(`${K}:lastActiveAccount`,''); if(!id)return;
setAuto(id,!autoEnabled(id)); render(id);
status(autoEnabled(id)?'🔁 自動再開ON':'⏸ 自動再開OFF。進捗は保持します');
if(autoEnabled(id)) autoResume('ON切替');
};
}
const id=me?.id || load(`${K}:lastActiveAccount`,''); if(id)render(id);
installOpenFreshScan();
return true;
}
forceLimits();
const boot=()=>{
if (installUI()) { setTimeout(()=>autoResume('起動'),1200); return; }
const mo=new MutationObserver(()=>{ if(installUI()){ mo.disconnect(); setTimeout(()=>autoResume('起動'),1200); } });
mo.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(()=>mo.disconnect(),20000);
};
boot();
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) setTimeout(()=>autoResume('タブ復帰'),800); });
window.addEventListener('focus',()=>setTimeout(()=>autoResume('画面復帰'),800));
})();