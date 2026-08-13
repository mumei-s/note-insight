import { useCallback, useEffect, useMemo, useState } from "react";
import { AnalyticsApp } from "./analytics-app";

type CoreNotification = {
  id: number;
  notification_type: string;
  raw_text: string;
  actor_name: string | null;
  actor_url: string | null;
  target_title: string | null;
  target_url: string | null;
  occurred_at: string | null;
  captured_at: string;
  is_read: boolean;
  meta?: Record<string, unknown>;
};

type CorePayload = {
  member: {
    id: string;
    noteUrlname: string | null;
    noteNickname: string | null;
    role: string;
  };
  watch: {
    verified: boolean;
    verificationCode: string | null;
    enabled: boolean;
    initializedAt: string | null;
    lastWatchAt: string | null;
    error: string | null;
  };
  notifications: CoreNotification[];
};

type LegacyPrivateNotification = {
  id: string;
  kind: "article_mentioned" | "purchase" | "tip" | "other";
  title: string;
  actorName: string | null;
  articleTitle: string | null;
  articleUrl: string | null;
  amountYen: number | null;
  occurredAt: string;
  rawText: string | null;
};

type UnifiedPrivateItem = {
  key: string;
  type: string;
  label: string;
  text: string;
  actor: string | null;
  articleTitle: string | null;
  articleUrl: string | null;
  amountYen: number | null;
  occurredAt: string | null;
  source: "INSIGHT既存保存" | "本人通知Core";
};

const CORE_ENDPOINT =
  "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notifications";
const MEMBER_KEY = "mumei-note-insight:member";
const DEVICE_KEY = "mumei-note-insight:device";

const typeLabels: Record<string, string> = {
  purchase: "購入",
  tip: "チップ",
  buzz: "記事が話題",
  quote: "引用・貼り付け",
  reply: "返信",
  comment: "コメント",
  like: "反応",
  follow: "フォロー",
  magazine: "マガジン",
  rating: "高評価",
  points: "ポイント",
  other: "本人通知",
};

function coreHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Insight-Member": window.localStorage.getItem(MEMBER_KEY) ?? "",
    "X-Insight-Device": window.localStorage.getItem(DEVICE_KEY) ?? "",
  };
}

async function coreApi(action: string) {
  const response = await fetch(CORE_ENDPOINT, {
    method: "POST",
    headers: coreHeaders(),
    body: JSON.stringify({ action }),
  });
  const payload = (await response.json()) as CorePayload & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "本人通知Coreへ接続できませんでした。");
  }
  return payload;
}

function formatDate(value: string | null) {
  if (!value) return "日時不明";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function legacyLabel(kind: LegacyPrivateNotification["kind"]) {
  if (kind === "article_mentioned") return "記事が話題";
  if (kind === "purchase") return "購入";
  if (kind === "tip") return "チップ";
  return "本人通知";
}

const shellStyle: React.CSSProperties = {
  position: "fixed",
  right: 14,
  bottom: 14,
  zIndex: 80,
};

export function CombinedAnalyticsApp() {
  const [open, setOpen] = useState(false);
  const [core, setCore] = useState<CorePayload | null>(null);
  const [legacy, setLegacy] = useState<LegacyPrivateNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const corePayload = await coreApi("dashboard");
      setCore(corePayload);
      if (corePayload.member.noteUrlname) {
        try {
          const response = await fetch(
            `/api/analytics?mode=archive&creator=${encodeURIComponent(
              corePayload.member.noteUrlname,
            )}`,
            { cache: "no-store" },
          );
          const payload = (await response.json()) as {
            privateNotifications?: LegacyPrivateNotification[];
          } & { error?: string };
          if (response.ok) {
            setLegacy(payload.privateNotifications ?? []);
          }
        } catch {
          // 本人通知Coreだけでも表示を継続する。
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const items = useMemo<UnifiedPrivateItem[]>(() => {
    const oldItems: UnifiedPrivateItem[] = legacy.map((item) => ({
      key: `legacy:${item.id}`,
      type: item.kind,
      label: legacyLabel(item.kind),
      text: item.rawText || item.title,
      actor: item.actorName,
      articleTitle: item.articleTitle,
      articleUrl: item.articleUrl,
      amountYen: item.amountYen,
      occurredAt: item.occurredAt,
      source: "INSIGHT既存保存",
    }));
    const coreItems: UnifiedPrivateItem[] = (core?.notifications ?? [])
      .filter((item) => item.meta?.source !== "public_watcher")
      .map((item) => ({
        key: `core:${item.id}`,
        type: item.notification_type,
        label: typeLabels[item.notification_type] ?? "本人通知",
        text: item.raw_text,
        actor: item.actor_name,
        articleTitle: item.target_title,
        articleUrl: item.target_url,
        amountYen: null,
        occurredAt: item.occurred_at || item.captured_at,
        source: "本人通知Core",
      }));

    const seen = new Set<string>();
    return [...oldItems, ...coreItems]
      .filter((item) => {
        const fingerprint = `${item.label}|${item.text}|${item.occurredAt?.slice(0, 10) ?? ""}`;
        if (seen.has(fingerprint)) return false;
        seen.add(fingerprint);
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.occurredAt ?? 0).getTime() -
          new Date(a.occurredAt ?? 0).getTime(),
      );
  }, [core, legacy]);

  async function startVerification() {
    setLoading(true);
    setMessage("");
    try {
      const payload = await coreApi("start-verification");
      setCore(payload);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "コードを発行できませんでした。");
      setLoading(false);
    }
  }

  async function checkVerification() {
    setLoading(true);
    setMessage("");
    try {
      await coreApi("check-verification");
      setMessage("本人確認できました。プロフィールから認証コードを削除して大丈夫です。");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "VERIFICATION_CODE_NOT_FOUND"
          ? "プロフィールに認証コードがまだ確認できません。保存後にもう一度押してください。"
          : error instanceof Error
            ? error.message
            : "本人確認できませんでした。",
      );
      setLoading(false);
    }
  }

  return (
    <>
      <AnalyticsApp />
      <div style={shellStyle}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            border: "1px solid #91c632",
            borderRadius: 999,
            background: "#b6ff38",
            color: "#101600",
            padding: "12px 16px",
            fontWeight: 900,
            boxShadow: "0 12px 36px rgba(0,0,0,.38)",
          }}
        >
          本人通知 {items.length ? `+${items.length}` : "+"}
        </button>
      </div>

      {open ? (
        <div
          role="presentation"
          onMouseDown={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,.7)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="本人通知"
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              height: "100%",
              overflowY: "auto",
              background: "#0b1017",
              color: "#f4f7fb",
              borderLeft: "1px solid #263244",
              padding: 16,
              boxShadow: "-18px 0 55px rgba(0,0,0,.5)",
            }}
          >
            <header style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <small style={{ color: "#b6ff38", fontWeight: 900 }}>INSIGHT + PRIVATE NOTIFICATIONS</small>
                <h2 style={{ margin: "5px 0" }}>本人通知をプラス</h2>
                <p style={{ color: "#91a0b5", margin: 0, lineHeight: 1.6 }}>
                  スキ・コメント・フォロー・マガジン等は元のINSIGHTを正本として使用。ここでは本人にしか届かない通知だけを追加します。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ border: 0, borderRadius: 10, background: "#243044", color: "white", padding: "9px 12px", fontWeight: 900 }}
              >
                閉じる
              </button>
            </header>

            <section style={{ marginTop: 14, border: "1px solid #263244", borderRadius: 15, padding: 14, background: "#101720" }}>
              <strong>取得の役割分担</strong>
              <div style={{ display: "grid", gap: 7, marginTop: 10, fontSize: 13 }}>
                <div><b style={{ color: "#b6ff38" }}>元INSIGHT：</b> 公開スキ・コメント・返信・フォロー・マガジン・分析</div>
                <div><b style={{ color: "#ffcf5a" }}>追加Core：</b> 購入・チップ・話題・引用・ポイント等の本人通知</div>
              </div>
            </section>

            <section style={{ marginTop: 12, border: "1px solid #263244", borderRadius: 15, padding: 14, background: "#101720" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong>本人確認</strong>
                <span style={{ fontSize: 12, color: core?.watch.verified ? "#b6ff38" : "#ffcf5a" }}>
                  {core?.watch.verified ? "確認済み" : "未確認"}
                </span>
              </div>
              {!core?.watch.verified ? (
                <>
                  {core?.watch.verificationCode ? (
                    <div style={{ marginTop: 10 }}>
                      <p style={{ color: "#91a0b5", lineHeight: 1.55, fontSize: 13 }}>
                        このコードを自分のnoteプロフィールへ一時的に入れて保存してください。
                      </p>
                      <code style={{ display: "block", padding: 12, borderRadius: 10, background: "#05080c", color: "#b6ff38", fontWeight: 900, wordBreak: "break-all" }}>
                        {core.watch.verificationCode}
                      </code>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                        {core.member.noteUrlname ? (
                          <a
                            href={`https://note.com/${core.member.noteUrlname}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#4ee6ff" }}
                          >
                            noteプロフィールを開く ↗
                          </a>
                        ) : null}
                        <button type="button" disabled={loading} onClick={() => void checkVerification()} style={{ border: 0, borderRadius: 10, background: "#b6ff38", color: "#111800", padding: "9px 12px", fontWeight: 900 }}>
                          プロフィールを確認
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" disabled={loading} onClick={() => void startVerification()} style={{ marginTop: 10, border: 0, borderRadius: 10, background: "#b6ff38", color: "#111800", padding: "10px 13px", fontWeight: 900 }}>
                      本人確認コードを発行
                    </button>
                  )}
                </>
              ) : (
                <p style={{ marginBottom: 0, color: "#91a0b5", fontSize: 13, lineHeight: 1.6 }}>
                  note IDの本人確認は完了しています。本人限定通知を自動取得する認証経路はまだ未接続なので、ここは「取得できた本人通知の統合表示」までを先に完成させています。
                </p>
              )}
              {message ? <p style={{ color: "#ffcf5a", fontSize: 13 }}>{message}</p> : null}
            </section>

            <section style={{ marginTop: 12, border: "1px solid #263244", borderRadius: 15, padding: 14, background: "#101720" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>本人通知の統合履歴</strong>
                <button type="button" disabled={loading} onClick={() => void load()} style={{ border: 0, borderRadius: 9, background: "#243044", color: "white", padding: "7px 10px", fontWeight: 800 }}>
                  {loading ? "読込中…" : "再読込"}
                </button>
              </div>
              <p style={{ color: "#91a0b5", fontSize: 12, lineHeight: 1.5 }}>
                元INSIGHTで保存した本人通知と、追加Coreに入った本人通知を同じ一覧へまとめています。
              </p>
              {items.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {items.slice(0, 100).map((item) => (
                    <article key={item.key} style={{ border: "1px solid #263244", borderRadius: 12, padding: 11, background: "#0c121a" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <span style={{ borderRadius: 999, background: "#202b3b", padding: "5px 8px", fontSize: 11, fontWeight: 900 }}>{item.label}</span>
                        <time style={{ color: "#91a0b5", fontSize: 11 }}>{formatDate(item.occurredAt)}</time>
                      </div>
                      <p style={{ margin: "8px 0 5px", lineHeight: 1.5, fontSize: 13 }}>{item.text}</p>
                      <div style={{ color: "#91a0b5", fontSize: 11, display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {item.actor ? <span>相手：{item.actor}</span> : null}
                        {item.amountYen != null ? <span>金額：{item.amountYen.toLocaleString("ja-JP")}円</span> : null}
                        <span>{item.source}</span>
                        {item.articleUrl ? (
                          <a href={item.articleUrl} target="_blank" rel="noreferrer" style={{ color: "#4ee6ff" }}>
                            対象を開く ↗
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "28px 12px", textAlign: "center", color: "#91a0b5" }}>
                  まだ本人通知の保存データはありません。
                </div>
              )}
            </section>
          </aside>
        </div>
      ) : null}
    </>
  );
}
