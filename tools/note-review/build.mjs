import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const envelopePath = join(root, 'review-core.enc.json');
const output = join(root, '.worker');
const aad = Buffer.from('note-review/core/v1');
const [command, sourceArg] = process.argv.slice(2);

async function readKey() {
  const file = process.env.REVIEW_BUILD_KEY_FILE;
  if (!file) throw new Error('Set REVIEW_BUILD_KEY_FILE to your private key file.');
  const text = (await readFile(file, 'utf8')).trim();
  const key = Buffer.from(text, 'base64');
  if (key.length !== 32 || key.toString('base64') !== text) throw new Error('Expected a base64 32-byte build key.');
  return key;
}

function openEnvelope(input, key) {
  const envelope = JSON.parse(input);
  if (envelope.v !== 1 || envelope.alg !== 'A256GCM') throw new Error('Unsupported envelope format.');
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid envelope.');
  const decrypt = createDecipheriv('aes-256-gcm', key, iv);
  decrypt.setAAD(aad);
  decrypt.setAuthTag(tag);
  return Buffer.concat([decrypt.update(Buffer.from(envelope.data, 'base64')), decrypt.final()]);
}

function allowedPrivateName(name) {
  return name === 'engine.mjs' || name === 'protected-example.mjs' || /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*\.test\.mjs$/.test(name);
}

async function seal(source, key) {
  const names = (await readdir(source)).filter(allowedPrivateName).sort();
  if (!names.includes('engine.mjs') || !names.includes('engine.test.mjs')) throw new Error('Private core and tests are required.');
  const files = {};
  for (const name of names) files[name] = await readFile(join(source, name), 'utf8');
  if (!files['protected-example.mjs']) {
    const { example } = await import(pathToFileURL(join(source, 'ui.mjs')).href);
    if (!example || typeof example.draft !== 'string' || typeof example.evidence !== 'string') throw new Error('Private example is missing.');
    files['protected-example.mjs'] = 'export const example = ' + JSON.stringify(example, null, 2) + ';\n';
  }
  const plain = Buffer.from(JSON.stringify(files));
  try {
    if (openEnvelope(await readFile(envelopePath, 'utf8'), key).equals(plain)) return;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  const envelope = { v: 1, alg: 'A256GCM', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
  const temp = envelopePath + '.tmp';
  await writeFile(temp, JSON.stringify(envelope) + '\n', { flag: 'wx' });
  await rename(temp, envelopePath);
}

async function build(key) {
  const files = JSON.parse(openEnvelope(await readFile(envelopePath, 'utf8'), key));
  if (!['engine.mjs', 'engine.test.mjs', 'protected-example.mjs'].every(name => Object.hasOwn(files, name))) throw new Error('Required modules are missing.');
  if (Object.entries(files).some(([name, value]) => !allowedPrivateName(name) || typeof value !== 'string')) throw new Error('Invalid entries in envelope.');
  await rm(output, { force: true, recursive: true });
  await mkdir(output, { mode: 0o700 });
  try {
    for (const [name, code] of Object.entries(files)) {
      await writeFile(join(output, name), code, { flag: 'wx', mode: 0o600 });
    }
    const publicFiles = ['auth.mjs', 'ui.mjs', 'worker.mjs', 'schema.sql', 'protect-build.mjs'];
    for (const name of publicFiles) await copyFile(join(root, name), join(output, name));
    const settings = process.env.REVIEW_RULE_KEY_FILE;
    const ruleKey = settings ? (await readFile(settings, 'utf8')).trim() : process.env.RULE_KEY;
    if (!ruleKey) throw new Error('Set REVIEW_RULE_KEY_FILE or RULE_KEY for the Worker.');
    const { bundleEngine } = await import('./protect-build.mjs');
    const protectedCode = await bundleEngine(files['engine.mjs'], ruleKey);
    await writeFile(join(output, 'protected-core.mjs'), protectedCode + '\nexport { getEngine };\n', { flag: 'wx', mode: 0o600 });
  } catch (e) {
    await rm(output, { recursive: true, force: true });
    throw e;
  }
}

try {
  const key = await readKey();
  if (command === 'seal' && sourceArg) await seal(resolve(sourceArg), key);
  else if (command === 'build' && !sourceArg) await build(key);
  else throw new Error('Use build or seal <private-source-directory>.');
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
