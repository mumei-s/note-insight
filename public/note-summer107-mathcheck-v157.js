(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_SUMMER107_MATHCHECK_157__) return;
  page.__MUMEI_SUMMER107_MATHCHECK_157__ = true;

  const TARGET_URL = 'https://note.com/fuku444/n/n1f75e8cda614';
  const STATE_PREFIX = 'mumei_summer107_mathcheck_v157';
  const PANEL = 'mumei-summer107-mathcheck-v157';
  const STATUS = 'mumei-summer107-mathcheck-status-v157';

  let busy = false;
  let viewCache = null;
  let selectionCache = null;
  let noteUrlCommand = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function enabled() {
    return /^\/notes\/n[a-z0-9]{8,}\/edit\/?$/i.test(location.pathname) && Boolean(articleKey());
  }
  function stateKey() {
    return `${STATE_PREFIX}:${articleKey() || 'unknown'}`;
  }
  function getState() {
    try { return JSON.parse(localStorage.getItem(stateKey()) || 'null'); }
    catch (_) { return null; }
  }
  function setState(value) {
    localStorage.setItem(stateKey(), JSON.stringify(value));
  }
  function clearState() {
    localStorage.removeItem(stateKey());
  }
  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const u = new URL(raw, location.href);
      u.search = '';
      u.hash = '';
      return u.href;
    } catch (_) { return raw; }
  }
  function setStatus(text, bad = false) {
    const node = document.getElementById(STATUS);
    if (!node) return;
    node.textContent = text;
    node.dataset.bad = bad ? '1' : '0';
  }

  function editor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') || document.querySelector('.ProseMirror');
  }
  function looksLikeView(value) {
    try {
      return Boolean(value && typeof value === 'object' && value.state?.doc && value.state?.schema &&
        typeof value.dispatch === 'function' && value.dom && typeof value.posAtDOM === 'function');
    } catch (_) { return false; }
  }
  function findView() {
    if (looksLikeView(viewCache) && viewCache.dom?.isConnected) return viewCache;
    const root = editor();
    if (!root) return null;
    const seen = new Set();
    const queue = [];
    let seed = root;
    for (let i = 0; i < 6 && seed; i += 1, seed = seed.parentElement) queue.push([seed, 0]);
    let steps = 0;
    while (queue.length && steps++ < 14000) {
      const [value, depth] = queue.shift();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      if (looksLikeView(value)) return (viewCache = value);
      let keys = [];
      try { keys = Object.getOwnPropertyNames(value); } catch (_) { continue; }
      for (const key of keys) {
        if (['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(key)) continue;
        let next;
        try { next = value[key]; } catch (_) { continue; }
        if (looksLikeView(next)) return (viewCache = next);
        if (depth < 7 && next && (typeof next === 'object' || typeof next === 'function') && next !== page && next !== document) {
          queue.push([next, depth + 1]);
        }
      }
    }
    return null;
  }

  function webpackRequire() {
    const chunks = page.webpackChunk_N_E;
    if (!chunks || typeof chunks.push !== 'function') return null;
    let req = null;
    const id = 993000000 + Math.floor(Math.random() * 6000000);
    try { chunks.push([[id], {}, (runtimeRequire) => { req = runtimeRequire; }]); } catch (_) {}
    return req;
  }
  function selectionApi() {
    if (selectionCache) return selectionCache;
    const req = webpackRequire();
    if (!req) throw new Error('note内部Selectionを取得できません');
    let mod;
    try { mod = req(44044); } catch (_) {}
    const Selection = mod?.Y1;
    if (typeof Selection?.atEnd !== 'function') throw new Error('note Selectionが見つかりません');
    selectionCache = Selection;
    return Selection;
  }
  function noteUrlCommandFactory() {
    if (typeof noteUrlCommand === 'function') return noteUrlCommand;
    const req = webpackRequire();
    if (!req) throw new Error('note内部URL処理を取得できません');
    let mod;
    try { mod = req(94928); } catch (_) {}
    let candidate = typeof mod?.fjT === 'function' ? mod.fjT : null;
    const looksRight = (value) => {
      if (typeof value !== 'function') return false;
      let source = '';
      try { source = Function.prototype.toString.call(value); } catch (_) {}
      return source.includes('state.selection') && source.includes('nodeBefore') &&
        source.includes('replaceRangeWith') && source.includes('.then');
    };
    if (!looksRight(candidate)) {
      const loaded = Object.values(req.c || {}).flatMap((entry) => {
        const exp = entry?.exports;
        if (typeof exp === 'function') return [exp];
        return exp && typeof exp === 'object' ? Object.values(exp) : [];
      });
      candidate = loaded.find(looksRight) || null;
    }
    if (!looksRight(candidate)) throw new Error('note正規URLコマンドが見つかりません');
    noteUrlCommand = candidate;
    return noteUrlCommand;
  }

  function embedNodes(view) {
    const list = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type?.name === 'embed') list.push({ node, pos });
    });
    return list;
  }
  function cardKey(hit) {
    return String(hit?.node?.attrs?.embeddedContentKey || '');
  }
  function cardUrl(hit) {
    return normalizeUrl(hit?.node?.attrs?.src);
  }
  function genuineTargetCard(hit) {
    const key = cardKey(hit);
    const html = String(hit?.node?.attrs?.htmlForEmbed || '');
    return cardUrl(hit) === normalizeUrl(TARGET_URL) && /^emb[a-z0-9]+$/i.test(key) && html.includes('note-embed');
  }
  function exactUrlParagraphs(view) {
    const list = [];
    view.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      if (normalizeUrl((node.textContent || '').trim()) === normalizeUrl(TARGET_URL)) list.push({ node, pos });
    });
    return list;
  }
  function deleteHits(view, hits) {
    if (!hits.length) return 0;
    const unique = new Map();
    hits.forEach((hit) => unique.set(`${hit.pos}:${hit.node.nodeSize}`, hit));
    let tr = view.state.tr;
    [...unique.values()].sort((a, b) => b.pos - a.pos).forEach((hit) => {
      tr = tr.delete(hit.pos, hit.pos + hit.node.nodeSize);
    });
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return unique.size;
  }
  function ensureEndSelection(view) {
    const paragraph = view.state.schema.nodes.paragraph;
    if (!paragraph) throw new Error('paragraph nodeなし');
    if (view.state.doc.lastChild?.type !== paragraph || view.state.doc.lastChild.textContent !== '') {
      view.dispatch(view.state.tr.insert(view.state.doc.content.size, paragraph.create()));
    }
    view.dispatch(view.state.tr.setSelection(selectionApi().atEnd(view.state.doc)).scrollIntoView());
    view.focus();
  }
  function insertUrlAtEnd(view) {
    ensureEndSelection(view);
    const paragraph = view.state.schema.nodes.paragraph;
    const node = paragraph.create(null, view.state.schema.text(TARGET_URL));
    view.dispatch(view.state.tr.insert(view.state.doc.content.size, node));
    view.dispatch(view.state.tr.setSelection(selectionApi().atEnd(view.state.doc)).scrollIntoView());
    view.focus();
  }
  async function waitForNewCard(view, beforeKeys, timeout = 45000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const hit = embedNodes(view).find((entry) => {
        const key = cardKey(entry);
        return key && !beforeKeys.has(key) && genuineTargetCard(entry);
      });
      if (hit) return hit;
      await sleep(250);
    }
    return null;
  }
  async function saveOnce(label) {
    setStatus(label);
    await sleep(4200);
    const button = [...document.querySelectorAll('button')].find((node) => {
      const text = node.textContent?.trim();
      return (text === '一時保存' || text === '下書き保存') && node.getClientRects().length;
    });
    if (button && !button.disabled) button.click();
    await sleep(6500);
  }

  async function sendMath() {
    if (busy || !enabled()) return;
    busy = true;
    try {
      const view = findView();
      if (!view) throw new Error('EditorViewなし。画面を再読込してください');
      selectionApi();
      noteUrlCommandFactory();

      const previous = getState();
      if (previous?.stage === 'card_ready' && previous?.embKey) {
        const still = embedNodes(view).some((hit) => cardKey(hit) === previous.embKey);
        if (still) throw new Error('前回の算数確認カードが残っています。先に「算削」');
      }

      const beforeKeys = new Set(embedNodes(view).map(cardKey).filter(Boolean));
      insertUrlAtEnd(view);
      setStatus('実績の算数 1件を新規カード生成中…');

      const command = noteUrlCommandFactory()(TARGET_URL);
      const handled = command(view.state, (transaction) => view.dispatch(transaction), view);
      if (!handled) {
        deleteHits(view, exactUrlParagraphs(view));
        throw new Error('note正規URLコマンド未処理');
      }

      const hit = await waitForNewCard(view, beforeKeys);
      if (!hit) {
        deleteHits(view, exactUrlParagraphs(view));
        throw new Error('新規embカード確認タイムアウト');
      }

      // URL文字だけを消す。既存の同URLカード・画像・リンクは触らない。
      deleteHits(view, exactUrlParagraphs(view));
      const embKey = cardKey(hit);
      setState({
        version: '15.7.0',
        articleKey: articleKey(),
        stage: 'card_ready',
        embKey,
        url: TARGET_URL,
        createdAt: new Date().toISOString()
      });

      await saveOnce('実績の算数 1件を1回だけ保存中…');

      const verified = embedNodes(view).find((entry) => cardKey(entry) === embKey && genuineTargetCard(entry));
      if (!verified) throw new Error('保存後の算数カード再確認NG');

      setStatus('算送 完了 ✅ 新しい1枚だけ追加済み｜追加保存せず今すぐ更新');
      page.alert(
        '実績の算数 1件確認準備完了\n\n' +
        '今回新規追加: 1枚\n' +
        '既存107カード: 変更なし\n' +
        '本文・画像・画像リンク: 変更なし\n\n' +
        '追加保存せず、そのまま「公開に進む」→「更新」。\n' +
        '通知確認後、編集へ戻って「算削」。'
      );
    } catch (error) {
      setStatus(`算送停止：${error?.message || String(error)}（更新しない）`, true);
    } finally {
      busy = false;
    }
  }

  async function deleteMath() {
    if (busy || !enabled()) return;
    busy = true;
    try {
      const state = getState();
      if (!state || state.version !== '15.7.0' || state.articleKey !== articleKey() || !state.embKey) {
        throw new Error('今回の算数確認カード記録がありません');
      }
      const view = findView();
      if (!view) throw new Error('EditorViewなし。画面を再読込してください');

      const hits = embedNodes(view).filter((hit) => cardKey(hit) === state.embKey);
      if (hits.length !== 1) throw new Error(`今回の算数カード特定 ${hits.length}/1`);
      deleteHits(view, hits);

      if (embedNodes(view).some((hit) => cardKey(hit) === state.embKey)) {
        throw new Error('今回の算数カード削除確認NG');
      }

      await saveOnce('今回の算数カード1枚だけ削除・1回保存中…');
      clearState();
      setStatus('算削 完了 ✅ 今回の1枚だけ削除｜107カード・本文・画像は保持');
      page.alert('算数確認カード1枚だけ削除完了。\n\nそのまま「公開に進む」→「更新」。');
    } catch (error) {
      setStatus(`算削停止：${error?.message || String(error)}（更新しない）`, true);
    } finally {
      busy = false;
    }
  }

  function mount() {
    if (!enabled() || !document.body || document.getElementById(PANEL)) return;
    const panel = document.createElement('div');
    panel.id = PANEL;
    panel.innerHTML = `
      <style>
        #${PANEL}{position:fixed;right:8px;top:54%;z-index:2147483647;background:#111827;color:#fff;border:1px solid #475569;border-radius:12px;padding:8px;box-shadow:0 10px 30px rgba(0,0,0,.35);font-family:system-ui,sans-serif;width:154px}
        #${PANEL} .title{font-size:11px;font-weight:900;margin-bottom:6px}#${PANEL} .sub{font-size:9px;line-height:1.3;color:#cbd5e1;margin-bottom:7px}
        #${PANEL} .row{display:flex;gap:6px}#${PANEL} button{flex:1;border:0;border-radius:8px;padding:8px 4px;font-weight:900;font-size:12px;color:#fff;background:#2563eb}#${PANEL} button[data-action="delete"]{background:#b91c1c}
        #${STATUS}{margin-top:7px;font-size:10px;line-height:1.35;color:#dbeafe}#${STATUS}[data-bad="1"]{color:#fecaca}
      </style>
      <div class="title">実績の算数｜再通知確認</div>
      <div class="sub">fuku444 / n1f75e8cda614<br>今回の新規1枚だけを管理</div>
      <div class="row"><button data-action="send">算送</button><button data-action="delete">算削</button></div>
      <div id="${STATUS}">全107は触らず「算送」</div>`;
    panel.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      if (button.dataset.action === 'send') sendMath();
      if (button.dataset.action === 'delete') deleteMath();
    });
    document.body.appendChild(panel);
  }

  setInterval(mount, 500);
  mount();
})();
