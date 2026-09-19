# 本人通知 復旧実装プロンプト（2026-09-19）

## 目的
本人通知の「5パネル表示」「設定画面からの復帰」「通知読込・保存」を完全に分離し、他機能の変更で相互に壊れない構造へ戻す。

## 絶対条件

### A. 5パネル表示
- 5パネルは `https://note.com/notifications` または実際に開いている note の通知ポップアップ上だけに表示する。
- クリエイターページ、記事ページ、ホーム、マガジン、設定ページなどでは絶対に表示しない。
- 「ベルを押した直後」という意図だけでは表示しない。実通知面が確認できてから表示する。
- `/notifications` では通知DOMの仮想スクロール・再描画中でもパネルを維持する。
- パネルのDOMは note の通知DOMへ子要素として挿入せず、独立fixed hostを使う。

### B. 設定 → 🔔通知へ戻る
- 設定画面の戻り先は常に `https://note.com/notifications`。
- creator URL、article URL、history.back()、document.referrer、直前通知リンクを戻り先に利用しない。
- 設定を開く際に記事復帰用状態を消去する。
- 設定画面の画面内「戻る」とブラウザBackの両方を `/notifications` に固定する。
- 設定復帰処理は記事復帰・通知位置復元ロジックを呼ばない。

### C. 通知記事から戻る位置
- Runtimeで記事/creator URLへ自動遷移・復帰しない。
- 通知位置の保存・復元はReaderだけが担当する。
- RuntimeとReaderで同じ戻る処理を二重実装しない。

### D. 読込・保存
- Readerはパネル表示ロジックから独立させる。
- scan開始時、現在見えている未保存通知を先にoutboxへ入れてingestへ送る。
- その後、保存済み境界から上方向へ差分を読む。
- 境界DOMが見つからない場合は保存済み時刻から直近差分を安全に確認する。
- ingest成功レスポンスの `confirmedClientSignatures` を受け取った通知だけ保存済みにする。
- ページ離脱・visibility hidden時も未送信分はoutboxに保持する。
- 購入・高評価を含む本人通知はReader → ingest → DB分類まで到達させる。

### E. バージョン
- UserScript / Reader / Runtime / release manifest の本人通知バージョンを一致させる。
- @require queryを必ず変更してキャッシュを更新する。
- 最新版ならトップの「更新あり」表示は出さない。最新版を示す常時ランプは不要。

## 回帰テスト必須
1. creatorページでは5パネルが表示不可。
2. articleページでは5パネルが表示不可。
3. `/notifications` ではDOM再描画中も5パネルを維持。
4. 設定画面の戻り先は文字列として `https://note.com/notifications` 固定。
5. Runtimeに記事復帰用 `saveArticleReturn/resumeArticleReturn` を持たせない。
6. Readerには通知位置復元を残す。
7. Reader scan開始時に visible rows の先行保存を実行。
8. UserScript / Reader / Runtime / releaseのバージョン一致。
9. purchase / rating の分類テストを維持。

## 禁止
- 戻り先にcreator/profile URLを使うこと。
- `history.back()` で設定から戻すこと。
- RuntimeとReaderの二重復帰。
- bell intentだけでパネルを表示すること。
- 通知DOMをパネルの親にすること。

## 手動読込モード
- 「読込」を押した時だけ「続きから読む / 全読み」を選択表示する。
- 自動読込は常に「続き」だけを使い、「全読み」を自動実行しない。
- 「続き」は既存の完了ライン・保存済み署名を使って追加分だけ取得する。
- 「全読み」は完了ラインを無視して取得可能な通知履歴を先頭から末尾まで再走査し、保存済みも含めサーバーへ再送する。
- 全読みのサーバー側は既存 fingerprint / client_signature で重複排除し、既存行は最新分類で更新する。これにより読込停止期間の取りこぼしと過去の誤分類を回収する。
- 全読み中は通常の boundarySignature / boundaryEventIdentity / boundaryLegacySignature を変更しない。
- 全読み結果は lastFullScanAt / lastFullSeenCount / lastFullConfirmedCount / lastScanMode=full-history-repair の別項目へ保存する。
- 全読み失敗時は outbox を残し、次回全読みまたは続きで再送できること。

### 手動読込の回帰テスト
- 読込ボタンが即scanを始めず、選択UIを開くこと。
- 「続きから読む」は scanContinue、「全読み」は scanFull にだけ接続すること。
- maybeAuto から scanFull へ到達する経路が存在しないこと。
- scanFull が sendBatchFull を使用し、通常チェックポイントを更新しないこと。
