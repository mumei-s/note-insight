# ブラウザ起動とSafari Userscriptsの導入・更新

開始点：main 3dc31826948d1321a75008ee0009fa2ba4d5b7a6。
利用者実機で「ChatGPT内で開いたブラウザでは更新できず、Edgeを先に起動すると更新できた」と確認された。

## 導入・更新の共通案内

本人通知の導入・更新、DM導入、Dashboard設定へ同じブラウザ案内を配置する。

| 環境 | 正式な更新経路 |
| --- | --- |
| Android | 拡張機能を入れたEdgeまたはFirefoxを単体で先に開く |
| iPhone・iPad | Safari＋無料Userscripts |
| Mac Safari | Userscripts。既存のTampermonkey利用者には別の手順を表示 |
| Windows・Mac・LinuxのChrome/Edge/Firefox/Opera | 拡張機能を入れた同じブラウザで更新を確定 |
| 明示的なアプリ内表示・未対応ブラウザで起動未確認 | 更新処理を開始せず、普段のブラウザへの移動・URLコピーを案内 |

UAは案内の初期選択用で、拡張機能の実行証明には使わない。
アプリ内表示がUAから識別できない場合もあるため、起動未確認ならブラウザを先に開く案内を常設する。
環境の選択を変えても実際の起動版・更新済み状態を偽装しない。
AndroidのEdge/Firefox起動は明示タップだけで行い、失敗時は安全な同じ更新画面とコピー方法を残す。
iOSでは通常のHTTPSリンクや未保証の独自schemeを「Safariを必ず起動できる」と表示しない。URLコピー→Safariを自分で開く手順を用意する。
移動URLは現在のツール・有効なnote ID・安全な本体復帰先だけを引き継ぎ、token/code等をコピーしない。

## Userscriptsでの文字列表示

Safariで正規の.user.jsを開くと文字列画面が出る。この画面は正常な途中段階である。
そのスクリプト画面のSafari拡張機能メニューからUserscriptsを開き、Install/Updateを確定して元の画面へ戻る。
TampermonkeyのUtilities/URL importやコード上書きをUserscripts向けには要求しない。
Userscriptsの更新を自動更新任せにせず、手動更新の入口を保持する。

## API互換性の実修正

Userscriptsの安定版はGM APIをFunctionのローカル引数として渡す。
既存のglobalThis.GMだけを見る判定では、版表示は動いてもGM storageの保存が行われないことを再現できた。
現active通知・DM・Dashboardの依存先をlexical GMに対応し、Tampermonkeyのmodern/legacy APIも保持する。
APIをglobalThisへコピーするshimは使わない。
3wrapperは取得できた既知のscriptHandler名だけをlive-manager属性へ公開し、案内の初期選択に使う。

変更した全@require先のキャッシュ指紋を更新し、既存の@name/@namespace・保存キー・権限・アカウント境界を保持する。

配信版：本体2026.10.30.3、本人通知3.6.61、DM1.4.19、Dashboard1.7.6。

## 検証

- 公式と同じFunction引数のAPI注入方式で、通知/DMの連携保存、Dashboard handoffの読戻し、storage満杯時のqueue保存確認を実行する。
- Android/iOS/iPadOS/macOS/Windows系のUA、手動選択と実行証明の分離、外部起動fallback、秘密query除外、コピー失敗、イベントループを検査する。
- 新規互換・ブラウザ案内・実installer統合テストをPagesの公開ゲートに含める。
- Android Edgeは利用者による実機確認あり。新しい版のiPhone/iPad/Mac/Windows全実機の操作をこの環境で完了したとは主張しない。

ローカル結果：Userscripts API互換14件、ブラウザ案内39件、実installer統合23件、更新/設定のまとまったゲート210件が成功。本番build・Pagesで要求する既存の各検査グループも成功。
旧版の@require固定値を検査していた箇所は、モジュール版と配布wrapperの一致へ変更した。
既存の履歴SQLテストはfixtureがUTCなのに境界がローカル時差に依存していたため、UTC明示の範囲へ安定化し、Los Angeles/Tokyoの両方で確認した。本番DB・migrationの変更はない。

一次資料：

- https://github.com/quoid/userscripts/blob/main/README.md
- https://github.com/quoid/userscripts/blob/release/4.x.x/src/ext/content-scripts/entry-userscripts.js
- https://apps.apple.com/jp/app/userscripts/id1463298887
- https://developer.chrome.com/docs/android/intents
- https://support.mozilla.org/en-US/kb/add-ons-firefox-ios
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent
