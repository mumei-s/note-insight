import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("本人通知の新規端末連携は既存端末を失効させない", async () => {
  const source = await read("supabase/functions/insight-notification-import-token/index.ts");
  const issue = source.match(/async function issueToken[\s\S]*?async function pairedState/)?.[0] || "";
  assert.match(issue, /insight_notification_ingest_tokens"\)\.insert/);
  assert.doesNotMatch(issue, /update\(\{revoked_at/);
  assert.match(source, /activeDeviceCount/);
  assert.match(source, /3650\*24\*60\*60\*1000/);
});

test("INSIGHTから共通の本人通知連携画面へ入り状態を分離表示する", async () => {
  const [page, launcher] = await Promise.all([
    read("public/notification-connection.html"),
    read("src/member-insight-live-v2.tsx"),
  ]);
  assert.match(page, /「INSIGHT参加中」と「本人通知の端末連携」は別状態/);
  assert.match(page, /GitHubの作成や複製は不要/);
  assert.match(page, /call\('pair-start'\)/);
  assert.match(page, /NOTE_ACCOUNT_MISMATCH/);
  assert.match(page, /activeDeviceCount/);
  assert.match(launcher, /notification-connection\.html/);
});

test("期限切れは再連携へ誘導する", async () => {
  const [reader, controls, pair] = await Promise.all([
    read("public/note-insight-notification-reader-v4.js"),
    read("public/note-insight-notification-controls-v1.js"),
    read("public/note-insight-notification-account-pair-v1.js"),
  ]);
  assert.match(reader, /errorCode:String\(e\?\.code\|\|''\)/);
  assert.match(controls, /repair\?'再連携'/);
  assert.match(pair, /NOTE_LOGIN_REQUIRED/);
  assert.match(pair, /NOTE_ACCOUNT_MISMATCH/);
});

test("共有画像は静的な可読PNGを参照する", async () => {
  const html = await read("index.html");
  assert.match(html, /mumei-s\.github\.io\/note-insight\/og-insight-20261003\.png/);
  assert.doesNotMatch(html, /functions\/v1\/insight-og-image/);
});
