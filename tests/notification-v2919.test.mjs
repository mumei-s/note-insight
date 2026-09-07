import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.22 bootstrap uses the stable notification base plus v2922 core and UI",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.22/);
  assert.match(boot,/runtime-v2922\.js\?v=2922a/);
  assert.match(boot,/runtime-v2922-ui\.js\?v=2922a/);
  assert.doesNotMatch(boot,/@require[^\n]*runtime-v2919\.js/);
  assert.doesNotMatch(boot,/@require[^\n]*runtime-v2920-ui\.js/);
  assert.match(boot,/mumei_open_notice_v2922/);
  assert.match(boot,/mumei_auto_notice_v2922/);
  assert.match(boot,/notificationAutoSynced/);
});

test("automatic notification save never deep-scrolls the visible notification panel",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2922.js");
  const auto=r.slice(r.indexOf("async function syncVisible"),r.indexOf("async function manualDeep"));
  assert.doesNotMatch(auto,/scrollTop\s*=/);
  assert.match(auto,/自動読取・保存中/);
  assert.match(r,/manual-deep-v2922/);
  assert.match(r,/box\.scrollTop=start/);
});

test("save checkpoint advances one visible boundary only after confirmed server save",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2922.js");
  assert.match(r,/mumei_insight_notification_checkpoint_v2922/);
  assert.match(r,/lastCheckAt/);
  assert.match(r,/lastSaveAt/);
  assert.match(r,/confirmed\?now:Number\(previous\.lastSaveAt\|\|0\)/);
  assert.match(r,/data-mumei-insight-boundary/);
  assert.match(r,/✓ ここまで保存済み/);
  assert.doesNotMatch(r,/content:'保完'/);
});

test("notification classification keeps self magazine additions tips and creator posts",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2922.js");
  for(const x of ["my_article_magazine_added","creator_article_posted","return'tip'","さん(?:から|より)"])assert.ok(r.includes(x));
  assert.match(r,/note-notification-continuous-sync-v2922/);
});

test("v2.9.22 UI keeps controls visible and exposes persistent automatic sync health",async()=>{
  const ui=await read("public/note-insight-notification-runtime-v2922-ui.js");
  for(const id of ["mumei-v2917-tool","mumei-v2918-rail","mumei-v2919-rail","mumei-v2920-rail","mumei-v2921-rail"])assert.match(ui,new RegExp(id));
  assert.match(ui,/max-width:calc\(100vw - 16px\)/);
  assert.match(ui,/追加読込・保存/);
  assert.match(ui,/フィルターON/);
  assert.match(ui,/INSIGHT/);
  assert.match(ui,/自動読取 ON/);
  assert.match(ui,/最終確認/);
  assert.match(ui,/最終保存/);
  assert.match(ui,/mumei-insight-manual-read-v2922/);
  assert.match(ui,/\?insightMode=notifications#dashboard/);
});

test("INSIGHT deep-link is not replaced by the background notification round trip",async()=>{
  const app=await read("src/App.tsx");
  assert.match(app,/NOTIFICATION_TOOL_VERSION = "2\.9\.22"/);
  assert.match(app,/function notificationDeepLink/);
  assert.match(app,/requested === "notifications"/);
  assert.match(app,/if \(notificationDeepLink\(\)\) return/);
  assert.match(app,/mumei_auto_notice_v2922/);
  assert.match(app,/mumei-notification-auto-result-v2922/);
});

test("server and feed retain self-add tip and explicit continuous sync support",async()=>{
  const s=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const f=await read("supabase/functions/insight-notification-feed-final/index.ts");
  assert.match(s,/continuous-sync-v\\d\+/);
  assert.match(s,/my_article_magazine_added/);
  assert.match(s,/return"tip"/);
  assert.match(f,/type==="my_article_magazine_added"\|\|type==="tip"/);
  assert.match(f,/追加されました/);
});

test("supported-browser install is accepted only after note-side v2.9.22 verification",async()=>{
  const helper=await read("public/notification-install.html");
  const flow=await read("public/notification-import.html");
  assert.match(helper,/2\.9\.22/);
  assert.match(helper,/https:\/\/mumei-s\.github\.io\/note-insight\/note-insight-notification-sync\.user\.js/);
  assert.doesNotMatch(helper,/script_installation\.php#url=/);
  assert.match(helper,/英語のコードだけが表示された場合は未インストールです/);
  assert.match(helper,/実動を確認/);
  assert.match(helper,/Android Edge/);
  assert.match(helper,/Android Firefox/);
  assert.match(helper,/PC Chrome \/ Edge/);
  assert.match(helper,/Mac Safari/);
  assert.match(helper,/Android Chrome/);
  assert.match(helper,/Yahooアプリ内ブラウザ/);
  assert.match(flow,/installed===VERSION/);
  assert.match(flow,/実動確認済み/);
});

test("INSIGHT notification view exposes real save time, accuracy warning and current categories",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(ui,/INSIGHT【通知】 最終更新/);
  assert.match(ui,/captured_at/);
  assert.match(ui,/本人通知の精度について/);
  assert.match(ui,/チップ・サポート/);
  assert.match(ui,/自分の記事追加/);
  assert.match(ui,/記事投稿/);
  assert.match(ui,/note通知へ/);
});

test("dashboard auto ingest remains separate",async()=>{
  const base=await read("public/note-insight-notification-runtime-v298.js");
  assert.match(base,/startsWith\('\/sitesettings\/stats'\)/);
  assert.match(base,/note-dashboard-auto-v298/);
  assert.match(base,/saveDashboardAuto/);
});
