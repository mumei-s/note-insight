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

test('隠れていたメンバーも全員を常時表示し、光のレールから人物と本人noteを切り替える', async t => {
  const h = await sceneFixture(t), { ParticipantShowcase } = h.load('src/hub-participant-showcase.tsx');
  const people = Array.from({ length: 8 }, (_, i) => ({ id: `${i}`, noteId: `person_${i}`, name: `参加者${i}`, image: `https://example.com/${i}.png`, profileUrl: `https://note.com/person_${i}` }));
  await h.render(ParticipantShowcase, { people });
  assert.equal(h.w.document.querySelectorAll('.hub-showcase-all a').length, 8);
  assert.equal(h.w.document.querySelector('.hub-showcase-all details'), null);
  assert.equal(h.w.document.querySelector('.hub-showcase-all').hasAttribute('hidden'), false);
  await h.click(h.w.document.querySelector('[aria-label="次のクリエイター"]'));
  assert.match(h.w.document.querySelector('.hub-showcase-identity').textContent, /参加者1/);
  assert.equal(h.w.document.querySelector('.hub-showcase-focus').href, 'https://note.com/person_1');
  assert.match(h.w.document.querySelector('.hub-showcase-controls').textContent, /再生/);
  assert.equal(h.w.document.querySelector('.hub-showcase-card'), null);
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
