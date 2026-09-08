import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.44 bootstrap loads exactly one current notification runtime",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.44/);
  assert.match(boot,/runtime-v2944\.js\?v=2944b/);
  assert.equal((boot.match(/\/\/ @require\s+/g)||[]).length,1);
  assert.doesNotMatch(boot,/runtime-v2933|runtime-v2935|runtime-v2938|runtime-v2939|runtime-v2940|runtime-v2942|runtime-v2943/);
  assert.match(boot,/@updateURL\s+https:\/\/mumei-s\.github\.io\/note-insight\/note-insight-notification-sync\.user\.js/);
});

test("v2.9.44 iframe is CSP-safe and binds each dock exactly once after required buttons exist",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2944.js");
  assert.match(r,/document\.createElement\('iframe'\)/);
  assert.match(r,/frame\.srcdoc=frameHtml\(\)/);
  assert.match(r,/frame\.addEventListener\('load',bindFrame/);
  assert.match(r,/frame\.dataset\.mumeiBound==='1'/);
  assert.match(r,/const d=frame\.contentDocument,read=d\.getElementById\('read'\),filter=d\.getElementById\('filter'\),settings=d\.getElementById\('settings'\),ins=d\.getElementById\('ins'\)/);
  assert.match(r,/if\(!read\|\|!filter\|\|!settings\|\|!ins\)return;frame\.dataset\.mumeiBound='1'/);
  assert.match(r,/contentDocument/);
  assert.doesNotMatch(r,/parent\.postMessage/);
  assert.doesNotMatch(r,/contentWindow\?\.postMessage/);
  assert.doesNotMatch(r,/<script>/);
});

test("v2.9.44 bottom dock never intercepts normal note scrolling",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2944.js");
  assert.match(r,/bottom:max\(8px,env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(r,/PANEL_GRACE=3200/);
  assert.match(r,/setInterval\(maintenance,1800\)/);
  assert.doesNotMatch(r,/touchmove/);
  assert.doesNotMatch(r,/wheel/);
  assert.doesNotMatch(r,/addEventListener\(['"]scroll/);
  assert.doesNotMatch(r,/scrollTop\s*=/);
  assert.doesNotMatch(r,/scrollTo\(/);
});

test("v2.9.44 finds real notification shell from 通知 and お知らせ",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2944.js");
  assert.match(r,/function findTabs/);
  assert.match(r,/smallTextNode\('通知'\)/);
  assert.match(r,/smallTextNode\('お知らせ'\)/);
  assert.match(r,/function shellFromTabs/);
  assert.match(r,/commonAncestor/);
  assert.match(r,/Date\.now\(\)-lastPanelSeen<PANEL_GRACE/);
});

test("v2.9.44 dock buttons are bound directly and only INSIGHT intentionally navigates",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2944.js");
  assert.match(r,/bind\(ui\.read,\(\)=>void manualSave\(\)\)/);
  assert.match(r,/bind\(ui\.filter,\(\)=>void toggleFilter\(\)\)/);
  assert.match(r,/bind\(ui\.settings/);
  assert.match(r,/bind\(ui\.ins,\(\)=>location\.assign\(INSIGHT\)\)/);
  assert.doesNotMatch(r,/\.click\(\)/);
  assert.doesNotMatch(r,/onclick=fake/);
});

test("v2.9.44 filter toggles once, restores hidden rows on OFF, and reports actual counts",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2944.js");
  assert.match(r,/const HIDE='mumei-v2944-hide'/);
  assert.match(r,/filterBusy=true/);
  assert.match(r,/if\(filterBusy\)return/);
  assert.match(r,/function clearHidden\(root\)/);
  assert.match(r,/rowCandidates\(root,true\)/);
  assert.match(r,/if\(!st\.enabled\)\{const restored=clearHidden\(root\)/);
  assert.match(r,/フィルターON ✓ 非表示\$\{result\.hidden\}件/);
  assert.match(r,/フィルターOFF ✓ \$\{result\.restored\}件復元/);
});

test("v2.9.44 filter remains leading-creator-only",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2944.js");
  assert.match(r,/function firstCreatorId/);
  assert.match(r,/function leadName/);
  assert.match(r,/function magazineNoise/);
  assert.match(r,/const first=firstCreatorId\(el\);if\(first\)return st\.ids\.has\(first\)/);
  assert.doesNotMatch(r,/actors\.some/);
});

test("v2.9.44 observes only inserted rows inside active notification panel",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2944.js");
  assert.match(r,/panelObs=new MutationObserver/);
  assert.match(r,/panelObs\.observe\(p,\{childList:true,subtree:true\}\)/);
  assert.match(r,/rowsFromMutation/);
  assert.doesNotMatch(r,/observe\(document\.documentElement/);
  assert.doesNotMatch(r,/observe\(document\.body/);
});

test("v2.9.44 manual save source remains server-accepted and captures profile image before magazine cover",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2944.js");
  const ingest=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  assert.match(r,/SRC='note-notification-manual-sync-v2944'/);
  assert.match(ingest,/manual-sync-v\\d\+/);
  assert.match(r,/function actorImage/);
  assert.match(r,/\/profile_/);
  assert.match(r,/magazine_cover\|ogp\|cover/);
  assert.match(r,/confirmedClientSignatures/);
  assert.match(r,/INSIGHT反映/);
  assert.doesNotMatch(r,/scrollHeight|scrollTop\s*=|scrollTo\(/);
});

test("INSIGHT merges duplicate magazine joins and prefers real creator icons",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(ui,/function mergeMagazineJoinRows/);
  assert.match(ui,/function mergePair/);
  assert.match(ui,/function safeActorImage/);
  assert.match(ui,/magazine_cover\|ogp\|cover/);
  assert.match(ui,/enrich\(mergeMagazineJoinRows\(x\.rows\|\|\[\]\)\)/);
  assert.match(ui,/actor_image_url:fresh\|\|safeActorImage/);
});

test("v2.9.44 installer verifies actual running version",async()=>{
  const update=await read("public/notification-update.html");
  const setup=await read("public/notification-setup.html");
  assert.match(update,/最新版 v2\.9\.44/);
  assert.match(update,/Android Edge/);
  assert.match(update,/Android Firefox/);
  assert.match(update,/iPhone\/iPad Safari/);
  assert.match(update,/window\.open\(SCRIPT,'mumei-notification-install'\)/);
  assert.match(update,/Date\.now\(\)-rawSince>1800/);
  assert.match(update,/child\.close\(\)/);
  assert.match(update,/mumei-notification-update-pending/);
  assert.doesNotMatch(update,/script_installation\.php/);
  assert.doesNotMatch(update,/location\.assign\(SCRIPT\)/);
  assert.match(setup,/最新版は v2\.9\.44/);
  assert.match(setup,/更新完了｜本人通知 v\$\{VERSION\}｜最新版/);
  assert.match(setup,/setTimeout\(\(\)=>location\.replace\(returnTarget\),2200\)/);
  assert.match(setup,/更新されていません/);
});

test("manual notification ingestion keeps unclassified rows as その他 instead of dropping them",async()=>{
  const ingest=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const feed=await read("supabase/functions/insight-notification-feed-final/index.ts");
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.doesNotMatch(ingest,/if\(type==="other"\)\{skipped\+\+;continue\}/);
  assert.match(ingest,/classifier:"action-v18-v2942"/);
  assert.match(feed,/if\(type==="other"\)return explicitManual\(source\)/);
  assert.match(ui,/\["other","その他"\]/);
});

test("INSIGHT and本人通知 versions remain independent",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json"));
  const release=await read("src/insight-release.ts");
  assert.equal(manifest.appVersion,"2026.09.08.2");
  assert.equal(manifest.notificationVersion,"2.9.44");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.08\.2"/);
});

test("INSIGHT app update visibly reports checking and latest result",async()=>{
  const live=await read("src/member-insight-live-v2.tsx");
  const css=await read("src/member-insight-live-v2.css");
  assert.match(live,/APP_UPDATE_RESULT_KEY="mumei-insight-app-update-result"/);
  assert.match(live,/showAppFeedback\("INSIGHT本体の最新版を確認中…",0\)/);
  assert.match(live,/✅ INSIGHT本体 v\$\{CURRENT_INSIGHT_APP_VERSION\}｜最新版です/);
  assert.match(css,/\.miv5-app-feedback/);
});

test("INSIGHT notification deep link and 3-second feed refresh remain deterministic",async()=>{
  const entry=await read("public/notification-entry.html");
  const live=await read("src/member-insight-live-v2.tsx");
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(entry,/insightMode=notifications#dashboard/);
  assert.match(live,/getElementById\("minf-notifications"\)/);
  assert.match(ui,/window\.setInterval\(refresh,3000\)/);
  assert.match(ui,/membership_reaction/);
  assert.match(ui,/membership_join/);
  assert.match(ui,/magazine_article_added/);
});

test("server/database preserve membership join/reaction classification",async()=>{
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
