import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("unpaired personal notifications auto-start the existing safe ID-checked pairing flow", async () => {
  const setup = await read("public/notification-setup.html");
  const page = await read("public/notification-import.html");
  const pairing = await read("supabase/functions/insight-notification-import-token/index.ts");
  const userScript = await read("public/note-insight-notification-sync.user.js");

  assert.match(setup, /autopair=1/);
  assert.match(page, /autoPair=qs\.get\('autopair'\)==='1'/);
  assert.match(page, /if\(autoPair&&!paired\).*startPair\(true\)/);
  assert.match(page, /call\('pair-start'\)/);
  assert.match(page, /mumei_role/);
  assert.match(pairing, /insight_notification_pair_codes/);
  assert.match(pairing, /pair-exchange/);
  assert.match(userScript, /expected&&expected!==id/);
  assert.match(userScript, /PAIR_ACCOUNT_MISMATCH/);
});

test("OWNER can add or remove favorites directly beside note profile links without a second favorite store", async () => {
  const index = await read("index.html");
  const quick = await read("public/insight-favorite-quick.js");
  const reader = await read("src/favorite-reader.tsx");

  assert.match(index, /insight-favorite-quick\.js/);
  assert.match(index, /notification-import\.html/);
  assert.match(index, /searchParams\.set\("autopair", "1"\)/);
  assert.match(quick, /action:'favorites'/);
  assert.match(quick, /action:'favorite_toggle'/);
  assert.match(quick, /parts\.length!==1/);
  assert.match(quick, /creatorKey:id/);
  assert.match(quick, /★/);
  assert.match(quick, /☆/);
  assert.match(reader, /action: "favorites"/);
  assert.match(reader, /action: "favorite_toggle"/);
});
