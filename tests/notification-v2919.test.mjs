import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.21 bootstrap uses only the stable notification core and UI",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.21/);
  assert.match(boot,/runtime-v2921\.js\?v=2921a/);
  assert.match(boot,/runtime-v2921-ui\.js\?v=2921a/);
  assert.doesNotMatch(boot,/@require[^\n]*runtime-v2919\.js/);
  assert.doesNotMatch(boot,/@require[^\n]*runtime-v2920-ui\.js/);
  assert.match(boot,/mumei_open_notice_v2921/);
});

test("automatic notification save never scrolls the visible notification panel",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2921.js");
  const auto=r.slice(r.indexOf("async function syncVisible"),r.indexOf("async function manualDeep"));
  assert.doesNotMatch(auto,/scrollTop\s*=/);
  assert.match(auto,/保存中… ページを閉じないでください/);
  assert.match(r,/manual-deep-v2921/);
  assert.match(r,/box\.scrollTop=start/);
});

test("saved marker selector is scoped to saved notification items only",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2921.js");
  assert.match(r,/SEL\.map\(x=>`\$\{x\}:not\(\[data-mumei-insight-saved/);
  assert.match(r,/SEL\.map\(x=>`\$\{x\}\[data-mumei-insight-saved/);
  assert.match(r,/content:'保完'/);
  assert.match(r,/for\(const el of rawItems\(\)\)delete el\.dataset\.mumeiInsightSaved/);
});

test("notification classification keeps self magazine additions tips and creator posts",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2921.js");
  for(const x of ["my_article_magazine_added","creator_article_posted","return'tip'","さん(?:から|より)"])assert.ok(r.includes(x));
  assert.match(r,/note-notification-continuous-sync-v2921/);
});

test("v2.9.21 UI hides every old rail and stays within the viewport",async()=>{
  const ui=await read("public/note-insight-notification-runtime-v2921-ui.js");
  for(const id of ["mumei-v2917-tool","mumei-v2918-rail","mumei-v2919-rail","mumei-v2920-rail"])assert.match(ui,new RegExp(id));
  assert.match(ui,/max-width:calc\(100vw - 16px\)/);
  assert.match(ui,/追加読込・保存/);
  assert.match(ui,/フィルターON/);
  assert.match(ui,/INSIGHT/);
  assert.match(ui,/mumei-insight-manual-read-v2921/);
});

test("server and feed retain self-add tip and explicit continuous sync support",async()=>{
  const s=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const f=await read("supabase/functions/insight-notification-feed-final/index.ts");
  assert.match(s,/continuous-sync-v\\d\+/);
  assert.match(s,/my_article_magazine_added/);
  assert.match(s,/return"tip"/);
  assert.match(f,/type==="my_article_magazine_added"\|\|type==="tip"/);
  assert.match(f,/追加されました/);
});

test("iPhone installation uses Tampermonkey handoff instead of raw source as primary path",async()=>{
  const helper=await read("public/notification-install.html");
  assert.match(helper,/2\.9\.21/);
  assert.match(helper,/script_installation\.php#url=/);
  assert.match(helper,/スクリプトURLをコピー/);
  assert.match(helper,/Dashboard \/ Utilities/);
  assert.match(helper,/raw本文/);
  assert.match(helper,/Safari＋Tampermonkey/);
});

test("INSIGHT notification view still exposes current notification categories",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(ui,/チップ・サポート/);
  assert.match(ui,/自分の記事追加/);
  assert.match(ui,/記事投稿/);
  assert.match(ui,/note通知へ/);
});

test("dashboard auto ingest remains separate",async()=>{
  const base=await read("public/note-insight-notification-runtime-v298.js");
  assert.match(base,/startsWith\('\/sitesettings\/stats'\)/);
  assert.match(base,/note-dashboard-auto-v298/);
  assert.match(base,/saveDashboardAuto/);
});
