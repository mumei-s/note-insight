"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { hasEntrySession } from "./api";

function Link({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const target =
    href === "/"
      ? "#"
      : href.startsWith("/features/")
        ? `#features/${href.slice("/features/".length)}`
        : href;
  return (
    <a className={className} href={target}>
      {children}
    </a>
  );
}

const features = [
  {
    slug: "dashboard",
    number: "01",
    title: "note型ダッシュボード",
    copy: "ビュー・コメント・スキの並びを基準に、反応率や対応率まで深掘り。",
    tag: "分析",
  },
  {
    slug: "likes",
    number: "02",
    title: "全記事スキ",
    copy: "人物・記事・日時・順位を全記事で集計し、対応済みも引き継ぎます。",
    tag: "スキ",
  },
  {
    slug: "comments",
    number: "03",
    title: "最後の返信まで",
    copy: "初手コメントから返信の返信まで追い、判定保留の扱いも切り替え可能。",
    tag: "会話",
  },
  {
    slug: "notifications",
    number: "04",
    title: "通知アーカイブ",
    copy: "公開反応に加え、話題・購入・チップの本人通知も消えない履歴へ。",
    tag: "保存",
  },
  {
    slug: "magazines",
    number: "05",
    title: "マガジン追加通知",
    copy: "自分の記事が入った通知を最優先で分離し、確認済みまで管理。",
    tag: "マガジン",
  },
  {
    slug: "members",
    number: "06",
    title: "会員・ID固定",
    copy: "共通パスワード、本人確認、管理者承認の三段階でデータを分離。",
    tag: "保護",
  },
  {
    slug: "updates",
    number: "07",
    title: "初回全件・以後差分",
    copy: "一度保存した記事は再利用し、新規記事と変化した反応を中心に更新。",
    tag: "高速化",
  },
];

function DashboardMock() {
  return (
    <div className="black-dashboard-mock" aria-label="分析画面サンプル">
      <div className="mock-topbar">
        <span>note INSIGHT</span>
        <div>
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="mock-layout">
        <aside>
          {["アクセス状況", "スキ", "コメント", "通知", "マガジン"].map(
            (item, index) => (
              <span className={index === 0 ? "active" : ""} key={item}>
                <b>{index + 1}</b>
                {item}
              </span>
            ),
          )}
        </aside>
        <section>
          <header>
            <div>
              <small>ACCESS ANALYTICS</small>
              <strong>ダッシュボード</strong>
            </div>
            <em>差分だけ更新</em>
          </header>
          <div className="mock-note-kpis">
            <article>
              <small>全体ビュー</small>
              <strong>—</strong>
              <span>本人専用データ</span>
            </article>
            <article>
              <small>コメント</small>
              <strong>286</strong>
              <span className="up">+18</span>
            </article>
            <article>
              <small>スキ</small>
              <strong>3,942</strong>
              <span className="up">+126</span>
            </article>
          </div>
          <div className="mock-chart-row">
            <div className="mock-chart">
              <small>保存開始後の反応推移</small>
              <div>
                {[34, 52, 42, 76, 61, 92, 84, 100].map((height, index) => (
                  <i style={{ height: `${height}%` }} key={index} />
                ))}
              </div>
            </div>
            <div className="mock-alerts">
              <small>今日の確認</small>
              <span>
                <b>7</b>返信確認
              </span>
              <span>
                <b>3</b>記事がマガジン追加
              </span>
              <span>
                <b>12</b>スキ対応待ち
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function PublicHome({
  initialLoginOpen = false,
}: {
  initialLoginOpen?: boolean;
}) {
  const [loginOpen, setLoginOpen] = useState(initialLoginOpen);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    setReturning(hasEntrySession());
    document.body.classList.toggle("dialog-open", loginOpen);
    return () => document.body.classList.remove("dialog-open");
  }, [loginOpen]);

  function enterMembers() {
    if (hasEntrySession()) {
      window.location.hash = "member";
      return;
    }
    setLoginOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/access/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as {
        error?: string;
        next?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "ログインできませんでした。");
      }
      window.location.hash = "member";
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "ログインできませんでした。",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="public-site">
      <header className="public-header">
        <Link className="public-brand" href="/">
          <span>無名 S note</span>
          INSIGHT
        </Link>
        <nav>
          <a href="#features">機能</a>
          <Link href="/features/members">会員制について</Link>
          <button onClick={enterMembers}>
            {returning ? "続きから開く" : "会員ログイン"}
          </button>
        </nav>
      </header>

      <main>
        <section className="black-hero">
          <div className="black-hero-copy">
            <p className="lime-eyebrow">無名 S note · CREATOR OPERATING SYSTEM</p>
            <h1>
              <strong className="cover-brand-title">無名 S note</strong>
              noteの数字と反応を、
              <br />
              <span>自分専用の記録</span>にする。
            </h1>
            <p>
              noteのダッシュボード構成を基準に、全記事スキ、コメントの最終返信、
              通知、フォロー、共同マガジンまで一つにつないで分析します。
            </p>
            <div className="black-hero-actions">
              <button onClick={enterMembers}>
                {returning ? "保存した続きから開く" : "パスワードを入力"}
              </button>
              <a href="#features">機能を1つずつ見る</a>
            </div>
            <div className="black-trust-row">
              <span>● 会員ごとにnote ID固定</span>
              <span>● 2回目から差分更新</span>
              <span>● 管理者承認制</span>
              <span>● 本人通知を永久保存</span>
            </div>
            <p className="pwa-install-note">
              Androidではブラウザの「ホーム画面に追加」からアプリとして使えます。
            </p>
          </div>
          <DashboardMock />
        </section>

        <section className="black-feature-intro" id="features">
          <div>
            <p className="lime-eyebrow">DETAILED PRODUCT TOUR</p>
            <h2>画面を見ながら、機能を一つずつ。</h2>
          </div>
          <p>
            サンプル名はすべてモザイク表示。各ページで、集計範囲・見方・
            できること・公開データ上の限界まで説明します。
          </p>
        </section>

        <section className="black-feature-grid">
          {features.map((feature) => (
            <Link href={`/features/${feature.slug}`} key={feature.slug}>
              <div className={`feature-preview preview-${feature.slug}`}>
                <span>{feature.tag}</span>
                <div className="feature-preview-lines">
                  <i />
                  <i />
                  <i />
                </div>
                <b className="feature-preview-number">{feature.number}</b>
              </div>
              <small>{feature.number}</small>
              <strong>{feature.title}</strong>
              <p>{feature.copy}</p>
              <em>詳しい画面を見る →</em>
            </Link>
          ))}
        </section>

        <section className="membership-explainer">
          <div>
            <p className="lime-eyebrow">THREE-LAYER ACCESS</p>
            <h2>パスワードが流出しても、分析データには入れません。</h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <strong>共通パスワード</strong>
              <p>まずサービスの入口を通過します。</p>
            </li>
            <li>
              <span>02</span>
              <strong>会員本人の確認</strong>
              <p>同じ人として識別し、参加者一覧へ登録します。</p>
            </li>
            <li>
              <span>03</span>
              <strong>管理者承認・ID固定</strong>
              <p>承認されたnote IDのデータだけを表示します。</p>
            </li>
          </ol>
        </section>

        <section className="black-final-cta">
          <p className="lime-eyebrow">MEMBERS ONLY</p>
          <h2>URLを配っても、中身は会員ごとに分離。</h2>
          <p>
            この端末は長期ログイン。最初に全件保存した後は、新規・変化分だけ更新します。
          </p>
          <button onClick={enterMembers}>
            {returning ? "保存した続きから開く" : "会員ログインへ"}
          </button>
        </section>
      </main>

      <footer className="public-footer">
        <strong>無名 S note｜note INSIGHT</strong>
        <span>
          公開情報を使った非公式サービスです。note株式会社の公式機能ではありません。
        </span>
      </footer>

      {loginOpen ? (
        <div
          className="black-login-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLoginOpen(false);
          }}
        >
          <section className="black-login-card">
            <button
              className="black-dialog-close"
              onClick={() => setLoginOpen(false)}
              aria-label="閉じる"
            >
              ×
            </button>
            <span className="black-lock">⌁</span>
            <p className="lime-eyebrow">MEMBER ENTRANCE</p>
            <h2 id="login-title">入口パスワード</h2>
            <p>
              通過後に会員本人を確認します。パスワードだけでは分析画面へ入れません。
            </p>
            {error ? <div className="black-form-error">{error}</div> : null}
            <form onSubmit={submit}>
              <label htmlFor="entry-password">アクセスパスワード</label>
              <input
                id="entry-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
                required
              />
              <button disabled={submitting}>
                {submitting ? "確認中…" : "次へ進む"}
              </button>
            </form>
            <small>
              noteのメールアドレス・パスワード・Cookieは使用しません。
            </small>
          </section>
        </div>
      ) : null}
    </div>
  );
}
