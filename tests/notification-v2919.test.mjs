import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.40 bootstrap loads exactly one notification runtime",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.40/);
  assert.match(boot,/runtime-v2940\.js\?v=2940a/);
  assert.equal((boot.match(/\/\/ @require\s+/g)||[]).length,1);
  assert.doesNotMatch(boot,/runtime-v2933/);
  assert.doesNotMatch(boot,/runtime-v2935/);
  assert.doesNotMatch(boot,/runtime-v2938/);
  assert.doesNotMatch(boot,/runtime-v2939/);
});

test("v2.9.40 runtime is one isolated dock with no normal-scroll interception",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2940.js");
  assert.match(r,/document\.createElement\('iframe'\)/);
  assert.match(r,/frame\.srcdoc=frameHtml\(\)/);
  assert.match(r,/parent\.postMessage\(\{m2940:true,cmd/);
  assert.match(r,/setInterval\(maintenance,900\)/);
  assert.doesNotMatch(r,/touchmove/);
  assert.doesNotMatch(r,/wheel/);
  assert.doesNotMatch(r,/document\.addEventListener\('scroll'/);
  assert.doesNotMatch(r,/scrollTop\s*=/);
  assert.doesNotMatch(r,/preventDefault\(\)/);
});

test("v2.9.40 filter is display-only and only the leading creator can hide a row",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2940.js");
  assert.match(r,/const HIDE='mumei-v2940-hide'/);
  assert.match(r,/function firstCreatorId/);
  assert.match(r,/function leadName/);
  assert.match(r,/function magazineNoise/);
  assert.match(r,/const first=firstCreatorId\(el\);if\(first\)return st\.ids\.has\(first\)/);
  assert.match(r,/el\.classList\.toggle\(HIDE/);
  assert.doesNotMatch(r,/actors\.some/);
  assert.doesNotMatch(r,/location\.(?:assign|href).*filter/i);
});

test("v2.9.40 only observes the active notification panel for newly added rows",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2940.js");
  assert.match(r,/panelObs=new MutationObserver/);
  assert.match(r,/panelObs\.observe\(p,\{childList:true,subtree:true\}\)/);
  assert.match(r,/rowsFromMutation/);
  assert.doesNotMatch(r,/observe\(document\.documentElement/);
  assert.doesNotMatch(r,/observe\(document\.body/);
});

test("v2.9.40 manual save never drives the notification scroll position",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2940.js");
  assert.match(r,/async function manualSave\(\)/);
  assert.match(r,/MAX_NEW=120/);
  assert.match(r,/confirmedClientSignatures/);
  assert.match(r,/mumei_insight_notification_saved_v2919/);
  assert.match(r,/mumei_insight_notification_checkpoint_v2922/);
  assert.doesNotMatch(r,/scrollHeight/);
  assert.doesNotMatch(r,/scrollTo\(/);
});

test("v2.9.40 INSIGHT navigation originates only from the isolated iframe command",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2940.js");
  assert.match(r,/notification-entry\.html\?from=note&insightMode=notifications#dashboard/);
  assert.match(r,/cmd==='insight'\)location\.assign\(INSIGHT\)/);
  assert.doesNotMatch(r,/\.click\(\)/);
  assert.doesNotMatch(r,/\.onclick\(fake/);
});

test("v2.9.40 retains grouped filter settings and exact/truncated fallback names",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2940.js");
  assert.match(r,/mumei_insight_notification_groups_v1/);
  assert.match(r,/mumei_insight_magazine_mute_profiles_v5/);
  assert.match(r,/async function settingsCommand/);
  assert.match(r,/group-toggle/);
  assert.match(r,/group-delete/);
  assert.match(r,/member-remove/);
  assert.match(r,/member-add/);
  assert.match(r,/function nameMatch/);
});

test("v2.9.40 update flow is same-tab, persistent, and auto-resumes verification",async()=>{
  const update=await read("public/notification-update.html");
  const setup=await read("public/notification-setup.html");
  assert.match(update,/最新版 v2\.9\.40/);
  assert.match(update,/v2\.9\.40 をインストール／更新/);
  assert.match(update,/tampermonkey\.net\/script_installation\.php#url=/);
  assert.match(update,/mumei-notification-update-pending/);
  assert.match(update,/location\.assign\(INSTALLER\)/);
  assert.doesNotMatch(update,/window\.open\(/);
  assert.match(update,/autoVerify/);
  assert.match(setup,/最新版は v2\.9\.40/);
  assert.match(setup,/更新確認を再開しています/);
  assert.match(setup,/mumei_insight_version_check=1/);
  assert.match(setup,/localStorage\.removeItem\(PENDING\)/);
});

test("INSIGHT and本人通知 versions remain independent",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json"));
  const release=await read("src/insight-release.ts");
  assert.equal(manifest.appVersion,"2026.09.07.8");
  assert.equal(manifest.notificationVersion,"2.9.40");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.07\.8"/);
});

test("INSIGHT notification deep link and active nav remain deterministic",async()=>{
  const entry=await read("public/notification-entry.html");
  const live=await read("src/member-insight-live-v2.tsx");
  const css=await read("src/member-insight-live-v2.css");
  assert.match(entry,/insightMode=notifications#dashboard/);
  assert.match(live,/getElementById\("minf-notifications"\)/);
  assert.match(css,/mode-notifications \.miu-nav button:nth-child\(8\)/);
});

test("INSIGHT notification view preserves membership categories and auto-reflects saved data",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(ui,/window\.setInterval\(refresh,3000\)/);
  assert.match(ui,/membership_reaction/);
  assert.match(ui,/membership_join/);
  assert.match(ui,/fresh\|\|r\.actor_image_url/);
});

test("server/database preserve membership join/reaction classification",async()=>{
  const s=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const f=await read("supabase/functions/insight-notification-feed-final/index.ts");
  const m=await read("supabase/migrations/20260907185100_notification_membership_exact_v5.sql");
  assert.match(s,/membership_reaction/);
  assert.match(s,/membership_join/);
  assert.match(s,/confirmedClientSignatures/);
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
