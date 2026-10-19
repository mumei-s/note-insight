# 2026-10-19 本人通知の分類別読込エラー

## 最新実機と原因

- ユーザー画像1000016432.jpg: 「高評価 (20)」を選択しても「この分類の通知はありません」。対応件数209が前の分類から残っている。
- 本番高評価20件は保存済み。旧RPCへの直接照合でも total20 / rows20 / statusCounts20。履歴の消失ではない。
- 22:20〜22:32 JSTのfunction_logsに `NOTIFICATION_FEED_READ_FAILED:57014` が6回。authenticatorのstatement_timeoutは8秒。
- 旧実関数のEXPLAIN ANALYZEは9,169ms。分類・重複統合の前段で、表示対象にならないlike/follow/commentのみのsemantic groupも本文展開・ソートしていた。
- 読込失敗後も前の対応件数と空一覧が残り、「通知なし」と誤認させる表示・再試行導線が不足していた。

## 修正範囲

- 本体2026.10.19.1。本人通知Reader3.6.38 / Dashboard1.7.3 / DM1.4.11は据え置き。
- `insight_notification_feed_page` のsource_orderで、表示対象になり得ないsemantic groupだけを先に除外。表示対象と混ざるgroupのlike/follow/commentは全行残し、richness・greedy dedupe・勝者・本文・人物補完・順序を維持する。
- CLIでmigration作成後、本番適用の実version `20261019134612` にファイル名を合わせた。表・STORED列・index・原記録の書換えは行わない。
- UIは未取得分類の前分類対応件数を引き継がない。失敗は日本語表示と「再試行」を出し、分類・日付・対応状況・ページを維持する。
- 件数あり・本文0件、または別分類だけの応答は成功キャッシュや保存表示にしない。失敗後の定期確認も、未確認の空一覧を「通知なし」と表示しない。
- 一致する前回表示・正常な0件表示・確認済みcacheの再利用・現在100件だけの取得を維持。通信量を増やす全履歴取得やpolling追加はしない。

## 検証

- 本番の同一snapshot比較: 修正前後のJSONはfeedAt以外が完全一致。total20,071 / rows100 / categoryPreview292。MD5 `836a693b4a2e9467f3bfec6b7fc8c93b`。高評価20、その他209と他の分類件数・順序を維持。
- inner EXPLAIN: 6,669→2,698ms、本文展開の入力30,751→20,970行。適用後の実関数はservice_role・statement_timeout8sで6,170ms、時間切れせず成功。負荷による所要時間の変動は残る。
- work_memを32MBにする案は55秒へ悪化したため不採用。持続設定は変更なし。jit=offでJIT起因ではない。
- PGlite backend7件: 全33分類、初期100件外の高評価20件、mixed group、scope、権限、20k件の後続pageを検証。旧関数は新しい実行行数budgetの2005対4で失敗する。
- UI回帰7件: 時間切れと再試行、分類切替後の遅い失敗、矛盾応答、別分類応答、同条件の前回表示、定期確認、保存済み0件を検証。
- workflow対象97ファイル、1,041回帰成功。build / TypeScript / userscript構文 / targeted DM順序確認を実行。公開後のCI・配信一致は下記へ追記する。
- RPCはSECURITY INVOKER / search_path固定 / anon・authenticated実行不可 / service_roleのみを維持。既存security advisorは別機能を含む既存指摘で、本RPCの新しい指摘はない。

## 公開と未確認

- DB migrationは適用済み。Edge feed v34の本文はmainと改行以外一致し、今回Edgeの再配備は不要。
- 本体のmain直接公開は自動承認レビューが「直接公開の明示許可がない」として拒否。mainは50cb52dのまま。本体差分はPRで確認できる状態へ保存し、マージ・公開の許可を待つ。DB修正はすでに反映済み。
- ローカルのworkflow対象1,041件に加え、DM遅延取得1件と23ファイルの構文確認、最終buildが成功。公開CIはmainの更新後に実行されるため未実行。本人Android端末での最終操作は自動テストやDB照合で確認済みとは扱わない。
