import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.42 bootstrap loads exactly one current notification runtime",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.42/);
  assert.match(boot,/runtime-v2942\.js\?v=2942a/);
  assert.equal((boot.match(/\/\/ @require\s+/g)||[]).length,1);
  assert.doesNotMatch(boot,/runtime-v2933|runtime-v2935|runtime-v2938|runtime-v2939|runtime-v2940/);
  assert.match(boot,/@updateURL\s+https:\/\/mumei-s\.github\.io\/note-insight\/note-insight-notification-sync\.user\.js/);
});

test("v2.9.42 bottom dock is isolated and never intercepts normal scrolling",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2942.js");
  assert.match(r,/document\.createElement\('iframe'\)/);
  assert.match(r,/bottom:max\(8px,env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(r,/setInterval\(maintenance,1500\)/);
  assert.match(r,/PANEL_GRACE=2600/);
  assert.doesNotMatch(r,/touchmove/);
  assert.doesNotMatch(r,/wheel/);
  assert.doesNotMatch(r,/addEventListener\(['"]scroll/);
  assert.doesNotMatch(r,/scrollTop\s*=/);
  assert.doesNotMatch(r,/scrollTo\(/);
  assert.doesNotMatch(r,/preventDefault\(\)/);
});

test("v2.9.42 finds the real notification shell by 通知 and お知らせ tabs",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2942.js");
  assert.match(r,/function exactTabCount/);
  assert.match(r,/t==='通知'/);
  assert.match(r,/t==='お知らせ'/);
  assert.match(r,/if\(tabs<2\)return-1/);
  assert.match(r,/Date\.now\(\)-lastPanelSeen<PANEL_GRACE/);
});

test("v2.9.42 filter is display-only and only leading creator can hide a row",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2942.js");
  assert.match(r,/const HIDE='mumei-v2942-hide'/);
  assert.match(r,/function firstCreatorId/);
  assert.match(r,/function leadName/);
  assert.match(r,/function magazineNoise/);
  assert.match(r,/const first=firstCreatorId\(el\);if\(first\)return st\.ids\.has\(first\)/);
  assert.match(r,/classList\.toggle\(HIDE/);
  assert.doesNotMatch(r,/actors\.some/);
});

test("v2.9.42 only observes newly inserted rows inside active notification panel",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2942.js");
  assert.match(r,/panelObs=new MutationObserver/);
  assert.match(r,/panelObs\.observe\(p,\{childList:true,subtree:true\}\)/);
  assert.match(r,/rowsFromMutation/);
  assert.doesNotMatch(r,/observe\(document\.documentElement/);
  assert.doesNotMatch(r,/observe\(document\.body/);
});

test("manual save source is accepted by server and never drives navigation or scroll",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2942.js");
  const ingest=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  assert.match(r,/SRC='note-notification-manual-sync-v2942'/);
  assert.match(ingest,/manual-sync-v\\d\+/);
  assert.match(r,/async function manualSave\(\)/);
  assert.match(r,/confirmedClientSignatures/);
  assert.match(r,/INSIGHT反映/);
  assert.doesNotMatch(r,/scrollHeight|scrollTop\s*=|scrollTo\(/);
});

test("only isolated INSIGHT command intentionally navigates away from note",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2942.js");
  assert.match(r,/cmd==='insight'\)location\.assign\(INSIGHT\)/);
  assert.doesNotMatch(r,/\.click\(\)/);
  assert.doesNotMatch(r,/\.onclick\(fake/);
});

test("v2.9.42 browser-aware install page keeps update screen available",async()=>{
  const update=await read("public/notification-update.html");
  const setup=await read("public/notification-setup.html");
  assert.match(update,/最新版 v2\.9\.42/);
  assert.match(update,/Android Edge/);
  assert.match(update,/Android Firefox/);
  assert.match(update,/iPhone\/iPad Safari/);
  assert.match(update,/Android Chrome \/ Yahoo/);
  assert.match(update,/window\.open\(SCRIPT,'mumei-notification-install'\)/);
  assert.match(update,/mumei-notification-update-pending/);
  assert.doesNotMatch(update,/script_installation\.php/);
  assert.doesNotMatch(update,/location\.assign\(SCRIPT\)/);
  assert.match(update,/autoVerify/);
  assert.match(setup,/最新版は v2\.9\.42/);
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
  assert.equal(manifest.appVersion,"2026.09.08.1");
  assert.equal(manifest.notificationVersion,"2.9.42");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.08\.1"/);
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
