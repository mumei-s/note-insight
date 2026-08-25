import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ROOT = process.cwd();
const [urlFileArg, outDirArg, expectedArg, batchIdArg] = process.argv.slice(2);
if (!urlFileArg || !outDirArg || !expectedArg || !batchIdArg) {
  throw new Error('usage: node build-note-batch-cards.mjs URL_FILE OUT_DIR EXPECTED BATCH_ID');
}

const URL_FILE = path.resolve(ROOT, urlFileArg);
const OUT_DIR = path.resolve(ROOT, outDirArg);
const PUBLIC_DIR = path.resolve(ROOT, 'public');
const CARD_DIR = path.join(OUT_DIR, 'cards');
const EXPECTED = Number(expectedArg);
const BATCH_ID = batchIdArg;
const WIDTH = 860;
const HEIGHT = 140;
const PUBLIC_PREFIX = `/${path.relative(PUBLIC_DIR, OUT_DIR).split(path.sep).join('/')}`;
const URL_RE = /^https:\/\/note\.com\/[A-Za-z0-9_]+\/n\/n[a-f0-9]{12}$/;

if (!Number.isSafeInteger(EXPECTED) || EXPECTED < 1) throw new Error(`EXPECTED不正: ${expectedArg}`);
if (!OUT_DIR.startsWith(`${PUBLIC_DIR}${path.sep}`) || OUT_DIR === PUBLIC_DIR) throw new Error(`OUT_DIR不正: ${OUT_DIR}`);
if (!/^[a-z0-9-]+$/.test(BATCH_ID)) throw new Error(`BATCH_ID不正: ${BATCH_ID}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeHtml(value = '') {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    }
    return named[entity.toLowerCase()] ?? _;
  });
}

function attrs(tag) {
  const output = {};
  const re = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (let match; (match = re.exec(tag));) output[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? '');
  return output;
}

function metas(html) {
  const output = new Map();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const item = attrs(match[0]);
    const key = (item.property || item.name || '').toLowerCase();
    if (key && item.content && !output.has(key)) output.set(key, item.content.trim());
  }
  return output;
}

function stripTitleSuffix(title, creator) {
  let value = String(title || '').trim();
  for (const suffix of [`｜${creator}｜note`, ` | ${creator} | note`, `｜${creator}｜note（ノート）`, '｜note', ' | note']) {
    if (creator && value.endsWith(suffix)) value = value.slice(0, -suffix.length).trim();
  }
  return value;
}

async function fetchRetry(url, asBuffer = false) {
  let last;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; MumeiNoteBatchBuilder/2.0)',
          accept: asBuffer ? 'image/avif,image/webp,image/png,image/jpeg,*/*' : 'text/html,application/json,*/*'
        },
        redirect: 'follow'
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return asBuffer ? Buffer.from(await response.arrayBuffer()) : await response.text();
    } catch (error) {
      last = error;
      if (attempt < 5) await sleep(attempt * 1200);
    }
  }
  throw new Error(`取得失敗 ${url}: ${last?.message || last}`);
}

function noteKey(url) {
  const match = url.match(/\/n\/(n[a-f0-9]{12})$/i);
  if (!match) throw new Error(`記事URL不正: ${url}`);
  return match[1];
}

async function article(url, index) {
  const key = noteKey(url);
  let apiNote = null;
  try {
    const payload = JSON.parse(await fetchRetry(`https://note.com/api/v3/notes/${key}`));
    apiNote = payload?.data || payload;
  } catch (_) {}

  let creator = String(apiNote?.user?.nickname || apiNote?.user?.name || '').trim();
  let title = String(apiNote?.name || '').trim();
  let thumbUrl = String(apiNote?.eyecatch_url || apiNote?.eyecatch || '').trim();
  if (!creator || !title || !thumbUrl) {
    const meta = metas(await fetchRetry(url));
    creator ||= String(meta.get('author') || meta.get('note:creator') || meta.get('twitter:data2') || new URL(url).pathname.split('/')[1]).trim();
    const rawTitle = meta.get('og:title') || meta.get('twitter:title') || '';
    title ||= stripTitleSuffix(rawTitle, creator);
    thumbUrl ||= String(meta.get('og:image') || meta.get('twitter:image') || '').trim();
  }
  if (thumbUrl.startsWith('//')) thumbUrl = `https:${thumbUrl}`;
  if (!title) throw new Error(`${index}: タイトル取得失敗 ${url}`);
  if (!creator) throw new Error(`${index}: クリエイター取得失敗 ${url}`);
  if (!/^https?:\/\//i.test(thumbUrl)) throw new Error(`${index}: サムネ取得失敗 ${url}`);
  return { index, key, url, title, creator, thumbUrl };
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
}

function charUnits(char) { return /^[\x00-\xff]$/.test(char) ? 0.55 : 1; }

function wrap(text, maxUnits = 27, maxLines = 3) {
  const chars = [...String(text)];
  const lines = [];
  let cursor = 0;
  for (let lineNo = 0; lineNo < maxLines && cursor < chars.length; lineNo += 1) {
    let line = '';
    let units = 0;
    while (cursor < chars.length) {
      const next = charUnits(chars[cursor]);
      if (line && units + next > maxUnits) break;
      line += chars[cursor];
      units += next;
      cursor += 1;
    }
    if (lineNo === maxLines - 1 && cursor < chars.length) {
      while (line && units + charUnits('…') > maxUnits) {
        const removed = [...line].pop();
        line = [...line].slice(0, -1).join('');
        units -= charUnits(removed);
      }
      line += '…';
    }
    lines.push(line);
  }
  return lines;
}

async function makeCard(item) {
  const source = await fetchRetry(item.thumbUrl, true);
  const thumb = await sharp(source).rotate().resize(320, 124, { fit: 'contain', background: '#f7f8fa' }).png().toBuffer();
  const titleSvg = wrap(item.title).map((line, i) =>
    `<text x="16" y="${30 + i * 24}" class="title">${escapeXml(line)}</text>`).join('');
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <rect x="1" y="1" width="858" height="138" rx="12" fill="#fff" stroke="#d9dde3" stroke-width="1.5"/>
    <style>.title{font-family:'Noto Sans CJK JP','Noto Sans JP',sans-serif;font-size:18px;font-weight:700;fill:#171b21}.creator{font-family:'Noto Sans CJK JP','Noto Sans JP',sans-serif;font-size:14px;fill:#626975}</style>
    ${titleSvg}<text x="16" y="125" class="creator">${escapeXml(item.creator)}</text>
    <rect x="532" y="8" width="320" height="124" rx="8" fill="#f7f8fa"/>
  </svg>`);
  const name = `${String(item.index).padStart(3, '0')}.png`;
  const outputPath = path.join(CARD_DIR, name);
  await sharp(svg).composite([{ input: thumb, left: 532, top: 8 }]).png({ compressionLevel: 9, palette: false }).toFile(outputPath);
  const info = await sharp(outputPath).metadata();
  if (info.width !== WIDTH || info.height !== HEIGHT || info.format !== 'png') {
    throw new Error(`${item.index}: 出力不正 ${info.format} ${info.width}x${info.height}`);
  }
  return { ...item, width: WIDTH, height: HEIGHT, cardPath: `${PUBLIC_PREFIX}/cards/${name}` };
}

async function main() {
  const urls = (await fs.readFile(URL_FILE, 'utf8')).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const bad = urls.filter((url) => !URL_RE.test(url));
  if (urls.length !== EXPECTED) throw new Error(`URL件数 ${urls.length}/${EXPECTED}`);
  if (new Set(urls).size !== EXPECTED) throw new Error('URL重複あり');
  if (bad.length) throw new Error(`URL形式不正: ${bad.join(', ')}`);
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(CARD_DIR, { recursive: true });

  const manifest = [];
  for (let index = 0; index < urls.length; index += 1) {
    process.stdout.write(`[${index + 1}/${EXPECTED}] ${urls[index]}\n`);
    manifest.push(await makeCard(await article(urls[index], index + 1)));
    await sleep(150);
  }
  const payload = {
    batchId: BATCH_ID, sourceUrlFile: path.relative(ROOT, URL_FILE).split(path.sep).join('/'),
    count: manifest.length, width: WIDTH, height: HEIGHT, generatedAt: new Date().toISOString(), items: manifest
  };
  await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(payload, null, 2)}\n`);
  await fs.writeFile(path.join(OUT_DIR, 'READY.txt'),
    `${manifest.length}/${EXPECTED} READY\n${WIDTH}x${HEIGHT}\nURL UNIQUE ${new Set(manifest.map((item) => item.url)).size}\n`);
  process.stdout.write(`READY ${BATCH_ID} ${manifest.length}/${EXPECTED}\n`);
}

await main();
