import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {contentRuntime,transformCoreContent,transformEditorContent} from '../scripts/profile-card-content-v292.mjs';
import {instrumentCore,instrumentEditor} from '../scripts/profile-card-quality-instrument.mjs';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';
function helper(code=contentRuntime){const dom=new JSDOM(''),page={innerWidth:360};vm.runInNewContext(code,{window:page,document:dom.window.document,DOMParser:dom.window.DOMParser,Intl,localStorage:{getItem:()=>null,setItem(){}}});return{api:page.__MUMEI_PROFILE_CARD_CONTENT__,dom,page}}
const row=text=>({urlname:'example_creator',key:'n000000000001',url:'https://note.com/example_creator/n/n000000000001',creator:'変更しない名前✨',presentation:{version:1,size:'thin',content:'profile',text,status:'available',source:{kind:'profile',account:'example_creator'}}});
function previousFile(path){try{return execFileSync('git',['show','410c7d4:'+path],{encoding:'utf8',maxBuffer:2e6,stdio:['ignore','pipe','ignore']})}catch{return null}}
test('v293 uses tiny text and preserves the entire previously selected presentation source',()=>{
 const h=helper(),source='一文目です。\n\n二つの意図的な改行を保持します。'+('日本語のプロフィール原文です。'.repeat(5)),person=row(source),before=JSON.stringify(person),layout=h.api.aboveLayout(person,288,20);
 assert.ok(layout.text.startsWith('$${\\tiny\\boxed{'));assert.equal(JSON.stringify(person),before);assert.ok(layout.lines.includes(''));
 assert.equal(layout.lines.slice(1).join(''),source.replaceAll('\n',''));assert.equal(layout.maxFontPx,14);assert.equal(layout.maxHeightPx,140);assert.equal(layout.lineCount,layout.lines.length);h.dom.window.close();
});
test('viewport and inherited font both affect the budget, including large-font stress layouts',()=>{
 const h=helper(),person=row('幅を確認します。'.repeat(12)),small=h.api.aboveLayout(person,288,20),large=h.api.aboveLayout(person,288,32),wide=h.api.aboveLayout(person,390,20);
 assert.ok(large.cellBudget<small.cellBudget);assert.ok(wide.cellBudget>=small.cellBudget);assert.ok(large.cellBudget<=13);assert.ok(wide.cellBudget<=22);assert.equal(large.fontBasePx,32);h.dom.window.close();
});
test('long URLs and wide Latin glyphs wrap without removing source text',()=>{
 const h=helper(),source='https://example.com/'+('WWWWmmmm'.repeat(15))+'?from=source&next=another',layout=h.api.aboveLayout(row(source),240,32);
 assert.equal(layout.lines.slice(1).join(''),source);assert.equal(layout.wordSplitCandidate,true);assert.ok(layout.lines.length>5);assert.ok(layout.lines.slice(1).every(line=>line.length<source.length/2));h.dom.window.close();
});
test('grapheme clusters and ordinary Japanese kinsoku boundaries remain intact',()=>{
 const h=helper(),source='「絵文字👩🏽‍💻と日本語か\u3099を一緒に確認します」。これからも、読みやすく続けます。🇯🇵'.repeat(3),layout=h.api.aboveLayout(row(source),288,32),body=layout.lines.slice(1);
 assert.equal(body.join(''),source);assert.ok(body.every(line=>!/^\p{Mark}|^\u200d|\u200d$/u.test(line)));assert.ok(body.every(line=>!/[（「『\(]$/u.test(line)));assert.ok(body.every(line=>!/^[、。，．）」』\)]/u.test(line)));h.dom.window.close();
});
test('context measurement is limited to the editor container and subtracts its actual padding',()=>{
 const h=helper(),element=h.dom.window.document.createElement('div');element.style.cssText='font-size:20px;padding:0 16px;border:0';element.getBoundingClientRect=()=>({width:320});
 const context=h.api.presentationContext({dom:element});assert.equal(context.bodyWidthPx,288);assert.equal(context.fontBasePx,20);assert.equal(context.measured,true);assert.equal(h.dom.window.document.body.childNodes.length,0);h.dom.window.close();
});
test('a persisted contract reconstructs its literal even when the current viewport changes',()=>{
 const h=helper(),person=row('画面の回転後も、貼り付け済みの原文は勝手に変更しません。'.repeat(3)),layout=h.api.aboveLayout(person,308,20),contract=h.api.layoutContract(layout);
 assert.equal(h.api.matchesAboveText(person,layout.text,contract),true);assert.notEqual(h.api.aboveText(person,240,32),layout.text);assert.equal(h.api.matchesAboveText({...person,presentation:{...person.presentation,text:'内容が変わりました'}},layout.text,contract),false);assert.ok(!Object.prototype.hasOwnProperty.call(contract,'text'));assert.ok(!Object.prototype.hasOwnProperty.call(contract,'lines'));h.dom.window.close();
});
test('the exact v292 literal remains recognized without being rewritten',{skip:!previousFile('public/note-profile-card-paster-content-v292.js')?'v292 baseline is required':false},()=>{
 const old=helper(previousFile('public/note-profile-card-paster-content-v292.js')),current=helper(),person=row('以前の紹介文です。\nそのまま保存します。'),literal=old.api.aboveText(person);
 assert.equal(current.api.legacyAboveText(person),literal);assert.notEqual(current.api.aboveText(person),literal);assert.equal(current.api.matchesAboveText(person,literal),true);assert.equal(current.api.matchesAboveText({...person,presentation:{...person.presentation,text:'別の内容'}},literal),false);old.dom.window.close();current.dom.window.close();
});
test('content transformations still compose with all existing quality hooks',()=>{
 for(const [file,transform,instrument] of [['public/note-profile-card-paster-core-v232.js',transformCoreContent,instrumentCore],['public/note-profile-card-paster-v22.user.js',transformEditorContent,instrumentEditor]])assert.doesNotThrow(()=>new vm.Script(instrument(transform(readFileSync(file,'utf8')))));
});
const compiled=(name,fn)=>test(name,{skip:!dependencies||!previousFile('public/note-profile-card-likes300-fix-v220.user.js')?'PM, canvas and v292 baseline are required':false},fn);
compiled('actual v292 pending paragraphs stay literal while future pending rows use the new layout',async()=>{
 const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'})]]),old=await runtime({count:3,localStorageMap:local,moduleCode:previousFile('public/note-profile-card-likes300-fix-v220.user.js')});old.state.failAt=2;await old.history();const previous=old.editor.readRun(),oldLiterals={...previous.presentationTexts},sources=Array.from(previous.rows,person=>person.presentation?.text);
 const current=await old.reload({moduleCode:readFileSync('public/note-profile-card-likes300-fix-v220.user.js','utf8')});await current.history();const run=current.editor.readRun();assert.equal(run.stage,'images_ready',current.state.statuses.at(-1)?.text);assert.equal(run.items.length,4);
 for(const [url,literal] of Object.entries(oldLiterals))assert.equal(run.presentationTexts[url],literal);
 assert.ok(run.presentationTexts[run.rows[2].url].startsWith('$${\\tiny\\boxed{'));assert.equal(run.presentationLayouts[run.rows[2].url].version,2);assert.deepEqual(Array.from(run.rows,person=>person.presentation?.text),sources);old.close();current.close();
});
compiled('a fresh source repair accepts an unchanged owned v292 literal instead of mistaking the new layout for changed source',async()=>{
 const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'})]]),old=await runtime({count:2,localStorageMap:local,moduleCode:previousFile('public/note-profile-card-likes300-fix-v220.user.js')});old.state.failAt=2;await old.history();const plan=old.editor.readRun(),rows=plan.rows.map((person,index)=>index===1?{...person,presentation:{...person.presentation,source:{...person.presentation.source,account:'different_account'}}}:person);old.editor.writeRun({...plan,rows});
 const current=await old.reload({moduleCode:readFileSync('public/note-profile-card-likes300-fix-v220.user.js','utf8')});await current.history();assert.equal(current.editor.readRun().qualityHold?.index,1);const literal=current.editor.readRun().presentationTexts[rows[1].url];await current.history();const run=current.editor.readRun();assert.equal(run.stage,'images_ready',current.state.statuses.at(-1)?.text);assert.ok(!run.qualityHold);assert.equal(run.presentationTexts[run.rows[1].url],literal);assert.equal(run.items.length,3);old.close();current.close();
});
