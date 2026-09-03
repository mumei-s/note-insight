// ==UserScript==
// @name         note ポン出し v18.1｜共同マガジン完全一覧・本数復元版
// @namespace    https://github.com/mumei-s/note-insight
// @version      18.1.0
// @description  正本＋92誌予備を合流し、既知の投稿本数を復元。自分のマガジンは👑表示。マガジン/固定記事のURLとnoteカードを生成。収納対応。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @connect      raw.githubusercontent.com
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v14.user.js
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v18.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v18.user.js
// ==/UserScript==

(() => {
  'use strict';
  if (window.__MUMEI_PON_V181__) return;
  window.__MUMEI_PON_V181__ = true;

  window.__MUMEI_PON_V15_ADDON__ = true;
  window.__MUMEI_PON_V16_ADDON__ = true;
  window.__MUMEI_PON_V171_ADDON__ = true;
  window.__MUMEI_PON_V172_ADDON__ = true;
  window.__MUMEI_PON_V173_ADDON__ = true;
  window.__MUMEI_PON_V18__ = true;

  const MASTER = 'https://note.com/ss_yr/n/nca7a49a69d3c';
  const LEGACY = 'https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v15.user.js';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let noteUrlCommand = null;

  const FB = {
    mf534419e7479:10, m300d06308833:10, m9872a92a8af5:10,
    mbefcb2e5a397:5, m1df0b906bace:5, m74b154cd7893:5, m653e8e82ea44:5,
    m4d9b9698cacf:5, mb028566a46ee:5, md96759f4be5b:5, mb80f5e0f9b99:5,
    m3759ff7a5b9c:5, m9e01fdb0606f:5, ma475a8bdcecc:5, m254cc8180f92:5,
    mba58a6f9aacf:5, m9bb45783969e:5, m33495b5ea807:5,
    mef2032492c4a:3, mb3dc2cd9766e:3, macfef0fcc489:3, m5db97d398203:3,
    mc4827a8e939b:3, m9186cf842d83:3, me86c388d3826:3, m95b78222e9b9:3,
    m16580951510b:3,
    mf2e99e9aa411:2, mc9bf7875a8d7:2, meadce3d098b0:2, mf7c9271b4e5e:2,
    m8d6e2d4322c8:2,
    m4eb9deb52a78:1, mf21f18654494:1, md3a807653baf:1,
    mbe79c0d9105c:1, m9f1b6d83fe39:1, ma7a2c6649fa2:1
  };
  const UL = new Set(['mff26de4b50e8','m3a58ed12c332','ma8d107d9475f','m6cf909200081','mad3a5537da46','m97848c1bdf32']);
  const PB = new Set(['mb4495066c358']);
  const BLOCK = new Set(['m535c97031825']);

  const key = u => (String(u).match(/\/m\/(m[a-z0-9]+)/i) || [])[1] || '';
  const owner = u => { try { return new URL(u).pathname.split('/').filter(Boolean)[0] || ''; } catch { return ''; } };
  const get = url => new Promise((resolve, reject) => GM_xmlhttpRequest({
    method:'GET', url, timeout:22000,
    onload:r => r.status < 400 ? resolve(r.responseText) : reject(Error('HTTP ' + r.status)),
    onerror:() => reject(Error('通信失敗')),
    ontimeout:() => reject(Error('timeout'))
  }));

  function legacyRows(src) {
    const m = String(src).match(/const FALLBACK=`([\s\S]*?)`\.trim\(\)\.split/);
    if (!m) return [];
    return m[1].trim().split('\n').map((line, i) => {
      const p = line.lastIndexOf('|');
      return p > 0 ? {title:line.slice(0,p), url:line.slice(p+1), index:i} : null;
    }).filter(Boolean);
  }

  async function rows() {
    let fallback = [];
    try { fallback = legacyRows(await get(LEGACY)); } catch {}
    const map = new Map(fallback.map(x => [x.url, {...x}]));
    const ordered = [];
    try {
      const html = await get(MASTER);
      const dom = new DOMParser().parseFromString(html, 'text/html');
      const root = dom.querySelector('article') || dom.body;
      for (const a of root.querySelectorAll('a[href]')) {
        let url;
        try { url = new URL(a.getAttribute('href'), 'https://note.com').href.split('?')[0]; } catch { continue; }
        if (!/^https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test(url)) continue;
        if (ordered.some(x => x.url === url)) continue;
        const old = map.get(url);
        ordered.push({title:old?.title || a.textContent.trim(), url, index:ordered.length});
        map.delete(url);
      }
    } catch {}
    for (const x of fallback) {
      if (!map.has(x.url)) continue;
      ordered.push({...x, index:ordered.length});
      map.delete(x.url);
    }
    return ordered;
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

  function fixedUrls(dom, ownerName) {
    const marker = [...dom.querySelectorAll('body *')].find(e => e.children.length === 0 && /固定された記事/.test(e.textContent.trim()));
    if (!marker) return [];
    let anchors = [];
    const section = marker.closest('section');
    if (section) anchors = [...section.querySelectorAll('a[href]')];
    if (!anchors.length) {
      const all = [...dom.querySelectorAll('a[href]')];
      const start = all.findIndex(a => (marker.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING));
      if (start >= 0) anchors = all.slice(start, start + 16);
    }
    const out = [];
    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      if (!/\/[A-Za-z0-9_-]+\/n\/n[a-z0-9]+/i.test(href)) continue;
      let url;
      try { url = new URL(href, 'https://note.com').href.split('?')[0]; } catch { continue; }
      if (owner(url) !== ownerName || out.includes(url)) continue;
      out.push(url);
      if (out.length >= 5) break;
    }
    return out;
  }

  function articleText(html) {
    const dom = new DOMParser().parseFromString(html, 'text/html');
    dom.querySelectorAll('del,s,strike,[style*="line-through"]').forEach(e => e.remove());
    return (dom.querySelector('article')?.innerText || dom.body?.innerText || dom.body?.textContent || '')
      .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const digit = t => String(t || '').replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
  function limit(text) {
    const t = digit(text)
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
        /(?:投稿数|投稿回数|追加本数|記事追加|投稿|寄稿)[^。]{0,36}?(?:無制限|制限なし|上限なし)/.test(t)) return {type:'unlimited'};
    return null;
  }

  function paidProhibited(text) {
    const t = digit(text).replace(/\s+/g, ' ');
    return /(?:有料記事|有料note)[^。]{0,24}(?:禁止|不可|NG|ご遠慮)/i.test(t) || /(?:無料記事のみ|無料の記事のみ)/.test(t);
  }

  function sameRule(a,b) {
    if (!a || !b || a.type !== b.type) return false;
    return a.type !== 'count' || a.count === b.count;
  }
  function ruleText(r) {
    if (!r) return '表記なし';
    if (r.type === 'unlimited') return '無制限';
    return r.type === 'count' ? `1日${r.count}記事` : '表記なし';
  }
  function fallbackRule(k, title, magazineOwner) {
    if (BLOCK.has(k)) return {type:'blocked'};
    if (UL.has(k)) return {type:'unlimited'};
    if (k in FB) return {type:'count', count:FB[k]};
    if (magazineOwner === 'ss_yr') {
      const m = String(title).match(/^([1-9])️⃣/);
      if (m) return {type:'count', count:+m[1]};
    }
    return {type:'none'};
  }

  async function inspect(row) {
    const k = key(row.url), magazineOwner = owner(row.url);
    let title = row.title, desc = '', pins = [], fixedTexts = [];
    try {
      const html = await get(row.url);
      const dom = new DOMParser().parseFromString(html, 'text/html');
      title = [...dom.querySelectorAll('h1')].map(e => e.textContent.trim()).find(Boolean) || title;
      desc = descriptionFromHtml(html, k);
      pins = fixedUrls(dom, magazineOwner);
      for (const url of pins) {
        try { fixedTexts.push(articleText(await get(url))); } catch {}
      }
    } catch {}

    let fixedRule = limit(fixedTexts.join(' '));
    let descRule = limit(desc);

    if (k === 'm752f734f7a1c') { fixedRule = {type:'count',count:4}; descRule = null; }
    if (k === 'm8d6e2d4322c8') { fixedRule = {type:'count',count:2}; descRule = null; }
    if (k === 'ma4dad1f25900') { fixedRule = {type:'count',count:3}; descRule = {type:'count',count:2}; }
    if (['mbe79c0d9105c','m9f1b6d83fe39','ma7a2c6649fa2'].includes(k) && !fixedRule && !descRule) {
      fixedRule = {type:'count',count:1};
    }

    let rules = [];
    if (BLOCK.has(k)) {
      rules = [{type:'blocked'}];
    } else {
      if (fixedRule) rules.push(fixedRule);
      if (descRule && !rules.some(r => sameRule(r, descRule))) rules.push(descRule);
      if (!rules.length) rules.push(fallbackRule(k, title, magazineOwner));
    }

    const conflict = fixedRule && descRule && !sameRule(fixedRule, descRule)
      ? `固定記事：${ruleText(fixedRule)}／紹介欄：${ruleText(descRule)}` : '';
    const allText = fixedTexts.join(' ') + ' ' + desc;

    return {
      ...row,
      title,
      displayTitle: magazineOwner === 'ss_yr' ? `👑 ${title}` : title,
      pins,
      rules,
      conflict,
      paid: PB.has(k) || paidProhibited(allText)
    };
  }

  async function inspectAll(input, show) {
    const out = new Array(input.length);
    let cursor = 0, done = 0;
    await Promise.all(Array.from({length:6}, async () => {
      while (true) {
        const i = cursor++;
        if (i >= input.length) return;
        out[i] = await inspect(input[i]);
        show(`取得 ${++done}/${input.length}`);
      }
    }));
    return out;
  }

  const trOrder = title => title === 'トランスミッション' ? 1 : /[２2]$/.test(title) ? 2 : /[３3]$/.test(title) ? 3 : 0;
  function ordered(items) {
    const a = [...items].sort((x,y) => x.index - y.index);
    const tr = a.filter(x => trOrder(x.title)).sort((x,y) => trOrder(x.title) - trOrder(y.title));
    if (tr.length < 2) return a;
    const first = Math.min(...tr.map(x => a.indexOf(x)));
    const rest = a.filter(x => !tr.includes(x));
    rest.splice(first, 0, ...tr);
    return rest;
  }

  const groupKey = r => r.type === 'count' ? r.count : r.type;
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
    const nums = [...groups.keys()].filter(x => typeof x === 'number').sort((a,b) => b-a);
    const order = [];
    if (groups.has('unlimited')) order.push('unlimited');
    order.push(...nums);
    if (groups.has('none')) order.push('none');
    if (groups.has('blocked')) order.push('blocked');

    const out = [];
    for (const g of order) {
      out.push(`# ${label(g)}`, '');
      for (const item of ordered(groups.get(g))) {
        out.push(`## ${item.displayTitle}`, '');
        if (item.conflict) out.push(item.conflict, '');
        if (item.paid) out.push('有料記事追加不可', '');
        out.push(`マガジンURL：${item.url}`, item.url, '');
        for (const pin of item.pins) out.push(`固定記事URL：${pin}`, pin, '');
        out.push('---', '');
      }
    }
    return out.join('\n').trim();
  }

  function looksLikeView(value) {
    try {
      return !!(value && typeof value === 'object' && value.state?.doc && value.state?.schema && typeof value.dispatch === 'function' && value.dom && typeof value.posAtDOM === 'function');
    } catch { return false; }
  }
  function findView() {
    const root = document.querySelector('.ProseMirror[contenteditable="true"]') || document.querySelector('.ProseMirror');
    if (!root) return null;
    const queue = [];
    let n = root;
    for (let i=0;i<7&&n;i++,n=n.parentElement) queue.push([n,0]);
    const seen = new Set();
    let steps = 0;
    while (queue.length && steps++ < 14000) {
      const [value, depth] = queue.shift();
      if (!value || (typeof value !== 'object' && typeof value !== 'function') || seen.has(value)) continue;
      seen.add(value);
      if (looksLikeView(value)) return value;
      if (depth >= 5) continue;
      let keys=[]; try { keys=Object.getOwnPropertyNames(value); } catch { continue; }
      for (const k of keys) {
        if (['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k)) continue;
        let next; try { next=value[k]; } catch { continue; }
        if (next && (typeof next === 'object' || typeof next === 'function') && !seen.has(next)) queue.push([next, depth+1]);
      }
    }
    return null;
  }
  function webpackRequire() {
    const chunks = window.webpackChunk_N_E;
    if (!chunks || typeof chunks.push !== 'function') return null;
    let require=null;
    try { chunks.push([[980000000+Math.floor(Math.random()*10000000)],{},r=>{require=r;}]); } catch {}
    return require;
  }
  function cardFactory() {
    if (typeof noteUrlCommand === 'function') return noteUrlCommand;
    const require=webpackRequire(); if (!require) return null;
    let module; try { module=require(94928); } catch {}
    const good=value=>{
      if (typeof value !== 'function') return false;
      let s=''; try { s=Function.prototype.toString.call(value); } catch {}
      return s.includes('state.selection') && s.includes('nodeBefore') && s.includes('replaceRangeWith') && s.includes('.then');
    };
    let c=typeof module?.fjT==='function'&&good(module.fjT)?module.fjT:null;
    if (!c) {
      const loaded=Object.values(require.c||{}).flatMap(e=>{const ex=e?.exports;if(!ex)return[];if(typeof ex==='function')return[ex];try{return Object.values(ex)}catch{return[]}});
      c=loaded.find(good)||null;
    }
    noteUrlCommand=c; return c;
  }
  function setCursorAfter(view,pos) {
    const node=view.state.doc.nodeAt(pos); if(!node)return false;
    const end=Math.max(1,Math.min(view.state.doc.content.size,pos+node.nodeSize-1));
    try { const Sel=view.state.selection.constructor; view.dispatch(view.state.tr.setSelection(Sel.near(view.state.doc.resolve(end),-1))); view.focus(); return true; } catch { return false; }
  }
  function nakedMagazineRows(view) {
    const out=[];
    view.state.doc.descendants((node,pos)=>{if(!node.isTextblock)return true;const u=(node.textContent||'').trim();if(/^https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test(u))out.push({pos,url:u});return true;});
    return out.sort((a,b)=>b.pos-a.pos);
  }
  async function forceMagazineCards(status) {
    const view=findView(), factory=cardFactory(); if(!view||!factory)return;
    for(let pass=0;pass<3;pass++){
      const list=nakedMagazineRows(view); if(!list.length)return;
      status.textContent=`マガジンカード再確認 ${list.length}件`;
      for(const item of list){const node=view.state.doc.nodeAt(item.pos);if(!node||(node.textContent||'').trim()!==item.url||!setCursorAfter(view,item.pos))continue;try{const c=factory(item.url);if(typeof c==='function')c(view.state,tr=>view.dispatch(tr),view);}catch{}await sleep(500);}await sleep(900);
    }
  }

  function install() {
    const root=document.getElementById('__mumei_pon_v14_root__');
    if(!root)return setTimeout(install,250);
    ['ponMags15','ponMags16','ponMags18'].forEach(id=>document.getElementById(id)?.remove());
    const panel=root.querySelector('#ponPanel14'), src=root.querySelector('#ponSrc14'), add=root.querySelector('#ponAdd14'), status=root.querySelector('#ponStatus14'), fab=root.querySelector('#ponFab14'), head=root.querySelector('#ponDrag14 b');
    const oldMin=root.querySelector('#ponMin14'), oldClose=root.querySelector('#ponClose14');
    if(!panel||!src||!add||!status||!fab||!oldMin||!oldClose)return setTimeout(install,250);
    if(head)head.textContent='↔️ ポン出し v18.1';

    const min=oldMin.cloneNode(true), close=oldClose.cloneNode(true);
    oldMin.replaceWith(min); oldClose.replaceWith(close);
    const stow=e=>{e?.preventDefault?.();e?.stopPropagation?.();e?.stopImmediatePropagation?.();panel.style.setProperty('display','none','important');fab.style.setProperty('display','block','important');};
    min.textContent='＿'; min.title='しまう'; min.addEventListener('click',stow,true);
    close.textContent='▼'; close.title='しまう'; close.addEventListener('click',stow,true);
    fab.addEventListener('click',()=>{panel.style.setProperty('display','block','important');fab.style.setProperty('display','none','important');},true);

    const button=document.createElement('button');
    button.id='ponMags18';
    button.textContent='📚 完全一覧｜本数別＋👑＋全カード';
    button.style.cssText='display:block;width:100%;border:0;border-radius:8px;padding:9px 5px;background:#ffd54a;color:#261f00;font-weight:900;font-size:11px;margin-bottom:5px';
    panel.insertBefore(button,src);

    button.onclick=async()=>{
      if(button.disabled)return;
      button.disabled=true;
      try{
        status.textContent='正本＋予備一覧を合流…';
        const list=await rows();
        if(!list.length)throw Error('マガジン一覧を取得できません');
        const items=await inspectAll(list,t=>status.textContent=t);
        src.value=buildSource(items);
        status.textContent=`${items.length}誌｜本数別・👑・URL・カードを生成中`;
        add.click();
      }catch(e){status.textContent='❌ '+(e?.message||e);button.disabled=false;}
    };

    const observer=new MutationObserver(()=>{
      const s=status.textContent||'';
      if(/^✅ 完了/.test(s)){
        setTimeout(()=>forceMagazineCards(status),500);
        setTimeout(()=>{button.disabled=false;},1800);
      } else if(/^❌/.test(s)) button.disabled=false;
    });
    observer.observe(status,{childList:true,subtree:true,characterData:true});

    let n=0;
    const cleanup=setInterval(()=>{['ponMags15','ponMags16'].forEach(id=>document.getElementById(id)?.remove());if(++n>20)clearInterval(cleanup);},500);
  }

  install();
})();