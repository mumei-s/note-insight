(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_SUMMER107_152_SAFE_DELETE__) return;
  page.__MUMEI_SUMMER107_152_SAFE_DELETE__ = true;

  const PANEL = 'summer107-panel-v1500';
  const STATUS = 'summer107-status-v1500';
  const MANIFEST_URL = 'https://mumei-s.github.io/note-insight/note-summer-107/manifest.json';
  const EXPECTED = 107;
  const SAFE_PREFIX = 'mumei_summer107_safe_delete_v152';

  let busy = false;
  let viewCache = null;
  let manifestRows = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function safeKey() {
    return `${SAFE_PREFIX}:${articleKey() || 'unknown'}`;
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
  function setSafeState(value) {
    localStorage.setItem(safeKey(), JSON.stringify(value));
  }
  function getSafeState() {
    try { return JSON.parse(localStorage.getItem(safeKey()) || 'null'); }
    catch (_) { return null; }
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
  async function loadManifestRows() {
    if (manifestRows?.length === EXPECTED) return manifestRows;
    const text = await request(MANIFEST_URL);
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error('manifest解析失敗'); }
    if (!Array.isArray(data?.items) || data.items.length !== EXPECTED) {
      throw new Error(`manifest件数不一致 ${data?.items?.length || 0}/${EXPECTED}`);
    }
    const rows = data.items.map((item, i) => ({
      index: i + 1,
      url: normalizeUrl(item?.url)
    }));
    const unique = new Set(rows.map((row) => row.url));
    if (unique.size !== EXPECTED || [...unique].some((url) => !url)) {
      throw new Error(`manifest URL一意性不一致 ${unique.size}/${EXPECTED}`);
    }
    manifestRows = rows;
    return rows;
  }

  function editor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') ||
      document.querySelector('.ProseMirror');
  }
  function looksLikeView(value) {
    try {
      return Boolean(value && typeof value === 'object' && value.state?.doc &&
        value.state?.schema && typeof value.dispatch === 'function' &&
        value.dom && typeof value.posAtDOM === 'function');
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
        if (depth < 7 && next && (typeof next === 'object' || typeof next === 'function') &&
          next !== page && next !== document) queue.push([next, depth + 1]);
      }
    }
    return null;
  }

  function imageNodes(view) {
    const list = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type?.name === 'image') list.push({ node, pos });
    });
    return list;
  }
  function embedNodes(view) {
    const list = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type?.name === 'embed') list.push({ node, pos });
    });
    return list;
  }
  function validNoteCard(hit, targetSet) {
    const node = hit?.node;
    if (node?.type?.name !== 'embed') return false;
    const url = normalizeUrl(node.attrs?.src);
    const key = String(node.attrs?.embeddedContentKey || '');
    const html = String(node.attrs?.htmlForEmbed || '');
    return targetSet.has(url) && /^emb[a-z0-9]+$/i.test(key) && html.includes('note-embed');
  }
  function cardKey(hit) {
    return String(hit?.node?.attrs?.embeddedContentKey || '');
  }
  function cardUrl(hit) {
    return normalizeUrl(hit?.node?.attrs?.src);
  }

  function verifyThinImages(view, rows) {
    const targetSet = new Set(rows.map((row) => row.url));
    const images = imageNodes(view).filter(({ node }) => targetSet.has(normalizeUrl(node.attrs?.link)));
    if (images.length !== EXPECTED) {
      throw new Error(`加工サムネイル＋⛓‍💥 ${images.length}/${EXPECTED}`);
    }
    const actual = images.map(({ node }) => normalizeUrl(node.attrs?.link));
    for (let i = 0; i < EXPECTED; i += 1) {
      if (actual[i] !== rows[i].url) throw new Error(`加工サムネイル順番不一致 ${i + 1}`);
    }
    return images;
  }

  function trailingTemporaryCards(view, targetSet) {
    const top = [];
    view.state.doc.forEach((node, offset) => top.push({ node, pos: offset }));
    const result = [];
    let started = false;

    for (let i = top.length - 1; i >= 0; i -= 1) {
      const hit = top[i];
      const node = hit.node;
      if (node.isTextblock && !(node.textContent || '').trim()) continue;
      if (validNoteCard(hit, targetSet)) {
        started = true;
        result.push(hit);
        continue;
      }
      if (started) break;
      // 記事末尾に空段落以外がある場合、そこより上は一時カード群ではない。
      break;
    }

    return result.reverse();
  }

  function rawTargetUrlBlocks(view, targetSet) {
    const list = [];
    view.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      const text = node.textBetween(0, node.content.size, '\n', '\n').trim();
      if (!text) return;
      const tokens = text.split(/\s+/).filter(Boolean);
      if (tokens.length && tokens.every((token) => targetSet.has(normalizeUrl(token)))) {
        list.push({ node, pos });
      }
    });
    return list;
  }

  function collectSafetySnapshot(view, rows) {
    verifyThinImages(view, rows);
    const targetSet = new Set(rows.map((row) => row.url));
    const allTargetCards = embedNodes(view).filter((hit) => validNoteCard(hit, targetSet));
    const tempCards = trailingTemporaryCards(view, targetSet);
    const tempKeySet = new Set(tempCards.map(cardKey));
    const retainedCards = allTargetCards.filter((hit) => !tempKeySet.has(cardKey(hit)));

    const coverage = new Map(rows.map((row) => [row.url, 0]));
    allTargetCards.forEach((hit) => coverage.set(cardUrl(hit), (coverage.get(cardUrl(hit)) || 0) + 1));
    const missing = rows.filter((row) => !(coverage.get(row.url) > 0));
    if (missing.length) {
      throw new Error(`紹介カード不足 ${EXPECTED - missing.length}/${EXPECTED}（不足: ${missing.slice(0, 5).map((r) => r.index).join(',')}）`);
    }

    const raw = rawTargetUrlBlocks(view, targetSet);
    if (raw.length) throw new Error(`生URLブロックが${raw.length}件残っています`);
    if (!tempCards.length) throw new Error('記事末尾の自動生成カード群を特定できません');

    const tempKeys = tempCards.map(cardKey);
    const retainedKeys = retainedCards.map(cardKey);
    if (new Set(tempKeys).size !== tempKeys.length) throw new Error('削除対象embキー重複');
    if (tempKeys.some((key) => retainedKeys.includes(key))) throw new Error('保持カードとのキー衝突');

    return {
      tempCards,
      retainedCards,
      tempKeys,
      retainedKeys,
      tempUrls: tempCards.map(cardUrl),
      retainedUrls: retainedCards.map(cardUrl),
      totalTargetCards: allTargetCards.length
    };
  }

  async function saveDraft() {
    const button = [...document.querySelectorAll('button')].find((node) => {
      const text = node.textContent?.trim();
      return (text === '下書き保存' || text === '一時保存') && node.getClientRects().length;
    });
    if (button && !button.disabled) button.click();
    await sleep(3500);
  }

  async function safePrePublishCheck() {
    if (busy) return;
    busy = true;
    try {
      setStatus('安全確認中｜受賞者カードと自動生成カードを分離…');
      const rows = await loadManifestRows();
      const view = findView();
      if (!view) throw new Error('EditorViewなし。画面を再読込してください');

      const snap = collectSafetySnapshot(view, rows);
      await saveDraft();
      const snap2 = collectSafetySnapshot(view, rows);

      const first = snap.tempKeys.join('|');
      const second = snap2.tempKeys.join('|');
      if (first !== second) throw new Error('保存前後で削除対象カードが変化しました');

      setSafeState({
        version: '15.2.0',
        articleKey: articleKey(),
        checkedAt: new Date().toISOString(),
        tempKeys: snap2.tempKeys,
        tempUrls: snap2.tempUrls,
        retainedKeys: snap2.retainedKeys,
        retainedUrls: snap2.retainedUrls,
        totalTargetCards: snap2.totalTargetCards
      });

      setStatus(
        `投稿前安全確認 OK ✅ 紹介対象107/107｜公開後の削除予定${snap2.tempKeys.length}枚｜保持カード${snap2.retainedKeys.length}枚`
      );
      page.alert(
        `投稿前安全確認 OK\n\n` +
        `紹介対象: 107/107\n` +
        `公開後に削除する自動生成カード: ${snap2.tempKeys.length}枚\n` +
        `本文内で保持するカード: ${snap2.retainedKeys.length}枚\n\n` +
        `削除対象はURLではなく、今ここで固定したembキーだけです。\n` +
        `同じ記事URLの受賞者カードは削除対象に入りません。\n\n` +
        `この表示が出た場合だけ「公開に進む」で公開してください。`
      );
    } catch (error) {
      localStorage.removeItem(safeKey());
      setStatus(`投稿前安全確認 NG：${error?.message || String(error)}（公開しない）`, true);
    } finally {
      busy = false;
    }
  }

  function deleteExactKeys(view, keys) {
    const wanted = new Set(keys);
    const hits = embedNodes(view).filter((hit) => wanted.has(cardKey(hit)));
    const found = new Set(hits.map(cardKey));
    const missing = keys.filter((key) => !found.has(key));
    if (missing.length) throw new Error(`削除対象カードが不足 ${keys.length - missing.length}/${keys.length}`);
    if (hits.length !== keys.length) throw new Error(`削除対象数不一致 ${hits.length}/${keys.length}`);

    let tr = view.state.tr;
    [...hits].sort((a, b) => b.pos - a.pos).forEach((hit) => {
      tr = tr.delete(hit.pos, hit.pos + hit.node.nodeSize);
    });
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return hits.length;
  }

  async function safeDeleteTemporaryCards() {
    if (busy) return;
    busy = true;
    try {
      const state = getSafeState();
      if (!state || state.version !== '15.2.0' || state.articleKey !== articleKey()) {
        throw new Error('投稿前「確認」の安全固定データがありません。削除しません');
      }
      const tempKeys = Array.isArray(state.tempKeys) ? state.tempKeys : [];
      const retainedKeys = Array.isArray(state.retainedKeys) ? state.retainedKeys : [];
      if (!tempKeys.length) throw new Error('削除対象embキーが0件です');

      const rows = await loadManifestRows();
      const view = findView();
      if (!view) throw new Error('EditorViewなし。画面を再読込してください');
      verifyThinImages(view, rows);

      const currentKeys = new Set(embedNodes(view).map(cardKey).filter(Boolean));
      const missingTemp = tempKeys.filter((key) => !currentKeys.has(key));
      if (missingTemp.length) throw new Error(`削除対象の再確認NG ${tempKeys.length - missingTemp.length}/${tempKeys.length}`);

      const missingRetained = retainedKeys.filter((key) => !currentKeys.has(key));
      if (missingRetained.length) throw new Error(`保持カードが公開前から変化しています ${retainedKeys.length - missingRetained.length}/${retainedKeys.length}`);

      const overlap = tempKeys.filter((key) => retainedKeys.includes(key));
      if (overlap.length) throw new Error('削除対象と保持対象が衝突。削除しません');

      const removed = deleteExactKeys(view, tempKeys);
      verifyThinImages(view, rows);

      const afterKeys = new Set(embedNodes(view).map(cardKey).filter(Boolean));
      const tempRemaining = tempKeys.filter((key) => afterKeys.has(key));
      if (tempRemaining.length) throw new Error(`自動生成カード削除残り ${tempRemaining.length}`);
      const retainedMissingAfter = retainedKeys.filter((key) => !afterKeys.has(key));
      if (retainedMissingAfter.length) throw new Error(`保持カードを巻き込んだ可能性 ${retainedMissingAfter.length}`);

      await saveDraft();

      const finalKeys = new Set(embedNodes(view).map(cardKey).filter(Boolean));
      const finalRetainedMissing = retainedKeys.filter((key) => !finalKeys.has(key));
      if (finalRetainedMissing.length) throw new Error(`保存後に保持カード不足 ${finalRetainedMissing.length}`);
      const finalTempRemaining = tempKeys.filter((key) => finalKeys.has(key));
      if (finalTempRemaining.length) throw new Error(`保存後に削除対象が残っています ${finalTempRemaining.length}`);

      setStatus(`安全削除完了 ✅ 自動生成${removed}枚だけ削除｜保持カード${retainedKeys.length}枚そのまま｜画像107保持`);
      page.alert(
        `安全削除完了\n\n` +
        `削除: 今回自動生成したカード ${removed}枚のみ\n` +
        `保持: 受賞者欄など既存カード ${retainedKeys.length}枚\n` +
        `保持: 加工サムネイル＋⛓‍💥 107件\n\n` +
        `この状態で記事を更新してください。`
      );
    } catch (error) {
      setStatus(`安全削除停止：${error?.message || String(error)}（更新しない）`, true);
    } finally {
      busy = false;
    }
  }

  document.addEventListener('click', (event) => {
    const check = event.target?.closest?.(`#${PANEL} button[data-action="check"]`);
    if (check) {
      event.preventDefault();
      event.stopImmediatePropagation();
      safePrePublishCheck();
      return;
    }
    const del = event.target?.closest?.(`#${PANEL} button[data-action="delete"]`);
    if (del) {
      event.preventDefault();
      event.stopImmediatePropagation();
      safeDeleteTemporaryCards();
    }
  }, true);
})();
