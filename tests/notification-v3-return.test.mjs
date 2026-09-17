import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("installer keeps participant steps compact with automatic confirmation",async()=>{
  const page=await read("public/tool-setup.html");
  assert.match(page,/INSIGHT インストール \/ 更新/);
  assert.match(page,/この画面で更新結果を確認/);
  assert.match(page,/Tampermonkey/);
  assert.match(page,/https:\/\/mumei-s\.github\.io\/note-insight\/note-insight-notification-v3\.user\.js/);
  assert.doesNotMatch(page,/script_installation\.php#url=/);
  assert.match(page,/mumei-notification-v3-loader/);
  assert.match(page,/mumei-notification-tool-version/);
  assert.match(page,/確認ボタンも不要/);
  assert.doesNotMatch(page,/Import from URL|window\.open\(|https:\/\/note\.com\/notifications|mumei_insight_version_check/);
});

test("V3.2.24 preloads reader, inline runtime and fallback dock",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),runtime=await read("public/note-insight-notification-runtime-v324.js"),loader=await read("public/note-insight-notification-loader-v318.js"),dock=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-reader-v323.js");
  assert.match(v3,/@version\s+3\.2\.24/);
  assert.match(v3,/runtime-checked-v3224/);
  const meta=v3.split("// ==/UserScript==")[0];
  assert.match(meta,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-reader-v323\.js\?v=3224/);
  assert.match(meta,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-runtime-v324\.js\?v=3224/);
  assert.match(meta,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-dock-watch-v312\.js\?v=3224/);
  assert.match(runtime,/window\.__mumeiNotificationDock322=true/);
  assert.match(runtime,/function findSurface\(/);
  assert.match(runtime,/showRoot\(Boolean\(shell\)\)/);
  assert.match(runtime,/通知フィルター登録/);
  assert.match(runtime,/async function openSettings\(/);
  assert.doesNotMatch(runtime,/notification-filter\.html/);
  assert.match(loader,/note-insight-dashboard-integrated-v318\.js/);
  assert.match(dock,/ensureReader/);assert.match(reader,/mumei-v3-read-request/);
});

test("notification panel is restricted to an actual notification surface",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v324.js");
  assert.match(runtime,/function findSurface\(\)/);
  assert.match(runtime,/^function showRoot\(on\)/m);
  assert.match(runtime,/showRoot\(Boolean\(shell\)\)/);
  assert.match(runtime,/if\(\^?\/notifications|\/notifications/);
  assert.doesNotMatch(runtime,/bellGraceUntil|intentUntil|rescueIntentUntil/);
});

test("inline filter registration keeps users on note",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v324.js");
  assert.match(runtime,/通知フィルター登録/);
  assert.match(runtime,/GRP='mumei_insight_notification_groups_v1:'/);
  assert.match(runtime,/MUT='mumei_insight_magazine_mute_ids_v5:'/);
  assert.match(runtime,/FIL='mumei_insight_magazine_filter_enabled_v3:'/);
  assert.doesNotMatch(runtime,/notification-filter\.html/);
});

test("INSIGHT notifications keep one category selector",async()=>{
  const ui=await read("src/insight-notification-ui-v18.ts"),release=await read("src/insight-release.ts");
  assert.match(release,/insight-notification-ui-v18/);
  assert.match(ui,/mumei-notification-category-button/);assert.match(ui,/通知項目：/);assert.match(ui,/PUBLIC_DUPLICATE_LABELS/);
});