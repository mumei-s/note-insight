import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { wrapModules } from '../scripts/build-card-userscript.mjs';

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
types.image.spec = { content: 'inline*' };
types.image.create = (attrs, text) => { const n = new Node('image', attrs, text || ''); n.nodeSize = n.textContent.length + 2; return n; };
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
function environment({ storage = new Map(), fetch: initialFetch, XMLHttpRequest: InitialXHR, nodes = [new Node('paragraph', {}, '本文'.repeat(348) + '。')] } = {}) {
  let time = 100000, quota = false, quotaLimit = Infinity, savedDraft = null;
  const events = new Map(), documentEvents = new Map();
  const statuses = new Map(['mumei-note-source-status-v163', 'mumei-likers-thin-status-v160'].map(id => [id, { textContent: '', dataset: {} }]));
  statuses.set('mumei-note-source-picker-v163', { querySelectorAll: () => [], querySelector: () => null });
  statuses.set('mumei-likers-thin-panel-v160', { querySelectorAll: () => [], querySelector: () => null });
  const title = { value: '消えてはいけないタイトル', tagName: 'TEXTAREA', dispatchEvent() {} };
  const schema = { nodes: types, text: x => x, nodeFromJSON: data => new Doc(data.content.map(n => new Node(n.type, n.attrs || {}, n.content?.map(x => x.text || '').join('') || ''))) };
  const view = { dom: { isConnected: true }, focus() {}, posAtDOM() {}, state: null, dispatch(tr) { if (tr.before !== this.state.doc) throw new Error('stale'); this.state = state(tr.doc); } };
  function state(doc) { return { doc, schema, selection: {from: doc.content.size-1}, get tr() { return new Tr(doc); } }; }
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
    localStorage: {
      getItem: k => storage.get(k) ?? null,
      setItem: (k, v) => {
        const text = String(v);
        const total = [...storage.entries()].reduce((n,[name,value]) => n + (name === k ? 0 : String(value).length), 0) + text.length;
        if (quota || total > quotaLimit) throw new Error('quota');
        storage.set(k, text);
      },
      removeItem: k => storage.delete(k),
      key: i => [...storage.keys()][i] ?? null,
      get length() { return storage.size; }
    },
    MutationObserver: Observer, Event: class { constructor(type) { this.type = type; } },
    setTimeout: (fn, ms) => { queueMicrotask(() => { time += ms || 0; fn(); }); return 1; }, clearTimeout() {}, setInterval() {}, clearInterval() {},
    addEventListener: (type, fn) => { const a = events.get(type) || []; a.push(fn); events.set(type, a); },
    dispatchEvent: event => { for (const fn of events.get(event.type) || []) fn(event); },
    confirm: () => true, alert() {}, console,
    HTMLTextAreaElement: class {}, HTMLInputElement: class {},
  };
  if (initialFetch) page.fetch = initialFetch;
  if (InitialXHR) page.XMLHttpRequest = InitialXHR;
  page.window = page; page.unsafeWindow = page;
  const ctx = vm.createContext(page);
  vm.runInContext(source('note-card-safety-v188.js'), ctx);
  const safety = page.__MUMEI_CARD_SAFETY__;
  safety.attach(view); safety.setSerializer(v => JSON.stringify(v.state.doc.toJSON()));
  safety.setDraftParser?.(n => view.state.schema.nodeFromJSON(JSON.parse(n.body)));
  if (!initialFetch) page.fetch = async () => ({ status: savedDraft ? 200 : 404, json: async () => ({ data: savedDraft }), clone: () => ({ json: async () => ({ data: savedDraft }) }) });
  const encode = () => JSON.stringify(view.state.doc.toJSON());
  function succeed() { savedDraft = {key, id:4321, name:title.value, body:encode()}; const ticket = safety.requestStart('PUT', '/api/v1/text_notes/' + key, JSON.stringify({ body: encode() })); safety.requestEnd(ticket, 200, { data: {} }); }
  function loadModule(name, exports) {
    const text = source(name).replace(/\}\)\(\);\s*$/, 'page.__test = {' + exports + '};\n})();');
    vm.runInContext(text, ctx); return page.__test;
  }
  return { page, safety, view, storage, title, button, statuses, observers, documentEvents, ctx, loadModule, succeed, encode, setSavedDraft: value => { savedDraft = value; }, savedDraft: () => savedDraft, quota: value => { quota = value; }, quotaLimit: value => { quotaLimit = value; }, time: () => time };
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
test('18.8.19: 容量不足時はpreviousを整理して現在本文の操作前控えを確保する', () => {
  const e = environment(); e.safety.capture();
  const latestKey='mumei_card_backup_v188:'+key+':latest';
  const previousKey='mumei_card_backup_v188:'+key+':previous';
  e.storage.set(previousKey, e.storage.get(latestKey));
  const used=[...e.storage.values()].reduce((n,v)=>n+String(v).length,0);
  const latestSize=String(e.storage.get(latestKey)).length;
  // A new before copy does not fit while previous exists, but does after previous is reclaimed.
  e.quotaLimit(used + Math.floor(latestSize/2));
  const token=e.safety.begin('画像作成',e.view);
  assert.equal(e.storage.has(previousKey),false);
  assert.ok(e.storage.get('mumei_card_backup_v188:'+key+':before'));
  e.safety.end(token);
});
test('18.8.19: 100枚以上の大きい本文ではpreviousを持たずlatestを更新する', () => {
  const nodes=[new Node('paragraph',{},'本文'),...Array.from({length:100},(_,i)=>image('large'+i))];
  const e=environment({nodes});
  e.storage.set('mumei_card_backup_v188:'+key+':previous',JSON.stringify({version:1,articleKey:key,doc:{type:'doc',content:[]}}));
  e.safety.capture();
  assert.equal(e.storage.has('mumei_card_backup_v188:'+key+':previous'),false);
  assert.ok(e.storage.get('mumei_card_backup_v188:'+key+':latest'));
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
// Native draft save assigns missing/duplicate block IDs before its HTTP request.
// The visible save button does not expose that request's promise to our caller.
async function afterSavePolls(fn) { for (let i = 0; i < 8; i++) await Promise.resolve(); fn(); }
function changeOnlyIds(e) {
  let tr = e.view.state.tr, index = 0;
  e.view.state.doc.forEach((node, pos) => { tr = tr.setNodeMarkup(pos, node.type, { ...node.attrs, id: 'saved-' + ++index }); });
  e.view.dispatch(tr);
}
test('実機10/310: 保存ボタンが管理IDを付け直した後も遅延した保存応答を待つ', async () => {
  const e = environment({ nodes: [new Node('paragraph', { id: 'duplicate' }, '本文'), image('duplicate'), embed('embexisting', 'https://note.com/user/n/n000000000000')] });
  let response, completed = false;
  e.button.click = () => { changeOnlyIds(e); response = afterSavePolls(() => { e.succeed(); completed = true; }); };
  assert.equal(await e.safety.save(e.view, '保存中'), true); await response;
  assert.equal(completed, true); assert.match(e.encode(), /本文/); assert.equal(e.safety.index(e.view).images.length, 1);
});
test('IDだけ変わっても保存成功応答なしでは完了としない', async () => {
  const e = environment(); e.button.click = () => changeOnlyIds(e);
  await assert.rejects(e.safety.save(e.view, '保存中'), /保存完了を確認できません/);
});
test('同一内容の別documentオブジェクトでも保存応答を待つ', async () => {
  const e = environment(); let response;
  e.button.click = () => {
    e.view.dispatch(e.view.state.tr.replaceWith(0, e.view.state.doc.content.size, new Doc(e.view.state.doc.nodes.slice()).content));
    response = afterSavePolls(e.succeed);
  };
  assert.equal(await e.safety.save(e.view, '保存中'), true); await response;
});
test('ID以外の本文・画像・リンク・カードキーの変更は保存通知だけで許可しない', async () => {
  for (const kind of ['text', 'image', 'link', 'card', 'title']) {
    const e = environment({ nodes: [new Node('paragraph', {}, '本文'), image('i1', 'https://note.com/a'), embed('embone', 'https://note.com/user/n/n000000000000')] });
    e.button.click = () => {
      changeOnlyIds(e);
      const nodes = e.view.state.doc.nodes, pos = nodes[0].nodeSize;
      if (kind === 'text') e.view.dispatch(e.view.state.tr.replaceWith(0, pos, new Node('paragraph', nodes[0].attrs, '書き換え')));
      if (kind === 'image') e.view.dispatch(e.view.state.tr.setNodeMarkup(pos, types.image, { ...nodes[1].attrs, src: 'https://assets.st-note.com/other.png' }));
      if (kind === 'link') e.view.dispatch(e.view.state.tr.setNodeMarkup(pos, types.image, { ...nodes[1].attrs, link: 'https://note.com/b' }));
      if (kind === 'card') e.view.dispatch(e.view.state.tr.setNodeMarkup(pos + nodes[1].nodeSize, types.embed, { ...nodes[2].attrs, embeddedContentKey: 'embother' }));
      if (kind === 'title') e.title.value = '別タイトル';
      const observer = e.observers.at(-1);
      for (const text of ['保存中', '保存しました']) observer.fn([{ type: 'childList', addedNodes: [{ textContent: text, closest: () => null, getClientRects: () => [1] }] }]);
    };
    await assert.rejects(e.safety.save(e.view, '保存中'), /本文が変わりました/, kind);
  }
});
test('保存応答の監視が間に合わなくても下書きの読戻し一致で保存確認できる', async () => {
  let saved;
  const e = environment({ fetch: async () => ({ status: 200, json: async () => ({ data: saved }), clone: () => ({ json: async () => ({ data: saved }) }) }) });
  e.safety.setDraftParser?.(n => e.view.state.schema.nodeFromJSON(JSON.parse(n.body)));
  e.button.click = () => { saved = { key, id: 4321, name: e.title.value, body: e.encode() }; };
  assert.equal(await e.safety.save(e.view, '全310件の🔗を保存中…'), true);
});
test('保存側の画像既定値は現在本文も同じ解析を通して比較する', async () => {
  const e = environment({ nodes: [image('i1')] });
  const parser = n => {
    const doc = JSON.parse(n.body); for (const node of doc.content) if (node.type === 'image' && node.attrs.width == null) node.attrs.width = 620;
    return e.view.state.schema.nodeFromJSON(doc);
  };
  e.safety.setDraftParser(parser);
  const draft = JSON.parse(e.encode()); draft.content[0].attrs.width = 620;
  e.setSavedDraft({ key, id: 4321, name: e.title.value, body: JSON.stringify(draft) });
  assert.equal((await e.safety.readDraft(e.view)).matches, true);
});
test('15秒を越えて到着する保存応答も待ち、保存操作を重ねて送らない', async () => {
  const e = environment(); let clicks = 0, respond;
  const timer = e.page.setTimeout; e.page.setTimeout = (fn, ms) => timer(() => { if (e.time() >= 120000) respond?.(); fn(); }, ms);
  e.button.click = () => { clicks++; respond = e.succeed; };
  assert.equal(await e.safety.save(e.view, '保存中'), true); assert.equal(clicks, 1); assert.ok(e.time() >= 120000);
});
test('別記事・古い本文・別タイトルを読み戻しても保存成功にしない', async () => {
  for (const kind of ['other', 'old', 'title']) {
    let saved;
    const e = environment({ fetch: async () => ({ status: 200, json: async () => ({ data: saved }), clone: () => ({ json: async () => ({ data: saved }) }) }) });
    e.safety.setDraftParser?.(n => e.view.state.schema.nodeFromJSON(JSON.parse(n.body)));
    saved = { key: kind === 'other' ? 'nffffffffffff' : key, id: 4321, name: kind === 'title' ? '別タイトル' : e.title.value, body: kind === 'old' ? JSON.stringify(new Doc([new Node('paragraph', {}, '古い本文')]).toJSON()) : e.encode() };
    await assert.rejects(e.safety.save(e.view, '保存中'), /保存完了を確認できません/);
  }
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
  const module = e.loadModule('note-source-picker-v163.js', 'syncBaseStatus, resumableSend, deleteCardsOnly, resetAll, deleteLastExactUrl, auditDocuments, checkAllCards, setView(v){viewCache=v;selectionCache={atEnd:()=>({})}}, setCommand(fn){noteUrlCommand=fn}');
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
test('310件の通知カードを10件ごとのID正規化・遅延保存を経て全件完了する', async () => {
  const e = sending(310); let saves = 0, response;
  e.button.click = () => { saves++; changeOnlyIds(e); response = afterSavePolls(e.succeed); };
  await e.module.resumableSend(); await response;
  const run = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
  assert.equal(run.stage, 'cards_ready', e.statuses.get('mumei-note-source-status-v163').textContent);
  assert.equal(e.calls(), 310); assert.equal(saves, 31); assert.equal(run.savedCardCount, 310);
  assert.equal(e.safety.index(e.view).images.length, 310); assert.equal(e.safety.index(e.view).embeds.length, 310);
  assert.match(e.encode(), /消さない本文/);
  assert.deepEqual(Array.from(e.safety.index(e.view).embeds, h => h.node.attrs.src), e.rows.map(r => r.url));
  await e.module.resumableSend(); assert.equal(e.calls(), 310); assert.equal(saves, 31);
});
test('保存済み下書きに1枚足りなければ全件完成扱いにしない', async () => {
  const e = sending(3); const succeed = e.succeed;
  e.button.click = () => { succeed(); const n = e.savedDraft(), doc = JSON.parse(n.body); doc.content = doc.content.filter(x => x.attrs?.embeddedContentKey !== 'emb2'); e.setSavedDraft({ ...n, body: JSON.stringify(doc) }); };
  await e.module.resumableSend();
  const run = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
  assert.notEqual(run.stage, 'cards_ready'); assert.equal(run.cardAudit.savedCards, 2);
  assert.equal(run.cardAudit.complete, false); assert.equal(run.cardAudit.rows[1].savedCard, false);
  assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /全件確認が未完了/);
  // A contradictory readback invalidates the old response proof: resume must
  // actually save again, not repeatedly skip the write as 'already saved'.
  let retries = 0; e.button.click = () => { retries++; e.succeed(); };
  await e.module.resumableSend();
  const completed = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
  assert.equal(retries, 1); assert.equal(e.calls(), 3); assert.equal(completed.stage, 'cards_ready'); assert.equal(completed.cardAudit.savedCards, 3);
});
test('全件確認は本文を変更せず、画像だけ・未記録・重複・順序・保存不足を区別する', async () => {
  const e = sending(3); let a = e.module.auditDocuments(e.view, e.dataset, e.run, null);
  assert.equal(a.images, 3); assert.equal(a.cards, 0); assert.equal(a.complete, false);
  await e.module.resumableSend(); const before = e.encode(); await e.module.checkAllCards(); assert.equal(e.encode(), before);
  let run = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key)); assert.equal(run.cardAudit.complete, true);
  const cards = e.safety.index(e.view).embeds;
  e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, cards[0].node));
  a = e.module.auditDocuments(e.view, e.dataset, run, null); assert.equal(a.duplicates, 1); assert.equal(a.complete, false);
  e.view.dispatch(e.view.state.tr.delete(e.view.state.doc.content.size - cards[0].node.nodeSize, e.view.state.doc.content.size));
  run.cardKeys = []; a = e.module.auditDocuments(e.view, e.dataset, run, { doc: e.view.state.doc, matches: true });
  assert.equal(a.cards, 3); assert.equal(a.recorded, 0); assert.equal(a.complete, false);
  run = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
  const first = e.safety.index(e.view).embeds[0];
  e.view.dispatch(e.view.state.tr.delete(first.pos, first.pos + first.node.nodeSize).insert(e.view.state.doc.content.size - first.node.nodeSize, first.node));
  a = e.module.auditDocuments(e.view, e.dataset, run, { doc: e.view.state.doc, matches: true });
  assert.equal(a.cards, 3); assert.equal(a.order, false); assert.equal(a.complete, false);
});
test('実際の送処理: 途中停止は現在のカードを保存し次の操作で残件だけ作る', async () => {
  const e = sending(3); let calls = 0;
  e.module.setCommand(url => (state, dispatch) => { calls++; const last = state.doc.nodes.at(-1); dispatch(state.tr.replaceWith(state.doc.content.size - last.nodeSize, state.doc.content.size, embed('emb' + calls, url))); if (calls === 1) e.safety.stop(); return true; });
  await e.module.resumableSend(); assert.equal(calls, 1); assert.match(e.encode(), /消さない本文/);
  await e.module.resumableSend(); assert.equal(calls, 3); assert.equal(e.safety.index(e.view).embeds.length, 3);
});
test('実際の送処理: タイムアウト後の書込みを止め、明示再開で未完了分だけ作る', async () => {
  const e = sending(2); let pending;
  e.module.setCommand(url => (state, dispatch) => { const last = state.doc.nodes.at(-1); pending = () => dispatch(state.tr.replaceWith(state.doc.content.size - last.nodeSize, state.doc.content.size, embed('emblate', url))); return true; });
  await e.module.resumableSend(); assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /タイムアウト/);
  const before=e.encode(); pending(); assert.equal(e.encode(),before); let calls = 0;
  e.module.setCommand(url => (state, dispatch) => { calls++; const last = state.doc.nodes.at(-1); dispatch(state.tr.replaceWith(state.doc.content.size - last.nodeSize, state.doc.content.size, embed('embremaining'+calls, url))); return true; });
  await e.module.resumableSend(); assert.equal(calls, 2); assert.equal(e.safety.index(e.view).embeds.length, 2);
  assert.equal(JSON.parse(e.storage.get('mumei_likers_thin_run_v160:'+key)).stage,'cards_ready');
});

// The published note editor assigns block IDs in appendTransaction and consumes
// URL text BEFORE its asynchronous embed request resolves. Keep both behaviors.
function nativeBlockIds(e) {
  const dispatch = e.view.dispatch.bind(e.view); let sequence = 0;
  e.view.dispatch = tr => {
    dispatch(tr);
    const nodes = e.view.state.doc.nodes.map(n => n.attrs.id ? n : new Node(n.type.name, { ...n.attrs, id: 'native-' + ++sequence }, n.textContent));
    if (nodes.some((n, i) => n !== e.view.state.doc.nodes[i])) dispatch(e.view.state.tr.replaceWith(0, e.view.state.doc.content.size, new Doc(nodes).content));
  };
  e.view.dispatch(e.view.state.tr);
}
function nativeCardCommand(e, { fail = false, late } = {}) {
  let sequence = 0;
  return url => (state, dispatch) => {
    const node = state.doc.lastChild, pos = state.doc.content.size - node.nodeSize;
    // First dispatch removes the typed URL while retaining the paragraph ID.
    dispatch(state.tr.replaceWith(pos, pos + node.nodeSize, new Node('paragraph', node.attrs)));
    const complete = () => {
      const placeholder = e.view.state.doc.nodeAt(pos);
      dispatch(e.view.state.tr.replaceWith(pos, pos + placeholder.nodeSize,
        fail ? new Node('paragraph', node.attrs, url) : embed('embnative' + ++sequence, url)));
    };
    if (late) late(complete); else queueMicrotask(complete);
    return true;
  };
}
test('noteの自動ID付与とURL先行削除を再現し、本文保護を維持してカード化する', async () => {
  const e = sending(3); nativeBlockIds(e);
  const protectedNodes = e.view.state.doc.nodes.slice();
  e.module.setCommand(nativeCardCommand(e));
  await e.module.resumableSend();
  assert.equal(e.safety.index(e.view).embeds.length, 3);
  assert.ok(protectedNodes.every(n => e.view.state.doc.nodes.includes(n)));
  assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /3\/3 完成・保存/);
});
test('v18.8.7の未確認記録と末尾URLから「送」で復旧し、既存の同じURLを残す', async () => {
  const e = sending(3); nativeBlockIds(e);
  const protectedNodes = e.view.state.doc.nodes.slice();
  const url = e.rows[0].url;
  e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, new Node('paragraph', {}, 'おわり')));
  e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, new Node('paragraph', {}, url)));
  e.run.pendingCard = { url, beforeKeys: [] }; e.run.stage = 'cards_building';
  e.storage.set('mumei_likers_thin_run_v160:' + key, JSON.stringify(e.run));
  e.module.setCommand(nativeCardCommand(e));
  await e.module.resumableSend();
  const run = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
  assert.equal(run.pendingCard, null); assert.equal(run.cardKeys.length, 3);
  assert.ok(protectedNodes.every(n => e.view.state.doc.nodes.includes(n)));
  assert.equal(e.view.state.doc.nodes.filter(n => n.textContent === url).length, 1);
  assert.match(e.encode(), /おわり/);
});
test('実機0/310: 旧版のpendingだけ残りURLがない下書きから310件を作成・保存する', async () => {
  const e = sending(310);
  const oldUrl = e.view.state.doc.nodes.indexOf(e.existing);
  const nodes = e.view.state.doc.nodes.filter((_, i) => i !== oldUrl);
  nodes.push(new Node('paragraph', {}, 'おわり'), new Node('paragraph'));
  e.view.dispatch(e.view.state.tr.replaceWith(0, e.view.state.doc.content.size, new Doc(nodes).content));
  nativeBlockIds(e); const protectedNodes = e.view.state.doc.nodes.filter(n => n.content.size || n.type.name !== 'paragraph');
  e.run.pendingCard = { url: e.rows[0].url, beforeKeys: [] }; e.run.stage = 'cards_building';
  e.storage.set('mumei_likers_thin_run_v160:' + key, JSON.stringify(e.run));
  e.module.setCommand(nativeCardCommand(e)); let saves = 0;
  e.button.click = () => { saves++; e.succeed(); };
  await e.module.resumableSend();
  const run = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
  assert.equal(run.cardKeys.length, 310); assert.equal(run.pendingCard, null); assert.equal(run.stage, 'cards_ready');
  assert.equal(e.safety.index(e.view).images.length, 310); assert.equal(e.safety.index(e.view).embeds.length, 310);
  assert.equal(saves, 31); assert.ok(protectedNodes.every(n => e.view.state.doc.nodes.includes(n)));
  assert.deepEqual(Array.from(e.safety.index(e.view).embeds, h => h.node.attrs.src), e.rows.map(r => r.url));
  assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /310\/310 完成・保存/);
});
// Reopened drafts can contain fewer cards than the old per-card local journal.
function reopenCards(e, recorded, present, pendingIndex = null) {
  e.run.cardKeys = e.rows.slice(0, recorded).map((r, i) => ({ url: r.url, key: 'embsaved' + i }));
  for (const i of present) e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, embed('embsaved' + i, e.rows[i].url)));
  if (pendingIndex != null) e.run.pendingCard = { url: e.rows[pendingIndex].url, beforeKeys: e.run.cardKeys.map(x => x.key) };
  e.storage.set('mumei_likers_thin_run_v160:' + key, JSON.stringify(e.run));
}
test('147/310の記録だけ残った再読込から画像310枚を保持し通知310件を復旧する', async () => {
  const e = sending(310); reopenCards(e, 147, [], 147); nativeBlockIds(e);
  const protectedNodes = e.view.state.doc.nodes.slice();
  e.module.setCommand(nativeCardCommand(e)); let saves = 0;
  e.button.click = () => { saves++; e.succeed(); };
  await e.module.resumableSend();
  const r = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
  assert.equal(r.stage, 'cards_ready'); assert.equal(r.cardKeys.length, 310); assert.equal(r.savedCardCount, 310);
  assert.ok(protectedNodes.every(n => e.view.state.doc.nodes.includes(n)));
  assert.equal(e.safety.index(e.view).images.length, 310); assert.equal(saves, 31);
  assert.deepEqual(Array.from(e.safety.index(e.view).embeds, h => h.node.attrs.src), e.rows.map(r => r.url));
});
test('再読込後の途中欠落だけを補い、残存カード・原文・画像と最終確認カードの順序を保持する', async () => {
  const e = sending(8); reopenCards(e, 7, [0, 2, 5, 6], 7);
  const protectedNodes = e.view.state.doc.nodes.slice();
  await e.module.resumableSend();
  assert.equal(e.calls(), 4); assert.ok(protectedNodes.every(n => e.view.state.doc.nodes.includes(n)));
  assert.deepEqual(Array.from(e.safety.index(e.view).embeds, h => h.node.attrs.src), e.rows.map(r => r.url));
});
test('欠落の後のpendingカードが既に完成していれば回収し順序を保って不足だけ補う', async () => {
  const e = sending(6); reopenCards(e, 4, [0, 2], 4);
  e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, embed('embpending', e.rows[4].url)));
  const originalCards = e.safety.index(e.view).embeds.map(h => h.node);
  await e.module.resumableSend(); assert.equal(e.calls(), 3);
  assert.ok(originalCards.every(n => e.view.state.doc.nodes.includes(n)));
  assert.deepEqual(Array.from(e.safety.index(e.view).embeds, h => h.node.attrs.src), e.rows.map(r => r.url));
});
test('保存後srcがiframe URLになるカードを既存キーで認識し重複しない', async () => {
  const e = sending(2); reopenCards(e, 1, [0]);
  const hit = e.safety.index(e.view).embeds[0];
  e.view.dispatch(e.view.state.tr.setNodeMarkup(hit.pos, types.embed, { ...hit.node.attrs,
    src: 'https://note.com/embed/notes/' + e.rows[0].url.split('/').at(-1),
    htmlForEmbed: '<iframe class="note-embed" src="https://note.com/embed/notes/' + e.rows[0].url.split('/').at(-1) + '"></iframe>' }));
  await e.module.resumableSend();
  assert.equal(e.calls(), 1); assert.equal(e.safety.index(e.view).embeds.length, 2);
  assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /完成・保存/);
});
test('同じキーが別記事・偽ドメインに変わった場合は本文を変更しない', async () => {
  for (const src of ['https://note.com/embed/notes/nffffffffffff', 'https://note.com.evil.test/embed/notes/n000000000000']) {
    const e = sending(2); reopenCards(e, 1, [0]); const h = e.safety.index(e.view).embeds[0];
    e.view.dispatch(e.view.state.tr.setNodeMarkup(h.pos, types.embed, { ...h.node.attrs, src }));
    const before = e.encode(); await e.module.resumableSend();
    assert.equal(e.calls(), 0); assert.equal(e.encode(), before); assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /記事を確認できません/);
  }
});
test('キーのない同URLカードが別にある場合は再生成も削除もしない', async () => {
  const e = sending(2); reopenCards(e, 1, []);
  e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, embed('embdifferent', e.rows[0].url)));
  const before = e.encode(); await e.module.resumableSend();
  assert.equal(e.calls(), 0); assert.equal(e.encode(), before); assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /同じ記事のカード/);
});
test('10件の保存に失敗したら11件目を作らず、同じ本文から重複なしで再開する', async () => {
  const e = sending(25); e.button.click = () => {};
  await e.module.resumableSend();
  assert.equal(e.calls(), 10); let r = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
  assert.notEqual(r.stage, 'cards_ready'); assert.equal(r.savedCardCount || 0, 0);
  e.button.click = e.succeed; await e.module.resumableSend();
  r = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
  assert.equal(e.calls(), 25); assert.equal(r.savedCardCount, 25); assert.equal(r.stage, 'cards_ready');
});
test('最終保存に失敗しても完成扱いにせず再送で保存だけを行う', async () => {
  const e = sending(2); e.button.click = () => {};
  await e.module.resumableSend();
  assert.notEqual(JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key)).stage, 'cards_ready');
  e.button.click = e.succeed; await e.module.resumableSend(); assert.equal(e.calls(), 2);
  assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /完成・保存/);
});
test('旧版の作業URLがなく元本文の同じURLだけある場合、その原文を保持して続行する', async () => {
  const e = sending(2); nativeBlockIds(e); const protectedNodes = e.view.state.doc.nodes.slice();
  e.run.pendingCard = { url: e.rows[0].url, beforeKeys: [] };
  e.storage.set('mumei_likers_thin_run_v160:' + key, JSON.stringify(e.run));
  e.module.setCommand(nativeCardCommand(e)); await e.module.resumableSend();
  assert.equal(e.safety.index(e.view).embeds.length, 2);
  assert.ok(protectedNodes.every(n => e.view.state.doc.nodes.includes(n)));
  assert.equal(e.view.state.doc.nodes.filter(n => n.textContent === e.rows[0].url).length, 1);
});
test('旧URL数の記録が現本文と違ってもURLが0件なら本文を変えず作業URLを再作成する', async () => {
  const e = sending(2);
  e.view.dispatch(e.view.state.tr.delete(e.view.state.doc.nodes[0].nodeSize, e.view.state.doc.nodes[0].nodeSize + e.existing.nodeSize));
  nativeBlockIds(e); const protectedNodes = e.view.state.doc.nodes.slice();
  e.run.pendingCard = { url: e.rows[0].url, beforeKeys: [], rawBeforeCount: 1 };
  e.storage.set('mumei_likers_thin_run_v160:' + key, JSON.stringify(e.run));
  e.module.setCommand(nativeCardCommand(e)); await e.module.resumableSend();
  assert.equal(e.safety.index(e.view).embeds.length, 2); assert.ok(protectedNodes.every(n => e.view.state.doc.nodes.includes(n)));
});
test('旧版のURLなしでも完成済みカードがあれば再生成せず残件だけ作る', async () => {
  const e = sending(2), url = e.rows[0].url;
  e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, embed('embalready', url)));
  e.run.pendingCard = { url, beforeKeys: [] };
  e.storage.set('mumei_likers_thin_run_v160:' + key, JSON.stringify(e.run));
  await e.module.resumableSend();
  assert.equal(e.calls(), 1); assert.equal(e.safety.index(e.view).embeds.length, 2);
  assert.equal(e.safety.index(e.view).embeds.filter(h => h.node.attrs.src === url).length, 1);
});
test('新しい試行の開始後は古い非同期変換を無効化し二重カードにしない', async () => {
  const e = sending(2); nativeBlockIds(e); let late;
  e.module.setCommand(nativeCardCommand(e, { late: fn => { late = fn; } }));
  await e.module.resumableSend(); assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /タイムアウト/);
  const command = nativeCardCommand(e); let fired = false;
  e.module.setCommand(url => (state, dispatch, view) => {
    if (!fired) { fired = true; late(); }
    return command(url)(view.state, dispatch, view);
  });
  await e.module.resumableSend();
  assert.equal(e.safety.index(e.view).embeds.length, 2);
  assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /2\/2 完成・保存/);
});
test('カードAPI失敗でURLへ戻った後も「送」で再試行できる', async () => {
  const e = sending(1); nativeBlockIds(e);
  e.module.setCommand(nativeCardCommand(e, { fail: true }));
  await e.module.resumableSend(); assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /タイムアウト/);
  e.module.setCommand(nativeCardCommand(e)); await e.module.resumableSend();
  assert.equal(e.safety.index(e.view).embeds.length, 1);
  assert.equal(e.view.state.doc.nodes.filter(n => n.textContent === e.rows[0].url).length, 1);
});
test('旧版の途中URLが複数ある場合は本文もURLも削除せず止める', async () => {
  const e = sending(1), url = e.rows[0].url;
  for (let i = 0; i < 2; i++) e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, new Node('paragraph', {}, url)));
  e.run.pendingCard = { url, beforeKeys: [] };
  e.storage.set('mumei_likers_thin_run_v160:' + key, JSON.stringify(e.run));
  const before = e.encode(); await e.module.resumableSend();
  assert.equal(e.encode(), before); assert.equal(e.calls(), 0);
  assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /一意に確認できません/);
});
test('再試行中の変換が元本文を消そうとしても本文保護は拒否する', async () => {
  const e = sending(1); nativeBlockIds(e); const protectedNodes = e.view.state.doc.nodes.slice();
  e.module.setCommand(url => (state, dispatch) => { dispatch(state.tr.delete(0, state.doc.content.size)); return true; });
  await e.module.resumableSend();
  assert.ok(protectedNodes.every(n => e.view.state.doc.nodes.includes(n)));
  assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /元の本文または画像を失う変更/);
});
test('実際の初期化: 生成画像・カードだけを削除し本文と通常画像を維持', async () => {
  const e = sending(3); const normalImage = image('normal'); e.view.dispatch(e.view.state.tr.insert(0, normalImage)); await e.module.resumableSend();
  await e.module.resetAll(); assert.ok(e.view.state.doc.nodes.includes(normalImage)); assert.ok(e.view.state.doc.nodes.includes(e.existing)); assert.match(e.encode(), /消さない本文/);
  assert.equal(e.safety.index(e.view).images.length, 1); assert.equal(e.safety.index(e.view).embeds.length, 0);
  assert.equal(e.storage.has('mumei_likers_thin_run_v160:' + key), false); assert.ok(e.safety.backups().find(x => x.slot === 'before').item.images >= 4);
});
test('500件を1件ずつ待機し、10件ごとの保存と全件確認を行う', async () => {
  const e = sending(500); let saves = 0; e.button.click = () => { saves++; e.succeed(); };
  const started = e.time(); await e.module.resumableSend();
  assert.equal(e.calls(), 500); assert.equal(e.safety.index(e.view).embeds.length, 500); assert.ok(e.view.state.doc.nodes.includes(e.existing));
  const elapsed = e.time() - started; assert.equal(saves, 50);
  // Each verified native save polls its synchronous test response after 100 ms.
  assert.ok(elapsed - saves * 100 >= 499 * 3000, String(elapsed));
  assert.ok(elapsed - saves * 100 < 499 * 3000 + 3000, String(elapsed));
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

test('200枚で画像通信が失敗した後、初期化は途中40枚も除去し元本文と通常画像を残す', async () => {
  const e = sending(307), original = [new Node('paragraph', {}, '原稿697文字を消さない'), image('original-photo')];
  e.view.dispatch(e.view.state.tr.replaceWith(0, e.view.state.doc.content.size, new Doc(original).content));
  e.run.images = {}; e.run.cardKeys = [];
  class Transfer { constructor() { this.list = []; this.items = { add: f => this.list.push(f) }; } get files() { return this.list; } }
  e.page.DataTransfer = Transfer;
  const api = e.loadModule('note-likers-thin-notify-v160.js', 'injectImageInput,beginUploadRequest,endUploadRequest,setView(v){viewCache=v},setArm(a){imageArm=a}');
  api.setView(e.view);
  for (let offset = 0; offset < 240; offset += 80) {
    const rows = e.rows.slice(offset, offset + 80); let arm;
    const completion = new Promise((resolve, reject) => { arm = { view:e.view, dataset:e.dataset, run:e.run, workRows:rows, files:rows.map(r=>({name:r.index+'.png',type:'image/png'})), beforeIds:new Set(e.safety.index(e.view).images.map(h=>h.node.attrs.id)), beforeInputs:new Set(), resolve, reject, consumed:false }; });
    const checked = offset === 160 ? assert.rejects(completion, /開始時160枚/) : completion;
    const input = { tagName:'INPUT', type:'file', accept:'image/*', files:[], value:'', dispatchEvent(event) {
      if (event.type !== 'change') return;
      for (const row of rows) e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size,
        row.index <= 200 ? image('upload'+row.index) : new Node('image', {id:'upload'+row.index,src:'blob:failed',link:''})));
      if (offset === 160) { const ticket = api.beginUploadRequest({type:'image/png'}, '/upload'); api.endUploadRequest(ticket, 500, 'failed'); }
    } };
    api.setArm(arm); await api.injectImageInput(input); await checked;
  }
  assert.equal(Object.keys(e.run.images).length, 200);
  assert.equal(e.run.pending.slots.length, 80); assert.equal(e.run.pending.stage, 'failed');
  await e.module.resetAll();
  assert.deepEqual(e.view.state.doc.nodes, original);
  assert.equal(e.storage.has('mumei_likers_thin_run_v160:' + key), false);
  assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /極薄240/);
});

test('次の画像選択待ちを初期化で解除し、ファイルを解放する', async () => {
  const e = sending(1), nativeClick = function () {};
  e.page.HTMLInputElement.prototype.click = nativeClick;
  const api = e.loadModule('note-likers-thin-notify-v160.js', 'installNativeInputInterceptor,prepareReset,setArm(a){imageArm=a}');
  let arm;
  const completion = new Promise((resolve, reject) => { arm = { consumed:false, files:[{}], beforeInputs:new Set([{}]), resolve, reject }; });
  const checked = assert.rejects(completion, /初期化へ/);
  api.setArm(arm); api.installNativeInputInterceptor(); await api.prepareReset(); await checked;
  assert.equal(arm.files.length, 0); assert.equal(arm.beforeInputs.size, 0);
  assert.equal(e.page.HTMLInputElement.prototype.click, nativeClick);
});

test('初期化は通信中と未記録の画像を削除せず、投入記録を残す', async () => {
  const e = sending(1), api = e.loadModule('note-likers-thin-notify-v160.js', 'beginUploadRequest,endUploadRequest,setArm(a){imageArm=a}');
  e.run.pending = { workUrls:e.rows.map(r=>r.url), beforeIds:['image0'], slots:['owned'], stage:'failed' };
  e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, image('unrecorded-photo')));
  e.storage.set('mumei_likers_thin_run_v160:' + key, JSON.stringify(e.run)); const before=e.encode();
  api.setArm({consumed:true}); const ticket=api.beginUploadRequest({type:'image/png'},'/upload');
  await e.module.resetAll(); assert.equal(e.encode(),before); assert.ok(e.storage.has('mumei_likers_thin_run_v160:'+key));
  api.endUploadRequest(ticket,200); e.run.pending.stage='uploading'; e.storage.set('mumei_likers_thin_run_v160:'+key,JSON.stringify(e.run));
  await e.module.resetAll(); assert.equal(e.encode(),before); assert.match(e.statuses.get('mumei-note-source-status-v163').textContent,/投入記録にない/);
});

test('307件の大容量対象一覧は最新＋操作前の2世代を保持し、古い3世代目を容量回収しても対象一覧ごと復元できる', () => {
  const e = sending(307);
  e.dataset.rows.forEach(r => { r.title='長い記事の見出し'.repeat(40); r.creator='作成者'; });
  e.storage.set('mumei_likers_thin_dataset_v160', JSON.stringify(e.dataset));
  e.safety.checkpoint(e.view); e.safety.capture();
  e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, new Node('paragraph',{},'追記'))); e.safety.capture();
  const copies=e.safety.backups(); assert.equal(copies.length,2);
  assert.deepEqual(new Set(copies.map(x=>x.slot)),new Set(['before','latest']));
  for(const {slot,item} of copies){ assert.equal(item.dataset.rows.length,307); assert.equal(JSON.parse(e.storage.get('mumei_card_backup_v188:'+key+':'+slot)).dataset,null); }
  assert.equal(e.storage.has('mumei_card_backup_v188:'+key+':previous'),false);
  const encodedCopies=copies.map(x=>JSON.stringify(x.item).length).reduce((a,b)=>a+b,0);
  const storedCopies=[...e.storage].filter(([k])=>k.startsWith('mumei_card_backup_v188:')).reduce((sum,[,v])=>sum+v.length,0);
  assert.ok(storedCopies < encodedCopies*0.75, `${storedCopies}/${encodedCopies}`);
  e.storage.delete('mumei_likers_thin_dataset_v160'); e.safety.restore(copies[0].item);
  assert.equal(JSON.parse(e.storage.get('mumei_likers_thin_dataset_v160')).rows.length,307);
});

test('同じIDで対象一覧が変わっても古い本文控えの一覧を上書きしない', () => {
  const e=sending(1); e.safety.capture(); const old=e.safety.backups()[0].item.dataset.rows[0].url;
  e.dataset.rows[0].url='https://note.com/other/n/n111111111111';e.storage.set('mumei_likers_thin_dataset_v160',JSON.stringify(e.dataset));
  e.safety.checkpoint(e.view);const copies=e.safety.backups();
  assert.equal(copies.find(c=>c.slot==='latest').item.dataset.rows[0].url,old);
  assert.equal(copies.find(c=>c.slot==='before').item.dataset.rows[0].url,e.dataset.rows[0].url);
});

function imageCacheEnvironment() {
  const e=environment(), entries=new Map(); let puts=0, deletes=0;
  const cache={ keys:async()=>[...entries.keys()].map(url=>({url})), match:async url=>entries.get(url)?.clone(), put:async(url,response)=>{puts++;entries.set(url,response);}, delete:async url=>{deletes++;return entries.delete(url);} };
  Object.assign(e.page,{caches:{open:async()=>cache},Response,Blob,File,setTimeout,clearTimeout});
  e.loadModule('note-thin-image-cache-v1882.js','key');
  return {...e,cache:e.page.__MUMEI_THIN_IMAGE_CACHE__,entries,puts:()=>puts,deletes:()=>deletes};
}
test('同じ画像は初期化・ページ再生成後も再利用し、タイトルや#記事が変われば作り直す', async () => {
  const e=imageCacheEnvironment(), row={index:1,url:'https://note.com/a/n/n111111111111',title:'見出し',creator:'作者',thumbUrl:'https://assets.st-note.com/thumb.png'};
  const blob=new Blob(['same png'],{type:'image/png'});assert.equal(await e.cache.put(row,blob),true);
  const api=e.loadModule('note-likers-thin-notify-v160.js','makeThinFile');
  const file=await api.makeThinFile({...row,index:200});assert.equal(file.name,'200_thin.png');assert.equal(await file.text(),'same png');
  const next=environment();Object.assign(next.page,{caches:{open:async()=>({keys:async()=>[...e.entries.keys()].map(url=>({url})),match:async url=>e.entries.get(url)?.clone()})},Response,setTimeout,clearTimeout});
  next.loadModule('note-thin-image-cache-v1882.js','key'); assert.equal(await (await next.page.__MUMEI_THIN_IMAGE_CACHE__.get(row)).text(),'same png');
  for(const change of [{title:'変更後'},{url:'https://note.com/a/n/n222222222222'},{thumbUrl:'https://assets.st-note.com/new.png'},{actorImageUrl:'new-avatar'}]) assert.equal(await e.cache.get({...row,...change}),null);
  assert.equal(e.puts(),1);
});
test('画像キャッシュは512件・1件128KiB以内に抑え、保存不可でも画像工程を妨げない', async () => {
  const e=imageCacheEnvironment(), blob=new Blob(['png'],{type:'image/png'});
  for(let i=0;i<513;i++)await e.cache.put({url:'article'+i,title:'見出し'},blob);
  assert.equal(e.entries.size,512);assert.equal(e.deletes(),1);
  assert.equal(await e.cache.put({url:'large'},new Blob(['x'.repeat(128*1024+1)],{type:'image/png'})),false);
  const broken=environment();Object.assign(broken.page,{caches:{open:async()=>{throw new Error('quota');}},Response,setTimeout,clearTimeout});
  broken.loadModule('note-thin-image-cache-v1882.js','key');assert.equal(await broken.page.__MUMEI_THIN_IMAGE_CACHE__.get({url:'a'}),null);assert.equal(await broken.page.__MUMEI_THIN_IMAGE_CACHE__.put({url:'a'},blob),false);
});

test('控えの整理は参照されない同一記事の対象一覧だけを除去する', () => {
  const e=sending(1), prefix='mumei_card_backup_v188:'+key+':dataset:';
  e.page.localStorage.key=i=>[...e.storage.keys()][i]??null;
  Object.defineProperty(e.page.localStorage,'length',{get:()=>e.storage.size});
  e.safety.capture();const referenced=JSON.parse(e.storage.get('mumei_card_backup_v188:'+key+':latest')).datasetRef;
  e.storage.set(prefix+'obsolete','{}');e.storage.set('mumei_card_backup_v188:naaaaaaaaaaaa:dataset:other','{}');
  e.safety.checkpoint(e.view);assert.equal(e.storage.has(prefix+'obsolete'),false);
  assert.equal(e.storage.has(referenced),true);assert.equal(e.storage.has('mumei_card_backup_v188:naaaaaaaaaaaa:dataset:other'),true);
  assert.equal(e.safety.backups().find(x=>x.slot==='latest').item.dataset.rows.length,1);
});
test('画像キャッシュは12時間を過ぎた画像を再利用しない', async () => {
  const e=imageCacheEnvironment(), row={url:'article',title:'見出し'};
  await e.cache.put(row,new Blob(['png'],{type:'image/png'}));e.page.Date.now=()=>100000+12*60*60*1000+1;
  assert.equal(await e.cache.get(row),null);
});
test('200枚後のブラウザ例外も段階付きで停止し、読み取り専用エラーメッセージを変更しない', async () => {
  const e=sending(200), before=e.encode();e.page.DataTransfer=class{constructor(){throw new DOMException('画像入力を準備できません','InvalidStateError');}};
  const api=e.loadModule('note-likers-thin-notify-v160.js','injectImageInput,setArm(a){imageArm=a}');let arm;
  const completion=new Promise((resolve,reject)=>{arm={view:e.view,dataset:e.dataset,run:e.run,workRows:[e.rows[0]],files:[{}],beforeIds:new Set(e.safety.index(e.view).images.map(x=>x.node.attrs.id)),beforeInputs:new Set(),resolve,reject};});
  const checked=assert.rejects(completion,/画像投入｜開始時200枚｜画像入力を準備できません/);api.setArm(arm);
  await api.injectImageInput({tagName:'INPUT',type:'file',accept:'image/*'});await checked;
  assert.equal(e.encode(),before);assert.equal(arm.files.length,0);
  const diag=JSON.parse(e.storage.get('mumei_upload_diag_v160:'+key));assert.equal(diag.at(-1).completedBefore,200);assert.equal(diag.at(-1).phase,'画像投入');
});

test('全件の投稿者ID・記事キーを照合し名前に「さん」を付ける。誤った名義は拒否する', async () => {
  const e = environment(), api = e.loadModule('note-card-creator-v1883.js','identity,caption,verifyRows');
  const row = {url:'https://note.com/author/n/n111111111111',urlname:'author',latestKey:'n111111111111',creator:'スキした人の仮名'};
  let calls=0;
  e.page.GM_xmlhttpRequest = o => {calls++;o.onload({status:200,responseText:JSON.stringify({data:{key:row.latestKey,user:{urlname:'author',nickname:'確認済みの作者 🌙'}}})});};
  await api.verifyRows([row]); assert.equal(row.creator,'確認済みの作者 🌙'); assert.equal(api.caption(row),'確認済みの作者 🌙さん');
  await api.verifyRows([row]); assert.equal(calls,1);
  assert.throws(()=>api.caption({...row,urlname:'other'}),/一致しません/);
  assert.throws(()=>api.caption({...row,creator:'別人'}),/未確認/);
  const other={...row,creatorVerified:null};e.page.GM_xmlhttpRequest=o=>o.onload({status:200,responseText:JSON.stringify({data:{key:row.latestKey,user:{urlname:'wrong',nickname:'別人'}}})});
  await assert.rejects(api.verifyRows([other]),/照合不一致/);assert.equal(other.creatorVerified,null);
});

test('50枚の長さが違うキャプションを追加しても本文位置・人物・リンクはずれない', async () => {
  const e=sending(50);e.loadModule('note-card-creator-v1883.js','caption');
  e.rows.forEach((r,i)=>Object.assign(r,{urlname:'user',latestKey:r.url.split('/').at(-1),creator:'作者'+i+'🌙'.repeat(i%5),creatorVerified:{urlname:'user',articleKey:r.url.split('/').at(-1),name:'作者'+i+'🌙'.repeat(i%5)}}));
  const api=e.loadModule('note-likers-thin-notify-v160.js','linkCreatedImages');
  const hits=e.safety.index(e.view).images;
  e.view.dispatch(e.view.state.tr.insert(0,new Node('paragraph',{},'挿入直前の手入力')));
  await api.linkCreatedImages(e.view,e.rows,hits,e.run);
  for(let i=0;i<50;i++) {const hit=e.safety.tracked(e.view,{id:'image'+i});assert.equal(hit.node.textContent,e.rows[i].creator+'さん');assert.equal(hit.node.attrs.link,e.rows[i].url);}
  assert.match(e.encode(),/挿入直前の手入力/);assert.match(e.encode(),/消さない本文/);
});

test('初期化は再表示でIDが変わった極薄も保存済みsrc＋リンクで特定する', async()=>{
  const e=sending(3), normal=image('normal'); e.view.dispatch(e.view.state.tr.insert(0,normal));
  for(const hit of e.safety.index(e.view).images.filter(h=>h.node!==normal))e.view.dispatch(e.view.state.tr.setNodeMarkup(hit.pos,hit.node.type,{...hit.node.attrs,id:'regenerated-'+hit.node.attrs.id}));
  await e.module.resetAll();assert.deepEqual(Array.from(e.safety.index(e.view).images,h=>h.node),[normal]);assert.match(e.encode(),/消さない本文/);
});
test('進捗が消えても同じ記事の控えにある画像記録から初期化する',async()=>{
  const e=sending(2);e.safety.capture();e.storage.delete('mumei_likers_thin_run_v160:'+key);
  await e.module.resetAll();assert.equal(e.safety.index(e.view).images.length,0);assert.match(e.encode(),/消さない本文/);
});
test('同じsrc＋リンクが複数なら初期化で消さずに記録を保持する',async()=>{
  const e=sending(1),old=e.safety.index(e.view).images[0];
  e.view.dispatch(e.view.state.tr.setNodeMarkup(old.pos,old.node.type,{...old.node.attrs,id:'new-id'}));
  e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size,new Node('image',{...old.node.attrs,id:'another-id'})));
  const before=e.encode();await e.module.resetAll();assert.equal(e.encode(),before);assert.ok(e.storage.has('mumei_likers_thin_run_v160:'+key));assert.match(e.statuses.get('mumei-note-source-status-v163').textContent,/複数/);
});

test('完成307枚は1回の開始で1枚ずつ投入し、名前・リンク・実績を確認。カード一括削除後も画像を保持',async()=>{
  const e=sending(307);e.view.dispatch(e.view.state.tr.replaceWith(0,e.view.state.doc.content.size,new Doc([new Node('paragraph',{},'守る本文')]).content));
  e.dataset.preparedBatch=true;e.run.images={};
  e.rows.forEach((r,i)=>Object.assign(r,{urlname:'user',latestKey:r.url.split('/').at(-1),creator:'作者'+i,preparedBatchId:'test',creatorVerified:{urlname:'user',articleKey:r.url.split('/').at(-1),name:'作者'+i}}));
  e.storage.set('mumei_likers_thin_dataset_v160',JSON.stringify(e.dataset));e.storage.set('mumei_likers_thin_run_v160:'+key,JSON.stringify(e.run));
  e.page.File=File;e.page.Blob=Blob;e.page.DataTransfer=class{constructor(){this.list=[];this.items={add:f=>this.list.push(f)}}get files(){return this.list}};
  e.page.__MUMEI_PREPARED_BATCH__={image:async()=>new Blob(['png'],{type:'image/png'})};
  e.loadModule('note-card-creator-v1883.js','caption');
  const base=e.loadModule('note-likers-thin-notify-v160.js','insertThinImages,deleteCardsOnly,setView(v){viewCache=v;selectionCache={atEnd:()=>({})}},setNative(fn){preparedImageCommand=()=>fn}');base.setView(e.view);
  const batches=[];
  base.setNative((view,files,pos,kind)=>{assert.equal(kind,'image');batches.push(files.length);for(let i=0;i<files.length;i++){const n=new Node('image',{id:'ready'+parseInt(files[i].name),src:'https://assets.st-note.com/'+files[i].name,link:''});n.nodeSize=2;view.dispatch(view.state.tr.insert(pos+1+2*i,n));}return true;});
  await base.insertThinImages();
  assert.deepEqual(batches,Array(307).fill(1));assert.equal(e.safety.index(e.view).images.length,307);
  for(let i=0;i<307;i++){const n=e.safety.tracked(e.view,{id:'ready'+(i+1)}).node;assert.equal(n.textContent,'作者'+i+'さん');assert.equal(n.attrs.link,e.rows[i].url);}
  assert.match(e.statuses.get('mumei-likers-thin-status-v160').textContent,/完成/);
  await e.module.resumableSend();assert.equal(e.safety.index(e.view).embeds.length,307);
  await base.deleteCardsOnly();assert.equal(e.safety.index(e.view).embeds.length,0);assert.equal(e.safety.index(e.view).images.length,307);assert.match(e.encode(),/守る本文/);
});

test('本日昨日は当日・昨日→本物の固定→最新の優先順位で、古い固定も採用する',async()=>{
  const e=environment();e.page.document.getElementById=()=>null;
  let latest=[{key:'n111111111111',name:'最新だが古い',publish_at:'2020-01-01',user:{urlname:'a',nickname:'作者'}}], pinned=[];
  e.page.GM_xmlhttpRequest=o=>o.onload({status:200,responseText:JSON.stringify({data:{contents:o.url.includes('disabled_pinned=true')?latest:pinned}})});
  const api=e.loadModule('note-prince-special-v184.js','choose');
  const c={urlname:'a',creator:'作者'};
  pinned=[{...latest[0],key:'n222222222222',name:'古い固定',isPinned:true,publish_at:'2015-01-01'}];
  assert.equal((await api.choose(c,'todayYesterday')).latestKey,'n222222222222');
  pinned=[{...pinned[0],isPinned:false}];assert.equal((await api.choose(c,'todayYesterday')).latestKey,'n111111111111');
  latest=[{...latest[0],publish_at:new Date(e.time()).toISOString()}];assert.equal((await api.choose(c,'todayYesterday')).latestKey,'n111111111111');
});

test('完成データの検証は人物重複・氏名違い・#の後混入・実績の欠落をすべて拒否する',()=>{
  const e=environment();e.loadModule('note-card-creator-v1883.js','caption');const api=e.loadModule('note-prepared-batch-v1883.js','validate');
  const row=(id,key,index,articleSource)=>({urlname:id,latestKey:key,url:`https://note.com/${id}/n/${key}`,index,articleSource,creator:id,caption:id+'さん',creatorVerified:{urlname:id,articleKey:key,name:id},pngSha256:'0'.repeat(64)});
  const data={format:'mumei-thin-prepared-v1',batchId:'test',count:3,rows:[row('tag','n111111111111',1,'hashtag'),row('normal','n222222222222',2,'todayYesterday'),{...row('fuku444','nb4f6934381e9',3,'final'),finalMarker:true}]};
  api.validate(data);
  const changed=fn=>{const copy=JSON.parse(JSON.stringify(data));fn(copy);return copy;};
  assert.throws(()=>api.validate(changed(d=>d.rows[1].creator='wrong')),/氏名|未確認/);
  assert.throws(()=>api.validate(changed(d=>d.rows[1]={...d.rows[0],index:2})),/重複/);
  assert.throws(()=>api.validate(changed(d=>{d.rows[0].articleSource='todayYesterday';d.rows[1].articleSource='hashtag';})),/先頭/);
  assert.throws(()=>api.validate(changed(d=>delete d.rows[2].finalMarker)),/実績/);
});

test('固定なしの最新29件に相当する群は、すべて通常群の後・実績の直前へ移す',()=>{
  const e=environment();e.page.document.getElementById=()=>null;const api=e.loadModule('note-prince-special-v184.js','orderRows');
  const rows=[{id:'latest1',articleSource:'latestFallback'},{id:'today',articleSource:'todayYesterday'},{id:'tag',articleSource:'hashtag'},{id:'latest2',articleSource:'latestFallback'},{id:'fixed',articleSource:'fixedFallback'},{id:'math',finalMarker:true}];
  assert.deepEqual(Array.from(api.orderRows(rows),r=>r.id),['tag','today','fixed','latest1','latest2','math']);
});


test('#全記事モードは同じ作者の別記事を保持し、URL側の重複と記事重複を拒否する',()=>{
  const e=environment();e.loadModule('note-card-creator-v1883.js','caption');const api=e.loadModule('note-prepared-batch-v1883.js','validate');
  const row=(id,key,index,articleSource)=>({urlname:id,latestKey:key,url:`https://note.com/${id}/n/${key}`,index,articleSource,creator:id,caption:id+'さん',creatorVerified:{urlname:id,articleKey:key,name:id},pngSha256:'0'.repeat(64)});
  const rows=[row('author','n111111111111',1,'hashtag'),row('author','n222222222222',2,'hashtag'),{...row('fuku444','nb4f6934381e9',3,'final'),finalMarker:true}];
  const d={format:'mumei-thin-prepared-v1',batchId:'all-tag',count:3,hashtagArticleMode:'all',hashtagArticleKeys:rows.slice(0,2).map(r=>r.latestKey),rows};
  api.validate(d);
  const clone=()=>JSON.parse(JSON.stringify(d));
  const url=clone();url.rows[1].articleSource='todayYesterday';assert.throws(()=>api.validate(url),/重複/);
  const duplicate=clone();duplicate.rows[1]={...duplicate.rows[0],index:2};assert.throws(()=>api.validate(duplicate),/重複/);
  const missing=clone();missing.hashtagArticleKeys.pop();assert.throws(()=>api.validate(missing),/全記事/);
  const legacy=clone();delete legacy.hashtagArticleMode;assert.throws(()=>api.validate(legacy),/重複/);
});

test('実機と同じ200枚済み・旧0/40記録から再開し、署名取得429とネイティブ警告で停止、待機後308枚まで重複なく完了',async()=>{
  const e=sending(308);
  e.view.dispatch(e.view.state.tr.replaceWith(0,e.view.state.doc.content.size,new Doc(e.view.state.doc.nodes.slice(0,202)).content));
  e.dataset.preparedBatch=true;
  e.run.images=Object.fromEntries(Object.entries(e.run.images).slice(0,200));
  e.run.pending={workUrls:e.rows.slice(200,240).map(r=>r.url),beforeIds:Array.from({length:200},(_,i)=>'old'+i),at:1,stage:'uploading',runtime:'18.8.3'};
  e.rows.forEach((r,i)=>Object.assign(r,{urlname:'user',latestKey:r.url.split('/').at(-1),creator:'作者'+i,preparedBatchId:'test',creatorVerified:{urlname:'user',articleKey:r.url.split('/').at(-1),name:'作者'+i}}));
  e.storage.set('mumei_likers_thin_dataset_v160',JSON.stringify(e.dataset));e.storage.set('mumei_likers_thin_run_v160:'+key,JSON.stringify(e.run));
  e.page.File=File;e.page.Blob=Blob;e.page.DataTransfer=class{constructor(){this.list=[];this.items={add:f=>this.list.push(f)}}get files(){return this.list}};
  e.page.__MUMEI_PREPARED_BATCH__={image:async()=>new Blob(['png'],{type:'image/png'})};
  let requests=0,alertCount=0,active=0,maxActive=0;
  e.page.fetch=async()=>({status:++requests===3?429:200,statusText:'Too Many Requests',headers:{get:()=>requests===3?'120':null}});
  e.page.alert=()=>alertCount++;
  e.loadModule('note-card-creator-v1883.js','caption');
  const base=e.loadModule('note-likers-thin-notify-v160.js','insertThinImages,setView(v){viewCache=v;selectionCache={atEnd:()=>({})}},setNative(fn){preparedImageCommand=()=>fn}');base.setView(e.view);
  const attempted=[];
  base.setNative((view,files,pos)=>{
    assert.equal(files.length,1);const index=parseInt(files[0].name);attempted.push(index);active++;maxActive=Math.max(maxActive,active);
    const id='new'+index;view.dispatch(view.state.tr.insert(pos+1,new Node('image',{id,src:'blob:pending',link:''})));
    void(async()=>{
      const response=await e.page.fetch('https://note.com/api/v3/images/upload/presigned_post',{method:'POST',body:{entries:function*(){yield ['filename',files[0].name]}}});
      await new Promise(resolve=>e.page.setTimeout(resolve,1500));
      const hit=e.safety.tracked(view,{id});
      if(response.status===429){view.dispatch(view.state.tr.delete(hit.pos,hit.pos+hit.node.nodeSize));e.page.alert('画像のアップロードに失敗しました');}
      else view.dispatch(view.state.tr.setNodeMarkup(hit.pos,hit.node.type,{...hit.node.attrs,src:'https://assets.st-note.com/'+index+'.png'}));
      active--;
    })();return true;
  });
  await base.insertThinImages();
  assert.deepEqual(attempted,[201,202,203]);assert.equal(maxActive,1);assert.equal(alertCount,1);
  assert.equal(e.safety.index(e.view).images.length,202);
  assert.match(e.statuses.get('mumei-likers-thin-status-v160').textContent,/HTTP 429/);
  let run=JSON.parse(e.storage.get('mumei_likers_thin_run_v160:'+key));assert.equal(run.pending.stage,'failed');assert.ok(run.pending.retryAt>e.time());
  await base.insertThinImages();assert.equal(attempted.length,3);assert.match(e.statuses.get('mumei-likers-thin-status-v160').textContent,/HTTP 429/);
  await new Promise(resolve=>e.page.setTimeout(resolve,120000));
  assert.equal(e.safety.networkHold().code,429);e.safety.resumeNetwork();
  await base.insertThinImages();
  assert.equal(e.safety.index(e.view).images.length,308);assert.equal(attempted.length,109);assert.equal(maxActive,1);
  run=JSON.parse(e.storage.get('mumei_likers_thin_run_v160:'+key));assert.equal(Object.keys(run.images).length,308);assert.equal(run.pending,null);
  for(let i=0;i<308;i++){const hit=e.safety.tracked(e.view,run.images[e.rows[i].url]);assert.equal(hit.node.attrs.link,e.rows[i].url);assert.equal(hit.node.textContent,'作者'+i+'さん');}
  assert.match(e.encode(),/消さない本文/);assert.ok(e.view.state.doc.nodes.includes(e.existing));
  assert.match(e.statuses.get('mumei-likers-thin-status-v160').textContent,/308\/308 完成/);
});

test('HTTPエラーが見えない場合もネイティブ画像失敗警告を記録し30分待ちを終える',async()=>{
  const e=sending(1);let alerts=0;e.page.alert=()=>alerts++;
  const api=e.loadModule('note-likers-thin-notify-v160.js','waitNewRemoteImages,setArm(a){imageArm=a}');
  api.setArm({consumed:true,uploadStartedAt:e.time(),currentUploadStartedAt:e.time()});
  e.page.alert('画像のアップロードに失敗しました');
  const start=e.time(),result=await api.waitNewRemoteImages(e.view,new Set(['image0']),1,120000);
  assert.equal(alerts,1);assert.equal(result.failed,true);assert.equal(result.net.kind,'note-alert');assert.ok(e.time()-start<30000);
});

test('追加5名は完成200枚と旧40枚の投入記録を保持し、実績の直前にだけ追加する。再開2回でも313件',async()=>{
  const e=environment();e.loadModule('note-card-creator-v1883.js','caption');
  vm.runInContext(source('note-yoizora-additions-v1886.js'),e.ctx);
  const original=JSON.parse(source('note-yoizora-prepared-20260923.json'));
  const dataset={preparedBatch:true,datasetId:'keep-this-id',count:original.count,rows:original.rows.map(({pngBase64,...r})=>({...r,preparedBatchId:original.batchId}))};
  const run={datasetId:dataset.datasetId,images:Object.fromEntries(dataset.rows.slice(0,200).map(r=>[r.url,{id:'i'+r.index,src:'https://assets.st-note.com/'+r.index+'.png'}])),pending:{workUrls:dataset.rows.slice(200,240).map(r=>r.url),stage:'uploading'},cardKeys:[]};
  const runBefore=JSON.stringify(run),first307=JSON.stringify(dataset.rows.slice(0,307)),cached=new Map();
  e.page.crypto=(await import('node:crypto')).webcrypto;e.page.atob=atob;e.page.Response=Response;
  e.page.caches={open:async()=>({put:async(k,v)=>cached.set(k,v),match:async k=>cached.get(k)?.clone()})};
  const api=e.loadModule('note-prepared-batch-v1883.js','sync,withAdditions,image');
  assert.equal(api.withAdditions(original).count,313);assert.equal(await api.sync(dataset,run),5);
  assert.equal(dataset.count,313);assert.equal(dataset.datasetId,'keep-this-id');assert.equal(JSON.stringify(run),runBefore);assert.equal(JSON.stringify(dataset.rows.slice(0,307)),first307);
  assert.deepEqual(Array.from(dataset.rows.slice(-6),r=>r.urlname),['noah_woaks','star246','ann43tsukinomiya','ai_hana_yocchi','shirono_aru','fuku444']);
  assert.equal(dataset.rows[249].urlname,'sanraku01');assert.equal(dataset.rows[312].index,313);
  for(const r of dataset.rows.slice(-6,-1)){assert.ok((await api.image(r)).size>1000);assert.ok(!('pngBase64'in r));}
  assert.equal(await api.sync(dataset,run),0);assert.equal(dataset.count,313);assert.equal(cached.size,5);
  assert.equal(dataset.rows.filter(r=>r.articleSource==='hashtag').length,42);
});

test('実績の画像が先に完成済みでも追加画像をその前に入れ、最後の位置を守る',async()=>{
  const e=sending(3), keep=embed('embkeep',e.rows[2].url);e.run.cardKeys=[{key:'embkeep',url:e.rows[2].url}];e.view.dispatch(e.view.state.tr.replaceWith(0,e.view.state.doc.content.size,new Doc([new Node('paragraph',{},'本文'),image('final',e.rows[2].url),keep]).content));
  e.dataset.preparedBatch=true;e.run.images={[e.rows[2].url]:{id:'final',src:'https://assets.st-note.com/final.png'}};
  e.rows.forEach((r,i)=>Object.assign(r,{urlname:'user',latestKey:r.url.split('/').at(-1),creator:'作者'+i,preparedBatchId:'test',creatorVerified:{urlname:'user',articleKey:r.url.split('/').at(-1),name:'作者'+i}}));
  e.storage.set('mumei_likers_thin_dataset_v160',JSON.stringify(e.dataset));e.storage.set('mumei_likers_thin_run_v160:'+key,JSON.stringify(e.run));
  e.page.File=File;e.page.Blob=Blob;e.page.DataTransfer=class{constructor(){this.list=[];this.items={add:f=>this.list.push(f)}}get files(){return this.list}};
  e.page.__MUMEI_PREPARED_BATCH__={image:async()=>new Blob(['png'],{type:'image/png'})};e.loadModule('note-card-creator-v1883.js','caption');
  const api=e.loadModule('note-likers-thin-notify-v160.js','insertThinImages,setView(v){viewCache=v;selectionCache={atEnd:()=>({})}},setNative(fn){preparedImageCommand=()=>fn}');api.setView(e.view);
  api.setNative((view,files,pos)=>{const i=parseInt(files[0].name);view.dispatch(view.state.tr.insert(pos+1,image('new'+i)));return true;});
  await api.insertThinImages();assert.deepEqual(Array.from(e.safety.index(e.view).images,h=>h.node.attrs.link),e.rows.map(r=>r.url));assert.equal(e.safety.index(e.view).images.at(-1).node.attrs.id,'final');assert.equal(e.safety.index(e.view).embeds[0].node,keep);assert.equal(JSON.parse(e.storage.get('mumei_likers_thin_run_v160:'+key)).cardKeys[0].key,'embkeep');
});

test('note実APIの数値記事ID付きdraft_saveを認識し、Androidの正規保存関数で完了を確認する',async()=>{
  let e,requests=0,nativeCalls=0;
  const fetch=async(url,init)=>{requests++;return{status:200,clone:()=>({json:async()=>url.includes('/api/v3/notes/')?{data:{key,id:4321}}:{data:{updated_at:'2026-09-24T01:00:00+09:00'}}})}};
  e=environment({fetch});await e.page.fetch('https://note.com/api/v3/notes/'+key+'?draft=true');
  e.page.document.querySelectorAll=()=>[];
  e.page.noteEditor={registerNoteDraft:async mode=>{nativeCalls++;assert.equal(mode,'manual');
    // Native save may normalize the document before sending it.
    e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size,new Node('paragraph')));
    await e.page.fetch('https://note.com/api/v1/text_notes/draft_save?id=4321&is_temp_saved=true',{method:'POST',body:JSON.stringify({body:e.encode(),name:e.title.value})});
  }};
  assert.equal(await e.safety.save(e.view,'保存確認'),true);assert.equal(nativeCalls,1);assert.equal(requests,2);
});

test('XHRで読んだ現在の記事IDだけを保存先と認め、他記事・古い本文・業務エラーを成功扱いにしない',async()=>{
  class XHR {open(method,url){this.url=url}addEventListener(type,fn){this.done=fn}send(){this.status=200;this.responseText=JSON.stringify({data:{key,id:4321}});this.done?.()}}
  const e=environment({XMLHttpRequest:XHR});const xhr=new e.page.XMLHttpRequest();xhr.open('GET','https://note.com/api/v3/notes/'+key+'?draft=true');xhr.send();
  const body=JSON.stringify({body:e.encode(),name:e.title.value}),url='https://note.com/api/v1/text_notes/draft_save?id=';
  assert.equal(e.safety.requestStart('POST',url+'9999',body),null);
  assert.equal(e.safety.requestStart('POST',url+'4321',JSON.stringify({body:'古い本文',name:e.title.value})),null);
  e.button.click=()=>e.safety.requestEnd(e.safety.requestStart('POST',url+'4321',body),200,{data:{error:{message:'保存失敗'}}});
  await assert.rejects(e.safety.save(e.view,'保存確認'),/保存完了を確認できません/);
  e.button.click=()=>e.safety.requestEnd(e.safety.requestStart('POST',url+'4321',body),200,{data:{updated_at:'2026-09-24'}});
  assert.equal(await e.safety.save(e.view,'保存確認'),true);
});

test('開き直した直後の本文・タイトルが取得済みの下書きと一致すれば再保存を待たない',async()=>{
  let payload;
  const e=environment({fetch:async()=>({status:200,clone:()=>({json:async()=>payload})})});
  payload={data:{key,id:4321,body:e.encode(),name:e.title.value}};
  await e.page.fetch('https://note.com/api/v3/notes/'+key+'?draft=true');
  e.button.click=()=>assert.fail('保存済み本文を再保存しない');
  assert.equal(await e.safety.save(e.view,'保存確認'),true);
});

test('保存済み310画像のIDが再表示で変わっても通知カード全310件を作成し、画像と本文を保持する',async()=>{
  const e=sending(310);
  for(const hit of e.safety.index(e.view).images.slice().reverse()) e.view.dispatch(e.view.state.tr.setNodeMarkup(hit.pos,hit.node.type,{...hit.node.attrs,id:'reopened-'+hit.node.attrs.id}));
  await e.module.resumableSend();
  assert.equal(e.calls(),310);assert.equal(e.safety.index(e.view).images.length,310);assert.equal(e.safety.index(e.view).embeds.length,310);assert.match(e.encode(),/消さない本文/);
  assert.match(e.statuses.get('mumei-note-source-status-v163').textContent,/310\/310 完成・保存/);
});

test('再表示した同じ画像が複数ある場合は記事リンクまで照合し、曖昧なら再利用しない',()=>{
  const a=image('new1','https://note.com/a/n/n111111111111'),b=image('new2','https://note.com/b/n/n222222222222');b.attrs.src=a.attrs.src;
  const e=environment({nodes:[a,b]}),rec={id:'old',src:a.attrs.src};
  assert.equal(e.safety.tracked(e.view,rec),null);assert.equal(e.safety.tracked(e.view,rec,b.attrs.link).node,b);
  b.attrs.link=a.attrs.link;assert.equal(e.safety.tracked(e.view,rec,a.attrs.link),null);
});

test('送の前の検証エラーは状態ミラー後も具体的な理由を表示し、汎用の停止要求へ戻らない',async()=>{
  const e=sending(3),mirror=e.module;
  const guard=e.loadModule('note-link-guard-v178.js','hardenAllBeforeSend,setView(v){viewCache=v},failVerify(){forceRelink=async()=>{throw new Error("noteの保存完了を確認できません")}}');
  guard.setView(e.view);guard.failVerify();assert.equal(await guard.hardenAllBeforeSend(),false);
  mirror.syncBaseStatus();
  for(const id of ['mumei-note-source-status-v163','mumei-likers-thin-status-v160']){assert.match(e.statuses.get(id).textContent,/送信停止.*保存完了を確認できません/);assert.equal(e.statuses.get(id).dataset.bad,'1');}
});

test('保存ボタンが表示されないブラウザではnoteのCtrl+S処理を使い、API成功が来るまで保存済みにしない',async()=>{
  const e=environment({fetch:async()=>({status:200,clone:()=>({json:async()=>({data:{key,id:4321}})})})});
  await e.page.fetch('https://note.com/api/v3/notes/'+key+'?draft=true');e.page.document.querySelectorAll=()=>[];
  e.page.KeyboardEvent=class{constructor(type,init){this.type=type;Object.assign(this,init);this.defaultPrevented=false}preventDefault(){this.defaultPrevented=true}};
  let calls=0;e.page.dispatchEvent=event=>{assert.equal(event.key,'s');assert.equal(event.ctrlKey,true);calls++;event.preventDefault();
    e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size,new Node('paragraph')));
    const ticket=e.safety.requestStart('POST','https://note.com/api/v1/text_notes/draft_save?id=4321',JSON.stringify({body:e.encode(),name:e.title.value}));
    e.page.setTimeout(()=>e.safety.requestEnd(ticket,200,{data:{updated_at:'2026-09-24'}}),700);
  };
  assert.equal(await e.safety.save(e.view,'保存確認'),true);assert.equal(calls,1);
  const rejected=environment();rejected.page.document.querySelectorAll=()=>[];rejected.page.KeyboardEvent=e.page.KeyboardEvent;rejected.page.dispatchEvent=()=>{};
  await assert.rejects(rejected.safety.save(rejected.view,'保存確認'),/保存操作を開始できません/);
});

function directSending(count = 3, respond) {
  const e = sending(count), dom = new JSDOM('<body><div class="ProseMirror"></div></body>');
  e.page.document.createElement = dom.window.document.createElement.bind(dom.window.document);
  e.page.FormData = dom.window.FormData;
  e.page.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  e.view.dom = dom.window.document.querySelector('.ProseMirror');
  types.embed.create = attrs => new Node('embed', attrs);
  let hidden = false, message = true;
  const domNodes = new Map(), cache = new WeakMap();
  const render = () => {
    domNodes.clear(); const wanted = [];
    e.view.state.doc.forEach((node, pos) => {
      if (cache.has(node)) { const el = cache.get(node); wanted.push(el); domNodes.set(pos, el); return; }
      const el = dom.window.document.createElement(node.type.name === 'embed' ? 'figure' : 'p');
      if (node.type.name === 'embed') {
        el.setAttribute('embedded-content-key', node.attrs.embeddedContentKey); el.innerHTML = node.attrs.htmlForEmbed;
        const frame = el.querySelector('iframe');
        if (frame) frame.getBoundingClientRect = () => ({ width: 320, height: hidden ? 0 : Number(frame.getAttribute('height')) });
      } else el.textContent = node.textContent;
      cache.set(node, el); wanted.push(el); domNodes.set(pos, el);
    });
    const keep = new Set(wanted);
    for (const el of [...e.view.dom.children]) if (!keep.has(el)) el.remove();
    wanted.forEach((el, i) => { if (e.view.dom.children[i] !== el) e.view.dom.insertBefore(el, e.view.dom.children[i] || null); });
    if (message) for (const frame of e.view.dom.querySelectorAll('iframe')) e.page.dispatchEvent({ type: 'message', origin: 'https://note.com', source: frame.contentWindow, data: 'height::' + frame.getAttribute('src') + '::360' });
  };
  const dispatch = e.view.dispatch.bind(e.view); e.view.dispatch = tr => { dispatch(tr); render(); }; e.view.nodeDOM = pos => domNodes.get(pos); render();
  vm.runInContext(source('note-card-visible-v18814.js'), e.ctx);
  const calls = [];
  const api = async form => { // note native client: /v1/embed
    const fields = Object.fromEntries(form.entries()); calls.push(fields);
    if (respond) return respond(fields, calls.length);
    const id = fields.url.split('/').pop();
    return { embeddedContent: { key: 'embdirect' + calls.length, service: 'note', identifier: id, htmlForEmbed: `<iframe class="note-embed" src="https://note.com/embed/notes/${id}" height="360"></iframe>` } };
  };
  e.module.setCommand(e.page.__MUMEI_CARD_VISIBLE__.factory(id => { assert.equal(id, 13550); return { MI: api }; }));
  return { ...e, directCalls: calls, render, hidden: value => { hidden = value; }, message: value => { message = value; }, dom, close: () => dom.window.close() };
}
test('18.8.16: native save can replace block IDs while an embed request is pending', async () => {
  let e;
  e = directSending(3, (fields, n) => {
    changeOnlyIds(e);
    const id = fields.url.split('/').pop();
    return { embeddedContent: { key: 'embids' + n, service: 'note', identifier: id, htmlForEmbed: `<iframe class="note-embed" src="https://note.com/embed/notes/${id}" height="360"></iframe>` } };
  });
  try {
    await e.module.resumableSend();
    const run = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
    assert.equal(run.stage, 'cards_ready', e.statuses.get('mumei-note-source-status-v163').textContent);
    assert.equal(e.directCalls.length, 3); assert.equal(run.cardAudit.savedCards, 3);
    assert.equal(e.safety.index(e.view).images.length, 3);
    assert.ok(e.view.state.doc.nodes.some(n => n.textContent === e.existing.textContent));
  } finally { e.close(); }
});
test('18.8.16: completed-image controls show continuation/deletion without reset or image reupload', () => {
  const dom = new JSDOM(`<body><div id="mumei-note-source-picker-v163"><div class="mumei-prince-special-v184"><div>設定</div><textarea data-source></textarea><div class="choices">選択</div><input data-count><button data-start>開始</button><div id="mumei-prepared-load"><button>宵空セット</button><button>データ読込</button><button data-prepared-additions>追加分</button></div></div><div class="actions"><button data-a="send">送</button><button data-a="delete">削</button></div><div data-card-safety><button data-safe="stop">停止</button><button data-safe="backup">本文の控え</button><button data-safe="audit">全件確認</button></div><div id="mumei-note-source-status-v163" data-bad="1">エラーの詳しい内容</div></div></body>`, {url:'https://editor.note.com/notes/'+key+'/edit',runScripts:'outside-only'});
  const w = dom.window, d = w.document;
  w.setInterval = () => 1; w.clearInterval = () => {};
  w.localStorage.setItem('mumei_likers_thin_dataset_v160', JSON.stringify({datasetId:'test',count:2,preparedBatch:true}));
  w.localStorage.setItem('mumei_likers_thin_run_v160:'+key, JSON.stringify({datasetId:'test',images:{a:{},b:{}},cardKeys:[]}));
  w.__MUMEI_PREPARED_BATCH__={missingAdditions:()=>[]};
  try {
    w.eval(source('note-generic-controls-v189.js').replace(/\}\)\(\);\s*$/, 'page.__testControls = updateControls;})();'));
    const panel=d.getElementById('mumei-note-source-picker-v163');w.__testControls(panel);
    const display=s=>w.getComputedStyle(d.querySelector(s)).display;
    assert.equal(display('[data-g="image"]'),'none'); assert.equal(display('[data-g="reset"]'),'none');
    assert.equal(display('[data-source]'),'none'); assert.equal(display('[data-start]'),'none');
    assert.notEqual(display('[data-safe="backup"]'),'none'); assert.equal(display('[data-prepared-additions]'),'none');
    for(const s of ['[data-g="send"]','[data-g="delete"]','[data-safe="stop"]','[data-safe="audit"]'])assert.notEqual(display(s),'none');
    assert.equal(w.getComputedStyle(d.querySelector('[data-bad]')).maxHeight,'none');
    d.querySelector('[data-bad]').dataset.bad='0';w.__testControls(panel);assert.equal(display('[data-safe="backup"]'),'none');
    w.__MUMEI_CARD_SAFETY__={networkHold:()=>({code:403})};w.__testControls(panel);assert.notEqual(display('[data-safe="backup"]'),'none');
    let sends=0,deletes=0;d.querySelector('[data-a="send"]').onclick=()=>sends++;d.querySelector('[data-a="delete"]').onclick=()=>deletes++;
    d.querySelector('[data-g="send"]').click();d.querySelector('[data-g="delete"]').click();assert.equal(sends,1);assert.equal(deletes,1);
    w.__MUMEI_PREPARED_BATCH__.missingAdditions=()=>[{}];w.__testControls(panel);assert.equal(display('[data-prepared-additions]'),'none');assert.equal(d.querySelector('[data-g="send"]').textContent,'追加＋カード続き');
    w.localStorage.removeItem('mumei_likers_thin_run_v160:'+key);w.__testControls(panel);
    assert.notEqual(display('[data-start]'),'none');assert.notEqual(display('[data-g="image"]'),'none');
  } finally {w.close();}
});
test('18.8.16: a changed work URL is retained and never replaced by a late embed response', async () => {
  let e;
  e = directSending(1, (fields) => {
    changeOnlyIds(e);
    let hit; e.view.state.doc.forEach((node, pos) => { if (node.textContent === fields.url) hit = {node,pos}; });
    e.view.dispatch(e.view.state.tr.replaceWith(hit.pos, hit.pos + hit.node.nodeSize, new Node('paragraph', {}, 'ユーザーが編集した本文')));
    const id = fields.url.split('/').pop();
    return { embeddedContent: { key: 'embunsafe', service: 'note', identifier: id, htmlForEmbed: `<iframe class="note-embed" src="https://note.com/embed/notes/${id}" height="360"></iframe>` } };
  });
  try {
    await e.module.resumableSend();
    assert.equal(e.safety.index(e.view).embeds.length, 0);
    assert.match(e.encode(), /ユーザーが編集した本文/);
    assert.equal(e.safety.index(e.view).images.length, 1);
    assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /作業用URLが変更/);
  } finally { e.close(); }
});
test('18.8.16: a late API response after timeout cannot edit the stopped draft', async () => {
  let reply;
  const e = directSending(1, () => new Promise(resolve => { reply = resolve; }));
  try {
    await e.module.resumableSend();
    const before = e.encode();
    const run = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
    assert.equal(run.stage, 'cards_paused'); assert.ok(run.pendingCard);
    const id = e.rows[0].url.split('/').pop();
    reply({ embeddedContent: { key: 'emblatetimeout', service: 'note', identifier: id, htmlForEmbed: `<iframe class="note-embed" src="https://note.com/embed/notes/${id}" height="360"></iframe>` } });
    for (let i = 0; i < 15; i++) await Promise.resolve();
    assert.equal(e.encode(), before); assert.equal(e.directCalls.length, 1);
    assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /自動再開はしません/);
  } finally { e.close(); }
});
test('18.8.16: existing cards are saved before resume display verification can time out', async () => {
  const e = directSending(2);
  try {
    await e.module.resumableSend();
    e.view.dispatch(e.view.state.tr.insert(0, new Node('paragraph', {}, '保存が必要な追記')));
    e.hidden(true); await e.module.resumableSend();
    assert.match(e.savedDraft().body, /保存が必要な追記/);
    const run = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
    assert.equal(run.stage, 'cards_paused'); assert.equal(run.savedCardCount, 2);
    assert.equal(e.directCalls.length, 2); assert.equal(e.safety.index(e.view).images.length, 2);
  } finally { e.close(); }
});
test('18.8.16: official registration targets the current article; all 313 visible cards are inserted and bulk deleted with images/body intact', async () => {
  const e = directSending(313);
  try {
    const original = e.view.state.doc.nodes.slice();
    const keep = embed('emboriginal', e.rows[0].url); e.view.dispatch(e.view.state.tr.insert(0, keep));
    await e.module.resumableSend();
    assert.equal(e.directCalls.length, 313, e.statuses.get('mumei-note-source-status-v163').textContent);
    assert.ok(e.directCalls.every(f => f.height === '360' && f.embeddable_type === 'Note' && f.embeddable_key === key));
    let run = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
    assert.equal(run.cardAudit.displayed, 313); assert.equal(run.stage, 'cards_ready');
    assert.equal(e.safety.index(e.view).embeds.length, e.rows.length + 1);
    await e.module.deleteCardsOnly();
    assert.deepEqual(Array.from(e.safety.index(e.view).embeds, h => h.node), [keep]);
    assert.equal(e.safety.index(e.view).images.length, 313);
    for (const n of original) assert.ok(e.view.state.doc.nodes.includes(n));
    assert.equal(JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key)).stage, 'cards_deleted');
  } finally { e.close(); }
});
test('18.8.14: invisible DOM never advances the counter; pending card resumes without duplicate registration', async () => {
  const e = directSending(2);
  try {
    e.hidden(true); await e.module.resumableSend();
    let run = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
    assert.equal(run.cardKeys.length, 0); assert.ok(run.pendingCard); assert.equal(e.directCalls.length, 1);
    assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /本文表示を確認できません/);
    e.hidden(false); await e.module.resumableSend();
    run = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key));
    assert.equal(e.directCalls.length, 2); assert.equal(run.stage, 'cards_ready'); assert.equal(run.cardKeys.length, 2);
  } finally { e.close(); }
});
test('18.8.14: an empty iframe box or another frame height message never counts as a displayed card', async () => {
  const e = directSending(1);
  try {
    e.message(false);
    e.page.dispatchEvent({ type: 'message', origin: 'https://note.com', source: {}, data: 'height::https://note.com/embed/notes/n000000000000::360' });
    await e.module.resumableSend();
    assert.equal(JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key)).cardKeys.length, 0);
    const frame = e.view.dom.querySelector('iframe');
    e.page.dispatchEvent({ type: 'message', origin: 'https://example.com', source: frame.contentWindow, data: 'height::x::360' });
    e.page.dispatchEvent({ type: 'message', origin: 'https://note.com', source: frame.contentWindow, data: 'height::x::0' });
    assert.equal(e.page.__MUMEI_CARD_VISIBLE__.inspect(e.view, e.safety.index(e.view).embeds[0], e.rows[0].url), false);
    e.message(true); e.render(); await e.module.resumableSend();
    assert.equal(e.directCalls.length, 1); assert.equal(JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key)).stage, 'cards_ready');
  } finally { e.close(); }
});
test('18.8.14: bulk deletion includes an unrecorded pending card and preserves the original identical URL', async () => {
  const e = directSending(1);
  try {
    e.hidden(true); await e.module.resumableSend();
    assert.equal(e.safety.index(e.view).embeds.length, 1);
    await e.module.deleteCardsOnly();
    assert.equal(e.safety.index(e.view).embeds.length, 0); assert.ok(e.view.state.doc.nodes.includes(e.existing)); assert.equal(e.safety.index(e.view).images.length, 1);
    assert.equal(JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key)).pendingCard, null);
  } finally { e.close(); }
});
test('18.8.14: deletion cancels a late official response, clears only the work URL and keeps the original URL', async () => {
  let reply; const e = directSending(1, () => new Promise(resolve => { reply = resolve; }));
  try {
    await e.module.resumableSend(); assert.equal(e.directCalls.length, 1);
    await e.module.deleteCardsOnly();
    reply({ embeddedContent: { key: 'emblate', service: 'note', identifier: 'n000000000000', htmlForEmbed: '<iframe class="note-embed" src="https://note.com/embed/notes/n000000000000" height="360"></iframe>' } });
    for (let i = 0; i < 12; i++) await Promise.resolve();
    assert.equal(e.safety.index(e.view).embeds.length, 0);
    assert.equal(e.view.state.doc.nodes.filter(n => n.textContent === e.rows[0].url).length, 1); assert.ok(e.view.state.doc.nodes.includes(e.existing));
  } finally { e.close(); }
});
test('18.8.14: wrong official response is rejected without changing body/images', async () => {
  const e = directSending(1, () => ({ embeddedContent: { key: 'embwrong', service: 'note', identifier: 'naaaaaaaaaaaa' } }));
  try {
    await e.module.resumableSend(); assert.equal(e.safety.index(e.view).embeds.length, 0); assert.equal(e.safety.index(e.view).images.length, 1); assert.ok(e.view.state.doc.nodes.includes(e.existing));
    assert.match(e.statuses.get('mumei-note-source-status-v163').textContent, /公式カード応答/);
  } finally { e.close(); }
});
test('18.8.14: repair a zero-height owned card in place, without replacing its official embed key', async () => {
  const e = directSending(1);
  try {
    const n = new Node('embed', { src: e.rows[0].url, embeddedContentKey: 'embzero', htmlForEmbed: '<iframe class="note-embed" src="https://note.com/embed/notes/n000000000000" height="0" style="height:0px"></iframe>' });
    e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size, n));
    const run = JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key)); run.cardKeys = [{ key: 'embzero', url: e.rows[0].url }]; e.storage.set('mumei_likers_thin_run_v160:' + key, JSON.stringify(run));
    await e.module.resumableSend();
    assert.equal(e.directCalls.length, 0); assert.equal(e.safety.index(e.view).embeds.length, 1);
    assert.equal(JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key)).stage, 'cards_ready');
    assert.match(e.safety.index(e.view).embeds[0].node.attrs.htmlForEmbed, /height="360"/);
  } finally { e.close(); }
});
test('18.8.14: deletion retains recovery records when the saved draft still has cards, then retries without harming images', async () => {
  const e = sending(2); await e.module.resumableSend(); const saved = e.savedDraft();
  e.safety.readDraft = async () => ({ matches: false, doc: e.view.state.schema.nodeFromJSON(JSON.parse(saved.body)) });
  await e.module.deleteCardsOnly();
  assert.equal(JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key)).cardKeys.length, 2);
  assert.equal(e.safety.index(e.view).embeds.length, 0); assert.equal(e.safety.index(e.view).images.length, 2);
  e.safety.readDraft = async () => ({ matches: true, doc: e.view.state.doc });
  await e.module.deleteCardsOnly(); assert.equal(JSON.parse(e.storage.get('mumei_likers_thin_run_v160:' + key)).stage, 'cards_deleted');
});

test('18.8.15: HTML 403 stops draft reads after one request and survives reload without losing the body', async () => {
  const e = environment(); let reads = 0, parses = 0, clicks = 0;
  const before = e.encode(); const token = e.safety.begin('送', e.view);
  e.button.click = () => clicks++;
  e.page.fetch = async () => { reads++; return { status: 403, json: async () => { parses++; throw new SyntaxError('HTML'); } }; };
  await assert.rejects(e.safety.save(e.view, '保存確認'), /HTTP 403/);
  assert.equal(reads, 1); assert.equal(parses, 0); assert.equal(clicks, 1);
  assert.equal(e.encode(), before); assert.ok(e.safety.backups().length);
  e.safety.end(token);
  const reopened = environment({ storage: e.storage });
  assert.ok(reopened.safety.stopped());
  await assert.rejects(reopened.safety.readDraft(reopened.view), /HTTP 403/);
  assert.throws(() => reopened.safety.begin('削除', reopened.view), /HTTP 403/);
  reopened.safety.resumeNetwork();
  assert.ok(reopened.safety.stopped(), 'manual release must not start background work');
  assert.equal(reopened.safety.networkHold(), null);
});
test('18.8.15: Retry-After cannot be released early, while backups remain available', async () => {
  const e = environment(); e.safety.observeHttp(429, '120');
  assert.throws(() => e.safety.resumeNetwork(), /120秒以上/);
  e.safety.capture(); assert.ok(e.safety.backups().length);
  await new Promise(resolve => e.page.setTimeout(resolve, 120000));
  e.safety.resumeNetwork(); assert.equal(e.safety.networkHold(), null);
});
test('18.8.15: native save HTML denial stops before draft polling and unrelated responses are untouched', async () => {
  let e, reads = 0;
  const response = () => ({status:403,headers:{get:()=>null},clone:()=>({json:async()=>{throw new SyntaxError('HTML')}})});
  e = environment({fetch:async()=>{reads++; return response();}});
  await e.page.fetch('https://note.com/api/unrelated'); assert.equal(e.safety.networkHold(), null);
  e.button.click = () => { void e.page.fetch('https://note.com/api/v1/text_notes/'+key,{method:'PUT',body:JSON.stringify({body:e.encode()})}); };
  const token = e.safety.begin('送',e.view);
  await assert.rejects(e.safety.save(e.view,'保存確認'),/HTTP 403/);
  e.safety.end(token); assert.equal(reads,2);
});
test('18.8.15: embed denial preserves one pending URL, never retries, and never counts completion', async () => {
  const e = directSending(2, () => { const err = new Error('denied'); err.response={status:403}; throw err; });
  try {
    const before = e.view.state.doc.nodes.slice();
    await e.module.resumableSend(); await e.module.resumableSend();
    const run=JSON.parse(e.storage.get('mumei_likers_thin_run_v160:'+key));
    assert.equal(e.directCalls.length,1); assert.equal(run.cardKeys.length,0); assert.ok(run.pendingCard);
    assert.match(e.statuses.get('mumei-note-source-status-v163').textContent,/HTTP 403/);
    for(const node of before) assert.ok(e.view.state.doc.nodes.includes(node));
  } finally { e.close(); }
});
test('18.8.15: missing iframe display proof causes zero automatic reloads', async () => {
  const e=directSending(1); let reloads=0;
  const original=e.dom.window.Element.prototype.setAttribute;
  e.dom.window.Element.prototype.setAttribute=function(name,value){if(this.tagName==='IFRAME'&&name==='src')reloads++;return original.call(this,name,value)};
  try { e.message(false);await e.module.resumableSend();assert.equal(reloads,0);assert.equal(e.directCalls.length,1);assert.equal(JSON.parse(e.storage.get('mumei_likers_thin_run_v160:'+key)).cardKeys.length,0); }
  finally { e.dom.window.Element.prototype.setAttribute=original;e.close(); }
});
test('18.8.15: backup export and close remain visible and usable during save/403 with hostile page button styles', async () => {
  const e=environment(), dom=new JSDOM('<style>button{color:transparent!important;background:transparent!important;display:none!important;font-size:0!important}</style><body></body>');
  const d=dom.window.document;
  e.page.document.body=d.body;e.page.document.createElement=d.createElement.bind(d);e.page.document.getElementById=d.getElementById.bind(d);
  e.page.Blob=Blob;let exported=null,downloads=0;
  e.page.URL={createObjectURL:blob=>{exported=blob;return 'blob:backup'},revokeObjectURL(){}};
  dom.window.HTMLAnchorElement.prototype.click=function(){downloads++;assert.match(this.download,/backup.json$/)};
  try {
    const token=e.safety.begin('送',e.view);e.safety.observeHttp(403);e.safety.showBackups();
    const box=d.querySelector('[role="dialog"]');assert.ok(box);
    for(const b of box.querySelectorAll('button')){const css=dom.window.getComputedStyle(b);assert.equal(b.type,'button');assert.notEqual(css.display,'none');assert.equal(css.color,'rgb(255, 255, 255)');}
    [...box.querySelectorAll('button')].find(b=>b.textContent==='現在の本文を書き出す').click();
    assert.equal(downloads,1);assert.equal(JSON.stringify(JSON.parse(await exported.text()).doc),e.encode());
    [...box.querySelectorAll('button')].find(b=>b.textContent==='閉じる').click();assert.equal(d.getElementById('mumei-card-backups'),null);
    assert.ok(e.safety.busy());e.safety.end(token);
  } finally {dom.window.close();}
});
test('18.8.16: two additions invalidate a completed run while keeping its cards, image records and pending work', async () => {
  const e=environment();e.loadModule('note-card-creator-v1883.js','caption');vm.runInContext(source('note-yoizora-additions-v1886.js'),e.ctx);
  const base=JSON.parse(source('note-yoizora-prepared-20260923.json')), patches=e.page.__MUMEI_YOIZORA_ADDITIONS__.rows;
  const rows=[...base.rows.slice(0,-1),...patches.slice(0,3),base.rows.at(-1)].map(({pngBase64,...r},i)=>({...r,index:i+1,preparedBatchId:base.batchId}));
  const dataset={preparedBatch:true,datasetId:'same',count:311,rows};
  const run={datasetId:'same',stage:'cards_ready',cardKeys:rows.map((r,i)=>({url:r.url,key:'emb'+i})),images:Object.fromEntries(rows.map(r=>[r.url,{id:'img'+r.index,src:'https://assets.st-note.com/'+r.index+'.png'}])),pendingCard:{url:rows[0].url,beforeKeys:[]},cardAudit:{complete:true},savedCardCount:311};
  const records=JSON.stringify([run.cardKeys,run.images,run.pendingCard]);
  e.page.crypto=(await import('node:crypto')).webcrypto;e.page.atob=atob;e.page.Response=Response;e.page.caches={open:async()=>({put:async()=>{}})};
  const api=e.loadModule('note-prepared-batch-v1883.js','sync,requireCurrent');
  assert.throws(()=>api.requireCurrent(dataset),/はな・しろのある/);assert.equal(await api.sync(dataset,run),2);
  assert.equal(dataset.count,313);assert.equal(dataset.rows.at(-3).urlname,'ai_hana_yocchi');assert.equal(dataset.rows.at(-2).urlname,'shirono_aru');assert.equal(dataset.rows.at(-1).urlname,'fuku444');
  assert.equal(JSON.stringify([run.cardKeys,run.images,run.pendingCard]),records);assert.equal(run.stage,'cards_paused');assert.equal(run.cardAudit,null);assert.equal(run.savedCardCount,0);
  assert.doesNotThrow(()=>api.requireCurrent(dataset));assert.equal(await api.sync(dataset,run),0);
});
test('18.8.15: CORS/offline failures stop after one read without falsely reporting an HTTP code', async () => {
  const e=environment();let requests=0;e.page.fetch=async()=>{requests++;throw new TypeError('Failed to fetch')};
  await assert.rejects(e.safety.save(e.view,'保存確認'),/HTTPの状態は確認できません/);
  assert.equal(requests,1);assert.equal(e.safety.networkHold().code,0);assert.ok(e.safety.backups().length);
});
test('18.8.15: adding a card to a completed set preserves old keys, puts the addition before the final card, and bulk removes all owned cards', async () => {
  const e=directSending(2);
  try {
    await e.module.resumableSend();
    const run=JSON.parse(e.storage.get('mumei_likers_thin_run_v160:'+key)), old=run.cardKeys.map(x=>x.key);
    const row={url:'https://note.com/new/n/nfffffffffffe',index:2}, img=image('added',row.url);
    const lastImage=e.safety.index(e.view).images.at(-1);e.view.dispatch(e.view.state.tr.insert(lastImage.pos,img));
    run.images[row.url]={id:'added',src:img.attrs.src};
    e.dataset.rows.splice(1,0,row);e.dataset.count=3;e.dataset.rows[2].index=3;
    e.storage.set('mumei_likers_thin_dataset_v160',JSON.stringify(e.dataset));e.storage.set('mumei_likers_thin_run_v160:'+key,JSON.stringify(run));
    await e.module.resumableSend();
    const after=JSON.parse(e.storage.get('mumei_likers_thin_run_v160:'+key));
    assert.equal(e.directCalls.length,3);assert.equal(after.stage,'cards_ready',e.statuses.get('mumei-note-source-status-v163').textContent);
    assert.deepEqual(after.cardKeys.map(x=>x.key),[old[0],'embdirect3',old[1]]);
    assert.deepEqual(Array.from(e.safety.index(e.view).embeds,h=>h.node.attrs.src),e.dataset.rows.map(r=>r.url));
    await e.module.deleteCardsOnly();assert.equal(e.safety.index(e.view).embeds.length,0);assert.equal(e.safety.index(e.view).images.length,3);assert.match(e.encode(),/消さない本文/);
  } finally {e.close();}
});

test('18.8.17: one action adds missing images, verifies saved links, then resumes cards; failure never enters card work', async () => {
  for (const fail of [false,true]) {
    const e=sending(3);
    e.dataset.preparedBatch=true;
    const keptCard=embed('embkept',e.rows[0].url);e.view.dispatch(e.view.state.tr.insert(e.view.state.doc.content.size,keptCard));
    e.run.cardKeys=[{key:'embkept',url:e.rows[0].url}];
    e.rows.forEach((r,i)=>Object.assign(r,{urlname:'user',latestKey:r.url.split('/').at(-1),creator:'作者'+i,preparedBatchId:'test',creatorVerified:{urlname:'user',articleKey:r.url.split('/').at(-1),name:'作者'+i}}));
    const missing=e.safety.tracked(e.view,e.run.images[e.rows[2].url]);e.view.dispatch(e.view.state.tr.delete(missing.pos,missing.pos+missing.node.nodeSize));delete e.run.images[e.rows[2].url];
    e.storage.set('mumei_likers_thin_dataset_v160',JSON.stringify(e.dataset));e.storage.set('mumei_likers_thin_run_v160:'+key,JSON.stringify(e.run));
    e.page.File=File;e.page.Blob=Blob;e.page.DataTransfer=class{constructor(){this.list=[];this.items={add:f=>this.list.push(f)}}get files(){return this.list}};
    e.page.__MUMEI_PREPARED_BATCH__={image:async()=>new Blob(['png'],{type:'image/png'}),missingAdditions:()=>[]};
    e.loadModule('note-card-creator-v1883.js','caption');
    const images=e.loadModule('note-likers-thin-notify-v160.js','insertThinImages,beginUploadRequest,endUploadRequest,setView(v){viewCache=v;selectionCache={atEnd:()=>({})}},setNative(fn){preparedImageCommand=()=>fn}');images.setView(e.view);
    let uploads=0;
    images.setNative((view,files,pos)=>{
      uploads++;assert.equal(files.length,1);
      if(fail){const t=images.beginUploadRequest(files[0],'https://note.com/api/v3/images/upload/presigned_post');images.endUploadRequest(t,403,'Forbidden');}
      else view.dispatch(view.state.tr.insert(pos+1,image('new3')));
      return true;
    });
    const guard=e.loadModule('note-link-guard-v178.js','hardenAllBeforeSend,setView(v){viewCache=v},setUrls(fn){htmlLinkedUrls=fn}');guard.setView(e.view);
    guard.setUrls(()=>new Set(e.safety.index(e.view).images.map(h=>h.node.attrs.link)));
    e.safety.setSerializer(v=>JSON.stringify(v.state.doc.toJSON()));e.safety.setDraftParser(n=>e.view.state.schema.nodeFromJSON(JSON.parse(n.body)));
    const beforeText=e.existing.textContent;
    const ok=await guard.hardenAllBeforeSend();assert.equal(ok,!fail,e.statuses.get('mumei-note-source-status-v163').textContent);assert.equal(uploads,1);
    if(ok){await e.module.resumableSend();assert.equal(e.calls(),2);assert.equal(JSON.parse(e.storage.get('mumei_likers_thin_run_v160:'+key)).stage,'cards_ready');}
    else {assert.equal(e.calls(),0);assert.equal(e.safety.networkHold().code,403);assert.match(e.statuses.get('mumei-note-source-status-v163').textContent,/画像受付 note.com：HTTP 403/);assert.doesNotMatch(e.statuses.get('mumei-note-source-status-v163').textContent,/「画」/);assert.equal(await guard.hardenAllBeforeSend(),false);assert.equal(uploads,1);}
    assert.equal(e.safety.index(e.view).images.length,fail?2:3);assert.ok(e.view.state.doc.nodes.some(n=>n.textContent===beforeText));
    assert.ok(e.safety.index(e.view).embeds.some(h=>h.node===keptCard));assert.ok(JSON.parse(e.storage.get('mumei_likers_thin_run_v160:'+key)).cardKeys.some(r=>r.key==='embkept'));
  }
});

test('18.8.17: combined action awaits addition success, rejects target changes, and serializes repeated clicks', async () => {
  const e=sending(1);e.dataset.preparedBatch=true;e.storage.set('mumei_likers_thin_dataset_v160',JSON.stringify(e.dataset));
  e.page.__MUMEI_PREPARED_BATCH__={missingAdditions:()=>[{}]};let resolve,calls=0,links=0;
  e.page.__MUMEI_THIN_IMAGES__={run:()=>{calls++;return new Promise(r=>{resolve=r})}};
  const guard=e.loadModule('note-link-guard-v178.js','hardenAllBeforeSend,setView(v){viewCache=v},countLinks(fn){forceRelink=fn}');guard.setView(e.view);guard.countLinks(async()=>{links++});
  const job=guard.hardenAllBeforeSend();assert.equal(await guard.hardenAllBeforeSend(),false);assert.equal(calls,1);assert.equal(links,0);
  e.storage.set('mumei_likers_thin_dataset_v160',JSON.stringify({...e.dataset,datasetId:'changed'}));resolve(true);assert.equal(await job,false);assert.equal(links,0);
  assert.match(e.statuses.get('mumei-note-source-status-v163').textContent,/対象が変わった/);
});

test('18.8.18: status-zero is provisional until the editor confirms image failure', () => {
  const e=sending(1);const api=e.loadModule('note-likers-thin-notify-v160.js','uploadFailureText,beginUploadRequest,endUploadRequest,recentNetFailure,confirmUnknownNetworkFailure,setArm(a){imageArm=a}');api.setArm({consumed:true});
  const ticket=api.beginUploadRequest({type:'image/png'},'https://uploads.example.com/image?secret=must-not-show');api.endUploadRequest(ticket,0,'Failed to fetch');
  const failure=api.recentNetFailure(0),text=api.uploadFailureText(failure);
  assert.equal(failure.url,'https://uploads.example.com/image');assert.equal(e.safety.networkHold(),null);assert.match(text,/画像送信 uploads.example.com：応答なし/);assert.doesNotMatch(text,/403|secret|must-not-show/);
  assert.equal(api.confirmUnknownNetworkFailure(failure),true);assert.equal(e.safety.networkHold().code,0);
});

test('18.8.20: prepared addition can recover from a confirmed status-zero hold using the hosted HTTPS copy', async () => {
  const e=sending(3);
  e.dataset.preparedBatch=true;
  e.rows.forEach((row,i)=>{
    row.urlname='user'; row.latestKey=row.url.split('/').at(-1); row.creator='作者'+i;
    row.preparedBatchId='yoizora-20260923-tag42';
    row.creatorVerified={articleKey:row.latestKey,urlname:'user',name:row.creator};
    row.caption=row.creator+'さん';
  });
  e.rows[0].pngSha256='0e7521e07ef776dcb6254b458687d234612b12ec550208a6d67044cf8e148ee0';
  const first=e.safety.tracked(e.view,e.run.images[e.rows[0].url],e.rows[0].url);
  e.view.dispatch(e.view.state.tr.delete(first.pos,first.pos+first.node.nodeSize));
  delete e.run.images[e.rows[0].url];
  e.storage.set('mumei_likers_thin_dataset_v160',JSON.stringify(e.dataset));
  e.storage.set('mumei_likers_thin_run_v160:'+key,JSON.stringify(e.run));
  e.page.__MUMEI_PREPARED_BATCH__={sync:async()=>0};
  e.loadModule('note-card-creator-v1883.js','caption,verifyRows,apply');
  const api=e.loadModule('note-likers-thin-notify-v160.js','insertThinImages,setView(v){viewCache=v;selectionCache={atEnd:()=>({})}}');
  api.setView(e.view);
  e.safety.observeHttp(0,'');
  const protectedText=e.existing.textContent;
  assert.equal(await api.insertThinImages(),true,e.statuses.get('mumei-likers-thin-status-v160').textContent);
  const run=JSON.parse(e.storage.get('mumei_likers_thin_run_v160:'+key));
  assert.equal(Object.keys(run.images).length,3);
  const restored=e.safety.tracked(e.view,run.images[e.rows[0].url],e.rows[0].url);
  assert.match(restored.node.attrs.src,/card-fallback-18820\/0e7521e07ef776dcb6254b458687d234612b12ec550208a6d67044cf8e148ee0\.png$/);
  assert.equal(restored.node.attrs.link,e.rows[0].url);
  assert.equal(restored.node.textContent,e.rows[0].caption);
  assert.equal(e.safety.networkHold(),null);
  assert.ok(e.view.state.doc.nodes.some(n=>n.textContent===protectedText));
  assert.equal(e.safety.index(e.view).images.length,3);
});

test('18.8.17: whole bundle initializes once and detects older components without erasing existing state', () => {
  const page={calls:0};page.window=page;const ctx=vm.createContext(page);
  const code=wrapModules('page.calls++;page.__MUMEI_CARD_VISIBLE__={};page.__MUMEI_THIN_IMAGES__={};');
  vm.runInContext(code,ctx);vm.runInContext(code,ctx);assert.equal(page.calls,1);assert.doesNotThrow(()=>page.__MUMEI_CARD_RUNTIME__.verify());
  page.__MUMEI_CARD_VISIBLE__={old:true};assert.throws(()=>page.__MUMEI_CARD_RUNTIME__.verify(),/複数版/);
  let stopped=0,notice='';const old={window:null,calls:0,__MUMEI_CARD_SAFETY__:{stop(){stopped++},status(s){notice=s}},saved:'keep'};old.window=old;
  vm.runInContext(code,vm.createContext(old));assert.equal(old.calls,0);assert.equal(old.saved,'keep');assert.equal(stopped,1);assert.match(notice,/旧版/);
});
