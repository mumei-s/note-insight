import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("installer keeps participant steps compact with automatic confirmation",async()=>{
  const page=await read("public/tool-setup.html");
  assert.match(page,/INSIGHT インストール \/ 更新/);assert.match(page,/最新版かどうか自動確認します/);assert.match(page,/insight-release\.json/);assert.match(page,/Tampermonkey/);
  assert.match(page,/https:\/\/mumei-s\.github\.io\/note-insight\/note-insight-notification-v3\.user\.js/);
  assert.doesNotMatch(page,/本人通知 V\d|V3\.2\.30/);assert.match(page,/mumei-notification-v3-loader/);assert.match(page,/mumei-notification-tool-version/);assert.match(page,/確認ボタンも不要/);
});

test("V3.2.30 preloads reader, checkpoint and compact launcher",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),checkpoint=await read("public/note-insight-notification-checkpoint-v325.js"),dock=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-reader-v323.js");
  assert.match(v3,/@version\s+3\.2\.30/);assert.match(v3,/compact-launcher-v3230/);
  const meta=v3.split("// ==/UserScript==")[0];
  assert.match(meta,/note-insight-notification-reader-v323\.js\?v=3230/);assert.match(meta,/note-insight-notification-checkpoint-v325\.js\?v=3230/);assert.match(meta,/note-insight-notification-dock-watch-v312\.js\?v=3230/);
  assert.doesNotMatch(meta,/note-insight-notification-runtime-v327\.js|surface-guard-v326/);
  assert.match(dock,/mumei-v3-launcher-v330/);assert.match(dock,/mumei-v3-tray-v330/);assert.match(dock,/🔔 INSIGHT/);
  assert.match(dock,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  for(const act of ["read","filter","settings","ins"])assert.match(dock,new RegExp(`data-act=\\"${act}\\"`));
  assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);assert.match(checkpoint,/localStorage\.setItem/);assert.match(reader,/mumei-v3-read-request/);
});

test("launcher appears while notification surface opens and auto-read starts when rows arrive",async()=>{
  const dock=await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(dock,/bellGraceUntil=Date\.now\(\)\+7000/);assert.match(dock,/showLauncher\(true\)/);assert.match(dock,/if\(!shell\|\|autoStarted\|\|!rows\(shell\)\.length\)return/);assert.match(dock,/void requestRead\(false\)/);
});

test("filter registration opens the dedicated settings page and returns to note notifications",async()=>{
  const dock=await read("public/note-insight-notification-dock-watch-v312.js"),page=await read("public/notification-filter.html");
  assert.match(dock,/notification-filter\.html/);assert.match(dock,/function openSettings\(\)/);assert.match(dock,/mumei_return/);assert.match(page,/通知フィルター設定/);assert.match(page,/returnUrl='https:\/\/note\.com\/notifications'/);
});

test("automatic incremental reading is default and there is no auto/manual mode button",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),dock=await read("public/note-insight-notification-dock-watch-v312.js");
  assert.doesNotMatch(v3,/note-insight-notification-runtime-v327\.js/);assert.doesNotMatch(dock,/data-a="mode"|mumei_insight_notification_auto_v325:/);assert.match(dock,/async function tryAutoStart\(/);assert.match(dock,/追加読込/);
});

test("INSIGHT notifications keep one category selector",async()=>{
  const ui=await read("src/insight-notification-ui-v18.ts"),release=await read("src/insight-release.ts");
  assert.match(release,/insight-notification-ui-v18/);assert.match(ui,/mumei-notification-category-button/);assert.match(ui,/通知項目：/);assert.match(ui,/PUBLIC_DUPLICATE_LABELS/);
});
