# WORK LATEST CHAT HANDOFF — 2026-09-10

Latest requirement source: current ChatGPT conversation continuing 「実機確認修正Deploy」. Always fetch current GitHub `main` before editing; preserve unrelated newer work and `docs/WORK_CURRENT_SOURCE.md` invariants. The latest Android screenshots in this conversation are authoritative for acceptance.

## Production checkpoint

- INSIGHT: `2026.09.10.2`
- 本人通知: `2.9.59`
- Dashboard bridge: `1.4.2`
- Latest code checkpoint before this documentation-only commit: `3b2d44cc97983f32e2b6e351215331f5a31f98f9`
- GitHub Pages run: `34478627061` / run 1726
- Build: success
- Userscript syntax: success
- Unified regressions: success
- Pages deploy: success
- Supabase `insight-notification-feed-final`: v16 ACTIVE, `verify_jwt=false` with custom `X-Insight-Token` auth.

## Latest implementation from Android screenshot findings

- TOP launcher is no longer four equal visible cards. `通常データ` is hidden from the top launcher and exposed as a compact `通常データ更新` control beside `アカウント切替` in `.miu-topactions`.
- Remaining top controls are `本人通知 / ダッシュボード / 詳細分析` in one three-column row on mobile. Their separate under-card install links are hidden so they cannot create an uneven second grid row.
- Blank-space handling is structural plus measured: `insight-mobile-v14.ts` reads the real `.miv5-source-grid` bounding height and constrains `.miv5-update` to that measured height with `ResizeObserver` follow-up. Pseudo-elements and legacy reserved block sizes are neutralized.
- Legacy `insight-ux-v13.ts` now detects the v14 style, marks the launcher `data-mumei-v14=1`, and disables all v13 top-layout rules/inline height reset for the v14 launcher. This fixes the specificity race that could silently restore the old 2-column layout after v14 ran.
- Per-item participant updates stay actionable in compact mode. Existing `本人通知` / `Dashboard` update states remain on their cards. Future INSIGHT app update state is surfaced on the `通常データ更新` proxy as `NEW INSIGHT本体更新` and routes to the hidden native app-update action, so moving the normal-data card does not lose update delivery.
- 通常データ manual refresh remains bounded/abortable in React. The visible proxy never locks the account-control row and mirrors the hidden native refresh state while saved data remains usable.
- 本人通知 comment-body display is repaired in two layers: notification feed dedupe preserves canonical `meta.body` and exports `comment_body`; mobile delegated disclosure reads saved feed body first, then queries `insight-comment-events` for the surrounding day and matches actor/article/time. This avoids the old v11/v12 class-mutation listener race.
- Production comment audit for 2026-09-08 through 2026-09-10 found 58 canonical comment rows and all 58 contain non-empty bodies. The screenshot row for `【フォロバ100】凪` at 2026-09-08 22:08 JST has a matching canonical body in production.
- Notification categories remain in the compact one-panel selector. Long-press (520 ms) now enables category reordering; order is stored locally in `mumei-notification-category-order-v14`.
- 本人通知なし詳細分析 was rebuilt as collapsed `<details>` sections. All analysis groups are buttons/accordions by default, with open-all/close-all controls, compact two-column mobile arrangement, explicit metric labels (`平均スキ数`, `平均コメント数`, `平均反応数`), and explicit `反応=スキ+コメント` / `PVではありません` wording.
- Graphs were added to every detailed-analysis group: overview bars, recent reaction sparkline, cadence bars, weekday bars, time-slot bars, title-word bars, evergreen bars, and article top-reaction bars.
- Article list uses a smartphone-fit CSS grid instead of a wide table; title text ellipsizes to protect viewport width.
- Detail-analysis refresh has an independent 20-second watchdog and restores the retry button/status while retaining saved analysis.

## Earlier notification/backend repairs retained

- Stable classification-independent notification identity.
- Exact `circle_plan_join`, `board_like_comment/post`, `board_reply_comment/post`, membership and article-update classification.
- Resume capture normalization and feed-compatible provenance.
- Existing 603 resume rows normalized, 7 duplicate client-signature rows removed, known article-update rows backfilled.
- `other` audit had no remaining known membership/comment/magazine-form rows after repair.

## Acceptance remaining

Code, build, regression tests, Supabase deployment and GitHub Pages deployment are complete. The only remaining acceptance check is visual/interactive confirmation on the user's actual Android browser after reloading the current production build: (1) no blank space below the three top cards, (2) `通常データ更新` appears beside `アカウント切替` and returns from busy state, (3) opening `コメント本文` displays the canonical body, (4) detailed analysis starts collapsed and fits the smartphone width, and (5) long-press category reordering persists.
