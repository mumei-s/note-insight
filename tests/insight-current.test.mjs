import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("participant dashboard stays on the restored live full-history INSIGHT", async () => {
  const app = await read("src/App.tsx");
  const live = await read("src/member-insight-live.tsx");
  const full = await read("src/member-insight-full.tsx");

  assert.match(app, /MemberInsightLive/);
  assert.match(app, /route === "dashboard"[\s\S]*MemberInsightLive/);
  assert.doesNotMatch(app, /MemberInsightApp/);
  assert.match(live, /visibilitychange/);
  assert.match(live, /window\.addEventListener\("focus"/);
  assert.match(live, /MemberInsightFull revision=\{revision\}/);
  for (const label of ["概要", "スキ履歴", "コメント", "応援者", "フォロー", "通知", "記事", "アカウント切替", "本人通知", "データ更新"]) assert.match(full, new RegExp(label));
  assert.match(full, /target="_blank" rel="noopener noreferrer">本人通知/);
  assert.match(full, /revision=0/);
});

test("comments refresh recent and pending threads without rebuilding history", async () => {
  const api = await read("supabase/functions/insight-member-api/index.ts");
  const note = await read("supabase/functions/insight-member-api/note.ts");
  const history = await read("supabase/functions/insight-member-history/index.ts");

  assert.match(api, /historyPage=3\+\(\(cursor-1\)%18\)/);
  assert.match(api, /p_status:"pending"/);
  assert.match(api, /refreshComments\.add\(row\.key\)/);
  assert.match(api, /refreshedCommentThreads/);
  assert.match(api, /x\.parent\?"reply":"comment"/);
  assert.match(note, /page<=20/);
  assert.match(note, /note_comments\?order=oldest&per_page=100&page=\$\{page\}/);
  assert.match(history, /noteId==="ss_yr"\?"owner"/);
  assert.match(history, /insight_fast_comment_threads/);
});

test("public comment/like notifications identify actors without private bell pairing", async () => {
  const api = await read("supabase/functions/insight-member-api/index.ts");
  const history = await read("supabase/functions/insight-member-history/index.ts");
  const full = await read("src/member-insight-full.tsx");

  assert.match(api, /actor_name:name/);
  assert.match(api, /member-public-watch/);
  assert.match(api, /さんが「\$\{art\.title\}」に\$\{x\.parent\?"返信":"コメント"\}しました/);
  assert.match(history, /\[m\.scope,m\.id\]/);
  assert.match(full, /r\.actor_name\|\|""/);
});

test("personal notification pairing is account-safe and reports paired state", async () => {
  const pairing = await read("supabase/functions/insight-notification-import-token/index.ts");
  const ingest = await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const setup = await read("public/notification-import.html");
  const userScript = await read("public/note-insight-notification-sync.user.js");

  assert.match(pairing, /authorized:true/);
  assert.match(pairing, /pairedState/);
  assert.match(pairing, /pairedExpiresAt/);
  assert.match(pairing, /pair-exchange/);
  assert.match(ingest, /NOTIFICATION_ACCOUNT_MISMATCH/);
  assert.match(ingest, /synced_note_id/);
  assert.match(setup, /本人通知は連携済みです/);
  assert.match(setup, /スキ・公開コメント・公開フォローは本人通知なしでもINSIGHTで追跡/);
  assert.match(userScript, /\/api\/v2\/current_user/);
  assert.match(userScript, /TOKEN_PREFIX='mumei_insight_notification_sync_token_v2:'/);
});

test("access switching and browser history never use the profile code as a password", async () => {
  const access = await read("src/access-portal-v6.tsx");
  const main = await read("src/main.tsx");
  const app = await read("src/App.tsx");

  assert.match(access, /アカウント切替/);
  assert.match(access, /<em>\{current \? "使用中" : "切替"\}<\/em>/);
  assert.match(access, /機種変更・再ログイン/);
  assert.doesNotMatch(access, /type="password"/);
  assert.doesNotMatch(access, /コードでINSIGHTへログイン/);
  assert.match(main, /if \(pwaTopLaunch\)/);
  assert.doesNotMatch(main, /rawInitialRoute/);
  assert.match(app, /popstate/);
  assert.doesNotMatch(main, /localStorage\.removeItem\(INSIGHT_TOKEN_KEY\)/);
});

test("distribution remains browser-neutral with PWA TOP hardening only as a safety net", async () => {
  const manifest = JSON.parse(await read("public/manifest.webmanifest"));
  const sw = await read("public/sw.js");
  const setup = await read("public/notification-setup.html");

  assert.equal(manifest.id, "/note-insight/");
  assert.equal(manifest.scope, "/note-insight/");
  assert.match(manifest.start_url, /^\/note-insight\/\?launch=top$/);
  assert.match(sw, /mumei-note-insight-v28/);
  assert.match(sw, /notification-setup\.html/);
  assert.match(setup, /from.*insight/);
});
