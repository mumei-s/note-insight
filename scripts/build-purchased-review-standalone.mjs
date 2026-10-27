import {readFileSync,writeFileSync} from 'node:fs';

const version='2.8.2';
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
 section(core,'function noteUrlCommandFactory(','function embedNodes('),
 section(core,'function cardUrl(','function parseLiker(').replace(' assertCreatorAllowed(row);\n','').replaceAll('await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();','await flushRunBackup();'),
 section(core,'function resolveOwnedCardHits(','async function auditGeneratedDuplicates('),
 section(core,'function deleteVerifiedNotificationCardHits(','async function deleteNotificationCards('),
 section(core,'async function saveCompletedCards(','async function createCardsAtTap(').replaceAll('await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();','await flushRunBackup();'),
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
  .replace(",'image/png'));",",'image/jpeg',0.95));")
  .replace("row.key+'.png',{type:'image/png'}", "row.key+'.jpg',{type:'image/jpeg'}")
  .replace('recordImage(made.hit,row);insertPos=addDivider(view,made.hit,row);await flushRunBackup();','recordImage(made.hit,row);insertPos=addDivider(view,made.hit,row);await flushRunBackup();\n   await sleep(IMAGE_GAP);')
  .replace('busy=true;stopRequested=false;pauseRequested=false;notifyFixedState();',"busy=true;activePhase='images';stopRequested=false;pauseRequested=false;notifyFixedState();")
  .replace('finally{busy=false;notifyFixedState();await releaseAwake()}',"finally{busy=false;activePhase='';notifyFixedState();await releaseAwake()}")
].join('\n');
const runtime=readFileSync('public/note-profile-card-paster-purchase-runtime.js','utf8');
const marker='// INCLUDED PURCHASE HELPERS';
if(!runtime.includes(marker))throw Error('Missing purchase helper marker');
const imagePacing=editor.match(/^const IMAGE_GAP=\d+;$/m)?.[0];
const cardPacing=core.match(/^const CARD_GAP_FAST=\d+;$/m)?.[0];
const blockPacing=core.match(/^const CARD_BLOCK_PAUSE=\d+;$/m)?.[0];
if(!imagePacing||!cardPacing||!blockPacing)throw Error('The existing thin-thumbnail pacing could not be verified');
const body=runtime.replace("const VERSION='2.8.2';",`const VERSION='${version}';`).replace('// INCLUDED PURCHASE PACING',[imagePacing,cardPacing,blockPacing].join('\n')).replace(marker,helpers);
const path='public/note-profile-card-paster-purchased.user.js';
const metadata=`// ==UserScript==\n// @name         無名S note 購入記事紹介\n// @namespace    https://github.com/mumei-s/note-insight/purchased-review\n// @version      ${version}\n// @description  購入記事紹介専用。小さめの通常サムネ・無料部分の要約紹介・記事リンク。\n// @match        https://editor.note.com/*\n// @noframes\n// @run-at       document-idle\n// @grant        GM_xmlhttpRequest\n// @grant        GM_setValue\n// @grant        GM_getValue\n// @grant        unsafeWindow\n// @connect      assets.st-note.com\n// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/${path}\n// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/${path}\n// ==/UserScript==\n\n`;
writeFileSync(path,metadata+body);
console.log('Built purchase-only tool '+version+' ('+Buffer.byteLength(metadata+body)+' bytes)');
