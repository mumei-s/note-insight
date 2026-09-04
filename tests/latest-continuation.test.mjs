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

test("favorites remain in the existing React UI and Favorite Reader without an external DOM scanner", async () => {
  const index = await read("index.html");
  const v6 = await read("src/fast-insight-v6.tsx");
  const reader = await read("src/favorite-reader.tsx");

  assert.doesNotMatch(index, /insight-favorite-quick\.js/);
  assert.match(index, /notification-import\.html/);
  assert.match(index, /searchParams\.set\("from", "setup"\)/);
  assert.match(index, /searchParams\.set\("autopair", "1"\)/);
  assert.match(v6, /favorite_toggle/);
  assert.match(v6, /iv6-star/);
  assert.match(v6, /r\.favorite\?"★":"☆"/);
  assert.match(reader, /action: "favorites"/);
  assert.match(reader, /action: "favorite_toggle"/);
});

test("PWA service worker accepts the current autopair route and purges the stale freeze cache", async () => {
  const sw = await read("public/sw.js");
  assert.match(sw, /mumei-note-insight-v30/);
  assert.match(sw, /u\.searchParams\.get\("autopair"\) === "1"/);
  assert.match(sw, /return !fromSetup && !autoPair/);
  assert.match(sw, /fetch\(event\.request, \{ cache: "no-store" \}\)/);
  assert.doesNotMatch(sw, /client\.navigate\(ROOT_URL\)/);
});
