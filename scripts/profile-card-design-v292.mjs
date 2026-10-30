// Presentation-only adapters for the self-contained distribution. Historical
// source modules remain available to the separate purchased-article installer.
function once(source,from,to){
 if(source.split(from).length!==2)throw Error('Design adapter no longer matches exactly once: '+from.slice(0,100));
 return source.replace(from,()=>to);
}

const helpers=String.raw`
// BEGIN CONTRAST AND DISTINCT PATTERNS
function thinDesignOrdinal(row){
 const position=Number(row?.index);
 if(Number.isSafeInteger(position)&&position>0)return position-1;
 const saved=Number(row?.designIndex);
 if(Number.isSafeInteger(saved)&&saved>=0)return saved;
 return 0;
}
function drawDistinctThinDecor(ctx,row,theme,baseCount){
 // Existing compositions and type sizes remain intact. Successive pools add
 // broad, different ornaments rather than cycling back to the same picture.
 const ordinal=thinDesignOrdinal(row),variant=Math.floor(ordinal/baseCount),height=ctx.canvas?.height||H;
 if(variant===0)return;
 const kind=(variant-1)%8,rank=Math.floor((variant-1)/8),gap=28+rank*3;
 ctx.save();ctx.strokeStyle=theme.accent;ctx.fillStyle=theme.accent;
 ctx.lineWidth=2.5;ctx.globalAlpha=.23;
 if(kind===0){
  for(let x=-height;x<W+height;x+=gap){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+height,height);ctx.stroke()}
 }else if(kind===1){
  for(let y=14;y<height;y+=gap)for(let x=14;x<W;x+=gap){ctx.beginPath();ctx.arc(x,y,4+rank,0,Math.PI*2);ctx.fill()}
 }else if(kind===2){
  for(let x=-gap;x<W;x+=gap*2){ctx.beginPath();ctx.moveTo(x,height/2);ctx.bezierCurveTo(x+gap/2,4,x+gap*1.5,height-4,x+gap*2,height/2);ctx.stroke()}
 }else if(kind===3){
  for(let y=10;y<height;y+=gap)for(let x=10;x<W;x+=gap){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+gap/2,y+gap/2);ctx.lineTo(x,y+gap);ctx.lineTo(x-gap/2,y+gap/2);ctx.closePath();ctx.stroke()}
 }else if(kind===4){
  for(let x=0;x<W;x+=gap*3)for(const radius of [gap*.5,gap,gap*1.5]){ctx.beginPath();ctx.arc(x,height/2,radius,0,Math.PI*2);ctx.stroke()}
 }else if(kind===5){
  for(let y=14;y<height;y+=gap)for(let x=14;x<W;x+=gap){ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x+7,y);ctx.moveTo(x,y-7);ctx.lineTo(x,y+7);ctx.stroke()}
 }else if(kind===6){
  for(let x=-gap;x<W+gap;x+=gap){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+gap/2,height);ctx.lineTo(x+gap,0);ctx.stroke()}
 }else{
  for(let y=0;y<height;y+=gap){ctx.beginPath();ctx.moveTo(0,y);for(let x=gap/2;x<W+gap;x+=gap/2)ctx.lineTo(x,y+(Math.round(x/(gap/2))%2?10:-10));ctx.stroke()}
 }
 // A wide ornamental rail encodes the non-repeating pool even when large
 // white/black assets cover most of the background. It uses no extra label.
 // Each base-4 digit is a visible joined shape across the full banner width.
 let code=variant;
 ctx.globalAlpha=.75;ctx.lineWidth=2;
 const cell=W/12;
 for(let i=0;i<12;i++){
  const digit=code%4;code=Math.floor(code/4);
  const x=i*cell+5,right=(i+1)*cell-5;
  ctx.beginPath();ctx.moveTo(x,height-6);
  if(digit===0){ctx.lineTo(x+(right-x)/3,height-10);ctx.lineTo(right,height-6)}
  else if(digit===1){ctx.lineTo(x+(right-x)/2,height-13);ctx.lineTo(right,height-6)}
  else if(digit===2){ctx.lineTo(x+(right-x)/3,height-13);ctx.lineTo(x+(right-x)*2/3,height-13);ctx.lineTo(right,height-6)}
  else{ctx.lineTo(x+(right-x)/4,height-12);ctx.lineTo(x+(right-x)/2,height-6);ctx.lineTo(x+(right-x)*3/4,height-12);ctx.lineTo(right,height-6)}
  ctx.stroke();
 }
 ctx.restore();
}
function drawThinContrastFrame(ctx,path){
 // Both colours are always drawn AFTER the bitmap. Neither a white nor a
 // black image can paint over its own boundary or merge with either UI theme.
 ctx.save();ctx.globalAlpha=1;ctx.setLineDash([]);
 ctx.strokeStyle='#18222f';ctx.lineWidth=4;path();ctx.stroke();
 ctx.strokeStyle='#ffffff';ctx.lineWidth=2;path();ctx.stroke();
 ctx.restore();
}
function drawFinalDistinctRail(ctx,row,layout,theme){
 const medium=ctx.canvas.height>H,left=medium?20:(layout.text?.[0]??100),width=medium?W-40:(layout.text?.[2]??455),bottom=ctx.canvas.height-6;
 // An odd multiplication is bijective modulo 2^24: within practical note
 // batch sizes every ordinal changes this whole geometric ornament. Draw it
 // last in the free strip below the name, never over an icon or article image.
 let code=(Math.imul(thinDesignOrdinal(row),0x9e3779b1)>>>0)&0xffffff;
 ctx.save();ctx.globalAlpha=.9;ctx.strokeStyle=theme.accent;ctx.lineWidth=2;ctx.setLineDash([]);
 const cell=width/12;
 for(let i=0;i<12;i++){
  const digit=code%4;code=Math.floor(code/4);const x=left+i*cell+2,right=left+(i+1)*cell-2;
  ctx.beginPath();ctx.moveTo(x,bottom);
  if(digit===0){ctx.lineTo(x+(right-x)/3,bottom-4);ctx.lineTo(right,bottom)}
  else if(digit===1){ctx.lineTo(x+(right-x)/2,bottom-7);ctx.lineTo(right,bottom)}
  else if(digit===2){ctx.lineTo(x+(right-x)/3,bottom-7);ctx.lineTo(x+(right-x)*2/3,bottom-7);ctx.lineTo(right,bottom)}
  else{ctx.lineTo(x+(right-x)/4,bottom-6);ctx.lineTo(x+(right-x)/2,bottom);ctx.lineTo(x+(right-x)*3/4,bottom-6);ctx.lineTo(right,bottom)}
  ctx.stroke();
 }
 ctx.restore();
}
function finishThinContrast(canvas,row,layout,theme={accent:'#267b91'}){
 const ctx=canvas.getContext('2d'),[ax,originalAy,originalAr]=layout.avatar,ay=layout.profileOnly?70:originalAy,ar=layout.profileOnly?Math.max(32,originalAr):originalAr;
 drawFinalDistinctRail(ctx,row,layout,theme);
 drawThinContrastFrame(ctx,()=>layout.shape==='square'?rounded(ctx,ax-ar,ay-ar,ar*2,ar*2,10):circle(ctx,ax,ay,ar));
 if(!layout.profileOnly){const [x,y,w,h]=layout.thumb;drawThinContrastFrame(ctx,()=>rounded(ctx,x,y,w,h,layout.radius||8))}
 drawThinContrastFrame(ctx,()=>rounded(ctx,2,2,canvas.width-4,canvas.height-4,11));
 return canvas;
}
function mediumTextParts(value){
 const text=String(value||'');
 return typeof Intl?.Segmenter==='function'?Array.from(new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(text),part=>part.segment):Array.from(text);
}
function mediumTextLines(ctx,value,width,{honorific=false}={}){
 const out=[];
 for(const paragraph of String(value||'').replace(/\r\n?/g,'\n').split('\n')){
  let line='';const parts=mediumTextParts(paragraph);
  for(let index=0;index<parts.length;index++){
   let part=parts[index];
   if(honorific&&index===parts.length-2&&part==='さ'&&parts[index+1]==='ん'){part='さん';index++}
   const next=line+part;
   if(line&&ctx.measureText(next).width>width){
    // Prefer an existing word boundary for Latin text. Japanese still uses
    // measured grapheme wrapping, while the original manual lines stay intact.
    const wordContinues=/[A-Za-z0-9]$/.test(line)&&/^[A-Za-z0-9]/.test(part),space=line.lastIndexOf(' ');
    const noStart=/^[、。，．・：；？！ー…‥）〕］｝〉》」』】〙〗〟’”｠»ヽヾ々〻ゝゞぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ,.:;!?\)\]\}]/u.test(part),noEnd=/[（〔［｛〈《「『【〖〘〚‘“\(\[\{]$/u.test(line);
    if(line.endsWith(' ')){out.push(line.trimEnd());line=part}
    else if((wordContinues||noStart&&/[A-Za-z0-9]$/.test(line))&&space>0){out.push(line.slice(0,space));line=line.slice(space+1)+part}
    else if(noStart||noEnd){const previous=mediumTextParts(line),last=previous.pop();if(previous.length)out.push(previous.join(''));line=last+part}
    else{out.push(line);line=part}
   }else line=next;
  }
  out.push(line);
 }
 return out;
}
function drawThinNameOnly(ctx,row,theme,layout){
 const [tx,,tw]=layout.text,name=String(row.creator||'')+'さん',maxHeight=112;
 let size=24,wrapped=[];
 for(;size>=16;size--){ctx.font='700 '+size+'px system-ui,-apple-system,sans-serif';wrapped=mediumTextLines(ctx,name,tw,{honorific:true});if(wrapped.length*Math.ceil(size*1.2)<=maxHeight&&wrapped.at(-1)!=='さん')break}
 size=Math.max(16,size);ctx.font='700 '+size+'px system-ui,-apple-system,sans-serif';
 const lineHeight=Math.ceil(size*1.2),maxLines=Math.max(1,Math.floor(maxHeight/lineHeight)),truncated=wrapped.length>maxLines;
 wrapped=wrapped.slice(0,maxLines);
 if(truncated&&wrapped.length){let parts=mediumTextParts(wrapped.at(-1));while(parts.length&&ctx.measureText(parts.join('')+'…').width>tw)parts.pop();wrapped[wrapped.length-1]=parts.join('')+'…'}
 ctx.fillStyle=theme.bg;rounded(ctx,tx-3,8,tw+6,H-16,5);ctx.fill();
 ctx.fillStyle=theme.ink;ctx.textAlign='start';ctx.textBaseline='top';
 const top=Math.max(9,Math.floor((H-wrapped.length*lineHeight)/2));
 wrapped.forEach((line,index)=>ctx.fillText(line,tx,top+index*lineHeight));
 row.presentationRender={width:W,height:H,fontSize:size,content:row.presentation.content,nameTruncated:truncated};
}
function drawMediumThinCard(row,avatar,thumb,theme){
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=360;
 const originalContext=canvas.getContext('2d'),ctx=typeof qualityCall==='function'?qualityCall('observeContext',[originalContext,row,canvas.width,canvas.height],originalContext):originalContext;
 ctx.fillStyle=theme.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
 drawDistinctThinDecor(ctx,row,theme,1);
 const content=row.presentation?.content||'name',nameOnly=content==='name',ix=20,iy=65,iw=410,ih=230,ax=nameOnly?644:478,ay=nameOnly?105:42,ar=nameOnly?34:20,tx=454,tw=382;
 ctx.fillStyle=theme.panel;rounded(ctx,ix,iy,iw,ih,10);ctx.fill();
 if(thumb){
  const sw=thumb.width||thumb.naturalWidth||1,sh=thumb.height||thumb.naturalHeight||1,scale=Math.max(iw/sw,ih/sh),dw=sw*scale,dh=sh*scale;
  ctx.save();rounded(ctx,ix,iy,iw,ih,10);ctx.clip();ctx.drawImage(thumb,ix+(iw-dw)/2,iy+(ih-dh)/2,dw,dh);ctx.restore();
 }else{
  ctx.save();ctx.fillStyle=theme.muted;ctx.font='700 22px system-ui,-apple-system,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(row.profileOnly?'公開記事なし':'記事画像なし',ix+iw/2,iy+ih/2);ctx.restore();
 }
 ctx.fillStyle=theme.soft;circle(ctx,ax,ay,ar);ctx.fill();
 if(avatar){
  const sw=avatar.width||avatar.naturalWidth||1,sh=avatar.height||avatar.naturalHeight||1,scale=Math.max(ar*2/sw,ar*2/sh),dw=sw*scale,dh=sh*scale;
  ctx.save();circle(ctx,ax,ay,ar);ctx.clip();ctx.drawImage(avatar,ax-dw/2,ay-dh/2,dw,dh);ctx.restore();
 }else{
  ctx.save();ctx.fillStyle=theme.muted;ctx.font='700 18px system-ui,-apple-system,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(mediumTextParts(row.creator||'n')[0]||'n',ax,ay);ctx.restore();
 }
 ctx.fillStyle=theme.ink;ctx.textBaseline='top';ctx.textAlign=nameOnly?'center':'start';
 const nameWidth=nameOnly?tw:332;
 let nameSize=nameOnly?26:22,nameLines=[],nameTruncated=false;
 for(;nameSize>=20;nameSize--){ctx.font='700 '+nameSize+'px system-ui,-apple-system,sans-serif';nameLines=mediumTextLines(ctx,String(row.creator||'')+'さん',nameWidth,{honorific:true});if(nameLines.length<=3&&nameLines.at(-1)!=='さん')break}
 nameSize=Math.max(20,nameSize);ctx.font='700 '+nameSize+'px system-ui,-apple-system,sans-serif';
 if(nameLines.length>3){nameTruncated=true;nameLines=nameLines.slice(0,3);let parts=mediumTextParts(nameLines[2]);while(parts.length&&ctx.measureText(parts.join('')+'…').width>nameWidth)parts.pop();nameLines[2]=parts.join('')+'…'}
 nameLines.forEach((line,index)=>ctx.fillText(line,nameOnly?644:504,(nameOnly?174:23)+index*(nameOnly?34:28)));
 if(nameOnly){
  row.presentationRender={width:W,height:360,fontSize:nameSize,content,nameTruncated};
  finishThinContrast(canvas,row,{avatar:[ax,ay,ar],thumb:[ix,iy,iw,ih],shape:'circle',radius:10},theme);
  return canvas;
 }
 const sourceText=String(row.presentation?.text||''),bodyTop=Math.max(78,23+nameLines.length*28+14),label=content==='profile'?'プロフィール（抜粋）':'記事紹介（無料部分の抜粋）';
 ctx.fillStyle=theme.bg;rounded(ctx,tx-4,bodyTop-4,tw+8,340-bodyTop,6);ctx.fill();
 ctx.fillStyle=theme.muted;ctx.font='700 15px system-ui,-apple-system,sans-serif';ctx.fillText(label,tx,bodyTop);
 ctx.fillStyle=theme.ink;ctx.font='500 20px system-ui,-apple-system,sans-serif';
 const textTop=bodyTop+25,lineHeight=28,maxLines=Math.max(1,Math.floor((333-textTop)/lineHeight)),allLines=mediumTextLines(ctx,sourceText,tw),truncated=allLines.length>maxLines,bodyLines=allLines.slice(0,maxLines);
 if(truncated&&bodyLines.length){let parts=mediumTextParts(bodyLines.at(-1));const suffix='…（抜粋）';while(parts.length&&ctx.measureText(parts.join('')+suffix).width>tw)parts.pop();bodyLines[bodyLines.length-1]=parts.join('')+suffix}
 bodyLines.forEach((line,index)=>ctx.fillText(line,tx,textTop+index*lineHeight));
 row.presentationRender={width:W,height:360,fontSize:20,content,excerpt:truncated||content!=='name',nameTruncated,sourceLength:mediumTextParts(sourceText).length};
 finishThinContrast(canvas,row,{avatar:[ax,ay,ar],thumb:[ix,iy,iw,ih],shape:'circle',radius:10},theme);
 return canvas;
}
function finishThinPresentation(canvas,row,avatar,thumb,theme,layout){
 return row.presentation?.size==='medium'?drawMediumThinCard(row,avatar,thumb,theme):finishThinContrast(canvas,row,layout,theme);
}
// END CONTRAST AND DISTINCT PATTERNS
`;

export function transformCoreDesign(source){
 source=once(source,' return themes[designHash(row?.key||row?.url||row?.creator)%themes.length]',' return themes[thinDesignOrdinal(row)%themes.length]');
 source=once(source,'function randomThinTheme(row){',helpers+'\nfunction randomThinTheme(row){');
 source=once(source,' drawThinDecor(ctx,theme);',' drawThinDecor(ctx,theme);\n drawDistinctThinDecor(ctx,row,theme,50);');
 source=once(source,' if(row.activityLabel){'," if(row.presentation){drawThinNameOnly(ctx,row,theme,{text:[tx,18,tw]})}\n else if(row.activityLabel){");
 return once(source," try{avatar?.close?.()}catch{}try{thumb?.close?.()}catch{}\n const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('画像生成失敗')),'image/png',1));"," const outputCanvas=finishThinPresentation(c,row,avatar,thumb,theme,{avatar:[ax,ay,ar],thumb:[ix,iy,iw,ih],shape:'circle'});\n try{avatar?.close?.()}catch{}try{thumb?.close?.()}catch{}\n const blob=await new Promise((resolve,reject)=>outputCanvas.toBlob(b=>b?resolve(b):reject(new Error('画像生成失敗')),'image/png',1));");
}

export function transformEditorDesign(source){
 source=once(source,'const HISTORY_DESIGN_COUNT=200;',helpers+'\nconst HISTORY_DESIGN_COUNT=200;');
 const start=source.indexOf(' const valid=rows.every((row,i)=>Number.isInteger(row.designIndex)'),end=source.indexOf('\nconst palettes=[',start);
 if(start<0||end<0)throw Error('Missing history design allocation markers');
 source=source.slice(0,start)+String.raw` // Retain every saved choice. New rows receive an unused index, including
 // the extra final card; there is no 200-style rollover into an old picture.
 const saved=new Set(rows.filter(row=>Number.isSafeInteger(row.designIndex)&&row.designIndex>=0).map(row=>row.designIndex));
 if(rows.every(row=>Number.isSafeInteger(row.designIndex)&&row.designIndex>=0))return rows;
 let pool=[],block=0;
 return rows.map(row=>{
  if(Number.isSafeInteger(row.designIndex)&&row.designIndex>=0)return row;
  while(!pool.length){
   const offset=block++*HISTORY_DESIGN_COUNT;
   pool=Array.from({length:HISTORY_DESIGN_COUNT},(_,index)=>offset+index).filter(index=>!saved.has(index));
   for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
  }
  const designIndex=pool.pop();saved.add(designIndex);return{...row,designIndex};
 });
}`+source.slice(end);
 const replacementStart=source.indexOf('function replacementDesignChoices(rows,position){'),replacementEnd=source.indexOf('\nasync function replaceUnavailableCreator(',replacementStart);
 if(replacementStart<0||replacementEnd<0)throw Error('Missing replacement design markers');
 source=source.slice(0,replacementStart)+String.raw`function replacementDesignChoices(rows,position){
 const used=new Set(rows.filter((row,index)=>index!==position&&Number.isSafeInteger(row.designIndex)&&row.designIndex>=0).map(row=>row.designIndex));
 const available=[];
 for(let designIndex=0;available.length<HISTORY_DESIGN_COUNT;designIndex++)if(!used.has(designIndex))available.push(designIndex);
 return available;
}`+source.slice(replacementEnd);
 const savedCondition='  if(Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<HISTORY_DESIGN_COUNT&&row.designIndex!==before)continue;';
 for(const list of ['refreshed','rows'])source=once(source,savedCondition+'\n  const choices=replacementDesignChoices('+list+',position);','  if(Number.isSafeInteger(row.designIndex)&&row.designIndex>=0&&!'+list+'.some((other,index)=>index!==position&&other.designIndex===row.designIndex))continue;\n  const choices=replacementDesignChoices('+list+',position);');
 source=once(source,'&&Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<HISTORY_DESIGN_COUNT)continue;','&&Number.isSafeInteger(row.designIndex)&&row.designIndex>=0)continue;');
 source=once(source," if(!Number.isInteger(index)||index<0||index>=HISTORY_DESIGN_COUNT)throw new Error('極薄デザイン番号が不正です');"," if(!Number.isSafeInteger(index)||index<0)throw new Error('極薄デザイン番号が不正です');\n index%=HISTORY_DESIGN_COUNT;");
 source=once(source,' const limit=row.gallery126===true?126:HISTORY_DESIGN_COUNT;',' const limit=row.gallery126===true?126:Number.MAX_SAFE_INTEGER;');
 source=once(source,'else{\n drawDecor(ctx,index,theme);','else{\n drawDecor(ctx,index,theme);\n drawDistinctThinDecor(ctx,row,theme,HISTORY_DESIGN_COUNT);');
 source=once(source,' drawDecor(ctx,index,theme);\n const [ax,ay,ar]=layout.avatar,',' drawDecor(ctx,index,theme);\n drawDistinctThinDecor(ctx,row,theme,HISTORY_DESIGN_COUNT);\n const [ax,ay,ar]=layout.avatar,');
 source=once(source," ctx.textAlign='start';ctx.textBaseline='top';ctx.fillStyle=theme.ink;ctx.font='700 18px system-ui,-apple-system,sans-serif';\n textLines(ctx,row.title,tw,2).forEach((line,i)=>ctx.fillText(line,tx,ty+i*25));\n const name=fitGalleryCreatorName(ctx,row.creator,nw);ctx.fillStyle=theme.muted;ctx.fillText(name.text,nx,ny);\n ctx.fillStyle=theme.accent;ctx.font='700 12px system-ui,-apple-system,sans-serif';ctx.fillText('note',bx,by);", " if(row.presentation){drawThinNameOnly(ctx,row,theme,layout)}else{\n ctx.textAlign='start';ctx.textBaseline='top';ctx.fillStyle=theme.ink;ctx.font='700 18px system-ui,-apple-system,sans-serif';\n textLines(ctx,row.title,tw,2).forEach((line,i)=>ctx.fillText(line,tx,ty+i*25));\n const name=fitGalleryCreatorName(ctx,row.creator,nw);ctx.fillStyle=theme.muted;ctx.fillText(name.text,nx,ny);\n ctx.fillStyle=theme.accent;ctx.font='700 12px system-ui,-apple-system,sans-serif';ctx.fillText('note',bx,by);\n }");
 source=once(source," const tx=100,tw=455;\n ctx.textBaseline='top';", " const tx=100,tw=455;\n if(row.presentation){drawThinNameOnly(ctx,row,theme,{text:[tx,18,tw]})}else{\n ctx.textBaseline='top';");
 source=once(source,"ctx.fillText('note',tx,110);\n\n const ix=590,iy=8,iw=262,ih=124;", "ctx.fillText('note',tx,110);\n }\n\n const ix=590,iy=8,iw=262,ih=124;");
 // History layouts are indexed modulo 200, but the extended index is retained
 // on the row for future resume and non-repeating allocation.
 source=once(source,' if(row.gallery126===true){drawGalleryCard(ctx,index,row,avatar,thumb)}else if(index>=50){drawHistoryCard(ctx,index,row,avatar,thumb)}else{',' if(row.gallery126===true){drawGalleryCard(ctx,index,row,avatar,thumb)}else if(index%HISTORY_DESIGN_COUNT>=50){drawHistoryCard(ctx,index,row,avatar,thumb)}else{');
 source=once(source,' try{avatar?.close?.()}catch{}\n try{if(thumb!==avatar)thumb?.close?.()}catch{}'," const contrastLayout=row.gallery126===true?{...galleryDesign(index).layout,profileOnly}:index%HISTORY_DESIGN_COUNT>=50?historyDesign(index).layout:{avatar:[50,70,34],thumb:[590,8,262,124],shape:'circle'};\n const outputCanvas=finishThinPresentation(canvas,row,avatar,thumb,theme,contrastLayout);\n try{avatar?.close?.()}catch{}\n try{if(thumb!==avatar)thumb?.close?.()}catch{}");
 return once(source,"=>canvas.toBlob(value=>value?resolve(value):reject(new Error('画像生成失敗')),'image/png',1)","=>outputCanvas.toBlob(value=>value?resolve(value):reject(new Error('画像生成失敗')),'image/png',1)");
}
