import {gzipSync, gunzipSync} from 'node:zlib';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const archive = join(root, 'review-kit.enc.json');
const context = Buffer.from('mumeis-note-review-kit/archive/v2');
const [mode = 'unpack', input] = process.argv.slice(2);
const manifestName = 'sources.json';

function safeName(name) {
  return typeof name === 'string' && /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.ー一-龯ぁ-ゖァ-ヺ]+$/.test(name)
    && name.split('/').every(part => !part.startsWith('.'));
}
async function privateKey() {
  if (!process.env.REVIEW_BUILD_KEY_FILE) throw new Error('Set REVIEW_BUILD_KEY_FILE.');
  const raw = (await readFile(process.env.REVIEW_BUILD_KEY_FILE, 'utf8')).trim();
  const key = Buffer.from(raw,'base64');
  if (key.length !== 32 || key.toString('base64') !== raw) throw new Error('Invalid build key.');
  return key;
}
function decode(envelope, key) {
  if (envelope.version !== 2 || envelope.algorithm !== 'AES-256-GCM') throw new Error('Unknown package.');
  const decrypt = createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));
  decrypt.setAAD(context);
  decrypt.setAuthTag(Buffer.from(envelope.tag,'base64'));
  const clear = Buffer.concat([decrypt.update(Buffer.from(envelope.data,'base64')),decrypt.final()]);
  return JSON.parse(gunzipSync(clear,{maxOutputLength: 12 * 1024 * 1024}).toString('utf8'));
}
const key = await privateKey();
if (mode === 'pack' && input) {
  const dir = resolve(input);
  const names = JSON.parse(await readFile(join(dir, manifestName),'utf8'));
  if (!Array.isArray(names) || !names.length || !names.every(safeName)) throw new Error('Invalid manifest.');
  const files = {};
  for (const name of [...new Set(names)].sort()) files[name] = (await readFile(join(dir,name))).toString('base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(context);
  const data = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(files)))),cipher.final()]);
  const envelope = {version:2, algorithm:'AES-256-GCM',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
  const tmp = archive + '.tmp';
  await writeFile(tmp, JSON.stringify(envelope)+'\n', {mode:0o600});
  await rename(tmp, archive);
} else if (mode === 'unpack') {
  const dir = resolve(input || join(root, '.private'));
  const files = decode(JSON.parse(await readFile(archive,'utf8')),key);
  const names = Object.keys(files);
  if (!names.length || !names.every(safeName)) throw new Error('Invalid package.');
  try { await stat(dir); throw new Error('Choose a new, empty destination path.'); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
  await mkdir(dir,{recursive:true,mode:0o700});
  for (const name of names) {
    const dest = join(dir,name);
    await mkdir(dirname(dest),{recursive:true,mode:0o700});
    await writeFile(dest,Buffer.from(files[name],'base64'),{flag:'wx',mode:0o600});
  }
  await writeFile(join(dir,manifestName),JSON.stringify(names,null,2)+'\n',{mode:0o600});
} else {
  throw new Error('Usage: node build.mjs unpack [new-dir] | pack <source-dir>');
}
