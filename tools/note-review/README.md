# 原稿点検ツール

既存のサイトから独立した Worker です。ブラウザには入力画面と点検結果を返します。エントリー用の合言葉、管理者用の合言葉、ビルド鍵は運営者が個別に管理します。

## ローカルでの復元

Node.js 24 と運営者のビルド鍵ファイルを用意し、このディレクトリで実行します。

```sh
export REVIEW_BUILD_KEY_FILE=/absolute/path/to/build-key
export REVIEW_RULE_KEY_FILE=/absolute/path/to/worker-rule-key
npm run build
npm test
```

Worker 用の鍵ファイルには 32 バイトの乱数を標準 Base64 で記録します。運用時には同じ値を Worker の秘密設定 `RULE_KEY` に登録します。リポジトリ復元用の鍵と、Worker 用の鍵は別々に管理します。

ビルドで復元するサーバーコードとテストは `.worker/` に作られます。認証付き暗号の検証に失敗した場合は処理を中断します。ブラウザ用の静的アセットには、このディレクトリを指定しないでください。

点検コードまたはテストを修正したときは、手元の非公開ソースを編集してから暗号化パッケージを更新します。

```sh
node build.mjs seal /absolute/path/to/private-source
```

稼働には専用のデータベースと環境ごとの秘密設定が必要です。初期スキーマは `schema.sql` にあります。

| Worker の設定 | 用途 |
|---|---|
| `DB` | `schema.sql` を適用した専用 D1 データベース |
| `ENTRY_CODE` | 初回利用者が入力する合言葉 |
| `OWNER_KEY` | 所有者確認・利用結果の受付番号生成に使う高エントロピーの秘密値 |
| `RULE_KEY` | 保護モジュールの生成時に使った Worker 用の鍵 |

起動エントリーは `.worker/worker.mjs` です。公開する環境には、このエントリーが読み込むサーバーモジュールだけを配置します。
