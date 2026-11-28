import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('public/note-insight-dashboard-sync.user.js','utf8')
  .replaceAll('location.assign(', '__navigate(').replaceAll('location.replace(', '__navigate(');
const app='https://mumei-s.github.io/note-insight/?insightMode=analysis&analysisPanel=dashboard#dashboard';
const start='mumei-dashboard-entry-refresh';
const prefix='mumei-dashboard-entry-v179';
const version=source.match(/const VERSION='([^']+)'/)[1];
const tick=()=>new Promise(r=>setTimeout(r,35));
function setup(t,url,gm,{enabled=true,automatic=true,noteId='tester',token='fixture',hidden=false,result='ok'}={}){
  const w=new JSDOM('<main><div id="mumei-dashboard-sync"><div class="status"></div></div></main>',{url,runScripts:'outside-only',pretendToBeVisual:true}).window;
  t.after(()=>w.close());
  Object.defineProperty(w.document,'visibilityState',{get:()=>hidden?'hidden':'visible'});
  const nav=[],reads=[];
  w.__navigate=url=>nav.push(new URL(url));
  w.GM_info={scriptHandler:'Tampermonkey'};
  w.GM={getValue:async(k,d)=>gm.get(k)??d,setValue:async(k,v)=>gm.set(k,v),deleteValue:async k=>gm.delete(k)};
  w.__mumeiDashboardFeatureV1={ready:Promise.resolve(),isEnabled:()=>enabled,isAutomatic:()=>automatic};
  w.document.getElementById('mumei-dashboard-sync').dataset.coreVersion=version;
  if(noteId)w.localStorage.setItem('mumei-dashboard-note-id-v1',noteId);
  if(token)w.localStorage.setItem('mumei-dashboard-ingest-token-v1',token);
  w.document.addEventListener('mumei-dashboard-read',e=>{
    reads.push({...e.detail,period:JSON.parse(w.sessionStorage.getItem('mumei-dashboard-requested-period'))?.period});
    w.document.dispatchEvent(new w.CustomEvent('mumei-dashboard-entry-finished',{detail:{result}}));
  });
  w.eval(source);
  return {w,nav,reads,dispatch:(detail={})=>w.document.dispatchEvent(new w.CustomEvent(start,{detail:{noteId:'tester',period:'month',returnTo:app,from:app,...detail}}))};
}
test('INSIGHT → existing note pairing → save/partial → original view, with cooldown and no secret in URL',async t=>{
  const gm=new Map(),home=setup(t,app,gm);
  home.dispatch();home.dispatch();await tick();
  assert.equal(home.nav.length,1);
  const target=home.nav[0];
  assert.equal(target.origin,'https://note.com');
  assert.equal(target.pathname,'/sitesettings/stats');
  assert.deepEqual([...target.searchParams.keys()],['mumei_dashboard_entry']);
  assert.doesNotMatch(JSON.stringify([...gm]),/fixture/);
  const note=setup(t,target.href,gm,{result:'partial'});await tick();
  assert.deepEqual(note.reads,[{automatic:false,entry:true,period:'month'}]);
  assert.equal(note.nav[0].searchParams.get('analysisPanel'),'dashboard');
  assert.equal(note.nav[0].searchParams.get('dashboardSync'),'partial');
  assert.equal(gm.size,0,'request is one-shot');
  home.dispatch();await tick();assert.equal(home.nav.length,1);
});
test('OFF・manual・hidden・stale navigation never leave INSIGHT',async t=>{
  for(const opts of [{enabled:false},{automatic:false},{hidden:true}]){
    const h=setup(t,app,new Map(),opts);h.dispatch();await tick();assert.equal(h.nav.length,0);
  }
  const h=setup(t,app,new Map());h.dispatch({from:app+'changed'});await tick();assert.equal(h.nav.length,0);
});
test('different or unpaired note account returns without reading',async t=>{
  for(const options of [{noteId:'other'},{token:''}]){
    const gm=new Map(),home=setup(t,app,gm);home.dispatch();await tick();
    const note=setup(t,home.nav[0].href,gm,options);await tick();
    assert.equal(note.reads.length,0);assert.equal(note.nav[0].searchParams.get('dashboardSync'),'skipped');
  }
});
test('verified manual save skips an unnecessary automatic visit',async t=>{
  const gm=new Map(),note=setup(t,'https://note.com/sitesettings/stats',gm);
  note.w.document.dispatchEvent(new note.w.CustomEvent('mumei-dashboard-snapshot-confirmed',{detail:{noteId:'tester',period:'month'}}));
  const home=setup(t,app,gm);home.dispatch();await tick();assert.equal(home.nav.length,0);
});
test('finishing a sync will not redirect an unrelated note page',async t=>{
  const gm=new Map(),home=setup(t,app,gm);home.dispatch();await tick();
  const note=setup(t,home.nav[0].href,gm);
  note.w.document.addEventListener('mumei-dashboard-read',()=>{
    note.w.history.replaceState(null,'','/ss_yr');
    note.w.document.dispatchEvent(new note.w.CustomEvent('mumei-dashboard-entry-finished',{detail:{result:'ok'}}));
  },true);
  await tick();
  assert.equal(note.reads.length,1);assert.equal(note.nav.length,0);
});
