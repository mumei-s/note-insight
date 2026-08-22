// ==UserScript==
// @name         無名S note URL進捗表示 6.2
// @namespace    https://github.com/mumei-s/note-insight/progress-620
// @version      6.2.0
// @description  DIRECT SUCCESS 3.0の隠し進捗をCOMPLETE 6.1の表示欄へミラーする
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
'use strict';
if(window.__MUMEI_PROGRESS_620__)return;
window.__MUMEI_PROGRESS_620__=true;
const SRC='mumei-direct-success-panel';
const DST='mumei-bridge610-panel';
let last='';
function paint(text,bad=false){
 const d=document.getElementById(DST);if(!d)return;
 d.textContent=text;
 d.style.background=bad?'#991b1b':'#111827';
 d.style.display='block';
}
function tick(){
 const s=document.getElementById(SRC),d=document.getElementById(DST);if(!s||!d)return;
 const x=(s.textContent||'').trim();if(!x||x===last||x==='DIRECT SUCCESS 3.0')return;
 last=x;
 let m;
 if(x==='EditorViewを探しています…')return paint('URL準備中…');
 if(x.includes('1枚目だけURL設定テスト'))return paint('URL書き込み 1/10…');
 m=x.match(/DIRECT URL\s+(\d+)\/10/);if(m)return paint(`URL書き込み ${m[1]}/10…`);
 m=x.match(/DIRECT停止\s+(\d+)枚目/);if(m)return paint(`URL ${m[1]}/10 で停止`,true);
 if(x.startsWith('DIRECT停止：'))return paint(`URL 1/10 で停止｜${x.replace('DIRECT停止：','')}`,true);
 m=x.match(/DIRECT完了\s+(\d+)\/10/);if(m)return paint(`URL完了 ${m[1]}/10 ✅`,Number(m[1])!==10);
 if(x.startsWith('DIRECTエラー：'))return paint(`URL処理エラー｜${x.replace('DIRECTエラー：','')}`,true);
}
setInterval(tick,120);
tick();
})();
