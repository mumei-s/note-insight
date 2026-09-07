import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.31 bootstrap loads current manual core and UI",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.31/);
  assert.match(boot,/runtime-v2931\.js\?v=2931a/);
  assert.match(boot,/runtime-v2931-ui\.js\?v=2931a/);
  assert.match(boot,/自動巡回・自動遷移は行わず/);
});

test("manual reader stays manual and uses the exact notification host from the button",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2931.js");
  assert.doesNotMatch(r,/MutationObserver/);
  assert.doesNotMatch(r,/setInterval/);
  assert.doesNotMatch(r,/syncVisible/);
  assert.match(r,/mumei-insight-manual-read-v2931/);
  assert.match(r,/COOLDOWN=12000/);
  assert.match(r,/MAX_NEW=120/);
  assert.match(r,/BATCH=25/);
  assert.match(r,/manualResume\(rootHint=null\)/);
  assert.match(r,/e\?\.detail\?\.root/);
  assert.match(r,/data-mumei-insight-notification-host/);
});

test("manual reader stores only server-confirmed rows and reuses saved boundary",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2931.js");
  assert.match(r,/confirmedClientSignatures/);
  assert.match(r,/saved\.add\(q\)/);
  assert.match(r,/oldBoundary/);
  assert.match(r,/boundaryFound/);
  assert.match(r,/保存済み境界/);
});

test("manual UI appears only on a real notification list and stays inside that host",async()=>{
  const ui=await read("public/note-insight-notification-runtime-v2931-ui.js");
  assert.match(ui,/function panelHost/);
  assert.match(ui,/scoreRoot/);
  assert.match(ui,/rows\(host\)\.length/);
  assert.match(ui,/host\.prepend\(rail\)/);
  assert.match(ui,/host\.append\(p\)/);
  assert.match(ui,/setAttribute\(HOST_ATTR,'1'\)/);
  assert.match(ui,/new CustomEvent\(EVT_MANUAL,\{detail:\{root:current\}\}\)/);
  assert.doesNotMatch(ui,/document\.body\.append\(rail\)/);
  assert.doesNotMatch(ui,/document\.body\.append\(p\)/);
});

test("notification filter actually hides matching magazine noise and can be managed per creator",async()=>{
  const ui=await read("public/note-insight-notification-runtime-v2931-ui.js");
  assert.match(ui,/mumei-muted-v2931/);
  assert.match(ui,/async function applyFilter/);
  assert.match(ui,/isMagazineNoise/);
  assert.match(ui,/actorIds/);
  assert.match(ui,/フィルターON/);
  assert.match(ui,/className='m2931-member'/);
  assert.match(ui,/textContent='解除'/);
  assert.match(ui,/グループ削除/);
  assert.match(ui,/g\.enabled/);
});

test("notification controls remain manual and direct across supported userscript browsers",async()=>{
  const ui=await read("public/note-insight-notification-runtime-v2931-ui.js");
  assert.match(ui,/touch-action:manipulation/);
  assert.match(ui,/-webkit-appearance:none/);
  assert.match(ui,/pointer-events:auto/);
  assert.match(ui,/type=\"button\"/);
  assert.match(ui,/location\.href=INS/);
  assert.match(ui,/INSIGHT【通知】/);
  assert.doesNotMatch(ui,/navigator\.userAgent/);
});

test("INSIGHT notification deep link and active nav are deterministic",async()=>{
  const entry=await read("public/notification-entry.html");
  const live=await read("src/member-insight-live-v2.tsx");
  const css=await read("src/member-insight-live-v2.css");
  assert.match(entry,/mumei-insight-entry-mode/);
  assert.match(entry,/insightMode=notifications#dashboard/);
  assert.match(live,/getElementById\("minf-notifications"\)/);
  assert.match(css,/mode-notifications \.miu-nav button:nth-child\(8\)/);
});

test("INSIGHT notification view auto-refreshes saved server data",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(ui,/window\.setInterval\(refresh,3000\)/);
  assert.match(ui,/手動保存（続きから）/);
  assert.match(ui,/自動反映 ON/);
  assert.match(ui,/membership_reaction/);
  assert.match(ui,/membership_join/);
  assert.match(ui,/fresh\|\|r\.actor_image_url/);
});

test("notification update flow returns with readable completion state",async()=>{
  const update=await read("public/notification-update.html");
  const setup=await read("public/notification-setup.html");
  assert.match(update,/最新版 v2\.9\.31/);
  assert.match(update,/v2\.9\.31 をインストール／更新/);
  assert.match(update,/mumei-notification-update-pending-v2931/);
  assert.match(update,/window\.open\(SCRIPT,'_blank'\)/);
  assert.match(update,/autoVerify/);
  assert.match(update,/mumei_insight_version_check=1/);
  assert.match(setup,/本人通知ツールをインストール／更新/);
  assert.match(setup,/更新完了 v\$\{VERSION\}/);
  assert.match(setup,/notificationUpdateResult/);
  assert.match(setup,/history\.replaceState/);
});

test("server accepts follow membership joins and membership reactions and confirms exact rows",async()=>{
  const s=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const f=await read("supabase/functions/insight-notification-feed-final/index.ts");
  assert.match(s,/manual-sync-v\\d\+/);
  assert.match(s,/membership_reaction/);
  assert.match(s,/membership_join/);
  assert.match(s,/メンシプ/);
  assert.match(s,/Member\\s\*Ship/);
  assert.match(s,/フォロー\|フォロワー/);
  assert.match(s,/confirmedClientSignatures/);
  assert.match(f,/membership_reaction/);
  assert.match(f,/membership_join/);
  assert.match(f,/type==="follow"&&\/フォロー\|フォロワー/);
});

test("release manifest advertises current app and notification versions",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json"));
  assert.equal(manifest.notificationVersion,"2.9.31");
  assert.equal(manifest.appVersion,"2026.09.07.6");
});

test("follow totals still use live note counts and relation sync supports each direction",async()=>{
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
