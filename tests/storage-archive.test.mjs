import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync('src/insight-browser-storage.ts', 'utf8').replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const cacheKey = 'mumei-insight-data-cache-v1:ss_yr:likes';
const cacheValue = 'saved-history'.repeat(120);

// The test backend models commit/abort boundaries and survives a new page realm.
function database(records = new Map(), options = {}) {
  return { records, open() {
    const request = {};
    queueMicrotask(() => {
      request.result = {
        objectStoreNames: { contains: () => true }, close() {},
        transaction(_name, mode) {
          const tx = {}, operations = []; let scheduled = false;
          function schedule(request, result) {
            if (scheduled) return; scheduled = true;
            queueMicrotask(() => {
              if (mode === 'readwrite' && options.failWrite) { tx.error = new Error('commit rejected'); tx.onabort?.(); return; }
              options.beforeCommit?.(mode);
              for (const operation of operations) operation();
              if (request) { request.result = result; request.onsuccess?.(); }
              tx.oncomplete?.();
            });
          }
          tx.objectStore = () => ({
            getAll() { const request = {}; schedule(request, [...records.values()].map(row => ({ ...row }))); return request; },
            put(row) { operations.push(() => records.set(row.key, { ...row })); schedule(); },
            delete(key) { operations.push(() => records.delete(key)); schedule(); },
            clear() { operations.push(() => records.clear()); schedule(); }
          });
          return tx;
        }
      };
      request.onsuccess?.();
    });
    return request;
  } };
}

function page(db, seed) {
  const dom = new JSDOM('', { url: 'https://mumei-s.github.io/note-insight/', runScripts: 'outside-only', storageQuota: 2000 });
  const w = dom.window, get = w.Storage.prototype.getItem, set = w.Storage.prototype.setItem, key = w.Storage.prototype.key;
  const length = Object.getOwnPropertyDescriptor(w.Storage.prototype, 'length').get;
  for (const [name, value] of seed || [[cacheKey, cacheValue], ['mumei-insight-access-token', 'saved-member'], ['unrelated', 'x'.repeat(200)]]) set.call(w.localStorage, name, value);
  w.indexedDB = db;
  w.eval(code + '\nwindow.prepareStorage=prepareBrowserStorage;window.retryStorage=retryBrowserStorage;window.pendingStatus=pendingBrowserWriteStatus;window.hasPending=hasPendingBrowserWrites;');
  return { w, get, set, rawEntries() { return Array.from({ length: length.call(w.localStorage) }, (_, i) => { const name = key.call(w.localStorage, i); return [name, get.call(w.localStorage, name)]; }); } };
}

test('actual full Web Storage becomes writable after a committed cache move, and reload retains the exact history', async () => {
  const db = database(), first = page(db), w = first.w;
  try {
    w.localStorage.setItem('preferences', 'p'.repeat(500));
    assert.ok(w.hasPending());
    await w.prepareStorage();
    assert.equal(w.hasPending(), false);
    assert.equal(first.get.call(w.localStorage, 'preferences'), 'p'.repeat(500));
    assert.equal(first.get.call(w.localStorage, 'mumei-insight-access-token'), 'saved-member');
    assert.equal(first.get.call(w.localStorage, cacheKey), null);
    assert.equal(db.records.get(cacheKey).value, cacheValue);
    assert.equal(w.localStorage.getItem(cacheKey), cacheValue);
    assert.ok(Array.from({ length: w.localStorage.length }, (_, i) => w.localStorage.key(i)).includes(cacheKey));
    const second = page(db, first.rawEntries());
    try {
      await second.w.prepareStorage();
      assert.equal(second.w.localStorage.getItem(cacheKey), cacheValue);
      second.w.localStorage.setItem(cacheKey, 'new-history'.repeat(170));
      await second.w.prepareStorage();
      assert.equal(second.w.hasPending(), false);
      assert.equal(db.records.get(cacheKey).value, 'new-history'.repeat(170));
      assert.equal(second.get.call(second.w.localStorage, cacheKey), null);
      second.w.localStorage.removeItem(cacheKey);
      await second.w.prepareStorage();
      assert.equal(db.records.has(cacheKey), false);
      assert.equal(second.w.localStorage.getItem(cacheKey), null);
    } finally { second.w.close(); }
  } finally { w.close(); }
});

test('an aborted archive transaction never removes the original history or claims successful saving', async () => {
  const db = database(new Map(), { failWrite: true }), first = page(db), w = first.w;
  try {
    w.localStorage.setItem('preferences', 'p'.repeat(500));
    await w.prepareStorage();
    assert.ok(w.hasPending());
    assert.equal(first.get.call(w.localStorage, cacheKey), cacheValue);
    assert.equal(first.get.call(w.localStorage, 'mumei-insight-access-token'), 'saved-member');
    assert.equal(db.records.size, 0);
  } finally { w.close(); }
});

test('cache changes made while the archive commits are not deleted as stale snapshots', async () => {
  let first;
  const db = database(new Map(), { beforeCommit(mode) { if (mode === 'readwrite') first.set.call(first.w.localStorage, cacheKey, 'newer-history'); } });
  first = page(db);
  try {
    first.w.localStorage.setItem('preferences', 'p'.repeat(500));
    await first.w.prepareStorage();
    assert.equal(first.get.call(first.w.localStorage, cacheKey), 'newer-history');
    assert.equal(first.w.localStorage.getItem(cacheKey), 'newer-history');
    assert.equal(first.w.hasPending(), false);
  } finally { first.w.close(); }
});

const boardKey='mumei-notification-board:ss_yr';
const boardRows=Array.from({length:2000},(_,i)=>({id:i+1,actor_name:'相手'+i,body:'保存した本人通知本文\n続き',confirmed:i%2===0,favorite:i%3===0,meta:{action_users:[{name:'相手'+i}],unknown:{field:'保持'}}}));
const boardValue=JSON.stringify(boardRows);

test('2000件の本人通知コピーがWeb Storage上限を超えても全fieldsを保ち、再読込後に復元する',async()=>{
  const db=database(),first=page(db,[['mumei-insight-access-token','saved-member']]);
  try{
    first.w.localStorage.setItem(boardKey,boardValue);
    assert.deepEqual({...first.w.pendingStatus()},{cacheCount:1,changeCount:0});
    await first.w.prepareStorage();assert.equal(first.w.hasPending(),false);
    assert.equal(first.get.call(first.w.localStorage,'mumei-insight-access-token'),'saved-member');
    assert.equal(db.records.get(boardKey).value,boardValue);assert.deepEqual(JSON.parse(first.w.localStorage.getItem(boardKey)),boardRows);
    const second=page(db,first.rawEntries());
    try{await second.w.prepareStorage();assert.deepEqual(JSON.parse(second.w.localStorage.getItem(boardKey)),boardRows)}finally{second.w.close()}
  }finally{first.w.close()}
});

test('古いnativeコピーの移動が、先に保存した新しいpending通知を上書きしない',async()=>{
  const old='old board'.repeat(140),db=database(),first=page(db,[[boardKey,old],['mumei-insight-access-token','saved-member']]);
  try{
    first.w.localStorage.setItem(boardKey,boardValue);
    await first.w.prepareStorage();
    assert.equal(first.w.hasPending(),false);assert.equal(first.w.localStorage.getItem(boardKey),boardValue);
    assert.equal(db.records.get(boardKey).value,boardValue);assert.equal(first.get.call(first.w.localStorage,boardKey),null);
  }finally{first.w.close()}
});

test('archive失敗時は旧通知とtokenを残し、設定保存が詰まっても再試行で新通知を永続化する',async()=>{
  const options={failWrite:true},db=database(new Map(),options),old='old board'.repeat(170),first=page(db,[[boardKey,old],['mumei-insight-access-token','saved-member']]);
  try{
    first.w.localStorage.setItem(boardKey,boardValue);
    first.w.localStorage.setItem('preferences','p'.repeat(500));
    await first.w.prepareStorage();
    assert.equal(first.get.call(first.w.localStorage,boardKey),old);assert.equal(first.get.call(first.w.localStorage,'mumei-insight-access-token'),'saved-member');
    assert.deepEqual({...first.w.pendingStatus()},{cacheCount:1,changeCount:1});assert.equal(db.records.size,0);
    options.failWrite=false;await first.w.retryStorage();
    assert.equal(first.w.hasPending(),false);assert.equal(db.records.get(boardKey).value,boardValue);
    assert.equal(first.get.call(first.w.localStorage,'preferences'),'p'.repeat(500));assert.equal(first.get.call(first.w.localStorage,'mumei-insight-access-token'),'saved-member');
  }finally{first.w.close()}
});

test('保存commit前に明示削除した通知コピーを遅いarchive処理から復活させない',async()=>{
  const db=database(),first=page(db,[['mumei-insight-access-token','saved-member']]);
  try{
    first.w.localStorage.setItem(boardKey,boardValue);first.w.localStorage.removeItem(boardKey);
    await first.w.prepareStorage();assert.equal(first.w.localStorage.getItem(boardKey),null);assert.equal(db.records.has(boardKey),false);
    assert.equal(first.get.call(first.w.localStorage,'mumei-insight-access-token'),'saved-member');
  }finally{first.w.close()}
});

test('本人別の通知・取得metadataを分け、認証・設定・未保存送信queueをarchiveへ動かさない',async()=>{
  const db=database(),first=page(db,[['mumei-insight-access-token','saved-member'],['mumei-insight-saved-accounts-v3','saved-account'],['mumei-notification-editor-outbox','unsent'],['filter-settings','saved-filter']]);
  try{
    first.w.localStorage.setItem(boardKey,boardValue);
    first.w.localStorage.setItem('mumei-notification-board:other',JSON.stringify(Array.from({length:100},(_,i)=>({id:i+99,body:'別本人の本文'}))));
    first.w.localStorage.setItem('mumei-notification-board-meta:ss_yr','meta'.repeat(1000));
    first.w.localStorage.setItem('mumei-notification-recent-watermark:ss_yr','watermark'.repeat(400));
    await first.w.prepareStorage();assert.equal(first.w.hasPending(),false);
    assert.equal(db.records.get(boardKey).value,boardValue);assert.notEqual(db.records.get('mumei-notification-board:other').value,boardValue);
    for(const key of ['mumei-insight-access-token','mumei-insight-saved-accounts-v3','mumei-notification-editor-outbox','filter-settings']){assert.ok(first.get.call(first.w.localStorage,key));assert.equal(db.records.has(key),false)}
  }finally{first.w.close()}
});

test('archive済み通知の新しい本文は元の値へ戻らず、commitが完了するまで保存待ちを通知する',async()=>{
  const db=database(new Map([[boardKey,{key:boardKey,value:boardValue}]])),first=page(db,[['mumei-insight-access-token','saved-member']]),events=[];
  try{
    await first.w.prepareStorage();first.w.addEventListener('mumei-insight-storage-quota',()=>events.push({...first.w.pendingStatus()}));
    const updated=JSON.stringify([{...boardRows[0],body:'新しい本文',meta:{untouched:true}}]);
    first.w.localStorage.setItem(boardKey,updated);assert.equal(first.w.hasPending(),true);
    await first.w.prepareStorage();assert.equal(first.w.hasPending(),false);assert.equal(db.records.get(boardKey).value,updated);
    assert.ok(events.some(value=>value.cacheCount===1&&value.changeCount===0));assert.deepEqual(events.at(-1),{cacheCount:0,changeCount:0});
  }finally{first.w.close()}
});
