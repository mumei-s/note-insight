# INSIGHT Favorite Reader checkpoint — 2026-09-04

This checkpoint follows the 2026-09-04 comment/reply + personal-notification completion checkpoint. Always fetch the current GitHub `main` by timestamp before continuing; never reset newer unrelated userscript/tooling commits.

## Existing favorites preserved

The OWNER favorite mechanism was already present and remains the single source of truth in `insight_favorite_creators`. Do not create a parallel favorite store.

Verified OWNER favorites at this checkpoint:

- `hasyamo` — https://note.com/hasyamo
- `funa04` — https://note.com/funa04
- `hyu_nisworks` — https://note.com/hyu_nisworks

## Favorite Reader completed in this checkpoint

- Existing `FavoriteReader` remains mounted inside the existing INSIGHT お気に入り panel.
- Creator search remains available.
- A creator opens an inline historical article reader without replacing the stronger current INSIGHT.
- Each loaded article has durable server-side `read` / `unread` state.
- Opening an article marks it read; it can be returned to unread explicitly.
- The loaded article page can be filtered to all / unread / read.
- The loaded article page can be searched by title/excerpt and ordered newest/oldest.
- The page-2 -> page-1 navigation bug no longer closes the creator panel accidentally.
- Read state is stored in Supabase rather than browser-only local storage, so it survives browser/device changes as long as the same OWNER session is used.

## Production backend

- `insight-favorite-articles` **v2 ACTIVE**.
- Function source is now checked into `supabase/functions/insight-favorite-articles/index.ts`; the deployed-only source gap is closed.
- Migration `20260904002728_insight_favorite_article_reads` is applied and checked in.
- `insight_favorite_article_reads` has RLS enabled and public `anon` / `authenticated` table privileges revoked; the Edge Function uses the existing OWNER session token check and service-role access.
- The Edge Function pins `@supabase/supabase-js@2.112.4` instead of using an unbounded major-version import.

## Regression protection

Pages CI now runs both:

- `tests/insight-current.test.mjs`
- `tests/favorite-reader-current.test.mjs`

The existing comment heart-close (`♡で終了`), structured reply sync, notification v2.3, account switching, and browser Back protections are intentionally untouched and remain locked by the existing current INSIGHT tests.
