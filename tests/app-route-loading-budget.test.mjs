import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const member = { noteId: 'fixture', displayName: '本人', status: 'active' };
const routes = {
  './access-portal-v6': 'AccessPortalV6', './article-likes-page-v2': 'ArticleLikesPageV2',
  './combined-analytics-app': 'CombinedAnalyticsApp', './evidence-v2': 'EvidenceV2',
  './feature-page': 'FeaturePage', './hub-home': 'HubHome', './management-page': 'ManagementPage',
  './member-insight-live-v2': 'MemberInsightLiveV2', './owner-gate': 'OwnerGate',
};
async function fixture(t, { hash = '', session = true, realShell = false, holdShell, fetch = async () => Response.json({ ok: true, application: member }) } = {}) {
  const loaded = [], mounts = [], calls = [], dependencies = { './insight-display-mode': { useInsightDisplayMode() {} } };
  for (const [path, name] of Object.entries(routes)) {
    if (realShell && name === 'MemberInsightLiveV2') continue;
    const Component = () => {
      React.useEffect(() => { mounts.push(name); }, []);
      return React.createElement('div', { 'data-screen': name });
    };
    Object.defineProperty(dependencies, path, { get() { loaded.push(name); return { [name]: Component }; } });
  }
  if (realShell) {
    Object.assign(dependencies, {
      './creator-avatar': { CreatorAvatar: () => null }, './insight-ux-v12': {},
      './insight-visible-motion': { useVisibleMotion: () => ({ ref: null, motion: false }) },
      './insight-release': { CURRENT_INSIGHT_APP_VERSION: 'test', CURRENT_DASHBOARD_VERSION: 'test', CURRENT_NOTIFICATION_VERSION: 'test', NOTIFICATION_VERSION_STORAGE_KEY: 'notice', DASHBOARD_VERSION_STORAGE_KEY: 'dash', versionDiffers: () => false, fetchInsightRelease: async () => ({}) },
      './insight-screen-loader': { loadInsightScreen: load => load.toString().includes('member-insight-live-v2') && holdShell ? holdShell.promise.then(load) : load() },
    });
    for (const [file, name] of [['unified-v4', 'UnifiedV4'], ['social-v2', 'SocialV2'], ['notifications-final', 'NotificationsFinal'], ['analysis-hub', 'AnalysisHub'], ['comments-final', 'CommentsFinal'], ['favorites-final', 'FavoritesFinal']]) {
      dependencies['./member-insight-' + file] = { ['MemberInsight' + name]: () => React.createElement('div', { 'data-scene': name }) };
    }
  }
  const globals = { URLSearchParams };
  const h = await sceneFixture(t, { globals, dependencies, fetch: async (...args) => { calls.push(args); return fetch(...args); } });
  Object.assign(globals, { Event: h.w.Event, CustomEvent: h.w.CustomEvent, navigator: h.w.navigator, requestAnimationFrame: callback => h.w.requestAnimationFrame(callback) });
  h.w.scrollTo = () => {}; h.w.HTMLElement.prototype.scrollIntoView = () => {};
  h.w.history.replaceState({}, '', hash || '#');
  if (session) {
    h.w.localStorage.setItem('mumei-insight-access-token', 'fixture-token');
    h.w.localStorage.setItem('mumei-insight-saved-accounts-v3', JSON.stringify([{ ...member, memberToken: 'fixture-token', updatedAt: 1 }]));
  }
  return { ...h, loaded, mounts, calls, App: h.load('src/App.tsx').App };
}

test('TOP startup loads its own screen without downloading member, login, owner or legacy analysis screens', async t => {
  const h = await fixture(t); await h.render(h.App);
  assert.deepEqual(h.loaded, ['HubHome']); assert.deepEqual(h.mounts, ['HubHome']); assert.equal(h.calls.length, 0);
});

test('member shell downloads during session verification, but cannot mount or start histories before verification', async t => {
  let finish; const h = await fixture(t, { hash: '#dashboard', fetch: () => new Promise(resolve => { finish = resolve; }) });
  await h.render(h.App);
  assert.deepEqual(h.loaded, ['HubHome', 'MemberInsightLiveV2']); assert.deepEqual(h.mounts, []);
  assert.equal(h.calls.length, 1); assert.ok(h.w.document.querySelector('.app-session-check'));
  await React.act(async () => { finish(Response.json({ ok: true, application: member })); await pause(); await pause(); });
  assert.deepEqual(h.mounts, ['MemberInsightLiveV2']); assert.equal(h.calls.length, 1);
  assert.equal(h.w.document.querySelector('.app-session-check'), null);
});

test('owner route loads its gate without loading participant histories or unused management screens', async t => {
  const h = await fixture(t, { hash: '#owner' }); await h.render(h.App);
  assert.deepEqual(h.loaded, ['HubHome', 'OwnerGate']); assert.deepEqual(h.mounts, ['OwnerGate']); assert.equal(h.calls.length, 0);
});

test('rejected member session mounts only the access screen and keeps the authenticated shell unmounted', async t => {
  const h = await fixture(t, { hash: '#dashboard', fetch: async () => Response.json({ ok: false, error: 'INSIGHT_SESSION_INVALID' }, { status: 401 }) });
  await h.render(h.App);
  assert.deepEqual(h.mounts, ['AccessPortalV6']); assert.equal(h.calls.length, 1);
  assert.equal(h.w.document.querySelector('[data-screen="MemberInsightLiveV2"]'), null);
});

test('a notification selected while the member chunk downloads opens that scene when the real shell arrives', async t => {
  let release; const holdShell = { promise: new Promise(resolve => { release = resolve; }) };
  const h = await fixture(t, { hash: '#dashboard', realShell: true, holdShell }); await h.render(h.App);
  assert.equal(h.w.document.querySelector('.miv5'), null);
  await h.click(h.w.document.querySelector('.app-bottom-item-toggle'));
  await h.click([...h.w.document.querySelectorAll('.app-bottom-item-sheet button')].find(button => button.textContent === '本人通知'));
  assert.equal(h.w.history.state.insightPendingTab, 'notifications');
  await React.act(async () => { release(); await pause(); await pause(); });
  assert.ok(h.w.document.querySelector('.miv5.mode-notifications [data-scene="NotificationsFinal"]'));
  assert.equal(h.w.document.querySelector('[data-scene="UnifiedV4"]'), null);
  assert.equal(h.w.history.state.insightTab, 'notifications'); assert.equal(h.w.history.state.insightPendingTab, undefined);
});

test('pressing main while a selected scene waits for the shell keeps the last choice as normal history', async t => {
  let release; const holdShell = { promise: new Promise(resolve => { release = resolve; }) };
  const h = await fixture(t, { hash: '#dashboard', realShell: true, holdShell }); await h.render(h.App);
  await h.click(h.w.document.querySelector('.app-bottom-item-toggle'));
  await h.click([...h.w.document.querySelectorAll('.app-bottom-item-sheet button')].find(button => button.textContent === 'コメント'));
  await h.click(h.w.document.querySelector('[aria-label="INSIGHT メイン"]'));
  assert.equal(h.w.history.state.insightPendingTab, 'likes');
  await React.act(async () => { release(); await pause(); await pause(); });
  assert.ok(h.w.document.querySelector('.miv5.mode-normal [data-scene="UnifiedV4"]'));
  assert.equal(h.w.history.state.insightTab, 'likes'); assert.equal(h.w.document.querySelector('[data-scene="CommentsFinal"]'), null);
});
