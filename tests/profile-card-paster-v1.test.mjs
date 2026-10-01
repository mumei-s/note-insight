import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=p=>readFile(new URL(p,root),"utf8");

test("v1.5 is editor-only and INSIGHT-independent",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/@version\s+1\.5\.0/);
 assert.match(s,/@match\s+https:\/\/editor\.note\.com\/\*/);
 assert.doesNotMatch(s,/@match\s+https:\/\/note\.com\/\*/);
 assert.doesNotMatch(s,/mumei_insight|current_user/);
});

test("normal source input remains unified and ordered",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/function parseUnifiedSources/);
 assert.match(s,/type:'note'/);
 assert.match(s,/type:'mag'/);
 assert.match(s,/type:'tag'/);
 assert.match(s,/for\(let si=0;si<sources\.length&&out\.length<limit;si\+\+\)/);
});

test("special workflow uses exactly both first-note tags",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/FIRST_TAGS=\['はじめてのnote','初めてのnote'\]/);
 assert.match(s,/collectFirstNoteSpecial/);
 assert.match(s,/sort=new/);
});

test("special workflow verifies creator has exactly one public article",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/async function creatorSinglePublicArticle/);
 assert.match(s,/total!==1/);
 assert.match(s,/contentList\(p2\)\.length/);
 assert.match(s,/noteKey\(only\.url\)===noteKey\(row\.url\)/);
});

test("special workflow rejects prohibited article categories but does not ban side jobs alone",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/label:'ポルノ'/);
 assert.match(s,/label:'ギャンブル'/);
 assert.match(s,/label:'暴力'/);
 assert.match(s,/label:'投資'/);
 assert.match(s,/label:'その他NG'/);
 assert.doesNotMatch(s,/副業\|/);
 assert.doesNotMatch(s,/\|副業/);
 assert.match(s,/specialArticleText/);
 assert.match(s,/specialBlockedReason/);
});

test("special exclusions only become active after explicit success button",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/SPECIAL_LAST/);
 assert.match(s,/SPECIAL_EXCLUDED/);
 assert.match(s,/function saveSpecialLast/);
 assert.match(s,/function commitSpecialLast/);
 assert.match(s,/data-a="commit-excluded"/);
 assert.match(s,/前回成功→除外/);
 const imageFn=s.match(/async function createImageList[\s\S]*?finally\{busy=false;update\(\)\}/)?.[0]||"";
 assert.match(imageFn,/saveSpecialLast\(rows\)/);
 assert.doesNotMatch(imageFn,/writeJSONKey\(SPECIAL_EXCLUDED/);
});

test("performance math is outside requested count and appended as plus one",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 const build=s.match(/async function buildRows[\s\S]*?return out\.map[\s\S]*?\n\}/)?.[0]||"";
 assert.match(build,/collectFirstNoteSpecial\(input\.mode,input\.count\)/);
 assert.match(build,/collectUnified\(input\.sources,input\.mode,input\.count,input\.choice\)/);
 assert.match(build,/rows\.push\(\{/);
 assert.match(build,/finalMarker:true/);
 assert.match(s,/指定件数は実績の算数を含まない/);
});

test("image list is automatic but native cards start from current tapped selection",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/async function createImageList/);
 assert.match(s,/async function createCardsAtTap/);
 assert.match(s,/function cardAnchorFromSelection/);
 assert.match(s,/let insertPos=cardAnchorFromSelection\(view\)/);
 assert.match(s,/createNativeCard\(view,row,insertPos\)/);
 assert.match(s,/insertPos=made\.nextPos/);
 assert.match(s,/data-a="cards"/);
 assert.match(s,/②ここからカード/);
});

test("images and native cards remain separate phases",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 const images=s.match(/async function createImageList[\s\S]*?finally\{busy=false;update\(\)\}/)?.[0]||"";
 const cards=s.match(/async function createCardsAtTap[\s\S]*?finally\{busy=false;update\(\)\}/)?.[0]||"";
 assert.match(images,/uploadOne/);
 assert.doesNotMatch(images,/createNativeCard/);
 assert.match(cards,/createNativeCard/);
 assert.doesNotMatch(cards,/makeFile/);
});

test("panel is substantially smaller and special workflow is collapsed inside details",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/width:min\(228px/);
 assert.match(s,/max-height:48vh/);
 assert.match(s,/<details data-special>/);
 assert.match(s,/<summary>＋ 特別案件：初投稿者<\/summary>/);
 assert.match(s,/PANEL\+'-mini'/);
 assert.match(s,/function bindLongDrag/);
});

test("post cleanup semantics stay safe",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/async function deleteNotificationCards/);
 assert.match(s,/紹介画像は残します/);
 assert.match(s,/async function deleteAllGenerated/);
 assert.match(s,/deleteHits\(view,\[\.\.\.cards,\.\.\.images\]\)/);
});

test("installer documents exact v1.5 behavior",async()=>{
 const h=await read("public/note-profile-card-paster-install.html");
 assert.match(h,/v1\.5\.0/);
 assert.match(h,/#はじめてのnote \/ #初めてのnote/);
 assert.match(h,/公開記事が1件だけ/);
 assert.match(h,/前回成功→除外/);
 assert.match(h,/実績の算数.*件数に含めず最後に\+1件/);
 assert.match(h,/本文で通知カードを置きたい場所をタップ/);
 assert.match(h,/パネルはさらに小型化/);
});
