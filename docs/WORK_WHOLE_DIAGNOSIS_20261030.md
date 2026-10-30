# INSIGHT 全体不具合診断 2026-10-30

対象: `mumei-s/note-insight`、開始時 main `d042f6c47d87c0dcbb07e5ba35e684cd71d91444`。
修正版: INSIGHT `2026.10.30.4` / 本人通知 `3.6.62` / DM `1.4.20` / Dashboard `1.7.7`。

## 再現・修正した問題

| 領域 | 再現した問題 | 修正・確認 |
| --- | --- | --- |
| 本人通知一覧 | 再分類の通信中にAからBへ切り替えると、遅いAの応答がBの同じ通知IDへ混ざる | token・表示scope・要求世代で採用を制限。切替と離脱で中断。旧finallyがBの状態を解除しない |
| 通知の取得・保存 | 通知取得中にnoteの本人が変わると、未確認の応答がAの保存待ちへ入り、Aへ戻った際に送信される | 各ページの取得結果を取り込む前に本人照合。相違時は新応答を捨て、既に照合済みのbufferとcursorを維持 |
| 前回保存線 | 新旧の通知本文が同じ場合、より強い通知IDを確認する前に新しい行へ一致する | 一覧全体で通知IDを優先。異なる明示IDと曖昧な同文は境界としない。旧IDなしDOMの一意な一致は維持 |
| 前回保存線 | 最初の本人IDを保持し続け、別本人へ戻っても前の境界を使う | 復帰時に本人を再確認し、古い非同期応答を世代で破棄。裏画面では確認しない |
| 前回保存線の負荷 | 300行の候補判定で兄弟行を相互比較し、約9万回の包含判定が発生する | 祖先を調べる方式へ変更。300行で比較数を抑える挙動テストを追加 |
| 自分コメント履歴 | 通信中、または閉じた間のrevision変更を消費して一覧が更新されない | 通信完了後に最新revisionを一度確認。閉じた間の変更は次回開く時に確認。定期通信は増やさない |
| お気に入り | 既読保存後に、先に始めた未読の応答で表示が戻る | 既読操作時に先行する記事取得を失効させる |
| お気に入り記事 | 1ページ固定で、61件目以降へ進めない | hasNextに従う明示ページ送り。押したページだけ取得し、確認済み現在ページを保持。検索範囲は「このページ」と明示 |
| DM Reader | hidden中のDOM変化が取得を再開し、pageshowで明示停止も解除される | hiddenで新規取得を防止。復帰信号を集約し、明示停止は明示再開まで維持 |
| DM Network | 本文fetch/JSONが中断に応じないと処理を占有し続ける。停止直後の空応答で完了位置が進む | 本文まで20秒のdeadline。停止後の応答で完了境界を進めない |
| Dashboard保存待ち | 本人確認fetch/JSONやGM callbackが応じないと保存queueが止まる | 本人確認10秒、保存・確認45秒の独立deadline。遅い成功を無視し、未確認段階を保持。Promise-only応答にも対応 |
| 内部更新の権限 | 内部cronの2関数がPUBLIC・anon・authenticatedから実行可能 | 対象2関数だけ権限を制限。postgres・service_roleの既存権限と定期実行ユーザーは保持 |

通知payloadの読込予算は維持（初回300件25ページ、新着5件2ページ、新着なし1ページ）。本人照合は結果の所属確認に必要な分だけ追加し、初回31→56回、差分3→5回、新着なし1→2回。DOM巡回・通知再送の予算は緩和していない。

## 検証

- 起動・認証・容量不足・保存領域・service worker: 18ファイル172件成功。
- 通知の最終領域検証: 14ファイル181件、追加の保存線挙動2件成功。
- 分析・コメント起動57件、自分コメント一覧21件、関連49件成功。重いfixtureの一括実行で終了したケースは分割して実動作を再確認。
- 社会関係・スキ・お気に入りの初回121件、社会関係の追加43件、お気に入り最終29件成功（重複を含むため合算しない）。
- 最終の更新・導入・Userscripts互換性・復帰・版整合性: 294件成功。
- 今回の修正の最終回帰バッチ: 111件成功。全件再実行でDM途中停止の確認済みcursorを失う回帰を検出し、公開前に補正。停止前に保存確認済みのcursorを保持し、停止中に後着した未処理応答は完了にしないことを両方確認。
- TypeScript、Vite build、変更JSの構文、`git diff --check` 成功。
- 公開画面のTOP→INSIGHT入口→TOPを確認。認証なしで本人履歴へ進まない。ブラウザにある管理用拡張のログをアプリのエラーへ混同していない。

カモミール (`chamomile_technical_gift_v9_frozen.zip`) はZIP/TARの検査ツールで、「検査してから処理する」という設計参考になる。今回は圧縮検査コードをINSIGHTへ入れず、実コード・失敗を再現するテスト・公開配信の確認で診断した。

## DBで適用・確認した内容

プロジェクト `xxhaerjvrgmnadxjqetz` は診断時 `ACTIVE_HEALTHY`。
接続済み機能でmetadata・advisor・集約ログのみを確認し、利用者の本人情報・トークン・本文を取得していない。通常のPostgresエラー集約は取得範囲で0件。一覧ログ取得1回はサーバーエラーで失敗したため、ログが全て正常とは断言しない。

適用済みmigration: `20261030111155 insight_internal_refresh_cron_privileges`。

```sql
REVOKE EXECUTE ON FUNCTION public.run_insight_avatar_refresh_cron()
FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_insight_comment_refresh_cron()
FROM PUBLIC, anon, authenticated;
```

適用前に、関数所有者・定期実行ユーザーがpostgres、他関数およびapp/Edge/workflowからの参照がないことを確認。適用時も対象2関数が引数なし・postgres所有・SECURITY DEFINERであることをガードした。
適用後は両関数とも `anon=false / authenticated=false / postgres=true / service_role=true` を確認。advisorから対象2関数の警告が消えた。
権限制限後の通常cronも、commentは11:22 UTC、avatarは11:25 UTCに成功し、両ジョブとも有効なままであることを確認した。

公式の権限説明: https://supabase.com/docs/guides/database/functions

## 残る検証上の制限・診断事項

- 全OS・全ブラウザの実機、note本人ログインでの端から端までの操作は未実施。Safari UserscriptsはAPIの実際の渡し方に合わせた実コード検証を行った。
- リポジトリ全件には以前から失敗している旧検査があり、全件合格とは扱わない。検査開始時の一括実行は3103件中2959成功・114失敗・30skip。このうち91の失敗名は修正前baselineにも存在。実行中の版更新による不一致等は、凍結後の294件・111件で再検証した。
- 凍結後の全件再実行は3110ケースを記録した地点で最終集計を出さず終了した。失敗名は既存90件と、上記の公開前に修正したDM途中停止1件。末尾の未記録を補うため、unified-view-retention / userscripts-manager-compat / view-retention-lifecycle の3ファイルを別実行し60件成功。全件が一度の実行で合格したとは報告しない。
- 旧baselineの91件は、旧版番号・ソース形の固定検査56件、fixture不足20件、旧Dashboard自動読込前提3件、前回UTC明示で修正済みの日時境界1件、別カードツールの原因未確定の行動検査11件に分類した。失敗名が古いことだけを理由に、全て無害とは扱わない。別カードツールは独立対象として残す。
- DB advisorには設計確認が必要な既存RPC権限警告48関数（anon/authenticatedそれぞれ）、search_path警告1件、重複索引3組などが残る。token照合を内蔵する正規APIも含まれるため、一括権限剥奪や索引削除はしていない。RLS有効・policyなしの情報通知は、service経由だけで利用する設計と照合が必要。
- DBの追加費用・新規テーブル・利用履歴の削除・全履歴転送は行っていない。

advisorの確認先:

- RPC権限: https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0028_anon_security_definer_function_executable
- search_path: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- 重複索引: https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index
