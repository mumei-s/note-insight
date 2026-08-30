# WORK CURRENT SOURCE OF TRUTH

Updated: 2026-08-30 JST

This file is the durable handoff for Work and normal chats. Treat the latest GitHub main plus this document as canonical. Do not overwrite unrelated newer work.

## Source priority
1. Latest GitHub `main` at the moment work starts.
2. This document for current product intent.
3. Existing `docs/GAME_SPEC.md` for previously completed game rules/security.

## Navigation rules
- INSIGHT child screens/tabs -> INSIGHT top -> root TOP -> exit confirmation.
- Directory detail/features -> directory top -> root TOP -> exit confirmation.
- Active game -> game mode list -> root TOP -> exit confirmation.
- Root TOP exit confirmation must attempt to close the app/window. Browser/PWA restrictions may require a safe fallback, but do not freeze the app.
- OWNER/admin entry remains separated from participant TOP and protected by OWNER authentication.

## Game data/security rules
- Ranked player art must be an approved user-uploaded directory card, max 3.
- Never replace a missing participant card with a profile avatar.
- Participant card art stays a still image; do not require generated video for participant cards.
- Trial/showcase uses official 無名S note / ちびS still artwork.
- Ranked exact opponent history stays private; public ranking/stats only expose safe aggregate information.
- Keep existing four games playable and do not regress their result/EXP/ranking/history recording.

## Quality target: premium modern smartphone game
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

## Game roster
Keep and upgrade:
1. COMMAND — tactical elemental duel.
2. TAP RUSH — reflex/rhythm target game.
3. ARCANE PUZZLE — 6x6 match-3. Rules must be explicit: swap adjacent runes, make 3+, chains build skill, diamond rune builds shield, rival attacks on countdown, 100% launches Arcane Nova.
4. STAR SHOOTER — lock-on target shooter.

Add:
5. CREATOR QUEST — lightweight action RPG battle. Character still art remains visible while enemies/effects/background animate. Player chooses ATTACK / GUARD / SKILL, builds SP, uses animated skill cut-ins, defeats multiple waves and a boss.
6. STAR CIRCUIT — arcade race. Character card is the driver portrait; vehicle/track/UI animate. Player changes lanes and uses BOOST, avoids hazards, collects energy, races a rival and finishes by distance/position.

## Openings
Each game gets its own opening movie-style sequence using still art:
- illustration background;
- 無名S note as showcase character;
- opponent/ちびS when applicable;
- pan/zoom/parallax/light/particles;
- clear game title and mode identity;
- then transition directly into playable gameplay.

## Persistence discipline
Before large implementation changes, create a GitHub save point. Commit in small recoverable stages:
1. specification/handoff;
2. new gameplay files/types;
3. arena wiring and visual layer;
4. backend ledger support if needed;
5. tests/build/cache/deploy.
If Work usage limits appear, stop only after pushing the current compilable state and updating this handoff with remaining work.

## Current request
Raise game quality beyond the current build using abundant illustrated backgrounds, character art and animation, while keeping the games truly playable. Add RPG and race modes. Work project should use this repository as durable storage so a Work limit cannot erase progress.
