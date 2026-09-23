import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const [directory, font] = process.argv.slice(2);
const dep = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const sharp = createRequire(import.meta.url)(dep ? path.join(dep,'sharp') : 'sharp');
const {createCanvas,loadImage,GlobalFonts} = await import(dep ? pathToFileURL(path.join(dep,'@napi-rs/canvas/index.js')).href : '@napi-rs/canvas');
if (!GlobalFonts.registerFromPath(font,'Noto Sans CJK JP')) throw new Error('Japanese font unavailable');
const out=path.resolve(directory), cards=path.join(out,'cards'), assets=path.join(out,'assets');
await fs.mkdir(cards,{recursive:true});await fs.mkdir(assets,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function augment(row){const file=path.join(out,'api-cache',sha('/api/v3/notes/'+row.latestKey)+'.json');const p=JSON.parse(await fs.readFile(file,'utf8')),n=p.data||p,u=n.user||{};if(u.urlname!==row.urlname)throw new Error('avatar author mismatch');return {...row,actorImageUrl:u.user_profile_image_url||u.user_profile_image_path||u.userProfileImagePath||row.actorImageUrl};}
const fingerprint=row=>sha(JSON.stringify([row.url,row.title,row.creator,row.actorImageUrl,row.thumbUrl]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function lines(ctx,text,width,count) {const result=[];let line='';for(const c of String(text)){if(ctx.measureText(line+c).width>width){result.push(line);line='';if(result.length===count){result[count-1]=result[count-1].slice(0,-1)+'…';return result;}}line+=c;}if(line)result.push(line);return result;}
async function picture(url,width=640) {
  if(!url)return null;
  if(typeof url!=='string'||!url.startsWith('https://'))throw new Error('Bad picture URL');
  const file=path.join(assets,sha(url));let bytes;
  try{bytes=await fs.readFile(file);}catch{
    const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw new Error('Image HTTP '+response.status+' '+url);
    bytes=Buffer.from(await response.arrayBuffer());await fs.writeFile(file,bytes);
  }
  const decoded=await sharp(bytes,{animated:false}).rotate().resize({width,height:width,fit:'inside',withoutEnlargement:true}).png().toBuffer();
  return loadImage(decoded);
}
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
async function render(row) {
  const file=path.join(cards,row.latestKey+'.png');try{if((await fs.readFile(file+'.fingerprint','utf8'))===fingerprint(row)){await fs.access(file);return;}}catch{}
  const [thumb,avatar]=await Promise.all([picture(row.thumbUrl),picture(row.actorImageUrl,84)]);
  const canvas=createCanvas(860,140),ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,860,140);ctx.strokeStyle='#d9dde3';ctx.lineWidth=1.5;rounded(ctx,1,1,858,138,12);ctx.stroke();
  ctx.textBaseline='top';ctx.fillStyle='#171b21';ctx.font='700 19px "Noto Sans CJK JP"';
  lines(ctx,row.title,504,3).forEach((line,i)=>ctx.fillText(line,16,9+i*22));
  ctx.fillStyle='#eef1f4';ctx.beginPath();ctx.arc(37,109,21,0,Math.PI*2);ctx.fill();
  if(avatar){ctx.save();ctx.beginPath();ctx.arc(37,109,21,0,Math.PI*2);ctx.clip();const scale=Math.max(42/avatar.width,42/avatar.height);ctx.drawImage(avatar,37-avatar.width*scale/2,109-avatar.height*scale/2,avatar.width*scale,avatar.height*scale);ctx.restore();}
  ctx.fillStyle='#343a43';ctx.font='700 16px "Noto Sans CJK JP"';lines(ctx,row.creator,452,2).forEach((line,i)=>ctx.fillText(line,68,91+i*18));
  ctx.fillStyle='#f7f8fa';rounded(ctx,532,8,320,124,8);ctx.fill();
  if(thumb){const scale=Math.min(320/thumb.width,124/thumb.height);ctx.save();rounded(ctx,532,8,320,124,8);ctx.clip();ctx.drawImage(thumb,532+(320-thumb.width*scale)/2,8+(124-thumb.height*scale)/2,thumb.width*scale,thumb.height*scale);ctx.restore();}
  else{ctx.fillStyle='#9ca3af';ctx.font='20px "Noto Sans CJK JP"';ctx.fillText('note',665,57);}
  await fs.writeFile(file,await canvas.encode('png'));await fs.writeFile(file+'.fingerprint',fingerprint(row));
}
const done=new Map();let completed=false;
while(!completed){
  let names=[];try{names=await fs.readdir(path.join(out,'verified'));}catch{}
  const rows=await Promise.all(names.filter(n=>n.endsWith('.json')).map(async n=>augment(JSON.parse(await fs.readFile(path.join(out,'verified',n),'utf8')))));
  const todo=rows.filter(r=>done.get(r.latestKey)!==fingerprint(r));let cursor=0;
  await Promise.all(Array.from({length:8},async()=>{for(;;){const row=todo[cursor++];if(!row)return;console.log('begin',row.urlname);await render(row);done.set(row.latestKey,fingerprint(row));console.log('rendered',done.size,row.urlname);}}));
  try{const manifest=JSON.parse(await fs.readFile(path.join(out,'manifest.json'),'utf8'));completed=manifest.rows.every(r=>done.has(r.latestKey));if(completed){
    for(const row of manifest.rows){Object.assign(row,await augment(row));const bytes=await fs.readFile(path.join(cards,row.latestKey+'.png'));row.pngSha256=sha(bytes);row.pngBase64=bytes.toString('base64');await fs.copyFile(path.join(cards,row.latestKey+'.png'),path.join(cards,String(row.index).padStart(3,'0')+'.png'));}
    await fs.writeFile(path.join(out,'yoizora-ready.json'),JSON.stringify(manifest));console.log('READY',manifest.count);
  }}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!completed)await sleep(2000);
}
