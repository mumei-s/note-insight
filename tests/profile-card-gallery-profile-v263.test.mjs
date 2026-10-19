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
 vm.runInContext(code+';globalThis.api={galleryProfileGraphemes,galleryProfileWidth,galleryProfileBudgetChunks,galleryProfileChunks,galleryProfileLines,galleryProfileLayout,escapeGalleryProfileTex,activityText,insertActivityAt,findActivity};',context);
 return context.api;
}
function coarseWordIntl(target=null){
 return{Segmenter:class{
  constructor(locale,options){this.granularity=options.granularity;this.native=new Intl.Segmenter(locale,options)}
  segment(text){
   if(this.granularity!=='word')return this.native.segment(text);
   if(!target)return[{index:0,segment:text,isWordLike:true}];
   const at=text.indexOf(target);
   if(at<0)return this.native.segment(text);
   return[...this.native.segment(text.slice(0,at)),{index:at,segment:target,isWordLike:true},...Array.from(this.native.segment(text.slice(at+target.length)),part=>({...part,index:part.index+at+target.length}))];
  }
 }};
}
const row={gallery126:true,creator:'猫好き🌱',profileText:'会社員とイラスト制作。親子で楽しむ物語を毎日発信しています。'};
let katex;
try{katex=createRequire(import.meta.url)(process.env.KATEX_TEST_MODULE||'katex')}catch{}
const renderedText=html=>html.replace(/<annotation[\s\S]*?<\/annotation>/g,'').replace(/<[^>]*>/g,'').replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos|nbsp));/gi,(_,hex,number,name)=>hex?String.fromCodePoint(parseInt(hex,16)):number?String.fromCodePoint(Number(number)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[name]).replaceAll('\u00a0',' ');

test('gallery profiles use the requested smaller note formula without changing the normal likes profile',()=>{
 const math=api().activityText(row);
 assert.ok(math.startsWith('$${\\scriptsize\\begin{array}{l}\\text{'));
 assert.ok(math.endsWith('\\end{array}}$$'));
 assert.equal(math.match(/\$\$/g).length,2);
 assert.ok(math.includes('\\\\\\text{'));
 assert.equal(api().activityText({...row,gallery126:false}),'プロフィール｜猫好き🌱さん：'+row.profileText);
});

test('wrapping preserves the complete profile and never cuts a grapheme or loses an original line',()=>{
 const text='👨‍👩‍👧‍👦🇯🇵か\u3099🎃 お絵描きと物語。'.repeat(30)+'\nhttps://example.com/profile?tag=cat&n=2\n\n最後まで残る文章';
 const lines=Array.from(api().galleryProfileLayout(text).lines);
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
 for(const literal of ['\\char"348{}','\\char"962{}','\\char"203C{}','\\char"FE0F{}','\\char"E9{}','\\char"2D{}','\\verb+`+','\\space '])assert.ok(escaped.includes(literal),literal);
 assert.ok(!escaped.includes('\u0348'));
 assert.ok(!escaped.includes('‼'));
});

test('Japanese closing punctuation stays with its text and opening brackets stay with their contents',()=>{
 const mathApi=api(),text='ここは、心のサウナみたいなnoteです。日常の違和感を「じぶんを知る地図づくり」の活動につなげます。'.repeat(5);
 const lines=Array.from(mathApi.galleryProfileLines(text));
 assert.equal(lines.join(''),text);
 for(const line of lines){
  assert.ok(!/^[、。，．）」』】]/u.test(line),line);
  assert.ok(!/[（「『【]$/u.test(line),line);
  assert.ok(mathApi.galleryProfileWidth(line)<=16.00001,line);
 }
});

for(const [mode,intl] of [['Intl',Intl],['fallback',{}]]){
 test(mode+' keeps complete Japanese and mixed-language words when wrapping',()=>{
  const mathApi=api(intl),words=['会社員','クリエイター','発信しています','綴っています','ITエンジニア','Webデザイン'],text=words.join(' '),lines=Array.from(mathApi.galleryProfileLines(text));
  assert.equal(lines.join(''),text);
  for(const word of words)assert.equal(lines.filter(line=>line.includes(word)).length,1,word);
  for(const line of lines)assert.ok(mathApi.galleryProfileWidth(line)<=16.00001,line);
 });
 test(mode+' wraps at complete sentences and clauses before using word boundaries',()=>{
  const mathApi=api(intl),sentences=['前の文章。','小さな物語を描いています。','親子で楽しく学びます。'];
  assert.deepEqual(Array.from(mathApi.galleryProfileLines(sentences.join(''))),sentences);
  assert.deepEqual(Array.from(mathApi.galleryProfileLines('いつも前向きに楽しみ、親子で物語を描きます。')),['いつも前向きに楽しみ、','親子で物語を描きます。']);
  const inflected='記事にしていますのでよければどうぞ。',layout=mathApi.galleryProfileLayout(inflected);
  assert.equal(layout.font,'scriptsize');
  assert.equal(layout.lines.join(''),inflected);
  assert.ok(layout.lines.some(line=>line.includes('よければどうぞ。')));
  assert.throws(()=>mathApi.galleryProfileLayout('W'.repeat(100)),/全文を保ったまま/);
 });
}

for(const [name,intl] of [['whole Japanese fragment',coarseWordIntl()],['long Minori phrase',coarseWordIntl('記事にしていますのでよければどうぞ')],['Minori conjunction and ending',coarseWordIntl('のでよければどうぞ')]]){
 test('coarse word Segmenter '+name+' cannot stop Minori profile formatting',()=>{
  const mathApi=api(intl),phrase='記事にしていますのでよければどうぞ。',layout=mathApi.galleryProfileLayout(phrase);
  assert.equal(layout.font,'scriptsize');
  assert.deepEqual(Array.from(layout.lines),['記事にしていますので','よければどうぞ。']);
  const minori=JSON.parse(readFileSync('public/note-profile-card-halloween126.json','utf8')).preparedRows.find(prepared=>prepared?.urlname==='open_tulip9172');
  assert.ok(minori);
  const original='プロフィール｜'+minori.creator+'さん：'+minori.profileText,full=mathApi.galleryProfileLayout(original);
  assert.equal(full.font,'scriptsize');
  assert.equal(full.lines.join(''),original.replace(/[\r\n]/g,''));
  assert.ok(full.lines.includes('記事にしていますので'));
  assert.ok(full.lines.includes('よければどうぞ。'));
  for(const line of full.lines)assert.ok(mathApi.galleryProfileWidth(line)<=full.maxWidth+.00001,line);
 });
}

test('coarse word Segmenter preserves all saved profiles, their font sizes and complete URLs',()=>{
 const rows=JSON.parse(readFileSync('public/note-profile-card-halloween126.json','utf8')).preparedRows.filter(Boolean),normal=api(),coarse=api(coarseWordIntl());
 assert.ok(rows.length>=125);
 for(const prepared of rows){
  const original='プロフィール｜'+prepared.creator+'さん：'+(prepared.profileText||'プロフィール未設定'),layout=coarse.galleryProfileLayout(original);
  assert.equal(layout.font,normal.galleryProfileLayout(original).font,prepared.urlname);
  assert.equal(layout.lines.join(''),original.replace(/[\r\n]/g,''),prepared.urlname);
  for(const line of layout.lines)assert.ok(coarse.galleryProfileWidth(line)<=layout.maxWidth+.00001,prepared.urlname+':'+line);
  for(const match of original.matchAll(/https?:\/\/[^\s\u3000<>「」『』《》【】（）〔〕［］｛｝]+/giu))assert.equal(layout.lines.filter(line=>line.includes(match[0])).length,1,prepared.urlname+':'+match[0]);
 }
 const words=['ITエンジニア','Webデザイン','TypeScript',"Beyoncé's","S's-YR",'C++','HTML5'],url='https://example.com/profile?tag=cat&n=2',text=words.join(' ')+' '+url,layout=coarse.galleryProfileLayout(text);
 assert.equal(layout.lines.join(''),text);
 for(const word of [...words,url])assert.equal(layout.lines.filter(line=>line.includes(word)).length,1,word);
 assert.throws(()=>coarse.galleryProfileLayout('https://example.com/'+('a'.repeat(200))),/全文を保ったまま/);
 assert.throws(()=>coarse.galleryProfileLayout('W'.repeat(100)),/全文を保ったまま/);
});

test('closing punctuation and quotes cannot turn a fitting Kanji run into an oversized atomic unit',()=>{
 const mathApi=api(),words=['創作','作品','制作','企画','支援','活動','実践','報告'];
 for(const original of [words.join('')+'。','「'+words.join('')+'」。']){
  const layout=mathApi.galleryProfileLayout(original);
  assert.equal(layout.font,'scriptsize');
  assert.equal(layout.lines.join(''),original);
  for(const word of words)assert.equal(layout.lines.filter(line=>line.includes(word)).length,1,word);
  for(const line of layout.lines){
   assert.ok(mathApi.galleryProfileWidth(line)<=16.00001,line);
   assert.ok(!/^[、。，．）」』】]/u.test(line),line);
   assert.ok(!/[（「『【]$/u.test(line),line);
  }
 }
});

test('URLs are indivisible and a long URL selects a smaller whole-profile font',()=>{
 const mathApi=api(),url='https://hasyamo-site.hasyamo.workers.dev/',profile={gallery126:true,creator:'はしゃも',profileText:'制作・相談受付中。事例・ポートフォリオ：'+url};
 const layout=mathApi.galleryProfileLayout('プロフィール｜'+profile.creator+'さん：'+profile.profileText);
 assert.equal(layout.font,'tiny');
 assert.equal(layout.lines.filter(line=>line.includes(url)).length,1);
 assert.equal(layout.lines.join(''),'プロフィール｜'+profile.creator+'さん：'+profile.profileText);
 assert.ok(mathApi.activityText(profile).startsWith('$${\\tiny\\begin{array}{l}'));
 for(const line of layout.lines)assert.ok(mathApi.galleryProfileWidth(line)<=layout.maxWidth+.00001,line);
 const bracketed='作品（https://note.com/like_kame6186）の中の人。';
 assert.ok(mathApi.galleryProfileLayout(bracketed).lines.some(line=>line.includes('（https://note.com/like_kame6186）')));
 assert.throws(()=>mathApi.galleryProfileLayout('https://example.com/'+('a'.repeat(200))),/全文を保ったまま/);
});

test('note ruby delimiters never appear literally in a gallery formula',()=>{
 const mathApi=api(),bio='カワイイの中に日々の機微や人間の気配を感じるものが好きです。《めじゅ》と呼んでくださいね。',formula=mathApi.activityText({gallery126:true,creator:'だんだんありがと@めじゅ',profileText:bio+' ｜ 区切り | 端'});
 assert.ok(!/[｜|《》]/u.test(formula));
 for(const literal of ['\\char"FF5C{}','\\char"7C{}','\\char"300A{}','\\char"300B{}'])assert.ok(formula.includes(literal),literal);
 const apostrophe=mathApi.escapeGalleryProfileTex("Beyoncé's `本`");
 assert.ok(!apostrophe.includes('|'));
 if(katex)assert.equal(renderedText(katex.renderToString(formula.slice(3,-3),{output:'mathml',strict:'ignore',trust:false,throwOnError:true})),'プロフィール｜だんだんありがと@めじゅさん：'+bio+' ｜ 区切り | 端');
});

test('every saved profile fits the phone budget and keeps every URL on one row',()=>{
 const rows=JSON.parse(readFileSync('public/note-profile-card-halloween126.json','utf8')).preparedRows.filter(Boolean),mathApi=api();
 assert.ok(rows.length>=125);
 for(const prepared of rows){
  const original='プロフィール｜'+prepared.creator+'さん：'+(prepared.profileText||'プロフィール未設定'),layout=mathApi.galleryProfileLayout(original);
  assert.ok(['scriptsize','tiny'].includes(layout.font),prepared.urlname);
  assert.equal(layout.lines.join(''),original.replace(/\r\n?|\n/g,''),prepared.urlname);
  for(const line of layout.lines)assert.ok(mathApi.galleryProfileWidth(line)<=layout.maxWidth+.00001,prepared.urlname+':'+line);
  for(const match of original.matchAll(/https?:\/\/[^\s\u3000<>「」『』《》【】（）〔〕［］｛｝]+/giu))assert.equal(layout.lines.filter(line=>line.includes(match[0])).length,1,prepared.urlname+':'+match[0]);
  assert.ok(!/[｜|《》]/u.test(mathApi.activityText(prepared)),prepared.urlname);
 }
});

test('fallback word wrapping keeps the current font size and full text for every saved profile',()=>{
 const rows=JSON.parse(readFileSync('public/note-profile-card-halloween126.json','utf8')).preparedRows.filter(Boolean),normal=api(),fallback=api({});
 for(const prepared of rows){
  const original='プロフィール｜'+prepared.creator+'さん：'+(prepared.profileText||'プロフィール未設定'),layout=fallback.galleryProfileLayout(original);
  assert.equal(layout.font,normal.galleryProfileLayout(original).font,prepared.urlname);
  assert.equal(layout.lines.join(''),original.replace(/\r\n?|\n/g,''),prepared.urlname);
  for(const line of layout.lines)assert.ok(fallback.galleryProfileWidth(line)<=layout.maxWidth+.00001,prepared.urlname+':'+line);
 }
});

test('semantic word and sentence preferences never shrink the established profile font',()=>{
 const rows=JSON.parse(readFileSync('public/note-profile-card-halloween126.json','utf8')).preparedRows.filter(Boolean),mathApi=api(),tiny=[];
 for(const prepared of rows){
  const original='プロフィール｜'+prepared.creator+'さん：'+(prepared.profileText||'プロフィール未設定'),layout=mathApi.galleryProfileLayout(original);
  const widest=Math.max(0,...original.replace(/\r\n?/g,'\n').split('\n').flatMap(line=>mathApi.galleryProfileBudgetChunks(line).map(mathApi.galleryProfileWidth)));
  assert.equal(layout.font,widest>16?'tiny':'scriptsize',prepared.urlname);
  if(layout.font==='tiny')tiny.push(prepared.urlname);
 }
 assert.deepEqual(tiny.sort(),['hasyamo','kinu885','skagenavi','chatgpt_ysd','gentle_curlew322','henko_3in0'].sort());
 const kanji='日本国内医療福祉経営企画活動管理運営支援情報技術創作制作';
 const layout=mathApi.galleryProfileLayout(kanji);
 assert.equal(layout.font,'scriptsize');
 assert.equal(layout.lines.join(''),kanji);
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
