import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const scripts = [
  'insight-dashboard-label-v19',
  'insight-inline-updates-v1',
  'insight-top-install-v16',
  'insight-update-guide-v18',
  'insight-ux-v11',
  'insight-ux-v12',
  'insight-ux-v13',
];
const compiled = new Map(scripts.map(name => [name, ts.transpileModule(
  readFileSync(`src/${name}.ts`, 'utf8').replace('export {};', ''),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText]));

async function launcher(t, { mobile = true, update = false, reverse = false } = {}) {
  const dom = new JSDOM(`<head></head><body>
    <section class="miv5-update"><div class="miv5-source-grid">
      <div class="miv5-source-card normal ${update ? 'needs-update' : ''}">
        <button class="miv5-source-main" aria-busy="false"><strong>✓ 通常データ</strong><small>本体 v1</small><span>保存済み</span></button>
        ${update ? '<button class="miv5-install-link update-ready">本体を更新</button>' : ''}
      </div>
      <div class="miv5-source-card notice ${update ? 'needs-update' : ''}">
        <button class="miv5-source-main"><strong>🔔 本人通知</strong><small>この端末 v3.6.5</small><span>通知履歴・追加分析</span></button>
        <a class="miv5-install-link" href="./tool-setup.html">設定・更新状態</a>
      </div>
      <div class="miv5-source-card dashboard ${update ? 'needs-update' : ''}">
        <button class="miv5-source-main"><strong>📊 分析</strong><small>Dashboard同期 v1.4.7</small><span>公式Dashboard＋INSIGHT</span></button>
      </div>
      <div class="miv5-source-card detail"><button class="miv5-source-main">詳細分析</button></div>
    </div></section>
    <div class="miu"><a href="https://note.com/tester">@tester</a><div class="miu-topactions"><button>アカウント切替</button></div></div>
    <nav><button>記事</button></nav>
  </body>`, { url: 'https://mumei-s.github.io/note-insight/#dashboard', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  t.after(() => w.close());
  w.matchMedia = () => ({ matches: mobile });
  w.scrollTo = () => {};
  w.fetch = async () => Response.json({ ok: true, rows: [] });
  const clicks = [];
  for (const kind of ['normal', 'notice', 'dashboard', 'detail']) {
    w.document.querySelector(`.${kind} .miv5-source-main`).onclick = () => clicks.push(kind);
  }
  for (const name of reverse ? [...scripts].reverse() : scripts) w.eval(`(() => {${compiled.get(name)}\n})()`);
  await pause(500);
  w.dispatchEvent(new w.MessageEvent('message', { origin: w.location.origin, data: {
    source: 'mumei-notification-feature-bridge-v1', type: 'state', enabled: true,
  } }));
  await pause(400);
  return { w, clicks };
}

async function assertSettled(w) {
  const changed = [];
  const observer = new w.MutationObserver(records => changed.push(...records.map(record => ({
    type: record.type, attribute: record.attributeName, target: record.target.nodeName,
  }))));
  observer.observe(w.document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  await pause(650);
  observer.disconnect();
  assert.equal(changed.length, 0, `上段の描画が静止せず ${changed.length} 回変化`);
  assert.equal(w.document.querySelector('[data-v13]'), null, '旧インストール / 更新リンクは再生成しない');
  assert.equal(w.document.querySelector('.dashboard > .miv5-install-link'), null);
  assert.equal(w.document.querySelectorAll('.notice a.mumei-canonical-install').length, 1);
  assert.equal(w.document.querySelector('.dashboard small').textContent, 'ダッシュボード同期ツール');
}

test('本番の上段補正を同時実行しても旧インストール / 更新リンクと高さが点滅しない', async t => {
  const { w, clicks } = await launcher(t);
  await assertSettled(w);
  assert.equal(w.document.querySelector('.miv5-update').style.height, '103px');
  const controls = w.document.querySelector('.mumei-notice-controls');
  const toggle = controls.querySelector('button');
  assert.equal(toggle.textContent, '🔔パネル ON');
  for (const kind of ['normal', 'notice', 'dashboard']) w.document.querySelector(`.${kind} .miv5-source-main`).click();
  w.document.querySelector('.mumei-detail-analysis-proxy').click();
  assert.deepEqual(clicks, ['normal', 'notice', 'dashboard', 'detail']);
  let toggleRequest;
  w.postMessage = data => { toggleRequest = data; };
  toggle.click();
  assert.equal(toggleRequest.type, 'set');
  assert.equal(toggleRequest.enabled, false);
  w.document.querySelector('.normal span').textContent = '公開データを更新中…';
  w.document.querySelector('.normal button').setAttribute('aria-busy', 'true');
  await pause(500);
  assert.equal(w.document.querySelector('.mumei-notice-controls'), controls);
  await assertSettled(w);
});

test('本体・ツールの更新がある状態でも案内ボタンを作り直さず操作を保持する', async t => {
  const { w } = await launcher(t, { update: true });
  await assertSettled(w);
  const panel = w.document.getElementById('mumei-insight-update-guide-v18');
  const button = panel.querySelector('[data-kind="normal"] button');
  let updates = 0;
  w.document.querySelector('.normal > .update-ready').onclick = () => updates++;
  button.focus();
  w.document.querySelector('nav button').textContent = '記事 266';
  await pause(500);
  assert.equal(w.document.activeElement, button);
  assert.equal(panel.querySelector('[data-kind="normal"] button'), button);
  button.click();
  assert.equal(updates, 1);
  for (const card of w.document.querySelectorAll('.needs-update')) card.classList.remove('needs-update');
  w.document.querySelector('.normal > .update-ready').remove();
  await pause(500);
  assert.equal(w.document.getElementById('mumei-insight-update-guide-v18'), null);
  await assertSettled(w);
});

test('読み込み順・画面幅が違っても現在の上段だけが表示を管理する', async t => {
  const { w } = await launcher(t, { mobile: false, reverse: true });
  await assertSettled(w);
  assert.equal(w.document.querySelector('.miv5-update').style.height, '108px');
  w.document.querySelector('.notice').classList.add('needs-install');
  await pause(500);
  await assertSettled(w);
  assert.equal(w.document.querySelector('.notice a.mumei-canonical-install').textContent, '＋ インストール');
});
