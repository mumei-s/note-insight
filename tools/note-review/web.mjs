import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

const backend = 'https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/note-review-kit';
const page = await readFile(new URL('./web/index.html',import.meta.url));
const unavailable = JSON.stringify({code:'unavailable', error:'点検室は現在準備中です。'});
const responseHeaders = {
  'Cache-Control':'no-store',
  'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'X-Robots-Tag':'noindex, nofollow',
};
const asJson = (res, status, body) => {
  res.writeHead(status, {...responseHeaders,'Content-Type':'application/json; charset=utf-8'});
  res.end(body);
};
function sameOrigin(req) {
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    return origin.protocol === 'https:' && origin.host === req.headers.host;
  } catch {return false;}
}
const server=createServer(async(req,res)=>{
  if (req.url === '/' && (req.method==='GET' || req.method==='HEAD')) {
    res.writeHead(200,{...responseHeaders,'Content-Type':'text/html; charset=utf-8'});
    return res.end(req.method==='GET'?page:undefined);
  }
  if (req.url !== '/api/kit') return asJson(res,404,'{"code":"not_found"}');
  if (!['GET','POST'].includes(req.method)) return asJson(res,405,'{"code":"method"}');
  if (!sameOrigin(req)) return asJson(res,403,'{"code":"origin"}');
  try {
    let body;
    if (req.method==='POST') {
      if (req.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json')
        return asJson(res,415,'{"code":"type"}');
      let size=0;
      const parts=[];
      for await (const part of req) {
        size+=part.length;
        if (size>140000) return asJson(res,413,'{"code":"too_large"}');
        parts.push(part);
      }
      body=Buffer.concat(parts);
    }
    const upstream=await fetch(backend,{method:req.method,body,
      headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
      redirect:'error',signal:AbortSignal.timeout(12000)});
    if (!upstream.headers.get('content-type')?.includes('application/json') || upstream.status===404)
      return asJson(res,503,unavailable);
    const data=await upstream.text();
    if (req.method==='GET' && (!upstream.ok || JSON.parse(data).version!==1))
      return asJson(res,503,unavailable);
    asJson(res,upstream.status,data);
  } catch {asJson(res,503,unavailable);}
});
server.requestTimeout=20000;
server.headersTimeout=15000;
server.listen(Number(process.env.PORT)||8080,'0.0.0.0');
