import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const dep=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const sharp=createRequire(import.meta.url)(dep?path.join(dep,'sharp'):'sharp');
const [source,dest]=process.argv.slice(2), data=JSON.parse(await fs.readFile(path.join(source,'yoizora-ready.json'),'utf8'));
await fs.mkdir(path.join(dest,'cards'),{recursive:true});
let cursor=0,bytes=0;
await Promise.all(Array.from({length:4},async()=>{for(;;){const row=data.rows[cursor++];if(!row)return;
  const png=await sharp(Buffer.from(row.pngBase64,'base64')).png({palette:true,colours:256,quality:90,dither:0.5,effort:7,compressionLevel:9}).toBuffer();
  const info=await sharp(png).metadata();if(info.width!==860||info.height!==140)throw new Error('Dimensions changed');
  row.pngSha256=crypto.createHash('sha256').update(png).digest('hex');row.pngBase64=png.toString('base64');bytes+=png.length;
  await fs.writeFile(path.join(dest,'cards',String(row.index).padStart(3,'0')+'.png'),png);
}}));
await fs.writeFile(path.join(dest,'yoizora-ready.json'),JSON.stringify(data));
await fs.copyFile(path.join(source,'people.json'),path.join(dest,'people.json'));
try{await fs.symlink(path.join(source,'api-cache'),path.join(dest,'api-cache'),'dir');}catch(e){if(e.code!=='EEXIST')throw e;}
console.log(JSON.stringify({count:data.count,pngBytes:bytes,jsonBytes:(await fs.stat(path.join(dest,'yoizora-ready.json'))).size}));
