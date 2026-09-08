(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_START_TO_PLUS_175__) return;
  page.__MUMEI_START_TO_PLUS_175__ = true;

  const VERSION = '17.5.0';
  const PANEL = 'mumei-note-source-picker-v163';
  const STATUS = 'mumei-note-source-status-v163';
  const STYLE = 'mumei-start-to-plus-v175-style';
  let watching = false;
  let watchToken = 0;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function panel() { return document.getElementById(PANEL); }
  function statusText() { return String(document.getElementById(STATUS)?.textContent || '').replace(/\s+/g, ' ').trim(); }
  function action(name) { return panel()?.querySelector(`button[data-a="${name}"]`) || null; }

  function installStyle() {
    if (document.getElementById(STYLE) || !document.head) return;
    const style = document.createElement('style');
    style.id = STYLE;
    style.textContent = `
      #${PANEL} button[data-a="image"]{display:none!important}
      #${PANEL} .actions{grid-template-columns:1.25fr 1fr 1fr!important}
      #${PANEL} button[data-a="extract"]{background:#0f766e!important;color:#fff!important;font-size:10px!important}
    `;
    document.head.appendChild(style);
  }

  function relabel() {
    const p = panel();
    if (!p) return;
    const extract = action('extract');
    if (extract) {
      extract.textContent = watching ? '準備中…' : '開始';
      extract.title = '抽出→極薄サムネ準備まで自動。次は＋→画像';
    }
    const title = p.querySelector('.mumei-title-text-v164') || p.querySelector(':scope > .title');
    if (title) {
      const raw = String(title.textContent || '極薄＋通知');
      title.textContent = /v\d+\.\d+/.test(raw) ? raw.replace(/v\d+\.\d+/i, `v${VERSION.replace(/\.0$/, '')}`) : `極薄＋通知 v17.5`;
    }
  }

  function extractedReady(text) {
    return /抽出\s*\d+件\s*✅\s*次は.?画/.test(text) ||
      /抽出済み\s*\d+件\s*✅\s*次は.?画/.test(text) ||
      /次は.?画/.test(text);
  }

  function imageReady(text) {
    return /準備\s*✅.*[＋+].*画像/.test(text) ||
      /「[＋+]」→「画像」/.test(text) ||
      /[＋+]→画像/.test(text);
  }

  function failed(text) {
    return /停止|失敗|エラー|取得できません|見つかりません|先に「削」|作り直してください/.test(text);
  }

  async function followToImageReady(token) {
    const deadline = Date.now() + 15 * 60 * 1000;
    let imageClicked = false;
    while (token === watchToken && Date.now() < deadline) {
      const text = statusText();
      if (!imageClicked && extractedReady(text)) {
        const image = action('image');
        if (image && !image.disabled) {
          imageClicked = true;
          image.click();
        }
      }
      if (imageClicked && imageReady(text)) {
        watching = false;
        relabel();
        try { page.navigator?.vibrate?.([40, 35, 40]); } catch (_) {}
        return;
      }
      if (failed(text) && !/次は.?画/.test(text)) {
        watching = false;
        relabel();
        return;
      }
      await sleep(350);
    }
    if (token === watchToken) {
      watching = false;
      relabel();
    }
  }

  function attach() {
    installStyle();
    const p = panel();
    const extract = action('extract');
    if (!p || !extract) return;
    if (extract.dataset.mumeiStart175 === '1') {
      relabel();
      return;
    }
    extract.dataset.mumeiStart175 = '1';
    extract.addEventListener('click', () => {
      if (watching) return;
      watching = true;
      watchToken += 1;
      const token = watchToken;
      relabel();
      void followToImageReady(token);
    }, false);
    relabel();
  }

  document.addEventListener('click', (event) => {
    const reset = event.target?.closest?.(`#${PANEL} button[data-a="reset"]`);
    if (!reset) return;
    watchToken += 1;
    watching = false;
    setTimeout(relabel, 100);
  }, true);

  setInterval(attach, 400);
  attach();
})();
