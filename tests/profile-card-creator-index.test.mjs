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

async function creatorRuntime(t, names = creatorNames, { requestMutator, ...options } = {}) {
  const r = await runtime({ ...options, count: names.length, requestMutator(url, payload) {
    const match = new URL(url).pathname.match(/\/creators\/quality_person_(\d+)$/);
    if (match) {
      payload.data.creator.nickname = names[Number(match[1])];
      payload.data.creator.profile = profiles[Number(match[1])];
    }
    return requestMutator ? requestMutator(url, payload) : payload;
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


function sectionNodes(doc, name) {
  const start = doc.findIndex(node => node.type === 'heading' && node.content[0].text === name);
  assert.ok(start >= 0, `missing creator heading ${name}`);
  const end = doc.findIndex((node, i) => i > start && node.type === 'horizontal_rule');
  assert.ok(end > start, `missing divider for ${name}`);
  return doc.slice(start, end + 1);
}

test('a verified blank bio and missing article artwork each keep their author through pause and reload, while a confirmed empty article list is excluded', { skip: !dependencies || !katex }, async t => {
  const r = await creatorRuntime(t, ['あい', 'いお', 'うみ', 'えま'], { noThumbIndex: 1, noArticleIndex: 3, requestMutator(url, payload) {
    if (new URL(url).pathname.endsWith('/creators/quality_person_0')) payload.data.creator.profile = '';
    return payload;
  } });
  const dom = withRealFormulaRenderer(r);
  t.after(() => dom.window.close());
  r.state.pauseAt = 1;
  await r.editor.createFixed300(historyOptions);
  const paused = r.editor.readRun();
  assert.equal(paused?.paused, true, r.state.statuses.at(-1)?.text);
  assert.deepEqual(Array.from(paused.rows, row => row.creator), ['あい', 'いお', 'うみ']);
  const before = r.doc().content;
  const short = sectionNodes(before, 'あい');
  assert.deepEqual(short.map(node => node.type), ['heading', 'image', 'horizontal_rule']);
  assert.equal(short[1].attrs.link, paused.rows[0].url);
  assert.equal(short[1].content?.length || 0, 0);
  const refreshed = await r.reload();
  t.after(() => refreshed.close());
  const freshDom = withRealFormulaRenderer(refreshed);
  t.after(() => freshDom.window.close());
  await refreshed.editor.createFixed300();
  const run = refreshed.editor.readRun();
  assert.equal(run.stage, 'images_ready', refreshed.state.statuses.at(-1)?.text);
  assert.equal(run.items.length, 3);
  assert.equal(refreshed.state.serial, 3);
  assert.deepEqual(sectionNodes(refreshed.doc().content, 'あい'), short);
  const noArt = sectionNodes(refreshed.doc().content, 'いお');
  assert.deepEqual(noArt.map(node => node.type), ['heading', 'paragraph', 'image', 'horizontal_rule']);
  assert.equal(noArt[2].attrs.link, 'https://note.com/quality_person_1/n/n000000000002');
  assert.equal(noArt[2].content?.length || 0, 0);
  assert.equal(run.rows[1].articleThumbnailMissing, true);
  assert.equal(run.rows[1].thumbUrl || '', '');
});

test('the newest accessible public article belongs to the creator when a more recent listed article was removed', { skip: !dependencies || !katex }, async t => {
  const removedKey = 'naaaaaaaaaab0';
  const olderKey = 'n000000000001';
  const r = await creatorRuntime(t, ['あい'], { requestMutator(url, payload) {
    const path = new URL(url).pathname;
    if (path.endsWith('/creators/quality_person_0/contents') && payload.data.contents.length) {
      const older = payload.data.contents[0];
      const removed = { ...older, key: removedKey, name: '消えた記事', publishAt: '2026-10-15T01:00:00Z', noteUrl: 'https://note.com/quality_person_0/n/' + removedKey };
      payload.data = { contents: [removed, older], totalCount: 2, isLastPage: true };
    }
    if (path.endsWith('/creators/quality_person_0')) payload.data.creator.noteCount = 2;
    if (path.endsWith('/notes/' + removedKey)) throw Object.assign(new Error('GET 404 ' + url), { status: 404 });
    return payload;
  } });
  await r.editor.createFixed300(historyOptions);
  const run = r.editor.readRun();
  assert.equal(run?.stage, 'images_ready', r.state.statuses.at(-1)?.text);
  assert.equal(run.rows.length, 1);
  assert.equal(run.rows[0].url, 'https://note.com/quality_person_0/n/' + olderKey);
  assert.equal(sectionNodes(r.doc().content, 'あい').find(node => node.type === 'image').attrs.link, run.rows[0].url);
  assert.ok(r.state.requests.some(url => url.includes(removedKey)));
});

test('a temporary outage cannot finish the index with a missing author, and reopening continues the same likes period', { skip: !dependencies || !katex }, async t => {
  let unavailable = true;
  const r = await creatorRuntime(t, ['あい', 'いお'], { requestMutator(url, payload) {
    if (unavailable && url.includes('/creators/quality_person_1/contents')) throw Object.assign(new Error('GET 503 ' + url), { status: 503 });
    return payload;
  } });
  await r.editor.createFixed300(historyOptions);
  assert.notEqual(r.editor.readRun()?.stage, 'images_ready');
  assert.equal(r.state.serial, 0);
  assert.equal(r.state.statuses.at(-1).bad, true);
  const prep = r.page.__MUMEI_PROFILE_CARD_PREP_STORE__.read();
  assert.ok(prep.creatorIndexBridge.people.some(row => row.urlname === 'quality_person_1'));
  assert.ok(!prep.skipped?.some(row => row.urlname === 'quality_person_1'));
  const fresh = await r.reload();
  t.after(() => fresh.close());
  unavailable = false;
  fresh.editor.patch('globalThis.resumeIndex = resumeFixed300;');
  await fresh.c.resumeIndex();
  const run = fresh.editor.readRun();
  assert.equal(run?.stage, 'images_ready', fresh.state.statuses.at(-1)?.text);
  assert.deepEqual(plain(run.historyFilter), period);
  assert.deepEqual(Array.from(run.rows, row => row.creator), ['あい', 'いお']);
  assert.equal(fresh.state.serial, 2);
});

test('an empty first listing cannot exclude a creator whose owned profile still reports published articles', { skip: !dependencies }, async t => {
  const r = await creatorRuntime(t, ['あい', 'いお'], { noArticleIndex: 1, requestMutator(url, payload) {
    if (new URL(url).pathname.endsWith('/creators/quality_person_1')) payload.data.creator.noteCount = 4;
    return payload;
  } });
  await r.editor.createFixed300(historyOptions);
  const run = r.editor.readRun();
  const prep = r.page.__MUMEI_PROFILE_CARD_PREP_STORE__.read();
  if (run?.stage === 'images_ready') {
    const author = run.rows.find(row => row.urlname === 'quality_person_1');
    assert.ok(author, 'a previously nonzero creator can only complete with an actual owned article');
    assert.match(author.url, /^https:\/\/note\.com\/quality_person_1\/n\/n[a-f0-9]{12}$/);
  } else {
    assert.equal(r.state.statuses.at(-1).bad, true);
  }
  assert.ok(!prep.skipped?.some(row => row.urlname === 'quality_person_1'));
});

test('permanent artwork errors try the original image URL and retain a title card, and temporary artwork outages resume without duplicate uploads', { skip: !dependencies }, async t => {
  const r = await creatorRuntime(t, ['あい', 'いお']);
  r.c.imageAttempts = [];
  r.editor.patch(`
    const normalBitmap = bitmapFromUrl;
    bitmapFromUrl = async url => {
      const parsed = new URL(url);
      if (/\\/thumb[01]\\.png$/.test(parsed.pathname)) {
        imageAttempts.push(url);
        if (parsed.pathname.endsWith('/thumb0.png')) throw Error('GET 404 ' + url);
        if (parsed.pathname.endsWith('/thumb1.png')) throw Object.assign(Error('通信失敗 ' + url), { code: 'REQUEST_FAILED' });
      }
      return normalBitmap(url);
    };
  `);
  await r.editor.createFixed300(historyOptions);
  const run = r.editor.readRun();
  assert.ok(run, r.state.statuses.at(-1)?.text);
  assert.notEqual(run.stage, 'images_ready');
  assert.equal(run.items.length, 1);
  assert.equal(run.rows.length, 2);
  assert.equal(r.state.statuses.at(-1).bad, true);
  const card = sectionNodes(r.doc().content, 'あい').find(node => node.type === 'image');
  assert.equal(card.attrs.link, run.rows[0].url);
  const firstArtwork = Array.from(r.c.imageAttempts, value => new URL(value)).filter(url => url.pathname.endsWith('/thumb0.png'));
  assert.ok(firstArtwork.some(url => url.searchParams.has('width')));
  assert.ok(firstArtwork.some(url => !url.search));
  const fresh = await r.reload();
  t.after(() => fresh.close());
  await fresh.editor.createFixed300();
  assert.equal(fresh.editor.readRun().stage, 'images_ready', fresh.state.statuses.at(-1)?.text);
  assert.equal(fresh.state.serial, 2);
  assert.equal(sectionNodes(fresh.doc().content, 'あい').find(node => node.type === 'image').attrs.id, card.attrs.id);
  assert.equal(sectionNodes(fresh.doc().content, 'いお').find(node => node.type === 'image').attrs.link, run.rows[1].url);
});

test('a temporary article-detail failure recovers the same newest article from its canonical public page', { skip: !dependencies }, async t => {
  const canonical = 'https://note.com/quality_person_0/n/n000000000001';
  const r = await creatorRuntime(t, ['あい'], { requestMutator(url, payload) {
    if (new URL(url).pathname === '/api/v3/notes/n000000000001') throw Object.assign(Error('GET 503 ' + url), { status: 503 });
    return payload;
  } });
  r.c.canonical = canonical;
  r.c.publicPageReads = [];
  r.editor.patch(`
    const readOtherURL = xhr;
    xhr = async (url, ...args) => {
      if (url.split('?')[0] !== canonical) return readOtherURL(url, ...args);
      publicPageReads.push(url);
      return '<!doctype html><html><head><link rel="canonical" href="' + canonical + '"><meta property="og:title" content="公開中の作品"><meta property="og:image" content="https://assets.st-note.com/thumb0.png"></head><body><article><h1>公開中の作品</h1><p>季節の写真を紹介します。</p></article></body></html>';
    };
  `);
  await r.editor.createFixed300(historyOptions);
  const run = r.editor.readRun();
  assert.ok(r.c.publicPageReads.length > 0, r.state.statuses.at(-1)?.text);
  assert.equal(run?.stage, 'images_ready', r.state.statuses.at(-1)?.text);
  assert.equal(run.rows[0].url, canonical);
  assert.equal(sectionNodes(r.doc().content, 'あい').find(node => node.type === 'image').attrs.link, canonical);
});

async function completedLegacyIndex(t) {
  const r = await creatorRuntime(t, ['あい', 'いお', 'うみ'], { requestMutator(url, payload) {
    if (new URL(url).pathname.endsWith('/creators/quality_person_1')) payload.data.creator.profile = '';
    return payload;
  } });
  const storage = r.page.__MUMEI_PROFILE_CARD_PREP_STORE__;
  const original = storage.read();
  const fullBridge = original.creatorIndexBridge;
  const previouslySkipped = fullBridge.people[1];
  storage.write({ ...original, creatorIndexBridge: { ...fullBridge, people: fullBridge.people.filter(person => person.urlname !== previouslySkipped.urlname) } });
  await storage.flush();
  await r.editor.createFixed300(historyOptions);
  const run = r.editor.readRun();
  assert.equal(run?.stage, 'images_ready', r.state.statuses.at(-1)?.text);
  assert.equal(run.items.length, 2);
  const { creatorIndexCoverage: oldCoverage, ...legacyRun } = run;
  const { creatorIndexCoverage: oldPrepCoverage, ...legacyPrep } = storage.read();
  r.editor.writeRun({ ...legacyRun, version: '2.9.69' });
  storage.write({ ...legacyPrep, creatorIndexBridge: fullBridge, index: 3, signature: fullBridge.at + '|all|creator-index-v1|latest',
    skipped: [{ urlname: previouslySkipped.urlname, likerKey: previouslySkipped.likerKey, code: 'PROFILE_UNAVAILABLE', reason: 'プロフィール未設定' }] });
  await storage.flush();
  await r.page.__MUMEI_PROFILE_CARD_RUN_STORE__.flush();
  return r;
}

test('resuming a completed legacy index inserts the previously skipped creator between intact entries without re-uploading either original', { skip: !dependencies }, async t => {
  const r = await completedLegacyIndex(t);
  const before = r.doc().content;
  const fresh = await r.reload();
  t.after(() => fresh.close());
  fresh.editor.patch('globalThis.recoverIndex = resumeFixed300;');
  await fresh.c.recoverIndex();
  const run = fresh.editor.readRun();
  assert.equal(run?.stage, 'images_ready', fresh.state.statuses.at(-1)?.text);
  assert.equal(run.creatorIndexCoverage, 2);
  assert.deepEqual(Array.from(run.rows, row => row.creator), ['あい', 'いお', 'うみ']);
  const after = fresh.doc().content;
  assert.deepEqual(after.filter(node => node.type === 'heading').map(node => node.content[0].text), ['あい', 'いお', 'うみ']);
  for (const name of ['あい', 'うみ']) assert.deepEqual(sectionNodes(after, name), sectionNodes(before, name));
  assert.deepEqual(sectionNodes(after, 'いお').map(node => node.type), ['heading', 'image', 'horizontal_rule']);
  assert.equal(fresh.state.serial, 3);
  await fresh.c.recoverIndex();
  assert.equal(fresh.state.serial, 3);
  assert.deepEqual(fresh.doc().content, after);
});

test('a manually edited old section blocks legacy gap insertion and preserves the entire draft', { skip: !dependencies }, async t => {
  const r = await completedLegacyIndex(t);
  let imagePos;
  r.view.state.doc.forEach((node, pos) => { if (imagePos === undefined && node.type.name === 'image') imagePos = pos; });
  const image = r.view.state.doc.nodeAt(imagePos);
  const edited = image.type.create(image.attrs, r.schema.text('自分で追記したキャプション'));
  r.view.dispatch(r.view.state.tr.replaceWith(imagePos, imagePos + image.nodeSize, edited));
  const before = r.doc();
  const fresh = await r.reload();
  t.after(() => fresh.close());
  fresh.editor.patch('globalThis.recoverIndex = resumeFixed300;');
  await fresh.c.recoverIndex();
  assert.equal(fresh.state.statuses.at(-1).bad, true);
  assert.equal(fresh.state.serial, 2);
  assert.deepEqual(fresh.doc(), before);
});

test('a verified newest unpinned post on the first newest-first page finishes without loading a creator’s older pages', { skip: !dependencies }, async t => {
  const r = await creatorRuntime(t, ['あい'], { requestMutator(url, payload) {
    const u = new URL(url);
    if (u.pathname.endsWith('/creators/quality_person_0/contents')) {
      if (Number(u.searchParams.get('page')) > 1) throw Error('unexpected older page');
      payload.data.contents = payload.data.contents.map(note => ({ ...note, isPinned: false }));
      payload.data.isLastPage = false;
      payload.data.totalCount = 600;
    }
    if (u.pathname.endsWith('/creators/quality_person_0')) payload.data.creator.noteCount = 600;
    return payload;
  } });
  await r.editor.createFixed300(historyOptions);
  assert.equal(r.editor.readRun()?.stage, 'images_ready', r.state.statuses.at(-1)?.text);
  assert.equal(sectionNodes(r.doc().content, 'あい').find(node => node.type === 'image').attrs.link, 'https://note.com/quality_person_0/n/n000000000001');
  assert.ok(!r.state.requests.some(value => { const u = new URL(value); return u.pathname.endsWith('/contents') && Number(u.searchParams.get('page')) > 1; }));
});

test('a held unpublished section can refresh its name and continue with a verified article lacking both bio and artwork', { skip: !dependencies || !katex }, async t => {
  let retry = false;
  const r = await creatorRuntime(t, ['A', 'B', 'C'], { requestMutator(url, payload) {
    const path = new URL(url).pathname;
    if (retry && path.endsWith('/creators/quality_person_1')) {
      payload.data.creator.nickname = 'Z';
      payload.data.creator.profile = '';
    }
    if (retry && path.endsWith('/notes/n000000000002')) {
      payload.data.eyecatch = null;
      payload.data.eyecatch_url = null;
      payload.data.user.profile = '';
    }
    return payload;
  } });
  const dom = withRealFormulaRenderer(r);
  t.after(() => dom.window.close());
  r.state.pauseAt = 1;
  await r.editor.createFixed300(historyOptions);
  const paused = r.editor.readRun();
  assert.equal(paused?.items?.length, 1, r.state.statuses.at(-1)?.text);
  const row = paused.rows[1];
  const identity = { account: row.urlname, key: row.key, url: row.url };
  r.editor.writeRun({ ...paused, qualityHold: {
    version: 1, kind: 'source', phase: 'images', index: 1, identity, articleKey: paused.articleKey, runId: paused.createdAt,
    reasons: [{ code: 'PROFILE_ACCOUNT', expected: row.urlname, actual: 'another_creator' }],
  } });
  retry = true;
  r.state.pauseAt = 0;
  await r.editor.createFixed300();
  const result = r.editor.readRun();
  assert.equal(result.stage, 'images_ready', r.state.statuses.at(-1)?.text);
  assert.ok(!result.qualityHold);
  assert.deepEqual(Array.from(result.rows, row => row.creator), ['A', 'C', 'Z']);
  assert.equal(result.items[0].id, paused.items[0].id);
  const refreshed = result.rows[2];
  assert.equal(refreshed.creatorIndexKey.display, 'Z');
  assert.equal(refreshed.creatorIndexProfileMissing, true);
  assert.equal(refreshed.articleThumbnailMissing, true);
  assert.equal(refreshed.thumbnailMissingEvidence.articleUrl, row.url);
  const blocks = r.doc().content;
  const heading = blocks.findIndex(block => block.type === 'heading' && block.content[0].text === 'Z');
  assert.deepEqual(blocks.slice(heading, heading + 3).map(block => block.type), ['heading', 'image', 'horizontal_rule']);
  assert.equal(blocks[heading + 1].attrs.link, row.url);
});

test('unavailable creator listings can recover from an RSS article and verify its author using the public article detail', { skip: !dependencies }, async t => {
  const canonical = 'https://note.com/quality_person_0/n/n000000000001';
  const r = await creatorRuntime(t, ['あい'], { requestMutator(url, payload) {
    if (new URL(url).pathname.endsWith('/creators/quality_person_0/contents')) throw Error('GET 503 ' + url);
    return payload;
  } });
  r.c.feedDocument = `<rss version="2.0"><channel><title>あい</title><item><title>写真日記</title><link>${canonical}</link><pubDate>Wed, 01 Jan 2025 00:00:00 GMT</pubDate></item></channel></rss>`;
  r.c.readFeeds = [];
  r.editor.patch(`
    const fetchOther = xhr;
    xhr = async (url, ...args) => {
      if (url !== 'https://note.com/quality_person_0/rss') return fetchOther(url, ...args);
      readFeeds.push(url);
      return feedDocument;
    };
  `);
  await r.editor.createFixed300(historyOptions);
  const run = r.editor.readRun();
  assert.equal(run?.stage, 'images_ready', r.state.statuses.at(-1)?.text);
  assert.equal(r.c.readFeeds.length, 1);
  assert.equal(run.rows[0].url, canonical);
  assert.ok(r.state.requests.some(value => new URL(value).pathname === '/api/v3/notes/n000000000001'));
});
