# 購入記事紹介の専用版 2.8.1

配布先は `public/note-profile-card-paster-purchased.user.js`。購入記事紹介だけを表示する独立したインストールIDと保存領域を持つ。

- 起動時からデータ選択・貼付/再開・一時停止・停止・今回分削除を表示する。
- ハロウィン、スキ履歴、プロフィール、URL/タグ入力などの作成機能はバンドルしない。
- 通常サムネと無料公開部分の要約を並べる2.8.0の描画・入力検証・note正規アップロード処理を再利用。
- 旧総合版が同時に有効な場合も、旧パネルとランチャーを専用版の表示中は非表示にして重なりを防止。旧ツールのデータや本文は削除しない。
- 途中記録は専用領域へ保存。旧2.8.0の購入記事紹介の記録だけは、記事IDが一致した場合に移行して再開できる。
- 元の極薄ツールとその更新先は維持。新しい専用版を使う場合は旧2.8.0を拡張機能側で停止できる。
- note編集画面の外では何も起動せず、起動時の通信・自動貼付は行わない。

ビルド: `node scripts/build-purchased-review-standalone.mjs`

確認: `node --test tests/profile-card-purchase-only-v281.test.mjs tests/profile-card-purchased-review-v280.test.mjs tests/profile-card-native-editor-v271.test.mjs tests/profile-card-save-native-v266.test.mjs`
