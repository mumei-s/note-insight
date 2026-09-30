import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=p=>readFile(new URL(p,root),"utf8");

test("profile paste tool v1.3 is editor-only and INSIGHT-independent",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/@version\s+1\.3\.0/);
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

test("introduced image carries visible creator caption and article link",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/function relinkCaption/);
  assert.match(s,/const caption=row\.creator\+'さん'/);
  assert.match(s,/node\.type\.create\(\{\.\.\.node\.attrs,link:row\.url\},view\.state\.schema\.text\(caption\)/);
  assert.match(s,/after\.node\.textContent/);
  assert.match(s,/row\.creator\+'さん'/);
  assert.match(s,/ctx\.drawImage/);
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
  assert.match(s,/正規通知カード作成/);
});

test("each row does image first then native notification card",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  const run=s.match(/async function run\(\)[\s\S]*?finally\{busy=false;update\(\)\}/)?.[0]||"";
  assert.ok(run.indexOf("uploadOne")>=0);
  assert.ok(run.indexOf("createNativeCard")>run.indexOf("uploadOne"));
  assert.match(run,/recordImage/);
});

test("v1.2 images are reused and caption repaired instead of duplicated",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/const old=readRun\(\)\|\|\{\}/);
  assert.match(s,/const row=rows\[i\],runNow=readRun\(\)\|\|\{\},rec=/);
  assert.match(s,/既存画像へ名前キャプション修復/);
  assert.match(s,/imageHit=relinkCaption/);
});

test("bulk delete removes only native notification cards and keeps images",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/async function deleteNotificationCards/);
  assert.match(s,/resolveOwnedCardHits/);
  assert.match(s,/紹介画像は残します/);
  assert.match(s,/正規通知カード一括削除/);
  const fn=s.match(/async function deleteNotificationCards[\s\S]*?return removed\n\}/)?.[0]||"";
  assert.doesNotMatch(fn,/resolveOwnedImageHits/);
});

test("reset removes generated images and notification cards together",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/async function deleteAllGenerated/);
  assert.match(s,/const cards=resolveOwnedCardHits\(view\),images=resolveOwnedImageHits\(view\)/);
  assert.match(s,/deleteHits\(view,\[\.\.\.cards,\.\.\.images\]\)/);
  assert.match(s,/async function resetAll/);
  assert.match(s,/今回作った紹介画像＋正規通知カード/);
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

test("installer clearly distinguishes image link and native notification card",async()=>{
  const h=await read("public/note-profile-card-paster-install.html");
  assert.match(h,/v1\.3\.0/);
  assert.match(h,/画像リンクと通知カードは別物です/);
  assert.match(h,/名前キャプション＋記事リンク/);
  assert.match(h,/note正規通知カード/);
  assert.match(h,/正規通知カード一括削除/);
  assert.match(h,/紹介画像は残します/);
  assert.match(h,/最初に戻る/);
});
