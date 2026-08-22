import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

// Build revision 2: run from the latest Direct notification verifier commit.

const ROOT = process.cwd();
const URL_FILE = path.join(ROOT, 'data', 'note-summer-magazine-107-urls.txt');
const OUT_DIR = path.join(ROOT, 'public', 'note-summer-107');
const CARD_DIR = path.join(OUT_DIR, 'cards');
const WIDTH = 860;
const HEIGHT = 140;
const EXPECTED = 107;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeHtml(value = '') {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'",
    nbsp: ' ', laquo: '«', raquo: '»'
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (_, entity) => {
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
  for (let match; (match = re.exec(tag));) {
    output[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? '');
  }
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
  let value = title.trim();
  for (const suffix of [
    `｜${creator}｜note`, ` | ${creator} | note`, `｜${creator}｜note（ノート）`,
    '｜note', ' | note'
  ]) {
    if (creator && value.endsWith(suffix)) value = value.slice(0, -suffix.length).trim();
  }
  return value;
}

async function fetchRetry(url, asBuffer = false) {
  let last;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; MumeiNoteCardBuilder/1.0)',
          accept: asBuffer ? 'image/avif,image/webp,image/png,image/jpeg,*/*' : 'text/html,*/*'
        },
        redirect: 'follow'
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return asBuffer ? Buffer.from(await response.arrayBuffer()) : await response.text();
    } catch (error) {
      last = error;
      if (attempt < 4) await sleep(attempt * 1000);
    }
  }
  throw new Error(`取得失敗 ${url}: ${last?.message || last}`);
}

function noteKey(url) {
  const match = url.match(/\/n\/(n[a-z0-9]+)(?:[/?#]|$)/i);
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

  const html = await fetchRetry(url);
  const meta = metas(html);
  const apiCreator = apiNote?.user?.nickname || apiNote?.user?.name || '';
  const creator = (apiCreator || meta.get('author') || meta.get('note:creator') ||
    meta.get('twitter:data2') || new URL(url).pathname.split('/')[1]).trim();
  const rawTitle = apiNote?.name || meta.get('og:title') || meta.get('twitter:title') || '';
  const title = apiNote?.name ? rawTitle.trim() : stripTitleSuffix(rawTitle, creator);
  const thumbUrl = apiNote?.eyecatch_url || apiNote?.eyecatch ||
    meta.get('og:image') || meta.get('twitter:image') || '';
  if (!title) throw new Error(`${index}: タイトル取得失敗 ${url}`);
  if (!creator) throw new Error(`${index}: クリエイター取得失敗 ${url}`);
  if (!thumbUrl) throw new Error(`${index}: サムネ取得失敗 ${url}`);
  return { index, key, url, title, creator, thumbUrl };
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[char]);
}

function charUnits(char) {
  return /^[\x00-\xff]$/.test(char) ? 0.55 : 1;
}

function wrap(text, maxUnits = 27, maxLines = 3) {
  const chars = [...text];
  const lines = [];
  let line = '';
  let units = 0;
  for (const char of chars) {
    const next = charUnits(char);
    if (line && units + next > maxUnits) {
      lines.push(line);
      line = char;
      units = next;
      if (lines.length === maxLines - 1) break;
    } else {
      line += char;
      units += next;
    }
  }
  if (lines.length < maxLines) {
    const used = lines.join('').length;
    let rest = [...text].slice(used).join('');
    let restUnits = [...rest].reduce((sum, char) => sum + charUnits(char), 0);
    while (rest.length && restUnits > maxUnits - 1) {
      const removed = [...rest].pop();
      rest = [...rest].slice(0, -1).join('');
      restUnits -= charUnits(removed);
    }
    if (used + [...rest].length < chars.length) rest += '…';
    if (rest) lines.push(rest);
  }
  return lines.slice(0, maxLines);
}

async function makeCard(item) {
  const imageBuffer = await fetchRetry(item.thumbUrl, true);
  const thumb = await sharp(imageBuffer)
    .rotate()
    .resize(320, 124, { fit: 'contain', background: '#f7f8fa' })
    .png()
    .toBuffer();
  const titleLines = wrap(item.title);
  const titleSvg = titleLines.map((line, i) =>
    `<text x="16" y="${30 + i * 24}" class="title">${escapeXml(line)}</text>`
  ).join('');
  const svg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
      <rect x="1" y="1" width="858" height="138" rx="12" fill="#fff" stroke="#d9dde3" stroke-width="1.5"/>
      <style>
        .title{font-family:'Noto Sans CJK JP','Noto Sans JP',sans-serif;font-size:18px;font-weight:700;fill:#171b21}
        .creator{font-family:'Noto Sans CJK JP','Noto Sans JP',sans-serif;font-size:14px;font-weight:400;fill:#626975}
      </style>
      ${titleSvg}
      <text x="16" y="125" class="creator">${escapeXml(item.creator)}</text>
      <rect x="532" y="8" width="320" height="124" rx="8" fill="#f7f8fa"/>
    </svg>`);
  const outputPath = path.join(CARD_DIR, `${String(item.index).padStart(3, '0')}.png`);
  await sharp(svg)
    .composite([{ input: thumb, left: 532, top: 8 }])
    .png({ compressionLevel: 9, palette: false })
    .toFile(outputPath);
  const info = await sharp(outputPath).metadata();
  if (info.width !== WIDTH || info.height !== HEIGHT) {
    throw new Error(`${item.index}: サイズ不正 ${info.width}x${info.height}`);
  }
  return {
    ...item,
    width: WIDTH,
    height: HEIGHT,
    cardPath: `/note-summer-107/cards/${String(item.index).padStart(3, '0')}.png`
  };
}

async function main() {
  const urls = (await fs.readFile(URL_FILE, 'utf8')).split(/\r?\n/)
    .map((value) => value.trim()).filter(Boolean);
  if (urls.length !== EXPECTED) throw new Error(`URL件数 ${urls.length}/${EXPECTED}`);
  if (new Set(urls).size !== EXPECTED) throw new Error('URL重複あり');
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(CARD_DIR, { recursive: true });

  const manifest = [];
  for (let i = 0; i < urls.length; i += 1) {
    process.stdout.write(`[${i + 1}/${EXPECTED}] ${urls[i]}\n`);
    const data = await article(urls[i], i + 1);
    manifest.push(await makeCard(data));
    await sleep(120);
  }

  await fs.writeFile(path.join(OUT_DIR, 'manifest.json'),
    `${JSON.stringify({
      magazineUrl: 'https://note.com/ai_naoyuki/m/m7ffeddfdfb3c',
      count: manifest.length,
      width: WIDTH,
      height: HEIGHT,
      generatedAt: new Date().toISOString(),
      items: manifest
    }, null, 2)}\n`);
  await fs.writeFile(path.join(OUT_DIR, 'READY.txt'),
    `107/107 READY\n${WIDTH}x${HEIGHT}\nURL UNIQUE ${new Set(manifest.map((item) => item.url)).size}\n`);
  process.stdout.write(`READY ${manifest.length}/${EXPECTED}\n`);
}

await main();
