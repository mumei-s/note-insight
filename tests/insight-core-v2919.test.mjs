import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("production keeps unified INSIGHT wrapper and all main panels",async()=>{
  const app=await read("src/App.tsx"),live=await read("src/member-insight-live-v2.tsx"),full=await read("src/member-insight-unified-v4.tsx");
  assert.match(app,/MemberInsightLiveV2/);
  for(const x of ["MemberInsightUnifiedV4","MemberInsightCompleteness","MemberInsightCommentsFinal","MemberInsightFavoritesFinal","MemberInsightSocialV2","MemberInsightNotificationsFinal","MemberInsightAnalyticsFinal"])assert.match(live,new RegExp(x));
  for(const x of ["スキ履歴","スキ順位","コメント","コメント順位","マガジン","お気に入り","フォロー","通知","記事","アカウント切替"])assert.match(full,new RegExp(x));
});

test("likes magazines favorites and archive features stay connected",async()=>{
  const full=await read("src/member-insight-unified-v4.tsx"),fav=await read("src/member-insight-favorites-final.tsx");
  for(const x of ["favorite_toggle","日ごと","月ごと","年ごと","参加人数","フォロワー","記事数","magazine_articles","favorite_articles","favorite_read_set","自分の記事・過去アーカイブ","さらに40件表示"])assert.match(full,new RegExp(x));
  for(const x of ["お気に入り・グループ管理","グループ作成","未分類","グループ削除","favorite_articles","favorite_read_set"])assert.match(fav,new RegExp(x));
});

test("comments workflow and exact final-reply heart remain available",async()=>{
  const c=await read("src/member-insight-comments-final.tsx");
  for(const x of ["要対応","未返信","相手返信","あなたの♡で終了","自分返信","counterpartHearted","最終返信に","さんの♡あり","さんの♡なし"])assert.match(c,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
});

test("social remains official-total plus latest-1000 tracking",async()=>{
  const s=await read("src/member-insight-social-v2.tsx"),rel=await read("supabase/functions/insight-relations/index.ts");
  for(const x of ["note公式の現在値","最新1,000人","【増】","【減】","人物一覧"])assert.match(s,new RegExp(x));
  assert.match(s,/不明 −\$\{c\}/);
  for(const x of ["NOTE_IDENTITY_LIST_CAPPED_AT_1000","syncCappedFollowers","official_total_plus_latest_1000","unknownEvent"])assert.match(rel,new RegExp(x));
});

test("analysis keeps 60-day exact-value views and comment-like analysis",async()=>{
  const a=await read("src/member-insight-analytics-final.tsx"),css=await read("src/member-insight-analytics-final.css");
  for(const x of ["60日","フォロワー日次増減","記事別VIEW構成比","記事別 VIEW × スキ","記事ごとの反応分析","スキ率＝スキ÷VIEW","コメント♡"])assert.match(a,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  for(const x of ["miaf-chart-readout","miaf-pie-table","miaf-scatter-readout"])assert.match(css,new RegExp(x));
});

test("favorite groups stay durable server-side with explicit delete",async()=>{
  const group=await read("supabase/functions/insight-favorite-groups/index.ts");
  for(const x of ["insight_favorite_groups","insight_favorite_creators","insight_member_sessions"])assert.match(group,new RegExp(x));
  for(const x of ["list","create","assign","rename","delete"])assert.match(group,new RegExp(`a===?"${x}"`));
});

test("TOP twice exits while note navigation does not log out",async()=>{
  const app=await read("src/App.tsx");
  for(const x of ["note-exit","もう1回で終了","function exitApp","android.intent.action.MAIN","android.intent.category.HOME"])assert.match(app,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(app,/https:\/\/note\.com\//);
  assert.doesNotMatch(app,/note-exit[^\n]*logout/i);
});

test("notification setup still locks storage to actual note account",async()=>{
  const setup=await read("public/notification-import.html"),ingest=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  for(const x of ["pair-start","noteId","X-Owner-Token","X-Insight-Token","mumei_return","通知フィルター・グループ管理"])assert.match(setup,new RegExp(x));
  assert.match(ingest,/NOTIFICATION_ACCOUNT_MISMATCH/);
  assert.match(ingest,/suppliedNoteId!==who\.noteId/);
});
