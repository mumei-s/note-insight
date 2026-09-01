import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("GitHub Pages primary artifact remains anonymous and installable", async () => {
  const index = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"));
  const assetNames = await readdir(new URL("../dist/assets/", import.meta.url));
  const javascript = (await Promise.all(assetNames.filter((name) => name.endsWith(".js")).map((name) => readFile(new URL(`../dist/assets/${name}`, import.meta.url), "utf8")))).join("\n");

  assert.match(index, /無名 S note/);
  assert.equal(manifest.start_url, "/note-insight/");
  assert.equal(manifest.display, "standalone");
  assert.doesNotMatch(index + javascript, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
});

test("private values are not checked into the public frontend", async () => {
  const apiSource = await readFile(new URL("../src/api.ts", import.meta.url), "utf8");
  assert.doesNotMatch(apiSource, /INSIGHT_SESSION_SECRET/);
  assert.doesNotMatch(apiSource, /INSIGHT_OWNER_ACCESS_HASH/);
  assert.match(apiSource, /X-Insight-Entry/);
  assert.match(apiSource, /X-Insight-Member/);
});

test("primary INSIGHT stays separated while CREATOR WORLD is a standalone page", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const top = await readFile(new URL("../src/hub-home.tsx", import.meta.url), "utf8");
  const gameHtml = await readFile(new URL("../game.html", import.meta.url), "utf8");
  const gameMain = await readFile(new URL("../src/game-main.tsx", import.meta.url), "utf8");
  const distGame = await readFile(new URL("../dist/game.html", import.meta.url), "utf8");
  const vite = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

  assert.match(app, /DETACHED_ROUTES/);
  assert.match(app, /"battle"/);
  assert.doesNotMatch(app, /import \{ BattleArenaPage \}/);
  assert.doesNotMatch(app, /import \{ CatalogIconsPage \}/);
  assert.match(top, /INSIGHT参加クリエイター/);
  assert.doesNotMatch(top, /名鑑参加クリエイター/);
  assert.match(gameHtml, /CREATOR WORLD/);
  assert.match(gameHtml, /creator-world-game-v8-opening\.css/);
  assert.match(gameMain, /BattleArenaPage/);
  assert.match(gameMain, /6 GAME ARENA/);
  assert.match(distGame, /CREATOR WORLD/);
  assert.match(vite, /game: "game\.html"/);
});

test("standalone trial has visible official illustration fallbacks", async () => {
  const shell = await readFile(new URL("../src/game-standalone.css", import.meta.url), "utf8");
  const opening = await readFile(new URL("../public/creator-world-game-v8-opening.css", import.meta.url), "utf8");
  const cinematic = await readFile(new URL("../public/creator-world-game-v9-six.css", import.meta.url), "utf8");

  assert.match(shell, /--g6-mumei:url\("https:\/\/xxhaerjvrgmnadxjqetz\.supabase\.co\/storage\/v1\/object\/public\/creator-images\/opponent\//);
  assert.match(shell, /--g6-chibi:url\("https:\/\/xxhaerjvrgmnadxjqetz\.supabase\.co\/storage\/v1\/object\/public\/creator-images\/opponent\//);
  assert.match(opening, /g8-opening-portrait\.player>span/);
  assert.match(opening, /var\(--g6-mumei\)/);
  assert.match(opening, /var\(--g6-chibi\)/);
  assert.match(cinematic, /g9-atmosphere/);
  assert.match(cinematic, /g9-cut-in/);
  assert.match(cinematic, /g9-result-cast/);
});

test("card management remains authenticated-self-only and gates ranked game use", async () => {
  const memberPage = await readFile(new URL("../public/directory-member.html", import.meta.url), "utf8");
  const dataClient = await readFile(new URL("../src/game-data-client.ts", import.meta.url), "utf8");
  const gameData = await readFile(new URL("../supabase/functions/creator-game-data/index.ts", import.meta.url), "utf8");
  const ledger = await readFile(new URL("../supabase/functions/creator-battle-ledger/index.ts", import.meta.url), "utf8");

  assert.match(memberPage, /他参加者の画像を編集・削除することはできません/);
  assert.doesNotMatch(memberPage, /participantId/);
  assert.match(memberPage, /battleOptIn/);
  assert.match(dataClient, /X-Owner-Token/);
  assert.match(dataClient, /X-Insight-Member/);
  assert.match(gameData, /BATTLE_CARD_REQUIRED/);
  assert.match(ledger, /PLAYER_CARD_NOT_AVAILABLE/);
});

test("the six game modes have distinct live mechanics and shared cinematic presentation", async () => {
  const arena = await readFile(new URL("../src/battle-arena-page.tsx", import.meta.url), "utf8");
  const engine = await readFile(new URL("../src/game-card-engine.ts", import.meta.url), "utf8");
  const ui = await readFile(new URL("../src/game-ui.tsx", import.meta.url), "utf8");
  const command = await readFile(new URL("../src/game-command.tsx", import.meta.url), "utf8");
  const tap = await readFile(new URL("../src/game-tap.tsx", import.meta.url), "utf8");
  const puzzle = await readFile(new URL("../src/game-match-view.tsx", import.meta.url), "utf8");
  const shooter = await readFile(new URL("../src/game-target-view.tsx", import.meta.url), "utf8");
  const quest = await readFile(new URL("../src/game-quest.tsx", import.meta.url), "utf8");
  const race = await readFile(new URL("../src/game-race.tsx", import.meta.url), "utf8");
  const cinematic = await readFile(new URL("../public/creator-world-game-v9-six.css", import.meta.url), "utf8");
  const ledger = await readFile(new URL("../supabase/functions/creator-battle-ledger/index.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260830180000_creator_duels_six_games.sql", import.meta.url), "utf8");

  for (const token of ["ROUND", "RIVAL INTENT", "ATTACK", "GUARD", "SIGNATURE", "CRITICAL", "COUNTER"]) assert.match(command, new RegExp(token));
  for (const token of ["TIME", "COMBO", "FEVER", "PERFECT", "GREAT", "GOOD", "MISS", "onPointerDown"]) assert.match(tap, new RegExp(token));
  for (const token of ["W = 6", "H = 6", "CHAIN", "ARCANE NOVA", "SHIELD", "HOW TO PLAY", "onPointerDown", "onPointerUp"]) assert.match(puzzle, new RegExp(token));
  for (const token of ["onPointerMove", "BOSS CARD", "PILOT SHIELD", "COMBO", "CRITICAL", "NOVA"]) assert.match(shooter, new RegExp(token));
  for (const token of ["WAVE_HP", "ATTACK", "GUARD", "SKILL", "SP", "BOSS", "GameAtmosphere", "SkillCutIn"]) assert.match(quest, new RegExp(token));
  for (const token of ["FINISH = 1000", "LANE", "BOOST", "ENERGY", "HAZARD", "onPointerDown", "onPointerUp", "GameAtmosphere", "SkillCutIn"]) assert.match(race, new RegExp(token));

  assert.match(engine, /deriveCardStats/);
  assert.match(engine, /balanceRatio/);
  assert.match(ui, /visibilitychange/);
  assert.match(ui, /BATTLE<br \/>START/);
  assert.match(ui, /GameAtmosphere/);
  assert.match(ui, /SkillCutIn/);
  assert.match(ui, /g9-result-cast/);
  assert.match(arena, /6つのゲーム/);
  assert.match(arena, /CreatorQuestBattle/);
  assert.match(arena, /StarCircuitBattle/);
  assert.match(arena, /TRIAL PLAY/);
  assert.match(arena, /RANKED MATCH/);
  for (const token of ["g9-atmosphere", "g9-cut-in", "g9ScreenShake", "g9-result-cast", "g9-quest", "g9-race", "prefers-reduced-motion"]) assert.match(cinematic, new RegExp(token));
  assert.match(ledger, /"choice", "tap", "puzzle", "shoot", "quest", "race"/);
  assert.match(migration, /'quest'::text/);
  assert.match(migration, /'race'::text/);
});

test("the public participant cache remains isolated behind RLS and an edge function", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260828103000_insight_participants_public.sql", import.meta.url), "utf8");
  const edge = await readFile(new URL("../supabase/functions/insight-participants/index.ts", import.meta.url), "utf8");

  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all .* from anon, authenticated/i);
  assert.match(edge, /unified_owner_sessions/);
  assert.match(edge, /action === "public"/);
  assert.match(edge, /action === "sync"/);
});
