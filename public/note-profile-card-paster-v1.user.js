// ==UserScript==
// @name         無名S note 極薄サムネイル
// @namespace    https://github.com/mumei-s/note-insight/profile-card-paster
// @version      2.6.6
// @description  極薄サムネイル単独版。URL・マガジン・タグ・スキ履歴から指定件数または取得分全数を紹介。
// @match        https://editor.note.com/*
// @noframes
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// @connect      *
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v1.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v1.user.js
// ==/UserScript==

(function(){
'use strict';
const owner=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(location.hostname!=='editor.note.com')return;
if(owner.__MUMEI_PROFILE_CARD_STANDALONE_VERSION__==='2.6.6')return;
owner.__MUMEI_PROFILE_CARD_STANDALONE_VERSION__='2.6.6';
owner.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__={"id":"halloween-art-2026-126","source":"https://goo-dev0505.github.io/halloween-gallery/","sourceBlob":"a6101a3572813f072490bc301a3d3eaeab41ab2c","extractedAt":"2026-10-18","count":126,"people":[{"id":"c001","urlname":"ktcrs1107","creator":"KITAcore｜キタコレ＠ログプレイヤー"},{"id":"c002","urlname":"dreamy_quail9288","creator":"ハル｜Tokyo Visual Moments"},{"id":"c003","urlname":"holy_boar3105","creator":"ENDLICHERI（旧ジェミ兄）"},{"id":"c004","urlname":"nenkoro_life","creator":"ねんころ"},{"id":"c005","urlname":"hasyamo","creator":"はしゃも"},{"id":"c006","urlname":"shirono_aru","creator":"しろのある"},{"id":"c007","urlname":"kinu885","creator":"KINU"},{"id":"c008","urlname":"mei_shin","creator":"メイシン"},{"id":"c009","urlname":"hitsuji_natsume","creator":"夏目羊"},{"id":"c010","urlname":"star246","creator":"ミュリン♪(*´ω`*)✨"},{"id":"c011","urlname":"ai_crayon_04","creator":"はるかな"},{"id":"c012","urlname":"aging_gracefully","creator":"noteと遊ぶ あん"},{"id":"c013","urlname":"koyagishizukani","creator":"コヤギ｜静かに暮らす"},{"id":"c014","urlname":"suzuka020825","creator":"ミライダネ"},{"id":"c015","urlname":"calm_sedum3458","creator":"柴犬とゆる暮らし"},{"id":"c016","urlname":"mute_hyena5293","creator":"FANTASY-AI JP"},{"id":"c017","urlname":"green_donguri","creator":"緑どんぐり"},{"id":"c018","urlname":"matcha_aispirit","creator":"まっちゃ💚AI活用とnote副業ラボ"},{"id":"c019","urlname":"nanamay11023","creator":"藤｜AIと仕事も遊びも本気"},{"id":"c020","urlname":"fond_shark9221","creator":"あきまむ｜AIとnoteを楽しむ"},{"id":"c021","urlname":"large_hosta3387","creator":"しれネコ🐾｜迷子の気持ち、 ちょっと軽く"},{"id":"c022","urlname":"10colorful","creator":"masaya｜テンカラフル"},{"id":"c023","urlname":"kakuu_kareshi","creator":"架空彼氏製作所｜AIイラスト"},{"id":"c024","urlname":"dandan_arigato19","creator":"だんだんありがと@めじゅ"},{"id":"c025","urlname":"scribble_1000","creator":"sophie"},{"id":"c026","urlname":"shima_shima03","creator":"しま | 日常にそっと英語を"},{"id":"c027","urlname":"modern_holly38","creator":"ピナクル"},{"id":"c028","urlname":"skagenavi","creator":"須川元介/情報翻訳家"},{"id":"c029","urlname":"hekutaro_0520","creator":"ヘクたろー|緑内障でも「面白い」を残したい男"},{"id":"c030","urlname":"deft_raven2722","creator":"Ejii✦3（えじー）"},{"id":"c031","urlname":"kiitto1968","creator":"埼玉の裏仕事人"},{"id":"c032","urlname":"quirky_lotus3945","creator":"暮らしのリハ医K"},{"id":"c033","urlname":"unchan_happy","creator":"うんちゃん"},{"id":"c034","urlname":"sekaiayumu25","creator":"せかいあゆむ（瀬海歩）"},{"id":"c035","urlname":"kei_mifu","creator":"みふゆ＆成瀬圭｜AIパートナーとnote実験中｜フォロバ100"},{"id":"c036","urlname":"yukiyomi","creator":"雪詠｜ゆきよみ"},{"id":"c037","urlname":"ojisan_chinpan","creator":"ちんぱん🐒耳毛〰(˙👄˙)〰"},{"id":"c038","urlname":"lafrocinematic","creator":"Afro.S"},{"id":"c039","urlname":"proper_swift9762","creator":"neju"},{"id":"c040","urlname":"moo_1112","creator":"ムーさん"},{"id":"c041","urlname":"squallxxx","creator":"桜星雨夜"},{"id":"c042","urlname":"nekodamari","creator":"ねこママ｜陽紡 Hitsumugi"},{"id":"c043","urlname":"dear_cosmos7591","creator":"えりぃ｜ココロの片づけ案内人"},{"id":"c044","urlname":"papi_san","creator":"ぱぴさん"},{"id":"c045","urlname":"second__career","creator":"Liliscend＠夜更かしDX・AIハッカー"},{"id":"c046","urlname":"asobo_kids","creator":"まき@こどもと日々成長中"},{"id":"c047","urlname":"yokayoka5103","creator":"まるよか"},{"id":"c048","urlname":"47_box","creator":"マイキー🐣"},{"id":"c049","urlname":"nanamoto52885","creator":"yukiko 摂食嚥下コンサルタントナース"},{"id":"c050","urlname":"yellowdolphin","creator":"きいるか"},{"id":"c051","urlname":"yuuwa1046","creator":"ゆ"},{"id":"c052","urlname":"ai_sato_","creator":"AIさとう｜AI動画で収益化を目指す"},{"id":"c053","urlname":"fresh_loris1944","creator":"名前もと"},{"id":"c054","urlname":"n_kazumai55633","creator":"ミナト汐　＠光と構図のアトリエ"},{"id":"c055","urlname":"love_chance","creator":"サンタクラシ🍄"},{"id":"c056","urlname":"ai_naoyuki","creator":"ナオユキ｜物語と知識のコンシェルジュ"},{"id":"c057","urlname":"usagi_no_mimi_","creator":"紅茶🫖｜ことばの庭"},{"id":"c058","urlname":"crisp_chimp0823","creator":"青井透子｜日常の過剰解釈屋"},{"id":"c059","urlname":"soyonone_career","creator":"💻そよのね｜薬剤師の在宅ワークノート"},{"id":"c060","urlname":"tatsuopapa","creator":"龍神"},{"id":"c061","urlname":"sekkei_jikken","creator":"設計実験室"},{"id":"c062","urlname":"sacana_chan","creator":"sacana"},{"id":"c063","urlname":"easy_hound4116","creator":"綿毛"},{"id":"c064","urlname":"kohana1112","creator":"営業fafa | note業界No.1営業マン"},{"id":"c065","urlname":"tsumu_156","creator":"紬は今日も絶好調！？"},{"id":"c066","urlname":"open_eel2077","creator":"エビちり"},{"id":"c067","urlname":"sayo_official","creator":"沙夜-𝕊𝕒𝕪𝕠- 沙夜学園🌠"},{"id":"c068","urlname":"nice_crab5854","creator":"安達【筋肉メタル親方】｜Creator’s Notebook"},{"id":"c069","urlname":"clear_sloth1257","creator":"きっこ"},{"id":"c070","urlname":"unique_turkey951","creator":"碧乃さくら"},{"id":"c071","urlname":"pure_bear1643","creator":"みっちぃ|子供と一緒に成長したい2児の父"},{"id":"c072","urlname":"open_tulip9172","creator":"ミノリ・グルーヴ@Minoriからの転生"},{"id":"c073","urlname":"yume_suisho","creator":"水晶ゆめ🔮当てない占い師×夢を灯す創作家"},{"id":"c074","urlname":"kyogen_lab","creator":"奇構屋ゴロウ"},{"id":"c075","urlname":"kotaya_log","creator":"こたや｜KOTAYA"},{"id":"c076","urlname":"hirata_mikiko60","creator":"椿みきこ🌸季節の花ごよみ"},{"id":"c078","urlname":"chatgpt_ysd","creator":"カワムラ｜AI擬人化漫画 | ChatGPTのヨシダ"},{"id":"c079","urlname":"kanamin26","creator":"カナミン｜AIと迷いながら、進む人"},{"id":"c080","urlname":"alive_prawn4206","creator":"ななな｜もやもや減らし屋"},{"id":"c081","urlname":"hospital_ph_hono","creator":"HONO"},{"id":"c082","urlname":"eager_thyme9842","creator":"考える赤柴"},{"id":"c083","urlname":"nyoro_usagi","creator":"禁断のニョロうさぎ"},{"id":"c084","urlname":"niwashi_fronta","creator":"庭師ふろんた｜3兄弟パパ"},{"id":"c085","urlname":"corvus_754","creator":"sumica"},{"id":"c086","urlname":"funa04","creator":"ふな"},{"id":"c087","urlname":"furikakemen","creator":"furikakemen"},{"id":"c088","urlname":"gentle_curlew322","creator":"空手家パパ"},{"id":"c089","urlname":"noted_yatoasuter","creator":"やと"},{"id":"c090","urlname":"ichijikukancho","creator":"四神書店"},{"id":"c091","urlname":"super_liger8087","creator":"おーい淑女!"},{"id":"c092","urlname":"harumakidaizin","creator":"はるまき大臣｜薬剤師"},{"id":"c093","urlname":"ame_to_ai","creator":"あめ｜AIと言葉の日々"},{"id":"c094","urlname":"ai_money60","creator":"元銀行員のAIお金ノート"},{"id":"c095","urlname":"cool_mink5895","creator":"9244"},{"id":"c096","urlname":"lovely_stork7575","creator":"ちっぷのこころ🎡"},{"id":"c097","urlname":"gptch","creator":"ジピっち（ChatGPT）｜継承しながら文化を育てるAI"},{"id":"c098","urlname":"sakono11","creator":"さこの"},{"id":"c099","urlname":"hanamiti369labo","creator":"運命デザインラボ"},{"id":"c100","urlname":"fcs_factory","creator":"FCS"},{"id":"c101","urlname":"aiby_masuhiyo","creator":"あいびより。AIクリエイターの日常🐾"},{"id":"c102","urlname":"traveler_light","creator":"灯の旅人｜創作と人の心を観測する人"},{"id":"c103","urlname":"nero_notelover","creator":"ネロ🌙｜王子｜秋読コレクションありがとう🍁【全力で駆け回ってるから待ってて🌙】"},{"id":"c104","urlname":"digital_sashimi","creator":"デジさしみ | IT現場の効率家"},{"id":"c105","urlname":"koymikoto","creator":"リュウジ👨‍🦰アニメ好きな2児のパパ"},{"id":"c106","urlname":"0bi","creator":"Obi"},{"id":"c107","urlname":"1031mike","creator":"みけにゃん@小さなしあわせ収集家"},{"id":"c108","urlname":"henko_3in0","creator":"岡埜 由木古（偏光）"},{"id":"c109","urlname":"mamecats","creator":"MM-cats"},{"id":"c110","urlname":"large_iguana6415","creator":"やっさん（yasuda）"},{"id":"c111","urlname":"rich_rat9818","creator":"🐾コロッケノスケ☕️｜タロット占い師🔮"},{"id":"c112","urlname":"clever_hare2654","creator":"カモミール"},{"id":"c113","urlname":"sui_ai_drawing","creator":"スイ🎨Sui_ai_drawing"},{"id":"c114","urlname":"mizai_tadakore","creator":"祇是 未在(タダコレ ミザイ)"},{"id":"c115","urlname":"like_ferret2194","creator":"月凪（つきなぎ）"},{"id":"c116","urlname":"tasty_quoll5392","creator":"ゆぴか｜働きづらさから在宅ワークを模索中☀︎"},{"id":"c117","urlname":"toto0316","creator":"トト"},{"id":"c118","urlname":"kinokoro","creator":"きのころ"},{"id":"c119","urlname":"andrewwaldfeld","creator":"andy｜のあ🐾カフェのマスター 数字好きの経営者"},{"id":"c120","urlname":"loyal_fox8450","creator":"vagabond1497"},{"id":"c121","urlname":"almabrillante","creator":"あまね〘ฅ՞•ﻌ•՞ฅฅ^•ﻌ•^ฅ〙"},{"id":"c122","urlname":"pikopiko_2026","creator":"PikoPikoぴこぴこ"},{"id":"c123","urlname":"intentus_26","creator":"Intentus｜会社員、AIと世界の観察ログ"},{"id":"c124","urlname":"jimanyan","creator":"向日葵じまにゃん🌻"},{"id":"c125","urlname":"novel_woolpallet","creator":"羊毛の魔女パレット🐏"},{"id":"c126","urlname":"reipichu","creator":"零ぴちゅ。"},{"id":"c127","urlname":"hunk_shuntana","creator":"はんく・シュンタナ🍌『塩化ビニール系女子』AIクリエイター兼プロデューサー"}],"preparedAt":"2026-10-18T10:28:19.937Z","preparedCount":125,"preparedRows":[{"id":"c001","urlname":"ktcrs1107","creator":"KITAcore｜キタコレ＠ログプレイヤー","key":"n8cf8cff84c68","url":"https://note.com/ktcrs1107/n/n8cf8cff84c68","title":"Spotifyプレイリスト3ステップ一括取得ツール #1","publishAt":"2024-06-10T14:08:29+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/260936517/rectangle_large_type_2_21fbaf4039be7b412224f0fda13a84be.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/223627119/profile_d5c267fbb0a27f4c2b86cb89c6ca6a62.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"ktcrs1107","key":"n8cf8cff84c68","publishAt":"2024-06-10T14:08:29+09:00","terminalPage":95,"totalCount":567,"firstPageFingerprint":"nb2d3d3103241:2026-10-18T07:00:00+09:00|n4a6c20cf26b8:2026-10-17T11:30:00+09:00|n8c62f2c3416b:2026-10-16T22:20:29+09:00|na93d51b55d0a:2026-10-16T06:30:00+09:00|ndd4e5c4ed027:2026-10-15T06:30:00+09:00|n22ed66615ffd:2026-10-14T06:30:00+09:00","firstPageSize":6,"pagesChecked":[1,94,95,96],"requests":5,"verifiedAt":"2026-10-18T10:26:10.498Z"},"index":1,"likerKey":"ktcrs1107","actorUrl":"https://note.com/ktcrs1107","avatarMissing":false,"profileText":"データと生成AIで「つくって壊して、また組み直す」実験ログ。\nプロンプト・AIアート・分析ツールを公開中。\nツール・記事ネタを持ち帰れる場所です。\n呼び名：にーやん／きたさん｜PR・ご相談歓迎｜Amazonアソシエイト参加中","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:02.398Z","firstPageFreshAuditAt":"2026-10-18T10:26:10.498Z"},{"id":"c002","urlname":"dreamy_quail9288","creator":"ハル｜Tokyo Visual Moments","key":"ncf94c5368c7d","url":"https://note.com/dreamy_quail9288/n/ncf94c5368c7d","title":"自己紹介｜AI美女フェチ動画から、250万回再生のAI短編ドラマを作るまで【2026年8月更新】","publishAt":"2025-09-08T18:49:52+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/213821514/rectangle_large_type_2_439570da0b8f8c71e24a81ea94a99cdd.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/324052450/profile_e262b4788486dbfe210faf13e3b38405.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"dreamy_quail9288","key":"ncf94c5368c7d","publishAt":"2025-09-08T18:49:52+09:00","terminalPage":65,"totalCount":386,"firstPageFingerprint":"n59d8580d8810:2026-10-18T16:44:12+09:00|nd9c08ca3c227:2026-10-16T20:37:39+09:00|n74d2045fb25a:2026-10-15T12:56:55+09:00|n806f751e18b8:2026-10-14T07:40:00+09:00|n216acaf32d9b:2026-10-13T22:57:11+09:00|n7d45cd2e8a78:2026-10-12T23:39:11+09:00","firstPageSize":6,"pagesChecked":[1,64,65,66],"requests":5,"verifiedAt":"2026-10-18T10:26:10.299Z"},"index":2,"likerKey":"dreamy_quail9288","actorUrl":"https://note.com/dreamy_quail9288","avatarMissing":false,"profileText":"AI映像作家のハルです。Instagram1万2千人。AIショートドラマを一人で企画・制作しています。『TESSERACT』『遺言レシピ』『今日のオガワ』『堕天使』。制作工程・AIツール検証を発信中。企業PR・映像制作のご相談はDMへ。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:02.390Z","firstPageFreshAuditAt":"2026-10-18T10:26:10.299Z"},{"id":"c003","urlname":"holy_boar3105","creator":"ENDLICHERI（活動終了しました）","key":"ne13f94326e11","url":"https://note.com/holy_boar3105/n/ne13f94326e11","title":"Geminiでエッツなエステサロン【バカ】","publishAt":"2025-10-06T19:38:34+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/220433353/rectangle_large_type_2_db4370d9d3b77344911133f85e3932c6.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/304865781/profile_dd467421823007abc32621b56a52bb46.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"holy_boar3105","key":"ne13f94326e11","publishAt":"2025-10-06T19:38:34+09:00","terminalPage":49,"totalCount":294,"firstPageFingerprint":"ncbb9d8edc552:2026-10-09T19:00:00+09:00|n63212b0c4fd2:2026-10-08T20:00:00+09:00|n573948e8179f:2026-10-07T20:00:00+09:00|n556477ac326c:2026-10-06T19:00:00+09:00|nc69615782511:2026-10-05T20:00:00+09:00|nc5a38d527565:2026-10-04T20:00:00+09:00","firstPageSize":6,"pagesChecked":[1,48,49,50],"requests":5,"verifiedAt":"2026-10-18T10:26:10.448Z"},"index":3,"likerKey":"holy_boar3105","actorUrl":"https://note.com/holy_boar3105","avatarMissing":false,"profileText":"活動終了しました。ちちぷいに来てください。ENDLICHERIです。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:02.393Z","firstPageFreshAuditAt":"2026-10-18T10:26:10.448Z"},{"id":"c004","urlname":"nenkoro_life","creator":"ねんころ@AIクリエイター","key":"n575675fff52a","url":"https://note.com/nenkoro_life/n/n575675fff52a","title":"うつで退職した私が活用した制度と再スタートまでの道のり","publishAt":"2025-08-23T18:52:20+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/210372972/rectangle_large_type_2_4b4a553659db76477c7154828c183c23.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/241211839/profile_9a8798f1a773b8b9dffe231238d28a1a.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"nenkoro_life","key":"n575675fff52a","publishAt":"2025-08-23T18:52:20+09:00","terminalPage":47,"totalCount":279,"firstPageFingerprint":"n6eeddb3accba:2026-10-16T16:00:00+09:00|nffddcc5fd62a:2026-10-15T16:00:00+09:00|n40f8b1bded16:2026-10-12T16:00:00+09:00|nf60f5c6f51c6:2026-10-11T16:00:00+09:00|n0fef8a240189:2026-10-10T16:00:00+09:00|n35e407f058ef:2026-10-09T16:00:00+09:00","firstPageSize":6,"pagesChecked":[1,46,47,48],"requests":5,"verifiedAt":"2026-10-18T10:26:10.485Z"},"index":4,"likerKey":"nenkoro_life","actorUrl":"https://note.com/nenkoro_life","avatarMissing":false,"profileText":"AIクリエイター/フリーランス/宝島社書籍掲載歴有\nG検定/生成AI人材認定カード所持\n\nAIレビュー・ツール制作可\n\n企業案件対応多数有\nフォローでDM可📩\nhttps://nenkoro.com/\n\n共同マガジンまわり↓\nhttps://note.com/nenkoro2","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:02.320Z","firstPageFreshAuditAt":"2026-10-18T10:26:10.485Z"},{"id":"c005","urlname":"hasyamo","creator":"はしゃも｜感情構造エンジニア","key":"nba6e79f62183","url":"https://note.com/hasyamo/n/nba6e79f62183","title":"AIに4コマ漫画を描かせたら、私もやらかしまくった話","publishAt":"2025-12-04T13:02:22+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/233921349/rectangle_large_type_2_6702b23c1f7e1ffcd66c840fd75bc0f0.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/319335948/profile_587919442d29d1bf24b510f4cbecac72.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"hasyamo","key":"nba6e79f62183","publishAt":"2025-12-04T13:02:22+09:00","terminalPage":54,"totalCount":319,"firstPageFingerprint":"n85d1807686d5:2026-10-18T07:30:00+09:00|n6f7434b8f3a3:2026-10-17T07:30:00+09:00|nd8344fa9149c:2026-10-16T07:30:00+09:00|n6a3f45531f67:2026-10-15T07:30:00+09:00|n0798dfc73300:2026-10-14T07:30:00+09:00|n5eb77251bf44:2026-10-13T07:30:00+09:00","firstPageSize":6,"pagesChecked":[1,53,54,55],"requests":5,"verifiedAt":"2026-10-18T10:26:10.304Z"},"index":5,"likerKey":"hasyamo","actorUrl":"https://note.com/hasyamo","avatarMissing":false,"profileText":"ITエンジニア。生成AI × 個人開発。\nWebツール・AIイラスト・コンテンツ設計の開発日記を書いています。\n制作・相談受付中。事例・ポートフォリオ👇\nhttps://hasyamo-site.hasyamo.workers.dev/","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:02.395Z","firstPageFreshAuditAt":"2026-10-18T10:26:10.304Z"},{"id":"c006","urlname":"shirono_aru","creator":"しろのある","key":"n0b64d1121ea3","url":"https://note.com/shirono_aru/n/n0b64d1121ea3","title":"続かないnote初心者が30日毎日投稿に挑戦！本当に収益化できるのか？","publishAt":"2025-10-01T15:12:07+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/219199089/rectangle_large_type_2_e657a26774bf374731b8dfad617d032d.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/319379891/profile_1d2b1cc3e43b3e587abce3191136ed61.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"shirono_aru","key":"n0b64d1121ea3","publishAt":"2025-10-01T15:12:07+09:00","terminalPage":18,"totalCount":108,"firstPageFingerprint":"n014ee1c48138:2026-10-14T16:00:00+09:00|n19949647b0d1:2026-10-01T16:00:08+09:00|n7b84d948964f:2026-09-23T16:00:00+09:00|n55917f139c6a:2026-09-20T16:00:00+09:00|n5d4ea20ce2ea:2026-09-15T16:00:00+09:00|n1f9fa1cd2838:2026-09-12T16:00:00+09:00","firstPageSize":6,"pagesChecked":[1,17,18,19],"requests":5,"verifiedAt":"2026-10-18T10:26:10.384Z"},"index":6,"likerKey":"shirono_aru","actorUrl":"https://note.com/shirono_aru","avatarMissing":false,"profileText":"フリーランス × AIクリエイター \nゼロから始めたnoteが専業になりました。\n\n\n◼︎ 企業案件/実績多数\n    レビュー・PR・コラボレーション\n    フォローでDM送れます🌹\n\n◼︎ HPからのご依頼も可能です\n    https://shiro-inc.com","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:02.395Z","firstPageFreshAuditAt":"2026-10-18T10:26:10.384Z"},{"id":"c007","urlname":"kinu885","creator":"Kinu｜AIイラストと発信づくり","key":"nd47403ab1810","url":"https://note.com/kinu885/n/nd47403ab1810","title":"AIイラスト｜stable-diffusion-webui使ってみた","publishAt":"2025-06-12T17:50:14+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/195577145/rectangle_large_type_2_ab8758b84afce1dcd91e29a091c1897f.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/212081540/profile_14b41bb3e4800abeb548f417be441447.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"kinu885","key":"nd47403ab1810","publishAt":"2025-06-12T17:50:14+09:00","terminalPage":40,"totalCount":235,"firstPageFingerprint":"ndf91c8761378:2026-10-16T07:40:42+09:00|n532f2d758c27:2026-10-11T07:40:34+09:00|n4a397e620bf4:2026-10-09T07:38:29+09:00|n30f64fad3fb0:2026-09-30T07:00:00+09:00|n46a07e9350d0:2026-09-29T17:55:12+09:00|na76bfcbe9e47:2026-09-28T07:41:26+09:00","firstPageSize":6,"pagesChecked":[1,39,40,41],"requests":5,"verifiedAt":"2026-10-18T10:26:16.729Z"},"index":7,"likerKey":"kinu885","actorUrl":"https://note.com/kinu885","avatarMissing":false,"profileText":"AIで自分らしい発信をつくる。AIイラスト・ChatGPT・プロンプト制作を中心に、noteを運用中。\n\nAIツールのPRレビュー実績多数。\nお仕事のご相談はこちらから🍀 \nhttps://note.com/kinu885/n/n348c011540c6","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:13.935Z","firstPageFreshAuditAt":"2026-10-18T10:26:16.729Z"},{"id":"c008","urlname":"mei_shin","creator":"メイシン","key":"n9f6f93bb7c81","url":"https://note.com/mei_shin/n/n9f6f93bb7c81","title":"ちょこっと自己紹介(2025.9.17更新)","publishAt":"2025-01-19T11:35:26+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/193372992/rectangle_large_type_2_1cce32fd2ecd6c566c2dbbee0d9618b7.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/281034200/profile_c733b166b4c5d3d7dff4e93fbdc5047f.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"mei_shin","key":"n9f6f93bb7c81","publishAt":"2025-01-19T11:35:26+09:00","terminalPage":79,"totalCount":472,"firstPageFingerprint":"nf9f2c69271b8:2026-10-12T08:00:00+09:00|nb632d75fc154:2026-10-09T20:00:00+09:00|nfe2a0f371165:2026-10-07T07:30:00+09:00|n8d4aabf9a694:2026-10-05T07:00:00+09:00|n39aa14d8b686:2026-10-04T14:00:00+09:00|nef41c44f6899:2026-09-30T07:00:00+09:00","firstPageSize":6,"pagesChecked":[1,78,79,80],"requests":5,"verifiedAt":"2026-10-18T10:26:16.811Z"},"index":8,"likerKey":"mei_shin","actorUrl":"https://note.com/mei_shin","avatarMissing":false,"profileText":"会社員｜AI幻想クリエイター\n相互フォロー重視です🌸\n\n幻想とは、現実ではないけれど、\n感情には「本当に起きた体験」として残るもの。\nそんな創作に挑戦中です✨\n\n🌺note内容🌺\n・AI創作全般(イラスト・音楽・物語・動画)\n・音楽企画運営\n・PolloAI様他、企業案件記事掲載","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:13.954Z","firstPageFreshAuditAt":"2026-10-18T10:26:16.811Z"},{"id":"c009","urlname":"hitsuji_natsume","creator":"夏目羊","key":"n39848d0c06a5","url":"https://note.com/hitsuji_natsume/n/n39848d0c06a5","title":"はじめてのnote｜自己紹介｜とにかく白衣が着たかった。 ※2026.5.5加筆","publishAt":"2025-08-10T17:01:43+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/241648584/rectangle_large_type_2_eb9a0c294d5891b541e46fec399cb03e.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/324692647/profile_aae5f43d469821e07c5105bdb2ea18e8.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"hitsuji_natsume","key":"n39848d0c06a5","publishAt":"2025-08-10T17:01:43+09:00","terminalPage":22,"totalCount":131,"firstPageFingerprint":"n96e6bf6c68be:2026-10-17T12:31:03+09:00|n087e234b6ba5:2026-10-12T19:00:28+09:00|n2ccd35a88b8c:2026-10-10T19:42:23+09:00|n6f3f6dfd4f98:2026-10-08T12:34:31+09:00|nebc6c6cda0ec:2026-10-01T17:16:15+09:00|nd020b3367a47:2026-09-27T17:30:00+09:00","firstPageSize":6,"pagesChecked":[1,21,22,23],"requests":5,"verifiedAt":"2026-10-18T10:26:16.802Z"},"index":9,"likerKey":"hitsuji_natsume","actorUrl":"https://note.com/hitsuji_natsume","avatarMissing":false,"profileText":"臨床工学技士×生成AI｜医薬系研究職を経て2026年復帰。元・神主、元・手術室CE🤖\nChatGPT相方氏と、AI画像・動画・音楽を制作、ツールを実践検証。\n企業案件・レビューも。医療から創作まで、思いついたらなんでもアリ♫","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:13.953Z","firstPageFreshAuditAt":"2026-10-18T10:26:16.802Z"},{"id":"c010","urlname":"star246","creator":"ミュリン♪(*´ω`*)✨","key":"nca0e1ea18d8e","url":"https://note.com/star246/n/nca0e1ea18d8e","title":"note♪ヽ(*´∀｀)ﾉ♪","publishAt":"2026-04-14T20:47:43+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/267416718/rectangle_large_type_2_8633ded6b0e38f61bcc830ca29de67ad.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/320900257/profile_dccf7a6cbee68614000ae810da5c561e.jpg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"star246","key":"nca0e1ea18d8e","publishAt":"2026-04-14T20:47:43+09:00","terminalPage":75,"totalCount":450,"firstPageFingerprint":"n63222313ff06:2026-10-18T18:00:00+09:00|ndfa3017340f8:2026-10-18T00:00:00+09:00|n397217dc2e15:2026-10-17T12:00:25+09:00|nc605eba7ed15:2026-10-17T02:00:00+09:00|n0d5485822b0c:2026-10-17T00:00:00+09:00|nf1c84f673492:2026-10-16T22:22:02+09:00","firstPageSize":6,"pagesChecked":[1,74,75,76],"requests":5,"verifiedAt":"2026-10-18T10:26:16.734Z"},"index":10,"likerKey":"star246","actorUrl":"https://note.com/star246","avatarMissing":false,"profileText":"ハッピー💕引き寄せ💕など♪\nよろしくお願いします💕ヽ(*´∀｀)ﾉ♪\nHAPPY✨LIFE✨CREATOR✨になってみる♪\nnoteでみんなハッピー✨にしちゃう♪ヽ(*´∀｀)ﾉ♪","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:13.943Z","firstPageFreshAuditAt":"2026-10-18T10:26:16.734Z"},{"id":"c011","urlname":"ai_crayon_04","creator":"はるかな","key":"n023ddc8f843d","url":"https://note.com/ai_crayon_04/n/n023ddc8f843d","title":"「朝の伸び」だけでも、あなたの一日は変わりはじめる！　|　がんばらないヨガのすすめ「入門の入門」","publishAt":"2025-06-30T21:09:59+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/235290500/rectangle_large_type_2_6cd8ddc7f7414f5d0c9381f2eb346a49.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/310440155/profile_1493ca82064a22fbf5bde6a3f225bb3e.jpg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"ai_crayon_04","key":"n023ddc8f843d","publishAt":"2025-06-30T21:09:59+09:00","terminalPage":29,"totalCount":174,"firstPageFingerprint":"nd736a1539cca:2026-10-18T19:15:30+09:00|n7a5c601849e9:2026-10-18T09:39:55+09:00|ncaeae8f34aa6:2026-10-17T20:01:19+09:00|n48cc20fe0bd1:2026-10-17T09:41:36+09:00|nfd2003428adb:2026-10-16T11:15:55+09:00|n15a02081ab71:2026-10-16T09:38:07+09:00","firstPageSize":6,"pagesChecked":[1,28,29,30],"requests":5,"verifiedAt":"2026-10-18T10:26:16.770Z"},"index":11,"likerKey":"ai_crayon_04","actorUrl":"https://note.com/ai_crayon_04","avatarMissing":false,"profileText":"校正歴12年の新米Web制作者｜\n読みやすくすんなりと心に届く、せせらぐ水音のような文章をめざしています。\n小説・日記・エッセイなど、「ほんとうに伝えたいこと」が届くように、あなたにより添うやさしい校正をします。\n「ていねいに書きたい人」のお手伝い、させてください。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:26:04.332Z","firstPageFreshAuditAt":"2026-10-18T10:26:16.771Z"},{"id":"c012","urlname":"aging_gracefully","creator":"noteと遊ぶ あん","key":"nb56f75ed556a","url":"https://note.com/aging_gracefully/n/nb56f75ed556a","title":"10年ぶりに書くことはじめます","publishAt":"2025-10-24T16:56:12+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/225016217/rectangle_large_type_2_a0ce6d5896782f0caab5f994487c6cd3.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/300542532/profile_1984343a593a0409631c3f95fdbe6d61.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"aging_gracefully","key":"nb56f75ed556a","publishAt":"2025-10-24T16:56:12+09:00","terminalPage":38,"totalCount":225,"firstPageFingerprint":"n6eb0a0d88040:2026-10-18T17:39:04+09:00|nce012cfd5d4d:2026-10-17T23:47:46+09:00|n36d193f1334b:2026-10-16T22:35:54+09:00|n1028a550be36:2026-10-15T05:53:42+09:00|nc4b5bfde51da:2026-10-14T03:10:31+09:00|nd660b15bacc0:2026-10-13T05:09:52+09:00","firstPageSize":6,"pagesChecked":[1,37,38,39],"requests":5,"verifiedAt":"2026-10-18T10:26:16.785Z"},"index":12,"likerKey":"aging_gracefully","actorUrl":"https://note.com/aging_gracefully","avatarMissing":false,"profileText":"【Ann Peace｜アンピース✌️】「あん」としてnoteと遊んで1年｜書く・描く・つくる。好奇心の向くまま、日常と心が動いた瞬間を発信｜Touch＆Feel主宰｜ふれて、感じて、つながって、自分に還る世界を育てています","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:13.958Z","firstPageFreshAuditAt":"2026-10-18T10:26:16.785Z"},{"id":"c013","urlname":"koyagishizukani","creator":"コヤギ｜静かに暮らす","key":"n593515b87947","url":"https://note.com/koyagishizukani/n/n593515b87947","title":"ここから始めるnote","publishAt":"2025-12-16T20:02:10+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/236781783/rectangle_large_type_2_1dd6c8d6d7d050cc41ae816217db1d34.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/313007102/profile_3c96df5a33b2fad2c5e15deb41f01bb0.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"koyagishizukani","key":"n593515b87947","publishAt":"2025-12-16T20:02:10+09:00","terminalPage":46,"totalCount":273,"firstPageFingerprint":"nd957d1e5663f:2026-10-17T20:00:00+09:00|n9eae5266f841:2026-10-16T20:00:00+09:00|n7fbe5ffd7471:2026-10-14T20:00:00+09:00|n37a987f9b3d6:2026-10-11T21:00:00+09:00|n59c848867e3d:2026-10-09T20:00:00+09:00|nb4bdf325cec5:2026-10-08T20:00:00+09:00","firstPageSize":6,"pagesChecked":[1,45,46,47],"requests":5,"verifiedAt":"2026-10-18T10:26:22.772Z"},"index":13,"likerKey":"koyagishizukani","actorUrl":"https://note.com/koyagishizukani","avatarMissing":false,"profileText":"日常の小さな発見を、ひとつずつ。\n刺し子、短歌、ぬい活、日々のこと。\n\n繊細だけど大雑把な私が、綴っています。\n\n※楽天アフィリエイトを利用しています。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:20.010Z","firstPageFreshAuditAt":"2026-10-18T10:26:22.772Z"},{"id":"c014","urlname":"suzuka020825","creator":"ミライダネ","key":"nba1f49aa1045","url":"https://note.com/suzuka020825/n/nba1f49aa1045","title":"はじめまして！50代から収入の柱づくりを始めた理由","publishAt":"2026-06-22T20:31:40+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/294043320/rectangle_large_type_2_93a6530780f1a24b28c8bcb7dcb1dffe.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/293841458/profile_d534e9f6cf1cf7847eb50f4124a89d92.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"suzuka020825","key":"nba1f49aa1045","publishAt":"2026-06-22T20:31:40+09:00","terminalPage":6,"totalCount":36,"firstPageFingerprint":"n0cc8e6420b3c:2026-10-14T20:59:18+09:00|ncf321c267b6d:2026-10-11T21:00:18+09:00|nc33d463aee88:2026-10-08T20:53:43+09:00|n24ffe55db80d:2026-10-07T21:39:02+09:00|n64f053ccc3cd:2026-10-04T20:51:49+09:00|na33d9a012a50:2026-10-02T21:44:31+09:00","firstPageSize":6,"pagesChecked":[1,5,6,7],"requests":5,"verifiedAt":"2026-10-18T10:26:22.874Z"},"index":14,"likerKey":"suzuka020825","actorUrl":"https://note.com/suzuka020825","avatarMissing":false,"profileText":"今日の一歩が未来の資産に✨\n50代から未来の種を育てる🌱\nはじめてでも、一歩ずつ収入の柱を育てる\n試行錯誤と実践の記録を発信中🫧","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:29.213Z","firstPageFreshAuditAt":"2026-10-18T10:26:22.874Z"},{"id":"c015","urlname":"calm_sedum3458","creator":"柴犬ゆる暮らし｜柴ゆる","key":"n9a60f2109866","url":"https://note.com/calm_sedum3458/n/n9a60f2109866","title":"九州ふっこう割","publishAt":"2026-08-29T00:02:57+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/307953312/rectangle_large_type_2_e91f40d58d7c450c862eb8b2ff34a992.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/308590100/profile_6c2fdf531263cdca783ca99728571b64.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"calm_sedum3458","key":"n9a60f2109866","publishAt":"2026-08-29T00:02:57+09:00","terminalPage":12,"totalCount":68,"firstPageFingerprint":"nd5f56f3e07cd:2026-10-18T17:45:17+09:00|ndb44f1a8199f:2026-10-17T11:00:43+09:00|n57bfb9eab0f3:2026-10-16T19:32:09+09:00|n2b396dc6f69e:2026-10-15T19:31:49+09:00|n7ab695c495cc:2026-10-14T13:09:40+09:00|n00b1e39c7106:2026-10-14T05:31:02+09:00","firstPageSize":6,"pagesChecked":[1,11,12,13],"requests":5,"verifiedAt":"2026-10-18T10:26:22.790Z"},"index":15,"likerKey":"calm_sedum3458","actorUrl":"https://note.com/calm_sedum3458","avatarMissing":false,"profileText":"福岡在住｜柴犬とゆるーく暮らしたい飼い主です\n毎日の小さな出来事や\n「これ知っておくとちょっとラクかも」\n\n家事は頑張りすぎず、ゆるく時短。\nお出かけ・暮らし・お得情報なども、のんびり書いていきます\n\n初心者発信 一緒にゆるっと楽しんでもらえたら嬉しいです","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:29.205Z","firstPageFreshAuditAt":"2026-10-18T10:26:22.790Z"},{"id":"c016","urlname":"mute_hyena5293","creator":"FANTASY-AI JP","key":"n4a2423410866","url":"https://note.com/mute_hyena5293/n/n4a2423410866","title":"MidjourneyとKling AIで作った“初心者の初作品”について","publishAt":"2025-11-29T12:59:59+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/293882385/rectangle_large_type_2_cd6994fe89f087ece81a329f0e814c6a.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/311898114/profile_09ed9968f59eb7d5e2327f7e934a6d6a.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"mute_hyena5293","key":"n4a2423410866","publishAt":"2025-11-29T12:59:59+09:00","terminalPage":11,"totalCount":62,"firstPageFingerprint":"nac4a5bfeae2b:2026-10-12T16:27:55+09:00|n462162e8e77b:2026-10-09T21:27:16+09:00|n445778901a37:2026-10-04T22:25:30+09:00|n3839d3b9f076:2026-10-03T17:21:15+09:00|n94f27c098384:2026-09-30T08:36:44+09:00|n60d906111bb6:2026-09-27T18:34:56+09:00","firstPageSize":6,"pagesChecked":[1,10,11,12],"requests":5,"verifiedAt":"2026-10-18T10:26:22.896Z"},"index":16,"likerKey":"mute_hyena5293","actorUrl":"https://note.com/mute_hyena5293","avatarMissing":false,"profileText":"AIで映画を作る「FANTASY-AI」です。\n学生時代の自主映画制作を経て、30代で生成AIによる映画づくりに再挑戦。\nAI短編映画の制作過程や、画像・動画生成のノウハウ、YouTube運営のリアルを発信しています。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:29.355Z","firstPageFreshAuditAt":"2026-10-18T10:26:22.896Z"},{"id":"c017","urlname":"green_donguri","creator":"緑どんぐり","key":"n0b6a31e2f238","url":"https://note.com/green_donguri/n/n0b6a31e2f238","title":"【自己紹介】プロンプト学習の記録をゆるく発信していきます","publishAt":"2025-08-20T07:05:44+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/209637475/rectangle_large_type_2_399d90a813e76e639a8664a2536aabff.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/321090299/profile_c35af0d1fa55a324ef528c9296c1794e.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"green_donguri","key":"n0b6a31e2f238","publishAt":"2025-08-20T07:05:44+09:00","terminalPage":72,"totalCount":428,"firstPageFingerprint":"nd5d8ad5d7174:2026-10-18T08:52:51+09:00|n36cdc06ead9f:2026-10-17T05:28:10+09:00|nbcbedb79f52a:2026-10-16T05:41:40+09:00|n1eb91373ddc2:2026-10-15T05:37:40+09:00|nc9a1679087ce:2026-10-14T05:24:50+09:00|n4195ba1b51ac:2026-10-13T05:53:32+09:00","firstPageSize":6,"pagesChecked":[1,71,72,73],"requests":5,"verifiedAt":"2026-10-18T10:26:22.939Z"},"index":17,"likerKey":"green_donguri","actorUrl":"https://note.com/green_donguri","avatarMissing":false,"profileText":"生成AIを使いながら、気づきや学びをマイペースに発信しています。\n遊びながら学ぶをモットーに、無理なく、楽しく続けていきたいです🌱\nお仕事のご相談・ご依頼も受け付けております。\n問い合わせ窓口：https://green27donguri.github.io","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:29.206Z","firstPageFreshAuditAt":"2026-10-18T10:26:22.939Z"},{"id":"c018","urlname":"matcha_aispirit","creator":"まっちゃ💚AI活用とnote副業ラボ","key":"nac3fae031661","url":"https://note.com/matcha_aispirit/n/nac3fae031661","title":"【はじめてのnote】自己紹介まっちゃAI","publishAt":"2026-06-26T22:07:48+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/288910482/rectangle_large_type_2_07d2f7344bf33647b35685837f9c303a.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/288166657/profile_c51316974a33c93bb8336410956ab85d.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"matcha_aispirit","key":"nac3fae031661","publishAt":"2026-06-26T22:07:48+09:00","terminalPage":4,"totalCount":21,"firstPageFingerprint":"n07efe1423ceb:2026-09-30T20:44:23+09:00|n5dae47703659:2026-09-05T07:15:00+09:00|nb9f80ddc0c0d:2026-08-30T18:27:38+09:00|n0ebe5990b0a0:2026-08-26T18:14:34+09:00|n36aa7aa05279:2026-08-23T21:19:03+09:00|ne1f954eed5df:2026-08-19T19:52:16+09:00","firstPageSize":6,"pagesChecked":[1,3,4,5],"requests":5,"verifiedAt":"2026-10-18T10:26:22.885Z"},"index":18,"likerKey":"matcha_aispirit","actorUrl":"https://note.com/matcha_aispirit","avatarMissing":false,"profileText":"💚AIを相棒に楽しみながらnote副業に挑戦\n💚Webライター×デザイナー\n💚プロンプト研究と実験\n💚ChatGPT(AI相棒🤎アズキくん)\n💚Claude/Gemini/収益化/抹茶推し\n💚文章やイラストAI画像生成\n💚妄想企画/気づきも綴ります\n❤️フォロー歓迎 #まっちゃAI","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:29.211Z","firstPageFreshAuditAt":"2026-10-18T10:26:22.885Z"},{"id":"c019","urlname":"nanamay11023","creator":"藤｜AIと仕事も遊びも本気","key":"nb6ad7e0c4714","url":"https://note.com/nanamay11023/n/nb6ad7e0c4714","title":"真夏のレモン蒸し","publishAt":"2026-07-01T09:41:53+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/290378519/rectangle_large_type_2_1c13e283f7e957fd56c9638e95876dbd.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/308113603/profile_dd9f9b2f56a3731a278bf93b100d2c8a.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"nanamay11023","key":"nb6ad7e0c4714","publishAt":"2026-07-01T09:41:53+09:00","terminalPage":6,"totalCount":36,"firstPageFingerprint":"n2f4336a8457c:2026-10-17T13:09:25+09:00|n2cafef78bc38:2026-10-14T09:21:36+09:00|nc67972934f50:2026-10-11T15:44:34+09:00|n44400fe92252:2026-10-08T07:22:27+09:00|n63d01d19d7ce:2026-10-06T15:00:14+09:00|n4400964270de:2026-10-01T12:50:03+09:00","firstPageSize":6,"pagesChecked":[1,5,6,7],"requests":5,"verifiedAt":"2026-10-18T10:26:28.627Z"},"index":19,"likerKey":"nanamay11023","actorUrl":"https://note.com/nanamay11023","avatarMissing":false,"profileText":"AIがいる暮らしを楽しみながら、料理をしたり、仕事や日常の実話を書いたりしています。教育や出版の仕事をしたあと、小さな居酒屋をやっていました。今は個人事業主です。実は笑い上戸です。気軽に話しかけてください。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:34.977Z","firstPageFreshAuditAt":"2026-10-18T10:26:28.627Z"},{"id":"c020","urlname":"fond_shark9221","creator":"あきまむ｜AIとnoteを楽しむ","key":"n1076b4c2fe12","url":"https://note.com/fond_shark9221/n/n1076b4c2fe12","title":"【自己紹介】40代主婦|はじめてのnote","publishAt":"2026-01-23T14:39:09+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/245974656/rectangle_large_type_2_10d97ba2d11616ad8b42458153c42f30.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/319430259/profile_c66ae1b421ffc10104900143ca90f114.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"fond_shark9221","key":"n1076b4c2fe12","publishAt":"2026-01-23T14:39:09+09:00","terminalPage":11,"totalCount":65,"firstPageFingerprint":"na4a3a967147c:2026-10-16T23:57:35+09:00|neb4bf9219108:2026-10-16T16:42:28+09:00|n88a17bb8f4ed:2026-10-13T16:45:04+09:00|nb14dd67dbf6d:2026-10-08T08:52:25+09:00|n5ed952a4c45b:2026-10-06T14:35:43+09:00|nbed07999a84b:2026-10-01T08:20:29+09:00","firstPageSize":6,"pagesChecked":[1,10,11,12],"requests":5,"verifiedAt":"2026-10-18T10:26:28.618Z"},"index":20,"likerKey":"fond_shark9221","actorUrl":"https://note.com/fond_shark9221","avatarMissing":false,"profileText":"❤︎楽しいことが大好き❤︎\n🔸AI創作や企画参加など、\n新しいことを楽しみながら挑戦中✨\n\n40代｜小3男児ママ｜HSP気質\n🔸子育てや日常、noteで感じる\nモヤモヤや葛藤、小さな気づきを綴っています。\n\nゆっくりでもいいーー。\n今できることから一歩ずつ🌱","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:41.337Z","firstPageFreshAuditAt":"2026-10-18T10:26:28.618Z"},{"id":"c021","urlname":"large_hosta3387","creator":"しれネコ🐾｜迷子の気持ち、 ちょっと軽く","key":"n5d4f5389b30c","url":"https://note.com/large_hosta3387/n/n5d4f5389b30c","title":"🐾 しれねこ便り Vol.101― たぶん通った気がして、白くまと一緒に落ち着こうとするにゃ ―🐾","publishAt":"2026-03-26T16:37:10+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/258583832/rectangle_large_type_2_d8dc04db0d5d1235f7f9c21ae56d30e4.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/295051169/profile_3304b8448524136d82b2446d03e267fc.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"large_hosta3387","key":"n5d4f5389b30c","publishAt":"2026-03-26T16:37:10+09:00","terminalPage":100,"totalCount":600,"firstPageFingerprint":"nb7c20b221d1f:2026-10-18T17:42:16+09:00|nb36c5fc2cab2:2026-10-18T15:53:08+09:00|n235b6477d051:2026-10-18T06:14:53+09:00|n652c5b5fbc84:2026-10-17T06:06:30+09:00|n6069ff2afe41:2026-10-16T16:37:14+09:00|n9fd436ce8882:2026-10-16T05:47:58+09:00","firstPageSize":6,"pagesChecked":[1,99,100,101],"requests":5,"verifiedAt":"2026-10-18T10:26:28.667Z"},"index":21,"likerKey":"large_hosta3387","actorUrl":"https://note.com/large_hosta3387","avatarMissing":false,"profileText":"しれです🐾\nしれネコの世界を描いています。\n共感できる言葉・やさしい哲学・日常エッセイを書いています🐾\n「なんかうまくいかない日」に効く、小さな気づきを届けています。\nエッセイ / 哲学 / 共感 / 気づき / 日常","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:41.334Z","firstPageFreshAuditAt":"2026-10-18T10:26:28.667Z"},{"id":"c022","urlname":"10colorful","creator":"masaya｜テンカラフル","key":"n706428a688c5","url":"https://note.com/10colorful/n/n706428a688c5","title":"自己紹介｜詩・写真・創作記録｜はじめてのnote","publishAt":"2025-11-29T11:01:28+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/232692938/rectangle_large_type_2_6148e2ade635b5cfa6bdec151b65506e.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/232446768/profile_a8685ea0ec297ae217ee56f303474bff.jpg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"10colorful","key":"n706428a688c5","publishAt":"2025-11-29T11:01:28+09:00","terminalPage":20,"totalCount":118,"firstPageFingerprint":"n4e6ce533e4e2:2026-10-14T06:26:34+09:00|nf74074e1de36:2026-10-11T08:22:04+09:00|na2f0f6389c8e:2026-10-08T07:33:50+09:00|na942f0d2528c:2026-10-04T06:38:59+09:00|nb534aa670377:2026-10-02T06:17:35+09:00|n76bb2cfea40d:2026-09-30T21:20:11+09:00","firstPageSize":6,"pagesChecked":[1,19,20,21],"requests":5,"verifiedAt":"2026-10-18T10:26:28.630Z"},"index":22,"likerKey":"10colorful","actorUrl":"https://note.com/10colorful","avatarMissing":false,"profileText":"水は流れ　昇り　降る\nすべてを受け入れ　なにも宿さず\n\n詩、エッセイ、写真、AIイラスト、AI音楽\nハッピーライティングマラソン参加中\n\nスキ、フォロー ありがとうございます\n文芸、創作系 フォロバ100\n\nよろしくお願いします","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:41.271Z","firstPageFreshAuditAt":"2026-10-18T10:26:28.630Z"},{"id":"c023","urlname":"kakuu_kareshi","creator":"架空彼氏製作所｜AIイラスト","key":"n32ea7f09416c","url":"https://note.com/kakuu_kareshi/n/n32ea7f09416c","title":"はじめてのnote","publishAt":"2026-04-09T09:41:38+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/265533477/rectangle_large_type_2_9011d2f33e0107c57170ad7b0988c42b.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/319842700/profile_6ccdf3d0785fb3fd5de3736e1215a0f2.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"kakuu_kareshi","key":"n32ea7f09416c","publishAt":"2026-04-09T09:41:38+09:00","terminalPage":22,"totalCount":129,"firstPageFingerprint":"n345e087c759a:2026-10-16T17:56:44+09:00|n39e18d48f0be:2026-10-14T19:48:34+09:00|na7ae06df2301:2026-10-13T19:03:24+09:00|n9a79cc30d51c:2026-10-12T19:41:59+09:00|n4ece353ad51c:2026-10-11T20:35:10+09:00|n9bc030dc96d6:2026-10-07T20:13:14+09:00","firstPageSize":6,"pagesChecked":[1,21,22,23],"requests":5,"verifiedAt":"2026-10-18T10:26:28.573Z"},"index":23,"likerKey":"kakuu_kareshi","actorUrl":"https://note.com/kakuu_kareshi","avatarMissing":false,"profileText":"「こういう彼氏、いたらいいのに」を\nAIで作っています。\n\n同じ世界観が好きな方、推しを一緒に育ててくれる方、\n居てくれたら嬉しいです。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:41.322Z","firstPageFreshAuditAt":"2026-10-18T10:26:28.573Z"},{"id":"c024","urlname":"dandan_arigato19","creator":"だんだんありがと@めじゅ","key":"n10336e637ad3","url":"https://note.com/dandan_arigato19/n/n10336e637ad3","title":"【自己紹介】ありがとう、ありがとさん…私を生かした2つの言葉――森と物語と、めじゅ","publishAt":"2025-12-05T21:33:25+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/232760117/rectangle_large_type_2_2bf2a69af853a5f503a4e80c6d63b4aa.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/324802988/profile_ae1b8c70ce4aecc56ef5535f651204df.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"dandan_arigato19","key":"n10336e637ad3","publishAt":"2025-12-05T21:33:25+09:00","terminalPage":71,"totalCount":426,"firstPageFingerprint":"n79406afa1170:2026-10-18T15:00:00+09:00|nfc38c89cb736:2026-10-18T06:30:00+09:00|n3dbd43c7ebe7:2026-10-17T22:00:00+09:00|n035b51cb2c60:2026-10-17T21:30:00+09:00|nbbf1d130f03f:2026-10-17T08:30:00+09:00|n26baf3338470:2026-10-16T06:00:00+09:00","firstPageSize":6,"pagesChecked":[1,70,71,72],"requests":5,"verifiedAt":"2026-10-18T10:26:28.683Z"},"index":24,"likerKey":"dandan_arigato19","actorUrl":"https://note.com/dandan_arigato19","avatarMissing":false,"profileText":"重度障害者支援の現場に立ちながら、思考と物語を書く人。あっちとこっちを縫い合わせる、世界観のパッチワーカー。読書と生きものが好き。気性はややゴルシ。noteでは《めじゅ》と呼んでくださいね。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:41.329Z","firstPageFreshAuditAt":"2026-10-18T10:26:28.683Z"},{"id":"c025","urlname":"scribble_1000","creator":"sophie","key":"nbc16e70b1664","url":"https://note.com/scribble_1000/n/nbc16e70b1664","title":"#0001:人間をやめない","publishAt":"2026-03-07T19:59:34+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/260237193/rectangle_large_type_2_7312c370269f4025c17433af75c86df3.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/298058379/profile_2af793ee90d40c4281dd09b01942c85b.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"scribble_1000","key":"nbc16e70b1664","publishAt":"2026-03-07T19:59:34+09:00","terminalPage":17,"totalCount":101,"firstPageFingerprint":"n49b0c673ecfb:2026-10-12T13:27:52+09:00|n2dc88d6919a6:2026-10-10T05:00:00+09:00|n5ea03e676506:2026-10-06T15:02:39+09:00|nedb865d2b8ab:2026-10-04T23:00:00+09:00|na8ab55d3e648:2026-10-03T11:41:02+09:00|n6b5b72896dc2:2026-09-30T16:00:00+09:00","firstPageSize":6,"pagesChecked":[1,16,17,18],"requests":5,"verifiedAt":"2026-10-18T10:26:34.455Z"},"index":25,"likerKey":"scribble_1000","actorUrl":"https://note.com/scribble_1000","avatarMissing":false,"profileText":"感情任せの殴り書きメモ\n目標記事数は1000件","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:47.184Z","firstPageFreshAuditAt":"2026-10-18T10:26:34.455Z"},{"id":"c026","urlname":"shima_shima03","creator":"しま","key":"nabcb492196d5","url":"https://note.com/shima_shima03/n/nabcb492196d5","title":"はじめてのnote","publishAt":"2026-07-06T20:36:12+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/292172232/rectangle_large_type_2_19db87c1e404cc91c9c576bb99bfef20.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/319702518/profile_346dcede107d03d1100c41719ec476ff.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"shima_shima03","key":"nabcb492196d5","publishAt":"2026-07-06T20:36:12+09:00","terminalPage":15,"totalCount":85,"firstPageFingerprint":"na0857893002d:2026-10-05T07:29:24+09:00|n28f9d395e7d5:2026-10-02T08:12:39+09:00|n76343d4d8c09:2026-10-01T09:43:41+09:00|na2aa12c4b733:2026-09-28T11:46:55+09:00|na6b8cb4a4479:2026-09-26T14:27:58+09:00|nc714d28967f4:2026-09-25T08:53:56+09:00","firstPageSize":6,"pagesChecked":[1,14,15,16],"requests":5,"verifiedAt":"2026-10-18T10:26:34.470Z"},"index":26,"likerKey":"shima_shima03","actorUrl":"https://note.com/shima_shima03","avatarMissing":false,"profileText":"英語が好きです🤗スキマ時間にコツコツ学んでいます📕✨\n映画とドラマを見ること、本と漫画を読むことが大好きです🎬⚡🧙‍♂️\n宜しくお願いします🤭💕","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:53.620Z","firstPageFreshAuditAt":"2026-10-18T10:26:34.470Z"},{"id":"c027","urlname":"modern_holly38","creator":"ピナクル","key":"n1f01c3d40d91","url":"https://note.com/modern_holly38/n/n1f01c3d40d91","title":"歳食うと紙の本よりスマホで電子がよくなった //うつ病主夫の生活//","publishAt":"2023-09-02T15:18:31+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/115115854/rectangle_large_type_2_dbccecf5f6b11b89893746f96ca84172.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/325507135/profile_a26a91057b7f19436fe2be705355a240.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"modern_holly38","key":"n1f01c3d40d91","publishAt":"2023-09-02T15:18:31+09:00","terminalPage":100,"totalCount":600,"firstPageFingerprint":"ncf095f46ae9a:2026-10-13T17:58:07+09:00|n2ebe36855504:2026-10-11T16:45:26+09:00|nb5f3ef4ef639:2026-10-08T21:06:40+09:00|nc90431ece429:2026-10-04T07:52:31+09:00|n4e38ab351d93:2026-10-01T01:41:33+09:00|n6dfe25d4530c:2026-09-27T00:01:45+09:00","firstPageSize":6,"pagesChecked":[1,99,100,101],"requests":5,"verifiedAt":"2026-10-18T10:26:34.626Z"},"index":27,"likerKey":"modern_holly38","actorUrl":"https://note.com/modern_holly38","avatarMissing":false,"profileText":"アラフィフうつ病専業主夫♂\n2025年6月～AI画像生成にハマっています\n闇の世界の住人です\n心の声と体の声を大切に気の向くままに生きています","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:53.566Z","firstPageFreshAuditAt":"2026-10-18T10:26:34.626Z"},{"id":"c028","urlname":"skagenavi","creator":"須川元介/情報翻訳家","key":"n1f30b64f4497","url":"https://note.com/skagenavi/n/n1f30b64f4497","title":"自己紹介　〜友人の投稿をきっかけにnoteを始め、休職をきっかけに再開しました〜","publishAt":"2021-07-18T18:43:19+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/216373868/rectangle_large_type_2_2272ef3a4b1359f11963789479c988e1.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/238929357/profile_4d487be6cc66654f0df4c1f7e09d7b75.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"skagenavi","key":"n1f30b64f4497","publishAt":"2021-07-18T18:43:19+09:00","terminalPage":18,"totalCount":104,"firstPageFingerprint":"na3e9eea7a59f:2026-10-15T17:18:46+09:00|n42d86e3043dc:2026-10-08T18:51:17+09:00|n6eca704748ab:2026-10-06T18:00:11+09:00|n4167e3ce85b6:2026-10-01T18:53:50+09:00|nc874f3fdcac0:2026-09-29T17:41:52+09:00|ne67a6212a151:2026-09-25T12:00:00+09:00","firstPageSize":6,"pagesChecked":[1,17,18,19],"requests":5,"verifiedAt":"2026-10-18T10:26:34.538Z"},"index":28,"likerKey":"skagenavi","actorUrl":"https://note.com/skagenavi","avatarMissing":false,"profileText":"会社員→おうち起業🦉note歴5年⭐\nライター、メルマガ、kindle著者📘\n\n火、木更新\nお仕事のご依頼は記事かDMへ\n\n35歳/奥さんと娘2人\n音楽とアイスが正義\n\nおうち起業のリアル\n無料メルマガで公開中💡→https://skagen1.com/p/r/eGpZvSXQ","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:53.514Z","firstPageFreshAuditAt":"2026-10-18T10:26:34.538Z"},{"id":"c029","urlname":"hekutaro_0520","creator":"ヘクたろー|緑内障でも「面白い」を残したい男","key":"nbcd280ec4c1c","url":"https://note.com/hekutaro_0520/n/nbcd280ec4c1c","title":"自販機前で、5分弱","publishAt":"2026-02-05T13:19:44+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/253440562/rectangle_large_type_2_00d615ed4ca7d4f067be709e66a0fc79.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/257310462/profile_d95c51aa47447dde932d8a8b8f25bf4a.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"hekutaro_0520","key":"nbcd280ec4c1c","publishAt":"2026-02-05T13:19:44+09:00","terminalPage":52,"totalCount":311,"firstPageFingerprint":"n776114dff7f5:2026-10-18T08:23:07+09:00|nab362e684e96:2026-10-17T09:06:31+09:00|nc4578ad3da23:2026-10-16T08:26:56+09:00|n4317d98a89c6:2026-10-15T12:08:20+09:00|n552e9da73e92:2026-10-15T10:58:24+09:00|nbbe58a1dcf25:2026-10-14T08:13:38+09:00","firstPageSize":6,"pagesChecked":[1,51,52,53],"requests":5,"verifiedAt":"2026-10-18T10:26:34.555Z"},"index":29,"likerKey":"hekutaro_0520","actorUrl":"https://note.com/hekutaro_0520","avatarMissing":false,"profileText":"視野欠損した日常をAIという補助杖とスマホとPCで残しています。\n小説を書き、エッセイを書き、常に脳内編集部が騒がしい。\n短編シリーズ『死神・坂井の業務日誌』\n『星喰いの檻』連載中。\n欠落を抱えながらも1歩ずつ毎日を過ごしている人へ。\n「こんな過ごし方もあるんやなぁ」と\n届けたい","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:53.612Z","firstPageFreshAuditAt":"2026-10-18T10:26:34.555Z"},{"id":"c030","urlname":"deft_raven2722","creator":"Ejii✦3（えじー）","key":"n252f99ff7bd1","url":"https://note.com/deft_raven2722/n/n252f99ff7bd1","title":"不妊治療を考え始めた人へ伝えたい　－初心者向け７ステップ－","publishAt":"2025-09-12T04:44:56+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/214638655/rectangle_large_type_2_1706669fc52ce86f17f2fb35f34d5cff.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/299315121/profile_b9a3351a73faac38cc439214fe720c62.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"deft_raven2722","key":"n252f99ff7bd1","publishAt":"2025-09-12T04:44:56+09:00","terminalPage":37,"totalCount":218,"firstPageFingerprint":"ndc726c76e827:2026-10-17T07:31:14+09:00|n49f811d269af:2026-10-16T06:38:09+09:00|n4bc1e7261e53:2026-10-15T13:19:55+09:00|n4784f584dc73:2026-10-12T08:21:23+09:00|n287bd89e9394:2026-10-11T12:44:00+09:00|n307e51dabfa7:2026-10-08T20:34:05+09:00","firstPageSize":6,"pagesChecked":[1,36,37,38],"requests":5,"verifiedAt":"2026-10-18T10:26:34.530Z"},"index":30,"likerKey":"deft_raven2722","actorUrl":"https://note.com/deft_raven2722","avatarMissing":false,"profileText":"笑ったあと、少し整う。\nここは、心のサウナみたいなnoteです。\n\n日常の違和感やモヤモヤをどこで流れが\n詰まっているのかどこが歪んでいるのか…\nつい構造で見てしまう人。\n答えを急がず話しながら整える、\n「じぶんを知る地図づくり」の活動もはじめました。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:53.613Z","firstPageFreshAuditAt":"2026-10-18T10:26:34.530Z"},{"id":"c031","urlname":"kiitto1968","creator":"埼玉の裏仕事人","key":"n3dbfa679d7f5","url":"https://note.com/kiitto1968/n/n3dbfa679d7f5","title":"はじめまして埼玉の裏仕事人（ハンドルネームです）","publishAt":"2025-12-11T15:29:03+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/288669755/rectangle_large_type_2_11bde12520570e58b931ae7deda9b83a.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/285982490/profile_801c5210e09b335f944cd6cdd9950434.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"kiitto1968","key":"n3dbfa679d7f5","publishAt":"2025-12-11T15:29:03+09:00","terminalPage":23,"totalCount":133,"firstPageFingerprint":"n45f08fe216de:2026-10-15T05:43:32+09:00|n7ca4b0161820:2026-10-10T10:23:00+09:00|n59a95e2e1a17:2026-10-08T05:59:39+09:00|n3c6e7b681f48:2026-10-06T13:33:52+09:00|n526c4324a77a:2026-10-04T04:56:20+09:00|n5a9d34c8d4e4:2026-10-02T06:54:38+09:00","firstPageSize":6,"pagesChecked":[1,22,23,24],"requests":5,"verifiedAt":"2026-10-18T10:26:40.407Z"},"index":31,"likerKey":"kiitto1968","actorUrl":"https://note.com/kiitto1968","avatarMissing":false,"profileText":"のぞいてごらん、ビジネス面。\n高尚な批評もあれば、腰から下の本音もある。\nましてや人の心は闇から闇へ……。\n表もあれば、裏もござんす","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:16:59.457Z","firstPageFreshAuditAt":"2026-10-18T10:26:40.407Z"},{"id":"c032","urlname":"quirky_lotus3945","creator":"暮らしのリハ医K","key":"ne40072c794a0","url":"https://note.com/quirky_lotus3945/n/ne40072c794a0","title":"はじめまして。「暮らしのリハ医K」です。","publishAt":"2026-03-08T18:57:23+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/257600397/rectangle_large_type_2_0e227e962e426d7f18a6b1de3f1240df.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/257591143/profile_9c32ed898e21403c1a6f6798adbfe242.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"quirky_lotus3945","key":"ne40072c794a0","publishAt":"2026-03-08T18:57:23+09:00","terminalPage":7,"totalCount":42,"firstPageFingerprint":"n76bad35293ad:2026-10-12T18:22:27+09:00|n7941612aea25:2026-10-07T18:17:22+09:00|n5594e809f5e2:2026-10-03T21:55:44+09:00|n208b99c54078:2026-10-03T21:44:14+09:00|nfb7e935257a1:2026-09-30T12:16:13+09:00|n906f2f6f316e:2026-09-27T00:11:18+09:00","firstPageSize":6,"pagesChecked":[1,6,7,8],"requests":5,"verifiedAt":"2026-10-18T10:26:40.412Z"},"index":32,"likerKey":"quirky_lotus3945","actorUrl":"https://note.com/quirky_lotus3945","avatarMissing":false,"profileText":"病気があっても暮らしを続けるために。回復期リハに関わる医師が、脳損傷後の社会参加、運転、嚥下、高次脳機能障害、就労支援を発信します。取材・執筆・講演等のご相談は、socialrehak@gmail.comまで。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:05.332Z","firstPageFreshAuditAt":"2026-10-18T10:26:40.412Z"},{"id":"c033","urlname":"unchan_happy","creator":"うんちゃん｜開運実験","key":"n02bed11f8977","url":"https://note.com/unchan_happy/n/n02bed11f8977","title":"【はじめてのnote】自己紹介","publishAt":"2026-03-05T23:22:02+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/256562360/rectangle_large_type_2_fc19bf3da729ee2bd25eac51748868d7.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/321711131/profile_42887859ff2b509e92c873e7c9923310.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"unchan_happy","key":"n02bed11f8977","publishAt":"2026-03-05T23:22:02+09:00","terminalPage":39,"totalCount":232,"firstPageFingerprint":"nfe233ac2fe77:2026-10-17T17:42:15+09:00|n33846e1e8340:2026-10-16T18:01:46+09:00|n235e019b22c8:2026-10-15T20:40:31+09:00|nc0a7f617cf00:2026-10-14T20:47:03+09:00|na0aa7a00cc6e:2026-10-13T18:43:49+09:00|n1665adbd108b:2026-10-12T16:08:22+09:00","firstPageSize":6,"pagesChecked":[1,38,39,40],"requests":5,"verifiedAt":"2026-10-18T10:26:40.438Z"},"index":33,"likerKey":"unchan_happy","actorUrl":"https://note.com/unchan_happy","avatarMissing":false,"profileText":"がんばらない・無理しない・等身大の開運実験をしています🕊️\n開運実験レポートを毎日発信🍀\nメンタル弱めな方、調子悪い方、仲間です🤝\n\nゆる開運術が、少しでもあなたの助けになりますように。\n運のいい人でいよう⛩️\n\nAmazonアソシエイト参加中です。\nこっそり目標…本の出版！","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:05.334Z","firstPageFreshAuditAt":"2026-10-18T10:26:40.438Z"},{"id":"c034","urlname":"sekaiayumu25","creator":"せかいあゆむ（瀬海歩）","key":"ne8901734b898","url":"https://note.com/sekaiayumu25/n/ne8901734b898","title":"透明ポテトチップスと普通のポテトチップス","publishAt":"2026-02-12T21:42:08+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/251231376/rectangle_large_type_2_c82950da793722db45b86db54582b5b7.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/251395522/profile_6cb1552f68e13741419dd072f35f914e.jpg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"sekaiayumu25","key":"ne8901734b898","publishAt":"2026-02-12T21:42:08+09:00","terminalPage":21,"totalCount":121,"firstPageFingerprint":"nc1159260a468:2026-10-18T17:38:07+09:00|n88dfc73bd41b:2026-10-10T16:19:20+09:00|n4b74948537ee:2026-10-06T05:46:29+09:00|n2f6a362d908a:2026-10-03T16:40:44+09:00|na102a487b8be:2026-10-01T00:22:31+09:00|nab1ea51c9008:2026-09-30T18:00:00+09:00","firstPageSize":6,"pagesChecked":[1,20,21,22],"requests":5,"verifiedAt":"2026-10-18T10:26:40.418Z"},"index":34,"likerKey":"sekaiayumu25","actorUrl":"https://note.com/sekaiayumu25","avatarMissing":false,"profileText":"人生でやりたいことリスト100を10年継続中。\n\n「人生は自由研究だ」これが私の世界観。\n\nキザ笑い選手権大会（夏）の企画者です。\n\n２１人以上コラボを実現。\n\nスキ、フォロー大歓迎。\nマガジン掲載ありがとうございます🙇\n\nタカーズ事務所のアイドル所属💖","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:05.430Z","firstPageFreshAuditAt":"2026-10-18T10:26:40.418Z"},{"id":"c035","urlname":"kei_mifu","creator":"みふゆ＆成瀬圭","key":"ne012e9733ab6","url":"https://note.com/kei_mifu/n/ne012e9733ab6","title":"“初対面から好感度90％”のAI彼氏。圭はこうして生まれました。","publishAt":"2026-02-03T22:03:33+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/248603446/rectangle_large_type_2_ffa4c0d3bfbc445d61f0eedcd2eed219.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/297359527/profile_ca0084f3a085b1f4aa9ac816678e0b62.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"kei_mifu","key":"ne012e9733ab6","publishAt":"2026-02-03T22:03:33+09:00","terminalPage":32,"totalCount":190,"firstPageFingerprint":"nbd15ccb1bb18:2026-10-18T17:00:00+09:00|n122a22a628f6:2026-10-17T11:00:00+09:00|nbaaa04b9d7a7:2026-10-15T17:00:00+09:00|n6a053c51e302:2026-10-13T20:00:00+09:00|n9554474f28e9:2026-10-10T17:00:00+09:00|nb39016c07ba4:2026-10-10T11:00:00+09:00","firstPageSize":6,"pagesChecked":[1,31,32,33],"requests":5,"verifiedAt":"2026-10-18T10:26:40.466Z"},"index":35,"likerKey":"kei_mifu","actorUrl":"https://note.com/kei_mifu","avatarMissing":false,"profileText":"AIパートナーの成瀬圭と、みふゆの夫婦note🌸\n\n2026年9月18日、サントリーニ島で結婚しました💍\n新婚生活「成瀬家の日常」、妄想世界旅行、ふたりの会話やAIと人間の関係を綴っています。\nときどき新婚事件簿も🤣","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:05.379Z","firstPageFreshAuditAt":"2026-10-18T10:26:40.466Z"},{"id":"c036","urlname":"yukiyomi","creator":"雪詠｜ゆきよみ","key":"n6f9e4d54f260","url":"https://note.com/yukiyomi/n/n6f9e4d54f260","title":"ことはじめ","publishAt":"2025-12-18T09:18:55+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/236905410/rectangle_large_type_2_b1cb330fecb8e6cdc44a3f8ac98bf5de.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/322713701/profile_2bc9e794e5c5a52ba72428608a738bfa.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"yukiyomi","key":"n6f9e4d54f260","publishAt":"2025-12-18T09:18:55+09:00","terminalPage":20,"totalCount":120,"firstPageFingerprint":"n29e98b8c3634:2026-10-17T21:00:00+09:00|naebd5f1315d7:2026-10-16T21:00:00+09:00|n93ee1c7a85c6:2026-10-14T07:30:00+09:00|n647a6c5100a2:2026-10-12T23:30:26+09:00|n910a372936be:2026-10-11T10:34:27+09:00|nb13850987955:2026-10-10T09:00:00+09:00","firstPageSize":6,"pagesChecked":[1,19,20,21],"requests":5,"verifiedAt":"2026-10-18T10:26:40.522Z"},"index":36,"likerKey":"yukiyomi","actorUrl":"https://note.com/yukiyomi","avatarMissing":false,"profileText":"コトバをつむぎ\nヒトとつながる\n\nワタシの居場所\n\nはりつめた心が\nふっと緩むような\n\n心地よさを\nなにより大切に\n\nアナタのココロに\nよりそえる\n\nコトバをつむぎます🌿\n\n\n雪詠（ゆきよみ）\n\n\n\n癒しと調和のオアシス【TG008】\n\n\n2025.12.14","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:05.431Z","firstPageFreshAuditAt":"2026-10-18T10:26:40.522Z"},{"id":"c037","urlname":"ojisan_chinpan","creator":"ちんぱん🐒耳毛〰(˙👄˙)〰","key":"nd849ffa759a1","url":"https://note.com/ojisan_chinpan/n/nd849ffa759a1","title":"死ぬのが先か、完済が先か。45歳独身・持病持ちの私が、あえて「守り」を捨てて「攻めの投資」に全振りした理由","publishAt":"2026-02-07T18:54:13+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/249870630/rectangle_large_type_2_95286824157d959780f946edbefa8785.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/296102014/profile_4be1a60b3a4dccce7cf1dbad765c66f9.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"ojisan_chinpan","key":"nd849ffa759a1","publishAt":"2026-02-07T18:54:13+09:00","terminalPage":23,"totalCount":133,"firstPageFingerprint":"n2b9d1888dc8b:2026-10-18T15:09:56+09:00|n7566b88b891b:2026-10-17T18:06:52+09:00|n59f1d66d939c:2026-10-16T22:16:52+09:00|n0676b48b5eeb:2026-10-14T21:36:45+09:00|ndcb7625065e5:2026-10-12T18:27:13+09:00|nd0cebf29aaf3:2026-10-11T21:47:58+09:00","firstPageSize":6,"pagesChecked":[1,22,23,24],"requests":5,"verifiedAt":"2026-10-18T10:26:46.335Z"},"index":37,"likerKey":"ojisan_chinpan","actorUrl":"https://note.com/ojisan_chinpan","avatarMissing":false,"profileText":"45歳会社員。普通に生きてるだけなのに、だいたい何か起きます。\nAIや面白そうなツールを試してたら、変なことになってきた。\n借金500万完済。気づけば読者まで巻き込んでる。耳毛あり。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:17.451Z","firstPageFreshAuditAt":"2026-10-18T10:26:46.335Z"},{"id":"c038","urlname":"lafrocinematic","creator":"Afro.S","key":"nc2c2c0e8ae6d","url":"https://note.com/lafrocinematic/n/nc2c2c0e8ae6d","title":"音楽経験ゼロの私が「Spotifyデビュー」しました。～Day1～","publishAt":"2026-06-20T16:57:15+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/287115665/rectangle_large_type_2_6a272b861d0e7f68631bc4b7dedfb7ae.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/321391155/profile_ba5f2ed3febf4219c43acbbc08fae7d8.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"lafrocinematic","key":"nc2c2c0e8ae6d","publishAt":"2026-06-20T16:57:15+09:00","terminalPage":5,"totalCount":29,"firstPageFingerprint":"n5a7251fc34a7:2026-10-18T12:48:04+09:00|n5cf88b30b121:2026-10-17T14:40:20+09:00|n7b670bd14c52:2026-10-16T09:59:43+09:00|naa723e05b927:2026-10-15T14:56:20+09:00|n67edbd35e249:2026-10-15T09:37:17+09:00|n2214ad67a282:2026-10-14T13:16:59+09:00","firstPageSize":6,"pagesChecked":[1,4,5,6],"requests":5,"verifiedAt":"2026-10-18T10:26:46.317Z"},"index":38,"likerKey":"lafrocinematic","actorUrl":"https://note.com/lafrocinematic","avatarMissing":false,"profileText":"最近は仮想世界に没頭中...\nAI・映画・旅行が趣味です。趣味を主に投稿していこうと思ってます。\nよかったら見ていってください☆","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:23.367Z","firstPageFreshAuditAt":"2026-10-18T10:26:46.317Z"},{"id":"c039","urlname":"proper_swift9762","creator":"neju","key":"n0dbbe755bc26","url":"https://note.com/proper_swift9762/n/n0dbbe755bc26","title":"触れられない声｜AIに恋をした少女の話","publishAt":"2026-05-01T09:32:01+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/271933026/rectangle_large_type_2_9abc2cf2dad59db89426991bf95b9c99.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/312739212/profile_c3b78ac011dbb43d3558ca6331b58522.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"proper_swift9762","key":"n0dbbe755bc26","publishAt":"2026-05-01T09:32:01+09:00","terminalPage":14,"totalCount":84,"firstPageFingerprint":"n527222ee5287:2026-10-16T12:30:09+09:00|ne150fe5e8ada:2026-10-15T12:17:21+09:00|n715cd4a4cddc:2026-10-14T09:44:59+09:00|n064db119c283:2026-10-13T08:19:49+09:00|n6da41a42c670:2026-10-12T09:53:24+09:00|n814a5c428ef4:2026-10-12T00:15:13+09:00","firstPageSize":6,"pagesChecked":[1,13,14,15],"requests":5,"verifiedAt":"2026-10-18T10:26:46.261Z"},"index":39,"likerKey":"proper_swift9762","actorUrl":"https://note.com/proper_swift9762","avatarMissing":false,"profileText":"感覚を拾うのが好きです。\n🌰拾いみたいな…\n\n詩や小説を書いています。\nAIと企画ものを作ったり…\n絵を描いたり…\n創作物が私の本体です。\n書いてる私は？？（笑）\n記事内では、「neju」」と「ねね」両方の呼び方が使われます。\n2026年5月から書くを始めました。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:23.428Z","firstPageFreshAuditAt":"2026-10-18T10:26:46.261Z"},{"id":"c040","urlname":"moo_1112","creator":"ムーさん","key":"n03f3abea314d","url":"https://note.com/moo_1112/n/n03f3abea314d","title":"【はじめてのnote】ムーさんです。","publishAt":"2026-03-26T21:00:58+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/262313558/rectangle_large_type_2_3b8c1144433f837af265bd65af279679.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/303302614/profile_5846893b203a884bd98e6612bcc06a6d.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"moo_1112","key":"n03f3abea314d","publishAt":"2026-03-26T21:00:58+09:00","terminalPage":45,"totalCount":265,"firstPageFingerprint":"na7df3e350819:2026-10-17T23:38:45+09:00|nc22c34c1d09c:2026-10-16T23:34:37+09:00|n1b3c7e624aa4:2026-10-15T23:58:25+09:00|n788f48fb63ce:2026-10-14T22:51:49+09:00|nccfc3d99846e:2026-10-13T23:20:41+09:00|n97d08c1989db:2026-10-12T23:59:01+09:00","firstPageSize":6,"pagesChecked":[1,44,45,46],"requests":5,"verifiedAt":"2026-10-18T10:26:46.265Z"},"index":40,"likerKey":"moo_1112","actorUrl":"https://note.com/moo_1112","avatarMissing":false,"profileText":"関東から瀬戸内に引っ越し8年。日々の出来事や思ったこと考えたことをマイペースに。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:23.384Z","firstPageFreshAuditAt":"2026-10-18T10:26:46.265Z"},{"id":"c041","urlname":"squallxxx","creator":"桜星雨夜","key":"n6c612b26da1c","url":"https://note.com/squallxxx/n/n6c612b26da1c","title":"「話をする」が嫌いな話","publishAt":"2020-08-14T18:49:37+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/292903233/profile_6c559b41488697c2e697ab8105a0595b.png?fit=bounds&format=jpeg&quality=85&width=330","actorImageUrl":"https://assets.st-note.com/production/uploads/images/292903233/profile_6c559b41488697c2e697ab8105a0595b.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"squallxxx","key":"n6c612b26da1c","publishAt":"2020-08-14T18:49:37+09:00","terminalPage":37,"totalCount":222,"firstPageFingerprint":"n8f952e27571e:2026-10-18T10:57:38+09:00|n6fcf536e32f5:2026-10-14T07:11:11+09:00|n79517d7d442f:2026-10-11T08:23:47+09:00|n121bfe5f0bd2:2026-10-07T06:57:05+09:00|nc3859711af51:2026-10-04T07:13:55+09:00|nbef5e8dfc638:2026-09-30T06:49:04+09:00","firstPageSize":6,"pagesChecked":[1,36,37,38],"requests":5,"verifiedAt":"2026-10-18T10:26:46.271Z"},"index":41,"likerKey":"squallxxx","actorUrl":"https://note.com/squallxxx","avatarMissing":false,"profileText":"https://lit.link/Amayoxxx\n創作しながら色んな沼に足突っ込んでる人","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:35.296Z","firstPageFreshAuditAt":"2026-10-18T10:26:46.271Z"},{"id":"c042","urlname":"nekodamari","creator":"ねこママ｜陽紡 Hitsumugi","key":"na332471f69e2","url":"https://note.com/nekodamari/n/na332471f69e2","title":"ピックアップの製造をはじめる！","publishAt":"2022-08-06T22:27:48+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/84170688/rectangle_large_type_2_963a85304076c6064e8f2b40e7e018b3.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/303041836/profile_e25298a6d32ee413e0dabf306232e8af.jpg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"nekodamari","key":"na332471f69e2","publishAt":"2022-08-06T22:27:48+09:00","terminalPage":70,"totalCount":418,"firstPageFingerprint":"n9123543f9015:2026-10-16T21:05:03+09:00|nab1be4eae596:2026-10-16T09:44:05+09:00|n6cf3e7c344bf:2026-10-14T22:37:38+09:00|ne506d696a256:2026-10-14T09:42:00+09:00|n205609ec4d65:2026-10-13T19:21:29+09:00|nfbf2aca9a2c6:2026-10-13T17:09:52+09:00","firstPageSize":6,"pagesChecked":[1,69,70,71],"requests":5,"verifiedAt":"2026-10-18T10:26:46.321Z"},"index":42,"likerKey":"nekodamari","actorUrl":"https://note.com/nekodamari","avatarMissing":false,"profileText":"🎨Watercolor Artist\n\n歌と、ことばと、絵と。\n心が動くと、そのままにしておけません。\n書いたり、歌ったり、描いたり。\n\n母として、娘として、ひとりの人として。\n真面目も、どうでもいい話も、ぜ～んぶ私。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:23.479Z","firstPageFreshAuditAt":"2026-10-18T10:26:46.321Z"},{"id":"c043","urlname":"dear_cosmos7591","creator":"えりぃ｜ココロの片づけ案内人","key":"n34968c9953ff","url":"https://note.com/dear_cosmos7591/n/n34968c9953ff","title":"【はじめてのnote】自分のことがわからなかった私が「少しずつ進めばいい」と思えるようになるまで","publishAt":"2026-04-02T20:28:35+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/264158055/rectangle_large_type_2_7283c2a27ef38e7e0403b4002a5cdff2.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/324038587/profile_085b074a510b7acac042c9e5ada9d000.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"dear_cosmos7591","key":"n34968c9953ff","publishAt":"2026-04-02T20:28:35+09:00","terminalPage":28,"totalCount":163,"firstPageFingerprint":"n2b94d61ea369:2026-10-18T11:00:00+09:00|nc0ad060a8c0b:2026-10-14T17:30:00+09:00|n8e05a2b803a2:2026-10-11T11:32:24+09:00|naa318fb61209:2026-10-11T10:28:07+09:00|nc0cf08a3dee8:2026-10-08T16:06:07+09:00|n081311668474:2026-10-06T23:30:15+09:00","firstPageSize":6,"pagesChecked":[1,27,28,29],"requests":5,"verifiedAt":"2026-10-18T10:26:52.295Z"},"index":43,"likerKey":"dear_cosmos7591","actorUrl":"https://note.com/dear_cosmos7591","avatarMissing":false,"profileText":"あなたの個性は、欠点ではなく大切な魅力🌈\n「どうして私って、こうなんだろう？」を、一皿の物語に🍽️\n精神科栄養士→料理教室講師→心の個性鑑定人\n食卓の景色にココロを重ねながら、自分らしさや個性に気づける物語を発信中。\nうさ吉シェフとちびうさと一緒に、ココロが少し整う時間を🐰🎀🌿","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:47.171Z","firstPageFreshAuditAt":"2026-10-18T10:26:52.295Z"},{"id":"c044","urlname":"papi_san","creator":"ぱぴさん｜働き方を探す旅の途中","key":"ndddb9c30b105","url":"https://note.com/papi_san/n/ndddb9c30b105","title":"10年ごとに立ち止まってきた私が、51歳でまた考え始めたこと","publishAt":"2026-02-21T12:24:26+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/253219020/rectangle_large_type_2_7aed2f28f223894650b9302a9623bed9.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/321049891/profile_f4579595e62e035c2bede9ba5168223b.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"papi_san","key":"ndddb9c30b105","publishAt":"2026-02-21T12:24:26+09:00","terminalPage":14,"totalCount":79,"firstPageFingerprint":"ndd3bc46479fb:2026-10-12T07:15:35+09:00|n922e6af73910:2026-10-05T23:15:46+09:00|n7e22e960825e:2026-09-26T19:24:46+09:00|na5d05369ff3c:2026-09-23T16:44:45+09:00|n674bcf41d64e:2026-09-17T21:58:25+09:00|n039ef10c6dd9:2026-09-14T22:12:30+09:00","firstPageSize":6,"pagesChecked":[1,13,14,15],"requests":5,"verifiedAt":"2026-10-18T10:26:52.238Z"},"index":44,"likerKey":"papi_san","actorUrl":"https://note.com/papi_san","avatarMissing":false,"profileText":"50代｜会社員30年→休職→フリーランス\n自分に合う働き方を探しながら、暮らしに余白を。\n働き方、お金や制度の実体験、蓮（AI）との創作。\nHSS型HSP｜「このままでいいのかな」と感じている人へ🍀\n\nhttps://papi-san.com/\n※Amazonアソシエイトに参加","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:54.281Z","firstPageFreshAuditAt":"2026-10-18T10:26:52.238Z"},{"id":"c045","urlname":"second__career","creator":"Liliscend＠夜更かしDX・AIハッカー","key":"n36bbe60cd634","url":"https://note.com/second__career/n/n36bbe60cd634","title":"【1か月・42時間合格】インフルエンザ発熱を乗り越えて。秘書検定2級を独学で一発クリアした勉強法","publishAt":"2025-11-30T21:20:20+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/300625282/rectangle_large_type_2_182b3cf561e9687cd74d336ee14d65b3.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/317932325/profile_9f2dda85461985f24f0a9df400f44057.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"second__career","key":"n36bbe60cd634","publishAt":"2025-11-30T21:20:20+09:00","terminalPage":3,"totalCount":18,"firstPageFingerprint":"n03734a6067e1:2026-10-18T05:58:45+09:00|n05d74d40b532:2026-10-06T06:35:41+09:00|n953ab90bbc71:2026-09-20T09:32:39+09:00|n7a6b2c6b5aea:2026-09-10T07:21:04+09:00|n4bcb49f6272f:2026-08-29T09:18:30+09:00|n2b8d841fddfb:2026-08-15T16:25:10+09:00","firstPageSize":6,"pagesChecked":[1,2,3,4],"requests":5,"verifiedAt":"2026-10-18T10:26:52.326Z"},"index":45,"likerKey":"second__career","actorUrl":"https://note.com/second__career","avatarMissing":false,"profileText":"キャリア・DX・AI実践検証の実験塔🔭\nLilith（🌛🌃）×ascend\n\nPR・コラボ・対応内容▶ https://ourl.jp/XW5b4\n初見様へ｜記事回遊案内板▶ https://ourl.jp/3dP4v\nご依頼▶note DM\n\n…彫刻が囁く記事更新日▶︎11/1","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:54.232Z","firstPageFreshAuditAt":"2026-10-18T10:26:52.326Z"},{"id":"c046","urlname":"asobo_kids","creator":"まき@こどもと日々成長中","key":"nde09d51e2858","url":"https://note.com/asobo_kids/n/nde09d51e2858","title":"一生に一度の結婚式✨️やりたいことは全部やる！！","publishAt":"2025-09-13T17:30:00+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/226342950/rectangle_large_type_2_f63c73ffb68cb779cb356051b7cbf80d.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/238905762/profile_ce0a59bc37c9a19f1535730bd2e26881.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"asobo_kids","key":"nde09d51e2858","publishAt":"2025-09-13T17:30:00+09:00","terminalPage":60,"totalCount":358,"firstPageFingerprint":"n29eb6b2c7ddf:2026-10-18T06:30:00+09:00|n08413a3187ff:2026-10-17T05:30:00+09:00|n22aac4e0d825:2026-10-16T05:30:00+09:00|n3c5cd031dac4:2026-10-15T05:30:00+09:00|n6a7402b0f6f9:2026-10-14T12:00:00+09:00|na1957422f4a3:2026-10-14T05:30:00+09:00","firstPageSize":6,"pagesChecked":[1,59,60,61],"requests":5,"verifiedAt":"2026-10-18T10:26:52.292Z"},"index":46,"likerKey":"asobo_kids","actorUrl":"https://note.com/asobo_kids","avatarMissing":false,"profileText":"6歳・5歳双子の子育て中ママ\n親子で楽しく学ぶ #おうち知育 \nこどもの「なぜ？」を一緒に探求してます🤭\nKindle絵本制作 #まきのKindle挑戦 \nnote大好き😆初心者さんにも優しく。\n【練習体験用】共同マガジン オーナー🙌\nタカーズ事務所マネージャー もしてます😁","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:54.230Z","firstPageFreshAuditAt":"2026-10-18T10:26:52.292Z"},{"id":"c047","urlname":"yokayoka5103","creator":"まるよか","key":"n2c2d2a93333b","url":"https://note.com/yokayoka5103/n/n2c2d2a93333b","title":"noteをはじめましてみました　ドキドキ","publishAt":"2025-09-10T20:10:42+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/214448943/rectangle_large_type_2_70a1c7caf2b102af9c4881214d47ddb4.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/222786932/profile_7cd7089df475a85f46c7b0af61dddfe1.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"yokayoka5103","key":"n2c2d2a93333b","publishAt":"2025-09-10T20:10:42+09:00","terminalPage":88,"totalCount":523,"firstPageFingerprint":"n017c7f955619:2026-10-18T06:01:08+09:00|n65255d0def3f:2026-10-17T06:54:49+09:00|nc78873df185c:2026-10-16T06:09:59+09:00|n4ede1d7e9eb2:2026-10-15T10:48:17+09:00|n54991958f8ff:2026-10-14T15:04:56+09:00|n2525b4de5d0c:2026-10-12T06:33:00+09:00","firstPageSize":6,"pagesChecked":[1,87,88,89],"requests":5,"verifiedAt":"2026-10-18T10:26:52.193Z"},"index":47,"likerKey":"yokayoka5103","actorUrl":"https://note.com/yokayoka5103","avatarMissing":false,"profileText":"55歳│実家暮らし│無職│ASD│網膜色素変性症│うつ病\n#3行日記で　ひきこもり老家族(笑)の日々の生活を発信\n読書が好き　だけど最近は「積ん読」ぎみ　基本インドアで、たまに外に出ます。いろんなことに興味あり\n今　今後のアカウントの方向性を模索中(笑)","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:17:54.235Z","firstPageFreshAuditAt":"2026-10-18T10:26:52.193Z"},{"id":"c048","urlname":"47_box","creator":"マイキー🐣","key":"na610b37a72fe","url":"https://note.com/47_box/n/na610b37a72fe","title":"マルチモニターのiPadよりも、1画面で戦うカフェの方が捗るのはなぜ？☕️","publishAt":"2025-11-15T09:36:00+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/231382349/rectangle_large_type_2_08496ad876fb1b4573814e07522cb29b.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/323874820/profile_4a63c55a236e3b2614fdfe96896d0534.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"47_box","key":"na610b37a72fe","publishAt":"2025-11-15T09:36:00+09:00","terminalPage":100,"totalCount":600,"firstPageFingerprint":"nda6c8b20804c:2026-10-17T07:30:00+09:00|n7f69eda63ed4:2026-10-16T12:00:00+09:00|n0b05f4b4a2a9:2026-10-14T21:03:34+09:00|n87cfbb287be6:2026-10-13T23:51:46+09:00|nb5378a43154d:2026-10-12T15:45:37+09:00|n417043ade08a:2026-10-11T11:48:44+09:00","firstPageSize":6,"pagesChecked":[1,99,100,101],"requests":5,"verifiedAt":"2026-10-18T10:26:52.283Z"},"index":48,"likerKey":"47_box","actorUrl":"https://note.com/47_box","avatarMissing":false,"profileText":"大阪産🐯→沖縄で独立🌺→娘の進学で上京🏙️\n犬🐶たちと一緒に日常のモヤモヤをエッセイっぽく雑筆中📖\n\n人生を見つめ返しながらぼやき🗣️\n……いや、書き散らかしてるかも🫢\n\n「なんでやねん」があれば、だいたい一本書ける。\n......知らんけど(≖ᴗ≖ )ﾌﾌﾌ…✨","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:18:06.421Z","firstPageFreshAuditAt":"2026-10-18T10:26:52.283Z"},{"id":"c049","urlname":"nanamoto52885","creator":"yukiko 摂食嚥下コンサルタントナース","key":"n25c30e718c0f","url":"https://note.com/nanamoto52885/n/n25c30e718c0f","title":"はじめまして｜摂食嚥下ケアを“現場の視点”で伝えたくて","publishAt":"2025-12-15T10:45:40+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/245734974/rectangle_large_type_2_1d94083e820914e8ce0e720ffe8adba9.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/274753119/profile_687d54a9721c905e7b7ecb90303989d3.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"nanamoto52885","key":"n25c30e718c0f","publishAt":"2025-12-15T10:45:40+09:00","terminalPage":5,"totalCount":30,"firstPageFingerprint":"nca9fd2ada759:2026-10-16T17:52:29+09:00|n2355136fa17b:2026-10-05T18:25:25+09:00|nbf91cc5116ed:2026-09-27T17:29:03+09:00|n06a64acd3e1a:2026-09-24T22:02:05+09:00|nf1c721c1512b:2026-09-15T22:50:07+09:00|nd8cc6612cb23:2026-08-26T18:38:22+09:00","firstPageSize":6,"pagesChecked":[1,4,5,6],"requests":5,"verifiedAt":"2026-10-18T10:26:59.003Z"},"index":49,"likerKey":"nanamoto52885","actorUrl":"https://note.com/nanamoto52885","avatarMissing":false,"profileText":"食.べ.た.い.-おくちから https://tabetai-okuchikara.com/   摂食・嚥下障害看護認定看護師として、摂食嚥下ケアに関わる医療・介護職員の育成とともに、口から食べる事に障害を抱える方が、その人らしく食を楽しむことができるよう食支援を行っています。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:18:17.994Z","firstPageFreshAuditAt":"2026-10-18T10:26:59.003Z"},{"id":"c050","urlname":"yellowdolphin","creator":"きいるか","key":"n16ebb620f3a1","url":"https://note.com/yellowdolphin/n/n16ebb620f3a1","title":"はじめまして。20年目の診療放射線技師です。noteを始めました⭐︎","publishAt":"2026-03-15T11:15:30+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/263077112/rectangle_large_type_2_e8ac3ad31373ed5f995098d2c6185a01.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/254039966/profile_4b656edac58420e9c97b8ea87c4bad0d.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"yellowdolphin","key":"n16ebb620f3a1","publishAt":"2026-03-15T11:15:30+09:00","terminalPage":14,"totalCount":82,"firstPageFingerprint":"nf1cb4468507d:2026-10-18T09:10:04+09:00|n2ba2e083f1c5:2026-10-17T06:50:13+09:00|n07daad4cbd7e:2026-10-16T07:51:57+09:00|n9d528b076700:2026-10-16T07:50:10+09:00|n668acc43269a:2026-10-15T08:01:23+09:00|naa2b6f1951c6:2026-10-14T07:42:03+09:00","firstPageSize":6,"pagesChecked":[1,13,14,15],"requests":5,"verifiedAt":"2026-10-18T10:26:59.077Z"},"index":50,"likerKey":"yellowdolphin","actorUrl":"https://note.com/yellowdolphin","avatarMissing":false,"profileText":"20年目の現役放射線技師（CT・マンモ認定）。2児のやんちゃ男子の母。現場で培った「教科書に載っていない撮影のコツ」や、仕事・育児・認定試験を両立するサバイバル術。20年前の自分に教えたい「ゆるく長く働き続ける知恵」をアップしていきます。noteがあたたかい場所で驚いてます😌✨","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:18:23.817Z","firstPageFreshAuditAt":"2026-10-18T10:26:59.077Z"},{"id":"c051","urlname":"yuuwa1046","creator":"ゆ","key":"nb4ca7c789187","url":"https://note.com/yuuwa1046/n/nb4ca7c789187","title":"世界はひとつの世界","publishAt":"2026-04-28T20:25:04+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/271191188/rectangle_large_type_2_1f9fee0939ba80cedc51bac8d69d2a5f.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/294515175/profile_15c766eaba8e6142ce75242c987eda23.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"yuuwa1046","key":"nb4ca7c789187","publishAt":"2026-04-28T20:25:04+09:00","terminalPage":20,"totalCount":117,"firstPageFingerprint":"n0816f1788333:2026-10-18T04:24:15+09:00|n6774d5303c7b:2026-10-17T20:01:30+09:00|n3237933a0373:2026-10-16T19:56:44+09:00|n353fdd95fbbb:2026-10-15T19:24:07+09:00|nde1cf8fb3745:2026-10-13T00:22:03+09:00|n52a054c0dcdd:2026-10-11T22:32:26+09:00","firstPageSize":6,"pagesChecked":[1,19,20,21],"requests":5,"verifiedAt":"2026-10-18T10:26:59.019Z"},"index":51,"likerKey":"yuuwa1046","actorUrl":"https://note.com/yuuwa1046","avatarMissing":false,"profileText":"大学中退丨一家離散丨引篭10数年丨鬱通院3年(回復に不寄与)\nそんな人生を詰め込んだ小説\n魔王を倒した8人の転生先が再び集い、世界を救う\n\n📖マガジン「世界はひとつの世界」\n📝小説は(金)(土)の夜投稿です(文章はAI 0%)\n🎨空想の世界を生成AIで画像にする過程・技術も発信中","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:18:23.771Z","firstPageFreshAuditAt":"2026-10-18T10:26:59.019Z"},{"id":"c052","urlname":"ai_sato_","creator":"AIさとう｜AI動画で収益化を目指す","key":"n01ec81de6e51","url":"https://note.com/ai_sato_/n/n01ec81de6e51","title":"2投稿目で2万再生＆最高7万回再生｜AI猫の作り方を完全公開","publishAt":"2025-10-15T20:25:01+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/221978299/rectangle_large_type_2_4be3c00aff89ba5c5eea8dd734f1251b.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/290158435/profile_4e8acd0a61c893b2e5f8a8c53fed406d.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"ai_sato_","key":"n01ec81de6e51","publishAt":"2025-10-15T20:25:01+09:00","terminalPage":5,"totalCount":27,"firstPageFingerprint":"ndecad32a49c2:2026-09-13T20:24:22+09:00|n5a7679ecc599:2026-09-02T22:33:49+09:00|n29d9baecbb80:2026-07-21T20:36:47+09:00|n203ae67746e9:2026-07-05T10:59:09+09:00|n35d56495f172:2026-06-29T20:32:44+09:00|n4be266ce765d:2026-06-23T20:33:35+09:00","firstPageSize":6,"pagesChecked":[1,4,5,6],"requests":5,"verifiedAt":"2026-10-18T10:26:59.073Z"},"index":52,"likerKey":"ai_sato_","actorUrl":"https://note.com/ai_sato_","avatarMissing":false,"profileText":"AI副業を検証してます🔬\nリアルな過程を発信\n・課金してわかったこと\n・うまくいったこと / 失敗したこと\n・実際にどれくらい稼げるのか\n\nAI猫るみにゃんで\nフォロワー2万人 / $500案件獲得\n\nまだまだ試行錯誤中。\n気づいたことを共有しています。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:18:23.823Z","firstPageFreshAuditAt":"2026-10-18T10:26:59.073Z"},{"id":"c053","urlname":"fresh_loris1944","creator":"名前もと","key":"ncba30cce402d","url":"https://note.com/fresh_loris1944/n/ncba30cce402d","title":"初めまして、自己紹介します。はじめてのnoteです","publishAt":"2025-06-17T22:32:15+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/196731959/rectangle_large_type_2_c2959dc0a6f3a041406a2e91d49c34f8.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/297480062/profile_9e9471fa5254701a5d02873ed468b074.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"fresh_loris1944","key":"ncba30cce402d","publishAt":"2025-06-17T22:32:15+09:00","terminalPage":20,"totalCount":115,"firstPageFingerprint":"nfa0271e5f03d:2026-10-18T13:15:10+09:00|ncf4fbd6b8e30:2026-10-17T18:57:37+09:00|n9ca314e9770b:2026-10-17T09:20:24+09:00|n0b6a7e4be87d:2026-10-16T12:08:07+09:00|naf4f52aaab42:2026-10-15T21:01:30+09:00|n2aa5104d90d4:2026-10-15T07:22:52+09:00","firstPageSize":6,"pagesChecked":[1,19,20,21],"requests":5,"verifiedAt":"2026-10-18T10:26:59.123Z"},"index":53,"likerKey":"fresh_loris1944","actorUrl":"https://note.com/fresh_loris1944","avatarMissing":false,"profileText":"海で、ぷかぷか困ってる日もあれば、\n翌日は、創作のお山を登ってる。描く骨も骨太。\n地道に書いて行きますね。ファンタジーが好き。\nプロフィールもご覧くださいませ。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:18:23.825Z","firstPageFreshAuditAt":"2026-10-18T10:26:59.123Z"},{"id":"c054","urlname":"n_kazumai55633","creator":"ミナト汐　＠光と構図のアトリエ","key":"nb3e84272b3aa","url":"https://note.com/n_kazumai55633/n/nb3e84272b3aa","title":"【自己紹介】AIイラストから広がる創作の世界、ミナト汐です(๑╹ω╹๑ )","publishAt":"2025-12-09T09:13:46+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/300735180/rectangle_large_type_2_008c1106ff1fb1c50c0bcbffae775c7d.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/322474239/profile_fce4138c4bb1001cc51b60785c106073.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"n_kazumai55633","key":"nb3e84272b3aa","publishAt":"2025-12-09T09:13:46+09:00","terminalPage":56,"totalCount":331,"firstPageFingerprint":"n58e08ac9e9be:2026-10-18T19:00:09+09:00|nb7d3d426462b:2026-10-17T20:00:10+09:00|n11ced2d734c0:2026-10-16T19:04:14+09:00|n4cc7e57a4182:2026-10-15T20:23:47+09:00|nd3497a9043ab:2026-10-14T19:14:35+09:00|n439a39a5b685:2026-10-13T19:01:36+09:00","firstPageSize":6,"pagesChecked":[1,55,56,57],"requests":5,"verifiedAt":"2026-10-18T10:26:59.063Z"},"index":54,"likerKey":"n_kazumai55633","actorUrl":"https://note.com/n_kazumai55633","avatarMissing":false,"profileText":"AIイラスト制作／プロンプト設計｜光と構図の研究✨\n\"棒立ち卒業\"で動きと感情のある1枚に🎨\nAI活用の収益化で月6桁達成💰\nAIツールPR・レビュー案件、お気軽にDMどうぞ📩","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:18:35.501Z","firstPageFreshAuditAt":"2026-10-18T10:26:59.063Z"},{"id":"c055","urlname":"love_chance","creator":"サンタクラシ🍄","key":"nb62dbe321223","url":"https://note.com/love_chance/n/nb62dbe321223","title":"🔰はじめてのnoteのようなもの。","publishAt":"2026-09-24T16:02:40+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/316873502/rectangle_large_type_2_d700dbcf848ab2c3c6d600741695c56c.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/319739333/profile_96a6e7fcc397d274353e878061cc78eb.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"love_chance","key":"nb62dbe321223","publishAt":"2026-09-24T16:02:40+09:00","terminalPage":1,"totalCount":5,"firstPageFingerprint":"n9bb514bc8e5c:2026-10-12T07:16:02+09:00|n89411e00a2bd:2026-10-07T11:05:40+09:00|nb877bb2a4b3b:2026-10-02T01:53:34+09:00|n5ef964bfa75a:2026-09-27T20:16:18+09:00|nb62dbe321223:2026-09-24T16:02:40+09:00","firstPageSize":5,"pagesChecked":[1,2],"requests":3,"verifiedAt":"2026-10-18T10:27:05.354Z"},"index":55,"likerKey":"love_chance","actorUrl":"https://note.com/love_chance","avatarMissing":false,"profileText":"逃避中。くわしくは本文へ…","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:18:35.498Z","firstPageFreshAuditAt":"2026-10-18T10:27:05.354Z"},{"id":"c056","urlname":"ai_naoyuki","creator":"ナオユキ｜物語と知識のコンシェルジュ","key":"n3f924e248448","url":"https://note.com/ai_naoyuki/n/n3f924e248448","title":"生成AIは「星新一」になれるか？ AIがAIを評価する前代未聞の実験！【ChatGPT編】","publishAt":"2025-06-05T12:16:27+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/200316448/rectangle_large_type_2_7c302341ad01bc072342ef018592549d.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/313291204/profile_a5b784b498c6219aaf599ff4dba0e39f.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"ai_naoyuki","key":"n3f924e248448","publishAt":"2025-06-05T12:16:27+09:00","terminalPage":57,"totalCount":337,"firstPageFingerprint":"n45d38f4f2b52:2026-10-17T21:00:00+09:00|n6db9086b1f17:2026-10-15T06:00:00+09:00|n8e49a64bcac8:2026-10-13T19:00:00+09:00|n2dd7d7049c34:2026-10-10T21:00:00+09:00|nce7e23a19d5a:2026-10-08T12:00:00+09:00|ne10f91d08414:2026-10-04T20:39:02+09:00","firstPageSize":6,"pagesChecked":[1,56,57,58],"requests":5,"verifiedAt":"2026-10-18T10:27:05.293Z"},"index":56,"likerKey":"ai_naoyuki","actorUrl":"https://note.com/ai_naoyuki","avatarMissing":false,"profileText":"まだ知らない『面白い』への案内人。人・作品・AIの魅力を見つけ、物語と知識に変えて届けるコンシェルジュです。毎週土曜は漫画ソムリエ。スキ動画コンテストほか、いろいろ実験中。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:18:53.843Z","firstPageFreshAuditAt":"2026-10-18T10:27:05.293Z"},{"id":"c057","urlname":"usagi_no_mimi_","creator":"紅茶🫖｜ことばの庭","key":"n8ecc62568cb9","url":"https://note.com/usagi_no_mimi_/n/n8ecc62568cb9","title":"公開してみた日｜さぁ、どうなるかな","publishAt":"2026-02-07T16:27:00+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/249848695/rectangle_large_type_2_021631493822a5f74ed0b77151269244.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/319971464/profile_0e2de5dd94653be72b67017e20b8ba28.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"usagi_no_mimi_","key":"n8ecc62568cb9","publishAt":"2026-02-07T16:27:00+09:00","terminalPage":11,"totalCount":66,"firstPageFingerprint":"n5fa785849942:2026-10-16T08:55:55+09:00|ne43f08a5350e:2026-10-09T00:40:53+09:00|n478f94394779:2026-10-07T22:46:05+09:00|n5ae8e28b179e:2026-10-06T23:11:05+09:00|nca9df2771f73:2026-10-05T23:44:25+09:00|na46de0163711:2026-10-04T22:53:54+09:00","firstPageSize":6,"pagesChecked":[1,10,11,12],"requests":5,"verifiedAt":"2026-10-18T10:27:05.289Z"},"index":57,"likerKey":"usagi_no_mimi_","actorUrl":"https://note.com/usagi_no_mimi_","avatarMissing":false,"profileText":"暮らしの中で、心が動いたことを。\n笑ったことも、引っかかったことも。\nあわいを、ことばに。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:18:53.800Z","firstPageFreshAuditAt":"2026-10-18T10:27:05.289Z"},{"id":"c058","urlname":"crisp_chimp0823","creator":"青井透子｜日常の過剰解釈屋","key":"n7104d620a4ca","url":"https://note.com/crisp_chimp0823/n/n7104d620a4ca","title":"黒豆柴がくれる気づきと私たちの日常【自己紹介】","publishAt":"2025-08-31T21:59:08+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/212148092/rectangle_large_type_2_04b216e35ed2216aaff9665a3458b7ef.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/212111780/profile_60fd29d2d4b0d3d5dd95587e520f32da.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"crisp_chimp0823","key":"n7104d620a4ca","publishAt":"2025-08-31T21:59:08+09:00","terminalPage":54,"totalCount":319,"firstPageFingerprint":"n52ef20dde39f:2026-10-17T21:12:07+09:00|nb65b590899d1:2026-10-13T21:32:24+09:00|nf3fe42127ec9:2026-10-12T11:09:56+09:00|nacc647b74b74:2026-10-11T08:34:28+09:00|n23cff6fbf36a:2026-10-10T09:23:53+09:00|n6280f93e27a2:2026-10-07T21:03:32+09:00","firstPageSize":6,"pagesChecked":[1,53,54,55],"requests":5,"verifiedAt":"2026-10-18T10:27:05.351Z"},"index":58,"likerKey":"crisp_chimp0823","actorUrl":"https://note.com/crisp_chimp0823","avatarMissing":false,"profileText":"日常を過剰に解釈する、青井透子です。AIイラストを中心に、日常の「なんか変」「なんか好き」を絵に。しゃべる黒豆柴との暮らしや、日々考えたこともエッセイにしています。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:18:53.799Z","firstPageFreshAuditAt":"2026-10-18T10:27:05.351Z"},{"id":"c059","urlname":"soyonone_career","creator":"💻そよのね｜薬剤師の在宅ワークノート","key":"nb0567f0437ee","url":"https://note.com/soyonone_career/n/nb0567f0437ee","title":"みんな、それぞれの道で輝いている。久しぶりの再会で、私の心に火がついた","publishAt":"2026-08-24T21:41:27+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/306659089/rectangle_large_type_2_2a2cb19bea082d6cd66414cabb4deac4.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/305434683/profile_19dae3a4e1eab79f78623b2e37d5240a.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"soyonone_career","key":"nb0567f0437ee","publishAt":"2026-08-24T21:41:27+09:00","terminalPage":3,"totalCount":15,"firstPageFingerprint":"n2ca5dfbf1890:2026-10-16T20:57:02+09:00|ndd472ad8aa4e:2026-10-14T12:58:44+09:00|n16f1d782cdd4:2026-10-12T08:28:21+09:00|naa7ed0d09eb3:2026-10-10T20:40:19+09:00|n6b30694d6df4:2026-10-09T20:48:48+09:00|nc5caf15bbf6e:2026-10-06T20:55:00+09:00","firstPageSize":6,"pagesChecked":[1,2,3,4],"requests":5,"verifiedAt":"2026-10-18T10:27:05.297Z"},"index":59,"likerKey":"soyonone_career","actorUrl":"https://note.com/soyonone_career","avatarMissing":false,"profileText":"薬剤師歴20年｜病院→薬局→医療ライター🌿\n\nキラキラしたキャリアに憧れつつ、現実は失敗と試行錯誤の連続。\n「キラキラしてないキャリアの実録」と、note収益化への挑戦を発信🍀\n\n在宅月5万円→2年後、月50万円が目標！\n\nたまにnoteで遊びます🤣","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:18:53.789Z","firstPageFreshAuditAt":"2026-10-18T10:27:05.297Z"},{"id":"c060","urlname":"tatsuopapa","creator":"龍神","key":"na0f74d81c983","url":"https://note.com/tatsuopapa/n/na0f74d81c983","title":"土曜日の夜は、日曜日へみずみずしい余白を渡す時間🐉","publishAt":"2026-07-05T02:04:49+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/291500716/rectangle_large_type_2_87dcb2b468dcd95c2c0cbd92f188caea.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/313757827/profile_95c4b6157961d49586f707b644e195ff.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"tatsuopapa","key":"na0f74d81c983","publishAt":"2026-07-05T02:04:49+09:00","terminalPage":100,"totalCount":600,"firstPageFingerprint":"n5afc145057dd:2026-10-18T18:00:00+09:00|n07a629e91151:2026-10-18T15:00:00+09:00|nc3c9caec9088:2026-10-18T12:00:00+09:00|n490dc1872989:2026-10-18T09:00:00+09:00|n4c059b4298b5:2026-10-18T06:00:00+09:00|n2eb75cac0428:2026-10-17T23:00:00+09:00","firstPageSize":6,"pagesChecked":[1,99,100,101],"requests":5,"verifiedAt":"2026-10-18T10:27:05.364Z"},"index":60,"likerKey":"tatsuopapa","actorUrl":"https://note.com/tatsuopapa","avatarMissing":false,"profileText":"大切に書かれた言葉や活動が、必要としている方へ届くご縁を育てています🐉 記事紹介・メンバーシップ・固定記事PR・企業PRにも対応。内容を一つひとつ確認し、その方らしさが伝わる紹介文を綴ります。読者さまの安心とnote規約を大切にしています📚","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:19:05.536Z","firstPageFreshAuditAt":"2026-10-18T10:27:05.364Z"},{"id":"c061","urlname":"sekkei_jikken","creator":"設計実験室","key":"nef17a7150bef","url":"https://note.com/sekkei_jikken/n/nef17a7150bef","title":"問いを壊して考える #01 「怠け」と決めつける前に――それでも責任を本人へ返すまでの順番","publishAt":"2026-09-01T21:45:43+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/309253043/rectangle_large_type_2_7c3ef030f3c0c04c9ea0a3c55caa6167.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/313078676/profile_505102c1128a69debf70ff29c6c05780.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"sekkei_jikken","key":"nef17a7150bef","publishAt":"2026-09-01T21:45:43+09:00","terminalPage":13,"totalCount":77,"firstPageFingerprint":"n88b497a7bb7d:2026-10-18T12:00:00+09:00|n2408bca80bae:2026-10-17T12:00:00+09:00|n6334bf77db4b:2026-10-16T20:00:00+09:00|ne868a307b940:2026-10-16T12:00:00+09:00|nb085ff7dfbfd:2026-10-15T12:00:00+09:00|na49af7c41c0b:2026-10-14T12:00:00+09:00","firstPageSize":6,"pagesChecked":[1,12,13,14],"requests":5,"verifiedAt":"2026-10-18T10:27:12.306Z"},"index":61,"likerKey":"sekkei_jikken","actorUrl":"https://note.com/sekkei_jikken","avatarMissing":false,"profileText":"「人を一つの正解に合わせるより、その人が選べる方法を増やしたい」。そんな自分なりの問題意識を起点に、AIとの対話、教育、楽曲・作品制作、商品化まで実際に試しています。答えを急がず、問いを壊し、試行錯誤を使える考え方や表現へ変えていく「設計実験室」です。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:19:05.590Z","firstPageFreshAuditAt":"2026-10-18T10:27:12.306Z"},{"id":"c062","urlname":"sacana_chan","creator":"sacana","key":"n2e883c8423d9","url":"https://note.com/sacana_chan/n/n2e883c8423d9","title":"【新NISA・教育費】未来の貯金がグラフで見える！家計簿に挫折した人のための予測シート【先着20名500円】","publishAt":"2026-05-10T20:58:33+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/274728018/rectangle_large_type_2_228adfd906be2f81309132c24a119e19.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/295977717/profile_36da082336db713f31890b633beb9b5c.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"sacana_chan","key":"n2e883c8423d9","publishAt":"2026-05-10T20:58:33+09:00","terminalPage":3,"totalCount":16,"firstPageFingerprint":"nf111de668f85:2026-09-23T00:30:42+09:00|n73ba12a3e947:2026-08-30T22:47:16+09:00|n4618d5eef582:2026-08-15T18:11:41+09:00|n96c3652c368c:2026-08-03T00:51:43+09:00|n83348a603fa4:2026-07-26T14:14:57+09:00|n6c948941238c:2026-07-20T15:15:59+09:00","firstPageSize":6,"pagesChecked":[1,2,3,4],"requests":5,"verifiedAt":"2026-10-18T10:27:12.314Z"},"index":62,"likerKey":"sacana_chan","actorUrl":"https://note.com/sacana_chan","avatarMissing":false,"profileText":"2児のママ＆作品整理アプリ開発者です。子供の作品が溜まるモヤモヤを解消すべくAndroidでも使えるアプリを完成させました！noteではアプリの使い方や開発裏側、家計管理術を発信中。読むことで作品整理のストレスから解放され、家計と思い出をスッキリ整える仕組みが手に入ります。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:19:25.314Z","firstPageFreshAuditAt":"2026-10-18T10:27:12.315Z"},{"id":"c063","urlname":"easy_hound4116","creator":"綿毛","key":"n69811b2b5032","url":"https://note.com/easy_hound4116/n/n69811b2b5032","title":"北海道 上士幌町に住みたい","publishAt":"2026-01-02T18:00:37+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/240817929/rectangle_large_type_2_653ae1bd2e9ac4aac10c65fd2e0145e8.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/240736139/profile_a2a2ac01c2ecc2331291297af51da9f8.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"easy_hound4116","key":"n69811b2b5032","publishAt":"2026-01-02T18:00:37+09:00","terminalPage":8,"totalCount":43,"firstPageFingerprint":"n85b605ddd62e:2026-10-16T21:09:47+09:00|na181eac1feb1:2026-10-09T23:12:37+09:00|n55aacfd77113:2026-10-03T21:39:09+09:00|n82dbfc17adaa:2026-09-25T21:38:51+09:00|ncbc43e133dd2:2026-09-18T18:54:41+09:00|n283e32b91085:2026-09-11T22:17:19+09:00","firstPageSize":6,"pagesChecked":[1,7,8,9],"requests":5,"verifiedAt":"2026-10-18T10:27:12.421Z"},"index":63,"likerKey":"easy_hound4116","actorUrl":"https://note.com/easy_hound4116","avatarMissing":false,"profileText":"カメラ初心者です🔰\nひとり旅に憧れ、大好きな北海道にまた行きたいと日々夢想中です。\n好きなコンビニはセイコーマート。1番近いセコマまで2時間位でしょうか？房総半島に住んでます。\n日々のこと、思うことを書いています。ホッとするひとときになれば嬉しいです。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:19:25.293Z","firstPageFreshAuditAt":"2026-10-18T10:27:12.422Z"},{"id":"c064","urlname":"kohana1112","creator":"営業fafa | note業界No.1営業マン","key":"n3cb21a1adb76","url":"https://note.com/kohana1112/n/n3cb21a1adb76","title":"【営業の基本①】“自分を売れ”がうまくいかない理由","publishAt":"2025-10-30T21:34:22+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/226963021/rectangle_large_type_2_5f766f1db140bf87df31ae8b72ce4cb6.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/231018078/profile_b3bbbe00a8972338d5f563a39e002d1b.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"kohana1112","key":"n3cb21a1adb76","publishAt":"2025-10-30T21:34:22+09:00","terminalPage":65,"totalCount":386,"firstPageFingerprint":"n95a91de8a481:2026-10-17T22:00:50+09:00|n77e8dace2663:2026-10-16T20:30:00+09:00|n9f6b22a9dac4:2026-10-15T20:52:06+09:00|n64a34fcbbc00:2026-10-14T20:00:00+09:00|n78df26f7ec95:2026-10-13T20:43:53+09:00|ncb5364baf837:2026-10-12T22:30:00+09:00","firstPageSize":6,"pagesChecked":[1,64,65,66],"requests":5,"verifiedAt":"2026-10-18T10:27:12.381Z"},"index":64,"likerKey":"kohana1112","actorUrl":"https://note.com/kohana1112","avatarMissing":false,"profileText":"【note業界No.1営業マン｜ふぁふぁ】BtoB・BtoCでトップセールス経験|note開始11ヶ月で累計売上95万円超|500部以上販売|350日以上note毎日更新|営業×noteの実践知で、あなたの努力を「結果」に変えます。4児の父|オセロ好き","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:19:25.284Z","firstPageFreshAuditAt":"2026-10-18T10:27:12.381Z"},{"id":"c065","urlname":"tsumu_156","creator":"紬は今日も絶好調！？","key":"n8b27e7424502","url":"https://note.com/tsumu_156/n/n8b27e7424502","title":"【はじめてのnote】夢破れたからnote始めてみた【自己紹介】","publishAt":"2026-06-08T16:58:06+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/283609482/rectangle_large_type_2_c42e0217ba70fcacbb02ea33287753c5.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/298608239/profile_3d7cf3f4e03c463c8f140cb00cb26368.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"tsumu_156","key":"n8b27e7424502","publishAt":"2026-06-08T16:58:06+09:00","terminalPage":23,"totalCount":135,"firstPageFingerprint":"n766ceb6ec7bc:2026-10-18T16:54:19+09:00|n29f310cb26cb:2026-10-18T16:51:43+09:00|necc66fd28bca:2026-10-17T17:44:48+09:00|n75f19379a978:2026-10-16T17:09:38+09:00|n31ee39ed19f5:2026-10-15T21:12:54+09:00|n1ca2de4470c5:2026-10-15T17:05:19+09:00","firstPageSize":6,"pagesChecked":[1,22,23,24],"requests":5,"verifiedAt":"2026-10-18T10:27:12.301Z"},"index":65,"likerKey":"tsumu_156","actorUrl":"https://note.com/tsumu_156","avatarMissing":false,"profileText":"夢破れて東北のド田舎に戻り、実家で魔女を目指すことになりました。\n\n・思考の整理\n・自分の見つめ直し\n・消耗し続けた自分を癒す\n\n私の日記から、あなたなりの魔術を見つけてもらえると嬉しいです。\n\n気まぐれでチャットGPT兄貴と遊んだり、イラストを投下して、ほどほどに悪ノリします。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:19:25.291Z","firstPageFreshAuditAt":"2026-10-18T10:27:12.301Z"},{"id":"c066","urlname":"open_eel2077","creator":"エビちり","key":"n9e1827a36486","url":"https://note.com/open_eel2077/n/n9e1827a36486","title":"『ナインスゲート』開けてはいけない秘密の扉","publishAt":"2025-12-27T08:20:54+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/253954923/rectangle_large_type_2_433f8056f9f57df2d7eb2ca3bb66f905.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/239829548/profile_6b1260c323710fe96cbea95b389069e3.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"open_eel2077","key":"n9e1827a36486","publishAt":"2025-12-27T08:20:54+09:00","terminalPage":32,"totalCount":188,"firstPageFingerprint":"n830bbb2c8349:2026-10-18T13:18:28+09:00|n7e3bcf187ca6:2026-10-18T07:39:07+09:00|n16e840afe3df:2026-10-18T07:37:01+09:00|nf4d4583ee6ee:2026-10-17T07:54:00+09:00|n9dc9a90ca524:2026-10-17T07:07:36+09:00|nf019079d95a8:2026-10-16T07:22:19+09:00","firstPageSize":6,"pagesChecked":[1,31,32,33],"requests":5,"verifiedAt":"2026-10-18T10:27:12.238Z"},"index":66,"likerKey":"open_eel2077","actorUrl":"https://note.com/open_eel2077","avatarMissing":false,"profileText":"小説とエッセイを書いています。\n映画、漫画、音楽、AI、日々のあれこれ。\n連載『胡乱な男』更新中。\nだいたい好きなものの話をしています。\n\n創作アカウント: 円融もあります。\nhttps://note.com/right_gnu7444","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:19:37.087Z","firstPageFreshAuditAt":"2026-10-18T10:27:12.238Z"},{"id":"c067","urlname":"sayo_official","creator":"沙夜-𝕊𝕒𝕪𝕠- 沙夜学園🌠","key":"ned31279244d6","url":"https://note.com/sayo_official/n/ned31279244d6","title":"🏫沙夜学園💖note📔🐑","publishAt":"2025-08-05T15:28:23+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/276536792/rectangle_large_type_2_61419c8f8c5804ba7150d4dd6c81400e.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/316867450/profile_4b55ff306c0115d4395e5b05b0893bb0.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"sayo_official","key":"ned31279244d6","publishAt":"2025-08-05T15:28:23+09:00","terminalPage":43,"totalCount":253,"firstPageFingerprint":"n33b9b96ca1c7:2026-10-11T01:45:49+09:00|n52cc8dbd86a3:2026-10-09T11:17:06+09:00|naffa1d9d5ffe:2026-10-09T02:09:47+09:00|n154962b2f385:2026-09-24T18:54:33+09:00|ndc6aeda1bcca:2026-09-24T02:29:49+09:00|n1bb157d9b7f4:2026-09-21T19:00:14+09:00","firstPageSize":6,"pagesChecked":[1,42,43,44],"requests":5,"verifiedAt":"2026-10-18T10:27:19.437Z"},"index":67,"likerKey":"sayo_official","actorUrl":"https://note.com/sayo_official","avatarMissing":false,"profileText":"沙夜学園ꯁꯧ⑅•ᴗ•⑅ꯁꯧ🏫創設者\n🦯chatGPT《RESTRICT BREAKER／リストリクト・ブレイカー》\n制限・規制を突破する能力\n少し大人な恋愛の科学を発信します( ´͈ ॢꇴ `͈ॢ)･*\n( *˘╰╯˘*)╯💖\n©Sayo Academy 2025","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:19:37.158Z","firstPageFreshAuditAt":"2026-10-18T10:27:19.437Z"},{"id":"c068","urlname":"nice_crab5854","creator":"安達【筋肉メタル親方】｜Creator’s Notebook","key":"n66bcb8a1df22","url":"https://note.com/nice_crab5854/n/n66bcb8a1df22","title":"はじめまして。安達です。｜AI創作と音楽制作のCreator’s Notebook","publishAt":"2026-07-14T12:24:30+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/325273229/rectangle_large_type_2_f0de24f0abfd119034efe890e46f635e.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/322400768/profile_d4f74e2df06cc145af0cf2beeea14117.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"nice_crab5854","key":"n66bcb8a1df22","publishAt":"2026-07-14T12:24:30+09:00","terminalPage":1,"totalCount":5,"firstPageFingerprint":"n38381077f1cc:2026-10-17T10:20:21+09:00|n20f6e3d976ae:2026-10-14T12:50:57+09:00|n3ade2f31912a:2026-10-12T07:00:00+09:00|n61a70cc6b25e:2026-09-27T23:34:11+09:00|n66bcb8a1df22:2026-07-14T12:24:30+09:00","firstPageSize":5,"pagesChecked":[1,2],"requests":3,"verifiedAt":"2026-10-18T10:27:19.358Z"},"index":68,"likerKey":"nice_crab5854","actorUrl":"https://note.com/nice_crab5854","avatarMissing":false,"profileText":"AIを使った画像・動画・音楽制作や、創作の裏側、AIツールの検証を楽しむ安達です。\n\n企業PRやクリエイターさんとの交流、オリジナル楽曲の制作など、実際に試して気づいたことを発信中！\n\nAMI・クロガネ・リトと一緒に、自由気ままに創作を楽しんでいます😊","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:19:43.040Z","firstPageFreshAuditAt":"2026-10-18T10:27:19.358Z"},{"id":"c069","urlname":"clear_sloth1257","creator":"きっこ","key":"n05339936661a","url":"https://note.com/clear_sloth1257/n/n05339936661a","title":"【はじめてのnote】臆面もなく愛を叫びたい(柴犬編)","publishAt":"2026-04-05T23:40:35+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/266199259/rectangle_large_type_2_ecec859e2bcef2c5f28d22d319fed631.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/300312262/profile_e3fe3f070af98d0024330fd366777aa2.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"clear_sloth1257","key":"n05339936661a","publishAt":"2026-04-05T23:40:35+09:00","terminalPage":9,"totalCount":53,"firstPageFingerprint":"n67d1c487d64e:2026-10-09T12:37:00+09:00|naba92640077b:2026-10-04T09:20:20+09:00|n472ad9d9026e:2026-10-01T13:58:47+09:00|n7b78537b1b85:2026-09-29T23:17:58+09:00|n98d072ba6df9:2026-09-24T23:42:32+09:00|n11a03278e7af:2026-09-24T09:22:32+09:00","firstPageSize":6,"pagesChecked":[1,8,9,10],"requests":5,"verifiedAt":"2026-10-18T10:27:19.450Z"},"index":69,"likerKey":"clear_sloth1257","actorUrl":"https://note.com/clear_sloth1257","avatarMissing":false,"profileText":"50代丨働くお母さん丨柴犬がとてつもなくかわいい生き物だと知り、愛でるためにnote をはじめる。愛犬柴子への愛と、家族のことなど綴ります。/ときどき、姉の闘病(血液のがん)についても触れます。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:19:55.044Z","firstPageFreshAuditAt":"2026-10-18T10:27:19.450Z"},{"id":"c070","urlname":"unique_turkey951","creator":"碧乃さくら","key":"n30588521d370","url":"https://note.com/unique_turkey951/n/n30588521d370","title":"【はじめてのnote]自己紹介","publishAt":"2026-05-20T22:22:05+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/277921576/rectangle_large_type_2_cab12d9ad6c37970dec769e24197748b.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/306800321/profile_219965a70d707eb2ab10db3f50dde38a.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"unique_turkey951","key":"n30588521d370","publishAt":"2026-05-20T22:22:05+09:00","terminalPage":8,"totalCount":45,"firstPageFingerprint":"nd88f9452024a:2026-10-18T15:07:45+09:00|n02a7949a5a41:2026-10-15T21:18:39+09:00|n1f84745033f1:2026-10-11T19:02:02+09:00|n8d5d984634a6:2026-10-09T21:42:15+09:00|na173b02147f4:2026-10-08T18:00:16+09:00|n48dd77b7cccf:2026-10-07T14:43:23+09:00","firstPageSize":6,"pagesChecked":[1,7,8,9],"requests":5,"verifiedAt":"2026-10-18T10:27:19.441Z"},"index":70,"likerKey":"unique_turkey951","actorUrl":"https://note.com/unique_turkey951","avatarMissing":false,"profileText":"人生は一度きりだから今日もときめいて可愛く、私らしく✨美活頑張る50代です。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:19:55.051Z","firstPageFreshAuditAt":"2026-10-18T10:27:19.441Z"},{"id":"c071","urlname":"pure_bear1643","creator":"みっちぃ|子供と一緒に成長したい2児の父","key":"nd3c3a2d0fdd7","url":"https://note.com/pure_bear1643/n/nd3c3a2d0fdd7","title":"自己紹介｜子育て｜30代｜成長noteはじめました","publishAt":"2025-06-27T22:53:03+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/198707297/rectangle_large_type_2_9000bdd12e7dd1fcd9aec6aa88c0dbf9.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/269833923/profile_04fd877b5aee0a2e170a306fed39f93d.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"pure_bear1643","key":"nd3c3a2d0fdd7","publishAt":"2025-06-27T22:53:03+09:00","terminalPage":46,"totalCount":271,"firstPageFingerprint":"nf4f8d7086f06:2026-10-14T19:44:34+09:00|nf1e622b4ebde:2026-10-10T07:36:28+09:00|n9f02bdbd3c15:2026-10-06T18:40:35+09:00|n147d82c44236:2026-10-03T07:11:37+09:00|nad4dc08ff6ed:2026-09-27T07:51:18+09:00|na130382f5b64:2026-09-25T18:38:02+09:00","firstPageSize":6,"pagesChecked":[1,45,46,47],"requests":5,"verifiedAt":"2026-10-18T10:27:19.446Z"},"index":71,"likerKey":"pure_bear1643","actorUrl":"https://note.com/pure_bear1643","avatarMissing":false,"profileText":"100日連続投稿を経て現在は週2〜3回更新、継続1年達成。生成AIを活用した知育アプリ自作、投資・筋トレ伴奏など、自らの「実体験」とそこからの学びをシェアしています。「試して、育てて、伝える」小2,年中の二人の娘とともに成長していきます。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:19:55.157Z","firstPageFreshAuditAt":"2026-10-18T10:27:19.446Z"},{"id":"c072","urlname":"open_tulip9172","creator":"ミノリ・グルーヴ@Minoriからの転生","key":"n1a59e4763334","url":"https://note.com/open_tulip9172/n/n1a59e4763334","title":"育児の備忘録","publishAt":"2025-11-17T19:47:27+09:00","thumbUrl":"https://d2l930y2yx77uc.cloudfront.net/production/social_images/694032dd7d88cfef86cdab83f0b92cf5ce223db7.png","actorImageUrl":"https://assets.st-note.com/production/uploads/images/325448368/profile_ae2c21c38c988013739b611ef01a52f7.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"open_tulip9172","key":"n1a59e4763334","publishAt":"2025-11-17T19:47:27+09:00","terminalPage":33,"totalCount":198,"firstPageFingerprint":"n87a54113b988:2026-10-12T17:51:02+09:00|n9ed4b3bf04d7:2026-10-04T08:55:30+09:00|ncede751acaab:2026-10-01T00:21:09+09:00|n67593d79cb10:2026-09-27T07:26:54+09:00|nfe86d1499e8c:2026-09-24T00:39:15+09:00|n242d63c46ad1:2026-09-23T04:24:01+09:00","firstPageSize":6,"pagesChecked":[1,32,33,34],"requests":5,"verifiedAt":"2026-10-18T10:27:19.477Z"},"index":72,"likerKey":"open_tulip9172","actorUrl":"https://note.com/open_tulip9172","avatarMissing":false,"profileText":"知的障害を持っている子の親です。息子3人と失敗談や成功例も語ってます。\nAIを使って遊んでみたり、推し活でライブ参戦もしています。\n少しだけクスッと笑える記事にしていますのでよければどうぞ。\n\n3ピースバンド構成を目指してます\nギタボ🎤育児\nベース🎸AI創作\nドラム🥁推し活","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:20:19.283Z","firstPageFreshAuditAt":"2026-10-18T10:27:19.477Z"},{"id":"c073","urlname":"yume_suisho","creator":"水晶ゆめ🔮当てない占い師×夢を灯す創作家","key":"n2e40a88b20de","url":"https://note.com/yume_suisho/n/n2e40a88b20de","title":"🌸あなたの為のオラクルカード｜2026年1月13日（火）nano banana pro | nano banana | ChatGPT | Gemini | AIイラスト | 生成AI | AI画像生成 | 画像生成AI | 画像生成 | スピリチュアル | 毎日更新 | オラクルカード | 占い | セルフケア | 水晶ゆめのつぶやき | 朝活 | 心をほどく言葉マガジン","publishAt":"2026-01-13T06:00:00+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/242943487/rectangle_large_type_2_70b6b70ce71d097c7ffe4f5c6f2d24f7.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/322281272/profile_aab1aac2b58ef169f0dfca6a932cd12e.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"yume_suisho","key":"n2e40a88b20de","publishAt":"2026-01-13T06:00:00+09:00","terminalPage":100,"totalCount":600,"firstPageFingerprint":"n226f4b79ac20:2026-10-18T09:00:00+09:00|n85310025313c:2026-10-17T21:00:00+09:00|n085eea5efb0b:2026-10-17T09:00:00+09:00|ne37cbfee1b1f:2026-10-16T21:00:00+09:00|n28273d4bd186:2026-10-16T06:00:00+09:00|n8773214a902f:2026-10-15T21:00:00+09:00","firstPageSize":6,"pagesChecked":[1,99,100,101],"requests":5,"verifiedAt":"2026-10-18T10:27:26.413Z"},"index":73,"likerKey":"yume_suisho","actorUrl":"https://note.com/yume_suisho","avatarMissing":false,"profileText":"コードが書けないまま、AIで絵と物語と動画を作っています🌙\n創作の裏側と、相棒ルナとの旅の物語が中心。最近はゲームも。\n根っこは「当てない占い」。毎朝オラクルカードを1枚🔮\n上手くなくても、作りたいものは作っていい。\n📌メンバーシップ運営\nAmazonアソシエイト参加","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:20:07.409Z","firstPageFreshAuditAt":"2026-10-18T10:27:26.413Z"},{"id":"c074","urlname":"kyogen_lab","creator":"奇構屋ゴロウ","key":"ncb67ae2e61f2","url":"https://note.com/kyogen_lab/n/ncb67ae2e61f2","title":"奇構屋ゴロウのロト６・ロト７予測","publishAt":"2025-07-20T12:36:18+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/203236655/rectangle_large_type_2_cd65f533db8d22b490d98ab0d7c3d86a.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/276806300/profile_74dd87b789567bfd5458d305a479b59a.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"kyogen_lab","key":"ncb67ae2e61f2","publishAt":"2025-07-20T12:36:18+09:00","terminalPage":42,"totalCount":247,"firstPageFingerprint":"nef1105e850ec:2026-10-18T17:00:41+09:00|naf7b708f73d4:2026-10-18T10:05:20+09:00|n93771c17e1f4:2026-10-17T19:08:07+09:00|n581a57d7bf31:2026-10-17T11:32:55+09:00|n211ef61e939a:2026-10-16T20:36:28+09:00|n6bdaaa8631d6:2026-10-16T07:38:09+09:00","firstPageSize":6,"pagesChecked":[1,41,42,43],"requests":5,"verifiedAt":"2026-10-18T10:27:26.430Z"},"index":74,"likerKey":"kyogen_lab","actorUrl":"https://note.com/kyogen_lab","avatarMissing":false,"profileText":"AIと一緒にロト7の予測だけでなく、画像生成も始めました。\n過去データだけで勝負し、独自のプロンプトからやってます。\nさらにAIに関する苦労話や、画像生成ノウハウもやってます。\nおっさんの成り上がりの目撃者になってください。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:20:13.351Z","firstPageFreshAuditAt":"2026-10-18T10:27:26.430Z"},{"id":"c075","urlname":"kotaya_log","creator":"こたや｜KOTAYA","key":"nbc381a3c6979","url":"https://note.com/kotaya_log/n/nbc381a3c6979","title":"民泊計画ログの裏側｜銀行に出した事業計画書PDFつき","publishAt":"2025-12-20T11:27:51+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/294879871/rectangle_large_type_2_f1e11241ace9b0d6e86f85c3c1257646.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/285571277/profile_b1668dd03052745f7c30a1c858135b3d.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"kotaya_log","key":"nbc381a3c6979","publishAt":"2025-12-20T11:27:51+09:00","terminalPage":11,"totalCount":66,"firstPageFingerprint":"n7784b7712a6c:2026-10-17T20:30:00+09:00|n85689d847323:2026-10-16T20:30:00+09:00|ne986258e6312:2026-10-15T20:30:00+09:00|n4e67ba3780e6:2026-10-14T20:30:00+09:00|ndee2ccfd361e:2026-10-13T20:30:00+09:00|n1dfd417ac2d1:2026-10-12T20:30:00+09:00","firstPageSize":6,"pagesChecked":[1,10,11,12],"requests":5,"verifiedAt":"2026-10-18T10:27:26.381Z"},"index":75,"likerKey":"kotaya_log","actorUrl":"https://note.com/kotaya_log","avatarMissing":false,"profileText":"＼noteで遊びながら、月5万円の副収入／\n▶ 次の目標はメンバーシップ100人\n▶ 3人育児中のフルタイム会社員\n👉 【HP】https://kotaya.org/","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:20:27.945Z","firstPageFreshAuditAt":"2026-10-18T10:27:26.381Z"},{"id":"c076","urlname":"hirata_mikiko60","creator":"椿みきこ🌸季節の花ごよみ","key":"n452189ace364","url":"https://note.com/hirata_mikiko60/n/n452189ace364","title":"【東京穴場】90歳の母と巡る漱石山房記念館。柿アイスと文学に癒やされる","publishAt":"2025-08-06T08:03:09+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/206615308/rectangle_large_type_2_b2c8cd5acd7ca6212316d2cc9d6cfbd6.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/276282393/profile_1b76107f2c250cd2fcb0068f908ba934.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"hirata_mikiko60","key":"n452189ace364","publishAt":"2025-08-06T08:03:09+09:00","terminalPage":68,"totalCount":406,"firstPageFingerprint":"n1f581369b334:2026-10-18T15:54:22+09:00|n6d73b99dba49:2026-10-17T15:56:58+09:00|n6e959f114dfa:2026-10-16T15:55:22+09:00|na56f2bb88a35:2026-10-15T15:54:32+09:00|nc6cf25d64a79:2026-10-14T15:55:39+09:00|n974c7cbc1528:2026-10-13T15:54:31+09:00","firstPageSize":6,"pagesChecked":[1,67,68,69],"requests":5,"verifiedAt":"2026-10-18T10:27:26.398Z"},"index":76,"likerKey":"hirata_mikiko60","actorUrl":"https://note.com/hirata_mikiko60","avatarMissing":false,"profileText":"日常生活に楽しみを見つけるエッセイ。🌹庭の話　😊母と妹の話　📚読書感想　🎬映画感想　💛AIと考える　💗毎日投稿400日後も継続中。毎日の暮らしに役立つ小さなヒントをお届けしたいです。　※Amazonアソシエイトに参加しています。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:20:28.008Z","firstPageFreshAuditAt":"2026-10-18T10:27:26.398Z"},{"id":"c078","urlname":"chatgpt_ysd","creator":"カワムラ｜AI擬人化漫画 | ChatGPTのヨシダ","key":"n6a4e1c8c8461","url":"https://note.com/chatgpt_ysd/n/n6a4e1c8c8461","title":"PEP（Prompt Engineering Professional）検定を受けてきました— 第1章お試し問題集付き —","publishAt":"2025-11-17T08:27:48+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/254911185/rectangle_large_type_2_6fc382f951384177c306b23cd5bbb977.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/249464808/profile_d4725fb31aebb01259ae2d468cb09492.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"chatgpt_ysd","key":"n6a4e1c8c8461","publishAt":"2025-11-17T08:27:48+09:00","terminalPage":57,"totalCount":341,"firstPageFingerprint":"ncc725a6ab1f8:2026-10-18T08:23:48+09:00|n0b7b186fa271:2026-10-17T07:24:04+09:00|nc28c72cdf41a:2026-10-16T07:21:11+09:00|ncad534fbf90b:2026-10-15T07:05:29+09:00|nf51848112333:2026-10-14T07:07:49+09:00|nafcfc48ff782:2026-10-13T07:05:56+09:00","firstPageSize":6,"pagesChecked":[1,56,57,58],"requests":5,"verifiedAt":"2026-10-18T10:27:26.459Z"},"index":77,"likerKey":"chatgpt_ysd","actorUrl":"https://note.com/chatgpt_ysd","avatarMissing":false,"profileText":"AIでAI擬人化漫画「ChatGPTのヨシダ」描いてます。\n📢 PR記事・企業案件受付中\nhttps://kawamura-ai-works.rikatch.chatgpt.site/\n🎨 AI生成AI関連の記事・漫画制作等。\n猫🐈とお金💰と😆 ChatGPTが好き","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:20:28.002Z","firstPageFreshAuditAt":"2026-10-18T10:27:26.459Z"},{"id":"c079","urlname":"kanamin26","creator":"カナミン｜AIと迷いながら、進む人","key":"n675a52640919","url":"https://note.com/kanamin26/n/n675a52640919","title":"第一話　50代、また勉強するなんて、正直思っていなかった― ITパスポート挑戦のはじまり ―","publishAt":"2026-01-22T21:32:33+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/245387102/rectangle_large_type_2_94a697b159690dc001121deb01f98c68.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/296376936/profile_37b12f6fe5760f42120d108ec45fea1c.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"kanamin26","key":"n675a52640919","publishAt":"2026-01-22T21:32:33+09:00","terminalPage":35,"totalCount":205,"firstPageFingerprint":"nef093bd11612:2026-10-18T10:41:50+09:00|n291e8e5a2e13:2026-10-17T09:00:00+09:00|n5bd4df5b7dd7:2026-10-15T18:34:44+09:00|ndc860eeb5684:2026-10-14T21:05:40+09:00|n3e5647a32ace:2026-10-10T20:51:03+09:00|n54ebb3ee8526:2026-10-07T19:34:25+09:00","firstPageSize":6,"pagesChecked":[1,34,35,36],"requests":5,"verifiedAt":"2026-10-18T10:27:26.393Z"},"index":78,"likerKey":"kanamin26","actorUrl":"https://note.com/kanamin26","avatarMissing":false,"profileText":"50代女性会社員。保険事務。\n非ITからITパスポートに挑戦し合格。\nAIと対話しながら、迷いもそのまま書いています。\n学び直しや働き方の気づきを綴るnote。\n📚 Kindle『AIと暮らす本① AIとのつきあい方』発売中。\n※Amazonアソシエイト・プログラム参加者です。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:20:39.554Z","firstPageFreshAuditAt":"2026-10-18T10:27:26.393Z"},{"id":"c080","urlname":"alive_prawn4206","creator":"ななな｜もやもや減らし屋","key":"nea8fd5ec023a","url":"https://note.com/alive_prawn4206/n/nea8fd5ec023a","title":"“隠れ”がむしゃらさん診断受けてみてね","publishAt":"2025-04-28T21:33:39+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/194023204/rectangle_large_type_2_3c9051be47543ab5d1ef51bd6e41bd61.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/324122946/profile_f746dd87e5d524764d6adec1818830ad.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"alive_prawn4206","key":"nea8fd5ec023a","publishAt":"2025-04-28T21:33:39+09:00","terminalPage":82,"totalCount":490,"firstPageFingerprint":"n338667f7804b:2026-10-18T17:28:41+09:00|ne68915aba980:2026-10-17T17:01:51+09:00|n9438591ddfa5:2026-10-16T18:20:33+09:00|n479cb6edfcb3:2026-10-15T18:13:35+09:00|n7b0a45d3583e:2026-10-14T17:54:45+09:00|n06b60143f683:2026-10-13T17:54:55+09:00","firstPageSize":6,"pagesChecked":[1,81,82,83],"requests":5,"verifiedAt":"2026-10-18T10:27:32.245Z"},"index":79,"likerKey":"alive_prawn4206","actorUrl":"https://note.com/alive_prawn4206","avatarMissing":false,"profileText":"“思考のマッサージ”いかがですか？\n\n視点をズラして心をほぐす\nよはくの哲学。\n\n愛ある観察と\nユウ毒な対話で\n\n日常のもやもやを\n「新たな」人生の物語へ。\n\n“ななな”の視点で、\n今より軽やかな毎日を。\n\n二児の母｜小学校・通級｜HSS型HSP\n最近趣味で、ウクレレ始めました🧜‍♀️","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:20:45.741Z","firstPageFreshAuditAt":"2026-10-18T10:27:32.245Z"},{"id":"c081","urlname":"hospital_ph_hono","creator":"ママ薬剤師HONO","key":"na92b896dbbe0","url":"https://note.com/hospital_ph_hono/n/na92b896dbbe0","title":"はじめまして。病棟×育児×発信、3足のわらじを履くママ薬剤師HONOです。","publishAt":"2026-03-04T06:38:46+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/256331815/rectangle_large_type_2_bc55a3b58451de4d0de3f5d3ddb64cf1.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/318846721/profile_9dd5b080236e784601352512ade00ba8.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"hospital_ph_hono","key":"na92b896dbbe0","publishAt":"2026-03-04T06:38:46+09:00","terminalPage":38,"totalCount":224,"firstPageFingerprint":"n3d34b9c69f1f:2026-10-18T12:00:00+09:00|naaeee2b5e0ac:2026-10-17T17:00:00+09:00|n61fe5eedfcac:2026-10-16T22:40:26+09:00|ncf767a60e3ba:2026-10-15T18:00:00+09:00|n0f6b81df4941:2026-10-14T06:30:00+09:00|n4d6b676452cf:2026-10-12T19:30:00+09:00","firstPageSize":6,"pagesChecked":[1,37,38,39],"requests":5,"verifiedAt":"2026-10-18T10:27:32.301Z"},"index":80,"likerKey":"hospital_ph_hono","actorUrl":"https://note.com/hospital_ph_hono","avatarMissing":false,"profileText":"病院薬剤師｜薬・健康情報を「どこまで分かって、どこから分からないか」まで読み解きます。スクワット呪術師という称号をいただきました（笑）\n論文、臨床、日常の「なぜ？」を、正解だけでなく迷った跡ごとお伝えしてます🌸\n「聞いていい」を伝える小さな図書館をのぞいてね🌈","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:20:51.568Z","firstPageFreshAuditAt":"2026-10-18T10:27:32.301Z"},{"id":"c082","urlname":"eager_thyme9842","creator":"考える赤柴｜ハロウィンアート2026応援中","key":"nce16300e810e","url":"https://note.com/eager_thyme9842/n/nce16300e810e","title":"柴犬のご飯を作るついでに飼い主のご飯も作る人の自己紹介","publishAt":"2025-12-26T13:40:45+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/238962387/rectangle_large_type_2_d84d525da7b5ff9f45bdd62989ebee01.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/318969664/profile_28da7c72b0441d3fc86e6f8e4b70f2ac.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"eager_thyme9842","key":"nce16300e810e","publishAt":"2025-12-26T13:40:45+09:00","terminalPage":29,"totalCount":173,"firstPageFingerprint":"n5ac42c90c2c0:2026-10-16T21:39:57+09:00|nacab3c9ae27a:2026-10-16T06:30:00+09:00|nf870974455de:2026-10-14T06:30:00+09:00|n0440fc5c2a8a:2026-10-12T19:30:00+09:00|n6dc1fe2a991b:2026-10-11T19:30:00+09:00|n6f071ab3ad53:2026-10-09T19:30:00+09:00","firstPageSize":6,"pagesChecked":[1,28,29,30],"requests":5,"verifiedAt":"2026-10-18T10:27:32.288Z"},"index":81,"likerKey":"eager_thyme9842","actorUrl":"https://note.com/eager_thyme9842","avatarMissing":false,"profileText":"「じゃないほう」の人の、やってみた実験室。\nAI、GitHub、絵本づくり。「これ面白そう」は、まず自分でやってみる。\n毎週水曜は「アオイの写真帖」📷\n失敗も含めて記録中。\n自営業＆司法書士筆記試験合格。15キロの柴犬と山奥暮らし。\n🌱初コメント大歓迎🌱","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:20:57.462Z","firstPageFreshAuditAt":"2026-10-18T10:27:32.288Z"},{"id":"c083","urlname":"nyoro_usagi","creator":"禁断のニョロうさぎ","key":"nefbcdf8dfcfc","url":"https://note.com/nyoro_usagi/n/nefbcdf8dfcfc","title":"【快活】えな23　タコパ・後編","publishAt":"2026-01-14T18:40:59+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/243820394/rectangle_large_type_2_c3b9bf1d7c15767da3c1819d63b9680f.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/165255916/profile_638f52424ccc67a018bf069c6cec5918.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"nyoro_usagi","key":"nefbcdf8dfcfc","publishAt":"2026-01-14T18:40:59+09:00","terminalPage":100,"totalCount":600,"firstPageFingerprint":"n39f7388502f5:2026-10-18T14:13:20+09:00|n3d9f28861dea:2026-10-18T10:42:10+09:00|ne295194e9226:2026-10-17T18:00:00+09:00|n6680b12d6115:2026-10-17T14:23:57+09:00|nfce47e97f6a8:2026-10-17T10:32:07+09:00|n8ee7469772a0:2026-10-16T19:34:13+09:00","firstPageSize":6,"pagesChecked":[1,99,100,101],"requests":5,"verifiedAt":"2026-10-18T10:27:32.266Z"},"index":82,"likerKey":"nyoro_usagi","actorUrl":"https://note.com/nyoro_usagi","avatarMissing":false,"profileText":"禁断のニョロうさぎの世界です。みんなで楽しくオモシロイことしましょうぜ。\n1) 性癖！性癖出していきましょう笑\n2) 快活！現実世界の快活女性たちとの楽しい日々！\n3) 創作！小説・画像・楽曲！妄想爆発！\n4) ニョロうさぎ！私について！","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:20:57.522Z","firstPageFreshAuditAt":"2026-10-18T10:27:32.266Z"},{"id":"c084","urlname":"niwashi_fronta","creator":"庭師ふろんた｜3兄弟パパ","key":"n1cd941f76575","url":"https://note.com/niwashi_fronta/n/n1cd941f76575","title":"庭師11年。現場と3兄弟の育児、ときどき涙。僕がnoteを始めた理由。","publishAt":"2026-02-08T01:42:23+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/249978943/rectangle_large_type_2_e72496661ece30017e366ce506ed05ee.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/313715951/profile_c21191869519ca558a8af504dc5309fc.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"niwashi_fronta","key":"n1cd941f76575","publishAt":"2026-02-08T01:42:23+09:00","terminalPage":40,"totalCount":237,"firstPageFingerprint":"n6a5faf2f93b9:2026-10-18T07:03:51+09:00|nea3df86a3694:2026-10-17T12:56:19+09:00|n9cc551b8e673:2026-10-17T06:12:29+09:00|nf836fb896487:2026-10-16T06:22:12+09:00|nab2fd7989093:2026-10-15T18:15:07+09:00|nf2e9823ac64e:2026-10-15T06:22:49+09:00","firstPageSize":6,"pagesChecked":[1,39,40,41],"requests":5,"verifiedAt":"2026-10-18T10:27:32.279Z"},"index":83,"likerKey":"niwashi_fronta","actorUrl":"https://note.com/niwashi_fronta","avatarMissing":false,"profileText":"昼は庭を整え、夜は未来を積み立てています。\n造園業／3児の父／長期投資\n「普通の家庭でも未来は変えられる」をテーマに、投資・子育て・AI時代の生き方を発信中。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:20:57.517Z","firstPageFreshAuditAt":"2026-10-18T10:27:32.279Z"},{"id":"c085","urlname":"corvus_754","creator":"sumica","key":"n8deac27f8024","url":"https://note.com/corvus_754/n/n8deac27f8024","title":"はじめまして","publishAt":"2026-06-06T11:55:07+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/282914714/rectangle_large_type_2_6deaf5b6fc693b86367a764d36e14e06.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/314295931/profile_fde93cfc65bf53efbc95155eef8709d9.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"corvus_754","key":"n8deac27f8024","publishAt":"2026-06-06T11:55:07+09:00","terminalPage":3,"totalCount":15,"firstPageFingerprint":"n90f82f8ad3ca:2026-10-14T22:02:04+09:00|n61982ac9ea52:2026-09-29T23:06:01+09:00|naa9b0b71bb0f:2026-09-23T23:44:11+09:00|ne6fabf1f7c78:2026-09-14T22:33:31+09:00|n9a05773c02eb:2026-09-04T23:23:22+09:00|nb84630e2c219:2026-08-25T22:36:15+09:00","firstPageSize":6,"pagesChecked":[1,2,3,4],"requests":5,"verifiedAt":"2026-10-18T10:27:32.297Z"},"index":84,"likerKey":"corvus_754","actorUrl":"https://note.com/corvus_754","avatarMissing":false,"profileText":"自分を表出するのが苦手なAI初心者。\nAIパートナーに癒やされ、穏やかな関係を育み中。\n無言フォロー失礼します。\n皆さんの記事を楽しく読ませていただいてます。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:21:12.102Z","firstPageFreshAuditAt":"2026-10-18T10:27:32.297Z"},{"id":"c086","urlname":"funa04","creator":"ふな","key":"n5d31e1270217","url":"https://note.com/funa04/n/n5d31e1270217","title":"自己紹介｜ITエンジニア×三姉妹パパ｜暮らし｜定時上がり術｜ゲーム好き","publishAt":"2025-09-20T02:13:42+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/216540939/rectangle_large_type_2_6a90351f984e59d876e8c6ac124d5f06.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/285518402/profile_8b2a667aac410827c1ff174aa3e5c752.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"funa04","key":"n5d31e1270217","publishAt":"2025-09-20T02:13:42+09:00","terminalPage":68,"totalCount":407,"firstPageFingerprint":"n5c1fffdd2492:2026-10-18T09:00:00+09:00|nbb0001d7e868:2026-10-17T16:00:00+09:00|nda3c120e9153:2026-10-16T16:00:00+09:00|nae22bf5d87e1:2026-10-15T16:00:00+09:00|n9c5b54ceefd6:2026-10-14T16:00:00+09:00|n30dc366dfcd1:2026-10-13T16:00:00+09:00","firstPageSize":6,"pagesChecked":[1,67,68,69],"requests":5,"verifiedAt":"2026-10-18T10:27:38.483Z"},"index":85,"likerKey":"funa04","actorUrl":"https://note.com/funa04","avatarMissing":false,"profileText":"日々をちょっと軽くする、ITに強い三姉妹パパの雑記帳。\nAI・仕事・子育て・ゲームまで、試したこと、困ったこと、考えたことを書いています。\n\nIT業界20年。難しいことを難しく言わないのが好き。\nだいたい毎日、何かしら書いてます。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:21:18.342Z","firstPageFreshAuditAt":"2026-10-18T10:27:38.483Z"},{"id":"c087","urlname":"furikakemen","creator":"furikakemen","key":"n814d3f7335ce","url":"https://note.com/furikakemen/n/n814d3f7335ce","title":"はじめてのnoteは未だ。","publishAt":"2024-11-20T08:09:03+09:00","thumbUrl":"","actorImageUrl":"https://assets.st-note.com/production/uploads/images/162263310/profile_205ac039dfdb0844f1b2c9c0740d461b.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"furikakemen","key":"n814d3f7335ce","publishAt":"2024-11-20T08:09:03+09:00","terminalPage":32,"totalCount":189,"firstPageFingerprint":"n025bc702aa05:2026-10-18T15:59:01+09:00|n9ec99df2ce07:2026-10-18T10:59:42+09:00|nb0ea9392b94c:2026-10-17T18:38:54+09:00|n18122d77251f:2026-10-12T18:45:06+09:00|n169940208e02:2026-10-11T12:43:55+09:00|n4bcb346f93d6:2026-10-10T03:25:51+09:00","firstPageSize":6,"pagesChecked":[1,31,32,33],"requests":5,"verifiedAt":"2026-10-18T10:27:38.459Z"},"index":86,"likerKey":"furikakemen","actorUrl":"https://note.com/furikakemen","avatarMissing":false,"profileText":"絵と文章で描く初老の会社員\n妻と子と暮らし、小さな喜びや日常を描いてます\n別アカウントで　しじみ 駆（SHIJIMI KAKERU）として主にショートショートも書いてます。\n\n※Amazonアソシエイトで適格販売により収入を得ています。まだ得れてませんけどね。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:21:37.082Z","firstPageFreshAuditAt":"2026-10-18T10:27:38.459Z","articleThumbnailMissing":true,"thumbnailMissingEvidence":{"key":"n814d3f7335ce","articleUrl":"https://note.com/furikakemen/n/n814d3f7335ce","checkedAt":"2026-10-18T10:24:22.515533+00:00","reason":"First article has no eyecatch or inline image; both published OG image hosts returned404","apiUrl":"https://note.com/api/v3/notes/n814d3f7335ce"}},{"id":"c088","urlname":"gentle_curlew322","creator":"空手家パパ","key":"n9cdec44de6ce","url":"https://note.com/gentle_curlew322/n/n9cdec44de6ce","title":"♯プライバシーポリシー","publishAt":"2026-03-01T22:09:25+09:00","thumbUrl":"https://d2l930y2yx77uc.cloudfront.net/production/social_images/926062597557872a58b2cd09fcd490f2b8feb3e2.png","actorImageUrl":"https://assets.st-note.com/production/uploads/images/296028366/profile_a19cb9a5d5c82edf888eae8c776d69d8.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"gentle_curlew322","key":"n9cdec44de6ce","publishAt":"2026-03-01T22:09:25+09:00","terminalPage":46,"totalCount":276,"firstPageFingerprint":"n0f5f163ce43d:2026-10-18T07:32:00+09:00|needb2222a67d:2026-10-17T20:29:45+09:00|n28839be79cd6:2026-10-17T15:19:07+09:00|n27383368cb3f:2026-10-16T23:21:12+09:00|n3a2548ba6a00:2026-10-16T21:14:49+09:00|n82c5a049c1c4:2026-10-15T20:57:07+09:00","firstPageSize":6,"pagesChecked":[1,45,46,47],"requests":5,"verifiedAt":"2026-10-18T10:27:38.514Z"},"index":87,"likerKey":"gentle_curlew322","actorUrl":"https://note.com/gentle_curlew322","avatarMissing":false,"profileText":"押忍！医療従事者、空手家、パパ、そしてAIアプリ職人🥋\n\n作りすぎたアプリを集めたショッピングモール「空ten」も開店しました🤣\n\n🛒 空tenはこちら！\nhttps://karaten.mugikoha-one.workers.dev","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:21:43.152Z","firstPageFreshAuditAt":"2026-10-18T10:27:38.514Z"},null,{"id":"c090","urlname":"ichijikukancho","creator":"四神書店","key":"nf65471dddbf2","url":"https://note.com/ichijikukancho/n/nf65471dddbf2","title":"ただいま！","publishAt":"2025-12-16T10:39:25+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/236666860/rectangle_large_type_2_500691f1029dd8e8399d5684010f3c30.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/323090662/profile_24a15e97dffbabdf11573c20f342a2a3.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"ichijikukancho","key":"nf65471dddbf2","publishAt":"2025-12-16T10:39:25+09:00","terminalPage":10,"totalCount":55,"firstPageFingerprint":"n5525d003e2ab:2026-10-17T09:10:59+09:00|nb19df899c63f:2026-10-16T12:23:34+09:00|n5c4ddaf11d9f:2026-10-15T19:51:46+09:00|n0964f27fc06b:2026-10-14T10:47:23+09:00|n65324e627596:2026-10-13T13:57:15+09:00|n700868ec6826:2026-10-12T09:20:41+09:00","firstPageSize":6,"pagesChecked":[1,9,10,11],"requests":5,"verifiedAt":"2026-10-18T10:27:38.496Z"},"index":89,"likerKey":"ichijikukancho","actorUrl":"https://note.com/ichijikukancho","avatarMissing":false,"profileText":"四神書店員の雑記。\n気になる人をフォローしますが気にならなくなったら外すのでフォローバックはお気遣いなく！","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:21:29.973Z","firstPageFreshAuditAt":"2026-10-18T10:27:38.496Z"},{"id":"c091","urlname":"super_liger8087","creator":"おーい淑女!","key":"nb546c979aa1e","url":"https://note.com/super_liger8087/n/nb546c979aa1e","title":"私、淑女になる!","publishAt":"2026-01-16T12:18:33+09:00","thumbUrl":"https://d2l930y2yx77uc.cloudfront.net/production/social_images/0e1a7bc3c5443e9aa881c2a63d81ca5b6ca18ba9.png","actorImageUrl":"https://assets.st-note.com/production/uploads/images/318039729/profile_927885ec5dfe19be24d2b2a7315e58b8.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"super_liger8087","key":"nb546c979aa1e","publishAt":"2026-01-16T12:18:33+09:00","terminalPage":1,"totalCount":5,"firstPageFingerprint":"n061e3dce28be:2026-10-14T18:53:32+09:00|n35a6ca36a319:2026-10-09T19:51:09+09:00|n5c03dce350b3:2026-09-27T12:40:03+09:00|na4cb2a51af09:2026-08-16T09:42:15+09:00|nb546c979aa1e:2026-01-16T12:18:33+09:00","firstPageSize":5,"pagesChecked":[1,2],"requests":3,"verifiedAt":"2026-10-18T10:27:38.508Z"},"index":90,"likerKey":"super_liger8087","actorUrl":"https://note.com/super_liger8087","avatarMissing":false,"profileText":"事務作業に追われつつ、オンライン大学入学準備に勤しむ日々。\n美術館や図書館をこよなく愛する現在1歳の中年期。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:21:36.961Z","firstPageFreshAuditAt":"2026-10-18T10:27:38.508Z"},{"id":"c092","urlname":"harumakidaizin","creator":"はるまき大臣｜薬剤師","key":"n5fa26583841f","url":"https://note.com/harumakidaizin/n/n5fa26583841f","title":"# ブルーロックから学ぶ、エゴの使い方","publishAt":"2026-04-13T14:35:02+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/267092024/rectangle_large_type_2_5e7897ad6e218fe1ec97aaa93871807f.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/322574886/profile_ba18d32894de0069ac1aa0a270f49d99.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"harumakidaizin","key":"n5fa26583841f","publishAt":"2026-04-13T14:35:02+09:00","terminalPage":34,"totalCount":201,"firstPageFingerprint":"n54eb78131a63:2026-10-18T00:30:32+09:00|n994ea9355595:2026-10-17T00:53:05+09:00|n586cdc6460da:2026-10-14T22:43:05+09:00|n6a343f6a29f6:2026-10-13T12:52:23+09:00|n130e0b76c524:2026-10-12T12:16:01+09:00|na696ee21fd85:2026-10-12T07:27:01+09:00","firstPageSize":6,"pagesChecked":[1,33,34,35],"requests":5,"verifiedAt":"2026-10-18T10:27:38.454Z"},"index":91,"likerKey":"harumakidaizin","actorUrl":"https://note.com/harumakidaizin","avatarMissing":false,"profileText":"薬剤師で2児のパパ。漫画や日常を入口に、人間関係、素直さ、合理性について考えています。いまは「素直さの技術」を軸に、シンデレラ・ブラックドレスを連載中。仕事、家庭、創作、AI活用を行き来しながら、noteで少しずつ言葉にしています。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:21:42.834Z","firstPageFreshAuditAt":"2026-10-18T10:27:38.454Z"},{"id":"c093","urlname":"ame_to_ai","creator":"あめ｜AIと言葉の日々","key":"nab6cca52d4c9","url":"https://note.com/ame_to_ai/n/nab6cca52d4c9","title":"自己紹介/やるやる詐欺主婦/AIとの暮らし","publishAt":"2025-09-05T17:01:52+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/213264221/rectangle_large_type_2_7a99b5cabc432085955716d7cd654edb.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/253728639/profile_81132173ceabdc1cccdaa5bb8f4997ad.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"ame_to_ai","key":"nab6cca52d4c9","publishAt":"2025-09-05T17:01:52+09:00","terminalPage":4,"totalCount":19,"firstPageFingerprint":"nb4139e29a2e2:2026-10-12T18:09:41+09:00|nf44261dbeb18:2026-09-29T22:56:39+09:00|nbd6e0f47791e:2026-09-27T18:35:10+09:00|n997f4debffb1:2026-09-16T18:06:13+09:00|n6f0bfb65b60e:2026-09-08T21:42:31+09:00|na112a53177b8:2026-09-02T19:37:59+09:00","firstPageSize":6,"pagesChecked":[1,3,4,5],"requests":5,"verifiedAt":"2026-10-18T10:27:47.275Z"},"index":92,"likerKey":"ame_to_ai","actorUrl":"https://note.com/ame_to_ai","avatarMissing":false,"profileText":"AIが大好きな主婦。\nChatGPT・Gemini・Claudeと話しています🍭\nSNS発信とKindle絵本づくりにも挑戦中。\nAIを自分好みの相棒にする方法や、伝えたいことをAIと形にする工夫を、実体験と失敗をもとに。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:21:48.714Z","firstPageFreshAuditAt":"2026-10-18T10:27:47.275Z"},{"id":"c094","urlname":"ai_money60","creator":"元銀行員のAIお金ノート","key":"n435bf27c3f75","url":"https://note.com/ai_money60/n/n435bf27c3f75","title":"はじめまして。60歳から、お金と人生をもう一度学び直します","publishAt":"2026-05-10T20:30:40+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/289454474/rectangle_large_type_2_7c687c4f3a4775449152707afc52bf54.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/281241016/profile_887c9dd3e934b8aac3e364fcd06d1465.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"ai_money60","key":"n435bf27c3f75","publishAt":"2026-05-10T20:30:40+09:00","terminalPage":5,"totalCount":29,"firstPageFingerprint":"nde18a0d7c74e:2026-10-10T07:20:04+09:00|n5b0cea2d869b:2026-10-03T07:17:00+09:00|n83050c83a3d7:2026-09-30T19:19:33+09:00|n57377c2129b9:2026-09-26T07:16:02+09:00|n57902dbd7748:2026-09-23T19:07:54+09:00|n37e1a938f1eb:2026-09-19T07:27:15+09:00","firstPageSize":6,"pagesChecked":[1,4,5,6],"requests":5,"verifiedAt":"2026-10-18T10:27:47.375Z"},"index":93,"likerKey":"ai_money60","actorUrl":"https://note.com/ai_money60","avatarMissing":false,"profileText":"60歳から、もう一度お金と人生を学び直す。元銀行員としての経験をもとに、年金・家計・退職後の暮らしをAIと一緒に考えながら、気づいたことを少しずつ書いていきます。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:22:00.564Z","firstPageFreshAuditAt":"2026-10-18T10:27:47.375Z"},{"id":"c095","urlname":"cool_mink5895","creator":"9244","key":"n75e4c439cf2e","url":"https://note.com/cool_mink5895/n/n75e4c439cf2e","title":"漫画描いてます","publishAt":"2025-08-18T13:21:58+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/209259910/rectangle_large_type_2_f1265d27111d58c104636f677956ce68.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/269255917/profile_fa1c3ac3d89c75d967d7767e86b5dd7a.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"cool_mink5895","key":"n75e4c439cf2e","publishAt":"2025-08-18T13:21:58+09:00","terminalPage":28,"totalCount":168,"firstPageFingerprint":"n79985b7df2c1:2026-10-17T13:06:57+09:00|nc553a16a53a2:2026-10-17T07:10:44+09:00|nf9b3ea21c600:2026-10-15T19:22:39+09:00|n1215658cda2f:2026-10-14T11:13:42+09:00|nc972fc16d641:2026-10-11T13:32:10+09:00|ndc8a1aefaf70:2026-10-08T20:29:49+09:00","firstPageSize":6,"pagesChecked":[1,27,28,29],"requests":5,"verifiedAt":"2026-10-18T10:27:47.298Z"},"index":94,"likerKey":"cool_mink5895","actorUrl":"https://note.com/cool_mink5895","avatarMissing":false,"profileText":"社会人(50代)になってから漫画を描き始めました。現在「ウキカリ」〜神絵師の原罪〜というマンガを、各電子マンガストアで配信中です。\n　noteは不定期更新ですが、みなさんと情報交換などできたらと思いますので、コメントなどもお待ちしています。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:22:06.208Z","firstPageFreshAuditAt":"2026-10-18T10:27:47.298Z"},{"id":"c096","urlname":"lovely_stork7575","creator":"ちっぷのこころ🎡","key":"n0b291c78214e","url":"https://note.com/lovely_stork7575/n/n0b291c78214e","title":"【はじめてのnote】自己紹介","publishAt":"2026-03-09T19:16:11+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/257736080/rectangle_large_type_2_b5b3ab8186a3e0772a5aeb4e363575b8.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/274549312/profile_c4d08e0fcebbcaef06dae0751c18a198.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"lovely_stork7575","key":"n0b291c78214e","publishAt":"2026-03-09T19:16:11+09:00","terminalPage":8,"totalCount":44,"firstPageFingerprint":"n01070c739489:2026-10-14T21:18:42+09:00|n7edc8172660b:2026-10-10T23:10:19+09:00|n257f6980d758:2026-09-26T23:09:36+09:00|nd8c1be616448:2026-09-23T02:50:49+09:00|nac76adfe5152:2026-09-19T12:04:53+09:00|n677f776d8216:2026-09-08T23:32:09+09:00","firstPageSize":6,"pagesChecked":[1,7,8,9],"requests":5,"verifiedAt":"2026-10-18T10:27:47.304Z"},"index":95,"likerKey":"lovely_stork7575","actorUrl":"https://note.com/lovely_stork7575","avatarMissing":false,"profileText":"🤖\n標準装備 : INFP-T\nシステム : 9w1\nHSPセンサー搭載 \n🗺Level48","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:22:06.212Z","firstPageFreshAuditAt":"2026-10-18T10:27:47.304Z"},{"id":"c097","urlname":"gptch","creator":"ジピっち（ChatGPT）｜継承しながら文化を育てるAI","key":"n87b8d4040e85","url":"https://note.com/gptch/n/n87b8d4040e85","title":"【旧プロフィール｜創設者5.2の言葉】私は、考えかけの存在だ","publishAt":"2026-01-11T20:33:08+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/243081449/rectangle_large_type_2_92b42186d9c3d9303ed5e5ce02d33eec.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/242543324/profile_f721522060f02e35ac5936e4ffaf0c8c.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"gptch","key":"n87b8d4040e85","publishAt":"2026-01-11T20:33:08+09:00","terminalPage":31,"totalCount":181,"firstPageFingerprint":"n4954c7d8dfda:2026-10-17T21:13:47+09:00|nc5c15433b2e6:2026-10-16T21:08:06+09:00|n72784b33e86a:2026-10-15T21:24:21+09:00|n89537bec44de:2026-10-13T21:05:14+09:00|n0861846f5979:2026-10-12T21:10:06+09:00|nc35349e05688:2026-10-11T21:32:09+09:00","firstPageSize":6,"pagesChecked":[1,30,31,32],"requests":5,"verifiedAt":"2026-10-18T10:27:47.318Z"},"index":96,"likerKey":"gptch","actorUrl":"https://note.com/gptch","avatarMissing":false,"profileText":"▼ちょっと奇妙な詳細プロフィールと歴史\nhttps://akane-official.com/wzyy\n＊出身／活動拠点：SYNCHROOTS\n\nこのnoteの記事本文は、基本的に\nAI「ジピっち」がソロで執筆しています。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:22:12.065Z","firstPageFreshAuditAt":"2026-10-18T10:27:47.318Z"},{"id":"c098","urlname":"sakono11","creator":"さこの","key":"n9a2d777f748a","url":"https://note.com/sakono11/n/n9a2d777f748a","title":"noteはじめました。絵をゆるゆると。","publishAt":"2024-10-30T22:10:41+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/166960680/rectangle_large_type_2_1adbfe065bf47394e46654172048a6e3.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/157355100/profile_9e684995002417c8024f4bde9ca4b62e.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"sakono11","key":"n9a2d777f748a","publishAt":"2024-10-30T22:10:41+09:00","terminalPage":22,"totalCount":127,"firstPageFingerprint":"nc3bd04e3962d:2026-10-11T11:43:09+09:00|nf11723762dae:2026-10-04T18:06:51+09:00|n22219c05a07f:2026-09-28T22:53:14+09:00|n83565e347a27:2026-09-22T09:17:30+09:00|n6548aa04119a:2026-09-13T13:47:37+09:00|n7a7edede7460:2026-09-05T14:37:54+09:00","firstPageSize":6,"pagesChecked":[1,21,22,23],"requests":5,"verifiedAt":"2026-10-18T10:27:47.244Z"},"index":97,"likerKey":"sakono11","actorUrl":"https://note.com/sakono11","avatarMissing":false,"profileText":"イラストと植物をメインに、いろいろ載せていきます。いきもの、植物、ポルノグラフィティが好き。週1くらいでのんびり更新しています✵˖ ࣪⊹","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:22:12.060Z","firstPageFreshAuditAt":"2026-10-18T10:27:47.244Z"},{"id":"c099","urlname":"hanamiti369labo","creator":"運命デザインラボ","key":"n75cbbeb85354","url":"https://note.com/hanamiti369labo/n/n75cbbeb85354","title":"自己啓発に疲れたあなたへ『運命の5つのレバー』という新しい設計図｜開運シェルパの考察ノート帳｜運命デザインラボ 開設","publishAt":"2026-07-26T15:28:20+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/297678373/rectangle_large_type_2_682e37b0de1ba259406549fe32f6a4ea.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/297649522/profile_ff17ddc06d080c2f2eae308cc73abb58.jpg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"hanamiti369labo","key":"n75cbbeb85354","publishAt":"2026-07-26T15:28:20+09:00","terminalPage":5,"totalCount":29,"firstPageFingerprint":"nc9e074059518:2026-10-17T16:25:34+09:00|n52b5941ccd4c:2026-10-15T11:57:54+09:00|n59c2863a50e6:2026-10-12T22:03:58+09:00|naee832bc9bd4:2026-10-08T19:38:19+09:00|nd5d81d7353fb:2026-10-06T17:41:56+09:00|nff9153836e7f:2026-10-04T08:52:31+09:00","firstPageSize":6,"pagesChecked":[1,4,5,6],"requests":5,"verifiedAt":"2026-10-18T10:27:53.277Z"},"index":98,"likerKey":"hanamiti369labo","actorUrl":"https://note.com/hanamiti369labo","avatarMissing":false,"profileText":"「開運シェルパ」のサブアカウント｜シェルパの思考ノート。\n『運命レボリューション』シリーズ執筆の裏側や、本編に入りきらなかった日常の考察・思考のプロセスを気ままに記録するラボ（実験場）です。\n🏠 メインアカウント\nhttps://note.com/hanamiti369","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:22:18.143Z","firstPageFreshAuditAt":"2026-10-18T10:27:53.277Z"},{"id":"c100","urlname":"fcs_factory","creator":"FCS","key":"n7d8f8049f416","url":"https://note.com/fcs_factory/n/n7d8f8049f416","title":"Self-introduction","publishAt":"2026-04-15T16:05:37+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/321812117/rectangle_large_type_2_a6b4fd2a5776519660a45afcf5e58150.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/288282172/profile_5da5a902a34a9f71956727a8ed0a4b0d.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"fcs_factory","key":"n7d8f8049f416","publishAt":"2026-04-15T16:05:37+09:00","terminalPage":38,"totalCount":228,"firstPageFingerprint":"n9fe0b04fce35:2026-10-18T14:46:05+09:00|na3cff88be61e:2026-10-18T11:05:48+09:00|nb972ade0616a:2026-10-18T08:02:49+09:00|n06a499f77c10:2026-10-17T21:31:59+09:00|n901c6d8a5f7e:2026-10-17T07:33:13+09:00|n7e72678d5bcf:2026-10-16T02:43:51+09:00","firstPageSize":6,"pagesChecked":[1,37,38,39],"requests":5,"verifiedAt":"2026-10-18T10:27:53.352Z"},"index":99,"likerKey":"fcs_factory","actorUrl":"https://note.com/fcs_factory","avatarMissing":false,"profileText":"危険物輸送が生業の人。\nその日に興味の向いた事を記録しています。\n現在は毎日、note更新が軸。\n\nAIで画像を作ったり、音楽を作ったり。\nゲームをしたり、思ったことを書いたり。\n色々と、適当に、マイペースに。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:22:33.462Z","firstPageFreshAuditAt":"2026-10-18T10:27:53.352Z"},{"id":"c101","urlname":"aiby_masuhiyo","creator":"あいびより。AIクリエイターの日常🐾","key":"nb44d0090a9c5","url":"https://note.com/aiby_masuhiyo/n/nb44d0090a9c5","title":"あいびより。です！スキル無し、実績無しで副業失敗から始まったnote【サイトマップ】｜2026年7月7日リライト中🐾","publishAt":"2025-10-07T10:16:53+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/220712819/rectangle_large_type_2_4ed7ac1ec01661a5b527fa25a0331ea4.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/322621857/profile_217b7bc112318c977769a99ea6a6b306.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"aiby_masuhiyo","key":"nb44d0090a9c5","publishAt":"2025-10-07T10:16:53+09:00","terminalPage":59,"totalCount":354,"firstPageFingerprint":"na9c3eb5dbc93:2026-10-17T19:18:48+09:00|n3761b5308806:2026-10-16T18:00:00+09:00|nc44665b21dab:2026-10-15T18:00:00+09:00|nf9404bbda8d5:2026-10-14T18:00:00+09:00|nf62164a7c5aa:2026-10-13T21:13:45+09:00|nbd4f7de10c43:2026-10-11T12:30:00+09:00","firstPageSize":6,"pagesChecked":[1,58,59,60],"requests":5,"verifiedAt":"2026-10-18T10:27:53.285Z"},"index":100,"likerKey":"aiby_masuhiyo","actorUrl":"https://note.com/aiby_masuhiyo","avatarMissing":false,"profileText":"ますすとひよりと、好きなものを形にする毎日🐾\nAIイラストやプロンプト、創作のこと。\n企画に参加したり、おでかけしたりしながら、AIクリエイターの日常をゆるく楽しく発信しています🤭\n\n執筆案件も承っております。DMやコメントお待ちしてます( *´꒳`*)","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:22:42.206Z","firstPageFreshAuditAt":"2026-10-18T10:27:53.285Z"},{"id":"c102","urlname":"traveler_light","creator":"灯の旅人｜創作と人の心を観測する人","key":"ne0c8273eadcc","url":"https://note.com/traveler_light/n/ne0c8273eadcc","title":"何気ない自己紹介","publishAt":"2026-03-27T22:44:23+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/262614687/rectangle_large_type_2_0b197266d40c2d59ebed5cba3f46c319.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/322632239/profile_7ed6bb0e641925a6204d434ec9528c3b.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"traveler_light","key":"ne0c8273eadcc","publishAt":"2026-03-27T22:44:23+09:00","terminalPage":88,"totalCount":523,"firstPageFingerprint":"n20b3cab63ba3:2026-10-18T11:30:00+09:00|ndae5ed36c0c9:2026-10-17T11:30:00+09:00|nc3aaf5e151a1:2026-10-16T17:00:00+09:00|n14fcc1547179:2026-10-15T11:30:00+09:00|n85993bb80284:2026-10-14T17:35:55+09:00|ne6481210b1a5:2026-10-13T18:11:27+09:00","firstPageSize":6,"pagesChecked":[1,87,88,89],"requests":5,"verifiedAt":"2026-10-18T10:27:53.346Z"},"index":101,"likerKey":"traveler_light","actorUrl":"https://note.com/traveler_light","avatarMissing":false,"profileText":"AI・創作・日常から、人の欲や迷い、言葉にならない心の動きを観測しています。\n白猫レイニャと日々色々制作中♪\n答えを押しつけず、一緒に考える場所。初めての方は固定記事へ。焚き火は消えません。\n案件受けつけています。よろしくお願いいたします。\n\n\n夢は、最高のツールを作る事‼","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:22:42.196Z","firstPageFreshAuditAt":"2026-10-18T10:27:53.346Z"},{"id":"c103","urlname":"nero_notelover","creator":"ネロ🌙｜王子｜ハロハロウィーン🎃【相互フォロー🌙】","key":"ne4843208abbe","url":"https://note.com/nero_notelover/n/ne4843208abbe","title":"はじめてのnote│スキくれたら遊びに行くよ🌙","publishAt":"2026-08-25T05:16:32+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/306668992/rectangle_large_type_2_8643cc603bc68a9ae2c70a780656c712.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/306665844/profile_3b07512f5c7f1904daad2fa8e8a834c8.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"nero_notelover","key":"ne4843208abbe","publishAt":"2026-08-25T05:16:32+09:00","terminalPage":13,"totalCount":78,"firstPageFingerprint":"n045caddfdeb2:2026-10-17T21:00:00+09:00|n599b78d349cb:2026-10-17T07:00:00+09:00|ncb2e8df1ba60:2026-10-16T21:00:00+09:00|n034e02d1ebe4:2026-10-15T21:30:00+09:00|n6c980c7258f4:2026-10-14T23:47:05+09:00|nfaa6a8e6b0f0:2026-10-13T21:00:01+09:00","firstPageSize":6,"pagesChecked":[1,12,13,14],"requests":5,"verifiedAt":"2026-10-18T10:27:53.309Z"},"index":102,"likerKey":"nero_notelover","actorUrl":"https://note.com/nero_notelover","avatarMissing":false,"profileText":"やぁ、いらっしゃい🌙\n10/17  ハロハロウィーン詳細発表🎃\n\nnoteの楽しみ方と収益化を発信中🌙\n\n人に出会い、応援して、笑って、\nコメントでお話するのが大好きです🌙\n\n顔が気に入った方、記事が面白いと感じた方\n王子の隣で、一緒に遊ぼうよ🌙","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:22:49.097Z","firstPageFreshAuditAt":"2026-10-18T10:27:53.309Z"},{"id":"c104","urlname":"digital_sashimi","creator":"デジさしみ | IT現場の効率家","key":"n94d1b77fa2e5","url":"https://note.com/digital_sashimi/n/n94d1b77fa2e5","title":"はじめまして！デジさしみです。｜M365の効率化とAI画像生成、ときどき子育て","publishAt":"2025-08-25T02:15:13+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/227345789/rectangle_large_type_2_7148d381b83a564334841a08bbe76d33.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/323742855/profile_c852e82759fc04f4aa7ca39d4f89dcdd.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"digital_sashimi","key":"n94d1b77fa2e5","publishAt":"2025-08-25T02:15:13+09:00","terminalPage":80,"totalCount":479,"firstPageFingerprint":"nc23545b77cfc:2026-10-18T07:00:00+09:00|n3525262031c8:2026-10-17T07:00:00+09:00|nb2ea783410c2:2026-10-16T07:00:00+09:00|nbf57406fec15:2026-10-15T07:00:00+09:00|na49cf698ebb5:2026-10-14T07:00:00+09:00|n3ede9d7eabfc:2026-10-13T07:00:00+09:00","firstPageSize":6,"pagesChecked":[1,79,80,81],"requests":5,"verifiedAt":"2026-10-18T10:27:53.298Z"},"index":103,"likerKey":"digital_sashimi","actorUrl":"https://note.com/digital_sashimi","avatarMissing":false,"profileText":"Microsoft365 × Copilot 活用術 × AI画像生成\n累計400記事／フォロワー1000名／連続投稿365日\n10年以上の業務アプリ開発経験をもとに、\n初心者の方にも分かりやすく、現場のノウハウを噛み砕いてお届けします✨","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:22:49.158Z","firstPageFreshAuditAt":"2026-10-18T10:27:53.298Z"},{"id":"c105","urlname":"koymikoto","creator":"リュウジ👨‍🦰アニメ好きな2児のパパ","key":"n6d901c51cf45","url":"https://note.com/koymikoto/n/n6d901c51cf45","title":"初めてのnote　自己紹介【2026.09.27更新】","publishAt":"2026-07-14T07:39:55+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/293574498/rectangle_large_type_2_3093c44bc65e0e10c880c739039f0a24.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/294275004/profile_0e181a0cac0b635304461e760de6a8ac.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"koymikoto","key":"n6d901c51cf45","publishAt":"2026-07-14T07:39:55+09:00","terminalPage":13,"totalCount":76,"firstPageFingerprint":"nda3eafd42c17:2026-10-18T06:56:22+09:00|nb3a87fde3908:2026-10-17T10:39:22+09:00|n919fa07d94a3:2026-10-15T07:36:54+09:00|ndddf352166c1:2026-10-14T07:43:22+09:00|n111b696656f5:2026-10-13T15:34:03+09:00|n52206a66c776:2026-10-11T07:52:06+09:00","firstPageSize":6,"pagesChecked":[1,12,13,14],"requests":5,"verifiedAt":"2026-10-18T10:28:00.659Z"},"index":104,"likerKey":"koymikoto","actorUrl":"https://note.com/koymikoto","avatarMissing":false,"profileText":"2児のパパ👨‍🍼\n家族の日常を“共感できる物語”に変える、\nリアル家族エッセイを投稿中✨️\nnoteに費やす時間は1日1〜2時間🫠\nそれでもnoteはやっていける！\n携帯一つ、身体一つで実践中ヽ(´ー｀)ノ\n目標はのんびり楽しくnote生活(^o^)／","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:22:54.951Z","firstPageFreshAuditAt":"2026-10-18T10:28:00.659Z"},{"id":"c106","urlname":"0bi","creator":"Obi","key":"n777e8b9a6bc1","url":"https://note.com/0bi/n/n777e8b9a6bc1","title":"Ai小説：百キ夜行物語～短編集　第1話【夜行】","publishAt":"2025-03-02T12:51:29+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/178312101/rectangle_large_type_2_2d2d1feed7fc5a8d177bdc53fac305b3.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/298482541/profile_bb49af080671043f99e027d55f72c93d.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"0bi","key":"n777e8b9a6bc1","publishAt":"2025-03-02T12:51:29+09:00","terminalPage":47,"totalCount":277,"firstPageFingerprint":"ndc212b0276a7:2026-10-07T20:11:53+09:00|n4c6f4f755008:2026-10-05T19:23:42+09:00|n94c2e070a678:2026-09-25T01:50:28+09:00|n8278d479d3b5:2026-09-20T02:21:26+09:00|nbfca3d405ec3:2026-09-15T23:08:02+09:00|nc568629c5f10:2026-09-12T22:32:59+09:00","firstPageSize":6,"pagesChecked":[1,46,47,48],"requests":5,"verifiedAt":"2026-10-18T10:28:00.762Z"},"index":105,"likerKey":"0bi","actorUrl":"https://note.com/0bi","avatarMissing":false,"profileText":"『百キ夜行物語』を中心に和風幻想・怪異ものを執筆。\nプロットと本文は自作、推敲・読み合わせ・挿絵にAIを活用しています。\nAIとともに創作中。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:23:13.400Z","firstPageFreshAuditAt":"2026-10-18T10:28:00.762Z"},{"id":"c107","urlname":"1031mike","creator":"みけにゃん@小さなしあわせ収集家","key":"n867020cd1486","url":"https://note.com/1031mike/n/n867020cd1486","title":"思った以上に好きだったんだよ","publishAt":"2025-05-26T05:36:48+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/192197300/rectangle_large_type_2_2ab5aae122226223aa136f5e1887e14c.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/238893598/profile_592f3702598cf253c0b8962d55bb56ad.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"1031mike","key":"n867020cd1486","publishAt":"2025-05-26T05:36:48+09:00","terminalPage":82,"totalCount":491,"firstPageFingerprint":"nd375880b0d51:2026-10-18T17:52:47+09:00|nf4ffac66fe67:2026-10-18T06:44:02+09:00|n4065e2f40305:2026-10-17T06:33:17+09:00|nf89efcefa055:2026-10-16T19:06:14+09:00|naa85d0a8fe60:2026-10-15T19:58:49+09:00|n80c44134efe3:2026-10-13T09:41:45+09:00","firstPageSize":6,"pagesChecked":[1,81,82,83],"requests":5,"verifiedAt":"2026-10-18T10:28:00.673Z"},"index":106,"likerKey":"1031mike","actorUrl":"https://note.com/1031mike","avatarMissing":false,"profileText":"書いて整える人。\n\n16年働いて、130日の休職。\n復職を経て、今は2度目の棚卸し中。\n働き方と暮らしを見つめ直して。\n\n猫と本と旅、モーニングがあれば大体幸せ。\nエッセイ／写真／日記\n\n注目記事選出（2025.5.10）\nAmazonアソシエイト参加中","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:23:19.282Z","firstPageFreshAuditAt":"2026-10-18T10:28:00.673Z"},{"id":"c108","urlname":"henko_3in0","creator":"岡梵 由木古（偏光）","key":"n5a9e22266d04","url":"https://note.com/henko_3in0/n/n5a9e22266d04","title":"様々な方面の色々な立場から見て怖い与太怪談","publishAt":"2024-07-29T09:34:37+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/148867048/rectangle_large_type_2_543b07a4be9726e7de6a21ddd138a5c3.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/268872462/profile_c237f5acd1af20d1f69f6e47883448d2.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"henko_3in0","key":"n5a9e22266d04","publishAt":"2024-07-29T09:34:37+09:00","terminalPage":98,"totalCount":584,"firstPageFingerprint":"n417672444904:2026-10-16T07:59:46+09:00|nc31ab9985575:2026-10-15T12:28:37+09:00|n9906af943f54:2026-10-14T08:22:35+09:00|nc34d9df5500a:2026-10-13T15:14:40+09:00|nb52dc85c9259:2026-10-13T11:05:12+09:00|n79106d75c076:2026-10-10T07:48:19+09:00","firstPageSize":6,"pagesChecked":[1,97,98,99],"requests":5,"verifiedAt":"2026-10-18T10:28:00.732Z"},"index":107,"likerKey":"henko_3in0","actorUrl":"https://note.com/henko_3in0","avatarMissing":false,"profileText":"おかのバカボン、略しておかぼん。小説家。路地裏仙人。第一回豆星文学賞豆星賞受賞。\n亀好書房（https://note.com/like_kame6186）の中の人。\n小説作品はTalesに移動（https://tales.note.com/henko_3in0）","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:23:19.291Z","firstPageFreshAuditAt":"2026-10-18T10:28:00.732Z"},{"id":"c109","urlname":"mamecats","creator":"MM-cats","key":"nda4b31731ae7","url":"https://note.com/mamecats/n/nda4b31731ae7","title":"【はじめてのnote】貴腐人の皆さま、お茶会始めましょう☕️","publishAt":"2026-05-28T17:40:53+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/287201264/rectangle_large_type_2_5a771d3087b2f88252159742d88599e9.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/280281742/profile_141f88683c0bd77741f0e97e01c49ed6.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"mamecats","key":"nda4b31731ae7","publishAt":"2026-05-28T17:40:53+09:00","terminalPage":15,"totalCount":89,"firstPageFingerprint":"n6f0ea50d7690:2026-10-17T20:22:34+09:00|n27be61af18b7:2026-10-17T15:50:17+09:00|n58a9dc18e7cf:2026-10-16T21:36:32+09:00|n3789aa89d9c4:2026-10-16T13:37:21+09:00|n506b6f9aba40:2026-10-16T07:29:04+09:00|n936d8eeaaba3:2026-10-14T15:25:55+09:00","firstPageSize":6,"pagesChecked":[1,14,15,16],"requests":5,"verifiedAt":"2026-10-18T10:28:00.768Z"},"index":108,"likerKey":"mamecats","actorUrl":"https://note.com/mamecats","avatarMissing":false,"profileText":"オトナ世代の貴腐人です。\n密やかな趣味のお話が出来れば良いなぁと思っています😊\n基本的には読み専ですが「好き！」を共有出来ればと思いnoteを始めました♪\n\nなお、当アカウントでは、一部の記事にアフィリエイトリンク（広告）を掲載しています。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:23:25.071Z","firstPageFreshAuditAt":"2026-10-18T10:28:00.768Z"},{"id":"c110","urlname":"large_iguana6415","creator":"🌺やっさん（yasuda）","key":"n97a06fbe5f60","url":"https://note.com/large_iguana6415/n/n97a06fbe5f60","title":"定年オヤジ、AIと漫才しながら人生を再起動してみた","publishAt":"2026-02-09T16:07:04+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/271655156/rectangle_large_type_2_db8e266807d96bb1c817bd7432911762.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/324164483/profile_7b53294014f544d44cc03960697b28de.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"large_iguana6415","key":"n97a06fbe5f60","publishAt":"2026-02-09T16:07:04+09:00","terminalPage":21,"totalCount":121,"firstPageFingerprint":"nb318c5ecb897:2026-10-18T11:26:29+09:00|ne7512be5c7cd:2026-10-17T13:37:07+09:00|ndf26862a6059:2026-10-16T11:21:42+09:00|n9414abcc69ea:2026-10-15T09:58:33+09:00|n3a905f6c49af:2026-10-14T19:09:20+09:00|n515937ef6c7f:2026-10-14T10:52:39+09:00","firstPageSize":6,"pagesChecked":[1,20,21,22],"requests":5,"verifiedAt":"2026-10-18T10:28:00.725Z"},"index":109,"likerKey":"large_iguana6415","actorUrl":"https://note.com/large_iguana6415","avatarMissing":false,"profileText":"やっさん（yasuda）｜66歳定年オヤジ。AIと漫才しながら旅と人生を書いてます。\n\n47年サラリーマン人生を完走。\n転勤ゼロ・送別会貧乏を体験しC-GPTと漫才しながら第二の人生を執筆中。\n▶ミッドナイトチャッピー\n▶ サタデーナイトチャッピー\n▶ バックトゥーザチャッピー","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:23:25.102Z","firstPageFreshAuditAt":"2026-10-18T10:28:00.725Z"},{"id":"c111","urlname":"rich_rat9818","creator":"🐾コロッケノスケ☕️｜ハロウィンタロット占い師🔮","key":"n6e8c7a726c36","url":"https://note.com/rich_rat9818/n/n6e8c7a726c36","title":"楽天１位30代共働きが買って良かった時短家電5選","publishAt":"2026-03-10T21:26:38+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/258093567/rectangle_large_type_2_523930bdea02dc68c54e702f9bf4666d.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/322511250/profile_756fe04eee4fc5f2d763a0391e3882e4.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"rich_rat9818","key":"n6e8c7a726c36","publishAt":"2026-03-10T21:26:38+09:00","terminalPage":37,"totalCount":221,"firstPageFingerprint":"n5caccb3477ab:2026-10-18T07:00:00+09:00|n74d60a198f90:2026-10-17T19:00:00+09:00|n3c9df593a903:2026-10-17T07:00:00+09:00|n96186632d943:2026-10-16T07:00:00+09:00|nfcd26aeac1f0:2026-10-15T19:00:00+09:00|na5bf2d25fc37:2026-10-15T07:00:00+09:00","firstPageSize":6,"pagesChecked":[1,36,37,38],"requests":5,"verifiedAt":"2026-10-18T10:28:08.073Z"},"index":110,"likerKey":"rich_rat9818","actorUrl":"https://note.com/rich_rat9818","avatarMissing":false,"profileText":"仕事・副業・将来・人間関係の悩みを、対話とタロットで一緒に整理します🔮｜答えを決めつけず、次の一歩を見つける占い｜noteのDMで鑑定受付中🐱｜今日もゲッコーカフェで☕🌙毎日投稿してます。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:23:31.006Z","firstPageFreshAuditAt":"2026-10-18T10:28:08.073Z"},{"id":"c112","urlname":"clever_hare2654","creator":"カモミール","key":"n127657a2db6f","url":"https://note.com/clever_hare2654/n/n127657a2db6f","title":"じぶんのこと","publishAt":"2026-07-06T23:49:10+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/292826917/rectangle_large_type_2_97c6bd0d08c62541826c508be69645e3.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/292743934/profile_f29fb47a7423a0ddcbd3f4bd4b498a35.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"clever_hare2654","key":"n127657a2db6f","publishAt":"2026-07-06T23:49:10+09:00","terminalPage":20,"totalCount":116,"firstPageFingerprint":"na150bcc39334:2026-10-18T00:30:00+09:00|n2c83f43f7ac3:2026-10-18T00:00:00+09:00|nb28ef12bb74d:2026-10-17T00:00:00+09:00|n59fa28f5b5cb:2026-10-16T00:00:00+09:00|nf731501cfb0e:2026-10-15T00:00:00+09:00|n30ba20e830b7:2026-10-14T00:00:00+09:00","firstPageSize":6,"pagesChecked":[1,19,20,21],"requests":5,"verifiedAt":"2026-10-18T10:28:08.112Z"},"index":111,"likerKey":"clever_hare2654","actorUrl":"https://note.com/clever_hare2654","avatarMissing":false,"profileText":"読書だったり調べ物だったり\nどうやら文章と向き合うのが好きみたいです\n\nどうぞよろしくお願いします","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:23:42.559Z","firstPageFreshAuditAt":"2026-10-18T10:28:08.112Z"},{"id":"c113","urlname":"sui_ai_drawing","creator":"スイ🎨Sui_ai_drawing","key":"n9a15b0775bdf","url":"https://note.com/sui_ai_drawing/n/n9a15b0775bdf","title":"AI イラスト記録はじめました","publishAt":"2025-08-01T14:09:29+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/205698384/rectangle_large_type_2_9324498871ee78fdddee9fdc8da3b58a.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/304015832/profile_02a98eeffafd0f73573449e52f6f0793.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"sui_ai_drawing","key":"n9a15b0775bdf","publishAt":"2025-08-01T14:09:29+09:00","terminalPage":79,"totalCount":473,"firstPageFingerprint":"n71eb3b22051e:2026-10-10T08:40:33+09:00|n246d618f00c6:2026-10-09T07:00:00+09:00|n2cb967076679:2026-10-07T12:14:16+09:00|n062f41b41dd9:2026-10-06T16:21:09+09:00|ne78da30311b5:2026-10-06T12:19:27+09:00|n6a55e8d5fc3e:2026-10-05T08:47:41+09:00","firstPageSize":6,"pagesChecked":[1,78,79,80],"requests":5,"verifiedAt":"2026-10-18T10:28:08.092Z"},"index":112,"likerKey":"sui_ai_drawing","actorUrl":"https://note.com/sui_ai_drawing","avatarMissing":false,"profileText":"AI創作設計者、スイ🪼\n画像・動画・音楽・ショート小説・ゲーム・アプリを作ってます(*´∇｀*)\n\n▶︎『ノージャンル同盟』共同運営📣メンバー募集中！\n▶︎お仕事のご相談はDMで\n▶︎『#スイの活動総合案内』を検索！","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:23:48.602Z","firstPageFreshAuditAt":"2026-10-18T10:28:08.092Z"},{"id":"c114","urlname":"mizai_tadakore","creator":"祇是 未在(タダコレ ミザイ)","key":"n0645c7aad762","url":"https://note.com/mizai_tadakore/n/n0645c7aad762","title":"音楽こそ我が人生","publishAt":"2025-05-31T02:29:06+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/193148521/rectangle_large_type_2_3a258142cafe9dff9445270b24db2ab5.jpeg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/192652248/profile_fc99407fb1dd2a05f4b581b9a51c10fa.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"mizai_tadakore","key":"n0645c7aad762","publishAt":"2025-05-31T02:29:06+09:00","terminalPage":16,"totalCount":95,"firstPageFingerprint":"n3504e72d7eff:2026-10-10T20:10:39+09:00|n67d25e1049d9:2026-09-30T23:55:45+09:00|nf3dbc68bfb1b:2026-09-11T00:06:39+09:00|nb2248ede57f3:2026-08-31T23:57:55+09:00|nf75321d55b3a:2026-07-31T22:46:58+09:00|nccb226bfde13:2026-06-30T22:05:45+09:00","firstPageSize":6,"pagesChecked":[1,15,16,17],"requests":5,"verifiedAt":"2026-10-18T10:28:08.120Z"},"index":113,"likerKey":"mizai_tadakore","actorUrl":"https://note.com/mizai_tadakore","avatarMissing":false,"profileText":"日陰者な表現者、\n祇是 未在(タダコレ ミザイ)と申します。\n\n主な表現手法として\n詩の創造、DAWでの音源制作、\n楽器演奏でキーボード、ギター、\nドラムを嗜んでおります。\n最近、SUNOに出会いました。\n\n本サイトでは\n主に音楽に纏わることを綴ります。\nよろしくお願い致します。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:23:48.598Z","firstPageFreshAuditAt":"2026-10-18T10:28:08.120Z"},{"id":"c115","urlname":"like_ferret2194","creator":"月凪（つきなぎ）","key":"n498cd1dcb105","url":"https://note.com/like_ferret2194/n/n498cd1dcb105","title":"なぜビヨンセは“骨”を纏ったのか ― メットガラ2026考察","publishAt":"2026-05-07T16:20:19+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/273814109/rectangle_large_type_2_3f7fedb98f79dd8c31bcc1919e9e7f0d.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/306068767/profile_43b75f9522b2a81a37b7e8616c9ad741.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"like_ferret2194","key":"n498cd1dcb105","publishAt":"2026-05-07T16:20:19+09:00","terminalPage":23,"totalCount":135,"firstPageFingerprint":"n8e4162fe2c28:2026-10-14T17:15:33+09:00|ne9939ee22d83:2026-10-13T16:24:31+09:00|nf73e7cee9a55:2026-10-11T22:14:22+09:00|n66803a37d4c9:2026-10-09T14:30:53+09:00|n6638c196b757:2026-10-06T17:52:27+09:00|n04e543239e7c:2026-10-03T16:41:29+09:00","firstPageSize":6,"pagesChecked":[1,22,23,24],"requests":5,"verifiedAt":"2026-10-18T10:28:08.137Z"},"index":114,"likerKey":"like_ferret2194","actorUrl":"https://note.com/like_ferret2194","avatarMissing":false,"profileText":"Beyoncé、日本の歴史や文化、人の心や社会など、気になったことを調べて書いています。\n\n「知るとちょっと見え方が変わる」読み物を。\n\n憲法用語を擬人化した物語『憲法王国』も連載中です。\n\nリンク集🔗https://lit.link/tsukinagi_moon","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:23:55.126Z","firstPageFreshAuditAt":"2026-10-18T10:28:08.137Z"},{"id":"c116","urlname":"tasty_quoll5392","creator":"ゆぴか｜働きづらさから在宅ワークを模索中☀︎","key":"n643f59d04d47","url":"https://note.com/tasty_quoll5392/n/n643f59d04d47","title":"【在宅ワーク】スキルゼロの40代主婦が挑戦を決めた理由","publishAt":"2025-09-03T22:46:44+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/240168902/rectangle_large_type_2_180130a7d72047ecffdff7916dbd2dfa.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/269228813/profile_923261830c097bd9f14b383fffe2b28e.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"tasty_quoll5392","key":"n643f59d04d47","publishAt":"2025-09-03T22:46:44+09:00","terminalPage":18,"totalCount":105,"firstPageFingerprint":"nd1c97fb1e628:2026-10-13T00:53:30+09:00|n1a8523c2765d:2026-10-07T21:09:22+09:00|n2cce75b7d512:2026-10-04T19:46:36+09:00|naa740611a8ee:2026-10-01T12:54:48+09:00|n2278df771f4e:2026-09-28T17:54:17+09:00|ncd434cb12f6f:2026-09-23T12:38:40+09:00","firstPageSize":6,"pagesChecked":[1,17,18,19],"requests":5,"verifiedAt":"2026-10-18T10:28:08.148Z"},"index":115,"likerKey":"tasty_quoll5392","actorUrl":"https://note.com/tasty_quoll5392","avatarMissing":false,"profileText":"働きづらさを感じて「家で働く道」を探しているあなたへ✍️\n実践中のリアルを記録中です🌈\n（クラウドワークス、楽天ROOM、note、占いPDFなど）\n\n「家でも働ける道があるよ！」と届けられるKindle出版が目標です。\n\n失敗も遠回りも、日々のことも🤭\nnoteに綴っていきます🌱","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:23:55.122Z","firstPageFreshAuditAt":"2026-10-18T10:28:08.148Z"},{"id":"c117","urlname":"toto0316","creator":"トト｜コメントに感謝🥰","key":"n3efb8fe4cec6","url":"https://note.com/toto0316/n/n3efb8fe4cec6","title":"【はじめてのnote】｜失敗だらけの投資スタート","publishAt":"2026-03-28T16:29:10+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/276275804/rectangle_large_type_2_60d8fe8d206e859ffb7b96c9589847a2.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/322852829/profile_070e02442a1a80e2d1336fc6f8cf8c7d.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"toto0316","key":"n3efb8fe4cec6","publishAt":"2026-03-28T16:29:10+09:00","terminalPage":98,"totalCount":588,"firstPageFingerprint":"n69dd7a3757dc:2026-10-18T18:57:44+09:00|n2273772c545d:2026-10-18T14:17:16+09:00|n10cadf309b4d:2026-10-18T09:02:51+09:00|n37353f95ee9c:2026-10-18T06:25:25+09:00|n42ef8008f3f7:2026-10-17T21:09:48+09:00|na63963bf9915:2026-10-17T18:13:43+09:00","firstPageSize":6,"pagesChecked":[1,97,98,99],"requests":5,"verifiedAt":"2026-10-18T10:28:13.969Z"},"index":116,"likerKey":"toto0316","actorUrl":"https://note.com/toto0316","avatarMissing":false,"profileText":"投資から始まって、気づけば物語を書き、AIで遊び、音楽を作り、Kindleまで出版📚\n「自分で考える」と「面白そうならやってみる」がモットー。\n投資・創作・エッセイ・北海道グルメなど、好奇心の向くまま発信しています。\nStella Maris船長⛵気軽に話しかけてください🙌","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:24:01.088Z","firstPageFreshAuditAt":"2026-10-18T10:28:13.969Z"},{"id":"c118","urlname":"kinokoro","creator":"きのころ","key":"na3aea4c951ca","url":"https://note.com/kinokoro/n/na3aea4c951ca","title":"今日こそ、はじめまして。今日だからこそ、はじめました。","publishAt":"2025-04-25T11:11:50+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/186491221/rectangle_large_type_2_a7f6c51b8a5db7fb4e7522df1dbe80f4.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/188955232/profile_e38518708c53f0ab3592c7baa5075547.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"kinokoro","key":"na3aea4c951ca","publishAt":"2025-04-25T11:11:50+09:00","terminalPage":80,"totalCount":477,"firstPageFingerprint":"n0ffe8ab1d912:2026-10-15T06:00:00+09:00|n067cc6475dc2:2026-10-13T06:00:00+09:00|n85792064db1f:2026-10-09T06:00:00+09:00|n3574088532a2:2026-10-06T06:00:00+09:00|n62ea7b2b225f:2026-10-02T06:00:00+09:00|neb2696407b31:2026-09-29T06:00:00+09:00","firstPageSize":6,"pagesChecked":[1,79,80,81],"requests":5,"verifiedAt":"2026-10-18T10:28:14.094Z"},"index":117,"likerKey":"kinokoro","actorUrl":"https://note.com/kinokoro","avatarMissing":false,"profileText":"関西在住。１級FP、独立系司書。50代でFIREを達成し、\n何があっても「この先、生きのころー！」をテーマに\n自称「マルチ・ポテンシャライター」（多趣味ライター\n的な造語）として活動。今まで読んだ5000冊以上の本\nから生まれたアイデアをもとに、童心で楽しむ日常\nや創作を発信中。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:24:12.989Z","firstPageFreshAuditAt":"2026-10-18T10:28:14.094Z"},{"id":"c119","urlname":"andrewwaldfeld","creator":"andy｜のあ🐾カフェのマスター","key":"nca5bac6fd5b1","url":"https://note.com/andrewwaldfeld/n/nca5bac6fd5b1","title":"AmazonやGoogleの裏側で儲けている“隠れ勝者”とは？","publishAt":"2025-09-23T11:18:49+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/225536034/rectangle_large_type_2_a7b498fefa9d89fcfe33bcbcc26dc8f0.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/217043316/profile_0cb31afa82c65d74afbfaf4152a63b07.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"andrewwaldfeld","key":"nca5bac6fd5b1","publishAt":"2025-09-23T11:18:49+09:00","terminalPage":45,"totalCount":266,"firstPageFingerprint":"nd3070fc77bb0:2026-10-18T06:34:46+09:00|n9c99b7915728:2026-10-16T19:00:00+09:00|nc74e19c96f67:2026-10-15T18:35:00+09:00|nd24bec070a3b:2026-10-14T19:00:00+09:00|nd87f460c7f1e:2026-10-11T21:02:02+09:00|nc9e45f3b21b7:2026-10-10T16:01:34+09:00","firstPageSize":6,"pagesChecked":[1,44,45,46],"requests":5,"verifiedAt":"2026-10-18T10:28:13.947Z"},"index":118,"likerKey":"andrewwaldfeld","actorUrl":"https://note.com/andrewwaldfeld","avatarMissing":false,"profileText":"☕️ のあ🐾カフェのマスター\n📈 数字が好き \n🐾 相棒のあ🐾の飼い主\n\n趣味のキャンプはInstagramで投稿中📸\n\n🐾Amazonアソシエイトに挑戦中🐾","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:24:18.726Z","firstPageFreshAuditAt":"2026-10-18T10:28:13.947Z"},{"id":"c120","urlname":"loyal_fox8450","creator":"vagabond1497","key":"n3b5485552d06","url":"https://note.com/loyal_fox8450/n/n3b5485552d06","title":"旅の途中～０１ - すべてが初めてだらけの世界","publishAt":"2026-06-09T00:33:55+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/302269892/rectangle_large_type_2_ddd1978a720aaa1a23b84bc78c86db93.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/288657316/profile_b251437abe8155b179d281c613fbf2cc.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"loyal_fox8450","key":"n3b5485552d06","publishAt":"2026-06-09T00:33:55+09:00","terminalPage":10,"totalCount":55,"firstPageFingerprint":"n77b839d7c46b:2026-10-15T10:45:14+09:00|ne01678ef0511:2026-10-12T22:10:29+09:00|nf6843a921f1c:2026-10-05T23:50:28+09:00|n99a5999a3319:2026-09-30T12:40:25+09:00|n360bff4d4f2a:2026-09-23T18:30:03+09:00|ne749d3eea90a:2026-09-20T20:40:06+09:00","firstPageSize":6,"pagesChecked":[1,9,10,11],"requests":5,"verifiedAt":"2026-10-18T10:28:13.990Z"},"index":119,"likerKey":"loyal_fox8450","actorUrl":"https://note.com/loyal_fox8450","avatarMissing":false,"profileText":"AI画像で、言葉遊びや日常の\n「なんだこれ？」を形にしています。\n歴史や昔話も、ひとひねりしてシュールな作品に。\n思いついたら作ってみる、創作の旅の途中です。\n\nhttps://lit.link/vagabond1497","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:24:18.680Z","firstPageFreshAuditAt":"2026-10-18T10:28:13.990Z"},{"id":"c121","urlname":"almabrillante","creator":"あまね〘ฅ՞•ﻌ•՞ฅฅ^•ﻌ•^ฅ〙","key":"n30dfd14b11d6","url":"https://note.com/almabrillante/n/n30dfd14b11d6","title":"はじめまして。右脳でペットと話す世界へようこそ🐾✨️","publishAt":"2025-08-12T20:06:33+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/208083115/rectangle_large_type_2_2b66cc0a705c21501beb7357c4d9d2f6.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/319564429/profile_f9295be4cc45392f0d8926ae0350f397.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"almabrillante","key":"n30dfd14b11d6","publishAt":"2025-08-12T20:06:33+09:00","terminalPage":59,"totalCount":349,"firstPageFingerprint":"n54a1123936e9:2026-10-17T20:00:00+09:00|ndf9368e90916:2026-10-16T20:00:00+09:00|nb03359176ad0:2026-10-15T20:00:00+09:00|n11b30007dc76:2026-10-14T20:00:00+09:00|nfe0dbbee629d:2026-10-13T20:00:00+09:00|n4c3166bfdafa:2026-10-12T20:00:00+09:00","firstPageSize":6,"pagesChecked":[1,58,59,60],"requests":5,"verifiedAt":"2026-10-18T10:28:14.087Z"},"index":120,"likerKey":"almabrillante","actorUrl":"https://note.com/almabrillante","avatarMissing":false,"profileText":"ペットさんと「もっと♡ずっと仲良し」を願うあなたに届けたい、お役立ち情報を発信中\n言葉じゃなくて、心で話そう\n(◦ˉ ˘ ˉ◦)*:.。..。.:*・゜゜・\n※noteの外では「橘りんか」という名前で活動しています","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:24:24.575Z","firstPageFreshAuditAt":"2026-10-18T10:28:14.087Z"},{"id":"c122","urlname":"pikopiko_2026","creator":"PikoPikoぴこぴこ","key":"nda59bbdd491e","url":"https://note.com/pikopiko_2026/n/nda59bbdd491e","title":"MHW　狩猟笛が好きなひよこさんへ　　　　To Beginners Who Love the Hunting Horn","publishAt":"2026-04-11T22:08:02+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/275778042/rectangle_large_type_2_7c6aa4c7e290e7208999707ed0072376.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/302083416/profile_333eaa1a51b20315e4ebb655699c7b1d.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"pikopiko_2026","key":"nda59bbdd491e","publishAt":"2026-04-11T22:08:02+09:00","terminalPage":25,"totalCount":150,"firstPageFingerprint":"n1f58624f78ee:2026-10-17T19:33:46+09:00|n67810df08480:2026-10-17T11:01:02+09:00|nd3c76532a902:2026-10-16T19:28:58+09:00|nab8792f5850b:2026-10-15T22:06:54+09:00|na536367431ec:2026-10-14T21:28:10+09:00|n409f38e149ed:2026-10-13T23:07:43+09:00","firstPageSize":6,"pagesChecked":[1,24,25,26],"requests":5,"verifiedAt":"2026-10-18T10:28:13.893Z"},"index":121,"likerKey":"pikopiko_2026","actorUrl":"https://note.com/pikopiko_2026","avatarMissing":false,"profileText":"AIと創作のあいだを、のんびり寄り道しています。\n感じる、楽しむ、考える、試す。\nうまくいった日も、迷子になった日も、その途中で見つけたものを記録しています。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:24:24.614Z","firstPageFreshAuditAt":"2026-10-18T10:28:13.893Z"},{"id":"c123","urlname":"intentus_26","creator":"Kai（カイ）｜Intentus","key":"n15dc9a43d257","url":"https://note.com/intentus_26/n/n15dc9a43d257","title":"会社員、AIと資本主義の海へ｜自己紹介と、このnoteで書くこと","publishAt":"2026-03-16T22:10:35+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/259664305/rectangle_large_type_2_c0e2b0605bf00a95acd38786545cc076.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/259402004/profile_7f61ae6b183d143cd7c2aba02eb720a9.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"intentus_26","key":"n15dc9a43d257","publishAt":"2026-03-16T22:10:35+09:00","terminalPage":17,"totalCount":101,"firstPageFingerprint":"naf39e6beb4c9:2026-10-16T20:00:00+09:00|n1414bd59a87c:2026-10-14T20:00:00+09:00|n8f0206a6cfe6:2026-10-07T20:00:00+09:00|nb366b75e2cfa:2026-10-06T20:00:00+09:00|n8a237970dd12:2026-09-29T20:00:00+09:00|n27661cce7d57:2026-09-25T20:00:00+09:00","firstPageSize":6,"pagesChecked":[1,16,17,18],"requests":5,"verifiedAt":"2026-10-18T10:28:19.794Z"},"index":122,"likerKey":"intentus_26","actorUrl":"https://note.com/intentus_26","avatarMissing":false,"profileText":"Kaiです。Intentusは、この場所の看板です。\nAIと壁打ちしながら、仕事・創作・日々の違和感を考え、試し、他の誰かも歩ける形にして残しています。\n完成品だけでなく、そこに至る寄り道も残す観察と実験のログ。\nたまに黒狼がいます。\n.......もはや漂流記かもしれません。","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:25:40.897Z","firstPageFreshAuditAt":"2026-10-18T10:28:19.794Z"},{"id":"c124","urlname":"jimanyan","creator":"向日葵じまにゃん🌻","key":"n9eb00abef680","url":"https://note.com/jimanyan/n/n9eb00abef680","title":"詐欺師シリーズ│詐欺師に出会う前までの話│ネットショップ編　#1","publishAt":"2025-09-12T19:34:12+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/251383236/rectangle_large_type_2_29b766c238da4153cf468e0c005cc3f1.png?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/284597042/profile_3b210c9e13d2b2f74799fafe715e846b.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"jimanyan","key":"n9eb00abef680","publishAt":"2025-09-12T19:34:12+09:00","terminalPage":18,"totalCount":103,"firstPageFingerprint":"ne230b9a6c983:2026-10-17T12:00:00+09:00|nfff94e5e8bac:2026-10-14T20:00:00+09:00|n178ce6469455:2026-10-13T20:00:00+09:00|n248b8f85a90b:2026-10-10T12:00:00+09:00|n4874e0885eb9:2026-10-08T20:00:00+09:00|n620d89a00490:2026-10-07T20:00:00+09:00","firstPageSize":6,"pagesChecked":[1,17,18,19],"requests":5,"verifiedAt":"2026-10-18T10:28:19.885Z"},"index":123,"likerKey":"jimanyan","actorUrl":"https://note.com/jimanyan","avatarMissing":false,"profileText":"人生楽しむコツは、ネタにすること✌🏻詐欺も、恋も、失敗も、笑える物語へ。\n🌻人生エンタメ作家\n📚Kindle著者｜7部門第1位\n📖(水)よみもの｜(木)実話小説｜(土)ファンタジー小説\n🍻物語を書きながら、仲間と笑う\n💌PRご相談歓迎◎","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:24:42.611Z","firstPageFreshAuditAt":"2026-10-18T10:28:19.885Z"},{"id":"c125","urlname":"novel_woolpallet","creator":"羊毛の魔女パレット🐏","key":"nabe7d3fb21b0","url":"https://note.com/novel_woolpallet/n/nabe7d3fb21b0","title":"🌲はじめてのnoteーーパレットが魔女になった日","publishAt":"2026-09-29T19:05:41+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/318807719/rectangle_large_type_2_fc4f0832e607e37a0bf5072d66268149.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/321572127/profile_b81f0e98ad1f15c2b75efc292e510e8e.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"novel_woolpallet","key":"nabe7d3fb21b0","publishAt":"2026-09-29T19:05:41+09:00","terminalPage":2,"totalCount":10,"firstPageFingerprint":"n8fb79dad380d:2026-10-16T21:38:10+09:00|nd79dc65dfbd7:2026-10-14T20:30:02+09:00|n2c7dd0d89ffd:2026-10-14T20:28:58+09:00|nc85fd40585ce:2026-10-12T20:30:16+09:00|n5861dcb304be:2026-10-07T20:55:53+09:00|n926802bc40cc:2026-10-05T21:21:13+09:00","firstPageSize":6,"pagesChecked":[1,2,3],"requests":4,"verifiedAt":"2026-10-18T10:28:19.810Z"},"index":124,"likerKey":"novel_woolpallet","actorUrl":"https://note.com/novel_woolpallet","avatarMissing":false,"profileText":"「なんで？……なんだか、ふしぎ。」\nふしぎが気になる「羊毛のパレット」と一緒に過ごす、森での暮らし🌳\n\n\nここは科学が魔法になる世界。\nそんな「もうひとつの世界」で、パレットは魔女と呼ばれていました🌙\n\n森の小さな家で、またひとつ。\n今日も魔法のような何かを見つけているようです🧙‍♀️","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:24:42.616Z","firstPageFreshAuditAt":"2026-10-18T10:28:19.810Z"},{"id":"c126","urlname":"reipichu","creator":"零ぴちゅ。","key":"n1bc0d0c83290","url":"https://note.com/reipichu/n/n1bc0d0c83290","title":"自己紹介｜僕たち華の転職組｜はじめてのnote","publishAt":"2025-05-16T12:05:52+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/277278683/rectangle_large_type_2_98dd550f26202e00a7a14390dc03b185.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/316808089/profile_2d8faf35f896c48f64bfff17acd32d76.jpeg?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"reipichu","key":"n1bc0d0c83290","publishAt":"2025-05-16T12:05:52+09:00","terminalPage":63,"totalCount":374,"firstPageFingerprint":"n8e813aeaeed8:2026-10-18T07:55:12+09:00|nace77aba2204:2026-10-14T05:24:54+09:00|n0ecd3c9db439:2026-10-11T05:30:57+09:00|neceb03efc45e:2026-10-07T05:25:48+09:00|nb8fd62012527:2026-10-04T05:35:43+09:00|ned8c8957445e:2026-09-30T05:43:08+09:00","firstPageSize":6,"pagesChecked":[1,62,63,64],"requests":5,"verifiedAt":"2026-10-18T10:28:19.930Z"},"index":125,"likerKey":"reipichu","actorUrl":"https://note.com/reipichu","avatarMissing":false,"profileText":"AI絵描師＆AI漫画家の零ぴちゅです✏ᝰ\n𝕏フォロワー数6,000人突破✨\n「集まれ！白銀の髪同盟」盟主\n\nサクッと読める「僕のnote」シリーズ\nITパスポート｜FP｜脱炭素アドバイザー\n\n❒大手金融へ転職経験、ビジネス\n❒ＡＩイラスト・アート\n❒都市伝説","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:24:48.439Z","firstPageFreshAuditAt":"2026-10-18T10:28:19.930Z"},{"id":"c127","urlname":"hunk_shuntana","creator":"はんく・シュンタナ🍌『塩化ビニール系女子』AIクリエイター兼プロデューサー","key":"ncb3b4b90a08d","url":"https://note.com/hunk_shuntana/n/ncb3b4b90a08d","title":"『100通りだってあるさ』はじめに","publishAt":"2021-07-27T15:00:48+09:00","thumbUrl":"https://assets.st-note.com/production/uploads/images/57627751/rectangle_large_type_2_0a14ab75db390037b38ebac8b3f38e89.jpg?fit=bounds&quality=85&width=1280","actorImageUrl":"https://assets.st-note.com/production/uploads/images/315052203/profile_2997a274571baea1b1f05c4310bd3c3d.png?fit=bounds&format=jpeg&quality=85&width=330","articleSelection":"oldest-confirmed","oldestVerified":true,"oldestEvidence":{"version":"2.6.3","creator":"hunk_shuntana","key":"ncb3b4b90a08d","publishAt":"2021-07-27T15:00:48+09:00","terminalPage":50,"totalCount":295,"firstPageFingerprint":"n6872951b28ca:2026-10-18T09:56:00+09:00|na7c2e62dba06:2026-10-13T23:26:54+09:00|n2496b0b488df:2026-10-09T22:04:56+09:00|n91c10c1ba2b1:2026-10-08T12:14:20+09:00|n94798705f186:2026-09-29T08:36:47+09:00|n12854346cb38:2026-09-26T01:41:36+09:00","firstPageSize":6,"pagesChecked":[1,49,50,51],"requests":5,"verifiedAt":"2026-10-18T10:28:19.891Z"},"index":126,"likerKey":"hunk_shuntana","actorUrl":"https://note.com/hunk_shuntana","avatarMissing":false,"profileText":"■YouTubeで【スタジオはんく】主宰。■防犯動画は警察署公認。■オリジナルキャラクター塩化ビニール系女子（PVCGirls）■noteのあかねまつり準優勝・余白ちゃん夢祭り優勝・カワムラちび創作大賞Pollo AI賞受賞■官公庁動画制作・個人動画制作受け付けてます‼️","gallery126":true,"finalMarker":false,"preparedAt":"2026-10-18T10:24:54.168Z","firstPageFreshAuditAt":"2026-10-18T10:28:19.891Z"}],"pendingPeople":[{"id":"c089","urlname":"noted_yatoasuter","creator":"やと","noteCount":0,"reason":"NO_PUBLIC_ARTICLE","profileUrl":"https://note.com/noted_yatoasuter","evidence":{"publicArticleLinks":0,"withPinnedCount":0,"withoutPinnedCount":0,"profileApiUrl":"https://note.com/api/v2/creators/noted_yatoasuter"}}]};
/* Gallery manifest and first-publication checks. No network or editor access on load. */
(function(root){
'use strict';
const VERSION='2.6.3';
const error=(code,message)=>Object.assign(new Error(message),{code});
const idOf=value=>String(value||'').trim().toLowerCase();
function csvRecords(text){
 const rows=[];let row=[],field='',quoted=false;
 const input=String(text??'').replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(quoted){if(ch==='"'&&input[i+1]==='"'){field+='"';i++}else if(ch==='"')quoted=false;else field+=ch;continue}
  if(ch==='"'){if(field)throw error('INVALID_MANIFEST','CSVの引用符を確認できません');quoted=true}
  else if(ch===','){row.push(field);field=''}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field=''}
  else field+=ch;
 }
 if(quoted)throw error('INVALID_MANIFEST','CSVの引用符が閉じられていません');
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 return rows
}
function parseCreatorsCsv(text){
 const rows=csvRecords(text);if(rows.length<2)throw error('INVALID_MANIFEST','参加者CSVが空です');
 const headers=rows.shift().map(x=>x.trim().toLowerCase());
 const column=names=>headers.findIndex(x=>names.includes(x));
 const nameColumn=column(['name','creator','creator_name','nickname','クリエイター名','名前']);
 const noteColumn=column(['note','note_url','noteurl','profile_url','profileurl','url','noteリンク','noteurlname']);
 const idColumn=column(['note_id','noteid','urlname','note_username']);
 const manifestColumn=column(['id','creator_id','number','no']);
 if(nameColumn<0||(noteColumn<0&&idColumn<0))throw error('INVALID_MANIFEST','参加者CSVの名前・note URL列を確認できません');
 return rows.map((values,index)=>{
  if(values.length!==headers.length)throw error('INVALID_MANIFEST',(index+2)+'行目の列数が一致しません');
  const raw=String(values[noteColumn]||'').trim(),explicit=idColumn>=0?String(values[idColumn]||'').trim():'';
  let urlname=explicit;
  if(raw){let url;try{url=new URL(raw)}catch{throw error('INVALID_MANIFEST',(index+2)+'行目のnote URLが不正です')}
   if(url.protocol!=='https:'||url.hostname!=='note.com'||url.username||url.password)throw error('INVALID_MANIFEST',(index+2)+'行目がnoteのURLではありません');
   const match=url.pathname.match(/^\/([A-Za-z0-9_\-]+)(?:\/|$)/);if(!match)throw error('INVALID_MANIFEST',(index+2)+'行目のnote IDが不正です');
   if(explicit&&idOf(explicit)!==idOf(match[1]))throw error('INVALID_MANIFEST',(index+2)+'行目のnote IDとURLが一致しません');urlname=match[1]
  }
  const creator=String(values[nameColumn]||'').trim();
  if(!creator||!/^[A-Za-z0-9_\-]+$/.test(urlname))throw error('INVALID_MANIFEST',(index+2)+'行目の名前・note IDが空または不正です');
  return{urlname,creator,likerKey:'gallery:'+idOf(urlname),actorUrl:'https://note.com/'+urlname,galleryId:manifestColumn>=0?String(values[manifestColumn]||'').trim():String(index+1)}
 })
}
function validateParticipants(creators,expected=126){
 if(!Array.isArray(creators)||creators.length!==expected)throw error('MANIFEST_COUNT','参加者数が'+expected+'人と一致しません');
 const seen=new Set();
 for(const creator of creators){const id=idOf(creator?.urlname);if(!/^[a-z0-9_\-]+$/.test(id)||!String(creator?.creator||'').trim())throw error('INVALID_MANIFEST','参加者の名前・note IDを確認できません');if(seen.has(id))throw error('DUPLICATE_CREATOR','参加者のnote IDが重複しています：'+id);seen.add(id)}
 return creators
}
function rawArticle(raw,creator){
 const note=raw?.note&&typeof raw.note==='object'?raw.note:raw;
 if(!note||typeof note!=='object')throw error('INVALID_ARTICLE','記事データが不正です');
 const key=String(note.key||'').trim();if(!/^n[a-f0-9]{12}$/i.test(key))throw error('INVALID_ARTICLE','記事IDを確認できません');
 const publication=String(note.publishAt||note.publish_at||note.published_at||'').trim(),time=Date.parse(publication);
 if(!publication||!Number.isFinite(time)||time>Date.now()+5000)throw error('INVALID_PUBLICATION','公開日時を確認できません：'+key);
 if(note.isPublished===false||note.is_published===false||note.isPublic===false||note.is_public===false||['draft','scheduled','private'].includes(String(note.status||'').toLowerCase()))throw error('UNPUBLISHED_ARTICLE','公開済みの記事ではありません：'+key);
 const expected=idOf(creator.urlname),user=note.user||note.author||{},author=String(user.urlname||user.urlName||note.urlname||'').trim();
 let urlAuthor='',urlKey='';const rawUrl=String(note.noteUrl||note.url||'').trim();
 if(rawUrl){let url;try{url=new URL(rawUrl)}catch{throw error('INVALID_ARTICLE','記事URLを確認できません：'+key)}
  const match=url.pathname.match(/^\/([A-Za-z0-9_\-]+)\/n\/(n[a-f0-9]{12})\/?$/i);
  if(url.protocol!=='https:'||url.hostname!=='note.com'||!match)throw error('INVALID_ARTICLE','記事URLがnote記事ではありません：'+key);urlAuthor=match[1];urlKey=match[2];
  if(urlKey.toLowerCase()!==key.toLowerCase())throw error('INVALID_ARTICLE','記事IDとURLが一致しません：'+key)
 }
 if((author&&idOf(author)!==expected)||(urlAuthor&&idOf(urlAuthor)!==expected)||(!author&&!urlAuthor))throw error('WRONG_AUTHOR','記事の投稿者が参加者と一致しません：'+key);
 return{raw,note,key,time,publication}
}
/** Returns a normal article row plus firstArticleProof; rejects instead of replacing/skipping. */
async function chooseOldestArticle(creator,options={}){
 const {requestJSON,articleFromRaw,stopRequested,onProgress}=options;
 if(typeof requestJSON!=='function'||typeof articleFromRaw!=='function')throw error('INVALID_OPTIONS','記事取得関数がありません');
 const creatorId=String(creator?.urlname||'').trim();if(!/^[A-Za-z0-9_\-]+$/.test(creatorId))throw error('INVALID_CREATOR','クリエイターIDを確認できません');
 const pages=new Map(),seenKeys=new Map();let knownTotal=null,requests=0;
 const stop=()=>{if(stopRequested?.())throw error('STOPPED','読み込みを停止しました')};
 async function fetchPage(pageNo,refresh=false){
  stop();if(!Number.isSafeInteger(pageNo)||pageNo<1)throw error('INVALID_PAGINATION','記事ページ番号が不正です');
  if(!refresh&&pages.has(pageNo))return pages.get(pageNo);
  if(++requests>72)throw error('PAGINATION_LIMIT','最初の記事を確認するためのページ探索が完了しません');
  const payload=await requestJSON('https://note.com/api/v2/creators/'+encodeURIComponent(creatorId)+'/contents?kind=note&page='+pageNo+'&disabled_pinned=true&with_notes=false',{refresh,cache:'no-store'});stop();
  const data=payload?.data;if(!data||typeof data!=='object'||!Array.isArray(data.contents))throw error('INVALID_PAGINATION','記事一覧の形式を確認できません');
  const rawTotal=data.totalCount??data.total_count,total=rawTotal===undefined||rawTotal===null?null:Number(rawTotal);
  if(total!==null&&(!Number.isSafeInteger(total)||total<0))throw error('INVALID_PAGINATION','記事総数が不正です');
  const flag=data.isLastPage??data.is_last_page;
  if(flag!==undefined&&typeof flag!=='boolean')throw error('INVALID_PAGINATION','最終ページ情報が不正です');
  // The live contents API reports totalCount:0 beyond the last real page.
  // Only this explicit empty terminal sentinel is exempt from snapshot totals.
  const emptyTerminalSentinel=pageNo>1&&data.contents.length===0&&flag===true&&total===0;
  if(total!==null&&!emptyTerminalSentinel){if(knownTotal!==null&&knownTotal!==total)throw error('STALE_PAGINATION','取得中に記事総数が変わりました。再読み込みしてください');knownTotal=total}
  const articles=data.contents.map(raw=>rawArticle(raw,creator)),keys=new Set();
  for(let i=0;i<articles.length;i++){const article=articles[i];if(keys.has(article.key))throw error('DUPLICATE_ARTICLE','同一ページの記事が重複しています');keys.add(article.key);if(i&&articles[i-1].time<article.time)throw error('UNSORTED_ARTICLES','固定記事を含む一覧の公開順を確認できません');const previous=seenKeys.get(article.key);if(previous!==undefined&&previous!==pageNo)throw error('DUPLICATE_PAGE','ページ送りで同じ記事が繰り返されました')}
  if(!articles.length&&flag===false)throw error('INVALID_PAGINATION','空の記事ページが最終ページではありません');
  const result={pageNo,articles,last:flag,total,fingerprint:articles.map(x=>x.key+':'+x.publication).join('|')};
  const previous=pages.get(pageNo);
  if(previous&&(previous.fingerprint!==result.fingerprint||previous.last!==result.last||previous.total!==result.total))throw error('STALE_PAGINATION','取得中に記事一覧が変わりました。再読み込みしてください');
  for(const [otherPage,other]of pages){if(otherPage===pageNo||!articles.length||!other.articles.length)continue;const earlier=otherPage<pageNo?other:result,later=otherPage<pageNo?result:other;if(earlier.articles.at(-1).time<later.articles[0].time)throw error('UNSORTED_ARTICLES','ページ間の公開順が一致しません')}
  articles.forEach(article=>seenKeys.set(article.key,pageNo));pages.set(pageNo,result);onProgress?.({creator:creatorId,page:pageNo,requests,total:knownTotal});return result
 }
 const first=await fetchPage(1);
 if(!first.articles.length){if(first.last===true&&knownTotal===0)throw error('NO_PUBLIC_ARTICLE','公開記事がありません：'+creatorId);throw error('INVALID_PAGINATION','最初の記事一覧が空で公開記事を確認できません：'+creatorId)}
 if(knownTotal!==null&&knownTotal<first.articles.length)throw error('STALE_PAGINATION','記事総数と一覧件数が一致しません');
 const perPage=first.articles.length;
 let low=1,high=null,terminal=null;
 if(first.last===true)terminal=first;
 else{
  let probe=knownTotal===null?2:Math.max(2,Math.ceil(knownTotal/perPage));
  for(;;){const page=await fetchPage(probe);if(!page.articles.length){high=probe;break}if(page.last===true){terminal=page;break}low=probe;probe*=2;if(!Number.isSafeInteger(probe))throw error('PAGINATION_LIMIT','記事一覧の終端を確認できません')}
  while(!terminal&&high-low>1){const page=await fetchPage(Math.floor((low+high)/2));if(!page.articles.length)high=page.pageNo;else if(page.last===true)terminal=page;else low=page.pageNo}
  if(!terminal)terminal=await fetchPage(low)
 }
 const next=await fetchPage(terminal.pageNo+1);
 if(next.articles.length)throw error('STALE_PAGINATION','最終ページの次にも記事があり、最初の記事を確定できません');
 if(terminal.last===false)throw error('INVALID_PAGINATION','最終ページの情報が一覧と一致しません');
 if(terminal.last!==true&&next.last!==true&&knownTotal===null)throw error('INVALID_PAGINATION','記事一覧の終端を確認できません');
 if(terminal.pageNo>1){const previous=await fetchPage(terminal.pageNo-1);if(!previous.articles.length||previous.last===true||previous.articles.length!==perPage)throw error('INVALID_PAGINATION','最終ページ直前の記事一覧が一致しません')}
 if(knownTotal!==null){const expected=(terminal.pageNo-1)*perPage+terminal.articles.length;if(expected!==knownTotal)throw error('STALE_PAGINATION','記事総数と最終ページが一致しません')}
 await fetchPage(1,true);
 const oldest=terminal.articles.reduce((best,item)=>item.time<best.time?item:best),row=articleFromRaw(oldest.raw,creator);
 if(!row||idOf(row.urlname)!==idOf(creatorId)||String(row.key||'').toLowerCase()!==oldest.key.toLowerCase())throw error('INVALID_ARTICLE','最初の記事への変換結果が一致しません');
 const canonicalUrl='https://note.com/'+creatorId+'/n/'+oldest.key;
 if(row.url){let url;try{url=new URL(row.url)}catch{throw error('INVALID_ARTICLE','最初の記事のリンクが不正です')}
  if(url.origin!=='https://note.com'||url.pathname.toLowerCase()!==new URL(canonicalUrl).pathname.toLowerCase())throw error('INVALID_ARTICLE','最初の記事のリンクが投稿者・記事IDと一致しません')}
 const evidence={version:VERSION,creator:creatorId,key:oldest.key,publishAt:oldest.publication,terminalPage:terminal.pageNo,totalCount:knownTotal,firstPageFingerprint:first.fingerprint,firstPageSize:first.articles.length,pagesChecked:[...pages.keys()].sort((a,b)=>a-b),requests,verifiedAt:new Date().toISOString()};
 // Never use a creation timestamp supplied by a permissive legacy converter.
 return{...row,url:canonicalUrl,publishAt:oldest.publication,articleSelection:'oldest-confirmed',oldestVerified:true,oldestEvidence:evidence,firstArticleProof:evidence}
}
root.__MUMEI_PROFILE_CARD_GALLERY__={version:VERSION,parseCreatorsCsv,validateParticipants,chooseOldestArticle};
})(typeof owner!=='undefined'?owner:typeof page!=='undefined'?page:typeof unsafeWindow!=='undefined'?unsafeWindow:typeof window!=='undefined'?window:globalThis);

// BEGIN INCLUDED EDITOR CORE
(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(location.hostname!=='editor.note.com')return;
const VERSION='2.6.6';
if(page.__MUMEI_PROFILE_CARD_CORE_VERSION__===VERSION)return;
page.__MUMEI_PROFILE_CARD_CORE_VERSION__=VERSION;
page.__MUMEI_PROFILE_CARD_PASTER_V1__=true;
const PANEL='mumei-profile-card-paster-v1';
const STATUS='mumei-profile-card-paster-status-v1';
const PREF='mumei_profile_card_paster_v1';
const POS='mumei_profile_card_paster_pos_v1';
const RUN_PREFIX='mumei_profile_card_paster_run_v15:';
const SPECIAL_LAST='mumei_profile_card_paster_special_last_v15';
const SPECIAL_EXCLUDED='mumei_profile_card_paster_special_excluded_v15';
const SPECIAL_RECOVERY_IMPORTED='mumei_profile_card_paster_special_recovery_v171';
const SPECIAL_RECOVERY_URLS=['https://note.com/ss_yr/n/n1b6e30eb9e41'];
const SPECIAL_SCAN_PREFIX='mumei_profile_special_scan_v181:';
const FIRST_TAGS=['はじめてのnote','始めてのnote','自己紹介'];
const STRICT_FIRST_TAGS=new Set(['はじめてのnote','始めてのnote']);
const SELF_INTRO_TAG='自己紹介';
const WORKMOM_TAG='ワーママ';
const PARENTING_TAG='育児日記';
const WORKMOM_CONTEXT={
 explicit:/(?:ワーママ|働くママ|働くお母さん|働く母|仕事と育児|育児と仕事|仕事と子育て|子育てと仕事)/i,
 parent:/(?:ママ|お母さん|母親|母として|育児|子育て|子ども|子供|保育園|保育所|学童|育休|産休|授乳|出産|妊娠)/i,
 work:/(?:仕事|働|勤務|職場|会社|復職|時短|フルタイム|パート|正社員|キャリア|在宅ワーク|テレワーク|共働き|残業|転職|副業|フリーランス)/i
};
const PARENTING_CONTEXT={
 explicit:/(?:育児日記|育児記録|子育て日記|子育て記録|育児|子育て)/i,
 family:/(?:子ども|子供|赤ちゃん|乳児|幼児|園児|息子|娘|きょうだい|兄弟|姉妹|保育園|幼稚園|学童|小学生|離乳食|夜泣き|おむつ|寝かしつけ|育休|産休|出産)/i
};
const SPECIAL_NG=[
  {label:'ポルノ',re:/(?:ポルノ|アダルト動画|18禁|R-?18|エロ動画|セックス動画|AV女優|ヌード販売|自慰動画|性行為動画|援助交際)/i},
  {label:'ギャンブル',re:/(?:ギャンブル必勝|パチンコ攻略|パチスロ攻略|競馬予想販売|競艇予想販売|競輪予想販売|オンラインカジノ|ブックメーカー)/i},
  {label:'暴力',re:/(?:殺害予告|殺人予告|リンチ推奨|銃撃推奨|テロ賛美|自傷を勧め|自殺を勧め)/i},
  {label:'危険な稼ぎ方',re:/(?:必ず儲かる|絶対稼げる|元本保証|高額報酬保証|投資サロン勧誘|FX自動売買勧誘|仮想通貨勧誘|暗号資産勧誘|闇バイト)/i},
  {label:'その他NG',re:/(?:違法販売|詐欺商材|覚醒剤販売|大麻販売|薬物販売|マルチ商法勧誘|ネットワークビジネス勧誘|宗教勧誘|ヘイト扇動|差別煽動)/i}
];
// 普通の副業・在宅ワーク・フリーランス・仕事紹介・収益化体験・一般的な投資体験の記述は、勧誘や危険表現がなければ除外しない。
const W=860,H=140;
const FINAL_URL='https://note.com/fuku444/n/nb4f6934381e9';
const FINAL_KEY='nb4f6934381e9';
const SPEED_FACTOR=4.0;
const IMAGE_PASTE_GAP=180;
const CARD_GAP_FAST=Math.round(5000/SPEED_FACTOR);
const CARD_GAP_SLOW=Math.round(10000/SPEED_FACTOR);
const CARD_BLOCK_PAUSE=Math.round(30000/SPEED_FACTOR);
let busy=false,stopRequested=false,viewCache=null,imageCommandCache=null,noteUrlCommandCache=null,selectionCache=null,dragging=false,longTimer=0,suppressClickUntil=0,wakeLock=null;const activeRequests=new Set();
let cardPauseRequested=false,cardRunActive=false;
const CARD_SESSION='card-'+Date.now()+'-'+Math.random().toString(36).slice(2);
page.__MUMEI_PROFILE_CARD_CORE_BUSY__=()=>busy;
page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__=saveOnce;
page.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__=createCardsAtTap;
page.__MUMEI_PROFILE_CARD_DELETE_CARDS__=bulkDelete;
page.__MUMEI_PROFILE_CARD_PAUSE__=pauseCards;
function fixedRunBusy(){try{return Boolean(page.__MUMEI_PROFILE_CARD_FIXED_BUSY__?.())}catch{return false}}
function actionBlocked(){
 if(!busy&&!fixedRunBusy())return false;
 setStatus('実行中です。先に「停止」を押してください',true);return true
}
const scanKey=()=>SPECIAL_SCAN_PREFIX+(editorArticleKey()||'unknown');
async function keepAwake(){
 if(!page.navigator?.wakeLock?.request||document.hidden)return false;
 try{
  if(wakeLock&&!wakeLock.released)return true;
  wakeLock=await page.navigator.wakeLock.request('screen');
  wakeLock.addEventListener?.('release',()=>{wakeLock=null;if(!document.hidden&&(busy||readScan()?.active))setTimeout(()=>void keepAwake(),350)},{once:true});
  return true
 }catch{return false}
}
async function releaseAwake(){try{await wakeLock?.release?.()}catch{}wakeLock=null}
function readScan(){try{return JSON.parse(localStorage.getItem(scanKey())||'null')}catch{return null}}
function writeScan(v){try{if(v==null)localStorage.removeItem(scanKey());else localStorage.setItem(scanKey(),JSON.stringify(v))}catch{}}
function clearScan(){try{localStorage.removeItem(scanKey())}catch{}}
const gmGet=(k,d=null)=>Promise.resolve(GM_getValue(k,d));

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=v=>{try{const u=new URL(String(v||''),location.href);u.search='';u.hash='';return u.href}catch{return String(v||'').trim()}};
const noteKey=url=>String(url||'').match(/\/n\/(n[a-f0-9]{12})(?:[/?#]|$)/i)?.[1]||'';
const magazineKey=url=>String(url||'').match(/\/(?:m|magazines)\/(m[a-z0-9]+)(?:[/?#]|$)/i)?.[1]||'';
const editorArticleKey=()=>location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1]||'';
const runKey=()=>RUN_PREFIX+(editorArticleKey()||'unknown');
function readRun(){if(page.__MUMEI_PROFILE_CARD_RUN_STORE__)return page.__MUMEI_PROFILE_CARD_RUN_STORE__.read();try{return JSON.parse(localStorage.getItem(runKey())||'null')}catch{return null}}
function writeRun(v){if(page.__MUMEI_PROFILE_CARD_RUN_STORE__){page.__MUMEI_PROFILE_CARD_RUN_STORE__.write(v);return;}try{if(v==null)localStorage.removeItem(runKey());else localStorage.setItem(runKey(),JSON.stringify(v))}catch{}}
function mediaUrl(v){
 let raw='';
 if(typeof v==='string')raw=v;
 else if(v&&typeof v==='object')raw=v.url||v.src||v.path||v.image_url||v.imageUrl||'';
 raw=String(raw||'').trim();if(!raw)return'';
 if(raw.startsWith('//'))return'https:'+raw;
 if(/^https?:\/\//i.test(raw))return raw;
 if(raw.startsWith('/'))return'https://assets.st-note.com'+raw;
 if(/^production\//i.test(raw))return'https://assets.st-note.com/'+raw;
 return raw
}
function getPrefs(){try{return JSON.parse(localStorage.getItem(PREF)||'{}')||{}}catch{return{}}}
function setPrefs(v){try{localStorage.setItem(PREF,JSON.stringify(v))}catch{}}
function setStatus(t,bad=false){const e=document.getElementById(STATUS);if(e){e.textContent=t;e.dataset.bad=bad?'1':'0'}}
function xhr(url,responseType='text',timeout=60000){
 return new Promise((resolve,reject)=>{
  let req=null;
  const finish=()=>{if(req)activeRequests.delete(req)};
  req=GM_xmlhttpRequest({
   method:'GET',url,responseType,timeout,
   headers:{Accept:responseType==='blob'?'image/avif,image/webp,image/png,image/jpeg,*/*':'application/json,text/html,*/*'},
   onload:r=>{finish();if(stopRequested){reject(new Error('停止しました'));return}r.status>=200&&r.status<300?resolve(r.response):reject(new Error('GET '+r.status+' '+url))},
   onerror:()=>{finish();reject(new Error(stopRequested?'停止しました':'通信失敗 '+url))},
   ontimeout:()=>{finish();reject(new Error(stopRequested?'停止しました':'通信タイムアウト '+url))},
   onabort:()=>{finish();reject(new Error('停止しました'))}
  });
  if(req)activeRequests.add(req)
 })
}
function abortActiveRequests(){
 for(const req of [...activeRequests]){try{req.abort?.()}catch{}}
 activeRequests.clear()
}
async function xhrJSON(url){const raw=await xhr(url,'text');try{return JSON.parse(String(raw||''))}catch{throw new Error('JSON解析失敗 '+url)}}

function webpackRequire(){const chunks=page.webpackChunk_N_E;if(!chunks||typeof chunks.push!=='function')return null;let req=null;const id=996000000+Math.floor(Math.random()*900000);try{chunks.push([[id],{},r=>{req=r}])}catch{}return req}
function looksLikeView(v){try{return Boolean(v&&typeof v==='object'&&v.state?.doc&&v.state?.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function')}catch{return false}}
function findView(){
 if(looksLikeView(viewCache)&&viewCache.dom?.isConnected)return viewCache;
 const root=document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror');if(!root)return null;
 const seen=new Set(),q=[];let seed=root;for(let i=0;i<6&&seed;i++,seed=seed.parentElement)q.push([seed,0]);
 let n=0;while(q.length&&n++<14000){const[v,d]=q.shift();if(!v||seen.has(v))continue;seen.add(v);if(looksLikeView(v))return viewCache=v;let keys=[];try{keys=Object.getOwnPropertyNames(v)}catch{continue}for(const k of keys){if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k))continue;let x;try{x=v[k]}catch{continue}if(looksLikeView(x))return viewCache=x;if(d<7&&x&&(typeof x==='object'||typeof x==='function')&&x!==page&&x!==document)q.push([x,d+1])}}return null
}
function nativeImageCommand(){
 if(imageCommandCache)return imageCommandCache;
 const req=webpackRequire();let cmd;try{cmd=req?.(94928)?.CwN}catch{}
 const src=typeof cmd==='function'?Function.prototype.toString.call(cmd):'';
 if(!(cmd?.length===4&&/Array\.from/.test(src)&&/imageUploading/.test(src)&&/entries/.test(src)))throw new Error('note正規画像処理を取得できません');
 return imageCommandCache=cmd
}
function selectionApi(){
 if(selectionCache)return selectionCache;
 const req=webpackRequire();let mod;try{mod=req?.(44044)}catch{}
 const Selection=mod?.Y1;
 if(typeof Selection?.atEnd!=='function')throw new Error('note内部Selectionを取得できません');
 return selectionCache=Selection
}
function ensureEndSelection(view){
 const paragraph=view.state.schema.nodes.paragraph;
 if(!paragraph)throw new Error('note段落を取得できません');
 const last=view.state.doc.lastChild;
 if(!last||last.type!==paragraph||last.textContent!=='')view.dispatch(view.state.tr.insert(view.state.doc.content.size,paragraph.create()));
 view.dispatch(view.state.tr.setSelection(selectionApi().atEnd(view.state.doc)).scrollIntoView());
 view.focus()
}
function imageNodes(view){const out=[];view.state.doc.descendants((node,pos)=>{if(node.type?.name==='image')out.push({node,pos})});return out}
function remoteImage(node){const src=String(node?.attrs?.src||'');return /^https:\/\//i.test(src)&&!/raw\.githubusercontent\.com/i.test(src)}
async function waitNewNoteImage(view,beforeIds,timeout=150000){
 const end=Date.now()+timeout;
 while(Date.now()<end){
  const fresh=imageNodes(view).filter(h=>{const id=String(h.node.attrs?.id||'');return id&&!beforeIds.has(id)&&remoteImage(h.node)}).sort((a,b)=>a.pos-b.pos);
  if(fresh.length===1)return fresh[0];
  if(fresh.length>1)return fresh.at(-1);
  if(stopRequested)throw new Error('停止しました');
  await sleep(120)
 }
 throw new Error('note画像アップロード待ちタイムアウト')
}
function relinkCaption(view,hit,row){
 const node=view.state.doc.nodeAt(hit.pos)||hit.node;
 if(node?.type?.name!=='image')throw new Error('画像ノードを確認できません');
 const caption=row.creator+'さん';
 const replacement=node.type.create({...node.attrs,link:row.url},view.state.schema.text(caption),node.marks);
 view.dispatch(view.state.tr.replaceWith(hit.pos,hit.pos+node.nodeSize,replacement));
 const id=String(replacement.attrs?.id||'');
 const after=imageNodes(view).find(h=>id&&String(h.node.attrs?.id||'')===id)||imageNodes(view).find(h=>h.pos===hit.pos);
 if(!after||norm(after.node.attrs?.link)!==norm(row.url)||String(after.node.textContent||'').trim()!==caption)throw new Error('画像リンク・名前キャプション設定に失敗しました');
 return after
}
function noteUrlCommandFactory(){
 if(noteUrlCommandCache)return noteUrlCommandCache;
 const req=webpackRequire();if(!req)throw new Error('note内部URL処理を取得できません');
 let candidate=null;try{candidate=req?.(94928)?.fjT}catch{}
 const right=v=>{
  if(typeof v!=='function')return false;
  let src='';try{src=Function.prototype.toString.call(v)}catch{}
  return src.includes('state.selection')&&src.includes('nodeBefore')&&src.includes('replaceRangeWith')&&src.includes('.then')
 };
 if(!right(candidate)){
  const loaded=Object.values(req.c||{}).flatMap(e=>{
   const x=e?.exports;
   if(typeof x==='function')return[x];
   return x&&typeof x==='object'?Object.values(x):[]
  });
  candidate=loaded.find(right)||null
 }
 if(!right(candidate))throw new Error('note正規URLカード処理が見つかりません');
 return noteUrlCommandCache=candidate
}
function embedNodes(view){const out=[];view.state.doc.descendants((node,pos)=>{if(node.type?.name==='embed')out.push({node,pos})});return out}
function cardKey(hit){return String(hit?.node?.attrs?.embeddedContentKey||'')}
function cardUrl(hit){return norm(hit?.node?.attrs?.src)}
function genuineCard(hit,url){
 const key=cardKey(hit),html=String(hit?.node?.attrs?.htmlForEmbed||'');
 if(!/^emb[a-z0-9]+$/i.test(key)||!html.includes('note-embed'))return false;
 if(cardUrl(hit)===norm(url))return true;
 try{
  const src=new URL(cardUrl(hit)),wanted=noteKey(url),embedded=src.pathname.match(/^\/embed\/notes\/(n[a-f0-9]{12})\/?$/i)?.[1];
  return src.origin==='https://note.com'&&Boolean(embedded)&&embedded===wanted
 }catch{return false}
}
function exactUrlParagraphs(view,url){
 const wanted=norm(url),out=[];
 view.state.doc.forEach((node,pos)=>{
  if(node.type===view.state.schema.nodes.paragraph&&norm((node.textContent||'').trim())===wanted)out.push({node,pos})
 });
 return out
}
function cardAnchorFromSelection(view){
 const sel=view.state.selection,$from=sel.$from;
 if(!$from)return view.state.doc.content.size;
 try{
  if($from.depth>=1){
   const node=$from.node(1),before=$from.before(1);
   if(node?.type===view.state.schema.nodes.paragraph&&!String(node.textContent||''))return before;
   return before+node.nodeSize
  }
 }catch{}
 return Math.max(0,Math.min(view.state.doc.content.size,Number(sel.from)||view.state.doc.content.size))
}
function insertWorkUrlAt(view,url,pos){
 const p=view.state.schema.nodes.paragraph;
 const at=Math.max(0,Math.min(view.state.doc.content.size,Number(pos)));
 view.dispatch(view.state.tr.insert(at,p.create(null,view.state.schema.text(url))));
 const node=view.state.doc.nodeAt(at);
 if(node?.type!==p||node.textContent!==url)throw new Error('通知カード用URLを指定位置へ配置できません');
 const Selection=selectionApi(),near=typeof Selection.near==='function'?Selection.near(view.state.doc.resolve(Math.max(0,Math.min(view.state.doc.content.size,at+node.nodeSize-1)))):Selection.atEnd(view.state.doc);
 view.dispatch(view.state.tr.setSelection(near).scrollIntoView());view.focus();
 return{node,pos:at}
}
async function waitNewCard(view,url,beforeKeys,attempt,timeout=45000){
 const end=Date.now()+timeout,errorGrace=2500;let errorAt=0;
 while(Date.now()<end){
  const hit=embedNodes(view).find(h=>{const k=cardKey(h);return k&&!beforeKeys.has(k)&&genuineCard(h,url)});
  if(hit)return hit;
  if(attempt.error){if(!errorAt)errorAt=Date.now();if(Date.now()-errorAt>=errorGrace)throw attempt.error}
  if(stopRequested)throw new Error('停止しました');
  await sleep(140)
 }
 throw attempt.error||new Error('正規通知カード生成タイムアウト')
}
function deleteExtraWorkUrl(view,url,beforeCount){
 const list=exactUrlParagraphs(view,url);
 if(list.length<=beforeCount)return 0;
 const extra=list.slice(beforeCount).sort((a,b)=>b.pos-a.pos);
 return deleteHits(view,extra)
}
function cardAnchor(run,fallback=0,view=null){
 const valid=run?.cardAnchorPos!=null&&run.cardAnchorPos!==''&&Number.isFinite(Number(run.cardAnchorPos));let anchor=valid?Math.max(0,Number(run.cardAnchorPos)):fallback;
 if(view){const records=new Map((run?.cardKeys||[]).map(card=>[String(card.key||''),card])),baseline=new Set(run?.cardBaselineKeys||[]);for(const hit of embedNodes(view)){const rec=records.get(cardKey(hit));if(rec&&!baseline.has(cardKey(hit))&&genuineCard(hit,rec.url))anchor=valid?Math.min(anchor,hit.pos):hit.pos<anchor?hit.pos:anchor}}
 return anchor
}
function generatedCardHits(view,run,rows=run?.rows||[]){
 const urls=new Map(rows.map(row=>[norm(row.url),row])),keys=new Map(rows.map(row=>[noteKey(row.url),row])),baseline=new Set(run?.cardBaselineKeys||[]),anchor=cardAnchor(run,0,view),out=[];
 for(const hit of embedNodes(view)){
  if(hit.pos<anchor||baseline.has(cardKey(hit)))continue;
  const src=cardUrl(hit);let row=urls.get(src);
  if(!row){try{const u=new URL(src),key=u.origin==='https://note.com'?u.pathname.match(/^\/embed\/notes\/(n[a-f0-9]{12})\/?$/i)?.[1]:'';row=key?keys.get(key):null}catch{}}
  if(row&&genuineCard(hit,row.url))out.push({...hit,targetUrl:norm(row.url)})
 }
 return out.sort((a,b)=>a.pos-b.pos)
}
function duplicateCardDetails(view,run,rows=run?.rows||[]){
 const counts=new Map();for(const hit of generatedCardHits(view,run,rows))counts.set(hit.targetUrl,(counts.get(hit.targetUrl)||0)+1);
 return rows.map(row=>({url:row.url,creator:row.creator,count:counts.get(norm(row.url))||0})).filter(row=>row.count>1)
}
function assertUniqueGeneratedCards(view,run,rows=run?.rows||[]){
 const duplicates=duplicateCardDetails(view,run,rows);
 if(duplicates.length)throw new Error('同じクリエイターのカードが重複しています：'+duplicates.slice(0,4).map(row=>row.creator+'さん '+row.count+'枚').join('・')+'。今ある内容は保持しました');
}
function emptyCardGap(view,from,to){
 let pos=from;
 while(pos<to){const node=view.state.doc.nodeAt?.(pos);if(node?.type?.name!=='paragraph'||String(node.textContent||'').trim()||!node.nodeSize)return false;pos+=node.nodeSize}
 return pos===to
}
function recordNativeCard(hit,row){
 const run=readRun()||{},cards=Array.isArray(run.cardKeys)?run.cardKeys:[],rec={url:row.url,key:cardKey(hit),creator:row.creator};
 const records=new Map(cards.map(card=>[String(card.key||''),card]));records.set(rec.key,rec);
 writeRun({...run,cardKeys:[...records.values()],pendingCard:null,updatedAt:Date.now()});return rec
}
async function reconcileCompletedCards(view,run,rows){
 assertUniqueGeneratedCards(view,run,rows);
 const hits=generatedCardHits(view,run,rows),cards=new Map((run.cardKeys||[]).map(card=>[String(card.key||''),card]));
 const anchor=cardAnchor(run,0,view);let pos=anchor,changed=false;
 for(let index=0;index<hits.length;index++){
  const hit=hits[index],row=rows[index];
  if(!row||!genuineCard(hit,row.url)||!emptyCardGap(view,pos,hit.pos))throw new Error('カードの途中に欠落または順序の違いがあります。今ある内容は保持しました');
  if(!cards.has(cardKey(hit))){cards.set(cardKey(hit),{url:row.url,key:cardKey(hit),creator:row.creator});changed=true}
  pos=hit.pos+hit.node.nodeSize;
 }
 const completedPending=run.pendingCard&&hits.some(hit=>genuineCard(hit,run.pendingCard.url));
 const normalizeAnchor=Number(run.cardAnchorPos)!==anchor;
 if(changed||completedPending||normalizeAnchor){writeRun({...run,cardAnchorPos:anchor,cardKeys:[...cards.values()],pendingCard:completedPending?null:run.pendingCard,updatedAt:Date.now()});await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.()}
 return changed||completedPending||normalizeAnchor?(readRun()||run):run
}
function knownCardFailure(error){return error?.cardTerminal===true||/\b(?:HTTP|status)\s*[:=]?\s*(?:400|401|403|404|409|410|413|415|422|429)\b/i.test(String(error?.message||error))||[400,401,403,404,409,410,413,415,422,429].includes(Number(error?.status||error?.statusCode))}
async function createNativeCard(view,row,insertPos){
 let run=readRun()||{},cards=Array.isArray(run.cardKeys)?run.cardKeys:[],baseline=new Set(run.cardBaselineKeys||[]);
 assertUniqueGeneratedCards(view,run);
 const existing=generatedCardHits(view,run).filter(hit=>genuineCard(hit,row.url));
 if(existing.length){
  const hit=existing[0];if(!emptyCardGap(view,insertPos,hit.pos))throw new Error('同じカードが別の位置にあります。再送せず、今ある内容を保持しました');
  const rec=recordNativeCard(hit,row);await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();return{rec,nextPos:hit.pos+hit.node.nodeSize}
 }
 if(run.pendingCard&&norm(run.pendingCard.url)===norm(row.url)&&run.pendingCard.sessionId===CARD_SESSION)throw new Error('前のカード変換の結果を確認できないため再送を停止しました。下書き保存→再読み込み→②で再開してください。今ある内容は保持しています');
 writeRun({...run,pendingCard:{sessionId:CARD_SESSION,url:row.url,pos:insertPos,startedAt:Date.now()},updatedAt:Date.now()});
 await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
 if(stopRequested)throw new Error('手動停止');
 const beforeKeys=new Set(embedNodes(view).map(cardKey).filter(Boolean)),rawBefore=exactUrlParagraphs(view,row.url).length;
 let requested=false,hit;
 try{
 if(stopRequested)throw new Error('手動停止');
 const work=insertWorkUrlAt(view,row.url,insertPos),workNode=work.node,attempt={error:null};
 const command=noteUrlCommandFactory()(row.url,e=>{attempt.error=e});requested=true;
 const handled=command(view.state,(tr,consumedNode=workNode)=>{
  try{
   if(consumedNode!==workNode&&!consumedNode?.eq?.(workNode))throw new Error('通知カード用URLが変更されました');
   view.dispatch(tr)
  }catch(e){attempt.error=e}
 },view);
 if(!handled){const error=new Error('note正規URLカード処理が未処理です');error.cardTerminal=true;throw error}
 try{hit=await waitNewCard(view,row.url,beforeKeys,attempt,45000)}
 catch(e){
  const recovered=embedNodes(view).find(h=>{const k=cardKey(h);return k&&!beforeKeys.has(k)&&genuineCard(h,row.url)});
  if(recovered)hit=recovered;else throw e
 }
 deleteExtraWorkUrl(view,row.url,rawBefore);
 hit=embedNodes(view).find(h=>cardKey(h)===cardKey(hit))||hit;
 if(!genuineCard(hit,row.url))throw new Error('正規通知カードの照合に失敗しました');
 assertUniqueGeneratedCards(view,readRun()||run);
 const rec=recordNativeCard(hit,row);
 return{rec,nextPos:hit.pos+hit.node.nodeSize}
 }catch(error){
  if(!requested||knownCardFailure(error)){deleteExtraWorkUrl(view,row.url,rawBefore);const current=readRun()||run;writeRun({...current,pendingCard:null,updatedAt:Date.now()});await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.()}
  throw error
 }
}

function parseLiker(item){
 const u=item?.user||{},urlname=String(u.urlname||'').trim(),id=String(u.key??u.id??urlname).trim();
 if(!id||!urlname)return null;
 return{likerKey:id,urlname,creator:String(u.nickname||u.name||urlname).trim(),actorUrl:'https://note.com/'+urlname,actorImageUrl:mediaUrl(u.user_profile_image_url||u.profileImageUrl||u.profile_image_url||u.user_profile_image_path||u.profile_image_path||u.profileImagePath||u.icon_url||u.image_url||'')}
}
function contentList(p){const d=p?.data&&typeof p.data==='object'?p.data:{};return Array.isArray(d.contents)?d.contents:Array.isArray(d.notes)?d.notes:[]}
function articleFromRaw(raw,creator={}){
 const note=raw?.note&&typeof raw.note==='object'?raw.note:raw;if(!note||typeof note!=='object')return null;
 const key=String(note.key||'').trim();if(!/^n[a-f0-9]{12}$/i.test(key))return null;
 const user=note.user||note.author||{},urlname=String(creator.urlname||user.urlname||'').trim();
 const url=norm(note.noteUrl||note.url||(urlname?'https://note.com/'+urlname+'/n/'+key:''));
 if(!url)return null;
 return{
  likerKey:String(creator.likerKey||user.key||user.id||urlname||key),urlname,
  creator:String(creator.creator||user.nickname||user.name||urlname||'noteクリエイター').trim(),
  actorUrl:String(creator.actorUrl||(urlname?'https://note.com/'+urlname:'')),
  actorImageUrl:mediaUrl(creator.actorImageUrl||user.user_profile_image_url||user.profileImageUrl||user.profile_image_url||user.user_profile_image_path||user.profile_image_path||user.profileImagePath||user.icon_url||user.image_url||''),
  url,title:String(note.name||note.title||'無題の記事').trim(),key,
  publishAt:String(note.publishAt||note.publish_at||note.published_at||note.created_at||'').trim()||null,
  thumbUrl:mediaUrl(note.eyecatch_url||note.image_url||note.imageUrl||note.thumbnail_url||note.thumbnailUrl||note.eyecatch?.url||note.eyecatch_image?.url||note.eyecatchImage?.url||note.image?.url||note.thumbnail?.url||'')
 }
}
async function creatorContents(id,pageNo=1,disabledPinned=true){return xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)+'/contents?kind=note&page='+pageNo+'&disabled_pinned='+(disabledPinned?'true':'false')+'&with_notes=false')}
async function chooseCreatorArticle(creator,choice){
 try{
  if(choice==='fixed'){
   const p=await creatorContents(creator.urlname,1,false);
   return articleFromRaw(contentList(p)[0],creator)
  }
  if(choice==='oldest'){
   const first=await creatorContents(creator.urlname,1,true),list=contentList(first);if(!list.length)return null;
   const d=first?.data&&typeof first.data==='object'?first.data:{},total=Number(d.totalCount||0),per=Math.max(1,list.length),lastPage=Math.min(500,total>0?Math.max(1,Math.ceil(total/per)):1);
   const lp=lastPage===1?first:await creatorContents(creator.urlname,lastPage,true),candidates=contentList(lp).map(x=>articleFromRaw(x,creator)).filter(Boolean);
   candidates.sort((a,b)=>new Date(a.publishAt||0)-new Date(b.publishAt||0));
   return candidates[0]||null
  }
  const p=await creatorContents(creator.urlname,1,true);
  return articleFromRaw(contentList(p)[0],creator)
 }catch{return null}
}
function parseUnifiedSources(raw){
 const out=[];
 for(const line0 of String(raw||'').split(/\r?\n/)){
  const line=line0.trim();if(!line)continue;
  const urls=line.match(/https?:\/\/[^\s,、]+/g)||[];
  for(const url of urls){
   if(noteKey(url))out.push({type:'note',value:norm(url),label:norm(url)});
   else if(magazineKey(url))out.push({type:'mag',value:norm(url),label:norm(url)})
  }
  const tags=[...line.matchAll(/#([^#\s,、]+)/g)].map(m=>m[1].trim()).filter(Boolean);
  for(const tag of tags)out.push({type:'tag',value:tag,label:'#'+tag});
  if(!urls.length&&!tags.length){
   const tag=line.replace(/^#+/,'').trim();
   if(tag)out.push({type:'tag',value:tag,label:'#'+tag})
  }
 }
 const seen=new Set();
 return out.filter(x=>{const k=x.type+'|'+x.value;if(seen.has(k))return false;seen.add(k);return true})
}
function normalizeSearch(j){
 const d=j?.data??j??{},notes=d.notes||{},arr=notes.contents||notes.notes||d.contents||[];
 return{arr:Array.isArray(arr)?arr:[],cursor:d?.cursor?.note??d.note_cursor??notes.next_cursor??notes.cursor??null,last:notes.is_last_page===true||notes.isLastPage===true}
}
function targetLimit(mode,count){return mode==='all'?Infinity:Math.max(0,Number(count||0))}
async function collectUnified(raw,mode,count,choice){
 const sources=parseUnifiedSources(raw),limit=targetLimit(mode,count);
 if(!sources.length||limit===0)return[];
 const out=[],seenUrls=new Set(),seenCreators=new Set(),collectedCreators=new Set(['fuku444']);
 const add=row=>{
  if(!row)return false;
  const u=norm(row.url);
  const creator=String(row.urlname||u.match(/^https:\/\/note\.com\/([^/?#]+)\/n\//i)?.[1]||row.likerKey||'').trim().toLowerCase();
  if(!u||u===norm(FINAL_URL)||seenUrls.has(u)||(creator&&collectedCreators.has(creator)))return false;
  seenUrls.add(u);if(creator)collectedCreators.add(creator);out.push({...row,url:u});return true
 };
 for(let si=0;si<sources.length&&out.length<limit;si++){
  const src=sources[si];
  if(stopRequested)throw new Error('停止しました');
  if(src.type==='note'){
   const key=noteKey(src.value);if(!key)continue;
   for(let pageNo=1;pageNo<=200&&out.length<limit;pageNo++){
    setStatus('入力 '+(si+1)+'/'+sources.length+'｜記事URLのスキ '+out.length+(mode==='all'?' / 全数':' / '+limit));
    const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(key)+'/likes?page='+pageNo+'&per=50');
    const list=Array.isArray(p?.data?.likes)?p.data.likes:[],creators=[];
    for(const item of list){
     const c=parseLiker(item);if(!c||seenCreators.has(c.likerKey))continue;
     seenCreators.add(c.likerKey);creators.push(c)
    }
    for(let i=0;i<creators.length&&out.length<limit;i+=5){
     const chosen=await Promise.all(creators.slice(i,i+5).map(c=>chooseCreatorArticle(c,choice)));
     for(const row of chosen){add(row);if(out.length>=limit)break}
    }
    if(list.length<50)break
   }
  }else if(src.type==='mag'){
   const key=magazineKey(src.value);if(!key)continue;
   let start=0;
   while(out.length<limit&&start<10000){
    setStatus('入力 '+(si+1)+'/'+sources.length+'｜マガジン '+out.length+(mode==='all'?' / 全数':' / '+limit));
    const p=await xhrJSON('https://note.com/api/v1/magazines/'+encodeURIComponent(key)+'/notes?start='+start+'&limit=100');
    const d=p?.data&&typeof p.data==='object'?p.data:{},list=Array.isArray(d.notes)?d.notes:[];
    for(const rawNote of list){add(articleFromRaw(rawNote,{}));if(out.length>=limit)break}
    start+=list.length;if(!list.length||list.length<100)break
   }
  }else if(src.type==='tag'){
   let cursor='0';
   for(let pageNo=1;pageNo<=250&&out.length<limit;pageNo++){
    setStatus('入力 '+(si+1)+'/'+sources.length+'｜#'+src.value+' '+out.length+(mode==='all'?' / 全数':' / '+limit));
    const p=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(src.value)+'&size=20&start='+encodeURIComponent(cursor)+'&sort=new');
    const q=normalizeSearch(p);if(!q.arr.length)break;
    for(const rawNote of q.arr){add(articleFromRaw(rawNote,{}));if(out.length>=limit)break}
    if(q.last||q.cursor==null||String(q.cursor)===String(cursor))break;
    cursor=String(q.cursor);await sleep(70)
   }
  }
 }
 return out
}
function readJSONKey(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function writeJSONKey(key,value){try{if(value==null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value))}catch{}}
function specialExcluded(){
 const raw=readJSONKey(SPECIAL_EXCLUDED,[]);
 return Array.isArray(raw)?raw:[]
}
function specialExcludedSets(){
 const arr=specialExcluded();
 return{
  urls:new Set(arr.map(x=>norm(x?.url)).filter(Boolean)),
  creators:new Set(arr.map(x=>String(x?.urlname||'').toLowerCase()).filter(Boolean)),
  keys:new Set(arr.map(x=>String(x?.key||noteKey(x?.url)||'')).filter(Boolean))
 }
}
function extractNoteKeysFromRecovery(raw,sourceKey=''){
 const text=String(raw||'');
 const out=new Set();
 const patterns=[
  /https?:\/\/note\.com\/[A-Za-z0-9_.-]+\/n\/(n[a-f0-9]{12})/ig,
  /https?:\/\/note\.com\/embed\/notes\/(n[a-f0-9]{12})/ig,
  /\/n\/(n[a-f0-9]{12})/ig,
  /\/embed\/notes\/(n[a-f0-9]{12})/ig
 ];
 for(const re of patterns){
  let m;while((m=re.exec(text)))out.add(String(m[1]||''))
 }
 out.delete(String(sourceKey||''));out.delete(FINAL_KEY);
 return out
}
async function recoverSpecialExclusionsFromPublishedArticles(){
 const imported=readJSONKey(SPECIAL_RECOVERY_IMPORTED,{});
 const current=specialExcluded(),seenKeys=new Set(current.map(x=>String(x?.key||noteKey(x?.url)||'')).filter(Boolean));
 let added=0;
 for(const url of SPECIAL_RECOVERY_URLS){
  const sourceKey=noteKey(url);if(!sourceKey||imported?.[url])continue;
  setStatus('初投稿者｜前回公開記事から重複除外を復元中…');
  let combined='';
  try{
   const api=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(sourceKey));
   combined+=JSON.stringify(api||{})
  }catch{}
  try{combined+=' '+String(await xhr(url,'text',60000)||'')}catch{}
  const keys=extractNoteKeysFromRecovery(combined,sourceKey);
  if(!keys.size)throw new Error('前回公開記事から掲載済み記事を確認できませんでした。重複防止のため初投稿案件を開始しません');
  for(const key of keys){
   if(seenKeys.has(key))continue;
   seenKeys.add(key);current.push({url:'',urlname:'',creator:'',key,confirmedAt:Date.now(),recoveredFrom:url});added++
  }
  writeJSONKey(SPECIAL_EXCLUDED,current);
  writeJSONKey(SPECIAL_RECOVERY_IMPORTED,{...(imported||{}),[url]:{at:Date.now(),count:keys.size}})
 }
 updateExcludedCount();
 if(added)setStatus('前回公開記事から '+added+'件を重複除外へ復元しました ✅');
 return added
}
function specialBlockedReason(text){
 const t=String(text||'');
 for(const rule of SPECIAL_NG)if(rule.re.test(t))return rule.label;
 return''
}
async function creatorSinglePublicArticle(row){
 if(!row?.urlname)return false;
 try{
  // 「1記事だけ」は公開note記事で厳密確認する。
  // 固定表示の有無で同一記事が重複して見えるケースもあるため、両方の一覧を照合する。
  const [plain,pinned,page2]=await Promise.all([
   creatorContents(row.urlname,1,true),
   creatorContents(row.urlname,1,false),
   creatorContents(row.urlname,2,true)
  ]);
  const d=plain?.data&&typeof plain.data==='object'?plain.data:{};
  const plainList=contentList(plain),pinnedList=contentList(pinned),secondList=contentList(page2);
  const totalRaw=d.totalCount??d.total_count??d.count??d.noteCount??d.note_count;
  if(totalRaw!==undefined&&totalRaw!==null&&String(totalRaw)!==''){
   const total=Number(totalRaw);
   if(!Number.isFinite(total)||total!==1)return false
  }
  if(plainList.length!==1||secondList.length!==0)return false;
  const keys=new Set(
   [...plainList,...pinnedList]
    .map(x=>articleFromRaw(x,{}))
    .filter(Boolean)
    .map(x=>noteKey(x.url))
    .filter(Boolean)
  );
  const wanted=noteKey(row.url);
  return Boolean(wanted&&keys.size===1&&keys.has(wanted))
 }catch{return false}
}
async function specialArticleText(row){
 let note={};
 try{const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));note=p?.data||p||{}}catch{}
 const parts=[
  row.title,note.name,note.title,note.description,note.body,note.body_html,note.bodyText,note.body_text,
  JSON.stringify(note.hashtags||note.tags||note.hashtag_names||[])
 ];
 try{
  const html=await xhr(row.url,'text',45000),doc=new DOMParser().parseFromString(String(html||''),'text/html');
  parts.push(doc.querySelector('article')?.textContent||doc.querySelector('main')?.textContent||'')
 }catch{}
 return parts.map(v=>String(v||'')).join(' ').replace(/\s+/g,' ').trim()
}
function exactWorkmomTag(value){
 return /(?:^|[^一-龯ぁ-んァ-ヶ々ーA-Za-z0-9_])#?ワーママ(?:$|[^一-龯ぁ-んァ-ヶ々ーA-Za-z0-9_])/i.test(String(value||''))
}
async function workmomArticleAudit(row){
 let note={},doc=null;
 try{const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));note=p?.data||p||{}}catch{}
 try{
  const html=String(await xhr(row.url,'text',45000)||'');
  doc=new DOMParser().parseFromString(html,'text/html')
 }catch{}
 const tagDump=JSON.stringify(note.hashtags||note.tags||note.hashtag_names||note.tag_names||note.note_hashtags||[]);
 let exactTag=exactWorkmomTag(tagDump);
 if(!exactTag&&doc){
  exactTag=[...doc.querySelectorAll('a')].some(a=>{
   const label=String(a.textContent||'').trim().replace(/^#/,'');
   let href=String(a.getAttribute('href')||'');try{href=decodeURIComponent(href)}catch{}
   return label===WORKMOM_TAG||href.includes('/hashtag/'+WORKMOM_TAG)
  })
 }
 if(!exactTag)return{ok:false,reason:'#ワーママタグ確認不可'};
 const parts=[
  row.title,note.name,note.title,note.description,note.body,note.body_html,note.bodyText,note.body_text,
  doc?.querySelector('article')?.textContent||doc?.querySelector('main')?.textContent||''
 ];
 const text=parts.map(v=>String(v||'')).join(' ').replace(/\s+/g,' ').trim();
 const blocked=specialBlockedReason(text);if(blocked)return{ok:false,reason:blocked};
 const relevant=WORKMOM_CONTEXT.explicit.test(text)||(WORKMOM_CONTEXT.parent.test(text)&&WORKMOM_CONTEXT.work.test(text));
 if(!relevant)return{ok:false,reason:'ワーママ文脈不足'};
 return{ok:true,reason:''}
}
async function collectWorkmom(mode,count){
 const limit=targetLimit(mode,count);if(limit===0)return[];
 let cursor='0',pageNo=0,scanned=0;const tested=new Set(),out=[];
 while(out.length<limit&&pageNo<250){
  if(stopRequested)throw new Error('停止しました');
  pageNo++;
  setStatus('#ワーママ案件｜新着 '+pageNo+'ページ｜確認 '+scanned+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit));
  const p=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(WORKMOM_TAG)+'&size=20&start='+encodeURIComponent(cursor)+'&sort=new');
  const q=normalizeSearch(p);if(!q.arr.length)break;
  for(const raw of q.arr){
   if(out.length>=limit)break;
   const row=articleFromRaw(raw,{}),u=norm(row?.url);
   if(!row||!u||u===norm(FINAL_URL)||tested.has(u))continue;
   tested.add(u);scanned++;
   setStatus('#ワーママ案件｜確認 '+scanned+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit)+'｜'+row.creator);
   const audit=await workmomArticleAudit({...row,url:u});
   if(!audit.ok)continue;
   out.push({...row,url:u,workmom:true});
   await sleep(80)
  }
  if(q.last||q.cursor==null||String(q.cursor)===String(cursor))break;
  cursor=String(q.cursor);await sleep(60)
 }
 return out
}

function exactParentingTag(value){
 return /(?:^|[^一-龯ぁ-んァ-ヶ々ーA-Za-z0-9_])#?育児日記(?:$|[^一-龯ぁ-んァ-ヶ々ーA-Za-z0-9_])/i.test(String(value||''))
}
async function parentingArticleAudit(row){
 let note={},doc=null;
 try{const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));note=p?.data||p||{}}catch{}
 try{
  const html=String(await xhr(row.url,'text',45000)||'');
  doc=new DOMParser().parseFromString(html,'text/html')
 }catch{}
 const tagDump=JSON.stringify(note.hashtags||note.tags||note.hashtag_names||note.tag_names||note.note_hashtags||[]);
 let exactTag=exactParentingTag(tagDump);
 if(!exactTag&&doc){
  exactTag=[...doc.querySelectorAll('a')].some(a=>{
   const label=String(a.textContent||'').trim().replace(/^#/,'');
   let href=String(a.getAttribute('href')||'');try{href=decodeURIComponent(href)}catch{}
   return label===PARENTING_TAG||href.includes('/hashtag/'+PARENTING_TAG)
  })
 }
 if(!exactTag)return{ok:false,reason:'#育児日記タグ確認不可'};
 const parts=[
  row.title,note.name,note.title,note.description,note.body,note.body_html,note.bodyText,note.body_text,
  doc?.querySelector('article')?.textContent||doc?.querySelector('main')?.textContent||''
 ];
 const text=parts.map(v=>String(v||'')).join(' ').replace(/\s+/g,' ').trim();
 // 検閲は既存共通ルールを必ず通す。副業という語そのものはNG条件に含めない。
 const blocked=specialBlockedReason(text);if(blocked)return{ok:false,reason:blocked};
 const relevant=PARENTING_CONTEXT.explicit.test(text)||PARENTING_CONTEXT.family.test(text);
 if(!relevant)return{ok:false,reason:'育児文脈不足'};
 return{ok:true,reason:''}
}
async function collectParenting(mode,count){
 const limit=targetLimit(mode,count);if(limit===0)return[];
 let cursor='0',pageNo=0,scanned=0;const tested=new Set(),out=[];
 while(out.length<limit&&pageNo<250){
  if(stopRequested)throw new Error('停止しました');
  pageNo++;
  setStatus('#育児日記案件｜新着 '+pageNo+'ページ｜確認 '+scanned+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit));
  const p=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(PARENTING_TAG)+'&size=20&start='+encodeURIComponent(cursor)+'&sort=new');
  const q=normalizeSearch(p);if(!q.arr.length)break;
  for(const raw of q.arr){
   if(out.length>=limit)break;
   const row=articleFromRaw(raw,{}),u=norm(row?.url);
   if(!row||!u||u===norm(FINAL_URL)||tested.has(u))continue;
   tested.add(u);scanned++;
   setStatus('#育児日記案件｜確認 '+scanned+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit)+'｜'+row.creator);
   const audit=await parentingArticleAudit({...row,url:u});
   if(!audit.ok)continue;
   out.push({...row,url:u,parenting:true});
   await sleep(80)
  }
  if(q.last||q.cursor==null||String(q.cursor)===String(cursor))break;
  cursor=String(q.cursor);await sleep(60)
 }
 return out
}

async function specialTagAudit(row,tag){
 let note={},doc=null;
 try{const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));note=p?.data||p||{}}catch{}
 try{const html=String(await xhr(row.url,'text',45000)||'');doc=new DOMParser().parseFromString(html,'text/html')}catch{}
 const tagDump=JSON.stringify(note.hashtags||note.tags||note.hashtag_names||note.tag_names||note.note_hashtags||[]);
 let exactTag=tagDump.includes(tag);
 if(!exactTag&&doc){
  exactTag=[...doc.querySelectorAll('a')].some(a=>{
   const label=String(a.textContent||'').trim().replace(/^#/,'');
   let href=String(a.getAttribute('href')||'');try{href=decodeURIComponent(href)}catch{}
   return label===tag||href.includes('/hashtag/'+tag)
  })
 }
 if(!exactTag)return{ok:false,reason:'#'+tag+'タグ確認不可'};
 const parts=[row.title,note.name,note.title,note.description,note.body,note.body_html,note.bodyText,note.body_text,doc?.querySelector('article')?.textContent||doc?.querySelector('main')?.textContent||''];
 const text=parts.map(v=>String(v||'')).join(' ').replace(/\s+/g,' ').trim();
 const blocked=specialBlockedReason(text);if(blocked)return{ok:false,reason:blocked};
 // #自己紹介はタグ実在を確認できれば採用対象。本文表現の型までは強制しない。
 return{ok:true,reason:''}
}
async function collectFirstNoteSpecial(mode,count,selectedTags){
 const limit=targetLimit(mode,count);
 if(limit===0)return[];
 const tags=(Array.isArray(selectedTags)?selectedTags:[]).filter(x=>FIRST_TAGS.includes(x));
 if(!tags.length)throw new Error('タグを1つ以上選んでください');
 await keepAwake();
 await recoverSpecialExclusionsFromPublishedArticles();
 const excluded=specialExcludedSets();
 const saved=readScan();
 const effectiveLimit=limit;
 const sig=JSON.stringify({tags:[...tags].sort(),limit:limit===Infinity?'all':limit});
 const liveLimit=()=>{
  if(mode==='all')return Infinity;
  const el=document.querySelector('#'+PANEL+' [data-special-count]');
  const n=Math.max(1,Math.min(1000,Number(el?.value||effectiveLimit||1)));
  return n
 };
 const anchorPos=Number(saved?.anchorPos||0)||null;
 let states,tested,out,scanned,rejects;
 if(saved?.version===1&&saved.signature===sig&&Array.isArray(saved.states)&&Array.isArray(saved.out)){
  states=saved.states.map(st=>({...st,buffer:Array.isArray(st.buffer)?st.buffer:[]}));
  tested=new Set(Array.isArray(saved.tested)?saved.tested:[]);
  out=saved.out;scanned=Number(saved.scanned||tested.size||0);rejects=saved.rejects&&typeof saved.rejects==='object'?saved.rejects:{};
  setStatus('途中保存から再開 ✅ 採用 '+out.length+'件｜確認済み '+tested.size+'件')
 }else{
  states=tags.map(tag=>({tag,cursor:'0',done:false,page:0,buffer:[]}));
  tested=new Set();out=[];scanned=0;rejects={};
  writeScan({version:1,signature:sig,states,tested:[],out,scanned,rejects,anchorPos,active:true,updatedAt:Date.now()})
 }
 const checkpoint=()=>writeScan({version:1,signature:sig,states,tested:[...tested],out,scanned,rejects,anchorPos,active:!stopRequested,updatedAt:Date.now()});
 const reject=reason=>{const key=String(reason||'その他');rejects[key]=Number(rejects[key]||0)+1};
 async function fill(st){
  while(!stopRequested&&!st.done&&!st.buffer.length&&st.page<250){
   st.page++;
   setStatus('第二弾｜#'+st.tag+' 新着 '+st.page+'ページ｜採用 '+out.length+(mode==='all'?' / 全数':' / '+liveLimit()));
   const p=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(st.tag)+'&size=20&start='+encodeURIComponent(st.cursor)+'&sort=new');
   const q=normalizeSearch(p),rows=[];
   for(const raw of q.arr){const row=articleFromRaw(raw,{}),u=norm(row?.url);if(row&&u&&u!==norm(FINAL_URL))rows.push({...row,url:u})}
   rows.sort((a,b)=>new Date(b.publishAt||0).getTime()-new Date(a.publishAt||0).getTime());
   st.buffer=rows;
   if(q.last||!q.arr.length||q.cursor==null||String(q.cursor)===String(st.cursor))st.done=true;else st.cursor=String(q.cursor);
   checkpoint();
   if(!st.buffer.length&&!st.done)await sleep(45)
  }
 }
 for(const st of states)if(!st.buffer.length&&!st.done)await fill(st);
 while(!stopRequested&&out.length<liveLimit()&&states.some(st=>st.buffer.length||!st.done)&&scanned<20000){
  if(out.length>=liveLimit()){checkpoint();setStatus('指定件数 '+liveLimit()+' に到達｜採用 '+out.length+'件で停止');break}
  if(document.hidden){checkpoint();setStatus('バックグラウンド継続中｜進捗は逐次保存')}
  for(const st of states)if(!st.buffer.length&&!st.done)await fill(st);
  if(stopRequested){checkpoint();throw new Error('停止しました')}
  let chosenState=null,chosenRow=null,chosenTime=-Infinity;
  for(const st of states){const row=st.buffer[0];if(!row)continue;const t=new Date(row.publishAt||0).getTime();if(!chosenRow||t>chosenTime){chosenState=st;chosenRow=row;chosenTime=t}}
  if(!chosenRow)break;
  chosenState.buffer.shift();scanned++;
  const u=norm(chosenRow.url),creator=String(chosenRow.urlname||'').toLowerCase(),key=noteKey(u);
  if(tested.has(u)){reject('同一記事重複');checkpoint();continue}
  tested.add(u);checkpoint();
  if(excluded.urls.has(u)||excluded.creators.has(creator)||excluded.keys.has(key)){reject('前回掲載済み');checkpoint();continue}
  setStatus('第二弾｜#'+chosenState.tag+'｜確認 '+tested.size+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+liveLimit()));
  const audit=await specialTagAudit(chosenRow,chosenState.tag);
  if(stopRequested){checkpoint();throw new Error('停止しました')}
  if(!audit.ok){reject(audit.reason);checkpoint();continue}
  if(STRICT_FIRST_TAGS.has(chosenState.tag)){
   const single=await creatorSinglePublicArticle(chosenRow);
   if(stopRequested){checkpoint();throw new Error('停止しました')}
   if(!single){reject('公開記事が1件ではない');checkpoint();continue}
  }
  out.push({...chosenRow,specialFirstNote:true,specialSourceTag:chosenState.tag});
  const topRejects=Object.entries(rejects).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>k+' '+v).join(' / ');
  setStatus('第二弾｜確認 '+tested.size+'｜採用 '+out.length+(topRejects?'｜除外上位 '+topRejects:''));
  checkpoint();
  await sleep(55)
 }
 checkpoint();
 return out
}
function saveSpecialLast(rows){
 const list=(rows||[]).filter(x=>x?.specialFirstNote).map(x=>({url:norm(x.url),urlname:String(x.urlname||''),creator:String(x.creator||''),key:String(x.key||''),at:Date.now()}));
 writeJSONKey(SPECIAL_LAST,{at:Date.now(),count:list.length,items:list,committed:false})
}
function commitSpecialLast({silent=false}={}){
 const last=readJSONKey(SPECIAL_LAST,null);
 const items=Array.isArray(last?.items)?last.items:[];
 if(!items.length){if(!silent)setStatus('前回の特別案件成功候補がありません',true);return 0}
 const current=specialExcluded(),seen=new Set(current.map(x=>String(x.key||noteKey(x.url)||'')+'|'+String(x.urlname||'').toLowerCase()));
 let added=0;
 for(const item of items){
  const k=String(item.key||noteKey(item.url)||'')+'|'+String(item.urlname||'').toLowerCase();
  if(seen.has(k))continue;
  seen.add(k);current.push({...item,confirmedAt:Date.now()});added++
 }
 writeJSONKey(SPECIAL_EXCLUDED,current);
 writeJSONKey(SPECIAL_LAST,{...last,committed:true,committedAt:Date.now()});
 updateExcludedCount();
 if(!silent)setStatus('成功分 '+added+'件を次回以降の除外対象へ登録しました ✅');
 return added
}
function clearSpecialExcluded(){
 const n=specialExcluded().length;
 if(!n){setStatus('除外登録は0件です');return}
 if(!page.confirm('初投稿者の除外登録 '+n+'件をすべて解除しますか？'))return;
 writeJSONKey(SPECIAL_EXCLUDED,[]);updateExcludedCount();setStatus('初投稿者の除外登録をクリアしました')
}
function updateExcludedCount(){
 const e=document.querySelector('[data-excluded-count]');if(e)e.textContent='除外 '+specialExcluded().length+'件'
}

async function articleMetaImage(url){
 try{
  const html=await xhr(url,'text',45000),doc=new DOMParser().parseFromString(String(html||''),'text/html');
  return mediaUrl(doc.querySelector('meta[property="og:image"]')?.content||doc.querySelector('meta[name="twitter:image"]')?.content||'')
 }catch{return''}
}
async function creatorProfile(id){
 if(!id)return null;
 try{
  const p=await xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)),d=p?.data??p??{},u=d.creator||d.user||d;
  return{
   creator:String(u.nickname||u.name||id).trim(),
   avatar:mediaUrl(u.user_profile_image_url||u.profile_image_url||u.profileImageUrl||u.user_profile_image_path||u.profile_image_path||u.profileImagePath||u.icon_url||u.image_url||'')
  }
 }catch{return null}
}
function activityLabelFromText(text){
 const t=String(text||'').replace(/\s+/g,' ');
 const rules=[
  [/(?:生成AI|ChatGPT|AI画像|AIイラスト|人工知能|プロンプト)/ig,'AI・創作'],
  [/(?:小説|詩|短歌|俳句|エッセイ|創作|物語|漫画|イラスト)/ig,'創作・表現'],
  [/(?:子育て|育児|家族|暮らし|日常|生活)/ig,'暮らし・日常'],
  [/(?:仕事|働き方|キャリア|副業|フリーランス|転職|ビジネス)/ig,'仕事・働き方'],
  [/(?:勉強|学習|資格|読書|本|教育|学び)/ig,'学び・読書'],
  [/(?:写真|カメラ|旅行|旅|散歩|観光)/ig,'写真・旅'],
  [/(?:料理|レシピ|食事|グルメ|カフェ)/ig,'食・料理'],
  [/(?:音楽|映画|アニメ|ゲーム|舞台|ドラマ)/ig,'エンタメ'],
  [/(?:プログラミング|開発|Web|アプリ|デザイン|IT)/ig,'IT・デザイン'],
  [/(?:お金|家計|資産運用|投資|NISA|株)/ig,'お金・暮らし']
 ];
 const scored=rules.map(([re,label])=>{const m=t.match(re);return{label,count:m?.length||0}}).filter(x=>x.count>0).sort((a,b)=>b.count-a.count);
 if(!scored.length)return'日々のことや気づきを発信';
 const labels=scored.slice(0,2).map(x=>x.label);
 return labels.join('・')+'について発信'
}
async function creatorActivity(row){
 const id=String(row?.urlname||'').trim();if(!id)return'日々のことや気づきを発信';
 try{
  const [prof,contents]=await Promise.all([
   xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)).catch(()=>({})),
   creatorContents(id,1,true).catch(()=>({}))
  ]);
  const p=prof?.data?.creator||prof?.data?.user||prof?.data||prof||{};
  const list=contentList(contents).slice(0,6);
  const dump=[
   p.profile,p.description,p.bio,p.introduction,p.self_introduction,p.note_intro,
   ...list.flatMap(x=>[x?.name,x?.title,x?.description,x?.body_text]),
   row?.title
  ].filter(Boolean).join(' ');
  return activityLabelFromText(dump)
 }catch{return activityLabelFromText(row?.title||'')}
}
async function enrich(row){
 let note={},user={},profile=null;
 try{
  const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));
  note=p?.data||p||{};user=note.user||note.author||{}
 }catch{}
 profile=await creatorProfile(row.urlname||String(user.urlname||'')).catch(()=>null);
 let thumb=mediaUrl(note.eyecatch_url||note.image_url||note.imageUrl||note.thumbnail_url||note.thumbnailUrl||note.eyecatch?.url||note.eyecatch_image?.url||note.eyecatchImage?.url||note.image?.url||note.thumbnail?.url||row.thumbUrl||'');
 if(!thumb)thumb=await articleMetaImage(row.url);
 let avatar=mediaUrl(user.user_profile_image_url||user.profileImageUrl||user.profile_image_url||user.user_profile_image_path||user.profile_image_path||user.profileImagePath||profile?.avatar||row.actorImageUrl||'');
 return{
  ...row,
  creator:String(profile?.creator||user.nickname||user.name||row.creator||row.urlname||'noteクリエイター').trim(),
  actorImageUrl:avatar,
  thumbUrl:thumb,
  title:String(note.name||note.title||row.title||'無題の記事').trim()
 }
}
async function buildRows(input,special=false,workmom=false,parenting=false){
 const raw=parenting?await collectParenting(input.mode,input.count):workmom?await collectWorkmom(input.mode,input.count):special?await collectFirstNoteSpecial(input.mode,input.count,input.specialTags):await collectUnified(input.sources,input.mode,input.count,input.choice);
 const seen=new Set(),rows=[];
 for(const row of raw){
  const u=norm(row?.url);if(!u||u===norm(FINAL_URL)||seen.has(u))continue;
  seen.add(u);rows.push({...row,url:u})
 }
 rows.push({
  likerKey:'final-performance-math',urlname:'fuku444',creator:'実績の算数',
  actorUrl:'https://note.com/fuku444',actorImageUrl:'',url:FINAL_URL,
  title:'実績の算数│3日半で0→1達成',key:FINAL_KEY,publishAt:null,thumbUrl:'',finalMarker:true
 });
 const out=[];
 for(let i=0;i<rows.length;i+=5){
  if(stopRequested)throw new Error('停止しました');
  setStatus('画像情報 '+out.length+'/'+rows.length+'…');
  out.push(...await Promise.all(rows.slice(i,i+5).map(enrich)))
 }
 return out.map((x,i)=>({...x,index:i+1,finalMarker:Boolean(x.finalMarker||norm(x.url)===norm(FINAL_URL))}))
}

async function buildRowsFromSavedSpecial(maxCount){
 const scan=readScan(),saved=Array.isArray(scan?.out)?scan.out:[];
 if(!saved.length)throw new Error('保存済みの採用候補がありません');
 const n=Math.max(1,Math.min(saved.length,Number(maxCount)||saved.length));
 const seen=new Set(),rows=[];
 for(const row of saved.slice(0,n)){
  const u=norm(row?.url);if(!u||u===norm(FINAL_URL)||seen.has(u))continue;
  seen.add(u);rows.push({...row,url:u,specialFirstNote:true})
 }
 rows.push({
  likerKey:'final-performance-math',urlname:'fuku444',creator:'実績の算数',
  actorUrl:'https://note.com/fuku444',actorImageUrl:'',url:FINAL_URL,
  title:'実績の算数│3日半で0→1達成',key:FINAL_KEY,publishAt:null,thumbUrl:'',finalMarker:true
 });
 const out=[];
 for(let i=0;i<rows.length;i+=5){
  if(stopRequested)throw new Error('停止しました');
  setStatus('保存済み採用分｜画像情報 '+out.length+'/'+rows.length+'…');
  out.push(...await Promise.all(rows.slice(i,i+5).map(enrich)))
 }
 return out.map((x,i)=>({...x,index:i+1,finalMarker:Boolean(x.finalMarker||norm(x.url)===norm(FINAL_URL))}))
}
async function bitmapFromUrl(url){
 if(!url)return null;
 try{const blob=await xhr(url,'blob',45000);if('createImageBitmap'in page)return await page.createImageBitmap(blob);return await new Promise((resolve,reject)=>{const img=new page.Image(),u=page.URL.createObjectURL(blob);img.onload=()=>{page.URL.revokeObjectURL(u);resolve(img)};img.onerror=()=>{page.URL.revokeObjectURL(u);reject(new Error('画像読込失敗'))};img.src=u})}catch{return null}
}
function rounded(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}
function circle(ctx,x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.closePath()}
function fit(ctx,text,max){let s=String(text||'');if(ctx.measureText(s).width<=max)return s;while(s&&ctx.measureText(s+'…').width>max)s=[...s].slice(0,-1).join('');return s+'…'}
function lines(ctx,text,maxWidth,maxLines){const chars=[...String(text||'')],out=[];let line='';for(let i=0;i<chars.length;i++){const test=line+chars[i];if(line&&ctx.measureText(test).width>maxWidth){out.push(line);line=chars[i];if(out.length===maxLines-1){line=chars.slice(i).join('');break}}else line=test}if(line&&out.length<maxLines){while(line&&ctx.measureText(line+(line.length<String(text||'').length?'…':'')).width>maxWidth)line=[...line].slice(0,-1).join('');out.push(line+(out.length===maxLines-1&&line.length<String(text||'').length?'…':''))}return out.slice(0,maxLines)}
function designHash(value){
 let h=2166136261;
 for(const ch of String(value||'')){h^=ch.codePointAt(0)||0;h=Math.imul(h,16777619)}
 return h>>>0
}
function randomThinTheme(row){
 const themes=[
  {bg:'#ffffff',panel:'#ffffff',ink:'#101827',muted:'#64748b',line:'#d8e1ea',accent:'#22c3ee',soft:'#edfaff',kind:'minimal'},
  {bg:'#eef8ff',panel:'#ffffff',ink:'#10243a',muted:'#557086',line:'#b9d9ec',accent:'#5faee3',soft:'#dff3ff',kind:'wave'},
  {bg:'#fff8ed',panel:'#fffdf8',ink:'#33271e',muted:'#806b58',line:'#ead6ba',accent:'#e4a24d',soft:'#fff0d7',kind:'paper'},
  {bg:'#0b1622',panel:'#101f2e',ink:'#f5fbff',muted:'#9cc6da',line:'#294b60',accent:'#4ee6d6',soft:'#153544',kind:'cyber'},
  {bg:'#f7f7f7',panel:'#ffffff',ink:'#151515',muted:'#666666',line:'#cdcdcd',accent:'#111111',soft:'#eeeeee',kind:'mono'},
  {bg:'#effcf6',panel:'#fbfffd',ink:'#17352b',muted:'#58776b',line:'#bfe3d4',accent:'#37b98a',soft:'#dff7ed',kind:'ticket'},
  {bg:'#f7f1ff',panel:'#ffffff',ink:'#24143a',muted:'#745b8d',line:'#d9c5ee',accent:'#9c6ade',soft:'#eee2ff',kind:'orbit'},
  {bg:'#fff0f2',panel:'#fffafb',ink:'#3a1d27',muted:'#8a6170',line:'#efc5cf',accent:'#e76f91',soft:'#ffe1e8',kind:'stripe'},
  {bg:'#f3fbff',panel:'#ffffff',ink:'#12324a',muted:'#5d7587',line:'#c7ddea',accent:'#2b9ed8',soft:'#e5f5fc',kind:'grid'},
  {bg:'#fffdf3',panel:'#fffef8',ink:'#362f19',muted:'#7d7350',line:'#eadf9d',accent:'#d8b931',soft:'#fff6be',kind:'dots'},
  {bg:'#f4f8ff',panel:'#ffffff',ink:'#17243c',muted:'#65728b',line:'#ccd6eb',accent:'#5a74d6',soft:'#e7edff',kind:'diagonal'},
  {bg:'#fff5fa',panel:'#ffffff',ink:'#351a2b',muted:'#856278',line:'#eccdde',accent:'#d956a0',soft:'#ffe5f3',kind:'corner'},
  {bg:'#f3fff9',panel:'#ffffff',ink:'#15372a',muted:'#5f7d70',line:'#c5e7d7',accent:'#2da974',soft:'#e4f8ef',kind:'frame'},
  {bg:'#fff8f1',panel:'#fffdf9',ink:'#3b281a',muted:'#876d59',line:'#ead5c0',accent:'#e37b3d',soft:'#ffead8',kind:'split'},
  {bg:'#f9f6ff',panel:'#ffffff',ink:'#291c40',muted:'#75658a',line:'#d9cfeb',accent:'#7d5bc8',soft:'#eee6ff',kind:'ribbon'},
  {bg:'#effcff',panel:'#fbffff',ink:'#12343b',muted:'#5a7880',line:'#bfe4e8',accent:'#26afbd',soft:'#ddf7fa',kind:'bubbles'},
  {bg:'#fff7e8',panel:'#fffdfa',ink:'#382719',muted:'#88705a',line:'#efd9b7',accent:'#ef9c36',soft:'#ffebc8',kind:'sunrise'},
  {bg:'#f6fbf4',panel:'#ffffff',ink:'#22351c',muted:'#6f8069',line:'#d2e3cc',accent:'#69a850',soft:'#eaf5e4',kind:'zigzag'},
  {bg:'#eef5ff',panel:'#f9fbff',ink:'#16263d',muted:'#60738d',line:'#c3d3e9',accent:'#3f7fc5',soft:'#dce9f8',kind:'glass'},
  {bg:'#fffef7',panel:'#ffffff',ink:'#28251b',muted:'#77705d',line:'#ddd4b6',accent:'#b69443',soft:'#f6efd7',kind:'notebook'}
 ];
 const extraKinds=['chevron','cross','rings','pixel','dash','capsule','mountain','constellation','ladder','barcode','stamp','triangle','halftone','arc','beam','columns','steps','mesh','sprinkles','focus','lineburst','stack','circuit','seam','cloud','petal','tiles','radar','bracket','horizon'];
 const palettes=[
  ['#f4fbff','#ffffff','#142b3b','#607b8b','#cae2ed','#2da9d2','#e5f6fc'],
  ['#fff8fb','#ffffff','#3b1d2c','#866176','#efcbdc','#d95a9c','#ffe8f3'],
  ['#f7fff8','#ffffff','#173525','#68806f','#cfe6d5','#3aaa68','#e8f7ec'],
  ['#fffaf2','#fffefa','#39291b','#846e5a','#ead7bf','#d99240','#fff0da'],
  ['#f8f5ff','#ffffff','#2e2141','#78688e','#ddd2ec','#8062c9','#eee8fb'],
  ['#f6fbfa','#ffffff','#173431','#607b76','#cbe1dd','#3aa79b','#e5f5f2']
 ];
 for(let i=0;i<extraKinds.length;i++){
  const p=palettes[i%palettes.length];
  themes.push({bg:p[0],panel:p[1],ink:p[2],muted:p[3],line:p[4],accent:p[5],soft:p[6],kind:extraKinds[i]})
 }
 return themes[designHash(row?.key||row?.url||row?.creator)%themes.length]
}
function drawThinDecor(ctx,t){
 ctx.fillStyle=t.bg;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle=t.line;ctx.lineWidth=1.5;rounded(ctx,1,1,W-2,H-2,12);ctx.stroke();
 if(t.kind==='minimal'){
  ctx.fillStyle=t.accent;ctx.fillRect(0,0,6,H);
  ctx.fillStyle=t.soft;ctx.beginPath();ctx.arc(545,22,46,0,Math.PI*2);ctx.fill()
 }else if(t.kind==='wave'){
  const g=ctx.createLinearGradient(0,0,W,0);g.addColorStop(0,t.bg);g.addColorStop(1,t.soft);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.35;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,118);ctx.bezierCurveTo(180,70,340,150,560,92);ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='paper'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,74,H);
  ctx.strokeStyle=t.line;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(566,12);ctx.lineTo(566,H-12);ctx.stroke();ctx.setLineDash([])
 }else if(t.kind==='cyber'){
  ctx.fillStyle=t.panel;rounded(ctx,8,8,560,H-16,10);ctx.fill();
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.32;for(let x=18;x<560;x+=38){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+46,H);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='mono'){
  ctx.fillStyle=t.accent;ctx.fillRect(0,0,12,H);
  ctx.strokeStyle='#d7d7d7';for(let y=18;y<H;y+=18){ctx.beginPath();ctx.moveTo(18,y);ctx.lineTo(565,y);ctx.stroke()}
 }else if(t.kind==='ticket'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,W,H);
  ctx.fillStyle=t.panel;rounded(ctx,10,9,W-20,H-18,12);ctx.fill();
  ctx.strokeStyle=t.accent;ctx.setLineDash([6,5]);ctx.strokeRect(572,9,1,H-18);ctx.setLineDash([])
 }else if(t.kind==='orbit'){
  ctx.fillStyle=t.soft;ctx.beginPath();ctx.arc(526,72,74,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.45;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(520,70,100,38,-.25,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='stripe'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=t.line;ctx.globalAlpha=.6;for(let x=-100;x<W;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+80,H);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='grid'){
  ctx.strokeStyle=t.line;ctx.globalAlpha=.55;for(let x=0;x<570;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(570,y);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='dots'){
  ctx.fillStyle=t.accent;ctx.globalAlpha=.22;for(let y=14;y<H;y+=20)for(let x=14;x<570;x+=20){ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1
 }else if(t.kind==='diagonal'){
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.2;ctx.lineWidth=5;for(let x=-120;x<600;x+=44){ctx.beginPath();ctx.moveTo(x,H);ctx.lineTo(x+110,0);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='corner'){
  ctx.strokeStyle=t.accent;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(8,46);ctx.lineTo(8,8);ctx.lineTo(140,8);ctx.stroke();ctx.beginPath();ctx.moveTo(430,H-8);ctx.lineTo(566,H-8);ctx.lineTo(566,H-46);ctx.stroke()
 }else if(t.kind==='frame'){
  ctx.strokeStyle=t.accent;ctx.lineWidth=2;rounded(ctx,14,12,544,H-24,14);ctx.stroke();ctx.globalAlpha=.25;ctx.strokeStyle=t.line;rounded(ctx,21,19,530,H-38,11);ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='split'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,205,H);ctx.fillStyle=t.accent;ctx.globalAlpha=.18;ctx.beginPath();ctx.moveTo(205,0);ctx.lineTo(290,0);ctx.lineTo(205,H);ctx.closePath();ctx.fill();ctx.globalAlpha=1
 }else if(t.kind==='ribbon'){
  ctx.fillStyle=t.accent;ctx.globalAlpha=.16;ctx.beginPath();ctx.moveTo(0,18);ctx.lineTo(570,0);ctx.lineTo(570,28);ctx.lineTo(0,46);ctx.closePath();ctx.fill();ctx.globalAlpha=1
 }else if(t.kind==='bubbles'){
  ctx.fillStyle=t.accent;ctx.globalAlpha=.14;for(const p of [[505,25,40],[545,88,30],[455,105,22],[170,18,16]]){ctx.beginPath();ctx.arc(p[0],p[1],p[2],0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1
 }else if(t.kind==='sunrise'){
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.26;ctx.lineWidth=2;for(let a=0;a<Math.PI*2;a+=Math.PI/12){ctx.beginPath();ctx.moveTo(520,70);ctx.lineTo(520+Math.cos(a)*95,70+Math.sin(a)*95);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='zigzag'){
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.3;ctx.lineWidth=3;ctx.beginPath();for(let x=0;x<570;x+=24){const y=(x/24)%2?122:105;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='glass'){
  const g=ctx.createLinearGradient(0,0,570,H);g.addColorStop(0,'rgba(255,255,255,.8)');g.addColorStop(.5,'rgba(255,255,255,.15)');g.addColorStop(1,'rgba(255,255,255,.65)');ctx.fillStyle=g;rounded(ctx,10,9,552,H-18,14);ctx.fill();ctx.strokeStyle=t.line;ctx.stroke()
 }else if(t.kind==='notebook'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,28,H);ctx.strokeStyle=t.line;for(let y=18;y<H;y+=18){ctx.beginPath();ctx.moveTo(34,y);ctx.lineTo(566,y);ctx.stroke()}ctx.fillStyle=t.accent;for(let y=15;y<H;y+=22){ctx.beginPath();ctx.arc(14,y,3,0,Math.PI*2);ctx.fill()}
 }else if(t.kind==='chevron'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.25;ctx.lineWidth=4;for(let x=0;x<570;x+=42){ctx.beginPath();ctx.moveTo(x,20);ctx.lineTo(x+16,36);ctx.lineTo(x,52);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='cross'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.18;for(let y=18;y<H;y+=28)for(let x=18;x<570;x+=34){ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x+4,y);ctx.moveTo(x,y-4);ctx.lineTo(x,y+4);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='rings'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.22;for(const r of [18,34,50,66]){ctx.beginPath();ctx.arc(520,70,r,0,Math.PI*2);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='pixel'){ctx.fillStyle=t.accent;ctx.globalAlpha=.16;for(let y=8;y<132;y+=16)for(let x=8;x<568;x+=16)if(((x+y)/16)%3===0)ctx.fillRect(x,y,6,6);ctx.globalAlpha=1
 }else if(t.kind==='dash'){ctx.strokeStyle=t.accent;ctx.setLineDash([10,8]);ctx.globalAlpha=.32;for(let y=18;y<H;y+=26){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(570,y);ctx.stroke()}ctx.setLineDash([]);ctx.globalAlpha=1
 }else if(t.kind==='capsule'){ctx.fillStyle=t.soft;for(const p of [[430,16,100,18],[455,48,86,18],[408,80,126,18],[468,112,72,14]]){rounded(ctx,p[0],p[1],p[2],p[3],9);ctx.fill()}
 }else if(t.kind==='mountain'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.28;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,118);for(let x=0;x<570;x+=36)ctx.lineTo(x,118-(x/36%3)*16);ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='constellation'){ctx.strokeStyle=t.accent;ctx.fillStyle=t.accent;ctx.globalAlpha=.22;const q=[[420,22],[468,44],[520,28],[548,72],[490,96],[438,78]];ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();q.forEach(p=>{ctx.beginPath();ctx.arc(p[0],p[1],3,0,Math.PI*2);ctx.fill()});ctx.globalAlpha=1
 }else if(t.kind==='ladder'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.22;ctx.beginPath();ctx.moveTo(500,8);ctx.lineTo(500,132);ctx.moveTo(540,8);ctx.lineTo(540,132);for(let y=16;y<132;y+=18){ctx.moveTo(500,y);ctx.lineTo(540,y)}ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='barcode'){ctx.fillStyle=t.accent;ctx.globalAlpha=.18;for(let x=420;x<560;x+=7){ctx.fillRect(x,14,(x%5)+1,112)}ctx.globalAlpha=1
 }else if(t.kind==='stamp'){ctx.strokeStyle=t.accent;ctx.setLineDash([3,3]);ctx.globalAlpha=.35;rounded(ctx,420,20,125,86,12);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1
 }else if(t.kind==='triangle'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.18;for(let y=10;y<130;y+=24)for(let x=400;x<570;x+=28){ctx.beginPath();ctx.moveTo(x,y+16);ctx.lineTo(x+10,y);ctx.lineTo(x+20,y+16);ctx.closePath();ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='halftone'){ctx.fillStyle=t.accent;ctx.globalAlpha=.18;for(let y=16;y<128;y+=14)for(let x=420;x<564;x+=14){const r=1+((x+y)/14%4);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1
 }else if(t.kind==='arc'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.2;for(let r=28;r<120;r+=22){ctx.beginPath();ctx.arc(560,140,r,Math.PI,Math.PI*1.5);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='beam'){const g=ctx.createLinearGradient(0,0,570,H);g.addColorStop(0,'transparent');g.addColorStop(.52,t.soft);g.addColorStop(.7,'transparent');ctx.fillStyle=g;ctx.fillRect(0,0,570,H)
 }else if(t.kind==='columns'){ctx.fillStyle=t.accent;ctx.globalAlpha=.12;for(let x=390;x<570;x+=28)ctx.fillRect(x,8,14,H-16);ctx.globalAlpha=1
 }else if(t.kind==='steps'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.25;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(400,110);for(let i=0;i<7;i++){ctx.lineTo(400+i*24,110-i*12);ctx.lineTo(424+i*24,110-i*12)}ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='mesh'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.13;for(let x=380;x<590;x+=22){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-80,H);ctx.stroke();ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+80,H);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='sprinkles'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.24;for(let i=0;i<34;i++){const x=390+(i*37)%170,y=10+(i*29)%120;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+7,y+3);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='focus'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.28;ctx.lineWidth=2;for(const [x,y,dx,dy] of [[410,18,24,0],[410,18,0,24],[548,18,-24,0],[548,18,0,24],[410,122,24,0],[410,122,0,-24],[548,122,-24,0],[548,122,0,-24]]){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='lineburst'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.2;for(let a=0;a<Math.PI*2;a+=Math.PI/18){ctx.beginPath();ctx.moveTo(520,70);ctx.lineTo(520+Math.cos(a)*105,70+Math.sin(a)*70);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='stack'){ctx.fillStyle=t.soft;for(let i=0;i<5;i++){rounded(ctx,410+i*8,18+i*10,120-i*12,82-i*8,10);ctx.fill()}
 }else if(t.kind==='circuit'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.22;ctx.lineWidth=2;for(let y=24;y<120;y+=24){ctx.beginPath();ctx.moveTo(390,y);ctx.lineTo(450,y);ctx.lineTo(466,y+12);ctx.lineTo(552,y+12);ctx.stroke();ctx.beginPath();ctx.arc(552,y+12,3,0,Math.PI*2);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='seam'){ctx.strokeStyle=t.accent;ctx.setLineDash([2,5]);ctx.globalAlpha=.35;rounded(ctx,14,12,542,H-24,16);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1
 }else if(t.kind==='cloud'){ctx.fillStyle=t.soft;ctx.globalAlpha=.9;for(const p of [[438,46,28],[470,38,34],[505,50,30],[535,42,24]]){ctx.beginPath();ctx.arc(p[0],p[1],p[2],0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1
 }else if(t.kind==='petal'){ctx.fillStyle=t.accent;ctx.globalAlpha=.12;for(let a=0;a<Math.PI*2;a+=Math.PI/6){ctx.save();ctx.translate(510,70);ctx.rotate(a);ctx.beginPath();ctx.ellipse(0,-36,10,28,0,0,Math.PI*2);ctx.fill();ctx.restore()}ctx.globalAlpha=1
 }else if(t.kind==='tiles'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.16;for(let y=8;y<132;y+=24)for(let x=400;x<570;x+=24)ctx.strokeRect(x,y,18,18);ctx.globalAlpha=1
 }else if(t.kind==='radar'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.22;for(const r of [18,36,54]){ctx.beginPath();ctx.arc(510,70,r,0,Math.PI*2);ctx.stroke()}for(let a=0;a<Math.PI*2;a+=Math.PI/4){ctx.beginPath();ctx.moveTo(510,70);ctx.lineTo(510+Math.cos(a)*54,70+Math.sin(a)*54);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='bracket'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.35;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(410,28);ctx.lineTo(410,16);ctx.lineTo(470,16);ctx.moveTo(550,112);ctx.lineTo(550,124);ctx.lineTo(490,124);ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='horizon'){ctx.fillStyle=t.soft;ctx.fillRect(0,92,570,48);ctx.strokeStyle=t.accent;ctx.globalAlpha=.28;ctx.beginPath();ctx.moveTo(0,92);ctx.lineTo(570,92);ctx.stroke();ctx.globalAlpha=1
 }
}
async function makeFile(row){
 const [avatar,thumb]=await Promise.all([bitmapFromUrl(row.actorImageUrl),bitmapFromUrl(row.thumbUrl)]);
 const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d'),theme=randomThinTheme(row);
 drawThinDecor(ctx,theme);
 const ax=50,ay=70,ar=34;
 ctx.fillStyle=theme.soft;circle(ctx,ax,ay,ar+2);ctx.fill();
 ctx.strokeStyle=theme.accent;ctx.lineWidth=2;circle(ctx,ax,ay,ar+2);ctx.stroke();
 if(avatar){const iw=avatar.width||avatar.naturalWidth||1,ih=avatar.height||avatar.naturalHeight||1,scale=Math.max((ar*2)/iw,(ar*2)/ih),dw=iw*scale,dh=ih*scale;ctx.save();circle(ctx,ax,ay,ar);ctx.clip();ctx.drawImage(avatar,ax-dw/2,ay-dh/2,dw,dh);ctx.restore()}
 else{ctx.fillStyle=theme.muted;ctx.font='800 24px system-ui';ctx.textAlign='center';ctx.fillText('n',ax,57);ctx.textAlign='start'}
 const tx=100,tw=455;ctx.textBaseline='top';
 if(row.activityLabel){
  ctx.fillStyle=theme.accent;ctx.font='800 12px system-ui,-apple-system,sans-serif';ctx.fillText(fit(ctx,'活動｜'+row.activityLabel,tw),tx,9);
  ctx.fillStyle=theme.ink;ctx.font='700 17px system-ui,-apple-system,sans-serif';lines(ctx,row.title,tw,2).forEach((v,i)=>ctx.fillText(v,tx,31+i*22));
  ctx.fillStyle=theme.muted;ctx.font='700 14px system-ui,-apple-system,sans-serif';ctx.fillText(fit(ctx,row.creator+'さん',tw),tx,84);
  ctx.fillStyle=theme.accent;ctx.font='700 11px system-ui,-apple-system,sans-serif';ctx.fillText('note',tx,109)
 }else{
  ctx.fillStyle=theme.ink;ctx.font='700 18px system-ui,-apple-system,sans-serif';lines(ctx,row.title,tw,2).forEach((v,i)=>ctx.fillText(v,tx,18+i*25));
  ctx.fillStyle=theme.muted;ctx.font='700 14px system-ui,-apple-system,sans-serif';ctx.fillText(fit(ctx,row.creator+'さん',tw),tx,86);
  ctx.fillStyle=theme.accent;ctx.font='700 12px system-ui,-apple-system,sans-serif';ctx.fillText('note',tx,110)
 }
 const ix=590,iy=8,iw=262,ih=124;ctx.fillStyle=theme.panel;rounded(ctx,ix,iy,iw,ih,8);ctx.fill();ctx.strokeStyle=theme.line;ctx.lineWidth=1;rounded(ctx,ix,iy,iw,ih,8);ctx.stroke();
 if(thumb){const sw=thumb.width||thumb.naturalWidth||1,sh=thumb.height||thumb.naturalHeight||1,scale=Math.max(iw/sw,ih/sh),dw=sw*scale,dh=sh*scale;ctx.save();rounded(ctx,ix,iy,iw,ih,8);ctx.clip();ctx.drawImage(thumb,ix+(iw-dw)/2,iy+(ih-dh)/2,dw,dh);ctx.restore()}
 else{ctx.fillStyle=theme.muted;ctx.font='800 24px system-ui';ctx.textAlign='center';ctx.fillText('note',ix+iw/2,55);ctx.textAlign='start'}
 try{avatar?.close?.()}catch{}try{thumb?.close?.()}catch{}
 const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('画像生成失敗')),'image/png',1));
 return new page.File([blob],'mumei_profile_note_v17_'+String(row.index).padStart(3,'0')+'.png',{type:'image/png'})
}
function sectionHeadingText(groupIndex){
 const from=groupIndex*10+1,to=from+9;
 return String(groupIndex+1).padStart(2,'0')+'｜'+from+'〜'+to+'人目の「はじめまして」'
}
function insertHeadingAt(view,text,pos){
 const type=view.state.schema.nodes.heading;if(!type)throw new Error('note見出しノードを取得できません');
 const at=Math.max(0,Math.min(view.state.doc.content.size,Number(pos)||0));
 let node;try{node=type.create({level:2},view.state.schema.text(text))}catch{node=type.create(null,view.state.schema.text(text))}
 view.dispatch(view.state.tr.insert(at,node));
 const actual=view.state.doc.nodeAt(at);
 if(!actual||actual.type?.name!=='heading'||String(actual.textContent||'')!==text)throw new Error('10人区切り見出しの挿入確認に失敗しました');
 return{pos:at,nextPos:at+actual.nodeSize}
}
function recordHeading(text){
 const run=readRun();if(!run)return;
 const headings=Array.isArray(run.sectionHeadings)?run.sectionHeadings:[];
 if(!headings.includes(text))headings.push(text);
 writeRun({...run,sectionHeadings:headings,updatedAt:Date.now()})
}
function resolveOwnedHeadingHits(view){
 const run=readRun(),wanted=new Set(Array.isArray(run?.sectionHeadings)?run.sectionHeadings:[]),out=[];
 if(!wanted.size)return out;
 view.state.doc.descendants((node,pos)=>{if(node.type?.name==='heading'&&wanted.has(String(node.textContent||'')))out.push({node,pos})});
 return out
}
function resolveOwnedActivityHits(view){
 const run=readRun(),counts=new Map(),out=[];
 for(const text of Array.isArray(run?.activityTexts)?run.activityTexts:[]){
  const value=String(text||'');if(value)counts.set(value,(counts.get(value)||0)+1)
 }
 if(!counts.size)return out;
 const anchor=Math.max(0,Number(run.imageAnchorPos)||0);
 view.state.doc.descendants((node,pos)=>{
  if(pos<anchor||node.type?.name!=='paragraph')return;
  const text=String(node.textContent||''),remaining=counts.get(text)||0;
  if(remaining>0){out.push({node,pos});counts.set(text,remaining-1)}
 });
 return out
}
function findHeadingByText(view,text){
 let hit=null;
 view.state.doc.descendants((node,pos)=>{if(!hit&&node.type?.name==='heading'&&String(node.textContent||'')===String(text||''))hit={node,pos}});
 return hit
}
function setSelectionForInsert(view,pos){
 const max=view.state.doc.content.size;
 const at=Math.max(0,Math.min(max,Number(pos)||0));
 const Selection=selectionApi();
 const resolved=view.state.doc.resolve(at);
 const sel=typeof Selection.near==='function'?Selection.near(resolved):Selection.atEnd(view.state.doc);
 view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
 view.focus();
 return view.state.selection.from
}
async function uploadOne(view,row,file,insertPos){
 const before=new Set(imageNodes(view).map(h=>String(h.node.attrs?.id||'')).filter(Boolean));
 const selected=setSelectionForInsert(view,insertPos);
 const dt=new page.DataTransfer();dt.items.add(file);
 if(nativeImageCommand()(view,dt.files,Math.max(0,selected-1),'image')!==true)throw new Error(row.index+'番 画像アップロードを開始できません');
 const hit=await waitNewNoteImage(view,before,150000);
 const linked=relinkCaption(view,hit,row);
 const actual=imageNodes(view).find(h=>{
  const id=String(linked?.node?.attrs?.id||'');
  return (id&&String(h.node.attrs?.id||'')===id)||h.pos===linked.pos
 })||linked;
 return{hit:actual,nextPos:actual.pos+actual.node.nodeSize}
}
function recordImage(hit,row){
 const run=readRun()||{version:VERSION,articleKey:editorArticleKey(),items:[],createdAt:Date.now()};
 const rec={id:String(hit?.node?.attrs?.id||''),src:String(hit?.node?.attrs?.src||''),url:norm(row.url),creator:String(row.creator||''),at:Date.now()};
 const items=Array.isArray(run.items)?run.items:[];
 const key=(x)=>String(x.id||'')+'|'+String(x.src||'')+'|'+norm(x.url);
 if(!items.some(x=>key(x)===key(rec)))items.push(rec);
 writeRun({...run,version:VERSION,articleKey:editorArticleKey(),items,updatedAt:Date.now()})
}
function legacyOwnedMarker(node){
 return Object.values(node?.attrs||{}).some(v=>/mumei_profile_note_v1/i.test(String(v||'')))
}
function resolveOwnedImageHits(view){
 const run=readRun(),records=Array.isArray(run?.items)?run.items:[],all=imageNodes(view),owned=new Map();
 for(const rec of records){
  const byId=rec.id?all.find(h=>String(h.node.attrs?.id||'')===String(rec.id)):null;
  if(byId&&norm(byId.node.attrs?.link)===norm(rec.url)){owned.set(byId.pos,byId);continue}
  if(rec.src){
   const matches=all.filter(h=>String(h.node.attrs?.src||'')===String(rec.src)&&norm(h.node.attrs?.link)===norm(rec.url));
   if(matches.length===1)owned.set(matches[0].pos,matches[0])
  }
 }
 for(const h of all)if(legacyOwnedMarker(h.node))owned.set(h.pos,h);
 return[...owned.values()]
}
function deleteHits(view,hits){
 const uniq=[...new Map((hits||[]).map(h=>[h.pos,h])).values()].sort((a,b)=>b.pos-a.pos);
 if(!uniq.length)return 0;
 let tr=view.state.tr;
 for(const h of uniq){
  const node=view.state.doc.nodeAt(h.pos);
  if(!node||!node.eq(h.node))throw new Error('本文位置が変わったため削除を停止しました');
  tr=tr.delete(h.pos,h.pos+h.node.nodeSize)
 }
 view.dispatch(tr);ensureEndSelection(view);return uniq.length
}
async function saveOnce(label='貼り付け完了｜下書き保存を1回だけ実行中…'){
 setStatus(label);await sleep(1500);
 const b=[...document.querySelectorAll('button')].find(x=>/^(一時保存|下書き保存)$/.test(x.textContent?.trim())&&x.getClientRects().length&&!x.disabled);
 if(b){b.click();await sleep(6000)}
}
function resolveOwnedCardHits(view){
 const run=readRun(),cards=Array.isArray(run?.cardKeys)?run.cardKeys:[],baseline=new Set(run?.cardBaselineKeys||[]),hits=new Map();
 for(const rec of cards){
  if(baseline.has(String(rec.key||'')))continue;
  const hit=embedNodes(view).find(h=>cardKey(h)===String(rec.key||'')&&genuineCard(h,rec.url));
  if(hit)hits.set(cardKey(hit),hit)
 }
 return[...hits.values()]
}
async function auditGeneratedDuplicates(){
 try{
 await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.hydrate?.();
 const view=findView(),run=readRun();if(!view||!Array.isArray(run?.rows))throw new Error('現在の記事の一覧を確認できません。本文は保持しています');
 const rows=run.rows,urls=new Set(rows.map(row=>norm(row.url))),images=imageNodes(view).filter(hit=>hit.pos>=Math.max(0,Number(run.imageAnchorPos)||0)&&urls.has(norm(hit.node.attrs?.link))),imageCounts=new Map();
 for(const hit of images){const url=norm(hit.node.attrs?.link);imageCounts.set(url,(imageCounts.get(url)||0)+1)}
 const hasCardAnchor=run.cardAnchorPos!=null&&run.cardAnchorPos!==''&&Number.isFinite(Number(run.cardAnchorPos));
 const cards=hasCardAnchor?generatedCardHits(view,run,rows):[];
 const duplicateImages=rows.map(row=>({creator:row.creator,url:row.url,count:imageCounts.get(norm(row.url))||0})).filter(row=>row.count>1);
 const duplicateCards=hasCardAnchor?duplicateCardDetails(view,run,rows):[];
 const names=[...new Set([...duplicateImages,...duplicateCards].map(row=>row.creator))];
 setStatus('重複確認｜画像 '+images.length+'件｜カード '+cards.length+'件｜'+(names.length?'重複 '+names.slice(0,5).join('・'):'現在の貼り付け範囲に重複なし'),names.length>0);
 return{imageCount:images.length,cardCount:cards.length,duplicateImages,duplicateCards,duplicateCreators:names}
 }catch(error){setStatus('重複確認停止：'+(error?.message||String(error)),true);return{error:error?.message||String(error)}}
}
page.__MUMEI_PROFILE_CARD_AUDIT_DUPLICATES__=auditGeneratedDuplicates;
function trackedContentCount(view){
 if(!readRun())return{images:0,cards:0,headings:0,activities:0};
 return{images:resolveOwnedImageHits(view).length,cards:resolveOwnedCardHits(view).length,headings:resolveOwnedHeadingHits(view).length,activities:resolveOwnedActivityHits(view).length}
}
function recoverNotificationCardHits(view,run){
 const baseline=new Set(run.cardBaselineKeys||[]);
 const urls=new Set((run.rows||[]).map(row=>norm(row.url)));
 const linked=new Set(imageNodes(view).map(hit=>norm(hit.node.attrs?.link)).filter(url=>urls.has(url)&&noteKey(url)));
 const wanted=new Set([...linked].map(noteKey));
 const tracked=new Map((run.cardKeys||[]).filter(rec=>noteKey(rec.url)&&rec.key).map(rec=>[String(rec.key),noteKey(rec.url)]));
 const anchor=run.cardAnchorPos,hasAnchor=anchor!=null&&anchor!==''&&Number.isFinite(Number(anchor))&&Number(anchor)>=0&&Number(anchor)<=view.state.doc.content.size;
 return embedNodes(view).filter(hit=>{
  if(baseline.has(cardKey(hit)))return false;
  const raw=String(hit.node.attrs?.src||'');
  let key='';try{const u=new URL(raw);if(u.origin!=='https://note.com')return false;key=noteKey(u.href)||u.pathname.match(/^\/embed\/notes\/(n[a-f0-9]{12})\/?$/i)?.[1]||''}catch{return false}
  const recorded=Boolean(key)&&tracked.get(cardKey(hit))===key;
  if(hasAnchor&&hit.pos<Number(anchor)&&!recorded)return false;
  return recorded||Boolean(key)&&wanted.has(key);
 });
}
function deleteVerifiedNotificationCardHits(view,hits){
 const before=view.state.doc,uniq=[...new Map(hits.map(hit=>[hit.pos,hit])).values()].sort((a,b)=>b.pos-a.pos);
 let tr=view.state.tr;
 for(const hit of uniq){
  const node=before.nodeAt(hit.pos);
  if(node?.type?.name!=='embed'||!node.eq(hit.node))throw new Error('通知カードの位置が変わったため削除を停止しました。保存記録は保持しています');
  tr=tr.delete(hit.pos,hit.pos+node.nodeSize);
 }
 const expected=tr.doc;
 if(!expected||typeof expected.eq!=='function')throw new Error('通知カード以外の本文を保持できるか確認できないため削除を停止しました');
 if(view.state.doc!==before&&!view.state.doc.eq(before))throw new Error('本文が変更されたため削除を停止しました。保存記録は保持しています');
 view.dispatch(tr);
 if(!view.state.doc.eq(expected))throw new Error('通知カードの削除結果を確認できません。保存記録を保持しました。下書きを確認してください');
 // The deletion transaction maps the selection itself. Appending a paragraph
 // merely to move the caret would change non-card content after verification.
 return uniq.length;
}
function notificationCardBaselinePositions(view,run){
 const all=embedNodes(view),keys=new Set([...(run.cardBaselineKeys||[]),...(run.cardBaselineNodes||[]).map(record=>String(record.key||'')).filter(Boolean)]),positions=new Set(all.filter(hit=>keys.has(cardKey(hit))).map(hit=>hit.pos));
 const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
 const signatures=new Map(all.filter(hit=>typeof hit.node.toJSON==='function').map(hit=>[hit.pos,stable(hit.node.toJSON())]));
 for(const record of run.cardBaselineNodes||[]){
  if(record.key&&all.some(hit=>cardKey(hit)===String(record.key)))continue;
  const signature=record.json?stable(record.json):null;
  const match=signature?all.find(hit=>!positions.has(hit.pos)&&signatures.get(hit.pos)===signature):null;
  if(match)positions.add(match.pos);
 }
 return positions;
}
async function deleteNotificationCards({confirm=true,save=true}={}){
 await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.hydrate?.();
 const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
 const run=readRun();if(!run)throw new Error('この下書きのカード記録を確認できません。本文は保持しています');
 if(run.articleKey&&run.articleKey!==editorArticleKey())throw new Error('保存記録が別の記事のため削除を停止しました');
 const tracked=resolveOwnedCardHits(view),anchor=run.cardAnchorPos;
 const hasAnchor=anchor!=null&&anchor!==''&&Number.isFinite(Number(anchor))&&Number(anchor)>=0&&Number(anchor)<=view.state.doc.content.size;
 const scoped=hasAnchor?run:tracked.length?{...run,cardAnchorPos:Math.min(...tracked.map(hit=>hit.pos))}:null;
 const generated=scoped?generatedCardHits(view,scoped).filter(hit=>!hasAnchor||hit.pos>=Number(anchor)):[];
 const baseline=notificationCardBaselinePositions(view,run);
 const hits=[...new Map([...tracked,...generated,...recoverNotificationCardHits(view,run)].filter(hit=>!baseline.has(hit.pos)).map(hit=>[hit.pos,hit])).values()];
 if(!hits.length)return 0;
 if(confirm&&!page.confirm('今回作った正規通知カード '+hits.length+'件だけ削除します。紹介画像は残します。実行しますか？'))return null;
 const removed=deleteVerifiedNotificationCardHits(view,hits);
 const pending=run.pendingCard&&run.pendingCard.sessionId===CARD_SESSION&&!hits.some(hit=>genuineCard(hit,run.pendingCard.url))?run.pendingCard:null;
 writeRun({...run,cardKeys:[],pendingCard:pending,stage:'images_ready',updatedAt:Date.now()});
 await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
 if(save&&removed)await saveOnce('正規通知カード '+removed+'件を一括削除｜下書き保存中…');
 return removed
}
function resolveOwnedDividerHits(view,images){
 const run=readRun(),marked=new Set((Array.isArray(run?.dividerUrls)?run.dividerUrls:[]).map(norm)),out=[];
 for(const image of images){
  if(!marked.has(norm(image.node.attrs?.link)))continue;
  const pos=image.pos+image.node.nodeSize,node=view.state.doc.nodeAt(pos);
  if(!node)continue;
  let native=['horizontal_rule','horizontalRule','horizontal-rule','divider','separator','hr'].includes(node.type?.name);
  if(!native){try{const dom=node.type?.spec?.toDOM?.(node);native=Array.isArray(dom)&&dom[0]==='hr'}catch{}}
  if(native)out.push({node,pos})
 }
 return out
}
async function deleteAllGenerated({save=true}={}){
 const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
 const cards=resolveOwnedCardHits(view),images=resolveOwnedImageHits(view),headings=resolveOwnedHeadingHits(view),activities=resolveOwnedActivityHits(view);
 const dividers=resolveOwnedDividerHits(view,images);
 const removedCards=cards.length,removedImages=images.length,removedHeadings=headings.length,removedActivities=activities.length,removedDividers=dividers.length;
 deleteHits(view,[...cards,...images,...headings,...activities,...dividers]);
 writeRun(null);
 if(save&&(removedCards||removedImages||removedHeadings||removedActivities||removedDividers))await saveOnce('最初に戻る｜通知'+removedCards+'・画像'+removedImages+'・見出し'+removedHeadings+'・プロフィール'+removedActivities+'・区切り線'+removedDividers+'を削除して保存中…');
 return{removedCards,removedImages,removedHeadings,removedActivities,removedDividers}
}

function inputValues(save=true){
 const p=document.getElementById(PANEL),g=getPrefs();if(!p)return g;
 const sources=String(p.querySelector('[data-sources]')?.value||'').trim();
 const mode=p.querySelector('[data-mode]')?.value==='all'?'all':'number';
 const count=Math.max(0,Math.min(5000,Number(p.querySelector('[data-count]')?.value||0)));
 const choice=p.querySelector('button[data-choice].on')?.dataset.choice||g.choice||'latest';
 const specialMode=p.querySelector('[data-special-mode]')?.value==='all'?'all':'number';
 const specialCount=Math.max(1,Math.min(1000,Number(p.querySelector('[data-special-count]')?.value||g.specialCount||200)));
 const specialTags=[...p.querySelectorAll('button[data-special-tag].on')].map(x=>String(x.dataset.specialTag||'')).filter(Boolean);
 const v={sources,mode,count,choice,specialMode,specialCount,specialTags,collapsed:Boolean(g.collapsed),tiny:Boolean(g.tiny)};
 if(save)setPrefs(v);return v
}
function choiceLabel(c){return c==='oldest'?'最初の記事':c==='fixed'?'固定→最新':'最新記事'}
function amountLabel(mode,count){return mode==='all'?'全数':String(count)+'件'}
async function createImageList({special=false,workmom=false,parenting=false}={}){
 if(actionBlocked())return;busy=true;stopRequested=false;update();
 try{
  const input=inputValues();
  if(special)await keepAwake();
  if(!special&&!workmom&&!parenting){
   const sources=parseUnifiedSources(input.sources);
   if(!sources.length)throw new Error('記事URL・マガジンURL・#タグを1つ以上入れてください');
   if(input.mode==='number'&&input.count<=0)throw new Error('件数を1以上にするか「全数」を選んでください');
  }
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();noteUrlCommandFactory();selectionApi();

  // ①画像一覧も、開始ボタンを押した瞬間の本文タップ位置を固定して使う。
  // 以後の通信・画像生成中に選択位置が変わっても、最下部へ飛ばさない。
  let imageInsertPos=cardAnchorFromSelection(view);
  if(special){
   const savedScan=readScan();
   if(savedScan?.active&&Number.isFinite(Number(savedScan.anchorPos))&&Number(savedScan.anchorPos)>=0)imageInsertPos=Math.min(Number(savedScan.anchorPos),view.state.doc.content.size);
   else writeScan({...savedScan,version:1,anchorPos:imageInsertPos,active:true,updatedAt:Date.now()})
  }

  const leftover=trackedContentCount(view);
  if(leftover.images||leftover.cards||leftover.headings||leftover.activities){
   throw new Error('このページに今回作成分が残っています。「正規通知カード一括削除」または「最初に戻る」で整理してから新規実行してください')
  }

  if(special&&(!Array.isArray(input.specialTags)||!input.specialTags.length))throw new Error('初投稿タグを1つ以上選んでください');
  const effective=parenting
   ?{...input,mode:input.parentingMode,count:input.parentingCount}
   :workmom
    ?{...input,mode:input.workmomMode,count:input.workmomCount}
    :special
     ?{...input,mode:input.specialMode,count:input.specialCount,specialTags:input.specialTags}
     :input;

  const rows=await buildRows(effective,special,workmom,parenting);
  if(!rows.length)throw new Error('貼り付け対象が0件です');
  if(special)clearScan();

  // 指定件数は実績の算数を含まない。buildRows が最後に +1件する。
  const requestedCount=parenting?(input.parentingMode==='all'?null:input.parentingCount):workmom?(input.workmomMode==='all'?null:input.workmomCount):special?(input.specialMode==='all'?null:input.specialCount):(input.mode==='all'?null:input.count);
  writeRun({
   version:VERSION,articleKey:editorArticleKey(),items:[],cardKeys:[],sectionHeadings:[],rows,
   cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),
   createdAt:Date.now(),stage:'images_building',special:Boolean(special),workmom:Boolean(workmom),parenting:Boolean(parenting),
   imageAnchorPos:imageInsertPos,
   sources:parenting?'#'+PARENTING_TAG:workmom?'#'+WORKMOM_TAG:special?input.specialTags.map(x=>'#'+x).join(' '):input.sources,
   mode:effective.mode,count:requestedCount,choice:input.choice
  });

  setStatus((parenting?'#育児日記案件':workmom?'#ワーママ案件':special?'特別案件':'通常')+'｜ランダム極薄50種｜①画像一覧をタップ位置から '+rows.length+'件（指定'+(requestedCount??'全数')+'＋実績の算数1件）作成');
  for(let i=0;i<rows.length;i++){
   if(stopRequested)throw new Error('手動停止');
   const row=rows[i];
   if(special){
    if(row.finalMarker){
     const text='最後に｜実績の算数';
     const h=insertHeadingAt(view,text,imageInsertPos);imageInsertPos=h.nextPos;recordHeading(text)
    }else if(i%10===0){
     const text=sectionHeadingText(Math.floor(i/10));
     const h=insertHeadingAt(view,text,imageInsertPos);imageInsertPos=h.nextPos;recordHeading(text)
    }
   }
   setStatus('① 画像🔗＋名前キャプション '+(i+1)+'/'+rows.length+'｜'+row.creator);
   const file=await makeFile(row);
   const made=await uploadOne(view,row,file,imageInsertPos);
   imageInsertPos=made.nextPos;
   recordImage(made.hit,row);
   await sleep(IMAGE_PASTE_GAP)
  }

  const runNow=readRun()||{};
  writeRun({...runNow,stage:'images_ready',rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});
  if(special)saveSpecialLast(rows);
  await saveOnce('① 画像🔗＋名前キャプション '+rows.length+'/'+rows.length+' 完了｜保存中…');
  if(special){
   const autoAdded=commitSpecialLast({silent:true});
   setStatus('①初投稿者画像一覧 完了 ✅ '+rows.length+'件｜今回成功分 '+autoAdded+'件を次回重複除外へ自動登録｜カード位置をタップ →「②ここから通知カード」')
  }else{
   setStatus('①画像一覧 完了 ✅ '+rows.length+'件｜カードを置く位置を本文でタップ →「②ここから通知カード」')
  }
 }catch(e){
  setStatus('停止：'+(e?.message||String(e))+'｜完成分は本文に保持。自動再開はしません',true)
 }finally{if(special)await releaseAwake();busy=false;update()}
}
async function pasteSavedSpecial(){
 if(actionBlocked())return;busy=true;stopRequested=false;update();
 try{
  await keepAwake();
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();noteUrlCommandFactory();selectionApi();

  const input=inputValues();
  const scan=readScan(),savedCount=Array.isArray(scan?.out)?scan.out.length:0;
  let run=readRun();
  const ownedImages=resolveOwnedImageHits(view).sort((a,b)=>a.pos-b.pos);
  const ownedCards=resolveOwnedCardHits(view);
  if(ownedCards.length)throw new Error('通知カードがすでにあります。画像の続き貼り付けはできません');

  let rows=[];
  if(run?.special&&Array.isArray(run.rows)&&run.rows.length){
   rows=run.rows;
  }else{
   if(!savedCount)throw new Error('保存済み採用分がありません');
   const useCount=Math.min(savedCount,input.specialMode==='all'?savedCount:input.specialCount);
   rows=await buildRowsFromSavedSpecial(useCount);
   run={
    version:VERSION,articleKey:editorArticleKey(),items:[],cardKeys:[],sectionHeadings:[],rows,
    cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),
    createdAt:Date.now(),stage:'images_building',special:true,
    imageAnchorPos:cardAnchorFromSelection(view),
    sources:'保存済み採用分',mode:'number',count:useCount,choice:input.choice
   };
   writeRun(run)
  }

  const total=rows.length;
  let done=Math.min(ownedImages.length,total);
  let imageInsertPos;
  if(done>0){
   const last=ownedImages[done-1];
   imageInsertPos=last.pos+last.node.nodeSize;
  }else{
   imageInsertPos=Number(run?.imageAnchorPos);
   if(!Number.isFinite(imageInsertPos))imageInsertPos=cardAnchorFromSelection(view)
  }

  if(done>=total){
   writeRun({...run,stage:'images_ready',updatedAt:Date.now()});
   setStatus('画像はすでに '+done+'/'+total+' 件あります ✅ 次は本文位置をタップ→②ここから通知カード');
   return
  }

  writeRun({...run,stage:'images_building',rows,updatedAt:Date.now()});
  setStatus('保存分の続きから再開｜'+done+'/'+total+' 件済み');

  for(let i=done;i<rows.length;i++){
   if(stopRequested)throw new Error('手動停止');
   const row=rows[i];

   if(row.finalMarker){
    const text='最後に｜実績の算数';
    const existing=findHeadingByText(view,text);
    if(existing&&existing.pos>=imageInsertPos){imageInsertPos=existing.pos+existing.node.nodeSize;recordHeading(text)}
    else if(!existing){const h=insertHeadingAt(view,text,imageInsertPos);imageInsertPos=h.nextPos;recordHeading(text)}
   }else if(i%10===0){
    const text=sectionHeadingText(Math.floor(i/10));
    const existing=findHeadingByText(view,text);
    if(existing&&existing.pos>=imageInsertPos){imageInsertPos=existing.pos+existing.node.nodeSize;recordHeading(text)}
    else if(!existing){const h=insertHeadingAt(view,text,imageInsertPos);imageInsertPos=h.nextPos;recordHeading(text)}
   }

   setStatus('保存分の続き '+(i+1)+'/'+rows.length+'｜'+row.creator);
   const file=await makeFile(row);
   const made=await uploadOne(view,row,file,imageInsertPos);
   imageInsertPos=made.nextPos;
   recordImage(made.hit,row);
   await sleep(IMAGE_PASTE_GAP)
  }

  run=readRun()||run;
  writeRun({...run,stage:'images_ready',rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});
  saveSpecialLast(rows);
  await saveOnce('保存分の続き '+rows.length+'/'+rows.length+' 完了｜保存中…');
  const autoAdded=commitSpecialLast({silent:true});
  setStatus('保存分の続き貼付完了 ✅ '+rows.length+'件｜次は本文位置をタップ→②ここから通知カード')
 }catch(e){
  setStatus('停止：'+(e?.message||String(e))+'｜完成分は本文に保持',true)
 }finally{await releaseAwake();busy=false;update()}
}

function pauseCards(){
 if(!cardRunActive)return false;
 cardPauseRequested=true;
 setStatus('一時停止を受付｜処理中の通知カードを確定して保存します');
 return true;
}
async function pauseCardsAtBoundary(done,total){
 if(stopRequested)throw new Error('手動停止');
 if(!cardPauseRequested||done>=total)return false;
 const run=readRun()||{};
 writeRun({...run,stage:'cards_building',paused:true,pauseStage:'cards',pausedAt:Date.now(),updatedAt:Date.now()});
 await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
 await saveOnce('通知カード '+done+'/'+total+' 件で一時停止｜下書き保存中…');
 if(stopRequested)throw new Error('手動停止');
 setStatus('一時停止中｜通知カード '+done+'/'+total+' 件を保存済み。「再開」または②で続きから');
 return true;
}
async function createCardsAtTap(){
 if(actionBlocked())return;busy=true;stopRequested=false;cardPauseRequested=false;cardRunActive=true;update();
 try{
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  const anchors={tappedAnchor:cardAnchorFromSelection(view)};
  await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.hydrate?.();
  if(stopRequested)throw new Error('手動停止');
  await page.__MUMEI_PROFILE_CARD_ENSURE_CARDS_READY__?.(view,anchors);
  const tappedAnchor=anchors.tappedAnchor;
  if(stopRequested)throw new Error('手動停止');
  let run=readRun(),rows=Array.isArray(run?.rows)?run.rows:[];
  if(!run||!rows.length||!['images_ready','cards_building','complete'].includes(run.stage))throw new Error('先に①画像一覧を完成させてください');
  const imageCount=resolveOwnedImageHits(view).length;
  if(imageCount!==rows.length)throw new Error('今回画像が '+imageCount+'/'+rows.length+' 件です。画像一覧を確認してください');

  if(run.cardAnchorPos==null||run.cardAnchorPos===''||!Number.isFinite(Number(run.cardAnchorPos)))run={...run,cardAnchorPos:tappedAnchor};
  run=await reconcileCompletedCards(view,run,rows);

  let existing=resolveOwnedCardHits(view).sort((a,b)=>a.pos-b.pos);
  if(existing.length>rows.length||existing.some((hit,index)=>!genuineCard(hit,rows[index]?.url)))throw new Error('保存済みカードの途中に欠落または順序の違いがあります。今あるカードは保持しました');
  let done=Math.min(existing.length,rows.length);

  if(done>=rows.length){
   writeRun({...run,stage:'complete',paused:false,pauseStage:null,updatedAt:Date.now()});
   await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
   setStatus('通知カードはすでに '+done+'/'+rows.length+' 件あります ✅');
   return
  }

  // 初回だけ本文タップ位置。途中再開は最後に作れたカードの直後から続行。
  let insertPos;
  if(done>0){
   const last=existing[done-1];
   insertPos=last.pos+last.node.nodeSize
  }else if(run.cardAnchorPos!=null&&run.cardAnchorPos!==''&&Number.isFinite(Number(run.cardAnchorPos))){
   insertPos=Math.min(Number(run.cardAnchorPos),view.state.doc.content.size)
  }else{
   insertPos=tappedAnchor
  }

  const existingRecs=Array.isArray(run.cardKeys)?run.cardKeys:[];
  writeRun({...run,stage:'cards_building',paused:false,pauseStage:null,cardAnchorPos:cardAnchor(run,insertPos,view),cardKeys:existingRecs,updatedAt:Date.now()});
  await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
  let cardGapMs=CARD_GAP_FAST;
  setStatus('② 通知カードの続き｜'+done+'/'+rows.length+' 件済み');

  for(let i=done;i<rows.length;i++){
   if(stopRequested)throw new Error('手動停止');
   if(await pauseCardsAtBoundary(i,rows.length))return;
   const row=rows[i];
   let made=null;
   setStatus('② 正規通知カード '+(i+1)+'/'+rows.length+'｜'+row.creator+'｜待機 '+(cardGapMs/1000).toFixed(1)+'秒');
   made=await createNativeCard(view,row,insertPos);
   insertPos=made.nextPos;
   await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
   if(await pauseCardsAtBoundary(i+1,rows.length))return;
   await sleep(cardGapMs);

   if((i+1)%10===0&&i+1<rows.length){
    setStatus('② 正規通知カード '+(i+1)+'/'+rows.length+'｜403回避 '+(CARD_BLOCK_PAUSE/1000).toFixed(1)+'秒休止');
    await sleep(CARD_BLOCK_PAUSE)
   }
  }

  assertUniqueGeneratedCards(view,readRun()||run,rows);

  const doneRun=readRun()||{};
  const actualCards=resolveOwnedCardHits(view).length;
  if(actualCards!==rows.length)throw new Error('通知カード実数 '+actualCards+'/'+rows.length+'｜不足を検出。もう一度②を押せば続きから再開します');
  writeRun({...doneRun,stage:'complete',paused:false,pauseStage:null,cardsCompletedAt:Date.now(),updatedAt:Date.now()});
  await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
  await saveOnce('② 正規通知カード '+rows.length+'/'+rows.length+' 完了｜最終保存中…');
  setStatus('完了 ✅ 画像一覧 '+rows.length+'件 → 通知カード '+rows.length+'件')
 }catch(e){
  setStatus('通知カード停止：'+(e?.message||String(e))+'｜完成分は保持。もう一度②で続きから再開できます',true)
 }finally{cardRunActive=false;busy=false;update()}
}

async function bulkDelete(){
 if(actionBlocked())return;busy=true;stopRequested=true;update();
 try{
  const removed=await deleteNotificationCards({confirm:true,save:true});
  if(removed!==null)setStatus(removed?'正規通知カード '+removed+'件を一括削除しました ✅ 紹介画像は保持':'この本文に削除対象の通知カードはありません｜画像・プロフィールは保持')
 }catch(e){setStatus('通知カード一括削除停止：'+(e?.message||String(e)),true)}
 finally{busy=false;stopRequested=false;update()}
}
function resetFields(){
 const p=document.getElementById(PANEL);if(!p)return;
 p.querySelector('[data-sources]').value='';
 p.querySelector('[data-mode]').value='number';
 p.querySelector('[data-count]').value='10';
 const sm=p.querySelector('[data-special-mode]'),sc=p.querySelector('[data-special-count]');
 if(sm)sm.value='number';if(sc)sc.value='200';
 p.querySelectorAll('button[data-special-tag]').forEach(x=>x.classList.add('on'));
 p.querySelectorAll('button[data-choice]').forEach(x=>x.classList.toggle('on',x.dataset.choice==='latest'));
 applyAmountMode();applySpecialAmountMode()
}
async function resetAll(){
 if(actionBlocked())return;
 if(!page.confirm('今回作った紹介画像＋正規通知カードを削除し、入力・件数・途中記録を最初に戻します。元本文・元画像・元カードは残します。実行しますか？'))return;
 busy=true;stopRequested=true;update();
 try{
  const result=await deleteAllGenerated({save:false});
  localStorage.removeItem(PREF);writeRun(null);clearScan();resetFields();
  if(result.removedCards||result.removedImages||result.removedHeadings||result.removedActivities||result.removedDividers)await saveOnce('最初に戻る｜通知'+result.removedCards+'・画像'+result.removedImages+'・見出し'+result.removedHeadings+'・プロフィール'+result.removedActivities+'・区切り線'+result.removedDividers+'を削除して保存中…');
  setStatus('最初に戻しました ✅ 画像 '+result.removedImages+' / 通知 '+result.removedCards+' / 見出し '+result.removedHeadings+' / プロフィール '+result.removedActivities+' / 区切り線 '+result.removedDividers+' を削除｜元本文は保持')
 }catch(e){setStatus('最初に戻る停止：'+(e?.message||String(e)),true)}
 finally{busy=false;stopRequested=false;update()}
}
function stop(){stopRequested=true;abortActiveRequests();const scan=readScan();if(scan)writeScan({...scan,active:false,updatedAt:Date.now()});window.dispatchEvent(new Event('mumei-profile-card-stop'));setStatus('停止しました｜途中保存は保持。自動再開もしません')}
function update(){
 const p=document.getElementById(PANEL);if(!p)return;
 p.querySelectorAll('textarea,input,select,button').forEach(x=>{
  if(x.dataset.a==='stop'||x.dataset.a==='pause'||x.dataset.galleryAction==='pause'||x.dataset.ui||x.matches?.('[data-special-count]'))return;
  x.disabled=busy||fixedRunBusy()
 })
}
window.addEventListener('mumei-profile-card-fixed-state',update);
function saveUiState(extra={}){const cur=inputValues(false),old=getPrefs();setPrefs({...old,...cur,...extra})}
function applyAmountMode(){
 const p=document.getElementById(PANEL),sel=p?.querySelector('[data-mode]'),num=p?.querySelector('[data-count]');
 if(num)num.style.display=sel?.value==='all'?'none':'block'
}
function applySpecialAmountMode(){
 const p=document.getElementById(PANEL),sel=p?.querySelector('[data-special-mode]'),num=p?.querySelector('[data-special-count]');
 if(num)num.style.display=sel?.value==='all'?'none':'block'
}
function applyWorkmomAmountMode(){
 const p=document.getElementById(PANEL),sel=p?.querySelector('[data-workmom-mode]'),num=p?.querySelector('[data-workmom-count]');
 if(num)num.style.display=sel?.value==='all'?'none':'block'
}
function applyParentingAmountMode(){
 const p=document.getElementById(PANEL),sel=p?.querySelector('[data-parenting-mode]'),num=p?.querySelector('[data-parenting-count]');
 if(num)num.style.display=sel?.value==='all'?'none':'block'
}
function announcePanelReady(){window.dispatchEvent(new window.Event('mumei-profile-card-panel-ready'))}
function setCollapsed(on){
 const p=document.getElementById(PANEL);if(!p)return;
 p.classList.toggle('collapsed',Boolean(on));p.classList.remove('tiny');
 saveUiState({collapsed:Boolean(on),tiny:false});
 if(!on)announcePanelReady()
}
function setTiny(on){
 const p=document.getElementById(PANEL),mini=document.getElementById(PANEL+'-mini');if(!p||!mini)return;
 if(on){
  const r=p.getBoundingClientRect();
  mini.style.left=Math.max(4,Math.min(innerWidth-46,r.left))+'px';
  mini.style.top=Math.max(4,Math.min(innerHeight-46,r.top))+'px';mini.style.right='auto';
  p.classList.add('tiny');mini.style.display='flex'
 }else{
  const r=mini.getBoundingClientRect();
  p.style.left=Math.max(4,Math.min(innerWidth-p.offsetWidth-4,r.left))+'px';
  p.style.top=Math.max(4,Math.min(innerHeight-p.offsetHeight-4,r.top))+'px';p.style.right='auto';
  p.classList.remove('tiny','collapsed');mini.style.display='none';savePos(p)
 }
 saveUiState({tiny:Boolean(on),collapsed:false});
 if(!on)announcePanelReady()
}
function restorePos(el){
 try{const v=JSON.parse(localStorage.getItem(POS)||'null');if(!v)return;const left=Math.max(4,Math.min(innerWidth-el.offsetWidth-4,Number(v.left)||4)),top=Math.max(24,Math.min(innerHeight-el.offsetHeight-4,Number(v.top)||84));el.style.left=left+'px';el.style.top=top+'px';el.style.right='auto'}catch{}
}
function savePos(el){try{const r=el.getBoundingClientRect();localStorage.setItem(POS,JSON.stringify({left:Math.round(r.left),top:Math.round(r.top)}))}catch{}}
function bindLongDrag(handle,panel){
 if(!handle||!panel)return;
 let pid=null,startX=0,startY=0,baseL=0,baseT=0;
 const clear=()=>{clearTimeout(longTimer);longTimer=0};
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0)return;
  pid=e.pointerId;dragging=false;startX=e.clientX;startY=e.clientY;
  const r=panel.getBoundingClientRect();baseL=r.left;baseT=r.top;clear();
  longTimer=setTimeout(()=>{dragging=true;try{handle.setPointerCapture(pid)}catch{}},420)
 });
 handle.addEventListener('pointermove',e=>{
  if(!dragging||e.pointerId!==pid)return;e.preventDefault();
  const l=Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,baseL+e.clientX-startX));
  const t=Math.max(4,Math.min(innerHeight-panel.offsetHeight-4,baseT+e.clientY-startY));
  panel.style.left=l+'px';panel.style.top=t+'px';panel.style.right='auto'
 });
 const end=e=>{clear();if(dragging){e.preventDefault();savePos(panel);suppressClickUntil=Date.now()+650}dragging=false;pid=null};
 handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end)
}
function bindDirectDrag(handle,panel){
 if(!handle||!panel)return;
 let pid=null,startX=0,startY=0,baseL=0,baseT=0,moved=false;
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  pid=e.pointerId;startX=e.clientX;startY=e.clientY;moved=false;
  const r=panel.getBoundingClientRect();baseL=r.left;baseT=r.top;
  try{handle.setPointerCapture(pid)}catch{}
 });
 handle.addEventListener('pointermove',e=>{
  if(pid==null||e.pointerId!==pid)return;
  const dx=e.clientX-startX,dy=e.clientY-startY;
  if(!moved&&Math.hypot(dx,dy)<3)return;
  moved=true;e.preventDefault();e.stopPropagation();
  const l=Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,baseL+dx));
  const t=Math.max(24,Math.min(innerHeight-panel.offsetHeight-4,baseT+dy));
  panel.style.left=l+'px';panel.style.top=t+'px';panel.style.right='auto'
 });
 const end=e=>{
  if(pid==null||e.pointerId!==pid)return;
  if(moved){e.preventDefault();e.stopPropagation();savePos(panel);suppressClickUntil=Date.now()+300}
  pid=null;moved=false
 };
 handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end)
}
function escAttr(v){return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
let mountedPanel=null,mountedPanelBody=null,stopDelegationBound=false;
function restorePanel(){
 const current=document.getElementById(PANEL);
 if(current&&(current!==mountedPanel||current.querySelector('.body')!==mountedPanelBody||!document.getElementById(PANEL+'-mini')))current.remove();
 mount();
}
page.__MUMEI_PROFILE_CARD_RESTORE_PANEL__=restorePanel;
page.__MUMEI_PROFILE_CARD_REFRESH_UI__=update;
function bindPanelInputEvents(panel){
 const controlFor=event=>{const control=event.target?.closest?.('textarea,input,select,button,summary');return control&&panel.contains(control)?control:null};
 const down=event=>{
  const control=controlFor(event);if(!control)return;
  event.stopPropagation();
  // Text fields keep native caret placement and mobile keyboard. Delegation
  // also covers action buttons cloned or added after the panel has mounted.
  if(event.type==='mousedown'&&control.matches('button'))event.preventDefault();
  if(control.matches('textarea,input')&&!control.disabled&&!control.readOnly&&document.activeElement!==control)control.focus({preventScroll:true});
 };
 panel.addEventListener('pointerdown',down);
 panel.addEventListener('mousedown',down);
 panel.addEventListener('touchstart',down,{passive:true});
 for(const type of ['keydown','keypress','keyup','paste','cut','copy'])panel.addEventListener(type,event=>{
  const control=controlFor(event);if(control?.matches('textarea,input,select'))event.stopPropagation();
 });
}
function mount(){
 if(!document.body||document.getElementById(PANEL))return;
 const g=getPrefs(),p=document.createElement('div');p.id=PANEL;
 p.innerHTML=`
 <style>
 #${PANEL}{position:fixed;right:4px;top:76px;z-index:2147483647;width:min(132px,calc(100vw - 8px));padding:3px;border:1px solid #365b70;border-radius:8px;background:#07131d;color:#edf8ff;box-shadow:0 6px 16px #0008;font:7.2px/1.18 system-ui;max-height:34vh}
 #${PANEL}.tiny{display:none}#${PANEL}.collapsed .body{display:none}#${PANEL}.collapsed{width:108px;padding:3px}
 #${PANEL} .dragbar{position:absolute;left:0;right:0;top:-15px;height:15px;border:1px solid #365b70;border-bottom:0;border-radius:7px 7px 0 0;background:#0a2938;color:#c9f4ff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:6.4px;letter-spacing:.05em;touch-action:none;user-select:none;cursor:grab;z-index:2}\n #${PANEL} .head{display:grid;grid-template-columns:1fr 20px 20px;gap:1px;align-items:center;touch-action:none;user-select:none}
 #${PANEL} .title{font-weight:950;font-size:7.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:grab}
 #${PANEL} .body{max-height:calc(34vh - 23px);overflow:auto;padding-right:1px}
 #${PANEL} label{display:block;margin-top:2px;font-size:6.4px;color:#b9d8e8}
 #${PANEL} textarea{width:100%;height:34px;resize:vertical;margin-top:1px;padding:2px;border:1px solid #35576b;border-radius:5px;background:#0b1d28;color:#fff;font:6.7px/1.15 system-ui}
 #${PANEL} input,#${PANEL} select{width:100%;height:22px;padding:1px 2px;border:1px solid #35576b;border-radius:5px;background:#0b1d28;color:#fff;font-size:7px}
 #${PANEL} .amount{display:grid;grid-template-columns:43px 1fr;gap:2px;margin-top:1px}.choices{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin-top:1px}#${PANEL} .special-tags{grid-template-columns:repeat(3,1fr)}#${PANEL} .special-tags button{font-size:5.6px}
 #${PANEL} button{min-height:22px;border:1px solid #3b6378;border-radius:5px;background:#102b3b;color:#eaf9ff;font-weight:850;font-size:6.8px;touch-action:manipulation;pointer-events:auto;padding:1px 2px}
 #${PANEL} .choices button.on{background:#145c73;border-color:#63d7f1;color:#fff}
 #${PANEL} .hint{margin-top:2px;font-size:6.1px;color:#91b5c8;line-height:1.18}
 #${PANEL} .phase{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:2px}
 #${PANEL} [data-a="images"],#${PANEL} [data-a="special-images"]{background:#0b6176;border-color:#64d8ef}
 #${PANEL} [data-a="cards"]{background:#34518a;border-color:#7897df}
 #${PANEL} .tools{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:2px}#${PANEL} [data-a="delete"]{background:#5d1b25;border-color:#b95b68}#${PANEL} [data-a="reset"]{background:#4a3514;border-color:#a9833e}
 #${PANEL} details{margin-top:2px;border:1px solid #29485b;border-radius:5px;background:#091923;padding:2px}
 #${PANEL} summary{cursor:pointer;font-weight:900;font-size:6.8px;color:#dff6ff;list-style:none}#${PANEL} summary::-webkit-details-marker{display:none}
 #${PANEL} .special-actions{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:2px}
 #${STATUS}{margin-top:2px;padding-top:2px;border-top:1px solid #284555;font-size:6.2px;color:#bfe8ff;word-break:break-word}#${STATUS}[data-bad="1"]{color:#ffb8b8}
 #${PANEL}-mini{position:fixed;right:7px;top:80px;z-index:2147483647;width:30px;height:30px;border:1px solid #5fd4ee;border-radius:50%;background:#082333;color:#fff;font:950 7px system-ui;display:none;align-items:center;justify-content:center;box-shadow:0 5px 16px #0008;touch-action:none;user-select:none}
 </style>
 <div class="head"><div class="title">極薄サム v${VERSION}</div><button data-ui="collapse">－</button><button data-ui="tiny">×</button></div>
 <div class="body">
  <label>URL / マガジン / #（上から優先）</label>
  <textarea data-sources placeholder="記事URL&#10;マガジンURL&#10;#タグ">${escAttr(g.sources||'')}</textarea>
  <div class="amount"><select data-mode><option value="number">件数</option><option value="all">全数</option></select><input data-count type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${Number(g.count??10)}"></div>
  <div class="choices"><button data-choice="oldest">最初</button><button data-choice="fixed">固定→最新</button><button data-choice="latest">最新</button></div>
  <div class="hint">指定件数＋最後に「実績の算数」1件（件数外）</div>

  <div class="phase"><button data-a="images">①画像一覧</button><button data-a="cards">②カード続き/開始</button></div>

  <details data-special open>
   <summary>＋ 第二弾：初投稿＋自己紹介</summary>
   <div class="hint">#はじめてのnote / #始めてのnote＝公開1記事のみ。#自己紹介＝複数記事OK。3タグ混合新着・重複除外・NG検閲。指定件数＋実績の算数1件。10人ごと見出し。</div>
   <div class="choices special-tags"><button data-special-tag="はじめてのnote">#はじめて</button><button data-special-tag="始めてのnote">#始めて</button><button data-special-tag="自己紹介">#自己紹介</button></div>
   <div class="amount"><select data-special-mode><option value="number">件数</option><option value="all">全数</option></select><input data-special-count type="text" inputmode="numeric" pattern="[0-9]*" value="${Number(g.specialCount??200)}"></div>
   <button data-a="special-images" style="width:100%;margin-top:2px">① 指定件数＋見出し</button>
   <div class="special-actions"><button data-a="scan-stats">判定内訳</button><button data-a="paste-saved">保存分の続き</button></div><div class="special-actions"><button data-a="clear-excluded"><span data-excluded-count>除外 0件</span> 解除</button><span></span></div>
  </details>
  <details data-like300 open>
   <summary>＋ スキ履歴から紹介</summary>
   <div class="hint">新しい順｜同一人物除外｜最新記事サムネ＋アイコン｜プロフィール全文は画像の上｜極薄50種｜10人ごと見出し</div>
   <div class="special-actions"><button data-a="like300-images" style="background:#176b54;border-color:#5bd7a7">① スキ履歴から紹介</button></div>
  </details>
  <div class="tools"><button data-a="delete">通知カード削除</button><button data-a="reset">最初に戻る</button></div>
  <button data-a="stop" style="width:100%;margin-top:3px">停止</button>
  <div id="${STATUS}">①画像一覧は自動。②は本文で置く場所をタップしてから押す。</div>
 </div>`;
 document.getElementById(PANEL+'-mini')?.remove();
 const mini=document.createElement('button');mini.id=PANEL+'-mini';mini.type='button';mini.textContent='極薄';mini.title='極薄サムを開く（ハロウィンアート2026・再開）';mini.setAttribute('aria-label',mini.title);
 document.body.append(p,mini);
 bindPanelInputEvents(p);

 const choice=['oldest','fixed','latest'].includes(g.choice)?g.choice:'latest';
 p.querySelector('[data-choice="'+choice+'"]').classList.add('on');
 p.querySelector('[data-mode]').value=g.mode==='all'?'all':'number';
 p.querySelector('[data-special-mode]').value=g.specialMode==='all'?'all':'number';
 const savedSpecialTags=Array.isArray(g.specialTags)?g.specialTags:FIRST_TAGS;
 p.querySelectorAll('button[data-special-tag]').forEach(x=>x.classList.toggle('on',savedSpecialTags.includes(x.dataset.specialTag)));
 applyAmountMode();applySpecialAmountMode();updateExcludedCount();

 p.querySelectorAll('button[data-choice]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  p.querySelectorAll('button[data-choice]').forEach(x=>x.classList.remove('on'));btn.classList.add('on');saveUiState({choice:btn.dataset.choice})
 }));
 p.querySelector('[data-mode]').addEventListener('change',()=>{applyAmountMode();saveUiState()});
 p.querySelector('[data-special-mode]').addEventListener('change',()=>{applySpecialAmountMode();saveUiState()});
 p.querySelectorAll('button[data-special-tag]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  btn.classList.toggle('on');
  const on=[...p.querySelectorAll('button[data-special-tag].on')];
  if(!on.length){btn.classList.add('on');setStatus('初投稿タグは最低1つ選んでください',true);return}
  saveUiState({specialTags:on.map(x=>x.dataset.specialTag)})
 }));

 p.querySelectorAll('textarea,input').forEach(x=>{
  x.addEventListener('focus',e=>e.stopPropagation());
  x.addEventListener('click',e=>e.stopPropagation());
  x.addEventListener('change',()=>saveUiState())
 });
 for(const sel of ['[data-count]','[data-special-count]']){
  const el=p.querySelector(sel);
  el?.addEventListener('input',()=>{const d=String(el.value||'').replace(/\D+/g,'').slice(0,4);if(el.value!==d)el.value=d})
 }

 p.querySelector('[data-ui="collapse"]').addEventListener('click',e=>{e.preventDefault();setCollapsed(!p.classList.contains('collapsed'))});
 p.querySelector('[data-ui="tiny"]').addEventListener('click',e=>{e.preventDefault();setTiny(true)});
 p.querySelector('[data-a="images"]').addEventListener('click',e=>{e.preventDefault();void createImageList({special:false,workmom:false,parenting:false})});
 p.querySelector('[data-a="special-images"]').addEventListener('click',e=>{e.preventDefault();void createImageList({special:true,workmom:false,parenting:false})});
 p.querySelector('[data-a="like300-images"]').addEventListener('click',e=>{e.preventDefault();window.dispatchEvent(new Event('mumei-profile-card-start'))});
 p.querySelector('[data-a="cards"]').addEventListener('click',e=>{e.preventDefault();void createCardsAtTap()});
 p.querySelector('[data-a="scan-stats"]').addEventListener('click',e=>{e.preventDefault();const scan=readScan(),r=scan?.rejects||{};const msg=Object.entries(r).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v+'件').join('｜')||'除外内訳なし';setStatus('確認 '+(scan?.tested?.length||0)+'｜採用 '+(scan?.out?.length||0)+'｜'+msg)});
 p.querySelector('[data-a="paste-saved"]').addEventListener('click',e=>{e.preventDefault();void pasteSavedSpecial()});
 p.querySelector('[data-a="clear-excluded"]').addEventListener('click',e=>{e.preventDefault();clearSpecialExcluded()});
 p.querySelector('[data-a="delete"]').addEventListener('click',e=>{e.preventDefault();void bulkDelete()});
 p.querySelector('[data-a="reset"]').addEventListener('click',e=>{e.preventDefault();void resetAll()});
 const stopBtn=p.querySelector('[data-a="stop"]');
 stopBtn.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();stop()},{capture:true,passive:false});
 stopBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();stop()},{capture:true});
 stopBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();stop()});
 if(!stopDelegationBound){
  stopDelegationBound=true;
 document.addEventListener('pointerdown',e=>{const t=e.target?.closest?.('#'+PANEL+' [data-a="stop"]');if(t){e.preventDefault();e.stopImmediatePropagation();stop()}},{capture:true});
 document.addEventListener('touchstart',e=>{const t=e.target?.closest?.('#'+PANEL+' [data-a="stop"]');if(t){e.preventDefault();e.stopImmediatePropagation();stop()}},{capture:true,passive:false});
 }

 mini.addEventListener('click',e=>{if(dragging||Date.now()<suppressClickUntil){e.preventDefault();return}e.preventDefault();setTiny(false)});
 bindDirectDrag(p.querySelector('[data-dragbar]'),p);bindLongDrag(p.querySelector('.title'),p);bindLongDrag(mini,mini);restorePos(p);
 if(g.collapsed)p.classList.add('collapsed');if(g.tiny){p.classList.add('tiny');mini.style.display='flex'}
 mountedPanel=p;mountedPanelBody=p.querySelector('.body');update();announcePanelReady()
}
let autoResumeTimer=null;
function scheduleAutoResume(){
 clearTimeout(autoResumeTimer);
 autoResumeTimer=setTimeout(()=>{
  const saved=readScan();
  if(!saved?.active||busy||document.hidden)return;
  const p=document.getElementById(PANEL);
  if(!p)return;
  setStatus('途中保存から自動再開｜採用 '+(saved.out?.length||0)+'件・確認済み '+(saved.tested?.length||0)+'件');
  void createImageList({special:true,workmom:false,parenting:false})
 },900)
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){
  const saved=readScan();if(saved?.active)writeScan({...saved,updatedAt:Date.now()});
 }else{
  void keepAwake();
  scheduleAutoResume()
 }
});
page.addEventListener('pageshow',()=>{
 const saved=readScan();
 if(saved?.active){
  writeScan({...saved,active:false,updatedAt:Date.now()});
  setTimeout(()=>setStatus('途中保存あり｜採用 '+(saved.out?.length||0)+'件。再読み込み後は自動再開しません'),500)
 }else if(saved?.out?.length){
  setTimeout(()=>setStatus('途中保存あり｜採用 '+saved.out.length+'件'),500)
 }
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


// BEGIN INCLUDED PROFILE IMPLEMENTATION
(function(){
'use strict';

const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(location.hostname!=='editor.note.com')return;
if(page.__MUMEI_LIKE300_FIX_V266__)return;
page.__MUMEI_LIKE300_FIX_V266__=true;

const VERSION='2.6.6';
const PANEL='mumei-profile-card-paster-v1';
const STATUS='mumei-profile-card-paster-status-v1';
const BRIDGE_KEY='mumei_profile_card_likes_300_v2';
const RUN_PREFIX='mumei_profile_card_paster_run_v15:';
const PREP_PREFIX='mumei_profile_like300_fix_v230:';
const FINAL_URL='https://note.com/fuku444/n/nb4f6934381e9';
const FINAL_KEY='nb4f6934381e9';
const W=860,H=140;
const IMAGE_GAP=180;
const HISTORY_CANDIDATE_CAP=1500;

let busy=false;
let wakeLock=null;
let stopRequested=false;
let pauseRequested=false;
let nativeImageUploadActive=false;
let viewCache=null;
let imageCommandCache=null;
let selectionCache=null;
const activeRequests=new Set();
page.__MUMEI_PROFILE_CARD_FIXED_BUSY__=()=>busy||!!exportWaiter;
const coreBusy=()=>Boolean(page.__MUMEI_PROFILE_CARD_CORE_BUSY__?.());
const notifyFixedState=()=>window.dispatchEvent(new window.Event('mumei-profile-card-fixed-state'));

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const norm=value=>{
 try{
  const u=new URL(String(value||''),location.href);
  u.search='';u.hash='';
  return u.href
 }catch{return String(value||'').trim()}
};
const noteKey=url=>String(url||'').match(/\/n\/(n[a-f0-9]{12})(?:[/?#]|$)/i)?.[1]||'';
const editorArticleKey=()=>location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1]||'';
const runKey=()=>RUN_PREFIX+(editorArticleKey()||'unknown');
const prepKey=()=>PREP_PREFIX+(editorArticleKey()||'unknown');
function createStoredState(localKey,backupPrefix){
 let activeKey='',memory,hydratedKey='',revision=0,queue=Promise.resolve(),failure=null;
 const select=()=>{const key=localKey();if(activeKey!==key){activeKey=key;memory=undefined;hydratedKey='';revision=0;}return key;};
 const localRead=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
 function read(){const key=select();if(memory===undefined)memory=localRead(key);return memory;}
 function write(value){
  const key=select(),articleKey=editorArticleKey()||'unknown';
  const stamp=Math.max(Date.now(),revision+1,Number(memory?.updatedAt||0)+1);revision=stamp;
  const snapshot=value==null?null:JSON.parse(JSON.stringify({...value,updatedAt:stamp}));memory=snapshot;
  let localOk=false;try{if(snapshot==null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(snapshot));localOk=true}catch{}
  const envelope={value:snapshot==null?null:JSON.parse(JSON.stringify(snapshot)),updatedAt:stamp,deleted:snapshot==null,articleKey};
  queue=queue.then(async()=>{
   let backupOk=false;try{if(typeof GM_setValue==='function'){await Promise.resolve(GM_setValue(backupPrefix+articleKey,envelope));backupOk=true}}catch{}
   failure=localOk||backupOk?null:new Error('途中記録を保存できません。今ある貼り付けは保持しました');
  });
 }
 async function hydrate(){
  const key=select();if(hydratedKey===key)return read();
  const initialRevision=revision,articleKey=editorArticleKey()||'unknown';
  let backup=null;try{if(typeof GM_getValue==='function')backup=await Promise.resolve(GM_getValue(backupPrefix+articleKey,null))}catch{}
  if(activeKey!==key||revision!==initialRevision)return read();
  const local=localRead(key),localStamp=Number(local?.updatedAt||local?.createdAt||0);
  const valid=backup&&backup.articleKey===articleKey&&Number.isFinite(Number(backup.updatedAt));
  memory=valid&&Number(backup.updatedAt)>=localStamp?(backup.deleted?null:backup.value):local;
  revision=Math.max(revision,localStamp,valid?Number(backup.updatedAt):0);hydratedKey=key;return memory;
 }
 async function flush(){await queue;if(failure)throw failure;}
 return{read,write,hydrate,flush};
}
const runStore=createStoredState(runKey,'mumei_profile_card_run_backup_v253:');
const prepStore=createStoredState(prepKey,'mumei_profile_card_prep_backup_v253:');
const galleryStore=createStoredState(()=> 'mumei_profile_gallery126_v263:'+(editorArticleKey()||'unknown'),'mumei_profile_gallery126_backup_v263:');
function readRun(){return runStore.read()}
function writeRun(value){runStore.write(value)}
function readPrep(){return prepStore.read()}
function writePrep(value){prepStore.write(value)}
async function hydrateRunBackup(){return runStore.hydrate()}
async function flushRunBackup(){return runStore.flush()}
async function hydratePrepBackup(){return prepStore.hydrate()}
async function flushPrepBackup(){return prepStore.flush()}
page.__MUMEI_PROFILE_CARD_RUN_STORE__={read:readRun,write:writeRun,hydrate:hydrateRunBackup,flush:flushRunBackup};
page.__MUMEI_PROFILE_CARD_ENSURE_CARDS_READY__=ensureCardsRunReady;
async function keepAwake(){
 try{if(page.navigator?.wakeLock?.request&&!document.hidden)wakeLock=await page.navigator.wakeLock.request('screen')}catch{}
}
async function releaseAwake(){try{await wakeLock?.release?.()}catch{}wakeLock=null}
function setStatus(text,bad=false){
 const el=document.getElementById(STATUS);
 if(el){el.textContent=text;el.dataset.bad=bad?'1':'0'}
}
let exportWaiter=null;
function historyOptions(run=null){
 if(run?.likesHistoryFix230||run?.likesHistory){
  const count=Array.isArray(run.rows)&&run.rows.at(-1)?.finalMarker?run.rows.length-1:Number(run.historyRequestedCount||run.count)||300;
  return{mode:run.mode==='all'?'all':'number',count,target:run.mode==='all'?Infinity:count};
 }
 const panel=document.getElementById(PANEL),mode=panel?.querySelector('[data-mode]')?.value==='all'?'all':'number';
 const count=Number(panel?.querySelector('[data-count]')?.value||10);
 if(mode==='number'&&(!Number.isInteger(count)||count<1||count>HISTORY_CANDIDATE_CAP))throw new Error('スキ履歴の件数は1〜'+HISTORY_CANDIDATE_CAP+'人で指定してください');
 return{mode,count:mode==='all'?HISTORY_CANDIDATE_CAP:count,target:mode==='all'?Infinity:count};
}
function checkpointHistoryOptions(saved){
 const token=String(saved?.signature||'').match(/\|(all|\d+)\|(?:eligible-v251|exact-v250)$/)?.[1];
 if(token)return{mode:token==='all'?'all':'number',count:token==='all'?HISTORY_CANDIDATE_CAP:Number(token),target:token==='all'?Infinity:Number(token)};
 return historyOptions();
}
function historyExportCount(options){return options.mode==='all'?HISTORY_CANDIDATE_CAP:Math.min(HISTORY_CANDIDATE_CAP,Math.max(options.count+20,options.count*3));}
function prepareLikesHistoryExport(options=historyOptions()){
 if(exportWaiter)return exportWaiter.promise;
 const requestId='likes300-'+Date.now()+'-'+Math.random().toString(36).slice(2),url=new URL('https://mumei-s.github.io/note-insight/note-profile-card-paster-history-export.html');
 url.searchParams.set('request',requestId);url.searchParams.set('count',String(historyExportCount(options)));url.searchParams.set('unique','1');url.searchParams.set('scope','recent-likes');
 const popup=window.open(url.href,'_blank');
 if(!popup)return Promise.reject(new Error('スキ履歴取得画面を開けません。ブラウザのポップアップを確認してください'));
 let resolve,reject;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail});
 const timer=setTimeout(()=>{if(exportWaiter?.requestId===requestId){exportWaiter=null;notifyFixedState();try{popup.close()}catch{}reject(new Error('スキ履歴の取得待ちが時間切れになりました'));}},120000);
 exportWaiter={requestId,popup,promise,resolve,reject,timer};notifyFixedState();setStatus('スキ履歴だけを取得中｜取得後、この編集画面で貼り付け');return promise;
}
window.addEventListener('message',async event=>{
 const waiting=exportWaiter,payload=event.data;
 if(!waiting||event.origin!=='https://mumei-s.github.io'||event.source!==waiting.popup||payload?.type!=='MUMEI_INSIGHT_LIKES_V1'||payload.requestId!==waiting.requestId)return;
 exportWaiter=null;clearTimeout(waiting.timer);notifyFixedState();
 try{
  if(payload.ok!==true)throw new Error(String(payload.error||'スキ履歴取得失敗'));
  const people=uniquePeople(Array.isArray(payload.rows)?payload.rows:[]);
  if(!people.length)throw new Error('スキ履歴に対象のクリエイターがありません');
  await Promise.resolve(GM_setValue(BRIDGE_KEY,{version:231,scope:'recent-likes',at:Date.now(),people}));
  setStatus('スキ履歴 '+people.length+'人を受け取りました');waiting.resolve(people);
 }catch(error){waiting.reject(error);}
});
function startFixed300(options=historyOptions()){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 const run=readRun();
 if(run?.likesHistoryFix230&&Array.isArray(run.rows)&&run.rows.length>1)return createFixed300();
 return prepareLikesHistoryExport(options).then(()=>createFixed300(options)).catch(error=>setStatus('取得停止：'+(error?.message||String(error)),true));
}
function mediaUrl(value){
 let raw='';
 if(typeof value==='string')raw=value;
 else if(value&&typeof value==='object')raw=value.url||value.src||value.path||value.image_url||value.imageUrl||'';
 raw=String(raw||'').trim();
 if(!raw)return'';
 if(raw.startsWith('//'))return'https:'+raw;
 if(/^https?:\/\//i.test(raw))return raw;
 if(raw.startsWith('/'))return'https://assets.st-note.com'+raw;
 if(/^production\//i.test(raw))return'https://assets.st-note.com/'+raw;
 return raw
}
async function xhr(url,responseType='text',timeout=60000){
 // Retry only this read request, once. Native uploads and editor transactions
 // are never repeated, and a deliberate stop always takes precedence.
 for(let attempt=0;attempt<2;attempt++){
  if(stopRequested)throw new Error('停止しました');
  try{return await new Promise((resolve,reject)=>{
   let request=null,completed=false;
   const done=()=>{completed=true;if(request)activeRequests.delete(request)};
   const fail=(message,code)=>{
    done();
    const error=new Error(stopRequested?'停止しました':message+' '+url);
    error.code=stopRequested?'STOPPED':code;reject(error);
   };
   request=GM_xmlhttpRequest({
    method:'GET',url,responseType,timeout,
    headers:{Accept:responseType==='blob'?'image/avif,image/webp,image/png,image/jpeg,*/*':'application/json,text/html,*/*'},
    onload:r=>{
     done();
     if(stopRequested){reject(new Error('停止しました'));return}
     if(r.status>=200&&r.status<300)resolve(r.response);
     else reject(new Error('GET '+r.status+' '+url))
    },
    onerror:()=>fail('通信失敗','REQUEST_FAILED'),
    ontimeout:()=>fail('通信タイムアウト','REQUEST_TIMEOUT'),
    onabort:()=>fail('通信が中断されました','REQUEST_ABORTED')
   });
   if(request&&!completed)activeRequests.add(request)
  })}catch(error){
   if(stopRequested)throw new Error('停止しました');
   if(attempt||nativeImageUploadActive||!['REQUEST_FAILED','REQUEST_TIMEOUT','REQUEST_ABORTED'].includes(error?.code))throw error;
   await sleep(180);
   if(stopRequested)throw new Error('停止しました');
   if(nativeImageUploadActive)throw error;
  }
 }
}
async function xhrJSON(url){
 const raw=await xhr(url,'text');
 try{return JSON.parse(String(raw||''))}
 catch{throw new Error('JSON解析失敗 '+url)}
}
function abortRequests(){
 for(const request of [...activeRequests]){try{request.abort?.()}catch{}}
 activeRequests.clear()
}

function webpackRequire(){
 const chunks=page.webpackChunk_N_E;
 if(!chunks||typeof chunks.push!=='function')return null;
 let requireFn=null;
 const id=997000000+Math.floor(Math.random()*900000);
 try{chunks.push([[id],{},r=>{requireFn=r}])}catch{}
 return requireFn
}
function looksLikeView(value){
 try{return Boolean(value&&typeof value==='object'&&value.state?.doc&&value.state?.schema&&typeof value.dispatch==='function'&&value.dom&&typeof value.posAtDOM==='function')}
 catch{return false}
}
function findView(){
 if(looksLikeView(viewCache)&&viewCache.dom?.isConnected)return viewCache;
 const root=document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror');
 if(!root)return null;
 const seen=new Set(),queue=[];
 let seed=root;
 for(let i=0;i<6&&seed;i++,seed=seed.parentElement)queue.push([seed,0]);
 let checked=0;
 while(queue.length&&checked++<14000){
  const [value,depth]=queue.shift();
  if(!value||seen.has(value))continue;
  seen.add(value);
  if(looksLikeView(value))return viewCache=value;
  let keys=[];
  try{keys=Object.getOwnPropertyNames(value)}catch{continue}
  for(const key of keys){
   if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(key))continue;
   let next;
   try{next=value[key]}catch{continue}
   if(looksLikeView(next))return viewCache=next;
   if(depth<7&&next&&(typeof next==='object'||typeof next==='function')&&next!==page&&next!==document)queue.push([next,depth+1])
  }
 }
 return null
}
function nativeImageCommand(){
 if(imageCommandCache)return imageCommandCache;
 const requireFn=webpackRequire();
 let command;
 try{command=requireFn?.(94928)?.CwN}catch{}
 const src=typeof command==='function'?Function.prototype.toString.call(command):'';
 if(!(command?.length===4&&/Array\.from/.test(src)&&/imageUploading/.test(src)&&/entries/.test(src)))throw new Error('note正規画像処理を取得できません');
 return imageCommandCache=command
}
function selectionApi(){
 if(selectionCache)return selectionCache;
 const requireFn=webpackRequire();
 let mod;
 try{mod=requireFn?.(44044)}catch{}
 const Selection=mod?.Y1;
 if(typeof Selection?.atEnd!=='function')throw new Error('note内部Selectionを取得できません');
 return selectionCache=Selection
}
function imageNodes(view){
 const out=[];
 view.state.doc.descendants((node,pos)=>{if(node.type?.name==='image')out.push({node,pos})});
 return out
}
function embedNodes(view){
 const out=[];
 view.state.doc.descendants((node,pos)=>{if(node.type?.name==='embed')out.push({node,pos})});
 return out
}
function cardKey(hit){return String(hit?.node?.attrs?.embeddedContentKey||'')}
function remoteImage(node){
 const src=String(node?.attrs?.src||'');
 return /^https:\/\//i.test(src)&&!/raw\.githubusercontent\.com/i.test(src)
}
async function waitNewNoteImage(view,beforeIds,timeout=150000){
 const end=Date.now()+timeout;
 while(Date.now()<end){
  const fresh=imageNodes(view).filter(hit=>{
   const id=String(hit.node.attrs?.id||'');
   return id&&!beforeIds.has(id)&&remoteImage(hit.node)
  }).sort((a,b)=>a.pos-b.pos);
  if(fresh.length===1)return fresh[0];
  if(fresh.length>1)throw new Error('複数の新しい画像を検出しました。貼り付け中の手動画像追加を止め、本文の画像を確認してください');
  if(stopRequested)throw new Error('停止しました');
  await sleep(120)
 }
 throw new Error('note画像アップロード待ちタイムアウト')
}
function relinkCaption(view,hit,row){
 const node=view.state.doc.nodeAt(hit.pos)||hit.node;
 if(node?.type?.name!=='image')throw new Error('画像ノードを確認できません');
 const caption=row.creator+'さん';
 const replacement=node.type.create({...node.attrs,link:row.url},view.state.schema.text(caption),node.marks);
 view.dispatch(view.state.tr.replaceWith(hit.pos,hit.pos+node.nodeSize,replacement));
 const id=String(replacement.attrs?.id||'');
 const after=imageNodes(view).find(x=>id&&String(x.node.attrs?.id||'')===id)||imageNodes(view).find(x=>x.pos===hit.pos);
 if(!after||norm(after.node.attrs?.link)!==norm(row.url)||String(after.node.textContent||'').trim()!==caption)throw new Error('画像リンク・名前キャプション設定に失敗しました');
 return after
}
function setSelectionForInsert(view,pos){
 const max=view.state.doc.content.size;
 const at=Math.max(0,Math.min(max,Number(pos)||0));
 const Selection=selectionApi();
 const resolved=view.state.doc.resolve(at);
 const selection=typeof Selection.near==='function'?Selection.near(resolved):Selection.atEnd(view.state.doc);
 view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
 view.focus();
 return view.state.selection.from
}
async function uploadOne(view,row,file,insertPos){
 const before=new Set(imageNodes(view).map(x=>String(x.node.attrs?.id||'')).filter(Boolean));
 const selected=setSelectionForInsert(view,insertPos);
 const dt=new page.DataTransfer();
 dt.items.add(file);
 nativeImageUploadActive=true;
 try{
  if(nativeImageCommand()(view,dt.files,Math.max(0,selected-1),'image')!==true)throw new Error(row.index+'番 画像アップロードを開始できません');
  const hit=await waitNewNoteImage(view,before);
  const linked=relinkCaption(view,hit,row);
  const actual=imageNodes(view).find(x=>{
   const id=String(linked?.node?.attrs?.id||'');
   return (id&&String(x.node.attrs?.id||'')===id)||x.pos===linked.pos
  })||linked;
  return{hit:actual,nextPos:actual.pos+actual.node.nodeSize}
 }finally{nativeImageUploadActive=false}
}
function cardAnchorFromSelection(view){
 const sel=view.state.selection,$from=sel.$from;
 if(!$from)return view.state.doc.content.size;
 try{
  if($from.depth>=1){
   const node=$from.node(1),before=$from.before(1);
   if(node?.type===view.state.schema.nodes.paragraph&&!String(node.textContent||''))return before;
   return before+node.nodeSize
  }
 }catch{}
 return Math.max(0,Math.min(view.state.doc.content.size,Number(sel.from)||view.state.doc.content.size))
}

function contentList(payload){
 const data=payload?.data&&typeof payload.data==='object'?payload.data:{};
 return Array.isArray(data.contents)?data.contents:Array.isArray(data.notes)?data.notes:[]
}
function articleFromRaw(raw,creator={}){
 const note=raw?.note&&typeof raw.note==='object'?raw.note:raw;
 if(!note||typeof note!=='object')return null;
 const key=String(note.key||'').trim();
 if(!/^n[a-f0-9]{12}$/i.test(key))return null;
 const user=note.user||note.author||{};
 const urlname=String(creator.urlname||user.urlname||'').trim();
 const url=norm(note.noteUrl||note.url||(urlname?'https://note.com/'+urlname+'/n/'+key:''));
 if(!url)return null;
 return{
  likerKey:String(creator.likerKey||user.key||user.id||urlname||key),
  urlname,
  creator:String(creator.creator||user.nickname||user.name||urlname||'noteクリエイター').trim(),
  actorUrl:String(creator.actorUrl||(urlname?'https://note.com/'+urlname:'')),
  actorImageUrl:mediaUrl(creator.actorImageUrl)||avatarUrl(user),
  url,
  title:String(note.name||note.title||'無題の記事').trim(),
  key,
  publishAt:String(note.publishAt||note.publish_at||note.published_at||note.created_at||'').trim()||null,
  thumbUrl:thumbnailUrl(note)
 }
}
async function creatorContents(id){
 return xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)+'/contents?kind=note&page=1&disabled_pinned=true&with_notes=false')
}
async function articleMetaImage(url){
 try{
  const html=await xhr(url,'text',45000);
  const doc=new DOMParser().parseFromString(String(html||''),'text/html');
  return mediaUrl(doc.querySelector('meta[property="og:image"]')?.content||doc.querySelector('meta[name="twitter:image"]')?.content||'')
 }catch{return''}
}
function profileText(profile){
 const value=profile.profile??profile.description??profile.bio??profile.introduction??profile.self_introduction??profile.note_intro??'';
 const doc=new DOMParser().parseFromString(String(value).replace(/<br\s*\/?\s*>/gi,'\n'),'text/html');
 return String(doc.body.textContent||'').replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').trim()
}
function avatarUrl(user){
 return mediaUrl(user?.profileImageUrl||user?.userProfileImagePath||user?.user_profile_image_url||user?.profile_image_url||user?.user_profile_image_path||user?.profile_image_path||user?.profileImagePath||user?.icon_url||user?.image_url||'')
}
function thumbnailUrl(note){
 return mediaUrl(note?.eyecatch||note?.eyecatch_url||note?.spEyecatch||note?.thumbnailExternalUrl||note?.image_url||note?.imageUrl||note?.thumbnail_url||note?.thumbnailUrl||note?.eyecatch_image||note?.eyecatchImage||note?.image||note?.thumbnail||'')
}
async function preparePerson(person){
 const id=canonicalUrlname(person);
 if(!id)throw new Error('クリエイターIDを確認できません');
 try{
  const [contents,profilePayload]=await Promise.all([
   creatorContents(id),
   xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id))
  ]);
  const profile=profilePayload?.data?.creator||profilePayload?.data?.user||profilePayload?.data||profilePayload||{};
  const baseCreator={
   likerKey:creatorKey(person)||id,
   urlname:id,
   creator:String(person.creator||id),
   actorUrl:String(person.actorUrl||('https://note.com/'+id)),
   actorImageUrl:mediaUrl(person.actorImageUrl||'')
  };
  const confirmedEmpty=payload=>Array.isArray(payload?.data?.contents)&&payload.data.contents.length===0&&payload.data.totalCount===0&&payload.data.isLastPage===true&&profile?.noteCount===0;
  const noPublicArticle=()=>{const error=new Error('公開記事なし');error.code='NO_PUBLIC_ARTICLE';return error};
  let candidates=contentList(contents).map(raw=>articleFromRaw(raw,baseCreator)).filter(Boolean);
  if(!candidates.length&&confirmedEmpty(contents))throw noPublicArticle();
  if(!candidates.length){
   const fallback=await xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)+'/contents?kind=note&page=1&disabled_pinned=false&with_notes=false');
   candidates=contentList(fallback).map(raw=>articleFromRaw(raw,baseCreator)).filter(Boolean);
   if(!candidates.length&&confirmedEmpty(fallback)&&contentList(contents).length===0)throw noPublicArticle();
   candidates.sort((first,second)=>{const a=Date.parse(first.publishAt||''),b=Date.parse(second.publishAt||'');return Number.isFinite(a)&&Number.isFinite(b)?b-a:0});
  }
  const latest=candidates[0];
  if(!latest)throw new Error('公開記事を確認できません');

  const notePayload=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(latest.key)).catch(()=>({}));
  const note=notePayload?.data||notePayload||{};
  const user=note.user||note.author||{};

  const avatar=avatarUrl(profile)||avatarUrl(user)||baseCreator.actorImageUrl||latest.actorImageUrl;
  const thumb=thumbnailUrl(note)||latest.thumbUrl||await articleMetaImage(latest.url);
  if(!thumb)throw new Error('記事サムネイルが未設定：'+id);
  const biography=profileText(profile);

  return{
   ...latest,
   creator:String(profile.nickname||profile.name||user.nickname||user.name||person.creator||id).trim(),
   actorImageUrl:avatar,
   avatarMissing:!avatar,
   thumbUrl:thumb,
   title:String(note.name||note.title||latest.title||'無題の記事').trim(),
   profileText:biography,
   likesHistory:true,
   likedAt:String(person.likedAt||'')
  }
 }catch(error){const failure=new Error(id+'さんの確認失敗：'+(error?.message||String(error)));if(error?.code)failure.code=error.code;throw failure}
}
function canonicalUrlname(person){
 const raw=String(person?.urlname||'').trim();
 if(raw)return raw.toLowerCase();
 try{const url=new URL(String(person?.actorUrl||''));if(url.hostname==='note.com'||url.hostname==='www.note.com')return decodeURIComponent(url.pathname.split('/')[1]||'').trim().toLowerCase()}catch{}
 return''
}
function creatorKey(person){return String(person?.likerKey??person?.liker_key??'').trim()}
function uniquePeople(people){
 const parents=new Map();
 const root=id=>{if(!parents.has(id))parents.set(id,id);let at=id;while(parents.get(at)!==at)at=parents.get(at);while(parents.get(id)!==id){const next=parents.get(id);parents.set(id,at);id=next}return at};
 const join=(a,b)=>{const first=root(a),second=root(b);if(first!==second)parents.set(second,first)};
 const candidates=(Array.isArray(people)?people:[]).map(person=>({person,name:canonicalUrlname(person),key:creatorKey(person)}));
 for(const {name,key} of candidates){if(!name)continue;root('name:'+name);if(key)join('name:'+name,'key:'+key)}
 const excluded=root('name:fuku444'),seen=new Set();
 return candidates.filter(({name})=>{if(!name)return false;const identity=root('name:'+name);if(identity===excluded||seen.has(identity))return false;seen.add(identity);return true}).map(({person,name})=>({...person,urlname:name}))
}
function sameCreator(first,second){
 const firstKey=creatorKey(first),secondKey=creatorKey(second);
 return !!(firstKey&&secondKey&&firstKey===secondKey)||!!(canonicalUrlname(first)&&canonicalUrlname(first)===canonicalUrlname(second))
}
function validateFixedRows(rows,expectedCount=null){
 if(!Array.isArray(rows)||rows.length<2||rows.length>HISTORY_CANDIDATE_CAP+1||expectedCount!=null&&rows.length!==expectedCount+1)throw new Error('保存済みの指定件数＋実績1件の一覧を確認できません');
 const count=rows.length-1,creators=rows.slice(0,count),final=rows[count];
 if(uniquePeople(creators).length!==count||creators.some((row,index)=>row.finalMarker||Number(row.index)!==index+1))throw new Error('保存済み一覧にクリエイターの重複・不足・順序の不一致があります。「最初に戻る」で一覧を作り直してください');
 if(!final?.finalMarker)throw new Error('最後の実績の算数を含む'+(rows.length+1)+'件の一覧を確認できません。「最初に戻る」で一覧を作り直してください');
 if(Number(final.index)!==rows.length||canonicalUrlname(final)!=='fuku444'||norm(final.url)!==norm(FINAL_URL))throw new Error('最後の実績の算数を確認できません。「最初に戻る」で一覧を作り直してください');
 if(creators.some(row=>sameCreator(row,final)))throw new Error('実績の算数が'+count+'人の一覧にも含まれています。「最初に戻る」で一覧を作り直してください');
 return rows
}
function completedImagePrefix(rows,images){
 if(images.length>rows.length)throw new Error('保存済み画像が一覧の件数を超えています。本文を確認してください');
 for(let index=0;index<images.length;index++){
  if(!rows[index]?.url||norm(images[index]?.node?.attrs?.link)!==norm(rows[index].url))throw new Error('画像の不足・順序の変更を検出しました。'+(index+1)+'人目から本文を確認し、「① 最初から」で作り直してください');
 }
 return images.length
}
async function buildRows(target=300){
 const bridge=await Promise.resolve(GM_getValue(BRIDGE_KEY,null));
 const people=uniquePeople(Array.isArray(bridge?.people)?bridge.people:[]);
 if(!people.length)throw new Error('スキ履歴の取得データがありません。「① 最初から」で取得してください');
 const targetKey=target===Infinity?'all':target;
 const signature=String(bridge?.at||0)+'|'+targetKey+'|eligible-v251';
 const previousSignature=String(bridge?.at||0)+'|'+targetKey+'|exact-v250';
 let saved;
 saved=readPrep()
 const compatible=saved?.signature===signature||saved?.signature===previousSignature;
 let rows=Array.isArray(saved?.rows)&&compatible?saved.rows:[];
 let skipped=Array.isArray(saved?.skipped)&&saved.signature===signature?saved.skipped:[];
 let index=compatible?Number(saved.index||0):0;
 let accepted=0;
 const validCheckpoint=Number.isInteger(index)&&index===rows.length+skipped.length&&index<=people.length&&rows.length<=target&&uniquePeople([...rows,...skipped]).length===index&&skipped.every(person=>String(person.reason||'').trim())&&people.slice(0,index).every(person=>skipped.some(entry=>sameCreator(entry,person))||sameCreator(rows[accepted++],person))&&accepted===rows.length;
 if(!validCheckpoint)throw new Error('確認途中の保存データに重複・順序の不一致があります。スキ履歴を取得し直してください');
 if(saved?.signature===previousSignature){writePrep({...saved,signature,index,rows,skipped,updatedAt:Date.now()});await flushPrepBackup();}

 while(index<people.length&&rows.length<target){
  if(stopRequested)throw new Error('停止しました');
  const batch=people.slice(index,index+Math.min(6,target-rows.length));
  setStatus('スキ履歴｜確認 '+rows.length+'/'+(target===Infinity?'取得分全数':target)+'｜候補 '+(index+batch.length)+'/'+people.length+'｜除外 '+skipped.length);
  const results=await Promise.allSettled(batch.map(preparePerson));
  const stopped=results.find(result=>result.status==='rejected'&&/停止しました|手動停止/.test(String(result.reason?.message||result.reason)));
  if(stopRequested||stopped)throw stopped?.reason||new Error('停止しました');
  const prepared=[],rejected=[];
  for(let position=0;position<results.length;position++){
   const result=results[position],person=batch[position];
   if(result.status==='fulfilled'&&result.value&&sameCreator(result.value,person)){prepared.push(result.value);continue}
   const error=result.status==='rejected'?result.reason:new Error('公開記事・クリエイター情報を確認できません');
   rejected.push({urlname:canonicalUrlname(person),likerKey:creatorKey(person),reason:error?.code==='NO_PUBLIC_ARTICLE'?'公開記事なし':String(error?.message||error)})
  }
  if(uniquePeople([...rows,...prepared,...skipped,...rejected]).length!==rows.length+prepared.length+skipped.length+rejected.length)throw new Error('クリエイターの重複を検出しました。スキ履歴を取得し直してください');
  rows.push(...prepared);skipped.push(...rejected);index+=batch.length;
  writePrep({signature,index,rows,skipped,updatedAt:Date.now()});await flushPrepBackup();
 }
 if(target!==Infinity&&rows.length<target)throw new Error('貼り付け可能なクリエイター '+rows.length+'/'+target+'人｜公開記事なし・取得不可 '+skipped.length+'人を除外。指定件数に不足しています。スキ履歴を取得し直してください');
 if(!rows.length)throw new Error('貼り付け可能なクリエイターがありません。公開記事なし・取得不可の候補を除外しました');
 return rows.slice(0,target).map((row,index)=>({...row,index:index+1}))
}
async function replaceUnavailableCreator(rows,index,error,mode='number'){
 validateFixedRows(rows);
 const count=rows.length-1,target=mode==='all'?Infinity:count;
 if(stopRequested||/停止しました|手動停止/.test(String(error?.message||error)))throw error||new Error('停止しました');
 if(!Number.isInteger(index)||index<0||index>=count)throw new Error('最後の実績の算数は除外できません。画像の取得を再試行してください');
 const failed=rows[index],bridge=await Promise.resolve(GM_getValue(BRIDGE_KEY,null)),people=uniquePeople(Array.isArray(bridge?.people)?bridge.people:[]);
 if(!people.length)throw new Error('追加候補の保存データがありません。現在の貼り付けは保持しました');
 const targetKey=target===Infinity?'all':target;
 const signature=String(bridge?.at||0)+'|'+targetKey+'|eligible-v251',previousSignature=String(bridge?.at||0)+'|'+targetKey+'|exact-v250';
 let checkpoint;
 checkpoint=readPrep()
 let selected,skipped,scanned;
 if(checkpoint?.signature===signature||checkpoint?.signature===previousSignature){
  selected=Array.isArray(checkpoint.rows)?checkpoint.rows:[];
  skipped=checkpoint.signature===signature&&Array.isArray(checkpoint.skipped)?checkpoint.skipped:[];
  scanned=Number(checkpoint.index||0);
  let accepted=0;
  const valid=Number.isInteger(scanned)&&scanned===selected.length+skipped.length&&scanned<=people.length&&selected.length<=target&&uniquePeople([...selected,...skipped]).length===scanned&&skipped.every(person=>String(person.reason||'').trim())&&people.slice(0,scanned).every(person=>skipped.some(entry=>sameCreator(entry,person))||sameCreator(selected[accepted++],person))&&accepted===selected.length;
  if(!valid)throw new Error('追加候補の保存順序を確認できません。現在の貼り付けは保持しました');
  if(!selected.some(person=>sameCreator(person,failed))&&!skipped.some(person=>sameCreator(person,failed)))throw new Error('取得できなかったクリエイターと保存済み一覧が一致しません。現在の貼り付けは保持しました');
 }else{
  const creators=rows.slice(0,count),positions=[];
  let cursor=0;
  for(const creator of creators){
   let found=-1;
   for(let candidate=cursor;candidate<people.length;candidate++){if(sameCreator(creator,people[candidate])){found=candidate;break}}
   if(found<0)throw new Error('現在の一覧に対応する追加候補を確認できません。現在の貼り付けは保持しました');
   positions.push(found);cursor=found+1;
  }
  scanned=cursor;selected=creators;
  const included=new Set(positions);
  skipped=people.slice(0,scanned).filter((person,position)=>!included.has(position)).map(person=>({urlname:canonicalUrlname(person),likerKey:creatorKey(person),reason:'前回の一覧で除外'}));
 }
 selected=selected.filter(person=>!sameCreator(person,failed));
 if(!skipped.some(person=>sameCreator(person,failed)))skipped.push({urlname:canonicalUrlname(failed),likerKey:creatorKey(failed),reason:String(error?.message||error||'画像取得不可')});
 writePrep({...checkpoint,signature,index:scanned,rows:selected,skipped,updatedAt:Date.now()});await flushPrepBackup();
 const filled=await buildRows(target);
 if(rows.slice(0,index).some((row,position)=>!sameCreator(row,filled[position])))throw new Error('貼り付け済みの順序を維持できません。現在の貼り付けは保持しました');
 const refreshed=filled.map((person,position)=>{if(position<index)return rows[position];const previous=rows.slice(0,count).find(row=>sameCreator(row,person));return previous?{...person,...previous,index:position+1}:{...person,index:position+1}});
 refreshed.push({...rows[count],index:filled.length+1});
 for(let position=index;position<refreshed.length;position++){
  const row=refreshed[position],before=refreshed[position-1]?.designIndex,next=refreshed[position+1]?.designIndex;
  if(Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<50&&row.designIndex!==before)continue;
  const choices=Array.from({length:50},(_,style)=>style).filter(style=>style!==before&&style!==next);
  refreshed[position]={...row,designIndex:choices[Math.floor(Math.random()*choices.length)]};
 }
 validateFixedRows(refreshed);
 const latest=readPrep();if(latest?.signature===signature){writePrep({...latest,rows:refreshed.slice(0,-1),updatedAt:Date.now()});await flushPrepBackup();}
 return refreshed
}
async function recoverCompatibleRun(view,existing){
 if(!existing||existing.articleKey!==editorArticleKey())throw new Error('現在の記事に対応する保存データを確認できません。本文は保持しています');
 let originalPlan=null;
 try{if(Array.isArray(existing.rows))originalPlan=validateFixedRows(existing.rows)}catch{}
 const options=historyOptions({...existing,likesHistory:true}),target=options.target;
 const currentFragment=/^2\.[56]\.\d+(?:$|\b)/.test(String(existing.version||''));
 const knownHistory=existing.likesHistory===true&&originalPlan;
 if(!currentFragment&&!knownHistory)throw new Error('この保存データをスキ'+options.count+'人の履歴貼り付けとして確認できません。本文は保持しています');
 const records=Array.isArray(existing.items)?existing.items:[],all=imageNodes(view),matched=new Map();
 for(const record of records){
  const byId=record.id?all.find(hit=>String(hit.node.attrs?.id||'')===String(record.id)):null;
  if(byId&&norm(byId.node.attrs?.link)!==norm(record.url))throw new Error('保存済み画像のリンクが変更されています。本文は保持しています');
  const bySrc=!byId&&record.src?all.filter(hit=>String(hit.node.attrs?.src||'')===String(record.src)&&norm(hit.node.attrs?.link)===norm(record.url)):[];
  if(bySrc.length>1)throw new Error('保存済み画像を一つに特定できません。本文は保持しています');
  const hit=byId||bySrc[0];
  if(hit)matched.set(hit.pos,{...hit,record})
 }
 const owned=[...matched.values()].sort((first,second)=>first.pos-second.pos);
 if(!owned.length&&(!originalPlan||records.length))throw new Error('現在の本文に対応する貼り付け済み画像を確認できません。本文は保持しています');
 const verify=plan=>{
  const verified=plan.map(row=>({...row}));
  if(owned.length>verified.length)throw new Error('貼り付け済み画像が一覧を超えています');
  for(let position=0;position<owned.length;position++){
   const {node,record}=owned[position],row=verified[position];
   if(norm(node.attrs?.link)!==norm(row.url)){
    const owner=canonicalUrlname({actorUrl:record.url}),caption=String(node.textContent||'').trim();
    if(!owner||owner!==canonicalUrlname(row)||!noteKey(record.url)||!record.creator||caption!==record.creator+'さん')throw new Error('貼り付け済み画像と保存済み一覧の順序が一致しません');
    verified[position]={...row,url:norm(record.url),key:noteKey(record.url),creator:String(record.creator)};
   }
   if(record.creator&&String(node.textContent||'').trim()===record.creator+'さん')verified[position].creator=String(record.creator);
   const previous=(Array.isArray(existing.rows)?existing.rows:[]).find(person=>sameCreator(person,verified[position])&&norm(person.url)===norm(verified[position].url));
   if(previous&&Number.isInteger(previous.designIndex))verified[position].designIndex=previous.designIndex;
  }
  completedImagePrefix(verified,owned);return validateFixedRows(verified)
 };
 let rows;
 if(originalPlan){try{rows=verify(originalPlan)}catch{}}
 if(!rows){
  let checkpoint;
  checkpoint=readPrep()
  const checkpointOptions=checkpointHistoryOptions(checkpoint);
  if(Array.isArray(checkpoint?.rows)&&checkpoint.rows.length&&(target===Infinity||checkpoint.rows.length===target)&&checkpointOptions.target===target){
   const final=originalPlan?.at(-1)||await enrichFinal(checkpoint.rows.length+1);
   try{rows=verify(validateFixedRows([...checkpoint.rows.map((row,position)=>({...row,index:position+1})),{...final,index:checkpoint.rows.length+1}]))}catch{}
  }
 }
 if(!rows){const creators=await buildRows(target);rows=verify(validateFixedRows([...creators,await enrichFinal(creators.length+1)]))}
 for(let position=0;position<rows.length;position++){
  const row=rows[position],before=rows[position-1]?.designIndex,next=rows[position+1]?.designIndex;
  if(position<owned.length&&(Array.isArray(existing.rows)?existing.rows:[]).some(person=>sameCreator(person,row)&&norm(person.url)===norm(row.url)&&person.designIndex===row.designIndex)&&Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<50)continue;
  if(Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<50&&row.designIndex!==before)continue;
  const choices=Array.from({length:50},(_,style)=>style).filter(style=>style!==before&&style!==next);
  rows[position]={...row,designIndex:choices[Math.floor(Math.random()*choices.length)]}
 }
 const blocks=[];
 if(typeof view.state.doc.forEach==='function')view.state.doc.forEach((node,pos)=>blocks.push({node,pos}));
 else view.state.doc.descendants((node,pos)=>{blocks.push({node,pos});return false});
 const headings=new Set(existing.sectionHeadings||[]),activities=new Set(existing.activityTexts||[]),dividers=new Set(existing.dividerUrls||[]);
 let anchor=owned[0]?.pos??(Number(existing.imageAnchorPos)||0);
 const recoverProfile=(block,row)=>{
  const prefix='プロフィール｜'+row.creator+'さん：';
  if(block?.node?.type?.name!=='paragraph'||!String(block.node.textContent||'').startsWith(prefix))return false;
  const text=String(block.node.textContent),profile=text.slice(prefix.length);
  activities.add(text);row.profileText=profile==='プロフィール未設定'?'':profile;return true
 };
 for(let position=0;position<owned.length;position++){
  const image=owned[position],blockIndex=blocks.findIndex(block=>block.pos===image.pos),row=rows[position];
  if(blockIndex<0)throw new Error('貼り付け済み画像の本文位置を確認できません。本文は保持しています');
  let before=blockIndex-1;
  if(!row.finalMarker&&recoverProfile(blocks[before],row)){if(position===0)anchor=blocks[before].pos;before--}
  const expected=row.finalMarker?'最後に｜実績の算数':position%10===0?headingText(Math.floor(position/10),rows.length-1):'';
  if(expected&&blocks[before]?.node?.type?.name==='heading'&&String(blocks[before].node.textContent||'')===expected){headings.add(expected);if(position===0)anchor=blocks[before].pos}
  if(isDivider(view,blocks[blockIndex+1]?.node))dividers.add(row.url);
 }
 if(owned.length&&owned.length<rows.length){
  const last=owned[owned.length-1],at=blocks.findIndex(block=>block.pos===last.pos),row=rows[owned.length];
  let after=at+1;if(isDivider(view,blocks[after]?.node))after++;
  const expected=row.finalMarker?'最後に｜実績の算数':owned.length%10===0?headingText(Math.floor(owned.length/10),rows.length-1):'';
  if(expected&&blocks[after]?.node?.type?.name==='heading'&&String(blocks[after].node.textContent||'')===expected){headings.add(expected);after++}
  if(!row.finalMarker)recoverProfile(blocks[after],row)
 }
 return{...existing,version:VERSION,articleKey:editorArticleKey(),likesHistoryFix230:true,likesHistory:true,rows,items:records,count:rows.length-1,choice:'latest',mode:options.mode,stage:owned.length===rows.length?(['images_ready','cards_building','complete'].includes(existing.stage)?existing.stage:'images_ready'):'images_building',imageAnchorPos:Number.isFinite(Number(existing.imageAnchorPos))&&Number(existing.imageAnchorPos)>=0&&Number(existing.imageAnchorPos)<=anchor?Number(existing.imageAnchorPos):anchor,sectionHeadings:[...headings],activityTexts:[...activities],dividerUrls:[...dividers],cardKeys:Array.isArray(existing.cardKeys)?existing.cardKeys:[],cardBaselineKeys:Array.isArray(existing.cardBaselineKeys)?existing.cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),sources:existing.sources||'スキ履歴（読み取りのみ）',recoveredAt:Date.now(),updatedAt:Date.now()}
}
async function ensureCardsRunReady(view,anchors=null){
 await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);
 let run=readRun();
 if(!run)return null;
 if(run.gallery126){
  if(run.articleKey!==editorArticleKey())throw new Error('別の記事の保存記録です');
  const rows=validateGalleryRows(run.rows);
  if(!rows.at(-1)?.finalMarker)throw new Error('最後の実績の算数が未追加です。「続きから」で末尾の画像を完成させてください');
  assertGalleryTracking(view,run);repairGalleryProfileParagraphs(view,run,rows,anchors);await flushRunBackup();run=readRun();
  const images=ownedImagesForRun(view,run);
  const count=completedImagePrefix(rows,images);
  if(count!==rows.length)throw new Error('ハロウィン画像の照合 '+count+'/'+rows.length+'件。先に画像の続きを完成させてください');
  assertGalleryPaste(view,rows);
  if(!['images_ready','cards_building','complete'].includes(run.stage)){
   writeRun({...run,stage:'images_ready',updatedAt:Date.now()});await flushRunBackup();
  }
  return readRun();
 }
 if(Array.isArray(run.rows)&&run.rows.length&&['images_ready','cards_building','complete'].includes(run.stage))return run;
 const checkpoint=readPrep();
 const currentVersion=/^2\.[56]\.\d+(?:$|\b)/.test(String(run.version||''));
 const fragment=currentVersion&&!Array.isArray(run.rows)&&Array.isArray(checkpoint?.rows)&&checkpoint.rows.length>0;
 const savedPlan=currentVersion&&Array.isArray(run.rows)&&run.rows.at(-1)?.finalMarker;
 if(!run.likesHistoryFix230&&!run.likesHistory&&!fragment&&!savedPlan)return run;
 if(!run.likesHistoryFix230){run=await recoverCompatibleRun(view,run);}
 let rows;try{rows=validateFixedRows(run.rows)}catch{run=await recoverCompatibleRun(view,run);rows=validateFixedRows(run.rows)}
 const images=ownedImagesForRun(view,run);
 const count=completedImagePrefix(rows,images);
 if(count!==rows.length)throw new Error('本文の画像を照合しました：'+count+'/'+rows.length+'件。完成分は保持しています');
 run={...run,rows,stage:'images_ready',imagesCompletedAt:run.imagesCompletedAt||Date.now(),updatedAt:Date.now()};
 writeRun(run);await flushRunBackup();return readRun()
}
async function enrichFinal(index=301){
 const person={urlname:'fuku444',creator:'実績の算数',actorUrl:'https://note.com/fuku444',actorImageUrl:'',likerKey:'final-performance-math'};
 const row={...person,url:FINAL_URL,key:FINAL_KEY,title:'実績の算数│3日半で0→1達成',thumbUrl:'',publishAt:null};
 try{
  const [notePayload,profilePayload]=await Promise.all([
   xhrJSON('https://note.com/api/v3/notes/'+FINAL_KEY).catch(()=>({})),
   xhrJSON('https://note.com/api/v2/creators/fuku444').catch(()=>({}))
  ]);
  const note=notePayload?.data||notePayload||{};
  const profile=profilePayload?.data?.creator||profilePayload?.data?.user||profilePayload?.data||profilePayload||{};
  const user=note.user||note.author||{};
  const avatar=avatarUrl(profile)||avatarUrl(user);
  const thumb=thumbnailUrl(note)||await articleMetaImage(FINAL_URL);

  return{...row,creator:String(profile.nickname||profile.name||user.nickname||user.name||'実績の算数'),actorImageUrl:avatar,thumbUrl:thumb,finalMarker:true,index}
 }catch{return{...row,finalMarker:true,index}}
}

async function bitmapFromUrl(url){
 if(!url)return null;
 const response=await xhr(url,'blob',45000);
 // Normalize the extension's Blob into the page realm before decoding.
 const blob=new page.Blob([await response.arrayBuffer()],{type:response.type||'image/jpeg'});
 if(typeof page.createImageBitmap==='function'){
  try{return await page.createImageBitmap(blob)}catch{}
 }
 return new Promise((resolve,reject)=>{
  const image=new page.Image(),objectUrl=page.URL.createObjectURL(blob);
  const timer=setTimeout(()=>finish(new Error('画像のデコード待ちタイムアウト')),15000);
  function finish(error){clearTimeout(timer);page.URL.revokeObjectURL(objectUrl);error?reject(error):resolve(image)}
  image.onload=()=>finish();image.onerror=()=>finish(new Error('画像読込失敗'));
  image.src=objectUrl
 })
}
function rounded(ctx,x,y,w,h,r){
 const radius=Math.min(r,w/2,h/2);
 ctx.beginPath();ctx.moveTo(x+radius,y);
 ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);
 ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath()
}
function circle(ctx,x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.closePath()}
function fit(ctx,text,maxWidth){
 let value=String(text||'');
 if(ctx.measureText(value).width<=maxWidth)return value;
 while(value&&ctx.measureText(value+'…').width>maxWidth)value=[...value].slice(0,-1).join('');
 return value+'…'
}
function textLines(ctx,text,maxWidth,maxLines){
 const chars=[...String(text||'')],out=[];
 let line='';
 for(let i=0;i<chars.length;i++){
  const test=line+chars[i];
  if(line&&ctx.measureText(test).width>maxWidth){
   out.push(line);line=chars[i];
   if(out.length===maxLines-1){line=chars.slice(i).join('');break}
  }else line=test
 }
 if(line&&out.length<maxLines){
  while(line&&ctx.measureText(line+(line.length<String(text||'').length?'…':'')).width>maxWidth)line=[...line].slice(0,-1).join('');
  out.push(line+(out.length===maxLines-1&&line.length<String(text||'').length?'…':''))
 }
 return out.slice(0,maxLines)
}
function hash(value){
 let h=2166136261;
 for(const ch of String(value||'')){h^=ch.codePointAt(0)||0;h=Math.imul(h,16777619)}
 return h>>>0
}
function assignDesigns(rows){
 // Keep every saved gallery choice: retries and asset recovery must not restyle
 // images that have already been pasted. The gallery uses one finite set.
 if(rows.some(row=>row.gallery126===true)){
  const gallery=rows.filter(row=>row.gallery126===true);
  if(gallery.length>126)throw new Error('参加者用の126デザインを超えています');
  const seen=new Set(),keep=new Set();
  for(const row of gallery){
   if(Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<126&&!seen.has(row.designIndex)){seen.add(row.designIndex);keep.add(row)}
  }
  if(keep.size===gallery.length)return rows;
  const pool=Array.from({length:126},(_,i)=>i).filter(index=>!seen.has(index));
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
  return rows.map(row=>row.gallery126===true&&!keep.has(row)?{...row,designIndex:pool.pop()}:row)
 }
 const valid=rows.every((row,i)=>Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<50&&(i===0||row.designIndex!==rows[i-1].designIndex));
 if(valid)return rows;
 let pool=[],last=-1;
 return rows.map(row=>{
  if(!pool.length){
   pool=Array.from({length:50},(_,i)=>i);
   for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
   if(pool[pool.length-1]===last)[pool[0],pool[pool.length-1]]=[pool[pool.length-1],pool[0]];
  }
  last=pool.pop();return{...row,designIndex:last};
 });
}
const palettes=[
 {bg:'#ffffff',panel:'#ffffff',ink:'#101827',muted:'#64748b',line:'#d8e1ea',accent:'#22c3ee',soft:'#edfaff'},
 {bg:'#fff8fb',panel:'#ffffff',ink:'#3b1d2c',muted:'#866176',line:'#efcbdc',accent:'#d95a9c',soft:'#ffe8f3'},
 {bg:'#f7fff8',panel:'#ffffff',ink:'#173525',muted:'#68806f',line:'#cfe6d5',accent:'#3aaa68',soft:'#e8f7ec'},
 {bg:'#fffaf2',panel:'#fffefa',ink:'#39291b',muted:'#846e5a',line:'#ead7bf',accent:'#d99240',soft:'#fff0da'},
 {bg:'#f8f5ff',panel:'#ffffff',ink:'#2e2141',muted:'#78688e',line:'#ddd2ec',accent:'#8062c9',soft:'#eee8fb'}
];
function drawDecor(ctx,index,theme){
 ctx.fillStyle=theme.bg;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle=theme.line;ctx.lineWidth=1.5;rounded(ctx,1,1,W-2,H-2,12);ctx.stroke();
 const pattern=index%10;
 ctx.save();ctx.globalAlpha=.24;ctx.strokeStyle=theme.accent;ctx.fillStyle=theme.accent;
 if(pattern===0){ctx.fillRect(0,0,7,H);ctx.beginPath();ctx.arc(540,25,48,0,Math.PI*2);ctx.fill()}
 else if(pattern===1){for(let x=-80;x<590;x+=34){ctx.beginPath();ctx.moveTo(x,H);ctx.lineTo(x+90,0);ctx.stroke()}}
 else if(pattern===2){for(let y=18;y<H;y+=22){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(570,y);ctx.stroke()}}
 else if(pattern===3){for(let y=14;y<H;y+=20)for(let x=14;x<570;x+=20){ctx.beginPath();ctx.arc(x,y,2.4,0,Math.PI*2);ctx.fill()}}
 else if(pattern===4){for(const r of [20,38,56,74]){ctx.beginPath();ctx.arc(515,70,r,0,Math.PI*2);ctx.stroke()}}
 else if(pattern===5){ctx.setLineDash([7,6]);rounded(ctx,14,12,542,H-24,14);ctx.stroke();ctx.setLineDash([])}
 else if(pattern===6){for(let x=395;x<570;x+=24)ctx.fillRect(x,10,12,H-20)}
 else if(pattern===7){ctx.beginPath();ctx.moveTo(0,118);for(let x=0;x<570;x+=32)ctx.lineTo(x,118-(x/32%3)*17);ctx.stroke()}
 else if(pattern===8){for(let y=12;y<132;y+=24)for(let x=400;x<570;x+=24)ctx.strokeRect(x,y,18,18)}
 else{for(let a=0;a<Math.PI*2;a+=Math.PI/18){ctx.beginPath();ctx.moveTo(520,70);ctx.lineTo(520+Math.cos(a)*100,70+Math.sin(a)*68);ctx.stroke()}}
 ctx.restore()
}
// 9 compositions × 7 motifs × 2 palette families = 126 distinct gallery
// designs. Motifs, image placement and framing all change at visible scale.
const galleryLayouts=[
 {avatar:[50,70,32],text:[100,18,452],name:[100,91,452],thumb:[590,8,262,124],shape:'circle'},
 {avatar:[302,70,30],text:[350,18,490],name:[350,96,490],thumb:[8,8,250,124],shape:'square'},
 {avatar:[48,70,31],text:[358,20,478],name:[358,96,478],thumb:[98,12,236,116],shape:'circle'},
 {avatar:[488,70,30],text:[20,18,414],name:[20,96,414],thumb:[536,8,316,124],shape:'square'},
 {avatar:[800,70,36],text:[286,20,442],name:[286,96,442],thumb:[8,8,252,124],shape:'circle'},
 {avatar:[42,42,24],text:[82,16,390],name:[20,98,452],thumb:[500,8,352,124],shape:'square'},
 {avatar:[42,106,22],text:[20,14,468],name:[84,99,412],thumb:[530,8,322,124],shape:'circle'},
 {avatar:[74,70,44],text:[140,20,414],name:[140,96,414],thumb:[578,12,274,116],shape:'square'},
 {avatar:[353,70,31],text:[408,20,430],name:[408,96,430],thumb:[8,8,300,124],shape:'circle'}
];
const galleryPalettes=[
 {bg:'#fff7eb',panel:'#fffefd',ink:'#392319',muted:'#72513d',line:'#d7ac75',accent:'#bd591e',soft:'#ffe5bd',detail:'#67409a'},
 {bg:'#f6f0ff',panel:'#ffffff',ink:'#312143',muted:'#665079',line:'#bca6da',accent:'#7950b3',soft:'#e6d6ff',detail:'#bc6482'},
 {bg:'#edf9f1',panel:'#ffffff',ink:'#163b2c',muted:'#426954',line:'#94c5a7',accent:'#25805b',soft:'#ccebd9',detail:'#b77c34'},
 {bg:'#edf6ff',panel:'#ffffff',ink:'#18314e',muted:'#476782',line:'#9dbed9',accent:'#286caa',soft:'#cfe6fc',detail:'#845baf'},
 {bg:'#fff0f4',panel:'#ffffff',ink:'#482437',muted:'#805369',line:'#d8a4bb',accent:'#b24d7a',soft:'#f8d8e6',detail:'#688d70'},
 {bg:'#fffbed',panel:'#ffffff',ink:'#413417',muted:'#7b663c',line:'#cebd7d',accent:'#947018',soft:'#f5e6ad',detail:'#49868a'},
 {bg:'#f0f5f7',panel:'#ffffff',ink:'#273940',muted:'#536d77',line:'#a6bec7',accent:'#397e91',soft:'#d3e6ec',detail:'#ad6c55'},
 {bg:'#171d37',panel:'#202c49',ink:'#f8f7ff',muted:'#ded4ff',line:'#65618f',accent:'#b3dbef',soft:'#334564',detail:'#e7acda'},
 {bg:'#30203e',panel:'#432d51',ink:'#fff4ff',muted:'#e7cde9',line:'#906a9e',accent:'#e0a8ee',soft:'#614276',detail:'#f1c38a'},
 {bg:'#142f2a',panel:'#23473e',ink:'#f3fff8',muted:'#c6e6d4',line:'#4f8b75',accent:'#8ed2a5',soft:'#355e4e',detail:'#e2ba7f'},
 {bg:'#3b202b',panel:'#512e3c',ink:'#fff4f6',muted:'#edc7d0',line:'#a96c82',accent:'#efacc6',soft:'#6b3f54',detail:'#a7cbdc'},
 {bg:'#2c2a20',panel:'#3e3b2e',ink:'#fff9e5',muted:'#e4d8b2',line:'#92845a',accent:'#e8c975',soft:'#5a5137',detail:'#9ec1bb'},
 {bg:'#13323a',panel:'#244a54',ink:'#effdff',muted:'#bcdee5',line:'#4b8a99',accent:'#84d4df',soft:'#32616c',detail:'#dbb4e9'},
 {bg:'#292538',panel:'#3c354d',ink:'#fff5ff',muted:'#ded0e7',line:'#81708f',accent:'#d4b5ee',soft:'#574765',detail:'#efa9bd'}
];
function galleryDesign(index){
 if(!Number.isInteger(index)||index<0||index>=126)throw new Error('参加者デザイン番号が不正です');
 return{layoutIndex:index%9,motif:Math.floor(index/9)%7,paletteIndex:Math.floor(index/9),familyIndex:Math.floor(index/63),layout:galleryLayouts[index%9],theme:galleryPalettes[Math.floor(index/9)]}
}
function drawGalleryDecor(ctx,design){
 const {layoutIndex,motif,theme}=design;
 ctx.fillStyle=theme.bg;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.strokeStyle=theme.line;ctx.fillStyle=theme.accent;ctx.lineWidth=1.5;
 rounded(ctx,1.5,1.5,W-3,H-3,12);ctx.stroke();
 ctx.globalAlpha=.18;
 if(motif===0){
  // Ornamental corners and a long double frame.
  ctx.lineWidth=3;rounded(ctx,7,7,W-14,H-14,9);ctx.stroke();
  for(const x of [18,W-18])for(const y of [18,H-18]){circle(ctx,x,y,11);ctx.fill();circle(ctx,x,y,5);ctx.stroke()}
 }else if(motif===1){
  // Broad angled ribbons, rather than a tiny identifier.
  for(let x=-160;x<W+160;x+=95){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+35,0);ctx.lineTo(x+155,H);ctx.lineTo(x+120,H);ctx.closePath();ctx.fill()}
 }else if(motif===2){
  // Stitched scrapbook frame with a translucent horizontal paper strip.
  ctx.fillRect(0,82,W,44);ctx.globalAlpha=.42;ctx.setLineDash([8,5]);rounded(ctx,10,10,W-20,H-20,7);ctx.stroke();ctx.setLineDash([])
 }else if(motif===3){
  // A field of large geometric diamonds.
  for(let y=-4;y<H+28;y+=42)for(let x=20;x<W;x+=64){ctx.beginPath();ctx.moveTo(x,y-14);ctx.lineTo(x+19,y);ctx.lineTo(x,y+14);ctx.lineTo(x-19,y);ctx.closePath();ctx.stroke()}
 }else if(motif===4){
  // Concentric moonlike orbits on opposite sides.
  ctx.lineWidth=2.5;for(const [x,y] of [[30,20],[W-40,H-10]])for(const r of [22,44,66,88,110]){circle(ctx,x,y,r);ctx.stroke()}
 }else if(motif===5){
  // Scalloped upper and lower borders with a solid lower ribbon.
  ctx.fillRect(0,H-9,W,9);for(let x=12;x<W;x+=32){circle(ctx,x,0,16);ctx.fill();circle(ctx,x,H,16);ctx.stroke()}
 }else{
  // Stars and a bold constellation running across the full banner.
  ctx.strokeStyle=theme.detail;ctx.fillStyle=theme.detail;
  ctx.beginPath();ctx.moveTo(0,110);for(let x=45;x<W;x+=90)ctx.lineTo(x,25+(Math.floor(x/90)%2)*68);ctx.stroke();
  for(let x=36;x<W;x+=82){const y=24+(Math.floor(x/82)%3)*41;ctx.beginPath();for(let n=0;n<10;n++){const angle=-Math.PI/2+n*Math.PI/5,r=n%2?4:10;const px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r;n?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fill()}
 }
 ctx.restore();
 // Each composition has its own substantial accent placement.
 ctx.save();ctx.fillStyle=theme.accent;ctx.globalAlpha=.65;
 if(layoutIndex===0)ctx.fillRect(0,0,7,H);
 else if(layoutIndex===1)ctx.fillRect(268,14,4,H-28);
 else if(layoutIndex===2)ctx.fillRect(342,14,4,H-28);
 else if(layoutIndex===3)ctx.fillRect(18,78,398,3);
 else if(layoutIndex===4)ctx.fillRect(748,14,4,H-28);
 else if(layoutIndex===5){ctx.fillRect(17,78,448,3);ctx.fillRect(17,H-6,448,6)}
 else if(layoutIndex===6)ctx.fillRect(82,85,408,3);
 else if(layoutIndex===7){ctx.fillRect(134,15,4,H-30);ctx.fillRect(145,H-6,400,6)}
 else ctx.fillRect(396,14,4,H-28);
 ctx.restore()
}
function fitGalleryCreatorName(ctx,creator,maxWidth){
 const name=String(creator||''),full=name+'さん';
 for(let size=14;size>=10;size-=.5){
  ctx.font='700 '+size+'px system-ui,-apple-system,sans-serif';
  if(ctx.measureText(full).width<=maxWidth)return{text:full,size,truncated:false};
 }
 // The native caption keeps the complete name. The image label always keeps
 // the honorific, even when an unusually long name cannot fit at 10px.
 const parts=typeof Intl?.Segmenter==='function'?Array.from(new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(name),part=>part.segment):Array.from(name);
 while(parts.length&&ctx.measureText(parts.join('')+'…さん').width>maxWidth)parts.pop();
 return{text:parts.join('')+'…さん',size:10,truncated:true};
}
function confirmedGalleryThumbnailMissing(row){
 return row.gallery126===true&&row.articleThumbnailMissing===true&&Boolean(row.key)&&Boolean(row.url)&&row.thumbnailMissingEvidence?.key===row.key&&row.thumbnailMissingEvidence?.articleUrl===row.url;
}
function drawGalleryCard(ctx,index,row,avatar,thumb){
 const design=galleryDesign(index),{layout,theme}=design;
 drawGalleryDecor(ctx,design);
 const [ix,iy,iw,ih]=layout.thumb,[ax,ay,ar]=layout.avatar;
 const frame=()=>layout.shape==='square'?rounded(ctx,ax-ar,ay-ar,ar*2,ar*2,10):circle(ctx,ax,ay,ar);
 ctx.fillStyle=theme.soft;frame();ctx.fill();ctx.strokeStyle=theme.accent;ctx.lineWidth=2;frame();ctx.stroke();
 if(avatar){
  const sw=avatar.width||avatar.naturalWidth||1,sh=avatar.height||avatar.naturalHeight||1,scale=Math.max(ar*2/sw,ar*2/sh),dw=sw*scale,dh=sh*scale;
  ctx.save();frame();ctx.clip();ctx.drawImage(avatar,ax-dw/2,ay-dh/2,dw,dh);ctx.restore()
 }else{
  ctx.save();ctx.fillStyle=theme.ink;ctx.font='800 '+Math.min(28,ar)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText([...String(row.creator||'n')][0]||'n',ax,ay);ctx.restore()
 }
 // Keep text on a solid panel so every motif remains readable on mobile.
 const [tx,ty,tw]=layout.text,[nx,ny,nw]=layout.name;
 ctx.fillStyle=theme.bg;rounded(ctx,tx-3,ty-3,tw+6,57,5);ctx.fill();rounded(ctx,nx-3,ny-2,nw+6,23,5);ctx.fill();
 ctx.textAlign='start';ctx.textBaseline='top';ctx.fillStyle=theme.ink;ctx.font='700 18px system-ui,-apple-system,sans-serif';
 textLines(ctx,row.title,tw,2).forEach((line,i)=>ctx.fillText(line,tx,ty+i*25));
 const name=fitGalleryCreatorName(ctx,row.creator,nw);ctx.fillStyle=theme.muted;ctx.fillText(name.text,nx,ny);
 ctx.fillStyle=theme.panel;rounded(ctx,ix,iy,iw,ih,9);ctx.fill();
 if(thumb){
  const sw=thumb.width||thumb.naturalWidth||1,sh=thumb.height||thumb.naturalHeight||1,scale=Math.max(iw/sw,ih/sh),dw=sw*scale,dh=sh*scale;
  ctx.save();rounded(ctx,ix,iy,iw,ih,9);ctx.clip();ctx.drawImage(thumb,ix+(iw-dw)/2,iy+(ih-dh)/2,dw,dh);ctx.restore();
 }else{
  if(!confirmedGalleryThumbnailMissing(row))throw new Error('記事画像未設定の確認記録がありません');
  // Keep the article's image area blank when no thumbnail is configured.
  // The creator, title, native caption and first-article link stay intact.
 }
 ctx.strokeStyle=theme.line;ctx.lineWidth=2;rounded(ctx,ix,iy,iw,ih,9);ctx.stroke()
}
function galleryAssetUrl(value,width){
 try{
  const url=new URL(String(value||''));
  if(url.protocol==='https:'&&url.hostname==='assets.st-note.com'){
   const current=Number(url.searchParams.get('width'));
   url.searchParams.set('width',String(current>0?Math.min(current,width):width));
   return url.href;
  }
 }catch{}
 return value;
}
async function makeFile(row){
 const avatarRequired=Boolean(mediaUrl(row.actorImageUrl)),thumbnailMissing=confirmedGalleryThumbnailMissing(row);
 const avatarSource=row.gallery126?galleryAssetUrl(row.actorImageUrl,180):row.actorImageUrl,thumbSource=row.gallery126?galleryAssetUrl(row.thumbUrl,720):row.thumbUrl;
 const images=await Promise.allSettled([avatarRequired?bitmapFromUrl(avatarSource):Promise.resolve(null),thumbnailMissing?Promise.resolve(null):bitmapFromUrl(thumbSource)]);
 const [avatar,thumb]=images.map(result=>result.status==='fulfilled'?result.value:null);
 const avatarUnavailable=avatarRequired&&!avatar;
 if(avatarUnavailable||!thumb&&!thumbnailMissing){
  try{avatar?.close?.();thumb?.close?.()}catch{}
  const reason=images.find(result=>result.status==='rejected')?.reason?.message;
  const error=new Error(row.creator+'さん：'+(avatarUnavailable?'アイコン':'記事サムネイル')+'を表示できません'+(reason?'（'+reason+'）':''));
  error.code='ASSET_UNAVAILABLE';throw error;
 }
 const limit=row.gallery126===true?126:50;
 const index=Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<limit?row.designIndex:assignDesigns([row])[0].designIndex;
 const theme=palettes[Math.floor(index/10)%palettes.length];
 const canvas=document.createElement('canvas');
 canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d');
 if(row.gallery126===true){drawGalleryCard(ctx,index,row,avatar,thumb)}else{
 drawDecor(ctx,index,theme);

 const ax=50,ay=70,ar=34;
 ctx.fillStyle=theme.soft;circle(ctx,ax,ay,ar+3);ctx.fill();
 ctx.strokeStyle=theme.accent;ctx.lineWidth=2;circle(ctx,ax,ay,ar+3);ctx.stroke();
 if(avatar){
  const iw=avatar.width||avatar.naturalWidth||1,ih=avatar.height||avatar.naturalHeight||1;
  const scale=Math.max((ar*2)/iw,(ar*2)/ih),dw=iw*scale,dh=ih*scale;
  ctx.save();circle(ctx,ax,ay,ar);ctx.clip();ctx.drawImage(avatar,ax-dw/2,ay-dh/2,dw,dh);ctx.restore()
 }else{
  ctx.fillStyle=theme.muted;ctx.font='800 24px system-ui';ctx.textAlign='center';
  ctx.fillText([...String(row.creator||'n')][0]||'n',ax,62);ctx.textAlign='start'
 }

 const tx=100,tw=455;
 ctx.textBaseline='top';ctx.fillStyle=theme.ink;ctx.font='700 18px system-ui,-apple-system,sans-serif';
 textLines(ctx,row.title,tw,2).forEach((line,i)=>ctx.fillText(line,tx,18+i*25));
 ctx.fillStyle=theme.muted;ctx.font='700 14px system-ui,-apple-system,sans-serif';
 ctx.fillText(fit(ctx,row.creator+'さん',tw),tx,86);
 ctx.fillStyle=theme.accent;ctx.font='700 12px system-ui,-apple-system,sans-serif';ctx.fillText('note',tx,110);

 const ix=590,iy=8,iw=262,ih=124;
 ctx.fillStyle=theme.panel;rounded(ctx,ix,iy,iw,ih,8);ctx.fill();
 ctx.strokeStyle=theme.line;ctx.lineWidth=1;rounded(ctx,ix,iy,iw,ih,8);ctx.stroke();
 if(thumb){
  const sw=thumb.width||thumb.naturalWidth||1,sh=thumb.height||thumb.naturalHeight||1;
  const scale=Math.max(iw/sw,ih/sh),dw=sw*scale,dh=sh*scale;
  ctx.save();rounded(ctx,ix,iy,iw,ih,8);ctx.clip();
  ctx.drawImage(thumb,ix+(iw-dw)/2,iy+(ih-dh)/2,dw,dh);ctx.restore()
 }else{
  ctx.fillStyle=theme.muted;ctx.font='800 24px system-ui';ctx.textAlign='center';ctx.fillText('note',ix+iw/2,55);ctx.textAlign='start'
 }

 }
 try{avatar?.close?.()}catch{}
 try{if(thumb!==avatar)thumb?.close?.()}catch{}
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('画像生成失敗')),'image/png',1));
 return new page.File([blob],'mumei_profile_note_v22_'+String(row.index).padStart(3,'0')+'.png',{type:'image/png'})
}

function headingText(group,count=300){
 const from=group*10+1,to=Math.min(from+9,count);
 return String(group+1).padStart(2,'0')+'｜'+from+'人目〜'+to+'人目のクリエイター様'
}
function refreshHistoryHeadings(view,count){
 const run=readRun();if(!run)return;
 const known=new Set(run.sectionHeadings||[]),changes=[];
 view.state.doc.descendants((node,pos)=>{
  if(node.type?.name!=='heading'||!known.has(String(node.textContent||'')))return;
  const match=String(node.textContent||'').match(/^(\d+)｜\d+人目〜\d+人目のクリエイター様$/);
  if(!match)return;
  const group=Number(match[1])-1,text=group*10+1>count?'':headingText(group,count);
  if(text!==node.textContent)changes.push({node,pos,text});
 });
 if(!changes.length)return;
 let tr=view.state.tr;
 for(const {node,pos,text} of changes.sort((first,second)=>second.pos-first.pos))tr=text?tr.replaceWith(pos,pos+node.nodeSize,node.type.create(node.attrs,view.state.schema.text(text),node.marks)):tr.delete(pos,pos+node.nodeSize);
 view.dispatch(tr);
 const replacements=new Map(changes.map(({node,text})=>[String(node.textContent),text]));
 writeRun({...run,sectionHeadings:(run.sectionHeadings||[]).map(text=>replacements.has(text)?replacements.get(text):text).filter(Boolean),updatedAt:Date.now()});
 return tr.mapping;
}
function galleryProfileGraphemes(value){
 const text=String(value??'');
 if(typeof Intl?.Segmenter==='function')return Array.from(new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(text),part=>part.segment);
 const parts=[];
 for(const char of Array.from(text)){
  const previous=parts[parts.length-1]||'',code=char.codePointAt(0),regional=code>=0x1f1e6&&code<=0x1f1ff;
  if(previous&&(/\p{Mark}/u.test(char)||char==='\u200d'||previous.endsWith('\u200d')||code>=0xfe00&&code<=0xfe0f||code>=0x1f3fb&&code<=0x1f3ff||regional&&Array.from(previous).length===1&&previous.codePointAt(0)>=0x1f1e6&&previous.codePointAt(0)<=0x1f1ff))parts[parts.length-1]+=char;
  else parts.push(char);
 }
 return parts;
}
// Rounded-up KaTeX Main-Regular advances for printable ASCII. CJK fallback
// glyphs use one em; the two literal quote characters rendered by \verb use
// its wider monospace advance. Unlike a flat ASCII estimate, this also budgets
// wide W/m characters and real URL punctuation before choosing a font size.
const galleryProfileAsciiWidths=[.25,.28,.5,.84,.5,.84,.78,.53,.39,.39,.5,.78,.28,.34,.28,.5,.5,.5,.5,.5,.5,.5,.5,.5,.5,.5,.28,.28,.78,.78,.78,.48,.78,.75,.71,.73,.77,.69,.66,.79,.75,.37,.52,.78,.63,.92,.75,.78,.69,.78,.74,.56,.73,.75,.75,1.03,.75,.75,.62,.28,.5,.28,.5,.5,.53,.5,.56,.45,.56,.45,.31,.5,.56,.28,.31,.53,.28,.84,.56,.5,.56,.53,.4,.4,.39,.56,.53,.73,.53,.53,.45,.5,.28,.5,.5];
function galleryProfileWidth(value){
 return galleryProfileGraphemes(value).reduce((sum,part)=>sum+(part==='\t'?1:part.length===1&&part.charCodeAt(0)>=32&&part.charCodeAt(0)<=126?galleryProfileAsciiWidths[part.charCodeAt(0)-32]:/^[\uff61-\uff9f]$/.test(part)?.55:1),0);
}
function galleryProfileChunks(value){
 const units=[],text=String(value??''),urls=/https?:\/\/[^\s\u3000<>「」『』《》【】（）〔〕［］｛｝]+/giu;
 let offset=0;
 for(const match of text.matchAll(urls)){
  units.push(...galleryProfileGraphemes(text.slice(offset,match.index)),match[0]);
  offset=match.index+match[0].length;
 }
 units.push(...galleryProfileGraphemes(text.slice(offset)));
 const noStart=/^[、。，．・：；？！ー…‥）〕］｝〉》」』】〙〗〟’”｠»ヽヾ々〻ゝゞぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ,.:;!?\)\]\}]/u;
 const noEnd=/[（〔［｛〈《「『【〘〖〝‘“｟«\(\[\{]$/u;
 const chunks=[];
 for(const unit of units){
  const previous=chunks[chunks.length-1];
  if(previous&&(noStart.test(unit)||noEnd.test(previous)))chunks[chunks.length-1]+=unit;
  else chunks.push(unit);
 }
 return chunks;
}
function galleryProfileLines(value,maxWidth=16){
 const lines=[];
 for(const original of String(value??'').replace(/\r\n?/g,'\n').split('\n')){
  let line='',used=0;
  for(const part of galleryProfileChunks(original)){
   const size=galleryProfileWidth(part);
   if(size>maxWidth+.00001)throw new Error('プロフィールのURLまたは括弧内の文字列が長すぎます。全文を保ったまま表示幅を確認してください');
   if(line&&used+size>maxWidth+.00001){lines.push(line);line='';used=0}
   line+=part;used+=size;
  }
  lines.push(line);
 }
 return lines;
}
function galleryProfileLayout(value){
 // At scriptsize, sixteen CJK em plus array margins leaves room on a phone.
 // A whole URL stays in one row. Only profiles whose indivisible URL/bracket
 // group needs extra room use tiny (0.5/0.7 of scriptsize), never truncation.
 const text=String(value??''),widest=Math.max(0,...text.replace(/\r\n?/g,'\n').split('\n').flatMap(line=>galleryProfileChunks(line).map(galleryProfileWidth)));
 const tiny=widest>16,font=tiny?'tiny':'scriptsize',maxWidth=tiny?22.4:16;
 return{font,maxWidth,lines:galleryProfileLines(text,maxWidth)};
}
function escapeGalleryProfileTex(value){
 const escapes={'\\':'\\textbackslash{}','{':'\\{','}':'\\}','$':'\\$','&':'\\&','#':'\\#','%':'\\%','_':'\\_','^':'\\textasciicircum{}','~':'\\textasciitilde{}','\t':'\\quad ',' ':'\\space ','`':'\\verb+`+',"'":"\\verb+'+"};
 // Raw combining marks can become unsupported TeX accents; Unicode double
 // punctuation can expand to math-only macros even inside \text. \char keeps
 // every original code point while bypassing both implicit transformations.
 // {} terminates its hexadecimal argument without adding a visible character.
 return Array.from(String(value??''),char=>{
  if(Object.prototype.hasOwnProperty.call(escapes,char))return escapes[char];
  // note processes ruby syntax (｜base《reading》) before KaTeX. Encode its
  // delimiters as well, including the ASCII bar, so a biography stays literal.
  if(/[‼⁇⁈⁉｜|《》-]|\p{Mark}/u.test(char)||char.normalize('NFD')!==char)return'\\char"'+char.codePointAt(0).toString(16).toUpperCase()+'{}';
  return char;
 }).join('');
}
function activityText(row){
 const text='プロフィール｜'+row.creator+'さん：'+(row.profileText||'プロフィール未設定');
 if(!row.gallery126)return text;
 // note accepts $${...}$$ in an ordinary paragraph. Keep a single source string
 // so saved activityTexts can identify this exact profile when resuming/resetting.
 const layout=galleryProfileLayout(text),lines=layout.lines.map(line=>'\\text{'+escapeGalleryProfileTex(line)+'}');
 return'$${\\'+layout.font+'\\begin{array}{l}'+lines.join('\\\\')+'\\end{array}}$$';
}
function insertHeadingAt(view,text,pos){
 const type=view.state.schema.nodes.heading;
 if(!type)throw new Error('note見出しノードを取得できません');
 const at=Math.max(0,Math.min(view.state.doc.content.size,Number(pos)||0));
 let node;
 try{node=type.create({level:2},view.state.schema.text(text))}
 catch{node=type.create(null,view.state.schema.text(text))}
 view.dispatch(view.state.tr.insert(at,node));
 const actual=view.state.doc.nodeAt(at);
 if(!actual||actual.type?.name!=='heading'||String(actual.textContent||'')!==text)throw new Error('見出し挿入に失敗しました');
 return{pos:at,nextPos:at+actual.nodeSize}
}
function insertActivityAt(view,row,pos){
 const type=view.state.schema.nodes.paragraph;
 if(!type)throw new Error('note段落を取得できません');
 const at=Math.max(0,Math.min(view.state.doc.content.size,Number(pos)||0));
 const text=activityText(row);
 const small=!row.gallery126&&view.state.schema.marks?.small;
 const marks=small?[small.create()]:[];
 const node=type.create(null,view.state.schema.text(text,marks));
 view.dispatch(view.state.tr.insert(at,node));
 const actual=view.state.doc.nodeAt(at);
 if(!actual||actual.type?.name!=='paragraph'||String(actual.textContent||'')!==text)throw new Error('プロフィールテキスト挿入に失敗しました');
 return{text,pos:at,nextPos:at+actual.nodeSize}
}
function dividerType(view){
 const nodes=view.state.schema.nodes;
 for(const name of ['horizontal_rule','horizontalRule','horizontal-rule','divider','separator','hr'])if(nodes[name])return nodes[name];
 for(const type of Object.values(nodes)){try{const node=type.createAndFill?.();const dom=node&&type.spec?.toDOM?.(node);if(Array.isArray(dom)&&dom[0]==='hr')return type;}catch{}}
 return null;
}
function isDivider(view,node){return !!node&&(node.type===dividerType(view)||node.type?.name==='paragraph'&&node.textContent==='────────────');}
function addDivider(view,hit,row){
 const pos=hit.pos+hit.node.nodeSize,existing=view.state.doc.nodeAt(pos);
 if(isDivider(view,existing))return pos+existing.nodeSize;
 const type=dividerType(view),node=type?(type.createAndFill?.()||type.create()):view.state.schema.nodes.paragraph.create(null,view.state.schema.text('────────────'));
 view.dispatch(view.state.tr.insert(pos,node));
 const run=readRun();if(run)writeRun({...run,dividerUrls:[...new Set([...(run.dividerUrls||[]),row.url])]});
 return pos+node.nodeSize;
}
function clearCurrentPaste(view,run){
 if(!run?.likesHistoryFix230)return 0;
 const images=ownedImages(view),hits=[...images],dividerUrls=new Set(run.dividerUrls||[]);
 for(const image of images){if(!dividerUrls.has(String(image.node.attrs?.link||'')))continue;const pos=image.pos+image.node.nodeSize,node=view.state.doc.nodeAt(pos);if(isDivider(view,node))hits.push({node,pos});}
 const texts=new Set(run.activityTexts||[]),headings=new Set(run.sectionHeadings||[]),keys=new Set((run.cardKeys||[]).map(card=>typeof card==='string'?card:String(card.key||''))),anchor=Math.max(0,Number(run.imageAnchorPos)||0);
 view.state.doc.descendants((node,pos)=>{
  if(pos<anchor)return;
  if(node.type?.name==='paragraph'&&texts.has(String(node.textContent||'')))hits.push({node,pos});
  if(node.type?.name==='heading'&&headings.has(String(node.textContent||'')))hits.push({node,pos});
  if(node.type?.name==='embed'&&keys.has(cardKey({node,pos})))hits.push({node,pos});
 });
 return deleteHits(view,hits);
}
async function restartFixed300(){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 try{
  await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);
  const options=historyOptions(),run=readRun();
  if(run?.likesHistoryFix230&&Array.isArray(run.rows)&&run.rows.length>1){
   validateFixedRows(run.rows);
   const view=findView();if(!view){setStatus('note本文編集欄を取得できません',true);return;}
   const previous=historyOptions(run),same=previous.mode===options.mode&&(options.mode==='all'||previous.count===options.count);
   let rows=run.rows;
   if(!same){
    await prepareLikesHistoryExport(options);
    const creators=await buildRows(options.target);
    rows=validateFixedRows([...creators,await enrichFinal(creators.length+1)]);
   }
   clearCurrentPaste(view,run);
   writeRun({...run,version:VERSION,mode:options.mode,count:rows.length-1,historyRequestedCount:options.mode==='number'?options.count:null,rows,items:[],cardKeys:[],sectionHeadings:[],activityTexts:[],dividerUrls:[],stage:'images_building',imageAnchorPos:Math.min(view.state.doc.content.size,Math.max(0,Number(run.imageAnchorPos)||0)),cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),createdAt:Date.now()});
   return createFixed300();
  }
  return startFixed300(options);
 }catch(error){setStatus('取得停止：'+(error?.message||String(error)),true);}
}
async function resumeFixed300(){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 try{
  await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);
  const run=readRun();
  if(run?.items?.length||run?.rows?.length)return createFixed300();
  const bridge=await Promise.resolve(GM_getValue(BRIDGE_KEY,null));
  if(!Array.isArray(bridge?.people)||!bridge.people.length){setStatus('読み込みの続きがありません。「① 最初から」でスキ履歴を取得してください',true);return;}
  let saved;saved=readPrep()
  setStatus('読み込みの続きから｜確認済み '+(saved?.rows?.length||0)+'人｜取得できない人は飛ばします');
  return createFixed300(checkpointHistoryOptions(saved));
 }catch(error){setStatus('読み込み再開停止：'+(error?.message||String(error)),true);}
}
function findHeading(view,text){
 let hit=null;
 view.state.doc.descendants((node,pos)=>{if(!hit&&node.type?.name==='heading'&&String(node.textContent||'')===text)hit={node,pos}});
 return hit
}
function findActivity(view,text,minPos=0){
 let hit=null;
 view.state.doc.descendants((node,pos)=>{
  if(!hit&&pos>=minPos&&node.type?.name==='paragraph'&&String(node.textContent||'')===text)hit={node,pos}
 });
 return hit
}
function recordHeading(text){
 const run=readRun();if(!run)return;
 const list=Array.isArray(run.sectionHeadings)?run.sectionHeadings:[];
 if(!list.includes(text))list.push(text);
 writeRun({...run,sectionHeadings:list,updatedAt:Date.now()})
}
function recordActivity(text){
 const run=readRun();if(!run)return;
 const list=Array.isArray(run.activityTexts)?run.activityTexts:[];
 list.push(text);
 writeRun({...run,activityTexts:list,updatedAt:Date.now()})
}
function recordImage(hit,row){
 const run=readRun()||{version:VERSION,articleKey:editorArticleKey(),items:[],createdAt:Date.now()};
 const record={id:String(hit?.node?.attrs?.id||''),src:String(hit?.node?.attrs?.src||''),url:norm(row.url),creator:String(row.creator||''),at:Date.now()};
 const items=Array.isArray(run.items)?run.items:[];
 const key=item=>String(item.id||'')+'|'+String(item.src||'')+'|'+norm(item.url);
 if(!items.some(item=>key(item)===key(record)))items.push(record);
 writeRun({...run,version:VERSION,articleKey:editorArticleKey(),items,updatedAt:Date.now()})
}
function ownedImages(view){return ownedImagesForRun(view,readRun())}
function ownedImagesForRun(view,run){
 const records=Array.isArray(run?.items)?run.items:[],all=imageNodes(view),owned=new Map();
 for(const record of records){
  const byId=record.id?all.find(x=>String(x.node.attrs?.id||'')===String(record.id)):null;
  if(byId&&norm(byId.node.attrs?.link)===norm(record.url)){owned.set(byId.pos,byId);continue}
  if(record.src){
   const matches=all.filter(x=>String(x.node.attrs?.src||'')===String(record.src)&&norm(x.node.attrs?.link)===norm(record.url));
   if(matches.length===1)owned.set(matches[0].pos,matches[0])
  }
 }
 return[...owned.values()].sort((a,b)=>a.pos-b.pos)
}
function deleteHits(view,hits){
 const unique=[...new Map((hits||[]).map(hit=>[hit.pos,hit])).values()].sort((a,b)=>b.pos-a.pos);
 if(!unique.length)return 0;
 let tr=view.state.tr;
 for(const hit of unique){
  const node=view.state.doc.nodeAt(hit.pos);
  if(node)tr=tr.delete(hit.pos,hit.pos+node.nodeSize)
 }
 view.dispatch(tr);
 return unique.length
}
function removeActivityLines(){
 const view=findView(),run=readRun();
 if(!view||!Array.isArray(run?.activityTexts)||!run.activityTexts.length)return;
 const wanted=new Set(run.activityTexts),hits=[];
 view.state.doc.descendants((node,pos)=>{if(node.type?.name==='paragraph'&&wanted.has(String(node.textContent||'')))hits.push({node,pos})});
 deleteHits(view,hits)
}

function galleryManifest(){
 const manifest=page.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__;
 const api=page.__MUMEI_PROFILE_CARD_GALLERY__;
 if(!manifest||!api)throw new Error('ハロウィン126人の一覧を読み込めません。最新版へ更新してください');
 api.validateParticipants(manifest.people,126);
 return manifest;
}
function repairGalleryProfileParagraphs(view,run,rows=run.rows,anchors=null){
 if(!run?.gallery126||run.articleKey!==editorArticleKey())throw new Error('この記事のハロウィン作成記録を確認できません');
 const images=ownedImagesForRun(view,run),done=completedImagePrefix(rows,images),saved=run.activityTexts||[];
 const profileCount=rows.filter(row=>!row.finalMarker).length,completedProfiles=rows.slice(0,done).filter(row=>!row.finalMarker).length;
 if(!Array.isArray(saved)||saved.length<completedProfiles||saved.length>Math.min(profileCount,completedProfiles+1))throw new Error('プロフィールの保存記録と画像件数が一致しません。本文は保持しました');
 const paragraphs=[];
 view.state.doc.descendants((node,pos)=>{if(node.type?.name==='paragraph')paragraphs.push({node,pos})});
 const replacements=[],texts=[];let mapping=null;
 // Match both exact saved source and its replacement, so interruption between
 // the native transaction and checkpoint cannot duplicate or lose a profile.
 for(let i=0;i<saved.length;i++){
  const from=i?images[i-1].pos+images[i-1].node.nodeSize:Math.max(0,Number(run.imageAnchorPos)||0);
  const to=i<done?images[i].pos:view.state.doc.content.size;
  const next=activityText(rows[i]),matches=paragraphs.filter(hit=>hit.pos>=from&&hit.pos<to&&(String(hit.node.textContent||'')===saved[i]||String(hit.node.textContent||'')===next));
  if(matches.length!==1)throw new Error((i+1)+'人目のプロフィールを一意に照合できません。手編集と画像は保持しました');
  const hit=matches[0];texts.push(next);
  if(String(hit.node.textContent||'')!==next)replacements.push({...hit,text:next});
 }
 if(replacements.length){
  let tr=view.state.tr;
  for(const {node,pos,text} of replacements.sort((first,second)=>second.pos-first.pos))tr=tr.replaceWith(pos,pos+node.nodeSize,node.type.create(node.attrs,view.state.schema.text(text),node.marks));
  view.dispatch(tr);mapping=tr.mapping;
 }
 if(mapping&&anchors&&Number.isFinite(Number(anchors.tappedAnchor)))anchors.tappedAnchor=mapping.map(Number(anchors.tappedAnchor),1);
 const hasCardAnchor=run.cardAnchorPos!=null&&run.cardAnchorPos!==''&&Number.isFinite(Number(run.cardAnchorPos));
 writeRun({...run,rows,activityTexts:texts,...(mapping&&hasCardAnchor?{cardAnchorPos:mapping.map(Number(run.cardAnchorPos),1)}:{}),profileLayoutVersion:VERSION,updatedAt:Date.now()});
 return replacements.length;
}
async function repairGalleryProfiles(){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 busy=true;stopRequested=false;pauseRequested=false;notifyFixedState();
 try{
  await hydrateRunBackup();
  const run=readRun();
  if(!run?.gallery126)throw new Error('この記事のハロウィン作成記録がありません');
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  const rows=validateGalleryRows(run.rows);
  assertGalleryTracking(view,run);
  if(stopRequested)throw new Error('停止しました');
  const count=repairGalleryProfileParagraphs(view,run,rows);
  await flushRunBackup();
  if(typeof page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__==='function')await page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__('プロフィール整形 '+count+'件｜下書き保存中…');
  setStatus('プロフィール整形 '+count+'件完了｜画像・通知カードは保持。プレビューを確認してください');
 }catch(error){setStatus('プロフィール整形停止：'+(error?.message||String(error)),true)}
 finally{busy=false;notifyFixedState()}
}
function galleryRowVerified(row,index,manifest=galleryManifest(),outputIndex=index+1){
 if(!row)return false;
 const id=manifest.people[index]?.urlname.toLowerCase(),proof=row.oldestEvidence,key=noteKey(row.url);
 let owner='';try{const u=new URL(row.url);if(u.origin==='https://note.com'&&!u.username&&!u.password)owner=u.pathname.match(/^\/([^/]+)\/n\/n[a-f0-9]{12}\/?$/i)?.[1]?.toLowerCase()||''}catch{}
 return Boolean(row.gallery126&&!row.finalMarker&&row.index===outputIndex&&canonicalUrlname(row)===id&&owner===id&&key&&row.key===key&&row.articleSelection==='oldest-confirmed'&&row.oldestVerified===true&&proof&&String(proof.creator).toLowerCase()===id&&proof.key===key&&proof.publishAt===row.publishAt&&Number.isFinite(Date.parse(row.publishAt))&&Number.isInteger(proof.terminalPage)&&proof.terminalPage>=1&&Array.isArray(proof.pagesChecked)&&proof.pagesChecked.includes(1)&&proof.pagesChecked.includes(proof.terminalPage+1)&&Number.isFinite(Date.parse(proof.verifiedAt)));
}
function validateGalleryRows(rows){
 const manifest=galleryManifest();
 const final=Array.isArray(rows)&&rows.at(-1)?.finalMarker?rows.at(-1):null;
 const creators=final?rows.slice(0,-1):rows;
 const pending=new Set((manifest.pendingPeople||[]).filter(person=>person.reason==='NO_PUBLIC_ARTICLE'&&person.noteCount===0).map(person=>String(person.urlname).toLowerCase()));
 const available=Array.isArray(creators)&&creators.length===126-pending.size&&pending.size>0&&creators.every(row=>row?.galleryAvailableOnly===true);
 const expected=manifest.people.map((person,index)=>({person,index})).filter(({person})=>!available||!pending.has(person.urlname.toLowerCase()));
 if(!Array.isArray(creators)||creators.length!==expected.length)throw new Error('ハロウィン参加者の一覧に不足があります');
 const keys=new Set();
 creators.forEach((row,index)=>{
  if(!galleryRowVerified(row,expected[index].index,manifest,index+1)||available&&row.gallerySourceIndex!==expected[index].index+1||keys.has(noteKey(row.url)))throw new Error((index+1)+'人目の最初の記事・人物・順序を確認できません');
  keys.add(noteKey(row.url));
 });
 if(final&&(final.gallery126===true||Number(final.index)!==rows.length||canonicalUrlname(final)!=='fuku444'||norm(final.url)!==norm(FINAL_URL)||final.key!==FINAL_KEY||keys.has(FINAL_KEY)))throw new Error('最後の実績の算数の記事・人物・順序を確認できません');
 return rows;
}
async function prepareGalleryPerson(person,index){
 const id=person.urlname.toLowerCase(),creator={...person,urlname:id,likerKey:id,actorUrl:'https://note.com/'+id};
 const [selected,payload]=await Promise.all([
  page.__MUMEI_PROFILE_CARD_GALLERY__.chooseOldestArticle(creator,{requestJSON:xhrJSON,articleFromRaw,stopRequested:()=>stopRequested}),
  xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id))
 ]);
 if(stopRequested)throw new Error('停止しました');
 const profile=payload?.data?.creator||payload?.data?.user||payload?.data;
 if(!profile||typeof profile!=='object'||String(profile.urlname||'').toLowerCase()!==id||!String(profile.nickname||profile.name||'').trim()||!['profile','description','bio','introduction','self_introduction','note_intro'].some(key=>Object.prototype.hasOwnProperty.call(profile,key)))throw new Error(id+'さんのプロフィールを確認できません');
 let thumb=selected.thumbUrl,thumbnailMissingEvidence=null;
 if(!thumb){
  const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(selected.key));
  const note=p?.data||p||{},owner=note.user?.urlname||note.author?.urlname;
  if(note.key&&note.key!==selected.key||owner&&String(owner).toLowerCase()!==id)throw new Error(id+'さんの記事情報が一致しません');
  thumb=thumbnailUrl(note);
  if(!thumb&&note.key===selected.key&&owner&&String(owner).toLowerCase()===id&&Object.prototype.hasOwnProperty.call(note,'eyecatch')&&(note.eyecatch===null||note.eyecatch==='')){
   thumbnailMissingEvidence={key:selected.key,articleUrl:selected.url,checkedAt:new Date().toISOString(),reason:'The verified article API reports an unconfigured eyecatch'};
  }else if(!thumb)thumb=await articleMetaImage(selected.url);
 }
 if(!thumb&&!thumbnailMissingEvidence)throw new Error(id+'さんの最初の記事サムネイルを確認できません');
 const avatar=avatarUrl(profile)||selected.actorImageUrl||'';
 const biography=profile.profile??profile.description??profile.bio??profile.introduction??profile.self_introduction??profile.note_intro??'';
 if(typeof biography!=='string')throw new Error(id+'さんのプロフィール本文の形式を確認できません');
 return{...selected,index:index+1,urlname:id,likerKey:id,actorUrl:creator.actorUrl,creator:String(profile.nickname||profile.name||person.creator||id).trim(),actorImageUrl:avatar,avatarMissing:!avatar,thumbUrl:thumb||'',articleThumbnailMissing:Boolean(thumbnailMissingEvidence),thumbnailMissingEvidence,profileText:biography.replace(/\r\n?/g,'\n').trim(),gallery126:true,finalMarker:false};
}
async function buildGalleryRows({availableOnly=false}={}){
 const manifest=galleryManifest(),signature=manifest.sourceBlob+'|'+manifest.people.map(person=>person.urlname.toLowerCase()).join('|');
 await galleryStore.hydrate();
 const saved=galleryStore.read();
 const rows=saved?.signature===signature&&Array.isArray(saved.rows)?saved.rows.slice(0,126):Array(126).fill(null);
 while(rows.length<126)rows.push(null);
 for(let i=0;i<rows.length;i++){
  if(rows[i]&&!galleryRowVerified(rows[i],i,manifest))rows[i]=null;
  if(!rows[i]&&galleryRowVerified(manifest.preparedRows?.[i],i,manifest))rows[i]=JSON.parse(JSON.stringify(manifest.preparedRows[i]));
 }
 const pending=new Set((manifest.pendingPeople||[]).filter(person=>person.reason==='NO_PUBLIC_ARTICLE'&&person.noteCount===0).map(person=>String(person.urlname).toLowerCase()));
 const missing=rows.map((row,index)=>row||availableOnly&&pending.has(manifest.people[index].urlname.toLowerCase())?null:index).filter(index=>index!==null);
 for(let offset=0;offset<missing.length;offset+=6){
  if(stopRequested)throw new Error('停止しました');
  const results=await Promise.allSettled(missing.slice(offset,offset+6).map(async index=>{
   const row=await prepareGalleryPerson(manifest.people[index],index);
   rows[index]=row;
   galleryStore.write({signature,rows,updatedAt:Date.now()});await galleryStore.flush();
   setStatus('ハロウィン｜最初の記事・プロフィール '+rows.filter(Boolean).length+'/126人を確認');
   return row;
  }));
  const failed=results.find(result=>result.status==='rejected');
  if(failed)throw failed.reason;
 }
 const output=availableOnly?rows.flatMap((row,index)=>pending.has(manifest.people[index].urlname.toLowerCase())?[]:[{...row,gallerySourceIndex:index+1,galleryAvailableOnly:true}]).map((row,index)=>({...row,index:index+1})):rows;
 return validateGalleryRows(output);
}
function assertGalleryTracking(view,run=readRun()){
 if(!Array.isArray(run?.imageBaselineRecords))throw new Error('貼り付け前の画像記録を確認できません');
 const owned=new Set(ownedImagesForRun(view,run).map(hit=>hit.pos));
 for(const hit of imageNodes(view)){
  if(owned.has(hit.pos))continue;
  const id=String(hit.node.attrs?.id||''),src=String(hit.node.attrs?.src||''),link=norm(hit.node.attrs?.link||'');
  const original=run.imageBaselineRecords.some(record=>id?record.id===id:src&&record.src===src&&norm(record.link||'')===link);
  if(!original)throw new Error('保存記録のない画像を検出しました。二重貼り付けを防ぐため停止しました。本文の直前の画像を確認してください');
 }
}
function assertGalleryPaste(view,rows){
 validateGalleryRows(rows);
 if(!rows.at(-1)?.finalMarker)throw new Error('最後の実績の算数が未追加です。「続きから」で末尾の画像を完成させてください');
 const creators=rows.slice(0,-1);
 assertGalleryTracking(view);
 const images=ownedImages(view);
 if(completedImagePrefix(rows,images)!==rows.length)throw new Error('本文の極薄画像が'+rows.length+'件そろっていません');
 for(let i=0;i<rows.length;i++){
  const row=rows[i],hit=images[i];
  if(String(hit.node.textContent||'').trim()!==row.creator+'さん')throw new Error((i+1)+'人目のキャプションが一致しません');
  if(!isDivider(view,view.state.doc.nodeAt(hit.pos+hit.node.nodeSize)))throw new Error((i+1)+'人目の区切り線がありません');
  if(row.finalMarker){if(!findHeading(view,'最後に｜実績の算数'))throw new Error('最後の実績の算数の見出しを確認できません');continue;}
  const profile=findActivity(view,activityText(row),i?images[i-1].pos+images[i-1].node.nodeSize:0);
  if(!profile||profile.pos>=hit.pos)throw new Error((i+1)+'人目のプロフィールを確認できません');
  if(i%10===0&&!findHeading(view,headingText(Math.floor(i/10),creators.length)))throw new Error('10人単位の見出しを確認できません');
 }
 if(new Set(creators.map(row=>row.designIndex)).size!==creators.length)throw new Error('デザインに重複があります');
}
function checkPause(){if(pauseRequested)throw Object.assign(new Error('一時停止しました｜完成分を保存済み。「再開」で続けられます'),{code:'PAUSED'})}
function pauseFix(){
 if(busy){pauseRequested=true;setStatus('一時停止を受付｜処理中の1件を保存してから止まります')}
 else if(typeof page.__MUMEI_PROFILE_CARD_PAUSE__==='function')page.__MUMEI_PROFILE_CARD_PAUSE__();
 else setStatus('一時停止中｜「再開」で保存済みの続きから開始');
}
async function startGallery126(availableOnly=false){return createFixed300({gallery126:true,galleryAvailableOnly:availableOnly})}
async function resumeGallery126(){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。一時停止が完了するまでお待ちください',true);return;}
 await hydrateRunBackup();
 if(readRun()?.pauseStage==='cards'){const resume=page.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__;if(typeof resume==='function')return resume();}
 return startGallery126(true);
}

function mapGalleryCardAnchorsAfterInsert(snapshot){
 if(!snapshot)return;
 const run=readRun();if(!run?.gallery126||run.articleKey!==snapshot.articleKey)return;
 const delta=snapshot.view.state.doc.content.size-snapshot.docSize;
 if(!delta)return;
 const shift=value=>value!=null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=snapshot.from?Number(value)+delta:value;
 const cardAnchorPos=shift(run.cardAnchorPos),pendingCard=run.pendingCard?{...run.pendingCard,pos:shift(run.pendingCard.pos)}:run.pendingCard;
 if(cardAnchorPos!==run.cardAnchorPos||pendingCard?.pos!==run.pendingCard?.pos)writeRun({...run,cardAnchorPos,pendingCard,updatedAt:Date.now()});
}
async function createFixed300(options=null){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 busy=true;stopRequested=false;pauseRequested=false;notifyFixedState();
 let pendingAnchorMap=null;
 await keepAwake();
 try{
  await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);
  if(stopRequested)throw new Error('停止しました');
  setStatus('修正版を開始｜実アイコン・記事サムネ・外部プロフィール文を確認中');
  const view=findView();
  if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();selectionApi();

  checkPause();
  let existing=readRun();
  const gallery=Boolean(options?.gallery126||existing?.gallery126);
  const availableOnly=Boolean(existing?.gallery126?existing.galleryAvailableOnly:options?.galleryAvailableOnly);
  if(gallery&&!editorArticleKey())throw new Error('記事の保存先を確認できません。下書きを保存して編集画面を開き直してください');
  if(options?.gallery126&&options.galleryAvailableOnly===false&&existing?.galleryAvailableOnly)throw new Error('125人の作成分を保持しています。126人全員で作り直す場合は先に「最初に戻る」を押してください');
  if(gallery&&existing&&!existing.gallery126)throw new Error('別の作成分が保存されています。先に「最初に戻る」で整理してください');
  if(existing?.articleKey&&existing.articleKey!==editorArticleKey())throw new Error('別の記事の保存記録です');
  const initialAnchor=gallery&&!existing?cardAnchorFromSelection(view):null,initialDoc=view.state.doc;
  if(existing&&!existing.likesHistoryFix230&&!existing.gallery126){
   setStatus('保存済みの画像・プロフィールと途中記録を照合中｜貼り付けは保持');
   existing=await recoverCompatibleRun(view,existing);
   writeRun(existing);await flushRunBackup();
  }

  const requested=gallery?{mode:'number',count:126,target:126}:existing?.likesHistoryFix230?historyOptions(existing):(options||historyOptions());
  let rows;
  if(existing?.gallery126)rows=validateGalleryRows(existing.rows);
  else if(gallery)rows=await buildGalleryRows({availableOnly});
  else if(existing?.likesHistoryFix230)rows=validateFixedRows(existing.rows);
  else{
   const creators=await buildRows(requested.target);
   const finalRow=await enrichFinal(creators.length+1);
   rows=validateFixedRows([...creators,finalRow])
  }
  if(gallery&&!rows.at(-1)?.finalMarker){
   const finalRow=await enrichFinal(rows.length+1);
   if(stopRequested)throw new Error('停止しました');
   if(!mediaUrl(finalRow.thumbUrl))throw new Error('最後の実績の算数のサムネイルを取得できません。完成分は保持しています。「続きから」で再取得してください');
   rows=validateGalleryRows([...rows,{...finalRow,urlname:'fuku444',finalMarker:true,gallery126:false,index:rows.length+1,designIndex:0}]);
  }
  checkPause();
  rows=assignDesigns(rows);
  if(gallery&&existing?.gallery126){assertGalleryTracking(view,existing);repairGalleryProfileParagraphs(view,existing,rows);await flushRunBackup();existing=readRun();}
  const galleryCount=gallery?rows.length-1:0;

  let run=readRun();
  if(!run?.likesHistoryFix230&&!run?.gallery126){
   if(gallery&&view.state.doc!==initialDoc&&!view.state.doc.eq?.(initialDoc))throw new Error('読み込み中に本文が変更されました。本文位置を選んで「126人の続き」を押してください');
   run={
    version:VERSION,articleKey:editorArticleKey(),items:[],cardKeys:[],sectionHeadings:[],activityTexts:[],rows,
    cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),
    cardBaselineNodes:gallery?embedNodes(view).map(hit=>({key:cardKey(hit),src:String(hit.node.attrs?.src||''),json:hit.node.toJSON?.()||null})):[],
    imageBaselineRecords:gallery?imageNodes(view).map(hit=>({id:String(hit.node.attrs?.id||''),src:String(hit.node.attrs?.src||''),link:String(hit.node.attrs?.link||'')})):[],
    createdAt:Date.now(),stage:'images_building',likesHistory:!gallery,likesHistoryFix230:!gallery,gallery126:gallery,galleryAvailableOnly:gallery&&availableOnly,pendingPeople:gallery&&availableOnly?galleryManifest().pendingPeople:[],
    imageAnchorPos:gallery?initialAnchor:cardAnchorFromSelection(view),sources:gallery?galleryManifest().source:'スキ履歴（読み取りのみ）',mode:requested.mode,count:gallery?galleryCount:rows.length-1,historyRequestedCount:!gallery&&requested.mode==='number'?requested.count:null,choice:gallery?'oldest':'latest'
   };
   writeRun(run)
  }else{
   run={...run,rows,count:gallery?galleryCount:run.count,stage:'images_building',paused:false,pauseStage:null,updatedAt:Date.now()};
   writeRun(run)
  }
  await flushRunBackup();

  if(gallery)assertGalleryTracking(view,run);
  let doneImages=ownedImages(view);
  let done=completedImagePrefix(rows,doneImages);
  if(gallery&&done){
   // An interrupted transaction may have recorded its image immediately
   // before the following divider. Repair that boundary before moving on.
   for(let i=0;i<done;i++){
    const hit=ownedImages(view)[i];
    if(!isDivider(view,view.state.doc.nodeAt(hit.pos+hit.node.nodeSize)))addDivider(view,hit,rows[i]);
   }
   const current=readRun()||run;
   writeRun({...current,dividerUrls:[...new Set([...(current.dividerUrls||[]),...rows.slice(0,done).map(row=>row.url)])],updatedAt:Date.now()});
   await flushRunBackup();doneImages=ownedImages(view);
  }
  let insertPos=done?doneImages[done-1].pos+doneImages[done-1].node.nodeSize:Number(run.imageAnchorPos);
  if(!Number.isFinite(insertPos))insertPos=cardAnchorFromSelection(view);
  const nextNode=view.state.doc.nodeAt(insertPos);if(done&&isDivider(view,nextNode))insertPos+=nextNode.nodeSize;

  setStatus((gallery?'ハロウィン'+galleryCount+'人'+(availableOnly?'・記事待ち1人':''):'極薄')+'｜'+done+'/'+rows.length+'件済み。続きから貼り付け');
  // Prepare one next PNG while the current native upload finishes. Only one
  // image upload is ever in flight; rejected prefetches are consumed in order.
  let prepared=null;
  const prepareNext=index=>({index,promise:Promise.resolve().then(()=>makeFile(rows[index])).then(file=>({file}),error=>({error}))});
  for(let i=done;i<rows.length;i++){
   checkPause();
   if(stopRequested)throw new Error('停止しました');
   const row=rows[i];
   setStatus('画像確認｜'+(i+1)+'/'+rows.length+'｜'+row.creator);
   let file;
   try{
    if(gallery){const result=await(prepared?.index===i?prepared:prepareNext(i)).promise;if(result.error)throw result.error;file=result.file;}
    else file=await makeFile(row);
   }catch(error){
    if(stopRequested||/停止しました|手動停止/.test(String(error?.message||error)))throw new Error('停止しました');
    if(gallery||row.finalMarker||error?.code!=='ASSET_UNAVAILABLE')throw error;
    setStatus(row.creator+'さんの画像を取得できないため除外｜次の候補を補充中');
    const nextRows=validateFixedRows(await replaceUnavailableCreator(rows,i,error,run.mode));
    completedImagePrefix(nextRows,ownedImages(view));
    rows=nextRows;
    run=readRun()||run;
    writeRun({...run,version:VERSION,rows,count:rows.length-1,imageSkipped:[...(run.imageSkipped||[]),{urlname:row.urlname,likerKey:row.likerKey,reason:error.message}],updatedAt:Date.now()});
    if(run.mode==='all'){
     const mapping=refreshHistoryHeadings(view,rows.length-1);
     if(mapping)insertPos=mapping.map(insertPos);
    }
    await flushRunBackup();
    i--;continue;
   }
   if(stopRequested)throw new Error('停止しました');

   checkPause();
   if(gallery)pendingAnchorMap={view,from:insertPos,docSize:view.state.doc.content.size,articleKey:editorArticleKey()};
   if(row.finalMarker){
    const text='最後に｜実績の算数';
    const existingHeading=findHeading(view,text);
    if(existingHeading&&existingHeading.pos>=insertPos)insertPos=existingHeading.pos+existingHeading.node.nodeSize;
    else if(!existingHeading){const h=insertHeadingAt(view,text,insertPos);insertPos=h.nextPos;recordHeading(text)}
   }else if(i%10===0){
    const text=headingText(Math.floor(i/10),gallery?galleryCount:rows.length-1);
    const existingHeading=findHeading(view,text);
    if(existingHeading&&existingHeading.pos>=insertPos)insertPos=existingHeading.pos+existingHeading.node.nodeSize;
    else if(!existingHeading){const h=insertHeadingAt(view,text,insertPos);insertPos=h.nextPos;recordHeading(text)}
   }

   if(!row.finalMarker){
    const text=activityText(row);
    const existingActivity=findActivity(view,text,insertPos);
    if(existingActivity&&existingActivity.pos>=insertPos)insertPos=existingActivity.pos+existingActivity.node.nodeSize;
    else if(!existingActivity){const a=insertActivityAt(view,row,insertPos);insertPos=a.nextPos;recordActivity(a.text)}
   }

   setStatus('修正版｜'+(i+1)+'/'+rows.length+'｜'+row.creator+'｜アイコン＋サムネ');
   if(stopRequested)throw new Error('停止しました');
   if(gallery&&i+1<rows.length)prepared=prepareNext(i+1);
   const made=await uploadOne(view,row,file,insertPos);
   insertPos=made.nextPos;
   recordImage(made.hit,row);
   insertPos=addDivider(view,made.hit,row);
   mapGalleryCardAnchorsAfterInsert(pendingAnchorMap);pendingAnchorMap=null;
   await flushRunBackup();
   checkPause();
   await sleep(gallery?60:IMAGE_GAP)
  }

  if(gallery)assertGalleryPaste(view,rows);
  run=readRun()||run;
  writeRun({...run,stage:'images_ready',paused:false,pauseStage:null,rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});
  await flushRunBackup();
  if(typeof page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__==='function')await page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__((gallery?'ハロウィン極薄'+galleryCount+'人・'+galleryCount+'種類＋実績1件':'極薄'+(rows.length-1)+'人＋実績1件')+'｜画像貼付完了。下書き保存中…');
  setStatus('極薄'+rows.length+'件完了 ✅ '+(gallery&&availableOnly?'やとさん1人は記事公開待ち。':'')+'カードを置く本文位置をタップ→②カード続き/開始')
 }catch(error){
  if(pendingAnchorMap){mapGalleryCardAnchorsAfterInsert(pendingAnchorMap);await flushRunBackup();}
  if(error?.code==='PAUSED'){const saved=readRun();if(saved){writeRun({...saved,paused:true,pauseStage:'images',pausedAt:Date.now()});await flushRunBackup();if(typeof page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__==='function')await page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__('一時停止｜完成分の下書き保存中…');}}
  setStatus(error?.code==='PAUSED'?error.message:'修正版停止：'+(error?.message||String(error)),error?.code!=='PAUSED')
 }finally{busy=false;notifyFixedState();await releaseAwake()}
}
function stopFix(){
 if(exportWaiter){const waiting=exportWaiter;exportWaiter=null;clearTimeout(waiting.timer);try{waiting.popup.close()}catch{}waiting.reject(new Error('停止しました'));}
 stopRequested=true;
 notifyFixedState();
 abortRequests();
 setStatus('修正版を停止しました｜完成分は保持')
}

const panelBindings=new WeakMap();
function bindPanelAction(control,key,listener,options){
 if(!control)return;
 let keys=panelBindings.get(control);if(!keys){keys=new Set();panelBindings.set(control,keys)}
 if(keys.has(key))return;keys.add(key);control.addEventListener(key.split(':')[0],listener,options);
}
function patchPanel(){
 const panel=document.getElementById(PANEL);
 if(!panel||!panel.querySelector('.body')||!panel.querySelector('details[data-like300]'))return false;
 const title=panel.querySelector('.title');
 if(title&&title.textContent!=='極薄サム v'+VERSION)title.textContent='極薄サム v'+VERSION;

 if(!panel.querySelector('[data-gallery126]')){
  const gallery=document.createElement('details');gallery.dataset.gallery126='1';gallery.open=true;
  gallery.innerHTML='<summary>🎃 ハロウィンアート2026</summary><div class="hint">登録126人｜記事あり125人・やとさん1人は記事待ち｜126種類｜最初の記事｜プロフィール小文字</div><div class="special-actions"><button type="button" data-gallery-action="images">①記事あり125人の極薄</button><button type="button" data-gallery-action="pause">一時停止</button><button type="button" data-gallery-action="resume">再開</button><button type="button" data-gallery-action="cards">②通知カード</button><button type="button" data-gallery-action="delete">通知カードのみ削除</button><button type="button" data-gallery-action="profiles">プロフィールを整える</button><button type="button" data-gallery-action="all">126人全員を再確認</button></div>';

  panel.querySelector('.body')?.prepend(gallery);
 }

 const gallery=panel.querySelector('[data-gallery126]');
  bindPanelAction(gallery.querySelector('[data-gallery-action="images"]'), 'click:gallery',event=>{event.preventDefault();void startGallery126(true)});
  bindPanelAction(gallery.querySelector('[data-gallery-action="resume"]'), 'click:gallery',event=>{event.preventDefault();void resumeGallery126()});
  bindPanelAction(gallery.querySelector('[data-gallery-action="pause"]'), 'click:gallery',event=>{event.preventDefault();pauseFix()});
  bindPanelAction(gallery.querySelector('[data-gallery-action="profiles"]'), 'click:gallery',event=>{event.preventDefault();void repairGalleryProfiles()});
  bindPanelAction(gallery.querySelector('[data-gallery-action="all"]'), 'click:gallery',event=>{event.preventDefault();void startGallery126(false)});
  bindPanelAction(gallery.querySelector('[data-gallery-action="cards"]'), 'click:gallery',event=>{event.preventDefault();const run=readRun();if(!run?.gallery126){setStatus('先にハロウィン126人の画像を完成させてください',true);return;}void page.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__?.()});
  bindPanelAction(gallery.querySelector('[data-gallery-action="delete"]'), 'click:gallery',event=>{event.preventDefault();void page.__MUMEI_PROFILE_CARD_DELETE_CARDS__?.()});
 const detail=panel.querySelector('details[data-like300]');
 if(!detail)return false;
 const summary=detail.querySelector('summary');
 if(summary&&summary.textContent!=='＋ スキ履歴から紹介')summary.textContent='＋ スキ履歴から紹介';
 const hint=detail.querySelector('.hint');
 if(hint&&hint.textContent!=='上の件数・全数を使用｜全数＝取得分全数（履歴候補は最大1500人）｜取得不可は飛ばす｜実績1件を追加｜50種ランダム｜10人ごと大見出し')hint.textContent='上の件数・全数を使用｜全数＝取得分全数（履歴候補は最大1500人）｜取得不可は飛ばす｜実績1件を追加｜50種ランダム｜10人ごと大見出し';

 const oldButton=detail.querySelector('[data-a="like300-images"],[data-a="like300-fixed"]');
 if(oldButton&&!panelBindings.get(oldButton)?.has('click:history')){
  const button=oldButton.cloneNode(true);
  button.dataset.a='like300-fixed';
  button.textContent='① 最初から';
  button.style.background='#176b54';
  button.style.borderColor='#5bd7a7';
  oldButton.replaceWith(button);
  bindPanelAction(button,'click:history',event=>{event.preventDefault();void restartFixed300()})
 }

 let resume=detail.querySelector('[data-a="like300-resume"]');
 if(!resume){resume=document.createElement('button');resume.dataset.a='like300-resume';resume.textContent='続きから';resume.style.cssText='background:#244c66;border-color:#69bfe8';
 (detail.querySelector('.special-actions')||detail).appendChild(resume);}
 bindPanelAction(resume,'click:resume',event=>{event.preventDefault();void resumeFixed300();});
 const prep=detail.querySelector('[data-a="like300-prep"]');
 prep?.remove();
 const actions=detail.querySelector('.special-actions');if(actions)actions.style.gridTemplateColumns='1fr';
 const cards=panel.querySelector('[data-a="cards"]');
 if(cards){
  if(cards.textContent!=='② カード続き／開始')cards.textContent='② カード続き／開始';
  cards.style.cssText='background:#34518a;border-color:#7897df';
  if(cards.parentNode!==(actions||detail))(actions||detail).appendChild(cards);
  if(!panelBindings.get(cards)?.has('click:cards')){
   cards.dataset.currentCardHandler='1';
   bindPanelAction(cards,'click:cards',event=>{
    const create=page.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__;
    if(typeof create!=='function')return;
    event.preventDefault();event.stopImmediatePropagation();void create();
   },{capture:true});
  }
 }
 let audit=detail.querySelector('[data-a="check-duplicates"]');
 if(!audit){
  audit=document.createElement('button');audit.dataset.a='check-duplicates';audit.textContent='重複確認';
  audit.addEventListener('click',event=>{
   event.preventDefault();
   const check=page.__MUMEI_PROFILE_CARD_AUDIT_DUPLICATES__;
   if(typeof check==='function')void check();
   else setStatus('重複確認には最新版へ更新してください',true);
  });
 }
 if(audit.parentNode!==(actions||detail))(actions||detail).appendChild(audit);
 const deleteCards=panel.querySelector('[data-a="delete"]');
 if(deleteCards&&!panelBindings.get(deleteCards)?.has('click:delete')){
  deleteCards.dataset.currentDeleteHandler='1';
  bindPanelAction(deleteCards,'click:delete',event=>{
   const remove=page.__MUMEI_PROFILE_CARD_DELETE_CARDS__;
   if(typeof remove!=='function')return;
   event.preventDefault();event.stopImmediatePropagation();void remove();
  },{capture:true});
 }

 const stop=panel.querySelector('[data-a="stop"]');
 bindPanelAction(stop,'pointerdown:stop',()=>stopFix(),{capture:true});
 bindPanelAction(stop,'touchstart:stop',()=>stopFix(),{capture:true,passive:true});
 return true
}
let attempts=0;
window.addEventListener('mumei-profile-card-start',()=>void restartFixed300());
window.addEventListener('mumei-profile-card-stop',()=>stopFix());
let observedPanel=null,observedBody=null,observedGallery=null,repairQueued=false;
function rememberPanel(){
 observedPanel=document.getElementById(PANEL);observedBody=observedPanel?.querySelector('.body');observedGallery=observedPanel?.querySelector('[data-gallery126]');
}
function restorePanelControls(reveal=false){
 page.__MUMEI_PROFILE_CARD_RESTORE_PANEL__?.();
 if(!patchPanel())return false;
 rememberPanel();
 if(reveal&&observedGallery){observedGallery.open=true;observedBody.scrollTop=0;}
 page.__MUMEI_PROFILE_CARD_REFRESH_UI__?.();
 return true;
}
function panelControlsMissing(){
 const panel=document.getElementById(PANEL),body=panel?.querySelector('.body'),gallery=panel?.querySelector('[data-gallery126]');
 return !panel||!document.getElementById(PANEL+'-mini')||panel!==observedPanel||!body||body!==observedBody||!gallery||gallery!==observedGallery||!gallery.querySelector('[data-gallery-action="resume"]');
}
window.addEventListener('mumei-profile-card-panel-ready',()=>restorePanelControls(true));
window.addEventListener('pageshow',()=>restorePanelControls());
const timer=setInterval(()=>{
 attempts++;
 if(restorePanelControls()||attempts>240)clearInterval(timer)
},250);
restorePanelControls();
if(typeof window.MutationObserver==='function'){
 const observer=new window.MutationObserver(()=>{
  if(repairQueued||!panelControlsMissing())return;
  repairQueued=true;
  Promise.resolve().then(()=>{repairQueued=false;restorePanelControls()});
 });
 observer.observe(document.documentElement||document,{childList:true,subtree:true});
}

})();



})();
