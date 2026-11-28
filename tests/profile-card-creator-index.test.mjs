import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { dependencies, runtime } from './fixtures/profile-card-quality-runtime.mjs';

const require = createRequire(import.meta.url);
let katex;
try { katex = require(process.env.KATEX_TEST_MODULE || 'katex'); } catch {}

const period = { fromDate: '2026-11-24', toDate: '2026-11-25', articleKey: '', timezone: 'Asia/Tokyo' };
const plain = value => JSON.parse(JSON.stringify(value));
const historyOptions = { creatorIndex: true, mode: 'all', count: 0, target: Infinity, choice: 'latest', historyFilter: period };
const creatorNames = ['Beta', 'アオ', 'あかり', 'Alpha'];
const profiles = ["日本語と記号 {猫} 50% #旅 $100・S's / `code` -- 文", 'A_B & C^2 \\ Z ~ 空', '一行目です。\n二行目です。', '四季の写真を撮ります。'];

function withRealFormulaRenderer(r, transform = formula => formula) {
  const dom = new JSDOM('<!doctype html><main></main>');
  r.c.katex = katex;
  r.page.katex = katex;
  const article = dom.window.document.querySelector('main');
  r.view.dom = article;
  r.view.nodeDOM = position => {
    const block = r.view.state.doc.nodeAt(position);
    if (!block) return null;
    const node = dom.window.document.createElement(block.type.name === 'image' ? 'figure' : 'p');
    if (block.textContent.startsWith('$$')) {
      node.innerHTML = katex.renderToString(transform(block.textContent.slice(2, -2)), { displayMode: true, throwOnError: false, strict: 'ignore' });
    } else {
      node.textContent = block.textContent;
    }
    article.append(node);
    return node;
  };
  return dom;
}

async function creatorRuntime(t, names = creatorNames) {
  const r = await runtime({ count: names.length, requestMutator(url, payload) {
    const match = new URL(url).pathname.match(/\/creators\/quality_person_(\d+)$/);
    if (match) {
      payload.data.creator.nickname = names[Number(match[1])];
      payload.data.creator.profile = profiles[Number(match[1])];
    }
    return payload;
  } });
  t.after(() => r.close());
  const people = r.people.slice(0, names.length).map((person, index) => ({ ...person,
    creator: names[index], likedArticleKey: 'n123456789abc', likedAt: '2026-11-24T02:00:00.000Z' }));
  people.push({ ...people[0], likedArticleKey: 'n987654321abc', likedAt: '2026-11-25T09:30:00.000Z' });
  const bridge = { creatorIndex: true, historyFilter: period, scope: 'filtered-likes', choice: 'latest', at: 1000, people };
  r.page.__MUMEI_PROFILE_CARD_PREP_STORE__.write({ creatorIndex: true, creatorIndexBridge: bridge, historyFilter: period, choice: 'latest' });
  await r.page.__MUMEI_PROFILE_CARD_PREP_STORE__.flush();
  return r;
}

function checkDocument(r, run) {
  assert.equal(run.stage, 'images_ready', r.state.statuses.at(-1)?.text);
  assert.equal(run.creatorIndex, true);
  assert.equal(run.items.length, creatorNames.length);
  assert.deepEqual(Array.from(run.rows, row => row.creator), ['アオ', 'あかり', 'Alpha', 'Beta']);
  const document = r.doc().content;
  const headings = document.map((node, index) => ({ node, index })).filter(({ node }) => node.type === 'heading');
  assert.deepEqual(headings.map(({ node }) => node.content[0].text), Array.from(run.rows, row => row.creator));
  assert.equal(document.filter(node => node.type === 'image').length, headings.length);
  assert.equal(document.filter(node => node.type === 'horizontal_rule').length, headings.length);
  for (const [i, { index }] of headings.entries()) {
    const row = run.rows[i];
    const [profile, image, divider] = document.slice(index + 1, index + 4);
    assert.equal(profile.type, 'paragraph');
    const literal = profile.content[0].text;
    assert.ok(literal.startsWith('$$') && literal.endsWith('$$') && literal.includes('\\boxed'));
    const html = katex.renderToString(literal.slice(2, -2), { throwOnError: true, strict: 'ignore' });
    assert.ok(html.includes('class="katex-html"'));
    assert.equal(image.type, 'image');
    assert.equal(image.attrs.link, row.url);
    assert.equal(image.content?.length || 0, 0);
    assert.equal(divider.type, 'horizontal_rule');
    if (i + 1 < headings.length) assert.equal(headings[i + 1].index, index + 4);
  }
}

test('creator index preset starts the exact JST range independent of other panel choices', { skip: !dependencies }, async t => {
  const r = await runtime();
  t.after(() => r.close());
  const dom = new JSDOM('<section id="mumei-profile-card-paster-v1"><select data-mode><option selected value="number">number</option></select><input data-count value="1"><button class="on" data-choice="oldest"></button><details><div class="special-actions"></div></details></section>');
  t.after(() => dom.window.close());
  r.c.document = dom.window.document;
  const panel = r.c.document.querySelector('section');
  r.c.panel = panel;
  r.editor.patch(`restartFixed300 = options => globalThis.started = options; patchHistoryFilterPanel(panel, panel.querySelector('details'));`);
  panel.querySelector('[data-a="history-nov-index"]').click();
  assert.deepEqual(plain(r.c.started.historyFilter), period);
  assert.equal(r.c.started.target, Infinity);
  assert.equal(r.c.started.choice, 'latest');
  assert.equal(r.c.started.creatorIndex, true);
  assert.equal(panel.querySelector('[data-count]').value, '1');
  assert.equal(panel.querySelector('[data-history-period]').value, 'all');
});

test('creator index keeps unique accounts over 300 and sorts on readings, then Latin names', { skip: !dependencies }, async t => {
  const r = await runtime();
  t.after(() => r.close());
  r.editor.patch('globalThis.namesApi = { sortCreatorIndexRows, uniquePeople };');
  const { uniquePeople, sortCreatorIndexRows } = r.c.namesApi;
  const many = Array.from({ length: 341 }, (_, i) => ({ urlname: 'account_' + i, likerKey: 'id-' + i }));
  many.push({ ...many[0], urlname: 'ACCOUNT_0' }, { ...many[1], urlname: 'renamed_account' });
  assert.equal(uniquePeople(many, true).length, 341);
  const names = [ ['aa', '日本', 'にほん'], ['bb', 'Zelda'], ['cc', '愛', 'あい'], ['dd', 'アオ'], ['ee', 'Apple'], ['ff', 'うみ'] ];
  const rows = names.map(([urlname, creator, creatorReading]) => ({ urlname, creator, creatorReading }));
  assert.deepEqual(Array.from(sortCreatorIndexRows(rows), row => row.creator), ['愛', 'アオ', 'うみ', '日本', 'Apple', 'Zelda']);
  assert.equal(rows[0].creator, '日本');
});

test('creator headings, escaped boxed profile, linked captionless image and native divider survive pause/reload', { skip: !dependencies || !katex }, async t => {
  const r = await creatorRuntime(t);
  const dom = withRealFormulaRenderer(r);
  t.after(() => dom.window.close());
  r.state.pauseAt = 1;
  await r.editor.createFixed300(historyOptions);
  const paused = r.editor.readRun();
  assert.equal(paused?.paused, true, r.state.statuses.at(-1)?.text);
  assert.equal(paused.count, creatorNames.length);
  const fresh = await r.reload();
  t.after(() => fresh.close());
  const freshDom = withRealFormulaRenderer(fresh);
  t.after(() => freshDom.window.close());
  await fresh.editor.createFixed300();
  checkDocument(fresh, fresh.editor.readRun());
  const copied = fresh.doc();
  await fresh.editor.createFixed300();
  assert.deepEqual(fresh.doc(), copied);
});

test('a KaTeX parse error on the pasted profile prevents the next creator and completion', { skip: !dependencies || !katex }, async t => {
  const r = await creatorRuntime(t);
  const dom = withRealFormulaRenderer(r, () => '\\notARealKatexCommand{');
  t.after(() => dom.window.close());
  await r.editor.createFixed300(historyOptions);
  const run = r.editor.readRun();
  assert.ok(run);
  assert.notEqual(run.stage, 'images_ready');
  assert.ok(r.state.images.length <= 1);
  assert.equal(r.state.statuses.at(-1).bad, true);
  assert.match(r.state.statuses.at(-1).text, /KaTeX|数式|コード|プロフィール/);
  const savedImageId = r.doc().content.find(node => node.type === 'image')?.attrs.id;
  const fresh = await r.reload();
  t.after(() => fresh.close());
  const freshDom = withRealFormulaRenderer(fresh);
  t.after(() => freshDom.window.close());
  await fresh.editor.createFixed300();
  checkDocument(fresh, fresh.editor.readRun());
  assert.equal(fresh.doc().content.find(node => node.type === 'image')?.attrs.id, savedImageId);
  assert.equal(fresh.state.serial, creatorNames.length);
});


test('distinct accounts with the same name keep separate headings and changing a completed divider blocks resumption', { skip: !dependencies || !katex }, async t => {
  const r = await creatorRuntime(t, ['あお', 'あお']);
  const dom = withRealFormulaRenderer(r);
  t.after(() => dom.window.close());
  r.state.pauseAt = 1;
  await r.editor.createFixed300(historyOptions);
  const paused = r.editor.readRun();
  assert.equal(paused?.paused, true, r.state.statuses.at(-1)?.text);
  assert.equal(paused.rows.length, 2);
  assert.equal(paused.rows[0].creator, paused.rows[1].creator);
  assert.notEqual(paused.rows[0].urlname, paused.rows[1].urlname);
  let dividerPos;
  r.view.state.doc.forEach((node, pos) => { if (node.type.name === 'horizontal_rule') dividerPos = pos; });
  assert.equal(typeof dividerPos, 'number');
  r.view.dispatch(r.view.state.tr.replaceWith(dividerPos, dividerPos + 1, r.para('手書きの追記')));
  const edited = r.doc();
  r.state.pauseAt = 0;
  await r.editor.createFixed300();
  assert.equal(r.state.statuses.at(-1).bad, true);
  assert.match(r.state.statuses.at(-1).text, /区切り線/);
  assert.deepEqual(r.doc(), edited);
  assert.equal(r.state.serial, 1);
  r.view.dispatch(r.view.state.tr.replaceWith(dividerPos, dividerPos + r.view.state.doc.nodeAt(dividerPos).nodeSize, r.schema.nodes.horizontal_rule.create()));
  await r.editor.createFixed300();
  assert.equal(r.editor.readRun().stage, 'images_ready');
  assert.deepEqual(r.doc().content.filter(node => node.type === 'heading').map(node => node.content[0].text), ['あお', 'あお']);
});

test('a rendered formula is checked against note’s source annotation and visible padded text width', { skip: !dependencies || !katex }, async t => {
  const r = await runtime();
  t.after(() => r.close());
  r.editor.patch('globalThis.inspectFormula = inspectCreatorIndexRender;');
  const dom = new JSDOM('<!doctype html><main style="padding: 0 10px; border-width: 0"><p></p></main>');
  t.after(() => dom.window.close());
  const root = dom.window.document.querySelector('main');
  const p = root.querySelector('p');
  const formula = '$${\\boxed{\\text{青}}}$$';
  p.innerHTML = katex.renderToString(formula.slice(3, -3), { strict: 'ignore' });
  const html = p.querySelector('.katex-html');
  const rect = (left, right) => ({ left, right, top: 40, bottom: 72, width: right - left, height: 32 });
  root.getBoundingClientRect = () => rect(8, 312);
  html.getBoundingClientRect = () => rect(28, 282);
  const view = { dom: root, nodeDOM: () => p };
  assert.equal(r.c.inspectFormula(view, 1, formula), true);
  html.getBoundingClientRect = () => rect(28, 319);
  assert.throws(() => r.c.inspectFormula(view, 1, formula), /表示幅/);
  html.getBoundingClientRect = () => rect(28, 282);
  const annotation = p.querySelector('annotation');
  annotation.textContent = '他のプロフィール';
  assert.throws(() => r.c.inspectFormula(view, 1, formula), /一致/);
  annotation.remove();
  assert.throws(() => r.c.inspectFormula(view, 1, formula), /一致/);
});
