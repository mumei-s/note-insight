import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("production favorite tab uses durable account-scoped groups", async () => {
  const live = await read("src/member-insight-live-v2.tsx");
  const css = await read("src/member-insight-live-v2.css");
  const reader = await read("src/member-insight-favorites-final.tsx");
  const groups = await read("supabase/functions/insight-favorite-groups/index.ts");
  const migration = await read("supabase/migrations/20260906021500_insight_favorite_groups.sql");

  assert.match(live, /MemberInsightFavoritesFinal/);
  assert.match(live, /label==="お気に入り"/);
  assert.match(live, /mode==="favorites"/);
  assert.match(css, /mode-favorites/);
  for (const label of ["お気に入り・グループ管理","グループ作成","未分類","通知フィルターのグループとは別","グループ管理","名前変更","グループ削除"]) assert.match(reader, new RegExp(label));
  for (const action of ["create","assign","rename","delete","list"]) assert.match(reader+groups, new RegExp(`action[:=].*["']${action}["']|a===?["']${action}["']`));
  assert.match(reader, /favorite_articles/);
  assert.match(reader, /favorite_read_set/);
  assert.match(groups, /insight_member_sessions/);
  assert.match(groups, /insight_favorite_groups/);
  assert.match(groups, /insight_favorite_creators/);
  assert.match(migration, /create table if not exists public\.insight_favorite_groups/i);
  assert.match(migration, /enable row level security/i);
});

test("legacy OWNER reader remains compatible while production uses final reader", async () => {
  const reader = await read("src/favorite-reader.tsx");
  const edge = await read("supabase/functions/insight-favorite-articles/index.ts");
  assert.match(reader, /お気に入りグループ/);
  assert.match(edge, /group_create/);
  assert.match(edge, /group_rename/);
  assert.match(edge, /group_delete/);
  assert.match(edge, /insight_favorite_groups/);
});
