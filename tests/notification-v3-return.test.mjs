import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("installer keeps participant steps compact with automatic confirmation",async()=>{
  const page=await read("public/tool-setup.html");
  assert.match(page,/INSIGHT インストール \/ 更新/);
  assert.match(page,/最新版かどうか自動確認します/);
  assert.match(page,/insight-release\.json/);
  assert.match(page,/Tampermonkey/);
  assert.match(page,/https:\/\/mumei-s\.github\.io\/note-insight\/note-insight-notification-v3\.user\.js/);
  assert.doesNotMatch(page,/V3\.2\.29|本人通知 V\d/);
  assert.doesNotMatch(page,/script_installation\.php#url=/);
  assert.match(page,/mumei-notification-v3-loader/);
  assert.match(page,/mumei-notification-tool-version/);
  assert.match(page,/確認ボタンも不要/);
  assert.doesNotMatch(page,/Import from URL|window\.open\(|https:\/\/note\.com\/notifications|mumei_insight_version_check/);
});

test("V3.2.29 preloads reader, persistent checkpoint and canonical four-button dock",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),checkpoint=await read("public/note-insight-notification-checkpoint-v325.js"),loader=await read("public/note-insight-notification-loader-v318.js"),dock=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-reader-v323.js");
  assert.match(v3,/@version\s+3\.2\.29/);
  assert.match(v3,/dock-4col-v3229/);
  const meta=v3.split("// ==/UserScript==")[0];
  assert.match(meta,/note-insight-notification-reader-v323\.js\?v=3229/);
  assert.match(meta,/note-insight-notification-checkpoint-v325\.js\?v=3229/);
  assert.match(meta,/note-insight-notification-dock-watch-v312\.js\?v=3229/);
  assert.doesNotMatch(meta,/note-insight-notification-runtime-v327\.js|surface-guard-v326/);
  assert.match(dock,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(dock,/data-act="read"/);assert.match(dock,/data-act="filter"/);assert.match(dock,/data-act="settings"/);assert.match(dock,/data-act="ins"/);
  assert.match(dock,/function findShell\(/);assert.match(dock,/function topClick\(/);assert.match(dock,/bellGraceUntil=Date\.now\(\)\+7000/);
  assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);
  assert.match(checkpoint,/localStorage\.setItem/);
  assert.match(loader,/note-insight-dashboard-integrated-v318\.js/);
  assert.match(dock,/ensureReader/);assert.match(reader,/mumei-v3-read-request/);
});

test("notification dock can appear before rows finish rendering and starts when rows arrive",async()=>{
  const dock=await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(dock,/bellGraceUntil=Date\.now\(\)\+7000/);
  assert.match(dock,/showDock\(true\)/);
  assert.match(dock,/async function startBellReader\(/);
  assert.match(dock,/if\(shell&&rows\(shell\)\.length\)/);
  assert.match(dock,/void requestRead\(!freshReaderLoaded\)/);
});

test("filter registration opens the dedicated settings page and returns to note notifications",async()=>{
  const dock=await read("public/note-insight-notification-dock-watch-v312.js"),page=await read("public/notification-filter.html");
  assert.match(dock,/FILTER_BASE='https:\/\/mumei-s\.github\.io\/note-insight\/notification-filter\.html'/);
  assert.match(dock,/function openSettings\(\)/);
  assert.match(dock,/mumei_return/);
  assert.match(page,/通知フィルター設定/);
  assert.match(page,/returnUrl='https:\/\/note\.com\/notifications'/);
});

test("automatic incremental reading is the default without a separate auto/manual control",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),dock=await read("public/note-insight-notification-dock-watch-v312.js");
  assert.doesNotMatch(v3,/note-insight-notification-runtime-v327\.js/);
  assert.doesNotMatch(dock,/data-a="mode"|mumei_insight_notification_auto_v325:/);
  assert.match(dock,/async function tryAutoStart\(/);
  assert.match(dock,/void requestRead\(!freshReaderLoaded\)/);
});

test("INSIGHT notifications keep one category selector",async()=>{
  const ui=await read("src/insight-notification-ui-v18.ts"),release=await read("src/insight-release.ts");
  assert.match(release,/insight-notification-ui-v18/);
  assert.match(ui,/mumei-notification-category-button/);assert.match(ui,/通知項目：/);assert.match(ui,/PUBLIC_DUPLICATE_LABELS/);
});
