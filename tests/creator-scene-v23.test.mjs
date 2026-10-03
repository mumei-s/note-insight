import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
test('複数項目の欠けた本人画像を1回のまとめ取得で補完し、別名フィールドと画像切れも回復する', async t => {
  const requests = [];
  const h = await sceneFixture(t, { fetch: async (_url, init) => { const { noteIds } = JSON.parse(init.body); requests.push(noteIds); return Response.json({ items: noteIds.map(noteId => ({ noteId, image: `https://example.com/${noteId}.png` })) }); } });
  const { CreatorAvatar, creatorNoteId } = h.load('src/creator-avatar.tsx');
  function Avatars() { return React.createElement('div', {}, React.createElement(CreatorAvatar, { person: { actor_url: 'https://note.com/person_a', actor_name: 'A' } }), React.createElement(CreatorAvatar, { person: { note_id: 'person_a' } }), React.createElement(CreatorAvatar, { person: { peer_note_id: 'person_b' } }), React.createElement(CreatorAvatar, { person: { urlname: 'person_c', profile_image_url: 'https://example.com/c.png' } }), React.createElement(CreatorAvatar, { person: { noteId: 'person_d', imageUrl: 'https://example.com/broken.png' } })); }
  await h.render(Avatars, {});
  assert.equal(creatorNoteId('https://evil.example/person_a'), '');
  await React.act(async () => { await wait(35); await pause(); });
  assert.equal(requests.length, 1); assert.deepEqual(requests[0].sort(), ['person_a', 'person_b']);
  assert.equal(h.w.document.querySelectorAll('img').length, 5);
  const broken = h.w.document.querySelector('img[src="https://example.com/broken.png"]');
  await React.act(async () => { broken.dispatchEvent(new h.w.Event('error')); await pause(); });
  await React.act(async () => { await wait(35); await pause(); });
  assert.equal(h.w.document.querySelectorAll('img[src="https://example.com/person_d.png"]').length, 1);
});

test('人物切替中に前の画像補完が返っても、新しい人物のアイコンとして表示しない', async t => {
  const pending = [];
  const h = await sceneFixture(t, { fetch: (_url, init) => new Promise(resolve => pending.push({ ids: JSON.parse(init.body).noteIds, finish: resolve })) });
  const { CreatorAvatar } = h.load('src/creator-avatar.tsx');
  await h.render(CreatorAvatar, { noteId: 'person_a', name: 'A' });
  await React.act(async () => { await wait(35); });
  await h.render(CreatorAvatar, { noteId: 'person_b', name: 'B' });
  await React.act(async () => { await wait(35); });
  await React.act(async () => { pending[0].finish(Response.json({ items: [{ noteId: 'person_a', image: 'https://example.com/a.png' }] })); await pause(); });
  assert.equal(h.w.document.querySelector('img'), null);
  await React.act(async () => { pending[1].finish(Response.json({ items: [{ noteId: 'person_b', image: 'https://example.com/b.png' }] })); await pause(); });
  assert.equal(h.w.document.querySelector('img').src, 'https://example.com/b.png');
});

test('人数が増えても全員が一覧パネルに入り、名前・note IDで探して本人noteへ移動できる', async t => {
  const h = await sceneFixture(t), { ParticipantShowcase } = h.load('src/hub-participant-showcase.tsx');
  const people = Array.from({ length: 240 }, (_, i) => ({ id: `${i}`, noteId: `person_${i}`, name: `参加者${i}`, image: `https://example.com/${i}.png`, profileUrl: `https://note.com/person_${i}` }));
  await h.render(ParticipantShowcase, { people });
  const toggle = h.w.document.querySelector('.hub-showcase-list-toggle');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(h.w.document.querySelector('.hub-showcase-panel').hidden, true);
  assert.equal(h.w.document.querySelectorAll('.hub-showcase-all a').length, 0);
  await h.click(toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(h.w.document.querySelector('.hub-showcase-panel').hidden, false);
  assert.equal(h.w.document.querySelectorAll('.hub-showcase-all a').length, 240);
  const input = h.w.document.querySelector('input[type="search"]');
  await h.change(input, 'person_239');
  assert.equal(h.w.document.querySelectorAll('.hub-showcase-all a').length, 1);
  assert.equal(h.w.document.querySelector('.hub-showcase-all a').href, 'https://note.com/person_239');
  await h.change(input, '参加者100');
  assert.equal(h.w.document.querySelector('.hub-showcase-all a').href, 'https://note.com/person_100');
  await h.change(input, '該当なし');
  assert.equal(h.w.document.querySelectorAll('.hub-showcase-all a').length, 0);
  assert.match(h.w.document.querySelector('.hub-showcase-list-empty').textContent, /該当する参加者はいません/);
  await h.click(toggle); await h.click(toggle);
  assert.equal(h.w.document.querySelectorAll('.hub-showcase-all a').length, 240);
  assert.equal(h.w.document.querySelector('input[type="search"]').value, '');
  await h.click(h.w.document.querySelector('[aria-label="次のクリエイター"]'));
  assert.match(h.w.document.querySelector('.hub-showcase-identity').textContent, /参加者1/);
  assert.equal(h.w.document.querySelector('.hub-showcase-focus').href, 'https://note.com/person_1');
  assert.match(h.w.document.querySelector('.hub-showcase-controls').textContent, /再生/);
  assert.equal(h.w.document.querySelector('.hub-showcase-card'), null);
});

function playbackFixture(h) {
  const timers = new Map(); let id = 0;
  h.w.setInterval = callback => { timers.set(++id, callback); return id; };
  h.w.clearInterval = timer => timers.delete(timer);
  return timers;
}
const playbackPeople = Array.from({ length: 3 }, (_, i) => ({ id: `${i}`, noteId: `person_${i}`, name: `参加者${i}`, image: `https://example.com/${i}.png`, profileUrl: `https://note.com/person_${i}` }));
const playbackKey = 'mumei-insight-participant-playback-v1';
function speedTimers(h) {
  const timers = new Map(); let id = 0;
  h.w.setInterval = (callback, delay) => { timers.set(++id, { callback, delay }); return id; };
  h.w.clearInterval = timer => timers.delete(timer);
  return timers;
}
async function chooseSpeed(h, level) {
  await React.act(async () => {
    const select = h.w.document.querySelector('.hub-showcase-speed select');
    select.value = String(level);
    select.dispatchEvent(new h.w.Event('change', { bubbles: true }));
    await pause();
  });
}

test('速度5段階をすぐにタイマーへ反映し、タイマーが重複せず停止中の速度変更でも再生しない', async t => {
  const h = await sceneFixture(t), timers = speedTimers(h), { ParticipantShowcase } = h.load('src/hub-participant-showcase.tsx');
  await h.render(ParticipantShowcase, { people: playbackPeople });
  assert.equal(h.w.document.querySelector('.hub-showcase-speed select').value, '3');
  assert.equal([...timers.values()][0].delay, 2000);
  for (const [level, delay] of [[1, 4000], [2, 3000], [3, 2000], [4, 1500], [5, 1000]]) {
    const oldTimer = [...timers.keys()][0];
    await chooseSpeed(h, level);
    assert.equal(timers.size, 1);
    assert.equal(timers.has(oldTimer), false);
    assert.equal([...timers.values()][0].delay, delay);
  }
  await React.act(async () => { [...timers.values()][0].callback(); await pause(); });
  assert.equal(h.w.document.querySelector('.hub-showcase-focus').href, 'https://note.com/person_1');
  const toggle = h.w.document.querySelector('.hub-showcase-controls button[aria-pressed]');
  await h.click(toggle);
  await chooseSpeed(h, 4);
  assert.equal(timers.size, 0);
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  await h.click(toggle);
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].delay, 1500);
});

test('ページを戻すと速度・再生状態・表示人物が復元され、読み込み中や参加者の並び替えでも人物を維持する', async t => {
  const h = await sceneFixture(t), timers = speedTimers(h), { ParticipantShowcase } = h.load('src/hub-participant-showcase.tsx');
  await h.render(ParticipantShowcase, { people: playbackPeople });
  await chooseSpeed(h, 5);
  await h.click(h.w.document.querySelector('[aria-label="次のクリエイター"]'));
  const saved = JSON.parse(h.w.localStorage.getItem(playbackKey));
  assert.equal(saved.speedLevel, 5); assert.equal(saved.paused, true); assert.equal(saved.personId, '1');
  await h.render(() => null, {});
  assert.equal(timers.size, 0);
  await h.render(ParticipantShowcase, { people: [] });
  assert.equal(h.w.localStorage.getItem(playbackKey), JSON.stringify(saved));
  const reordered = [playbackPeople[2], playbackPeople[0], playbackPeople[1]];
  await h.render(ParticipantShowcase, { people: reordered });
  assert.equal(h.w.document.querySelector('.hub-showcase-speed select').value, '5');
  assert.equal(h.w.document.querySelector('.hub-showcase-focus').href, 'https://note.com/person_1');
  assert.match(h.w.document.querySelector('.hub-showcase-controls').textContent, /3 \/ 3/);
  assert.equal(timers.size, 0);
  await h.click(h.w.document.querySelector('.hub-showcase-controls button[aria-pressed]'));
  assert.equal(h.w.document.querySelector('.hub-showcase-focus').href, 'https://note.com/person_2');
  await h.render(() => null, {});
  await h.render(ParticipantShowcase, { people: playbackPeople });
  assert.equal(h.w.document.querySelector('.hub-showcase-controls button[aria-pressed]').getAttribute('aria-pressed'), 'true');
  assert.equal(h.w.document.querySelector('.hub-showcase-focus').href, 'https://note.com/person_2');
  assert.equal([...timers.values()][0].delay, 1000);
  await h.render(ParticipantShowcase, { people: [playbackPeople[0], playbackPeople[1]] });
  assert.equal(h.w.document.querySelector('.hub-showcase-focus').href, 'https://note.com/person_0');
});

test('保存値が壊れていたり保存が禁止されていても標準速度で表示・切替できる', async t => {
  const h = await sceneFixture(t), timers = speedTimers(h), { ParticipantShowcase } = h.load('src/hub-participant-showcase.tsx');
  for (const raw of ['{broken', 'null', JSON.stringify({ version: 1, speedLevel: 99, paused: 'true', personId: {} }), JSON.stringify({ version: 99, speedLevel: 5 })]) {
    h.w.localStorage.setItem(playbackKey, raw);
    await h.render(ParticipantShowcase, { people: playbackPeople });
    assert.equal(h.w.document.querySelector('.hub-showcase-speed select').value, '3');
    assert.equal([...timers.values()][0].delay, 2000);
    await h.render(() => null, {});
  }
  h.w.Storage.prototype.getItem = () => { throw new Error('storage unavailable'); };
  h.w.Storage.prototype.setItem = () => { throw new Error('storage unavailable'); };
  await h.render(ParticipantShowcase, { people: playbackPeople });
  await chooseSpeed(h, 5);
  await React.act(async () => { [...timers.values()][0].callback(); await pause(); });
  assert.equal(h.w.document.querySelector('.hub-showcase-focus').href, 'https://note.com/person_1');
  assert.equal([...timers.values()][0].delay, 1000);
});

test('タップ由来のホバーが残っても再生直後に人物が替わり、その後も自動切替を続ける', async t => {
  const h = await sceneFixture(t), timers = playbackFixture(h), { ParticipantShowcase } = h.load('src/hub-participant-showcase.tsx');
  await h.render(ParticipantShowcase, { people: playbackPeople });
  assert.equal(timers.size, 1);
  const stage = h.w.document.querySelector('.hub-showcase-stage');
  await React.act(async () => {
    const touch = new h.w.MouseEvent('pointerover', { bubbles: true });
    Object.defineProperty(touch, 'pointerType', { value: 'touch' });
    stage.dispatchEvent(touch);
    stage.dispatchEvent(new h.w.MouseEvent('mouseover', { bubbles: true }));
    await pause();
  });
  assert.equal(timers.size, 1);
  await h.click(h.w.document.querySelector('[aria-label="次のクリエイター"]'));
  assert.equal(timers.size, 0);
  await h.click(h.w.document.querySelector('.hub-showcase-controls button[aria-pressed]'));
  assert.match(h.w.document.querySelector('.hub-showcase-identity').textContent, /参加者2/);
  assert.equal(timers.size, 1);
  await React.act(async () => { [...timers.values()][0](); await pause(); });
  assert.match(h.w.document.querySelector('.hub-showcase-identity').textContent, /参加者0/);
  await h.click(h.w.document.querySelector('.hub-showcase-controls button[aria-pressed]'));
  assert.equal(timers.size, 0);
});

test('動きを減らす設定でも明示的な再生は動き、画面外とバックグラウンドでは止まる', async t => {
  let observer;
  class Observer {
    constructor(callback) { observer = callback; }
    observe() { observer([{ isIntersecting: true }]); }
    disconnect() {}
  }
  const h = await sceneFixture(t, { globals: { IntersectionObserver: Observer } }), timers = playbackFixture(h);
  h.w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  const { ParticipantShowcase } = h.load('src/hub-participant-showcase.tsx');
  await h.render(ParticipantShowcase, { people: playbackPeople });
  assert.equal(timers.size, 0);
  assert.match(h.w.document.querySelector('.hub-showcase-controls').textContent, /再生/);
  await h.click(h.w.document.querySelector('.hub-showcase-controls button[aria-pressed]'));
  assert.equal(timers.size, 1);
  assert.equal(h.w.document.querySelector('.hub-showcase').dataset.motion, 'off');
  await React.act(async () => { [...timers.values()][0](); await pause(); });
  assert.match(h.w.document.querySelector('.hub-showcase-identity').textContent, /参加者2/);
  await React.act(async () => {
    Object.defineProperty(h.w.document, 'visibilityState', { configurable: true, value: 'hidden' });
    h.w.document.dispatchEvent(new h.w.Event('visibilitychange')); await pause();
  });
  assert.equal(timers.size, 0);
  await React.act(async () => {
    Object.defineProperty(h.w.document, 'visibilityState', { configurable: true, value: 'visible' });
    h.w.document.dispatchEvent(new h.w.Event('visibilitychange')); await pause();
  });
  assert.equal(timers.size, 1);
  await React.act(async () => { observer([{ isIntersecting: false }]); await pause(); });
  assert.equal(timers.size, 0);
  await React.act(async () => { observer([{ isIntersecting: true }]); await pause(); });
  assert.equal(timers.size, 1);
});

test('円グラフは正確な構成比と合計を保ち、棒グラフの未取得値を0にしない', async t => {
  const h = await sceneFixture(t), { InsightDonut } = h.load('src/insight-donut.tsx'), { InsightColumns } = h.load('src/member-insight-analysis-charts.tsx');
  await h.render(InsightDonut, { label: '内訳', items: [{ label: 'A', value: 25 }, { label: 'B', value: 75 }] });
  assert.equal(h.w.document.querySelector('.donut-object text').textContent, '100');
  const buttons = h.w.document.querySelectorAll('.insight-donut-legend');
  assert.match(buttons[0].textContent, /25\.0%/); assert.match(buttons[1].textContent, /75\.0%/);
  await h.click(buttons[0]); assert.equal(h.w.document.querySelector('.donut-object text').textContent, '25');
  await h.render(InsightColumns, { label: '日別', items: [{ label: 'A', value: 25 }, { label: 'B', value: 75 }, { label: '未取得', value: null }, { label: 'ゼロ', value: 0 }] });
  const bars = [...h.w.document.querySelectorAll('.insight-column-front')];
  assert.equal(bars.length, 2);
  assert.ok(Math.abs(Number(bars[0].getAttribute('height')) * 3 - Number(bars[1].getAttribute('height'))) < 1e-6);
  const unknown = h.w.document.querySelector('g[aria-label="未取得 未取得"]');
  assert.match(unknown.textContent, /—|未取得/); assert.equal(unknown.querySelector('.insight-column-front'), null);
});
