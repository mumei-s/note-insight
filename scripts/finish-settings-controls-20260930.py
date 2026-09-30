from pathlib import Path

def once(s, a, b):
    if s.count(a) != 1:
        raise SystemExit('FOLLOWUP_ANCHOR_MISMATCH: ' + a[:100])
    return s.replace(a, b, 1)

p=Path('src/member-insight-live-v2.tsx')
s=p.read_text()
s=once(s,'{dashboardUpdateAvailable?<em>更新あり</em>:dashboardMissing?<em>未導入</em>:null}','')
s=once(s,'{notificationUpdateAvailable?<em>更新あり</em>:notificationMissing?<em>＋ 未導入</em>:null}','')
s=once(s,'if(expected&&expected===CURRENT_INSIGHT_APP_VERSION)','if(expected&&!versionDiffers(CURRENT_INSIGHT_APP_VERSION,expected))')
p.write_text(s)
p=Path('src/insight-top-install-v16.ts')
# Match the install-link class too: the nested notice default has six class selectors.
# Equal class specificity plus body/a wins without inline styles or a global override.
s=once(p.read_text(),'.miv5-update .miv5-source-card.needs-update a.${CANONICAL}{','body .miv5-update .miv5-source-card.needs-update a.miv5-install-link.${CANONICAL}[data-update-state="available"]{')
p.write_text(s)
p=Path('src/api.ts')
s=once(p.read_text(),'.then((value) => { registration = value; })','.then((value) => { registration = value; lastCheck = Date.now(); })')
s=once(s,'try { await start(); if (registration) await registration.update(); }','''try {
      const alreadyRegistered = Boolean(registration);
      await start();
      // register() already checks the worker. Do not race it with a second
      // update on the same load/pageshow or while another worker is installing.
      if (alreadyRegistered && registration && document.visibilityState === "visible" && !registration.installing && !registration.waiting) await registration.update();
    }''')
p.write_text(s)

p=Path('tests/settings-update-20260930.mjs')
s=p.read_text()
lines=[line for line in s.splitlines() if "file + ' update source'" in line]
if len(lines)!=1: raise SystemExit('UPDATE_SOURCE_ASSERTION_ANCHOR')
s=once(s,lines[0],r''' const origin = file === 'note-insight-dashboard-sync.user.js' ? 'https://mumei-s.github.io/note-insight/' : 'https://raw.githubusercontent.com/mumei-s/note-insight/main/public/';
 check(text.match(/@updateURL\s+([^\s]+)/)?.[1], origin + file, file + ' canonical update source');
 check(text.match(/@downloadURL\s+([^\s]+)/)?.[1], origin + file, file + ' canonical download source');''')
s=once(s,"name+' settings steady glow'","name+' settings steady glow '+JSON.stringify(visual)")
s=once(s,"const inlineJs = compile(await read('src/insight-inline-updates-v1.ts'));","const inlineJs = compile(await read('src/insight-inline-updates-v1.ts'));\nconst noticeRouteJs = compile(await read('src/insight-notification-update-route-v1.ts'));")
s=once(s,'<script>${inline(topJs)}</script><script>${inline(inlineJs)}</script>','<script type="module">${inline(topJs)}</script><script type="module">${inline(inlineJs)}</script><script type="module">${inline(noticeRouteJs)}</script>')
s=once(s,"window.testMode='normal';localStorage.setItem('test-preserved-history','do-not-delete');localStorage.setItem('mumei-insight-access-token','synthetic-token-only');sessionStorage.setItem('test-preserved-session','keep');","window.testMode='normal';")
s=s.replace('<em>更新あり</em>', '')
s=once(s,"await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));","""await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
     // Seed once in the test, never from the reloaded app document.
     await page.evaluate(()=>{localStorage.setItem('test-preserved-history','do-not-delete');localStorage.setItem('mumei-insight-access-token','synthetic-token-only');sessionStorage.setItem('test-preserved-session','keep')});""")
s=once(s,"await page.screenshot({path:out+'/'+name+'-'+width+'-update.png',fullPage:true});","""await page.screenshot({path:out+'/'+name+'-'+width+'-update.png',fullPage:true});
     const entryURL=page.url();
     await page.locator('.notice a.mumei-canonical-install').click();
     await page.waitForURL(u=>u.pathname==='/note-insight/notification-update.html');
     check(new URL(page.url()).searchParams.get('account'),'test_fixture',name+' notice setup preserves account');
     check(new URL(page.url()).searchParams.get('return'),entryURL,name+' notice setup preserves return');
     await page.goBack();
     await page.waitForFunction(()=>document.querySelectorAll('[data-update-state="available"]').length===2);
     await page.locator('.dashboard a.mumei-canonical-install').click();
     await page.waitForURL(u=>u.pathname==='/note-insight/dashboard-setup.html');
     check(new URL(page.url()).searchParams.get('from'),'analysis',name+' actual dashboard settings click');
     await page.goBack();
     await page.waitForFunction(()=>document.querySelectorAll('[data-update-state="available"]').length===2);""")
s=once(s,"} catch(e) { await page.screenshot(","} catch(e) { await fs.writeFile(out+'/'+name+'-'+width+'-failure.json',JSON.stringify({error:String(e),stack:e.stack,assertions:results.assertions,completed:results.engines},null,2)); await page.screenshot(")
# Drop real connections, not just page-owned requests in offline emulation.
s=once(s,'let sawNoCache = false;','let sawNoCache = false;\nlet originOffline = false, droppedOriginRequests = 0, droppedSwRequests = 0;\nresults.offlineSimulation = "origin socket disconnect; genuine SW cache fallback; not a physical radio test";')
s=once(s,"const server = http.createServer((req, res) => {","const server = http.createServer((req, res) => {\n if (originOffline) { droppedOriginRequests++; if(new URL(req.url, \'http://127.0.0.1\').pathname.endsWith(\'/sw.js\'))droppedSwRequests++; req.socket.destroy(); return; }")
s=once(s,'await context.setOffline(true);','check(errors, [], name+\' no application errors before injected outage\');\n     originOffline = true;\n     const droppedBefore = droppedOriginRequests;')
s=once(s,'await context.setOffline(false);','ok(droppedOriginRequests > droppedBefore, name+\' origin outage actually reached the network\');\n     await page.waitForTimeout(100);\n     originOffline = false;')
s=once(s,'finally { await context.close(); }','finally { originOffline = false; await context.close(); }')
# WebKit can deliver failed SW-load diagnostics after connectivity is restored.
# Correlate only that exact error with an actual SW socket dropped in this test.
# Record it; do not ignore other errors. A fresh reg.update() must also succeed.
s=once(s,"const errors=[];page.on('pageerror', e=>errors.push(e.message));","""const errors=[], outageNetworkErrors=[];
    const swDropsAtStart=droppedSwRequests;
    page.on('pageerror', e=>{
     const message=e.message;
     const swAccessFailure=message.endsWith('/note-insight/sw.js due to access control checks.');
     const expectedNetworkFailure=message==='TypeError: Load failed'||swAccessFailure||message.endsWith('/note-insight/insight-release.json?offline=1.');
     const correlatedLateSwFailure=swAccessFailure&&droppedSwRequests>swDropsAtStart;
     if((originOffline&&expectedNetworkFailure)||correlatedLateSwFailure)outageNetworkErrors.push({message,delayed:!originOffline});
     else errors.push(message);
    });""")
s=once(s,"check(errors,[],name+' no JavaScript errors');","""check(await page.evaluate(async()=>{
      const reg=await navigator.serviceWorker.getRegistration();
      if(!reg)return 'missing';
      return Promise.race([reg.update().then(()=>Boolean(reg.active)),new Promise(resolve=>setTimeout(()=>resolve('timeout'),5000))]);
     }),true,name+' fresh SW update succeeds after network restoration');
     check(errors,[],name+' no unexpected JavaScript errors');""")
s=once(s,"results.engines.push({name,version:browser.version(),width,status:'passed'});","results.engines.push({name,version:browser.version(),width,status:'passed',outageNetworkErrors,droppedSwRequests:droppedSwRequests-swDropsAtStart});")
p.write_text(s)
print('Finished card badge removal and stricter browser tests; participant data untouched.')
