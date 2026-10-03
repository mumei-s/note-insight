import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { resolve, dirname } from 'node:path';

export const pause = () => new Promise(resolve => setImmediate(resolve));
export async function sceneFixture(t, { fetch = async () => Response.json({ items: [] }), globals = {} } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://mumei-s.github.io/note-insight/', pretendToBeVisual: true }), w = dom.window;
  for (const key of ['window', 'document', 'localStorage', 'HTMLElement', 'Element', 'navigator']) Object.defineProperty(globalThis, key, { value: w[key], configurable: true, writable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(w.document.getElementById('root')), modules = new Map();
  function load(file) {
    const path = resolve(file);
    if (modules.has(path)) return modules.get(path);
    const exports = {}; modules.set(path, exports);
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(compiled, { exports, require(name) { if (name === 'react') return React; if (name === 'react/jsx-runtime') return jsx; if (name.endsWith('.css')) return {}; return load(resolve(dirname(path), name + (name.includes('visible-motion') ? '.ts' : '.tsx'))); }, window: w, document: w.document, localStorage: w.localStorage, fetch, URL, AbortController, setTimeout, clearTimeout, console, ...globals }, { filename: path });
    return exports;
  }
  t.after(async () => { await React.act(async () => root.unmount()); w.close(); });
  return { w, root, load, render: async (Component, props) => { await React.act(async () => { root.render(React.createElement(Component, props)); await pause(); }); }, click: async el => { await React.act(async () => { el.click(); await pause(); }); }, change: async (el, value) => { await React.act(async () => { Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new w.Event('input', { bubbles: true })); await pause(); }); } };
}
