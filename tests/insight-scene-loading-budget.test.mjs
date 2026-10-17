import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

async function fixture(t, mode, holdNormal) {
  const loaded = [], mounts = [], dependencies = {
    './creator-avatar': { CreatorAvatar: () => null },
    './insight-account-store': { INSIGHT_TOKEN_KEY: 'token', currentStoredInsightAccount: () => ({ noteId: 'fixture', memberToken: 'session' }), setAccessIntent() {} },
    './insight-release': { CURRENT_INSIGHT_APP_VERSION: 'test', CURRENT_DASHBOARD_VERSION: 'test', CURRENT_NOTIFICATION_VERSION: 'test', NOTIFICATION_VERSION_STORAGE_KEY: 'notice', DASHBOARD_VERSION_STORAGE_KEY: 'dash', versionDiffers: () => false, fetchInsightRelease: async () => ({}) },
    './insight-visible-motion': { useVisibleMotion: () => ({ ref: null, motion: false }) }, './insight-ux-v12': {},
  };
  if (holdNormal) dependencies['./insight-screen-loader'] = { loadInsightScreen: load => load.toString().includes('unified-v4') ? holdNormal.promise.then(load) : load() };
  for (const [file, name] of [['unified-v4', 'UnifiedV4'], ['social-v2', 'SocialV2'], ['notifications-final', 'NotificationsFinal'], ['analysis-hub', 'AnalysisHub'], ['comments-final', 'CommentsFinal'], ['favorites-final', 'FavoritesFinal']]) {
    const Component = ({ active }) => {
      const [page, setPage] = React.useState(1);
      React.useEffect(() => { mounts.push(name); }, []);
      return React.createElement('button', { 'data-scene': name, 'data-active': active, onClick: () => setPage(value => value + 1) }, 'page ' + page);
    };
    Object.defineProperty(dependencies, './member-insight-' + file, { get() { loaded.push(name); return { ['MemberInsight' + name]: Component }; } });
  }
  const globals = { URLSearchParams };
  const h = await sceneFixture(t, { dependencies, globals, fetch: async () => Response.json({ ok: true, application: { noteId: 'fixture', status: 'active' } }) });
  Object.assign(globals, { Event: h.w.Event, CustomEvent: h.w.CustomEvent, navigator: h.w.navigator, requestAnimationFrame: callback => h.w.requestAnimationFrame(callback) });
  h.w.localStorage.setItem('token', 'session'); h.w.history.replaceState({}, '', '?insightMode=' + mode + '#dashboard');
  h.w.scrollTo = () => {}; h.w.HTMLElement.prototype.scrollIntoView = () => {};
  await h.render(h.load('src/member-insight-live-v2.tsx').MemberInsightLiveV2);
  return { ...h, loaded, mounts, select: async tab => React.act(async () => { h.w.dispatchEvent(new h.w.CustomEvent('mumei-insight-select-item', { detail: tab })); await pause(); await pause(); }) };
}

for (const [mode, name] of [['normal', 'UnifiedV4'], ['notifications', 'NotificationsFinal'], ['comments', 'CommentsFinal'], ['analysis', 'AnalysisHub']]) {
  test(`${mode} deep link downloads and mounts only its selected scene`, async t => {
    const h = await fixture(t, mode); assert.deepEqual(h.loaded, [name]); assert.deepEqual(h.mounts, [name]);
  });
}

test('opening normal history after a notification deep link loads it once and keeps its selected page on return', async t => {
  const h = await fixture(t, 'notifications'); await h.select('likes');
  const saved = h.w.document.querySelector('[data-scene="UnifiedV4"]'); await h.click(saved); assert.equal(saved.textContent, 'page 2');
  await h.select('comments'); assert.equal(h.w.document.querySelector('[data-scene="UnifiedV4"]'), saved);
  await h.select('likes'); assert.equal(h.w.document.querySelector('[data-scene="UnifiedV4"]'), saved); assert.equal(saved.textContent, 'page 2');
  assert.deepEqual(h.loaded, ['NotificationsFinal', 'UnifiedV4', 'CommentsFinal']); assert.equal(h.mounts.filter(name => name === 'UnifiedV4').length, 1);
});

test('a pending hidden normal chunk cannot delay the selected notification scene', async t => {
  let release; const hold = { promise: new Promise(resolve => { release = resolve; }) };
  const h = await fixture(t, 'normal', hold); assert.deepEqual(h.loaded, []);
  await h.select('notifications');
  assert.ok(h.w.document.querySelector('[data-scene="NotificationsFinal"]'));
  assert.deepEqual(h.loaded, ['NotificationsFinal']);
  await React.act(async () => { release(); await pause(); await pause(); });
  assert.ok(h.w.document.querySelector('[data-scene="NotificationsFinal"]'));
  assert.equal(h.w.document.querySelector('[data-scene="UnifiedV4"]').closest('.miv5-unified-slot').hidden, true);
});
