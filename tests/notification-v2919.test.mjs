import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");
const has=(text,items)=>{for(const x of items)assert.match(text,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))};

test("V3.3.9 loads panel-free automatic notification reader",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),reader=await read("public/note-insight-notification-autoscan-v2970.js");
  assert.match(v3,/@version\s+3\.3\.9/);
  assert.ok(v3.includes("note-insight-notification-autoscan-v2970.js?v=3390"));
  assert.ok(v3.includes("note-insight-notification-bootstrap-v2966.js?v=3390"));
  assert.doesNotMatch(v3,/note-insight-notification-runtime-v2958\.js\?v=|note-insight-notification-runtime-v327\.js\?v=/);
  has(reader,["function directPanel","function findPanel(){return directPanel()}","actor_image_url:img","function scheduleAuto","historyComplete","mumei_insight_notification_avatar_repair_v338:","✓全履歴確認","✓追加確認"]);
});

test("automatic notification reading does not require a dock",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),reader=await read("public/note-insight-notification-autoscan-v2970.js");
  assert.doesNotMatch(v3,/note-insight-notification-runtime-v2958\.js\?v=/);
  assert.match(reader,/function scheduleAuto/);assert.match(reader,/void scan\(\)/);
  assert.match(reader,/for\(let i=0;i<1200&&!stop;i\+\+\)/);assert.match(reader,/steps\+\+<1200/);
  assert.match(reader,/new MutationObserver/);
});

test("installer is isolated, versionless and browser-specific",async()=>{
  const redirect=await read("public/tool-setup.html"),setup=await read("public/notification-browser-install.html"),top=await read("src/insight-top-install-v16.ts"),route=await read("src/insight-notification-update-route-v1.ts"),bridge=await read("public/note-insight-bridge.user.js");
  has(redirect,["notification-browser-install.html","location.replace(target.href)"]);
  assert.doesNotMatch(redirect,/ブラウザ別インストール|raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-v3\.user\.js/);
  has(setup,["mumei-installer-boundary","INSIGHT インストール / 更新","本人通知ツール","本人通知をインストール / 更新","ブラウザ別インストール","insight-release.json","notificationVersion","raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js","mumei-notification-v3-loader","mumei-notification-tool-version","apps.apple.com/jp/app/userscripts/id1463298887","data-browser=\"android-edge\"","data-browser=\"android-firefox\"","data-browser=\"android-other\"","data-browser=\"ios-safari\"","data-browser=\"ios-other\"","data-browser=\"pc-edge\"","data-browser=\"pc-chrome\"","data-browser=\"pc-firefox\"","data-browser=\"pc-opera\"","data-browser=\"mac-safari\"","Yahoo!ブラウザー"]);
  assert.doesNotMatch(setup,/本人通知 V\d|V3\.3\.6をインストール|script_installation\.php#url=/);
  has(top,["./tool-setup.html?from=top","mumei-notice-controls","mumei-notice-feature-toggle","mumei-notification-feature-ui-v1","mumei-notification-feature-bridge-v1","本人通知機能をOFFにする","本人通知機能をONにする"]);
  assert.match(top,/grid-template-columns:minmax\(34px,.62fr\) minmax\(0,1fr\)/);
  has(route,["notification-update.html"]);
  has(bridge,["互換停止版"]);
});

test("release tracks V3.3.9 without putting the version in the user-facing label",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json")),release=await read("src/insight-release.ts"),v3=await read("public/note-insight-notification-v3.user.js");
  assert.equal(manifest.appVersion,"2026.09.21.6");assert.equal(manifest.notificationVersion,"3.3.9");assert.equal(manifest.notificationLabel,"本人通知");assert.equal(manifest.dashboardVersion,"1.4.4");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.21\.6"/);assert.match(release,/CURRENT_NOTIFICATION_VERSION = "3\.3\.9"/);assert.match(v3,/@version\s+3\.3\.9/);
});

test("Dashboard and notification auth prefer explicit owner before stale member session",async()=>{const dash=await read("supabase/functions/insight-dashboard-import-token/index.ts"),notice=await read("supabase/functions/insight-notification-import-token/index.ts");for(const src of [dash,notice])assert.match(src,/if\(preferred==="owner"&&await owner\(req\)\)return ownerIdentity\(\);const p=await participant\(req\)/)});

test("private notification categories stay dense while public duplicates are excluded",async()=>{const ui=await read("src/member-insight-notifications-final.tsx"),picker=await read("src/insight-notification-ui-v18.ts"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");has(ui,["reply_self","membership_join","purchase","tip","other"]);has(feed,["[\"like\",\"follow\",\"comment\",\"creator_article_posted\"]"]);has(picker,["スキ","人物フォロー","通常コメント","記事投稿"])});