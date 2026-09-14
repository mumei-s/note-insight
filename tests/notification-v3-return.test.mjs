import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("setup center bypasses Tampermonkey intermediary on Edge and keeps the INSIGHT tab",async()=>{
  const page=await read("public/tool-setup.html");
  assert.match(page,/通知＋ダッシュボードを直接インストール／更新/);
  assert.match(page,/本人通知を実働確認／連携/);
  assert.match(page,/target="_blank"/);
  assert.doesNotMatch(page,/note-insight-dashboard-sync\.user\.js/);
  assert.match(page,/note-insight-notification-v3\.user\.js/);
  assert.match(page,/mumei-direct-install-pending/);
  assert.match(page,/この画面で連携を続けられます/);
  assert.match(page,/Import from URL/);
  assert.doesNotMatch(page,/script_installation\.php#url=/);
  assert.doesNotMatch(page,/window\.open\(/);
});

test("notification update persists confirmed version before returning to INSIGHT",async()=>{
  for(const path of ["public/notification-setup.html","public/notification-update-v29665.html","public/notification-update-v2966.html","public/notification-setup-v2966.html"]){const page=await read(path);assert.match(page,/tool-setup\.html/)}
  const update=await read("public/notification-update.html");assert.match(update,/本人通知 V3\.1\.8/);assert.match(update,/Raw文字列/);assert.match(update,/更新確認してINSIGHTへ戻る/);assert.match(update,/raw\.githubusercontent\.com/);assert.match(update,/localStorage\.setItem\('mumei-notification-tool-version',installed\)/);assert.match(update,/dest\.searchParams\.set\('notificationInstalled',installed\)/);
});

test("retired Bridge is a no-op compatibility stub",async()=>{
  const b=await read("public/note-insight-bridge.user.js");
  assert.match(b,/@version\s+1\.0\.1/);
  assert.match(b,/互換停止版/);
  assert.match(b,/このBridgeは何も起動しません/);
});

test("V3.1.8 keeps version return and delegates controls to the compact dock-watch",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),fix=await read("public/note-insight-notification-loader-v318.js"),watch=await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(v3,/@version\s+3\.1\.8/);assert.match(v3,/note-insight-notification-loader-v318\.js/);assert.doesNotMatch(v3,/note-insight-notification-v317-fix\.js/);
  assert.match(fix,/const VERSION='3\.1\.8'/);assert.match(fix,/mumei_insight_version_check/);assert.match(fix,/runtime-checked-v318/);
  assert.match(watch,/mumeiNotificationCompactDock/);assert.match(watch,/mumei-notification-launcher-position-v1/);assert.match(watch,/520/);
});

test("notification controls stay in one movable button and auto-start bottom-up scan while collapsed",async()=>{
  const watch=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-autoscan-v2970.js");
  assert.match(watch,/🔔 INSIGHT/);assert.match(watch,/× 通知/);assert.match(watch,/function ensureLauncher\(/);assert.match(watch,/function bindDrag\(/);assert.match(watch,/savePos/);assert.match(watch,/localStorage\.setItem\(POS/);
  assert.match(watch,/追加読込・保存/);assert.match(watch,/フィルターOFF/);assert.match(watch,/フィルター設定/);assert.match(watch,/INSIGHT【通知】/);
  assert.match(watch,/function tryAutoStart\(\)/);assert.match(watch,/autoStarted=true/);assert.match(watch,/read\.click\(\)/);assert.match(watch,/display',open\?'block':'none'/);
  assert.match(watch,/本人通知本体を再接続中/);assert.match(watch,/接続修復のため1回だけ再読込/);
  assert.doesNotMatch(watch,/mumeiAlwaysVisible|forceDock|setTimeout\(pulse,180\)|function pulse\(/);
  assert.match(reader,/verified-shell-bottom-to-top/);assert.match(reader,/slice\(\)\.reverse\(\)/);
});

test("INSIGHT notifications collapse category choices into one selector",async()=>{
  const ui=await read("src/insight-notification-ui-v18.ts"),release=await read("src/insight-release.ts");
  assert.match(release,/insight-notification-ui-v18/);
  assert.match(ui,/mumei-notification-category-button/);assert.match(ui,/通知項目：/);assert.match(ui,/data-mumei-category-open/);assert.match(ui,/mumeiCategoryOpen="0"/);assert.match(ui,/PUBLIC_DUPLICATE_LABELS/);
  for(const label of ["スキ","人物フォロー","通常コメント","記事投稿"])assert.match(ui,new RegExp(label));
});
