import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("setup center uses one direct userscript update and keeps participant steps simple",async()=>{
  const page=await read("public/tool-setup.html");
  assert.match(page,/通知＋ダッシュボードをインストール／更新/);
  assert.match(page,/本人通知を実働確認／連携/);
  assert.match(page,/Tampermonkey自体を入れ直す必要はありません/);
  assert.doesNotMatch(page,/target="_blank"/);
  assert.doesNotMatch(page,/note-insight-dashboard-sync\.user\.js/);
  assert.match(page,/note-insight-notification-v3\.user\.js/);
  assert.match(page,/mumei-direct-install-pending/);
  assert.match(page,/このまま連携できます/);
  assert.doesNotMatch(page,/Import from URL/);
  assert.doesNotMatch(page,/script_installation\.php#url=/);
  assert.doesNotMatch(page,/window\.open\(/);
});

test("old notification update routes to the same unified setup center",async()=>{
  for(const path of ["public/notification-setup.html","public/notification-update-v29665.html","public/notification-update-v2966.html","public/notification-setup-v2966.html"]){const page=await read(path);assert.match(page,/tool-setup\.html/)}
  const update=await read("public/notification-update.html");assert.match(update,/tool-setup\.html/);assert.match(update,/本人通知とダッシュボードは同じ1本で更新します/);assert.doesNotMatch(update,/Raw文字列|Import from URL|raw\.githubusercontent\.com/);
});

test("retired Bridge is a no-op compatibility stub",async()=>{
  const b=await read("public/note-insight-bridge.user.js");
  assert.match(b,/@version\s+1\.0\.1/);
  assert.match(b,/互換停止版/);
  assert.match(b,/このBridgeは何も起動しません/);
});

test("V3.1.9 loads the permanent dock before the existing core loader",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),fixed=await read("public/note-insight-notification-fixed-dock-v319.js"),loader=await read("public/note-insight-notification-loader-v318.js");
  assert.match(v3,/@version\s+3\.1\.9/);assert.match(v3,/note-insight-notification-fixed-dock-v319\.js\?v=319/);assert.match(v3,/note-insight-notification-loader-v318\.js\?v=319/);assert.doesNotMatch(v3,/note-insight-notification-launcher-v317\.js/);
  assert.match(fixed,/const VERSION='3\.1\.9'/);assert.match(fixed,/notificationInstalled',VERSION/);assert.match(fixed,/fixed-dock-v319/);assert.match(loader,/const VERSION='3\.1\.8'/);
});

test("notification controls are always fixed in four columns with no collapse launcher",async()=>{
  const fixed=await read("public/note-insight-notification-fixed-dock-v319.js"),reader=await read("public/note-insight-notification-autoscan-v2970.js");
  assert.match(fixed,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);assert.match(fixed,/bottom:max\(10px/);assert.match(fixed,/下から読込/);assert.match(fixed,/フィルターOFF/);assert.match(fixed,/フィルター設定/);assert.match(fixed,/INSIGHT【通知】/);
  assert.match(fixed,/__mumeiNotificationDockWatchV312=true/);assert.match(fixed,/__mumeiNotificationLauncherV317=true/);assert.match(fixed,/removeLauncher/);assert.doesNotMatch(fixed,/🔔 INSIGHT|× 通知パネル|bindDrag|savePos/);
  assert.match(fixed,/function onClick\(e\)/);assert.match(fixed,/clickLegacy\('read'\)/);assert.match(fixed,/clickLegacy\('filter'\)/);assert.match(fixed,/function autoStart\(\)/);assert.match(fixed,/read\.click\(\)/);
  assert.match(reader,/verified-shell-bottom-to-top/);assert.match(reader,/slice\(\)\.reverse\(\)/);
});

test("INSIGHT notifications collapse category choices into one selector",async()=>{
  const ui=await read("src/insight-notification-ui-v18.ts"),release=await read("src/insight-release.ts");
  assert.match(release,/insight-notification-ui-v18/);
  assert.match(ui,/mumei-notification-category-button/);assert.match(ui,/通知項目：/);assert.match(ui,/data-mumei-category-open/);assert.match(ui,/mumeiCategoryOpen="0"/);assert.match(ui,/PUBLIC_DUPLICATE_LABELS/);
  for(const label of ["スキ","人物フォロー","通常コメント","記事投稿"])assert.match(ui,new RegExp(label));
});
