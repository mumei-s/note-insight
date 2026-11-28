# 原稿の点検室

読者は、noteの有料部分にある「原稿の点検室を開く」からブラウザで利用します。販売と決済はnoteです。

## Webの入口

Web公開に使うファイルは web/index.html と web.mjs です。このディレクトリで Node.js 22以上を使用し、node web.mjs を実行します。ルートが読者の入口です。/api/kit は点検用の固定サーバーにのみ接続し、受け取った原稿は保存しません。読者データベースにアクセスする管理鍵は公開用Webサーバーに置きません。

## 非公開の実装を復元する

点検エンジン、端末署名の検証、権限と利用状況を管理するSQL、編集用フロントエンドの原本とテストは暗号化しています。復号鍵は販売者が管理します。

```sh
export REVIEW_BUILD_KEY_FILE=/absolute/path/to/private-build-key
node build.mjs unpack
```

復元先は新しい .private/ です。運用と検証手順は .private/OPERATIONS.md にあります。ソースを更新した場合は .private/sources.json の対象ファイルを確認してから node build.mjs pack .private を実行します。
