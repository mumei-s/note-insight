import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.23 bootstrap loads the current core plus robust fallback reader",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.23/);
  assert.match(boot,/runtime-v2922\.js\?v=2923/);
  assert.match(boot,/runtime-v2922-ui\.js\?v=2923/);
  assert.match(boot,/runtime-v2923-compat\.js\?v=2923a/);
  assert.match(boot,/runtime-v2923-ui-fix\.js\?v=2923a/);
  assert.match(boot,/mumei_open_notice_v2923/);
  assert.match(boot,/mumei_auto_notice_v2923/);
});

test("automatic notification save still never deep-scrolls the visible panel",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2922.js");
  const auto=r.slice(r.indexOf("async function syncVisible"),r.indexOf("async function manualDeep"));
  assert.doesNotMatch(auto,/scrollTop\s*=/);
  assert.match(auto,/自動読取・保存中/);
  assert.match(r,/manual-deep-v2922/);
  assert.match(r,/box\.scrollTop=start/);
});

test("v2.9.23 fallback reader detects current note rows beyond old class selectors",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2923-compat.js");
  assert.match(r,/li,\[role="listitem"\],article/);
  assert.match(r,/querySelectorAll\('div'\)/);
  assert.match(r,/notificationRoot/);
  assert.match(r,/note-notification-continuous-sync-v2923/);
  assert.match(r,/mumei-insight-manual-read-v2923/);
  assert.match(r,/本人連携が必要です/);
  assert.match(r,/通知一覧をまだ検出できません/);
});

test("manual read button is rerouted away from the old red-error-only handler",async()=>{
  const ui=await read("public/note-insight-notification-runtime-v2923-ui-fix.js");
  assert.match(ui,/mumei-insight-manual-read-v2923/);
  assert.match(ui,/read\.onclick/);
  assert.match(ui,/PAIR_REQUIRED/);
  assert.match(ui,/Tampermonkeyの実行許可/);
});

test("save checkpoint still advances one visible boundary only after confirmed save",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2922.js");
  assert.match(r,/mumei_insight_notification_checkpoint_v2922/);
  assert.match(r,/lastCheckAt/);
  assert.match(r,/lastSaveAt/);
  assert.match(r,/data-mumei-insight-boundary/);
  assert.match(r,/✓ ここまで保存済み/);
});

test("INSIGHT deep-link and background notification round trip target v2.9.23",async()=>{
  const app=await read("src/App.tsx");
  assert.match(app,/NOTIFICATION_TOOL_VERSION = "2\.9\.23"/);
  assert.match(app,/function notificationDeepLink/);
  assert.match(app,/requested === "notifications"/);
  assert.match(app,/if \(notificationDeepLink\(\)\) return/);
  assert.match(app,/mumei_auto_notice_v2923/);
  assert.match(app,/mumei-notification-auto-result-v2923/);
});

test("INSIGHT data refresh, app update, and notification update are visibly separated",async()=>{
  const live=await read("src/member-insight-live-v2.tsx");
  const manifest=JSON.parse(await read("public/insight-release.json"));
  assert.match(live,/AUTO DATA SYNC/);
  assert.match(live,/公開データは自動更新中（操作不要）/);
  assert.match(live,/INSIGHT本体 更新/);
  assert.match(live,/本人通知ツール 更新あり/);
  assert.match(live,/notification-update\.html/);
  assert.equal(manifest.notificationVersion,"2.9.23");
  assert.ok(manifest.appVersion);
});

test("dedicated notification update page verifies the installed userscript on note",async()=>{
  const page=await read("public/notification-update.html");
  assert.match(page,/最新版 v2\.9\.23/);
  assert.match(page,/note-insight-notification-sync\.user\.js/);
  assert.match(page,/mumei_insight_version_check=1/);
  assert.match(page,/Android Edge/);
  assert.match(page,/Android Firefox/);
  assert.match(page,/Android Chrome/);
  assert.match(page,/Yahooアプリ内ブラウザ/);
});

test("server and feed retain explicit continuous sync support",async()=>{
  const s=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const f=await read("supabase/functions/insight-notification-feed-final/index.ts");
  assert.match(s,/continuous-sync-v\\d\+/);
  assert.match(s,/my_article_magazine_added/);
  assert.match(s,/return"tip"/);
  assert.match(f,/type==="my_article_magazine_added"\|\|type==="tip"/);
});

test("INSIGHT notification view exposes real save time and accuracy warning",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(ui,/INSIGHT【通知】 最終更新/);
  assert.match(ui,/captured_at/);
  assert.match(ui,/本人通知の精度について/);
  assert.match(ui,/チップ・サポート/);
  assert.match(ui,/自分の記事追加/);
});

test("dashboard auto ingest remains separate",async()=>{
  const base=await read("public/note-insight-notification-runtime-v298.js");
  assert.match(base,/startsWith\('\/sitesettings\/stats'\)/);
  assert.match(base,/note-dashboard-auto-v298/);
  assert.match(base,/saveDashboardAuto/);
});
