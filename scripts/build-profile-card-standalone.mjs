import {readFileSync,writeFileSync} from 'node:fs';

const version='2.6.0';
let core=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');
let editor=readFileSync('public/note-profile-card-paster-v22.user.js','utf8').replace(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/,'');
// Keep the original source modules for existing verification. The distributed
// tool is self-contained and does not execute those files as @require scripts.
core=core.replace(/^const INSIGHT_BRIDGE_KEY=.*\n/m,'').replace(/^const LIKE300_PREP_PREFIX=.*\n/m,'').replace(/^const like300PrepKey=.*\n/m,'');
core=core.slice(0,core.indexOf('async function prepareInsightLikePerson('))+core.slice(core.indexOf('async function bitmapFromUrl(',core.indexOf('async function prepareInsightLikePerson(')));
core=core.slice(0,core.indexOf('async function createInsightLikes300('))+core.slice(core.indexOf('async function pasteSavedSpecial(',core.indexOf('async function createInsightLikes300(')));
core=core.replaceAll("const VERSION='2.5.8'",`const VERSION='${version}'`);
editor=editor.replaceAll("const VERSION='2.5.8'",`const VERSION='${version}'`).replaceAll('V258','V260').replaceAll('prepareInsightExport','prepareLikesHistoryExport').replace("title.textContent='紹介貼付 v'+VERSION","title.textContent='極薄サム v'+VERSION");

const body=`(function(){\n'use strict';\nconst owner=typeof unsafeWindow!=='undefined'?unsafeWindow:window;\nif(location.hostname!=='editor.note.com')return;\nif(owner.__MUMEI_PROFILE_CARD_STANDALONE_VERSION__==='${version}')return;\nowner.__MUMEI_PROFILE_CARD_STANDALONE_VERSION__='${version}';\n// BEGIN INCLUDED EDITOR CORE\n${core}\n// BEGIN INCLUDED PROFILE IMPLEMENTATION\n${editor}\n})();\n`;
function metadata(name,namespace,path){return `// ==UserScript==\n// @name         ${name}\n// @namespace    ${namespace}\n// @version      ${version}\n// @description  極薄サムネイル単独版。INSIGHTからスキ履歴だけ読み取り、編集画面でプロフィール・画像・カードを作成。\n// @match        https://editor.note.com/*\n// @noframes\n// @run-at       document-idle\n// @grant        GM_xmlhttpRequest\n// @grant        GM_setValue\n// @grant        GM_getValue\n// @grant        unsafeWindow\n// @connect      note.com\n// @connect      assets.st-note.com\n// @connect      *\n// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/${path}\n// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/${path}\n// ==/UserScript==\n\n`;}
const original='public/note-profile-card-paster-v1.user.js';
const legacy='public/note-profile-card-likes300-fix-v220.user.js';
writeFileSync(original,metadata('無名S note アイコン＋キャプション 貼り付け装置','https://github.com/mumei-s/note-insight/profile-card-paster',original).replace('// @namespace','// @name:ja      無名S note 極薄サムネイル\n// @namespace')+body);
// Preserve the installed identity and its GM progress. Changing @name or
// @namespace would install a new script and strand private saved checkpoints.
writeFileSync(legacy,metadata('無名S note INSIGHTスキ300 修正版','https://github.com/mumei-s/note-insight/likes300-fix',legacy).replace('// @namespace','// @name:ja      無名S note 極薄サムネイル（スキ履歴）\n// @namespace')+body);
