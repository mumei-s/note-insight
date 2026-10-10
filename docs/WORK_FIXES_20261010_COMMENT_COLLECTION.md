# INSIGHT コメント取得の修復 — 2026-10-10

開始main: `83d1459dd603dc9c27045cc20cddeada8598d125`。利用者の「INSIGHT本体のコメント取得がされていない。他にも確認せよ」を正とし、過去の表示freshness検査だけを取得成功の根拠にしない。

## 本番原因と復旧

- 直近24時間のcomment batch HTTP409は186回。SQLSTATE23503、通知のmember_id外部キー違反。
- ご本人の正本profileは`owner`。cronが同じ本人のapplication UUIDを通知先に選び、存在しないFK先へ通知を入れたため、同一transaction内のコメントupsertまで巻き戻された。
- 最初の実測は4,440件、最新コメント10月1日、最後の新規保存10月2日。正本scopeを通知先にも使う修正後、4,464件へ増え、10月8日のコメント保存を確認。不足は15記事/104件から13記事/80件へ減った。
- 修正後の本番batch148呼出ではHTTP409ゼロ。
- 不足上位6記事は記事APIが200でもコメントAPIが403。取得拒否を成功扱いせず、部分取得を表示する。こうした記事が修復6枠を占有し続けないよう、最大100件の不足候補から少量ずつ巡回する。

## コメント画面と保存処理

- 画面は保存先履歴を表示しながら、本人tokenで限定したnote取得を開始。手動の「noteからコメントを取得」も追加。日付・記事・対応状況の選択を保つ。
- 取得後は同じフィルターの保存先を全ページ再読取。同じ件数でも51件目以降の本文・返信・♡変更を古いsnapshotで覆わない。
- 保存先読取とnote取得を別表示にし、停止・時間切れ・一部失敗を最新/完了と偽装しない。
- 不正JSON・不完全なページ応答で保存済み履歴を空や欠損へ上書きしない。離脱・本人切替の遅い応答も破棄する。
- member refreshはsession/active/verifiedを検証し、bodyの任意member/note指定を採用しない。既存maintenanceを尊重。scope共通の原子的60秒cooldownで重複収集を抑える。cron secretとmember認証は別。

## 他機能の確認と修正

- 公開同期: スキ403が後続コメント・フォロワー取得を止める問題を再現し、ソースごとに独立して継続。保存errorを確認し、成功件数と対象数を区別。既存コメントの変更だけ更新し、新規だけ通知する。部分失敗なら初回完了印/カーソルを進めない。
- DM: 会話一覧を訪問せず直接開いたroomで本文だけ保存し、相手一覧から辿れない経路を再現。保存確認前に同じ本人のroomを登録。名前未取得はDBのnullを保ち、表示だけ「DM会話」。既存owner履歴保護も保持。既存本番の孤立messageは0件で補修不要。
- DMのplain object errorを`[object Object]`として捨てず、秘密・本文・detailを含めない安全なstorage codeを返す。過去のDM500の原因は現logだけでは未確定であり、この修正で過去の500まで直したとは断定しない。
- 分析/スキRPC500はSQLSTATE57014のstatement timeout。重複する表走査/相関集計を短縮する4RPC SQLを別migrationで配備。120通りの旧結果との一致と権限保持を検査。本番データの候補分析SQLは約1,059→148ms、スキ一覧候補119msを測定。summaryは時間変動が大きく速度改善率を断定しない。権限やtimeout上限は緩めない。

## 検証・配信

- コメント画面22件、コメントbackend/本番transaction SQL再現8件、公開sync10件、DMの直接room取得7件の新旧検証を含む回帰が成功。TypeScript/build/userscript syntax成功。
- 現行Pages workflowの明示pattern外の旧Dashboard自動取得fixture3件は、現在の手動読込仕様と不一致。今回の修正とは分離し、現行手動パネル/保存queue検査で確認する。
- Supabase: comment-refresh v10、member-api v16、dm-ingest v5、dm-feed v5。必要な相対依存も含めて配備し、取得した本番sourceとの一致と未認証401を確認。DB migrationは`20261010121607_insight_comment_refresh_claim` / `20261010122927_insight_rpc_read_performance`。
- 本体2026.10.10.1。本人通知3.6.38/Dashboard1.7.3/DM Reader1.4.10はそのまま。Web本体/サーバー修正であり、端末userscriptまで更新したと説明しない。
- Pages公開manifest/bundleと最終Actionsは公開工程で確認する。認証済みAndroidの利用者操作までは代替検証を実機成功と呼ばない。
