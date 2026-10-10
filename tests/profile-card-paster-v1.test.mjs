import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=p=>readFile(new URL(p,root),"utf8");

test("v1.7.1 is editor-only and direct-updated",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 const h=await read("public/note-profile-card-paster-install.html");
 assert.match(s,/@version\s+1\.7\.1/);
 assert.match(s,/@match\s+https:\/\/editor\.note\.com\/\*/);
 assert.doesNotMatch(s,/@match\s+https:\/\/note\.com\/\*/);
 assert.match(h,/v=1\.7\.1/);
 assert.match(h,/location\.replace/);
});

test("first-note flow keeps strict one-public-note verification",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/FIRST_TAGS=\['はじめてのnote','初めてのnote'\]/);
 const block=s.match(/async function collectFirstNoteSpecial[\s\S]*?\n\}/)?.[0]||"";
 assert.match(block,/creatorSinglePublicArticle\(chosenRow\)/);
 assert.match(block,/specialBlockedReason\(text\)/);
});

test("workmom flow keeps relevance and moderation without single-note restriction",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 const block=s.match(/async function collectWorkmom[\s\S]*?(?=async function collectFirstNoteSpecial)/)?.[0]||"";
 assert.match(s,/WORKMOM_TAG='ワーママ'/);
 assert.match(block,/workmomArticleAudit/);
 assert.doesNotMatch(block,/creatorSinglePublicArticle/);
 assert.match(s,/specialBlockedReason\(text\)/);
});

test("parenting diary flow verifies exact tag, parenting context, and moderation",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/PARENTING_TAG='育児日記'/);
 assert.match(s,/function exactParentingTag/);
 assert.match(s,/async function parentingArticleAudit/);
 assert.match(s,/PARENTING_CONTEXT\.explicit/);
 assert.match(s,/PARENTING_CONTEXT\.family/);
 assert.match(s,/specialBlockedReason\(text\)/);
 const block=s.match(/async function collectParenting[\s\S]*?(?=async function collectFirstNoteSpecial)/)?.[0]||"";
 assert.match(block,/sort=new/);
 assert.doesNotMatch(block,/creatorSinglePublicArticle/);
 assert.match(s,/<summary>＋ 案件：#育児日記<\/summary>/);
});

test("moderation excludes risky categories but does not block benign side-hustle by keyword",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 const ng=s.match(/const SPECIAL_NG=\[[\s\S]*?\n\];/)?.[0]||"";
 for(const label of ["ポルノ","ギャンブル","暴力","投資","その他NG"]) assert.match(ng,new RegExp("label:'"+label+"'"));
 assert.doesNotMatch(ng,/副業/);
});

test("random thin design has eight themes and does not render sequence numbers",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 const fn=s.match(/function randomThinTheme[\s\S]*?\n\}/)?.[0]||"";
 assert.equal((fn.match(/\{bg:/g)||[]).length,8);
 assert.match(s,/function drawThinDecor/);
 assert.doesNotMatch(s,/fillText\([^\n]*row\.index/);
 assert.match(s,/mumei_profile_note_v17_/);
});

test("all paste flows use approximately 1.35x faster shared timing",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/const SPEED_FACTOR=1\.35/);
 assert.match(s,/IMAGE_PASTE_GAP=Math\.round\(1200\/SPEED_FACTOR\)/);
 assert.match(s,/CARD_GAP_FAST=Math\.round\(5000\/SPEED_FACTOR\)/);
 assert.match(s,/CARD_GAP_SLOW=Math\.round\(10000\/SPEED_FACTOR\)/);
 assert.match(s,/CARD_BLOCK_PAUSE=Math\.round\(30000\/SPEED_FACTOR\)/);
 assert.match(s,/await sleep\(IMAGE_PASTE_GAP\)/);
});

test("panel footprint is substantially reduced and remains scrollable",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/width:min\(132px/);
 assert.match(s,/max-height:34vh/);
 assert.match(s,/overflow:auto/);
 assert.match(s,/PANEL\+'-mini'/);
});


test("first-note second round restores exclusions from the supplied previous published article",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/SPECIAL_RECOVERY_URLS=\['https:\/\/note\.com\/ss_yr\/n\/n1b6e30eb9e41'\]/);
 assert.match(s,/async function recoverSpecialExclusionsFromPublishedArticles/);
 assert.match(s,/extractNoteKeysFromRecovery/);
 const block=s.match(/async function collectFirstNoteSpecial[\s\S]*?\n\}/)?.[0]||"";
 assert.match(block,/recoverSpecialExclusionsFromPublishedArticles\(\)/);
 assert.match(block,/excluded\.keys\.has\(noteKey\(u\)\)/);
});

test("successful first-note image run automatically commits exclusions for the next round",async()=>{
 const s=await read("public/note-profile-card-paster-v1.user.js");
 assert.match(s,/commitSpecialLast\(\{silent:true\}\)/);
 assert.match(s,/次回重複除外へ自動登録/);
});
