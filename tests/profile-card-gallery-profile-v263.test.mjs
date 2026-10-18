import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
const code=source.slice(source.indexOf('function galleryProfileGraphemes('),source.indexOf('function insertHeadingAt('))+
 source.slice(source.indexOf('function insertActivityAt('),source.indexOf('function dividerType('))+
 source.slice(source.indexOf('function findActivity('),source.indexOf('function recordHeading('));
function api(intl=Intl){
 const context=vm.createContext({Intl:intl});
 vm.runInContext(code+';globalThis.api={galleryProfileGraphemes,galleryProfileLines,escapeGalleryProfileTex,activityText,insertActivityAt,findActivity};',context);
 return context.api;
}
const row={gallery126:true,creator:'猫好き🌱',profileText:'会社員とイラスト制作。親子で楽しむ物語を毎日発信しています。'};
let katex;
try{katex=createRequire(import.meta.url)(process.env.KATEX_TEST_MODULE||'katex')}catch{}
const renderedText=html=>html.replace(/<annotation[\s\S]*?<\/annotation>/g,'').replace(/<[^>]*>/g,'').replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos|nbsp));/gi,(_,hex,number,name)=>hex?String.fromCodePoint(parseInt(hex,16)):number?String.fromCodePoint(Number(number)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[name]).replaceAll('\u00a0',' ');

test('gallery profiles use the requested smaller note formula without changing the normal likes profile',()=>{
 const math=api().activityText(row);
 assert.ok(math.startsWith('$${\\footnotesize\\begin{array}{l}\\text{'));
 assert.ok(math.endsWith('\\end{array}}$$'));
 assert.equal(math.match(/\$\$/g).length,2);
 assert.ok(math.includes('\\\\\\text{'));
 assert.equal(api().activityText({...row,gallery126:false}),'プロフィール｜猫好き🌱さん：'+row.profileText);
});

test('wrapping preserves the complete profile and never cuts a grapheme or loses an original line',()=>{
 const text='👨‍👩‍👧‍👦🇯🇵か\u3099🎃 お絵描きと物語。'.repeat(30)+'\nhttps://example.com/a_very_long_address?tag=cat&n=2\n\n最後まで残る文章';
 const lines=Array.from(api().galleryProfileLines(text));
 assert.equal(lines.join(''),text.replaceAll('\n',''));
 assert.ok(lines.includes(''));
 assert.ok(lines.length>10);
 for(const line of lines){assert.ok(!line.startsWith('\u200d'));assert.ok(!line.endsWith('\u200d'));assert.ok(!line.startsWith('\u3099'))}
 const fallback=api({}).galleryProfileGraphemes('👨‍👩‍👧‍👦🇯🇵か\u3099👍🏽');
 assert.deepEqual(Array.from(fallback),['👨‍👩‍👧‍👦','🇯🇵','か\u3099','👍🏽']);
});

test('profile punctuation and apparent TeX commands are text, never executable math commands',()=>{
 const special=String.raw`{作品} $100 & 50% #note a_b ^ ~ \htmlStyle{color:red}{偽装} \end{array}`;
 const escaped=api().escapeGalleryProfileTex(special);
 for(const part of [String.raw`\{作品\}`,String.raw`\$100`,String.raw`\&`,String.raw`50\%`,String.raw`\#note`,String.raw`a\_b`,String.raw`\textasciicircum{}`,String.raw`\textasciitilde{}`,String.raw`\textbackslash{}htmlStyle\{color:red\}\{偽装\}`])assert.ok(escaped.includes(part),part);
 assert.ok(!escaped.includes(String.raw`\htmlStyle{`));
 assert.ok(!escaped.includes(String.raw`\end{array}`));
});

test('combining accents and punctuation keep their Unicode code points instead of becoming TeX accents',()=>{
 const escaped=api().escapeGalleryProfileTex('発信します( ´͈ ॢꇴ `͈ॢ)‼️ é --');
 for(const literal of ['\\char"348{}','\\char"962{}','\\char"203C{}','\\char"FE0F{}','\\char"E9{}','\\char"2D{}','\\verb|`|','\\space '])assert.ok(escaped.includes(literal),literal);
 assert.ok(!escaped.includes('\u0348'));
 assert.ok(!escaped.includes('‼'));
});

test('actual KaTeX preserves the kaomoji, consecutive spaces and accented Latin character',{skip:!katex},()=>{
 const original={gallery126:true,creator:'顔文字(*´ω`*)',profileText:"発信します( ´͈ ॢꇴ `͈ॢ)‼️  Beyoncé's -- 親子👨‍👩‍👧‍👦"};
 const formula=api().activityText(original);
 const html=katex.renderToString(formula.slice(3,-3),{output:'mathml',strict:'ignore',trust:false,throwOnError:true});
 assert.equal(renderedText(html),'プロフィール｜'+original.creator+'さん：'+original.profileText);
});

test('every prepared gallery profile parses in actual KaTeX and preserves its complete text',{skip:!katex},()=>{
 const rows=JSON.parse(readFileSync('public/note-profile-card-halloween126.json','utf8')).preparedRows.filter(Boolean),mathApi=api();
 assert.ok(rows.length>=125);
 for(const prepared of rows){
  const formula=mathApi.activityText(prepared);
  const html=katex.renderToString(formula.slice(3,-3),{output:'mathml',strict:'ignore',trust:false,throwOnError:true});
  assert.equal(renderedText(html),('プロフィール｜'+prepared.creator+'さん：'+(prepared.profileText||'プロフィール未設定')).replace(/[\r\n]/g,''),prepared.urlname);
 }
});

test('a profile paragraph is saved exactly once and remains discoverable for resume by its saved source',()=>{
 const mathApi=api(),nodes=new Map(),text=(value,marks)=>({textContent:value,marks}),paragraph={name:'paragraph',create(attrs,content){return{type:paragraph,textContent:content.textContent,marks:content.marks,nodeSize:content.textContent.length+2}}};
 let smallCalls=0;
 const view={state:{schema:{nodes:{paragraph},text,marks:{small:{create(){smallCalls++;return'tiny'}}}},doc:{content:{size:10000},nodeAt:pos=>nodes.get(pos),descendants(fn){for(const [pos,node] of nodes)fn(node,pos)}},tr:{insert(pos,node){return{pos,node}}}},dispatch(tr){nodes.set(tr.pos,tr.node)}};
 const inserted=mathApi.insertActivityAt(view,row,7);
 assert.equal(inserted.text,mathApi.activityText(row));
 assert.equal(smallCalls,0);
 assert.equal(mathApi.findActivity(view,inserted.text,0).pos,7);
 assert.equal(mathApi.findActivity(view,inserted.text,8),null);
 assert.equal(inserted.nextPos,7+nodes.get(7).nodeSize);
 mathApi.insertActivityAt(view,{...row,gallery126:false},500);
 assert.equal(smallCalls,1);
});
