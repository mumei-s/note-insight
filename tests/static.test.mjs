import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("GitHub Pages artifact is anonymous and installable", async () => {
  const index = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"),
  );
  const assetNames = await readdir(new URL("../dist/assets/", import.meta.url));
  const javascript = (
    await Promise.all(
      assetNames
        .filter((name) => name.endsWith(".js"))
        .map((name) => readFile(new URL(`../dist/assets/${name}`, import.meta.url), "utf8")),
    )
  ).join("\n");

  assert.match(index, /無名 S note/);
  assert.equal(manifest.start_url, "/note-insight/");
  assert.equal(manifest.display, "standalone");
  assert.doesNotMatch(
    index + javascript,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );
});

test("private values are not checked into the public frontend", async () => {
  const apiSource = await readFile(new URL("../src/api.ts", import.meta.url), "utf8");
  assert.doesNotMatch(apiSource, /INSIGHT_SESSION_SECRET/);
  assert.doesNotMatch(apiSource, /INSIGHT_OWNER_ACCESS_HASH/);
  assert.match(apiSource, /X-Insight-Entry/);
  assert.match(apiSource, /X-Insight-Member/);
});

test("TOP embeds each participant rail in its own entrance", async () => {
  const top = await readFile(new URL("../src/hub-home.tsx", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(top, /INSIGHT参加クリエイター/);
  assert.match(top, /名鑑参加クリエイター/);
  assert.match(top, /<Entrance title="INSIGHT"[^>]*><ParticipantRail kind="insight"/);
  assert.match(top, /<Entrance title="クリエイター名鑑"[^>]*><ParticipantRail kind="catalog"/);
  assert.match(top, /profileUrl: `https:\/\/note\.com\/\$\{person\.note_id\}`/);
  assert.match(top, /profileUrl: icons\[creator\.note_id\]\?\.profileUrl/);
  assert.match(top, /#catalog\/\$\{encodeURIComponent\(person\.noteId\)\}/);
  assert.match(app, /CatalogIconsPage initialNoteId/);
});

test("card management remains authenticated-self-only and gates game use", async () => {
  const memberPage = await readFile(new URL("../public/directory-member.html", import.meta.url), "utf8");
  const dataClient = await readFile(new URL("../src/game-data-client.ts", import.meta.url), "utf8");
  const gameData = await readFile(new URL("../supabase/functions/creator-game-data/index.ts", import.meta.url), "utf8");
  const ledger = await readFile(new URL("../supabase/functions/creator-battle-ledger/index.ts", import.meta.url), "utf8");

  assert.match(memberPage, /OWNERも名鑑参加者として自分のカード/);
  assert.match(memberPage, /他参加者の画像を編集・削除することはできません/);
  assert.doesNotMatch(memberPage, /participantId/);
  assert.match(memberPage, /battleOptIn/);
  assert.match(dataClient, /X-Owner-Token/);
  assert.match(dataClient, /X-Insight-Member/);
  assert.match(gameData, /noteUrlname: "ss_yr"/);
  assert.match(gameData, /BATTLE_CARD_REQUIRED/);
  assert.match(ledger, /if \(await owner\(req\)\)/);
  assert.match(ledger, /PLAYER_CARD_NOT_AVAILABLE/);
});

test("OWNER bypasses the participant password with note-profile verification", async () => {
  const access = await readFile(new URL("../src/access-portal.tsx", import.meta.url), "utf8");
  const owner = await readFile(new URL("../src/owner-gate.tsx", import.meta.url), "utf8");

  assert.match(access, /OWNERはパスワード不要/);
  assert.match(access, /hasVerifiedOwnerSession/);
  assert.match(access, /OWNER本人認証で入る/);
  assert.match(owner, /noteプロフィールへ一時コード/);
  assert.match(owner, /nextRoute\(\)/);
});

test("the four game modes have distinct live mechanics and shared results", async () => {
  const arena = await readFile(new URL("../src/battle-arena-page.tsx", import.meta.url), "utf8");
  const engine = await readFile(new URL("../src/game-card-engine.ts", import.meta.url), "utf8");
  const ui = await readFile(new URL("../src/game-ui.tsx", import.meta.url), "utf8");
  const command = await readFile(new URL("../src/game-command.tsx", import.meta.url), "utf8");
  const tap = await readFile(new URL("../src/game-tap.tsx", import.meta.url), "utf8");
  const puzzle = await readFile(new URL("../src/game-match-view.tsx", import.meta.url), "utf8");
  const shooter = await readFile(new URL("../src/game-target-view.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/creator-world-game-v5.css", import.meta.url), "utf8");
  const spec = await readFile(new URL("../docs/GAME_SPEC.md", import.meta.url), "utf8");

  assert.match(ui, /BATTLE<br \/>START/);
  assert.match(ui, /WIN/);
  assert.match(ui, /DRAW/);
  assert.match(ui, /LOSE/);
  assert.match(ui, /EXP/);
  for (const token of ["ROUND", "RIVAL INTENT", "ATTACK", "GUARD", "SIGNATURE", "CRITICAL", "COUNTER"]) assert.match(command, new RegExp(token));
  for (const token of ["TIME", "COMBO", "FEVER", "PERFECT", "GREAT", "GOOD", "MISS", "onPointerDown"]) assert.match(tap, new RegExp(token));
  for (const token of ["W = 6", "H = 6", "CHAIN", "ARCANE NOVA", "SHIELD", "onPointerDown", "onPointerUp"]) assert.match(puzzle, new RegExp(token));
  for (const token of ["onPointerMove", "BOSS CARD", "PILOT SHIELD", "COMBO", "CRITICAL", "NOVA"]) assert.match(shooter, new RegExp(token));
  assert.match(engine, /deriveCardStats/);
  assert.match(engine, /balanceRatio/);
  assert.match(ui, /visibilitychange/);
  assert.match(ui, /PAUSED/);
  assert.match(arena, /TRIAL PLAY/);
  assert.match(arena, /RANKED MATCH/);
  assert.match(arena, /enemyCardPosition/);
  assert.match(arena, /playerCard\.url/);
  assert.match(arena, /row\.playerCard\.url/);
  assert.match(arena, /row\.opponent\.cardUrl/);
  assert.match(arena, /row\.byGame/);
  assert.match(styles, /g5BeatCountdown/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(spec, /fb2fc687afc18291bcc1dd1fd7472bcdeb624d70/);
  assert.doesNotMatch(arena + engine + ui + command + tap + puzzle + shooter + spec, /docs\.google|drive\.google|sheets\.google/i);
});

test("the public participant cache is isolated behind RLS and an edge function", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260828103000_insight_participants_public.sql", import.meta.url), "utf8");
  const edge = await readFile(new URL("../supabase/functions/insight-participants/index.ts", import.meta.url), "utf8");

  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all .* from anon, authenticated/i);
  assert.match(edge, /unified_owner_sessions/);
  assert.match(edge, /action === "public"/);
  assert.match(edge, /action === "sync"/);
});
