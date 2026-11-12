const readingPalettes=[
 {paper:'#eef8f5',soft:'#d3ece5',deep:'#103d3b',edge:'#24796b',ink:'#122f2c',mark:'#f2be73'},
 {paper:'#f7f0ff',soft:'#e7ddf7',deep:'#392c59',edge:'#7357a0',ink:'#312543',mark:'#fab9a0'},
 {paper:'#fff4e5',soft:'#f5e1cb',deep:'#4b3428',edge:'#9a5d37',ink:'#432e25',mark:'#f5b960'},
 {paper:'#edf5ff',soft:'#d6e8fd',deep:'#183d63',edge:'#3975a8',ink:'#182f4c',mark:'#b7db80'},
 {paper:'#fff0f2',soft:'#f6dbe0',deep:'#562f3e',edge:'#a65168',ink:'#452433',mark:'#ffd08f'},
 {paper:'#f1f4e5',soft:'#e3e8cf',deep:'#363f25',edge:'#657740',ink:'#303921',mark:'#e8bb74'}
];
const readingFont='system-ui,-apple-system,"Noto Sans CJK JP","Noto Sans JP",sans-serif';

function usesReadingArtwork(row){
 return row.presentation?.version===2&&!row.gallery126&&!row.finalMarker;
}

function readingSilhouette(ctx,style,w,h,seam,hasCopy){
 const inset=5,right=w-inset,bottom=h-inset;
 if(style===1){
  const arc=Math.min(h/2-inset,hasCopy?76:58);
  ctx.beginPath();
  ctx.moveTo(inset+arc,inset);
  ctx.lineTo(right-18,inset);
  ctx.quadraticCurveTo(right,inset,right,inset+18);
  ctx.lineTo(right,bottom-18);
  ctx.quadraticCurveTo(right,bottom,right-18,bottom);
  ctx.lineTo(inset+arc,bottom);
  ctx.quadraticCurveTo(inset,bottom,inset,h/2);
  ctx.quadraticCurveTo(inset,inset,inset+arc,inset);
  ctx.closePath();
  return;
 }
 if(style===2){
  const cut=hasCopy?30:23;
  ctx.beginPath();
  ctx.moveTo(inset+cut,inset);
  ctx.lineTo(right,inset);
  ctx.lineTo(right,bottom-cut);
  ctx.lineTo(right-cut,bottom);
  ctx.lineTo(inset,bottom);
  ctx.lineTo(inset,inset+cut);
  ctx.closePath();
  return;
 }
 const topNotch=hasCopy?0:13;
 ctx.beginPath();
 ctx.moveTo(inset+14,inset);
 if(topNotch){
  ctx.lineTo(seam-topNotch,inset);
  ctx.bezierCurveTo(seam-topNotch,inset+17,seam+topNotch,inset+17,seam+topNotch,inset);
 }
 ctx.lineTo(right-14,inset);
 ctx.quadraticCurveTo(right,inset,right,inset+14);
 if(hasCopy){
  ctx.lineTo(right,150);
  ctx.bezierCurveTo(right-19,150,right-19,176,right,176);
 }
 ctx.lineTo(right,bottom-14);
 ctx.quadraticCurveTo(right,bottom,right-14,bottom);
 if(topNotch){
  ctx.lineTo(seam+topNotch,bottom);
  ctx.bezierCurveTo(seam+topNotch,bottom-17,seam-topNotch,bottom-17,seam-topNotch,bottom);
 }
 ctx.lineTo(inset+14,bottom);
 ctx.quadraticCurveTo(inset,bottom,inset,bottom-14);
 if(hasCopy){
  ctx.lineTo(inset,176);
  ctx.bezierCurveTo(inset+19,176,inset+19,150,inset,150);
 }
 ctx.lineTo(inset,inset+14);
 ctx.quadraticCurveTo(inset,inset,inset+14,inset);
 ctx.closePath();
}

function readingCover(ctx,image,x,y,w,h,trace){
 const sw=image.width||image.naturalWidth||1,sh=image.height||image.naturalHeight||1;
 const scale=Math.max(w/sw,h/sh);
 ctx.save();trace();ctx.clip();
 ctx.drawImage(image,x+(w-sw*scale)/2,y+(h-sh*scale)/2,sw*scale,sh*scale);
 ctx.restore();
}

function readingLines(ctx,text,width,maxLines,honorific=false){
 const all=mediumTextLines(ctx,text,width,{honorific});
 const lines=all.slice(0,maxLines);
 if(all.length>maxLines){
  const last=mediumTextParts(lines.at(-1));
  while(last.length&&ctx.measureText(last.join('')+'…').width>width)last.pop();
  lines[lines.length-1]=last.join('')+'…';
 }
 return {lines,truncated:all.length>maxLines};
}

function drawReadingArtwork(canvas,row,avatar,thumb){
 const medium=row.presentation.size==='medium',content=row.presentation.display;
 const hasCopy=medium&&Boolean(row.presentation.text)&&content!=='name';
 const w=canvas.width=W,h=canvas.height=medium?360:H;
 const ctx=qualityCall('observeContext',[canvas.getContext('2d'),row,w,h],canvas.getContext('2d'));
 const ordinal=thinDesignOrdinal(row),style=ordinal%3;
 const index=Number.isSafeInteger(row.designIndex)?row.designIndex:ordinal;
 const color=readingPalettes[(Math.floor(ordinal/3)+index)%readingPalettes.length];
 const center=hasCopy?79:h/2,seam=thumb?558:684,split=163;
 const wave=20+index%23;
 const trace=()=>readingSilhouette(ctx,style,w,h,seam,hasCopy);
 const paper=ctx.createLinearGradient(20,0,w-20,h);
 paper.addColorStop(0,color.paper);paper.addColorStop(1,color.soft);
 ctx.save();trace();ctx.clip();
 ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);
 if(style===0){
  ctx.fillStyle=color.soft;ctx.fillRect(seam,0,w-seam,hasCopy?split:h);
  ctx.setLineDash([2+index%4,4+Math.floor(index/4)%9]);ctx.lineWidth=2;ctx.strokeStyle=color.edge;
  ctx.beginPath();ctx.moveTo(seam,hasCopy?14:24);ctx.lineTo(seam,hasCopy?split-10:h-24);ctx.stroke();
  ctx.setLineDash([]);
 }else if(style===1){
  ctx.fillStyle=color.deep;
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(322+wave,0);
  ctx.quadraticCurveTo(270,center,300+wave,hasCopy?split:h);
  ctx.lineTo(0,hasCopy?split:h);ctx.closePath();ctx.fill();
  ctx.strokeStyle=color.edge;ctx.lineWidth=2;
  for(let x=276+wave;x<=310+wave;x+=8){
   ctx.beginPath();ctx.moveTo(x,0);ctx.quadraticCurveTo(x-55,center,x-18,hasCopy?split:h);ctx.stroke();
  }
 }else{
  ctx.fillStyle=color.deep;
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(seam+wave+28,0);ctx.lineTo(seam-wave,hasCopy?split:h);
  ctx.lineTo(0,hasCopy?split:h);ctx.closePath();ctx.fill();
  ctx.strokeStyle=color.mark;ctx.lineWidth=5;
  ctx.beginPath();ctx.moveTo(seam+wave+27,0);ctx.lineTo(seam-wave,hasCopy?split:h);ctx.stroke();
 }
 if(hasCopy){
  ctx.strokeStyle=color.edge;ctx.lineWidth=1.4;
  ctx.setLineDash(style===0?[2,6]:[]);
  ctx.beginPath();ctx.moveTo(26,split);ctx.lineTo(w-26,split);ctx.stroke();
  ctx.setLineDash([]);
 }

 const leftCover=style===1,coverWidth=leftCover?243:246,coverHeight=hasCopy?128:medium?140:106;
 const coverX=leftCover?39:588,coverY=center-coverHeight/2;
 if(thumb){
  const coverTrace=()=>rounded(ctx,coverX,coverY,coverWidth,coverHeight,leftCover?19:style===2?5:12);
  ctx.fillStyle=leftCover?color.edge:color.paper;coverTrace();ctx.fill();
  readingCover(ctx,thumb,coverX,coverY,coverWidth,coverHeight,coverTrace);
  ctx.strokeStyle=leftCover?color.paper:color.deep;ctx.lineWidth=3;coverTrace();ctx.stroke();
 }
 const avatarX=leftCover?397:69,avatarSize=medium?72:67,avatarY=center-avatarSize/2;
 const darkName=style===2;
 const avatarTrace=()=>leftCover?rounded(ctx,avatarX-avatarSize/2,avatarY,avatarSize,avatarSize,20):circle(ctx,avatarX,center,avatarSize/2);
 ctx.fillStyle=color.soft;avatarTrace();ctx.fill();
 if(avatar)readingCover(ctx,avatar,avatarX-avatarSize/2,avatarY,avatarSize,avatarSize,avatarTrace);
 else{
  ctx.fillStyle=color.ink;ctx.font='750 27px '+readingFont;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(mediumTextParts(row.creator)[0]||'n',avatarX,center);
 }
 ctx.strokeStyle=darkName?color.mark:color.edge;ctx.lineWidth=3.4;avatarTrace();ctx.stroke();

 const x=avatarX+avatarSize/2+17,nameWidth=leftCover?w-x-32:thumb?seam-x-(darkName?wave+7:20):seam-x-34;
 const name=String(row.creator||'')+'さん';
 let nameSize=36,nameLine;
 do{
  ctx.font='750 '+nameSize+'px '+readingFont;
  nameLine=readingLines(ctx,name,nameWidth,2,true);
  if(!nameLine.truncated||nameSize===25)break;
  nameSize--;
 }while(true);
 ctx.textAlign='start';ctx.textBaseline='top';ctx.fillStyle=darkName?color.paper:color.ink;
 const nameStep=nameSize+5,nameY=center-(nameLine.lines.length*nameStep-5)/2;
 nameLine.lines.forEach((line,i)=>ctx.fillText(line,x,nameY+i*nameStep));

 let copyTruncated=false;
 if(hasCopy){
  ctx.fillStyle=color.deep;ctx.font='700 23px '+readingFont;
  ctx.fillText(contentApi.label(row.presentation),42,182);
  ctx.fillStyle=color.ink;
  const copyTop=217,lineHeight=28,maxLines=Math.floor((h-copyTop-12)/lineHeight);
  ctx.font='500 25px '+readingFont;
  const copy=readingLines(ctx,row.presentation.text,w-84,maxLines);
  copy.lines.forEach((line,i)=>ctx.fillText(line,42,copyTop+i*lineHeight));
  copyTruncated=copy.truncated;
 }
 ctx.restore();
 trace();ctx.lineWidth=3;ctx.strokeStyle=color.deep;ctx.stroke();
 trace();ctx.lineWidth=1;ctx.strokeStyle=color.paper;ctx.stroke();
 row.presentationRender={width:w,height:h,fontSize:hasCopy?25:nameSize,content,truncated:copyTruncated,nameTruncated:nameLine.truncated};
 return canvas;
}
