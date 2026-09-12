(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_PRINCE_FINAL_GATE_1853__) return;
  page.__MUMEI_PRINCE_FINAL_GATE_1853__ = true;

  const VERSION = '18.5.3';
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const STATUS = 'mumei-note-source-status-v163';
  const ORIGINAL_ALERT = page.alert.bind(page);

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function runKey() { return `${RUN_PREFIX}:${articleKey() || 'unknown'}`; }
  function getJSON(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch (_) { return fallback; }
  }
  function setStatus(text, bad = false) {
    for (const id of [STATUS, 'mumei-likers-thin-status-v160']) {
      const el = document.getElementById(id);
      if (el) { el.textContent = text; el.dataset.bad = bad ? '1' : '0'; }
    }
  }
  function stage() {
    const dataset = getJSON(DATA_KEY, null);
    const run = getJSON(runKey(), null);
    const source = String(dataset?.sourceMode || run?.sourceMode || '');
    const insightAdded = Number(dataset?.insightAddedCount || run?.insightAddedCount || 0) > 0 || /insight/i.test(source);
    const princeOnly = /prince|hashtag|王子/i.test(source) && !insightAdded;
    return { dataset, run, princeOnly, insightAdded };
  }

  page.alert = function patchedPrinceAlert(message) {
    const text = String(message ?? '');
    const s = stage();
    const genericReady = text.includes('準備完了') && text.includes('そのまま公開/更新') && text.includes('通知後「削」');
    if (genericReady && s.princeOnly) {
      setStatus('👑 #王子ごっこカード完成 ✅ まだ公開しない → 次に「❤️ INSIGHT500を今の#へ追加」');
      return ORIGINAL_ALERT(
        '👑 #王子ごっこ分は完成しました。\n\nまだ公開しないでください。\n\n次に「❤️ INSIGHT500を今の#へ追加」\n→「画」\n→「送」\nまで進めます。\n\n#王子ごっこ＋INSIGHT500の両方がそろってから公開/更新。\n通知後の「削」で両方のカードをまとめて削除します。\n極薄画像＋埋め込みURLは残ります。'
      );
    }
    return ORIGINAL_ALERT(message);
  };

  function refreshStatus() {
    const s = stage();
    if (!s.princeOnly) return;
    if (s.run?.stage === 'cards_ready') {
      setStatus('👑 #王子ごっこカード完成 ✅ まだ公開しない → ❤️ INSIGHT500を今の#へ追加');
    }
  }

  setInterval(refreshStatus, 800);
  refreshStatus();
})();
