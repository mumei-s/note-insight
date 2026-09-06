(function(){
'use strict';
if(!/(^|\.)note\.com$/.test(location.hostname))return;
const SEL='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i],li[role="listitem"],article';
let restoring=null,timer=0;
function style(){if(document.getElementById('mumei-v2918-safe-style'))return;const s=document.createElement('style');s.id='mumei-v2918-safe-style';s.textContent=`
.mumei-v2918-stamp{font-size:0!important;line-height:1!important;min-width:24px!important;text-align:center!important}
.mumei-v2918-stamp::after{content:'保完';font:950 7px/1.35 system-ui!important;color:#bfffd1!important}
#mumei-v2918-settings{left:max(8px,env(safe-area-inset-left,0px))!important;right:max(8px,env(safe-area-inset-right,0px))!important;bottom:calc(72px + env(safe-area-inset-bottom,0px))!important;top:auto!important;transform:none!important;width:auto!important;max-width:none!important;max-height:58vh!important;overflow:auto!important;box-sizing:border-box!important}
#mumei-v2918-mainrail{max-width:100vw!important;overflow:hidden!important;box-sizing:border-box!important}
@media(max-width:390px){#mumei-v2918-mainrail{height:28px!important;padding:1px 2px!important;grid-template-columns:minmax(66px,1.15fr) minmax(61px,1fr) 38px 53px!important;gap:2px!important}#mumei-v2918-mainrail button{height:24px!important;font-size:7.5px!important;padding:0 2px!important}}
`;document.documentElement.append(s)}
function sanitize(){for(const x of document.querySelectorAll('.mumei-v2918-stamp')){if(x.textContent)x.textContent='';x.setAttribute('aria-label','INSIGHT保存確認済み');x.title='INSIGHT保存確認済み'}}
function scrollParent(){const first=[...document.querySelectorAll(SEL)].find(x=>x.getBoundingClientRect?.().height>0);let p=first?.parentElement;for(let i=0;i<12&&p&&p!==document.body&&p!==document.documentElement;i++,p=p.parentElement){const cs=getComputedStyle(p);if(/auto|scroll/.test(cs.overflowY)&&p.scrollHeight>p.clientHeight+100)return p}return null}
function capture(){const p=scrollParent();return{win:window.scrollY,p,top:p?.scrollTop||0}}
function restore(pos){if(!pos)return;if(pos.p)pos.p.scrollTop=pos.top;window.scrollTo({top:pos.win,behavior:'auto'})}
function watchRead(e){const b=e.target instanceof Element?e.target.closest('#mumei-v2918-mainrail .read'):null;if(!b)return;restoring=capture();clearTimeout(timer);const check=()=>{sanitize();const t=document.querySelector('#mumei-v2918-mainrail .status')?.textContent||'';if(/保存完了|保存できません/.test(t)){restore(restoring);setTimeout(()=>restore(restoring),180);restoring=null;return}timer=setTimeout(check,120)};timer=setTimeout(check,120)}
style();sanitize();document.addEventListener('click',watchRead,true);
const ob=new MutationObserver(()=>{sanitize();if(restoring){const t=document.querySelector('#mumei-v2918-mainrail .status')?.textContent||'';if(/保存完了|保存できません/.test(t)){restore(restoring);setTimeout(()=>restore(restoring),180);restoring=null}}});
if(document.body)ob.observe(document.body,{childList:true,subtree:true,characterData:true});
addEventListener('pageshow',sanitize);addEventListener('focus',sanitize);
})();
