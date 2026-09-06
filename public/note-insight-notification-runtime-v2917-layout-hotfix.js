(function(){
'use strict';
if(!/(^|\.)note\.com$/.test(location.hostname))return;
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const INS='https://mumei-s.github.io/note-insight/?insightMode=notifications#dashboard';
let timer=0;
function visible(e){if(!e?.getBoundingClientRect)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'}
function firstItem(){return [...document.querySelectorAll(ITEM)].find(e=>visible(e)&&!e.closest?.('#mumei-v2918-rail,#mumei-v2917-menu,#mumei-v2917-settings'))||null}
function style(){if(document.getElementById('mumei-v2918-layout-style'))return;const s=document.createElement('style');s.id='mumei-v2918-layout-style';s.textContent=`
#mumei-v2917-tool,#mumei-v2917-ins{position:fixed!important;left:-2000px!important;right:auto!important;top:-2000px!important;width:1px!important;min-width:1px!important;height:1px!important;min-height:1px!important;padding:0!important;opacity:0!important;pointer-events:none!important;box-shadow:none!important;overflow:hidden!important}
#mumei-v2918-rail{position:sticky!important;top:0!important;z-index:2147483500!important;width:100%!important;min-width:0!important;height:34px!important;padding:3px 6px!important;margin:0!important;display:flex!important;justify-content:flex-end!important;align-items:center!important;background:rgba(31,42,51,.96)!important;backdrop-filter:blur(8px)!important;-webkit-backdrop-filter:blur(8px)!important;border-bottom:1px solid rgba(101,130,150,.32)!important;box-sizing:border-box!important}
#mumei-v2918-rail .m2918-inner{width:min(220px,72vw)!important;height:28px!important;display:grid!important;grid-template-columns:minmax(0,1fr) 76px!important;border:1px solid #42657b!important;border-radius:8px!important;overflow:hidden!important;background:#0a1b27!important;box-shadow:0 2px 7px #0006!important}
#mumei-v2918-rail button{min-width:0!important;height:28px!important;border:0!important;border-radius:0!important;margin:0!important;padding:0 8px!important;background:#0d2331!important;color:#dff7ff!important;font:950 9px/1 system-ui!important;white-space:nowrap!important;box-shadow:none!important;touch-action:manipulation!important;transition:transform .05s,filter .05s,background .05s!important}
#mumei-v2918-rail button+button{border-left:1px solid #42657b!important}
#mumei-v2918-rail button.ins{color:#bff5ff!important;background:#103043!important}
#mumei-v2918-rail button:active,#mumei-v2918-rail button.pressed{transform:translateY(1px) scale(.985)!important;filter:brightness(1.2)!important;background:#174157!important;box-shadow:inset 0 2px 4px #0008!important}
#mumei-v2917-menu{z-index:2147483646!important}
#mumei-v2917-settings{left:50%!important;top:50%!important;right:auto!important;bottom:auto!important;transform:translate(-50%,-50%)!important;max-height:min(78vh,620px)!important;overflow:auto!important}
@media(max-width:420px){#mumei-v2918-rail{height:32px!important;padding:2px 5px!important}#mumei-v2918-rail .m2918-inner{width:min(204px,70vw)!important;height:27px!important;grid-template-columns:minmax(0,1fr) 70px!important}#mumei-v2918-rail button{height:27px!important;font-size:8.5px!important;padding:0 6px!important}}
`;document.documentElement.append(s)}
function press(b){b.classList.add('pressed');setTimeout(()=>b.classList.remove('pressed'),120)}
function legacyTool(){return document.getElementById('mumei-v2917-tool')}
function alignMenu(anchor){requestAnimationFrame(()=>{const m=document.getElementById('mumei-v2917-menu');if(!m)return;const r=anchor.getBoundingClientRect(),w=m.offsetWidth||188,h=m.offsetHeight||150;const left=Math.max(6,Math.min(innerWidth-w-6,r.right-w));const top=Math.max(6,Math.min(innerHeight-h-6,r.bottom+4));m.style.setProperty('left',`${left}px`,'important');m.style.setProperty('top',`${top}px`,'important')})}
function openLegacyMenu(anchor){const t=legacyTool();if(!t)return;try{const r=anchor.getBoundingClientRect(),x=r.left+8,y=r.top+8,id=917;const P=globalThis.PointerEvent||MouseEvent;t.dispatchEvent(new P('pointerdown',{bubbles:true,cancelable:true,pointerId:id,button:0,clientX:x,clientY:y}));t.dispatchEvent(new P('pointerup',{bubbles:true,cancelable:true,pointerId:id,button:0,clientX:x,clientY:y}));alignMenu(anchor)}catch{}}
function build(){style();const first=firstItem();if(!first||!first.parentElement)return;let rail=document.getElementById('mumei-v2918-rail');if(rail&&rail.parentElement!==first.parentElement)rail.remove();rail=document.getElementById('mumei-v2918-rail');if(!rail){rail=document.createElement('div');rail.id='mumei-v2918-rail';rail.setAttribute('aria-label','INSIGHT通知操作');rail.innerHTML='<div class="m2918-inner"><button class="ops" type="button">通知操作</button><button class="ins" type="button">INSIGHT</button></div>';const ops=rail.querySelector('.ops'),ins=rail.querySelector('.ins');ops.onclick=()=>{press(ops);openLegacyMenu(ops)};ins.onclick=()=>{press(ins);setTimeout(()=>location.assign(INS),70)};first.parentElement.insertBefore(rail,first)}else if(rail.nextSibling!==first){first.parentElement.insertBefore(rail,first)}}
function refresh(){clearTimeout(timer);timer=setTimeout(build,120)}
const ob=new MutationObserver(refresh);
function init(){style();build();if(document.body)ob.observe(document.body,{childList:true,subtree:true});addEventListener('pageshow',refresh);addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh()});setInterval(build,5000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
