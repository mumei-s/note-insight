// Node build step for a standalone, trusted engine module. The Worker receives no parser or build key.
import {createCipheriv, randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire, globalPaths} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const self = fileURLToPath(import.meta.url);
const unsupported = () => { throw new Error('Expected a standalone module exporting only function review.'); };
const noConstructors = () => { throw new Error('Use regex literals for private patterns in the review engine.'); };

function scanAcorn(source, parser) {
  const ast = parser.parse(source, {sourceType:'module', ecmaVersion:'latest'});
  const exports = ast.body.filter(node => /^(Import|Export)/.test(node.type));
  const node = exports[0];
  if (exports.length !== 1 || node.type !== 'ExportNamedDeclaration'
      || node.declaration?.type !== 'FunctionDeclaration' || node.declaration.id?.name !== 'review') unsupported();
  const literals = [];
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (value.type === 'Literal') {
      if (value.regex) literals.push([value.start, value.end, value.regex.pattern, value.regex.flags]);
      return;
    }
    if (value.type === 'Identifier' && value.name === 'RegExp') noConstructors();
    for (const child of Object.values(value)) walk(child);
  }
  walk(ast);
  return {exportStart:node.start,literals};
}

function scanTypeScript(source, ts) {
  const file = ts.createSourceFile('engine.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  if (file.parseDiagnostics.length) throw new Error('The engine source has a syntax error.');
  const exports = file.statements.filter(node => ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
    || ts.isExportAssignment(node) || node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
  const fn = exports[0];
  if (exports.length !== 1 || !ts.isFunctionDeclaration(fn) || fn.name?.text !== 'review'
      || fn.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)) unsupported();
  const literals = [];
  function visit(node) {
    if (ts.isIdentifier(node) && node.text === 'RegExp') noConstructors();
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      const raw = node.getText(file);
      const closing = raw.lastIndexOf('/');
      literals.push([node.getStart(file), node.end, raw.slice(1,closing), raw.slice(closing+1)]);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return {exportStart:fn.modifiers.find(mod => mod.kind === ts.SyntaxKind.ExportKeyword).getStart(file),literals};
}
function resolveOptional(id) {
  try { return require.resolve(id); } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return null;
  }
}
function scan(source) {
  const acorn = resolveOptional('acorn');
  if (acorn) return scanAcorn(source,require(acorn));
  const tsCandidates = ['typescript', process.env.TYPESCRIPT_PATH,
    resolve(dirname(process.execPath),'../lib/node_modules/typescript'),
    ...globalPaths.map(path => resolve(path,'typescript'))];
  for (const candidate of tsCandidates.filter(Boolean)) {
    const parser = resolveOptional(candidate);
    if (parser) return scanTypeScript(source,require(parser));
  }
  // Node ships Acorn. Only the offline parser subprocess needs access to its internal module.
  // The module text is input to the parser on stdin, never a program passed to the shell.
  const result = execFileSync(process.execPath,['--expose-internals',self,'--scan-with-node-acorn'],
    {input:source,encoding:'utf8',maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe']});
  return JSON.parse(result);
}

function unexportAndProtect(source, scanResult) {
  const {exportStart, literals} = scanResult;
  if (!literals.length || source.includes('__paidRuleAt')) throw new Error('Cannot safely transform this review engine.');
  const edits = [[exportStart, exportStart+'export'.length, '']];
  const table = [];
  const indices = new Map();
  for (const [start,end,pattern,flags] of literals) {
    const key = JSON.stringify([pattern,flags]);
    if (!indices.has(key)) {
      indices.set(key, table.length);
      table.push([pattern,flags]);
    }
    // A fresh RegExp per expression also preserves object identity and g/y lastIndex semantics.
    edits.push([start,end,'__paidRuleAt('+indices.get(key)+')']);
  }
  let output = source;
  for (const [start,end,text] of edits.sort((a,b) => b[0]-a[0]))
    output = output.slice(0,start) + text + output.slice(end);
  return {code:output, table};
}

export function bundleEngine(source, base64key) {
  if (typeof source !== 'string' || typeof base64key !== 'string') throw new Error('Engine source and RULE_KEY required.');
  const key = Buffer.from(base64key,'base64');
  if (key.length !== 32 || key.toString('base64') !== base64key) throw new Error('RULE_KEY must be canonical base64 for 32 bytes.');
  const {code, table} = unexportAndProtect(source,scan(source));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('editor-review/rules/v1'));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(table),'utf8'),cipher.final(),cipher.getAuthTag()]);
  return `
const getEngine = (() => {
  const iv = '${iv.toString('base64')}';
  const encryptedRules = '${ciphertext.toString('base64')}';
  const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  let current = null;
  function materialize(__paidRuleAt) {
${code}
    return {review};
  }
  async function open(base64key) {
    if (typeof base64key !== 'string' || base64key.length !== 44) throw new Error();
    const decoded = bytes(base64key);
    if (decoded.length !== 32 || btoa(String.fromCharCode(...decoded)) !== base64key) throw new Error();
    const key = await crypto.subtle.importKey('raw', decoded, 'AES-GCM', false, ['decrypt']);
    const clear = await crypto.subtle.decrypt({
      name:'AES-GCM', iv:bytes(iv), additionalData:new TextEncoder().encode('editor-review/rules/v1'),
    },key,bytes(encryptedRules));
    const patterns = JSON.parse(new TextDecoder().decode(clear)).map(([s,f]) => new RegExp(s,f));
    return materialize(i => new RegExp(patterns[i]));
  }
  return async function getEngine(base64key) {
    if (current && current.key === base64key) return current.engine;
    const pending = {key:base64key, engine:null};
    pending.engine = open(base64key).catch(() => {
      if (current === pending) current = null;
      throw new Error('Review rules unavailable.');
    });
    current = pending;
    return pending.engine;
  };
})();
`;
}

if (process.argv[1] && resolve(process.argv[1]) === self && process.argv[2] === '--scan-with-node-acorn') {
  const parser = require('internal/deps/acorn/acorn/dist/acorn');
  process.stdout.write(JSON.stringify(scanAcorn(readFileSync(0,'utf8'),parser)));
}
