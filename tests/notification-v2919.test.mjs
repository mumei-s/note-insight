import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.38 bootstrap loads stability, perf, filter, native scroll and controls runtimes",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.38/);
  assert.match(boot,/runtime-v2935-guard\.js\?v=2935c/);
  assert.match(boot,/runtime-v2938-perf\.js\?v=2938a/);
  assert.match(boot,/runtime-v2936-filter\.js\?v=2938c/);
  assert.match(boot,/runtime-v2936-scroll\.js\?v=2938c/);
  assert.match(boot,/runtime-v2938-controls\.js\?v=2938a/);
  assert.match(boot,/自動巡回・自動遷移は行わず/);
});

test("manual reader remains manual and keeps its saved checkpoint",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2933.js");
  assert.doesNotMatch(r,/MutationObserver/);
  assert.doesNotMatch(r,/setInterval/);
  assert.match(r,/manualResume\(rootHint=null\)/);
  assert.match(r,/COOLDOWN=12000/);
  assert.match(r,/MAX_NEW=120/);
  assert.match(r,/confirmedClientSignatures/);
  assert.match(r,/oldBoundary/);
  assert.match(r,/boundaryFound/);
  assert.match(r,/finally\{if\(box\)try\{box\.scrollTop=startScroll/);
});

test("independent guard tolerates transient notification-shell misses without dock flicker",async()=>{
  const g=await read("public/note-insight-notification-runtime-v2935-guard.js");
  assert.match(g,/MISS_GRACE=900/);
  assert.match(g,/lastShell=null,lastSeen=0/);
  assert.match(g,/now-lastSeen<MISS_GRACE/);
  assert.match(g,/function setHidden/);
  assert.match(g,/hideTimer=setTimeout/);
  assert.doesNotMatch(g,/rail\.hidden=!shell/);
  assert.match(g,/version:'2\.9\.38'/);
});

test("lead-only filter is authoritative and does not rescan on every scroll",async()=>{
  const f=await read("public/note-insight-notification-runtime-v2936-filter.js");
  assert.match(f,/__MUMEI_FILTER_ENGINE_V2938__/);
  assert.match(f,/function leadTextName/);
  assert.match(f,/function leadId/);
  assert.match(f,/function nameMatches/);
  assert.match(f,/const OWN='mumei-muted-v2938'/);
  assert.match(f,/function setOwnMuted/);
  assert.match(f,/function watchRoot/);
  assert.match(f,/rootObserver\.observe\(root/);
  assert.doesNotMatch(f,/document\.addEventListener\('scroll'/);
  assert.doesNotMatch(f,/actors\.some/);
});

test("legacy per-scroll filter hook is pre-disabled for performance",async()=>{
  const p=await read("public/note-insight-notification-runtime-v2938-perf.js");
  assert.match(p,/data-mumei-insight-filter-scroll-v2933/);
  assert.match(p,/dataset\.mumeiInsightFilterScrollV2933='1'/);
  assert.match(p,/schedule\(10\)/);
});

test("filtered notification scrolling uses native motion and blocks only boundary overscroll",async()=>{
  const s=await read("public/note-insight-notification-runtime-v2936-scroll.js");
  assert.match(s,/overscroll-behavior-y:contain/);
  assert.match(s,/touch-action:pan-y/);
  assert.match(s,/function canMove/);
  assert.match(s,/if\(canMove\(box,delta\)\)return/);
  assert.match(s,/if\(canMove\(box,e\.deltaY\)\)return/);
  assert.match(s,/e\.preventDefault\(\)/);
  assert.doesNotMatch(s,/box\.scrollTop=next/);
  assert.doesNotMatch(s,/requestOlder/);
  assert.doesNotMatch(s,/document\.addEventListener\('scroll'/);
});

test("dock controls preserve scroll position and INSIGHT uses a deterministic absolute route",async()=>{
  const c=await read("public/note-insight-notification-runtime-v2938-controls.js");
  assert.match(c,/notification-entry\.html\?from=note&insightMode=notifications#dashboard/);
  assert.match(c,/function capture/);
  assert.match(c,/function restore/);
  assert.match(c,/window\.scrollTo\(0,s\.pageY\)/);
  assert.match(c,/s\.box\.scrollTop=/);
  assert.match(c,/stopImmediatePropagation/);
  assert.match(c,/location\.assign\(INS\)/);
  assert.match(c,/classList\.contains\('filter'\)/);
  assert.match(c,/state==='done'\|\|state==='error'/);
});

test("INSIGHT notification deep link and active nav remain deterministic",async()=>{
  const entry=await read("public/notification-entry.html");
  const live=await read("src/member-insight-live-v2.tsx");
  const css=await read("src/member-insight-live-v2.css");
  assert.match(entry,/insightMode=notifications#dashboard/);
  assert.match(live,/getElementById\("minf-notifications"\)/);
  assert.match(css,/mode-notifications \.miu-nav button:nth-child\(8\)/);
});

test("INSIGHT and本人通知 versions stay separate",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json"));
  const release=await read("src/insight-release.ts");
  assert.equal(manifest.appVersion,"2026.09.07.8");
  assert.equal(manifest.notificationVersion,"2.9.38");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.07\.8"/);
});

test("notification update/settings advertise v2.9.38 and retain same-tab verification",async()=>{
  const update=await read("public/notification-update.html");
  const setup=await read("public/notification-setup.html");
  assert.match(update,/最新版 v2\.9\.38/);
  assert.match(update,/v2\.9\.38 をインストール／更新/);
  assert.match(update,/mumei-notification-update-pending-v2938/);
  assert.match(update,/location\.assign\(SCRIPT\)/);
  assert.doesNotMatch(update,/window\.open\(SCRIPT/);
  assert.match(update,/autoVerify/);
  assert.match(setup,/最新版は v2\.9\.38/);
  assert.match(setup,/更新完了 v\$\{VERSION\}/);
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

test("follow totals and delta history retain mixed-shape upsert fix",async()=>{
  const social=await read("src/member-insight-social-v2.tsx");
  const live=await read("src/member-insight-live-v2.tsx");
  const rel=await read("supabase/functions/insight-relations/index.ts");
  const api=await read("supabase/functions/insight-social-events/index.ts");
  assert.match(social,/live_expected_count/);
  assert.match(live,/post\(RELATIONS,"sync",\{direction:"followers"\}/);
  assert.match(live,/post\(RELATIONS,"sync",\{direction:"followings"\}/);
  assert.match(rel,/const stable=people\.filter/);
  assert.match(rel,/touched=people\.filter/);
  assert.match(rel,/relation-delta-fix/);
  assert.match(api,/liveCounts/);
});
