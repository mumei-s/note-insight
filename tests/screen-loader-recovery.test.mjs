import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';

function compile(source, extra = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => name === 'react' ? React : jsx, URL, ...extra });
  return exports;
}
const { loadInsightScreen } = compile(readFileSync('src/insight-screen-loader.ts', 'utf8'));

test('a failed chunk is tagged for explicit reload, with no automatic import retry', async () => {
  let calls = 0; const cause = new TypeError('failed to load module');
  await assert.rejects(loadInsightScreen(async () => { calls++; throw cause; }), error => error.name === 'InsightScreenLoadError' && error.cause === cause);
  assert.equal(calls, 1); const value = {}; assert.equal(await loadInsightScreen(async () => value), value);
});

test('actual startup boundary reloads the current route for a chunk failure and retains ordinary in-place retry', () => {
  const ast = ts.createSourceFile('main.tsx', readFileSync('src/main.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const selected = ast.statements.filter(node => (ts.isFunctionDeclaration(node) && node.name?.text === 'startupFailureLabel') || (ts.isClassDeclaration(node) && node.name?.text === 'StartupBoundary')).map(node => node.getText(ast)).join('\n');
  let reloads = 0; const route = 'https://mumei-s.github.io/note-insight/?insightMode=notifications#dashboard';
  const { StartupBoundary } = compile('import { Component } from "react";\n' + selected + '\nexport { StartupBoundary };', { window: { location: { href: route, reload() { reloads++; } } } });
  const boundary = new StartupBoundary({ children: 'saved screen' });
  boundary.setState = patch => { boundary.state = { ...boundary.state, ...patch }; };
  boundary.state = StartupBoundary.getDerivedStateFromError({ name: 'InsightScreenLoadError' });
  let button = boundary.render().props.children.find(child => child?.type === 'button');
  assert.equal(button.props.children, '再読み込み'); assert.equal(reloads, 0); button.props.onClick(); assert.equal(reloads, 1);
  boundary.state = StartupBoundary.getDerivedStateFromError(new TypeError('render failed'));
  button = boundary.render().props.children.find(child => child?.type === 'button'); assert.equal(button.props.children, '再表示');
  button.props.onClick(); assert.equal(reloads, 1); assert.equal(boundary.render(), 'saved screen');
});
