import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const OWNER = 'mumei-unified-owner-token', TOKEN = 'mumei-insight-access-token', SEEN = 'mumei-owner-pending-seen-v1';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const result = (id = 'new') => Response.json({ ok: true, count: 1, items: [{ id, updatedAt: 'now', displayName: id }] });
const compile = (source, context) => vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
function withoutImports(source) { const file = ts.createSourceFile('fixture.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); for (const statement of [...file.statements].reverse()) if (ts.isImportDeclaration(statement)) source = source.slice(0, statement.getFullStart()) + source.slice(statement.end); return source; }
function fixture(respond, owner = 'owner-a') {
  const data = new Map([[OWNER, owner], [TOKEN, 'member-a'], ['mumei-insight-saved-accounts-v3', JSON.stringify([{ noteId: 'member_a', memberToken: 'member-a', status: 'active', updatedAt: 1 }])]]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
  const calls = [], notices = [], timeouts = new Map(), intervals = new Map(), window = new EventTarget(); let timer = 0;
  Object.assign(window, { location: { href: 'https://example.test/', hash: '' }, setTimeout(fn, ms) { const id = ++timer; timeouts.set(id, { fn, ms }); return id; }, clearTimeout: id => timeouts.delete(id), setInterval(fn, ms) { intervals.set(++timer, { fn, ms }); return timer; } });
  const document = { visibilityState: 'visible', getElementById: () => null, createElement: () => ({ style: {}, remove() {} }), body: { appendChild: box => notices.push(box) } };
  const context = vm.createContext({ window, document, localStorage: storage, sessionStorage: storage, URL, Event, AbortController, console, exports: {}, installApiBridge() {}, registerServiceWorker() {}, touchInsightSession: async () => {}, fetch: async (url, init) => { const body = JSON.parse(init.body); if (body.action === 'touch') return Response.json({ ok: true }); const call = { url, init, body }; calls.push(call); return respond(call, calls.length); } });
  compile(readFileSync('src/insight-account-store.ts', 'utf8'), context); Object.assign(context, context.exports);
  const source = readFileSync('src/main.tsx', 'utf8'); compile(withoutImports(source.slice(0, source.indexOf('function startupFailureLabel('))), context);
  return { calls, notices, data, document, fire: name => window.dispatchEvent(new Event(name)), interval: () => [...intervals.values()].find(x => x.ms === 120000).fn(), timeout: () => { const [id, entry] = [...timeouts].find(([, x]) => x.ms === 30000); timeouts.delete(id); entry.fn(); } };
}

test('owner startup, pageshow, focus and interval share the complete unfinished poll, not a result cache', async () => {
  const body = deferred(), next = deferred();
  const h = fixture((_call, n) => n === 1 ? { ok: true, json: () => body.promise } : next.promise);
  await settle(); h.fire('pageshow'); h.fire('focus'); h.interval(); assert.equal(h.calls.length, 1);
  body.resolve({ ok: true, count: 1, items: [{ id: 'first', updatedAt: 'now', displayName: 'first' }] }); await settle();
  assert.equal(h.notices.length, 1); assert.equal(h.data.get(SEEN), 'first:now');
  h.fire('focus'); h.fire('pageshow'); assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].init.headers['X-Owner-Token'], 'owner-a'); assert.equal(h.calls[1].init.cache, 'no-store');
  next.resolve(result('second')); await settle(); assert.equal(h.notices.length, 2); assert.equal(h.data.get(SEEN), 'second:now');
});

test('owner token replacement cannot share the old poll or let its completion unlock the new flight', async () => {
  const old = deferred(), next = deferred(), h = fixture((_call, n) => n === 1 ? old.promise : next.promise);
  h.data.set(OWNER, 'owner-b'); h.fire('focus'); assert.equal(h.calls.length, 2); assert.equal(h.calls[0].init.signal.aborted, true);
  old.resolve(result('old')); await settle(); assert.equal(h.notices.length, 0); assert.equal(h.data.has(SEEN), false);
  h.fire('pageshow'); assert.equal(h.calls.length, 2); next.resolve(result('current')); await settle(); assert.equal(h.data.get(SEEN), 'current:now');
});

for (const change of ['logout', 'member-switch', 'member-logout']) test(`late owner-pending result after ${change} cannot notify or update seen state`, async () => {
  const old = deferred(), h = fixture(() => old.promise);
  if (change === 'logout') h.data.delete(OWNER); else if (change === 'member-switch') h.data.set(TOKEN, 'member-b'); else h.data.set('mumei-insight-explicit-logout:member_a', '1');
  old.resolve(result('old')); await settle(); assert.equal(h.notices.length, 0); assert.equal(h.data.has(SEEN), false);
});

test('observed owner logout cancels its flight and starts no anonymous owner check', async () => {
  const old = deferred(), h = fixture(() => old.promise); h.data.delete(OWNER); h.fire('focus');
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].init.signal.aborted, true); old.resolve(result()); await settle(); assert.equal(h.data.has(SEEN), false);
});

for (const failure of ['network', '401', '402', 'malformed']) test(`owner poll ${failure} is not cached and the next event checks again`, async () => {
  const old = deferred(), h = fixture((_call, n) => n === 1 ? old.promise : result()); h.fire('focus'); assert.equal(h.calls.length, 1);
  if (failure === 'network') old.reject(new Error('offline')); else old.resolve(failure === 'malformed' ? new Response('{') : Response.json({ ok: false }, { status: Number(failure) }));
  await settle(); assert.equal(h.data.has(SEEN), false); h.fire('focus'); await settle(); assert.equal(h.calls.length, 2); assert.equal(h.data.get(SEEN), 'new:now');
});

test('timeout releases only that owner flight and a late ignored-abort response stays stale', async () => {
  const old = deferred(), next = deferred(), h = fixture((_call, n) => n === 1 ? old.promise : next.promise);
  h.timeout(); assert.equal(h.calls[0].init.signal.aborted, true); h.fire('focus'); assert.equal(h.calls.length, 2);
  old.resolve(result('old')); await settle(); h.fire('pageshow'); assert.equal(h.calls.length, 2); assert.equal(h.data.has(SEEN), false);
  next.resolve(result('current')); await settle(); assert.equal(h.data.get(SEEN), 'current:now');
});

test('missing owner credentials and hidden intervals never issue owner reads', async () => {
  const h = fixture(() => result(), ''); h.fire('focus'); h.fire('pageshow'); h.interval(); assert.equal(h.calls.length, 0);
  h.data.set(OWNER, 'owner-b'); h.document.visibilityState = 'hidden'; h.interval(); assert.equal(h.calls.length, 0);
  h.document.visibilityState = 'visible'; h.interval(); await settle(); assert.equal(h.calls.length, 1);
});
