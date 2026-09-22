(() => {
  'use strict';
  const DASH_KEY='mumei-dashboard-tool-version',NOTICE_KEY='mumei-notification-tool-version';
  const MEMBER='mumei-insight-access-token',OWNER='mumei-unified-owner-token',ACTIVE='mumei-insight-active-account-v3',PENDING='mumei-dashboard-update-pending-v2';
  const API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-import-token';
  const $=id=>document.getElementById(id),q=new URLSearchParams(location.search);
  const get=(key,storage=localStorage)=>{try{return storage.getItem(key)||''}catch{return''}};
  const put=(key,value,storage=sessionStorage)=>{try{storage.setItem(key,value)}catch{}};
  const remove=(key,storage=sessionStorage)=>{try{storage.removeItem(key)}catch{}};
  const version=v=>/^\d+(?:\.\d+){1,3}$/.test(String(v||''))?String(v):'';
  const accountId=v=>/^[a-z0-9_-]+$/i.test(String(v||''))?String(v).toLowerCase():'';
  function compare(a,b){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]||0)-(y[i]||0);if(d)return Math.sign(d)}return 0}
  const current=()=>version(document.documentElement.getAttribute('data-mumei-dashboard-bridge'));
  const expected=accountId(q.get('account'))||accountId(get(ACTIVE));
  function safeBack(v){try{const u=new URL(String(v||''),location.href);return u.origin===location.origin&&u.pathname.startsWith('/note-insight/')&&!/\/dashboard-setup(?:-v2)?\.html$/.test(u.pathname)?u.href:''}catch{return''}}
  const backUrl=new URL(safeBack(q.get('return'))||'./?insightMode=analysis#dashboard',location.href);
  if(/\/note-insight\/(?:index\.html)?$/.test(backUrl.pathname)){backUrl.searchParams.set('insightMode','analysis');backUrl.hash='dashboard'}
  const back=backUrl.href;
  $('back').href=back;$('returnAnalysis').href=back;
  const self=new URL(location.href);self.searchParams.delete('verifyTs');self.searchParams.set('auto','0');
  const noticeUrl=new URL('./notification-browser-install.html',location.href);noticeUrl.searchParams.set('return',self.href);$('installNotice').href=noticeUrl.href;
  function text(el,value){if(el.textContent!==value)el.textContent=value}
  function status(id,message,kind=''){const el=$(id);el.className='status'+(kind?' '+kind:'');text(el,message)}
  function pending(){try{const p=JSON.parse(get(PENDING,sessionStorage)||'null');return p&&Date.now()-Number(p.at)<60*60*1000?p:null}catch{return null}}
  function detect(){const ua=navigator.userAgent||'',ios=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),safari=/Safari/i.test(ua)&&!/Chrome|CriOS|Edg|FxiOS|OPR|Android/i.test(ua);if(ios)return safari?'ios-safari':'ios-other';if(/Android/i.test(ua))return /EdgA/i.test(ua)?'android-edge':/Firefox/i.test(ua)?'android-firefox':'android-other';if(safari&&/Macintosh/i.test(ua))return'mac-safari';if(/Edg\//i.test(ua))return'pc-edge';if(/Firefox/i.test(ua))return'pc-firefox';if(/OPR\//i.test(ua))return'pc-opera';return'pc-chrome'}
  $('browser').value=detect();
  const TM=browser=>['Tampermonkey公式ページ','https://www.tampermonkey.net/index.php?browser='+browser+'&locale=ja'];
  function links(id,items){const root=$(id);root.replaceChildren();for(const [label,url] of items){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';root.append(a)}}
  function browserGuide(){
    const id=$('browser').value,safari=id==='ios-safari'||id==='mac-safari',other=id==='ios-other'||id==='android-other';
    $('switchBrowser').hidden=!other;
    text($('browserHelp'),other?'下の案内から対応ブラウザでこの画面を開いてください。':safari?'Safariの拡張機能を有効にして、上の更新ボタンを押します。':'Tampermonkeyを有効にして、上の更新ボタンを押します。すでに使っている方は拡張機能の入れ直し不要です。');
    text($('codeHelp'),safari?'Safariの拡張機能メニューから、お使いのUserscriptsまたはTampermonkeyを開き、表示中のスクリプトをインストールしてください。その後、この更新画面に戻って「更新を確認」を押します。':'ブラウザの拡張機能一覧でTampermonkeyが有効か確認し、もう一度更新ボタンを押してください。拡張機能側のサイトへのアクセスやユーザースクリプト実行の許可も確認します。');
    text($('extensionText'),safari?'UserscriptsまたはTampermonkeyのどちらかを有効にし、note.comとmumei-s.github.ioでの実行を許可してください。':'Tampermonkeyを追加して有効にします。note.comとmumei-s.github.ioでの実行を許可してください。');
    links('extensionLinks',safari?[['Userscripts（Safari）','https://apps.apple.com/app/userscripts/id1463298887'],['Tampermonkey（有料・INSIGHTとは別料金）','https://www.tampermonkey.net/index.php?browser=safari&locale=ja']]:[id==='android-firefox'?['Firefox Android用Tampermonkey','https://addons.mozilla.org/android/addon/tampermonkey/']:TM(id.includes('firefox')?'firefox':id.includes('edge')?'edge':id.includes('opera')?'opera':'chrome')]);
    text($('switchHelp'),id==='ios-other'?'Safariでこの更新画面を開いてください。':'この案内では、AndroidのEdgeまたはFirefoxを使用します。移動先で同じINSIGHTアカウントへログインしてください。');
    links('switchLinks',id==='android-other'?[['Edge','https://play.google.com/store/apps/details?id=com.microsoft.emmx'],['Firefox','https://play.google.com/store/apps/details?id=org.mozilla.firefox']]:[]);
  }
  const supported=()=>!['ios-other','android-other'].includes($('browser').value)||Boolean(current());
  let release=null,releaseError='',loadingRelease=null,busy=false,checking=false,readFeedback=null,autoStarted=false;
  function readStatus(message,kind=''){readFeedback={message,kind};status('readStatus',message,kind)}
  function paint(){
    const active=current(),last=version(get(DASH_KEY)),latest=version(release?.dashboardVersion),notice=version(get(NOTICE_KEY)),noticeLatest=version(release?.notificationVersion);
    const ready=Boolean(latest&&active&&compare(active,latest)>=0),noticeReady=Boolean(noticeLatest&&notice&&compare(notice,noticeLatest)>=0);
    text($('dashCurrent'),active?'v'+active:last?'前回検出 v'+last:'起動確認待ち');text($('dashLatest'),latest?'v'+latest:'確認できません');
    text($('noticeCurrent'),notice?'v'+notice:'未確認');text($('noticeLatest'),noticeLatest?'v'+noticeLatest:'確認できません');
    text($('dashBadge'),ready?'最新版':active&&latest?'更新あり':'起動確認待ち');$('dashBadge').className='badge '+(ready?'ok':'warn');
    text($('noticeBadge'),noticeReady?'最新版':notice&&noticeLatest?'更新あり':'未確認');$('noticeBadge').className='badge '+(noticeReady?'ok':'warn');
    $('installDashboard').hidden=ready;$('verifyDashboard').hidden=ready;$('installNotice').hidden=noticeReady;
    text($('installDashboard'),(active||last?'ダッシュボード同期を更新':'ダッシュボード同期をインストール')+(latest?'（v'+latest+'）':''));
    text($('installHint'),ready?'更新済みです。追加のインストール操作は不要です。':'確認画面で「更新／インストール」を押したら、このタブへ戻ってください。');
    $('startRead').disabled=!ready||busy||!supported();
    if(ready){remove(PENDING);status('dashStatus','✓ ダッシュボード同期 v'+active+' の起動を確認しました。','ok')}
    else if(releaseError)status('dashStatus',releaseError,'warn');
    else if(active&&latest)status('dashStatus','導入済み v'+active+' → 最新 v'+latest+'。上の更新ボタンを押してください。','warn');
    else status('dashStatus','この画面でツールの起動をまだ確認できません。導入・更新後に「更新を確認」を押してください。','warn');
    if(readFeedback)status('readStatus',readFeedback.message,readFeedback.kind);
    else if(!busy)status('readStatus',ready?'準備できました。下の分析へ戻るか、最新の公式データを読み込んでください。':'ダッシュボード同期の起動確認後に読み込めます。',ready?'ok':'');
    text($('account'),expected?'対象：@'+expected+'（note側でも本人一致を確認します）':'読み込み開始時にINSIGHTのログインアカウントを確認します。');
    // auto=1 is set only by an explicit data-read link. Consume it before starting so a reload cannot repeat the request.
    if(ready&&supported()&&q.get('auto')==='1'&&!autoStarted){autoStarted=true;const u=new URL(location.href);u.searchParams.set('auto','0');history.replaceState(history.state,'',u.href);void startRead()}
  }
  async function loadRelease(){
    if(loadingRelease)return loadingRelease;
    loadingRelease=(async()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);try{const r=await fetch('./insight-release.json?ts='+Date.now(),{cache:'no-store',signal:c.signal});if(!r.ok)throw new Error();const p=await r.json();if(!version(p.dashboardVersion)||!version(p.notificationVersion))throw new Error();release=p;releaseError=''}catch{releaseError='最新版の確認に失敗しました。通信を確認し、「更新を確認」を押してください。'}finally{clearTimeout(timer);loadingRelease=null;paint()}})();return loadingRelease;
  }
  function reloadForCheck(){const p=pending()||{at:Date.now()};put(PENDING,JSON.stringify({...p,reloaded:true}));status('dashStatus','更新したツールをこの画面で起動して確認します…');const u=new URL(location.href);u.searchParams.set('verifyTs',String(Date.now()));location.replace(u.href)}
  async function verify(manual=false){
    if(checking)return;checking=true;
    try{await loadRelease();const latest=version(release?.dashboardVersion),active=current();if(latest&&active&&compare(active,latest)>=0)return;const p=pending();if(manual||(p&&!p.reloaded))reloadForCheck();else if(p?.reloaded)status('dashStatus','更新をまだ確認できません。拡張機能で保存したことと、このサイトでの実行許可を確認してください。','warn')}finally{checking=false}
  }
  $('installDashboard').addEventListener('click',e=>{if(!supported()){e.preventDefault();status('dashStatus','ブラウザの案内に沿って対応ブラウザで開いてください。','warn');document.querySelector('.browser-card').open=true;$('browser').focus();return}put(PENDING,JSON.stringify({at:Date.now(),target:release?.dashboardVersion||'',reloaded:false}));status('dashStatus','更新画面を別タブで開きます。更新後、このタブに戻ってください。')});
  $('verifyDashboard').addEventListener('click',()=>void verify(true));
  $('browser').addEventListener('change',()=>{browserGuide();paint()});
  $('copyPage').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(self.href);text($('copyPage'),'コピーしました')}catch{text($('copyPage'),'アドレス欄からこのページのURLをコピーしてください')}});
  async function startRead(){
    if(busy||$('startRead').disabled)return;
    const member=get(MEMBER),owner=expected==='ss_yr'?get(OWNER):'',accountAtStart=get(ACTIVE);
    if(!member&&!owner){$('loginInsight').hidden=false;readStatus('INSIGHTへのログインが必要です。下のリンクからログインしてください。','warn');return}
    if(expected&&accountId(accountAtStart)&&accountId(accountAtStart)!==expected){readStatus('アカウントが切り替わっています。INSIGHTへ戻り、利用するアカウントを確認してください。','warn');return}
    busy=true;readFeedback=null;$('loginInsight').hidden=true;paint();readStatus('INSIGHTの本人アカウントを確認しています…');
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);
    try{
      const headers={'Content-Type':'application/json'};if(member)headers['X-Insight-Token']=member;if(owner)headers['X-Owner-Token']=owner;
      const r=await fetch(API,{method:'POST',headers,body:JSON.stringify({action:'pair-start',role:expected==='ss_yr'?'owner':'member'}),cache:'no-store',signal:c.signal});
      const p=await r.json().catch(()=>({}));if(!r.ok||p.ok===false)throw new Error(p.error||'PAIR_START_FAILED');
      if(get(MEMBER)!==member||get(ACTIVE)!==accountAtStart||(owner&&get(OWNER)!==owner))throw new Error('ACCOUNT_CHANGED');
      const id=accountId(p.noteId),code=String(p.pairingCode||'');if(!id||!/^\d{8}$/.test(code))throw new Error('PAIR_RESPONSE_INVALID');if(expected&&id!==expected)throw new Error('ACCOUNT_MISMATCH');
      const url=new URL('https://note.com/sitesettings/stats');url.searchParams.set('mumei_dashboard_pair',code);url.searchParams.set('mumei_dashboard_sync','1');url.searchParams.set('mumei_dashboard_account',id);url.searchParams.set('mumei_dashboard_return',back);url.searchParams.set('mumei_dashboard_tool_version',current());
      readStatus('@'+id+' を確認しました。公式ダッシュボードへ移動します。','ok');location.assign(url.href);
    }catch(e){const message=String(e?.message||'');readStatus(/ACCOUNT/.test(message)?'アカウントが一致しないか切り替わりました。INSIGHTへ戻り、利用するアカウントを確認してください。':/LOGIN|SESSION|401/.test(message)?'INSIGHTのログインを確認してください。ログイン後、この画面から再開できます。':e?.name==='AbortError'?'通信に時間がかかっています。もう一度読み込んでください。':'読み込みを開始できませんでした。通信とINSIGHTのログインを確認して再試行してください。','warn')}
    finally{clearTimeout(timer);busy=false;$('startRead').disabled=!(release&&current()&&compare(current(),release.dashboardVersion)>=0&&supported())}
  }
  $('startRead').addEventListener('click',()=>void startRead());
  const observer=new MutationObserver(paint);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-mumei-dashboard-bridge']});
  addEventListener('storage',e=>{if([DASH_KEY,NOTICE_KEY].includes(e.key))paint()});addEventListener('mumei-notification-version-changed',paint);
  const resume=()=>void verify(false);addEventListener('pageshow',resume);addEventListener('focus',resume);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resume()});
  browserGuide();paint();void loadRelease();
})();
