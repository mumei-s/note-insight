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

p=Path('tests/settings-update-20260930.mjs')
s=p.read_text()
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
p.write_text(s)
print('Finished card badge removal and stricter browser tests; participant data untouched.')
