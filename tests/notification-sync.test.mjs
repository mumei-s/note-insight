import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("notification sync detects the opened mobile notification view", async () => {
  const source = await readFile(
    new URL("../public/note-insight-notification-sync.user.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /@version\s+2\.1\.0/);
  assert.match(source, /tabByText\('通知'\)/);
  assert.match(source, /tabByText\('お知らせ'\)/);
  assert.match(source, /new MutationObserver\(check\)/);
  assert.match(source, /onNotificationOpened/);
  assert.doesNotMatch(source, /通知ベルを自動で見つけられません/);
});

test("notification status uses a non-obstructive edge drawer", async () => {
  const source = await readFile(
    new URL("../public/note-insight-notification-sync.user.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /data-sync-tab/);
  assert.match(source, /data-sync-panel/);
  assert.match(source, /data-sync-close/);
  assert.match(source, /right:'0'/);
  assert.match(source, /host\._collapse/);
});

test("magazine mute stays scoped to actor and notification type", async () => {
  const source = await readFile(
    new URL("../public/note-insight-notification-sync.user.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /isMagazineNotice\(text\)&&actors\.some/);
  assert.match(source, /mumeiMagazineMuted/);
  assert.match(source, /一時表示/);
});
