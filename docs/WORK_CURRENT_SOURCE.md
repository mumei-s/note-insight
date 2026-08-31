# WORK CURRENT SOURCE OF TRUTH

Updated: 2026-08-31 JST

## 2026-08-31 PRIMARY APP SPLIT — HIGHEST PRIORITY
The deployed primary `note-insight` app is now **INSIGHT + クリエイター名鑑 only**.

- Game UI/runtime is detached from the primary app.
- Do not expose or re-add `battle`, `game-admin`, game TOP cards, game bottom navigation, or game OWNER controls unless the user explicitly requests reconnection.
- Existing six-game source, CSS, tests, backend ledger support, migrations, records, and `docs/GAME_SPEC.md` remain preserved and must not be deleted or rolled back.
- For current primary-app work, `docs/PRIMARY_APP_SCOPE.md` is the canonical product-scope document.
- If games are resumed later, prefer a separate app/entry point rather than coupling them back into INSIGHT + 名鑑.

The game material below is a **preserved detached implementation archive**, not the current primary-app scope.

This file is the durable handoff for Work and normal chats. Treat the latest GitHub main plus this document as canonical. Do not overwrite unrelated newer work.

## Source priority
1. Latest GitHub `main` at the moment work starts.
2. `docs/PRIMARY_APP_SCOPE.md` for the current deployed app scope.
3. This document for preserved game implementation history.
4. Existing `docs/GAME_SPEC.md` for previously completed game rules/security.

## Navigation rules
- INSIGHT child screens/tabs -> INSIGHT top -> root TOP -> exit confirmation.
- Directory detail/features -> directory top -> root TOP -> exit confirmation.
- Primary root TOP contains INSIGHT and 名鑑 only.
- Root TOP exit confirmation must attempt to close the app/window. Browser/PWA restrictions may require a safe fallback, but do not freeze the app.
- OWNER/admin entry remains separated from participant TOP and protected by OWNER authentication.

## Game data/security rules — DETACHED ARCHIVE
- Ranked player art must be an approved user-uploaded directory card, max 3.
- Never replace a missing participant card with a profile avatar.
- Participant card art stays a still image; do not require generated video for participant cards.
- Trial/showcase uses official 無名S note / ちびS still artwork.
- Ranked exact opponent history stays private; public ranking/stats only expose safe aggregate information.
- Keep existing four games playable and do not regress their result/EXP/ranking/history recording if/when the detached game app is resumed.

## Quality target: premium modern smartphone game — DETACHED ARCHIVE
Do not ship a plain browser-dashboard look. Every game should visibly use illustration, character art, animated UI, layered backgrounds and impact effects.

Shared visual requirements:
- character stills rendered as real image elements in gameplay/opening/result scenes;
- parallax illustrated backgrounds;
- animated particles, light streaks, aura, impact flashes and screen shake where appropriate;
- character cut-ins for skills/fever/nova/boost;
- opening -> VS -> live play -> result flow;
- touch-first mobile HUD, readable on narrow screens;
- reduced-motion support;
- haptics when available;
- static image animation through camera pan/zoom/tilt/parallax rather than requiring participant video generation.

## Game roster — DETACHED ARCHIVE
Keep and upgrade:
1. COMMAND — tactical elemental duel.
2. TAP RUSH — reflex/rhythm target game.
3. ARCANE PUZZLE — 6x6 match-3. Rules must be explicit: swap adjacent runes, make 3+, chains build skill, diamond rune builds shield, rival attacks on countdown, 100% launches Arcane Nova.
4. STAR SHOOTER — lock-on target shooter.

Add:
5. CREATOR QUEST — lightweight action RPG battle. Character still art remains visible while enemies/effects/background animate. Player chooses ATTACK / GUARD / SKILL, builds SP, uses animated skill cut-ins, defeats multiple waves and a boss.
6. STAR CIRCUIT — arcade race. Character card is the driver portrait; vehicle/track/UI animate. Player changes lanes and uses BOOST, avoids hazards, collects energy, races a rival and finishes by distance/position.

## Openings — DETACHED ARCHIVE
Each game gets its own opening movie-style sequence using still art:
- illustration background;
- 無名S note as showcase character;
- opponent/ちびS when applicable;
- pan/zoom/parallax/light/particles;
- clear game title and mode identity;
- then transition directly into playable gameplay.

## Persistence discipline
Before large implementation changes, create a GitHub save point. Commit in small recoverable stages. Always start from current latest main. If usage limits appear, stop only after pushing the current compilable state and updating the handoff with remaining work.

## Preserved game implementation checkpoint — 2026-08-30
- GitHub checkpoint `49f671c` adds a playable CREATOR QUEST and STAR CIRCUIT without replacing the four existing game implementations.
- The arena exposes six game cards, six per-mode stat rows, and a six-mode live-game router in the preserved detached source.
- Shared gameplay presentation includes registered-card image parallax, layered particles/light, skill/fever/nova/boost cut-ins, impact shake, direct-art movie openings, and two-card result scenes. Registered participant images remain still image elements.
- CREATOR QUEST includes ATTACK / GUARD / SKILL, SP, three waves, a boss, haptics, pause, result, score, EXP, retry, and ranked ledger submission.
- STAR CIRCUIT includes three lanes, button/swipe steering, hazards, energy, BOOST, integrity, live rival distance/position, a 1,000 m finish, haptics, pause, result, score, EXP, retry, and ranked ledger submission.
- `creator-battle-ledger` accepts `quest` and `race` and returns both modes in safe aggregate rankings; the existing private history format is unchanged.
- TypeScript, production build, and all 7 static game test groups passed at the checkpoint.
- `creator-battle-ledger` Edge Function v5 was ACTIVE with `quest` and `race` enabled; its existing custom session/OWNER authentication and `verify_jwt=false` setting were preserved.
- The production `creator_duels_game_mode_check` constraint accepts all six modes. Migration `20260830180000_creator_duels_six_games.sql` records the same change.

## Current primary request
Keep the production-facing tool focused on INSIGHT and the creator directory. Preserve the completed game implementation separately and do not let game work destabilize or complicate INSIGHT / 名鑑.
