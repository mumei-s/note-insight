# PRIMARY APP SCOPE

Updated: 2026-08-31 JST

## Primary deployed app
The primary `note-insight` GitHub Pages app is now intentionally limited to:

1. **INSIGHT** — analytics, evidence, article reactions, participant authentication and OWNER management.
2. **クリエイター名鑑** — public directory, creator detail pages, participant registration and OWNER approval management.

## Game separation
- CREATOR WORLD / the six games are **detached from the primary app UI and runtime**.
- Do not expose `battle` or `game-admin` from TOP, bottom navigation, routing, or OWNER control in the primary app.
- Existing game source files, CSS, tests, Supabase ledger support, migrations, records, and `docs/GAME_SPEC.md` remain preserved in the repository.
- Do not delete, roll back, or rewrite the saved game implementation merely to keep it detached.
- Do not reconnect games to the primary app unless the user explicitly asks to do so.
- If games return later, prefer a separate app/entry point so INSIGHT and the directory remain lightweight and independently maintainable.

## Navigation
- Root TOP contains exactly two participant entrances: INSIGHT and クリエイター名鑑.
- Bottom navigation contains TOP / INSIGHT / 名鑑 only.
- Root exit confirmation refers only to INSIGHT and 名鑑.
- OWNER remains separated from participant TOP and keeps INSIGHT management and 名鑑 management only.

## Preservation rule
Always start from the latest GitHub `main`. Do not overwrite newer unrelated work such as note userscripts or notification tooling when changing the primary app.
