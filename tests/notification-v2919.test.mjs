import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.26 bootstrap loads only manual-safe notification runtimes",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.26/);
  assert.match(boot,/runtime-v2926\.js\?v=2926a/);
  assert.match(boot,/runtime-v2926-ui\.js\?v=2926a/);
  assert.doesNotMatch(boot,/@require.+runtime-v2924/);
  assert.doesNotMatch(boot,/@require.+runtime-v298/);
  assert.match(boot,/自動巡回・自動遷移を停止/);
});

test("manual reader has no automatic DOM observer or heartbeat sync",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2926.js");
  assert.doesNotMatch(r,/MutationObserver/);
  assert.doesNotMatch(r,/setInterval/);
  assert.doesNotMatch(r,/syncVisible/);
  assert.match(r,/mumei-insight-manual-read-v2926/);
  assert.match(r,/manual-incremental-v2926/);
  assert.match(r,/rowsBottomFirst/);
  assert.match(r,/保存到達点/);
  assert.match(r,/✓ ここまで保存済み/);
});

test("manual UI is fixed and never reparented into note notification DOM",async()=>{
  const ui=await read("public/note-insight-notification-runtime-v2926-ui.js");
  assert.match(ui,/position:fixed!important/);
  assert.match(ui,/document\.body\.append\(rail\)/);
  assert.doesNotMatch(ui,/insertBefore\(rail/);
  assert.doesNotMatch(ui,/MutationObserver/);
  assert.match(ui,/手動 続き読込・保存/);
  assert.match(ui,/INSIGHT【通知】/);
});

test("bootstrap strips legacy auto-notice params without opening or redirecting notification panel",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/stripControlParams/);
  assert.doesNotMatch(boot,/findAndOpenBell/);
  assert.doesNotMatch(boot,/clickBell/);
  assert.doesNotMatch(boot,/handleAutoNotice/);
});

test("notification rail goes directly to INSIGHT notification entry",async()=>{
  const ui=await read("public/note-insight-notification-runtime-v2926-ui.js");
  assert.match(ui,/notification-entry\.html/);
  assert.match(ui,/INSIGHT【通知】/);
  const entry=await read("public/notification-entry.html");
  assert.match(entry,/insightMode=notifications#dashboard/);
});

test("INSIGHT disables notification auto-navigation in v2.9.26 safe mode",async()=>{
  const app=await read("src/App.tsx");
  assert.match(app,/NOTIFICATION_TOOL_VERSION = "2\.9\.26"/);
  assert.match(app,/v2\.9\.26 emergency safe mode/);
  assert.doesNotMatch(app,/note\.searchParams\.set\("mumei_auto_notice_v2924"/);
  assert.doesNotMatch(app,/window\.location\.assign\(note\.href\)/);
});

test("INSIGHT data refresh, app update, and notification update remain separated",async()=>{
  const live=await read("src/member-insight-live-v2.tsx");
  const manifest=JSON.parse(await read("public/insight-release.json"));
  assert.match(live,/AUTO DATA SYNC/);
  assert.match(live,/INSIGHT本体 更新/);
  assert.match(live,/本人通知ツール 更新あり/);
  assert.match(live,/notification-update\.html/);
  assert.equal(manifest.notificationVersion,"2.9.26");
  assert.equal(manifest.appVersion,"2026.09.07.3");
});

test("dedicated notification update page advertises manual-safe v2.9.26",async()=>{
  const page=await read("public/notification-update.html");
  assert.match(page,/最新版 v2\.9\.26/);
  assert.match(page,/手動/);
  assert.match(page,/note-insight-notification-sync\.user\.js/);
  assert.match(page,/mumei_insight_version_check=1/);
});

test("server accepts manual sync source and current follow wording",async()=>{
  const s=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const f=await read("supabase/functions/insight-notification-feed-final/index.ts");
  assert.match(s,/manual-sync-v\\d\+/);
  assert.match(s,/my_article_magazine_added/);
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
  assert.match(rel,/direction=b\.direction==="followers"\|\|b\.direction==="followings"/);
  assert.match(rel,/fast-relations/);
  assert.match(api,/liveCounts/);
  assert.match(api,/live_count_at/);
});
