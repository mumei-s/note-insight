(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
const PREF='mumei_profile_card_presentation_v292';
function options(value={}){return{size:value.size==='medium'?'medium':'thin',content:['profile','summary'].includes(value.content)?value.content:'name'}}
function readOptions(){try{return options(JSON.parse(localStorage.getItem(PREF)||'{}'))}catch{return options()}}
function account(value){return String(value?.urlname||value?.urlName||value?.url_name||value?.presentationAccount||'').trim().toLowerCase()}
function clean(value){
 if(typeof value!=='string')return'';
 const doc=new DOMParser().parseFromString(value.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|h[1-6]|li|blockquote)>/gi,'\n'),'text/html');
 doc.querySelectorAll('script,style,iframe,form,button,nav').forEach(node=>node.remove());
 return String(doc.body.textContent||'').replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function excerpt(value,budget=220){
 const text=String(value||'').trim(),units=Array.from(text);if(units.length<=budget)return{text,truncated:false};
 const prefix=units.slice(0,budget-7).join('');
 const boundaries=[...prefix.matchAll(/[。！？.!?](?:[」』）)]|\s|$)?|\n/g)].map(match=>match.index+match[0].length);
 const end=boundaries.filter(index=>index>=Math.floor(budget*.5)).at(-1);
 return{text:prefix.slice(0,end||prefix.length).trim()+'…（抜粋）',truncated:true};
}
function freeBody(note={}){
 const explicit=['free_body','freeBody','free_body_html','freeBodyHtml','free_body_text','freeBodyText','free_content','freeContent'];
 for(const field of explicit)if(typeof note[field]==='string'&&clean(note[field]))return{text:clean(note[field]),field,kind:'note-free'};
 const body=typeof note.body==='string'?note.body:typeof note.body_html==='string'?note.body_html:typeof note.body_text==='string'?note.body_text:typeof note.bodyText==='string'?note.bodyText:'';
 const separator=String(note.separator||'').trim();
 if(body&&separator){
  const doc=new DOMParser().parseFromString(body,'text/html'),nodes=[...doc.body.querySelectorAll('[id],[name]')];
  const marker=nodes.find(node=>node.getAttribute('id')===separator||node.getAttribute('name')===separator);
  if(marker){
   const range=doc.createRange();range.setStart(doc.body,0);range.setEndBefore(marker);
   const holder=doc.createElement('div');holder.append(range.cloneContents());
   return{text:clean(holder.innerHTML),field:'body-before-separator',kind:'note-free'};
  }
 }
 const numericPrice=Object.prototype.hasOwnProperty.call(note,'price')&&note.price!==null&&note.price!==''&&Number.isFinite(Number(note.price));
 const explicitlyFree=numericPrice&&Number(note.price)===0&&!note.is_limited&&!note.isLimited&&!note.is_membership_only&&!note.isMembershipOnly&&!note.paywall?.is_simple_paid_note&&!note.paywall?.context?.is_membership_connected;
 if(body&&explicitlyFree)return{text:clean(body),field:'free-article-body',kind:'note-free'};
 // Publisher-supplied public leads are useful even when the full/free boundary
 // is unknown. Never use a title or an authenticated paid body as a summary.
 for(const field of ['lead','description','excerpt','summary'])if(typeof note[field]==='string'&&clean(note[field]))return{text:clean(note[field]),field,kind:'note-public-lead'};
 return{text:'',field:'',kind:'note-free'};
}
function noteSource(note={}){
 const user=note.user||note.author||{},id=account(user),key=String(note.key||note.note_key||note.noteKey||'').toLowerCase();
 let url=String(note.note_url||note.noteUrl||'');
 if(!url&&id&&/^n[a-f0-9]{12}$/.test(key))url='https://note.com/'+encodeURIComponent(id)+'/n/'+key;
 return{account:id,key,url};
}
function compose(row,note={},profile={},requested=readOptions()){
 const selected=options(requested),base={version:1,...selected,text:'',status:'available',source:{kind:'name'}};
 if(selected.content==='name')return base;
 const rawProfile=profile?.rawProfile||profile||{};
 if(selected.content==='profile'){
  const text=typeof rawProfile.profileText==='string'?rawProfile.profileText:clean(rawProfile.profile??rawProfile.description??rawProfile.bio??rawProfile.introduction??rawProfile.self_introduction??rawProfile.note_intro??'');
  const shown=excerpt(text,selected.size==='medium'?220:118);
  return{...base,...shown,status:text?'available':'unavailable',text:text?shown.text:'プロフィール未設定',source:{kind:'profile',account:account(rawProfile),key:'',url:account(rawProfile)?'https://note.com/'+encodeURIComponent(account(rawProfile)):''}};
 }
 const available=freeBody(note),shown=excerpt(available.text,selected.size==='medium'?220:118);
 return{...base,...shown,status:available.text?'available':'unavailable',text:available.text?shown.text:'無料公開本文を取得できません',source:{kind:available.kind,field:available.field,...noteSource(note)}};
}
function tex(value){
 const escapes={'\\':'\\textbackslash{}','{':'\\{','}':'\\}','$':'\\$','&':'\\&','#':'\\#','_':'\\_','%':'\\%','^':'\\textasciicircum{}','~':'\\textasciitilde{}','\t':'\\quad ',' ':'\\space ','`':'\\verb+`+',"'":"\\verb+'+"};
 return Array.from(String(value||''),char=>{
  if(Object.prototype.hasOwnProperty.call(escapes,char))return escapes[char];
  if(/[‼⁇⁈⁉｜|《》-]|\p{Mark}/u.test(char)||char.normalize('NFD')!==char)return'\\char"'+char.codePointAt(0).toString(16).toUpperCase()+'{}';
  return char;
 }).join('');
}
function wrap(value,budget=26){
 const lines=[];for(const original of String(value||'').split('\n')){
  let line='',width=0;for(const char of Array.from(original)){
   const size=/^[\x20-\x7e]$/.test(char)?.53:1;
   if(line&&width+size>budget){lines.push(line);line='';width=0}line+=char;width+=size;
  }lines.push(line);
 }return lines;
}
function aboveText(row){
 const value=row?.presentation;if(!value||value.size!=='thin'||value.content==='name'||row.finalMarker)return'';
 const label=value.content==='profile'?'プロフィール':'無料公開部分の要約';
 const lines=['◇ '+label,...wrap(value.text)].map(line=>'\\text{'+tex(line)+'}');
 return'$${\\scriptsize\\boxed{\\begin{array}{l}'+lines.join('\\\\')+'\\end{array}}}$$';
}
function mount(panel){
 if(!panel||panel.querySelector('[data-presentation-size]'))return;
 const saved=readOptions(),row=document.createElement('div');row.className='amount presentation';row.style.gridTemplateColumns='1fr 1fr';
 row.innerHTML='<select data-presentation-size aria-label="サムネイルの大きさ"><option value="thin">極薄</option><option value="medium">中型</option></select><select data-presentation-content aria-label="紹介内容"><option value="name">名前のみ</option><option value="profile">プロフィール</option><option value="summary">記事の要約</option></select>';
 row.querySelector('[data-presentation-size]').value=saved.size;row.querySelector('[data-presentation-content]').value=saved.content;
 const amount=panel.querySelector('.amount');if(amount)amount.before(row);else panel.querySelector('.body')?.append(row);
 const hint=document.createElement('div');hint.className='hint';hint.dataset.presentationHint='';row.after(hint);
 const update=()=>{const selected=options({size:row.querySelector('[data-presentation-size]').value,content:row.querySelector('[data-presentation-content]').value});try{localStorage.setItem(PREF,JSON.stringify(selected))}catch{}hint.textContent=selected.content==='name'?'名前は画像の中':selected.size==='thin'?'紹介文は画像の上｜長文は抜粋':'紹介文は画像の中｜長文は抜粋';};
 row.addEventListener('change',update);update();
}
page.__MUMEI_PROFILE_CARD_CONTENT__={readOptions,options,compose,aboveText,mount,clean,excerpt,freeBody};
})();
