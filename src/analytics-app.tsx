"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Tab =
  | "overview"
  | "likers"
  | "ranking"
  | "comments"
  | "comment-ranking"
  | "analysis"
  | "archive"
  | "magazine-adds"
  | "social"
  | "magazines";

type Creator = {
  id: number | null;
  key: string | null;
  urlname: string;
  nickname: string;
  profile: string;
  profileImageUrl: string | null;
  followerCount: number;
  noteCount: number;
  profileUrl: string;
};

type Person = {
  id: string;
  urlname: string | null;
  nickname: string;
  profileImageUrl: string | null;
  followerCount: number | null;
  profileUrl: string | null;
};

type Article = {
  key: string;
  title: string;
  publishAt: string | null;
  likeCount: number;
  commentCount: number;
  url: string;
};

type LikerEvent = {
  articleKey: string;
  articleTitle: string;
  articleUrl: string;
  likedAt: string | null;
  user: Person;
};

type RankingEntry = Person & {
  count: number;
  lastLikedAt: string | null;
  articles: {
    key: string;
    title: string;
    url: string;
    likedAt: string | null;
  }[];
};

type FollowerPoint = {
  date: string;
  count: number;
};

type ThreadStatus =
  | "unreplied"
  | "followup_pending"
  | "heart_closed"
  | "replied"
  | "unknown";

type CommentMessage = {
  key: string;
  parentKey: string | null;
  isRoot: boolean;
  isCreator: boolean;
  text: string;
  createdAt: string | null;
  likeCount: number;
  isCreatorLiked: boolean;
  isBlocked: boolean;
  user: Person;
};

type CommentThread = {
  articleKey: string;
  articleTitle: string;
  articleUrl: string;
  rootKey: string;
  status: ThreadStatus;
  isComplete: boolean;
  creatorReplyCount: number;
  participantCount: number;
  lastMessageAt: string | null;
  messages: CommentMessage[];
};

type CommentArticleResult = {
  articleKey: string;
  articleTitle: string;
  articleUrl: string;
  expectedCommentCount: number;
  fetchStatus: "ok" | "empty" | "unavailable" | "error";
  threads: CommentThread[];
  message: string | null;
};

type CommentRankingEntry = Person & {
  totalMessageCount: number;
  initialCommentCount: number;
  initialArticleCount: number;
  pendingThreadCount: number;
  lastCommentAt: string | null;
  articles: {
    key: string;
    title: string;
    url: string;
    initialCommentCount: number;
    totalMessageCount: number;
  }[];
};

type ArticleCommentRankingEntry = {
  articleKey: string;
  articleTitle: string;
  articleUrl: string;
  initialCommentCount: number;
  uniqueCreatorCount: number;
  creators: (Person & { initialCommentCount: number })[];
};

type MagazineMember = Person & {
  role: "owner" | "member";
};

type Magazine = {
  key: string;
  title: string;
  description: string;
  url: string;
  coverImageUrl: string | null;
  noteCount: number;
  followerCount: number | null;
  memberCount: number;
  owner: MagazineMember | null;
  members: MagazineMember[];
  participantsAvailable: boolean;
  participantsComplete: boolean;
  isCollaborative: boolean;
  relation: "owner" | "participant" | "tracked";
  source: "profile" | "tracked";
  inProfile: boolean;
  trackedManually: boolean;
  isNewOnProfile: boolean;
  followerDelta: number | null;
  followerHistory: {
    count: number;
    recordedAt: string;
  }[];
  recentArticles: {
    key: string;
    title: string;
    url: string;
    publishAt: string | null;
    author: Person;
  }[];
  recentArticlesAvailable: boolean;
  newArticleCount: number;
  newMemberCount: number;
  removedMemberCount: number;
};

type ActivityType =
  | "like"
  | "comment"
  | "reply"
  | "magazine_member_added"
  | "magazine_member_removed"
  | "magazine_article_added"
  | "magazine_followers_changed"
  | "creator_magazine_added"
  | "creator_magazine_removed"
  | "follower_added"
  | "follower_removed"
  | "following_added"
  | "following_removed";

type ActivityEvent = {
  id: number;
  creatorUrlname: string;
  eventKey: string;
  eventType: ActivityType;
  actorId: string | null;
  actorUrlname: string | null;
  actorNickname: string | null;
  actorImageUrl: string | null;
  subjectKey: string | null;
  subjectTitle: string | null;
  subjectUrl: string | null;
  message: string | null;
  occurredAt: string | null;
  observedAt: number;
  metadata?: Record<string, unknown>;
};

type AnalyticsRunRecord = {
  id: string;
  creatorUrlname: string;
  mode: "initial" | "incremental" | "full" | "cached";
  status: "running" | "complete" | "partial" | "cached";
  source: "live" | "saved";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  totalArticles: number;
  targetArticles: number;
  cachedArticles: number;
  processedArticles: number;
  failedArticles: number;
  totalLikes: number;
  identifiedLikes: number;
  supporterCount: number;
  commentThreadCount: number;
  pendingThreadCount: number;
  activityCount: number;
  followerCount: number;
  warningCount: number;
};

type ManualCompletions = {
  commentThreadKeys: string[];
  likeKeys: string[];
  magazineAdditionKeys: string[];
};

type MemberInfo = {
  id: string;
  role: "owner" | "member";
  status: "active";
  noteUrlname: string;
  noteNickname: string | null;
  noteImageUrl: string | null;
  potentialPendingEnabled: boolean;
};

type AdminCreatorHistoryItem = {
  creatorUrlname: string;
  nickname: string;
  profileImageUrl: string | null;
  profileUrl: string;
  firstOpenedAt: number;
  lastOpenedAt: number;
  openCount: number;
};

type PrivateNotificationKind =
  | "article_mentioned"
  | "purchase"
  | "tip"
  | "other";

type PrivateNotification = {
  id: string;
  creatorUrlname: string;
  kind: PrivateNotificationKind;
  title: string;
  actorName: string | null;
  actorUrlname: string | null;
  articleTitle: string | null;
  articleUrl: string | null;
  amountYen: number | null;
  occurredAt: string;
  source: "manual" | "notification_import";
  rawText: string | null;
  createdAt: number;
};

type PrivateNotificationFormInput = {
  kind: PrivateNotificationKind;
  title: string;
  actorName: string;
  articleTitle: string;
  articleUrl: string;
  amountYen: string;
  occurredAt: string;
};

type ManifestData = {
  creator: Creator;
  metrics: {
    followerCount: number;
    followerDelta: number;
    totalLikes: number;
    totalArticles: number;
    publicArticles: number;
    articlesWithComments: number;
  };
  followerHistory: FollowerPoint[];
  articles: Article[];
  scanArticles: Article[];
  cachedLikerEvents: LikerEvent[];
  cachedCommentResults: CommentArticleResult[];
  cacheSummary: {
    cachedArticles: number;
    updateArticles: number;
    lastScannedAt: string | null;
  };
  magazines: Magazine[];
  magazineRefreshedAt: string | null;
  activityEvents: ActivityEvent[];
  privateNotifications: PrivateNotification[];
  currentRunId: string | null;
  runHistory: AnalyticsRunRecord[];
  manualCompletions: ManualCompletions;
  batchSize: number;
  refreshedAt: string;
  warnings: string[];
  sourceNote: string;
  archiveNote: string;
};

type DashboardData = ManifestData & {
  likerEvents: LikerEvent[];
  commentResults: CommentArticleResult[];
};

type ScanProgress = {
  processed: number;
  total: number;
  failed: number;
  cached: number;
};

type SocialSnapshot = {
  kind: "followers" | "followings";
  totalCount: number;
  people: Person[];
  added: Person[];
  removed: Person[];
  complete: boolean;
  scanMode: "baseline" | "full" | "cached";
  scannedAt: string;
  lastFullScanAt: string | null;
  message: string;
};

type SocialData = {
  followers: SocialSnapshot;
  followings: SocialSnapshot;
  warnings: string[];
  activityEvents: ActivityEvent[];
};

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "ダッシュボード" },
  { id: "likers", label: "スキ一覧" },
  { id: "ranking", label: "スキ順位" },
  { id: "comments", label: "コメント" },
  { id: "comment-ranking", label: "コメント順位" },
  { id: "analysis", label: "分析記録" },
  { id: "archive", label: "通知保存" },
  { id: "magazine-adds", label: "マガジン追加" },
  { id: "social", label: "フォロー変化" },
  { id: "magazines", label: "マガジン" },
];

const numberFormatter = new Intl.NumberFormat("ja-JP");

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return "日時不明";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function formatDuration(value: number | null) {
  if (value == null) return "実行中";
  if (value < 1_000) return `${value}ms`;
  const seconds = Math.round(value / 1_000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}分${seconds % 60}秒`;
}

function likeCompletionKey(event: LikerEvent) {
  return `${event.articleKey}:${event.user.id}`;
}

function dateKey(value: string | null, fallback?: number) {
  const date = value ? new Date(value) : new Date(fallback ?? 0);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

type DateScopeMode = "all" | "day" | "month";

function matchesDateScope(
  value: string | null,
  fallback: number | undefined,
  mode: DateScopeMode,
  day: string,
  month: string,
) {
  if (mode === "all") return true;
  const key = dateKey(value, fallback);
  if (!key) return false;
  if (mode === "day") return !day || key === day;
  return !month || key.startsWith(`${month}-`);
}

function DateScopeControls({
  mode,
  day,
  month,
  onChange,
}: {
  mode: DateScopeMode;
  day: string;
  month: string;
  onChange: (next: {
    mode: DateScopeMode;
    day?: string;
    month?: string;
  }) => void;
}) {
  return (
    <div className="date-scope-controls" aria-label="日付・月で絞り込む">
      <div className="date-scope-tabs">
        {[
          ["all", "全期間"],
          ["day", "日付ごと"],
          ["month", "月ごと"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={mode === id ? "active" : ""}
            onClick={() => onChange({ mode: id as DateScopeMode })}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "day" ? (
        <label>
          <span>表示する日</span>
          <input
            type="date"
            value={day}
            onChange={(event) =>
              onChange({ mode: "day", day: event.target.value })
            }
          />
        </label>
      ) : null}
      {mode === "month" ? (
        <label>
          <span>表示する月</span>
          <input
            type="month"
            value={month}
            onChange={(event) =>
              onChange({ mode: "month", month: event.target.value })
            }
          />
        </label>
      ) : null}
    </div>
  );
}

function pageSlice<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(Math.ceil(items.length / pageSize), 1);
  const safePage = Math.min(Math.max(page, 1), pageCount);
  return {
    page: safePage,
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
  };
}

function initials(name: string) {
  return [...name.trim()].slice(0, 2).join("") || "n";
}

function Avatar({
  person,
  size = "medium",
}: {
  person: Pick<Person, "nickname" | "profileImageUrl">;
  size?: "small" | "medium" | "large";
}) {
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {person.profileImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.profileImageUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span>{initials(person.nickname)}</span>
      )}
    </span>
  );
}

function buildRanking(events: LikerEvent[]): RankingEntry[] {
  const result = new Map<
    string,
    RankingEntry & {
      articleMap: Map<
        string,
        { key: string; title: string; url: string; likedAt: string | null }
      >;
    }
  >();
  for (const event of events) {
    const existing = result.get(event.user.id);
    if (existing) {
      if (!existing.articleMap.has(event.articleKey)) {
        existing.count += 1;
      }
      existing.articleMap.set(event.articleKey, {
        key: event.articleKey,
        title: event.articleTitle,
        url: event.articleUrl,
        likedAt: event.likedAt,
      });
      if ((event.likedAt ?? "") > (existing.lastLikedAt ?? "")) {
        existing.lastLikedAt = event.likedAt;
      }
    } else {
      result.set(event.user.id, {
        ...event.user,
        count: 1,
        lastLikedAt: event.likedAt,
        articles: [],
        articleMap: new Map([
          [
            event.articleKey,
            {
              key: event.articleKey,
              title: event.articleTitle,
              url: event.articleUrl,
              likedAt: event.likedAt,
            },
          ],
        ]),
      });
    }
  }
  return [...result.values()]
    .map(({ articleMap, ...entry }) => ({
      ...entry,
      articles: [...articleMap.values()].sort((a, b) =>
        (b.likedAt ?? "").localeCompare(a.likedAt ?? ""),
      ),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        (b.lastLikedAt ?? "").localeCompare(a.lastLikedAt ?? ""),
    );
}

function allThreads(results: CommentArticleResult[]) {
  return results
    .flatMap((result) => result.threads)
    .sort((a, b) =>
      (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""),
    );
}

function buildCommentRanking(
  results: CommentArticleResult[],
  includeUnknown = true,
): CommentRankingEntry[] {
  const ranking = new Map<
    string,
    CommentRankingEntry & {
      articleMap: Map<
        string,
        {
          key: string;
          title: string;
          url: string;
          initialCommentCount: number;
          totalMessageCount: number;
        }
      >;
      pendingKeys: Set<string>;
    }
  >();

  for (const thread of allThreads(results)) {
    const root =
      thread.messages.find((message) => message.isRoot) ??
      thread.messages[0];
    for (const message of thread.messages) {
      if (message.isCreator) continue;
      const current = ranking.get(message.user.id);
      if (current) {
        current.totalMessageCount += 1;
        const article = current.articleMap.get(thread.articleKey);
        if (article) {
          article.totalMessageCount += 1;
        } else {
          current.articleMap.set(thread.articleKey, {
            key: thread.articleKey,
            title: thread.articleTitle,
            url: thread.articleUrl,
            initialCommentCount: 0,
            totalMessageCount: 1,
          });
        }
        if ((message.createdAt ?? "") > (current.lastCommentAt ?? "")) {
          current.lastCommentAt = message.createdAt;
        }
      } else {
        ranking.set(message.user.id, {
          ...message.user,
          totalMessageCount: 1,
          initialCommentCount: 0,
          initialArticleCount: 0,
          pendingThreadCount: 0,
          lastCommentAt: message.createdAt,
          articles: [],
          articleMap: new Map([
            [
              thread.articleKey,
              {
                key: thread.articleKey,
                title: thread.articleTitle,
                url: thread.articleUrl,
                initialCommentCount: 0,
                totalMessageCount: 1,
              },
            ],
          ]),
          pendingKeys: new Set(),
        });
      }
    }

    if (root && !root.isCreator) {
      const current = ranking.get(root.user.id);
      if (current) {
        current.initialCommentCount += 1;
        const article = current.articleMap.get(thread.articleKey);
        if (article) article.initialCommentCount += 1;
      }
    }

    if (
      root &&
      !root.isCreator &&
      (thread.status === "unreplied" ||
        thread.status === "followup_pending" ||
        (includeUnknown && thread.status === "unknown"))
    ) {
      ranking.get(root.user.id)?.pendingKeys.add(thread.rootKey);
    }
  }

  return [...ranking.values()]
    .map(({ articleMap, pendingKeys, ...entry }) => ({
      ...entry,
      initialArticleCount: [...articleMap.values()].filter(
        (article) => article.initialCommentCount > 0,
      ).length,
      pendingThreadCount: pendingKeys.size,
      articles: [...articleMap.values()]
        .filter((article) => article.initialCommentCount > 0)
        .sort(
          (a, b) =>
            b.initialCommentCount - a.initialCommentCount ||
            a.title.localeCompare(b.title, "ja"),
        ),
    }))
    .sort(
      (a, b) =>
        b.initialCommentCount - a.initialCommentCount ||
        b.initialArticleCount - a.initialArticleCount ||
        b.totalMessageCount - a.totalMessageCount ||
        b.pendingThreadCount - a.pendingThreadCount ||
        (b.lastCommentAt ?? "").localeCompare(a.lastCommentAt ?? ""),
    );
}

function buildArticleCommentRanking(
  results: CommentArticleResult[],
): ArticleCommentRankingEntry[] {
  const ranking = new Map<
    string,
    ArticleCommentRankingEntry & {
      creatorMap: Map<string, Person & { initialCommentCount: number }>;
    }
  >();

  for (const thread of allThreads(results)) {
    const root =
      thread.messages.find((message) => message.isRoot) ??
      thread.messages[0];
    if (!root || root.isCreator) continue;
    let article = ranking.get(thread.articleKey);
    if (!article) {
      article = {
        articleKey: thread.articleKey,
        articleTitle: thread.articleTitle,
        articleUrl: thread.articleUrl,
        initialCommentCount: 0,
        uniqueCreatorCount: 0,
        creators: [],
        creatorMap: new Map(),
      };
      ranking.set(thread.articleKey, article);
    }
    article.initialCommentCount += 1;
    const creator = article.creatorMap.get(root.user.id);
    if (creator) {
      creator.initialCommentCount += 1;
    } else {
      article.creatorMap.set(root.user.id, {
        ...root.user,
        initialCommentCount: 1,
      });
    }
  }

  return [...ranking.values()]
    .map(({ creatorMap, ...entry }) => ({
      ...entry,
      uniqueCreatorCount: creatorMap.size,
      creators: [...creatorMap.values()].sort(
        (a, b) =>
          b.initialCommentCount - a.initialCommentCount ||
          a.nickname.localeCompare(b.nickname, "ja"),
      ),
    }))
    .sort(
      (a, b) =>
        b.initialCommentCount - a.initialCommentCount ||
        b.uniqueCreatorCount - a.uniqueCreatorCount ||
        a.articleTitle.localeCompare(b.articleTitle, "ja"),
    );
}

function EmptyPreview() {
  return (
    <section className="preview-shell" aria-label="分析画面のイメージ">
      <div className="preview-kpis">
        {["全記事スキ", "未返信", "通知保存"].map((label, index) => (
          <article className="preview-kpi" key={label}>
            <span>{label}</span>
            <strong>{["3,942", "7", "628"][index]}</strong>
            <i />
          </article>
        ))}
      </div>
      <div className="preview-grid">
        <article className="preview-chart">
          <span>全記事を合算したランキング</span>
          <svg viewBox="0 0 560 190" aria-hidden="true">
            <path
              d="M15 160 C95 150 120 136 180 140 S275 116 330 120 S430 96 545 45"
              fill="none"
              stroke="#42c9a0"
              strokeWidth="4"
            />
            <path
              d="M15 160 C95 150 120 136 180 140 S275 116 330 120 S430 96 545 45 L545 180 L15 180 Z"
              fill="url(#preview-gradient)"
            />
            <defs>
              <linearGradient id="preview-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#42c9a0" stopOpacity=".22" />
                <stop offset="100%" stopColor="#42c9a0" stopOpacity=".02" />
              </linearGradient>
            </defs>
          </svg>
        </article>
        <article className="preview-ranking">
          <span>返信漏れチェック</span>
          {["未返信", "再返信あり", "返信済み"].map((label, index) => (
            <div key={label}>
              <b>{index + 1}</b>
              <i />
              <em />
              <strong>{label}</strong>
            </div>
          ))}
        </article>
      </div>
    </section>
  );
}

function BoundDashboardLoading({
  memberLoading,
}: {
  memberLoading: boolean;
}) {
  return (
    <main className="bound-loading-screen">
      <section>
        <p className="eyebrow">PRIVATE MEMBER DASHBOARD</p>
        <h1>
          登録済みのnoteを、
          <br />
          <span>差分だけ更新します。</span>
        </h1>
        <p>
          {memberLoading
            ? "会員と固定note IDを確認しています。"
            : "保存済みの全記事を読み込み、新規・変化分だけ確認しています。"}
        </p>
        <div className="bound-loading-bar">
          <i />
        </div>
        <a href="#member">会員情報を確認する</a>
      </section>
      <EmptyPreview />
    </main>
  );
}

function ScanProgressBar({
  phase,
  progress,
  batchSize,
}: {
  phase: "manifest" | "scanning" | "complete";
  progress: ScanProgress;
  batchSize: number;
}) {
  const percent =
    progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : phase === "complete"
        ? 100
        : 4;
  return (
    <section className={`scan-progress ${phase === "complete" ? "done" : ""}`}>
      <div className="scan-progress-copy">
        <span className="scan-state">
          {phase === "manifest"
            ? "記事一覧と保存済みデータを確認中"
            : phase === "scanning"
              ? `差分を更新中 ${progress.processed}/${progress.total}`
              : progress.total
                ? `差分${progress.total}記事の更新完了`
                : "新規・変更なし（保存済みを使用）"}
        </span>
        <strong>
          {phase === "complete"
            ? progress.failed > 0
              ? `保存済みを含む結果を表示中。${progress.failed}記事は未更新のため暫定です`
              : `ランキングは保存済みを含む全${progress.cached + progress.processed}記事を合算済みです`
            : `${progress.cached}記事は保存済み。更新対象だけ${batchSize}記事ずつ確認します`}
        </strong>
        <small>
          {progress.failed > 0
            ? `${progress.failed}記事は取得に失敗。警告から確認できます。`
            : "初回は全記事、2回目以降は新規・件数変化・対応待ちを中心に更新します。"}
        </small>
      </div>
      <div className="progress-meter" aria-label={`集計進捗 ${percent}%`}>
        <span style={{ width: `${Math.max(percent, 3)}%` }} />
      </div>
      <b>{percent}%</b>
    </section>
  );
}

function TopRanking({ entries }: { entries: RankingEntry[] }) {
  if (!entries.length) {
    return <div className="empty-card compact-empty">公開スキを読み込み中です。</div>;
  }
  return (
    <div className="top-ranking-list">
      {entries.slice(0, 5).map((entry, index) => (
        <a
          href={entry.profileUrl ?? undefined}
          target={entry.profileUrl ? "_blank" : undefined}
          rel="noreferrer"
          className="top-ranking-row"
          key={entry.id}
        >
          <span className={`rank-number rank-${index + 1}`}>{index + 1}</span>
          <Avatar person={entry} />
          <span className="person-copy">
            <strong>{entry.nickname}</strong>
            <small>{entry.urlname ? `@${entry.urlname}` : "noteユーザー"}</small>
          </span>
          <span className="like-total">
            <strong>{formatNumber(entry.count)}</strong>
            <small>記事</small>
          </span>
        </a>
      ))}
    </div>
  );
}

function Overview({
  data,
  ranking,
  threads,
  completedThreads,
  completedLikes,
  completedMagazineAdditions,
  potentialPendingEnabled,
  savingPotentialSetting,
  onPotentialPendingChange,
  scanComplete,
  progress,
  onTab,
}: {
  data: DashboardData;
  ranking: RankingEntry[];
  threads: CommentThread[];
  completedThreads: Set<string>;
  completedLikes: Set<string>;
  completedMagazineAdditions: Set<string>;
  potentialPendingEnabled: boolean;
  savingPotentialSetting: boolean;
  onPotentialPendingChange: (enabled: boolean) => void;
  scanComplete: boolean;
  progress: ScanProgress;
  onTab: (tab: Tab) => void;
}) {
  const [period, setPeriod] = useState<7 | 30 | 365 | 0>(30);
  const pending = threads.filter(
    (thread) =>
      !completedThreads.has(thread.rootKey) &&
      (thread.status === "unreplied" ||
        thread.status === "followup_pending" ||
        (potentialPendingEnabled && thread.status === "unknown")),
  );
  const pendingLikes = data.likerEvents.filter(
    (event) => !completedLikes.has(likeCompletionKey(event)),
  );
  const ownMagazineAdditions = data.activityEvents.filter(
    (event) =>
      isOwnMagazineArticleEvent(event, data.creator) &&
      !completedMagazineAdditions.has(event.eventKey),
  );
  const now = Date.parse(data.refreshedAt);
  const periodStart =
    period === 0 || !Number.isFinite(now)
      ? 0
      : now - period * 24 * 60 * 60 * 1_000;
  const periodActivities = data.activityEvents.filter((event) => {
    const timestamp = event.occurredAt
      ? new Date(event.occurredAt).getTime()
      : event.observedAt;
    return Number.isFinite(timestamp) && timestamp >= periodStart;
  });
  const periodLikes =
    period === 0
      ? data.metrics.totalLikes
      : periodActivities.filter((event) => event.eventType === "like").length;
  const periodComments =
    period === 0
      ? data.articles.reduce(
          (total, article) => total + article.commentCount,
          0,
        )
      : periodActivities.filter(
          (event) =>
            event.eventType === "comment" || event.eventType === "reply",
        ).length;
  const completedConversationCount = threads.filter(
    (thread) =>
      completedThreads.has(thread.rootKey) ||
      thread.status === "replied" ||
      thread.status === "heart_closed",
  ).length;
  const responseRate = threads.length
    ? Math.round((completedConversationCount / threads.length) * 100)
    : 100;
  const articleInsights = data.articles
    .map((article) => {
      const supporters = new Set(
        data.likerEvents
          .filter((event) => event.articleKey === article.key)
          .map((event) => event.user.id),
      ).size;
      const articleThreads = threads.filter(
        (thread) => thread.articleKey === article.key,
      );
      const attention = articleThreads.filter(
        (thread) =>
          !completedThreads.has(thread.rootKey) &&
          (thread.status === "unreplied" ||
            thread.status === "followup_pending" ||
            (potentialPendingEnabled && thread.status === "unknown")),
      ).length;
      return { article, supporters, attention };
    })
    .sort(
      (left, right) =>
        right.article.likeCount - left.article.likeCount ||
        right.article.commentCount - left.article.commentCount,
    )
    .slice(0, 10);
  return (
    <>
      <section className="note-dashboard-panel">
        <header className="note-dashboard-heading">
          <div>
            <p className="panel-kicker">ACCESS STATUS + DEEP ANALYTICS</p>
            <h2>アクセス状況</h2>
            <p>noteの標準ダッシュボードと同じ3指標を起点に、対応状況まで深掘りします。</p>
          </div>
          <div className="period-switch" aria-label="集計期間">
            {[
              [7, "週"],
              [30, "月"],
              [365, "年"],
              [0, "全期間"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={period === value ? "active" : ""}
                onClick={() => setPeriod(value as typeof period)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="dashboard-layer-heading official-layer">
          <span>note公式ダッシュボードと同じ基本3指標</span>
          <small>公開情報では取得できない全体ビューは「―」で明示します。</small>
        </div>
        <div className="note-standard-kpis">
          <article>
            <span>全体ビュー</span>
            <strong>―</strong>
            <small>note本人専用データ・未連携</small>
          </article>
          <article>
            <span>コメント</span>
            <strong>{formatNumber(periodComments)}</strong>
            <small>{period === 0 ? "公開累計" : "保存開始後の期間内"}</small>
          </article>
          <article>
            <span>スキ</span>
            <strong>{formatNumber(periodLikes)}</strong>
            <small>{period === 0 ? "公開累計" : "保存開始後の期間内"}</small>
          </article>
        </div>

        <div className="dashboard-layer-heading insight-layer">
          <span>無名 S note 深掘り分析</span>
          <small>人物の重複を除き、返信・スキ対応・マガジン追加まで横断集計。</small>
        </div>
        <div className="deep-analysis-kpis">
          <article>
            <span>重複を除く応援者</span>
            <strong>{formatNumber(ranking.length)}</strong>
            <small>{scanComplete ? "全記事合算" : "集計中の暫定値"}</small>
          </article>
          <button onClick={() => onTab("comments")}>
            <span>返信確認</span>
            <strong>{formatNumber(pending.length)}</strong>
            <small>未返信・再返信{potentialPendingEnabled ? "・判定保留" : ""}</small>
          </button>
          <button onClick={() => onTab("magazine-adds")}>
            <span>自分の記事が追加</span>
            <strong>{formatNumber(ownMagazineAdditions.length)}</strong>
            <small>未確認のマガジン通知</small>
          </button>
          <article>
            <span>会話対応率</span>
            <strong>{responseRate}%</strong>
            <small>{completedConversationCount}/{threads.length}会話</small>
          </article>
          <button onClick={() => onTab("likers")}>
            <span>スキ対応待ち</span>
            <strong>{formatNumber(pendingLikes.length)}</strong>
            <small>対応済みを除く</small>
          </button>
        </div>

        <div className="potential-setting-row">
          <span>
            <strong>「未対応の可能性」も対応待ちに含める</strong>
            <small>取得不完全で自動判定できない会話を、赤い確認件数へ入れるか切り替えます。</small>
          </span>
          <button
            className={`setting-switch ${potentialPendingEnabled ? "on" : ""}`}
            role="switch"
            aria-checked={potentialPendingEnabled}
            disabled={savingPotentialSetting}
            onClick={() => onPotentialPendingChange(!potentialPendingEnabled)}
          >
            <i />
            {potentialPendingEnabled ? "ON" : "OFF"}
          </button>
        </div>

        <div className="note-article-table">
          <div className="note-article-head">
            <span>記事</span>
            <span>ビュー</span>
            <span>コメント</span>
            <span>スキ</span>
            <span>確認できた人</span>
            <span>要対応</span>
          </div>
          {articleInsights.map(({ article, supporters, attention }) => (
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              key={article.key}
            >
              <strong>{article.title}</strong>
              <span>―</span>
              <span>{formatNumber(article.commentCount)}</span>
              <span>{formatNumber(article.likeCount)}</span>
              <span>{formatNumber(supporters)}</span>
              <b className={attention ? "has-attention" : ""}>
                {formatNumber(attention)}
              </b>
            </a>
          ))}
        </div>
      </section>

      <section className="overview-grid">
        <article className="panel action-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">ACTION REQUIRED</p>
              <h2>対応確認が必要なコメント</h2>
            </div>
            <button className="text-button" onClick={() => onTab("comments")}>
              すべて確認
            </button>
          </div>
          {pending.length ? (
            <div className="overview-action-list">
              {pending.slice(0, 5).map((thread) => {
                const root = thread.messages[0];
                return (
                  <a
                    href={thread.articleUrl}
                    target="_blank"
                    rel="noreferrer"
                    key={thread.rootKey}
                  >
                    <span className={`thread-status status-${thread.status}`}>
                      {threadLabels[thread.status]}
                    </span>
                    <span>
                      <strong>{root?.user.nickname ?? "noteユーザー"}</strong>
                      <small>{thread.articleTitle}</small>
                    </span>
                    <b>記事 ↗</b>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="empty-card compact-empty">
              現在、対応確認が必要な会話はありません。
            </div>
          )}
        </article>
        <article className="panel ranking-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">ALL-ARTICLE SUPPORTERS</p>
              <h2>スキランキング</h2>
            </div>
            <button className="text-button" onClick={() => onTab("ranking")}>
              すべて見る
            </button>
          </div>
          <TopRanking entries={ranking} />
        </article>
      </section>

      <section className="scan-summary">
        <div>
          <span className="summary-label">集計範囲</span>
          <strong>
            {scanComplete ? "全" : "処理済み "}
            {formatNumber(
              scanComplete
                ? data.metrics.publicArticles
                : progress.cached + progress.processed,
            )} 記事
          </strong>
        </div>
        <div>
          <span className="summary-label">人物を確認できたスキ</span>
          <strong>{formatNumber(data.likerEvents.length)} 件</strong>
        </div>
        <div>
          <span className="summary-label">保存済み通知</span>
          <strong>
            {formatNumber(
              data.activityEvents.length + data.privateNotifications.length,
            )}{" "}
            件
          </strong>
        </div>
        <p>{data.sourceNote}</p>
      </section>
    </>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-box">
      <span className="sr-only">{placeholder}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function AdminCreatorSwitcher({
  creators,
  currentUrlname,
  loading,
  error,
  onOpen,
}: {
  creators: AdminCreatorHistoryItem[];
  currentUrlname: string;
  loading: boolean;
  error: string;
  onOpen: (noteInput: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const needle = query.trim().toLowerCase();
  const filtered = creators.filter(
    (creator) =>
      !needle ||
      creator.nickname.toLowerCase().includes(needle) ||
      creator.creatorUrlname.toLowerCase().includes(needle),
  );

  async function addCreator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteInput.trim() || loading) return;
    await onOpen(noteInput);
    setNoteInput("");
  }

  return (
    <details className="admin-creator-switcher">
      <summary>
        <span>管理者の閲覧ID</span>
        <strong>{formatNumber(creators.length)}件保存</strong>
      </summary>
      <div className="admin-creator-popover">
        <div className="admin-creator-heading">
          <div>
            <span>ADMIN CREATOR LIBRARY</span>
            <strong>一度開いたIDは一覧に残ります</strong>
          </div>
          <small>一般会員には表示されません</small>
        </div>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="保存済みID・名前を検索"
        />
        <form className="admin-creator-add" onSubmit={addCreator}>
          <input
            value={noteInput}
            onChange={(event) => setNoteInput(event.target.value)}
            placeholder="新しいnote IDまたはURL"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button disabled={loading || !noteInput.trim()}>
            {loading ? "確認中…" : "追加して開く"}
          </button>
        </form>
        {error ? <p className="admin-creator-error">{error}</p> : null}
        <div className="admin-creator-list">
          {filtered.length ? (
            filtered.map((creator) => {
              const active =
                creator.creatorUrlname.toLowerCase() ===
                currentUrlname.toLowerCase();
              return (
                <button
                  type="button"
                  key={creator.creatorUrlname}
                  className={active ? "active" : ""}
                  disabled={loading || active}
                  onClick={() => void onOpen(creator.creatorUrlname)}
                >
                  <Avatar
                    person={{
                      nickname: creator.nickname,
                      profileImageUrl: creator.profileImageUrl,
                    }}
                    size="small"
                  />
                  <span>
                    <strong>{creator.nickname}</strong>
                    <small>@{creator.creatorUrlname}</small>
                  </span>
                  <time>
                    {active
                      ? "表示中"
                      : `最終 ${formatDate(new Date(creator.lastOpenedAt).toISOString())}`}
                  </time>
                </button>
              );
            })
          ) : (
            <p>検索条件に一致するIDはありません。</p>
          )}
        </div>
      </div>
    </details>
  );
}

function Pagination({
  page,
  total,
  pageSize = 20,
  onPage,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onPage: (page: number) => void;
}) {
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(Math.max(page, 1), pageCount);
  if (pageCount <= 1) return null;
  const numberedPages = [...new Set([1, safePage - 1, safePage, safePage + 1, pageCount])]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((left, right) => left - right);
  return (
    <nav className="pagination" aria-label="ページ切り替え">
      <span className="pagination-summary">
        {safePage} / {formatNumber(pageCount)}ページ
        <small>
          （全{formatNumber(total)}件・{formatNumber(pageSize)}件ずつ）
        </small>
      </span>
      <div className="pagination-pages">
        <button
          type="button"
          className="pagination-edge"
          onClick={() => onPage(1)}
          disabled={safePage <= 1}
        >
          先頭
        </button>
        <button
          type="button"
          aria-label="前のページ"
          onClick={() => onPage(safePage - 1)}
          disabled={safePage <= 1}
        >
          ‹
        </button>
        {numberedPages.map((number, index) => {
          const previous = numberedPages[index - 1];
          return (
            <span className="pagination-number-wrap" key={number}>
              {previous && number - previous > 1 ? (
                <i aria-hidden="true">…</i>
              ) : null}
              <button
                type="button"
                className={number === safePage ? "active" : ""}
                aria-current={number === safePage ? "page" : undefined}
                onClick={() => onPage(number)}
              >
                {formatNumber(number)}
              </button>
            </span>
          );
        })}
        <button
          type="button"
          aria-label="次のページ"
          onClick={() => onPage(safePage + 1)}
          disabled={safePage >= pageCount}
        >
          ›
        </button>
        <button
          type="button"
          className="pagination-edge"
          onClick={() => onPage(pageCount)}
          disabled={safePage >= pageCount}
        >
          末尾
        </button>
      </div>
      <form
        className="pagination-jump"
        onSubmit={(event) => {
          event.preventDefault();
          const requested = Number.parseInt(
            String(new FormData(event.currentTarget).get("page") ?? ""),
            10,
          );
          if (Number.isFinite(requested)) {
            onPage(Math.min(Math.max(requested, 1), pageCount));
          }
        }}
      >
        <label>
          <span>ページ指定</span>
          <input
            type="number"
            name="page"
            min="1"
            max={pageCount}
            defaultValue={safePage}
            key={safePage}
          />
        </label>
        <button type="submit">移動</button>
      </form>
    </nav>
  );
}

function LikersView({
  events,
  scanning,
  completedLikes,
  savingCompletionKeys,
  onToggleCompleted,
}: {
  events: LikerEvent[];
  scanning: boolean;
  completedLikes: Set<string>;
  savingCompletionKeys: Set<string>;
  onToggleCompleted: (itemKey: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "completed">(
    "pending",
  );
  const [sort, setSort] = useState<"newest" | "oldest" | "name" | "name-desc">(
    "newest",
  );
  const [dateMode, setDateMode] = useState<DateScopeMode>("all");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (needle
      ? events.filter(
          (event) =>
            event.user.nickname.toLowerCase().includes(needle) ||
            (event.user.urlname ?? "").toLowerCase().includes(needle) ||
            `@${event.user.urlname ?? ""}`.toLowerCase().includes(needle) ||
            event.articleTitle.toLowerCase().includes(needle),
        )
      : [...events]
    ).filter((event) => {
      const completed = completedLikes.has(likeCompletionKey(event));
      const completionMatches =
        filter === "all" ||
        (filter === "completed" && completed) ||
        (filter === "pending" && !completed);
      return (
        completionMatches &&
        matchesDateScope(
          event.likedAt,
          undefined,
          dateMode,
          selectedDay,
          selectedMonth,
        )
      );
    });
    return matches.sort((a, b) => {
      if (sort === "oldest") {
        return (a.likedAt ?? "").localeCompare(b.likedAt ?? "");
      }
      if (sort === "name" || sort === "name-desc") {
        const order = a.user.nickname.localeCompare(
          b.user.nickname,
          "ja",
          { numeric: true, sensitivity: "base" },
        );
        return sort === "name" ? order : -order;
      }
      return (b.likedAt ?? "").localeCompare(a.likedAt ?? "");
    });
  }, [
    events,
    query,
    sort,
    filter,
    completedLikes,
    dateMode,
    selectedDay,
    selectedMonth,
  ]);
  const likerPage = pageSlice(filtered, page, pageSize);
  const pageItems = likerPage.items;

  return (
    <section className="panel list-panel">
      <div className="section-title-row">
        <div>
          <p className="panel-kicker">LIKE ACTIVITY / ALL ARTICLES</p>
          <h2>スキしてくれた人</h2>
          <p>全公開記事を対象に、人物・記事・日時を新しい順で表示します。</p>
        </div>
        <div className="list-tools">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="クリエイターID・名前・記事名で検索"
          />
          <label className="select-box">
            <span className="sr-only">並び順</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as typeof sort);
                setPage(1);
              }}
            >
              <option value="newest">新しいスキ順</option>
              <option value="oldest">古いスキ順</option>
              <option value="name">名前 あいうえお順</option>
              <option value="name-desc">名前 逆順</option>
            </select>
          </label>
        </div>
      </div>
      <div className="filter-pills" aria-label="スキの対応状態で絞り込む">
        {[
          ["pending", "未対応"],
          ["completed", "対応済み"],
          ["all", "すべて"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? "active" : ""}
            onClick={() => {
              setFilter(id as typeof filter);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <DateScopeControls
        mode={dateMode}
        day={selectedDay}
        month={selectedMonth}
        onChange={(next) => {
          setDateMode(next.mode);
          if (next.day !== undefined) setSelectedDay(next.day);
          if (next.month !== undefined) setSelectedMonth(next.month);
          setPage(1);
        }}
      />
      {filtered.length ? (
        <>
          <div className="liker-table">
            <div className="table-head">
              <span>クリエイター</span>
              <span>スキされた記事</span>
              <span>日時</span>
              <span>対応</span>
            </div>
            {pageItems.map((event, index) => {
              const completionKey = likeCompletionKey(event);
              const isCompleted = completedLikes.has(completionKey);
              const isSaving = savingCompletionKeys.has(
                `like:${completionKey}`,
              );
              return (
                <div
                  className={`liker-row ${isCompleted ? "liker-row-completed" : ""}`}
                  key={`${event.articleKey}-${event.user.id}-${event.likedAt}-${(page - 1) * pageSize + index}`}
                >
                  <a
                    className="person-cell"
                    href={event.user.profileUrl ?? undefined}
                    target={event.user.profileUrl ? "_blank" : undefined}
                    rel="noreferrer"
                  >
                    <Avatar person={event.user} />
                    <span>
                      <strong>{event.user.nickname}</strong>
                      <small>{event.user.urlname ? `@${event.user.urlname}` : "noteユーザー"}</small>
                    </span>
                  </a>
                  <a className="article-cell" href={event.articleUrl} target="_blank" rel="noreferrer">
                    {event.articleTitle}
                  </a>
                  <time>{formatDate(event.likedAt, true)}</time>
                  <button
                    type="button"
                    className="like-completion-button"
                    onClick={() => onToggleCompleted(completionKey)}
                    disabled={isSaving}
                    aria-pressed={isCompleted}
                  >
                    {isSaving
                      ? "保存中…"
                      : isCompleted
                        ? "✓ 対応済み"
                        : "＋ 対応済みにする"}
                  </button>
                </div>
              );
            })}
          </div>
          <Pagination
            page={likerPage.page}
            total={filtered.length}
            pageSize={pageSize}
            onPage={setPage}
          />
        </>
      ) : (
        <div className="empty-card">
          {scanning
            ? "全記事の公開スキを読み込んでいます。"
            : events.length
              ? "検索条件に一致するスキはありません。"
              : "公開アカウントからのスキは見つかりませんでした。"}
        </div>
      )}
    </section>
  );
}

function RankingView({
  entries,
  scanning,
  articleCount,
}: {
  entries: RankingEntry[];
  scanning: boolean;
  articleCount: number;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const pageSize = 20;
  const filtered = entries.filter((entry) => {
    const needle = query.trim().toLowerCase();
    return (
      !needle ||
      entry.nickname.toLowerCase().includes(needle) ||
      (entry.urlname ?? "").toLowerCase().includes(needle)
    );
  });
  const rankingPage = pageSlice(filtered, page, pageSize);
  const pageItems = rankingPage.items;
  return (
    <section className="panel list-panel">
      <div className="section-title-row">
        <div>
          <p className="panel-kicker">ALL-ARTICLE SUPPORTER RANKING</p>
          <h2>スキランキング {scanning ? <small className="provisional">暫定</small> : null}</h2>
          <p>
            {scanning
              ? "処理済み記事の暫定順位です。完了後に全記事を合算して確定します。"
              : `全${formatNumber(articleCount)}記事で、スキした記事数が多い順です。`}
          </p>
        </div>
        <div className="list-tools">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="クリエイターID・名前で検索"
          />
          <span className="count-badge">{formatNumber(entries.length)}人</span>
        </div>
      </div>
      {filtered.length ? (
        <>
          <div className="ranking-table">
            {pageItems.map((entry) => {
              const rank = entries.indexOf(entry) + 1;
              const isOpen = expanded === entry.id;
              return (
                <article className="ranking-entry" key={entry.id}>
                  <div className="ranking-row">
                    <span className={`rank-number rank-${rank}`}>{rank}</span>
                    <Avatar person={entry} size="large" />
                    <a
                      className="person-copy"
                      href={entry.profileUrl ?? undefined}
                      target={entry.profileUrl ? "_blank" : undefined}
                      rel="noreferrer"
                    >
                      <strong>{entry.nickname}</strong>
                      <small>
                        {entry.urlname ? `@${entry.urlname}` : "noteユーザー"}
                      </small>
                    </a>
                    <button
                      className="like-total large article-count-button"
                      onClick={() => setExpanded(isOpen ? null : entry.id)}
                      aria-expanded={isOpen}
                    >
                      <strong>{formatNumber(entry.count)}</strong>
                      <small>記事を見る</small>
                    </button>
                  </div>
                  {isOpen ? (
                    <div className="ranking-article-list">
                      {entry.articles.map((article) => (
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noreferrer"
                          key={article.key}
                        >
                          <span>{article.title}</span>
                          <time>{formatDate(article.likedAt, true)}</time>
                          <b>記事を開く ↗</b>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          <Pagination
            page={rankingPage.page}
            total={filtered.length}
            pageSize={pageSize}
            onPage={setPage}
          />
        </>
      ) : (
        <div className="empty-card">
          {scanning
            ? "全記事を集計中です。"
            : entries.length
              ? "検索条件に一致するクリエイターはいません。"
              : "公開アカウントからのスキは見つかりませんでした。"}
        </div>
      )}
    </section>
  );
}

const threadLabels: Record<ThreadStatus, string> = {
  unreplied: "未返信",
  followup_pending: "返信後に再返信あり",
  heart_closed: "♥で会話終了候補",
  replied: "返信済み",
  unknown: "要確認",
};

function CommentsView({
  results,
  scanning,
  completedThreads,
  potentialPendingEnabled,
  savingCompletionKeys,
  onToggleCompleted,
}: {
  results: CommentArticleResult[];
  scanning: boolean;
  completedThreads: Set<string>;
  potentialPendingEnabled: boolean;
  savingCompletionKeys: Set<string>;
  onToggleCompleted: (rootKey: string) => void;
}) {
  const [filter, setFilter] = useState<
    "all" | ThreadStatus | "pending" | "completed"
  >("pending");
  const [query, setQuery] = useState("");
  const [dateMode, setDateMode] = useState<DateScopeMode>("all");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const threads = useMemo(() => allThreads(results), [results]);
  const unavailable = results.filter(
    (result) =>
      result.fetchStatus === "unavailable" || result.fetchStatus === "error",
  );
  const filtered = threads.filter((thread) => {
    const isCompleted = completedThreads.has(thread.rootKey);
    const statusMatches =
      filter === "all" ||
      (filter === "completed" && isCompleted) ||
      filter === thread.status ||
      (filter === "pending" &&
        !isCompleted &&
        (thread.status === "unreplied" ||
          thread.status === "followup_pending" ||
          (potentialPendingEnabled && thread.status === "unknown")));
    const needle = query.trim().toLowerCase();
    const queryMatches =
      !needle ||
      thread.articleTitle.toLowerCase().includes(needle) ||
      thread.messages.some(
        (message) =>
          message.user.nickname.toLowerCase().includes(needle) ||
          (message.user.urlname ?? "").toLowerCase().includes(needle) ||
          message.text.toLowerCase().includes(needle),
      );
    return (
      statusMatches &&
      queryMatches &&
      matchesDateScope(
        thread.lastMessageAt,
        undefined,
        dateMode,
        selectedDay,
        selectedMonth,
      )
    );
  });
  const commentPage = pageSlice(filtered, page, pageSize);
  const pageItems = commentPage.items;

  return (
    <section className="panel list-panel comments-panel">
      <div className="section-title-row">
        <div>
          <p className="panel-kicker">FULL CONVERSATION CHECK</p>
          <h2>コメントと返信漏れ</h2>
          <p>
            初手コメントから返信の返信まで確認。♥の会話終了候補と、保存済みの手動対応を分けます。
          </p>
        </div>
        <SearchInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="クリエイターID・人・記事・本文で検索"
        />
      </div>

      <div className="filter-pills" aria-label="コメント状態で絞り込む">
        {[
          ["pending", "対応確認"],
          ["unreplied", "未返信"],
          ["followup_pending", "再返信あり"],
          ["heart_closed", "♥で終了候補"],
          ["replied", "返信済み"],
          ["unknown", "判定保留"],
          ["completed", "手動対応済み"],
          ["all", "すべて"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? "active" : ""}
            onClick={() => {
              setFilter(id as typeof filter);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="potential-filter-note">
        判定保留は現在
        <strong>{potentialPendingEnabled ? " 対応待ちに含める" : " 別枠のみ"}</strong>
        設定です。ダッシュボードのスイッチから変更できます。
      </p>

      <DateScopeControls
        mode={dateMode}
        day={selectedDay}
        month={selectedMonth}
        onChange={(next) => {
          setDateMode(next.mode);
          if (next.day !== undefined) setSelectedDay(next.day);
          if (next.month !== undefined) setSelectedMonth(next.month);
          setPage(1);
        }}
      />

      <p className="public-data-limit">
        ブロック中・ブロックされた相手の完全な一覧は、noteのログイン本人専用情報のため公開版では判定しません。
        コメントAPIが公開したブロック表示だけ、該当発言に表示します。
      </p>

      {unavailable.length ? (
        <details className="unavailable-box">
          <summary>判定できない記事が{unavailable.length}件あります</summary>
          {unavailable.map((result) => (
            <a href={result.articleUrl} target="_blank" rel="noreferrer" key={result.articleKey}>
              <strong>{result.articleTitle}</strong>
              <span>{result.message}</span>
            </a>
          ))}
        </details>
      ) : null}

      {filtered.length ? (
        <>
          <div className="thread-list">
            {pageItems.map((thread) => {
              const root = thread.messages[0];
              const last = thread.messages.at(-1);
              const isCompleted = completedThreads.has(thread.rootKey);
              const isSaving = savingCompletionKeys.has(
                `comment_thread:${thread.rootKey}`,
              );
              return (
                <article
                  className={`thread-wrap ${isCompleted ? "thread-manual-complete" : ""}`}
                  key={thread.rootKey}
                >
                  <button
                    type="button"
                    className="completion-toggle"
                    onClick={() => onToggleCompleted(thread.rootKey)}
                    aria-pressed={isCompleted}
                    disabled={isSaving}
                  >
                    {isSaving
                      ? "保存中…"
                      : isCompleted
                        ? "✓ 対応済み"
                        : "＋ 対応済みにする"}
                  </button>
                  <details className={`thread-card status-${thread.status}`}>
                    <summary>
                      <span
                        className={`thread-status status-${thread.status}`}
                      >
                        {isCompleted
                          ? "手動対応済み"
                          : threadLabels[thread.status]}
                      </span>
                      <span className="thread-person">
                        {root ? <Avatar person={root.user} size="small" /> : null}
                        <span>
                          <strong>
                            {root?.user.nickname ?? "noteユーザー"}
                          </strong>
                          <small>
                            {root?.text ??
                              "コメント本文を取得できませんでした。"}
                          </small>
                        </span>
                      </span>
                      <a
                        className="thread-article thread-summary-link"
                        href={thread.articleUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <small>記事を開く</small>
                        <strong>{thread.articleTitle} ↗</strong>
                      </a>
                      <span className="thread-last">
                        <small>最終発言</small>
                        <strong>
                          {last?.isCreator ? "あなた" : last?.user.nickname}
                        </strong>
                        <time>{formatDate(thread.lastMessageAt, true)}</time>
                      </span>
                      <span className="thread-count">
                        {thread.messages.length}件
                      </span>
                    </summary>
                    <div className="thread-detail">
                      <a
                        className="thread-article-link"
                        href={thread.articleUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        「{thread.articleTitle}」をnoteで開く ↗
                      </a>
                      <div className="message-timeline">
                        {thread.messages.map((message) => (
                          <article
                            className={
                              message.isCreator ? "creator-message" : ""
                            }
                            key={message.key}
                          >
                            <Avatar person={message.user} size="small" />
                            <div>
                              <header>
                                <strong>
                                  {message.isCreator
                                    ? "あなた"
                                    : message.user.nickname}
                                </strong>
                                <span>
                                  {message.isRoot ? "初手コメント" : "返信"}
                                </span>
                                {message.isCreatorLiked ? (
                                  <span className="creator-heart">
                                    ♥ 作者がスキ
                                  </span>
                                ) : null}
                                {message.isBlocked ? (
                                  <span className="blocked-comment">
                                    ブロック表示
                                  </span>
                                ) : null}
                                <time>
                                  {formatDate(message.createdAt, true)}
                                </time>
                              </header>
                              <p>{message.text}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                      {thread.status === "heart_closed" ? (
                        <p className="heart-closure-note">
                          最後の再返信に作者の♥が付いています。会話終了の可能性が高いものとして分けています。
                        </p>
                      ) : null}
                      {!thread.isComplete ? (
                        <p className="thread-incomplete">
                          返信一覧の一部を取得できなかったため、自動判定を保留しています。
                        </p>
                      ) : null}
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
          <Pagination
            page={commentPage.page}
            total={filtered.length}
            pageSize={pageSize}
            onPage={setPage}
          />
        </>
      ) : (
        <div className="empty-card">
          {scanning
            ? "コメントの全スレッドを確認中です。"
            : threads.length
              ? "この条件に一致する会話はありません。"
              : "公開コメントは見つかりませんでした。"}
        </div>
      )}
    </section>
  );
}

function CommentRankingView({
  entries,
  articleEntries,
  scanning,
}: {
  entries: CommentRankingEntry[];
  articleEntries: ArticleCommentRankingEntry[];
  scanning: boolean;
}) {
  const [mode, setMode] = useState<"creators" | "articles">("creators");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const needle = query.trim().toLowerCase();
  const creatorRows = entries.filter(
    (entry) =>
      !needle ||
      entry.nickname.toLowerCase().includes(needle) ||
      (entry.urlname ?? "").toLowerCase().includes(needle),
  );
  const articleRows = articleEntries.filter(
    (entry) =>
      !needle || entry.articleTitle.toLowerCase().includes(needle),
  );
  const activeTotal =
    mode === "creators" ? creatorRows.length : articleRows.length;
  const creatorRankingPage = pageSlice(creatorRows, page, pageSize);
  const articleRankingPage = pageSlice(articleRows, page, pageSize);
  const creatorPageItems =
    mode === "creators"
      ? creatorRankingPage.items
      : [];
  const articlePageItems =
    mode === "articles"
      ? articleRankingPage.items
      : [];
  return (
    <section className="panel list-panel">
      <div className="section-title-row">
        <div>
          <p className="panel-kicker">COMMENTER RANKING</p>
          <h2>コメントランキング {scanning ? <small className="provisional">暫定</small> : null}</h2>
          <p>
            順位の基準は各記事への初手コメントです。返信数とは分けて集計します。
          </p>
        </div>
        <SearchInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder={
            mode === "creators"
              ? "クリエイターID・名前で検索"
              : "記事名で検索"
          }
        />
      </div>
      <div className="ranking-mode-tabs">
        <button
          className={mode === "creators" ? "active" : ""}
          onClick={() => {
            setMode("creators");
            setPage(1);
          }}
        >
          クリエイター順位
        </button>
        <button
          className={mode === "articles" ? "active" : ""}
          onClick={() => {
            setMode("articles");
            setPage(1);
          }}
        >
          記事別・初手コメント順位
        </button>
      </div>

      {mode === "creators" && creatorRows.length ? (
        <>
          <div className="comment-ranking-table">
            {creatorPageItems.map((entry) => {
              const rank = entries.indexOf(entry) + 1;
              return (
                <details className="comment-ranking-entry" key={entry.id}>
                  <summary className="comment-ranking-row">
                    <span className={`rank-number rank-${rank}`}>{rank}</span>
                    <Avatar person={entry} size="large" />
                    <span className="person-copy">
                      <strong>{entry.nickname}</strong>
                      <small>
                        {entry.urlname ? `@${entry.urlname}` : "noteユーザー"}
                      </small>
                    </span>
                    <span className="rank-stat primary-stat">
                      <small>初手コメント</small>
                      <strong>{formatNumber(entry.initialCommentCount)}</strong>
                    </span>
                    <span className="rank-stat">
                      <small>初手した記事</small>
                      <strong>{formatNumber(entry.initialArticleCount)}</strong>
                    </span>
                    <span className="rank-stat">
                      <small>コメント＋返信</small>
                      <strong>{formatNumber(entry.totalMessageCount)}</strong>
                    </span>
                  </summary>
                  <div className="comment-rank-details">
                    {entry.profileUrl ? (
                      <a
                        className="profile-open-link"
                        href={entry.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        クリエイターページを開く ↗
                      </a>
                    ) : null}
                    <strong>初手コメントした記事</strong>
                    {entry.articles.map((article) => (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noreferrer"
                        key={article.key}
                      >
                        <span>{article.title}</span>
                        <small>
                          初手 {article.initialCommentCount}件・全発言{" "}
                          {article.totalMessageCount}件
                        </small>
                      </a>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </>
      ) : null}

      {mode === "articles" && articleRows.length ? (
        <div className="article-comment-ranking">
          {articlePageItems.map((entry) => {
            const rank = articleEntries.indexOf(entry) + 1;
            return (
              <details className="article-comment-entry" key={entry.articleKey}>
                <summary>
                  <span className={`rank-number rank-${rank}`}>{rank}</span>
                  <span className="article-rank-title">
                    <strong>{entry.articleTitle}</strong>
                    <small>
                      初手したクリエイター {entry.uniqueCreatorCount}人
                    </small>
                  </span>
                  <span className="rank-stat primary-stat">
                    <small>初手コメント</small>
                    <strong>{entry.initialCommentCount}</strong>
                  </span>
                </summary>
                <div className="article-comment-creators">
                  <a
                    className="profile-open-link"
                    href={entry.articleUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    記事を開く ↗
                  </a>
                  {entry.creators.map((creator) => (
                    <a
                      href={creator.profileUrl ?? undefined}
                      target={creator.profileUrl ? "_blank" : undefined}
                      rel="noreferrer"
                      key={creator.id}
                    >
                      <Avatar person={creator} size="small" />
                      <span>
                        <strong>{creator.nickname}</strong>
                        <small>
                          {creator.urlname ? `@${creator.urlname}` : "noteユーザー"}
                        </small>
                      </span>
                      <b>{creator.initialCommentCount}件</b>
                    </a>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      ) : null}

      {activeTotal ? (
        <Pagination
          page={mode === "creators" ? creatorRankingPage.page : articleRankingPage.page}
          total={activeTotal}
          pageSize={pageSize}
          onPage={setPage}
        />
      ) : (
        <div className="empty-card">
          {scanning
            ? "コメントを集計中です。"
            : query
              ? "検索条件に一致する項目はありません。"
              : "公開コメントは見つかりませんでした。"}
        </div>
      )}
    </section>
  );
}

function SocialView({
  social,
  followerHistory,
  loading,
  error,
  onRefresh,
}: {
  social: SocialData | null;
  followerHistory: FollowerPoint[];
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
}) {
  const [kind, setKind] = useState<"followers" | "followings">("followers");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const snapshot = social?.[kind] ?? null;
  const needle = query.trim().toLowerCase();
  const filtered = (snapshot?.people ?? []).filter(
    (person) =>
      !needle ||
      person.nickname.toLowerCase().includes(needle) ||
      (person.urlname ?? "").toLowerCase().includes(needle),
  );
  const socialPage = pageSlice(filtered, page, pageSize);
  const pageItems = socialPage.items;
  const recentHistory = followerHistory.slice(-8);

  return (
    <section className="panel list-panel social-panel">
      <div className="section-title-row">
        <div>
          <p className="panel-kicker">FOLLOW CHANGE WATCH</p>
          <h2>フォロワー・フォロー変化</h2>
          <p>
            初回に全員を基準保存し、次回から増えた人・外れた人を名前とIDで残します。
          </p>
        </div>
        <button
          className="outline-button"
          onClick={() => void onRefresh()}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : null}
          一覧を照合
        </button>
      </div>

      <div className="social-kind-tabs">
        {[
          ["followers", "フォロワー", social?.followers.totalCount ?? 0],
          ["followings", "フォロー中", social?.followings.totalCount ?? 0],
        ].map(([id, label, count]) => (
          <button
            key={String(id)}
            className={kind === id ? "active" : ""}
            onClick={() => {
              setKind(id as typeof kind);
              setPage(1);
            }}
          >
            <span>{String(label)}</span>
            <strong>{formatNumber(Number(count))}</strong>
          </button>
        ))}
      </div>

      {!social && loading ? (
        <div className="social-loading">
          <span className="spinner" />
          <strong>公開一覧を照合しています</strong>
          <p>初回だけ全ページを確認します。2回目以降は変化がなければ保存済みを使います。</p>
        </div>
      ) : null}
      {error ? <div className="inline-error">{error}</div> : null}

      {snapshot ? (
        <>
          <div className={`social-scan-note ${snapshot.complete ? "" : "incomplete"}`}>
            <strong>
              {snapshot.scanMode === "baseline"
                ? "初回基準を保存"
                : snapshot.scanMode === "cached"
                  ? "高速確認済み"
                  : "全員照合済み"}
            </strong>
            <span>{snapshot.message}</span>
            <small>
              確認 {formatDate(snapshot.scannedAt, true)}
              {snapshot.lastFullScanAt
                ? `・全件照合 ${formatDate(snapshot.lastFullScanAt, true)}`
                : ""}
            </small>
          </div>

          {kind === "followers" && recentHistory.length ? (
            <div className="social-history">
              <strong>フォロワー数の保存推移</strong>
              <div>
                {recentHistory.map((point, index) => {
                  const previous = recentHistory[index - 1];
                  const delta = previous ? point.count - previous.count : null;
                  return (
                    <span key={`${point.date}-${index}`}>
                      <small>{point.date.slice(5).replace("-", "/")}</small>
                      <b>{formatNumber(point.count)}</b>
                      {delta ? (
                        <em className={delta < 0 ? "negative-delta" : ""}>
                          {delta > 0 ? "+" : ""}
                          {formatNumber(delta)}
                        </em>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          {snapshot.added.length || snapshot.removed.length ? (
            <div className="social-change-box">
              <h3>今回わかった増減</h3>
              <div>
                {snapshot.added.map((person) => (
                  <a
                    href={person.profileUrl ?? undefined}
                    target={person.profileUrl ? "_blank" : undefined}
                    rel="noreferrer"
                    key={`added-${person.id}`}
                  >
                    <Avatar person={person} size="small" />
                    <span>
                      <strong>{person.nickname}</strong>
                      <small>{person.urlname ? `@${person.urlname}` : "noteユーザー"}</small>
                    </span>
                    <b className="positive-change">追加</b>
                  </a>
                ))}
                {snapshot.removed.map((person) => (
                  <a
                    href={person.profileUrl ?? undefined}
                    target={person.profileUrl ? "_blank" : undefined}
                    rel="noreferrer"
                    key={`removed-${person.id}`}
                  >
                    <Avatar person={person} size="small" />
                    <span>
                      <strong>{person.nickname}</strong>
                      <small>{person.urlname ? `@${person.urlname}` : "noteユーザー"}</small>
                    </span>
                    <b className="negative-change">終了</b>
                  </a>
                ))}
              </div>
              <p>過去に確認した増減は「通知保存」に蓄積されています。</p>
            </div>
          ) : null}

          <div className="list-tools">
            <SearchInput
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="クリエイターID・名前で検索"
            />
            <span className="count-badge">
              {formatNumber(filtered.length)}人
            </span>
          </div>
          {pageItems.length ? (
            <>
              <div className="social-people-list">
                {pageItems.map((person) => (
                  <a
                    href={person.profileUrl ?? undefined}
                    target={person.profileUrl ? "_blank" : undefined}
                    rel="noreferrer"
                    key={person.id}
                  >
                    <Avatar person={person} />
                    <span>
                      <strong>{person.nickname}</strong>
                      <small>{person.urlname ? `@${person.urlname}` : "noteユーザー"}</small>
                    </span>
                    <b>noteで開く ↗</b>
                  </a>
                ))}
              </div>
              <Pagination
                page={socialPage.page}
                total={filtered.length}
                pageSize={pageSize}
                onPage={setPage}
              />
            </>
          ) : (
            <div className="empty-card">
              {query
                ? "検索条件に一致する人はいません。"
                : "公開一覧に表示できる人はいません。"}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

const activityLabels: Record<ActivityType, string> = {
  like: "スキ",
  comment: "コメント",
  reply: "返信",
  magazine_member_added: "参加者追加",
  magazine_member_removed: "参加終了",
  magazine_article_added: "記事追加",
  magazine_followers_changed: "フォロワー変化",
  creator_magazine_added: "公開マガジン追加",
  creator_magazine_removed: "公開マガジン終了",
  follower_added: "フォロワー追加",
  follower_removed: "フォロワー終了",
  following_added: "フォロー追加",
  following_removed: "フォロー終了",
};

function isOwnMagazineArticleEvent(event: ActivityEvent, creator: Creator) {
  if (event.eventType !== "magazine_article_added") return false;
  if (
    event.actorUrlname &&
    event.actorUrlname.toLowerCase() === creator.urlname.toLowerCase()
  ) {
    return true;
  }
  return creator.id != null && event.actorId === String(creator.id);
}

function MagazineAddsView({
  events,
  creator,
  magazines,
  completedMagazineAdditions,
  savingCompletionKeys,
  onToggleCompleted,
}: {
  events: ActivityEvent[];
  creator: Creator;
  magazines: Magazine[];
  completedMagazineAdditions: Set<string>;
  savingCompletionKeys: Set<string>;
  onToggleCompleted: (eventKey: string) => void;
}) {
  const [filter, setFilter] = useState<
    "own-pending" | "own" | "others" | "all"
  >("own-pending");
  const [query, setQuery] = useState("");
  const [dateMode, setDateMode] = useState<DateScopeMode>("all");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const magazinesByKey = useMemo(
    () => new Map(magazines.map((magazine) => [magazine.key, magazine])),
    [magazines],
  );
  const additions = events
    .filter((event) => event.eventType === "magazine_article_added")
    .sort((a, b) => {
      const aTime = a.occurredAt
        ? new Date(a.occurredAt).getTime()
        : a.observedAt;
      const bTime = b.occurredAt
        ? new Date(b.occurredAt).getTime()
        : b.observedAt;
      return bTime - aTime;
    });
  const ownCount = additions.filter((event) =>
    isOwnMagazineArticleEvent(event, creator),
  ).length;
  const ownPendingCount = additions.filter(
    (event) =>
      isOwnMagazineArticleEvent(event, creator) &&
      !completedMagazineAdditions.has(event.eventKey),
  ).length;
  const otherCount = additions.length - ownCount;
  const filtered = additions.filter((event) => {
    const isOwn = isOwnMagazineArticleEvent(event, creator);
    if (
      filter === "own-pending" &&
      (!isOwn || completedMagazineAdditions.has(event.eventKey))
    ) {
      return false;
    }
    if (filter === "own" && !isOwn) return false;
    if (filter === "others" && isOwn) return false;
    const needle = query.trim().toLowerCase();
    const magazineTitle =
      typeof event.metadata?.magazineTitle === "string"
        ? event.metadata.magazineTitle
        : "";
    const magazineKey =
      typeof event.metadata?.magazineKey === "string"
        ? event.metadata.magazineKey
        : "";
    const magazineOwner = magazinesByKey.get(magazineKey)?.owner;
    const queryMatches =
      !needle ||
      (event.actorNickname ?? "").toLowerCase().includes(needle) ||
      (event.actorUrlname ?? "").toLowerCase().includes(needle) ||
      (event.subjectTitle ?? "").toLowerCase().includes(needle) ||
      magazineTitle.toLowerCase().includes(needle) ||
      (magazineOwner?.nickname ?? "").toLowerCase().includes(needle) ||
      (magazineOwner?.urlname ?? "").toLowerCase().includes(needle);
    if (!queryMatches) return false;
    const eventDate = dateKey(event.occurredAt, event.observedAt);
    if (
      !matchesDateScope(
        event.occurredAt,
        event.observedAt,
        dateMode,
        selectedDay,
        selectedMonth,
      )
    ) {
      return false;
    }
    if (fromDate && eventDate < fromDate) return false;
    if (toDate && eventDate > toDate) return false;
    return true;
  });
  const magazineAddPage = pageSlice(filtered, page, pageSize);
  const pageItems = magazineAddPage.items;

  return (
    <section className="panel list-panel magazine-add-panel">
      <div className="section-title-row">
        <div>
          <p className="panel-kicker">MAGAZINE ARTICLE ADDITIONS</p>
          <h2>マガジン追加履歴</h2>
          <p>
            自分の記事がマガジンに入った履歴と、追跡中の共同マガジンに追加された記事を分けて残します。
          </p>
        </div>
        <span className="count-badge">
          {formatNumber(additions.length)}件保存
        </span>
      </div>

      <div className="magazine-add-summary">
        <article className={ownPendingCount ? "magazine-priority-stat" : ""}>
          <span>自分の記事・未確認</span>
          <strong>{formatNumber(ownPendingCount)}</strong>
          <small>最優先で確認</small>
        </article>
        <article>
          <span>自分の記事・合計</span>
          <strong>{formatNumber(ownCount)}</strong>
          <small>確認済みを含む</small>
        </article>
        <article>
          <span>共同マガジン内</span>
          <strong>{formatNumber(otherCount)}</strong>
          <small>他の人の記事</small>
        </article>
      </div>

      {ownPendingCount ? (
        <div className="own-magazine-alert">
          <span>!</span>
          <div>
            <strong>
              自分の記事がマガジンに追加されています
            </strong>
            <p>
              未確認が{formatNumber(ownPendingCount)}件あります。記事と追加先を開き、確認済みにできます。
            </p>
          </div>
        </div>
      ) : (
        <div className="own-magazine-alert is-clear">
          <span>✓</span>
          <div>
            <strong>自分の記事追加はすべて確認済みです</strong>
            <p>新しい追加を確認すると、ここに最優先で表示します。</p>
          </div>
        </div>
      )}

      <div className="magazine-add-limit">
        <strong>追加した人について</strong>
        <p>
          公開データでは記事の作者・記事・追加先を確認できますが、実際に追加操作をした人までは特定できません。
        </p>
      </div>

      <div className="filter-pills">
        {[
          ["own-pending", "自分の記事・未確認"],
          ["own", "自分の記事"],
          ["others", "共同マガジン"],
          ["all", "すべて"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={filter === id ? "active" : ""}
            onClick={() => {
              setFilter(id as typeof filter);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="archive-search-tools">
        <SearchInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="クリエイターID・記事名・マガジン名で検索"
        />
        <label>
          <span>開始日</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          <span>終了日</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
          />
        </label>
        {query || fromDate || toDate || dateMode !== "all" ? (
          <button
            className="clear-filter-button"
            onClick={() => {
              setQuery("");
              setFromDate("");
              setToDate("");
              setDateMode("all");
              setSelectedDay("");
              setSelectedMonth("");
              setPage(1);
            }}
          >
            条件をクリア
          </button>
        ) : null}
      </div>
      <DateScopeControls
        mode={dateMode}
        day={selectedDay}
        month={selectedMonth}
        onChange={(next) => {
          setDateMode(next.mode);
          if (next.day !== undefined) setSelectedDay(next.day);
          if (next.month !== undefined) setSelectedMonth(next.month);
          setPage(1);
        }}
      />

      {filtered.length ? (
        <>
          <div className="magazine-add-table">
            <div className="magazine-add-head">
              <span>記事の作者</span>
              <span>追加された記事</span>
              <span>追加先マガジン</span>
              <span>追加した人</span>
              <span>確認した日時</span>
              <span>確認</span>
            </div>
            {pageItems.map((event) => {
              const own = isOwnMagazineArticleEvent(event, creator);
              const isCompleted = completedMagazineAdditions.has(
                event.eventKey,
              );
              const isSaving = savingCompletionKeys.has(
                `magazine_addition:${event.eventKey}`,
              );
              const actor: Person = {
                id: event.actorId ?? event.eventKey,
                urlname: event.actorUrlname,
                nickname:
                  event.actorNickname ??
                  (own ? creator.nickname : "noteクリエイター"),
                profileImageUrl:
                  event.actorImageUrl ?? (own ? creator.profileImageUrl : null),
                followerCount: null,
                profileUrl: event.actorUrlname
                  ? `https://note.com/${event.actorUrlname}`
                  : own
                    ? creator.profileUrl
                    : null,
              };
              const magazineTitle =
                typeof event.metadata?.magazineTitle === "string"
                  ? event.metadata.magazineTitle
                  : "マガジン";
              const magazineUrl =
                typeof event.metadata?.magazineUrl === "string"
                  ? event.metadata.magazineUrl
                  : null;
              const magazineKey =
                typeof event.metadata?.magazineKey === "string"
                  ? event.metadata.magazineKey
                  : "";
              const magazineOwner = magazinesByKey.get(magazineKey)?.owner;
              const ownerNickname =
                magazineOwner?.nickname ??
                (typeof event.metadata?.magazineOwnerNickname === "string"
                  ? event.metadata.magazineOwnerNickname
                  : null);
              const ownerUrlname =
                magazineOwner?.urlname ??
                (typeof event.metadata?.magazineOwnerUrlname === "string"
                  ? event.metadata.magazineOwnerUrlname
                  : null);
              const addedByNickname =
                typeof event.metadata?.addedByNickname === "string"
                  ? event.metadata.addedByNickname
                  : null;
              const addedByUrlname =
                typeof event.metadata?.addedByUrlname === "string"
                  ? event.metadata.addedByUrlname
                  : null;
              return (
                <article
                  className={`magazine-add-row ${
                    isCompleted ? "magazine-add-completed" : ""
                  }`}
                  key={event.eventKey}
                >
                  <div className="person-cell">
                    <Avatar person={actor} />
                    <span>
                      {actor.profileUrl ? (
                        <a
                          href={actor.profileUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {actor.nickname}
                        </a>
                      ) : (
                        <strong>{actor.nickname}</strong>
                      )}
                      <small>
                        {own
                          ? "自分の記事"
                          : actor.urlname
                            ? `@${actor.urlname}`
                            : "記事の作者"}
                      </small>
                    </span>
                  </div>
                  <div className="magazine-added-article">
                    {event.subjectUrl ? (
                      <a
                        href={event.subjectUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {event.subjectTitle ?? "記事を開く"} ↗
                      </a>
                    ) : (
                      <strong>{event.subjectTitle ?? "記事"}</strong>
                    )}
                    {own ? <span>自分の記事</span> : null}
                  </div>
                  <div className="magazine-destination">
                    {magazineUrl ? (
                      <a href={magazineUrl} target="_blank" rel="noreferrer">
                        {magazineTitle} ↗
                      </a>
                    ) : (
                      <strong>{magazineTitle}</strong>
                    )}
                    {ownerNickname ? (
                      ownerUrlname ? (
                        <a
                          className="magazine-owner-inline"
                          href={`https://note.com/${ownerUrlname}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          運営：{ownerNickname} ↗
                        </a>
                      ) : (
                        <small>運営：{ownerNickname}</small>
                      )
                    ) : (
                      <small>運営者は取得できませんでした</small>
                    )}
                  </div>
                  <div className="magazine-adder-status">
                    {addedByNickname ? (
                      addedByUrlname ? (
                        <a
                          href={`https://note.com/${addedByUrlname}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {addedByNickname} ↗
                        </a>
                      ) : (
                        <strong>{addedByNickname}</strong>
                      )
                    ) : (
                      <>
                        <strong>特定不可</strong>
                        <small>note公開情報に操作した人なし</small>
                      </>
                    )}
                  </div>
                  <div className="magazine-add-time">
                    <time>{formatDate(event.occurredAt, true)}</time>
                    <small>
                      保存{" "}
                      {formatDate(
                        new Date(event.observedAt).toISOString(),
                        true,
                      )}
                    </small>
                  </div>
                  <div className="magazine-add-action">
                    {own ? (
                      <button
                        type="button"
                        onClick={() => onToggleCompleted(event.eventKey)}
                        disabled={isSaving}
                        aria-pressed={isCompleted}
                      >
                        {isSaving
                          ? "保存中…"
                          : isCompleted
                            ? "✓ 確認済み"
                            : "確認済みにする"}
                      </button>
                    ) : (
                      <span>共同履歴</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination
            page={magazineAddPage.page}
            total={filtered.length}
            pageSize={pageSize}
            onPage={setPage}
          />
        </>
      ) : (
        <div className="empty-card">
          {additions.length
            ? "条件に一致するマガジン追加履歴はありません。"
            : "マガジンの記事追加を確認すると、ここに履歴が残ります。"}
        </div>
      )}
    </section>
  );
}

type ArchiveFilter =
  | "all"
  | "like"
  | "conversation"
  | "social"
  | "magazine"
  | "private"
  | "article_mentioned"
  | "purchase"
  | "tip";

type ArchiveTimelineItem = {
  key: string;
  category: Exclude<ArchiveFilter, "all" | "private"> | "other";
  label: string;
  actorName: string | null;
  actorUrlname: string | null;
  actorImageUrl: string | null;
  message: string;
  subjectTitle: string | null;
  subjectUrl: string | null;
  amountYen: number | null;
  occurredAt: string | null;
  storedAt: number;
  rawText: string | null;
  isPrivate: boolean;
};

const privateNotificationLabels: Record<PrivateNotificationKind, string> = {
  article_mentioned: "記事が話題",
  purchase: "購入",
  tip: "チップ",
  other: "本人通知",
};

function archiveCategory(event: ActivityEvent): ArchiveTimelineItem["category"] {
  if (event.eventType === "like") return "like";
  if (event.eventType === "comment" || event.eventType === "reply") {
    return "conversation";
  }
  if (
    event.eventType.startsWith("follower_") ||
    event.eventType.startsWith("following_")
  ) {
    return "social";
  }
  return "magazine";
}

function ArchiveView({
  events,
  privateNotifications,
  archiveNote,
  onMagazineAdds,
  onAddPrivate,
  onImportPrivate,
}: {
  events: ActivityEvent[];
  privateNotifications: PrivateNotification[];
  archiveNote: string;
  onMagazineAdds: () => void;
  onAddPrivate: (input: PrivateNotificationFormInput) => Promise<void>;
  onImportPrivate: (rawText: string) => Promise<number>;
}) {
  const [filter, setFilter] = useState<ArchiveFilter>("all");
  const [query, setQuery] = useState("");
  const [dateMode, setDateMode] = useState<DateScopeMode>("all");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [savingPrivate, setSavingPrivate] = useState(false);
  const [importText, setImportText] = useState("");
  const [privateMessage, setPrivateMessage] = useState("");
  const [privateForm, setPrivateForm] = useState<PrivateNotificationFormInput>({
    kind: "article_mentioned",
    title: "あなたの記事が話題です",
    actorName: "",
    articleTitle: "",
    articleUrl: "",
    amountYen: "",
    occurredAt: dateKey(new Date().toISOString()),
  });
  const pageSize = 20;

  const timeline = useMemo<ArchiveTimelineItem[]>(() => {
    const publicItems = events
      .filter((event) => event.eventType !== "magazine_article_added")
      .map((event) => ({
        key: `public:${event.eventKey}`,
        category: archiveCategory(event),
        label: activityLabels[event.eventType],
        actorName:
          event.metadata?.isCreator === true
            ? "あなた"
            : event.actorNickname,
        actorUrlname: event.actorUrlname,
        actorImageUrl: event.actorImageUrl,
        message: event.message ?? activityLabels[event.eventType],
        subjectTitle: event.subjectTitle,
        subjectUrl: event.subjectUrl,
        amountYen: null,
        occurredAt: event.occurredAt,
        storedAt: event.observedAt,
        rawText: null,
        isPrivate: false,
      }));
    const privateItems: ArchiveTimelineItem[] = privateNotifications.map(
      (event) => ({
        key: `private:${event.id}`,
        category: event.kind,
        label: privateNotificationLabels[event.kind],
        actorName: event.actorName,
        actorUrlname: event.actorUrlname,
        actorImageUrl: null,
        message: event.title,
        subjectTitle: event.articleTitle,
        subjectUrl: event.articleUrl,
        amountYen: event.amountYen,
        occurredAt: event.occurredAt,
        storedAt: event.createdAt,
        rawText: event.rawText,
        isPrivate: true,
      }),
    );
    return [...publicItems, ...privateItems].sort((a, b) => {
      const aTime = a.occurredAt
        ? new Date(a.occurredAt).getTime()
        : a.storedAt;
      const bTime = b.occurredAt
        ? new Date(b.occurredAt).getTime()
        : b.storedAt;
      return (Number.isFinite(bTime) ? bTime : b.storedAt) -
        (Number.isFinite(aTime) ? aTime : a.storedAt);
    });
  }, [events, privateNotifications]);

  const filtered = timeline.filter((item) => {
    const typeMatches =
      filter === "all" ||
      (filter === "private" && item.isPrivate) ||
      item.category === filter;
    if (!typeMatches) return false;
    const needle = query.trim().toLowerCase();
    if (
      needle &&
      ![
        item.actorName,
        item.actorUrlname,
        item.subjectTitle,
        item.message,
        item.rawText,
      ].some((value) => value?.toLowerCase().includes(needle))
    ) {
      return false;
    }
    const itemDate = dateKey(item.occurredAt, item.storedAt);
    if (
      !matchesDateScope(
        item.occurredAt,
        item.storedAt,
        dateMode,
        selectedDay,
        selectedMonth,
      )
    ) {
      return false;
    }
    if (fromDate && itemDate < fromDate) return false;
    if (toDate && itemDate > toDate) return false;
    return true;
  });
  const archivePage = pageSlice(filtered, page, pageSize);
  const pageItems = archivePage.items;

  async function savePrivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingPrivate) return;
    setSavingPrivate(true);
    setPrivateMessage("");
    try {
      await onAddPrivate(privateForm);
      setPrivateMessage("本人通知を履歴へ保存しました。");
      setPrivateForm((current) => ({
        ...current,
        title:
          current.kind === "article_mentioned"
            ? "あなたの記事が話題です"
            : "",
        actorName: "",
        articleTitle: "",
        articleUrl: "",
        amountYen: "",
      }));
    } catch (caught) {
      setPrivateMessage(
        caught instanceof Error ? caught.message : "通知を保存できませんでした。",
      );
    } finally {
      setSavingPrivate(false);
    }
  }

  async function importPrivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importText.trim() || savingPrivate) return;
    setSavingPrivate(true);
    setPrivateMessage("");
    try {
      const count = await onImportPrivate(importText);
      setImportText("");
      setPrivateMessage(`${formatNumber(count)}件の通知文を履歴へ取り込みました。`);
    } catch (caught) {
      setPrivateMessage(
        caught instanceof Error ? caught.message : "通知文を取り込めませんでした。",
      );
    } finally {
      setSavingPrivate(false);
    }
  }

  return (
    <section className="panel list-panel archive-panel">
      <div className="section-title-row">
        <div>
          <p className="panel-kicker">PERMANENT NOTIFICATION HISTORY</p>
          <h2>通知アーカイブ</h2>
          <p>公開反応と本人だけに届く通知を、同じ履歴から検索できます。</p>
        </div>
        <span className="count-badge">{formatNumber(timeline.length)}件保存</span>
      </div>

      <div className="archive-source-grid">
        <article>
          <span>AUTO</span>
          <strong>公開反応は差分更新で保存</strong>
          <p>{archiveNote}</p>
        </article>
        <article>
          <span>IMPORT</span>
          <strong>本人通知は貼り付けて保存</strong>
          <p>
            noteには外部向けの公式APIがないため、チップ・購入・「あなたの記事が話題です」は
            note通知や通知メールの文面を取り込んで残します。
          </p>
        </article>
      </div>

      <div className="private-notification-note enabled">
        <div>
          <strong>本人通知の消えない履歴</strong>
          <span>{formatNumber(privateNotifications.length)}件保存済み</span>
        </div>
        <p>
          noteのパスワードやCookieは使用しません。現時点では完全自動連携ではありませんが、
          ここへ保存した履歴はnote側の通知一覧から消えても残ります。
        </p>
        <form className="private-notification-form" onSubmit={savePrivate}>
          <label>
            <span>種類</span>
            <select
              value={privateForm.kind}
              onChange={(event) => {
                const kind = event.target.value as PrivateNotificationKind;
                setPrivateForm((current) => ({
                  ...current,
                  kind,
                  title:
                    kind === "article_mentioned"
                      ? "あなたの記事が話題です"
                      : kind === "tip"
                        ? "チップを受け取りました"
                        : kind === "purchase"
                          ? "記事・マガジンが購入されました"
                          : "",
                }));
              }}
            >
              <option value="article_mentioned">あなたの記事が話題です</option>
              <option value="purchase">記事・マガジンの購入</option>
              <option value="tip">チップ</option>
              <option value="other">その他</option>
            </select>
          </label>
          <label>
            <span>通知日</span>
            <input
              type="date"
              value={privateForm.occurredAt}
              onChange={(event) =>
                setPrivateForm((current) => ({
                  ...current,
                  occurredAt: event.target.value,
                }))
              }
              required
            />
          </label>
          <label className="private-wide-field">
            <span>通知内容</span>
            <input
              value={privateForm.title}
              onChange={(event) =>
                setPrivateForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="例：○○さんが記事を購入しました"
              required
            />
          </label>
          <label>
            <span>相手の名前</span>
            <input
              value={privateForm.actorName}
              onChange={(event) =>
                setPrivateForm((current) => ({
                  ...current,
                  actorName: event.target.value,
                }))
              }
              placeholder="分かる場合だけ"
            />
          </label>
          <label>
            <span>金額（円）</span>
            <input
              type="number"
              min="0"
              value={privateForm.amountYen}
              onChange={(event) =>
                setPrivateForm((current) => ({
                  ...current,
                  amountYen: event.target.value,
                }))
              }
              placeholder="500"
            />
          </label>
          <label>
            <span>記事名</span>
            <input
              value={privateForm.articleTitle}
              onChange={(event) =>
                setPrivateForm((current) => ({
                  ...current,
                  articleTitle: event.target.value,
                }))
              }
              placeholder="対象の記事"
            />
          </label>
          <label className="private-wide-field">
            <span>noteの記事URL</span>
            <input
              type="url"
              value={privateForm.articleUrl}
              onChange={(event) =>
                setPrivateForm((current) => ({
                  ...current,
                  articleUrl: event.target.value,
                }))
              }
              placeholder="https://note.com/..."
            />
          </label>
          <button className="primary-button" disabled={savingPrivate}>
            {savingPrivate ? "保存中…" : "通知履歴へ保存"}
          </button>
        </form>
        <details className="private-import-box">
          <summary>note通知・通知メールをまとめて取り込む</summary>
          <form onSubmit={importPrivate}>
            <p>
              通知文をそのまま貼り付けます。複数件は空行で区切ると、話題・購入・チップを自動判定します。
            </p>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder={"2026/08/02\nあなたの記事が話題です\n記事：○○\nhttps://note.com/...\n\n2026/08/02\n○○さんが500円のチップを送りました"}
              rows={8}
            />
            <button className="outline-button" disabled={savingPrivate || !importText.trim()}>
              文面を取り込んで保存
            </button>
          </form>
        </details>
        {privateMessage ? <p className="private-save-message">{privateMessage}</p> : null}
      </div>

      <div className="archive-routing-note">
        <span>
          <strong>記事のマガジン追加は専用履歴にも整理</strong>
          自分の記事と共同マガジン内の記事を分けて確認できます。
        </span>
        <button className="outline-button" onClick={onMagazineAdds}>
          マガジン追加を開く
        </button>
      </div>

      <div className="filter-pills archive-filter-pills">
        {[
          ["all", "すべて"],
          ["private", "本人通知"],
          ["article_mentioned", "記事が話題"],
          ["purchase", "購入"],
          ["tip", "チップ"],
          ["like", "スキ"],
          ["conversation", "コメント・返信"],
          ["social", "フォロー"],
          ["magazine", "マガジン"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={filter === id ? "active" : ""}
            onClick={() => {
              setFilter(id as ArchiveFilter);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="archive-search-tools">
        <SearchInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="名前・ID・記事名・通知文で検索"
        />
        <label>
          <span>開始日</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          <span>終了日</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
          />
        </label>
        {query || fromDate || toDate || dateMode !== "all" ? (
          <button
            className="clear-filter-button"
            onClick={() => {
              setQuery("");
              setFromDate("");
              setToDate("");
              setDateMode("all");
              setSelectedDay("");
              setSelectedMonth("");
              setPage(1);
            }}
          >
            条件をクリア
          </button>
        ) : null}
      </div>
      <DateScopeControls
        mode={dateMode}
        day={selectedDay}
        month={selectedMonth}
        onChange={(next) => {
          setDateMode(next.mode);
          if (next.day !== undefined) setSelectedDay(next.day);
          if (next.month !== undefined) setSelectedMonth(next.month);
          setPage(1);
        }}
      />
      {filtered.length ? (
        <>
          <div className="activity-list">
            {pageItems.map((item) => {
              const actor: Person | null = item.actorName
                ? {
                    id: item.key,
                    urlname: item.actorUrlname,
                    nickname: item.actorName,
                    profileImageUrl: item.actorImageUrl,
                    followerCount: null,
                    profileUrl: item.actorUrlname
                      ? `https://note.com/${item.actorUrlname}`
                      : null,
                  }
                : null;
              return (
                <article
                  className={`activity-row ${item.isPrivate ? "activity-private" : ""}`}
                  key={item.key}
                >
                  <span className="activity-kind">{item.label}</span>
                  {actor ? (
                    <Avatar person={actor} />
                  ) : (
                    <span className="activity-system">
                      {item.isPrivate ? "N" : "M"}
                    </span>
                  )}
                  <div className="activity-copy">
                    <strong>{actor?.nickname ?? (item.isPrivate ? "note本人通知" : "更新")}</strong>
                    <p>{item.message}</p>
                    {item.amountYen != null ? (
                      <b className="notification-amount">¥{formatNumber(item.amountYen)}</b>
                    ) : null}
                    {item.subjectUrl ? (
                      <a href={item.subjectUrl} target="_blank" rel="noreferrer">
                        {item.subjectTitle ?? "noteで開く"} ↗
                      </a>
                    ) : item.subjectTitle ? (
                      <small>{item.subjectTitle}</small>
                    ) : null}
                    {item.rawText ? (
                      <details className="private-raw-text">
                        <summary>取り込んだ原文</summary>
                        <pre>{item.rawText}</pre>
                      </details>
                    ) : null}
                  </div>
                  <div className="activity-time">
                    <time>{formatDate(item.occurredAt, true)}</time>
                    <small>
                      {item.isPrivate ? "保存" : "確認"}{" "}
                      {formatDate(new Date(item.storedAt).toISOString(), true)}
                    </small>
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination
            page={archivePage.page}
            total={filtered.length}
            pageSize={pageSize}
            onPage={setPage}
          />
        </>
      ) : (
        <div className="empty-card">この条件の保存済み通知はまだありません。</div>
      )}
    </section>
  );
}

function MagazineMemberList({ magazine }: { magazine: Magazine }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const needle = query.trim().toLowerCase();
  const filtered = magazine.members.filter(
    (member) =>
      !needle ||
      member.nickname.toLowerCase().includes(needle) ||
      (member.urlname ?? "").toLowerCase().includes(needle),
  );
  const memberPage = pageSlice(filtered, page, pageSize);
  const pageItems = memberPage.items;

  return (
    <details className="member-list" open={magazine.members.length <= 6}>
      <summary>
        参加者一覧
        <span>
          {magazine.participantsComplete
            ? `全${magazine.members.length}人確認`
            : magazine.participantsAvailable
              ? `${magazine.members.length}人確認（公開範囲）`
              : "詳細取得不可"}
        </span>
      </summary>
      {magazine.members.length ? (
        <>
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="参加者ID・名前で検索"
          />
          <div>
            {pageItems.map((member) => (
              <a
                href={member.profileUrl ?? undefined}
                target={member.profileUrl ? "_blank" : undefined}
                rel="noreferrer"
                key={member.id}
              >
                <Avatar person={member} size="small" />
                <span>
                  <strong>{member.nickname}</strong>
                  <small>
                    {member.role === "owner" ? "オーナー" : "運営メンバー"}
                    {member.urlname ? `・@${member.urlname}` : ""}
                  </small>
                </span>
              </a>
            ))}
          </div>
          <Pagination
            page={memberPage.page}
            total={filtered.length}
            pageSize={pageSize}
            onPage={setPage}
          />
        </>
      ) : (
        <p>noteの公開データから参加者一覧を確認できませんでした。</p>
      )}
    </details>
  );
}

function MagazineArticleList({ magazine }: { magazine: Magazine }) {
  const [query, setQuery] = useState("");
  const [dateMode, setDateMode] = useState<DateScopeMode>("all");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const needle = query.trim().toLowerCase();
  const filtered = magazine.recentArticles.filter(
    (article) =>
      (!needle ||
        article.title.toLowerCase().includes(needle) ||
        article.author.nickname.toLowerCase().includes(needle) ||
        (article.author.urlname ?? "").toLowerCase().includes(needle)) &&
      matchesDateScope(
        article.publishAt,
        undefined,
        dateMode,
        selectedDay,
        selectedMonth,
      ),
  );
  const articlePage = pageSlice(filtered, page, pageSize);
  const pageItems = articlePage.items;
  return (
    <details className="magazine-article-list">
      <summary>
        他の人が追加した記事
        <span>
          {magazine.recentArticlesAvailable
            ? `最新${magazine.recentArticles.length}件`
            : "取得不可"}
        </span>
      </summary>
      {magazine.recentArticles.length ? (
        <div className="magazine-article-tools">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="記事名・作者名・IDで検索"
          />
          <DateScopeControls
            mode={dateMode}
            day={selectedDay}
            month={selectedMonth}
            onChange={(next) => {
              setDateMode(next.mode);
              if (next.day !== undefined) setSelectedDay(next.day);
              if (next.month !== undefined) setSelectedMonth(next.month);
              setPage(1);
            }}
          />
        </div>
      ) : null}
      {pageItems.length ? (
        <>
          <div>
            {pageItems.map((article) => (
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                key={article.key}
              >
                <Avatar person={article.author} size="small" />
                <span>
                  <strong>{article.title}</strong>
                  <small>
                    {article.author.nickname}
                    {article.author.urlname
                      ? `（@${article.author.urlname}）`
                      : ""}
                    {article.publishAt
                      ? `・${formatDate(article.publishAt)}`
                      : ""}
                  </small>
                </span>
                <b>記事 ↗</b>
              </a>
            ))}
          </div>
          <Pagination
            page={articlePage.page}
            total={filtered.length}
            pageSize={pageSize}
            onPage={setPage}
          />
          <p>
            初回は基準保存だけを行い、次回から新しく見つかった記事を「通知保存」に残します。
          </p>
        </>
      ) : (
        <p>
          {magazine.recentArticlesAvailable
            ? "公開記事はまだありません。"
            : "noteの公開データから記事一覧を確認できませんでした。"}
        </p>
      )}
    </details>
  );
}

function MagazineFollowerHistory({ magazine }: { magazine: Magazine }) {
  const points = magazine.followerHistory ?? [];
  return (
    <details className="magazine-follower-history">
      <summary>
        フォロワー数の推移
        <span>{points.length ? `${points.length}回保存` : "基準作成中"}</span>
      </summary>
      {points.length ? (
        <div className="magazine-history-points">
          {points.slice(-12).map((point, index, visiblePoints) => {
            const previous = visiblePoints[index - 1];
            const delta = previous ? point.count - previous.count : null;
            return (
              <span key={`${point.recordedAt}-${index}`}>
                <small>{formatDate(point.recordedAt, true)}</small>
                <strong>{formatNumber(point.count)}人</strong>
                {delta ? (
                  <em className={delta < 0 ? "negative-delta" : ""}>
                    {delta > 0 ? "+" : ""}
                    {formatNumber(delta)}
                  </em>
                ) : null}
              </span>
            );
          })}
        </div>
      ) : (
        <p>今回の人数を基準として保存します。</p>
      )}
      <p className="magazine-follower-limit">
        フォローした人・外した人の氏名はnoteのログイン専用情報です。公開版では人数差分までを正確に保存します。
      </p>
    </details>
  );
}

function MagazinesView({
  magazines,
  onAdd,
  refreshing,
  refreshedAt,
  onRefresh,
}: {
  magazines: Magazine[];
  onAdd: (input: string) => Promise<void>;
  refreshing: boolean;
  refreshedAt: string | null;
  onRefresh: () => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim()) return;
    setAdding(true);
    setMessage("");
    try {
      await onAdd(input);
      setInput("");
      setMessage("追跡するマガジンに追加しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "追加できませんでした。");
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="panel list-panel magazine-panel">
      <div className="section-title-row">
        <div>
          <p className="panel-kicker">MAGAZINE PARTICIPATION WATCH</p>
          <h2>マガジン・共同マガジン</h2>
          <p>
            分析したクリエイターの公開マガジン一覧と、手動追加した他者・共同マガジンの変化を残します。
          </p>
        </div>
        <div className="magazine-refresh-actions">
          <span className="count-badge">{formatNumber(magazines.length)}誌</span>
          <button
            className="outline-button"
            onClick={() => void onRefresh()}
            disabled={refreshing}
          >
            {refreshing ? <span className="spinner" /> : null}
            マガジン更新
          </button>
          {refreshedAt ? (
            <small>確認 {formatDate(refreshedAt, true)}</small>
          ) : null}
        </div>
      </div>

      <form className="magazine-add-form" onSubmit={submit}>
        <label htmlFor="magazine-input">追跡したいnoteマガジンを追加</label>
        <div>
          <input
            id="magazine-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="https://note.com/…/m/m…"
          />
          <button className="primary-button" disabled={adding}>
            {adding ? <span className="spinner" /> : null}
            追加して確認
          </button>
        </div>
        {message ? <p>{message}</p> : null}
      </form>

      <div className="follow-limit-note">
        <strong>通常通知のように保存</strong>
        <span>
          参加者・フォロワー数・プロフィール掲載の変化は「通知保存」に残します。
          記事の追加は「マガジン追加」で、自分の記事と共同マガジン内の記事を分けて確認できます。
        </span>
      </div>

      {magazines.length ? (
        <div className="magazine-grid">
          {magazines.map((magazine) => (
            <article className="magazine-card" key={magazine.key}>
              <header>
                <div>
                  <div className="magazine-badges">
                    <span className={`relation-${magazine.relation}`}>
                      {magazine.relation === "owner"
                        ? "自分が運営"
                        : magazine.relation === "participant"
                          ? "参加中"
                          : "追加追跡"}
                    </span>
                    {magazine.isCollaborative ? <span>共同運営</span> : null}
                    {magazine.inProfile ? <span>プロフィール掲載</span> : null}
                    {magazine.trackedManually ? <span>手動追跡</span> : null}
                    {magazine.isNewOnProfile ? (
                      <span className="new-member">新規マガジン</span>
                    ) : null}
                    {magazine.newMemberCount > 0 ? (
                      <span className="new-member">新規参加 +{magazine.newMemberCount}</span>
                    ) : null}
                    {magazine.newArticleCount > 0 ? (
                      <span className="new-member">記事追加 +{magazine.newArticleCount}</span>
                    ) : null}
                  </div>
                  <a href={magazine.url} target="_blank" rel="noreferrer">
                    {magazine.title} ↗
                  </a>
                </div>
              </header>
              {magazine.description ? <p>{magazine.description}</p> : null}
              {magazine.owner ? (
                <a
                  className="magazine-owner"
                  href={magazine.owner.profileUrl ?? undefined}
                  target={magazine.owner.profileUrl ? "_blank" : undefined}
                  rel="noreferrer"
                >
                  運営：{magazine.owner.nickname}
                  {magazine.owner.urlname ? `（@${magazine.owner.urlname}）` : ""}
                </a>
              ) : null}
              <div className="magazine-stats">
                <span>
                  <small>フォロワー</small>
                  <strong>
                    {magazine.followerCount == null
                      ? "―"
                      : formatNumber(magazine.followerCount)}
                  </strong>
                  {magazine.followerDelta ? (
                    <em className={magazine.followerDelta < 0 ? "negative-delta" : ""}>
                      {magazine.followerDelta > 0 ? "+" : ""}
                      {formatNumber(magazine.followerDelta)}
                    </em>
                  ) : null}
                </span>
                <span>
                  <small>参加者</small>
                  <strong>{formatNumber(magazine.memberCount)}</strong>
                </span>
                <span>
                  <small>記事</small>
                  <strong>{formatNumber(magazine.noteCount)}</strong>
                </span>
              </div>
              <MagazineFollowerHistory magazine={magazine} />
              <MagazineArticleList magazine={magazine} />
              <MagazineMemberList magazine={magazine} />
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-card">
          {refreshing
            ? "マガジンを別処理で更新しています。記事分析は待たずに利用できます。"
            : "プロフィール上の公開マガジンは見つかりませんでした。上の欄から共同マガジンを追加できます。"}
        </div>
      )}
    </section>
  );
}

const runModeLabels: Record<AnalyticsRunRecord["mode"], string> = {
  initial: "初回全件",
  incremental: "差分更新",
  full: "全件再取得",
  cached: "保存データ",
};

const runStatusLabels: Record<AnalyticsRunRecord["status"], string> = {
  running: "実行中",
  complete: "完了",
  partial: "一部未更新",
  cached: "保存表示",
};

function AnalysisView({
  data,
  ranking,
  threads,
  completedThreads,
  completedLikes,
  potentialPendingEnabled,
  scanning,
}: {
  data: DashboardData;
  ranking: RankingEntry[];
  threads: CommentThread[];
  completedThreads: Set<string>;
  completedLikes: Set<string>;
  potentialPendingEnabled: boolean;
  scanning: boolean;
}) {
  const [runDateMode, setRunDateMode] = useState<DateScopeMode>("all");
  const [runDay, setRunDay] = useState("");
  const [runMonth, setRunMonth] = useState("");
  const [runPage, setRunPage] = useState(1);
  const runPageSize = 20;
  const pendingThreads = threads.filter(
    (thread) =>
      !completedThreads.has(thread.rootKey) &&
      (thread.status === "unreplied" ||
        thread.status === "followup_pending" ||
        (potentialPendingEnabled && thread.status === "unknown")),
  );
  const unresolvedLikes = data.likerEvents.filter(
    (event) => !completedLikes.has(likeCompletionKey(event)),
  ).length;
  const identifiedRate = data.metrics.totalLikes
    ? (data.likerEvents.length / data.metrics.totalLikes) * 100
    : 0;
  const responseRate = threads.length
    ? ((threads.length - pendingThreads.length) / threads.length) * 100
    : 100;
  const averageLikes = data.metrics.publicArticles
    ? data.metrics.totalLikes / data.metrics.publicArticles
    : 0;
  const cacheCoverage = data.metrics.publicArticles
    ? (data.cacheSummary.cachedArticles / data.metrics.publicArticles) * 100
    : 0;
  const refreshedTimestamp = new Date(data.refreshedAt).getTime();
  const now = Number.isFinite(refreshedTimestamp) ? refreshedTimestamp : 0;
  const recentActivities = data.activityEvents.filter((event) => {
    const value = event.occurredAt
      ? new Date(event.occurredAt).getTime()
      : event.observedAt;
    return Number.isFinite(value) && value >= now - 7 * 24 * 60 * 60 * 1_000;
  });
  const previousActivities = data.activityEvents.filter((event) => {
    const value = event.occurredAt
      ? new Date(event.occurredAt).getTime()
      : event.observedAt;
    return (
      Number.isFinite(value) &&
      value < now - 7 * 24 * 60 * 60 * 1_000 &&
      value >= now - 14 * 24 * 60 * 60 * 1_000
    );
  });
  const activityDelta = recentActivities.length - previousActivities.length;
  const topArticle = [...data.articles].sort(
    (left, right) =>
      right.likeCount - left.likeCount ||
      right.commentCount - left.commentCount,
  )[0];
  const topSupporter = ranking[0];
  const firstFollower = data.followerHistory[0]?.count;
  const latestFollower = data.followerHistory.at(-1)?.count;
  const followerRecordedDelta =
    firstFollower == null || latestFollower == null
      ? 0
      : latestFollower - firstFollower;
  const activityKinds = new Map<string, number>();
  for (const event of data.activityEvents) {
    activityKinds.set(
      event.eventType,
      (activityKinds.get(event.eventType) ?? 0) + 1,
    );
  }
  const activityBreakdown = [...activityKinds.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8);
  const filteredRuns = data.runHistory.filter((run) =>
    matchesDateScope(
      run.startedAt,
      undefined,
      runDateMode,
      runDay,
      runMonth,
    ),
  );
  const visibleRunPage = pageSlice(filteredRuns, runPage, runPageSize);
  const insights = [
    pendingThreads.length
      ? `返信確認が必要な会話が${formatNumber(pendingThreads.length)}件あります。コメント画面から記事へ直接移動できます。`
      : "返信確認が必要な会話は、現在すべて整理されています。",
    unresolvedLikes
      ? `確認できたスキのうち${formatNumber(unresolvedLikes)}件が未対応です。スキ一覧でまとめて確認できます。`
      : "確認できたスキは、すべて対応済みです。",
    topArticle
      ? `表示スキが最も多い記事は「${topArticle.title}」（${formatNumber(topArticle.likeCount)}件）です。`
      : "記事データが増えると、上位記事の傾向を表示します。",
    activityDelta === 0
      ? "直近7日間の記録数は、その前の7日間と同じです。"
      : `直近7日間の記録は、その前の7日間より${formatNumber(Math.abs(activityDelta))}件${activityDelta > 0 ? "増えています" : "減っています"}。`,
  ];

  return (
    <section className="analysis-view">
      <div className="section-title-row">
        <div>
          <p className="panel-kicker">DETAILED RECORDS & INSIGHTS</p>
          <h2>ダッシュボードの詳細分析</h2>
          <p>
            記事・スキ・コメント・通知・更新処理を横断し、変化と対応状況を記録します。
          </p>
        </div>
        <span className={`analysis-live-badge ${scanning ? "is-scanning" : ""}`}>
          {scanning ? "集計中・暫定値" : "最新集計"}
        </span>
      </div>

      <div className="analysis-kpi-grid">
        <article>
          <span>1記事あたり表示スキ</span>
          <strong>{averageLikes.toFixed(1)}</strong>
          <small>全{formatNumber(data.metrics.publicArticles)}記事</small>
        </article>
        <article>
          <span>人物を確認できた割合</span>
          <strong>{identifiedRate.toFixed(1)}%</strong>
          <small>
            {formatNumber(data.likerEvents.length)} /{" "}
            {formatNumber(data.metrics.totalLikes)}件
          </small>
        </article>
        <article>
          <span>会話の対応完了率</span>
          <strong>{responseRate.toFixed(1)}%</strong>
          <small>未確認 {formatNumber(pendingThreads.length)}件</small>
        </article>
        <article>
          <span>高速表示できる記事</span>
          <strong>{cacheCoverage.toFixed(0)}%</strong>
          <small>
            保存済み {formatNumber(data.cacheSummary.cachedArticles)}記事
          </small>
        </article>
        <article>
          <span>直近7日の通知記録</span>
          <strong>{formatNumber(recentActivities.length)}</strong>
          <small className={activityDelta < 0 ? "negative-delta" : ""}>
            前週比 {activityDelta > 0 ? "+" : ""}
            {formatNumber(activityDelta)}
          </small>
        </article>
        <article>
          <span>記録期間のフォロワー差</span>
          <strong>
            {followerRecordedDelta > 0 ? "+" : ""}
            {formatNumber(followerRecordedDelta)}
          </strong>
          <small>{formatNumber(data.followerHistory.length)}日分を保存</small>
        </article>
      </div>

      <div className="analysis-panels">
        <article className="panel insight-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">AUTOMATIC INSIGHTS</p>
              <h3>いま確認したいこと</h3>
            </div>
          </div>
          <ol>
            {insights.map((insight, index) => (
              <li key={insight}>
                <span>{index + 1}</span>
                <p>{insight}</p>
              </li>
            ))}
          </ol>
        </article>

        <article className="panel performance-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">TOP PERFORMANCE</p>
              <h3>上位の記録</h3>
            </div>
          </div>
          {topArticle ? (
            <a href={topArticle.url} target="_blank" rel="noreferrer">
              <span>表示スキ最多の記事</span>
              <strong>{topArticle.title}</strong>
              <small>
                {formatNumber(topArticle.likeCount)}スキ・
                {formatNumber(topArticle.commentCount)}コメント ↗
              </small>
            </a>
          ) : null}
          {topSupporter ? (
            <a
              href={topSupporter.profileUrl ?? undefined}
              target={topSupporter.profileUrl ? "_blank" : undefined}
              rel="noreferrer"
            >
              <span>最も多くの記事を応援</span>
              <strong>{topSupporter.nickname}</strong>
              <small>{formatNumber(topSupporter.count)}記事 ↗</small>
            </a>
          ) : null}
          <div className="activity-breakdown">
            <span>保存通知の内訳</span>
            {activityBreakdown.length ? (
              activityBreakdown.map(([kind, count]) => (
                <div key={kind}>
                  <small>{activityLabels[kind as ActivityType] ?? kind}</small>
                  <b>{formatNumber(count)}</b>
                </div>
              ))
            ) : (
              <p>更新すると通知の内訳を表示します。</p>
            )}
          </div>
        </article>
      </div>

      <section className="panel run-history-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">ANALYSIS RUN HISTORY</p>
            <h3>更新・分析の実行記録</h3>
            <p>初回、差分更新、全件再取得、保存表示を最大180回残します。</p>
          </div>
          <span className="count-badge">
            {formatNumber(filteredRuns.length)} / {formatNumber(data.runHistory.length)}回
          </span>
        </div>
        {data.runHistory.length ? (
          <>
            <DateScopeControls
              mode={runDateMode}
              day={runDay}
              month={runMonth}
              onChange={(next) => {
                setRunDateMode(next.mode);
                if (next.day !== undefined) setRunDay(next.day);
                if (next.month !== undefined) setRunMonth(next.month);
                setRunPage(1);
              }}
            />
            {filteredRuns.length ? (
              <div className="run-history-table">
                <div className="run-history-head">
                  <span>開始日時</span>
                  <span>種類・状態</span>
                  <span>記事処理</span>
                  <span>スキ・応援者</span>
                  <span>会話・通知</span>
                  <span>所要時間</span>
                </div>
                {visibleRunPage.items.map((run) => (
                  <article key={run.id}>
                    <time>{formatDate(run.startedAt, true)}</time>
                    <span>
                      <b>{runModeLabels[run.mode]}</b>
                      <small className={`run-status status-${run.status}`}>
                        {runStatusLabels[run.status]}
                      </small>
                    </span>
                    <span>
                      <b>
                        {formatNumber(run.cachedArticles + run.processedArticles)} /{" "}
                        {formatNumber(run.totalArticles)}
                      </b>
                      <small>
                        失敗 {formatNumber(run.failedArticles)}・警告{" "}
                        {formatNumber(run.warningCount)}
                      </small>
                    </span>
                    <span>
                      <b>{formatNumber(run.identifiedLikes)}件</b>
                      <small>{formatNumber(run.supporterCount)}人</small>
                    </span>
                    <span>
                      <b>未確認 {formatNumber(run.pendingThreadCount)}</b>
                      <small>通知 {formatNumber(run.activityCount)}件</small>
                    </span>
                    <strong>{formatDuration(run.durationMs)}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-card">指定した日付・月の実行記録はありません。</div>
            )}
            <Pagination
              page={visibleRunPage.page}
              total={filteredRuns.length}
              pageSize={runPageSize}
              onPage={setRunPage}
            />
          </>
        ) : (
          <div className="empty-card">
            次の分析から、ここに詳しい実行履歴を保存します。
          </div>
        )}
      </section>
    </section>
  );
}

function ShareModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : window.location.href.split("#")[0];

  async function copyUrl() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="閉じる">
          ×
        </button>
        <p className="panel-kicker">PASTE INTO NOTE</p>
        <h2 id="share-title">サービスの表紙をnoteに貼る</h2>
        <p>
          下のURLをnote記事の空の行に貼り、改行してください。
          リンクカードから黒い表紙と機能説明を開けます。
          分析画面は会員本人の確認と管理者承認が済んだ人だけが利用できます。
        </p>
        <div className="share-url">
          <input readOnly value={shareUrl} aria-label="共有URL" />
          <button className="primary-button" onClick={copyUrl}>
            {copied ? "コピーしました" : "URLをコピー"}
          </button>
        </div>
        <p className="modal-note">
          noteの仕様上、外部画面を記事本文内で直接操作するiframeではなく、リンクカードから開く形です。
          会員一覧にはnote名だけを表示し、メールアドレスは表示しません。
          URLや共通パスワードが流出しても、未承認の人は分析データへ進めません。
        </p>
      </section>
    </div>
  );
}

async function responseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "データを取得できませんでした。");
  }
  return payload;
}

type BatchPayload = {
  likerEvents: LikerEvent[];
  failedLikeArticleKeys: string[];
  commentResults: CommentArticleResult[];
  warnings: string[];
};

function mergeBatchData(
  current: DashboardData,
  articles: Article[],
  payload: BatchPayload,
) {
  const refreshedArticleKeys = new Set(
    articles.map((article) => article.key),
  );
  const failedLikeArticleKeys = new Set(
    payload.failedLikeArticleKeys ?? [],
  );
  const refreshedLikeArticleKeys = new Set(
    [...refreshedArticleKeys].filter(
      (articleKey) => !failedLikeArticleKeys.has(articleKey),
    ),
  );
  const likerMap = new Map(
    current.likerEvents
      .filter((event) => !refreshedLikeArticleKeys.has(event.articleKey))
      .map((event) => [`${event.articleKey}:${event.user.id}`, event]),
  );
  for (const event of payload.likerEvents) {
    likerMap.set(`${event.articleKey}:${event.user.id}`, event);
  }
  const commentMap = new Map(
    current.commentResults.map((item) => [item.articleKey, item]),
  );
  for (const item of payload.commentResults) {
    if (
      item.fetchStatus === "ok" ||
      item.fetchStatus === "empty" ||
      !commentMap.has(item.articleKey)
    ) {
      commentMap.set(item.articleKey, item);
    }
  }
  return {
    ...current,
    likerEvents: [...likerMap.values()].sort((a, b) =>
      (b.likedAt ?? "").localeCompare(a.likedAt ?? ""),
    ),
    commentResults: [...commentMap.values()],
    warnings: [...new Set([...current.warnings, ...payload.warnings])],
  };
}

export function AnalyticsApp() {
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [memberLoading, setMemberLoading] = useState(true);
  const [adminCreators, setAdminCreators] = useState<
    AdminCreatorHistoryItem[]
  >([]);
  const [adminCreatorLoading, setAdminCreatorLoading] = useState(false);
  const [adminCreatorError, setAdminCreatorError] = useState("");
  const [potentialPendingEnabled, setPotentialPendingEnabled] =
    useState(true);
  const [savingPotentialSetting, setSavingPotentialSetting] =
    useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [phase, setPhase] = useState<"idle" | "manifest" | "scanning" | "complete">("idle");
  const [progress, setProgress] = useState<ScanProgress>({
    processed: 0,
    total: 0,
    failed: 0,
    cached: 0,
  });
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [shareOpen, setShareOpen] = useState(false);
  const [magazineRefreshing, setMagazineRefreshing] = useState(false);
  const [social, setSocial] = useState<SocialData | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState("");
  const [completedThreads, setCompletedThreads] = useState<Set<string>>(
    new Set(),
  );
  const [completedLikes, setCompletedLikes] = useState<Set<string>>(new Set());
  const [completedMagazineAdditions, setCompletedMagazineAdditions] =
    useState<Set<string>>(new Set());
  const [savingCompletionKeys, setSavingCompletionKeys] = useState<Set<string>>(
    new Set(),
  );
  const runId = useRef(0);
  const initialRun = useRef(false);
  const completionMigration = useRef(new Set<string>());
  const scanning = phase === "manifest" || phase === "scanning";

  async function readAdminCreators() {
    const response = await fetch("/api/member/creators", {
      cache: "no-store",
    });
    const payload = await responseJson<{
      creators: AdminCreatorHistoryItem[];
    }>(response);
    setAdminCreators(payload.creators);
    return payload.creators;
  }

  const ranking = useMemo(
    () => buildRanking(data?.likerEvents ?? []),
    [data?.likerEvents],
  );
  const threads = useMemo(
    () => allThreads(data?.commentResults ?? []),
    [data?.commentResults],
  );
  const commentRanking = useMemo(
    () =>
      buildCommentRanking(
        data?.commentResults ?? [],
        potentialPendingEnabled,
      ),
    [data?.commentResults, potentialPendingEnabled],
  );
  const articleCommentRanking = useMemo(
    () => buildArticleCommentRanking(data?.commentResults ?? []),
    [data?.commentResults],
  );

  async function refreshMagazines(
    creatorUrlname: string,
    expectedRun = runId.current,
  ) {
    setMagazineRefreshing(true);
    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refresh_magazines",
          creator: creatorUrlname,
        }),
      });
      const payload = await responseJson<{
        magazines: Magazine[];
        activityEvents: ActivityEvent[];
        refreshedAt: string;
        warnings: string[];
      }>(response);
      if (expectedRun !== runId.current) return;
      setData((current) =>
        current
          ? {
              ...current,
              magazines: payload.magazines,
              magazineRefreshedAt: payload.refreshedAt,
              activityEvents: payload.activityEvents,
              warnings: [
                ...new Set([...current.warnings, ...payload.warnings]),
              ],
            }
          : current,
      );
    } catch (caught) {
      if (expectedRun !== runId.current) return;
      setData((current) =>
        current
          ? {
              ...current,
              warnings: [
                ...new Set([
                  ...current.warnings,
                  caught instanceof Error
                    ? `マガジン更新: ${caught.message}`
                    : "マガジンを更新できませんでした。",
                ]),
              ],
            }
          : current,
      );
    } finally {
      if (expectedRun === runId.current) setMagazineRefreshing(false);
    }
  }

  async function refreshSocial(
    creatorUrlname: string,
    expectedRun = runId.current,
  ) {
    setSocialLoading(true);
    setSocialError("");
    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refresh_social",
          creator: creatorUrlname,
        }),
      });
      const payload = await responseJson<SocialData>(response);
      if (expectedRun !== runId.current) return;
      setSocial(payload);
      setData((current) =>
        current
          ? {
              ...current,
              activityEvents: payload.activityEvents,
              warnings: [
                ...new Set([...current.warnings, ...payload.warnings]),
              ],
            }
          : current,
      );
    } catch (caught) {
      if (expectedRun !== runId.current) return;
      setSocialError(
        caught instanceof Error
          ? caught.message
          : "フォロー一覧を確認できませんでした。",
      );
    } finally {
      if (expectedRun === runId.current) setSocialLoading(false);
    }
  }

  function selectTab(nextTab: Tab) {
    setTab(nextTab);
    if (nextTab === "social" && data && !social && !socialLoading) {
      void refreshSocial(data.creator.urlname);
    }
  }

  async function updatePotentialPending(enabled: boolean) {
    if (savingPotentialSetting) return;
    const previous = potentialPendingEnabled;
    setPotentialPendingEnabled(enabled);
    setSavingPotentialSetting(true);
    try {
      const response = await fetch("/api/member/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ potentialPendingEnabled: enabled }),
      });
      const payload = (await response.json()) as {
        member?: MemberInfo;
        error?: string;
      };
      if (!response.ok || !payload.member) {
        throw new Error(payload.error ?? "設定を保存できませんでした。");
      }
      setMember(payload.member);
      setPotentialPendingEnabled(
        payload.member.potentialPendingEnabled !== false,
      );
    } catch (caught) {
      setPotentialPendingEnabled(previous);
      setError(
        caught instanceof Error
          ? caught.message
          : "設定を保存できませんでした。",
      );
    } finally {
      setSavingPotentialSetting(false);
    }
  }

  async function migrateLegacyCompletions(
    creatorUrlname: string,
    serverCompletions: ManualCompletions,
  ) {
    if (completionMigration.current.has(creatorUrlname)) return;
    completionMigration.current.add(creatorUrlname);
    const storageKey =
      `mumei-note-insight:${creatorUrlname}:completed-threads`;
    let legacyKeys: string[] = [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      legacyKeys = Array.isArray(parsed)
        ? parsed.filter((key): key is string => typeof key === "string")
        : [];
    } catch {
      return;
    }
    const mergedComments = [
      ...new Set([
        ...serverCompletions.commentThreadKeys,
        ...legacyKeys,
      ]),
    ];
    if (
      mergedComments.length === serverCompletions.commentThreadKeys.length
    ) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {}
      return;
    }
    setCompletedThreads(new Set(mergedComments));
    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_manual_completions",
          creator: creatorUrlname,
          commentThreadKeys: mergedComments,
          likeKeys: serverCompletions.likeKeys,
          magazineAdditionKeys: serverCompletions.magazineAdditionKeys,
        }),
      });
      const payload = await responseJson<{
        manualCompletions: ManualCompletions;
      }>(response);
      setCompletedThreads(
        new Set(payload.manualCompletions.commentThreadKeys),
      );
      setCompletedLikes(new Set(payload.manualCompletions.likeKeys));
      setCompletedMagazineAdditions(
        new Set(payload.manualCompletions.magazineAdditionKeys ?? []),
      );
      try {
        window.localStorage.removeItem(storageKey);
      } catch {}
    } catch {
      completionMigration.current.delete(creatorUrlname);
    }
  }

  async function toggleManualCompletion(
    itemType: "comment_thread" | "like" | "magazine_addition",
    itemKey: string,
  ) {
    if (!data) return;
    const savingKey = `${itemType}:${itemKey}`;
    if (savingCompletionKeys.has(savingKey)) return;
    const target =
      itemType === "comment_thread"
        ? completedThreads
        : itemType === "like"
          ? completedLikes
          : completedMagazineAdditions;
    const nextCompleted = !target.has(itemKey);
    const applyOptimistic = (current: Set<string>) => {
      const next = new Set(current);
      if (nextCompleted) next.add(itemKey);
      else next.delete(itemKey);
      return next;
    };
    if (itemType === "comment_thread") {
      setCompletedThreads(applyOptimistic);
    } else if (itemType === "like") {
      setCompletedLikes(applyOptimistic);
    } else {
      setCompletedMagazineAdditions(applyOptimistic);
    }
    setSavingCompletionKeys((current) => new Set(current).add(savingKey));
    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_manual_completion",
          creator: data.creator.urlname,
          itemType,
          itemKey,
          completed: nextCompleted,
        }),
      });
      const payload = await responseJson<{
        manualCompletions: ManualCompletions;
      }>(response);
      setCompletedThreads(
        new Set(payload.manualCompletions.commentThreadKeys),
      );
      setCompletedLikes(new Set(payload.manualCompletions.likeKeys));
      setCompletedMagazineAdditions(
        new Set(payload.manualCompletions.magazineAdditionKeys ?? []),
      );
    } catch (caught) {
      const rollback = (current: Set<string>) => {
        const next = new Set(current);
        if (nextCompleted) next.delete(itemKey);
        else next.add(itemKey);
        return next;
      };
      if (itemType === "comment_thread") {
        setCompletedThreads(rollback);
      } else if (itemType === "like") {
        setCompletedLikes(rollback);
      } else {
        setCompletedMagazineAdditions(rollback);
      }
      setError(
        caught instanceof Error
          ? `対応状態を保存できませんでした。${caught.message}`
          : "対応状態を保存できませんでした。",
      );
    } finally {
      setSavingCompletionKeys((current) => {
        const next = new Set(current);
        next.delete(savingKey);
        return next;
      });
    }
  }

  async function runAnalysis(rawCreator: string, forceFull = false) {
    const creatorInput = rawCreator.trim();
    if (!creatorInput) {
      setError("noteのURLまたはnote IDを入力してください。");
      return;
    }

    const currentRun = ++runId.current;
    const previousData = data;
    let manifestLoaded = Boolean(previousData);
    setPhase("manifest");
    setProgress({ processed: 0, total: 0, failed: 0, cached: 0 });
    setError("");
    if (!previousData) setSocial(null);
    setSocialError("");
    setSocialLoading(false);
    setMagazineRefreshing(false);
    try {
      const manifestResponse = await fetch(
        `/api/analytics?creator=${encodeURIComponent(creatorInput)}${
          forceFull ? "&refresh=full" : ""
        }`,
        { cache: "no-store" },
      );
      const manifest = await responseJson<ManifestData>(manifestResponse);
      if (currentRun !== runId.current) return;
      manifestLoaded = true;
      const initialData: DashboardData = {
        ...manifest,
        warnings: manifest.warnings ?? [],
        privateNotifications: manifest.privateNotifications ?? [],
        likerEvents: manifest.cachedLikerEvents ?? [],
        commentResults: manifest.cachedCommentResults ?? [],
      };
      let runSnapshot = initialData;
      setData(initialData);
      const serverCompletions = manifest.manualCompletions ?? {
        commentThreadKeys: [],
        likeKeys: [],
        magazineAdditionKeys: [],
      };
      setCompletedThreads(
        new Set(serverCompletions.commentThreadKeys),
      );
      setCompletedLikes(new Set(serverCompletions.likeKeys));
      setCompletedMagazineAdditions(
        new Set(serverCompletions.magazineAdditionKeys ?? []),
      );
      setSavingCompletionKeys(new Set());
      void migrateLegacyCompletions(
        manifest.creator.urlname,
        serverCompletions,
      );
      setTab("overview");
      setProgress({
        processed: 0,
        total: manifest.scanArticles.length,
        failed: 0,
        cached: Math.max(
          manifest.articles.length - manifest.scanArticles.length,
          0,
        ),
      });
      const batches: Article[][] = [];
      for (
        let index = 0;
        index < manifest.scanArticles.length;
        index += manifest.batchSize
      ) {
        batches.push(
          manifest.scanArticles.slice(index, index + manifest.batchSize),
        );
      }
      setPhase(batches.length ? "scanning" : "complete");

      let processedCount = 0;
      let failedCount = 0;
      for (let index = 0; index < batches.length; index += 1) {
        const group = batches.slice(index, index + 1);
        const responses = await Promise.all(
          group.map(async (articles) => {
            try {
              const response = await fetch("/api/analytics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "scan_batch",
                  creator: manifest.creator.urlname,
                  runId: manifest.currentRunId,
                  articles,
                }),
              });
              return {
                articles,
                payload: await responseJson<BatchPayload>(response),
                error: null,
              };
            } catch (caught) {
              return {
                articles,
                payload: null,
                error:
                  caught instanceof Error
                    ? caught.message
                    : "記事データを取得できませんでした。",
              };
            }
          }),
        );
        if (currentRun !== runId.current) return;

        for (const result of responses) {
          processedCount += result.articles.length;
          if (result.error || !result.payload) {
            failedCount += result.articles.length;
            runSnapshot = {
              ...runSnapshot,
              warnings: [
                ...runSnapshot.warnings,
                `${result.articles[0]?.title ?? "記事"}ほか${result.articles.length}件: ${result.error}`,
              ],
            };
            setData(runSnapshot);
            continue;
          }
          runSnapshot = mergeBatchData(
            runSnapshot,
            result.articles,
            result.payload,
          );
          setData(runSnapshot);
        }
        setProgress({
          processed: processedCount,
          total: manifest.scanArticles.length,
          failed: failedCount,
          cached: Math.max(
            manifest.articles.length - manifest.scanArticles.length,
            0,
          ),
        });
      }

      try {
        const archiveResponse = await fetch(
          `/api/analytics?mode=archive&creator=${encodeURIComponent(
            manifest.creator.urlname,
          )}`,
          { cache: "no-store" },
        );
        const archive = await responseJson<{
          activityEvents: ActivityEvent[];
          privateNotifications: PrivateNotification[];
        }>(archiveResponse);
        if (currentRun === runId.current) {
          runSnapshot = {
            ...runSnapshot,
            activityEvents: archive.activityEvents,
            privateNotifications: archive.privateNotifications ?? [],
          };
          setData(runSnapshot);
        }
      } catch {
        runSnapshot = {
          ...runSnapshot,
          warnings: [
            ...new Set([
              ...runSnapshot.warnings,
              "最新の通知アーカイブを再読込できませんでした。",
            ]),
          ],
        };
        setData(runSnapshot);
      }
      if (manifest.currentRunId && currentRun === runId.current) {
        try {
          const finalThreads = allThreads(runSnapshot.commentResults);
          const completedAtStart = new Set(
            serverCompletions.commentThreadKeys,
          );
          const pendingThreadCount = finalThreads.filter(
            (thread) =>
              !completedAtStart.has(thread.rootKey) &&
              (thread.status === "unreplied" ||
                thread.status === "followup_pending" ||
                (potentialPendingEnabled &&
                  thread.status === "unknown")),
          ).length;
          const finalRanking = buildRanking(runSnapshot.likerEvents);
          const finishResponse = await fetch("/api/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "finish_run",
              creator: manifest.creator.urlname,
              runId: manifest.currentRunId,
              processedArticles: processedCount,
              failedArticles: failedCount,
              identifiedLikes: runSnapshot.likerEvents.length,
              supporterCount: finalRanking.length,
              commentThreadCount: finalThreads.length,
              pendingThreadCount,
              activityCount: runSnapshot.activityEvents.length,
              warningCount: runSnapshot.warnings.length,
            }),
          });
          const finished = await responseJson<{
            runHistory: AnalyticsRunRecord[];
          }>(finishResponse);
          runSnapshot = {
            ...runSnapshot,
            runHistory: finished.runHistory,
          };
          setData(runSnapshot);
        } catch {
          runSnapshot = {
            ...runSnapshot,
            warnings: [
              ...new Set([
                ...runSnapshot.warnings,
                "分析の実行履歴を確定できませんでした。",
              ]),
            ],
          };
          setData(runSnapshot);
        }
      }
      if (currentRun === runId.current) {
        void refreshMagazines(manifest.creator.urlname, currentRun);
      }
    } catch (caught) {
      if (currentRun !== runId.current) return;
      const message =
        caught instanceof Error
          ? caught.message
          : "データを取得できませんでした。";
      setError(
        previousData
          ? `更新できなかったため、保存済みの集計をそのまま表示しています。${message}`
          : message,
      );
    } finally {
      if (currentRun === runId.current) {
        setPhase(manifestLoaded ? "complete" : "idle");
      }
    }
  }

  async function openAdminCreator(noteInput: string) {
    if (adminCreatorLoading) return;
    setAdminCreatorLoading(true);
    setAdminCreatorError("");
    try {
      const response = await fetch("/api/member/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteInput }),
      });
      const payload = await responseJson<{
        selectedCreator: AdminCreatorHistoryItem;
        creators: AdminCreatorHistoryItem[];
      }>(response);
      setAdminCreators(payload.creators);
      window.localStorage.setItem(
        "mumei-note-insight:admin-selected-creator",
        payload.selectedCreator.creatorUrlname,
      );
      await runAnalysis(payload.selectedCreator.creatorUrlname);
    } catch (caught) {
      setAdminCreatorError(
        caught instanceof Error
          ? caught.message
          : "保存IDを開けませんでした。",
      );
    } finally {
      setAdminCreatorLoading(false);
    }
  }

  useEffect(() => {
    if (initialRun.current) return;
    initialRun.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/member/me", {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          member?: MemberInfo;
          error?: string;
        };
        if (!response.ok || !payload.member?.noteUrlname) {
          throw new Error(
            payload.error ?? "会員と登録済みnote IDを確認できませんでした。",
          );
        }
        if (cancelled) return;
        setMember(payload.member);
        setPotentialPendingEnabled(
          payload.member.potentialPendingEnabled !== false,
        );
        let creatorUrlname = payload.member.noteUrlname;
        if (payload.member.role === "owner") {
          try {
            const creators = await readAdminCreators();
            const saved = window.localStorage.getItem(
              "mumei-note-insight:admin-selected-creator",
            );
            const savedCreator = creators.find(
              (creator) =>
                creator.creatorUrlname.toLowerCase() ===
                saved?.toLowerCase(),
            );
            if (savedCreator) creatorUrlname = savedCreator.creatorUrlname;
          } catch (caught) {
            setAdminCreatorError(
              caught instanceof Error
                ? caught.message
                : "保存ID一覧を読み込めませんでした。",
            );
          }
        }
        setMemberLoading(false);
        await runAnalysis(creatorUrlname);
      } catch (caught) {
        if (cancelled) return;
        setMemberLoading(false);
        setError(
          caught instanceof Error
            ? caught.message
            : "会員情報を確認できませんでした。",
        );
        window.setTimeout(() => {
          window.location.hash = "member";
        }, 900);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addMagazine(magazineInput: string) {
    if (!data) return;
    const response = await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_magazine",
        creator: data.creator.urlname,
        magazine: magazineInput,
      }),
    });
    const payload = await responseJson<{
      magazine: Magazine;
      activityEvents: ActivityEvent[];
    }>(response);
    setData((current) => {
      if (!current) return current;
      const magazines = new Map(
        current.magazines.map((magazine) => [magazine.key, magazine]),
      );
      magazines.set(payload.magazine.key, payload.magazine);
      return {
        ...current,
        magazines: [...magazines.values()],
        activityEvents: payload.activityEvents,
      };
    });
  }

  async function addPrivateNotification(
    input: PrivateNotificationFormInput,
  ) {
    if (!data) throw new Error("分析対象のnote IDを確認できません。");
    const response = await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_private_notification",
        creator: data.creator.urlname,
        ...input,
      }),
    });
    const payload = await responseJson<{
      privateNotifications: PrivateNotification[];
    }>(response);
    setData((current) =>
      current
        ? {
            ...current,
            privateNotifications: payload.privateNotifications,
          }
        : current,
    );
  }

  async function importPrivateNotificationText(rawText: string) {
    if (!data) throw new Error("分析対象のnote IDを確認できません。");
    const response = await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "import_private_notifications",
        creator: data.creator.urlname,
        rawText,
      }),
    });
    const payload = await responseJson<{
      importedCount: number;
      privateNotifications: PrivateNotification[];
    }>(response);
    setData((current) =>
      current
        ? {
            ...current,
            privateNotifications: payload.privateNotifications,
          }
        : current,
    );
    return payload.importedCount;
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button
          className="brand"
          onClick={() => setTab("overview")}
          aria-label="ダッシュボードへ戻る"
        >
          <span>無名 S note</span> INSIGHT
        </button>
        {data ? (
          <>
            <nav className="desktop-tabs" aria-label="分析メニュー">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  className={tab === item.id ? "active" : ""}
                  onClick={() => selectTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="header-actions">
              <a className="outline-button header-member-link" href="#member">
                会員
              </a>
              <button
                className="primary-button"
                onClick={() => void runAnalysis(data.creator.urlname)}
                disabled={scanning}
              >
                {scanning ? <span className="spinner" /> : null}
                差分だけ更新
              </button>
            </div>
          </>
        ) : (
          <div className="security-actions">
            <p className="header-note">
              🔒 会員・note ID固定・長期ログイン
            </p>
            <a className="outline-button" href="#member">
              会員情報
            </a>
          </div>
        )}
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          <span>!</span>
          <p>{error}</p>
          <button onClick={() => setError("")} aria-label="閉じる">
            ×
          </button>
        </div>
      ) : null}

      {!data ? (
        <BoundDashboardLoading memberLoading={memberLoading} />
      ) : (
        <main className="dashboard">
          <section className="account-bar">
            <div className="account-identity">
              <Avatar person={data.creator} size="large" />
              <div>
                <p className="eyebrow">ANALYZING ALL PUBLIC ARTICLES</p>
                <h1>{data.creator.nickname}</h1>
                <a href={data.creator.profileUrl} target="_blank" rel="noreferrer">
                  @{data.creator.urlname}
                </a>
                <span className="bound-id-badge">
                  {member?.role === "owner"
                    ? "管理者・保存ID切替可"
                    : "会員・ID固定済み"}
                </span>
              </div>
            </div>
            <div className="account-tools">
              {member?.role === "owner" ? (
                <AdminCreatorSwitcher
                  creators={adminCreators}
                  currentUrlname={data.creator.urlname}
                  loading={adminCreatorLoading}
                  error={adminCreatorError}
                  onOpen={openAdminCreator}
                />
              ) : null}
              <span className="all-articles-badge">
                全{formatNumber(data.metrics.publicArticles)}記事
              </span>
              <div className="updated-at">
                <span>開始時刻</span>
                <strong>{formatDate(data.refreshedAt, true)}</strong>
              </div>
              <button className="share-button" onClick={() => setShareOpen(true)}>
                noteに貼る
              </button>
            </div>
          </section>

          <nav className="mobile-tabs" aria-label="分析メニュー">
            {tabs.map((item) => (
              <button
                key={item.id}
                className={tab === item.id ? "active" : ""}
                onClick={() => selectTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <ScanProgressBar
            phase={phase === "manifest" ? "manifest" : phase === "scanning" ? "scanning" : "complete"}
            progress={progress}
            batchSize={data.batchSize}
          />

          {data.warnings.length ? (
            <details className="warning-box">
              <summary>確認が必要な項目があります（{data.warnings.length}件）</summary>
              <ul>
                {data.warnings.slice(0, 30).map((warning, index) => {
                  const article = data.articles.find((item) =>
                    warning.includes(item.title),
                  );
                  return (
                    <li key={`${warning}-${index}`}>
                      <span>{warning}</span>
                      {article ? (
                        <a href={article.url} target="_blank" rel="noreferrer">
                          該当記事を開く ↗
                        </a>
                      ) : (
                        <button onClick={() => setTab("comments")}>
                          確認画面へ
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}

          {tab === "overview" ? (
            <Overview
              data={data}
              ranking={ranking}
              threads={threads}
              completedThreads={completedThreads}
              completedLikes={completedLikes}
              completedMagazineAdditions={completedMagazineAdditions}
              potentialPendingEnabled={potentialPendingEnabled}
              savingPotentialSetting={savingPotentialSetting}
              onPotentialPendingChange={(enabled) =>
                void updatePotentialPending(enabled)
              }
              scanComplete={!scanning}
              progress={progress}
              onTab={selectTab}
            />
          ) : null}
          {tab === "likers" ? (
            <LikersView
              events={data.likerEvents}
              scanning={scanning}
              completedLikes={completedLikes}
              savingCompletionKeys={savingCompletionKeys}
              onToggleCompleted={(itemKey) =>
                void toggleManualCompletion("like", itemKey)
              }
            />
          ) : null}
          {tab === "ranking" ? (
            <RankingView
              entries={ranking}
              scanning={scanning}
              articleCount={data.metrics.publicArticles}
            />
          ) : null}
          {tab === "comments" ? (
            <CommentsView
              results={data.commentResults}
              scanning={scanning}
              completedThreads={completedThreads}
              potentialPendingEnabled={potentialPendingEnabled}
              savingCompletionKeys={savingCompletionKeys}
              onToggleCompleted={(rootKey) =>
                void toggleManualCompletion("comment_thread", rootKey)
              }
            />
          ) : null}
          {tab === "comment-ranking" ? (
            <CommentRankingView
              entries={commentRanking}
              articleEntries={articleCommentRanking}
              scanning={scanning}
            />
          ) : null}
          {tab === "analysis" ? (
            <AnalysisView
              data={data}
              ranking={ranking}
              threads={threads}
              completedThreads={completedThreads}
              completedLikes={completedLikes}
              potentialPendingEnabled={potentialPendingEnabled}
              scanning={scanning}
            />
          ) : null}
          {tab === "archive" ? (
            <ArchiveView
              events={data.activityEvents}
              privateNotifications={data.privateNotifications}
              archiveNote={data.archiveNote}
              onMagazineAdds={() => selectTab("magazine-adds")}
              onAddPrivate={addPrivateNotification}
              onImportPrivate={importPrivateNotificationText}
            />
          ) : null}
          {tab === "magazine-adds" ? (
            <MagazineAddsView
              events={data.activityEvents}
              creator={data.creator}
              magazines={data.magazines}
              completedMagazineAdditions={completedMagazineAdditions}
              savingCompletionKeys={savingCompletionKeys}
              onToggleCompleted={(eventKey) =>
                void toggleManualCompletion("magazine_addition", eventKey)
              }
            />
          ) : null}
          {tab === "social" ? (
            <SocialView
              social={social}
              followerHistory={data.followerHistory}
              loading={socialLoading}
              error={socialError}
              onRefresh={() => refreshSocial(data.creator.urlname)}
            />
          ) : null}
          {tab === "magazines" ? (
            <MagazinesView
              magazines={data.magazines}
              onAdd={addMagazine}
              refreshing={magazineRefreshing}
              refreshedAt={data.magazineRefreshedAt}
              onRefresh={() => refreshMagazines(data.creator.urlname)}
            />
          ) : null}
        </main>
      )}

      <footer className="site-footer">
        <span>無名 S note｜note INSIGHT</span>
        <p>
          note株式会社の公式機能ではありません。公開反応は差分確認し、本人通知は利用者が保存した文面だけを保管します。
        </p>
      </footer>

      {shareOpen && data ? (
        <ShareModal onClose={() => setShareOpen(false)} />
      ) : null}
    </div>
  );
}
