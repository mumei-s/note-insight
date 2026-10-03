import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const page = readFileSync('public/notification-connection.html', 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function connection(t, installed = '3.6.20') {
  const dom = new JSDOM(page, { url: 'https://mumei-s.github.io/note-insight/notification-connection.html', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.localStorage.setItem('mumei-insight-access-token', 'fixture-member');
  if (installed) w.localStorage.setItem('mumei-notification-tool-version', installed);
  const requests = [];
  w.fetch = async (url, init) => {
    if (String(url).includes('insight-release.json')) return { json: async () => ({ notificationVersion: '3.6.23' }) };
    requests.push(JSON.parse(init.body).action);
    return { ok: true, json: async () => ({ ok: true, noteId: 'creator_b', paired: true, activeDeviceCount: 2 }) };
  };
  w.eval(w.document.querySelector('script').textContent);
  for (let n = 0; n < 20 && w.document.getElementById('accountState').textContent !== '@creator_b'; n++) await pause(5);
  assert.equal(w.document.getElementById('accountState').textContent, '@creator_b');
  return { w, requests };
}

test('本人通知の最上部から本人のフィルター・保存済み履歴へ進める', async t => {
  const { w, requests } = await connection(t);
  const top = w.document.querySelector('.shortcuts');
  assert.deepEqual([...top.querySelectorAll('a')].map(el => el.textContent), ['フィルター設定', '保存済みの本人通知']);
  assert.ok(top.compareDocumentPosition(w.document.querySelector('.hero')) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  const filter = new URL(top.querySelector('#filter').href), history = new URL(top.querySelector('#history').href);
  assert.equal(filter.pathname, '/note-insight/notification-filter-settings.html');
  assert.equal(filter.searchParams.get('notificationAccount'), 'creator_b');
  assert.equal(history.searchParams.get('insightMode'), 'notifications');
  assert.equal(history.searchParams.get('notificationAccount'), 'creator_b');
  assert.equal(history.hash, '#dashboard');
  assert.equal(w.document.querySelectorAll('#history').length, 1);
  assert.equal(w.document.querySelectorAll('#filter').length, 1);
  assert.deepEqual(requests, ['stats'], '操作導線の追加で再連携を自動実行しない');
});

test('添付の旧v3.6.20には更新ボタンを出し、導入後は自動で更新ありを消す', async t => {
  const { w, requests } = await connection(t);
  const action = w.document.getElementById('toolAction'), update = w.document.getElementById('update');
  assert.equal(action.hidden, false);
  assert.equal(update.textContent, '本人通知ツールを更新（v3.6.23）');
  const target = new URL(update.href);
  assert.equal(target.pathname, '/note-insight/notification-browser-install.html');
  assert.equal(target.searchParams.get('notificationAccount'), 'creator_b');
  assert.equal(new URL(target.searchParams.get('return')).pathname, '/note-insight/notification-connection.html');
  assert.match(w.document.getElementById('updateHelp').textContent, /本人通知をインストール \/ 更新/);
  assert.match(w.document.getElementById('message').textContent, /上の「本人通知ツールを更新」/);
  w.localStorage.setItem('mumei-notification-tool-version', '3.6.23');
  w.dispatchEvent(new w.Event('mumei-notification-version-changed'));
  assert.equal(action.hidden, true);
  assert.equal(w.document.getElementById('toolState').textContent, 'v3.6.23');
  assert.equal(w.document.getElementById('toolState').className, 'good');
  assert.doesNotMatch(w.document.getElementById('message').textContent, /更新があります/);
  assert.equal(w.localStorage.getItem('mumei-insight-access-token'), 'fixture-member');
  assert.deepEqual(requests, ['stats']);
});

test('最新版は更新案内を消し、未導入時はインストールへ進める', async t => {
  const latest = await connection(t, '3.6.23');
  assert.equal(latest.w.document.getElementById('toolAction').hidden, true);
  const missing = await connection(t, '');
  assert.equal(missing.w.document.getElementById('toolAction').hidden, false);
  assert.equal(missing.w.document.getElementById('update').textContent, '本人通知ツールをインストール');
});
