import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const path = new URL('../public/', import.meta.url);
const source = name => fs.readFileSync(new URL(name, path), 'utf8');
const key = 'n123456789abc';
const types = Object.fromEntries(['paragraph', 'image', 'embed'].map(name => [name, { name }]));
class Node {
  constructor(type, attrs = {}, text = '') { this.type = types[type]; this.attrs = attrs; this.textContent = text; this.isTextblock = type === 'paragraph'; this.nodeSize = this.isTextblock ? text.length + 2 : 1; this.content = { size: text.length }; this.marks = []; }
  toJSON() { return { type: this.type.name, ...(Object.keys(this.attrs).length ? { attrs: this.attrs } : {}), ...(this.textContent ? { content: [{ type: 'text', text: this.textContent }] } : {}) }; }
  eq(n) { return n && JSON.stringify(n.toJSON()) === JSON.stringify(this.toJSON()); }
}
types.paragraph.create = (_, text) => new Node('paragraph', {}, text || '');
class Doc {
  constructor(nodes) { this.nodes = nodes; this.content = { size: nodes.reduce((n, x) => n + x.nodeSize, 0), nodes }; this.lastChild = nodes.at(-1); this.scans = 0; }
  descendants(fn) { this.scans++; this.forEach(fn); }
  forEach(fn) { let pos = 0; for (const n of this.nodes) { fn(n, pos); pos += n.nodeSize; } }
  nodeAt(pos) { let found; this.forEach((node, at) => { if (at === pos) found = node; }); return found; }
  toJSON() { return { type: 'doc', content: this.nodes.map(n => n.toJSON()) }; }
  check() { if (!this.nodes.length) throw new Error('invalid empty doc'); }
}
class Tr {
  constructor(doc) { this.before = doc; this.doc = doc; }
  delete(from, to) { const nodes = []; this.doc.forEach((node, pos) => { if (pos < from || pos >= to) nodes.push(node); }); this.doc = new Doc(nodes); return this; }
  insert(pos, node) { const nodes = []; let inserted = false; this.doc.forEach((n, at) => { if (at >= pos && !inserted) { nodes.push(node); inserted = true; } nodes.push(n); }); if (!inserted) nodes.push(node); this.doc = new Doc(nodes); return this; }
  setNodeMarkup(pos, type, attrs) { const nodes = this.doc.nodes.slice(); const old = this.doc.nodeAt(pos); const i = nodes.indexOf(old); if (i < 0) throw new Error('bad position'); nodes[i] = new Node(type.name, attrs, old.textContent); this.doc = new Doc(nodes); return this; }
  replaceWith(from, to, content) { if (content.nodes) { this.doc = new Doc(content.nodes); return this; } return this.delete(from, to).insert(from, content); }
  scrollIntoView() { return this; }
  setSelection() { return this; }
}
function environment({ storage = new Map(), nodes = [new Node('paragraph', {}, '本文'.repeat(348) + '。')] } = {}) {
  let time = 100000, quota = false;
  const events = new Map(), documentEvents = new Map();
  const statuses = new Map(['mumei-note-source-status-v163', 'mumei-likers-thin-status-v160'].map(id => [id, { textContent: '', dataset: {} }]));
  statuses.set('mumei-note-source-picker-v163', { querySelectorAll: () => [], querySelector: () => null });
  statuses.set('mumei-likers-thin-panel-v160', { querySelectorAll: () => [], querySelector: () => null });
  const title = { value: '消えてはいけないタイトル', tagName: 'TEXTAREA', dispatchEvent() {} };
  const schema = { nodes: types, text: x => x, nodeFromJSON: data => new Doc(data.content.map(n => new Node(n.type, n.attrs || {}, n.content?.map(x => x.text || '').join('') || ''))) };
  const view = { dom: { isConnected: true }, focus() {}, posAtDOM() {}, state: null, dispatch(tr) { if (tr.before !== this.state.doc) throw new Error('stale'); this.state = state(tr.doc); } };
  function state(doc) { return { doc, schema, get tr() { return new Tr(doc); } }; }
  view.state = state(new Doc(nodes));
  const button = { textContent: '下書き保存', disabled: false, getClientRects: () => [1], click() {} };
  const document = {
    body: {}, head: null, hidden: false,
    getElementById: id => statuses.get(id) || null,
    querySelector: q => q.includes('タイトル') ? title : null,
    querySelectorAll: q => q === 'button' ? [button] : [],
    addEventListener: (type, fn) => { const a = documentEvents.get(type) || []; a.push(fn); documentEvents.set(type, a); },
  };
  const observers = [];
  class Observer { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.closed = true; } }
  const page = {
    location: { pathname: '/notes/' + key + '/edit', href: 'https://editor.note.com/notes/' + key + '/edit', origin: 'https://editor.note.com' },
    document, Date: class extends Date { static now() { return time; } }, URL, URLSearchParams,
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => { if (quota) throw new Error('quota'); storage.set(k, String(v)); }, removeItem: k => storage.delete(k) },
    MutationObserver: Observer, Event: class { constructor(type) { this.type = type; } },
    setTimeout: (fn, ms) => { queueMicrotask(() => { time += ms || 0; fn(); }); return 1; }, clearTimeout() {}, setInterval() {}, clearInterval() {},
    addEventListener: (type, fn) => { const a = events.get(type) || []; a.push(fn); events.set(type, a); },
    dispatchEvent: event => { for (const fn of events.get(event.type) || []) fn(event); },
    confirm: () => true, alert() {}, console,
    HTMLTextAreaElement: class {}, HTMLInputElement: class {},
  };
  page.window = page; page.unsafeWindow = page;
  const ctx = vm.createContext(page);
  vm.runInContext(source('note-card-safety-v188.js'), ctx);
  const safety = page.__MUMEI_CARD_SAFETY__;
  safety.attach(view); safety.setSerializer(v => JSON.stringify(v.state.doc.toJSON()));
  const encode = () => JSON.stringify(view.state.doc.toJSON());
  function succeed() { const ticket = safety.requestStart('PUT', '/api/v1/text_notes/' + key, JSON.stringify({ body: encode() })); safety.requestEnd(ticket, 200, { data: {} }); }
  function loadModule(name, exports) {
    const text = source(name).replace(/\}\)\(\);\s*$/, 'page.__test = {' + exports + '};\n})();');
    vm.runInContext(text, ctx); return page.__test;
  }
  return { page, safety, view, storage, title, button, statuses, observers, documentEvents, ctx, loadModule, succeed, encode, quota: value => { quota = value; }, time: () => time };
}
const image = (id = 'i1', link = '') => new Node('image', { id, src: 'https://assets.st-note.com/' + id + '.png', link });
const embed = (id, url) => new Node('embed', { embeddedContentKey: id, src: url, htmlForEmbed: '<div class="note-embed"></div>' });

test('697文字と複数画像の控えは空の再読み込みでも消えず復元できる', () => {
  const env = environment(); env.view.dispatch(env.view.state.tr.insert(env.view.state.doc.content.size, image()).insert(env.view.state.doc.content.size + 1, image('i2')));
  env.safety.capture(); const original = env.encode();
  const next = environment({ storage: env.storage, nodes: [new Node('paragraph')] });
  next.safety.capture(); const saved = next.safety.backups()[0].item;
  assert.equal(saved.characters, 697); assert.equal(saved.images, 2);
  next.safety.restore(saved); assert.equal(next.encode(), original);
  assert.equal(next.safety.backups().find(x => x.slot === 'before').item.characters, 0);
});
test('容量不足なら本文を変更する前に停止し前回の控えを残す', () => {
  const e = environment(); e.safety.capture(); const before = e.encode(); const old = e.storage.get('mumei_card_backup_v188:' + key + ':latest'); e.quota(true);
  assert.throws(() => e.safety.begin('削除', e.view), /控えを保存できません/);
  assert.equal(e.encode(), before); assert.equal(e.storage.get('mumei_card_backup_v188:' + key + ':latest'), old);
});
test('同じ記事への二重操作と別タブの処理を拒否する', () => {
  const e = environment(), token = e.safety.begin('画像作成', e.view);
  assert.throws(() => e.safety.begin('削除', e.view), /完了を待って/);
  const second = environment({ storage: e.storage }); assert.throws(() => second.safety.begin('送', second.view), /別のタブ/);
  e.safety.end(token); const t2 = second.safety.begin('送', second.view); second.safety.end(t2);
});
test('元本文を消す変換と古い位置への書き込みを拒否する', () => {
  const e = environment(), original = e.encode();
  assert.throws(() => e.safety.dispatch(e.view, e.view.state.tr.delete(0, e.view.state.doc.content.size)), /失う変更/);
  const stale = e.view.state.tr.insert(e.view.state.doc.content.size, image());
  e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, new Node('paragraph', {}, '手入力')));
  assert.throws(() => e.safety.dispatch(e.view, stale), /古い位置/);
  assert.match(e.encode(), /手入力/); assert.ok(e.encode().includes(JSON.parse(original).content[0].content[0].text));
});
test('削除対象カード以外の本文・画像・既存カードを保持する', () => {
  const p = new Node('paragraph', {}, '本文'), img = image(), keep = embed('embold', 'https://note.com/a/n/n111111111111'), remove = embed('embnew', 'https://note.com/b/n/n222222222222');
  const e = environment({ nodes: [p, img, keep, remove] });
  const h = e.safety.index(e.view).embeds.find(x => x.node === remove);
  assert.equal(e.safety.remove(e.view, [h]), 1); assert.deepEqual(e.view.state.doc.nodes, [p, img, keep]);
  assert.throws(() => e.safety.remove(e.view, [h]), /位置が変わり/);
});
test('別記事の控えは復元できない', () => {
  const e = environment(), saved = e.safety.snapshot(e.view, 'test'); saved.articleKey = 'naaaaaaaaaaaa';
  assert.throws(() => e.safety.restore(saved), /この記事の控え/);
});
test('保存ボタンを押しただけでは保存成功にせずタイムアウトで停止', async () => {
  const e = environment(); let clicks = 0; e.button.click = () => clicks++;
  await assert.rejects(e.safety.save(e.view, '保存中'), /保存完了を確認できません/);
  assert.equal(clicks, 1); assert.ok(e.safety.backups().length); assert.equal(e.page.location.pathname, '/notes/' + key + '/edit');
});
test('本文と記事が一致する成功応答で即座に完了する', async () => {
  const e = environment(); e.button.click = e.succeed; const started = e.time();
  assert.equal(await e.safety.save(e.view, '保存中'), true); assert.ok(e.time() - started < 500);
});
test('別記事・古い本文・HTTP失敗・業務エラー応答を保存成功と誤認しない', async () => {
  for (const scenario of ['other', 'stale', 'http', 'error']) {
    const e = environment();
    e.button.click = () => {
      const ticket = e.safety.requestStart('PUT', '/api/v1/text_notes/' + (scenario === 'other' ? 'naaaaaaaaaaaa' : key), JSON.stringify({ body: scenario === 'stale' ? '古い本文' : e.encode() }));
      e.safety.requestEnd(ticket, scenario === 'http' ? 500 : 200, scenario === 'error' ? { success: false } : {});
    };
    await assert.rejects(e.safety.save(e.view, '保存中'), /保存完了を確認/);
  }
});
test('保存応答を待つ間の手入力を未保存のまま成功扱いにしない', async () => {
  const e = environment();
  e.button.click = () => { const ticket = e.safety.requestStart('PUT', '/api/v1/text_notes/' + key, JSON.stringify({ body: e.encode() })); e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, new Node('paragraph', {}, '追記'))); e.safety.requestEnd(ticket, 200, {}); };
  await assert.rejects(e.safety.save(e.view, '保存中'), /本文が変わりました/); assert.match(e.encode(), /追記/);
});
test('3000枚の画像検証は本文を1回だけ走査し変更後だけ再走査', () => {
  const e = environment({ nodes: Array.from({ length: 3000 }, (_, i) => image('image' + i)) }); const doc = e.view.state.doc;
  for (let i = 0; i < 3000; i++) assert.equal(e.safety.tracked(e.view, { id: 'image' + i }).node.attrs.id, 'image' + i);
  assert.equal(doc.scans, 1); e.view.dispatch(e.view.state.tr.insert(doc.content.size, image('new'))); assert.ok(e.safety.tracked(e.view, { id: 'new' })); assert.equal(e.view.state.doc.scans, 1);
});

function sending(count = 3) {
  const rows = Array.from({ length: count }, (_, i) => ({ index: i + 1, url: 'https://note.com/user/n/n' + String(i).padStart(12, '0'), finalMarker: i === count - 1 }));
  const existing = new Node('paragraph', {}, rows[0].url);
  const nodes = [new Node('paragraph', {}, '消さない本文'), existing, ...rows.map((r, i) => image('image' + i, r.url))];
  const e = environment({ nodes });
  const dataset = { version: '16.0.0', sourceKey: 'n08825c632afd', datasetId: 'd1', count, rows, confirmationUrl: rows.at(-1).url };
  const run = { version: '16.0.0', articleKey: key, datasetId: 'd1', images: Object.fromEntries(rows.map((r, i) => [r.url, { id: 'image' + i, src: nodes[i + 2].attrs.src }])), cardKeys: [] };
  e.storage.set('mumei_likers_thin_dataset_v160', JSON.stringify(dataset)); e.storage.set('mumei_likers_thin_run_v160:' + key, JSON.stringify(run));
  const module = e.loadModule('note-source-picker-v163.js', 'resumableSend, resetAll, deleteLastExactUrl, setView(v){viewCache=v;selectionCache={atEnd:()=>({})}}, setCommand(fn){noteUrlCommand=fn}');
  module.setView(e.view); let calls = 0;
  module.setCommand(url => (state, dispatch) => {
    calls++;
    const last = state.doc.nodes.at(-1), pos = state.doc.content.size - last.nodeSize;
    dispatch(state.tr.replaceWith(pos, state.doc.content.size, embed('emb' + calls, url))); return true;
  });
  e.button.click = e.succeed;
  return { ...e, module, rows, dataset, run, existing, calls: () => calls };
}
test('実際の送処理: 既存の同じURLと本文を残し、カードを作成して再開時に重複させない', async () => {
  const e = sending(10); await e.module.resumableSend();
  assert.equal(e.calls(), 10); assert.ok(e.view.state.doc.nodes.includes(e.existing)); assert.match(e.encode(), /消さない本文/);
  assert.equal(e.safety.index(e.view).embeds.length, 10);
  await e.module.resumableSend(); assert.equal(e.calls(), 10); assert.equal(e.safety.index(e.view).embeds.length, 10);
  assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /完成・保存/);
});
test('実際の送処理: 途中停止は現在のカードを保存し次の操作で残件だけ作る', async () => {
  const e = sending(3); let calls = 0;
  e.module.setCommand(url => (state, dispatch) => { calls++; const last = state.doc.nodes.at(-1); dispatch(state.tr.replaceWith(state.doc.content.size - last.nodeSize, state.doc.content.size, embed('emb' + calls, url))); if (calls === 1) e.safety.stop(); return true; });
  await e.module.resumableSend(); assert.equal(calls, 1); assert.match(e.encode(), /消さない本文/);
  await e.module.resumableSend(); assert.equal(calls, 3); assert.equal(e.safety.index(e.view).embeds.length, 3);
});
test('実際の送処理: タイムアウト後に完成したカードを回収して二重生成しない', async () => {
  const e = sending(2); let pending;
  e.module.setCommand(url => (state, dispatch) => { const last = state.doc.nodes.at(-1); pending = () => dispatch(state.tr.replaceWith(state.doc.content.size - last.nodeSize, state.doc.content.size, embed('emblate', url))); return true; });
  await e.module.resumableSend(); assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /タイムアウト/);
  pending(); let calls = 0;
  e.module.setCommand(url => (state, dispatch) => { calls++; const last = state.doc.nodes.at(-1); dispatch(state.tr.replaceWith(state.doc.content.size - last.nodeSize, state.doc.content.size, embed('embremaining', url))); return true; });
  await e.module.resumableSend(); assert.equal(calls, 1); assert.equal(e.safety.index(e.view).embeds.length, 2);
});
test('実際の初期化: 生成画像・カードだけを削除し本文と通常画像を維持', async () => {
  const e = sending(3); const normalImage = image('normal'); e.view.dispatch(e.view.state.tr.insert(0, normalImage)); await e.module.resumableSend();
  await e.module.resetAll(); assert.ok(e.view.state.doc.nodes.includes(normalImage)); assert.ok(e.view.state.doc.nodes.includes(e.existing)); assert.match(e.encode(), /消さない本文/);
  assert.equal(e.safety.index(e.view).images.length, 1); assert.equal(e.safety.index(e.view).embeds.length, 0);
  assert.equal(e.storage.has('mumei_likers_thin_run_v160:' + key), false); assert.ok(e.safety.backups().find(x => x.slot === 'before').item.images >= 4);
});
test('500件の固定待ち時間を短縮し、全件確認と本文保持を行う', async () => {
  const e = sending(500); const started = e.time(); await e.module.resumableSend();
  assert.equal(e.calls(), 500); assert.equal(e.safety.index(e.view).embeds.length, 500); assert.ok(e.view.state.doc.nodes.includes(e.existing));
  const elapsed = e.time() - started; assert.ok(elapsed < 32000, String(elapsed));
});
test('配布対象コードには自動再読み込み・自動遷移が存在しない', () => {
  for (const name of ['note-card-safety-v188.js','note-likers-thin-notify-v160.js','note-source-picker-v163.js','note-link-guard-v178.js','note-start-clean-v177.js','note-prince-special-v184.js','note-generic-stability-v187.js','note-generic-controls-v189.js']) {
    assert.doesNotMatch(source(name), /location\s*\.\s*(?:reload\s*\(|(?:assign|replace)\s*\(|href\s*=)/, name);
  }
});

test('一部アップロード失敗時は別の行へリンクをずらさず投入記録を維持する', async () => {
  const e = sending(3);
  // Native placeholders record A,B,C in order, but only A and C finished uploading.
  const a = image('a'), b = new Node('image', { id: 'b', src: 'blob:unfinished', link: '' }), c = image('c');
  e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, a).insert(e.view.state.doc.content.size + 1, b).insert(e.view.state.doc.content.size + 2, c));
  const run = { ...e.run, images: {}, pending: { workUrls: e.rows.map(r => r.url), beforeIds: ['image0','image1','image2'], slots: ['a','b','c'] } };
  const base = e.loadModule('note-likers-thin-notify-v160.js', 'linkCreatedImages,recoverPending,setView(v){viewCache=v}'); base.setView(e.view);
  const hits = e.safety.index(e.view).images.filter(h => ['a','c'].includes(h.node.attrs.id));
  await base.linkCreatedImages(e.view, [e.rows[0], e.rows[2]], hits, run);
  assert.equal(e.safety.tracked(e.view, { id: 'c' }).node.attrs.link, e.rows[2].url);
  assert.ok(run.pending); assert.equal(run.images[e.rows[1].url], undefined);
  await assert.rejects(base.recoverPending(e.view, e.dataset, run), /未完了/); assert.ok(run.pending);
  const bh = e.safety.tracked(e.view, { id: 'b' }); e.view.dispatch(e.view.state.tr.setNodeMarkup(bh.pos, bh.node.type, { ...bh.node.attrs, src: 'https://assets.st-note.com/b.png' }));
  assert.equal(await base.recoverPending(e.view, e.dataset, run), 3); assert.equal(run.pending, null);
  assert.equal(e.safety.tracked(e.view, { id: 'b' }).node.attrs.link, e.rows[1].url);
});

test('リンク付与の直前に本文位置が変わっても画像IDで再取得する', async () => {
  const e = sending(2), base = e.loadModule('note-likers-thin-notify-v160.js', 'linkCreatedImages,setView(v){viewCache=v}'); base.setView(e.view);
  const before = e.safety.index(e.view).images;
  const typed = new Node('paragraph', {}, '画像の前に手入力'); e.view.dispatch(e.view.state.tr.insert(0, typed));
  await base.linkCreatedImages(e.view, e.rows, before, e.run);
  assert.ok(e.view.state.doc.nodes.includes(typed)); assert.equal(e.safety.tracked(e.view, { id: 'image1' }).node.attrs.link, e.rows[1].url);
});

test('307枚を同じファイル入力へ80/80/80/67枚連続投入し、3回目もタイマーを解除する', async () => {
  const e = sending(307);
  e.view.dispatch(e.view.state.tr.replaceWith(0, e.view.state.doc.content.size, new Doc([new Node('paragraph', {}, '保護する原稿')]).content));
  e.run.images = {}; e.run.cardKeys = [];
  const cancelled = []; e.page.clearTimeout = id => cancelled.push(id);
  class Transfer { constructor(){ this.list=[]; this.items={add:f=>this.list.push(f)}; } get files(){return this.list;} }
  e.page.DataTransfer = Transfer;
  let arm, calls = 0;
  const nativeClick = function(){ throw new Error('native file chooser must be intercepted'); };
  e.page.HTMLInputElement.prototype.click = nativeClick;
  const input = new e.page.HTMLInputElement();
  Object.assign(input, { tagName:'INPUT', type:'file', accept:'image/*', files:[], value:'', dispatchEvent(event) {
    if(event.type !== 'change')return;
    calls++;
    for(const row of arm.workRows)e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size,image('uploaded'+row.index)));
  }});
  const base = e.loadModule('note-likers-thin-notify-v160.js',
    'installNativeInputInterceptor,cancelImageArm,setView(v){viewCache=v},setArm(a){imageArm=a}');
  base.setView(e.view);
  for(let offset=0;offset<307;offset+=80){
    const workRows=e.rows.slice(offset,offset+80);
    const completion=new Promise((resolve,reject)=>{arm={view:e.view,dataset:e.dataset,run:e.run,workRows,files:workRows.map(r=>({name:r.index+".png",type:"image/png"})),beforeIds:new Set(e.safety.index(e.view).images.map(h=>h.node.attrs.id)),beforeInputs:new Set([input]),timer:offset+1,resolve,reject,consumed:false};});
    base.setArm(arm);base.installNativeInputInterceptor();input.click();await completion;
    assert.equal(arm.timer,null);assert.equal(arm.files.length,0);assert.equal(arm.beforeInputs.size,0);
    base.cancelImageArm();assert.equal(e.page.HTMLInputElement.prototype.click,nativeClick);
  }
  assert.equal(calls,4);assert.equal(cancelled.length,4);
  assert.equal(Object.keys(e.run.images).length,307);assert.equal(e.safety.index(e.view).images.length,307);
  assert.match(e.encode(),/保護する原稿/);assert.equal(e.run.pending,null);
});

test('画像以外のHTTP失敗と前回のエラー表示ではアップロードを中断しない', async () => {
  const e=sending(1);
  e.view.dispatch(e.view.state.tr.replaceWith(0,e.view.state.doc.content.size,new Doc([new Node('paragraph',{},'原稿')]).content));
  e.page.fetch=async()=>({status:500,statusText:'error'});
  const toast={textContent:'画像のアップロードに失敗しました',getClientRects:()=>[1],closest:()=>null};
  const oldQuery=e.page.document.querySelectorAll;
  e.page.document.querySelectorAll=q=>q.includes('[role="alert"]')?[toast]:oldQuery(q);
  const base=e.loadModule('note-likers-thin-notify-v160.js','waitNewRemoteImages,uploadBody,beginUploadRequest,endUploadRequest,recentNetFailure,setView(v){viewCache=v},setArm(a){imageArm=a}');
  base.setView(e.view);base.setArm({consumed:true});
  assert.equal(base.uploadBody(JSON.stringify({body:'本文'})),false);
  await e.page.fetch('https://editor.note.com/api/analytics',{method:'POST',body:'{}'});
  assert.equal(base.recentNetFailure(0),null);
  let checks=0;const clock=e.page.setTimeout;
  e.page.setTimeout=(fn,ms)=>clock(()=>{if(++checks===12)e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size,image('late')));fn();},ms);
  const result=await base.waitNewRemoteImages(e.view,new Set(),1,20000,new Map([[toast,toast.textContent]]));
  assert.equal(result.failed,false);assert.ok(checks>=12);
});

test('失敗が記録された0/80枚の投入は本文を消さず再準備できる',async()=>{
  const e=sending(1);e.run.pending={workUrls:e.rows.map(r=>r.url),beforeIds:e.safety.index(e.view).images.map(h=>h.node.attrs.id),at:1,stage:'failed'};
  const base=e.loadModule('note-likers-thin-notify-v160.js','recoverPending,setView(v){viewCache=v}');base.setView(e.view);
  const before=e.encode();assert.equal(await base.recoverPending(e.view,e.dataset,e.run),0);
  assert.equal(e.encode(),before);assert.equal(e.run.pending,null);
});

test('失敗が記録された一部画像は成功分を保持し未完了の今回画像だけ除いて再開する',async()=>{
  const e=sending(3);
  const original=e.view.state.doc.nodes.slice();
  const pendingRows=e.rows;
  e.run.images={};e.run.pending={workUrls:pendingRows.map(r=>r.url),beforeIds:e.safety.index(e.view).images.map(h=>h.node.attrs.id),slots:['a','b','c'],at:1,stage:'failed'};
  for(const n of [image('a'),new Node('image',{id:'b',src:'blob:failed',link:''}),image('c')])e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size,n));
  const base=e.loadModule('note-likers-thin-notify-v160.js','recoverPending,missingRows,setView(v){viewCache=v}');base.setView(e.view);
  assert.equal(await base.recoverPending(e.view,e.dataset,e.run),2);
  assert.ok(original.every(n=>e.view.state.doc.nodes.includes(n)));
  assert.equal(e.safety.tracked(e.view,{id:'b'}),null);
  assert.equal(e.safety.tracked(e.view,{id:'c'}).node.attrs.link,e.rows[2].url);
  assert.deepEqual(base.missingRows(e.view,e.dataset,e.run).map(r=>r.index),[2]);
});

test('進行中の画像要求が残る間は失敗分の削除・再投入をしない',async()=>{
  const e=sending(1);e.run.pending={workUrls:e.rows.map(r=>r.url),beforeIds:e.safety.index(e.view).images.map(h=>h.node.attrs.id),at:1,stage:'failed'};
  const base=e.loadModule('note-likers-thin-notify-v160.js','recoverPending,beginUploadRequest,endUploadRequest,setView(v){viewCache=v},setArm(a){imageArm=a}');
  base.setView(e.view);base.setArm({consumed:true});const ticket=base.beginUploadRequest({type:'image/png'},'/upload');
  await assert.rejects(base.recoverPending(e.view,e.dataset,e.run),/未完了/);
  assert.ok(e.run.pending);base.endUploadRequest(ticket,200);
});

function tagSelection(pages){
  const e=environment();
  e.statuses.get('mumei-note-source-picker-v163').querySelector=q=>q==='.mumei-prince-special-v184'?{}:null;
  const api=e.loadModule('note-prince-special-v184.js','sources,collectCombinedCreators,choose,mergeCreator,setJSON(fn){json=fn}');
  const calls=[];api.setJSON(async url=>{calls.push(url);if(url.endsWith('/current_user'))return{data:{urlname:'self'}};
    if(url.includes('/likes?'))return{data:{likes:(pages.likes||['alice']).map(urlname=>({user:{urlname,key:urlname,nickname:urlname}}))}};
    if(url.includes('/hashtags/')){const p=Number(new URL(url).searchParams.get('page'));const rows=pages.tags[p-1]||[];return{data:{notes:rows.map(([urlname,key])=>({key,name:'#の記事',user:{urlname,key:urlname,nickname:urlname}})),is_last_page:p>=pages.tags.length}};}
    if(url.includes('/contents?'))return{data:{contents:[{key:'n999999999999',name:'固定記事',user:{urlname:'alice'}}]}};
    throw new Error(url);
  });return{e,api,calls};
}
test('#とURLの順序を逆にしても重複人物には#記事を採用する',async()=>{
  for(const input of ['https://note.com/test/n/n111111111111 #企画','#企画 https://note.com/test/n/n111111111111']){
    const {api}=tagSelection({tags:[[['alice','n222222222222']]]});
    const people=await api.collectCombinedCreators(api.sources(input),1);
    assert.equal(people.length,1);
    for(const mode of ['latest','fixed','oldest','todayYesterday'])assert.equal((await api.choose(people[0],mode)).latestKey,'n222222222222');
  }
});
test('人数上限到達後・#の後続ページで見つかった重複にも#記事を採用する',async()=>{
  const {api,calls}=tagSelection({tags:[[['bob','n333333333333']],[['alice','n222222222222']]]});
  const people=await api.collectCombinedCreators(api.sources('https://note.com/test/n/n111111111111 #企画'),1);
  assert.equal(people.length,1);assert.equal(people[0].urlname,'alice');
  assert.equal((await api.choose(people[0],'fixed')).latestKey,'n222222222222');
  assert.ok(calls.some(url=>url.includes('/hashtags/')&&url.includes('page=2')));
});
test('URLのみの人物は選択した記事条件を維持する',async()=>{
  const {api}=tagSelection({tags:[[['bob','n333333333333']]]});
  const people=await api.collectCombinedCreators(api.sources('https://note.com/test/n/n111111111111 #企画'),1);
  assert.equal((await api.choose(people[0],'fixed')).latestKey,'n999999999999');
});
test('パネルの幅と入力欄を少し縮小し、操作ボタンのサイズを保つ',()=>{
  const css=source('note-generic-stability-v187.js');
  assert.match(css,/width:min\(230px/);assert.match(css,/textarea\[data-source\]\{min-height:42px/);
  assert.match(css,/choices button\{height:27px/);
});
