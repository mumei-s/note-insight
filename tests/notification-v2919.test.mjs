import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.24 bootstrap loads the bottom-up reader and current UI",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.24/);
  assert.match(boot,/runtime-v2924\.js\?v=2924a/);
  assert.match(boot,/runtime-v2924-ui\.js\?v=2924a/);
  assert.match(boot,/mumei_open_notice_v2924/);
  assert.match(boot,/mumei_auto_notice_v2924/);
});

test("automatic notification save reads current rows bottom-first without deep scrolling",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2924.js");
  const auto=r.slice(r.indexOf("async function syncVisible"),r.indexOf("async function manualDeep"));
  assert.doesNotMatch(auto,/scrollTop\s*=/);
  assert.match(auto,/rowsBottomFirst/);
  assert.match(auto,/自動読取・保存中…（下→上）/);
});

test("manual notification read is incremental and exposes continuation state",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2924.js");
  assert.match(r,/manual-incremental-v2924/);
  assert.match(r,/deepHasMore/);
  assert.match(r,/続き読込・保存中/);
  assert.match(r,/保存到達点/);
  assert.match(r,/✓ ここまで保存済み/);
});

test("notification rail goes directly to INSIGHT notification entry",async()=>{
  const ui=await read("public/note-insight-notification-runtime-v2924-ui.js");
  assert.match(ui,/notification-entry\.html/);
  assert.match(ui,/INSIGHT【通知】/);
  assert.match(ui,/mumei-insight-manual-read-v2924/);
  const entry=await read("public/notification-entry.html");
  assert.match(entry,/insightMode=notifications#dashboard/);
});

test("INSIGHT deep-link and background notification round trip target v2.9.24",async()=>{
  const app=await read("src/App.tsx");
  assert.match(app,/NOTIFICATION_TOOL_VERSION = "2\.9\.24"/);
  assert.match(app,/mumei-insight-entry-mode/);
  assert.match(app,/requested === "notifications"/);
  assert.match(app,/mumei_auto_notice_v2924/);
  assert.match(app,/mumei-notification-auto-result-v2924/);
});

test("INSIGHT data refresh, app update, and notification update are visibly separated",async()=>{
  const live=await read("src/member-insight-live-v2.tsx");
  const manifest=JSON.parse(await read("public/insight-release.json"));
  assert.match(live,/AUTO DATA SYNC/);
  assert.match(live,/公開データは自動更新中（操作不要）/);
  assert.match(live,/INSIGHT本体 更新/);
  assert.match(live,/本人通知ツール 更新あり/);
  assert.match(live,/notification-update\.html/);
  assert.equal(manifest.notificationVersion,"2.9.24");
  assert.equal(manifest.appVersion,"2026.09.07.3");
});

test("dedicated notification update page verifies the installed userscript on note",async()=>{
  const page=await read("public/notification-update.html");
  assert.match(page,/最新版 v2\.9\.24/);
  assert.match(page,/note-insight-notification-sync\.user\.js/);
  assert.match(page,/mumei_insight_version_check=1/);
  assert.match(page,/Android Edge/);
  assert.match(page,/Android Firefox/);
  assert.match(page,/Android Chrome/);
  assert.match(page,/Yahooアプリ内ブラウザ/);
});

test("server and feed accept explicit v2.9.24 continuous sync and current follow wording",async()=>{
  const s=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const f=await read("supabase/functions/insight-notification-feed-final/index.ts");
  assert.match(s,/continuous-sync-v\\d\+/);
  assert.match(s,/my_article_magazine_added/);
  assert.match(s,/return"tip"/);
  assert.match(f,/type==="follow"&&\/フォロー\|フォロワー/);
  assert.match(f,/lastUpdatedAt/);
});

test("INSIGHT notification view exposes authoritative save time and refreshed creator avatars",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(ui,/INSIGHT【通知】 最終更新/);
  assert.match(ui,/lastUpdatedAt/);
  assert.match(ui,/INSIGHT保存処理 最終実行/);
  assert.match(ui,/fresh\|\|r\.actor_image_url/);
  assert.match(ui,/本人通知の精度について/);
});

test("follow totals use live note counts and relation sync supports each direction",async()=>{
  const social=await read("src/member-insight-social-v2.tsx");
  const rel=await read("supabase/functions/insight-relations/index.ts");
  const api=await read("supabase/functions/insight-social-events/index.ts");
  assert.match(social,/live_expected_count/);
  assert.match(social,/公式現在/);
  assert.match(rel,/direction:b\.direction/);
  assert.match(rel,/fast-relations/);
  assert.match(api,/liveCounts/);
  assert.match(api,/live_count_at/);
});

test("dashboard auto ingest remains separate",async()=>{
  const base=await read("public/note-insight-notification-runtime-v298.js");
  assert.match(base,/startsWith\('\/sitesettings\/stats'\)/);
  assert.match(base,/note-dashboard-auto-v298/);
  assert.match(base,/saveDashboardAuto/);
});
