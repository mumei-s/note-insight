import { useEffect, useMemo, useState } from "react";

const FAST = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-fast-api-v2";
const ARTICLES = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-favorite-articles";
const OWNER = "mumei-unified-owner-token";

type Favorite = {
  creator_key: string;
  actor_name: string | null;
  actor_url: string | null;
  actor_image_url: string | null;
  created_at: string;
};

type Article = {
  key: string;
  title: string;
  url: string;
  publishedAt: string | null;
  thumbnail: string | null;
  likeCount: number;
  commentCount: number;
  excerpt: string | null;
  read: boolean;
  readAt: string | null;
};

type ArticleState = {
  rows: Article[];
  page: number;
  hasNext: boolean;
  loading: boolean;
  error: string;
};

type ReadFilter = "all" | "unread" | "read";
type ArticleSort = "newest" | "oldest";

function date(v: string | null) {
  if (!v) return "日時不明";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(d);
}

function idFromUrl(v: string | null) {
  try {
    return v ? new URL(v).pathname.split("/").filter(Boolean)[0] || "" : "";
  } catch {
    return "";
  }
}

function timeValue(v: string | null) {
  const n = v ? new Date(v).getTime() : 0;
  return Number.isFinite(n) ? n : 0;
}

async function post(url: string, body: Record<string, unknown>) {
  const token = localStorage.getItem(OWNER) || "";
  if (!token) throw new Error("OWNER本人認証が必要です");
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Owner-Token": token },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const p = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(p?.error || "読み込めませんでした");
  return p;
}

export function FavoriteReader() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [articles, setArticles] = useState<Record<string, ArticleState>>({});
  const [articleQuery, setArticleQuery] = useState("");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [articleSort, setArticleSort] = useState<ArticleSort>("newest");

  async function loadFavorites() {
    setLoading(true);
    setError("");
    try {
      const p = await post(FAST, { action: "favorites" });
      setFavorites(Array.isArray(p?.rows) ? p.rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込めませんでした");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFavorites();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? favorites.filter(
          (x) =>
            String(x.actor_name || "").toLowerCase().includes(q) ||
            String(x.actor_url || "").toLowerCase().includes(q),
        )
      : favorites;
  }, [favorites, query]);

  async function loadArticles(f: Favorite, page = 1) {
    const key = f.creator_key;
    const currentPage = articles[key]?.page || 1;
    if (open === key && page === 1 && currentPage === 1) {
      setOpen(null);
      return;
    }
    setOpen(key);
    setArticles((v) => ({
      ...v,
      [key]: {
        rows: v[key]?.rows || [],
        page,
        hasNext: v[key]?.hasNext || false,
        loading: true,
        error: "",
      },
    }));
    try {
      const p = await post(ARTICLES, {
        action: "articles",
        creatorUrl: f.actor_url,
        creatorKey: f.creator_key,
        page,
      });
      setArticles((v) => ({
        ...v,
        [key]: {
          rows: Array.isArray(p?.rows) ? p.rows : [],
          page: Number(p?.page || page),
          hasNext: Boolean(p?.hasNext),
          loading: false,
          error: "",
        },
      }));
    } catch (e) {
      setArticles((v) => ({
        ...v,
        [key]: {
          rows: [],
          page,
          hasNext: false,
          loading: false,
          error: e instanceof Error ? e.message : "記事を取得できませんでした",
        },
      }));
    }
  }

  async function setRead(f: Favorite, article: Article, read: boolean) {
    const key = f.creator_key;
    const previous = article.read;
    const patch = (value: boolean) =>
      setArticles((v) => {
        const current = v[key];
        if (!current) return v;
        return {
          ...v,
          [key]: {
            ...current,
            rows: current.rows.map((x) =>
              x.key === article.key
                ? { ...x, read: value, readAt: value ? new Date().toISOString() : null }
                : x,
            ),
          },
        };
      });

    patch(read);
    try {
      await post(ARTICLES, {
        action: "read_set",
        creatorKey: f.creator_key,
        creatorUrl: f.actor_url,
        articleKey: article.key,
        articleUrl: article.url,
        read,
      });
    } catch (e) {
      patch(previous);
      setError(e instanceof Error ? e.message : "既読状態を保存できませんでした");
    }
  }

  async function remove(f: Favorite) {
    try {
      await post(FAST, {
        action: "favorite_toggle",
        creatorKey: f.creator_key,
        actorName: f.actor_name,
        actorUrl: f.actor_url,
        actorImageUrl: f.actor_image_url,
        favorite: false,
      });
      setFavorites((v) => v.filter((x) => x.creator_key !== f.creator_key));
      if (open === f.creator_key) setOpen(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解除できませんでした");
    }
  }

  return (
    <div className="fav-reader">
      <div className="fav-reader-head">
        <div>
          <b>お気に入り・高速記事ビュー</b>
          <small>登録 {favorites.length}人。過去記事をINSIGHT内で探し、既読/未読も保存します。</small>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="お気に入りを検索" />
      </div>

      {error ? <div className="fav-reader-error">{error}</div> : null}
      {loading ? (
        <div className="fav-reader-empty">読み込み中…</div>
      ) : visible.length === 0 ? (
        <div className="fav-reader-empty">お気に入りしたクリエイターはまだいません。</div>
      ) : (
        <div className="fav-reader-list">
          {visible.map((f) => {
            const a = articles[f.creator_key];
            const isOpen = open === f.creator_key;
            const q = articleQuery.trim().toLowerCase();
            const pageRows = [...(a?.rows || [])];
            const unreadCount = pageRows.filter((x) => !x.read).length;
            const filteredRows = pageRows
              .filter((x) => !q || x.title.toLowerCase().includes(q) || String(x.excerpt || "").toLowerCase().includes(q))
              .filter((x) => readFilter === "all" || (readFilter === "read" ? x.read : !x.read))
              .sort((x, y) =>
                articleSort === "newest"
                  ? timeValue(y.publishedAt) - timeValue(x.publishedAt)
                  : timeValue(x.publishedAt) - timeValue(y.publishedAt),
              );

            return (
              <article className="fav-creator" key={f.creator_key}>
                <div className="fav-creator-main">
                  <div className="fav-person">
                    {f.actor_image_url ? (
                      <img src={f.actor_image_url} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <span>{String(f.actor_name || "n").slice(0, 1)}</span>
                    )}
                    <div>
                      <strong>{f.actor_name || "noteユーザー"}</strong>
                      <small>{idFromUrl(f.actor_url) ? `@${idFromUrl(f.actor_url)}` : ""}</small>
                    </div>
                  </div>
                  <div className="fav-actions">
                    <button onClick={() => void loadArticles(f, 1)}>
                      {isOpen && (a?.page || 1) === 1 ? "記事を閉じる" : "過去記事を見る"}
                    </button>
                    {f.actor_url ? <a href={f.actor_url} target="_blank" rel="noreferrer">プロフィール ↗</a> : null}
                    <button className="remove" onClick={() => void remove(f)}>★ 解除</button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="fav-articles">
                    {a?.loading ? (
                      <div className="fav-reader-empty">過去記事を高速取得中…</div>
                    ) : a?.error ? (
                      <div className="fav-reader-error">{a.error}</div>
                    ) : a?.rows?.length ? (
                      <>
                        <div className="fav-article-tools">
                          <div className="fav-unread-summary"><b>このページ 未読 {unreadCount}件</b><span>全 {pageRows.length}件</span></div>
                          <input value={articleQuery} onChange={(e) => setArticleQuery(e.target.value)} placeholder="このページの記事を検索" />
                          <select value={readFilter} onChange={(e) => setReadFilter(e.target.value as ReadFilter)}>
                            <option value="all">すべて</option><option value="unread">未読だけ</option><option value="read">既読だけ</option>
                          </select>
                          <select value={articleSort} onChange={(e) => setArticleSort(e.target.value as ArticleSort)}>
                            <option value="newest">新しい順</option><option value="oldest">古い順</option>
                          </select>
                        </div>

                        {filteredRows.length ? (
                          <div className="fav-article-grid">
                            {filteredRows.map((x) => (
                              <article className={`fav-article ${x.read ? "is-read" : "is-unread"}`} key={x.key}>
                                <a className="fav-article-link" href={x.url} target="_blank" rel="noreferrer" onClick={() => void setRead(f, x, true)}>
                                  {x.thumbnail ? <img src={x.thumbnail} alt="" referrerPolicy="no-referrer" /> : <div className="fav-thumb" />}
                                  <div>
                                    <span className="fav-read-badge">{x.read ? "既読" : "● 未読"}</span>
                                    <strong>{x.title}</strong>
                                    <small>{date(x.publishedAt)}　♡{x.likeCount}　💬{x.commentCount}</small>
                                    {x.excerpt ? <p>{x.excerpt}</p> : null}
                                    <em>noteで読む ↗</em>
                                  </div>
                                </a>
                                <button className="fav-read-toggle" onClick={() => void setRead(f, x, !x.read)}>{x.read ? "未読に戻す" : "既読にする"}</button>
                              </article>
                            ))}
                          </div>
                        ) : <div className="fav-reader-empty">この条件に合う記事はありません。</div>}

                        <div className="fav-page">
                          <button disabled={(a?.page || 1) <= 1} onClick={() => void loadArticles(f, (a?.page || 1) - 1)}>← 新しい記事</button>
                          <span>記事ページ {a?.page || 1}</span>
                          <button disabled={!a?.hasNext} onClick={() => void loadArticles(f, (a?.page || 1) + 1)}>古い記事 →</button>
                        </div>
                      </>
                    ) : <div className="fav-reader-empty">公開記事を取得できませんでした。</div>}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        .fav-reader{display:grid;gap:10px;margin:8px 0 14px}.fav-reader-head{display:flex;justify-content:space-between;gap:10px;align-items:end;border:1px solid #32465c;border-radius:12px;background:#0b151f;padding:11px}.fav-reader-head>div{display:grid;gap:2px}.fav-reader-head b{color:#ffd86a}.fav-reader-head small{color:#8494a8}.fav-reader-head input,.fav-article-tools input,.fav-article-tools select{min-height:38px;border:1px solid #3c4d63;border-radius:9px;background:#070c12;color:#fff;padding:0 10px}.fav-reader-head input{min-width:210px}.fav-reader-list{display:grid;gap:9px}.fav-creator{border:1px solid #2d3d51;border-radius:13px;background:#0b1119;overflow:hidden}.fav-creator-main{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px}.fav-person{display:flex;align-items:center;gap:9px;min-width:0}.fav-person img,.fav-person>span{width:42px;height:42px;border-radius:50%;object-fit:cover;background:#182432;display:grid;place-items:center;flex:none}.fav-person>div{min-width:0}.fav-person strong,.fav-person small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fav-person small{color:#8493a8}.fav-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.fav-actions button,.fav-actions a,.fav-page button,.fav-read-toggle{border:1px solid #3c5068;border-radius:8px;background:#122030;color:#eaf3fd;min-height:36px;padding:7px 10px;font-weight:850;text-decoration:none}.fav-actions button:first-child{border-color:#4c788f;color:#8feaff}.fav-actions .remove{border-color:#665447;color:#ffd86a}.fav-articles{border-top:1px solid #253448;padding:10px;background:#080d14}.fav-article-tools{display:grid;grid-template-columns:auto minmax(160px,1fr) auto auto;gap:7px;align-items:center;margin-bottom:10px}.fav-unread-summary{display:grid;gap:1px;padding-right:5px}.fav-unread-summary b{color:#8feaff;font-size:11px}.fav-unread-summary span{color:#8293a8;font-size:10px}.fav-article-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.fav-article{border:1px solid #293a50;border-radius:10px;background:#0f1721;padding:8px;min-width:0;display:grid;gap:7px}.fav-article.is-unread{border-color:#4d7188;box-shadow:inset 3px 0 0 #63dfff}.fav-article.is-read{opacity:.82}.fav-article-link{display:grid;grid-template-columns:92px minmax(0,1fr);gap:9px;color:#eef5fc;text-decoration:none;min-width:0}.fav-article-link>img,.fav-thumb{width:92px;height:68px;border-radius:7px;object-fit:cover;background:#172330}.fav-article-link>div{min-width:0}.fav-read-badge{display:inline-flex;border:1px solid #3b536c;border-radius:999px;padding:2px 6px;margin-bottom:4px;color:#95a6b9;font-size:9px;font-weight:900}.is-unread .fav-read-badge{border-color:#397b96;color:#8feaff}.fav-article-link strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.45}.fav-article-link small{display:block;color:#8293a8;margin-top:4px}.fav-article-link p{font-size:11px;color:#a6b3c3;line-height:1.5;margin:5px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.fav-article-link em{font-style:normal;color:#8feaff;font-size:10px;font-weight:900}.fav-read-toggle{justify-self:end;min-height:30px;padding:4px 8px;font-size:10px}.fav-page{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:10px}.fav-page span{color:#8d9caf;font-size:11px}.fav-page button:disabled{opacity:.35}.fav-reader-empty{padding:18px;text-align:center;color:#8fa0b4}.fav-reader-error{border:1px solid #70404b;border-radius:9px;background:#251218;color:#ffabb5;padding:9px}@media(max-width:700px){.fav-reader-head{display:grid}.fav-reader-head input{min-width:0;width:100%}.fav-creator-main{display:grid}.fav-actions{justify-content:stretch}.fav-actions>*{flex:1;text-align:center}.fav-article-tools{grid-template-columns:1fr 1fr}.fav-unread-summary{grid-column:1/-1}.fav-article-tools input{grid-column:1/-1}.fav-article-grid{grid-template-columns:1fr}.fav-article-link{grid-template-columns:76px minmax(0,1fr)}.fav-article-link>img,.fav-thumb{width:76px;height:60px}.fav-page{justify-content:space-between}}
      `}</style>
    </div>
  );
}
