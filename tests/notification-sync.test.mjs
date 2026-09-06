import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(name)=>readFile(new URL(`../public/${name}`,import.meta.url),"utf8");
const readRoot=(name)=>readFile(new URL(`../${name}`,import.meta.url),"utf8");
async function sources(){return{boot:await read("note-insight-notification-sync.user.js"),runtime:await read("note-insight-notification-runtime-v298.js"),patch16:await read("note-insight-notification-runtime-v2915-patch.js"),patch17:await read("note-insight-notification-runtime-v2917-patch.js"),setup:await read("notification-import.html"),entry:await read("notification-setup.html"),helper:await read("notification-install.html")}}

test("v2.9.17 bootstrap loads the movable control overlay",async()=>{const{boot}=await sources();assert.match(boot,/@version\s+2\.9\.17/);assert.match(boot,/runtime-v298\.js\?v=2917/);assert.match(boot,/runtime-v2915-patch\.js\?v=2917/);assert.match(boot,/runtime-v2917-patch\.js\?v=2917/);assert.match(boot,/mumei_open_notice_v2917/);assert.match(boot,/mumei_insight_version_check/)});

test("v2.9.17 auto sync tracks saved signatures and rechecks unconfirmed notifications",async()=>{const{patch17}=await sources();for(const x of ["mumei_insight_notification_saved_v2917:","note-notification-continuous-sync-v2917","visible-unconfirmed-v2917","count-change-v2917","heartbeat-v2917","startup-v2917","loadSaved","saveSaved","unconfirmedCount","mumei-v2917-stamp","保完"])assert.match(patch17,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));assert.match(patch17,/setInterval\(\(\)=>void poll\(\),30000\)/);assert.match(patch17,/setInterval\(\(\)=>void sync\(false,'heartbeat-v2917'\),120000\)/)});

test("v2.9.17 notification UI is one movable control plus always-visible INSIGHT",async()=>{const{patch17}=await sources();for(const x of ["mumei-v2917-tool","通知操作","mumei-v2917-ins","INSIGHT","追加読込・保存","フィルターON","フィルターOFF","設定","dragTool","pointerdown","480","mumei_insight_notification_tool_pos_v2917"])assert.match(patch17,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));assert.match(patch17,/#mumei-v2916-dock,#mumei-v2916-settings/);assert.match(patch17,/touch-action:none/);assert.match(patch17,/button:active/)});

test("filter settings accepts creator URL ID or at-ID",async()=>{const{patch17}=await sources();for(const x of ["フィルターグループ作成","クリエイターURL / ID","URL / ID / @ID","creatorId","saveGroups","mumei_insight_magazine_mute_ids_v5:"])assert.match(patch17,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));assert.match(patch17,/s=s\.replace\(\/\^@\//)});

test("self magazine additions and chips are locally classified before save",async()=>{const{patch17}=await sources(),ingest=await readRoot("supabase/functions/insight-notification-ingest-v2/index.ts");assert.match(patch17,/あなたの記事が\.\{0,320\}に追加されました/);for(const x of ["チップ","サポート","支援","応援金","localKind","my_article_magazine_added","return'tip'"])assert.match(patch17,new RegExp(x));assert.match(ingest,/あなたの記事が\.\{0,260\}に追加されました/);assert.match(ingest,/チップ\|サポート/);assert.match(ingest,/支援\|応援金/);assert.match(ingest,/continuous-sync-v\\d\+/)});

test("account identity remains locked to actual note login",async()=>{const{patch17}=await sources(),ingest=await readRoot("supabase/functions/insight-notification-ingest-v2/index.ts");assert.match(patch17,/\/api\/v2\/current_user/);assert.match(patch17,/k\(TOK,a\.id\)/);assert.match(patch17,/noteId:a\.id/);assert.match(ingest,/NOTIFICATION_ACCOUNT_MISMATCH/);assert.match(ingest,/suppliedNoteId!==who\.noteId/)});

test("manual fallback and dashboard automatic ingest remain available",async()=>{const{runtime,patch16}=await sources();for(const x of ["manualCurrent","manualSweep","読込→INSIGHT自動保存完了","過去読込→INSIGHT自動保存完了","note-dashboard-auto-v298","saveDashboardAuto","mumei_insight_notification_groups_v1:","mumei_insight_magazine_filter_enabled_v3:"])assert.match(runtime+patch16,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));assert.match(runtime,/startsWith\('\/sitesettings\/stats'\)/)});

test("pairing still returns only to INSIGHT after verification",async()=>{const{runtime}=await sources();assert.match(runtime,/function insightReturn/);assert.match(runtime,/u\.origin==='https:\/\/mumei-s\.github\.io'/);assert.match(runtime,/u\.pathname\.startsWith\('\/note-insight\/'\)/);assert.match(runtime,/mumei_return/);assert.match(runtime,/location\.replace\(back\)/)});

test("installer and setup pages expose v2.9.17 everywhere",async()=>{const{boot,setup,entry,helper}=await sources();for(const src of [setup,entry,helper])assert.match(src,/2\.9\.17/);assert.match(setup,/VERSION='2\.9\.17'/);assert.match(entry,/v=2917/);assert.match(helper,/TAMPERMONKEY INSTALL/);assert.match(helper,/このブラウザで v2\.9\.17/);assert.match(helper,/mumei_insight_version_check=1/);assert.match(boot,/notificationInstalled/)});

test("raw update URLs and modern plus legacy GM APIs remain available",async()=>{const{boot,runtime,patch16,patch17}=await sources();assert.match(boot,/@updateURL\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-sync\.user\.js/);for(const x of ["GM.xmlHttpRequest","GM.getValue","GM.setValue","GM_xmlhttpRequest","GM_getValue","GM_setValue"])assert.match(boot+runtime+patch16+patch17,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))});
