# 夏の陣107 通知・極薄リンクシステム v15

## 正本

- userscript: `public/note-card-batch-bridge-v610.user.js`
- manifest: `public/note-summer-107/manifest.json`
- processed cards: `public/note-summer-107/cards/001.png` ～ `107.png`
- magazine: https://note.com/ai_naoyuki/m/m7ffeddfdfb3c
- image size: 860x140
- item count: 107
- URL uniqueness: 107/107

## 採用フロー

1. 過去生成済み加工サムネイル107枚をnote本文へ一括投入。
2. 各画像へmanifest順で対応記事URLをリンク付与する。
3. 保存後、note Web UI内部の正規URLコマンドを使って、本物のnote標準カード107件を末尾へ順番に自動生成する。
4. 投稿前の「確認」で、画像リンク107/107、標準カード107/107、URL順、embeddedContentKey、note-embed、生URL残り0を再検査する。
5. 投稿はnote純正UIでユーザーが実行する。
6. 実通知確認後、編集へ戻り「削」で標準カード／通知用生URLだけ一括削除する。
7. 加工サムネイル＋URLリンク107件を保持したまま保存し、記事を更新する。

## UI

- `夏107`: manifest・件数・URL・加工画像pathを確認
- `画`: 加工画像を準備。本文→＋→画像を1回で一括投入し、URLリンク付与後に保存
- `送`: note正規URLコマンドで本物カード107件を自動生成。途中停止時は既存の真正カードを認識して続きから再開
- `確認`: 投稿前最終監査。OKになるまで公開しない
- `削`: 通知後に標準カードと通知用URLのみ削除。加工画像は絶対に削除しない
- `×`: パネルを閉じる

## 投稿前成功条件

- manifest = 107件
- manifest magazine URL一致
- 860x140
- URL重複0
- cardPath 001～107連番
- 加工画像リンク 107/107
- 画像リンク順 = manifest順
- note標準カード 107/107
- カードURL順 = manifest順
- 各カード `embeddedContentKey` が `emb...`
- 各カード `htmlForEmbed` に `note-embed`
- 通知用生URL残り0

## 削除後成功条件

- 加工画像リンク107件を維持
- 対象note標準カード0件
- 対象生URL0件

## 廃止

- 307/326モード
- 10件モード
- 2件通知テストモード
- synthetic Enter
- embed JSONコピー
- 手動URLリスト貼り付け

カードが見えるだけでは通知成功とは判定しない。受信側の実通知を最終判定とする。
