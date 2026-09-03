// ==UserScript==
// @name         note ポン出し v16｜共同マガジン現行ルール照合版
// @namespace    https://github.com/mumei-s/note-insight
// @version      16.0.0
// @description  正本一覧から共同マガジンを取得。オーナー本人の固定記事と紹介欄を別々に照合し、食い違いは両グループ掲載。note標準カードなので後から手動削除可能。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @connect      raw.githubusercontent.com
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v14.user.js
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v16.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v16.user.js
// ==/UserScript==
(() => {
'use strict';
if (window.__MUMEI_PON_V16_ADDON__) return;
window.__MUMEI_PON_V16_ADDON__ = true;

const MASTER = 'https://note.com/ss_yr/n/nca7a49a69d3c';
const LEGACY_DATA = 'https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v15.user.js';
const BLOCK = new Set(['m535c97031825']);
const SPECIAL = {
  m752f734f7a1c: { fixed: {type:'count', count:4} },
  ma4dad1f25900: { fixed: {type:'count', count:3}, desc: {type:'count', count:2} },
  m8d6e2d4322c8: { fixed: {type:'count', count:2} }
};

const key = u => (String(u).match(/\/m\/(m[a-z0-9]+)/i) || [])[1] || '';
const owner = u => { try { return new URL(u).pathname.split('/').filter(Boolean)[0] || ''; } catch { return ''; } };
const get = url => new Promise((resolve, reject) => GM_xmlhttpRequest({
  method: 'GET', url, timeout: 22000,
  onload: r => r.status < 400 ? resolve(r.responseText) : reject(Error('HTTP ' + r.status)),
  onerror: () => reject(Error('通信失敗')),
  ontimeout: () => reject(Error('timeout'))
}));

function legacyRows(src) {
  const m = String(src).match(/const FALLBACK=`([\s\S]*?)`\.trim\(\)\.split/);
  if (!m) return [];
  return m[1].trim().split('\n').map((s, i) => {
    const p = s.lastIndexOf('|');
    return p > 0 ? {title:s.slice(0,p), url:s.slice(p+1), index:i} : null;
  }).filter(Boolean);
}

async function fallbackRows() {
  try { return legacyRows(await get(LEGACY_DATA)); } catch { return []; }
}

async function masterRows() {
  const fb = await fallbackRows();
  try {
    const html = await get(MASTER);
    const dom = new DOMParser().parseFromString(html, 'text/html');
    const root = dom.querySelector('article') || dom.body;
    const seen = new Set();
    const rows = [];
    for (const a of root.querySelectorAll('a[href]')) {
      let url;
      try { url = new URL(a.getAttribute('href'), 'https://note.com').href.split('?')[0]; } catch { continue; }
      if (!/^https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test(url) || seen.has(url)) continue;
      seen.add(url);
      const old = fb.find(x => x.url === url);
      rows.push({title:old?.title || a.textContent.trim(), url, index:rows.length});
    }
    if (rows.length >= 70) return rows;
  } catch {}
  return fb;
}

function descriptionFromHtml(html, magazineKey) {
  const at = html.indexOf(magazineKey);
  const region = at >= 0 ? html.slice(Math.max(0, at - 90000), Math.min(html.length, at + 140000)) : html;
  const re = /["']description["']\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let m, best = '';
  while ((m = re.exec(region))) {
    try {
      const v = JSON.parse('"' + m[1] + '"');
      if (v.length > best.length && v.length < 14000) best = v;
    } catch {}
  }
  return best;
}

function ownerFixedUrl(dom, ownerName) {
  const nodes = [...dom.querySelectorAll('body *')];
  const mark = nodes.find(e => e.children.length === 0 && /固定された記事/.test(e.textContent.trim()));
  if (!mark) return null;
  const links = [...dom.querySelectorAll('a[href]')];
  for (const a of links) {
    if (!(mark.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    const href = a.getAttribute('href') || '';
    if (!/\/[A-Za-z0-9_-]+\/n\/n[a-z0-9]+/i.test(href)) continue;
    let url;
    try { url = new URL(href, 'https://note.com').href.split('?')[0]; } catch { continue; }
    if (owner(url) === ownerName) return url;
    return null;
  }
  return null;
}

function articleText(html) {
  const dom = new DOMParser().parseFromString(html, 'text/html');
  dom.querySelectorAll('del,s,strike,[style*="line-through"]').forEach(e => e.remove());
  return (dom.querySelector('article')?.innerText || dom.body?.innerText || dom.body?.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const digit = t => String(t || '').replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
function limit(text) {
  let t = digit(text)
    .replace(/\[[^\]]*(?:例|example)[^\]]*\]/gi, ' ')
    .replace(/［[^］]*(?:例|example)[^］]*］/gi, ' ')
    .replace(/\s+/g, ' ');
  const counts = [];
  let m;
  let re = /(?:1日|一日)(?:あたり|当たり|の)?[^。]{0,48}?(\d+)\s*[〜～~\-]\s*(\d+)\s*(?:本|記事|投稿|回|件)/g;
  while ((m = re.exec(t))) counts.push(Math.max(+m[1], +m[2]));
  re = /(?:1日|一日)(?:あたり|当たり|の)?[^。]{0,48}?(\d+)\s*(?:本|記事|投稿|回|件)/g;
  while ((m = re.exec(t))) counts.push(+m[1]);
  if (counts.length) return {type:'count', count:Math.max(...counts)};
  if (/(?:1日|一日)[^。]{0,50}?(?:上限|制限)[^。]{0,18}?(?:なし|ありません|ない|無い)/.test(t) ||
      /(?:投稿数|投稿回数|追加本数|記事追加|投稿|寄稿)[^。]{0,36}?(?:無制限|制限なし|上限なし)/.test(t)) {
    return {type:'unlimited'};
  }
  return null;
}

function paidProhibited(text) {
  const t = digit(text).replace(/\s+/g, ' ');
  return /(?:有料記事|有料note)[^。]{0,24}(?:禁止|不可|NG|ご遠慮)/i.test(t) || /(?:無料記事のみ|無料の記事のみ)/.test(t);
}

function sameRule(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  return a.type !== 'count' || a.count === b.count;
}
function ruleText(r) {
  if (!r) return '表記なし';
  if (r.type === 'unlimited') return '無制限';
  if (r.type === 'count') return `1日${r.count}記事`;
  return '表記なし';
}

async function inspect(row) {
  const k = key(row.url), o = owner(row.url);
  let title = row.title, fixed = null, desc = '', fixedText = '';
  try {
    const html = await get(row.url);
    const dom = new DOMParser().parseFromString(html, 'text/html');
    title = [...dom.querySelectorAll('h1')].map(e => e.textContent.trim()).find(Boolean) || title;
    desc = descriptionFromHtml(html, k);
    fixed = ownerFixedUrl(dom, o);
    if (fixed) {
      try { fixedText = articleText(await get(fixed)); } catch {}
    }
  } catch {}

  let fixedRule = limit(fixedText);
  let descRule = limit(desc);
  const sp = SPECIAL[k];
  if (!fixedRule && sp?.fixed) fixedRule = sp.fixed;
  if (!descRule && sp?.desc) descRule = sp.desc;

  const rules = [];
  if (BLOCK.has(k)) {
    rules.push({type:'blocked'});
  } else {
    if (fixedRule) rules.push(fixedRule);
    if (descRule && !rules.some(r => sameRule(r, descRule))) rules.push(descRule);
    if (!rules.length) rules.push({type:'none'});
  }

  const conflict = fixedRule && descRule && !sameRule(fixedRule, descRule)
    ? `固定記事：${ruleText(fixedRule)}／紹介欄：${ruleText(descRule)}`
    : '';

  return {
    ...row, title, fixed, fixedRule, descRule, rules, conflict,
    paid: paidProhibited(fixedText) || paidProhibited(desc)
  };
}

async function inspectAll(rows, show) {
  const out = new Array(rows.length);
  let cursor = 0, done = 0;
  await Promise.all(Array.from({length:6}, async () => {
    while (true) {
      const i = cursor++;
      if (i >= rows.length) return;
      out[i] = await inspect(rows[i]);
      show(`取得 ${++done}/${rows.length}`);
    }
  }));
  return out;
}

const transmissionOrder = title => title === 'トランスミッション' ? 1 : /[２2]$/.test(title) ? 2 : /[３3]$/.test(title) ? 3 : 0;
function ordered(items) {
  const a = [...items].sort((x,y) => x.index - y.index);
  const tr = a.filter(x => transmissionOrder(x.title)).sort((x,y) => transmissionOrder(x.title) - transmissionOrder(y.title));
  if (tr.length < 2) return a;
  const first = Math.min(...tr.map(x => a.indexOf(x)));
  const rest = a.filter(x => !tr.includes(x));
  rest.splice(first, 0, ...tr);
  return rest;
}

function groupKey(rule) { return rule.type === 'count' ? rule.count : rule.type; }
function label(g) {
  if (g === 'unlimited') return '♾️ 無制限';
  if (g === 'none') return '制限数表記なし';
  if (g === 'blocked') return '🚫 記事追加不可';
  return `${g === 10 ? '🔟' : g + '️⃣'} 1日${g}記事まで`;
}

function buildSource(items) {
  const groups = new Map();
  for (const item of items) {
    for (const rule of item.rules) {
      const g = groupKey(rule);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(item);
    }
  }
  const numeric = [...groups.keys()].filter(x => typeof x === 'number').sort((a,b) => b-a);
  const order = [];
  if (groups.has('unlimited')) order.push('unlimited');
  order.push(...numeric);
  if (groups.has('none')) order.push('none');
  if (groups.has('blocked')) order.push('blocked');

  const out = [];
  for (const g of order) {
    out.push(`# ${label(g)}`, '');
    for (const item of ordered(groups.get(g))) {
      out.push(`## ${item.title}`, '');
      if (item.conflict) out.push(item.conflict, '');
      if (item.paid) out.push('有料記事追加不可', '');
      out.push(item.url, '');
      if (item.fixed) out.push(item.fixed, '');
      out.push('---', '');
    }
  }
  return out.join('\n').trim();
}

function install() {
  const root = document.getElementById('__mumei_pon_v14_root__');
  if (!root) return setTimeout(install, 300);
  document.getElementById('ponMags15')?.remove();
  const panel = root.querySelector('#ponPanel14');
  const src = root.querySelector('#ponSrc14');
  const status = root.querySelector('#ponStatus14');
  const add = root.querySelector('#ponAdd14');
  const head = root.querySelector('#ponDrag14 b');
  if (head) head.textContent = '↔️ ポン出し v16';
  if (!panel || panel.querySelector('#ponMags16')) return;

  const button = document.createElement('button');
  button.id = 'ponMags16';
  button.textContent = '📚 共マガ一覧を追記＋全カード化';
  button.style.cssText = 'display:block;width:100%;border:0;border-radius:8px;padding:9px 5px;background:#ffd54a;color:#261f00;font-weight:900;font-size:11px;margin-bottom:5px';
  panel.insertBefore(button, src);

  button.onclick = async () => {
    if (button.disabled) return;
    button.disabled = true;
    try {
      status.textContent = '正本一覧を取得…';
      const rows = await masterRows();
      if (!rows.length) throw Error('正本一覧を取得できません');
      const items = await inspectAll(rows, t => status.textContent = t);
      src.value = buildSource(items);
      status.textContent = `${items.length}誌を追記＋カード化（作成後は各カードを手動削除可）`;
      add.click();
    } catch (e) {
      status.textContent = '❌ ' + (e?.message || e);
    } finally {
      button.disabled = false;
    }
  };

  let n = 0;
  const timer = setInterval(() => {
    document.getElementById('ponMags15')?.remove();
    if (++n > 20) clearInterval(timer);
  }, 500);
}
install();
})();