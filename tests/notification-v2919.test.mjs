import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.35 bootstrap loads current manual core, UI, dock and independent guard",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.35/);
  assert.match(boot,/runtime-v2933\.js\?v=2933c/);
  assert.match(boot,/runtime-v2933-ui\.js\?v=2933c/);
  assert.match(boot,/runtime-v2934-dock\.js\?v=2934b/);
  assert.match(boot,/runtime-v2935-guard\.js\?v=2935a/);
  assert.match(boot,/自動巡回・自動遷移は行わず/);
});

test("manual reader stays manual, accepts exact host, and tolerates note row DOM changes",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2933.js");
  assert.doesNotMatch(r,/MutationObserver/);
  assert.doesNotMatch(r,/setInterval/);
  assert.doesNotMatch(r,/syncVisible/);
  assert.match(r,/mumei-insight-manual-read-v2933/);
  assert.match(r,/COOLDOWN=12000/);
  assert.match(r,/MAX_NEW=120/);
  assert.match(r,/BATCH=25/);
  assert.match(r,/manualResume\(rootHint=null\)/);
  assert.match(r,/e\?\.detail\?\.root/);
  assert.match(r,/function rowLike/);
  assert.match(r,/knownLike\(el\)/);
  assert.match(r,/NOTIFICATION_ROWS_WAITING/);
});

test("manual reader keeps the saved checkpoint internally while v2.9.35 hides boundary visuals",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2933.js");
  const guard=await read("public/note-insight-notification-runtime-v2935-guard.js");
  assert.match(r,/confirmedClientSignatures/);
  assert.match(r,/saved\.add\(q\)/);
  assert.match(r,/oldBoundary/);
  assert.match(r,/boundaryFound/);
  assert.match(r,/boundary:nextBoundary/);
  assert.match(guard,/data-mumei-insight-boundary-v2933/);
  assert.match(guard,/box-shadow:none!important/);
  assert.match(guard,/display:none!important;content:none!important/);
  assert.match(guard,/stripBoundaryText/);
});

test("manual UI appears from the notification tab shell even before strict rows resolve",async()=>{
  const ui=await read("public/note-insight-notification-runtime-v2933-ui.js");
  assert.match(ui,/function commonShell/);
  assert.match(ui,/exact\('通知'\)/);
  assert.match(ui,/exact\('お知らせ'\)/);
  assert.match(ui,/async function createRail\(host\)/);
  assert.doesNotMatch(ui,/if\(!host\|\|!rows\(host\)\.length\)return null/);
  assert.match(ui,/new CustomEvent\(EVT_MANUAL,\{detail:\{root:current\}\}\)/);
});

test("v2.9.35 guard detaches controls from note reaction modals and restores only on the real notification shell",async()=>{
  const dock=await read("public/note-insight-notification-runtime-v2934-dock.js");
  const guard=await read("public/note-insight-notification-runtime-v2935-guard.js");
  assert.match(dock,/bottom:max\(8px,env\(safe-area-inset-bottom,0px\)\)!important/);
  assert.match(dock,/min-height:48px!important/);
  assert.match(guard,/function notificationShell\(\)/);
  assert.match(guard,/commonShell\(exact\('通知'\),exact\('お知らせ'\)\)/);
  assert.match(guard,/rail\.parentElement!==document\.body/);
  assert.match(guard,/document\.body\.append\(rail\)/);
  assert.match(guard,/settings\.parentElement!==document\.body/);
  assert.match(guard,/document\.body\.append\(settings\)/);
  assert.match(guard,/rail\.hidden=!shell/);
  assert.match(guard,/MutationObserver/);
  assert.match(guard,/stopImmediatePropagation/);
  assert.match(guard,/e\.detail\.root=shell/);
});

test("notification filter hides every matching magazine noise row including truncated creator names",async()=>{
  const ui=await read("public/note-insight-notification-runtime-v2933-ui.js");
  assert.match(ui,/mumei-muted-v2933/);
  assert.match(ui,/async function applyFilter/);
  assert.match(ui,/isMagazineNoise/);
  assert.match(ui,/actorIds/);
  assert.match(ui,/mumei_insight_magazine_mute_profiles_v5/);
  assert.match(ui,/hydrateProfile/);
  assert.match(ui,/sameCreatorName/);
  assert.match(ui,/warmFilterProfiles/);
  assert.doesNotMatch(ui,/1件だけ残す仕様ではありません/);
  assert.match(ui,/textContent='解除'/);
  assert.match(ui,/グループ削除/);
  assert.match(ui,/g\.enabled/);
});

test("notification controls remain manual and direct across supported userscript browsers",async()=>{
  const ui=await read("public/note-insight-notification-runtime-v2933-ui.js");
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

test("INSIGHT always shows app and notification versions as separate tracks",async()=>{
  const live=await read("src/member-insight-live-v2.tsx");
  const css=await read("src/member-insight-live-v2.css");
  const release=await read("src/insight-release.ts");
  assert.match(live,/miv5-version-status/);
  assert.match(live,/INSIGHT本体/);
  assert.match(live,/本人通知/);
  assert.match(live,/現在 v\{CURRENT_INSIGHT_APP_VERSION\}/);
  assert.match(live,/この端末 v\$\{notificationInstalled\}/);
  assert.match(live,/最新 v\$\{appLatest/);
  assert.match(live,/最新 v\$\{notificationLatest/);
  assert.match(css,/\.miv5-version-status/);
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.07\.8"/);
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

test("INSIGHT notification cards keep count headlines but hide duplicate category headings and reduce vertical space",async()=>{
  const css=await read("src/member-insight-notifications-final.css");
  assert.match(css,/article:not\(\.type-magazine_article_added\) \.minf-main>strong\{display:none\}/);
  assert.match(css,/article\.type-follow \.minf-main>span/);
  assert.match(css,/article\.type-magazine_join \.minf-main>span/);
  assert.match(css,/article\.type-membership_join \.minf-main>span/);
  assert.match(css,/padding:5px 7px/);
  assert.match(css,/width:28px;height:28px/);
  assert.match(css,/\.minf-main\{display:grid;gap:1px;margin-top:2px/);
});

test("notification update flow stays in browser history and returns with readable completion state",async()=>{
  const update=await read("public/notification-update.html");
  const setup=await read("public/notification-setup.html");
  assert.match(update,/最新版 v2\.9\.35/);
  assert.match(update,/v2\.9\.35 をインストール／更新/);
  assert.match(update,/mumei-notification-update-pending-v2935/);
  assert.match(update,/location\.assign\(SCRIPT\)/);
  assert.doesNotMatch(update,/window\.open\(SCRIPT/);
  assert.match(update,/ブラウザの「←」/);
  assert.match(update,/autoVerify/);
  assert.match(update,/mumei_insight_version_check=1/);
  assert.match(setup,/本人通知ツールをインストール／更新/);
  assert.match(setup,/更新完了 v\$\{VERSION\}/);
  assert.match(setup,/notificationUpdateResult/);
  assert.match(setup,/history\.replaceState/);
});

test("server and database preserve exact membership joins, reactions, boards, and replies",async()=>{
  const s=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const f=await read("supabase/functions/insight-notification-feed-final/index.ts");
  const m=await read("supabase/migrations/20260907185100_notification_membership_exact_v5.sql");
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
  assert.match(m,/circle_plan_join/);
  assert.match(m,/board_like_\(comment\|post\)/);
  assert.match(m,/membership_reaction/);
  assert.match(m,/trg_zzz_fix_insight_membership/);
});

test("release manifest advertises current app and notification versions independently",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json"));
  assert.equal(manifest.notificationVersion,"2.9.35");
  assert.equal(manifest.appVersion,"2026.09.07.8");
});

test("follow totals, people and delta history refresh without mixed-shape relation upserts",async()=>{
  const social=await read("src/member-insight-social-v2.tsx");
  const live=await read("src/member-insight-live-v2.tsx");
  const rel=await read("supabase/functions/insight-relations/index.ts");
  const api=await read("supabase/functions/insight-social-events/index.ts");
  assert.match(social,/live_expected_count/);
  assert.match(social,/公式現在/);
  assert.match(live,/post\(RELATIONS,"sync",\{direction:"followers"\}/);
  assert.match(live,/post\(RELATIONS,"sync",\{direction:"followings"\}/);
  assert.match(live,/if\(mode==="social"\)void relationSync\(true\)/);
  assert.match(rel,/function relationRows/);
  assert.match(rel,/const stable=people\.filter/);
  assert.match(rel,/touched=people\.filter/);
  assert.match(rel,/if\(stable\.length\)await upsertRows/);
  assert.match(rel,/if\(touched\.length\)await upsertRows/);
  assert.match(rel,/function errText/);
  assert.match(rel,/relation-delta-fix/);
  assert.match(api,/liveCounts/);
  assert.match(api,/live_count_at/);
});
