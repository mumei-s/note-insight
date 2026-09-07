(function(){
'use strict';
if(location.hostname!=='note.com')return;
const RAIL='mumei-v2922-rail';
const EVT='mumei-insight-manual-read-v2923';
function normalizeHealth(){const rail=document.getElementById(RAIL);if(!rail)return;rail.dataset.version='2.9.23';const read=rail.querySelector('.read');if(read&&!read.dataset.v2923){read.dataset.v2923='1';read.onclick=()=>window.dispatchEvent(new Event(EVT))}const h=rail.querySelector('.health');if(!h)return;const map=[['PAIR_REQUIRED','本人連携が必要です（設定→本人通知・統計）'],['INGEST_TOKEN_INVALID','本人連携の再確認が必要です'],['INGEST_TOKEN_REQUIRED','本人連携が必要です'],['NOTE_LOGIN_REQUIRED','noteのログイン状態を確認してください'],['NO_GM_REQUEST','Tampermonkeyの実行許可を確認してください'],['USERSCRIPT_REQUEST_UNAVAILABLE','Tampermonkeyの実行許可を確認してください'],['NETWORK_ERROR','通信エラー・自動再試行'],['TIMEOUT','通信タイムアウト・自動再試行']];let text=h.textContent||'';for(const [a,b] of map)text=text.replaceAll(a,b);if(h.textContent!==text)h.textContent=text}
const ob=new MutationObserver(normalizeHealth);if(document.body)ob.observe(document.body,{childList:true,subtree:true,characterData:true});
setInterval(normalizeHealth,700);normalizeHealth();
})();
