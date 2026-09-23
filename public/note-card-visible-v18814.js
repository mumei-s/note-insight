(function () {
  'use strict';
  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const pending = new Map();
  const rendered = new WeakMap(), refreshed = new WeakSet();
  page.addEventListener('message', event => {
    if (event.origin !== 'https://note.com' || !event.source) return;
    const parts = String(event.data).split('::'), height = Number(parts[2]);
    if (parts[0] === 'height' && height >= 80 && height <= 4000) rendered.set(event.source, height);
  });
  let generation = 0;
  const keyOf = url => { try { const u = new URL(url); return u.origin === 'https://note.com' && u.pathname.match(/^\/(?:[a-z0-9_]+\/n|embed\/notes)\/(n[a-f0-9]{12})\/?$/i)?.[1] || ''; } catch (_) { return ''; } };
  const article = () => page.location.pathname.match(/\/(n[a-f0-9]{12})(?:\/|$)/i)?.[1] || '';
  function parsed(html, url) {
    const holder = document.createElement('div'); holder.innerHTML = String(html || '');
    const frames = [...holder.querySelectorAll('iframe')];
    if (!keyOf(url) || frames.length !== 1 || keyOf(frames[0].getAttribute('src')) !== keyOf(url) || !frames[0].classList.contains('note-embed')) throw new Error('noteカードの表示内容と対象URLが一致しません');
    return { holder, frame: frames[0] };
  }
  function usableHtml(html, url) {
    const { holder, frame } = parsed(html, url);
    // Keep the official iframe and key. Only repair an invisible height on
    // tool-owned cards; never substitute an image or fabricate an embed key.
    const height = Number.parseFloat(frame.getAttribute('height'));
    const inline = Number.parseFloat(frame.style.height);
    if (!(height >= 80) || (Number.isFinite(inline) && inline < 80)) {
      frame.setAttribute('height', '360'); frame.style.removeProperty('height');
    }
    return holder.innerHTML;
  }
  function factory(req) {
    const api = req(13550)?.MI;
    if (typeof api !== 'function' || !Function.prototype.toString.call(api).includes('/v1/embed')) throw new Error('note公式カード登録処理を取得できません');
    return (url, onError = () => {}) => (state, dispatch, view) => {
      const sourceKey = article(), targetKey = keyOf(url);
      if (!sourceKey || !targetKey) throw new Error('カードの対象記事を確認できません');
      let raw = null;
      state.doc.forEach((node, pos) => { if (node.type.name !== 'paragraph' || node.textContent) raw = { node, pos }; });
      if (!raw || raw.node.type.name !== 'paragraph' || raw.node.textContent !== url) throw new Error('作業用URLを確認できません');
      const id = sourceKey + ':' + url;
      const ownGeneration = generation;
      if (!pending.has(id)) {
        const form = new page.FormData();
        form.append('url', url); form.append('height', '360'); form.append('embeddable_type', 'Note'); form.append('embeddable_key', sourceKey);
        // Use note's authenticated client, exactly as its URL command does.
        // Do not wait for the global, unscoped iframe-height listener.
        const request = Promise.resolve().then(() => api(form)).then(result => {
          const e = result?.embeddedContent;
          if (!e || !/^emb[a-z0-9]+$/i.test(e.key) || String(e.service).toLowerCase() !== 'note' || e.identifier !== targetKey || (e.url && keyOf(e.url) !== targetKey)) throw new Error('note公式カード応答が対象記事と一致しません');
          return { src: url, style: '', htmlForEmbed: usableHtml(e.htmlForEmbed, url), identifier: targetKey, embeddedService: e.service, embeddedContentKey: e.key };
        });
        pending.set(id, request); request.catch(() => { if (pending.get(id) === request) pending.delete(id); });
      }
      pending.get(id).then(attrs => {
        if (generation !== ownGeneration || article() !== sourceKey || !view.dom?.isConnected) return;
        let hit = null;
        view.state.doc.forEach((node, pos) => { if (node === raw.node) hit = { node, pos }; });
        if (!hit) return; // A stopped/older attempt cannot replace another node.
        dispatch(view.state.tr.replaceWith(hit.pos, hit.pos + hit.node.nodeSize, view.state.schema.nodes.embed.create(attrs)));
      }).catch(onError);
      return true;
    };
  }
  function inspect(view, hit, url) {
    try {
      parsed(hit.node.attrs.htmlForEmbed, url);
      const dom = view.nodeDOM(hit.pos), figure = dom?.matches?.('figure') ? dom : dom?.querySelector?.('figure[embedded-content-key]');
      if (!figure || !view.dom.contains(figure) || figure.getAttribute('embedded-content-key') !== hit.node.attrs.embeddedContentKey) return false;
      const frame = figure.querySelector('iframe.note-embed');
      if (!frame || keyOf(frame.getAttribute('src')) !== keyOf(url) || !rendered.has(frame.contentWindow)) return false;
      const bounds = frame.getBoundingClientRect(), style = page.getComputedStyle(frame);
      return bounds.width >= 80 && bounds.height >= 80 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') !== 0;
    } catch (_) { return false; }
  }
  async function wait(view, hit, url) {
    const old = hit.node.attrs.htmlForEmbed, fixed = usableHtml(old, url);
    if (fixed !== old) page.__MUMEI_CARD_SAFETY__.dispatch(view, view.state.tr.setNodeMarkup(hit.pos, hit.node.type, { ...hit.node.attrs, htmlForEmbed: fixed }), [hit.node]);
    const started = Date.now(), until = started + 45000;
    const label = document.getElementById('mumei-note-source-status-v163')?.textContent || 'カード表示確認';
    let shown = -1;
    while (Date.now() < until) {
      const current = page.__MUMEI_CARD_SAFETY__.index(view).embeds.find(h => h.node.attrs.embeddedContentKey === hit.node.attrs.embeddedContentKey);
      // note updates iframe heights asynchronously. Keep only this verified,
      // tool-owned frame from collapsing again; this does not alter saved HTML.
      if (current) {
        const dom = view.nodeDOM?.(current.pos), frame = dom?.querySelector?.('iframe.note-embed');
        if (frame && keyOf(frame.getAttribute('src')) === keyOf(url)) {
          frame.style.minHeight = '80px';
          // A frame restored before the listener was installed gets one reload
          // of its own preview only. No new embed registration or body rewrite.
          if (!rendered.has(frame.contentWindow) && Date.now() - started > 10000 && !refreshed.has(frame)) {
            refreshed.add(frame); frame.setAttribute('src', frame.getAttribute('src'));
          }
        }
      }
      if (current && inspect(view, current, url)) return current;
      if (page.__MUMEI_CARD_SAFETY__.stopped()) throw new Error('表示確認を停止しました。途中のカードは保持しています');
      const seconds = Math.floor((Date.now() - started) / 1000);
      if (seconds !== shown) { shown = seconds; page.__MUMEI_CARD_SAFETY__.status(label + `（表示応答待ち ${seconds}秒）`); }
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    throw new Error('カードの本文表示を確認できません。件数を進めず保持しました');
  }
  page.__MUMEI_CARD_VISIBLE__ = { factory, inspect, wait, cancel() { generation++; pending.clear(); } };
})();
