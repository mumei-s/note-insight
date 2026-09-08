import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.39 bootstrap loads only the current stable runtime chain",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.39/);
  assert.match(boot,/runtime-v2938-perf\.js\?v=2938a/);
  assert.match(boot,/runtime-v2935-guard\.js\?v=2935c/);
  assert.match(boot,/runtime-v2939-prelude\.js\?v=2939a/);
  assert.match(boot,/runtime-v2933\.js\?v=2933c/);
  assert.match(boot,/runtime-v2933-ui\.js\?v=2933c/);
  assert.match(boot,/runtime-v2939-filter\.js\?v=2939a/);
  assert.match(boot,/runtime-v2939-scroll\.js\?v=2939a/);
  assert.match(boot,/runtime-v2939-dock\.js\?v=2939a/);
  assert.doesNotMatch(boot,/runtime-v2936-filter/);
  assert.doesNotMatch(boot,/runtime-v2936-scroll/);
  assert.doesNotMatch(boot,/runtime-v2938-controls/);
});

test("manual reader remains manual and keeps confirmed saved checkpoints",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2933.js");
  assert.doesNotMatch(r,/MutationObserver/);
  assert.doesNotMatch(r,/setInterval/);
  assert.match(r,/manualResume\(rootHint=null\)/);
  assert.match(r,/COOLDOWN=12000/);
  assert.match(r,/MAX_NEW=120/);
  assert.match(r,/confirmedClientSignatures/);
  assert.match(r,/oldBoundary/);
  assert.match(r,/boundaryFound/);
});

test("v2.9.39 prelude narrows manual reading to notification rows before the reader runs",async()=>{
  const p=await read("public/note-insight-notification-runtime-v2939-prelude.js");
  assert.match(p,/__MUMEI_NOTIFICATION_V2939__/);
  assert.match(p,/function safeListRoot/);
  assert.match(p,/mumei-insight-manual-read-v2933/);
  assert.match(p,/e\.detail\.root=r/);
});

test("legacy per-scroll filtering is pre-disabled before UI binding",async()=>{
  const p=await read("public/note-insight-notification-runtime-v2938-perf.js");
  assert.match(p,/data-mumei-insight-filter-scroll-v2933/);
  assert.match(p,/dataset\.mumeiInsightFilterScrollV2933='1'/);
  assert.match(p,/schedule\(10\)/);
});

test("v2.9.39 filter is display-only, lead-representative-only, and does not run on scroll",async()=>{
  const f=await read("public/note-insight-notification-runtime-v2939-filter.js");
  assert.match(f,/const OWN='mumei-muted-v2939'/);
  assert.match(f,/function leadName/);
  assert.match(f,/function leadId/);
  assert.match(f,/function nameMatch/);
  assert.match(f,/function magazineNoise/);
  assert.match(f,/function setHidden/);
  assert.match(f,/MutationObserver/);
  assert.match(f,/mumei-insight-filter-refresh-v2939/);
  assert.doesNotMatch(f,/document\.addEventListener\('scroll'/);
  assert.doesNotMatch(f,/touchmove/);
  assert.doesNotMatch(f,/wheel/);
});

test("v2.9.39 native scroll runtime never writes scrollTop or captures touch movement",async()=>{
  const s=await read("public/note-insight-notification-runtime-v2939-scroll.js");
  assert.match(s,/overscroll-behavior-y:contain/);
  assert.match(s,/touch-action:pan-y/);
  assert.match(s,/function findBox/);
  assert.doesNotMatch(s,/touchmove/);
  assert.doesNotMatch(s,/wheel/);
  assert.doesNotMatch(s,/scrollTop\s*=/);
  assert.doesNotMatch(s,/preventDefault/);
});

test("v2.9.39 dock isolates user taps inside an iframe and invokes legacy handlers without DOM clicks",async()=>{
  const d=await read("public/note-insight-notification-runtime-v2939-dock.js");
  assert.match(d,/document\.createElement\('iframe'\)/);
  assert.match(d,/frame\.srcdoc=html\(\)/);
  assert.match(d,/parent\.postMessage\(\{mumei2939:true,cmd:id\}/);
  assert.match(d,/typeof b\.onclick!=='function'/);
  assert.match(d,/b\.onclick\(fake\(\)\)/);
  assert.match(d,/mumei-insight-filter-refresh-v2939/);
  assert.match(d,/notification-entry\.html\?from=note&insightMode=notifications#dashboard/);
  assert.match(d,/location\.assign\(INS\)/);
  assert.match(d,/function capture/);
  assert.match(d,/function restore/);
  assert.match(d,/window\.scrollTo\(0,s\.pageY\)/);
});

test("independent guard keeps the dock state stable through transient note DOM changes",async()=>{
  const g=await read("public/note-insight-notification-runtime-v2935-guard.js");
  assert.match(g,/MISS_GRACE=900/);
  assert.match(g,/lastShell=null,lastSeen=0/);
  assert.match(g,/hideTimer=setTimeout/);
  assert.doesNotMatch(g,/rail\.hidden=!shell/);
});

test("INSIGHT notification deep link and active nav remain deterministic",async()=>{
  const entry=await read("public/notification-entry.html");
  const live=await read("src/member-insight-live-v2.tsx");
  const css=await read("src/member-insight-live-v2.css");
  assert.match(entry,/insightMode=notifications#dashboard/);
  assert.match(live,/getElementById\("minf-notifications"\)/);
  assert.match(css,/mode-notifications \.miu-nav button:nth-child\(8\)/);
});

test("INSIGHT and本人通知 versions remain separate",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json"));
  const release=await read("src/insight-release.ts");
  assert.equal(manifest.appVersion,"2026.09.07.8");
  assert.equal(manifest.notificationVersion,"2.9.39");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.07\.8"/);
});

test("v2.9.39 update flow uses Tampermonkey installer and persistent auto-return state",async()=>{
  const update=await read("public/notification-update.html");
  const setup=await read("public/notification-setup.html");
  assert.match(update,/最新版 v2\.9\.39/);
  assert.match(update,/v2\.9\.39 をインストール／更新/);
  assert.match(update,/tampermonkey\.net\/script_installation\.php#url=/);
  assert.match(update,/mumei-notification-update-pending-v2939/);
  assert.match(update,/localStorage\.setItem\(PENDING/);
  assert.match(update,/window\.open\(INSTALLER,'_blank'\)/);
  assert.match(update,/child\.closed/);
  assert.match(update,/autoVerify/);
  assert.match(setup,/最新版は v2\.9\.39/);
  assert.match(setup,/最新版です/);
  assert.match(setup,/localStorage\.removeItem\(PENDING\)/);
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
