import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const guard = readFileSync('public/insight-editor-isolation.js', 'utf8');
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('installed legacy v2.1 bridge is removed before use, without altering INSIGHT or starting capture', async () => {
  const dom = new JSDOM('<main id="root"><h1>INSIGHT TOP</h1></main><nav id="owner-nav">管理</nav>', {
    url: 'https://mumei-s.github.io/note-insight/?like300prep=1&keep=1#dashboard', runScripts: 'outside-only'
  });
  const w = dom.window;
  w.localStorage.setItem('mumei-insight-access-token', 'saved-session');
  const root = w.document.getElementById('root'), before = root.outerHTML;
  let requests = 0, writes = 0;
  w.fetch = () => { requests++; throw Error('unexpected capture'); };
  w.GM_setValue = () => { writes++; };
  w.unsafeWindow = w;
  w.eval(guard);
  const legacy = readFileSync('tests/fixtures/legacy-like300-bridge-v210.js', 'utf8');
  w.eval(legacy);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  await settle();
  assert.equal(w.document.getElementById('mumei-like300-bridge'), null);
  assert.equal(root.outerHTML, before);
  assert.equal(w.localStorage.getItem('mumei-insight-access-token'), 'saved-session');
  assert.equal(new URL(w.location.href).searchParams.get('keep'), '1');
  assert.equal(w.location.hash, '#dashboard');
  assert.equal(new URL(w.location.href).searchParams.has('like300prep'), false);
  assert.equal(requests, 0); assert.equal(writes, 0);
  // A second delayed injection and an ordinary app update cannot recreate the panel.
  const late = w.document.createElement('div'); late.innerHTML = '<div id="mumei-like300-fix">旧版</div>';
  w.document.body.appendChild(late);
  root.appendChild(w.document.createElement('section'));
  await settle();
  assert.equal(w.document.getElementById('mumei-like300-fix'), null);
  assert.equal(root.children.length, 2);
  assert.ok(w.document.getElementById('owner-nav'));
  dom.window.close();
});

test('isolation is inactive in the editor, where the tool is allowed', () => {
  const dom = new JSDOM('<div id="mumei-profile-card-paster-v1">紹介</div>', { url: 'https://editor.note.com/notes/n123/edit', runScripts: 'outside-only' });
  const before = dom.window.document.body.innerHTML;
  dom.window.eval(guard);
  assert.equal(dom.window.document.body.innerHTML, before);
  dom.window.close();
});

test('unrelated promise rejection preserves the app and never recreates a recovery screen during handoff', async () => {
  const html = readFileSync('index.html', 'utf8');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  const dom = new JSDOM('<div id="root"><main>INSIGHT TOP</main></div>', { url: 'https://mumei-s.github.io/note-insight/', runScripts: 'outside-only' });
  const w = dom.window, root = w.document.getElementById('root');
  w.eval(inline);
  w.dispatchEvent(new w.Event('unhandledrejection'));
  assert.equal(root.textContent, 'INSIGHT TOP');
  root.replaceChildren();
  w.dispatchEvent(new w.Event('unhandledrejection'));
  assert.equal(w.document.getElementById('insight-static-boot'), null);
  assert.equal(root.children.length, 0, 'an optional error must leave the React-owned root alone');
  await settle();
  assert.equal(w.document.getElementById('insight-static-boot'), null);
  dom.window.close();
});
