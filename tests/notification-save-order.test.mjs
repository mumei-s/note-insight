import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function helpers(p,names){let source=read(p).replace(/^import .*;\n/gm,'');const ctx={createClient:()=>({}),Deno:{env:{get:()=>''},serve:()=>{}},console,URL,Date,Intl,Map,Set,Number,JSON};vm.createContext(ctx);source+='\nglobalThis.result={'+names.join(',')+'};';vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,ctx);return ctx.result}

test('通知は最後に保存した人物を先頭にし、重複の詳細を保持しても保存位置を古くしない',()=>{
 const{dedupe}=helpers('supabase/functions/insight-notification-feed-final/index.ts',['dedupe']);
 const old={id:'old',notification_type:'other',raw_text:'古い人物さんが追加しました',captured_at:'2026-09-20T00:00:00Z',occurred_at:'2027-01-01T00:00:00Z',meta:{event_identity:'notice:old'}};
 const fresh={id:'new',notification_type:'other',raw_text:'最終保存の人物さんが追加しました',captured_at:'2026-10-04T00:00:00Z',occurred_at:'2026-09-21T00:00:00Z',meta:{event_identity:'notice:new'}};
 const result=dedupe([old,{...fresh,captured_at:'2026-09-21T00:00:00Z',actor_image_url:'saved-image'},fresh]);assert.equal(result.length,2);assert.equal(result[0].captured_at,'2026-10-04T00:00:00Z');assert.equal(result[0].actor_image_url,'saved-image');assert.equal(result[1].id,'old');
});
