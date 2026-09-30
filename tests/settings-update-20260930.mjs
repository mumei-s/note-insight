import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import { chromium, firefox, webkit } from 'playwright';

const out = 'test-results/settings-update-20260930';
await fs.mkdir(out, { recursive: true });
const read = p => fs.readFile(p, 'utf8');
const live = await read('src/member-insight-live-v2.tsx');
const api = await read('src/api.ts');
const release = JSON.parse(await read('public/insight-release.json'));
const manifestSource = await read('src/insight-release.ts');
const results = { testedAt: new Date().toISOString(), mode: process.argv.includes('--live') ? 'public-delivery' : 'local-mocked-ui', assertions: 0, engines: [], scope: 'Browser engines, synthetic account/version state; not participant devices or extension-manager installation confirmation.' };
function check(actual, expected, label) { assert.deepEqual(actual, expected, label); results.assertions++; }
function ok(value, label) { assert.ok(value, label); results.assertions++; }
check(release.appVersion, '2026.09.30.8', 'app release');
ok(manifestSource.includes(`CURRENT_INSIGHT_APP_VERSION = "${release.appVersion}"`), 'source/manifest coherence');
ok(!live.includes('{dashboardUpdateAvailable||dashboardMissing?<a className="miv5-source-main"'), 'analysis always opens feature');
ok(live.includes('onClick={()=>openMode("analysis")} aria-label='), 'analysis feature handler preserved');
ok(live.includes('onClick={()=>openMode("notifications")}'), 'notification feature handler preserved');
for (const [file, expected] of [['note-insight-notification-v3.user.js', release.notificationVersion], ['note-insight-dashboard-sync.user.js', release.dashboardVersion], ['note-insight-dm.user.js', release.dmVersion]]) {
 const text = await read('public/' + file);
 check(text.match(/@version\s+([^\s]+)/)?.[1], expected, file + ' metadata version');
 ok(/@(?:download|update)URL\s+https:\/\/mumei-s.github.io\/note-insight\//.test(text), file + ' update source');
}

if (process.argv.includes('--live')) {
 const root = 'https://mumei-s.github.io/note-insight/';
 const html = await read('dist/index.html');
 const assets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"?#]+\.(?:js|css))"/g)].map(m => m[1]);
 ok(assets.length >= 2, 'built JS/CSS links');
 for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
   const request = context.request;
   const r = await request.get(root + 'insight-release.json?verify=' + Date.now(), { headers: { 'Cache-Control': 'no-cache' } });
   check(r.status(), 200, name + ' live release status');
   check((await r.json()).appVersion, release.appVersion, name + ' live release version');
   const sw = await request.get(root + 'sw.js?verify=' + Date.now());
   check(sw.status(), 200, name + ' live SW status');
   check(await sw.text(), await read('public/sw.js'), name + ' exact SW content');
   const home = await request.get(root + '?insightAppVersion=' + release.appVersion);
   check(home.status(), 200, name + ' live shell status');
   const homeText = await home.text();
   for (const asset of assets) {
    ok(homeText.includes(asset), name + ' current hashed asset referenced');
    const a = await request.get(new URL(asset, root).href);
    check(a.status(), 200, name + ' asset status');
    const file = 'dist/assets/' + path.basename(asset);
    const hash = b => crypto.createHash('sha256').update(b).digest('hex');
    check(hash(await a.body()), hash(await fs.readFile(file)), name + ' deployed asset byte equality');
   }
   for (const [file, expected] of [['note-insight-notification-v3.user.js', release.notificationVersion], ['note-insight-dashboard-sync.user.js', release.dashboardVersion]]) {
    const response = await request.get(root + file + '?verify=' + Date.now());
    check(response.status(), 200, name + ' userscript status');
    check((await response.text()).match(/@version\s+([^\s]+)/)?.[1], expected, name + ' userscript version');
   }
   // Render only the release document: no participant authentication or backend sync is exercised.
   const page = await context.newPage();
   await page.goto(root + 'insight-release.json?browser=' + name + '&verify=' + Date.now());
   ok((await page.locator('body').innerText()).includes(release.appVersion), name + ' actual browser document load');
   results.engines.push({ name, version: browser.version(), delivery: 'passed', participantLogin: 'not tested' });
  } finally { await context.close(); await browser.close(); }
 }
 await fs.writeFile(out + '/live.json', JSON.stringify(results, null, 2));
 console.log(JSON.stringify(results, null, 2));
 process.exit(0);
}

const compile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/export\s*\{\s*\};?/g, '');
const topJs = compile(await read('src/insight-top-install-v16.ts'));
const inlineJs = compile(await read('src/insight-inline-updates-v1.ts'));
const baseCss = await read('src/member-insight-live-v2.css');
const updateStart = live.indexOf('  async function updateInsightApp(){');
const updateAction = live.slice(updateStart, live.indexOf('  useEffect(()=>{', updateStart)).replaceAll('import.meta.env.BASE_URL', '"/note-insight/"');
ok(updateStart > 0 && updateAction.includes('insightAppVersion'), 'exercise actual app update function');
const registration = compile(api.slice(api.indexOf('export function registerServiceWorker()')).replace('export ', '').replaceAll('import.meta.env.BASE_URL', '"/note-insight/"'));
const swSource = await read('public/sw.js');
let sawNoCache = false;
const inline = code => code.replace(/<\/script/gi, '<\\/script');
const fixture = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#101b28;color:white;font-family:system-ui}button,a{box-sizing:border-box}${baseCss}</style><body>
<section class="miv5-update"><div class="miv5-source-grid">
<div class="miv5-source-card normal"><button class="miv5-source-main"><strong>通常データ</strong><small>公開記事・スキを再取得</small></button></div>
<div class="miv5-source-card dashboard needs-update"><button class="miv5-source-main" onclick="window.testMode='analysis'"><strong>📊 分析</strong><small>ダッシュボード v1.6.3</small><span>公式ダッシュボード＋INSIGHT</span><em>更新あり</em></button><a class="miv5-install-link miv5-dashboard-settings" href="./dashboard-setup.html?from=analysis">設定</a></div>
<div class="miv5-source-card notice needs-update"><button class="miv5-source-main" onclick="window.testMode='notifications'"><strong>🔔 本人通知</strong><small>この端末 v3.6.19</small><span>通知履歴・追加分析</span><em>更新あり</em></button><a class="miv5-install-link" href="./tool-setup.html">設定</a></div>
</div></section><div class="miu"><a href="https://note.com/test_fixture">@test_fixture</a></div>
<button id="app-update" onclick="updateInsightApp()">本体更新テスト</button><p id="feedback"></p>
<script>window.testMode='normal';localStorage.setItem('test-preserved-history','do-not-delete');localStorage.setItem('mumei-insight-access-token','synthetic-token-only');sessionStorage.setItem('test-preserved-session','keep');
window.addEventListener('message',e=>{const d=e.data;if(e.origin!==location.origin)return;for(const [source,bridge]of [['mumei-notification-feature-ui-v1','mumei-notification-feature-bridge-v1'],['mumei-dashboard-feature-ui-v1','mumei-dashboard-feature-bridge-v1']]){if(d?.source===source){const enabled=d.type==='set'?d.enabled:true;window.postMessage({source:bridge,type:'state',enabled},location.origin)}}});</script>
<script>${inline(topJs)}</script><script>${inline(inlineJs)}</script>
<script>${inline(registration)}registerServiceWorker();
let appBusy=false;const CURRENT_INSIGHT_APP_VERSION='2026.09.30.7';const APP_UPDATE_RESULT_KEY='mumei-insight-app-update-result';
function setAppBusy(v){appBusy=v}function showAppFeedback(v){document.getElementById('feedback').textContent=v}
async function checkRelease(){return fetch('./insight-release.json?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json())}
function versionDiffers(a,b){return a!==b}const sleep=ms=>new Promise(r=>setTimeout(r,ms));
${inline(updateAction)}</script></body></html>`;

const server = http.createServer((req, res) => {
 const url = new URL(req.url, 'http://127.0.0.1');
 const relative = url.pathname.replace(/^\/note-insight\//, '');
 res.setHeader('Cache-Control', 'public, max-age=600');
 if (relative === 'sw.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(swSource); }
 if (relative === 'insight-release.json') {
  if (/no-cache|no-store|max-age=0/.test(req.headers['cache-control'] || '')) sawNoCache = true;
  res.setHeader('Content-Type', 'application/json');return res.end(JSON.stringify(release));
 }
 if (relative === 'manifest.webmanifest') { res.setHeader('Content-Type', 'application/manifest+json');return res.end('{}'); }
 if (relative === 'favicon.svg') { res.setHeader('Content-Type', 'image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg"/>'); }
 if (['', 'index.html', 'fixture.html', 'recovery.html', 'dashboard-setup.html', 'tool-setup.html', 'notification-update.html'].includes(relative)) { res.setHeader('Content-Type', 'text/html; charset=utf-8');return res.end(fixture); }
 res.statusCode = 404;res.end('not found');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
 for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch({ headless: true });
  try {
   for (const width of [360, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 840 } });
    const page = await context.newPage();
    const errors=[];page.on('pageerror', e=>errors.push(e.message));
    try {
     await page.goto(origin + '/note-insight/index.html#dashboard');
     await page.waitForFunction(()=>document.querySelectorAll('[data-update-state="available"]').length===2);
     await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
     const settings = page.locator('.miv5-update a.mumei-canonical-install');
     check(await settings.count(),2,name+' exactly two settings controls');
     check(await settings.allTextContents(),['更新','更新'],name+' equal labels');
     const visual=await settings.evaluateAll(nodes=>nodes.map(n=>({color:getComputedStyle(n).backgroundColor,shadow:getComputedStyle(n).boxShadow,label:n.getAttribute('aria-label'),fits:n.scrollWidth<=n.clientWidth+1})));
     ok(visual.every(v=>v.color==='rgb(182, 255, 56)'&&v.shadow!=='none'),name+' settings steady glow');
     ok(visual.every(v=>v.label.includes('更新があります')&&v.fits),name+' accessible label and fit '+width);
     const mainColors=await page.locator('.dashboard>.miv5-source-main,.notice>.miv5-source-main').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).borderTopColor));
     check(mainColors,['rgb(65, 106, 131)','rgb(119, 99, 58)'],name+' large cards not glowing');
     await page.locator('.dashboard>.miv5-source-main').click();
     check(await page.evaluate(()=>window.testMode),'analysis',name+' analysis feature remains usable');
     await page.locator('.notice>.miv5-source-main').click();
     check(await page.evaluate(()=>window.testMode),'notifications',name+' notice feature remains usable');
     check(new URL(await page.locator('.dashboard a.mumei-canonical-install').getAttribute('href'),page.url()).pathname,'/note-insight/dashboard-setup.html',name+' dashboard setup destination');
     await page.screenshot({path:out+'/'+name+'-'+width+'-update.png',fullPage:true});
     await page.evaluate(()=>document.querySelectorAll('.needs-update').forEach(n=>n.classList.remove('needs-update')));
     await page.waitForFunction(()=>document.querySelectorAll('[data-update-state="current"]').length===2);
     check(await settings.allTextContents(),['設定','設定'],name+' labels reset on confirmed current versions');
     const latestColors=await settings.evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));
     ok(latestColors.every(v=>v!=='rgb(182, 255, 56)'),name+' current versions no update glow');
     await page.evaluate(()=>document.querySelectorAll('.dashboard,.notice').forEach(n=>n.classList.add('needs-install')));
     await page.waitForFunction(()=>document.querySelectorAll('[data-update-state="missing"]').length===2);
     ok((await settings.allTextContents()).every(x=>x==='設定'),name+' missing distinct from update');
     await page.evaluate(async()=>{for(let i=0;i<8;i++)await fetch('./insight-release.json?ts='+Date.now()+'-'+i,{cache:'no-store'})});
     const cacheURLs=await page.evaluate(async()=>{const names=(await caches.keys()).filter(n=>n.startsWith('mumei-note-insight-'));return(await Promise.all(names.map(async n=>(await(await caches.open(n)).keys()).map(r=>r.url)))).flat()});
     ok(cacheURLs.every(u=>!u.includes('insight-release.json')),name+' manifests never cached');
     check(await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return r.updateViaCache}),'none',name+' SW bypasses HTTP cache');
     await context.setOffline(true);
     check(await page.evaluate(()=>fetch('./insight-release.json?offline=1',{cache:'no-store'}).then(()=>false,()=>true)),true,name+' offline cannot fake fresh release');
     await page.reload();
     ok((await page.locator('body').innerText()).includes('通常データ'),name+' cached app shell survives offline');
     check(await page.evaluate(()=>localStorage.getItem('test-preserved-history')),'do-not-delete',name+' history preserved');
     await context.setOffline(false);
     await page.evaluate(()=>window.dispatchEvent(new Event('online')));
     await page.locator('#app-update').click();
     await page.waitForURL(u=>u.searchParams.get('insightAppVersion')===release.appVersion);
     check(new URL(page.url()).hash,'#dashboard',name+' update preserves route');
     check(await page.evaluate(()=>localStorage.getItem('mumei-insight-access-token')),'synthetic-token-only',name+' login token untouched');
     check(await page.evaluate(()=>sessionStorage.getItem('test-preserved-session')),'keep',name+' session untouched');
     check(await page.evaluate(()=>sessionStorage.getItem('mumei-insight-app-update-result')),release.appVersion,name+' expected version checkpoint');
     check(errors,[],name+' no JavaScript errors');
     results.engines.push({name,version:browser.version(),width,status:'passed'});
    } catch(e) { await page.screenshot({path:out+'/'+name+'-'+width+'-failure.png',fullPage:true}).catch(()=>{}); throw e; }
    finally { await context.close(); }
   }
  } finally { await browser.close(); }
 }
 ok(sawNoCache,'release checks use no-cache/no-store');
 await fs.writeFile(out+'/local.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
} finally { await new Promise(resolve=>server.close(resolve)); }
