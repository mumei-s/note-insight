// Run explicitly with a local Chromium and Playwright; no live account or API.
// PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs CHROMIUM_PATH=/usr/bin/chromium node --test tests/outgoing-comment-two-tap.browser.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const code = 'a'.repeat(32), noteUrl = `https://note.com/self?mumei_own_comment_scope=${code}&mumei_account=self`;
let server, browser, base;
before(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 }, base: '/' }); await server.listen();
  base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); await server?.close(); });
const consentResult = extra => ({ok:true,noteId:'self',pairingCode:code,expiresAt:new Date(Date.now()+600000).toISOString(),noteUrl,...extra});
async function app(t, { response = consentResult(), hold = false } = {}) {
  const context = await browser.newContext(), page = await context.newPage(); t.after(()=>context.close());
  let calls=0, pending;
  await context.route('**/*', async route => {
    const url=route.request().url();
    if(url.startsWith(base)) return route.continue();
    if(url.startsWith('https://note.com/')) return route.fulfill({contentType:'text/html',body:'<!doctype html><body>mock note</body>'});
    if(url.includes('/functions/v1/')) {
      const body=route.request().postDataJSON();
      if(body.action==='own-comment-consent-start') {calls++; if(hold){pending=route;return;} return route.fulfill({json:response});}
      return route.fulfill({json:{ok:true,noteId:'self',rows:[],hasMore:false,permission:{enabled:false,activeDeviceCount:0}}});
    }
    return route.abort();
  });
  await page.goto(base+'/tests/fixtures/own-comment-consent.html');
  await page.locator('.mioc > summary').click(); await page.locator('.mioc-permission > summary').click();
  return {page,get calls(){return calls;},resolve:async()=>{try {await pending.fulfill({json:response});} catch(error) {if(!/closed|disposed|aborted/i.test(String(error)))throw error;}}};
}
test('one trusted INSIGHT click navigates same tab; synthetic click cannot request consent', async t=>{
  const h=await app(t); assert.equal(await h.page.locator('input[type=checkbox]').count(),0);
  await h.page.getByRole('button',{name:'同意してnoteへ進む'}).evaluate(el=>el.click()); assert.equal(h.calls,0);
  await h.page.getByRole('button',{name:'同意してnoteへ進む'}).click(); await h.page.waitForURL(noteUrl);
  assert.equal(h.calls,1); assert.equal(h.page.context().pages().length,1);
});
test('trusted double tap sends one request; cancel and late response never navigate',async t=>{
  const h=await app(t,{hold:true}); await h.page.getByRole('button',{name:'同意してnoteへ進む'}).dblclick();
  await h.page.getByRole('button',{name:'設定を中止'}).waitFor(); assert.equal(h.calls,1);
  await h.page.getByRole('button',{name:'設定を中止'}).click(); await h.resolve();
  await h.page.getByRole('button',{name:'同意してnoteへ進む'}).waitFor({state:'visible'});
  assert.ok(h.page.url().startsWith(base)); assert.equal(await h.page.locator('.mioc-handoff').count(),0);
});
test('account/session switch during consent cannot navigate',async t=>{
  const h=await app(t,{hold:true});await h.page.getByRole('button',{name:'同意してnoteへ進む'}).click();
  await h.page.getByRole('button',{name:'設定を中止'}).waitFor();
  await h.page.evaluate(()=>{localStorage.setItem('mumei-insight-access-token','other-session');window.dispatchEvent(new Event('storage'));});
  await h.resolve(); await h.page.waitForFunction(()=>document.querySelector('.mioc')?.open===false); assert.ok(h.page.url().startsWith(base)); assert.equal(await h.page.locator('.mioc-handoff').count(),0);
});
for(const [name,change] of [ ['expired',{expiresAt:'2020-01-01T00:00:00Z'}], ['foreign origin',{noteUrl:noteUrl.replace('note.com','evil.example')}], ['wrong account',{noteId:'other'}], ['extra query',{noteUrl:noteUrl+'&token=secret'}], ['wrong path',{noteUrl:noteUrl.replace('/self?','/other?')}] ]) {
  test(`reject ${name} handoff without navigation`,async t=>{
    const h=await app(t,{response:consentResult(change)});await h.page.getByRole('button',{name:'同意してnoteへ進む'}).click();
    await h.page.getByRole('alert').waitFor(); assert.ok(h.page.url().startsWith(base));assert.equal(await h.page.locator('.mioc-handoff').count(),0);
  });
}
const readerSource=fs.readFileSync(new URL('../public/note-insight-outgoing-comment-reader-v1.js',import.meta.url),'utf8');
async function reader(t,{account='self',changedAccount=null,denied=false,storageFailure=false}={}) {
 const context=await browser.newContext(),page=await context.newPage();t.after(()=>context.close());
 await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
 await page.goto(noteUrl);
 await page.evaluate(({account,changedAccount,denied,storageFailure})=>{
  const permission='mumei_insight_own_comment_enabled_v1:self';
  window.fixture={calls:[],values:{['mumei_insight_notification_sync_token_v2:'+account]:'test-token'},reads:0,enabled:false};
  window.fetch=async()=>({ok:true,json:async()=>({data:{user:{urlname:++fixture.reads>1&&changedAccount?changedAccount:account}}})});
  window.GM={getValue:async(k,d)=>fixture.values[k]??d,setValue:async(k,v)=>{if(storageFailure)throw new Error('local storage unavailable');fixture.values[k]=v;},xmlHttpRequest(args){
   const body=JSON.parse(args.data);fixture.calls.push(body);queueMicrotask(()=>args.onload({status:denied&&body.action==='own-comment-scope-exchange'?401:200,responseText:JSON.stringify(denied&&body.action==='own-comment-scope-exchange'?{ok:false,error:'OWN_COMMENT_CONSENT_INVALID_OR_USED'}:{ok:true,enabled:true,account})}));
  }};
  window.__mumeiOutgoingCommentCaptureV1={indexedStore:()=>({pending:async()=>[]}),create:o=>{fixture.options=o;return{install:()=>true,drain:async()=>{}};}};
 },{account,changedAccount,denied,storageFailure});
 await page.evaluate(readerSource);await page.getByRole('button',{name:'このブラウザで自動保存を有効にする'}).waitFor();
 return {page,state:()=>page.evaluate(()=>({calls:fixture.calls,enabled:fixture.options.enabled(),values:fixture.values,reads:fixture.reads}))};
}
test('second trusted Reader click enables; landing and synthetic click do not; stop remains usable',async t=>{
 const h=await reader(t);assert.equal((await h.state()).calls.length,0);
 await h.page.getByRole('button',{name:'このブラウザで自動保存を有効にする'}).evaluate(el=>el.click()); assert.equal((await h.state()).calls.length,0);
 await h.page.getByRole('button',{name:'このブラウザで自動保存を有効にする'}).dblclick();
 await h.page.waitForFunction(()=>fixture.options.enabled());const state=await h.state();assert.equal(state.calls.length,1);assert.equal(state.calls[0].action,'own-comment-scope-exchange');assert.equal(state.calls[0].code,code);assert.equal(h.page.url(),'https://note.com/self');
 await h.page.getByRole('button',{name:'自動保存を停止',exact:true}).click();await h.page.waitForFunction(()=>!fixture.options.enabled());
 assert.equal((await h.state()).calls[1].action,'own-comment-scope-disable');assert.equal(await h.page.getByRole('button',{name:'このブラウザで自動保存を有効にする'}).isDisabled(),true);
});
for(const options of [{account:'other'},{changedAccount:'other'},{denied:true}]){
 test(`Reader fails closed ${JSON.stringify(options)}`,async t=>{const h=await reader(t,options);await h.page.getByRole('button',{name:'このブラウザで自動保存を有効にする'}).click();await h.page.locator('aside p').filter({hasText: options.account ? 'このアカウントの同意リンク' : '有効化を確認できません'}).waitFor();
 assert.equal((await h.state()).enabled,false);assert.equal((await h.state()).calls.length,options.denied?1:0);
 });
}
test('storage failure after grant permits explicit server revoke and never capture',async t=>{
 const h=await reader(t,{storageFailure:true});await h.page.getByRole('button',{name:'このブラウザで自動保存を有効にする'}).click();
 await h.page.getByText(/有効化を確認できません/).waitFor();assert.equal((await h.state()).enabled,false);
 await h.page.getByRole('button',{name:'自動保存を停止',exact:true}).click();
 await h.page.waitForFunction(()=>fixture.calls.some(x=>x.action==='own-comment-scope-disable'));
 assert.equal((await h.state()).enabled,false);
});
