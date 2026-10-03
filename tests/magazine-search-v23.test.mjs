import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const magazine = (id, title, article) => ({ url: `https://note.com/creator/m/${id}`, title, relation: 'owner', owner: { urlname: 'creator', nickname: 'オーナー', profile_image_url: 'https://example.com/owner.png' }, memberCount: 1, noteCount: 50, members: [{ urlname: 'member', nickname: '参加者', image_url: 'https://example.com/member.png' }], recentArticles: [{ key: article, title: article, url: `https://note.com/author/n/${article}`, publishAt: '2026-10-03T12:00:00+09:00', author: { urlname: 'author', nickname: '投稿者', image_url: 'https://example.com/author.png' } }] });
async function fixture(t) {
  const h = await sceneFixture(t), requests = [], rows = [magazine('mA', 'マガジンA', 'Aの記事'), magazine('mB', 'マガジンB', 'Bの記事')];
  const { MemberInsightMagazines } = h.load('src/member-insight-magazines.tsx');
  const search = (params, signal) => new Promise(resolve => requests.push({ params, signal, finish: resolve }));
  await h.render(MemberInsightMagazines, { revision: 0, accountKey: 'tester', history: async () => ({ rows }), search });
  const card = key => h.w.document.querySelector(`[data-magazine-key="${key}"]`), toggle = key => card(key).querySelector('[aria-expanded]'), button = key => [...card(key).querySelectorAll('.miu-calendar-tools button')].find(b => b.textContent === '検索');
  return { ...h, requests, card, toggle, button, finish: async (i, payload) => { await React.act(async () => { requests[i].finish(payload); await pause(); }); } };
}

test('記事検索は押した直後に開閉状態が変わり、保存済み記事と検索中の進行を表示する', async t => {
  const h = await fixture(t);
  await h.click(h.toggle('mA'));
  assert.equal(h.toggle('mA').getAttribute('aria-expanded'), 'true');
  assert.match(h.toggle('mA').textContent, /閉じる/);
  assert.match(h.card('mA').textContent, /Aの記事/);
  assert.ok(h.card('mA').querySelector('.mimag-owner img'));
  assert.ok(h.card('mA').querySelector('.miu-member-faces img'));
  assert.ok(h.card('mA').querySelector('.mimag-author img'));
  await h.click(h.button('mA'));
  assert.match(h.card('mA').querySelector('[role="status"]').textContent, /1件を先に表示/);
  assert.equal(h.requests[0].params.magazineKey, 'mA', 'keyなしの保存行もマガジンURLから識別する');
  await h.finish(0, { rows: [], total: 0 });
  assert.match(h.card('mA').textContent, /検索結果 1件/);
});

test('別マガジンへ移動した後の遅い検索返答を破棄し、再表示でも結果を混ぜない', async t => {
  const h = await fixture(t);
  await h.click(h.toggle('mA')); await h.click(h.button('mA'));
  await h.click(h.toggle('mB'));
  assert.equal(h.requests[0].signal.aborted, true);
  await h.click(h.button('mB'));
  await h.finish(1, { rows: [{ key: 'bnew', title: 'Bの追加記事', url: 'https://note.com/author/n/bnew' }] });
  await h.finish(0, { rows: [{ key: 'old', title: 'Aの遅い返答', url: 'https://note.com/author/n/old' }] });
  assert.match(h.card('mB').textContent, /Bの追加記事/); assert.doesNotMatch(h.card('mB').textContent, /Aの遅い返答/);
  await h.click(h.toggle('mA'));
  assert.match(h.card('mA').textContent, /Aの記事/); assert.doesNotMatch(h.card('mA').textContent, /Bの追加記事|Aの遅い返答/);
});

test('同じマガジンの同じ検索は結果を即時再利用し、条件とエラーをほかの欄へ持ち込まない', async t => {
  const h = await fixture(t);
  await h.click(h.toggle('mA'));
  await h.change(h.card('mA').querySelector('[aria-label="記事タイトル・投稿者"]'), 'A');
  await h.click(h.button('mA'));
  assert.equal(h.requests[0].params.query, 'A');
  await h.finish(0, { rows: [], total: 0 });
  await h.click(h.button('mA')); assert.equal(h.requests.length, 1);
  await h.click(h.toggle('mB')); assert.equal(h.card('mB').querySelector('[aria-label="記事タイトル・投稿者"]').value, '');
  await h.click(h.toggle('mA')); assert.equal(h.card('mA').querySelector('[aria-label="記事タイトル・投稿者"]').value, 'A');
});

test('中止は保存済みの結果を保ち、待機表示を終える', async t => {
  const h = await fixture(t); await h.click(h.toggle('mA')); await h.click(h.button('mA'));
  await h.click([...h.card('mA').querySelectorAll('button')].find(b => b.textContent === '中止'));
  assert.equal(h.requests[0].signal.aborted, true); assert.equal(h.card('mA').querySelector('.mimag-progress'), null); assert.match(h.card('mA').textContent, /Aの記事/);
  await h.finish(0, { rows: [{ title: '中止後の返答' }] }); assert.doesNotMatch(h.card('mA').textContent, /中止後の返答/);
});
