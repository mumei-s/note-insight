import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=p=>readFile(new URL(p,root),"utf8");

test("profile paste tool v1.2 is editor-only and INSIGHT-independent",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/@version\s+1\.2\.0/);
  assert.match(s,/@match\s+https:\/\/editor\.note\.com\/\*/);
  assert.doesNotMatch(s,/@match\s+https:\/\/note\.com\/\*/);
  assert.doesNotMatch(s,/mumei_insight|current_user/);
});

test("one unified input auto-detects note, magazine, and hashtag sources",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/function parseUnifiedSources/);
  assert.match(s,/type:'note'/);
  assert.match(s,/type:'mag'/);
  assert.match(s,/type:'tag'/);
  assert.match(s,/data-sources/);
  assert.doesNotMatch(s,/data-likes-sources|data-mag-sources/);
});

test("unified sources preserve top-to-bottom priority and aggregate count/all",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/for\(let si=0;si<sources\.length&&out\.length<limit;si\+\+\)/);
  assert.match(s,/data-mode/);
  assert.match(s,/<option value="all">全数<\/option>/);
  assert.match(s,/function targetLimit/);
  assert.match(s,/mode==='all'\?Infinity/);
});

test("supports oldest fixed-latest latest for article URL likers",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/data-choice="oldest"/);
  assert.match(s,/data-choice="fixed"/);
  assert.match(s,/data-choice="latest"/);
  assert.match(s,/disabled_pinned=/);
  assert.match(s,/固定→最新/);
});

test("image enrichment uses liker article creator and page metadata fallbacks",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/user_profile_image_path/);
  assert.match(s,/profile_image_path/);
  assert.match(s,/creatorProfile/);
  assert.match(s,/articleMetaImage/);
  assert.match(s,/meta\[property="og:image"\]/);
  assert.match(s,/@connect\s+\*/);
});

test("generated card visibly includes icon caption title and thumbnail",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/actorImageUrl/);
  assert.match(s,/thumbUrl/);
  assert.match(s,/row\.creator\+'さん'/);
  assert.match(s,/ctx\.drawImage/);
  assert.match(s,/link:row\.url/);
});

test("paste is fully automatic without plus/image picker",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/CwN/);
  assert.match(s,/DataTransfer/);
  assert.match(s,/ensureEndSelection/);
  assert.match(s,/読み込み→全自動貼付/);
  assert.match(s,/＋操作不要/);
});

test("tracks owned cards for safe bulk delete",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/RUN_PREFIX/);
  assert.match(s,/function recordCreated/);
  assert.match(s,/function resolveOwnedHits/);
  assert.match(s,/function deleteOwnedCards/);
  assert.match(s,/data-a="delete"/);
  assert.match(s,/今回カード一括削除/);
});

test("reset returns workflow to start while preserving original content",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/async function resetAll/);
  assert.match(s,/function resetFields/);
  assert.match(s,/data-a="reset"/);
  assert.match(s,/最初に戻る/);
  assert.match(s,/元本文・元画像は残します/);
});

test("panel remains compact collapsible tiny and long-press movable",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/width:min\(268px/);
  assert.match(s,/\.collapsed \.body\{display:none\}/);
  assert.match(s,/PANEL\+'-mini'/);
  assert.match(s,/function bindLongDrag/);
  assert.match(s,/420\)/);
  assert.match(s,/data-ui="collapse"/);
  assert.match(s,/data-ui="tiny"/);
});

test("performance math article is always appended last",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/FINAL_URL='https:\/\/note\.com\/fuku444\/n\/nb4f6934381e9'/);
  assert.match(s,/rows\.push\(\{[\s\S]*finalMarker:true/);
  assert.match(s,/最後：実績の算数/);
});

test("installer describes unified v1.2 workflow",async()=>{
  const h=await read("public/note-profile-card-paster-install.html");
  assert.match(h,/v1\.2\.0/);
  assert.match(h,/記事URL \/ マガジンURL \/ #タグを1つの欄へ/);
  assert.match(h,/上から優先して合算/);
  assert.match(h,/画像取得を強化/);
  assert.match(h,/今回カード一括削除/);
  assert.match(h,/最初に戻る/);
  assert.match(h,/＋ボタンや「画像」は押しません/);
  assert.match(h,/最後は必ず「実績の算数」/);
});
