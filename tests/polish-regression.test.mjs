import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("TOP requires two TOP presses and exit never logs out",async()=>{const app=await read("src/App.tsx"),home=await read("src/hub-home.tsx");for(const x of ["topArmed","TOPをもう一度押すと終了","大元TOP｜TOPを2回押すと終了","./exit.html"])assert.match(app,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));assert.match(home,/アプリを終了してnoteへ/);assert.match(home,/https:\/\/note\.com\//);const exitLink=home.match(/<section className="hub-note-exit-wrap">[\s\S]*?<\/section>/)?.[0]||"";assert.doesNotMatch(exitLink,/forgetMemberSession|forgetInsightAccount|removeItem|logout|leave/);});

test("notification list is dense without dropping fields",async()=>{const css=await read("src/insight-polish-v1.css"),ui=await read("src/member-insight-notifications-final.tsx");for(const x of [".minf-list{gap:6px", ".minf-list article{padding:8px 9px", ".minf-avatar{width:34px", ".minf-main{gap:2px", "-webkit-line-clamp:2"])assert.match(css,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));for(const x of ["minf-meta","minf-who","minf-main","minf-target"])assert.match(ui,new RegExp(x));});

test("supporter metric is explicitly inbound",async()=>{const css=await read("src/insight-polish-v1.css");assert.match(css,/スキしてくれた人数/);assert.match(css,/inbound unique supporters/);});

test("dashboard analysis uses only ALL snapshots and never mixes custom periods",async()=>{const api=await read("supabase/functions/insight-dashboard-data/index.ts"),ui=await read("src/member-insight-analytics-final.tsx");assert.match(api,/filter\(\(r:any\)=>String\(r\.period_type\)===?"all"\)/);assert.match(api,/periodType:"all"/);assert.match(api,/const latest=allSnaps\.at\(-1\)/);assert.doesNotMatch(ui,/全体スキ率/);assert.doesNotMatch(ui,/全体コメント率/);for(const x of ["累計VIEW（ALL）","累計スキ（ALL）","累計コメント（ALL）","期間の違うDashboard値は混ぜません"])assert.match(ui,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));});

test("comment likes are analyzed as events people and ranked actors only on analysis run",async()=>{const ui=await read("src/member-insight-analytics-final.tsx"),css=await read("src/insight-polish-v1.css");for(const x of ["loadCommentLikes","comment_like","コメント♡ 件数","コメント♡してくれた人数","COMMENT LIKE ANALYSIS","本人通知から集計"])assert.match(ui,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));assert.match(css,/miaf-commentlike-list/);assert.match(ui,/useEffect\(\(\)=>\{void refresh\(\)\},\[\]\)/);assert.doesNotMatch(ui,/setInterval|visibilitychange/);});

test("follower delta chart exposes every intermediate tick and exact before-after counts",async()=>{const ui=await read("src/member-insight-analytics-final.tsx"),css=await read("src/insight-polish-v1.css");for(const x of ["for(let v=axisMax","v>=-axisMax","v-=step","prevCount","前日 → 当日","目盛り単位","増減（人/日）","日付（JST）"])assert.match(ui,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));assert.match(css,/miaf-grid/);assert.match(css,/stroke-dasharray:2 4/);});
