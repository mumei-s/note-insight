import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source = readFileSync('public/note-insight-dm-reader-v1.js', 'utf8');
const room = '11111111-1111-4111-8111-111111111111';
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

function fixture(t) {
  const dom = new JSDOM('<main><div class="messageText">保存済み本文</div><form><textarea></textarea></form></main>', {
    url: 'https://note.com/messages/rooms/' + room, runScripts: 'outside-only',
  });
  const w = dom.window, timers = new Map(), gm = new Map(), observers = [];
  let next = 0, accountReads = 0, historyReads = 0;
  const Observer = w.MutationObserver;
  w.MutationObserver = class extends Observer { constructor(fn) { super(fn); observers.push(this); } };
  t.after(() => { observers.forEach(o => o.disconnect()); w.close(); });
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const height = this.hidden || this.style.display === 'none' ? 0 : this.id === 'mumei-dm-reader-status' ? 18 : 50;
    const top = this.matches('textarea') ? 680 : 0;
    return { top, bottom: top + height, left: 8, right: 367, width: 359, height };
  };
  Object.defineProperty(w.document.documentElement, 'clientHeight', { value: 800 });
  w.setTimeout = (fn, ms = 0) => { const id = ++next; timers.set(id, { fn, ms }); return id; };
  w.clearTimeout = id => timers.delete(id); w.setInterval = () => 0; w.clearInterval = () => {};
  gm.set('mumei_insight_dm_sync_token_v1:tester', 'fixture-token');
  w.GM = { getValue: async (key, fallback) => gm.get(key) ?? fallback, setValue: async (key, value) => gm.set(key, structuredClone(value)),
    xmlHttpRequest: opts => opts.onload({ status: 200, responseText: '{"ok":true}' }) };
  w.fetch = async () => { accountReads++; return { ok: true, json: async () => ({ data: { urlname: 'tester' } }) }; };
  w.__mumeiDmNetworkV2 = { readHistory: async (_room, _owner, { onProgress }) => {
    historyReads++; await onProgress({ stage: 'delta', read: 1, saved: 0, stored: 1 });
    return { read: 1, saved: 0, stored: 1, complete: true };
  } };
  const end = source.lastIndexOf('{let timer=0,running=false;');
  assert.ok(end > 0);
  w.eval(source.slice(0, end) + 'window.__dmStatusTest={showStatus,statusLayout};' + source.slice(end));
  timers.clear();
  async function flush() {
    await settle();
    for (let i = 0; i < 6; i++) {
      const ready = [...timers].filter(([, value]) => value.ms <= 220);
      if (!ready.length) break;
      for (const [id, value] of ready) { timers.delete(id); value.fn(); }
      await settle();
    }
  }
  return { w, gm, flush, ui: w.__dmStatusTest, readCount: () => accountReads, historyCount: () => historyReads,
    get panel() { return w.document.getElementById('mumei-dm-reader-status'); } };
}

test('DM進捗パネルの追加・同じ状態の再表示では読み込みを再起動しない', async t => {
  const h = fixture(t);
  assert.equal(h.w.__mumeiInsightDmReaderV1Api.run(), true);
  await h.flush();
  assert.equal(h.readCount(), 1, 'Reader自身の表示は新しいDM本文ではない');
  const panel = h.panel, state = h.gm.get('mumei_insight_dm_checkpoint_v1:tester');
  let mutations = 0;
  const observer = new h.w.MutationObserver(records => { mutations += records.length; });
  observer.observe(panel, { subtree: true, childList: true, attributes: true });
  for (let i = 0; i < 12; i++) h.ui.showStatus(state);
  await h.flush();
  assert.equal(h.panel, panel);
  assert.equal(mutations, 0, '同じ状態で表示属性を書き換え続けない');
  assert.equal(h.readCount(), 1);
  assert.match(panel.textContent, /全件保存完了・新着待ち.*本文保存 1件/);
});

test('DM画面の装飾の変化は再読込せず、新しい本文は読込を起動する', async t => {
  const h = fixture(t);
  h.w.__mumeiInsightDmReaderV1Api.run(); await h.flush();
  const before = h.historyCount();
  for (let i = 0; i < 4; i++) {
    h.w.document.querySelector('main').style.opacity = String(0.8 + i * 0.05);
    await h.flush();
  }
  assert.equal(h.historyCount(), before, 'class/styleだけで完了表示を再点灯させない');
  h.w.document.querySelector('.messageText').textContent = '新しく届いた本文';
  await h.flush();
  assert.equal(h.historyCount(), before + 1);
  assert.equal(h.gm.get('mumei_insight_dm_sync_token_v1:tester'), 'fixture-token');
});

test('通知の表示属性が切り替わった時はDMパネルを即座に隠す', async t => {
  const h = fixture(t);
  h.w.__mumeiInsightDmReaderV1Api.run(); await h.flush();
  const bell = h.w.document.createElement('section'); bell.hidden = true;
  bell.innerHTML = '<button role="tab">通知</button><button role="tab">お知らせ</button>';
  h.w.document.body.append(bell); await h.flush();
  assert.ok(h.panel);
  bell.hidden = false; await settle();
  assert.equal(h.panel, null);
  h.ui.showStatus({ storedMessageCount: 20 });
  assert.equal(h.panel, null, '遅い保存応答でDMパネルを復活させない');
});
