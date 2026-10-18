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
            const commit = () => {
              if (mode === 'readwrite' && options.failWrite) { tx.error = new Error('commit rejected'); tx.onabort?.(); return; }
              options.beforeCommit?.(mode);
              for (const operation of operations) operation();
              if (request) { request.result = result; request.onsuccess?.(); }
              if (mode === 'readonly' && options.failReadCommit) { tx.error = new Error('read commit rejected'); tx.onabort?.(); return; }
              tx.oncomplete?.();
            };
            if (mode === 'readonly' && options.holdRead) options.holdRead(() => queueMicrotask(commit));
            else queueMicrotask(commit);
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

const savedViewCode = ts.transpileModule(readFileSync('src/insight-saved-view.ts','utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function savedViews(w) { w.eval('(function(){const exports={};\n'+savedViewCode+'\nwindow.savedViews=exports;})()'); return w.savedViews; }
const tick = () => new Promise(resolve => setImmediate(resolve));

test('新しいdocumentの一時的なarchive読取失敗後、pending書込がなくても保存表示を再試行で復元する',async()=>{
  const db=database(),first=page(db,[['mumei-insight-access-token','private-token']]),scope={account:'tester',token:'private-token'},savedAt=Date.now()-86400000;
  const value={rows:Array.from({length:100},(_,id)=>({id,body:'保存した本文'.repeat(30)})),total:100};
  let second;
  try{
    const api=savedViews(first.w);api.writeSavedInsightView('likes-last',scope,value,savedAt);await first.w.prepareStorage();
    const key=api.savedInsightViewKey('likes-last',scope),native=first.rawEntries();
    assert.equal(first.get.call(first.w.localStorage,key),null);assert.ok(db.records.has(key));first.w.close();
    const open=db.open.bind(db);let blocked=true,opens=0;
    db.open=()=>{opens++;if(!blocked)return open();const request={error:new Error('temporarily blocked')};queueMicrotask(()=>request.onerror?.());return request};
    second=page(db,native);const next=savedViews(second.w),events=[];second.w.addEventListener('mumei-insight-storage-hydrated',()=>events.push('ready'));
    await second.w.prepareStorage();assert.equal(opens,1,'1回の起動準備で失敗した読取を連打しない');assert.equal(next.readSavedInsightView('likes-last',scope),null);assert.equal(second.w.hasPending(),false);
    blocked=false;await second.w.retryStorage();
    assert.equal(opens,2);const restored=next.readSavedInsightView('likes-last',scope);assert.deepEqual(JSON.parse(JSON.stringify(restored.value)),value);assert.equal(restored.savedAt,savedAt);assert.equal(events.length,1);
    await second.w.retryStorage();assert.equal(opens,2,'復元成功後に不要なarchive再読込をしない');
  }finally{first.w.close();second?.w.close()}
});

for(const stillBlocked of [false,true])test(`起動を待たせず1回だけarchiveを再試行し、自動確認を連打しない（再試行時${stillBlocked?'失敗':'回復'}）`,async()=>{
  const db=database(new Map([[cacheKey,{key:cacheKey,value:cacheValue}]])),open=db.open.bind(db);let blocked=true,opens=0;
  db.open=()=>{opens++;if(!blocked)return open();const request={error:new Error('temporarily blocked')};queueMicrotask(()=>request.onerror?.());return request};
  const first=page(db,[['mumei-insight-access-token','saved-member']]),nativeTimeout=first.w.setTimeout.bind(first.w),retries=[],events=[];
  first.w.setTimeout=(fn,ms,...args)=>{if(ms===250){retries.push(fn);return -1}return nativeTimeout(fn,ms,...args)};
  first.w.addEventListener('mumei-insight-storage-hydrated',()=>events.push('ready'));
  try{
    await first.w.prepareStorage();assert.equal(opens,1);assert.equal(retries.length,1);assert.equal(first.w.localStorage.getItem(cacheKey),null);
    blocked=stillBlocked;retries[0]();for(let i=0;i<10;i++)await tick();
    assert.equal(opens,2);assert.equal(retries.length,1,'2回目の失敗を自動ループにしない');
    if(stillBlocked){assert.equal(first.w.localStorage.getItem(cacheKey),null);assert.equal(events.length,0);blocked=false;await first.w.retryStorage();assert.equal(opens,3)}
    assert.equal(first.w.localStorage.getItem(cacheKey),cacheValue);assert.equal(events.length,1);
  }finally{first.w.close()}
});

test('一時的にblockedとなった古いopenの遅い成功は接続を閉じて再試行を妨げない',async()=>{
  const requests=[],db={open(){const request={};requests.push(request);queueMicrotask(()=>request.onblocked?.());return request}},first=page(db,[['mumei-insight-access-token','saved-member']]);let closed=0;
  try{
    await first.w.prepareStorage();assert.equal(requests.length,1);
    requests[0].result={close(){closed++}};requests[0].onsuccess();assert.equal(closed,1);
  }finally{first.w.close()}
});

test('遅いarchive復元は新しい保存済み本文と明示削除を元の履歴に戻さない',async()=>{
  const removedKey='mumei-insight-data-cache-v1:saved:removed',waiters=[],db=database(new Map([[cacheKey,{key:cacheKey,value:'old history'}],[removedKey,{key:removedKey,value:'removed history'}]]),{holdRead:release=>waiters.push(release)}),first=page(db,[['mumei-insight-access-token','saved-member']]);
  try{
    const preparing=first.w.prepareStorage();for(let i=0;i<10&&!waiters.length;i++)await tick();assert.equal(waiters.length,1);
    first.w.localStorage.setItem(cacheKey,'new history'.repeat(400));first.w.localStorage.removeItem(removedKey);
    for(let i=0;i<10&&db.records.get(cacheKey)?.value!=='new history'.repeat(400);i++)await tick();
    assert.equal(db.records.get(cacheKey).value,'new history'.repeat(400));
    waiters[0]();await preparing;
    assert.equal(first.w.localStorage.getItem(cacheKey),'new history'.repeat(400));assert.equal(first.w.localStorage.getItem(removedKey),null);assert.equal(db.records.has(removedKey),false);
  }finally{first.w.close()}
});

test('明示clear後に届く古いarchiveを表示せず、clear後の新しい保存は維持する',async()=>{
  const nextKey='mumei-insight-data-cache-v1:saved:new',waiters=[],db=database(new Map([[cacheKey,{key:cacheKey,value:'cleared history'}]]),{holdRead:release=>waiters.push(release)}),first=page(db,[['mumei-insight-access-token','saved-member']]);
  try{
    const preparing=first.w.prepareStorage();for(let i=0;i<10&&!waiters.length;i++)await tick();
    first.w.localStorage.clear();first.w.localStorage.setItem(nextKey,'after clear'.repeat(400));
    for(let i=0;i<10&&!db.records.has(nextKey);i++)await tick();waiters[0]();await preparing;
    assert.equal(first.w.localStorage.getItem(cacheKey),null);assert.equal(first.w.localStorage.getItem(nextKey),'after clear'.repeat(400));assert.equal(db.records.has(cacheKey),false);
  }finally{first.w.close()}
});

test('読取transactionのcommit失敗は復元完了にせず、回復後にのみ履歴を公開する',async()=>{
  const options={failReadCommit:true},db=database(new Map([[cacheKey,{key:cacheKey,value:cacheValue}]]),options),first=page(db,[['mumei-insight-access-token','saved-member']]);
  try{
    await first.w.prepareStorage();assert.equal(first.w.localStorage.getItem(cacheKey),null);assert.equal(first.w.hasPending(),false);
    options.failReadCommit=false;await first.w.retryStorage();assert.equal(first.w.localStorage.getItem(cacheKey),cacheValue);
  }finally{first.w.close()}
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
