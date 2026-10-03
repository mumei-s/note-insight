import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

test('分析は4つの入口で開始し、選んだ分析だけを読み込み、通常分析はツールなしページへ直結する', async t => {
  let summaries = 0;
  const h = await sceneFixture(t, { dependencies: {
    './member-insight-analytics-pro-v3': { MemberInsightAnalyticsProV3: ({ view }) => React.createElement('div', { 'data-pro-view': view }, view) },
    './member-insight-analysis-summary-client': { loadNotificationSummary: async () => { summaries++; return { sample: 0 }; } },
  } });
  const { MemberInsightAnalysisHub } = h.load('src/member-insight-analysis-hub.tsx');
  await h.render(MemberInsightAnalysisHub, { noteId: 'tester' });
  assert.equal(h.w.document.querySelectorAll('.miah-menu-card').length, 4);
  assert.deepEqual([...h.w.document.querySelectorAll('.miah-menu-main strong')].map(x => x.textContent), ['通常分析', 'ダッシュボード INSIGHTプロ', '本人通知分析', '総合判定']);
  assert.equal(h.w.document.querySelector('.miah-selected'), null);
  assert.equal(h.w.document.querySelector('.miah-tools'), null);
  assert.equal(summaries, 0);
  const normal = new URL(h.w.document.querySelector('.normal .miah-menu-main').href);
  assert.equal(normal.pathname, '/note-insight/install-free-analysis-v3.html'); assert.equal(normal.searchParams.get('account'), 'tester');
  const back = new URL(normal.searchParams.get('return')); assert.equal(back.searchParams.get('insightMode'), 'analysis'); assert.equal(back.hash, '#dashboard');
  await h.click(h.w.document.querySelector('.notifications .miah-menu-main'));
  assert.equal(summaries, 1); assert.ok(h.w.document.querySelector('.miah-notification')); assert.equal(h.w.document.querySelector('[data-pro-view]'), null);
  await h.click(h.w.document.querySelector('.dashboard .miah-menu-main'));
  assert.equal(h.w.document.querySelector('[data-pro-view]').dataset.proView, 'dashboard'); assert.equal(h.w.document.querySelector('.miah-notification'), null);
  await h.click(h.w.document.querySelector('.verdict .miah-menu-main'));
  assert.equal(h.w.document.querySelector('[data-pro-view]').dataset.proView, 'verdict'); assert.equal(new URL(h.w.location.href).searchParams.get('analysisPanel'), 'verdict');
  await React.act(async () => h.w.dispatchEvent(new h.w.Event('mumei-insight-analysis-menu')));
  assert.equal(h.w.document.querySelector('.miah-selected'), null); assert.equal(new URL(h.w.location.href).searchParams.has('analysisPanel'), false);
  await React.act(async () => { h.w.history.back(); await new Promise(resolve => h.w.setTimeout(resolve, 20)); });
  assert.equal(h.w.document.querySelector('[data-pro-view]').dataset.proView, 'verdict');
  await React.act(async () => { h.w.history.back(); await new Promise(resolve => h.w.setTimeout(resolve, 20)); });
  assert.equal(h.w.document.querySelector('[data-pro-view]').dataset.proView, 'dashboard');
  await h.click(h.w.document.querySelector('.miah-menu-back')); assert.equal(h.w.document.querySelector('.miah-selected'), null);
  assert.equal(summaries, 1);
});

test('直接URLの本人通知分析と設定リンクが対象アカウント・分析一覧への戻り先を維持する', async t => {
  const h = await sceneFixture(t, { dependencies: {
    './member-insight-analytics-pro-v3': { MemberInsightAnalyticsProV3: () => null },
    './member-insight-analysis-summary-client': { loadNotificationSummary: async () => ({ sample: 0 }) },
  } });
  h.w.history.replaceState({}, '', '/note-insight/?insightMode=analysis&analysisPanel=notifications#dashboard');
  const { MemberInsightAnalysisHub } = h.load('src/member-insight-analysis-hub.tsx');
  await h.render(MemberInsightAnalysisHub, { noteId: 'ss_yr' });
  assert.ok(h.w.document.querySelector('.miah-selected.notifications'));
  for (const gear of h.w.document.querySelectorAll('.miah-menu-settings')) {
    const url = new URL(gear.href); assert.equal(url.pathname, '/note-insight/dashboard-setup.html');
    assert.equal(url.searchParams.get('account'), 'ss_yr'); assert.equal(url.searchParams.get('role'), 'owner'); assert.equal(url.searchParams.get('auto'), '0');
    assert.equal(new URL(url.searchParams.get('return')).searchParams.has('analysisPanel'), false);
  }
});

test('プロ分析は通知取得を必須にせず、総合判定を開いた時に同じ保存履歴を照合する', async t => {
  let summaries = 0;
  const days = Array.from({ length: 14 }, (_, i) => ({ date: new Date(Date.now() - (14 - i) * 86400000).toISOString().slice(0, 10), pageViews: (i + 1) * 10, likes: i + 1, comments: 1 }));
  const payload = { noteId: 'tester', latestDashboard: { pageViews: 1050, likes: 105, comments: 14, capturedAt: new Date().toISOString() }, dailyMetrics: days, dailyHistory: days, topArticles: [] };
  const h = await sceneFixture(t, { fetch: async (_url, init) => Response.json(JSON.parse(init.body).action === 'follower-count' ? { followerCount: { count: 7 } } : payload), dependencies: {
    './insight-account-store': { INSIGHT_TOKEN_KEY: 'fixture-token', currentStoredInsightAccount: () => ({ noteId: 'tester' }) },
    './insight-release': { CURRENT_DASHBOARD_VERSION: '1.6.4', CURRENT_INSIGHT_APP_VERSION: 'fixture', CURRENT_NOTIFICATION_VERSION: '3.6.24' },
    './member-insight-analysis-summary-client': { loadNotificationSummary: async () => { summaries++; return { total: 105, dailyCounts: days.map((row, i) => ({ date: row.date, count: i + 1 })) }; } },
  } });
  h.w.localStorage.setItem('fixture-token', 'test-token');
  const { MemberInsightAnalyticsProV3 } = h.load('src/member-insight-analytics-pro-v3.tsx');
  await h.render(MemberInsightAnalyticsProV3, { view: 'dashboard' });
  assert.equal(summaries, 0); assert.ok(h.w.document.querySelector('.mipro-view-dashboard')); assert.match(h.w.document.querySelector('.mipro').textContent, /1,050/);
  await h.render(MemberInsightAnalyticsProV3, { view: 'verdict' });
  assert.equal(summaries, 1); assert.equal(h.w.document.querySelector('.mipro-head h2').textContent, '総合判定');
  assert.match(h.w.document.querySelector('.mipro-view-verdict').textContent, /同日相関 1\.00/);
  assert.ok(h.w.document.querySelector('svg[aria-label="横軸は保存通知件数、縦軸は公式PV"]'));
  assert.equal(h.w.document.querySelector('.mipro-trend'), null);
  assert.match(h.w.document.querySelector('.mipro').textContent, /因果ではありません|増やしたとは判定しません/);
});

test('通常分析の戻り先を分析一覧へ統一し、演出は背景・動きを減らす設定で停止する', async t => {
  const dom = new JSDOM('<a id="analysisBack"></a><button id="close"></button><main id="content"><figure class="public-donut"></figure><svg class="spark"></svg></main>', { url: 'https://mumei-s.github.io/note-insight/install-free-analysis-v3.html?return=https%3A%2F%2Fevil.example', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close()); const w = dom.window; let mediaChanged;
  const media = { matches: false, addEventListener(_type, fn) { mediaChanged = fn; } }; w.matchMedia = () => media;
  w.eval(readFileSync('public/public-analysis-motion.js', 'utf8'));
  assert.equal(w.document.querySelector('#analysisBack').href, 'https://mumei-s.github.io/note-insight/?insightMode=analysis#dashboard');
  const chart = w.document.querySelector('.public-donut'); assert.equal(chart.dataset.motion, 'on');
  media.matches = true; mediaChanged(); assert.equal(chart.dataset.motion, 'off');
  media.matches = false; mediaChanged(); assert.equal(chart.dataset.motion, 'on');
  Object.defineProperty(w.document, 'visibilityState', { configurable: true, value: 'hidden' }); w.document.dispatchEvent(new w.Event('visibilitychange')); assert.equal(chart.dataset.motion, 'off');
  Object.defineProperty(w.document, 'visibilityState', { configurable: true, value: 'visible' }); w.document.dispatchEvent(new w.Event('visibilitychange')); assert.equal(chart.dataset.motion, 'on');
  const late = w.document.createElement('figure'); late.className = 'public-donut'; w.document.querySelector('#content').append(late); await pause(); assert.equal(late.dataset.motion, 'on');
});
