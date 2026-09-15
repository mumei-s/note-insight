# ブラウザ別の導入導線

開始main: 80dc5e41c30e086e2860edec77bc66607a7a27d4。

- 統合ファイル3.2.3を維持。スクリプトの再更新は不要で、導入センターの配置・案内だけ変更。
- Android Edge / Firefox / その他、iOS Safari / その他、PC Edge / Chrome / Firefox / Mac Safari の9入口。自動選択＋手動切替。
- ブラウザ選択 → 更新 → 起動確認の順。初回の拡張準備と連携を別に配置。
- Tampermonkey導入済みの場合は再導入不要。文字列表示時の拡張メニューとURL取り込み手順を各ブラウザの中に配置。
- Safari Userscriptsでは.user.jsを開いて拡張ポップアップから取り込む公式手順。強制ダウンロードを廃止。Safari以外へ戻しても動くとは案内しない。
- ブラウザ切替時の無効状態リセット、確認からの帰還時の選択保持、設定URLコピーの再自動判定を検証。
- 参考記事 https://note.com/hasyamo/n/n47ac66c72fec は本文取得不可のため内容は未採用。
- 公式資料: https://github.com/quoid/userscripts#usage 、https://www.tampermonkey.net/faq.php?locale=en&q=Q209 、https://addons.mozilla.org/firefox/addon/tampermonkey/
- Android/iOS実機での拡張操作は未検証。ローカルPlaywrightはブラウザ実行ファイルがなく、画面描画検証は実行できず。
