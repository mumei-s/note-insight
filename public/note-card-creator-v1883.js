(function () {
  'use strict';
  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const norm = v => String(v || '').trim().toLowerCase();
  function identity(row) {
    const u = new URL(row.url), match = u.pathname.match(/^\/([a-z0-9_]+)\/n\/(n[a-f0-9]{12})\/?$/i);
    if (u.origin !== 'https://note.com' || !match || norm(row.urlname) !== norm(match[1]) || row.latestKey !== match[2]) throw new Error('記事URLと投稿者IDが一致しません');
    return { id: norm(match[1]), key: match[2] };
  }
  function caption(row) {
    const { id, key } = identity(row), v = row.creatorVerified;
    if (!v || v.articleKey !== key || norm(v.urlname) !== id || !String(v.name || '').trim() || v.name !== row.creator) throw new Error(`投稿者名が未確認です：${id}`);
    return v.name + 'さん';
  }
  function request(key) {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({ method: 'GET', url: `https://note.com/api/v3/notes/${key}`, responseType: 'text', timeout: 45000,
      onload: r => { try { if (r.status !== 200) throw new Error('投稿者照合 HTTP ' + r.status); const p = JSON.parse(r.responseText); resolve(p.data || p); } catch (e) { reject(e); } },
      onerror: () => reject(new Error('投稿者照合の通信失敗')), ontimeout: () => reject(new Error('投稿者照合の時間切れ')) }));
  }
  async function verifyRows(rows, progress = () => {}) {
    let cursor = 0, done = 0;
    async function worker() {
      for (;;) {
        const i = cursor++; if (i >= rows.length) return;
        if (page.__MUMEI_CARD_SAFETY__?.stopped()) throw new Error('投稿者照合を停止しました');
        const row = rows[i], { id, key } = identity(row);
        try { caption(row); } catch (_) {
          const n = await request(key), u = n.user || n.author || {}, actual = norm(u.urlname || u.url_name), name = String(u.nickname || u.name || '').trim();
          if (n.key !== key || actual !== id || !name) throw new Error(`投稿者の照合不一致：${id} / ${key}`);
          row.creator = name; row.creatorVerified = { articleKey: key, urlname: actual, name, checkedAt: new Date().toISOString() };
        }
        row.caption = caption(row); progress(++done, rows.length);
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, rows.length) }, worker));
  }
  function apply(view, hit, row, tr) {
    const text = caption(row), node = hit.node;
    if (node.type.name !== 'image' || node.type.spec?.content !== 'inline*') throw new Error('noteのキャプション形式が変わりました。本文を保持して停止します');
    const replacement = node.type.create({ ...node.attrs, link: row.url }, view.state.schema.text(text), node.marks);
    return tr.replaceWith(hit.pos, hit.pos + node.nodeSize, replacement);
  }
  page.__MUMEI_CARD_CREATOR__ = { identity, caption, verifyRows, apply };
})();
