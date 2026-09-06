import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read=name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8');

test('notification open starts resumable autosave immediately',async()=>{const s=await read('note-insight-notification-runtime-v2917-resume-hotfix.js');for(const x of ['notification-open-v2917c','mumei_insight_notification_anchor_v2917c:','保存中…閉じないでください','保存未完了・次回ここから再開','保存完✓'])assert.match(s,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.match(s,/if\(!panelOpen\).*sync\(\{deep:false/)});

test('saved marker uses dataset pseudo element and never contaminates notification text',async()=>{const s=await read('note-insight-notification-runtime-v2917-resume-hotfix.js');assert.match(s,/dataset\.mumeiSaved/);assert.match(s,/content:'保完'/);assert.match(s,/itemText/);assert.match(s,/mumei-v2917-stamp/);assert.doesNotMatch(s,/append\(s\).*保完/)});

test('manual additional read preserves position and scans deeply',async()=>{const s=await read('note-insight-notification-runtime-v2917-resume-hotfix.js');assert.match(s,/manual-additional-v2917c/);assert.match(s,/deep:true/);assert.match(s,/const s=await saved\(a\.id\),oldAnchor/);assert.match(s,/ctx\.set\(start\)/)});

test('chip receiver wording and self magazine additions are classified',async()=>{const s=await read('note-insight-notification-runtime-v2917-resume-hotfix.js');for(const x of ['さんから','チップ','届きました','受け取りました','my_article_magazine_added'])assert.match(s,new RegExp(x));});

test('UI stays in notification margin and settings cannot overflow viewport',async()=>{const s=await read('note-insight-notification-runtime-v2917-resume-hotfix.js');assert.match(s,/#mumei-v2917c-rail\{position:sticky/);assert.match(s,/height:29px/);assert.match(s,/left:8px!important;right:8px!important/);assert.match(s,/通知操作/);assert.match(s,/INSIGHT/)});

test('iOS helper hands raw userscript to Tampermonkey installation page',async()=>{const s=await read('notification-install.html');assert.match(s,/script_installation\.php#url=/);assert.match(s,/isIOS&&isSafari/);assert.match(s,/SafariでTampermonkeyへ渡してインストール/)});
