import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("OWNER favorite reader keeps favorites, grouping and durable reading state", async () => {
  const fast8 = await read("src/fast-insight-v8.tsx");
  const reader = await read("src/favorite-reader.tsx");
  const edge = await read("supabase/functions/insight-favorite-articles/index.ts");
  const migration = await read("supabase/migrations/20260904002728_insight_favorite_article_reads.sql");

  assert.match(fast8, /FavoriteReader/);
  assert.match(fast8, /data-iv8-favorite-reader/);
  assert.match(reader, /action:\s*["']favorites["']/);
  assert.match(reader, /action:\s*["']favorite_toggle["']/);
  assert.match(reader, /action:\s*["']read_set["']/);
  assert.match(reader, /currentPage\s*===\s*1/);
  for (const label of ["未読だけ", "既読だけ", "新しい順", "古い順", "このページの記事を検索", "未読に戻す"]) assert.match(reader, new RegExp(label));
  for (const label of ["お気に入りグループ", "グループ作成", "未分類", "通知グループとは別"]) assert.match(reader, new RegExp(label));
  assert.match(reader, /mumei-insight-favorite-creator-groups-v1/);
  assert.match(reader, /group_name/);
  assert.match(edge, /@supabase\/supabase-js@2\.112\.4/);
  assert.match(edge, /unified_owner_sessions/);
  assert.match(edge, /insight_favorite_article_reads/);
  assert.match(edge, /action === "read_set"/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all .* from anon, authenticated/i);
});
