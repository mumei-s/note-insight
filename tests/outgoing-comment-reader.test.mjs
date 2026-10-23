import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const source = fs.readFileSync(new URL('../public/note-insight-outgoing-comment-reader-v1.js', import.meta.url), 'utf8');
const permission = 'mumei_insight_own_comment_enabled_v1:self';
const device = 'mumei_insight_own_comment_device_used_v1';
const code = 'a'.repeat(32);
async function setup({ opted = false, consent = false, account = 'self', failure = false } = {}) {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://note.com/self' + (consent ? `?mumei_own_comment_scope=${code}&mumei_account=self` : ''), runScripts: 'outside-only' });
  const w = dom.window, values = new Map([['mumei_insight_notification_sync_token_v2:' + account, 'private-token']]);
  if (opted) { values.set(device, true); values.set(permission, { enabled: true, pendingDisable: false }); }
  const calls = [], options = []; let reads = 0, installs = 0, drains = 0;
  w.fetch = async () => { reads++; return { ok: true, json: async () => ({ data: { user: { urlname: account } } }) }; };
  w.GM = { getValue: async (k, d) => values.has(k) ? values.get(k) : d, setValue: async (k, v) => values.set(k, v), xmlHttpRequest(args) {
    calls.push({ url: args.url, body: JSON.parse(args.data), headers: args.headers });
    queueMicrotask(() => { if (failure && JSON.parse(args.data).action === 'own-comment-scope-disable') return args.onerror(); args.onload({ status: 200, responseText: JSON.stringify({ ok: true, account, enabled: true }) }); });
  } };
  w.__mumeiOutgoingCommentCaptureV1 = { indexedStore: () => ({ pending: async () => [], put: async () => {}, ack: async () => {} }), create: o => { options.push(o); return { install: () => { installs++; return true; }, drain: async () => { drains++; } }; } };
  w.eval(source);
  const settle = async () => { for (let i=0;i<8;i++) await new Promise(r => setImmediate(r)); };
  await settle();
  return { dom, w, values, calls, options, settle, get reads() { return reads; }, get installs() { return installs; }, get drains() { return drains; } };
}
test('unopted Reader adds zero fetch, status calls, or hook installs', async () => {
  const f = await setup(); assert.equal(f.reads, 0); assert.equal(f.calls.length, 0); assert.equal(f.installs, 0); f.dom.window.close();
});
test('consent URL does not grant scope until checkbox and explicit click', async () => {
  const f = await setup({ consent: true });
  assert.equal(f.calls.length, 0); assert.equal(f.options[0].enabled(), false);
  const box = f.w.document.querySelector('input'), button = f.w.document.querySelector('button');
  assert.equal(box.checked, false); assert.equal(button.disabled, true);
  box.checked = true; box.dispatchEvent(new f.w.Event('change')); button.click(); await f.settle();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].body.action, 'own-comment-scope-exchange'); assert.equal(f.calls[0].body.code, code);
  assert.equal(f.calls[0].headers['X-Ingest-Token'], 'private-token'); assert.equal(f.options[0].enabled(), true);
  assert.equal(f.w.location.search, ''); assert.equal(f.w.document.body.textContent.includes('private-token'), false); f.dom.window.close();
});
test('wrong note account cannot consume consent', async () => {
  const f = await setup({ consent: true, account: 'other' }); const box = f.w.document.querySelector('input'); box.checked = true; box.dispatchEvent(new f.w.Event('change')); f.w.document.querySelector('button').click(); await f.settle(); assert.equal(f.calls.length, 0); assert.equal(f.options[0].enabled(), false); f.dom.window.close();
});
test('already opted account installs observer once without recurring polling', async () => {
  const f = await setup({ opted: true }); assert.equal(f.reads, 1); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].body.action, 'own-comment-scope-status'); assert.equal(f.installs, 1); assert.equal(f.options[0].enabled(), true); assert.equal(f.drains, 1); await f.settle(); assert.equal(f.reads, 1); assert.equal(f.calls.length, 1); f.dom.window.close();
});
test('offline opt-out disables capture immediately and retains pending scope reduction', async () => {
  const f = await setup({ opted: true, failure: true }); f.w.document.querySelectorAll('button')[1].click(); await f.settle();
  assert.equal(f.options[0].enabled(), false); assert.equal(f.values.get(permission).enabled, false); assert.equal(f.values.get(permission).pendingDisable, true);
  assert.equal(f.w.document.querySelectorAll('button')[1].disabled, false); f.dom.window.close();
});
test('real core plus Reader installs on page fetch and uploads only acknowledged successful own post', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://note.com/other/n/n123', runScripts: 'outside-only' }), w = dom.window;
  const rows = new Map(), sends = []; const values = new Map([[device,true],[permission,{enabled:true,pendingDisable:false}],['mumei_insight_notification_sync_token_v2:self','test-token']]);
  w.GM = {getValue:async(k,d)=>values.get(k)??d,setValue:async(k,v)=>values.set(k,v),xmlHttpRequest(args){const b=JSON.parse(args.data);sends.push({url:args.url,body:b});queueMicrotask(()=>args.onload({status:200,responseText:JSON.stringify(b.records?{ok:true,acks:b.records.map(r=>({id:r.id,persisted:true}))}:{ok:true,enabled:true,account:'self'})}));}};
  const posted = { data:{ key:'nc1',note_key:'n123',created_at:'2026-10-23T00:00:00Z',is_root:true,parent_key:null,user:{urlname:'self'},comment:{type:'root',children:[{type:'text',value:'saved response, not draft'}]}}};
  const result = {ok:true,status:200,clone:()=>({json:async()=>posted})}; const postedPromise=Promise.resolve(result);
  const original=w.fetch=(url)=>url==='/api/v2/current_user'?Promise.resolve({ok:true,json:async()=>({data:{user:{urlname:'self'}}})}):postedPromise;
  w.eval(fs.readFileSync(new URL('../public/note-insight-outgoing-comment-capture-v1.js',import.meta.url),'utf8'));
  w.__mumeiOutgoingCommentCaptureV1.indexedStore=()=>({put:async r=>{if(!rows.has(r.id))rows.set(r.id,r)},pending:async a=>[...rows.values()].filter(r=>r.account===a&&r.state==='pending'),ack:async id=>{rows.get(id).state='archived'}});
  w.eval(source); for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r)); assert.notEqual(w.fetch,original);
  assert.equal(w.fetch('https://note.com/api/v3/notes/n123/note_comments',{method:'POST',body:JSON.stringify({comment:{type:'root',children:[]}})}),postedPromise);
  for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));
  assert.equal(rows.size,1);assert.equal([...rows.values()][0].body,'saved response, not draft');assert.equal([...rows.values()][0].state,'archived');
  assert.equal(sends.filter(x=>x.body.records).length,1);assert.equal(sends.find(x=>x.body.records).url.endsWith('/insight-outgoing-comment-ingest'),true);dom.window.close();
});
test('public userscript loads actual observer before Reader without expanding grants or connections', () => {
  const loader=fs.readFileSync(new URL('../public/note-insight-notification-v3.user.js',import.meta.url),'utf8');
  const core=loader.indexOf('/note-insight-outgoing-comment-capture-v1.js'),reader=loader.indexOf('/note-insight-outgoing-comment-reader-v1.js');
  assert.ok(core>0&&reader>core);assert.match(loader,/@run-at\s+document-start/);
  assert.equal((loader.match(/@grant\s+unsafeWindow/g)||[]).length,1);
  assert.equal((loader.match(/@connect/g)||[]).length,4);
});
test('permission reread stops another tab before saving or sending even without GM change-listener support', async () => {
  const f=await setup({opted:true});f.values.set(permission,{enabled:false,pendingDisable:true});
  await f.options[0].store.put({id:'self:n123:nc1'});assert.equal(f.options[0].enabled(),false);
  await assert.rejects(f.options[0].send({id:'self:n123:nc1'}),/停止中/);assert.equal(f.calls.length,1);f.dom.window.close();
});
