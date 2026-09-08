import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.48 bootstrap keeps one current core runtime and account-aware handoff",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.48/);
  assert.match(boot,/runtime-v2948\.js\?v=2948a/);
  assert.equal((boot.match(/\/\/ @require\s+/g)||[]).length,1);
  assert.match(boot,/async function openMatchingInsight\(\)/);
  assert.match(boot,/u\.searchParams\.set\('account',a\.id\)/);
  assert.match(boot,/stopImmediatePropagation\(\)/);
});

test("v2.9.48 recovers checkpoint from saved overlap, never note unread state",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2948.js");
  assert.match(r,/SAVED='mumei_insight_notification_saved_v2919:'/);
  assert.match(r,/CHECK='mumei_insight_notification_checkpoint_v2922:'/);
  assert.match(r,/function resolveBoundary\(data,boundary,saved\)/);
  assert.match(r,/if\(saved\.has\(s\)\)return\{index:i,signature:s,reached:true,recovered:true\}/);
  assert.match(r,/boundarySource:resolved\.recovered\?'manual-saved-overlap-v2948':'manual-confirmed-top-v2948'/);
  assert.doesNotMatch(r,/\bunread\b|aria-unread|is-unread/i);
  assert.doesNotMatch(r,/scrollTop\s*=|scrollTo\(/);
});

test("v2948 current core remains CSP-safe, bottom-docked, filter-session-only and scroll-neutral",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2948.js");
  assert.match(r,/document\.createElement\('iframe'\)/);
  assert.match(r,/frame\.srcdoc=frameHtml\(\)/);
  assert.match(r,/frame\.dataset\.mumeiBound==='1'/);
  assert.match(r,/bottom:max\(8px,env\(safe-area-inset-bottom,0px\)\)/);
  assert.doesNotMatch(r,/parent\.postMessage|contentWindow\?\.postMessage|<script>/);
  assert.doesNotMatch(r,/touchmove|wheel|addEventListener\(['"]scroll|scrollTop\s*=|scrollTo\(/);
  assert.match(r,/filterOn=false/);
  assert.match(r,/async function resetFilterSession\(root\)/);
  assert.match(r,/フィルターON ✓ 非表示\$\{result\.hidden\}件/);
  assert.match(r,/フィルターOFF ✓ \$\{result\.restored\}件復元/);
  assert.match(r,/function verifiedLeadCreatorId/);
  assert.match(r,/const lead=leadName\(text\);if\(!lead\)return false/);
});

test("manual save remains server-confirmed and independent of note read badges",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2948.js");
  const ingest=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  assert.match(r,/SRC='note-notification-manual-sync-v2948'/);
  assert.match(r,/confirmedClientSignatures/);
  assert.match(r,/boundarySignature/);
  assert.match(r,/前回保存ここまで/);
  assert.match(ingest,/manual-sync-v\\d\+/);
  assert.match(r,/function actorImage/);
  assert.match(r,/magazine_cover\|ogp\|cover/);
});

test("database classifier keeps plain follows and creator article posts out of その他",async()=>{
  const m=await read("supabase/migrations/20260908051000_notification_classification_exact_v6.sql");
  assert.match(m,/がフォローしました\( \|\$\)/);
  assert.match(m,/new\.notification_type := 'follow'/);
  assert.match(m,/が\(新しい\)\?記事を投稿しました/);
  assert.match(m,/new\.notification_type := 'creator_article_posted'/);
  assert.match(m,/update public\.insight_notifications[\s\S]*notification_type='follow'/);
  assert.match(m,/update public\.insight_notifications[\s\S]*notification_type='creator_article_posted'/);
});

test("feed merges manual comments/replies with canonical comments and splits reply context",async()=>{
  const f=await read("supabase/functions/insight-notification-feed-final/index.ts");
  assert.match(f,/kind==="comment"\|\|kind==="reply"\|\|kind==="reply_self"\|\|kind==="reply_other"/);
  assert.match(f,/Promise\.all\(\[notificationRows\(ids,base\),commentRows/);
  assert.match(f,/displayCategory=selfArticle\?"reply_self":"reply_other"/);
  assert.match(f,/自分の記事のコメントへの返信/);
  assert.match(f,/相手の記事で自分のコメントへの返信/);
  assert.match(f,/if\(type==="reply"\|\|type==="comment"\)return/);
});

test("feed splits own membership reactions from joined memberships and retains join/magazine categories",async()=>{
  const f=await read("supabase/functions/insight-notification-feed-final/index.ts");
  assert.match(f,/membership_reaction_self/);
  assert.match(f,/membership_reaction_joined/);
  assert.match(f,/targetOwner&&targetOwner===noteId/);
  assert.match(f,/membership_join/);
  assert.match(f,/magazine_join/);
});

test("INSIGHT notification UI exposes exact requested categories",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(ui,/\["creator_article_posted","記事投稿"\]/);
  assert.match(ui,/\["reply_self","自分の記事返信"\]/);
  assert.match(ui,/\["reply_other","相手の記事返信"\]/);
  assert.match(ui,/\["membership_reaction_self","自分のメンシプ反応"\]/);
  assert.match(ui,/\["membership_reaction_joined","参加中のメンシプ反応"\]/);
  assert.match(ui,/\["magazine_join","マガジン参加"\]/);
  assert.match(ui,/\["membership_join","メンシプ参加"\]/);
  assert.match(ui,/display_category/);
  assert.match(ui,/window\.setInterval\(refresh,3000\)/);
});

test("INSIGHT merges duplicate magazine joins and keeps captured actor avatar authoritative",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(ui,/function mergeMagazineJoinRows/);
  assert.match(ui,/function mergePair/);
  assert.match(ui,/function safeActorImage/);
  assert.match(ui,/magazine_cover\|ogp\|cover/);
  assert.match(ui,/rows\.filter\(r=>!safeActorImage\(r\.actor_image_url\)\)/);
  assert.match(ui,/safeActorImage\(r\.actor_image_url\)\|\|String\(m\.get\(noteId\(r\.actor_url\)\)\|\|""\)\|\|null/);
  assert.match(ui,/enrich\(mergeMagazineJoinRows\(x\.rows\|\|\[\]\)\)/);
});

test("v2.9.48 installer verifies the actual running version",async()=>{
  const update=await read("public/notification-update.html");
  const setup=await read("public/notification-setup.html");
  assert.match(update,/最新版 v2\.9\.48/);
  assert.match(update,/Android Edge/);
  assert.match(update,/Android Firefox/);
  assert.match(update,/iPhone\/iPad Safari/);
  assert.match(update,/window\.open\(SCRIPT,'mumei-notification-install'\)/);
  assert.match(update,/Date\.now\(\)-rawSince>1800/);
  assert.match(update,/child\.close\(\)/);
  assert.doesNotMatch(update,/script_installation\.php/);
  assert.match(setup,/最新版は v2\.9\.48/);
  assert.match(setup,/更新完了｜本人通知 v\$\{VERSION\}｜最新版/);
});

test("manual notifications are never dropped merely because subtype is unknown",async()=>{
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
  assert.equal(manifest.appVersion,"2026.09.08.6");
  assert.equal(manifest.notificationVersion,"2.9.48");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.08\.6"/);
});

test("comment history loads every saved thread instead of stopping at the first 100",async()=>{
  const ui=await read("src/member-insight-comments-final.tsx");
  const css=await read("src/member-insight-comments-final.css");
  assert.match(ui,/const PAGE=100/);
  assert.match(ui,/async function loadAll\(\)/);
  assert.match(ui,/const pages=Math\.ceil\(expected\/PAGE\)/);
  assert.match(ui,/for\(let start=2;start<=pages;start\+=FETCH_GROUP\)/);
  assert.match(ui,/setRows\(collected\)/);
  assert.match(ui,/全履歴 読込完了/);
  assert.doesNotMatch(ui,/className="micf-pager"/);
  assert.match(css,/content-visibility:auto/);
});

test("notification entry activates only the matching saved INSIGHT account token",async()=>{
  const entry=await read("public/notification-entry.html");
  assert.match(entry,/mumei-insight-saved-accounts-v3/);
  assert.match(entry,/mumei-insight-active-account-v3/);
  assert.match(entry,/mumei-insight-access-token/);
  assert.match(entry,/notificationAccount/);
  assert.doesNotMatch(entry,/memberToken\s*=\s*requested/);
});

test("server/database preserve exact membership join and board reaction classification",async()=>{
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
