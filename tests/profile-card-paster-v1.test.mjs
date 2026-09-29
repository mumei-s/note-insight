import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=p=>readFile(new URL(p,root),"utf8");

test("profile paste tool is editor-only and INSIGHT-independent",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/@match\s+https:\/\/editor\.note\.com\/\*/);
  assert.doesNotMatch(s,/@match\s+https:\/\/note\.com\/\*/);
  assert.doesNotMatch(s,/INSIGHT|mumei_insight|current_user/);
});

test("supports likes source, magazine source, and independent counts",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/\/api\/v3\/notes\/.*\/likes\?page=/);
  assert.match(s,/\/api\/v1\/magazines\/.*\/notes\?start=/);
  assert.match(s,/data-likes-count/);
  assert.match(s,/data-mag-count/);
});

test("supports oldest, fixed-fallback-latest, and latest article choice",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/data-choice="oldest"/);
  assert.match(s,/data-choice="fixed"/);
  assert.match(s,/data-choice="latest"/);
  assert.match(s,/disabled_pinned=/);
  assert.match(s,/固定→最新/);
});

test("generated paste includes icon, caption, thumbnail, and URL link",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/actorImageUrl/);
  assert.match(s,/thumbUrl/);
  assert.match(s,/row\.creator\+'さん'/);
  assert.match(s,/link:row\.url/);
  assert.match(s,/ctx\.drawImage/);
});

test("dedupes duplicate article URLs and pastes through note native image command",async()=>{
  const s=await read("public/note-profile-card-paster-v1.user.js");
  assert.match(s,/seen\.has\(u\)/);
  assert.match(s,/CwN/);
  assert.match(s,/DataTransfer/);
  assert.match(s,/waitNewNoteImage/);
});

test("installer describes combined workflow",async()=>{
  const h=await read("public/note-profile-card-paster-install.html");
  assert.match(h,/記事URL → スキした人/);
  assert.match(h,/マガジンURL → 掲載記事/);
  assert.match(h,/丸アイコン/);
  assert.match(h,/〇〇さん/);
  assert.match(h,/INSIGHTとは完全に別ツール/);
});
