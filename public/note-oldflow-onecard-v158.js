(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_OLDFLOW_ONECARD_158__) return;
  page.__MUMEI_OLDFLOW_ONECARD_158__ = true;

  const TARGET_URL = 'https://note.com/fuku444/n/n1f75e8cda614';
  const STATE_PREFIX = 'mumei_oldflow_onecard_v158';
  const PANEL = 'mumei-oldflow-onecard-v158';
  const STATUS = 'mumei-oldflow-onecard-status-v158';

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
    const id = 994000000 + Math.floor(Math.random() * 5000000);
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

  // 15.0のカード生成後保存と同じ待ち時間。
  async function saveLike150(label) {
    setStatus(label);
    await sleep(4200);
    const button = [...document.querySelectorAll('button')].find((node) =>
      node.textContent?.trim() === '一時保存' && node.getClientRects().length);
    if (button && !button.disabled) button.click();
    await sleep(6500);
  }

  // 15.2の「確認」で行っていた追加保存を再現。
  async function saveLike152Confirm(label) {
    setStatus(label);
    const button = [...document.querySelectorAll('button')].find((node) => {
      const text = node.textContent?.trim();
      return (text === '下書き保存' || text === '一時保存') && node.getClientRects().length;
    });
    if (button && !button.disabled) button.click();
    await sleep(3500);
  }

  function verifyTrackedCard(view, embKey) {
    return Boolean(embedNodes(view).find((hit) => cardKey(hit) === embKey && genuineTargetCard(hit)));
  }

  async function oldSend() {
    if (busy || !enabled()) return;
    busy = true;
    try {
      const view = findView();
      if (!view) throw new Error('EditorViewなし。画面を再読込してください');
      selectionApi();
      noteUrlCommandFactory();

      const previous = getState();
      if (previous?.embKey && embedNodes(view).some((hit) => cardKey(hit) === previous.embKey)) {
        throw new Error('旧フローテストカードが残っています。先に「旧削」');
      }

      const beforeKeys = new Set(embedNodes(view).map(cardKey).filter(Boolean));
      insertUrlAtEnd(view);
      setStatus('旧15.3再現｜本物カード1件生成中…');
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
      deleteHits(view, exactUrlParagraphs(view));
      const embKey = cardKey(hit);

      setState({ version: '15.8.0', articleKey: articleKey(), stage: 'sent_saved', embKey, url: TARGET_URL });
      await saveLike150('旧15.3再現｜カード生成後の1回目保存中…');
      if (!verifyTrackedCard(view, embKey)) throw new Error('1回目保存後カード確認NG');

      setStatus('旧送 完了 ✅ 次は必ず「旧確認」');
    } catch (error) {
      setStatus(`旧送停止：${error?.message || String(error)}（更新しない）`, true);
    } finally { busy = false; }
  }

  async function oldConfirm() {
    if (busy || !enabled()) return;
    busy = true;
    try {
      const state = getState();
      if (!state || state.version !== '15.8.0' || state.articleKey !== articleKey() || state.stage !== 'sent_saved' || !state.embKey) {
        throw new Error('先に「旧送」を完了してください');
      }
      const view = findView();
      if (!view) throw new Error('EditorViewなし。画面を再読込してください');
      if (!verifyTrackedCard(view, state.embKey)) throw new Error('旧送カードが見つかりません');

      await saveLike152Confirm('旧15.3再現｜投稿前「確認」の2回目保存中…');
      if (!verifyTrackedCard(view, state.embKey)) throw new Error('2回目保存後カード確認NG');

      setState({ ...state, stage: 'confirmed', confirmedAt: new Date().toISOString() });
      setStatus('旧確認 完了 ✅ これが当時の公開直前状態｜そのまま更新');
      page.alert(
        '旧15.3系の公開直前フローを再現しました。\n\n' +
        '1. 本物カード生成\n2. 1回目保存\n3. 旧「確認」で2回目保存\n\n' +
        '今は追加操作せず「公開に進む」→「更新」。\n通知確認後は「旧削」。'
      );
    } catch (error) {
      setStatus(`旧確認停止：${error?.message || String(error)}（更新しない）`, true);
    } finally { busy = false; }
  }

  async function oldDelete() {
    if (busy || !enabled()) return;
    busy = true;
    try {
      const state = getState();
      if (!state || state.version !== '15.8.0' || state.articleKey !== articleKey() || !state.embKey) {
        throw new Error('今回の旧フローカード記録がありません');
      }
      const view = findView();
      if (!view) throw new Error('EditorViewなし。画面を再読込してください');
      const hits = embedNodes(view).filter((hit) => cardKey(hit) === state.embKey);
      if (hits.length !== 1) throw new Error(`今回カード特定 ${hits.length}/1`);
      deleteHits(view, hits);
      if (embedNodes(view).some((hit) => cardKey(hit) === state.embKey)) throw new Error('今回カード削除確認NG');

      await saveLike150('旧フロー確認カード1枚だけ削除・保存中…');
      clearState();
      setStatus('旧削 完了 ✅ 今回の1枚だけ削除｜そのまま更新');
      page.alert('旧フロー確認カード1枚だけ削除完了。\n\nそのまま「公開に進む」→「更新」。');
    } catch (error) {
      setStatus(`旧削停止：${error?.message || String(error)}（更新しない）`, true);
    } finally { busy = false; }
  }

  function mount() {
    if (!enabled() || !document.body || document.getElementById(PANEL)) return;
    const panel = document.createElement('div');
    panel.id = PANEL;
    panel.innerHTML = `
      <style>
        #${PANEL}{position:fixed;right:8px;top:40%;z-index:2147483647;background:#1f2937;color:#fff;border:1px solid #6b7280;border-radius:12px;padding:8px;box-shadow:0 10px 30px rgba(0,0,0,.35);font-family:system-ui,sans-serif;width:166px}
        #${PANEL} .title{font-size:11px;font-weight:900;margin-bottom:6px}#${PANEL} .sub{font-size:9px;line-height:1.3;color:#d1d5db;margin-bottom:7px}
        #${PANEL} .row{display:flex;gap:5px}#${PANEL} button{flex:1;border:0;border-radius:8px;padding:8px 3px;font-weight:900;font-size:11px;color:#fff;background:#7c3aed}#${PANEL} button[data-action="confirm"]{background:#b45309}#${PANEL} button[data-action="delete"]{background:#b91c1c}
        #${STATUS}{margin-top:7px;font-size:10px;line-height:1.35;color:#ede9fe}#${STATUS}[data-bad="1"]{color:#fecaca}
      </style>
      <div class="title">旧15.3系｜1件再現テスト</div>
      <div class="sub">実績の算数1件だけ。既存本文・画像・画像🔗・107カードは触らない。</div>
      <div class="row"><button data-action="send">旧送</button><button data-action="confirm">旧確認</button><button data-action="delete">旧削</button></div>
      <div id="${STATUS}">旧送 → 旧確認 → 更新</div>`;
    panel.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      if (button.dataset.action === 'send') oldSend();
      if (button.dataset.action === 'confirm') oldConfirm();
      if (button.dataset.action === 'delete') oldDelete();
    });
    document.body.appendChild(panel);
  }

  setInterval(mount, 500);
  mount();
})();
