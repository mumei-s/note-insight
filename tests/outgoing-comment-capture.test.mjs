import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scope = { URL };
vm.runInNewContext(fs.readFileSync(new URL('../public/note-insight-outgoing-comment-capture-v1.js', import.meta.url), 'utf8'), scope);
const api = scope.__mumeiOutgoingCommentCaptureV1;
const url = 'https://note.com/api/v3/notes/n123/note_comments';
const init = { method: 'POST', body: JSON.stringify({ comment: { type: 'root', children: [] }, acknowledgement: false }) };
function response(overrides = {}) { return { data: { key: 'nc123', note_key: 'n123', is_root: true, parent_key: null, created_at: '2026-10-23T00:00:00Z', user: { urlname: 'self', key: 'uk' }, comment: { type: 'root', children: [{ type: 'element', tag_name: 'p', children: [{ type: 'text', value: 'posted text' }] }] }, ...overrides } }; }
function fixture({ json = response(), status = 200, reject = false, account = () => 'self', enabled = () => true, send } = {}) {
  const rows = new Map(), errors = []; let clones = 0, calls = 0;
  const res = { ok: status >= 200 && status < 300, status, clone() { clones++; return { json: async () => json }; } };
  const promise = reject ? Promise.reject(new Error('cancelled')) : Promise.resolve(res);
  const page = { location: { href: 'https://note.com/other/n/n123' }, fetch() { calls++; return promise; } };
  const original = page.fetch;
  const store = { async put(row) { if (!rows.has(row.id)) rows.set(row.id, row); }, async pending(self) { return [...rows.values()].filter(r => r.account === self && r.state === 'pending'); }, async ack(id) { rows.get(id).state = 'archived'; } };
  const capture = api.create({ page, account, store, send, enabled, onError: e => errors.push(e) });
  return { page, original, capture, rows, errors, promise, get clones() { return clones; }, get calls() { return calls; } };
}
test('staged module does not install or send anything itself', () => { assert.equal(typeof api.create, 'function'); });
test('installed observer preserves original promise, response and native call count', async () => {
  const f = fixture(); assert.equal(f.capture.install(), true); assert.equal(f.capture.install(), false);
  const p = f.page.fetch(url, init); assert.equal(p, f.promise); const res = await p; assert.equal(res.status, 200);
  await f.capture.settled(); assert.equal(f.calls, 1); assert.equal(f.clones, 1); assert.equal(f.rows.size, 1);
  const row = [...f.rows.values()][0]; assert.equal(row.body, 'posted text'); assert.equal(row.parentKey, null); assert.equal(row.state, 'pending');
  f.capture.uninstall(); assert.equal(f.page.fetch, f.original);
});
test('does not inspect GET, unrelated POST, legacy, likes, or foreign host', async () => {
  const f = fixture(); f.capture.install();
  f.page.fetch(url); f.page.fetch(url + '/nc123/likes', init); f.page.fetch('https://other.test/api/v3/notes/n123/note_comments', init); f.page.fetch(url.replace('note_comments','comments'), init);
  await f.capture.settled(); assert.equal(f.clones, 0); assert.equal(f.rows.size, 0);
});
test('failed, cancelled and mismatched account posts never archive drafts', async () => {
  for (const opts of [{ status: 403 }, { reject: true }, { json: response({ user: { urlname: 'other' } }) }, { json: { data: { key: 'nc123' } } }]) {
    const f = fixture(opts); f.capture.install(); await f.page.fetch(url, init).catch(() => {}); await f.capture.settled(); assert.equal(f.rows.size, 0);
  }
});
test('account change after posting fails closed', async () => {
  let self = 'self'; const f = fixture({ account: () => self }); f.capture.install(); f.page.fetch(url, init); self = 'other';
  await f.capture.settled(); assert.equal(f.rows.size, 0);
});
test('observer failures cannot change successful native fetch', async () => {
  const f = fixture({ account() { throw new Error('storage unavailable'); } }); f.capture.install();
  assert.equal(f.page.fetch(url, init), f.promise); assert.equal((await f.promise).status, 200); assert.equal(f.errors.length, 1);
});
test('deduplicates exact stable comment key and keeps pending until exact acknowledgement', async () => {
  let good = false; const f = fixture({ send: async row => good ? { id: row.id, persisted: true } : { persisted: true } }); f.capture.install();
  f.page.fetch(url, init); f.page.fetch(url, init); await f.capture.settled(); assert.equal(f.rows.size, 1);
  await assert.rejects(f.capture.drain(), /ARCHIVE_NOT_ACKNOWLEDGED/); assert.equal([...f.rows.values()][0].state, 'pending');
  good = true; assert.equal((await f.capture.drain()).sent, 1); assert.equal((await f.capture.drain()).sent, 0);
});
test('reply preserves exact request parent, rejects inconsistent response parent', async () => {
  const request = { ...init, body: JSON.stringify({ comment: {}, parent_key: 'ncParent' }) };
  const f = fixture({ json: response({ is_root: false, parent_key: 'ncParent' }) }); f.capture.install(); f.page.fetch(url, request); await f.capture.settled(); assert.equal([...f.rows.values()][0].parentKey, 'ncParent');
  const bad = fixture({ json: response({ is_root: false, parent_key: 'ncOther' }) }); bad.capture.install(); bad.page.fetch(url, request); await bad.capture.settled(); assert.equal(bad.rows.size, 0);
});
test('no send adapter means local-only staging, never falsely acknowledged', async () => {
  const f = fixture(); f.capture.install(); f.page.fetch(url, init); await f.capture.settled(); assert.equal((await f.capture.drain()).staged, true); assert.equal([...f.rows.values()][0].state, 'pending');
});

test('opt-out stops capture and upload without deleting pending history', async () => {
  let enabled = true, sent = 0;
  const f = fixture({ enabled: () => enabled, send: async row => { sent++; return { id: row.id, persisted: true }; } });
  f.capture.install(); f.page.fetch(url, init); await f.capture.settled(); enabled = false;
  f.page.fetch(url, init); await f.capture.settled(); assert.equal(f.clones, 1); assert.equal(f.rows.size, 1);
  await f.capture.drain(); assert.equal(sent, 0); assert.equal([...f.rows.values()][0].state, 'pending');
});
test('new comment queued during upload drains without polling or duplicate flight', async () => {
  const rows = [{ id: 'one' }], sent = []; let release;
  const gate = new Promise(r => { release = r; });
  const c = api.create({ page: {}, account: () => 'self', enabled: () => true,
    store: { pending: async () => [...rows], ack: async id => { rows.splice(rows.findIndex(x => x.id === id), 1); } },
    send: async row => { sent.push(row.id); if (row.id === 'one') await gate; return { id: row.id, persisted: true }; } });
  const first = c.drain(); await new Promise(r => setImmediate(r)); rows.push({ id: 'two' }); assert.equal(c.drain(), first); release(); await first;
  assert.deepEqual(sent, ['one', 'two']); assert.equal(rows.length, 0);
});
test('malformed own response never enters queue', async () => {
  for (const changes of [{key:'arbitrary'}, {created_at:'October 23, 2026'}, {comment:{type:'root',children:[{type:'text',value:'   '}]}}, {comment:{type:'root',children:[{type:'text',value:'bad\u0000body'}]}}]) {
    const f=fixture({json:response(changes)}); f.capture.install(); f.page.fetch(url,init); await f.capture.settled(); assert.equal(f.rows.size,0);
  }
});
test('permanent poison row stays pending but does not block later valid comments', async () => {
  const rows=[{id:'bad'},{id:'good'}],sent=[];
  const c=api.create({page:{},account:()=> 'self',enabled:()=>true,store:{pending:async()=>[...rows],ack:async id=>rows.splice(rows.findIndex(r=>r.id===id),1)},send:async row=>{sent.push(row.id);if(row.id==='bad')throw Object.assign(new Error('INVALID_COMMENT_BODY'),{retryable:false});return{id:row.id,persisted:true}}});
  await assert.rejects(c.drain(),/INVALID_COMMENT_BODY/);assert.deepEqual(sent,['bad','good']);assert.deepEqual(rows,[{id:'bad'}]);
});
test('network failure stops current drain to avoid a per-record retry storm', async () => {
  let sends=0;const c=api.create({page:{},account:()=> 'self',enabled:()=>true,store:{pending:async()=>[{id:'one'},{id:'two'}],ack:async()=>assert.fail('must not ack')},send:async()=>{sends++;throw new Error('offline')}});
  await assert.rejects(c.drain(),/offline/);assert.equal(sends,1);
});
