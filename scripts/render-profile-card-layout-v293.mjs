// Real Chromium geometry for the exported presentation formula and real KaTeX.
// This harness never loads user screenshots, accounts, or the note service.
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const modules=[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,join(root,'node_modules'),join(root,'..','quality-deps','node_modules')].filter(Boolean);
function dependency(name,override){
 if(override)return require(override);
 try{return require(name)}catch{}
 for(const directory of modules)try{return createRequire(join(directory,'package.json'))(name)}catch{}
 return null;
}
function packageRoot(name,override){
 if(override){const path=require.resolve(override);let directory=dirname(path);while(directory!==dirname(directory)){if(existsSync(join(directory,'package.json')))return directory;directory=dirname(directory)}}
 try{return dirname(require.resolve(name+'/package.json'))}catch{}
 for(const directory of modules)try{return dirname(createRequire(join(directory,'package.json')).resolve(name+'/package.json'))}catch{}
 return null;
}
export function browserLayoutDependencies(){
 const playwright=dependency('playwright',process.env.PLAYWRIGHT_TEST_MODULE),katexRoot=packageRoot('katex',process.env.KATEX_TEST_MODULE);
 const executablePath=[process.env.CHROMIUM_TEST_EXECUTABLE,playwright?.chromium.executablePath(),join(root,'..','content293-qa','chromium')].find(path=>path&&existsSync(path));
 const japaneseFont=[process.env.PROFILE_LAYOUT_JP_FONT,join(root,'..','font-qa','NotoSansJP.ttf')].find(path=>path&&existsSync(path));
 return{playwright,katexRoot,executablePath,japaneseFont,available:!!(playwright&&katexRoot&&executablePath&&japaneseFont)};
}
export const mobileLayoutCases={widths:[320,360,390,430],themes:['light','dark'],mathFontPx:[16,20,32],contents:['profile','summary'],texts:{
 japanese:'文章とデザインを通じて、毎日の暮らしに小さな発見を届けています。生成AIの活用と創作の工夫、仕事で学んだことを丁寧に記録します。読みやすい言葉を大切にしながら、自分らしい表現を探しています。'.repeat(2),
 wide_ascii:'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
 manual_lines:'暮らしの記録と創作の話🌸。\n読みやすい文章を考えます。\nAI / Web / Design の工夫✨。\n自然な改行を大切にします。\n長い説明は抜粋して紹介します。'
}};
const launchArgs=['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--disable-gpu-compositing','--use-gl=disabled','--no-zygote','--single-process'];
const sha256=code=>createHash('sha256').update(code).digest('hex');
function previewHtml(){return`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/katex.min.css"><style>
@font-face{font-family:MobileQAJP;src:url('/NotoSansJP.ttf') format('truetype');font-display:block}
*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:MobileQAJP,sans-serif;background:#fff;color:#17212c}body[data-theme="dark"]{background:#10181e;color:#f0f3f5}
.case-label{font:11px/1.4 MobileQAJP,sans-serif;padding:7px 16px;overflow-wrap:anywhere;opacity:.75}.article{width:100%;padding:0 16px 24px}.math-container{width:100%;overflow:visible;line-height:1.6}.katex .text,.katex .text *{font-family:KaTeX_Main,MobileQAJP,serif}.thin-thumbnail{display:block;width:100%;height:auto;aspect-ratio:860/140}.caption{font:13px/1.5 MobileQAJP,sans-serif;margin:6px 0 0}hr{border:0;border-top:1px solid currentColor;opacity:.3;margin:14px 0}
</style><script src="/katex.min.js"></script></head><body><div class="case-label"></div><main class="article"><div class="math-container"></div><img class="thin-thumbnail" alt="Anonymous thin thumbnail" width="860" height="140"><p class="caption">匿名の作者さん</p><hr></main></body></html>`}
const thumbnail='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="860" height="140" viewBox="0 0 860 140"><rect x="2" y="2" width="856" height="136" rx="10" fill="#203649" stroke="#fff" stroke-width="3"/><circle cx="63" cy="70" r="39" fill="#d2e0e7"/><rect x="590" y="10" width="258" height="120" rx="8" fill="#9cb5c1"/><text x="125" y="63" fill="white" font-family="sans-serif" font-size="27">Anonymous author</text><text x="125" y="96" fill="#c7d8e2" font-family="sans-serif" font-size="18">860 × 140 thin thumbnail</text></svg>');

export function layoutFailures(result){
 const failures=[];
 if(result.parseError)failures.push('KaTeX parse error: '+result.parseError);
 if(result.variant==='current'&&result.qualityFault)failures.push('the real measured inspector entered its failure fallback');
 if(!result.japaneseFontLoaded)failures.push('Japanese test font did not load');
 if(result.overflowRightPx>1||result.overflowLeftPx>1)failures.push('visible formula exceeds article content by '+Math.max(result.overflowRightPx,result.overflowLeftPx).toFixed(2)+'px');
 if(result.scrollOverflowPx>1)failures.push('formula content scrolls beyond its container by '+result.scrollOverflowPx.toFixed(2)+'px');
 if(result.mathFontPx<=20&&result.boxHeight>141)failures.push('normal-note profile box exceeds the 140px compact-height target');
 if(result.mathFontPx<=20&&result.maxGlyphFontPx>14.1)failures.push('normal-note visible glyphs exceed the 14px target');
 if(result.variant==='current'&&result.mathFontPx===32&&(result.maxGlyphFontPx>14.1||result.boxHeight>141)&&!result.qualityFindings?.some(finding=>finding.status==='candidate'&&['紹介の実文字サイズ','紹介の表示高さ'].includes(finding.check)))failures.push('oversized inherited-font case lacks a real measured quality candidate');
 return failures;
}

export async function renderMobileLayoutMatrix({outputDir=null,screenshots=false,cases=mobileLayoutCases,currentCode=null,baselineCode=null,qualityCode=null}={}){
 const deps=browserLayoutDependencies();if(!deps.available)throw Error('Real Chromium, Playwright, KaTeX and Noto Sans JP are required. Configure CHROMIUM_TEST_EXECUTABLE, PLAYWRIGHT_TEST_MODULE, KATEX_TEST_MODULE and PROFILE_LAYOUT_JP_FONT.');
 currentCode??=readFileSync(join(root,'public/note-profile-card-paster-content-v292.js'),'utf8');
 baselineCode??=execFileSync('git',['show','410c7d4:public/note-profile-card-paster-content-v292.js'],{cwd:root,encoding:'utf8',maxBuffer:1e6});
 qualityCode??=readFileSync(join(root,'public/note-profile-card-paster-quality-v290.js'),'utf8');
 const assets=new Map([['/katex.min.css',join(deps.katexRoot,'dist/katex.min.css')],['/katex.min.js',join(deps.katexRoot,'dist/katex.min.js')],['/NotoSansJP.ttf',deps.japaneseFont]]);
 const server=createServer((request,response)=>{
  const path=new URL(request.url,'http://localhost').pathname;
  if(path==='/'||path==='/notes/nmobile2930000/edit'){response.setHeader('Content-Type','text/html; charset=utf-8');response.end(previewHtml());return}
  const font=path.match(/^\/fonts\/([A-Za-z0-9_.-]+)$/),file=assets.get(path)||(font?join(deps.katexRoot,'dist/fonts',font[1]):null);
  if(!file||!existsSync(file)){response.writeHead(404);response.end();return}
  response.setHeader('Content-Type',extname(file)==='.css'?'text/css':extname(file)==='.js'?'text/javascript':extname(file)==='.ttf'?'font/ttf':extname(file)==='.woff2'?'font/woff2':'font/woff');response.end(readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 let browser;const results=[];
 try{
  browser=await deps.playwright.chromium.launch({headless:true,executablePath:deps.executablePath,ignoreDefaultArgs:['--enable-unsafe-swiftshader'],args:launchArgs});
  const page=await browser.newPage({viewport:{width:430,height:1000},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await page.goto(origin+'/notes/nmobile2930000/edit');await page.evaluate(()=>document.fonts.ready);
  for(const [variant,code]of [['baseline_v292',baselineCode],['current',currentCode]]){
   await page.addScriptTag({content:code});
   for(const width of cases.widths){await page.setViewportSize({width,height:1000});for(const theme of cases.themes)for(const mathFontPx of cases.mathFontPx)for(const content of cases.contents)for(const [sample,text]of Object.entries(cases.texts)){
    const result=await page.evaluate(async input=>{
     // Each viewport/font combination represents an independent editor page.
     // A previous scenario's deliberate fault must not disable this one.
     if(input.variant==='current'){delete window.__MUMEI_PROFILE_CARD_QUALITY__;(0,eval)(input.qualityCode)}
     document.body.dataset.theme=input.theme;document.querySelector('.case-label').textContent=input.variant+' · '+input.width+'px · '+input.theme+' · inherited math '+input.mathFontPx+'px · '+input.content+' · '+input.sample;
     const article=document.querySelector('.article'),container=document.querySelector('.math-container'),image=document.querySelector('.thin-thumbnail');container.style.fontSize=input.mathFontPx+'px';image.src=input.thumbnail;
     const api=window.__MUMEI_PROFILE_CARD_CONTENT__,row={urlname:'anonymous_writer',key:'n0123456789ab',url:'https://note.com/anonymous_writer/n/n0123456789ab',creator:'匿名の作者'},note={key:row.key,noteUrl:row.url,user:{urlname:row.urlname},price:0,body:input.text},profile={urlname:row.urlname,profile:input.text};
     row.presentation=api.compose(row,note,profile,{size:'thin',content:input.content});
     const articleStyle=getComputedStyle(article),articleRect=article.getBoundingClientRect(),left=articleRect.left+parseFloat(articleStyle.paddingLeft),right=articleRect.right-parseFloat(articleStyle.paddingRight),layout=api.aboveLayout?.(row,right-left,input.mathFontPx)||null,formula=api.aboveText(row,right-left,input.mathFontPx);
     let parseError='';try{window.katex.render(formula.replace(/^\$\$|\$\$$/g,''),container,{displayMode:true,throwOnError:true,strict:'ignore'})}catch(error){parseError=error.message;container.textContent=error.message}
     await document.fonts.ready;await image.decode();
     const html=container.querySelector('.katex-html'),box=html?.getBoundingClientRect(),visible=[],textRects=[],glyphFonts=[];
     if(html){for(const node of html.querySelectorAll('*')){const rect=node.getBoundingClientRect();if(rect.width>0&&rect.height>0&&getComputedStyle(node).visibility!=='hidden')visible.push(rect)}
      const walker=document.createTreeWalker(html,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))if(node.textContent.trim()){const range=document.createRange();range.selectNodeContents(node);for(const rect of range.getClientRects())if(rect.width>0&&rect.height>0){visible.push(rect);textRects.push(rect)}const font=parseFloat(getComputedStyle(node.parentElement).fontSize);if(Number.isFinite(font))glyphFonts.push(font)}}
     const visibleLeft=visible.length?Math.min(...visible.map(rect=>rect.left)):left,visibleRight=visible.length?Math.max(...visible.map(rect=>rect.right)):right,thumb=image.getBoundingClientRect(),display=container.querySelector('.katex-display'),displayStyle=display?getComputedStyle(display):null;
     const paragraph={type:{name:'paragraph'},textContent:formula},imageNode={type:{name:'image'},attrs:{link:row.url},nodeSize:1},view={dom:article,state:{doc:{nodeAt:pos=>pos===0?paragraph:pos===1?imageNode:null}},nodeDOM:pos=>pos===0?container:pos===1?image:null},quality=input.variant==='current'?window.__MUMEI_PROFILE_CARD_QUALITY__:null;
     window.__MUMEI_PROFILE_CARD_RUN_STORE__={read:()=>({articleKey:'nmobile2930000',rows:[row],presentationTexts:{[row.url]:formula},presentationPositions:{[row.url]:0},presentationLayouts:{[row.url]:layout}})};
     quality?.presentationAt?.(row,view,{pos:0,text:formula,layout});quality?.presentationPasted?.(row,view,{pos:1,node:imageNode});const inspection=quality?.snapshot?.(),qualityFindings=inspection?.records.at(-1)?.findings||[];
     const heightRects=box?[box,...textRects]:textRects,boxHeight=heightRects.length?Math.max(...heightRects.map(rect=>rect.bottom))-Math.min(...heightRects.map(rect=>rect.top)):0;
     return{...input,text:undefined,thumbnail:undefined,qualityCode:undefined,formula,sourceText:row.presentation.text,layout,parseError,qualityFindings,qualityFault:inspection?.fault||false,japaneseFontLoaded:document.fonts.check('16px MobileQAJP'),articleContentWidth:right-left,articleLeft:left,articleRight:right,visibleLeft,visibleRight,overflowLeftPx:Math.max(0,left-visibleLeft),overflowRightPx:Math.max(0,visibleRight-right),scrollOverflowPx:Math.max(0,container.scrollWidth-container.clientWidth),boxHeight,katexHtmlHeight:box?.height||0,maxGlyphFontPx:glyphFonts.length?Math.max(...glyphFonts):null,thumbnailHeight:thumb.height,boxToThumbnailRatio:boxHeight/thumb.height,nativeTopMarginPx:parseFloat(displayStyle?.marginTop)||0,nativeBottomMarginPx:parseFloat(displayStyle?.marginBottom)||0,mathContainerHeight:container.getBoundingClientRect().height,formulaToImageGap:box?thumb.top-box.bottom:0};
    },{variant,width,theme,mathFontPx,content,sample,text,thumbnail,qualityCode:variant==='current'?qualityCode:''});
    result.failures=layoutFailures(result);result.status=result.failures.length?'failed':result.mathFontPx===32&&(result.maxGlyphFontPx>14.1||result.boxHeight>141)?'expectedCandidate':'passed';results.push(result);
    if(screenshots&&outputDir&&[20,32].includes(mathFontPx)&&sample==='japanese'&&content==='profile'&&[320,430].includes(width)){
     mkdirSync(outputDir,{recursive:true});const filename=variant+'-'+width+'-'+theme+'-font'+mathFontPx+'.png',article=await page.locator('.article').boundingBox();
     // Capture the actual phone viewport, including any historical clipping.
     // A full-page screenshot would expand to the old overflowing formula.
     await page.screenshot({path:join(outputDir,filename),clip:{x:0,y:0,width,height:Math.min(1000,Math.ceil(article.y+article.height+8))}});result.screenshot=filename;
    }
   }}
  }
  const report={engine:'Chromium '+await browser.version(),generatedAt:new Date().toISOString(),method:'Actual exported compose/aboveText, actual KaTeX JS/CSS/fonts, real Chromium layout and Noto Sans JP; no user material or live service. No forced KaTeX font size, overflow clipping, transforms or scaling. All parent sizes require width containment; normal 16/20px parents require visible glyphs <=14px and box height <=140px. An adversarial 32px parent must record a measured quality candidate when oversized, rather than claiming a balanced pass. The image-height ratio is reported without discarding source text.',scope:'Presentation rendering and real DOM inspection only. The anonymous thin-thumbnail placeholder and example divider supply layout context; native uploads, divider insertion and editor transactions are tested separately.',sourceSha256:{current:sha256(currentCode),baseline_v292:sha256(baselineCode),quality:sha256(qualityCode)},baselineCommit:'410c7d4',cases:results,summary:{currentCases:results.filter(row=>row.variant==='current').length,currentPassed:results.filter(row=>row.variant==='current'&&row.status==='passed').length,currentExpectedCandidates:results.filter(row=>row.variant==='current'&&row.status==='expectedCandidate').length,currentFailures:results.filter(row=>row.variant==='current'&&row.failures.length).length,baselineCases:results.filter(row=>row.variant==='baseline_v292').length,baselineFailures:results.filter(row=>row.variant==='baseline_v292'&&row.failures.length).length}};
  if(outputDir){mkdirSync(outputDir,{recursive:true});writeFileSync(join(outputDir,'layout-report.json'),JSON.stringify(report,null,2)+'\n')}
  return report;
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const outputDir=resolve(process.argv[2]||join(root,'docs/profile-card-quality/mobile-layout-v293'));
 const report=await renderMobileLayoutMatrix({outputDir,screenshots:true});console.log(JSON.stringify({outputDir,engine:report.engine,sourceSha256:report.sourceSha256,summary:report.summary},null,2));
 if(report.summary.currentFailures)process.exitCode=1;
}
