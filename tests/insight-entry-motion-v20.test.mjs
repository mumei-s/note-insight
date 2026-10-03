import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { createRoot } from 'react-dom/client';

const appSource = readFileSync('src/App.tsx', 'utf8');
const liveSource = readFileSync('src/member-insight-live-v2.tsx', 'utf8');
const upperCss = readFileSync('src/insight-thumb-dock-v11.css', 'utf8');

// Optional offline visual fixtures contain no credentials or participant data.
function preview(name, w, styles = '') {
  const dir = process.env.INSIGHT_MOTION_PREVIEW_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const html = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>INSIGHT motion QA</title><style>html,body{margin:0;background:#03070b}*{box-sizing:border-box}' + styles + '</style></head><body>' + w.document.body.innerHTML + '</body></html>';
  writeFileSync(join(dir, name + '.html'), html);
}

function setup(t, url = 'https://mumei-s.github.io/note-insight/#dashboard') {
  const dom = new JSDOM('<div id="root"></div>', { url, pretendToBeVisual: true });
  const w = dom.window;
  for (const key of ['window', 'document', 'localStorage', 'HTMLElement', 'Element']) globalThis[key] = w[key];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.localStorage.setItem('fixture-token-key', 'fixture-session');
  const root = createRoot(w.document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); w.close(); });
  return { w, root };
}

function load(source, w, fetch, overrides = {}) {
  const stub = () => React.createElement('div', { 'data-feature-fixture': true });
  const account = { noteId: 'tester', displayName: 'Test Creator', memberToken: 'fixture-session' };
  const modules = {
    react: React,
    'react/jsx-runtime': jsx,
    './creator-avatar': { CreatorAvatar: ({ image, name }) => React.createElement(image ? 'img' : 'span', image ? { src: image, alt: name } : {}, image ? undefined : name?.slice(0, 1)) },
    './insight-account-store': {
      INSIGHT_TOKEN_KEY: 'fixture-token-key', currentStoredInsightAccount: () => account,
      readStoredInsightAccounts: () => [account], restoreStoredMemberSession: () => account,
      rememberApplicant() {}, rememberMemberSession() {}, setAccessIntent() {},
    },
    './insight-release': {
      CURRENT_INSIGHT_APP_VERSION: 'test', CURRENT_NOTIFICATION_VERSION: 'test', CURRENT_DASHBOARD_VERSION: 'test',
      NOTIFICATION_VERSION_STORAGE_KEY: 'notice-version', DASHBOARD_VERSION_STORAGE_KEY: 'dashboard-version',
      versionDiffers: () => false, fetchInsightRelease: async () => ({ appVersion: 'test', notificationVersion: 'test', dashboardVersion: 'test' }),
    },
  };
  const ast = ts.createSourceFile('fixture.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node)) continue;
    const name = node.moduleSpecifier.text;
    if (modules[name]) continue;
    modules[name] = {};
    for (const specifier of node.importClause?.namedBindings?.elements || []) modules[name][specifier.name.text] = stub;
  }
  Object.assign(modules, overrides);
  const compiled = ts.transpileModule(source.replaceAll('import.meta.env.BASE_URL', '"/note-insight/"'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: name => { if (!(name in modules)) throw new Error('Missing fixture: ' + name); return modules[name]; },
    window: w, document: w.document, localStorage: w.localStorage, sessionStorage: w.sessionStorage,
    location: w.location, history: w.history, navigator: w.navigator,
    URL, URLSearchParams, AbortController, Event: w.Event, CustomEvent: w.CustomEvent,
    requestAnimationFrame: w.requestAnimationFrame.bind(w), fetch, console,
  });
  return exports;
}

test('黒い切替待ち画面はナビ非表示中も装飾され、確認完了後に待ち時間を追加しない', async t => {
  const { w, root } = setup(t);
  let finish;
  let requests = 0;
  const fetch = () => { requests++; return new Promise(resolve => { finish = resolve; }); };
  const { App } = load(appSource, w, fetch);
  await React.act(async () => root.render(React.createElement(App)));
  assert.deepEqual([...w.document.querySelectorAll('.app-session-brand span')].map(el => el.textContent), ['無名 S note', 'INSIGHT']);
  assert.match(w.document.querySelector('[role="status"]').textContent, /ログイン状態を確認しています/);
  assert.equal(w.document.querySelector('.app-bottom-nav'), null);
  assert.ok([...w.document.querySelectorAll('style')].some(el => el.textContent.includes('.app-session-check{position:relative')));
  assert.equal(w.localStorage.getItem('fixture-token-key'), 'fixture-session');
  preview('session', w);
  await React.act(async () => { finish({ ok: true, json: async () => ({ ok: true }) }); });
  assert.equal(w.document.querySelector('.app-session-check'), null);
  assert.ok(w.document.querySelector('.app-route-shell.is-ready'));
  const nav = w.document.querySelector('.app-bottom-nav');
  assert.deepEqual([...nav.querySelectorAll('button[aria-label]')].map(el => el.getAttribute('aria-label')), ['TOP', 'INSIGHT', 'noteへ']);
  assert.equal(nav.querySelector('.app-bottom-item-toggle').textContent.includes('項目を選ぶ'), true);
  await React.act(async () => nav.querySelector('.app-bottom-item-toggle').click());
  const labels = [...nav.querySelectorAll('.app-bottom-item-sheet button')].map(el => el.textContent);
  assert.ok(labels.includes('本人通知'));
  assert.ok(!labels.includes('通知'));
  assert.equal(requests, 1, '演出が認証を再実行しない');
  assert.equal(w.location.hash, '#dashboard');
  assert.equal(w.localStorage.getItem('fixture-token-key'), 'fixture-session');
});

test('上部演出だけを再生し、操作ボタンと保存データ画面は再マウントしない', async t => {
  const { w, root } = setup(t);
  let mounts = 0;
  function Unified() {
    React.useEffect(() => { mounts++; }, []);
    return React.createElement('div', { className: 'miu', 'data-saved-panel': true });
  }
  const fetch = async () => ({ ok: true, json: async () => ({ ok: true, member: { noteId: 'tester', displayName: 'Tester' }, rows: [], total: 0 }) });
  const { MemberInsightLiveV2 } = load(liveSource, w, fetch, { './member-insight-unified-v4': { MemberInsightUnifiedV4: Unified } });
  await React.act(async () => root.render(React.createElement(MemberInsightLiveV2)));
  const signature = w.document.querySelector('.miv5-hero-signature');
  const halo = w.document.querySelector('.miv5-launcher-halo');
  const analysis = w.document.querySelector('[aria-label="分析を開く"]');
  const settings = w.document.querySelector('[aria-label="分析設定"]');
  const saved = w.document.querySelector('[data-saved-panel]');
  settings.focus();
  await React.act(async () => w.dispatchEvent(new w.CustomEvent('mumei-insight-select-item', { detail: 'supporters' })));
  assert.notEqual(w.document.querySelector('.miv5-hero-signature'), signature);
  assert.notEqual(w.document.querySelector('.miv5-launcher-halo'), halo);
  assert.equal(w.document.querySelector('[aria-label="分析を開く"]'), analysis);
  assert.equal(w.document.querySelector('[aria-label="分析設定"]'), settings);
  assert.equal(w.document.activeElement, settings);
  assert.equal(w.document.querySelector('[data-saved-panel]'), saved);
  const styles = [...liveSource.matchAll(/import "(\.\/[^\"]+\.css)";/g)].map(match => readFileSync('src/' + match[1].slice(2), 'utf8')).join('\n');
  preview('upper', w, readFileSync('src/styles.css', 'utf8') + '\n' + styles);
  await React.act(async () => analysis.click());
  assert.ok(w.document.querySelector('.miv5.mode-analysis'));
  assert.equal(w.document.querySelector('[data-saved-panel]'), saved);
  await React.act(async () => w.dispatchEvent(new w.Event('mumei-insight-root')));
  assert.ok(w.document.querySelector('.miv5.mode-normal'));
  assert.equal(w.history.state.insightTab, 'likes');
  assert.equal(mounts, 1);
  assert.equal(w.document.querySelector('.miv5-launcher-item.notification .gear'), null);
  assert.ok(w.document.querySelector('[aria-label="本人通知の連携と履歴を開く"]'));
});

test('上部文字の二重透明化を防ぎ、下部は静止、動きを減らす設定にも対応する', () => {
  assert.match(upperCss, /color:rgba\(214,248,255,\.20\)/);
  assert.match(upperCss, /100%\{opacity:1;transform:translateY\(0\)\}/);
  assert.doesNotMatch(upperCss, /opacity:\.13|infinite|app-bottom-nav/);
  assert.match(upperCss, /\.miv5-launcher-halo\{[\s\S]*?display:block!important/);
  assert.match(upperCss, /strong span:last-child\{\s*justify-self:start;\s*margin-left:8%/);
  assert.match(upperCss, /\.miv5-launcher-item::before,\s*\.miv5-launcher-item::after\{[^}]*pointer-events:none/);
  assert.match(upperCss, /@keyframes iv22LetterGlint/);
  assert.match(upperCss, /@keyframes iv22StarGlint/);
  assert.match(upperCss, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(appSource, /const PARTICIPANT_MAINTENANCE = false/);
  assert.match(appSource, /@media\(prefers-reduced-motion:reduce\)/);
  const ast = ts.createSourceFile('App.tsx', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const scene = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'InsightSessionTransition').getText(ast);
  assert.doesNotMatch(scene, /setTimeout|fetch|localStorage|history|goTo\(/, '待機画面は表示専用');
});

test('クリエイターの名前・画像・noteリンクはアカウント切替に追従する', async t => {
  const { w, root } = setup(t);
  let current = { noteId: 'creator_a', displayName: 'Creator A', imageUrl: 'https://example.com/a.png' };
  const fetch = async () => ({ ok: true, json: async () => ({ ok: true, member: { ...current }, rows: [], total: 0 }) });
  const { MemberInsightLiveV2 } = load(liveSource, w, fetch, {
    './insight-account-store': { INSIGHT_TOKEN_KEY: 'fixture-token-key', currentStoredInsightAccount: () => current, setAccessIntent() {} },
  });
  const verify = () => {
    assert.equal(w.document.querySelector('.miv5-creator-copy h1').textContent, current.displayName);
    assert.equal(w.document.querySelector('.miv5-creator-copy a').href, 'https://note.com/' + current.noteId);
    assert.equal(w.document.querySelector('.miv5-creator-avatar img').src, current.imageUrl);
    assert.deepEqual([...w.document.querySelectorAll('.miv5-hero-signature strong span')].map(el => el.textContent), ['無名 S note', 'INSIGHT']);
  };
  await React.act(async () => root.render(React.createElement(MemberInsightLiveV2, { key: current.noteId })));
  verify();
  current = { noteId: 'creator_b', displayName: 'Creator B', imageUrl: 'https://example.com/b.png' };
  await React.act(async () => root.render(React.createElement(MemberInsightLiveV2, { key: current.noteId })));
  verify();
  assert.doesNotMatch(w.document.querySelector('.miv5-creator-copy').textContent, /Creator A|ss_yr/);
});
