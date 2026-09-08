import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.46 bootstrap keeps one stable core runtime and adds account-aware INSIGHT handoff",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.46/);
  assert.match(boot,/runtime-v2945\.js\?v=2945a/);
  assert.equal((boot.match(/\/\/ @require\s+/g)||[]).length,1);
  assert.doesNotMatch(boot,/runtime-v2933|runtime-v2935|runtime-v2938|runtime-v2939|runtime-v2940|runtime-v2942|runtime-v2943|runtime-v2944/);
  assert.match(boot,/const INSIGHT_ENTRY='https:\/\/mumei-s\.github\.io\/note-insight\/notification-entry\.html'/);
  assert.match(boot,/const DOCK_FRAME='mumei-v2945-frame'/);
  assert.match(boot,/async function openMatchingInsight\(\)/);
  assert.match(boot,/u\.searchParams\.set\('account',a\.id\)/);
  assert.match(boot,/stopImmediatePropagation\(\)/);
  assert.match(boot,/mumeiAccountRoute/);
  assert.match(boot,/await set\(key\(FILTER,a\.id\),false\)/);
  assert.doesNotMatch(boot,/await set\(key\(FILTER,a\.id\),ids\.length>0\)/);
});

test("v2.9.45 core iframe is CSP-safe and binds only after controls exist",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2945.js");
  assert.match(r,/document\.createElement\('iframe'\)/);
  assert.match(r,/frame\.srcdoc=frameHtml\(\)/);
  assert.match(r,/frame\.addEventListener\('load',bindFrame/);
  assert.match(r,/frame\.dataset\.mumeiBound==='1'/);
  assert.match(r,/if\(!read\|\|!filter\|\|!settings\|\|!ins\)return;frame\.dataset\.mumeiBound='1'/);
  assert.doesNotMatch(r,/parent\.postMessage/);
  assert.doesNotMatch(r,/contentWindow\?\.postMessage/);
  assert.doesNotMatch(r,/<script>/);
});

test("v2.9.45 core never intercepts normal note scrolling",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2945.js");
  assert.match(r,/bottom:max\(8px,env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(r,/PANEL_GRACE=3200/);
  assert.match(r,/setInterval\(maintenance,1800\)/);
  assert.doesNotMatch(r,/touchmove/);
  assert.doesNotMatch(r,/wheel/);
  assert.doesNotMatch(r,/addEventListener\(['"]scroll/);
  assert.doesNotMatch(r,/scrollTop\s*=/);
  assert.doesNotMatch(r,/scrollTo\(/);
});

test("v2.9.45 core finds the real bell shell and not a generic reaction popup",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2945.js");
  assert.match(r,/function findTabs/);
  assert.match(r,/smallTextNode\('通知'\)/);
  assert.match(r,/smallTextNode\('お知らせ'\)/);
  assert.match(r,/function shellFromTabs/);
  assert.match(r,/commonAncestor/);
});

test("v2.9.45 core filter is session-only, reversible and leading-creator-only",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2945.js");
  assert.match(r,/filterOn=false/);
  assert.match(r,/async function resetFilterSession\(root\)/);
  assert.match(r,/filterOn=false;if\(root\)clearHidden\(root\)/);
  assert.match(r,/if\(!panelOpen\)\{panelOpen=true;void resetFilterSession\(p\)/);
  assert.match(r,/else if\(panelOpen\)\{panelOpen=false/);
  assert.match(r,/await set\(key\(FIL,a\.id\),false\)/);
  assert.doesNotMatch(r,/set\(key\(FIL,a\.id\),true\)/);
  assert.match(r,/フィルターON ✓ 非表示\$\{result\.hidden\}件/);
  assert.match(r,/フィルターOFF ✓ \$\{result\.restored\}件復元/);
  assert.match(r,/function firstCreatorId/);
  assert.match(r,/const first=firstCreatorId\(el\);if\(first\)return st\.ids\.has\(first\)/);
  assert.doesNotMatch(r,/actors\.some/);
});

test("v2.9.45 saved boundary is manual-confirmed and independent of note read state",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2945.js");
  assert.match(r,/const BOUNDARY='mumei-v2945-boundary'/);
  assert.match(r,/前回保存ここまで/);
  assert.match(r,/boundarySignature/);
  assert.match(r,/boundaryIndex=boundary\?data\.findIndex\(r=>signature\(r\)===boundary\):-1/);
  assert.match(r,/data\.slice\(0,boundaryIndex\)/);
  assert.match(r,/boundarySource:'manual-confirmed-top'/);
  assert.match(r,/async function applyBoundary\(root\)/);
  assert.doesNotMatch(r,/\bunread\b|aria-unread|is-unread|既読|未読/i);
  const maintenance=r.slice(r.indexOf("function maintenance()"));
  assert.doesNotMatch(maintenance,/boundarySignature\s*:/);
  assert.doesNotMatch(maintenance,/key\(CHECK/);
});

test("v2.9.45 boundary marker is best-effort and size guarded",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2945.js");
  assert.match(r,/r\.width<220\|\|r\.height<24\|\|r\.height>320/);
  assert.match(r,/catch\{clearBoundary\(root\);return false\}/);
  assert.match(r,/box-shadow:inset 0 2px 0 #55d8f1/);
});

test("manual save remains server-confirmed and captures creator profile before magazine cover",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2945.js");
  const ingest=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  assert.match(r,/SRC='note-notification-manual-sync-v2945'/);
  assert.match(ingest,/manual-sync-v\\d\+/);
  assert.match(r,/function actorImage/);
  assert.match(r,/\/profile_/);
  assert.match(r,/magazine_cover\|ogp\|cover/);
  assert.match(r,/confirmedClientSignatures/);
  assert.match(r,/INSIGHT反映/);
});

test("feed always surfaces server-accepted explicit manual notifications",async()=>{
  const feed=await read("supabase/functions/insight-notification-feed-final/index.ts");
  assert.match(feed,/function explicitManual/);
  assert.match(feed,/if\(explicitManual\(source\)\)return true/);
  assert.match(feed,/if\(type==="other"\)return false/);
  const manualPos=feed.indexOf("if(explicitManual(source))return true");
  const actionPos=feed.indexOf("const action=");
  assert.ok(manualPos>=0&&actionPos>manualPos,"manual rows must bypass the secondary wording regex");
});

test("notification entry activates only the matching saved INSIGHT account token",async()=>{
  const entry=await read("public/notification-entry.html");
  assert.match(entry,/mumei-insight-saved-accounts-v3/);
  assert.match(entry,/mumei-insight-active-account-v3/);
  assert.match(entry,/mumei-insight-access-token/);
  assert.match(entry,/rows\.find\(x=>String\(x\?\.noteId/);
  assert.match(entry,/if\(account\?\.memberToken\)/);
  assert.match(entry,/localStorage\.setItem\(TOKEN,String\(account\.memberToken\)\)/);
  assert.match(entry,/u\.searchParams\.set\('insightMode','notifications'\)/);
  assert.match(entry,/u\.searchParams\.set\('notificationAccount',requested\)/);
  assert.doesNotMatch(entry,/memberToken\s*=\s*requested/);
});

test("INSIGHT merges duplicate magazine joins and prefers creator icons",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(ui,/function mergeMagazineJoinRows/);
  assert.match(ui,/function mergePair/);
  assert.match(ui,/function safeActorImage/);
  assert.match(ui,/magazine_cover\|ogp\|cover/);
  assert.match(ui,/enrich\(mergeMagazineJoinRows\(x\.rows\|\|\[\]\)\)/);
});

test("v2.9.46 installer verifies the actual running version",async()=>{
  const update=await read("public/notification-update.html");
  const setup=await read("public/notification-setup.html");
  assert.match(update,/最新版 v2\.9\.46/);
  assert.match(update,/Android Edge/);
  assert.match(update,/Android Firefox/);
  assert.match(update,/iPhone\/iPad Safari/);
  assert.match(update,/window\.open\(SCRIPT,'mumei-notification-install'\)/);
  assert.match(update,/Date\.now\(\)-rawSince>1800/);
  assert.match(update,/child\.close\(\)/);
  assert.doesNotMatch(update,/script_installation\.php/);
  assert.doesNotMatch(update,/location\.assign\(SCRIPT\)/);
  assert.match(setup,/最新版は v2\.9\.46/);
  assert.match(setup,/更新完了｜本人通知 v\$\{VERSION\}｜最新版/);
  assert.match(setup,/更新されていません/);
});

test("manual notification ingestion keeps unclassified rows instead of dropping them",async()=>{
  const ingest=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const feed=await read("supabase/functions/insight-notification-feed-final/index.ts");
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.doesNotMatch(ingest,/if\(type==="other"\)\{skipped\+\+;continue\}/);
  assert.match(feed,/if\(explicitManual\(source\)\)return true/);
  assert.match(ui,/\["other","その他"\]/);
});

test("INSIGHT and本人通知 release tracks remain independent",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json"));
  const release=await read("src/insight-release.ts");
  assert.equal(manifest.appVersion,"2026.09.08.3");
  assert.equal(manifest.notificationVersion,"2.9.46");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.08\.3"/);
});

test("INSIGHT app update visibly reports checking and latest result",async()=>{
  const live=await read("src/member-insight-live-v2.tsx");
  const css=await read("src/member-insight-live-v2.css");
  assert.match(live,/APP_UPDATE_RESULT_KEY="mumei-insight-app-update-result"/);
  assert.match(live,/showAppFeedback\("INSIGHT本体の最新版を確認中…",0\)/);
  assert.match(live,/✅ INSIGHT本体 v\$\{CURRENT_INSIGHT_APP_VERSION\}｜最新版です/);
  assert.match(css,/\.miv5-app-feedback/);
});

test("INSIGHT notification entry and 3-second feed refresh remain deterministic",async()=>{
  const entry=await read("public/notification-entry.html");
  const live=await read("src/member-insight-live-v2.tsx");
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(entry,/insightMode/);
  assert.match(entry,/notificationAccount/);
  assert.match(live,/getElementById\("minf-notifications"\)/);
  assert.match(ui,/window\.setInterval\(refresh,3000\)/);
  assert.match(ui,/membership_reaction/);
  assert.match(ui,/membership_join/);
  assert.match(ui,/magazine_article_added/);
});

test("server/database preserve membership join and reaction classification",async()=>{
  const s=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const f=await read("supabase/functions/insight-notification-feed-final/index.ts");
  const m=await read("supabase/migrations/20260907185100_notification_membership_exact_v5.sql");
  assert.match(s,/membership_reaction/);
  assert.match(s,/membership_join/);
  assert.match(f,/membership_reaction/);
  assert.match(f,/membership_join/);
  assert.match(m,/circle_plan_join/);
  assert.match(m,/trg_zzz_fix_insight_membership/);
});

test("follow totals and delta history retain relation refresh fix",async()=>{
  const social=await read("src/member-insight-social-v2.tsx");
  const live=await read("src/member-insight-live-v2.tsx");
  const rel=await read("supabase/functions/insight-relations/index.ts");
  const api=await read("supabase/functions/insight-social-events/index.ts");
  assert.match(social,/live_expected_count/);
  assert.match(live,/post\(RELATIONS,"sync",\{direction:"followers"\}/);
  assert.match(live,/post\(RELATIONS,"sync",\{direction:"followings"\}/);
  assert.match(rel,/relation-delta-fix/);
  assert.match(api,/liveCounts/);
});
