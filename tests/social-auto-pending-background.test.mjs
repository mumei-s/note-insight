import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-insight-social-compare-v1.js','utf8');
const begin=source.indexOf('async function autoPending(){');
const end=source.indexOf('function start(){',begin);
assert.ok(begin>=0&&end>begin,'the bounded background review is installed');
const scan=source.slice(begin,end);

test('owner note session checks stored missing relationships without full list reload',()=>{
 assert.match(scan,/id='ss_yr'/);
 assert.match(scan,/own\.isMyself!==true/);
 assert.match(scan,/batch\.rows\.slice\(0,12\)/);
 assert.match(scan,/6\*60\*60\*1000/);
 assert.match(scan,/action:'history_candidates',pendingOnly:true/);
 assert.match(scan,/row\.person_key===candidate\.person_key/);
 assert.match(scan,/typeof row\.is_following==='boolean'&&typeof row\.is_follower==='boolean'/);
 assert.match(scan,/confirmedPersonKeys/);
 assert.match(scan,/cursor=String\(candidate\.person_key\|\|''\)/);
 assert.doesNotMatch(scan,/\/api\/v3\/users\//);
 assert.match(source,/void autoPending\(\)/);
});
