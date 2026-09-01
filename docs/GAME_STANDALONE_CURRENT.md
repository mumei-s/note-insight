# CREATOR WORLD — standalone completion checkpoint

Updated: 2026-09-02 JST

This checkpoint is created from current GitHub `main` (`acdd13d590bba06aafd19d92b2423465ff691cf5`) before resuming the game work after Work usage limits.

## Scope
- Keep the production-facing INSIGHT app unchanged and INSIGHT-only.
- Keep creator directory/catalog detached from the primary app.
- Finish the preserved six-game CREATOR WORLD as a separate standalone GitHub Pages entry.
- Do not restore `#battle` into the primary INSIGHT router.

## Existing preserved game state
Six playable modes already exist:
1. COMMAND
2. TAP RUSH
3. ARCANE PUZZLE
4. STAR SHOOTER
5. CREATOR QUEST
6. STAR CIRCUIT

`creator-battle-ledger` and the database constraint already support all six game modes. Existing card/auth/privacy rules remain unchanged.

## Completion work for this checkpoint
1. Add a dedicated standalone `game.html` entry so the detached game can be played without altering the primary INSIGHT app.
2. Make TRIAL use real official still artwork for `無名S note` and `ちびS` instead of empty art values.
3. Ensure all six modes keep the shared cinematic opening, parallax illustration background, particles, light sweeps, cut-ins, impact motion and two-character result presentation.
4. Keep ranked mode restricted to approved uploaded creator cards; never use profile avatars as substitutes.
5. Run production TypeScript/build and static tests through the repository workflow, then confirm GitHub Pages deploy.
6. Update this file with final commit/deployment status before stopping.

## Persistence rule
Do not overwrite newer unrelated INSIGHT/userscript work. Fetch latest `main` before each write cluster. If another writer advances `main`, rebase the intended game-only diff onto the new head instead of reverting it.
