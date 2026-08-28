// ==UserScript==
// @name         note サブ垢探偵｜文体指紋スキャナ
// @namespace    https://github.com/mumei-s/note-insight
// @version      1.3.0
// @description  #はじめてのnote候補を検索し、cosmos_invest本垢の句読点・改行・接続詞・見出し・文末癖から文体類似度を算出。公開1記事とべあのスキも照合します。
// @match        https://note.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const CFG = {
    startJst: '2026-08-20T00:00:00+09:00',
    endJst: '2026-08-26T13:32:00+09:00',
    query: 'はじめてのnote',
    pageSize: 20,
    maxSearchPages: 350,
    requestDelayMs: 80,
    creatorLimit: 260,
    likerLimit: 80,
    baselineUser: 'cosmos_invest',
    baselineMaxNotes: 10,
    baselineFixedKeys: ['nc722d6a38402', 'n540a1b01393a'],
    targetLiker: 'bear_l_t_puzzle',
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = (s, root = document) => root.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ms = s => { const v = Date.parse(s || ''); return Number.isFinite(v) ? v : 0; };
  const pick = (o, keys, fallback = '') => { for (const k of keys) if (o && o[k] != null) return o[k]; return fallback; };

  async function getJson(url) {
    const r = await fetch(url, { credentials: 'include', headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }

  const unwrapNote = j => { const d = j?.data ?? j ?? {}; return d.note || d; };
  const keyOf = n => pick(n, ['key','note_key','noteKey','slug']);
  const titleOf = n => pick(n, ['name','title']);
  const publishOf = n => pick(n, ['publish_at','publishAt','published_at','publishedAt','created_at']);
  const userOf = n => n?.user || n?.creator || n?.note_user || {};
  const urlnameOf = n => pick(userOf(n), ['urlname','url_name','username'], pick(n,['urlname']));
  const nicknameOf = n => pick(userOf(n), ['nickname','name'], pick(n,['nickname'],urlnameOf(n)));
  const likesOf = n => Number(pick(n,['like_count','likeCount','likes_count'],0)) || 0;

  function htmlInfo(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    const text = (d.innerText || d.textContent || '').replace(/\r/g,'');
    return { text, headings: d.querySelectorAll('h1,h2,h3,h4').length };
  }

  const EMOJI = /\p{Extended_Pictographic}/gu;
  const EMOJI_END = /\p{Extended_Pictographic}(?:\uFE0F)?(?:[」』）】])?\s*$/u;
  const CONNECTORS = ['でも','だから','なので','そして','ちなみに','つまり','まあ','さて','実は','なんか','ちょっと','とりあえず','もちろん','ということで','それでも','とはいえ','というか','というのも','そもそも','ただ','逆に','ちなみにね'];
  const PUNCT_PATTERNS = ['・・・？','・・・！','・・・','……？','……！','……','！？','？！','！！','？？','！','？','。','、','「','」','（','）','：','・'];

  function countRe(text, token) {
    if (!token) return 0;
    let i = 0, n = 0;
    while ((i = text.indexOf(token, i)) !== -1) { n++; i += token.length; }
    return n;
  }

  function fingerprint(bodyHtml) {
    const { text, headings } = htmlInfo(bodyHtml);
    const rawLines = text.split('\n');
    const lines = rawLines.map(x => x.trim()).filter(Boolean);
    const chars = Math.max(1, text.replace(/\s/g,'').length);
    const sentences = text.split(/[。！？!?\n]+/).map(x=>x.trim()).filter(Boolean);
    const lineLens = lines.map(x => x.length);
    const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
    const med = arr => {
      if (!arr.length) return 0;
      const a=[...arr].sort((x,y)=>x-y), m=Math.floor(a.length/2);
      return a.length%2 ? a[m] : (a[m-1]+a[m])/2;
    };
    const norm = n => n * 1000 / chars;
    const punct = {};
    for (const p of PUNCT_PATTERNS) punct[p] = norm(countRe(text,p));
    const conn = {};
    for (const c of CONNECTORS) conn[c] = norm(countRe(text,c));
    let emojiEnd = 0;
    const emojiMap = new Map();
    for (const line of lines) {
      if (EMOJI_END.test(line)) emojiEnd++;
      for (const m of line.matchAll(EMOJI)) emojiMap.set(m[0], (emojiMap.get(m[0])||0)+1);
    }
    const emojiCount = [...emojiMap.values()].reduce((a,b)=>a+b,0);
    const shortLines = lines.filter(x=>x.length<=28).length;
    const oneWordLines = lines.filter(x=>x.length<=8).length;
    const blankRuns = (text.match(/\n\s*\n/g)||[]).length;
    const endMaru = lines.filter(x=>/。\s*$/.test(x)).length;
    const endQ = lines.filter(x=>/[？?]\s*$/.test(x)).length;
    const endEx = lines.filter(x=>/[！!]\s*$/.test(x)).length;
    const endQuote = lines.filter(x=>/[」』]\s*$/.test(x)).length;
    return {
      chars, headings,
      avgLine: avg(lineLens), medLine: med(lineLens),
      avgSentence: avg(sentences.map(x=>x.length)),
      lines: lines.length,
      shortRatio: lines.length ? shortLines/lines.length : 0,
      oneWordRatio: lines.length ? oneWordLines/lines.length : 0,
      blankRatio: lines.length ? blankRuns/lines.length : 0,
      emojiRate: norm(emojiCount),
      emojiEndRatio: lines.length ? emojiEnd/lines.length : 0,
      endMaruRatio: lines.length ? endMaru/lines.length : 0,
      endQRatio: lines.length ? endQ/lines.length : 0,
      endExRatio: lines.length ? endEx/lines.length : 0,
      endQuoteRatio: lines.length ? endQuote/lines.length : 0,
      punct, conn,
    };
  }

  function avgFingerprints(fps) {
    if (!fps.length) return null;
    const scalar = ['headings','avgLine','medLine','avgSentence','shortRatio','oneWordRatio','blankRatio','emojiRate','emojiEndRatio','endMaruRatio','endQRatio','endExRatio','endQuoteRatio'];
    const out = { punct:{}, conn:{} };
    for (const k of scalar) out[k] = fps.reduce((s,f)=>s+(f[k]||0),0)/fps.length;
    for (const p of PUNCT_PATTERNS) out.punct[p] = fps.reduce((s,f)=>s+(f.punct[p]||0),0)/fps.length;
    for (const c of CONNECTORS) out.conn[c] = fps.reduce((s,f)=>s+(f.conn[c]||0),0)/fps.length;
    return out;
  }

  function relSim(a,b,scale=1) {
    const denom = Math.max(scale, Math.abs(a), Math.abs(b));
    return Math.max(0, 1 - Math.abs(a-b)/denom);
  }

  function vectorCos(a,b,keys) {
    let dot=0, aa=0, bb=0;
    for (const k of keys) { const x=a[k]||0,y=b[k]||0; dot+=x*y; aa+=x*x; bb+=y*y; }
    if (!aa || !bb) return 0;
    return dot / Math.sqrt(aa*bb);
  }

  function similarity(fp, base) {
    if (!fp || !base) return {score:0, parts:{}};
    // 句読点・記号を最重要。絵文字は補助。
    const punctCos = vectorCos(fp.punct, base.punct, PUNCT_PATTERNS);
    const connCos = vectorCos(fp.conn, base.conn, CONNECTORS);
    const lineSim = (
      relSim(fp.avgLine,base.avgLine,12)+
      relSim(fp.medLine,base.medLine,10)+
      relSim(fp.avgSentence,base.avgSentence,14)+
      relSim(fp.shortRatio,base.shortRatio,.15)+
      relSim(fp.oneWordRatio,base.oneWordRatio,.08)+
      relSim(fp.blankRatio,base.blankRatio,.08)
    )/6;
    const endingSim = (
      relSim(fp.endMaruRatio,base.endMaruRatio,.15)+
      relSim(fp.endQRatio,base.endQRatio,.04)+
      relSim(fp.endExRatio,base.endExRatio,.04)+
      relSim(fp.endQuoteRatio,base.endQuoteRatio,.04)
    )/4;
    const headingSim = relSim(fp.headings,base.headings,2);
    const emojiSim = (relSim(fp.emojiRate,base.emojiRate,2)+relSim(fp.emojiEndRatio,base.emojiEndRatio,.05))/2;
    const total = punctCos*.38 + lineSim*.24 + endingSim*.14 + connCos*.12 + headingSim*.07 + emojiSim*.05;
    return { score: Math.round(total*100), parts:{ punct:Math.round(punctCos*100), line:Math.round(lineSim*100), ending:Math.round(endingSim*100), connector:Math.round(connCos*100), heading:Math.round(headingSim*100), emoji:Math.round(emojiSim*100) } };
  }

  async function loadBaseline(status) {
    status('コスモス本垢の文体指紋を作成中…');
    const keys = new Set(CFG.baselineFixedKeys);
    try {
      const j = await getJson(`/api/v2/creators/${CFG.baselineUser}/contents?kind=note&page=1`);
      const d = j?.data ?? j ?? {};
      const arr = d.contents || d.notes || d.items || [];
      for (const n of arr) { const k=keyOf(n); if(k) keys.add(k); if(keys.size>=CFG.baselineMaxNotes) break; }
    } catch {}
    const fps=[];
    for (const k of [...keys].slice(0,CFG.baselineMaxNotes)) {
      try {
        const j=await getJson(`/api/v3/notes/${encodeURIComponent(k)}`);
        const n=unwrapNote(j);
        const body=pick(n,['body','free_body','description'],'');
        if(body) fps.push(fingerprint(body));
      } catch {}
      await sleep(CFG.requestDelayMs);
    }
    if (!fps.length) throw new Error('本垢文体の取得に失敗');
    return { base:avgFingerprints(fps), count:fps.length };
  }

  function normalizeSearch(j) {
    const d=j?.data ?? j ?? {};
    const no=d.notes || {};
    const notes=no.contents || no.notes || [];
    const cursor=d?.cursor?.note ?? d.note_cursor ?? no.next_cursor ?? no.cursor ?? null;
    const isLast=no.is_last_page===true || no.isLastPage===true;
    return {notes:Array.isArray(notes)?notes:[],cursor,isLast};
  }

  async function searchPeriod(status) {
    const start=ms(CFG.startJst), end=ms(CFG.endJst);
    let cursor='0', pages=0, reachedOld=false;
    const map=new Map();
    while(pages<CFG.maxSearchPages && !reachedOld){
      pages++;
      status(`#はじめてのnoteを遡り中… ${pages}ページ / ${map.size}候補`);
      const u=`/api/v3/searches?context=note&q=${encodeURIComponent(CFG.query)}&size=${CFG.pageSize}&start=${encodeURIComponent(cursor)}&sort=new`;
      const j=await getJson(u);
      const {notes,cursor:next,isLast}=normalizeSearch(j);
      if(!notes.length) break;
      let oldest=Infinity;
      for(const n of notes){
        const t=ms(publishOf(n)); if(t) oldest=Math.min(oldest,t);
        if(t>=start && t<=end){
          const k=keyOf(n); if(k) map.set(k,{key:k,title:titleOf(n),publishAt:publishOf(n),urlname:urlnameOf(n),nickname:nicknameOf(n),likes:likesOf(n)});
        }
      }
      if(oldest<start) reachedOld=true;
      if(isLast || next==null || String(next)===String(cursor)) break;
      cursor=String(next);
      await sleep(CFG.requestDelayMs);
    }
    return {cands:[...map.values()],pages,reachedOld};
  }

  function collectTags(obj){
    const out=new Set(), seen=new Set();
    const walk=(x,d=0)=>{ if(!x||typeof x!=='object'||seen.has(x)||d>7)return; seen.add(x);
      if(Array.isArray(x)){x.forEach(v=>walk(v,d+1));return;}
      for(const [k,v] of Object.entries(x)){
        if(/hashtag/i.test(k)){
          if(typeof v==='string') out.add(v.replace(/^#/,''));
          if(Array.isArray(v)) for(const h of v){const nm=typeof h==='string'?h:(h?.name||h?.hashtag||h?.tag); if(nm)out.add(String(nm).replace(/^#/,''));}
        }
        if(v&&typeof v==='object') walk(v,d+1);
      }
    }; walk(obj); return [...out];
  }

  async function enrichDetails(cands,base,status){
    const out=[];
    for(let i=0;i<cands.length;i++){
      const c=cands[i]; status(`全文で文体比較 ${i+1}/${cands.length}：${c.nickname||c.urlname}`);
      try{
        const j=await getJson(`/api/v3/notes/${encodeURIComponent(c.key)}`), n=unwrapNote(j);
        c.title=titleOf(n)||c.title; c.publishAt=publishOf(n)||c.publishAt; c.urlname=urlnameOf(n)||c.urlname; c.nickname=nicknameOf(n)||c.nickname; c.likes=likesOf(n)||c.likes;
        c.tags=collectTags(j);
        c.hasTargetTag=c.tags.includes('はじめてのnote')||c.tags.includes('初めてのnote')||/はじめてのnote|初めてのnote/i.test(c.title);
        const body=pick(n,['body','free_body','description'],'');
        c.fp=fingerprint(body); c.sim=similarity(c.fp,base);
        if(c.hasTargetTag) out.push(c);
      }catch(e){c.detailError=String(e.message||e);}
      await sleep(CFG.requestDelayMs);
    }
    return out;
  }

  function normalizeContents(j){const d=j?.data??j??{}; const arr=d.contents||d.notes||d.items||[]; return {arr:Array.isArray(arr)?arr:[],last:d.is_last_page??d.isLastPage??j?.is_last_page,next:d.next_page??d.nextPage??j?.next_page};}
  function findPinned(j,key){let hit=false; const seen=new Set(); const walk=(x,d=0)=>{if(hit||!x||typeof x!=='object'||seen.has(x)||d>8)return;seen.add(x);for(const[k,v]of Object.entries(x)){if(/pinned|fixed|top_note/i.test(k)){let s='';try{s=typeof v==='string'?v:JSON.stringify(v);}catch{} if(s&&key&&s.includes(key)){hit=true;return;}}if(v&&typeof v==='object')walk(v,d+1);}};walk(j);return hit;}

  async function enrichCreators(cands,status){
    const sorted=[...cands].sort((a,b)=>b.sim.score-a.sim.score||b.likes-a.likes).slice(0,CFG.creatorLimit);
    for(let i=0;i<sorted.length;i++){
      const c=sorted[i]; status(`クリエイターページ確認 ${i+1}/${sorted.length}：${c.nickname}`);
      try{
        const [profile,p1]=await Promise.all([getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}`),getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/contents?kind=note&page=1`)]);
        const cc=normalizeContents(p1); c.visibleCount=cc.arr.length; c.visibleIsLast=cc.last===true||(!cc.next&&cc.arr.length<10); c.isOneArticle=c.visibleCount===1&&c.visibleIsLast; c.isPinned=findPinned(profile,c.key)||findPinned(p1,c.key);
      }catch(e){c.creatorError=String(e.message||e);}
      await sleep(CFG.requestDelayMs);
    }
    return sorted;
  }

  async function hasBear(key){
    for(let page=1;page<=8;page++){
      const j=await getJson(`/api/v3/notes/${encodeURIComponent(key)}/likes?page=${page}&per_page=100`),d=j?.data??j??{};
      const arr=Array.isArray(d)?d:(d.users||d.likes||d.contents||[]), users=Array.isArray(arr)?arr:[];
      if(users.some(x=>{const u=x?.user||x?.creator||x||{};return(u.urlname||u.url_name||u.username)===CFG.targetLiker;}))return true;
      const next=d.next_page??j?.next_page; if(!next&&users.length<100)break;
    }
    return false;
  }

  async function enrichBear(cands,status){
    const targets=[...cands].filter(c=>c.isOneArticle!==false).sort((a,b)=>(b.sim.score+(b.isOneArticle?20:0))-(a.sim.score+(a.isOneArticle?20:0))).slice(0,CFG.likerLimit);
    for(let i=0;i<targets.length;i++){const c=targets[i];status(`べあのスキ確認 ${i+1}/${targets.length}：${c.nickname}`);try{c.bearLiked=await hasBear(c.key);}catch{c.bearLiked=false;}await sleep(CFG.requestDelayMs);}
  }

  function nameBonus(c){const s=`${c.nickname} ${c.title}`;let n=0,labels=[];for(const[re,l]of[[/花|はな|華|コスモス|cosmos/i,'花'],[/空|そら|星|月|宇宙|space|sky|star|moon/i,'宇宙'],[/3人|三人|トリオ|trio/i,'3人'],[/別|裏|影|匿名|名無し|無名|sub|sab|サブ/i,'別人格']])if(re.test(s)){n+=4;labels.push(l);}return{n,labels};}
  function finalScore(c){const nb=nameBonus(c).n;return c.sim.score+(c.isOneArticle?18:0)+(c.isPinned?8:0)+(c.bearLiked?35:0)+nb-(c.isOneArticle===false?25:0);}
  function reason(c){const r=[];r.push(`文体${c.sim.score}%`);r.push(`記号${c.sim.parts.punct}%`);r.push(`改行${c.sim.parts.line}%`);r.push(`文末${c.sim.parts.ending}%`);r.push(`接続${c.sim.parts.connector}%`);if(c.isOneArticle)r.push('★公開1記事');else if(c.visibleCount!=null)r.push(`記事${c.visibleCount}+`);if(c.isPinned)r.push('固定一致');if(c.bearLiked)r.push('★★べあがスキ');const nb=nameBonus(c);if(nb.labels.length)r.push(`名前:${nb.labels.join('/')}`);return r.join(' / ');}

  function makeUI(){
    const host=document.createElement('div');host.id='subacct-finder';host.style.cssText='position:fixed;right:10px;bottom:12px;z-index:2147483647;font-family:system-ui,sans-serif;color:#111;';
    host.innerHTML=`<button id="saf-start" style="border:0;border-radius:999px;padding:12px 16px;background:#111;color:#fff;font-weight:800;box-shadow:0 4px 18px #0004">🕵️ サブ垢探偵 v1.3</button><div id="saf-panel" style="display:none;width:min(94vw,760px);max-height:80vh;overflow:auto;background:#fff;border:1px solid #ccc;border-radius:14px;box-shadow:0 10px 35px #0005;margin-top:8px;padding:12px"><div style="display:flex;gap:8px;align-items:center;position:sticky;top:-12px;background:#fff;padding:8px 0;z-index:2"><b style="flex:1">文体指紋でサブ垢探索 v1.3</b><button id="saf-run">文体比較スタート</button><button id="saf-close">×</button></div><div id="saf-status" style="font-size:12px;background:#f5f5f5;padding:8px;border-radius:8px;margin-bottom:8px">待機中</div><div style="font-size:11px;margin-bottom:8px">絵文字は補助5%。句読点38%・改行24%・文末14%・接続詞12%・見出し7%で本垢と比較。公開1記事・固定・べあスキを別加点。</div><div id="saf-results"></div></div>`;
    document.body.appendChild(host);
    const panel=$('#saf-panel',host),st=$('#saf-status',host),res=$('#saf-results',host);$('#saf-start',host).onclick=()=>panel.style.display=panel.style.display==='none'?'block':'none';$('#saf-close',host).onclick=()=>panel.style.display='none';const status=s=>st.textContent=s;
    $('#saf-run',host).onclick=async e=>{const btn=e.currentTarget;btn.disabled=true;res.innerHTML='';try{const b=await loadBaseline(status);status(`本垢${b.count}記事で指紋作成済み。候補検索へ…`);const sr=await searchPeriod(status);let cs=await enrichDetails(sr.cands,b.base,status);status(`期間内${cs.length}記事。文体上位をクリエイターページ確認…`);cs=await enrichCreators(cs,status);await enrichBear(cs,status);cs.sort((a,b)=>finalScore(b)-finalScore(a));status(`完了：${cs.length}候補。本垢文体類似度＋公開1記事＋べあスキで順位付け。`);res.innerHTML=cs.slice(0,60).map((c,i)=>{const a=`https://note.com/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`,p=`https://note.com/${encodeURIComponent(c.urlname)}`;return `<div style="border-top:1px solid #eee;padding:10px 2px"><div style="display:flex;gap:8px;align-items:center"><b style="font-size:17px">#${i+1} ${esc(c.nickname)}</b><strong style="margin-left:auto">${finalScore(c)}点</strong></div><div style="font-size:14px;font-weight:700">本垢文体類似度 ${c.sim.score}%</div><div style="font-size:12px">${esc(c.title)} / ${esc(c.publishAt)} / スキ${c.likes}</div><div style="font-size:11px;margin:5px 0">${esc(reason(c))}</div><div style="display:flex;gap:12px"><a href="${a}" target="_blank">記事</a><a href="${p}" target="_blank">クリエイターページ</a></div></div>`;}).join('')||'<b>候補なし</b>';}catch(err){console.error(err);status(`エラー: ${err.message||err}`);}finally{btn.disabled=false;}};
  }
  if(!document.getElementById('subacct-finder'))makeUI();
})();