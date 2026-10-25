import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
const code=source.slice(source.indexOf('function galleryProfileGraphemes('),source.indexOf('function insertHeadingAt('))+
 source.slice(source.indexOf('function insertActivityAt('),source.indexOf('function dividerType('));
function api(intl=Intl){
 const context=vm.createContext({Intl:intl});
 vm.runInContext(code+';globalThis.api={activityText,historyProfileLayout,galleryProfileWidth,compactHistoryRows,insertActivityAt};',context);
 return context.api;
}
const compact=extra=>({creator:'創作する花🌱',profileText:'親子で物語とイラストを制作しています。相談も歓迎です。',likesHistory:true,profileLayout:'compact-v272',...extra});
const originalText=row=>'プロフィール｜'+row.creator+'さん：'+(row.profileText||'プロフィール未設定');
let katex;
try{katex=createRequire(import.meta.url)(process.env.KATEX_TEST_MODULE||'katex')}catch{}
const renderedText=html=>html.replace(/<annotation[\s\S]*?<\/annotation>/g,'').replace(/<[^>]*>/g,'').replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos|nbsp));/gi,(_,hex,number,name)=>hex?String.fromCodePoint(parseInt(hex,16)):number?String.fromCodePoint(Number(number)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[name]).replaceAll('\u00a0',' ');

test('fresh history plans opt into compact profiles while preserving creator, design and final metadata',()=>{
 const math=api(),rows=[{index:1,creator:'花',url:'https://note.com/hana/n/n000000000001',designIndex:199,profileText:'全文。'},{index:2,creator:'実績の算数',finalMarker:true,url:'https://note.com/fuku444/n/nb4f6934381e9',designIndex:5}],before=JSON.stringify(rows);
 const next=Array.from(math.compactHistoryRows(rows));
 assert.equal(JSON.stringify(rows),before,'the previous plan is not mutated by selecting fresh formatting');
 assert.equal(next[0].profileLayout,'compact-v272');
 assert.equal(next[0].url,rows[0].url);assert.equal(next[0].designIndex,199);assert.equal(next[0].profileText,'全文。');
 assert.equal(next[1].url,rows[1].url);assert.equal(next[1].finalMarker,true);assert.equal(next[1].index,2);assert.equal(next[1].designIndex,5);
 assert.ok(math.activityText(next[0]).startsWith('$${\\scriptsize\\begin{array}{l}'));
});

test('unflagged saved history profiles retain their exact plain source for legacy resume',()=>{
 const math=api(),row={creator:'以前の作者',profileText:'以前の紹介。\n変更せずに残します。',likesHistory:true};
 assert.equal(math.activityText(row),originalText(row));
 assert.equal(math.activityText({creator:'空',profileText:''}),'プロフィール｜空さん：プロフィール未設定');
 const source=math.activityText(row);
 math.activityText(compact());
 assert.equal(math.activityText(row),source,'creating a compact row cannot change an older saved row');
});

test('compact history profiles use small formula text and do not request an unsupported small mark',()=>{
 const math=api(),row=compact(),formula=math.activityText(row),nodes=new Map();let smallCalls=0;
 const paragraph={name:'paragraph',create(attrs,content){return{type:paragraph,textContent:content.textContent,marks:content.marks,nodeSize:content.textContent.length+2}}};
 const view={state:{schema:{nodes:{paragraph},text:(value,marks=[])=>({textContent:value,marks}),marks:{small:{create(){smallCalls++;return'tiny'}}}},doc:{content:{size:10000},nodeAt:pos=>nodes.get(pos)},tr:{insert(pos,node){return{pos,node}}}},dispatch(tr){nodes.set(tr.pos,tr.node)}};
 const result=math.insertActivityAt(view,row,17);
 assert.ok(formula.startsWith('$${\\scriptsize\\begin{array}{l}'));
 assert.ok(formula.includes('\\\\\\text{'),'compact paragraphs contain explicit fitted rows');
 assert.equal(result.text,formula);assert.equal(nodes.get(17).textContent,formula);
 assert.deepEqual(Array.from(nodes.get(17).marks),[]);assert.equal(smallCalls,0);
 assert.equal(result.nextPos,17+nodes.get(17).nodeSize);
});

for(const [mode,intl] of [['Intl',Intl],['fallback',{}]]){
 test(mode+' keeps full profile text, emoji and natural sentence boundaries at the compact size',()=>{
  const math=api(intl),row=compact({profileText:'前の文章。親子で楽しく学びます。\n👨‍👩‍👧‍👦🇯🇵 か\u3099( ´͈ ॢꇴ `͈ॢ)‼️'}),text=originalText(row),layout=math.historyProfileLayout(text);
  assert.equal(layout.font,'scriptsize');
  assert.equal(Array.from(layout.lines).join(''),text.replace(/[\r\n]/g,''));
  assert.ok(layout.lines.some(line=>line.includes('親子で楽しく学びます。')));
  for(const line of layout.lines){assert.ok(math.galleryProfileWidth(line)<=layout.maxWidth+.00001,line);assert.ok(!line.startsWith('\u200d'));assert.ok(!line.endsWith('\u200d'));assert.ok(!line.startsWith('\u3099'))}
 });

 test(mode+' keeps Katakana words whole across their prolonged-sound marks',()=>{
  const math=api(intl),word='コミュニケーション',text='前の文章。'+word+'を大切にしています。',layout=math.historyProfileLayout(text);
  assert.equal(layout.font,'scriptsize');
  assert.equal(layout.lines.join(''),text);
  assert.equal(layout.lines.filter(line=>line.includes(word)).length,1);
  const longer='メンタルヘルスコミュニケーションアドバイザー',small=math.historyProfileLayout(longer);
  assert.equal(small.font,'tiny');
  assert.equal(small.lines.join(''),longer);
  assert.equal(small.lines.filter(line=>line.includes(longer)).length,1);
 });

 test(mode+' retains a long complete URL on its own tiny row without stopping the history batch',()=>{
  const math=api(intl);
  for(const url of ['https://example.com/profile/someone-long-name/about-me','https://example.com/'+('a'.repeat(200))]){
   const text='制作を受け付けています。\n'+url+'\n全文を残します。',layout=math.historyProfileLayout(text);
   assert.equal(layout.font,'tiny');
   assert.equal(layout.lines.join(''),text.replace(/[\r\n]/g,''));
   assert.equal(layout.lines.filter(line=>line===url).length,1,'the complete URL has a dedicated row');
   assert.ok(math.galleryProfileWidth(url)>layout.maxWidth,'this exercises a genuinely indivisible wide URL');
   assert.ok(math.activityText(compact({profileText:text})).startsWith('$${\\tiny\\begin{array}{l}'));
  }
 });
}

test('actual KaTeX preserves every original compact history code point and safe literal delimiter',{skip:!katex},()=>{
 const math=api(),rows=[
  compact({creator:'《めじゅ》｜A&B',profileText:"プロフィールをそのまま残す。Beyoncé's `作品`‼️  👨‍👩‍👧‍👦 か\u3099"}),
  compact({creator:'特殊文字',profileText:String.raw`{作品} $100 & 50% #note a_b ^ ~ \htmlStyle{color:red}{偽装}`} ),
  compact({creator:'長いリンク',profileText:'https://example.com/profile/someone-long-name/about-me'}),
  compact({creator:'とても長いリンク',profileText:'https://example.com/'+('a'.repeat(200))})
 ];
 for(const row of rows){
  const formula=math.activityText(row);
  assert.ok(!/[｜|《》]/u.test(formula),'note ruby syntax cannot reinterpret literal profile delimiters');
  const html=katex.renderToString(formula.slice(3,-3),{output:'mathml',strict:'ignore',trust:false,throwOnError:true});
  assert.equal(renderedText(html),originalText(row).replace(/[\r\n]/g,''),row.creator);
 }
});
