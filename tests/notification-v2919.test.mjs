import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.19 bootstrap is the only current notification runtime",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.19/);
  assert.match(boot,/runtime-v298\.js\?v=2919/);
  assert.match(boot,/runtime-v2919\.js\?v=2919a/);
  assert.doesNotMatch(boot,/@require[^\n]*runtime-v2918/);
  assert.match(boot,/mumei_open_notice_v2919/);
  assert.match(boot,/mumei_insight_version_check/);
});

test("v2919 stops old UI regeneration flicker without deleting old controls",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2919.js");
  assert.match(r,/location\.hostname!==['"]note\.com['"]/);
  for(const id of ["mumei-v2917-tool","mumei-v2917-ins","mumei-v2918-mainrail","mumei-v2918-settings"])assert.match(r,new RegExp(id));
  assert.match(r,/display:none!important/);
  assert.match(r,/pointer-events:none!important/);
  assert.doesNotMatch(r,/querySelectorAll\(OLD\).*remove/);
  assert.doesNotMatch(r,/characterData:true/);
});

test("v2919 reads only notification items and never generic page articles",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2919.js");
  assert.match(r,/const ITEM=['"]\.m-navbarNoticeItem/);
  assert.doesNotMatch(r,/li\[role=.listitem.\],article/);
  assert.match(r,/MutationObserver/);
  assert.match(r,/childList:true,subtree:true/);
});

test("saved marker is CSS-only and cannot enter notification text",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2919.js");
  assert.match(r,/data-mumei-insight-saved/);
  assert.match(r,/::after\{content:'保完'/);
  assert.match(r,/replace\(\/保完/);
  assert.doesNotMatch(r,/createElement\(['"]span['"]\).*保完/);
});

test("bell open triggers near-immediate save and panel heartbeat never auto-opens bell",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2919.js");
  assert.match(r,/bell-open-v2919/);
  assert.match(r,/schedule\('bell-open-v2919',40\)/);
  assert.match(r,/notification-dom-v2919',80/);
  assert.match(r,/panel-heartbeat-v2919/);
  assert.doesNotMatch(r,/\.click\(\).*bell/);
  assert.doesNotMatch(r,/launchReturn/);
});

test("tip self-add and creator post classification are covered client and server",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2919.js");
  const s=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  for(const x of ["my_article_magazine_added","creator_article_posted","return'tip'","さん(?:から|より)"])assert.match(r,new RegExp(x));
  for(const x of ["my_article_magazine_added","creator_article_posted","action-v14-v2919","browser-notification-v2919","さん(?:から|より)"])assert.match(s,new RegExp(x));
  assert.match(s,/continuous-sync-v\\d\+/);
  assert.match(s,/cleanRaw/);
});

test("iPhone install never requires opening raw source as the primary path",async()=>{
  const helper=await read("public/notification-install.html");
  const setup=await read("public/notification-import.html");
  for(const src of [helper,setup])assert.match(src,/2\.9\.19/);
  assert.match(helper,/script_installation\.php#url=/);
  assert.match(helper,/スクリプトURLをコピー/);
  assert.match(helper,/Dashboard \/ Utilities/);
  assert.match(helper,/rawコード/);
  assert.match(setup,/Safari＋Tampermonkey/);
});

test("INSIGHT notification view points to v2919 setup and bell",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(ui,/v2\.9\.19/);
  assert.match(ui,/mumei_open_notice_v2919=1/);
  assert.match(ui,/v=2919/);
  assert.match(ui,/チップ・サポート/);
  assert.match(ui,/自分の記事追加/);
  assert.match(ui,/記事投稿/);
});

test("dashboard auto ingest stays present and separate",async()=>{
  const base=await read("public/note-insight-notification-runtime-v298.js");
  assert.match(base,/startsWith\('\/sitesettings\/stats'\)/);
  assert.match(base,/note-dashboard-auto-v298/);
  assert.match(base,/saveDashboardAuto/);
});
