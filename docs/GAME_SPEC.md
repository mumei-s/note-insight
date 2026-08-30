# CREATOR WORLD — game completion specification

Baseline: `fb2fc687afc18291bcc1dd1fd7472bcdeb624d70`.

This change is game-only. It must not alter INSIGHT, the catalog, notifications,
magazines, evidence storage, participant access, or their Supabase functions.
Google Drive/Docs/Sheets sharing is not part of the game flow. Source is stored
and deployed through GitHub Pages; game identity continues to use the existing
INSIGHT member session and approved catalog submission.

## Access and cards

- The public arena shows a safe spectator preview without returning creator game
  data. The preview uses no profile icon or participant record.
- A playable ranked match requires an active INSIGHT session, an approved catalog
  submission, battle opt-in, and at least one user-uploaded catalog card.
- The player selects one of their registered cards (maximum three) for every match.
- A creator rival can expose and use up to three registered cards; the player picks
  the rival card before starting. Official rivals use their official card.
- Card attributes are deterministic from the selected card identity and are used by
  every mode. A profile image is never substituted for a missing card.

## Six separate games

1. **COMMAND / tactical duel** — seven-round elemental mind game with telegraphed
   rival intent, attack, guard/counter, an ultimate, shields, critical hits, and
   deterministic card attributes.
2. **TAP RUSH / reaction** — moving, shrinking beat targets graded PERFECT/GREAT/GOOD,
   combo and fever multipliers, misses, a countdown, and boss HP.
3. **ARCANE PUZZLE / match-3** — a real 6×6 board with tap or swipe exchange,
   cascades, rival countdown attacks, shield rune, skill gauge, and Arcane Nova.
4. **STAR SHOOTER / aim** — time-limited moving targets with lifetimes, accuracy,
   combo, critical targets, player shield damage, lock-on aim, and Nova Burst.
5. **CREATOR QUEST / action RPG** — three consecutive enemy waves, visible player
   and rival card art, attack, guard, SP, animated skill cut-ins, and a final boss.
6. **STAR CIRCUIT / arcade race** — three-lane steering by buttons or swipe,
   hazards, energy pickups, machine integrity, boost, a live rival position, and a
   1,000-metre finish.

Each game supports pause/resume, page-background pause, touch-sized controls,
reduced-motion mode, haptic feedback where available, a clear result, score, EXP,
and retry. Result saving starts only after a completed playable match.

## Cinematic presentation

- Every mode uses a full-screen movie opening with the selected registered cards,
  title reveal, VS transition, light, particles, pan, zoom, and parallax.
- Gameplay keeps participant artwork as still image elements. Motion is created by
  camera transforms, layered parallax, UI animation, particles, flashes, cut-ins,
  impact shake, and skill/fever/nova/boost effects.
- Results keep both selected card images visible and never substitute a profile
  avatar for missing art. Trial uses only the official 無名S note / ちびS artwork.

## Records and privacy

- Public: total wins, losses, win rate, per-game record, and overall ranking.
- Private: opponent, game, result, date/time, player card, opponent card, and score.
- Pairwise detailed records are never included in the public ranking.
- Battle writes continue through `creator-battle-ledger`; duplicate match keys are
  handled by its existing unique constraint.

## Release gates

- TypeScript check, production build, and static tests pass.
- Only game source, game styles, game tests, the game ledger mode allowlist, and
  this specification may differ from the baseline.
- Mobile-width and desktop public arena are visually checked after GitHub Pages
  deployment; playable/authenticated behavior is also validated at the function
  boundary without exposing private credentials.
