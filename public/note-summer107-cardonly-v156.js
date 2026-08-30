(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_SUMMER107_CARDONLY_156__) return;
  page.__MUMEI_SUMMER107_CARDONLY_156__ = true;

  const VERSION = '15.6.0';
  const EXPECTED = 107;
  const MANIFEST_URL = 'https://mumei-s.github.io/note-insight/note-summer-107/manifest.json';
  const STATE_PREFIX = 'mumei_summer107_cardonly_v156';
  const PANEL = 'mumei-summer107-cardonly-v156';
  const STATUS = 'mumei-summer107-cardonly-status-v156';

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
  function genuineCard(hit, targetUrl) {
    const key = cardKey(hit);
    const html = String(hit?.node?.attrs?.htmlForEmbed || '');
    return cardUrl(hit) === normalizeUrl(targetUrl) && /^emb[a-z0-9]+$/i.test(key) && html.includes('note-embed');
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
    while (Date.now() < deadline) {
      const hit = embedNodes(view).find((entry) => {
        const key = cardKey(entry);
        return key && !beforeKeys.has(key) && genuineCard(entry, url);
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

  function verifyCreated(view, keys, urls) {
    if (keys.length !== urls.length) throw new Error(`今回カード記録不一致 ${keys.length}/${urls.length}`);
    const wanted = new Set(keys);
    const found = embedNodes(view).filter((hit) => wanted.has(cardKey(hit)));
    if (found.length !== keys.length) throw new Error(`今回カード再確認 ${found.length}/${keys.length}`);
    const byKey = new Map(found.map((hit) => [cardKey(hit), cardUrl(hit)]));
    for (let i = 0; i < keys.length; i += 1) {
      if (byKey.get(keys[i]) !== normalizeUrl(urls[i])) throw new Error(`今回カードURL不一致 ${i + 1}`);
    }
    return true;
  }

  async function sendAll() {
    if (busy || !enabled()) return;
    busy = true;
    try {
      const rows = await loadRows();
      const view = findView();
      if (!view) throw new Error('EditorViewなし。画面を再読込してください');
      selectionApi();
      noteUrlCommandFactory();

      const previous = getState();
      if (previous?.stage === 'cards_ready' && Array.isArray(previous.keys)) {
        const current = new Set(embedNodes(view).map(cardKey).filter(Boolean));
        const remaining = previous.keys.filter((key) => current.has(key));
        if (remaining.length) throw new Error(`前回の今回分カードが${remaining.length}枚残っています。先に「全削」`);
      }

      const createdKeys = [];
      const createdUrls = [];
      setState({ version: VERSION, articleKey: articleKey(), stage: 'building', keys: [], urls: [], at: new Date().toISOString() });
      setStatus('全107開始｜既存本文・画像・画像🔗・既存カードは保持');

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const beforeKeys = allKeys(view);
        insertUrlAtEnd(view, row.url);
        setStatus(`本物カード ${i + 1}/${EXPECTED} 生成中…`);

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
        setState({
          version: VERSION,
          articleKey: articleKey(),
          stage: 'building',
          keys: createdKeys,
          urls: createdUrls,
          progress: i + 1,
          at: new Date().toISOString()
        });
        setStatus(`本物カード ${i + 1}/${EXPECTED} ✅`);
        if (i < rows.length - 1) await sleep(900);
      }

      if (createdKeys.length !== EXPECTED || new Set(createdKeys).size !== EXPECTED) {
        throw new Error(`今回embキー数不一致 ${createdKeys.length}/${EXPECTED}`);
      }
      verifyCreated(view, createdKeys, createdUrls);

      setState({
        version: VERSION,
        articleKey: articleKey(),
        stage: 'cards_ready',
        keys: createdKeys,
        urls: createdUrls,
        progress: EXPECTED,
        createdAt: new Date().toISOString()
      });

      await saveOnce('本物カード107件を1回だけ保存中…');
      verifyCreated(view, createdKeys, createdUrls);

      setStatus('107/107 本物カード生成・1回保存完了 ✅ 追加保存せず今すぐ公開/更新');
      page.alert(
        '夏107 カード送信準備完了\n\n' +
        '今回新しく作った本物カード: 107/107\n' +
        '既存本文: 変更なし\n' +
        '既存画像・画像リンク: 変更なし\n' +
        '既存カード: 変更なし\n\n' +
        '追加の確認・保存は押さず、そのまま「公開に進む」→「更新」。\n' +
        '通知後、編集へ戻って「全削」。'
      );
    } catch (error) {
      const state = getState();
      const count = Array.isArray(state?.keys) ? state.keys.length : 0;
      setStatus(`全送停止：${error?.message || String(error)}｜今回生成済み ${count}/${EXPECTED}（公開しない）`, true);
    } finally {
      busy = false;
    }
  }

  async function deleteAll() {
    if (busy || !enabled()) return;
    busy = true;
    try {
      const state = getState();
      if (!state || state.version !== VERSION || state.articleKey !== articleKey() || !Array.isArray(state.keys) || !state.keys.length) {
        throw new Error('今回のカード記録がありません');
      }
      const view = findView();
      if (!view) throw new Error('EditorViewなし。画面を再読込してください');

      const wanted = new Set(state.keys);
      const hits = embedNodes(view).filter((hit) => wanted.has(cardKey(hit)));
      if (hits.length !== state.keys.length) {
        throw new Error(`今回カード特定 ${hits.length}/${state.keys.length}`);
      }

      const beforeOtherKeys = new Set(embedNodes(view).map(cardKey).filter((key) => key && !wanted.has(key)));
      const removed = deleteHits(view, hits);
      const afterKeys = new Set(embedNodes(view).map(cardKey).filter(Boolean));
      const leftover = state.keys.filter((key) => afterKeys.has(key));
      if (leftover.length) throw new Error(`今回カード削除残り ${leftover.length}`);
      const missingOther = [...beforeOtherKeys].filter((key) => !afterKeys.has(key));
      if (missingOther.length) throw new Error(`既存カードが${missingOther.length}件変化したため保存停止`);

      await saveOnce(`今回の本物カード${removed}件だけ削除・1回保存中…`);
      clearState();
      setStatus(`今回の107カードだけ削除完了 ✅ 本文・画像・画像🔗・既存カードは保持｜このまま更新`);
      page.alert(
        `今回追加したカード ${removed}件だけ削除完了。\n\n` +
        '本文・画像・画像リンク・既存カードは触っていません。\n' +
        'そのまま「公開に進む」→「更新」。'
      );
    } catch (error) {
      setStatus(`全削停止：${error?.message || String(error)}（更新しない）`, true);
    } finally {
      busy = false;
    }
  }

  function mount() {
    if (!enabled() || !document.body) return;
    if (document.getElementById(PANEL)) return;

    const panel = document.createElement('div');
    panel.id = PANEL;
    panel.innerHTML = `
      <style>
        #${PANEL}{position:fixed;right:8px;top:38%;z-index:2147483647;background:#0f172a;color:#fff;border:1px solid #334155;border-radius:12px;padding:8px;box-shadow:0 10px 30px rgba(0,0,0,.35);font-family:system-ui,sans-serif;width:160px}
        #${PANEL} .title{font-size:11px;font-weight:900;margin-bottom:6px}
        #${PANEL} .sub{font-size:9px;line-height:1.3;color:#cbd5e1;margin-bottom:7px}
        #${PANEL} .row{display:flex;gap:6px}
        #${PANEL} button{flex:1;border:0;border-radius:8px;padding:8px 4px;font-weight:900;font-size:12px;color:#fff;background:#059669}
        #${PANEL} button[data-action="delete"]{background:#b91c1c}
        #${STATUS}{margin-top:7px;font-size:10px;line-height:1.35;color:#d1fae5}
        #${STATUS}[data-bad="1"]{color:#fecaca}
      </style>
      <div class="title">夏107 カードのみ v15.6</div>
      <div class="sub">既存本文・画像・画像🔗は保持</div>
      <div class="row">
        <button type="button" data-action="send">全送</button>
        <button type="button" data-action="delete">全削</button>
      </div>
      <div id="${STATUS}">「全送」で107件の本物カードだけ追加</div>`;

    panel.addEventListener('click', (event) => {
      const button = event.target?.closest?.('button[data-action]');
      if (!button) return;
      if (button.dataset.action === 'send') sendAll();
      if (button.dataset.action === 'delete') deleteAll();
    });

    document.body.appendChild(panel);
  }

  setInterval(mount, 500);
  mount();
})();
