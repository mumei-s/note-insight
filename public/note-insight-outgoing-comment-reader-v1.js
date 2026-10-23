(function () {
'use strict';
if (location.hostname !== 'note.com' || globalThis.__mumeiOutgoingCommentReaderV1) return;
globalThis.__mumeiOutgoingCommentReaderV1 = true;
const API = globalThis.__mumeiOutgoingCommentCaptureV1;
if (!API) return;
const BASE = 'https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/';
const TOKEN = 'mumei_insight_notification_sync_token_v2:';
const PERMISSION = 'mumei_insight_own_comment_enabled_v1:';
const DEVICE_USED = 'mumei_insight_own_comment_device_used_v1';
const params = new URLSearchParams(location.search);
const consentCode = String(params.get('mumei_own_comment_scope') || '');
const expectedAccount = String(params.get('mumei_account') || '').toLowerCase();
const modern = () => Boolean(globalThis.GM);
const get = async (k, d) => modern() && typeof GM.getValue === 'function' ? GM.getValue(k, d) : typeof GM_getValue === 'function' ? GM_getValue(k, d) : d;
const set = async (k, value) => { if (modern() && typeof GM.setValue === 'function') return GM.setValue(k, value); if (typeof GM_setValue === 'function') return GM_setValue(k, value); throw new Error('連携設定を保存できません'); };
let account = '', token = '', enabled = false, controller, panel, message, startButton, stopButton, retryButton;
let consentUsed = false, serverScopeGranted = false;
let lastError = '', queued = 0, busy = false, pendingDisable = false;
const store = API.indexedStore(globalThis.indexedDB);
function request(endpoint, body) {
  return new Promise((resolve, reject) => {
    const owner = modern() && typeof GM.xmlHttpRequest === 'function' ? GM : null;
    const fn = owner ? owner.xmlHttpRequest : typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null;
    if (!fn || !token) return reject(new Error('本人通知の連携を先に設定してください'));
    let settled = false, handle;
    const finish = (error, result) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(result); };
    const timer = setTimeout(() => { finish(new Error('保存確認が時間切れです。未保存分は端末に保持しています')); try { handle?.abort?.(); } catch {} }, 20000);
    try {
      handle = fn.call(owner, { method: 'POST', url: BASE + endpoint, headers: { 'Content-Type': 'application/json', 'X-Ingest-Token': token }, data: JSON.stringify(body), timeout: 20000,
        onload: r => { let data; try { data = JSON.parse(r.responseText || '{}'); } catch { return finish(new Error('保存先の応答を確認できません')); } if (r.status < 200 || r.status >= 300 || data.ok !== true) return finish(Object.assign(new Error(data.error || '保存を確認できません'), { status: r.status, retryable: ![400, 409, 413, 422].includes(r.status) })); finish(null, data); },
        onerror: () => finish(new Error('通信できません。未保存分は端末に保持しています')), ontimeout: () => finish(new Error('保存確認が時間切れです')) });
      if (handle && typeof handle.catch === 'function') handle.catch(error => finish(error));
    } catch (e) { finish(e); }
  });
}
function render() {
  if (!panel) return;
  message.textContent = lastError || (enabled ? `@${account} 自分のコメントを自動保存中 · 未保存 ${queued}件` : `@${account} 自分のコメント自動保存は停止中`);
  startButton.disabled = busy || enabled || consentUsed || !consentCode;
  stopButton.disabled = busy || (!enabled && !pendingDisable && !serverScopeGranted);
  retryButton.disabled = busy || !enabled;
}
async function updateCount() { try { queued = (await store.pending(account)).length; } catch (e) { lastError = String(e.message || e); } render(); }
async function drain() {
  if (!controller || !enabled) return;
  try { await controller.drain(); lastError = ''; } catch (e) { lastError = String(e.message || e); }
  await updateCount();
}
function mount() {
  if (panel || !document.body || (!consentCode && !enabled && !pendingDisable)) return;
  panel = document.createElement('aside'); panel.setAttribute('aria-label', '自分のコメント保存');
  panel.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483000;max-width:330px;padding:12px;border:1px solid #ddd;border-radius:12px;background:white;color:#222;font:13px/1.6 sans-serif;box-shadow:0 2px 12px #0002';
  const details = document.createElement('details'); details.open = Boolean(consentCode);
  const summary = document.createElement('summary'); summary.textContent = 'INSIGHT 自分のコメント保存'; details.append(summary);
  message = document.createElement('p'); details.append(message);
  const disclosure = document.createElement('p'); disclosure.textContent = 'このブラウザで投稿に成功した自分のコメント本文・アカウント・記事ID・コメントID・返信先ID・投稿日時を、INSIGHTの自分専用履歴に保存します。下書き・失敗した投稿・旧形式のコメント欄・noteアプリからの投稿は対象外です。'; details.append(disclosure);
  startButton = document.createElement('button'); startButton.type = 'button'; startButton.textContent = 'このブラウザで自動保存を有効にする'; details.append(startButton);
  stopButton = document.createElement('button'); stopButton.type = 'button'; stopButton.textContent = '自動保存を停止'; details.append(stopButton);
  retryButton = document.createElement('button'); retryButton.type = 'button'; retryButton.textContent = '未保存分を再送'; details.append(retryButton);
  const help = document.createElement('small'); help.textContent = '期限切れ・別アカウント・再開時はINSIGHTの保存設定からやり直してください。停止しても保存済み履歴は消えません。端末の未保存分は保持し、再開するまで送信しません。'; details.append(help);
  startButton.addEventListener('click', async event => {
    // Explicit trusted device consent, never a click dispatched by the page.
    if (!event.isTrusted || busy || enabled || consentUsed) return;
    if (!/^[a-f0-9]{32}$/.test(consentCode) || account !== expectedAccount) { lastError = 'INSIGHTで保存の設定を開き、このアカウントの同意リンクからやり直してください'; render(); return; }
    busy = true; render();
    try {
      // The note login may have changed since this tab was opened.
      if (await currentAccount() !== account) throw new Error('noteのアカウントが変わりました。本人のアカウントでINSIGHTの保存設定からやり直してください');
      const result = await request('insight-notification-import-token', { action: 'own-comment-scope-exchange', code: consentCode, account });
      if (result.enabled !== true || result.account !== account) throw new Error('保存権限を確認できません');
      consentUsed = true; serverScopeGranted = true;
      await set(DEVICE_USED, true);
      await set(PERMISSION + account, { enabled: true, pendingDisable: false }); enabled = true; lastError = '';
      const url = new URL(location.href); url.searchParams.delete('mumei_own_comment_scope'); url.searchParams.delete('mumei_account'); history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      void drain();
    } catch (e) { lastError = '有効化を確認できません。INSIGHTの保存設定からやり直してください。' + String(e.message || e); } finally { busy = false; render(); }
  });
  stopButton.addEventListener('click', async () => {
    if (busy || (!enabled && !pendingDisable && !serverScopeGranted)) return;
    // Stop capture immediately even if the scope-reduction request is offline.
    enabled = false; pendingDisable = true; busy = true; render();
    let stopServerConfirmed = false;
    try {
      // A local storage failure must not prevent revoking a confirmed server grant.
      try { await set(PERMISSION + account, { enabled: false, pendingDisable: true }); } catch {}
      await request('insight-notification-import-token', { action: 'own-comment-scope-disable', account });
      serverScopeGranted = false; stopServerConfirmed = true;
      await set(PERMISSION + account, { enabled: false, pendingDisable: false }); pendingDisable = false;
      lastError = '自動保存を停止しました。履歴は保持しています';
    }
    catch (e) { lastError = 'この端末の保存は停止しました。サーバー権限の停止を確認できていません: ' + String(e.message || e); }
    finally { busy = false; render(); }
  });
  retryButton.addEventListener('click', () => void drain());
  panel.append(details); document.body.append(panel); render();
}
async function currentAccount() {
  const response = await fetch('/api/v2/current_user', { credentials: 'include', cache: 'no-store' });
  if (!response.ok) throw new Error('noteのログイン状態を確認できません');
  const json = await response.json(), data = json.data ?? json, user = data.user ?? data;
  return String(user.urlname || '').toLowerCase();
}
async function init() {
  // Unopted-in Reader installs do not add any account/status traffic.
  if (!consentCode && await get(DEVICE_USED, false) !== true) return;
  // One account check on page startup, not a recurring poll. Successful response
  // identity must still match this account before any comment can be captured.
  account = await currentAccount();
  if (!/^[a-z0-9_-]+$/.test(account)) return;
  token = String(await get(TOKEN + account, ''));
  if (!token) { if (consentCode) { lastError = '先にこのブラウザで本人通知を連携してください'; mount(); } return; }
  const permission = await get(PERMISSION + account, null);
  const locallyEnabled = permission?.enabled === true;
  pendingDisable = permission?.pendingDisable === true;
  enabled = locallyEnabled && !pendingDisable;
  if (pendingDisable) {
    try { await request('insight-notification-import-token', { action: 'own-comment-scope-disable', account }); pendingDisable = false; await set(PERMISSION + account, { enabled: false, pendingDisable: false }); }
    catch { lastError = 'この端末の保存は停止中です。サーバー権限の停止は再試行が必要です'; }
  }
  // Never turn on from server state alone: every device requires explicit local
  // consent. Only already opted-in pages need the extra scope-status request.
  if (locallyEnabled) {
    try {
      const status = await request('insight-notification-import-token', { action: 'own-comment-scope-status', account });
      enabled = status.enabled === true && status.account === account;
    } catch { lastError = '保存先への接続を確認できません。投稿成功分は端末に保持します'; }
  }
  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const allowed = async () => {
    const current = await get(PERMISSION + account, null);
    if (current?.enabled !== true || current?.pendingDisable === true) { enabled = false; render(); return false; }
    return enabled;
  };
  const captureStore = { ...store, async put(row) { if (!await allowed()) return; await store.put(row); Promise.resolve().then(() => drain()); } };
  controller = API.create({ page, account: () => account, enabled: () => enabled, store: captureStore,
    send: async record => { if (!await allowed()) throw new Error('自動保存は停止中です。未保存分を保持しています'); const result = await request('insight-outgoing-comment-ingest', { records: [record] }); return result.acks?.find(ack => ack.id === record.id); },
    onError: e => { lastError = 'コメントの保存を確認できません: ' + String(e.message || e); render(); } });
  if (!controller.install()) throw new Error('このブラウザで投稿の監視を開始できません');
  // A stop in another tab of this same installed Reader must take effect here
  // immediately, rather than waiting for a failed upload or a page reload.
  const watch = modern() && typeof GM.addValueChangeListener === 'function' ? GM.addValueChangeListener.bind(GM) : typeof GM_addValueChangeListener === 'function' ? GM_addValueChangeListener : null;
  if (watch) watch(PERMISSION + account, (_key, _old, value, remote) => {
    if (!remote) return;
    if (value?.enabled !== true || value?.pendingDisable === true) {
      enabled = false; pendingDisable = value?.pendingDisable === true; render();
    }
  });
  await allowed(); // Reconcile a stop that raced the startup status request.
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });
  await updateCount(); if (enabled) void drain();
  window.addEventListener('online', () => void drain());
  window.addEventListener('pageshow', e => { if (e.persisted) void drain(); });
}
void init().catch(e => { lastError = String(e.message || e); if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true }); });
})();
