import {readFileSync,writeFileSync} from 'node:fs';
import {instrumentCore,instrumentEditor} from './profile-card-quality-instrument.mjs';
import {transformCoreGeneral,transformEditorGeneral} from './profile-card-general-v292.mjs';
import {transformCoreDesign,transformEditorDesign} from './profile-card-design-v292.mjs';
import {transformCoreSpeed,transformEditorSpeed} from './profile-card-speed-v292.mjs';
import {contentRuntime,transformCoreContent,transformEditorContent} from './profile-card-content-v292.mjs';

const version='2.9.2';
let core=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');
let editor=readFileSync('public/note-profile-card-paster-v22.user.js','utf8').replace(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/,'');
const gallery=readFileSync('public/note-profile-card-gallery-v263.js','utf8');
const quality=readFileSync('public/note-profile-card-paster-quality-v290.js','utf8');
const manifest=JSON.parse(readFileSync('public/note-profile-card-halloween126.json','utf8'));
if(manifest.people.length!==126||new Set(manifest.people.map(person=>person.urlname.toLowerCase())).size!==126)throw new Error('Gallery manifest must contain exactly126 unique creators');
// Keep the original source modules for existing verification. The distributed
// tool is self-contained and does not execute those files as @require scripts.
core=core.replace(/^const INSIGHT_BRIDGE_KEY=.*\n/m,'').replace(/^const LIKE300_PREP_PREFIX=.*\n/m,'').replace(/^const like300PrepKey=.*\n/m,'');
function removeFlow(code,startMarker,endMarker){
 const start=code.indexOf(startMarker),end=code.indexOf(endMarker,start);
 if(start<0||end<=start)throw new Error('Source markers missing: '+startMarker);
 return code.slice(0,start)+code.slice(end);
}
core=removeFlow(core,'async function prepareInsightLikePerson(','async function bitmapFromUrl(');
core=removeFlow(core,'async function createInsightLikes300(','async function pasteSavedSpecial(');
core=core.replaceAll("const VERSION='2.5.8'",`const VERSION='${version}'`);
core=core.replaceAll('紹介貼付 v','極薄サム v').replaceAll('＋ スキ履歴から300人','＋ スキ履歴から紹介').replaceAll('300人＋実績1件｜50種ランダム','指定件数＋実績1件｜50種ランダム').replaceAll('① スキ300貼付','① スキ履歴から紹介');
editor=editor.replaceAll("const VERSION='2.5.8'",`const VERSION='${version}'`).replaceAll('V258','V280').replaceAll('prepareInsightExport','prepareLikesHistoryExport').replaceAll('紹介貼付 v','極薄サム v');
// Purchase introductions remain in their separate installer; remove them only
// from this general tool. Keep the original extraction source for that builder.
editor=removeFlow(editor,'const PURCHASE_REVIEW_FORMAT=','function bindPanelAction(')
 .replace(' patchPurchasedReviewPanel(panel);\n','')
 .replace('  if(run?.purchasedReview)return pastePurchasedReview();',"  if(run?.purchasedReview){setStatus('この保存分は購入記事紹介の専用版で再開してください',true);return;}");
core=transformCoreContent(core);editor=transformEditorContent(editor);
core=instrumentCore(core);editor=instrumentEditor(editor);
core=transformCoreGeneral(core);editor=transformEditorGeneral(editor);
core=transformCoreDesign(core);editor=transformEditorDesign(editor);
core=transformCoreSpeed(core);editor=transformEditorSpeed(editor);

const body=`(function(){\n'use strict';\nconst owner=typeof unsafeWindow!=='undefined'?unsafeWindow:window;\nif(location.hostname!=='editor.note.com')return;\nif(owner.__MUMEI_PROFILE_CARD_STANDALONE_VERSION__==='${version}')return;\nowner.__MUMEI_PROFILE_CARD_STANDALONE_VERSION__='${version}';\nowner.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__=${JSON.stringify(manifest)};\n${quality}\n${contentRuntime}\n${gallery}\n// BEGIN INCLUDED EDITOR CORE\n${core}\n// BEGIN INCLUDED PROFILE IMPLEMENTATION\n${editor}\n})();\n`;
function metadata(name,namespace,path){return `// ==UserScript==\n// @name         ${name}\n// @namespace    ${namespace}\n// @version      ${version}\n// @description  極薄・中型サムネイル単独版。#・記事のスキ・マガジンを複合指定。名前・プロフィール・無料本文の抜粋、毎回の品質検査と通知カードに対応。\n// @match        https://editor.note.com/*\n// @noframes\n// @run-at       document-idle\n// @grant        GM_xmlhttpRequest\n// @grant        GM_setValue\n// @grant        GM_getValue\n// @grant        unsafeWindow\n// @connect      note.com\n// @connect      assets.st-note.com\n// @connect      *\n// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/${path}\n// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/${path}\n// ==/UserScript==\n\n`;}
const original='public/note-profile-card-paster-v1.user.js';
const legacy='public/note-profile-card-likes300-fix-v220.user.js';
writeFileSync(original,metadata('無名S note 極薄サムネイル','https://github.com/mumei-s/note-insight/profile-card-paster',original)+body);
// Retain each update URL, namespace, and storage keys while changing the
// product name as requested. Both distributions contain the same editor tool.
writeFileSync(legacy,metadata('無名S note 極薄サムネイル','https://github.com/mumei-s/note-insight/likes300-fix',legacy)+body);
