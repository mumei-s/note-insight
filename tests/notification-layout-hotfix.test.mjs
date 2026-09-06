import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("notification hotfix replaces movable overlay with slim sticky rail",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  const hot=await read("public/note-insight-notification-runtime-v2917-layout-hotfix.js");
  assert.match(boot,/notification-runtime-v2917-layout-hotfix\.js\?v=2917b/);
  for(const x of ["mumei-v2918-rail","position:sticky","通知操作","INSIGHT","height:34px","m2918-inner"]){
    assert.match(hot,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  }
  assert.match(hot,/#mumei-v2917-tool,#mumei-v2917-ins\{position:fixed!important;left:-2000px/);
  assert.doesNotMatch(hot,/setPointerCapture|mumei_insight_notification_tool_pos_v2917/);
});

test("hotfix inserts the rail as a sibling before notifications instead of inside a notification card",async()=>{
  const hot=await read("public/note-insight-notification-runtime-v2917-layout-hotfix.js");
  assert.match(hot,/first\.parentElement\.insertBefore\(rail,first\)/);
  assert.doesNotMatch(hot,/first\.append\(rail\)|first\.prepend\(rail\)/);
});

test("creator icons in INSIGHT notification view link to creator top pages",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx");
  assert.match(ui,/function creatorTop/);
  assert.match(ui,/`https:\/\/note\.com\/\$\{id\}`/);
  assert.match(ui,/aria-label=\{`\$\{name\}のクリエイターページ`\}/);
  assert.match(ui,/className="minf-actor" href=\{actorTop\}/);
});
