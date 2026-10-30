(function(){
'use strict';
if(window.MumeiInsightBrowserGuide)return;
const ROOT='/note-insight/',instances=new Map();
const profiles=[
 ['android-edge','Android / Edge'],['android-firefox','Android / Firefox'],['android-other','Android / その他・アプリ内'],
 ['ios-safari','iPhone・iPad / Safari'],['ios-other','iPhone・iPad / その他・アプリ内'],
 ['mac-safari','Mac / Safari'],['pc-edge','PC / Edge'],['pc-chrome','PC / Chrome'],['pc-firefox','PC / Firefox'],['pc-opera','PC / Opera']
];
const validBrowser=id=>profiles.some(item=>item[0]===id);
const wrappers={notification:'note-insight-notification-v3.user.js',dm:'note-insight-dm.user.js',dashboard:'note-insight-dashboard-sync.user.js'};
const labels={notification:'本人通知',dm:'DM同期',dashboard:'ダッシュボード同期'};
const paths=new Set(['notification-update-now.html','notification-browser-install.html','dm-browser-install.html','dashboard-setup.html']);
const cleanId=value=>/^[a-z0-9_-]+$/i.test(String(value||'').replace(/^@/,''))?String(value).replace(/^@/,'').toLowerCase():'';
function describe(nav=navigator){
 const ua=String(nav.userAgent||''),ios=/iPhone|iPad|iPod/i.test(ua)||(nav.platform==='MacIntel'&&Number(nav.maxTouchPoints)>1),android=/Android/i.test(ua);
 const embedded=/ChatGPT|FBAN|FBAV|Instagram|Line\/|;\s*wv\b|\bWebView\b/i.test(ua);
 const safari=/Safari/i.test(ua)&&!/Chrome|Chromium|CriOS|Edg|FxiOS|OPR|OPiOS|Android/i.test(ua);
 let browser;
 if(ios)browser=safari?'ios-safari':'ios-other';
 else if(android)browser=/EdgA\//i.test(ua)?'android-edge':/Firefox\//i.test(ua)?'android-firefox':'android-other';
 else if(safari&&/Macintosh|Mac OS X/i.test(ua))browser='mac-safari';
 else if(/Edg\//i.test(ua))browser='pc-edge';
 else if(/Firefox\//i.test(ua))browser='pc-firefox';
 else if(/OPR\//i.test(ua))browser='pc-opera';
 else browser='pc-chrome';
 return{browser,ios,android,embedded};
}
const safariBrowser=id=>id==='ios-safari'||id==='mac-safari';
function live(tool){
 const root=document.documentElement,value=root?.getAttribute('data-mumei-'+tool+'-live-version')||(tool==='dashboard'?root?.getAttribute('data-mumei-dashboard-bridge'):'')||'';
 return /^\d+(?:\.\d+){1,3}$/.test(value)?value:'';
}
function detectedManager(tool){
 const value=document.documentElement?.getAttribute('data-mumei-'+tool+'-live-manager')||'';
 return /userscripts/i.test(value)?'userscripts':/tampermonkey/i.test(value)?'tampermonkey':'';
}
function safePage(tool,raw=location.href){
 if(!wrappers[tool])tool='notification';
 let source;try{source=new URL(raw,location.href)}catch{source=new URL(location.href)}
 if(source.origin!==location.origin||source.username||source.password)source=new URL(location.href);
 const name=source.pathname.startsWith(ROOT)?source.pathname.slice(ROOT.length):'',path=paths.has(name)?name:'notification-update-now.html';
 const target=new URL(ROOT+path,location.origin),q=source.searchParams,account=cleanId(q.get('account')||q.get('notificationAccount'));
 if(path==='notification-update-now.html')target.searchParams.set('tool',tool);
 if(account)target.searchParams.set('account',account);
 let back='';
 try{back=window.MumeiInsightUpdateReturn?.resolve(q.get('return'),{fallbackMode:tool==='notification'?'notifications':tool==='dashboard'?'analysis':'normal',fallbackTab:tool==='dm'?'dm':tool==='notification'?'notifications':'',account})||q.get('return')||''}catch{back=q.get('return')||''}
 if(!back){const u=new URL(ROOT,location.origin);u.searchParams.set('insightMode',tool==='notification'?'notifications':tool==='dashboard'?'analysis':'normal');if(tool==='dm')u.searchParams.set('insightTab','dm');if(account)u.searchParams.set('account',account);u.hash='dashboard';back=u.href}
 // Resolve again through a narrow allowlist even if the shared helper is unavailable.
 let u;try{u=new URL(back,location.href)}catch{u=new URL(ROOT,location.origin);u.searchParams.set('insightMode',tool==='notification'?'notifications':tool==='dashboard'?'analysis':'normal');if(tool==='dm')u.searchParams.set('insightTab','dm')}
 const safeBack=new URL(ROOT,location.origin);
 if(u.origin===location.origin&&[ROOT,ROOT+'index.html'].includes(u.pathname)){
  for(const key of ['insightMode','insightTab','analysisPanel']){
   const allowed={insightMode:['normal','comments','favorites','social','notifications','analysis'],insightTab:['likes','supporters','comments','commentRanking','magazines','favorites','social','notifications','dm','articles'],analysisPanel:['menu','normal','dashboard','notifications','verdict']};
   if(allowed[key].includes(u.searchParams.get(key)))safeBack.searchParams.set(key,u.searchParams.get(key));
  }
  if(account)safeBack.searchParams.set(safeBack.searchParams.get('insightMode')==='notifications'?'notificationAccount':'account',account);
  safeBack.hash=u.hash==='#owner-insight'?'owner-insight':'dashboard';
 }else safeBack.hash='dashboard';
 target.searchParams.set('return',safeBack.href);
 const browser=q.get('browserRoute');if(validBrowser(browser))target.searchParams.set('browserRoute',browser);
 const manager=q.get('scriptManager');if(['userscripts','tampermonkey'].includes(manager))target.searchParams.set('scriptManager',manager);
 if(path==='dashboard-setup.html')target.searchParams.set('auto','0');
 return target.href;
}
function intent(tool,browser,raw=location.href){
 const packages={'android-edge':'com.microsoft.emmx','android-firefox':'org.mozilla.firefox'};
 if(!packages[browser])return'';
 const target=new URL(safePage(tool,raw));target.searchParams.set('browserRoute',browser);target.searchParams.set('scriptManager','tampermonkey');
 const fallback=new URL(target);fallback.searchParams.set('browserLaunchFailed',browser);
 return'intent://'+target.host+target.pathname+target.search+'#Intent;scheme=https;package='+packages[browser]+';S.browser_fallback_url='+encodeURIComponent(fallback.href)+';end';
}
function instructions(browser,manager){
 if(safariBrowser(browser)&&manager==='userscripts')return[
  'Safariを先に開き、この更新画面のURLを貼り付けます。UserscriptsをSafariの拡張機能で有効にしてください。',
  '更新ボタンでスクリプトを開きます。文字列の画面は正常な途中手順です。その画面の拡張機能 → Userscripts → インストール／更新を押してください。',
  '元の更新画面へ戻り「更新を確認」を押します。新しい版の起動を確認してから完了になります。'
 ];
 if(['ios-other','android-other'].includes(browser))return[
  browser==='ios-other'?'URLをコピーしてからSafariを先に開き、アドレス欄へ貼り付けてください。':'下のEdge・Firefoxのボタン、またはURLコピーから、拡張機能を入れたブラウザ単体で開いてください。',
  '移動先でスクリプトを更新し、元の更新画面へ戻って起動を確認してください。'
 ];
 return[
  'Tampermonkeyを入れた普段のブラウザを先に開き、この更新画面を表示します。',
  '更新ボタンを押し、拡張機能の確認画面で更新／インストールを確定します。',
  '元の更新画面へ戻って起動を確認します。文字列のままならTampermonkeyのダッシュボード → ユーティリティ → URLからインポートを使います。'
 ];
}
function mount(root,tool){
 if(!root||!wrappers[tool])return null;
 if(instances.has(tool))return instances.get(tool).snapshot();
 const env=describe(),q=new URLSearchParams(location.search);
 let selected=validBrowser(q.get('browserRoute'))?q.get('browserRoute'):env.browser;
 let explicitManager=['userscripts','tampermonkey'].includes(q.get('scriptManager'))?q.get('scriptManager'):'',stamp='';
 root.classList.add('ibg');root.innerHTML='<h2>更新するブラウザを確認</h2><p class="ibg-state" role="status"></p><p class="ibg-context"></p><label>操作説明の環境<select class="ibg-browser"></select></label><label class="ibg-manager-row">Safariでお使いの拡張機能<select class="ibg-manager"><option value="userscripts">Userscripts（無料）</option><option value="tampermonkey">Tampermonkey（すでにお使いの方）</option></select></label><ol class="ibg-steps"></ol><div class="ibg-handoff"><p class="ibg-switch"></p><div class="ibg-actions"><a class="ibg-edge">Edgeでこの画面を開く</a><a class="ibg-firefox">Firefoxでこの画面を開く</a><button class="ibg-copy" type="button">この更新画面のURLをコピー</button></div><input class="ibg-url" readonly aria-label="普段使うブラウザで開く更新画面URL"><p class="ibg-copy-status" role="status"></p></div><details><summary>対応する環境を確認</summary><p>Android：Edge・Firefox＋Tampermonkey。iPhone・iPad：Safari＋Userscripts。Mac：Safari＋Userscripts、またはChrome・Edge・Firefox＋Tampermonkey。Windows・Linux：Chrome・Edge・Firefox・Opera＋Tampermonkey。</p><p>アプリ内表示では、拡張機能やブラウザのログイン状態を引き継げない場合があります。更新完了は実際の起動版で確認します。</p></details>';
 if(!document.getElementById('insight-browser-guide-style')){
  const style=document.createElement('style');style.id='insight-browser-guide-style';
  style.textContent='.ibg{margin:16px 0;padding:14px;border:1px solid #527e96;border-radius:12px;background:#0b2230;color:#e8f6ff;line-height:1.6;overflow-wrap:anywhere}.ibg h2{margin:0 0 10px;font:800 18px/1.4 system-ui}.ibg p,.ibg li,.ibg label,.ibg summary{font:14px/1.65 system-ui;color:#d8eaf5}.ibg .ibg-state{font-weight:800;color:#fff1c5}.ibg label{display:block;margin:10px 0}.ibg select,.ibg input{box-sizing:border-box;width:100%;min-height:44px;padding:9px;border:1px solid #7399ae;border-radius:8px;background:#0b1720;color:#fff;font:14px system-ui}.ibg ol{padding-left:22px;margin:12px 0}.ibg li+li{margin-top:8px}.ibg .ibg-actions{display:grid;gap:8px}.ibg .ibg-actions a,.ibg .ibg-actions button{box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-height:46px;padding:10px;border:1px solid #80c3cf;border-radius:8px;background:#154554;color:#fff;text-decoration:none;font:700 14px/1.5 system-ui;cursor:pointer}.ibg .ibg-url{margin-top:9px;font-size:12px}.ibg details{margin-top:10px}.ibg [hidden]{display:none!important}';
  document.head.append(style);
 }
 const el=selector=>root.querySelector(selector),browserSelect=el('.ibg-browser'),managerSelect=el('.ibg-manager');
 for(const [value,label] of profiles){const option=document.createElement('option');option.value=value;option.textContent=label;browserSelect.append(option)}
 function snapshot(){
  const liveVersion=live(tool),manager=explicitManager||detectedManager(tool)||(safariBrowser(selected)?'userscripts':'tampermonkey');
  const canInstall=Boolean(liveVersion||(!env.embedded&&!['ios-other','android-other'].includes(env.browser)));
  return{browser:selected,actualBrowser:env.browser,manager,canInstall,liveVersion,instruction:instructions(selected,manager).join(' ')};
 }
 function render(){
  const state=snapshot();browserSelect.value=selected;managerSelect.value=state.manager;el('.ibg-manager-row').hidden=!safariBrowser(selected);
  el('.ibg-state').textContent=state.liveVersion?labels[tool]+' v'+state.liveVersion+' の起動をこの画面で確認しています。':'この画面では拡張機能の起動をまだ確認できていません。';
  el('.ibg-context').textContent='ChatGPTなどのアプリ内から開いた場合は、普段使うブラウザを先に起動して、このURLを開いてください。ブラウザ名の自動判定だけで更新済みにはしません。';
  el('.ibg-context').hidden=Boolean(state.liveVersion);
  el('.ibg-steps').replaceChildren();for(const text of instructions(selected,state.manager)){const li=document.createElement('li');li.textContent=text;el('.ibg-steps').append(li)}
  const page=new URL(safePage(tool));page.searchParams.set('browserRoute',selected);page.searchParams.set('scriptManager',state.manager);
  el('.ibg-url').value=page.href;el('.ibg-edge').href=intent(tool,'android-edge',page.href);el('.ibg-firefox').href=intent(tool,'android-firefox',page.href);
  el('.ibg-edge').hidden=!env.android;el('.ibg-firefox').hidden=!env.android;
  el('.ibg-handoff').hidden=Boolean(state.liveVersion);
  const failed=q.get('browserLaunchFailed');
  el('.ibg-switch').textContent=failed?'ブラウザへ切り替わらなかった場合は、URLをコピーし、普段のブラウザを自分で起動して貼り付けてください。':env.ios?'Safariへは自動で切り替わらない場合があります。URLをコピーし、Safariを自分で起動して貼り付けてください。':env.android?'EdgeまたはFirefoxを単体で開きます。ボタンで切り替わらなければ、URLをコピーしてブラウザを先に開いてください。':'URLをコピーし、拡張機能を入れた普段のブラウザを先に起動して貼り付けてください。';
  const next=JSON.stringify(state);if(stamp!==next){stamp=next;document.dispatchEvent(new CustomEvent('mumei-insight-browser-guide-change',{detail:{tool,...state}}))}
 }
 const api={snapshot,render,setBrowser:id=>{if(validBrowser(id)){selected=id;explicitManager='';render()}},setManager:name=>{if(['userscripts','tampermonkey'].includes(name)){explicitManager=name;render()}}};
 instances.set(tool,api);
 browserSelect.addEventListener('change',()=>api.setBrowser(browserSelect.value));managerSelect.addEventListener('change',()=>api.setManager(managerSelect.value));
 el('.ibg-copy').addEventListener('click',async()=>{
  const input=el('.ibg-url'),value=input.value;let copied=false;
  try{await navigator.clipboard.writeText(value);copied=true}catch{input.focus();input.select();try{copied=document.execCommand('copy')===true}catch{}}
  el('.ibg-copy-status').textContent=copied?'URLをコピーしました。普段のブラウザを先に開き、アドレス欄に貼り付けてください。':'自動コピーできませんでした。上のURL欄を長押し、または選択してコピーしてください。';
 });
 document.addEventListener('click',event=>{
  const link=event.target?.closest?.('a[href]');if(!link)return;
  let url;try{url=new URL(link.href)}catch{return}
  if(![location.origin,'https://raw.githubusercontent.com'].includes(url.origin)||!url.pathname.endsWith('/'+wrappers[tool]))return;
  if(snapshot().canInstall)return;
  event.preventDefault();event.stopImmediatePropagation();root.hidden=false;el('.ibg-copy-status').textContent='この画面内では更新を確定できません。上の案内から普段のブラウザを先に開いてください。';
  browserSelect.focus();
 },true);
 const observer=new MutationObserver(render);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-mumei-'+tool+'-live-version','data-mumei-'+tool+'-live-manager',...(tool==='dashboard'?['data-mumei-dashboard-bridge']:[])]});
 window.addEventListener('mumei-insight-tool-ready',render);render();return snapshot();
}
window.MumeiInsightBrowserGuide=Object.freeze({describe,safePage,intent,mount,forTool:tool=>instances.get(tool)?.snapshot(),setBrowser:(tool,id)=>instances.get(tool)?.setBrowser(id),setManager:(tool,name)=>instances.get(tool)?.setManager(name)});
function init(){for(const root of document.querySelectorAll('[data-insight-browser-guide]')){const q=new URLSearchParams(location.search),tool=root.dataset.tool==='auto'?(q.get('tool')==='dm'?'dm':'notification'):root.dataset.tool;mount(root,tool)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
