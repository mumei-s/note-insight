import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";

const backend=readFileSync("supabase/functions/insight-social-events/index.ts","utf8");
const ui=readFileSync("src/member-insight-social-v2.tsx","utf8");
const start=backend.indexOf("function sameRunWindowCandidates(");
const end=backend.indexOf("async function investigateUnknown(",start);
assert.ok(start>=0&&end>start,"same-sync candidate helper exists");
const js=ts.transpileModule(backend.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const match=vm.runInNewContext(js+"\nsameRunWindowCandidates;",{Date,Map,Number,String});

test("人数のみの減少は同じ同期の範囲外人物を候補に戻すが、解除確定にはしない",()=>{
 const event={direction:"followers",detected_at:"2026-10-29T18:17:01Z"};
 const people=[{person_key:"recent-a",actor_name:"直近の人物A",last_seen_at:"2026-10-29T12:17:01Z"},{person_key:"recent-b",actor_name:"直近の人物B",last_seen_at:"2026-10-29T12:17:01Z"}];
 const checked=[{person_key:"recent-a",is_follower:true,follower_verified_at:"2026-10-29T12:17:01Z"},{person_key:"recent-b",is_follower:true,follower_verified_at:"2026-10-29T12:17:01Z"}];
 const exits=[{person_key:"recent-a",actor_name:"直近の人物A"},{person_key:"recent-b",actor_name:"直近の人物B"}];
 const found=match(people,checked,event,exits);
 assert.deepEqual(Array.from(found,r=>r.person_key),["recent-a","recent-b"]);
 assert.ok(found.every(r=>r.current_relation==="unverified"&&r.candidate_source==="same_scan_window_exit"&&r.identity_exact===false));
 assert.match(ui,/解除した本人とは未確定/);
});

test("減少後の再確認でフォロー継続が分かった人物を不明候補から除外",()=>{
 const event={direction:"followers",detected_at:"2026-10-29T18:17:01Z"},people=[{person_key:"later-positive"}];
 const check=[{person_key:"later-positive",is_follower:true,follower_verified_at:"2026-10-30T00:17:01Z"}];
 assert.equal(match(people,check,event,[{person_key:"later-positive"}]).length,0);
});

test("同じ同期の候補は本人scopeとrun_idと人数ゼロの範囲外記録に限定",()=>{
 const section=backend.slice(backend.indexOf("async function investigateUnknown("),backend.indexOf("function currentRelationship("));
 assert.match(section,/\.eq\("member_id",scope\)/);
 assert.match(section,/\.eq\("run_id",event\.run_id\)/);
 assert.match(section,/\.eq\("change_count",0\)/);
 assert.match(section,/\.eq\("event_type","removed"\)/);
 assert.match(section,/sameScanCandidates:sameScan\.length/);
 assert.doesNotMatch(section,/update\(|\.insert\(/);
});
