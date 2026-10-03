# INSIGHT 2026.10.03.20 — 切替画面とメイン上部

## 引継ぎ・今回の範囲

- 「メンテナンス表示不要」の最新チャットを継続。開始時の正本 main は `e64c2494c1b7d438c571bcff8e8e471ffd4fc2c9`。
- 録画 `1000015602.mp4` の対象は、端末の録画UIでもデータカードのぼかしでもなく、一瞬黒背景になり2行のログイン確認文が表示される部分。
- メイン上部の「無名 S note / INSIGHT」と注意・分析・本人通知の長丸に演出。下部 TOP / INSIGHT / noteへ と、その中の項目バーは動かさない。
- 通常入口はスキ履歴。本人通知は明示した時だけ。メンテナンスは無効のまま。

## 原因と修正

1. ログイン確認画面のCSSが `BottomNav` 内だったため、確認中にナビを非表示にすると装飾も消えていた。待機画面のCSSを独立させ、黒背景・2行ロゴ・横断光・確認中の進行表示へ変更。認証が完了したら即座に本体へ戻す。演出のための追加待機・認証再実行・保存データ変更はない。
2. 上部背景文字は文字色のalpha `.13` と要素opacity `.13` の二重指定で、最終実効alphaが約 `.017` だった。文字色alpha `.20`、opacity `1` とし、クリエイター枠全体に配置。光と長丸のリングは1回で静止する。
3. 装飾要素だけを mode / tab に応じて再生成し、項目切替時にも演出を再生する。操作ボタン、フォーカス、保存データパネルは維持する。
4. OSの「動きを減らす」設定では静止表示。下部ナビには演出を追加しない。

## 変更対象

- `src/insight-thumb-dock-v11.css` — 上部装飾の表示とモーション
- `src/member-insight-live-v2.tsx` — 装飾だけの再生キー
- `src/App.tsx` / `public/sw.js` — 切替待ち画面と配信キャッシュ
- release metadata / deploy marker / 回帰テスト

各本体コミットは機能境界を分離して検査する。認証・Supabase・本人通知Reader・フィルター・分析のデータ処理は変更しない。

## 検証

- `npm run build` 成功。
- `node --test tests/insight-entry-motion-v20.test.mjs tests/auth-storage-recovery-v2.test.mjs tests/notification-auth-v363.test.mjs tests/notification-feature-v366.test.mjs` — 17件成功。
- 旧 `insight-navigation-v145.test.mjs` は、現行の「入口はスキ履歴」や下部項目バー移行前の `.miu-nav` を前提にするため失敗。今回の差分は装飾キー2箇所のみで、その旧仕様を復活させない。
- クラウドブラウザには参加者セッションがなく、実会員の上部演出とAndroid端末の最終確認は未実施。ローカルHTMLの表示はブラウザポリシーで不可のため、それを迂回して表示・公開しない。
- Pages公開状況と配信内容は、公開後に別途確認する。
