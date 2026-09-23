(function () {
  'use strict';
  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_CARD_SAFETY__) return;
  const PREFIX = 'mumei_card_backup_v188:';
  const PANEL = 'mumei-note-source-picker-v163';
  let active = null, view = null, viewKey = '', lastDoc = null, confirmedDoc = null;
  let stopped = false, error = '', captureTimer = null, previousAt = 0, lastTitle = null;
  let serializer = null, confirmedTitle = null;
  const noteIdentity = new Map(), loadedDraft = new Map();
  const owner = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const leaseKey = () => PREFIX + key() + ':lease';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const key = () => location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1] || '';
  const read = name => {
    try {
      const item = JSON.parse(localStorage.getItem(name) || 'null');
      if (item?.datasetRef) {
        const dataset = JSON.parse(localStorage.getItem(item.datasetRef) || 'null');
        if (!dataset) throw new Error('backup dataset missing');
        return { ...item, dataset };
      }
      return item;
    } catch (_) { return null; }
  };
  const runKey = () => 'mumei_likers_thin_run_v160:' + key();
  const titleNode = () => document.querySelector('textarea[placeholder*="タイトル"],input[placeholder*="タイトル"]');
  const meaningful = doc => Boolean(doc?.content?.some(n => n.type !== 'paragraph' || n.content?.length));
  function stats(doc) {
    let characters = 0, images = 0;
    const walk = n => { if (n.text) characters += n.text.length; if (n.type === 'image') images++; (n.content || []).forEach(walk); };
    walk(doc); return { characters, images };
  }
  function status(text, bad = false) {
    for (const id of ['mumei-note-source-status-v163', 'mumei-likers-thin-status-v160']) {
      const el = document.getElementById(id);
      if (el) { el.textContent = text; el.dataset.bad = bad ? '1' : '0'; }
    }
  }
  function current(v = view) {
    if (!key() || !v?.dom?.isConnected || v !== view || key() !== viewKey) throw new Error('編集画面が変わったため停止しました。元の記事へ戻って再開してください');
    return v;
  }
  function attach(v) {
    if (!v?.state?.doc || !v.dom?.isConnected || !key()) return v;
    if (v !== view || viewKey !== key()) {
      if (active) throw new Error('処理中に編集画面が変わりました。本文操作を停止しました');
      view = v; viewKey = key(); lastDoc = null; confirmedDoc = null; lastTitle = null; confirmedTitle = null;
    }
    return v;
  }
  function snapshot(v, reason) {
    current(v);
    const doc = v.state.doc.toJSON();
    return { version: 1, articleKey: key(), at: Date.now(), reason, doc, title: titleNode()?.value ?? null,
      run: read(runKey()), dataset: backupDataset(), ...stats(doc) };
  }
  let datasetRaw = null, datasetValue = null;
  const encodedLists = new WeakMap();
  function backupDataset() {
    const raw = localStorage.getItem('mumei_likers_thin_dataset_v160');
    if (raw !== datasetRaw) { datasetValue = raw ? JSON.parse(raw) : null; datasetRaw = raw; }
    return datasetValue;
  }
  function write(slot, value) {
    const name = PREFIX + value.articleKey + ':' + slot;
    try {
      const { datasetRef: oldRef, ...inline } = value;
      let stored = inline;
      if (value.dataset?.datasetId) {
        const ref = PREFIX + value.articleKey + ':dataset:' + encodeURIComponent(value.dataset.datasetId);
        let data = encodedLists.get(value.dataset);
        if (!data) { data = JSON.stringify(value.dataset); encodedLists.set(value.dataset, data); }
        const old = localStorage.getItem(ref);
        // Keep one immutable target list shared by all three backups. Never
        // replace an older list if a dataset ID is accidentally reused.
        if (old === null) localStorage.setItem(ref, data);
        if (localStorage.getItem(ref) === data) { stored = { ...value, dataset: null, datasetRef: ref }; }
      }
      const json = JSON.stringify(stored);
      localStorage.setItem(name, json);
      if (localStorage.getItem(name) !== json) throw new Error('書き込み確認失敗');
      error = '';
      if (slot === 'before' || slot === 'previous') pruneDatasets(value.articleKey);
    } catch (_) {
      error = '本文の控えを保存できません。空き容量を確認するか「本文の控え」から書き出してください';
      throw new Error(error);
    }
    return value;
  }
  function pruneDatasets(articleKey) {
    // Only remove unreferenced lists owned by this tool/article. Backup JSON
    // exports contain the full list and do not depend on these storage keys.
    try {
      if (typeof localStorage.key !== 'function') return;
      const root = PREFIX + articleKey + ':', refs = new Set();
      for (const slot of ['before', 'latest', 'previous']) {
        const item = JSON.parse(localStorage.getItem(root + slot) || 'null');
        if (item?.datasetRef) refs.add(item.datasetRef);
      }
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const name = localStorage.key(i);
        if (name?.startsWith(root + 'dataset:') && !refs.has(name)) localStorage.removeItem(name);
      }
    } catch (_) { /* A stale list is preferable to deleting a referenced backup. */ }
  }
  function checkpoint(v, reason = '操作前') { return write('before', snapshot(v, reason)); }
  function capture() {
    if (!view || key() !== viewKey || !view.dom?.isConnected || (lastDoc === view.state.doc && lastTitle === (titleNode()?.value ?? null))) return;
    const item = snapshot(view, '編集中');
    // Empty/remounted editors must never overwrite the last nonempty copy.
    if (!meaningful(item.doc)) return;
    const old = read(PREFIX + key() + ':latest');
    if (old && Date.now() - previousAt > 30000) { write('previous', old); previousAt = Date.now(); }
    write('latest', item); lastDoc = view.state.doc; lastTitle = item.title;
  }
  function begin(label, v) {
    attach(v); current(v);
    if (active) throw new Error(active.label + 'の完了を待ってください');
    const lease = read(leaseKey());
    if (lease && lease.owner !== owner && lease.until > Date.now()) throw new Error('別のタブでこの記事を処理中です。その処理を終えてから再開してください');
    const token = { label, key: key(), view: v };
    checkpoint(v, label + 'の前');
    try { localStorage.setItem(leaseKey(), JSON.stringify({ owner, until: Date.now() + 30000 })); }
    catch (_) { throw new Error('本文保護用の記録を保存できません。操作を止めました'); }
    active = token; stopped = false;
    return token;
  }
  function end(token) {
    if (active !== token) return;
    try { capture(); } catch (e) { status(e.message, true); }
    const name = PREFIX + token.key + ':lease';
    if (read(name)?.owner === owner) localStorage.removeItem(name);
    active = null;
  }
  function check(v = view) {
    current(v);
    if (active && (active.key !== key() || active.view !== v)) throw new Error('記事が変わったため停止しました');
    if (active && read(leaseKey())?.owner !== owner) throw new Error('別のタブで操作が始まったため停止しました');
  }
  function stop() { stopped = true; page.dispatchEvent(new page.Event('mumei-card-stop')); status('停止要求を受け付けました。処理中の1件／画像投入が終わるまで本文を保持します'); }

  function dispatch(v, tr, allowed = []) {
    check(v);
    if (tr.before !== v.state.doc) throw new Error('処理中に本文が変わりました。古い位置への書き込みを止めました');
    const remaining = [];
    tr.doc.forEach(node => remaining.push(node));
    v.state.doc.forEach(node => {
      if (allowed.includes(node) || (node.type.name === 'paragraph' && !node.content.size)) return;
      const i = remaining.findIndex(other => node === other || node.eq(other));
      if (i < 0) throw new Error('元の本文または画像を失う変更を止めました');
      remaining.splice(i, 1);
    });
    v.dispatch(tr);
  }

  // A single traversal per immutable ProseMirror document, shared by all modules.
  let indexedDoc = null, cachedIndex = null;
  function index(v) {
    check(v);
    if (indexedDoc === v.state.doc) return cachedIndex;
    const images = [], embeds = [], byId = new Map(), bySrc = new Map();
    v.state.doc.descendants((node, pos) => {
      const hit = { node, pos };
      if (node.type?.name === 'image') {
        images.push(hit);
        if (node.attrs.id) byId.set(String(node.attrs.id), hit);
        const src = String(node.attrs.src || '');
        if (!bySrc.has(src)) bySrc.set(src, []);
        bySrc.get(src).push(hit);
      }
      if (node.type?.name === 'embed') embeds.push(hit);
    });
    indexedDoc = v.state.doc; return (cachedIndex = { images, embeds, byId, bySrc });
  }
  function tracked(v, rec, expectedUrl = '') {
    if (!rec) return null;
    const i = index(v), exact = rec.id ? i.byId.get(String(rec.id)) : null;
    if (exact) return !rec.src || String(exact.node.attrs.src || '') === String(rec.src) ? exact : null;
    if (!rec.src) return null;
    const normalize = value => { try { const u = new URL(String(value), location.href); u.search = ''; u.hash = ''; return u.href; } catch (_) { return String(value || ''); } };
    const wanted = expectedUrl || rec.link || '';
    const matches = (i.bySrc.get(String(rec.src)) || []).filter(hit => !wanted || normalize(hit.node.attrs.link) === normalize(wanted));
    return matches.length === 1 ? matches[0] : null;
  }
  function remove(v, hits) {
    check(v);
    const unique = [...new Map(hits.map(h => [h.pos, h])).values()].sort((a, b) => b.pos - a.pos);
    let tr = v.state.tr;
    for (const hit of unique) {
      if (!v.state.doc.nodeAt(hit.pos)?.eq(hit.node)) throw new Error('本文位置が変わりました。削除せず停止しました');
      tr = tr.delete(hit.pos, hit.pos + hit.node.nodeSize);
    }
    if (unique.length) { v.dispatch(tr); v.focus(); }
    return unique.length;
  }
  function relink(v, hit, url, tr) {
    check(v);
    const fresh = tracked(v, hit.node.attrs);
    if (!fresh || fresh.node.type.name !== 'image') throw new Error('画像位置が変わりました。本文を保持して停止しました');
    return tr.setNodeMarkup(fresh.pos, fresh.node.type, { ...fresh.node.attrs, link: url }, fresh.node.marks);
  }

  function apiUrl(rawUrl) {
    try { const u = new URL(String(rawUrl), location.href); return [location.origin,'https://note.com'].includes(u.origin) ? u : null; } catch (_) { return null; }
  }
  function metadataUrl(rawUrl) {
    const u = apiUrl(rawUrl);
    return u && u.pathname === '/api/v3/notes/' + key() ? u : null;
  }
  function failedPayload(payload) {
    return !payload || payload.error || (payload.errors && Object.keys(payload.errors).length) || payload.success === false || payload.status === 'error' ||
      payload.data?.error || (payload.data?.errors && Object.keys(payload.data.errors).length) || payload.data?.success === false || payload.data?.status === 'error';
  }
  function observeNoteResponse(rawUrl, code, payload) {
    const u = metadataUrl(rawUrl), n = payload?.data;
    if (!u || code < 200 || code >= 300 || failedPayload(payload) || n?.key !== key() || !/^\d+$/.test(String(n.id || ''))) return;
    noteIdentity.set(key(), String(n.id));
    if (u.searchParams.get('draft') === 'true' && typeof n.body === 'string' && typeof n.name === 'string') loadedDraft.set(key(), {body:n.body,title:n.name});
  }
  // Match the actual note draft endpoint by its numeric note ID as well as the editor HTML/title.
  function requestStart(method, rawUrl, body) {
    if (!view || key() !== viewKey || !/^(POST|PUT|PATCH)$/i.test(method || '')) return null;
    try {
      const u = apiUrl(rawUrl); if (!u) return null;
      let data = body;
      if (typeof body === 'string') {
        try { data = JSON.parse(body); } catch (_) { data = Object.fromEntries(new URLSearchParams(body)); }
      } else if (body && typeof body.entries === 'function') data = Object.fromEntries(body.entries());
      const keyed = new RegExp('/(?:text_)?notes/' + key() + '(?:/(?:draft|save))?/?$').test(u.pathname);
      const nativeDraft = u.pathname === '/api/v1/text_notes/draft_save';
      const id = String(u.searchParams.get('id') || data?.id || '');
      if (!keyed && (!nativeDraft || !id || (id !== key() && id !== noteIdentity.get(key())))) return null;
      const html = serializer?.(view);
      const candidates = [data?.body, data?.body_html, data?.html, data?.content, data?.note?.body];
      if (typeof html !== 'string' || !candidates.some(value => value === html)) return null;
      const title = titleNode()?.value ?? null;
      const submittedTitle = data?.name ?? data?.title ?? data?.note?.name;
      if (title !== null && submittedTitle !== undefined && submittedTitle !== title) return null;
      return { doc: view.state.doc, view, key: key(), title };
    } catch (_) { return null; }
  }
  function requestEnd(ticket, code, payload) {
    if (!ticket || ticket.key !== key() || ticket.view !== view || ticket.doc !== view.state.doc || ticket.title !== (titleNode()?.value ?? null) || code < 200 || code >= 300 || failedPayload(payload)) return;
    confirmedDoc = ticket.doc; confirmedTitle = ticket.title;
  }
  function installSaveProbe() {
    if (typeof page.fetch === 'function') {
      const fetch = page.fetch.bind(page);
      page.fetch = async function (...args) {
        const method = args[1]?.method || args[0]?.method || 'GET', url = args[0]?.url || args[0];
        const metadata = /^GET$/i.test(method) && metadataUrl(url);
        const ticket = requestStart(method, url, args[1]?.body);
        const response = await fetch(...args);
        if (ticket || metadata) {
          try { const payload = await response.clone().json(); if (metadata) observeNoteResponse(url, response.status, payload); requestEnd(ticket, response.status, payload); } catch (_) { /* no proof */ }
        }
        return response;
      };
    }
    const proto = page.XMLHttpRequest?.prototype;
    if (proto) {
      const open = proto.open, send = proto.send;
      proto.open = function (method, url, ...rest) { this.__mumeiSave = { method, url }; return open.call(this, method, url, ...rest); };
      proto.send = function (...args) {
        const info = this.__mumeiSave, metadata = /^GET$/i.test(info?.method || '') && metadataUrl(info?.url);
        const t = requestStart(info?.method, info?.url, args[0]);
        if (t || metadata) this.addEventListener('load', () => {
          try { const payload = this.responseType === 'json' ? this.response : JSON.parse(this.responseText); if (metadata) observeNoteResponse(info.url, this.status, payload); requestEnd(t, this.status, payload); } catch (_) { /* no proof */ }
        }, { once: true });
        return send.apply(this, args);
      };
    }
  }
  async function save(v, label) {
    check(v); capture(); status(label);
    const expected = v.state.doc;
    const expectedTitle = titleNode()?.value ?? null;
    if (confirmedDoc === expected && confirmedTitle === expectedTitle) return true;
    const loaded = loadedDraft.get(key());
    if (loaded && loaded.title === expectedTitle && loaded.body === serializer?.(v)) { confirmedDoc = expected; confirmedTitle = expectedTitle; return true; }
    let uiConfirmed = false, savingSeen = false, clicked = false, nativeError = null, nativePending = false;
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const candidates = record.type === 'characterData' ? [record.target] : [...record.addedNodes];
        for (const n of candidates) {
          const el = n.nodeType === 3 ? n.parentElement : n;
          if (!el || el.closest?.('#' + PANEL + ',#mumei-likers-thin-panel-v160,.ProseMirror')) continue;
          const t = String(el.textContent || '').trim();
          if (!clicked || t.length >= 70 || !el.getClientRects?.().length) continue;
          if (/^(?:下書き)?保存中/.test(t)) savingSeen = true;
          if (savingSeen && /^(?:下書きを?|記事を?)?保存(?:しました|されました|済み)(?:[。！!\s]|$)/.test(t)) uiConfirmed = true;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    try {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        check(v);
        if (nativeError) throw new Error('noteの下書き保存に失敗しました：' + (nativeError.message || String(nativeError)));
        if (confirmedDoc === v.state.doc && confirmedTitle === (titleNode()?.value ?? null)) return true;
        if (v.state.doc !== expected || (titleNode()?.value ?? null) !== expectedTitle) {
          if (nativePending) { await sleep(100); continue; }
          throw new Error('保存確認中に本文が変わりました。控えを残して停止しました');
        }
        if ((confirmedDoc === expected && confirmedTitle === expectedTitle) || uiConfirmed) { confirmedDoc = expected; confirmedTitle = expectedTitle; return true; }
        if (!clicked) {
          const button = [...document.querySelectorAll('button')].find(b => /^(一時保存|下書き保存)$/.test(b.textContent?.trim()) && b.getClientRects().length && !b.disabled);
          if (button) { clicked = true; button.click(); }
          else if (typeof page.noteEditor?.registerNoteDraft === 'function') {
            clicked = true; nativePending = true;
            Promise.resolve().then(() => page.noteEditor.registerNoteDraft('manual')).catch(e => { nativeError = e; }).finally(() => { nativePending = false; });
          } else if (typeof page.KeyboardEvent === 'function') {
            // The current editor registers Ctrl+S on window for its own instant draft save.
            clicked = true; nativePending = true;
            const event = new page.KeyboardEvent('keydown', {key:'s',code:'KeyS',ctrlKey:true,bubbles:true,cancelable:true});
            page.dispatchEvent(event);
            if (!event.defaultPrevented) throw new Error('noteの下書き保存操作を開始できません。本文を保持して停止しました');
          }
        }
        await sleep(100);
      }
      throw new Error('noteの保存完了を確認できません。本文の控えは保存済みです。noteの保存表示を確認後、同じ操作で再開してください');
    } finally { observer.disconnect(); }
  }
  function restore(item) {
    check(view);
    if (active) throw new Error('処理を停止してから復元してください');
    if (!item || item.version !== 1 || item.articleKey !== key()) throw new Error('この記事の控えではありません');
    const doc = view.state.schema.nodeFromJSON(item.doc);
    doc.check();
    checkpoint(view, '復元前');
    const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
    view.dispatch(tr); confirmedDoc = null;
    if (item.title != null && titleNode()) {
      const el = titleNode();
      const setter = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? page.HTMLTextAreaElement.prototype : page.HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(el, item.title); else el.value = item.title;
      el.dispatchEvent(new page.Event('input', { bubbles: true }));
    }
    if (item.run) localStorage.setItem(runKey(), JSON.stringify(item.run)); else localStorage.removeItem(runKey());
    if (item.dataset) localStorage.setItem('mumei_likers_thin_dataset_v160', JSON.stringify(item.dataset));
    localStorage.removeItem('mumei_link_guard_v178:' + key());
    capture(); status('本文と画像を復元しました。内容を確認し、noteで下書き保存してください');
  }
  function backups() { return ['latest', 'before', 'previous'].map(slot => ({ slot, item: read(PREFIX + key() + ':' + slot) })).filter(x => x.item); }
  function download(item) {
    const blob = new page.Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
    const url = page.URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'note-' + item.articleKey + '-backup.json'; a.click();
    setTimeout(() => page.URL.revokeObjectURL(url), 30000);
  }
  function showBackups() {
    if (document.getElementById('mumei-card-backups')) return;
    const box = document.createElement('div'); box.id = 'mumei-card-backups';
    Object.assign(box.style, { position: 'fixed', inset: '10% 6px auto', zIndex: '2147483647', background: '#fff', color: '#111827', padding: '14px', border: '2px solid #2563eb', borderRadius: '12px', maxHeight: '75vh', overflow: 'auto', fontSize: '13px' });
    const title = document.createElement('strong'); title.textContent = 'この記事の本文の控え'; box.append(title);
    const close = document.createElement('button'); close.textContent = '閉じる'; close.onclick = () => box.remove(); box.append(close);
    const list = backups();
    if (!list.length) { const p = document.createElement('p'); p.textContent = '保存された控えはまだありません'; box.append(p); }
    for (const { item } of list) {
      const row = document.createElement('p');
      row.textContent = new Date(item.at).toLocaleString() + '｜' + item.reason + '｜' + item.characters + '文字・画像' + item.images + '枚 ';
      const restoreButton = document.createElement('button'); restoreButton.textContent = '復元';
      restoreButton.onclick = () => { if (!page.confirm('この時点の本文・画像に戻します。現在の内容も控えに残します。復元しますか？')) return; try { restore(item); box.remove(); } catch (e) { status(e.message, true); } };
      const exportButton = document.createElement('button'); exportButton.textContent = '書き出す'; exportButton.onclick = () => download(item);
      row.append(restoreButton, exportButton); box.append(row);
    }
    const live = document.createElement('button'); live.textContent = '現在の本文を書き出す'; live.onclick = () => { try { download(snapshot(view, '書き出し')); } catch (e) { status(e.message, true); } }; box.append(live);
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    const label = document.createElement('p'); label.textContent = '書き出した控えを読み込む'; box.append(label, input);
    input.onchange = async () => { try { const item = JSON.parse(await input.files[0].text()); if (page.confirm('読み込んだ控えでこの記事を復元しますか？')) { restore(item); box.remove(); } } catch (e) { status(e.message, true); } };
    document.body.append(box);
  }
  function mount() {
    const panel = document.getElementById(PANEL);
    if (!panel || panel.querySelector('[data-card-safety]')) return;
    const row = document.createElement('div'); row.dataset.cardSafety = '1';
    row.innerHTML = '<button type="button" data-safe="stop">停止</button> <button type="button" data-safe="backup">本文の控え</button><span style="font-size:9px"> v18.8.7</span>';
    row.addEventListener('click', e => { const a = e.target.closest('[data-safe]')?.dataset.safe; if (a === 'stop') stop(); if (a === 'backup') showBackups(); }); panel.append(row);
  }
  page.__MUMEI_CARD_SAFETY__ = { attach, begin, end, check, checkpoint, capture, save, index, tracked, remove, relink, restore, backups, snapshot, dispatch,
    setSerializer: fn => { serializer = fn; },
    busy: () => Boolean(active), stopped: () => stopped, stop, status, requestStart, requestEnd };
  installSaveProbe();
  document.addEventListener('input', () => { clearTimeout(captureTimer); captureTimer = setTimeout(() => { try { capture(); } catch (e) { status(e.message, true); } }, 400); }, true);
  page.addEventListener('pagehide', () => { stopped = true; try { capture(); } catch (_) {} });
  page.addEventListener('beforeunload', e => {
    try { capture(); } catch (_) {}
    if (view && key() === viewKey && (active || read(runKey())) && (confirmedDoc !== view.state.doc || confirmedTitle !== (titleNode()?.value ?? null))) { e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopped = true; try { capture(); } catch (_) {} } });
  setInterval(() => { mount(); try { capture(); } catch (e) { status(e.message, true); } }, 1500);
  setInterval(() => { if (active && active.key === key() && read(leaseKey())?.owner === owner) localStorage.setItem(leaseKey(), JSON.stringify({ owner, until: Date.now() + 30000 })); }, 10000);
})();
