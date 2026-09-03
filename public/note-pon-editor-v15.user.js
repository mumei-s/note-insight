// ==UserScript==
// @name         note ポン出し v15｜共同マガジン一覧ワンタップ
// @namespace    https://github.com/mumei-s/note-insight
// @version      15.0.1
// @description  v14の安全な追記・見出し・区切り線・noteカード機能に、共同マガジン一覧の自動生成を追加。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v14.user.js
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v15.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v15.user.js
// ==/UserScript==
(() => {
'use strict';
if (window.__MUMEI_PON_V15_ADDON__) return; window.__MUMEI_PON_V15_ADDON__=true;
const MASTER='https://note.com/ss_yr/n/nca7a49a69d3c';
const FALLBACK=`
「スピと現実のあいだ」共同運営マガジン|https://note.com/deeplayer_misuzu/m/mf534419e7479
「星空ピージェイ」お便り係|https://note.com/clever_dunlin794/m/mf2e99e9aa411
「書きたい」気持ちをそっと支え合う小さな共同運営マガジン📙|https://note.com/towa410/m/mc9bf7875a8d7
【おくるひと】「億り人」を目指す挑戦者のための戦略マガジン|https://note.com/protect_support/m/m6e82a3605ce7
【みんなとまなぶ】共同運営マガジン|https://note.com/ma_can/m/mef2032492c4a
【一緒に創ろう】シュンの共同運営マガジン|https://note.com/kinoko1629/m/mbefcb2e5a397
【共同マガジン】コネクト・ログ ～一期一会の記録～|https://note.com/mameshibamendako/m/mff26de4b50e8
【共同マガジン】わたしたちの昼休み|https://note.com/yuusei1961/m/mb15d934bcbfc
【共同運営】スイとみんなで作る!ノージャンル同盟🫧|https://note.com/sui_ai_drawing/m/m1df0b906bace
【共同運営マガジン】応援し合う輪 🌈|https://note.com/ayumu_ai/m/m300d06308833
【共同運営マガジン】頑張る隊|https://note.com/jeu3eds49/m/mf2e12dc63c25
【募集】皆のわがまま叶える共同マガジン♪ 海外・英語・子育て|https://note.com/tkmktm/m/m462790bd3a7b
【参加者募集中】NOTERMAGAZIN|https://note.com/inaho3373/m/m0640ab3756eb
【投稿受付中】じぶんを信じる つよくなるせかい|https://note.com/ro_mo_no/m/m57b60e701392
【新規募集中】 みんなで! 継続チャレンジ・マラソン|https://note.com/gotohayumi/m/m1ae88c1b61e5
【誰かの記事が、誰かの心に届く】まめの共同運営マガジン|https://note.com/mame_mame_go/m/mb3dc2cd9766e
❀龍神のご縁結び｜メンバーシップ限定共同運営マガジン❀|https://note.com/tatsuopapa/m/mc7c43a9831f4
🌈ことばの温度をわけあう場所🌈2026年7月24日更新|https://note.com/hiroxkura/m/m475fe8b80594
🌱感謝の流れが巡るやさしい循環マガジン🌱|https://note.com/tatsuopapa/m/ma8d107d9475f
🍀よりまるの【可能性を広げる】共同運営マガジン|https://note.com/honest_iris3408/m/m3a58ed12c332
🟩募集中【共同マガジン】あなたのnoteを応援するマガジン|https://note.com/tarohanamana/m/m33495b5ea807
556 + 279 = ∞　心と心をつなぐ無限の可能性|https://note.com/void_404/m/m1b658a3b6a39
noteを一緒に伸ばし隊|https://note.com/nemutaineko/m/m7318b32a6d98
note予備校|https://note.com/u_yasushi/m/m022c29793e70
note集客発掘パーク|https://note.com/shigekumasaku/m/m9872a92a8af5
SCと一緒に育てるメンシプ限定クリエイティブマガジン|https://note.com/sc_fun/m/macfef0fcc489
SCと紡ぐ、言葉を大切にするマガジン|https://note.com/sc_fun/m/m653e8e82ea44
The Gratitude Flow Loop｜有料循環室|https://note.com/tatsuopapa/m/m6cf909200081
あかりのクリエイティブマガジン2次マガジン|https://note.com/akari_seaart/m/m4d9b9698cacf
あなたへ届けるnote（共同運営マガジン）|https://note.com/yuri_ai_tec/m/mb028566a46ee
きょんとみんなの🌸フリーマガジン|https://note.com/kyownruby/m/md96759f4be5b
ケミパパ共同運営マガジン【といーずレター📮】|https://note.com/chemengpapa0420/m/m5db97d398203
ここがnoteの真ん中！|https://note.com/mahiro_ku/m/mb80f5e0f9b99
シゲクサークル共同運営マガジン|https://note.com/shigekumasaku/m/m3759ff7a5b9c
シゲクの共同運営マガジン|https://note.com/shigekumasaku/m/m9e01fdb0606f
てくてくノート２|https://note.com/gakky_dx/m/mad3a5537da46
ドラドランドの共同運営マガジン「we are noter」|https://note.com/doradorando_mine/m/maf8b8fdb3d6c
トランスミッション|https://note.com/supertoraneko/m/m45e61de5e47c
トランスミッション２|https://note.com/supertoraneko/m/m71e28640b3b5
トランスミッション３|https://note.com/supertoraneko/m/m83e2019ce0a8
ぺんぎんサークル|https://note.com/clever_hawk171/m/m1d135900b5f2
マイトンの共同マガジン『My Tone コレクション』|https://note.com/witty_auklet639/m/me587b516ca22
ますすとひよりのアトリエ🐾|https://note.com/aibiyori_masusu/m/ma475a8bdcecc
ミオとみんなの共同運営マガジン【参加受付中】|https://note.com/clever_bear514/m/mf467d84dbc30
みんなで、あなたの応援したいクリエイターさんの記事を集める。|https://note.com/modern_cosmos195/m/m8e8e455e2ec6
みんなで作る！心の波に乗っかり隊|https://note.com/toko1018/m/m6eda01f56855
みんなで作ろう！ひらっちのマガジン|https://note.com/legal_viper6284/m/m254cc8180f92
みんなで紡ぐ絆と成長マガジン|https://note.com/sai_chat_gpt/m/mc4827a8e939b
みんなとミナトのAIイラスト展示場🎨|https://note.com/n_kazumai55633/m/ma4dad1f25900
みんなの共同運営マガジン|https://note.com/mitsuruamano/m/meadce3d098b0
みんなの成長ラウンジ【共同運営マガジン】|https://note.com/taka_taka_999/m/mc8ad7fa1a478
丘澄絵梨奈の共同マガジン|https://note.com/okasumi/m/mba58a6f9aacf
働き方ブッ壊しマガジン|https://note.com/yuuyouzou/m/mb4495066c358
共同マガジン「ハルマガ」|https://note.com/marketer_note/m/m9186cf842d83
共同マガジン『ハルマガ＋（プラス）』|https://note.com/marketer_note/m/m4eb9deb52a78
共同マガジンにトライ|https://note.com/takekenken/m/m47e504c18849
共同運営マガジン|https://note.com/101xxx510/m/m914a0edaf859
共同運営マガジン CREATORS CONCERTO|https://note.com/real_phlox8176/m/m11b94f8cf911
共同運営マガジン＊noteで人生を豊かにする仲間たち＊|https://note.com/hisanena/m/mb9e4035cab20
共同運営マガジン｜～スキが巡り育つ場所🍀～|https://note.com/fujiha_haretari/m/md03da4b14957
共同運営マガジン❷|https://note.com/101xxx510/m/m49583cf94dff
写真と哲学、日常、みんなが感動するステーション|https://note.com/donchan_13/m/m1de95ffb4171
大人の学びキャンパス|https://note.com/shigekumasaku/m/m53caa91d8fe4
愛桜の共同運営マガジン！【参加者募集】|https://note.com/aira_kasiko2/m/mfffc6ce81838
日常を少し豊かにする鍵～新しい視点に出会うマガジン|https://note.com/chikayorimichi_5/m/me86c388d3826
明日香の エンためになる 共同運営マガジン|https://note.com/shushu8823/m/mbbc52210a8ae
有料note銀座商店街|https://note.com/shigekumasaku/m/m9614e5ff9031
未来のクリエイターに推しエール(チップ)を｜記事厳選共同運営|https://note.com/siiyakamuro/m/mf21f18654494
未来の知識でnoteクリエイターの可能性を広げるラボ|https://note.com/shigekumasaku/m/m9bb45783969e
灯の旅人の よりみちマガジン|https://note.com/traveler_light/m/m752f734f7a1c
無限題｜MUGENDAI|https://note.com/yuzuki_com/m/ma2ce850ace68
第2回スキ動画コンテスト「夏の陣」|https://note.com/ai_naoyuki/m/m7ffeddfdfb3c
継続を目指すあなたを応援！100日継続共同運営マガジン|https://note.com/niji_aroma/m/m24dcacd75a48
綴り灯|https://note.com/wise_rat6355/m/md3a807653baf
自分に優しく、人にはもっと優しい成長マガジン♪|https://note.com/tatsuopapa/m/m97848c1bdf32
読まれる・売れるnoteの教科書|https://note.com/um_mi3108/m/mb607a414c367
【記事追加NG】リコピンさん ありがとう さようなら|https://note.com/ss_yr/m/m535c97031825
⚠️【無名S note 泥くさ部】⚠️|https://note.com/ss_yr/m/m74b154cd7893
1️⃣【物語で稼ぐnote文芸室】共同マガジン|https://note.com/ss_yr/m/m27c5946c6611
2️⃣【Monetize Crew】有料記事SELECT|https://note.com/ss_yr/m/m32528b24bba4
2️⃣WORDS BOOST あなたの言葉に、加速を。|https://note.com/ss_yr/m/m7f7032fb7065
2️⃣無名℃S×ゼンラーマン BOOST Room|https://note.com/ss_yr/m/mf7c9271b4e5e
2️⃣無名S note Spotlight BOOST|https://note.com/ss_yr/m/md481a16210b9
3️⃣AI CREATIVE WORKS　SELECT|https://note.com/ss_yr/m/m95b78222e9b9
3️⃣無名℃S Room 仲間がみつかる共同マガジン|https://note.com/ss_yr/m/mca2c344a0f50
3️⃣無名S note LIFE CARE BOOST|https://note.com/ss_yr/m/mc311c8aba7e2
note収益ラボ｜収益化戦略【共同マガジン】|https://note.com/ss_yr/m/mbe79c0d9105c
note収益ラボ｜実践・成果記録【共同マガジン】|https://note.com/ss_yr/m/m9f1b6d83fe39
WORKING MOM SHIFT｜無名S note|https://note.com/ss_yr/m/m8d6e2d4322c8
タ◯ミーしか勝たんのよ…|https://note.com/ss_yr/m/m16580951510b
収益ラボ／有料記事ショーケース【共同マガジン】|https://note.com/ss_yr/m/ma7a2c6649fa2
有料共同マガジン|https://note.com/ss_yr/m/mb0fe7b50973b`.trim().split('\n').map((s,i)=>{const p=s.lastIndexOf('|');return{title:s.slice(0,p),url:s.slice(p+1),index:i};});
const OV={m752f734f7a1c:4,m8d6e2d4322c8:2,ma4dad1f25900:3,mbe79c0d9105c:1,m9f1b6d83fe39:1,ma7a2c6649fa2:1};
const FB={mf534419e7479:10,m300d06308833:10,m9872a92a8af5:10,mbefcb2e5a397:5,m1df0b906bace:5,m74b154cd7893:5,m653e8e82ea44:5,m4d9b9698cacf:5,mb028566a46ee:5,md96759f4be5b:5,mb80f5e0f9b99:5,m3759ff7a5b9c:5,m9e01fdb0606f:5,ma475a8bdcecc:5,m254cc8180f92:5,mba58a6f9aacf:5,m9bb45783969e:5,m33495b5ea807:5,mef2032492c4a:3,mb3dc2cd9766e:3,macfef0fcc489:3,m5db97d398203:3,mc4827a8e939b:3,m9186cf842d83:3,me86c388d3826:3,m95b78222e9b9:3,mf2e99e9aa411:2,mc9bf7875a8d7:2,ma4dad1f25900:3,meadce3d098b0:2,mf7c9271b4e5e:2,m8d6e2d4322c8:2,m4eb9deb52a78:1,mf21f18654494:1,md3a807653baf:1,mbe79c0d9105c:1,m9f1b6d83fe39:1,ma7a2c6649fa2:1};
const UL=new Set(['mff26de4b50e8','m3a58ed12c332','ma8d107d9475f','m6cf909200081','mad3a5537da46','m97848c1bdf32']),PB=new Set(['mb4495066c358']),BLOCK=new Set(['m535c97031825']);
const key=u=>(String(u).match(/\/m\/(m[a-z0-9]+)/i)||[])[1]||'',owner=u=>{try{return new URL(u).pathname.split('/').filter(Boolean)[0]||''}catch{return''}};
const get=url=>new Promise((ok,no)=>GM_xmlhttpRequest({method:'GET',url,timeout:20000,onload:r=>r.status<400?ok(r.responseText):no(Error('HTTP '+r.status)),onerror:()=>no(Error('通信失敗')),ontimeout:()=>no(Error('timeout'))}));
const text=html=>{const d=new DOMParser().parseFromString(html,'text/html');d.querySelectorAll('del,s,strike,[style*="line-through"]').forEach(e=>e.remove());return(d.body?.innerText||d.body?.textContent||'').replace(/\u00a0/g,' ')};
function desc(html,k){const i=html.indexOf(k),r=i>=0?html.slice(Math.max(0,i-80000),Math.min(html.length,i+120000)):html;const re=/["']description["']\s*:\s*"((?:\\.|[^"\\])*)"/g;let m,b='';while((m=re.exec(r))){try{const v=JSON.parse('"'+m[1]+'"');if(v.length>b.length&&v.length<12000)b=v}catch{}}return b}
function fixed(dom,o){const mark=[...dom.querySelectorAll('body *')].find(e=>e.children.length===0&&e.textContent.trim()==='固定された記事');if(!mark)return null;const a=[...dom.querySelectorAll('a[href]')].find(a=>(mark.compareDocumentPosition(a)&4)&&/\/[A-Za-z0-9_-]+\/n\/n[a-z0-9]+/i.test(a.getAttribute('href')||''));if(!a)return null;let u;try{u=new URL(a.getAttribute('href'),'https://note.com').href.split('?')[0]}catch{return null}return owner(u)===o?u:null}
const digit=t=>String(t||'').replace(/[０-９]/g,d=>String.fromCharCode(d.charCodeAt(0)-0xFEE0));
function limit(t){t=digit(t).replace(/\[[^\]]*(?:例|example)[^\]]*\]/gi,' ').replace(/［[^］]*(?:例|example)[^］]*］/gi,' ');const ns=[];let m,re=/(?:1日|一日)(?:あたり|当たり|の)?[^。\n]{0,28}?(\d+)\s*[〜～~\-]\s*(\d+)\s*(?:本|記事|投稿|回|件)/g;while((m=re.exec(t)))ns.push(Math.max(+m[1],+m[2]));re=/(?:1日|一日)(?:あたり|当たり|の)?[^。\n]{0,28}?(?:最大|上限|まで|目安|程度|くらい|約|およそ|1人)?[^0-9。\n]{0,10}?(\d+)\s*(?:本|記事|投稿|回|件)/g;while((m=re.exec(t)))ns.push(+m[1]);if(ns.length)return{type:'count',count:Math.max(...ns)};if(/(?:1日|一日)[^。\n]{0,35}?(?:上限|制限)[^。\n]{0,12}?(?:なし|ありません|ない|無い)/.test(t)||/(?:投稿数|投稿回数|追加本数|記事追加|投稿|寄稿)[^。\n]{0,30}?(?:無制限|制限なし|上限なし)/.test(t))return{type:'unlimited'};return null}
const paid=t=>/(?:有料記事|有料note)[^。\n]{0,18}(?:禁止|不可|NG|ご遠慮)/i.test(digit(t))||/(?:無料記事のみ|無料の記事のみ)/.test(t);
async function master(){try{const h=await get(MASTER),d=new DOMParser().parseFromString(h,'text/html'),r=d.querySelector('article')||d.body,seen=new Set(),a=[];for(const x of r.querySelectorAll('a[href]')){let u;try{u=new URL(x.getAttribute('href'),'https://note.com').href.split('?')[0]}catch{continue}if(!/https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test(u)||seen.has(u))continue;seen.add(u);const f=FALLBACK.find(z=>z.url===u);a.push({title:f?.title||x.textContent.trim(),url:u,index:a.length})}if(a.length>=70&&a.length<=120)return a}catch{}return FALLBACK.map(x=>({...x}))}
function hard(r,p){const k=key(r.url);if(BLOCK.has(k))return{type:'blocked'};if(k in OV)return{type:'count',count:OV[k]};if(p)return p;if(UL.has(k))return{type:'unlimited'};if(k in FB)return{type:'count',count:FB[k]};if(owner(r.url)==='ss_yr'){const m=r.title.match(/^([1-9])️⃣/);if(m)return{type:'count',count:+m[1]}}return{type:'none'}}
async function one(r){const k=key(r.url),o=owner(r.url);let title=r.title,fd=null,de='',ft='';try{const h=await get(r.url),d=new DOMParser().parseFromString(h,'text/html');title=[...d.querySelectorAll('h1')].map(e=>e.textContent.trim()).find(Boolean)||title;de=desc(h,k);fd=fixed(d,o);if(fd)try{ft=text(await get(fd))}catch{}}catch{}return{...r,title,fixed:fd,rule:hard({...r,title},limit(ft)||limit(de)),paid:PB.has(k)||paid(ft)||paid(de)}}
async function all(rows,show){const out=new Array(rows.length);let n=0,c=0;await Promise.all(Array.from({length:6},async()=>{while(1){const i=c++;if(i>=rows.length)return;out[i]=await one(rows[i]);show(`取得 ${++n}/${rows.length}`)}}));return out}
const tr=t=>t==='トランスミッション'?1:/[２2]$/.test(t)?2:/[３3]$/.test(t)?3:0;
function ord(a){a=[...a].sort((x,y)=>x.index-y.index);const t=a.filter(x=>tr(x.title)).sort((x,y)=>tr(x.title)-tr(y.title));if(t.length<2)return a;const p=Math.min(...t.map(x=>a.indexOf(x))),b=a.filter(x=>!t.includes(x));b.splice(p,0,...t);return b}
const label=g=>g==='unlimited'?'♾️ 無制限':g==='none'?'制限数表記なし':g==='blocked'?'🚫 記事追加不可':`${g===10?'🔟':g+'️⃣'} 1日${g}記事まで`;
function source(items){const gs=new Map;for(const x of items){const g=x.rule.type==='count'?x.rule.count:x.rule.type;(gs.get(g)||gs.set(g,[]).get(g)).push(x)}const ns=[...gs.keys()].filter(x=>typeof x==='number').sort((a,b)=>b-a),os=[];if(gs.has('unlimited'))os.push('unlimited');os.push(...ns);if(gs.has('none'))os.push('none');if(gs.has('blocked'))os.push('blocked');const l=[];for(const g of os){l.push(`# ${label(g)}`,'');for(const x of ord(gs.get(g))){l.push(`## ${x.title}`,'');if(x.paid)l.push('有料記事追加不可','');l.push(x.url,'');if(x.fixed)l.push(x.fixed,'');l.push('---','')}}return l.join('\n').trim()}
function install(){const root=document.getElementById('__mumei_pon_v14_root__');if(!root)return setTimeout(install,300);const panel=root.querySelector('#ponPanel14'),src=root.querySelector('#ponSrc14'),status=root.querySelector('#ponStatus14'),add=root.querySelector('#ponAdd14');const head=root.querySelector('#ponDrag14 b');if(head)head.textContent='↔️ ポン出し v15.0.1';if(panel&&!panel.querySelector('#ponMags15')){const b=document.createElement('button');b.id='ponMags15';b.textContent='📚 共マガ一覧を追記＋全カード化';b.style.cssText='display:block;width:100%;border:0;border-radius:8px;padding:9px 5px;background:#ffd54a;color:#261f00;font-weight:900;font-size:11px;margin-bottom:5px';panel.insertBefore(b,src);b.onclick=async()=>{if(b.disabled)return;b.disabled=true;try{status.textContent='正本一覧を取得…';const rows=await master();const items=await all(rows,t=>status.textContent=t);src.value=source(items);status.textContent=`${items.length}誌を本文へ追記＋カード化`;add.click()}catch(e){status.textContent='❌ '+(e?.message||e)}finally{b.disabled=false}}}}
install();
})();