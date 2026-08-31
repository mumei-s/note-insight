(() => {
  'use strict';

  const K = 'note巡回BOOST_v4';
  const PATCH_VERSION = '4.4.0';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const gload = (name, fb) => { try { return JSON.parse(localStorage.getItem(`${K}:${name}`)) ?? fb; } catch { return fb; } };
  const gsave = (name, v) => { try { localStorage.setItem(`${K}:${name}`, JSON.stringify(v)); } catch {} };
  const acctKey = (id, name) => `${K}:acct:${id}:${name}`;
  const aload = (id, name, fb) => { try { return JSON.parse(localStorage.getItem(acctKey(id, name))) ?? fb; } catch { return fb; } };
  const asave = (id, name, v) => { try { localStorage.setItem(acctKey(id, name), JSON.stringify(v)); } catch {} };
  const profileCache = new Map();
  let current = null;
  let reactionOpen = false;
  let reactionBusy = false;

  async function api(url, init={}) {
    const headers = Object.assign({accept:'application/json'}, init.headers || {});
    const r = await fetch(url, Object.assign({credentials:'include'}, init, {headers}));
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : {}; } catch {}
    if (!r.ok) {
      const e = new Error(`${r.status} ${r.statusText}`);
      e.status = r.status;
      e.body = text.slice(0,300);
      throw e;
    }
    return json ?? {};
  }

  async function getCurrentAccount() {
    try {
      const j = await api('/api/v2/current_user');
      const d = j?.data ?? j ?? {};
      const u = d?.user || d;
      const id = String(u?.urlname || u?.url_name || u?.username || '');
      if (!id) return null;
      let name = String(u?.nickname || u?.name || id);
      let avatar = String(u?.profile_image_path || u?.profileImagePath || u?.profile_image_url || '');
      try {
        const p = await getProfile(id);
        name = p.name || name;
        avatar = p.avatar || avatar;
      } catch {}
      return {id, name, avatar};
    } catch {
      return null;
    }
  }

  async function getProfile(id) {
    if (!id) return {id:'', name:'', avatar:''};
    if (profileCache.has(id)) return profileCache.get(id);
    let out = {id, name:id, avatar:''};
    try {
      const j = await api(`/api/v2/creators/${encodeURIComponent(id)}`);
      const d = j?.data ?? j ?? {};
      out = {
        id,
        name: String(d.nickname || d.name || d.display_name || id),
        avatar: String(d.profile_image_path || d.profileImagePath || d.profile_image_url || d.avatar_url || '')
      };
    } catch {}
    profileCache.set(id, out);
    return out;
  }

  function setStatus(text) {
    const el = $('#nb-status');
    if (el) el.textContent = text;
  }

  function toast(text, kind='') {
    const el = $('#nb-toast');
    if (!el) return;
    el.textContent = text;
    el.className = `nb-toast ${kind}`;
    el.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.style.display = 'none'; }, 3800);
  }

  function knownAccounts() {
    const list = gload('knownAccounts', []);
    return Array.isArray(list) ? list.filter(x => x?.id) : [];
  }

  function beginSwitch(target) {
    const targetId = String(target?.id || '');
    const targetName = String(target?.name || targetId || '別アカウント');
    gsave('pendingSwitch', {id:targetId, name:targetName, startedAt:Date.now()});
    setStatus(targetId ? `🔄 @${targetId} へ切替準備。ログアウトします。` : '🔄 別アカウントへ切替準備。ログアウトします。');
    location.assign('https://note.com/logout');
  }

  function prefillLogin(targetId) {
    if (!targetId || location.pathname !== '/login') return;
    const tryFill = () => {
      const inputs = $$('input').filter(i => i.type !== 'password' && i.type !== 'hidden' && !i.disabled);
      const input = inputs.find(i => /mail|email|login|account|id/i.test(`${i.name} ${i.id} ${i.autocomplete} ${i.placeholder}`)) || inputs[0];
      if (!input || input.value) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(input, targetId); else input.value = targetId;
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
      input.focus();
      return true;
    };
    if (!tryFill()) {
      let n = 0;
      const t = setInterval(() => { if (tryFill() || ++n > 20) clearInterval(t); }, 250);
    }
  }

  async function handlePendingSwitch() {
    const pending = gload('pendingSwitch', null);
    if (!pending) return;
    current = await getCurrentAccount();
    if (!current) {
      prefillLogin(String(pending.id || ''));
      if (location.pathname !== '/login' && location.pathname !== '/logout') {
        location.assign('https://note.com/login');
      }
      return;
    }
    if (!pending.id || current.id === pending.id) {
      gsave('pendingSwitch', null);
      setStatus(`✅ @${current.id} に切替完了。巡回履歴・安全カウンターを自動復元しました。`);
      toast(`✅ ${current.name} に切替完了`, 'ok');
      return;
    }
    setStatus(`⚠ ログイン中は @${current.id}。切替先は @${pending.id} です。`);
    toast(`切替先 @${pending.id} と違うアカウントです`, 'bad');
  }

  function usageFor(accountId, name, ms) {
    const arr = aload(accountId, name, []);
    const now = Date.now();
    return Array.isArray(arr) ? arr.filter(x => x && now - Number(x.t || 0) < ms).length : 0;
  }

  function renderAccounts() {
    const box = $('#nb-accounts');
    if (!box) return;
    const list = knownAccounts();
    const pending = gload('pendingSwitch', null);
    const settings = Object.assign({likeHour:18, magHour:20}, gload('settings', {}));
    const items = list.slice(0,6).map(a => {
      const active = current?.id === a.id;
      const lh = usageFor(a.id, 'likes', 3600e3);
      const mh = usageFor(a.id, 'mags', 3600e3);
      const reactions = aload(a.id, 'reactions', []);
      const rc = Array.isArray(reactions) ? reactions.length : 0;
      return `<div class="nb-account nb-account-v44 ${active?'active':''}">
        <div class="nb-acct-main">
          ${a.avatar?`<img src="${esc(a.avatar)}" alt="">`:''}
          <div><b>${active?'● ':''}${esc(a.name||a.id)}</b><span>@${esc(a.id)}</span><small>❤️${lh}/${settings.likeHour}　📚${mh}/${settings.magHour}　↩${rc}</small></div>
        </div>
        ${active?'<em>使用中</em>':`<button class="nb-switch-one" data-id="${esc(a.id)}">切替</button>`}
      </div>`;
    }).join('');
    box.innerHTML = `<div class="nb-account-title"><b>🔄 アカウント切替</b><span>現在のnoteログインIDと必ず連動</span></div>${items || '<div class="nb-empty small">現在のアカウントを登録中…</div>'}<button id="nb-switch-other" class="nb-switch-other">＋ 別アカウントでログイン</button>${pending?.id?`<div class="nb-pending">切替待ち：@${esc(pending.id)}</div>`:''}`;
    for (const btn of $$('.nb-switch-one', box)) {
      btn.onclick = () => {
        const target = list.find(x => x.id === btn.dataset.id);
        if (target) beginSwitch(target);
      };
    }
    $('#nb-switch-other', box).onclick = () => beginSwitch({id:'', name:'別アカウント'});
  }

  function userFromLikeItem(x) {
    if (!x || typeof x !== 'object') return null;
    const u = x.user || x.creator || x.note_user || x.noteUser || x.liker || x.actor || x.account || x.member || x;
    const id = String(
      u?.urlname || u?.url_name || u?.username || u?.note_id ||
      x?.urlname || x?.url_name || x?.username || x?.creator_urlname || x?.user_urlname || ''
    );
    if (!id) return null;
    return {
      id,
      name: String(u?.nickname || u?.name || u?.display_name || x?.nickname || x?.name || id),
      avatar: String(
        u?.profile_image_path || u?.profileImagePath || u?.profile_image_url || u?.avatar_url ||
        x?.profile_image_path || x?.profileImagePath || x?.avatar_url || ''
      )
    };
  }

  function normalizeLikeUsers(j) {
    const candidates = [];
    const seenObjects = new Set();
    const walk = (x, depth=0, key='') => {
      if (x == null || depth > 5) return;
      if (Array.isArray(x)) {
        if (!key || /like|user|creator|content|item|reaction|data/i.test(key)) candidates.push(...x);
        for (const v of x) if (v && typeof v === 'object') walk(v, depth+1, key);
        return;
      }
      if (typeof x !== 'object' || seenObjects.has(x)) return;
      seenObjects.add(x);
      const direct = userFromLikeItem(x);
      if (direct) candidates.push(x);
      for (const [k,v] of Object.entries(x)) {
        if (v && typeof v === 'object' && /data|like|user|creator|content|item|reaction|result/i.test(k)) walk(v, depth+1, k);
      }
    };
    walk(j, 0, 'data');
    const out = new Map();
    for (const x of candidates) {
      const u = userFromLikeItem(x);
      if (u?.id) out.set(u.id, Object.assign(out.get(u.id)||{}, u));
    }
    return [...out.values()];
  }

  function outboundMap(accountId) {
    const arr = aload(accountId, 'outbound', []);
    const map = new Map();
    if (!Array.isArray(arr)) return map;
    for (const x of arr) {
      if (!x?.urlname) continue;
      const prev = map.get(x.urlname);
      if (!prev || Number(x.t||0) >= Number(prev.t||0)) map.set(x.urlname, x);
    }
    return map;
  }

  async function enrichReactionPeople(accountId) {
    const arr = aload(accountId, 'reactions', []);
    if (!Array.isArray(arr) || !arr.length) return arr || [];
    let changed = false;
    const ids = [...new Set(arr.map(x => x?.from || x?.urlname).filter(Boolean))].slice(0,40);
    const profiles = new Map();
    for (const id of ids) {
      const p = await getProfile(id);
      profiles.set(id, p);
      await sleep(15);
    }
    for (const x of arr) {
      const id = String(x.from || x.urlname || '');
      if (!id) continue;
      const p = profiles.get(id);
      if (p && (!x.name || x.name === id || !x.avatar)) {
        x.from = id;
        x.name = p.name || x.name || id;
        x.avatar = p.avatar || x.avatar || '';
        changed = true;
      }
    }
    if (changed) asave(accountId, 'reactions', arr.slice(-500));
    return arr;
  }

  async function checkReactionsEnhanced() {
    if (reactionBusy) return;
    current = current || await getCurrentAccount();
    if (!current?.id) return toast('ログイン中アカウントを取得できません', 'bad');
    const accountId = current.id;
    const outMap = outboundMap(accountId);
    if (!outMap.size) return toast('このアカウントからのスキ履歴がまだありません');
    reactionBusy = true;
    const stored = aload(accountId, 'reactions', []);
    const found = Array.isArray(stored) ? stored : [];
    const seen = new Set(found.map(x => `${x.from||x.urlname||''}|${x.myKey||''}`).filter(x => !x.startsWith('|')));
    let added = 0;
    try {
      setStatus('↩ 誰からの反応か確認中…');
      const notes = [];
      for (let p=1; p<=3; p++) {
        const j = await api(`/api/v2/creators/${encodeURIComponent(accountId)}/contents?kind=note&page=${p}`);
        const arr = Array.isArray(j?.data?.contents) ? j.data.contents : [];
        notes.push(...arr);
        if (arr.length < 10) break;
      }
      const maxNotes = Math.min(notes.length, 30);
      for (let i=0; i<maxNotes; i++) {
        const n = notes[i] || {};
        const key = String(n.key || n.note_key || n.noteKey || n.slug || '');
        const title = String(n.name || n.title || key);
        if (!key) continue;
        setStatus(`↩ 反応者確認 ${i+1}/${maxNotes}｜${title}`);
        for (let p=1; p<=3; p++) {
          const lj = await api(`/api/v3/notes/${encodeURIComponent(key)}/likes?page=${p}&per_page=100`);
          const users = normalizeLikeUsers(lj);
          for (const raw of users) {
            if (!raw?.id || !outMap.has(raw.id)) continue;
            const rk = `${raw.id}|${key}`;
            if (seen.has(rk)) continue;
            const profile = (!raw.name || raw.name === raw.id || !raw.avatar) ? await getProfile(raw.id) : raw;
            const outbound = outMap.get(raw.id) || {};
            seen.add(rk);
            found.push({
              t: Date.now(),
              checkedAt: Date.now(),
              from: raw.id,
              name: profile.name || raw.name || raw.id,
              avatar: profile.avatar || raw.avatar || '',
              myKey: key,
              myTitle: title,
              outKey: outbound.key || '',
              outTitle: outbound.title || '',
              outT: outbound.t || 0,
              type: 'like_return'
            });
            added++;
          }
          if (users.length < 95) break;
          await sleep(50);
        }
        await sleep(45);
      }
      asave(accountId, 'reactions', found.slice(-500));
      await enrichReactionPeople(accountId);
      setStatus(`↩ 反応確認完了：新規 ${added}件 / 累計 ${found.length}件｜反応者名つき`);
      renderReactionsEnhanced();
      renderAccounts();
      toast(added ? `↩ 新しいスキ返し ${added}件。反応者を表示しました` : '新しいスキ返しはまだありません', added ? 'ok' : '');
    } catch (e) {
      setStatus(`反応確認エラー：${e.message || e}`);
      toast('反応確認に失敗しました', 'bad');
    } finally {
      reactionBusy = false;
    }
  }

  function fmtTime(t) {
    if (!Number(t)) return '';
    try { return new Date(Number(t)).toLocaleString('ja-JP', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}); } catch { return ''; }
  }

  function renderReactionsEnhanced() {
    const box = $('#nb-reactions');
    const count = $('#nb-reaction-count');
    if (!box || !current?.id) return;
    const stored = aload(current.id, 'reactions', []);
    const arr = [...(Array.isArray(stored) ? stored : [])].filter(x => x?.from || x?.urlname).sort((a,b) => Number(b.t||0)-Number(a.t||0));
    const people = new Set(arr.map(x => x.from || x.urlname).filter(Boolean));
    if (count) count.textContent = String(arr.length);
    if (!reactionOpen) {
      box.style.display = 'none';
      return;
    }
    box.style.display = 'block';
    box.innerHTML = `<div class="nb-react-head"><b>↩ 反応者 ${people.size}人 / ${arr.length}件</b><button id="nb-react-refresh">再確認</button></div>${arr.length ? arr.slice(0,50).map(x => {
      const id = String(x.from || x.urlname || '');
      const name = String(x.name || id);
      const myUrl = x.myKey ? `https://note.com/${encodeURIComponent(current.id)}/n/${encodeURIComponent(x.myKey)}` : '';
      const outUrl = x.outKey ? `https://note.com/${encodeURIComponent(id)}/n/${encodeURIComponent(x.outKey)}` : '';
      return `<div class="nb-reactrow nb-reactrow-v44">
        <div class="nb-react-person">${x.avatar?`<img src="${esc(x.avatar)}" alt="">`:''}<div><a href="https://note.com/${encodeURIComponent(id)}" target="_blank"><b>${esc(name)}</b></a><span>@${esc(id)}</span></div></div>
        <div class="nb-react-detail">❤️ <b>${esc(name)}</b> さんからスキ返し</div>
        <small>${myUrl?`あなたの記事：<a href="${myUrl}" target="_blank">${esc(x.myTitle||x.myKey)}</a>`:`あなたの記事：${esc(x.myTitle||x.myKey||'不明')}`}</small>
        ${x.outTitle||x.outKey?`<small>先にスキした相手記事：${outUrl?`<a href="${outUrl}" target="_blank">${esc(x.outTitle||x.outKey)}</a>`:esc(x.outTitle||x.outKey)}</small>`:''}
        <small class="nb-react-time">確認 ${esc(fmtTime(x.checkedAt||x.t))}</small>
      </div>`;
    }).join('') : '<div class="nb-empty small">反応履歴はまだありません。上の「再確認」で取得します。</div>'}`;
    const refresh = $('#nb-react-refresh', box);
    if (refresh) refresh.onclick = checkReactionsEnhanced;
  }

  function injectStyles() {
    if ($('#nb-v44-style')) return;
    const s = document.createElement('style');
    s.id = 'nb-v44-style';
    s.textContent = `
      #nb-accounts{display:block!important;margin:5px 0!important}
      .nb-account-title{display:flex;align-items:center;gap:7px;margin:4px 1px 6px}.nb-account-title b{font-size:12px}.nb-account-title span{font-size:10px;color:#666;margin-left:auto}
      .nb-account-v44{display:flex!important;align-items:center;gap:6px;margin:4px 0;padding:6px 7px!important}.nb-acct-main{display:flex;gap:7px;align-items:center;min-width:0;flex:1}.nb-acct-main img{width:30px;height:30px;border-radius:50%;object-fit:cover}.nb-acct-main>div{display:grid;min-width:0}.nb-account-v44 em{font-style:normal;font-size:10px;font-weight:900;color:#146c43}.nb-account-v44 button,.nb-switch-other{border:1px solid #ccc;border-radius:7px;background:#fff;padding:6px 9px;font-weight:900}.nb-switch-other{width:100%;margin-top:4px}.nb-pending{font-size:11px;background:#fff5cf;border-radius:7px;padding:5px 7px;margin-top:4px}
      #nb-reactions{max-height:250px!important}.nb-react-head{position:sticky;top:0;background:#fff;display:flex;align-items:center;padding:4px 2px 6px;z-index:2}.nb-react-head b{flex:1}.nb-react-head button{padding:5px 8px;border:1px solid #ccc;border-radius:7px;background:#fff;font-weight:800}.nb-reactrow-v44{padding:8px 4px!important}.nb-react-person{display:flex;align-items:center;gap:7px}.nb-react-person img{width:34px;height:34px;border-radius:50%;object-fit:cover;background:#eee}.nb-react-person>div{display:grid}.nb-react-person a{color:#111;text-decoration:none}.nb-react-person span{font-size:10px;color:#666}.nb-react-detail{margin:4px 0;font-size:12px}.nb-reactrow-v44 small{display:block;line-height:1.45}.nb-reactrow-v44 small a{color:#1265a8}.nb-react-time{color:#777}
    `;
    document.head.appendChild(s);
  }

  async function patchUI() {
    const root = $('#note巡回boost-v4');
    if (!root) return false;
    injectStyles();
    current = await getCurrentAccount();
    const title = $('.nb-head b', root);
    if (title) title.textContent = `巡回BOOST v${PATCH_VERSION}`;
    renderAccounts();
    const react = $('#nb-react', root);
    if (react) {
      react.onclick = async () => {
        reactionOpen = !reactionOpen;
        renderReactionsEnhanced();
        if (reactionOpen) {
          await enrichReactionPeople(current?.id || '');
          renderReactionsEnhanced();
          await checkReactionsEnhanced();
        }
      };
    }
    renderReactionsEnhanced();
    return true;
  }

  async function start() {
    await handlePendingSwitch();
    if (location.pathname === '/login') {
      const pending = gload('pendingSwitch', null);
      prefillLogin(String(pending?.id || ''));
    }
    for (let i=0; i<40; i++) {
      if (await patchUI()) break;
      await sleep(250);
    }
    setTimeout(patchUI, 1800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
