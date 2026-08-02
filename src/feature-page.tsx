import { ReactNode } from "react";

function Link({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const target = href.startsWith("/features/")
    ? `#features/${href.slice("/features/".length)}`
    : href.includes("login=1")
      ? "#member"
      : href === "/#features"
        ? "#features"
        : "#";
  return <a className={className} href={target}>{children}</a>;
}

type Feature = {
  slug: string;
  index: string;
  kicker: string;
  title: string;
  lead: string;
  points: {
    label: string;
    title: string;
    text: string;
  }[];
};

const features: Feature[] = [
  {
    slug: "dashboard",
    index: "01",
    kicker: "NOTE-STYLE DASHBOARD",
    title: "noteの見慣れた数字から、次の行動まで。",
    lead:
      "note標準の「全体ビュー・コメント・スキ」の並びを土台に、保存開始後の増減、対応率、応援者の重複、記事別の反応まで同じ画面で確認します。",
    points: [
      {
        label: "基準",
        title: "note型の3指標",
        text: "全体ビュー、コメント、スキを同じ順番で配置。取得できない本人専用値は「―」と明示します。",
      },
      {
        label: "深掘り",
        title: "反応の中身を分解",
        text: "人数、初手コメント、リピーター、対応完了率、記事別の反応密度を追加します。",
      },
      {
        label: "期間",
        title: "7日・30日・1年・全期間",
        text: "保存した公開反応を期間で切り替え、増減と推移を確認できます。",
      },
      {
        label: "正確性",
        title: "推測値は混ぜない",
        text: "note本人だけが見られるビューや売上は推測しません。購入・チップ等は本人が保存した通知だけを履歴に加えます。",
      },
    ],
  },
  {
    slug: "likes",
    index: "02",
    kicker: "ALL-ARTICLE LIKES",
    title: "6記事ではなく、全記事で応援者を集計。",
    lead:
      "初回に公開記事を全件確認し、2回目以降は保存済みを使って変化した記事だけ更新。人物・記事・日時・順位を20件ずつ確認できます。",
    points: [
      {
        label: "一覧",
        title: "人物・記事・日時",
        text: "名前、note ID、スキされた記事、記事リンク、確認日時を一行で表示します。",
      },
      {
        label: "検索",
        title: "ID・名前・記事名",
        text: "あいうえお順、新しい順、古い順を切り替え、20件ずつページ移動できます。",
      },
      {
        label: "順位",
        title: "全記事合算ランキング",
        text: "クリエイターごとの記事数を押すと、対象記事の一覧とリンクを開けます。",
      },
      {
        label: "対応",
        title: "対応済みを保存",
        text: "確認したスキは対応済みにし、次回ログイン後も状態を引き継ぎます。",
      },
    ],
  },
  {
    slug: "comments",
    index: "03",
    kicker: "FULL THREAD CHECK",
    title: "返信した後の、返信まで見逃さない。",
    lead:
      "初手コメントだけで終わらず、返信の返信を最後までたどります。未返信、再返信、返信済み、♥で終了候補、判定保留を分けます。",
    points: [
      {
        label: "会話",
        title: "スレッドを最後まで表示",
        text: "誰の発言か、初手か返信か、最終発言者、日時、記事リンクをまとめます。",
      },
      {
        label: "判定",
        title: "未返信と再返信を分離",
        text: "自分がまだ返信していない会話と、自分の返信後にもう一度届いた会話を区別します。",
      },
      {
        label: "切替",
        title: "判定保留を含める ON/OFF",
        text: "取得不完全な「未対応の可能性」を対応待ち件数へ含めるか、会員ごとに切り替えます。",
      },
      {
        label: "順位",
        title: "初手コメントを重視",
        text: "クリエイター別・記事別に、初手コメント人数と全発言数を別々に集計します。",
      },
    ],
  },
  {
    slug: "notifications",
    index: "04",
    kicker: "PERMANENT NOTIFICATION HISTORY",
    title: "公開反応も本人通知も、検索できる履歴へ。",
    lead:
      "スキ、コメント、返信、フォロー変化は差分更新で保存。購入、チップ、「あなたの記事が話題です」は通知文を取り込み、note側から消えた後も探し直せます。",
    points: [
      {
        label: "保存",
        title: "確認後も消さない",
        text: "公開データから確認できた出来事を会員のnote IDごとに蓄積します。",
      },
      {
        label: "検索",
        title: "人物・記事・日付",
        text: "開始日・終了日、クリエイターID、名前、記事名で絞り込みます。",
      },
      {
        label: "本人通知",
        title: "話題・購入・チップ",
        text: "種類、相手、記事、金額、日付、元の通知文をIDごとに保存し、公開反応と同じ画面で検索します。",
      },
      {
        label: "連携範囲",
        title: "公式APIがない範囲を明示",
        text: "本人通知は現時点で自動取得せず、手入力または通知・通知メールの文面取り込みで安全に残します。",
      },
    ],
  },
  {
    slug: "magazines",
    index: "05",
    kicker: "MAGAZINE WATCH",
    title: "自分の記事が追加された瞬間を、最優先に。",
    lead:
      "マガジン全体の更新とは別に、自分の記事が追加された履歴だけを専用通知として表示。記事、追加先、日時、確認済みを一目で見分けます。",
    points: [
      {
        label: "最優先",
        title: "自分の記事を先頭表示",
        text: "未確認件数を大きく表示し、追加された記事とマガジンへ直接移動できます。",
      },
      {
        label: "分離",
        title: "共同マガジン内の記事",
        text: "他の人の記事追加とは別タブにし、自分の記事通知を埋もれさせません。",
      },
      {
        label: "追跡",
        title: "参加者・フォロワー推移",
        text: "公開範囲で確認できる参加者の追加・終了、フォロワー数の増減も記録します。",
      },
      {
        label: "操作",
        title: "確認済みを保存",
        text: "自分の記事追加通知を一件ずつ確認済みにし、未確認だけに絞り込めます。",
      },
    ],
  },
  {
    slug: "members",
    index: "06",
    kicker: "MEMBER ISOLATION",
    title: "URLを配っても、他人の分析は見えない。",
    lead:
      "共通パスワードだけに頼らず、会員本人の確認と管理者承認を追加。会員とnote IDを固定し、分析API側でも別IDへの切り替えを拒否します。",
    points: [
      {
        label: "入口",
        title: "共通パスワード",
        text: "URLだけをコピーしても利用できません。入力失敗には回数制限をかけます。",
      },
      {
        label: "本人",
        title: "会員アカウントを識別",
        text: "メールアドレスは一覧へ出さず、同じ会員としてだけ識別します。",
      },
      {
        label: "固定",
        title: "1会員・1note ID",
        text: "一度登録したIDは自分で変更不可。サーバー側で自分のID以外を強制的に拒否します。",
      },
      {
        label: "管理",
        title: "承認・脱退・保存ID",
        text: "管理者は会員を管理し、一度開いたクリエイターIDを検索・再表示できます。一般会員は固定IDのままです。",
      },
    ],
  },
  {
    slug: "updates",
    index: "07",
    kicker: "INCREMENTAL UPDATE",
    title: "最初だけ全件。次からは変化だけ。",
    lead:
      "記事ごとのスキ数・コメント数・確認日時を保存。次回は新規記事、件数が変化した記事、確認が必要な記事を中心に再取得します。",
    points: [
      {
        label: "初回",
        title: "全公開記事を保存",
        text: "記事一覧、スキ、コメント、記事ごとの取得結果を分割して保存します。",
      },
      {
        label: "次回",
        title: "差分対象だけ更新",
        text: "保存済み全件を読み直さず、変化がある記事を6記事ずつ安全に確認します。",
      },
      {
        label: "履歴",
        title: "更新時間と失敗数",
        text: "開始・完了時間、保存利用数、更新対象、失敗記事数を毎回記録します。",
      },
      {
        label: "継続",
        title: "端末を長期保持",
        text: "最大5年の会員セッションを使い、Cookie削除・脱退時を除きログインを維持します。",
      },
    ],
  },
];

function FeatureMock({ slug }: { slug: string }) {
  if (slug === "comments") {
    return (
      <div className="tour-screen tour-comments">
        <header>
          <strong>コメントと返信漏れ</strong>
          <span>判定保留を含める　ON</span>
        </header>
        {["未返信", "返信後に再返信あり", "♥で終了候補"].map(
          (label, index) => (
            <article key={label}>
              <i />
              <div>
                <b className="tour-masked">クリエイター名</b>
                <span className="tour-masked">
                  コメント本文のサンプルが表示されます
                </span>
              </div>
              <em className={`tour-status status-${index}`}>{label}</em>
            </article>
          ),
        )}
      </div>
    );
  }
  if (slug === "magazines") {
    return (
      <div className="tour-screen tour-magazines">
        <header>
          <div>
            <small>未確認</small>
            <strong>3件</strong>
          </div>
          <span>自分の記事だけ表示</span>
        </header>
        {["記事タイトル A", "記事タイトル B", "記事タイトル C"].map(
          (title) => (
            <article key={title}>
              <b>NEW</b>
              <div>
                <strong className="tour-masked">{title}</strong>
                <span className="tour-masked">追加先マガジン名</span>
              </div>
              <button>確認済みにする</button>
            </article>
          ),
        )}
      </div>
    );
  }
  if (slug === "members") {
    return (
      <div className="tour-screen tour-members">
        <header>
          <strong>参加メンバー</strong>
          <span>承認待ち 2人</span>
        </header>
        {["OWNER", "ACTIVE", "PENDING", "PENDING"].map((status, index) => (
          <article key={`${status}-${index}`}>
            <i />
            <div>
              <b className="tour-masked">noteクリエイター名</b>
              <span className="tour-masked">@creator_id</span>
            </div>
            <em>{status}</em>
            {status === "PENDING" ? <button>承認</button> : null}
          </article>
        ))}
      </div>
    );
  }
  if (slug === "likes") {
    return (
      <div className="tour-screen tour-table">
        <header>
          <strong>全記事スキ</strong>
          <span>3,942件</span>
        </header>
        {Array.from({ length: 4 }, (_, index) => (
          <article key={index}>
            <i />
            <div>
              <b className="tour-masked">クリエイター名</b>
              <span className="tour-masked">@creator_id</span>
            </div>
            <strong className="tour-masked">スキされた記事タイトル</strong>
            <button>{index === 1 ? "✓ 対応済み" : "対応済みにする"}</button>
          </article>
        ))}
      </div>
    );
  }
  if (slug === "notifications") {
    return (
      <div className="tour-screen tour-notifications">
        <header>
          <strong>通知アーカイブ</strong>
          <span>日付検索</span>
        </header>
        {["記事が話題", "購入", "チップ", "スキ"].map(
          (kind, index) => (
            <article key={kind}>
              <b>{kind}</b>
              <i />
              <div>
                <strong className="tour-masked">クリエイター名</strong>
                <span className="tour-masked">通知内容と記事タイトル</span>
              </div>
              <time>7/{30 - index}</time>
            </article>
          ),
        )}
      </div>
    );
  }
  if (slug === "updates") {
    return (
      <div className="tour-screen tour-updates">
        <header>
          <strong>差分更新</strong>
          <span>完了</span>
        </header>
        <div className="tour-progress">
          <span style={{ width: "100%" }} />
        </div>
        <section>
          <article>
            <small>全記事</small>
            <strong>186</strong>
          </article>
          <article>
            <small>保存を利用</small>
            <strong>180</strong>
          </article>
          <article>
            <small>今回更新</small>
            <strong>6</strong>
          </article>
          <article>
            <small>失敗</small>
            <strong>0</strong>
          </article>
        </section>
        <p>保存済み180記事を利用し、変化した6記事だけ更新しました。</p>
      </div>
    );
  }
  return (
    <div className="tour-screen tour-dashboard">
      <header>
        <strong>アクセス状況</strong>
        <span>30日間⌄</span>
      </header>
      <section>
        <article>
          <small>全体ビュー</small>
          <strong>—</strong>
          <span>本人専用</span>
        </article>
        <article>
          <small>コメント</small>
          <strong>286</strong>
          <span>+18</span>
        </article>
        <article>
          <small>スキ</small>
          <strong>3,942</strong>
          <span>+126</span>
        </article>
      </section>
      <div className="tour-line-chart">
        {[28, 42, 38, 55, 68, 59, 81, 73, 96, 88].map(
          (height, index) => (
            <i style={{ height: `${height}%` }} key={index} />
          ),
        )}
      </div>
    </div>
  );
}

export function FeaturePage({ slug }: { slug: string }) {
  const foundIndex = features.findIndex((feature) => feature.slug === slug);
  const currentIndex = foundIndex < 0 ? 0 : foundIndex;
  const feature = features[currentIndex];
  const previous =
    features[(currentIndex - 1 + features.length) % features.length];
  const next = features[(currentIndex + 1) % features.length];

  return (
    <div className="feature-tour-site">
      <header className="public-header">
        <Link className="public-brand" href="/">
          <span>無名 S note</span>
          INSIGHT
        </Link>
        <nav>
          <Link href="/#features">機能一覧</Link>
          <Link className="tour-login-link" href="/?login=1">
            会員ログイン
          </Link>
        </nav>
      </header>

      <main className="feature-tour-main">
        <section className="feature-tour-hero">
          <div>
            <span className="feature-tour-index">{feature.index}</span>
            <p className="lime-eyebrow">{feature.kicker}</p>
            <h1>{feature.title}</h1>
            <p>{feature.lead}</p>
          </div>
          <FeatureMock slug={feature.slug} />
        </section>

        <section className="feature-tour-points">
          {feature.points.map((point) => (
            <article key={point.label}>
              <span>{point.label}</span>
              <h2>{point.title}</h2>
              <p>{point.text}</p>
            </article>
          ))}
        </section>

        <nav className="feature-tour-navigation" aria-label="機能ページ移動">
          <Link href={`/features/${previous.slug}`}>
            <small>← 前の機能</small>
            <strong>{previous.title}</strong>
          </Link>
          <Link href={`/features/${next.slug}`}>
            <small>次の機能 →</small>
            <strong>{next.title}</strong>
          </Link>
        </nav>

        <section className="feature-tour-cta">
          <h2>会員ごとに、自分のnoteだけを分析。</h2>
          <p>初回は全件保存。2回目から差分だけ更新します。</p>
          <Link href="/?login=1">パスワードを入力</Link>
        </section>
      </main>
    </div>
  );
}
