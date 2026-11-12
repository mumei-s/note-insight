const readingPalettes=[
 {paper:'#eef8f5',soft:'#cde9e1',deep:'#103d3b',edge:'#24796b',ink:'#122f2c',mark:'#f2be73'},
 {paper:'#f7f0ff',soft:'#e7ddf7',deep:'#392c59',edge:'#7357a0',ink:'#312543',mark:'#fab9a0'},
 {paper:'#fff4e5',soft:'#f5e1cb',deep:'#4b3428',edge:'#9a5d37',ink:'#432e25',mark:'#f5b960'},
 {paper:'#edf5ff',soft:'#d6e8fd',deep:'#183d63',edge:'#3975a8',ink:'#182f4c',mark:'#b7db80'},
 {paper:'#fff0f2',soft:'#f6dbe0',deep:'#562f3e',edge:'#a65168',ink:'#452433',mark:'#ffd08f'},
 {paper:'#f1f4e5',soft:'#e3e8cf',deep:'#363f25',edge:'#657740',ink:'#303921',mark:'#e8bb74'},
 {paper:'#e8f8fc',soft:'#c9e7f0',deep:'#163e50',edge:'#28798a',ink:'#163743',mark:'#f2ad78'},
 {paper:'#fff1e9',soft:'#f5d6c8',deep:'#562c25',edge:'#ab5743',ink:'#4f2b26',mark:'#f9c567'},
 {paper:'#f3f2ee',soft:'#deddd4',deep:'#2b303b',edge:'#596a7b',ink:'#252b33',mark:'#e4ba6c'},
 {paper:'#eef0ff',soft:'#d9ddfa',deep:'#272b59',edge:'#525f9f',ink:'#262a4e',mark:'#ffd28c'},
 {paper:'#f9f3dd',soft:'#f0e2b5',deep:'#484020',edge:'#8b702f',ink:'#383019',mark:'#a9dfd8'},
 {paper:'#fceefa',soft:'#efd4e9',deep:'#482944',edge:'#8e4d80',ink:'#38243b',mark:'#f5c888'}
];
const readingFont='system-ui,-apple-system,"Noto Sans CJK JP","Noto Sans JP",sans-serif';

// Each entry changes the geometry, image position, avatar frame and balance
// of the strip. Repeat the palette cycle before returning to the same pair.
const readingStyles=[
 {shape:'ticket', left:false, wide:252, corners:12, avatar:34, pane:'media'},
 {shape:'arch', left:true, wide:248, corners:23, avatar:19, pane:'media'},
 {shape:'fold', left:false, wide:260, corners:5, avatar:34, pane:'name'},
 {shape:'capsule', left:true, wide:278, corners:40, avatar:34, pane:'paper'},
 {shape:'tab', left:false, wide:235, corners:20, avatar:12, pane:'name'},
 {shape:'steps', left:true, wide:284, corners:7, avatar:10, pane:'paper'},
 {shape:'stamp', left:false, wide:274, corners:13, avatar:16, pane:'media'},
 {shape:'slant', left:true, wide:254, corners:9, avatar:34, pane:'name'},
 {shape:'corner', left:false, wide:284, corners:29, avatar:17, pane:'paper'},
 {shape:'wave', left:true, wide:246, corners:22, avatar:34, pane:'media'},
 {shape:'inset', left:false, wide:266, corners:5, avatar:12, pane:'name'},
 {shape:'bevel', left:true, wide:252, corners:15, avatar:22, pane:'paper'}
];

function usesReadingArtwork(row){
 return row.presentation?.version>=2&&!row.gallery126&&!row.finalMarker;
}

function readingPolygon(ctx,points){
 ctx.beginPath();
 ctx.moveTo(...points[0]);
 for(const point of points.slice(1))ctx.lineTo(...point);
 ctx.closePath();
}

function readingSilhouette(ctx,shape,w,h,seam,hasCopy){
 const l=6,t=6,r=w-6,b=h-6,m=h/2;
 if(shape==='capsule'){rounded(ctx,l,t,r-l,b-t,Math.min(58,m-l));return;}
 if(shape==='inset'){rounded(ctx,l,t,r-l,b-t,21);return;}
 const polygons={
  fold:[[l+28,t],[r,t],[r,b-30],[r-30,b],[l,b],[l,t+28]],
  tab:[[l+17,t],[r-21,t],[r,t+21],[r,m-15],[r-24,m],[r,m+15],[r,b-20],[r-20,b],[l,b],[l,t+17]],
  steps:[[l+27,t],[r,t],[r,b-26],[r-32,b-26],[r-32,b],[l,b],[l,t+25],[l+27,t+25]],
  slant:[[l+29,t],[r,t],[r-27,b],[l,b]],
  corner:[[l,t],[r-43,t],[r,t+31],[r,b],[l+35,b],[l,b-27]],
  bevel:[[l+18,t],[r-24,t],[r,t+24],[r,b-24],[r-24,b],[l+18,b],[l,b-18],[l,t+18]]
 };
 if(polygons[shape]){readingPolygon(ctx,polygons[shape]);return;}
 ctx.beginPath();
 if(shape==='arch'){
  ctx.moveTo(l+62,t);ctx.lineTo(r-15,t);ctx.quadraticCurveTo(r,t,r,t+15);
  ctx.lineTo(r,b-15);ctx.quadraticCurveTo(r,b,r-15,b);ctx.lineTo(l+62,b);
  ctx.quadraticCurveTo(l,b,l,m);ctx.quadraticCurveTo(l,t,l+62,t);
 }else if(shape==='stamp'){
  ctx.moveTo(l+9,t);ctx.lineTo(r-9,t);ctx.quadraticCurveTo(r,t,r,t+9);
  for(let y=t+16;y<b-19;y+=18){
   ctx.lineTo(r,y);ctx.quadraticCurveTo(r-15,y+5,r,y+10);
  }
  ctx.lineTo(r,b-9);ctx.quadraticCurveTo(r,b,r-9,b);ctx.lineTo(l+9,b);
  ctx.quadraticCurveTo(l,b,l,b-9);ctx.lineTo(l,t+9);ctx.quadraticCurveTo(l,t,l+9,t);
 }else if(shape==='wave'){
  ctx.moveTo(l+19,t);ctx.lineTo(r-24,t);ctx.quadraticCurveTo(r,t,r,t+24);
  ctx.lineTo(r,b-16);ctx.bezierCurveTo(r-112,b-42,r-134,b,r-243,b);
  ctx.lineTo(l+18,b);ctx.quadraticCurveTo(l,b,l,b-18);ctx.lineTo(l,t+19);
  ctx.quadraticCurveTo(l,t,l+19,t);
 }else{
  const notch=13;
  ctx.moveTo(l+14,t);
  if(!hasCopy){
   ctx.lineTo(seam-notch,t);ctx.bezierCurveTo(seam-notch,t+17,seam+notch,t+17,seam+notch,t);
  }
  ctx.lineTo(r-14,t);ctx.quadraticCurveTo(r,t,r,t+14);
  if(hasCopy){ctx.lineTo(r,150);ctx.bezierCurveTo(r-19,150,r-19,176,r,176);}
  ctx.lineTo(r,b-14);ctx.quadraticCurveTo(r,b,r-14,b);
  if(!hasCopy){
   ctx.lineTo(seam+notch,b);ctx.bezierCurveTo(seam+notch,b-17,seam-notch,b-17,seam-notch,b);
  }
  ctx.lineTo(l+14,b);ctx.quadraticCurveTo(l,b,l,b-14);
  if(hasCopy){ctx.lineTo(l,176);ctx.bezierCurveTo(l+19,176,l+19,150,l,150);}
  ctx.lineTo(l,t+14);ctx.quadraticCurveTo(l,t,l+14,t);
 }
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

function readingAccent(ctx,style,color,seam,hero,variant){
 ctx.save();
 ctx.strokeStyle=style.pane==='paper'?color.edge:color.mark;
 ctx.fillStyle=ctx.strokeStyle;
 ctx.lineWidth=2.5;
 switch(variant%4){
  case 0:
   ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(seam,19);ctx.lineTo(seam,hero-19);ctx.stroke();
   break;
  case 1:
   for(let i=-1;i<=1;i++){
    ctx.beginPath();ctx.moveTo(seam+i*8-10,14);ctx.quadraticCurveTo(seam+i*8+21,hero/2,seam+i*8-10,hero-14);ctx.stroke();
   }
   break;
  case 2:
   for(let y=24;y<hero-16;y+=18){
    readingPolygon(ctx,[[seam,y-5],[seam+5,y],[seam,y+5],[seam-5,y]]);ctx.fill();
   }
   break;
  default:
   ctx.beginPath();ctx.moveTo(seam-9,15);ctx.lineTo(seam+9,hero-15);ctx.stroke();
   ctx.beginPath();ctx.moveTo(seam+1,15);ctx.lineTo(seam+19,hero-15);ctx.stroke();
 }
 ctx.restore();
}

function drawReadingArtwork(canvas,row,avatar,thumb){
 const medium=row.presentation.size==='medium',content=contentApi.visibleContent(row.presentation);
 const text=contentApi.introText(row.presentation),hasCopy=medium&&Boolean(text)&&content!=='name';
 const w=canvas.width=W,h=canvas.height=medium?360:H;
 const ctx=qualityCall('observeContext',[canvas.getContext('2d'),row,w,h],canvas.getContext('2d'));
 const ordinal=thinDesignOrdinal(row),styleIndex=ordinal%readingStyles.length,cycle=Math.floor(ordinal/readingStyles.length);
 const style=readingStyles[styleIndex],color=readingPalettes[(cycle+styleIndex*5)%readingPalettes.length];
 const variant=styleIndex+Math.floor(cycle/readingPalettes.length);
 const coverWidth=style.wide,coverHeight=hasCopy?119:medium?148:100;
 const leftCover=style.left&&Boolean(thumb),hero=hasCopy?159:h,center=hero/2;
 const coverX=leftCover?37:w-coverWidth-34,coverY=center-coverHeight/2;
 const seam=thumb?(leftCover?coverX+coverWidth+22:coverX-23):w-73;
 const darkName=style.pane==='name';
 const trace=()=>readingSilhouette(ctx,style.shape,w,h,seam,hasCopy);
 const paper=ctx.createLinearGradient(24,0,w-24,h);
 paper.addColorStop(0,color.paper);paper.addColorStop(1,color.soft);
 ctx.save();trace();ctx.clip();
 ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);
 if(style.pane!=='paper'&&(thumb||darkName)){
  const left=thumb?(darkName?!leftCover:leftCover):true;
  const bend=styleIndex%2===0?11:-11;
  ctx.fillStyle=color.deep;
  readingPolygon(ctx,left?[[0,0],[seam+bend,0],[seam-bend,hero],[0,hero]]:[[seam+bend,0],[w,0],[w,hero],[seam-bend,hero]]);
  ctx.fill();
 }
 readingAccent(ctx,style,color,seam,hero,variant);
 if(style.shape==='inset'){
  ctx.strokeStyle=color.edge;ctx.lineWidth=1.5;
  rounded(ctx,14,14,w-28,h-28,15);ctx.stroke();
 }
 if(hasCopy){
  ctx.strokeStyle=color.edge;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(31,hero);ctx.lineTo(w-31,hero);ctx.stroke();
 }
 if(thumb){
  const coverTrace=()=>rounded(ctx,coverX,coverY,coverWidth,coverHeight,style.corners);
  ctx.fillStyle=color.soft;coverTrace();ctx.fill();
  readingCover(ctx,thumb,coverX,coverY,coverWidth,coverHeight,coverTrace);
  ctx.strokeStyle=style.pane==='media'?color.paper:color.deep;ctx.lineWidth=3;coverTrace();ctx.stroke();
 }

 const avatarSize=medium?69:64,avatarX=leftCover?seam+57:71,avatarY=center-avatarSize/2;
 const avatarTrace=()=>rounded(ctx,avatarX-avatarSize/2,avatarY,avatarSize,avatarSize,style.avatar);
 ctx.fillStyle=color.soft;avatarTrace();ctx.fill();
 if(avatar)readingCover(ctx,avatar,avatarX-avatarSize/2,avatarY,avatarSize,avatarSize,avatarTrace);
 else{
  ctx.fillStyle=color.ink;ctx.font='750 27px '+readingFont;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(mediumTextParts(row.creator)[0]||'n',avatarX,center);
 }
 ctx.strokeStyle=darkName?color.mark:color.edge;ctx.lineWidth=3.4;avatarTrace();ctx.stroke();

 const x=avatarX+avatarSize/2+15,nameWidth=leftCover?w-x-43:seam-x-24;
 const name=String(row.creator||'')+'さん';
 let nameSize=36,nameLine;
 for(;nameSize>=25;nameSize--){
  ctx.font='750 '+nameSize+'px '+readingFont;
  nameLine=readingLines(ctx,name,nameWidth,2,true);
  if((!nameLine.truncated&&nameLine.lines.at(-1)!=='さん')||nameSize===25)break;
 }
 ctx.textAlign='start';ctx.textBaseline='top';ctx.fillStyle=darkName?color.paper:color.ink;
 const nameStep=nameSize+5,nameY=center-(nameLine.lines.length*nameStep-5)/2;
 nameLine.lines.forEach((line,i)=>ctx.fillText(line,x,nameY+i*nameStep));

 let copyTruncated=false;
 if(hasCopy){
  const copyTop=182,lineHeight=29,maxLines=Math.floor((h-copyTop-21)/lineHeight);
  ctx.fillStyle=color.ink;ctx.font='500 26px '+readingFont;
  const copy=readingLines(ctx,text,w-90,maxLines);
  copy.lines.forEach((line,i)=>ctx.fillText(line,45,copyTop+i*lineHeight));
  copyTruncated=copy.truncated;
 }
 ctx.restore();
 trace();ctx.lineWidth=4;ctx.strokeStyle=color.deep;ctx.stroke();
 trace();ctx.lineWidth=1.5;ctx.strokeStyle=color.paper;ctx.stroke();
 row.presentationRender={width:w,height:h,fontSize:hasCopy?26:nameSize,content,truncated:copyTruncated,nameTruncated:nameLine.truncated};
 return canvas;
}
