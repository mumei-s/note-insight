(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_SUMMER107_153_CONFIRM_DETAIL__) return;
  page.__MUMEI_SUMMER107_153_CONFIRM_DETAIL__ = true;

  const MANIFEST_URL = 'https://mumei-s.github.io/note-insight/note-summer-107/manifest.json';
  const STATUS = 'summer107-status-v1500';
  const SAFE_PREFIX = 'mumei_summer107_safe_delete_v152';
  const OVERLAY = 'summer107-confirm-detail-v153';
  const EXPECTED = 107;

  let manifestMap = null;
  let lastCheckedAt = '';
  let loading = false;

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
      const u = new URL(raw, location.href);
      u.search = '';
      u.hash = '';
      return u.href;
    } catch (_) {
      return raw;
    }
  }
  function getState() {
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
  async function loadManifestMap() {
    if (manifestMap) return manifestMap;
    const text = await request(MANIFEST_URL);
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error('manifest解析失敗'); }
    if (!Array.isArray(data?.items) || data.items.length !== EXPECTED) {
      throw new Error(`manifest件数不一致 ${data?.items?.length || 0}/${EXPECTED}`);
    }
    const map = new Map();
    data.items.forEach((item, i) => {
      const url = normalizeUrl(item?.url);
      if (!url) return;
      map.set(url, {
        index: Number(item?.index) || i + 1,
        creator: String(item?.creator || 'クリエイター名不明'),
        title: String(item?.title || 'タイトル不明'),
        url
      });
    });
    if (map.size !== EXPECTED) throw new Error(`manifest URL一意性不一致 ${map.size}/${EXPECTED}`);
    manifestMap = map;
    return map;
  }
  function esc(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
  function countMap(urls) {
    const map = new Map();
    (urls || []).forEach((url) => {
      const key = normalizeUrl(url);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }
  function closeOverlay() {
    document.getElementById(OVERLAY)?.remove();
  }
  function showOverlay(state, map) {
    closeOverlay();

    const keepCounts = countMap(state.retainedUrls);
    const keepItems = [...keepCounts.entries()].map(([url, count]) => ({
      item: map.get(url) || { index: '?', creator: '不明', title: '不明', url },
      count
    })).sort((a, b) => Number(a.item.index) - Number(b.item.index));

    const overlay = document.createElement('div');
    overlay.id = OVERLAY;
    overlay.innerHTML = `
      <style>
        #${OVERLAY}{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:12px;font-family:system-ui,sans-serif}
        #${OVERLAY} .card{width:min(620px,100%);max-height:88vh;display:flex;flex-direction:column;background:#111827;color:#f9fafb;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.5);overflow:hidden}
        #${OVERLAY} .head{padding:12px 14px;background:#064e3b;border-bottom:1px solid #374151}
        #${OVERLAY} h2{font-size:16px;margin:0 0 5px}
        #${OVERLAY} .summary{font-size:12px;line-height:1.5}
        #${OVERLAY} .scroll{overflow:auto;padding:10px 12px 14px}
        #${OVERLAY} .row{display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #1f2937}
        #${OVERLAY} .num{flex:0 0 36px;font-size:11px;color:#9ca3af;padding-top:2px}
        #${OVERLAY} .body{min-width:0;flex:1}
        #${OVERLAY} .creator{font-size:12px;font-weight:800;color:#bbf7d0}
        #${OVERLAY} .title{font-size:11px;line-height:1.4;color:#d1d5db;margin-top:2px}
        #${OVERLAY} .empty{font-size:12px;color:#9ca3af;padding:8px 0}
        #${OVERLAY} .foot{padding:10px 12px;border-top:1px solid #374151;background:#0f172a;display:flex;gap:8px;align-items:center}
        #${OVERLAY} .note{font-size:11px;line-height:1.4;flex:1;color:#d1d5db}
        #${OVERLAY} button{border:0;border-radius:8px;background:#059669;color:white;font-weight:900;padding:9px 14px;font-size:12px}
      </style>
      <div class="card">
        <div class="head">
          <h2>夏の陣107｜残すカードの確認</h2>
          <div class="summary">本文内に残すカード <b>${Number(state.retainedKeys?.length || 0)}枚</b></div>
        </div>
        <div class="scroll">
          ${keepItems.length ? keepItems.map(({ item, count }) => `
            <div class="row">
              <div class="num">#${esc(item.index)}</div>
              <div class="body">
                <div class="creator">${esc(item.creator)}${count > 1 ? ` <b>×${count}</b>` : ''}</div>
                <div class="title">${esc(item.title)}</div>
              </div>
            </div>`).join('') : '<div class="empty">保持カードなし</div>'}
        </div>
        <div class="foot">
          <div class="note">ここに表示されたカードは削除対象外。削除は確認時に固定した末尾自動生成カードのembキーだけ。</div>
          <button type="button" id="summer107-detail-ok-v153">確認OK</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('summer107-detail-ok-v153')?.addEventListener('click', closeOverlay);

    const status = document.getElementById(STATUS);
    if (status) {
      status.textContent = `投稿前安全確認 OK ✅ 保持カード${state.retainedKeys?.length || 0}枚｜保持一覧を表示`;
      status.dataset.bad = '0';
      status.dataset.open = '1';
    }
  }

  async function inspectState() {
    if (loading) return;
    const state = getState();
    if (!state || state.version !== '15.2.0' || !state.checkedAt || state.articleKey !== articleKey()) return;
    if (state.checkedAt === lastCheckedAt) return;
    loading = true;
    try {
      const map = await loadManifestMap();
      lastCheckedAt = state.checkedAt;
      showOverlay(state, map);
    } catch (error) {
      const status = document.getElementById(STATUS);
      if (status) {
        status.textContent = `保持一覧の表示失敗：${error?.message || String(error)}（公開前に確認してください）`;
        status.dataset.bad = '1';
        status.dataset.open = '1';
      }
    } finally {
      loading = false;
    }
  }

  setInterval(inspectState, 350);
  inspectState();
})();
