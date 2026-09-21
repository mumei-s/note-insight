import "./member-insight-completeness.css";

export function MemberInsightCompleteness({revision=0}:{revision?:number}){
  void revision;
  return <aside className="micmp precision-only">
    <details>
      <summary><b>⚠ データ精度・取得元</b><span>注意事項</span></summary>
      <section className="micmp-notice">
        <div><b>📊 公式Dashboardを正本</b><span>PV・スキ・コメント・売上・流入など、公式Dashboardで取得できる数値はDashboard同期の公式値を最優先で表示します。</span></div>
        <div><b>公開データは補助</b><span>公開記事・公開スキ・公開コメント・フォロー等は履歴や人物確認の補助に使います。公式Dashboardと数字が異なる場合、集計値は公式Dashboard側を採用します。</span></div>
        <div><b>🔔 本人通知</b><span>通知欄にしかないメンシプ参加・掲示板返信・購入/支援などを追加取得します。通知は取得条件やnote側表示により欠落・重複・時刻ずれが起こる場合があります。</span></div>
        <div className="precision"><b>重要</b><span>公開一覧に出ない記事・限定公開・削除済み・note側集計更新の時間差があるため、公開履歴件数と公式Dashboard総数が一致しない場合があります。</span></div>
      </section>
    </details>
  </aside>
}
