// ==UserScript==
// @name         note ポン出し v19.1｜共マガ参加中一覧・本数完全整理・全カード
// @namespace    https://github.com/mumei-s/note-insight
// @version      19.1.0
// @description  参加中保存一覧だけを母集団にし、無関係マガジンを除外。固定記事・紹介欄・案内記事・既知値から投稿上限を復元し、本数別に1誌1回で並べ、マガジン/固定記事をnoteカード化。ss_yr所有誌は👑表示。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @connect      raw.githubusercontent.com
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v14.user.js?v=19.1.0
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v19.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v19.user.js
// ==/UserScript==

(() => {
  'use strict';
  if (window.__MUMEI_PON_V191__) return;
  window.__MUMEI_PON_V191__ = true;
  window.__MUMEI_PON_V15_ADDON__ = true;
  window.__MUMEI_PON_V16_ADDON__ = true;
  window.__MUMEI_PON_V171_ADDON__ = true;
  window.__MUMEI_PON_V172_ADDON__ = true;
  window.__MUMEI_PON_V173_ADDON__ = true;
  window.__MUMEI_PON_V18__ = true;
  window.__MUMEI_PON_V181__ = true;
  window.__MUMEI_PON_V19__ = true;

  const SAVED_LIST = 'https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v15.user.js';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let noteUrlCommand = null;

  const EXCLUDE_KEYS = new Set([
    'm535c97031825',
    'm7ffeddfdfb3c'
  ]);
  const EXCLUDE_TITLE = /(コメントできなくなりました|ちび創作大賞|スキ動画コンテスト)/;

  const KNOWN_COUNT = {
    mf534419e7479:10, m300d06308833:10, m9872a92a8af5:10,
    mbefcb2e5a397:5, m1df0b906bace:5, m74b154cd7893:5, m653e8e82ea44:5,
    m4d9b9698cacf:5, mb028566a46ee:5, md96759f4be5b:5, mb80f5e0f9b99:5,
    m3759ff7a5b9c:5, m9e01fdb0606f:5, ma475a8bdcecc:5, m254cc8180f92:5,
    mba58a6f9aacf:5, m9bb45783969e:5, m33495b5ea807:5,
    m752f734f7a1c:4,
    mef2032492c4a:3, mb3dc2cd9766e:3, macfef0fcc489:3, m5db97d398203:3,
    mc4827a8e939b:3, m9186cf842d83:3, me86c388d3826:3, m95b78222e9b9:3,
    m16580951510b:3, ma4dad1f25900:3,
    mf2e99e9aa411:2, mc9bf7875a8d7:2, meadce3d098b0:2, mf7c9271b4e5e:2,
    m8d6e2d4322c8:2,
    m4eb9deb52a78:1, mf21f18654494:1, md3a807653baf:1,
    mbe79c0d9105c:1, m9f1b6d83fe39:1, ma7a2c6649fa2:1
  };
  const KNOWN_UNLIMITED = new Set([
    'mff26de4b50e8','m3a58ed12c332','ma8d107d9475f','m6cf909200081','mad3a5537da46','m97848c1bdf32'
  ]);
  const KNOWN_PAID_PROHIBITED = new Set(['mb4495066c358']);

  const key = u => (String(u).match(/\/m\/(m[a-z0-9]+)/i) || [])[1] || '';
  const owner = u => { try { return new URL(u).pathname.split('/').filter(Boolean)[0] || ''; } catch { return ''; } };
  const cleanUrl = (href, base='https://note.com') => {
    try { return new URL(href, base).href.split('?')[0].split('#')[0]; } catch { return ''; }
  };
  const get = url => new Promise((resolve, reject) => GM_xmlhttpRequest({
    method:'GET', url, timeout:24000,
    onload:r => r.status < 400 ? resolve(r.responseText) : reject(Error('HTTP ' + r.status)),
    onerror:() => reject(Error('通信失敗')),
    ontimeout:() => reject(Error('timeout'))
  }));

  function savedRows(src) {
    const m = String(src).match(/const FALLBACK=`([\s\S]*?)`\.trim\(\)\.split/);
    if (!m) return [];
    return m[1].trim().split('\n').map((line, index) => {
      const p = line.lastIndexOf('|');
      if (p <= 0) return null;
      const title = line.slice(0,p).trim();
      const url = cleanUrl(line.slice(p+1).trim());
      if (!/^https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test(url)) return null;
      return {title, url, index};
    }).filter(Boolean);
  }

  async function rows() {
    const src = await get(SAVED_LIST);
    const seen = new Set();
    return savedRows(src).filter(row => {
      const k = key(row.url);
      if (!k || seen.has(k) || EXCLUDE_KEYS.has(k) || EXCLUDE_TITLE.test(row.title)) return false;
      seen.add(k);
      return true;
    }).map((row,index) => ({...row,index}));
  }

  function descriptionFromHtml(html, magazineKey, dom) {
    const meta = dom?.querySelector('meta[name="description"]')?.content ||
      dom?.querySelector('meta[property="og:description"]')?.content || '';
    const at = html.indexOf(magazineKey);
    const region = at >= 0 ? html.slice(Math.max(0,at-120000), Math.min(html.length,at+180000)) : html;
    const re = /["']description["']\s*:\s*"((?:\\.|[^"\\])*)"/g;
    let m, best = meta;
    while ((m = re.exec(region))) {
      try {
        const v = JSON.parse('"' + m[1] + '"');
        if (v.length > best.length && v.length < 20000) best = v;
      } catch {}
    }
    return best;
  }

  function articleUrlFromAnchor(a) {
    const url = cleanUrl(a.getAttribute('href') || '');
    return /^https:\/\/note\.com\/[A-Za-z0-9_-]+\/n\/n[a-z0-9]+$/i.test(url) ? url : '';
  }

  function ownerFixedUrls(dom, ownerName) {
    const nodes = [...dom.querySelectorAll('body *')];
    const marks = nodes.filter(e => e.children.length === 0 && /固定された記事/.test((e.textContent || '').trim()));
    if (!marks.length) return [];
    const allLinks = [...dom.querySelectorAll('a[href]')];
    const out = [], seen = new Set();
    for (const mark of marks) {
      let found = [];
      let box = mark.parentElement;
      for (let depth=0; depth<7 && box; depth+=1, box=box.parentElement) {
        const urls = [...box.querySelectorAll('a[href]')].map(articleUrlFromAnchor).filter(Boolean);
        const uniq = [...new Set(urls)].filter(u => owner(u) === ownerName);
        if (uniq.length && uniq.length <= 8) { found = uniq; break; }
      }
      if (!found.length) {
        let articleSeen = 0;
        for (const a of allLinks) {
          if (!(mark.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
          const url = articleUrlFromAnchor(a);
          if (!url) continue;
          articleSeen += 1;
          if (owner(url) === ownerName) found.push(url);
          if (articleSeen >= 8) break;
        }
      }
      for (const u of found) if (!seen.has(u)) { seen.add(u); out.push(u); }
    }
    return out.slice(0,6);
  }

  function guideCandidates(dom, ownerName, fixedSet) {
    const out = [], seen = new Set();
    for (const a of dom.querySelectorAll('a[href]')) {
      const url = articleUrlFromAnchor(a);
      if (!url || owner(url) !== ownerName || fixedSet.has(url) || seen.has(url)) continue;
      const near = ((a.textContent||'') + ' ' + (a.parentElement?.textContent||'')).replace(/\s+/g,' ');
      if (!/(参加|募集|ルール|投稿|共同運営|共同マガジン|マガジン|案内|ガイド|使い方|お知らせ)/.test(near)) continue;
      seen.add(url); out.push(url);
      if (out.length >= 4) break;
    }
    return out;
  }

  function articleText(html) {
    const dom = new DOMParser().parseFromString(html,'text/html');
    dom.querySelectorAll('del,s,strike,[style*="line-through"]').forEach(e => e.remove());
    return (dom.querySelector('article')?.innerText || dom.body?.innerText || dom.body?.textContent || '')
      .replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  }

  const digit = t => String(t || '').replace(/[０-９]/g,d => String.fromCharCode(d.charCodeAt(0)-0xFEE0));
  function limit(text) {
    const t = digit(text)
      .replace(/\[[^\]]*(?:例|example)[^\]]*\]/gi,' ')
      .replace(/［[^］]*(?:例|example)[^］]*］/gi,' ')
      .replace(/\s+/g,' ');
    if (!t) return null;
    const noLimit = [
      /(?:投稿数|投稿回数|追加本数|記事追加|投稿|寄稿)[^。]{0,45}?(?:無制限|制限なし|上限なし)/,
      /(?:1日|一日|毎日)[^。]{0,65}?(?:上限|制限)[^。]{0,24}?(?:なし|ありません|ない|無い)/,
      /(?:何本でも|何記事でも)[^。]{0,20}?(?:投稿|追加|OK|可)/
    ];
    if (noLimit.some(re => re.test(t)) && !/(?:以前|過去|かつて)[^。]{0,30}(?:無制限|上限なし|制限なし)/.test(t)) {
      return {type:'unlimited', confidence:3};
    }
    const hits = [];
    const add = (n, confidence, at) => {
      n = Number(n);
      if (!Number.isFinite(n) || n < 1 || n > 99) return;
      hits.push({count:n, confidence, at});
    };
    let m;
    const patterns = [
      {re:/(?:1人|お一人(?:様)?|ひとり)?\s*(?:につき|あたり|当たり|の)?\s*(?:1日|一日|毎日)\s*(?:につき|あたり|当たり|の|最大|上限|まで|目安|程度|約)?[^0-9。]{0,16}?(\d+)\s*(?:本|記事|投稿|回|件)/g, c:5},
      {re:/(?:1日|一日|毎日)[^。]{0,28}?(\d+)\s*[〜～~\-]\s*(\d+)\s*(?:本|記事|投稿|回|件)/g, c:5, range:true},
      {re:/(?:1日|一日)(?:に|の|あたり|当たり|につき)?[^。]{0,55}?(?:投稿|追加|記事|本数|回数)[^。0-9]{0,20}?(\d+)\s*(?:本|記事|投稿|回|件)/g, c:5},
      {re:/(?:投稿|追加|記事|寄稿)[^。]{0,32}?(?:1日|一日|毎日)[^。0-9]{0,20}?(\d+)\s*(?:本|記事|投稿|回|件)/g, c:5},
      {re:/(?:1日|一日|毎日)\s*[:：・,、-]?\s*(\d+)\s*(?:本|記事|投稿|回|件)/g, c:4},
      {re:/(?:1日|一日)[^。]{0,18}?(?:1人|お一人(?:様)?|ひとり)[^。0-9]{0,12}?(\d+)\s*(?:本|記事|投稿|回|件)/g, c:5}
    ];
    for (const p of patterns) {
      p.re.lastIndex = 0;
      while ((m = p.re.exec(t))) add(p.range ? Math.max(+m[1],+m[2]) : m[1], p.c, m.index);
    }
    if (!hits.length) return null;
    hits.sort((a,b) => b.confidence-a.confidence || a.at-b.at);
    const bestConfidence = hits[0].confidence;
    const best = hits.filter(x => x.confidence === bestConfidence).sort((a,b) => a.at-b.at)[0];
    return {type:'count', count:best.count, confidence:bestConfidence};
  }

  function paidProhibited(text) {
    const t = digit(text).replace(/\s+/g,' ');
    return /(?:有料記事|有料note)[^。]{0,32}(?:禁止|不可|NG|ご遠慮)/i.test(t) || /(?:無料記事のみ|無料の記事のみ)/.test(t);
  }
  function sameRule(a,b) { return !!a && !!b && a.type === b.type && (a.type !== 'count' || a.count === b.count); }
  function ruleText(r) {
    if (!r) return '表記なし';
    if (r.type === 'unlimited') return '無制限';
    return r.type === 'count' ? `1日${r.count}記事` : '表記なし';
  }

  function fallbackRule(k, title, magazineOwner) {
    if (KNOWN_UNLIMITED.has(k)) return {type:'unlimited', source:'保存済み確認値'};
    if (k in KNOWN_COUNT) return {type:'count', count:KNOWN_COUNT[k], source:'保存済み確認値'};
    if (magazineOwner === 'ss_yr') {
      const m = String(title).match(/^([1-9])️⃣/);
      if (m) return {type:'count', count:+m[1], source:'マガジン名'};
    }
    return {type:'none', source:'表記なし'};
  }

  async function inspect(row) {
    const k = key(row.url), magazineOwner = owner(row.url);
    let title = row.title, desc = '', fixedUrls = [], fixedText = '', guideText = '';
    try {
      const html = await get(row.url);
      const dom = new DOMParser().parseFromString(html,'text/html');
      title = [...dom.querySelectorAll('h1')].map(e => e.textContent.trim()).find(Boolean) || title;
      desc = descriptionFromHtml(html,k,dom);
      fixedUrls = ownerFixedUrls(dom,magazineOwner);
      if (fixedUrls.length) {
        const texts = await Promise.all(fixedUrls.map(async u => { try { return articleText(await get(u)); } catch { return ''; } }));
        fixedText = texts.filter(Boolean).join(' ');
      }
      if (!limit(fixedText) && !limit(desc)) {
        for (const u of guideCandidates(dom,magazineOwner,new Set(fixedUrls))) {
          try {
            const t = articleText(await get(u));
            guideText += ' ' + t;
            if (limit(t)) break;
          } catch {}
        }
      }
    } catch {}
    const fixedRule = limit(fixedText);
    const descRule = limit(desc);
    const guideRule = limit(guideText);
    let rule = null, source = '';
    if (fixedRule) { rule = fixedRule; source = '固定記事'; }
    else if (descRule) { rule = descRule; source = '紹介欄'; }
    else if (guideRule) { rule = guideRule; source = '案内記事'; }
    else {
      rule = fallbackRule(k,title,magazineOwner);
      source = rule.source || '';
    }
    if (k === 'm752f734f7a1c') { rule = {type:'count',count:4}; source = '確認済み固定記事'; }
    if (k === 'm8d6e2d4322c8') { rule = {type:'count',count:2}; source = '確認済み固定記事'; }
    if (k === 'ma4dad1f25900') { rule = {type:'count',count:3}; source = '確認済み固定記事'; }
    if (['mbe79c0d9105c','m9f1b6d83fe39','ma7a2c6649fa2'].includes(k) && rule.type === 'none') {
      rule = {type:'count',count:1}; source = '確認済み固定記事';
    }
    let conflict = '';
    if (fixedRule && descRule && !sameRule(fixedRule,descRule)) {
      conflict = `※固定記事：${ruleText(fixedRule)}／紹介欄：${ruleText(descRule)} → 固定記事を採用`;
    }
    const allText = [fixedText,desc,guideText].join(' ');
    return {
      ...row,
      title,
      displayTitle: magazineOwner === 'ss_yr' ? `👑 ${title}` : title,
      fixedUrls,
      rule,
      source,
      conflict,
      paid: KNOWN_PAID_PROHIBITED.has(k) || paidProhibited(allText)
    };
  }

  async function inspectAll(input, show) {
    const out = new Array(input.length);
    let cursor=0, done=0;
    await Promise.all(Array.from({length:5}, async () => {
      while (true) {
        const i=cursor++;
        if (i >= input.length) return;
        out[i]=await inspect(input[i]);
        show(`投稿回数を確認 ${++done}/${input.length}`);
      }
    }));
    return out.filter(Boolean);
  }

  const transmissionOrder = title => /^トランスミッション$/.test(title) ? 1 : /トランスミッション[２2]$/.test(title) ? 2 : /トランスミッション[３3]$/.test(title) ? 3 : 0;
  function ordered(items) {
    const a=[...items].sort((x,y)=>x.index-y.index);
    const tr=a.filter(x=>transmissionOrder(x.title)).sort((x,y)=>transmissionOrder(x.title)-transmissionOrder(y.title));
    if (tr.length < 2) return a;
    const first=Math.min(...tr.map(x=>a.indexOf(x)));
    const rest=a.filter(x=>!tr.includes(x));
    rest.splice(first,0,...tr);
    return rest;
  }

  const groupKey = r => r.type === 'count' ? r.count : r.type;
  function label(g) {
    if (g === 'unlimited') return '♾️ 無制限・制限なし';
    if (g === 'none') return '❓ 制限数の表記を確認できないマガジン';
    return `${g === 10 ? '🔟' : g + '️⃣'} 1日${g}記事まで`;
  }

  function buildSource(items) {
    const groups=new Map();
    for (const item of items) {
      const g=groupKey(item.rule);
      if (!groups.has(g)) groups.set(g,[]);
      groups.get(g).push(item);
    }
    const nums=[...groups.keys()].filter(x=>typeof x==='number').sort((a,b)=>b-a);
    const order=[];
    if (groups.has('unlimited')) order.push('unlimited');
    order.push(...nums);
    if (groups.has('none')) order.push('none');
    const out=[];
    for (const g of order) {
      out.push(`# ${label(g)}`,'');
      for (const item of ordered(groups.get(g))) {
        out.push(`## ${item.displayTitle}`,'');
        if (item.conflict) out.push(item.conflict,'');
        if (item.paid) out.push('※有料記事追加不可','');
        out.push(`マガジンURL：${item.url}`,item.url,'');
        for (const pin of item.fixedUrls) out.push(`固定記事URL：${pin}`,pin,'');
        out.push('---','');
      }
    }
    return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  }

  function looksLikeView(value) {
    try { return !!(value && typeof value==='object' && value.state?.doc && value.state?.schema && typeof value.dispatch==='function' && value.dom && typeof value.posAtDOM==='function'); }
    catch { return false; }
  }
  function findView() {
    const root=document.querySelector('.ProseMirror[contenteditable="true"]') || document.querySelector('.ProseMirror');
    if (!root) return null;
    const queue=[]; let node=root;
    for (let i=0;i<7&&node;i+=1,node=node.parentElement) queue.push([node,0]);
    const seen=new Set(); let steps=0;
    while (queue.length && steps++<14000) {
      const [value,depth]=queue.shift();
      if (!value || (typeof value!=='object'&&typeof value!=='function') || seen.has(value)) continue;
      seen.add(value);
      if (looksLikeView(value)) return value;
      if (depth>=5) continue;
      let keys=[]; try { keys=Object.getOwnPropertyNames(value); } catch { continue; }
      for (const k of keys) {
        if (['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k)) continue;
        let next; try { next=value[k]; } catch { continue; }
        if (next && (typeof next==='object'||typeof next==='function') && !seen.has(next)) queue.push([next,depth+1]);
      }
    }
    return null;
  }
  function webpackRequire() {
    const chunks=window.webpackChunk_N_E;
    if (!chunks || typeof chunks.push!=='function') return null;
    let req=null;
    try { chunks.push([[980000000+Math.floor(Math.random()*10000000)],{},r=>{req=r;}]); } catch {}
    return req;
  }
  function cardFactory() {
    if (typeof noteUrlCommand==='function') return noteUrlCommand;
    const req=webpackRequire(); if (!req) return null;
    const right=fn=>{
      if (typeof fn!=='function') return false;
      let s=''; try { s=Function.prototype.toString.call(fn); } catch {}
      return s.includes('state.selection') && s.includes('nodeBefore') && s.includes('replaceRangeWith') && s.includes('.then');
    };
    let mod; try { mod=req(94928); } catch {}
    let fn=right(mod?.fjT)?mod.fjT:null;
    if (!fn) {
      const loaded=Object.values(req.c||{}).flatMap(e=>{const ex=e?.exports;if(!ex)return[];if(typeof ex==='function')return[ex];try{return Object.values(ex)}catch{return[]}});
      fn=loaded.find(right)||null;
    }
    noteUrlCommand=fn; return fn;
  }
  function setCursorAfter(view,pos) {
    const node=view.state.doc.nodeAt(pos); if(!node)return false;
    try {
      const end=Math.max(1,Math.min(view.state.doc.content.size,pos+node.nodeSize-1));
      const Sel=view.state.selection.constructor;
      view.dispatch(view.state.tr.setSelection(Sel.near(view.state.doc.resolve(end),-1)));
      view.focus(); return true;
    } catch { return false; }
  }
  function nakedMagazineRows(view) {
    const out=[];
    view.state.doc.descendants((node,pos)=>{
      if (!node.isTextblock) return true;
      const u=(node.textContent||'').trim();
      if (/^https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test(u)) out.push({pos,url:u});
      return true;
    });
    return out.sort((a,b)=>b.pos-a.pos);
  }
  async function forceMagazineCards(status) {
    const view=findView(), factory=cardFactory();
    if(!view||!factory)return;
    for(let pass=0;pass<4;pass+=1){
      const list=nakedMagazineRows(view);
      if(!list.length)return;
      status.textContent=`マガジンカード再確認 ${list.length}件`;
      for(const item of list){
        const node=view.state.doc.nodeAt(item.pos);
        if(!node||(node.textContent||'').trim()!==item.url||!setCursorAfter(view,item.pos))continue;
        try{const c=factory(item.url);if(typeof c==='function')c(view.state,tr=>view.dispatch(tr),view);}catch{}
        await sleep(480);
      }
      await sleep(850);
    }
  }

  function install() {
    const root=document.getElementById('__mumei_pon_v14_root__');
    if(!root)return setTimeout(install,250);
    ['ponMags15','ponMags16','ponMags18','ponMags19'].forEach(id=>document.getElementById(id)?.remove());
    const panel=root.querySelector('#ponPanel14'), src=root.querySelector('#ponSrc14'), add=root.querySelector('#ponAdd14'), status=root.querySelector('#ponStatus14'), fab=root.querySelector('#ponFab14'), head=root.querySelector('#ponDrag14 b');
    const oldMin=root.querySelector('#ponMin14'), oldClose=root.querySelector('#ponClose14');
    if(!panel||!src||!add||!status||!fab||!oldMin||!oldClose)return setTimeout(install,250);
    if(head)head.textContent='↔️ ポン出し v19.1';
    const min=oldMin.cloneNode(true), close=oldClose.cloneNode(true);
    oldMin.replaceWith(min); oldClose.replaceWith(close);
    const stow=e=>{e?.preventDefault?.();e?.stopPropagation?.();e?.stopImmediatePropagation?.();panel.style.setProperty('display','none','important');fab.style.setProperty('display','block','important');};
    min.textContent='＿'; min.title='しまう'; min.addEventListener('click',stow,true);
    close.textContent='▼'; close.title='しまう'; close.addEventListener('click',stow,true);
    fab.addEventListener('click',()=>{panel.style.setProperty('display','block','important');fab.style.setProperty('display','none','important');},true);

    const button=document.createElement('button');
    button.id='ponMags19';
    button.textContent='📚 参加中だけ→回数完全整理＋全カード';
    button.style.cssText='display:block;width:100%;border:0;border-radius:8px;padding:9px 5px;background:#ffd54a;color:#261f00;font-weight:900;font-size:11px;margin-bottom:5px';
    panel.insertBefore(button,src);

    button.onclick=async()=>{
      if(button.disabled)return;
      button.disabled=true;
      try{
        status.textContent='参加中保存一覧を読み込み…';
        const list=await rows();
        if(!list.length)throw Error('参加中マガジン一覧を取得できません');
        status.textContent=`対象 ${list.length}誌｜投稿回数を確認開始`;
        const items=await inspectAll(list,t=>status.textContent=t);
        src.value=buildSource(items);
        const unknown=items.filter(x=>x.rule.type==='none').length;
        status.textContent=`${items.length}誌｜回数順に整理済み（未確認 ${unknown}誌）→カード生成中`;
        add.click();
      }catch(e){
        status.textContent='❌ '+(e?.message||e);
        button.disabled=false;
      }
    };

    const observer=new MutationObserver(()=>{
      const s=status.textContent||'';
      if(/^✅ 完了/.test(s)){
        setTimeout(()=>forceMagazineCards(status),550);
        setTimeout(()=>{button.disabled=false;},2200);
      } else if(/^❌/.test(s)) button.disabled=false;
    });
    observer.observe(status,{childList:true,subtree:true,characterData:true});

    let n=0;
    const cleanup=setInterval(()=>{
      ['ponMags15','ponMags16','ponMags18'].forEach(id=>document.getElementById(id)?.remove());
      if(++n>30)clearInterval(cleanup);
    },500);
  }

  install();
})();
