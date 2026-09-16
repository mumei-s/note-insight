# INSIGHT 本人通知・起動時自動同期 実装プロンプト

## 目的
本人通知の4列パネルを必須にせず、ユーザーがINSIGHTを起動した時点で、noteの🔔通知を自動で開き、通知を読み込み、Supabaseへ保存し、INSIGHTの【通知】へ自動復帰・反映させる。

## 最重要の既知不具合
1. `notification-entry.html` は本人通知Userscriptの `@match` 対象外なので、そこでGM共有領域へ同期要求を保存しようとしてもTampermonkeyコードは動かない。
2. `dashboard-setup.html` は `@match` 対象だが、現状はページ自身が即時に `tool-setup.html` へ `location.replace()` している。Userscriptは `@run-at document-idle` のため、同期シードを処理する前にページが消える。
3. INSIGHTトップの起動ガードが60秒だと、同期失敗直後の再試行が無反応に見える。

## 正しい構成
1. INSIGHT起動
2. `notification-entry.html` へ移動
3. `notification-entry.html` は `dashboard-setup.html?mumei_insight_sync_seed=1...` へ移動
4. `dashboard-setup.html` は `mumei_insight_sync_seed=1` の時だけ通常の即時リダイレクトを禁止し、その場に待機する
5. 既存V3 Userscriptが `dashboard-setup.html` で起動し、遠隔 `note-insight-notification-loader-v318.js` を読む
6. loaderの `seedNotificationSync()` がGM共有領域 `mumei_insight_pending_sync_v1` に `{back,id,expected,at}` を保存
7. note.comへ移動
8. note側loaderがGM共有領域から同期要求を復元
9. noteアカウント一致確認
10. 上部🔔を自動クリック
11. 通知シートをDOMから認識
12. Readerで通知を読み込み、既存保存済みと重複除外しつつ新規分をingest
13. 画面上に常時 `🔔 INSIGHT 自動同期` と `読込○件｜保存○件` を表示
14. 完了後 `notificationSync=done` を付けてINSIGHTへ戻る
15. INSIGHT【通知】を表示

## 絶対条件
- `/notifications` 直URLに依存しない。
- creator profileへフォールバックしない。
- パネル表示の成否を同期の必須条件にしない。
- 同期要求はURLだけで保持しない。GM共有領域に保存する。
- `dashboard-setup.html` の通常導入動線は壊さない。同期シード時だけ留める。
- 本人通知未導入ユーザーは従来INSIGHTをそのまま開ける。
- 既存のBOOST、ポン出し、ゲーム、他機能は触らない。
- 同期中は必ず視覚表示を出す。何も出ない状態を成功扱いしない。
- エラー時もINSIGHTへ戻し、次回再試行可能にする。
- 再試行ガードは失敗時に長時間ブロックしない。

## 実装対象
- `public/dashboard-setup.html`
- `public/notification-entry.html`（必要最小限）
- `public/note-insight-notification-loader-v318.js`
- `index.html`
- `tests/notification-v2968.test.mjs`

## 完了条件
- `dashboard-setup.html?mumei_insight_sync_seed=1...` が即時 `tool-setup.html` へ飛ばない。
- loaderの `seedNotificationSync()` がそのページで確実に実行できる。
- noteへ移動後、同期要求がGMから復元される。
- note上で進捗表示が出る。
- Readerのdone/errorでINSIGHTへ戻る。
- 構文チェック、build、回帰テスト、GitHub Pages deployが全成功する。
