(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_SUMMER107_RESEND_154__) return;
  page.__MUMEI_SUMMER107_RESEND_154__ = true;

  const PANEL = 'summer107-panel-v1500';
  const STATUS = 'summer107-status-v1500';
  const MANIFEST_URL = 'https://mumei-s.github.io/note-insight/note-summer-107/manifest.json';
  const EXPECTED = 107;
  const STATE_PREFIX = 'mumei_summer107_resend_v154';

  let busy = false;
  let viewCache = null;
  let selectionCache = null;
  let noteUrlCommand = null;
  let rowsCache = null;

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
  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, location.href);
      url.search = '';
      url.hash = '';
      return url.href;
    } catch (_) {
      return raw;
    }
  }
  function setStatus(text, bad = false) {
    const node = document.getElementById(STATUS);
    if (!node) return;
    node.textContent = text;
    node.dataset.bad = bad ? '1' : '0';
    node.dataset.open = '1';
  }

  function request(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'text',
        timeout: 45000,
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText || res.response || '');
          else reject(new Error(`manifest GET ${res.status}`));
        },
        onerror: () => reject(new Error('manifest通信失敗')),
        ontimeout: () => reject(new Error('manifest通信タイムアウト'))
      });
    });
  }

  async function loadRows() {
    if (rowsCache?.length === EXPECTED) return rowsCache;
    const text = await request(MANIFEST_URL);
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error('manifest解析失敗'); }
    if (!Array.isArray(data?.items) || data.items.length !== EXPECTED) {
      throw new Error(`manifest件数不一致 ${data?.items?.length || 0}/${EXPECTED}`);
    }
    const rows = data.items.map((item, i) => ({
      index: i + 1,
      url: normalizeUrl(item?.url),
      creator: String(item?.creator || ''),
      title: String(item?.title || '')
    }));
    const unique = new Set(rows.map((row) => row.url));
    if (unique.size !== EXPECTED || [...unique].some((url) => !url)) {
      throw new Error(`manifest URL一意性不一致 ${unique.size}/${EXPECTED}`);
    }
    rowsCache = rows;
    return rows;
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
    const id = 985000000 + Math.floor(Math.random() * 10000000);
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
  function genuineCard(hit, targetUrl = '') {
    const key = cardKey(hit);
    const html = String(hit?.node?.attrs?.htmlForEmbed || '');
    if (!/^emb[a-z0-9]+$/i.test(key) || !html.includes('note-embed')) return false;
    return !targetUrl || cardUrl(hit) === normalizeUrl(targetUrl);
  }
  function allKeys(view) {
    return new Set(embedNodes(view).map(cardKey).filter(Boolean));
  }
  function exactUrlParagraphs(view, url) {
    const target = normalizeUrl(url);
    const list = [];
    view.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      if (normalizeUrl((node.textContent || '').trim()) === target) list.push({ node, pos });
    });
    return list;
  }
  function deleteHits(view, hits) {
    const unique = new Map();
    (hits || []).forEach((hit) => {
      if (hit?.node) unique.set(`${hit.pos}:${hit.node.nodeSize}`, hit);
    });
    if (!unique.size) return 0;
    let tr = view.state.tr;
    [...unique.values()].sort((a, b) => b.pos - a.pos).forEach((hit) => {
      tr = tr.delete(hit.pos, hit.pos + hit.node.nodeSize);
    });
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return unique.size;
  }
  function deleteLastExactUrl(view, url) {
    const hits = exactUrlParagraphs(view, url).sort((a, b) => b.pos - a.pos);
    if (hits[0]) deleteHits(view, [hits[0]]);
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
  function insertUrlAtEnd(view, url) {
    ensureEndSelection(view);
    const paragraph = view.state.schema.nodes.paragraph;
    const node = paragraph.create(null, view.state.schema.text(url));
    view.dispatch(view.state.tr.insert(view.state.doc.content.size, node));
    view.dispatch(view.state.tr.setSelection(selectionApi().atEnd(view.state.doc)).scrollIntoView());
    view.focus();
  }
  async function waitForNewCard(view, url, beforeKeys, timeout = 45000) {
    const deadline = Date.now() + timeout;
    const target = normalizeUrl(url);
    while (Date.now() < deadline) {
      const hit = embedNodes(view).find((entry) => {
        const key = cardKey(entry);
        return key && !beforeKeys.has(key) && genuineCard(entry, target);
      });
      if (hit) return hit;
      await sleep(250);
    }
    return null;
  }

  async function saveOnce() {
    setStatus('再送カード107件を1回だけ保存中…');
    await sleep(4200);
    const button = [...document.querySelectorAll('button')].find((node) => {
      const text = node.textContent?.trim();
      return (text === '一時保存' || text === '下書き保存') && node.getClientRects().length;
    });
    if (button && !button.disabled) button.click();
    await sleep(6500);
  }

  function verifyKeys(view, keys, urls) {
    const keySet = new Set(keys);
    const found = embedNodes(view).filter((hit) => keySet.has(cardKey(hit)));
    if (found.length !== keys.length) throw new Error(`今回カード再確認 ${found.length}/${keys.length}`);
    const foundMap = new Map(found.map((hit) => [cardKey(hit), cardUrl(hit)]));
    for (let i = 0; i < keys.length; i += 1) {
      if (foundMap.get(keys[i]) !== normalizeUrl(urls[i])) {
        throw new Error(`今回カードURL不一致 ${i + 1}`);
      }
    }
    return true;
  }

  async function resend107() {
    if (busy || !enabled()) return;
    busy = true;
    try {
      const rows = await loadRows();
      const view = findView();
      if (!view) throw new Error('EditorViewなし。画面を再読込してください');
      selectionApi();
      noteUrlCommandFactory();

      const oldState = getState();
      if (oldState?.stage === 'cards_ready' && Array.isArray(oldState.keys)) {
        const still = new Set(embedNodes(view).map(cardKey));
        const remaining = oldState.keys.filter((key) => still.has(key));
        if (remaining.length) throw new Error(`前回の再送カードが${remaining.length}枚残っています。先に「再削」`);
      }

      const createdKeys = [];
      const createdUrls = [];

      setStatus('再送107開始｜既存本文・画像・受賞者カードは触りません');

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const beforeKeys = allKeys(view);
        insertUrlAtEnd(view, row.url);
        setStatus(`再送 本物カード ${i + 1}/${EXPECTED} 生成中…`);

        const command = noteUrlCommandFactory()(row.url);
        const handled = command(view.state, (transaction) => view.dispatch(transaction), view);
        if (!handled) {
          deleteLastExactUrl(view, row.url);
          throw new Error(`${i + 1}/${EXPECTED} note正規URLコマンド未処理`);
        }

        const hit = await waitForNewCard(view, row.url, beforeKeys);
        if (!hit) {
          deleteLastExactUrl(view, row.url);
          throw new Error(`${i + 1}/${EXPECTED} 新規embカード確認タイムアウト`);
        }

        deleteLastExactUrl(view, row.url);
        createdKeys.push(cardKey(hit));
        createdUrls.push(row.url);
        setStatus(`再送 本物カード ${i + 1}/${EXPECTED} ✅`);
        if (i < rows.length - 1) await sleep(900);
      }

      if (createdKeys.length !== EXPECTED || new Set(createdKeys).size !== EXPECTED) {
        throw new Error(`今回embキー数不一致 ${createdKeys.length}/${EXPECTED}`);
      }
      verifyKeys(view, createdKeys, createdUrls);

      setState({
        version: '15.4.0',
        articleKey: articleKey(),
        stage: 'cards_ready',
        keys: createdKeys,
        urls: createdUrls,
        createdAt: new Date().toISOString()
      });

      await saveOnce();
      verifyKeys(view, createdKeys, createdUrls);

      setStatus(`再送カード ${EXPECTED}/${EXPECTED} 新規生成・保存完了 ✅ 今すぐ「公開に進む」→「更新」`);
      page.alert(
        `再送107 完了\n\n` +
        `今回新しく作った本物カード: ${EXPECTED}/${EXPECTED}\n` +
        `既存画像: 変更なし\n` +
        `受賞者カード等: 変更なし\n\n` +
        `追加の「確認」や保存は押さず、今すぐnoteの「公開に進む」→「更新」。\n` +
        `更新後、通知確認をしてから編集へ戻り「再削」を押してください。`
      );
    } catch (error) {
      setStatus(`再送停止：${error?.message || String(error)}（更新しない）`, true);
    } finally {
      busy = false;
    }
  }

  async function deleteResendCards() {
    if (busy || !enabled()) return;
    busy = true;
    try {
      const state = getState();
      if (!state || state.version !== '15.4.0' || state.articleKey !== articleKey() ||
        !Array.isArray(state.keys) || !Array.isArray(state.urls) || state.keys.length !== EXPECTED) {
        throw new Error('今回の再送107の固定embキーがありません。削除しません');
      }

      const view = findView();
      if (!view) throw new Error('EditorViewなし。画面を再読込してください');
      verifyKeys(view, state.keys, state.urls);

      const wanted = new Set(state.keys);
      const hits = embedNodes(view).filter((hit) => wanted.has(cardKey(hit)));
      if (hits.length !== EXPECTED) throw new Error(`再削対象 ${hits.length}/${EXPECTED}`);

      deleteHits(view, hits);
      const after = new Set(embedNodes(view).map(cardKey));
      const remaining = state.keys.filter((key) => after.has(key));
      if (remaining.length) throw new Error(`再削残り ${remaining.length}枚`);

      setState({ ...state, stage: 'cards_deleted', deletedAt: new Date().toISOString() });
      setStatus(`再送カード ${EXPECTED}枚だけ削除 ✅ 既存画像・受賞者カードは保持｜保存中…`);
      await saveOnce();

      const afterSave = new Set(embedNodes(view).map(cardKey));
      const left = state.keys.filter((key) => afterSave.has(key));
      if (left.length) throw new Error(`保存後も再送カードが${left.length}枚残っています`);

      setStatus(`再送カード ${EXPECTED}枚だけ削除・保存完了 ✅ 「公開に進む」→「更新」`);
      page.alert(
        `再削 完了\n\n` +
        `今回の再送カード107枚だけ削除しました。\n` +
        `極薄画像・リンク・受賞者カード・107対象外カードは触っていません。\n\n` +
        `noteの「公開に進む」→「更新」で完了です。`
      );
    } catch (error) {
      setStatus(`再削停止：${error?.message || String(error)}（更新しない）`, true);
    } finally {
      busy = false;
    }
  }

  function mountButtons() {
    const panel = document.getElementById(PANEL);
    if (!panel || !enabled()) return;

    if (!panel.querySelector('[data-action="resend107"]')) {
      const send = document.createElement('button');
      send.type = 'button';
      send.dataset.action = 'resend107';
      send.textContent = '再送';
      send.title = '画像は触らず、本物カード107件を新規生成して再通知用に保存';
      send.style.background = '#b91c1c';
      send.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        resend107();
      }, true);
      panel.insertBefore(send, panel.firstChild);
    }

    if (!panel.querySelector('[data-action="resendDelete"]')) {
      const del = document.createElement('button');
      del.type = 'button';
      del.dataset.action = 'resendDelete';
      del.textContent = '再削';
      del.title = '今回の再送で新しく作ったembキー107件だけ削除';
      del.style.background = '#7c3aed';
      del.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        deleteResendCards();
      }, true);
      const close = panel.querySelector('[data-action="close"]');
      panel.insertBefore(del, close || null);
    }
  }

  setInterval(mountButtons, 500);
  mountButtons();
})();
