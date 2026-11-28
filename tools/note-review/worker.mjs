import {handleAuth, getAccessContext, isSameOriginJson, readLimitedJson, allowRate} from './auth.mjs';
import {getEngine} from './protected-core.mjs';
import {html, css, js, example} from './ui.mjs';

const contentPolicy = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const stages = new Set(['着手前', '作業中', '公開前']);
const assets = new Map([
  ['/', [html, 'text/html; charset=utf-8']],
  ['/owner', [html, 'text/html; charset=utf-8']],
  ['/ui.css', [css, 'text/css; charset=utf-8']],
  ['/ui.js', [js, 'text/javascript; charset=utf-8']],
  ['/robots.txt', ['User-agent: *\nDisallow: /\n', 'text/plain; charset=utf-8']],
]);
function error(message, status) { return Response.json({error:message}, {status}); }

function safeHeaders(res) {
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-store, private');
  headers.set('Vary', 'Cookie');
  headers.set('Content-Security-Policy', contentPolicy);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(res.body, {status:res.status, headers});
}

// A receipt groups an account's results for the day without exposing its note ID.
async function receipt(subject, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const day = new Date().toISOString().slice(0,10);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode('receipt/' + day + '/' + subject)));
  const account = Array.from(signature.slice(0, 5), b => b.toString(16).padStart(2,'0')).join('');
  return 'S-' + day.replaceAll('-','') + '-' + account + '-' + crypto.randomUUID().slice(0,6);
}

async function route(request, env) {
  const path = new URL(request.url).pathname;
  if (assets.has(path)) {
    if (!['GET','HEAD'].includes(request.method)) return error('利用できない操作です。', 405);
    const [body, mime] = assets.get(path);
    return new Response(request.method === 'HEAD' ? null : body, {headers:{'Content-Type':mime}});
  }
  const auth = await handleAuth(request, env, path);
  if (auth) return auth;
  if (path !== '/api/review' && path !== '/api/example') return error('ページが見つかりません。',404);
  const reviewRoute = path === '/api/review';
  if (request.method !== (reviewRoute ? 'POST' : 'GET')) return error('利用できない操作です。',405);
  if (reviewRoute && !isSameOriginJson(request)) return error('ツールを開き直してください。',403);
  const viewer = await getAccessContext(request, env);
  if (!viewer) return error('本人確認が必要です。',401);
  if (!viewer.active) return error('利用権の状態を確認してください。',403);
  if (!reviewRoute) return Response.json(example);
  let input;
  try { input = await readLimitedJson(request, 140000); }
  catch (e) { return error(e.status === 413 ? '原稿を短くしてお試しください。' : '入力形式を確認してください。', e.status === 413 ? 413 : 400); }
  const {draft,evidence = '',stage} = input;
  if (typeof draft !== 'string' || !draft.trim() || typeof evidence !== 'string' || !stages.has(stage))
    return error('工程を選び、点検する原稿を入力してください。',400);
  if (draft.length > 24000 || evidence.length > 8000)
    return error('原稿は24,000字、根拠は8,000字以内で入力してください。',413);
  if (!await allowRate(env.DB, 'review-minute', viewer.subject, 12, 60)
      || !await allowRate(env.DB, 'review-day', viewer.subject, 100, 86400))
    return error('短時間または一日の点検回数の上限に達しました。時間をおいてお使いください。',429);
  const engine = await getEngine(env.RULE_KEY);
  const result = engine.review({draft, evidence, stage});
  return Response.json({...result,receipt:await receipt(viewer.subject, env.OWNER_KEY)});
}

export default {
  async fetch(request, env) {
    try { return safeHeaders(await route(request, env)); }
    catch { return safeHeaders(error('点検室の準備が整っていません。時間をおいてお試しください。',503)); }
  },
};
