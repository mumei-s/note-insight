import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const windows = new WeakMap();

// Run the real browser modules and their relative TypeScript imports. ModuleKind.None
// only worked before these entry points imported the shared update-return adapter.
export function browserSourceModule(w, file) {
  let state = windows.get(w);
  if (!state) {
    const scope = { window: w, document: w.document, location: w.location, history: w.history,
      localStorage: w.localStorage, sessionStorage: w.sessionStorage, navigator: w.navigator,
      MutationObserver: w.MutationObserver, Element: w.Element, HTMLElement: w.HTMLElement, Node: w.Node,
      Event: w.Event, CustomEvent: w.CustomEvent, URL: w.URL, URLSearchParams: w.URLSearchParams,
      Response, AbortController, console, fetch: (...args) => w.fetch(...args),
      setTimeout: w.setTimeout.bind(w), clearTimeout: w.clearTimeout.bind(w),
    };
    // Match index.html: the shared browser helper precedes the application modules.
    vm.runInNewContext(readFileSync('public/insight-update-return.js', 'utf8'), scope,
      { filename: 'public/insight-update-return.js' });
    state = { scope, modules: new Map() };
    windows.set(w, state);
  }
  const path = resolve(file);
  if (state.modules.has(path)) return state.modules.get(path);
  const exports = {};
  state.modules.set(path, exports);
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, { ...state.scope, exports, require(name) {
    if (!name.startsWith('./') && !name.startsWith('../')) throw new Error('Unsupported browser module: ' + name);
    const dependency = resolve(dirname(path), name);
    return browserSourceModule(w, dependency + (extname(dependency) ? '' : '.ts'));
  } }, { filename: path });
  return exports;
}
