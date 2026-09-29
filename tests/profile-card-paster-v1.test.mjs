import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=p=>readFile(new URL(p,root),"utf8");

test("profile paste tool v1.1 is editor-only and INSIGHT-independent",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/@version\s+1\.1\.0/);
  assert.match(s,/@match\s+https:\/\/editor\.note\.com\/\*/);
  assert.doesNotMatch(s,/@match\s+https:\/\/note\.com\/\*/);
  assert.doesNotMatch(s,/mumei_insight|current_user/);
});

test("supports multiple article URLs, hashtags, and magazine URLs in source order",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/function parseSourceLines/);
  assert.match(s,/split\(\/\\r\?\\n\//);
  assert.match(s,/type:'tag'/);
  assert.match(s,/\/api\/v3\/searches\?context=note/);
  assert.match(s,/\/api\/v3\/notes\/.*\/likes\?page=/);
  assert.match(s,/\/api\/v1\/magazines\/.*\/notes\?start=/);
  assert.match(s,/for\(let si=0;si<sources\.length/);
});

test("supports numeric aggregate count and all mode independently",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/data-likes-mode/);
  assert.match(s,/data-mag-mode/);
  assert.match(s,/<option value="all">全数<\/option>/);
  assert.match(s,/function targetLimit/);
  assert.match(s,/mode==='all'\?Infinity/);
});

test("supports oldest, fixed-fallback-latest, and latest article choice with clickable buttons",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/data-choice="oldest"/);
  assert.match(s,/data-choice="fixed"/);
  assert.match(s,/data-choice="latest"/);
  assert.match(s,/disabled_pinned=/);
  assert.match(s,/querySelectorAll\('button\[data-choice\]'\)\.forEach\(btn=>btn\.addEventListener\('click'/);
  assert.match(s,/touch-action:manipulation/);
});

test("generated paste includes icon, image caption, thumbnail, and URL link",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/actorImageUrl/);
  assert.match(s,/thumbUrl/);
  assert.match(s,/row\.creator\+'さん'/);
  assert.match(s,/link:row\.url/);
  assert.match(s,/ctx\.drawImage/);
});

test("paste is fully automatic and does not require plus/image picker",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/CwN/);
  assert.match(s,/DataTransfer/);
  assert.match(s,/ensureEndSelection/);
  assert.match(s,/読み込み→全自動貼付/);
  assert.match(s,/＋操作不要/);
  assert.doesNotMatch(s,/page\.confirm\(/);
});

test("panel is compact, collapsible, tiny-restorable, and long-press draggable",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/width:min\(276px/);
  assert.match(s,/\.collapsed \.body\{display:none\}/);
  assert.match(s,/PANEL\+'-mini'/);
  assert.match(s,/function bindLongDrag/);
  assert.match(s,/setTimeout\(\(\)=>\{dragging=true/);
  assert.match(s,/420\)/);
  assert.match(s,/data-ui="collapse"/);
  assert.match(s,/data-ui="tiny"/);
});

test("dedupes duplicate article URLs and keeps source priority",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/seenUrls\.has\(u\)/);
  assert.match(s,/seen\.has\(u\)/);
  assert.match(s,/sources\.length&&out\.length<limit/);
});

test("performance math article is always last and deduped from sources",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/FINAL_URL='https:\/\/note\.com\/fuku444\/n\/nb4f6934381e9'/);
  assert.match(s,/u===norm\(FINAL_URL\)/);
  assert.match(s,/raw\.push\(\{[\s\S]*finalMarker:true/);
  assert.match(s,/最後：実績の算数/);
});

test("installer describes v1.1 workflow",async()=>{
  const h=await read("public/note-profile-card-paster-install.html");
  assert.match(h,/v1\.1\.0/);
  assert.match(h,/記事URL \/ #タグ/);
  assert.match(h,/マガジンURL → 掲載記事/);
  assert.match(h,/上に並べた入力から優先/);
  assert.match(h,/「全数」/);
  assert.match(h,/＋ボタンや「画像」は押しません/);
  assert.match(h,/極小化/);
  assert.match(h,/長押しで移動/);
  assert.match(h,/最後は必ず「実績の算数」/);
  assert.match(h,/INSIGHTとは完全に別ツール/);
});
