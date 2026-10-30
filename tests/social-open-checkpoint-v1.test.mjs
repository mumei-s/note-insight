import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("src/member-insight-live-v2.tsx","utf8");
const relation=source.slice(source.indexOf("  async function relationSync(force=false){"),source.indexOf("  async function publicSync(force=false){"));
const startup=source.slice(source.indexOf("    // Recheck a saved relationship checkpoint"),source.indexOf("    if(!official)void loadOfficial();"));
test("INSIGHT起動時・復帰時にはフォロワーとフォローを画面訪問に関係なく差分確認する",()=>{
 assert.match(startup,/void relationSync\(false\)/);
 assert.match(startup,/if\(!skipSocialBootstrap\.current\)check\(\)/);
 assert.match(startup,/window\.setTimeout\(/);
 assert.match(startup,/window\.addEventListener\("pageshow",resume\)/);
 assert.match(startup,/document\.addEventListener\("visibilitychange",resume\)/);
 assert.doesNotMatch(startup,/publicSync\(true\)/,"startup must not force public-history sweep");
});
test("6時間のサーバー定期同期を活用し、30分以内なら重複する全員取得を省略する",()=>{
 assert.match(relation,/post\(RELATIONS,"dashboard"/);
 assert.match(relation,/latest\.set\(direction,Date\.parse/);
 assert.match(relation,/now-verified!>=RELATION_MS/);
 assert.match(relation,/if\(!due\.length\)/);
 assert.match(relation,/post\(RELATIONS,"sync",\{direction\}/);
 assert.match(relation,/lastRelationAttempt\.current<120_000/);
});
test("差分同期中に他のコメント・スキ画面をリロードせず、失敗を成功扱いしない",()=>{
 assert.match(relation,/navigation\.current\.mode==="social"/);
 assert.match(relation,/results\.every\(result=>result\.status==="fulfilled"\)/);
 assert.match(relation,/if\(complete\)/);
 assert.doesNotMatch(relation,/window\.location\.reload|localStorage\.clear\(/);
});
