import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=p=>readFile(new URL(p,root),"utf8");

test("profile paste tool v1.4 is editor-only and INSIGHT-independent",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/@version\s+1\.4\.0/);
  assert.match(s,/@match\s+https:\/\/editor\.note\.com\/\*/);
  assert.doesNotMatch(s,/@match\s+https:\/\/note\.com\/\*/);
  assert.doesNotMatch(s,/mumei_insight|current_user/);
});

test("one unified input auto-detects note magazine and hashtag sources",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/function parseUnifiedSources/);
  assert.match(s,/type:'note'/);
  assert.match(s,/type:'mag'/);
  assert.match(s,/type:'tag'/);
  assert.match(s,/data-sources/);
});

test("source order and numeric or all mode are preserved",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/for\(let si=0;si<sources\.length&&out\.length<limit;si\+\+\)/);
  assert.match(s,/<option value="all">全数<\/option>/);
  assert.match(s,/mode==='all'\?Infinity/);
});

test("image data uses creator and article metadata fallbacks",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/user_profile_image_path/);
  assert.match(s,/profile_image_path/);
  assert.match(s,/creatorProfile/);
  assert.match(s,/articleMetaImage/);
  assert.match(s,/meta\[property="og:image"\]/);
  assert.match(s,/@connect\s+\*/);
});

test("introduced image carries note caption and article link",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/function relinkCaption/);
  assert.match(s,/const caption=row\.creator\+'さん'/);
  assert.match(s,/node\.type\.create\(\{\.\.\.node\.attrs,link:row\.url\},view\.state\.schema\.text\(caption\)/);
  assert.match(s,/after\.node\.textContent/);
});

test("native notification card is a separate note embed",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/function noteUrlCommandFactory/);
  assert.match(s,/\.fjT/);
  assert.match(s,/function embedNodes/);
  assert.match(s,/embeddedContentKey/);
  assert.match(s,/htmlForEmbed/);
  assert.match(s,/note-embed/);
  assert.match(s,/async function createNativeCard/);
});

test("run is fresh every time and never adopts previous progress",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  const run=s.match(/async function run\(\)[\s\S]*?finally\{busy=false;update\(\)\}/)?.[0]||"";
  assert.match(run,/毎回ここから新規セッション/);
  assert.match(run,/items:\[\],cardKeys:\[\]/);
  assert.match(run,/前回作成分が残っています/);
  assert.doesNotMatch(run,/既存画像へ名前キャプション修復/);
  assert.doesNotMatch(run,/runNow=readRun/);
});

test("all images are created before any native notification card",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  const run=s.match(/async function run\(\)[\s\S]*?finally\{busy=false;update\(\)\}/)?.[0]||"";
  const imagePhase=run.indexOf("// Phase 1:");
  const cardPhase=run.indexOf("// Phase 2:");
  const uploadPos=run.indexOf("uploadOne");
  const nativePos=run.indexOf("createNativeCard");
  assert.ok(imagePhase>=0);
  assert.ok(cardPhase>imagePhase);
  assert.ok(uploadPos>imagePhase && uploadPos<cardPhase);
  assert.ok(nativePos>cardPhase);
  assert.match(run,/① 画像🔗＋名前キャプション/);
  assert.match(run,/② 正規通知カード/);
});

test("bulk delete removes only native notification cards and keeps image list",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/async function deleteNotificationCards/);
  assert.match(s,/resolveOwnedCardHits/);
  assert.match(s,/紹介画像は残します/);
  assert.match(s,/正規通知カード一括削除/);
  const fn=s.match(/async function deleteNotificationCards[\s\S]*?return removed\n\}/)?.[0]||"";
  assert.doesNotMatch(fn,/resolveOwnedImageHits/);
});

test("reset removes current image list and notification-card list together",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/async function deleteAllGenerated/);
  assert.match(s,/const cards=resolveOwnedCardHits\(view\),images=resolveOwnedImageHits\(view\)/);
  assert.match(s,/deleteHits\(view,\[\.\.\.cards,\.\.\.images\]\)/);
  assert.match(s,/async function resetAll/);
});

test("panel is compact movable collapsible and Android count input is focusable",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/width:min\(268px/);
  assert.match(s,/\.collapsed \.body\{display:none\}/);
  assert.match(s,/PANEL\+'-mini'/);
  assert.match(s,/function bindLongDrag/);
  assert.match(s,/data-count type="text" inputmode="numeric"/);
  assert.match(s,/pointerdown',e=>\{e\.stopPropagation\(\)\}/);
});

test("performance math remains final",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/FINAL_URL='https:\/\/note\.com\/fuku444\/n\/nb4f6934381e9'/);
  assert.match(s,/rows\.push\(\{[\s\S]*finalMarker:true/);
  assert.match(s,/最後：実績の算数/);
});

test("installer documents fresh image-list then card-list workflow",async()=>{
  const h=await read("public/note-profile-card-paster-install.html");
  assert.match(h,/v1\.4\.0/);
  assert.match(h,/今回の入力から新規開始/);
  assert.match(h,/① 画像🔗＋名前キャプションを全件まとめて作成/);
  assert.match(h,/② その後ろにnote正規通知カードを全件まとめて作成/);
  assert.match(h,/交互には並べません/);
  assert.match(h,/正規通知カード一括削除/);
  assert.match(h,/最初に戻る/);
});
