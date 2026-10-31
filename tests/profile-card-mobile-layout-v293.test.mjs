import test from 'node:test';
import assert from 'node:assert/strict';
import {browserLayoutDependencies,renderMobileLayoutMatrix} from '../scripts/render-profile-card-layout-v293.mjs';

const dependencies=browserLayoutDependencies(),skip=dependencies.available?false:'Real Chromium/Playwright, KaTeX and Noto Sans JP are required';
let rendered;
const matrix=()=>rendered??=renderMobileLayoutMatrix();

test('real mobile Chromium keeps thin profile and summary boxes within the article and compact at normal note font sizes',{skip},async()=>{
 const report=await matrix(),current=report.cases.filter(row=>row.variant==='current');assert.equal(current.length,144);
 const failed=current.filter(row=>row.failures.length).map(({width,theme,mathFontPx,content,sample,failures,boxHeight,thumbnailHeight})=>({width,theme,mathFontPx,content,sample,failures,boxHeight,thumbnailHeight}));
 assert.deepEqual(failed,[],'Measured Chromium geometry failed: '+JSON.stringify(failed.slice(0,8)));
 assert.ok(report.engine.startsWith('Chromium '));assert.ok(current.every(row=>row.japaneseFontLoaded&&!row.parseError&&!row.qualityFault));
 for(const row of current){const old=report.cases.find(previous=>previous.variant==='baseline_v292'&&previous.width===row.width&&previous.theme===row.theme&&previous.mathFontPx===row.mathFontPx&&previous.content===row.content&&previous.sample===row.sample);assert.equal(row.sourceText,old.sourceText,'responsive layout must preserve the existing presentation excerpt')}
 assert.equal(current.filter(row=>row.status==='passed').length,96);assert.equal(current.filter(row=>row.status==='expectedCandidate').length,48);
 for(const row of current.filter(row=>row.mathFontPx===32))assert.ok(row.qualityFindings.some(finding=>finding.status==='candidate'&&['紹介の実文字サイズ','紹介の表示高さ'].includes(finding.check)),'32px inherited-font limitation must be measured and recorded');
});

test('the actual v2.9.2 negative control demonstrably fails mobile width and height checks',{skip},async()=>{
 const report=await matrix(),previous=report.cases.filter(row=>row.variant==='baseline_v292');assert.equal(previous.length,144);
 for(const width of [320,360,390,430]){
  const cases=previous.filter(row=>row.width===width&&row.mathFontPx===32);
  assert.ok(cases.some(row=>row.overflowRightPx>1||row.scrollOverflowPx>1),'The v2.9.2 width-negative control must fail at '+width+'px');
  assert.ok(cases.some(row=>row.failures.some(reason=>reason.includes('visible formula exceeds')||reason.includes('scrolls beyond'))),'The actual width assertion must reject the historical control at '+width+'px');
  assert.ok(cases.some(row=>row.boxHeight>row.thumbnailHeight*1.5+2),'The v2.9.2 height-negative control must fail at '+width+'px');
 }
 assert.notEqual(report.sourceSha256.current,report.sourceSha256.baseline_v292,'the repaired output must differ from its historical failing control');
});
