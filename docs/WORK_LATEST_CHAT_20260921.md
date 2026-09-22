# WORK 最新引継ぎ — 2026-09-21 08:41 JST

## 正本・作業ルール
- 必ず `mumei-s/note-insight` の**開始時点の最新 main**を取得してから作業する。
- この文書と通常チャット最新指示を最新版要件として扱う。
- 古いローカル状態・古いWork状態で main を上書きしない。
- 既存で正常な機能を壊さず、通知・DM・分析は機能境界を分離したまま修正する。
- Work制限が近づいたら、コード・仕様・未完了事項を main とこの引継ぎ文書へ保存してから停止する。
- 「直したつもり」ではなく、実機挙動・本番配信・GitHub Pages deploy・Supabase反映まで確認する。

## 現在の利用者実機で確認された問題（2026-09-21 08:41）
### 1. 本人通知：読取・保存・反映が遅い／状態表示が矛盾
実機では以下が表示されている。
- サーバー反映済み 2026/9/21 07:45
- 端末 最終読取 2026/9/21 07:00
- 今回 読取 24件
- 今回 保存確認 0件
- サーバー受信 18件
- サーバー保存確認 0件

ユーザー要望：
- 以前の方式のように、**保存・反映はほぼ即時**にする。
- 読み込みは通知一覧の**下（古い側）→上（新しい側）**に向かって進める。
- 読み込み中は件数がリアルタイムで増える方式にする。
  - 例：`読込 120 / 1,842`、`保存 118` のように進捗が見える。
- 停止ボタン、画面切替、ページ離脱、アプリを閉じた時点までを必ず保存。
- 再開時は保存済み境界から差分のみ続行。毎回全件読み直しは禁止。
- 読込パネルが「再読込」のまま固定されないこと。
- 「✓保存」「途中保存」「完了」など現在状態を明確に表示する。

### 2. 通知人物アイコンが不足
現在、一部は人物アイコンが表示されるが、最新読取分で欠落が残る。
note API `/api/v3/notices` のレスポンスには以下が存在することを確認済み：
- `action_users[].url`
- `action_users[].name`
- `action_users[].user_profile_image_path`
- `noticed_at`
- `all_area_url`
- `featured_area_url`
- `featured_content_name`

要件：
- 通知本文だけでなく、**上記の構造化情報を直接保存**する。
- `action_users[0]` を第一人物として actor_url / actor_name / actor_image_url に保存。
- 過去データも安全に紐づくものは補修する。
- アイコン取得を後段の遅い推測だけに依存しない。

### 3. 通知分類：「その他・未分類」が多すぎる
実機で明らかに人物名や通知種別が判別できる通知が大量に「その他・未分類」へ入っている。
例：人物名＋「○分前」だけのカードなど。

要件：
- APIの `kind`、`body`、`body_ast`、`all_area_url`、`featured_area_url` を優先して分類。
- 既知kindを網羅して classifier に対応させる。
- 「その他」に入った通知は、分類ルール更新後に**自動再判別**する。
- 手動「全履歴を再分類」を押さなくても、classifier version が上がったらバックグラウンド再分類。
- 再分類は全件一気にUIをブロックせずチャンク処理。
- その他に残すのは、構造化情報を見ても本当に判別不能なものだけ。

### 4. 通知カテゴリUI：横スライド禁止、1パネルへ
現在「すべて / 自分の記事追加 / コメント♡ / ...」が横スクロールタブ。
要件：
- 横スライドは廃止。
- **1つのカテゴリ選択パネル**にまとめる。
- 例：現在選択カテゴリ＋件数を1行表示し、タップで一覧を開くドロップダウン/シート方式。
- スマホ縦幅を極力消費しない。
- 日付フィルタ、更新状態、分類修復も縦幅を圧縮。

### 5. 本人通知全体の縦幅圧縮
現状、「読取・保存・反映状況」「更新状態・精度」「表示日」「分類を確認・修復」などが縦に長い。

要件：
- 常時表示は最小限：
  - 最終保存時刻
  - 読取/保存状態
  - カテゴリ選択
  - 必要な主要操作
- 詳細状態・精度説明・再分類は折りたたみ1か所に統合。
- 余白・説明文・カード高さを圧縮。
- 下部固定ナビと重ならないこと。

## 6. 通知下部操作パネル
最終希望：
- 画面下部に横4列：
  1. 読込
  2. フィルター ON/OFF
  3. 設定
  4. INSIGHT
- 通知DOMに貼り付けず独立レイヤーで固定。
- 通知を閉じたら消える。
- 読込中はリアルタイム進捗件数。
- 読込完了後は `✓保存`。
- 設定・INSIGHTは確実に各目的画面へ遷移する。

## 7. 「設定」「INSIGHT」遷移時にnoteトップが一瞬出る
現在は遷移先そのものは正しくなったが、**noteトップが一瞬挟まって見える**。

要件：
- 中間遷移を画面上に露出させない。
- 設定ページ→🔔復帰は、可能なら同一タブ内でベルを直接復元し、noteトップの描画を見せない。
- INSIGHTへ移る時も不要なnoteトップ描画を挟まない。
- Return bridge / history / overlay を使い、利用者にちらつきを見せない。
- ただし無限点滅・ベル連打・誤クリックは再発禁止。

## 8. DM：本人取得はできているが、UIと内容取得が未完成
実機：
- DM専用連携済み
- 相手 21
- 保存DM 0
- 最終同期時刻は更新される
- 相手一覧は取得できる
- 「note DMを開いて同期」を実行すると、**全クリエイターDM一覧へ飛ぶだけで各会話内容が保存されない**

要件：
- 本人通知とは完全分離したDM専用Readerを維持。
- DM一覧を開いた時に相手一覧取得。
- 各相手ごとの会話本文を取得し、相手単位で保存。
- 一覧ページに飛ぶだけで終わらない。
- 必要なら会話API/XHR/fetchを解析して、DOMを1件ずつ開く方式より通信Readerを優先。
- 途中停止時点まで保存、再開可能。
- 既読/未読、日時、相手、本文、可能ならリンク/添付情報を保存。
- INSIGHTでは相手ごとにまとめて表示。
- **DMの上部情報も1パネル化**し、更新ボタン・再設定・note DMを開く・連携済み・件数等を縦に積みすぎない。
- 説明文を圧縮。

## 9. DM画面の縦幅圧縮
現状：
- 「DM同期ツール更新」
- 「DM連携を再設定」
- 「note DMを開いて同期」
- 「DM専用連携済み」
- 相手/保存DM/最終同期
が縦に積まれている。

要件：
- 1つのコンパクトパネルへ統合。
- 状態・件数を横並び/2段程度。
- 操作は主操作1つ＋詳細メニュー程度へ。
- 説明文は1行程度。
- 一覧表示領域を上へ詰める。

## 10. ダッシュボード分析
Workで優先して実装する重作業。

要件：
- Dashboard同期データの取得表示を高速化。
- 保存済みスナップショットは即表示し、最新取得だけバックグラウンド。
- グラフの精密度・視認性・操作性を向上。
- 単純円グラフだけでなく、用途に応じて：
  - 時系列
  - 増減
  - 比率
  - 記事別
  - 流入/反応
  - 期間比較
- 期間切替、ツールチップ、ラベル、省略表示、スマホ可読性を改善。
- 0値/欠損/古いスナップショットを誤解させない表示。
- 本人通知なし分析と本人通知あり分析の境界は維持。
- 既存の正常なDashboard連携を壊さない。

## 11. 取得速度の設計方針
最優先。
- UIを待たせる処理をなくす。
- 既存保存データを先に表示。
- ネットワーク取得/再分類/アイコン補完はバックグラウンド。
- 通知Feedのキャッシュは短くするか、sync完了イベントで明示無効化。
- 2秒ポーリングだけに依存せず、保存成功イベント→INSIGHTへ即refresh。
- Reader→ingest→feed の各段で時刻・件数を持ち、どこで遅れているか可視化。
- 手動読込と自動読込が競合しない。

## 12. 画像で確認した見た目（この通常チャットの添付を仕様証拠として扱う）
### 画像A：本人通知上部
- 「読取・保存・反映状況」が大きい。
- サーバー反映済みでも今回保存0 / サーバー保存0。
- 下に日付フィルタ、横スクロールカテゴリが続き縦幅が大きい。
→ 状態カード圧縮＋カテゴリ1パネル化。

### 画像B：その他・未分類一覧
- 人物アイコン自体は取れているカードもある。
- しかし明らかに人物通知が大量に「その他・未分類」。
- raw textが「人物名＋○分前」に近いカードが並ぶ。
→ API kind/body_astを使って再分類。classifier更新時の自動再判別必須。

### 画像C：DM
- DM専用連携は成立。
- 相手21、保存DM0。
- 相手カードのアイコンは取得できている。
- 上部操作・説明・状態カードが縦に長い。
→ DM内容取得を完成させ、上部を1パネルへ圧縮。

※ 画像実体は通常チャット添付。Work側で添付自体が見えない場合でも、この文書の観測内容を正本として作業を進める。必要なら実機確認時に同じ画面を再取得する。

## 13. 現在のバージョンに関する注意
通常チャット側で V3.4.4 / INSIGHT 2026.09.21.14 までコード更新を試行したが、
**ユーザー実機では「最新でもない」「即時反映しない」「再読込のまま」**と確認されている。
したがって、バージョン番号だけを根拠に「修正済み」と判断しない。
必ず以下を確認：
1. GitHub Pages deploy が最新 main を配信しているか
2. userscript @require のcache bustが最新か
3. service worker / browser cacheが旧bundleを返していないか
4. Supabase edge functionがGitHub sourceと同一か
5. 実機の表示バージョン・bundle hash・userscript version
6. note側Readerが実際に新コードを動かしているか

## 14. Workでの優先順位
1. **実配信バージョン不一致の解消**
2. **通知Readerを下→上・進捗件数・途中保存・即時反映へ**
3. **action_users等を使った人物/アイコン/日時/URL保存**
4. **分類器と自動再分類の全面修正**
5. **通知UIの1パネル化・縦幅圧縮**
6. **DM会話本文の実取得と相手別保存**
7. **DM上部1パネル化・縦幅圧縮**
8. **Dashboard分析高速化・グラフ品質向上**
9. 全機能回帰テスト＋本番実機確認

## 15. 完了判定
以下すべてを満たすまで「完成」としない。
- 🔔を開いた直後から読込進捗件数が変化する。
- 下→上に読み、停止/離脱地点まで保存される。
- 次回は差分から再開。
- 保存成功後1〜2秒以内を目安にINSIGHTへ反映。
- 読込ボタンが「再読込」のまま固まらない。
- 最新通知で人物アイコンが取得できる。
- 「その他・未分類」が既知通知種別で大量発生しない。
- classifier更新後、自動再分類される。
- 設定/INSIGHT遷移でnoteトップのちらつきが見えない。
- 通知カテゴリは横スライドではなく1パネル。
- DMは一覧取得だけでなく会話本文が保存される。
- DMは相手ごとにまとまる。
- 通知/DMとも上部UIがコンパクト。
- Dashboard保存済みデータは即表示、グラフ精度・操作性が向上。
- Android実機で下部固定ナビや操作バーが重ならない。



## 16. 2026-09-21 通常チャット実装更新
- 本人通知を V3.5.2 へ更新。
- `/api/v3/notices` を直接読む通信Readerを主経路とし、DOM Readerは補助として分離維持。
- 初回全履歴はAPI最古ページから開始し、各ページ内も古い通知→新しい通知の順で保存する「下→上」方式へ変更。
- 読込中は `読込 N / 総数｜保存 N` を通知し、4列パネルの「読込」は実行中「停止 N/総数」へ変化。
- 停止時は現在ページの保存・チェックポイント確定後に終了。未完了初回読込は保存済みAPIページから再開。
- `kind / body / body_ast / all_area_url / featured_area_url / featured_content_name / action_users` をReader→ingestへ構造化保存。
- classifierは `action-v23-structured`。classifier version更新時はINSIGHT側からチャンク自動再分類し、`action_users[0]` で人物URL・名前・アイコンも補修。
- INSIGHT本人通知UIは横カテゴリタブを廃止し、カテゴリ＋日付を1つのコンパクトパネルへ統合。精度・サーバー状態・再分類は折りたたみへ収納。
- 保存チェックポイントはGM value change listener対応時にINSIGHTへ即通知し、非対応環境は短いpollingでフォールバック。
- 設定/INSIGHT遷移は独立固定4列パネルから実行し、遷移直前veilでnoteトップのちらつきを隠す。

### DM
- DM同期を V1.2.0 へ更新。
- DB実測で「相手21 / 本文0」を確認し、一覧取得と本文取得を切り分け。
- 新規 `note-insight-dm-network-v2.js` がDMのfetch/XHRレスポンスを直接解析し、本文・相手・日時・方向・添付・取得可能な既読状態を保存。
- 既存DM Readerの全ルーム自動巡回キュー・途中index保存を維持し、Network Reader優先＋DOM Reader補助へ変更。
- INSIGHTのDM上部を連携状態・相手数・保存件数・最終同期・主操作を1パネルへ圧縮。

### Dashboard分析
- INSIGHT本体を v2026.09.21.17 へ更新。
- 参加アカウント単位の保存済み分析キャッシュを先に同期表示し、最新Dashboard/通知取得はバックグラウンド更新。
- キャッシュは通知本文等を丸ごと保持せず、クロス分析に必要な日時だけへ縮小。
- 日別チャートはPV / 売上 / スキ / コメント、7/30/90日切替、点タップ詳細を追加。
- 日別データ欠損時は0グラフを描かず、「スナップショットなし」と明示。

### 配信・正本
- Supabase本番とGitHub mainの以下Edge Functionソースが一致することを確認：
  - insight-notification-ingest-v2
  - insight-notification-feed-final
  - insight-notification-reclassify
  - insight-dm-ingest
  - insight-dm-feed
  - insight-dashboard-data
- release manifest / App定数 / userscript / cache-bust / deploy-version / Service Worker cacheを同一リリースへ揃えた。
- Service Worker cacheは `mumei-note-insight-v35`。
- GitHub Pages workflowに現行通知Network/Reader/Controls/Status bridgeとDM Network/Readerのsyntax checkを追加。
- 旧版番号を固定していた回帰テストを現行V3.5.2 / DM V1.2.0仕様へ更新し、停止・途中保存の回帰条件を追加。

### 対応環境の方針
Android専用実装は禁止。共通Reader/保存ロジックはUA分岐させず、標準fetch/XHR・DOM・Storageとuserscript APIのmodern/legacy fallbackで構成する。
配布導線は少なくとも以下を維持：
- Android: Edge / Firefox、Chrome・Yahoo!ブラウザー等は対応ブラウザへ案内
- iPhone/iPad: Safari（Userscripts/Tampermonkey）
- Windows/Linux/Chromebook: Edge / Chrome系 / Firefox / Opera
- macOS: Safari（Userscripts/Tampermonkey）および一般的な対応ブラウザ

### 最終確認
コード上の完了だけで「完成」としない。最終mainのGitHub Actions build・regression・Pages deploy成功、およびPages公開manifest/userscriptの実配信版一致を確認すること。


## 17. 2026-09-21 19:32 JST 実機指摘フォローアップ
- 最新main `f5c75a2` を起点に、既存完成機能を維持した作業ブランチで修正。
- DM Readerを V1.3.5 へ更新。2件並列処理なのにループが3件ずつ進み「3人目・6人目…」を飛ばしていた不具合を `i+=2` に修正。Reader cache-bustも `v=135` へ更新し、V1.3.4構文修正版が端末キャッシュに残る問題を回避。
- INSIGHT内側タブと外側専用modeを連動させ、DMから通知/お気に入り/分析等へ移動した際にDM欄が残る二重状態を解消。専用mode中は内側DMをCSSでも非表示にする安全策を追加。
- お気に入り管理にクリエイター単位の `★ 解除` を追加。解除成功後は一覧・グループ割当・記事キャッシュから同時に除去。
- 本人通知FeedはAPI応答後、人物アイコン補完を待たず保存済み行を先に描画し、アイコン補完だけをバックグラウンド化。カテゴリ別メモリキャッシュは維持。
- 自動再分類は `onlyPending=true` で「その他・未分類」だけを対象にし、同一cursor再発・500チャンク超過時の停止ガードを追加。手動「全履歴を再分類」は従来どおり全履歴対象。
- 通知の「詳細・精度・再分類」はカード内最小高さを廃止して縦幅をさらに圧縮。
- DMの「設定・状態」は縦幅を増やしすぎず、枠・背景・▼/▲を付けて押せるUIであることを明確化。
- リリース目標：INSIGHT本体 `2026.09.21.26` / 本人通知 `3.5.8` / DM `1.3.5` / Dashboard `1.4.4`。
- この時点ではPR #11上。main merge、GitHub Pages配信、Supabase `insight-notification-reclassify` 本番反映、Android実機確認が済むまでは「完成」としない。


## 18. 2026-09-21 20:28 JST main実ファイル再確認と緊急補正
- PR #11 merge後に main の実ファイルを再取得して確認したところ、DM Readerのループが依然 `i+=3` のまま残っていた。
- 報告や差分説明ではなく main の実ファイルを正として再修正。
- `public/note-insight-dm-reader-v1.js` を `i+=2` に修正し、DM Readerを V1.3.6 へ更新。
- `public/note-insight-dm.user.js` は `@version 1.3.6`、Reader cache-bust `v=136` に変更し、旧V1.3.5 Readerキャッシュを強制回避。
- INSIGHT本体を `2026.09.21.27`、DMを `1.3.6` として release manifest / release constants / regression testを同期。
- 通知即表示、未分類のみ自動再分類、DM残留防止、お気に入り個別解除、詳細/設定UI圧縮は main に存在することを再確認。
- Supabase `insight-notification-reclassify` 本番 version 10 は `onlyPending` 対応済みソースと一致。
- 残る確認はGitHub Pages上の配信版とAndroid実機挙動。コード上だけで完成扱いしない。


## 19. 2026-09-21 DM以外の全指示再点検
ユーザー実機で「何も更新されていない」と確認されたため、DMだけでなく最新通常チャットの本人通知・UI・再分類・お気に入り・配信要件を再点検した。過去の完了報告ではなく main 実ファイルとSupabase実データを正とした。

### 本人通知の実データから見つかった原因
- `notification_type=other` は確認時562件。そのうち370件は `note-notification-explicit-sync-v330` が通知ではないAPIを誤取得した履歴だった。
- 誤取得元は magazine layout / related notes / magazines / extra_items / creator contents / circle plans 等。記事本文・マガジン説明・おすすめ記事タイトル等が通知として混入していた。
- 370件は削除せず `meta.noise_reason=non-notification-api-capture` を付けて隔離。既存DB triggerがtypeをotherへ戻すため、feed / analysis / reclassifyでnoise_reasonを正として除外する。
- 隔離後の画面対象otherは 562 → 192件相当。
- `meta.kind=qa_answer` が1件otherに残っていた。DB互換triggerを壊さず、feed/analysis側で `question_answer` として表示・集計する。

### Reader / 取得元
- 本人通知userscriptを V3.5.10へ更新。
- Network Readerは `/api/v3/notices` のルート通知レコードだけを抽出する `extractDirectNotices` を追加。
- 通知同期では非通知API captureを採用しない。direct noticesへ変換できないcaptureは破棄し、DOM Reader fallbackへ渡す。
- Network Reader cache-bustは `v=3581`。
- これにより related_notes / magazines / layout等が今後「その他」に入る経路を遮断。

### 再分類 / Backend
- classifierを `action-v24-structured` へ更新。
- v23済みという理由だけでotherをスキップしていた処理を削除。既存otherも新ルールで再判定可能。
- 隔離済みnetwork noiseは再分類対象から除外。
- Supabase本番:
  - insight-notification-ingest-v2 v33
  - insight-notification-reclassify v12
  - insight-notification-feed-final v25
  - insight-notification-analysis-summary v5
- live sourceにV24 / noise除外 / structured question answer対応が存在することを確認。

### INSIGHT通知UI
- 本人通知画面は `NOTIFICATION_MASTER_CACHE` を追加。一度取得した保存済み行をカテゴリ切替で即利用し、切替のたびに一覧を空にして「読込中」に戻さない。
- API更新は裏でsilent refresh。人物アイコン補完も一覧表示後に行う。
- 「その他・未分類を新しいルールで再判定中」と処理内容を明確化。
- `question_answer` カテゴリを追加。
- 分類バッジを大きくし、詳細・精度・再分類は3列を維持したまま縦余白をさらに圧縮。
- summaryに▼を付け、展開可能であることを明確化。
- INSIGHTトップの本人通知カードに独立した `設定・更新状態` / `本人通知を更新` / `本人通知を設定` ボタンを追加し、小さな状態表示だけに依存しない。

### 既存指示の維持確認
- お気に入りはクリエイター単位の `★ 解除` を維持。
- 通知カテゴリは1パネル方式を維持。
- 通知Readerの下→上、読込/保存件数、停止/途中保存、300件上限を維持。
- DMは今回の非DM修正から分離し、既存V1.3.6を変更しない。

### リリース
- INSIGHT本体 `2026.09.21.28`
- 本人通知 `3.5.10`
- DM `1.3.6`
- Dashboard `1.4.4`
- Service Worker cache `mumei-note-insight-v44`
- Pages回帰テストの通知版・network cache-bust・release版を現行値へ更新。
- 最終Pages配信確認とAndroid実機確認が完了するまでは「完成」と断定しない。


## 20. 2026-09-22 Work継続・最新実機指摘
最新の仕様・実装・検証状況は [WORK_CONTINUATION_20260922.md](WORK_CONTINUATION_20260922.md) を参照。
- ユーザーから「🔔が毎回全件読込・反映が遅い」「DMがまだ読めない」と再報告あり。最優先にする。
- 最新main f33517c1までの通常チャット変更を取得し、Work修正を統合。旧mainで上書きしない。
- 本体2026.09.22.1／通知3.6.0／DM1.4.0。通知の永続差分再開、独立した新着即表示、V25分類のDB上書き防止、DM本文取得と失敗者再開を追加。
- フォローに最新1,000人／過去から1,000人の切替と人物別調査を追加。範囲外の人を解除と推測で断定しない。
- Android実機・本物のnote DM本文取得は未確認。91件のテスト成功を実機成功として報告しない。

### 2026-09-22 公開検証追記
機能コードmain `dd0f5ad1cee208f764c995292e54b41faaf9b86e`、Actions `35678522792` のbuild・91件テスト・Pages deploy成功。Supabase 6関数は配備後ソース一致確認済み。Pages HTTP本文／Android／本物のDM取得は確認待ちとして `WORK_CONTINUATION_20260922.md` に記録。

## 21. 2026-09-22 パネル再不具合への継続修正
ユーザーから再度「保存がすぐ出る・他のパネルが押せない・DMが読めない」。Proへの変更は作業品質を高める希望であり、各ブラウザ対応の維持も明示された。
最新の原因・修正・検証範囲は [WORK_FIXES_20260922_CONTROLS.md](WORK_FIXES_20260922_CONTROLS.md)。本体2026.09.22.2／通知3.6.1／DM1.4.1。DM本文の本番成功は未確認で、相手別エラーを保存表示する。前回の成功報告より実機結果を優先。

## 22. 2026-09-22 保存位置・DMパネル残留・分析の続き

最新main `9c3f2378902ba9287970a5d34c0b42c34d3bba44` を起点に、本体2026.09.22.3／通知3.6.2／DM1.4.2／Dashboard1.4.5を実装。最新画像の「🔔にDMパネルが出ている」も対象。DM URL上に通知が重なって開く場合、DOM表示に応じてDMの巡回とパネルを停止し、遅い保存応答でも復活させない。

原因・実装・保存境界の条件・DM本文の未確認事項・ブラウザ検証範囲は [WORK_FIXES_20260922_BOUNDARY.md](WORK_FIXES_20260922_BOUNDARY.md)。本人通知なし分析は別HTMLなので、React側だけの変更で完了扱いしない。本物のDM本文成功と全ブラウザ実機確認は未完了として引き継ぐ。

公開確認：機能main `8a9533fa2c5aa6a6dffc3866b56d336cb5baf4b9`、Actions `35686819667` のbuild・108件テスト・Pages deploy成功。公開manifest／本人通知／DM wrapper／DM Reader／本人通知なし分析HTMLのHTTP200と内容完全一致を確認。Dashboard backend version 7もソース一致確認済み。端末の旧userscriptは各更新が必要。

## 23. 2026-09-22 参加者の更新パネルと通知Storageエラー

ユーザーから「パネルを作らないと参加者が更新できない」「既存参加者が触らず運営側で更新できる所は更新」と依頼。追加画像1000015188.jpgでは通知がStorage.setItemエラーで停止。詳細仕様・移行方法・検証範囲は [WORK_FIXES_20260922_UPDATE_PANEL.md](WORK_FIXES_20260922_UPDATE_PANEL.md)。本体2026.09.22.4／本人通知3.6.3／Dashboard1.4.5据え置き／DM1.4.2据え置き。Web配信だけで端末内の古いuserscriptまで更新したと報告しない。
