# 機能更新の完全切り分けルール

今後は **1回の更新で本体機能を1種類だけ変更する**。

## 絶対ルール
- 「ついで修正」をしない。
- 1コミット / 1更新で複数機能の本体を変更しない。
- 対象機能に付随する tests / docs / release metadata は同時変更可。
- `public/note-insight-notification-v3.user.js` は読み込み・version glueとしてのみ同伴可。
- 共有coreを触る必要がある場合、その更新は共有core更新として単独で行う。
- 別機能も必要になった場合、次のコミットへ分離する。

## 主な境界
- `notification-installer` — ブラウザ別インストール導線
- `notification-filter-settings` — フィルター設定専用ページ
- `notification-reader` — 通知読込
- `notification-checkpoint` — 完了ライン・保存境界
- `notification-shell` — 5パネル・通知面・共有runtime
- `notification-insight-ui` — INSIGHT通知画面
- `notification-backend` — 本人通知バックエンド
- `dashboard`
- `auth-access`
- `directory-catalog`
- `favorites`
- `games`
- `comments`
- `social`
- `analysis`
- `membership`

## インストール導線の正本
- `public/notification-browser-install.html`
- `public/tool-setup.html` は互換redirectのみ。
- 本人通知V3更新では `notification-browser-install.html` を変更しない。

## CI
`scripts/check-feature-boundaries.mjs` が直前コミットの差分を検査する。

複数の機能本体グループが同じ更新に混ざった場合、GitHub Actionsを失敗させ、PagesへDeployしない。

未分類の `public/`, `src/`, `supabase/functions/` ファイルは1ファイル単位で独立機能として厳格に扱う。
