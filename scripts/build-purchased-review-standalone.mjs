import {readFileSync,writeFileSync} from 'node:fs';

const version='2.8.1';
const editor=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
const core=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');
function section(source,from,to){
 const start=source.indexOf(from),end=source.indexOf(to,start);
 if(start<0||end<=start)throw Error('Missing helper: '+from);
 return source.slice(start,end);
}
const helpers=[
 section(editor,'function createStoredState(','const runStore='),
 section(editor,"async function xhr(url,","async function xhrJSON("),
 section(editor,'function abortRequests(','function contentList(').replace(' assertCreatorAllowed(row);\n',''),
 section(editor,'async function bitmapFromUrl(','function rounded('),
 section(editor,'function galleryAssetUrl(','async function makeFile(').replaceAll('galleryAssetUrl','purchaseAssetUrl'),
 section(editor,'function completedImagePrefix(','async function buildRows('),
 section(editor,'function dividerType(','function clearCurrentPaste('),
 section(editor,'function recordImage(','function deleteHits('),
 section(editor,'function assertGalleryTracking(','function reconcileGalleryHeadings(').replaceAll('assertGalleryTracking','assertPurchaseTracking'),
 section(core,'function nativeDraftSaveButton(','function resolveOwnedCardHits(').replace('await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();','await flushRunBackup();'),
 section(editor,"const PURCHASE_REVIEW_FORMAT=",'function patchPurchasedReviewPanel(')
  .replaceAll('galleryAssetUrl','purchaseAssetUrl').replaceAll('assertGalleryTracking','assertPurchaseTracking')
  .replace('likesHistoryFix230:true,','').replaceAll('page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__?.(','saveOnce(')
  .replace("saved?.confirmed?'", "(saved===true||saved?.confirmed)?'")
].join('\n');
const runtime=readFileSync('public/note-profile-card-paster-purchase-runtime.js','utf8');
const marker='// INCLUDED PURCHASE HELPERS';
if(!runtime.includes(marker))throw Error('Missing purchase helper marker');
const body=runtime.replace("const VERSION='2.8.1';",`const VERSION='${version}';`).replace(marker,helpers);
const path='public/note-profile-card-paster-purchased.user.js';
const metadata=`// ==UserScript==\n// @name         無名S note 購入記事紹介\n// @namespace    https://github.com/mumei-s/note-insight/purchased-review\n// @version      ${version}\n// @description  購入記事紹介専用。小さめの通常サムネ・無料部分の要約紹介・記事リンク。\n// @match        https://editor.note.com/*\n// @noframes\n// @run-at       document-idle\n// @grant        GM_xmlhttpRequest\n// @grant        GM_setValue\n// @grant        GM_getValue\n// @grant        unsafeWindow\n// @connect      assets.st-note.com\n// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/${path}\n// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/${path}\n// ==/UserScript==\n\n`;
writeFileSync(path,metadata+body);
console.log('Built purchase-only tool '+version+' ('+Buffer.byteLength(metadata+body)+' bytes)');
