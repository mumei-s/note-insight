import { FormEvent, useEffect, useMemo, useState } from "react";
import { clearLocalSession, hasMemberSession } from "./api";

type Member = {
  id: string;
  role: "owner" | "member";
  status: "pending" | "active" | "removed";
  noteUrlname: string | null;
  noteNickname: string | null;
  noteImageUrl: string | null;
  potentialPendingEnabled: boolean;
  joinedAt: string;
  approvedAt: string | null;
  lastSeenAt: string;
};

type PortalPayload = {
  member: Member;
  members: Member[];
  isOwner: boolean;
  signInRequired: false;
  memberToken?: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function MemberAvatar({ member }: { member: Member }) {
  return (
    <span className="member-avatar" aria-hidden="true">
      {member.noteImageUrl ? (
        <img src={member.noteImageUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <b>{member.role === "owner" ? "管" : "待"}</b>
      )}
    </span>
  );
}

export function MemberPortal() {
  const [payload, setPayload] = useState<PortalPayload | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(hasMemberSession());
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const activeMembers = useMemo(
    () => payload?.members.filter((member) => member.status === "active") ?? [],
    [payload],
  );
  const pendingMembers = useMemo(
    () => payload?.members.filter((member) => member.status === "pending") ?? [],
    [payload],
  );

  async function readPayload(response: Response) {
    const result = (await response.json()) as PortalPayload & { error?: string };
    if (!response.ok) {
      throw new Error(result.error ?? "会員情報を確認できませんでした。");
    }
    setPayload(result);
    return result;
  }

  useEffect(() => {
    if (!hasMemberSession()) return;
    let cancelled = false;
    fetch("/api/member/me", { cache: "no-store" })
      .then(async (response) => {
        if (!cancelled) await readPayload(response);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "会員情報を確認できませんでした。",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/member/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteInput }),
      });
      const result = await readPayload(response);
      if (result.member.noteUrlname) setNoteInput("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "note IDを登録できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function ownerLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/member/owner-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminCode }),
      });
      await readPayload(response);
      setAdminCode("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "管理者としてログインできませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function adminAction(member: Member, action: "approve" | "remove") {
    if (
      action === "remove" &&
      !window.confirm(
        `${member.noteNickname ?? member.noteUrlname ?? "この会員"}を脱退させます。登録IDとこの端末の会員ログインは無効になります。`,
      )
    ) {
      return;
    }
    setActionId(member.id);
    setError("");
    try {
      const response = await fetch("/api/member/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, memberId: member.id }),
      });
      await readPayload(response);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "会員状態を変更できませんでした。",
      );
    } finally {
      setActionId(null);
    }
  }

  function leaveDevice() {
    void fetch("/api/access/logout", { method: "POST" }).catch(() => {});
    clearLocalSession();
    window.location.hash = "";
  }

  return (
    <div className="member-site">
      <header className="member-header">
        <a className="public-brand" href="#">
          <span>無名 S note</span>
          INSIGHT
        </a>
        <div>
          <span>会員管理</span>
          <button onClick={leaveDevice}>この端末を解除</button>
        </div>
      </header>

      <main className="member-main">
        <section className="member-intro">
          <div>
            <p className="lime-eyebrow">MEMBER ACCESS CONTROL</p>
            <h1>会員とnote IDを、1対1で固定。</h1>
            <p>
              参加者ごとに分析領域を分けます。一度登録したnote IDは管理者の脱退処理なしでは変更できません。
            </p>
          </div>
          <div className="long-session-card">
            <span>LONG SESSION</span>
            <strong>最大5年</strong>
            <p>端末解除・保存データ削除・管理者による脱退時だけ再確認します。</p>
          </div>
        </section>

        {error ? (
          <div className="member-error" role="alert">
            <b>!</b>
            {error}
          </div>
        ) : null}

        {loading ? (
          <section className="member-loading">
            <i />
            <strong>会員情報を確認しています</strong>
          </section>
        ) : null}

        {!loading && !payload ? (
          <div className="member-choice-grid">
            <section className="member-step-card">
              <span className="member-step-number">MEMBER</span>
              <h2>参加する</h2>
              <p>
                note IDを登録すると承認待ち一覧へ入ります。管理者の承認後、自分専用ダッシュボードが開きます。
              </p>
              <form className="member-code-form" onSubmit={register}>
                <input
                  value={noteInput}
                  onChange={(event) => setNoteInput(event.target.value)}
                  placeholder="note ID またはクリエイターページURL"
                  autoComplete="off"
                  required
                />
                <button className="member-primary-link" disabled={saving}>
                  {saving ? "確認中…" : "このIDで参加申請"}
                </button>
              </form>
            </section>

            <section className="member-step-card">
              <span className="member-step-number">OWNER</span>
              <h2>管理者として入る</h2>
              <p>
                管理者専用コードで、承認・脱退・保存済みクリエイターの確認を行います。
              </p>
              <form className="member-code-form" onSubmit={ownerLogin}>
                <input
                  type="password"
                  value={adminCode}
                  onChange={(event) => setAdminCode(event.target.value)}
                  placeholder="管理者専用コード"
                  autoComplete="current-password"
                  required
                />
                <button className="member-primary-link" disabled={saving}>
                  {saving ? "確認中…" : "管理画面を開く"}
                </button>
              </form>
            </section>
          </div>
        ) : null}

        {!loading && payload?.member.status === "pending" && !payload.member.noteUrlname ? (
          <section className="member-step-card">
            <span className="member-step-number">STEP 3</span>
            <h2>自分のnote IDを登録</h2>
            <form className="member-note-form" onSubmit={register}>
              <label htmlFor="member-note-id">noteのURLまたはnote ID</label>
              <div>
                <input
                  id="member-note-id"
                  value={noteInput}
                  onChange={(event) => setNoteInput(event.target.value)}
                  placeholder="例：mumei_s_note"
                  autoComplete="off"
                  required
                />
                <button disabled={saving}>{saving ? "確認中…" : "このIDで固定する"}</button>
              </div>
            </form>
          </section>
        ) : null}

        {!loading && payload?.member.status === "pending" && payload.member.noteUrlname ? (
          <section className="member-pending-card">
            <span>承認待ち</span>
            <MemberAvatar member={payload.member} />
            <div>
              <h2>{payload.member.noteNickname}</h2>
              <p>@{payload.member.noteUrlname}</p>
            </div>
            <strong>管理者が承認すると、自分専用ダッシュボードが開きます。</strong>
          </section>
        ) : null}

        {!loading && payload?.member.status === "active" && payload.member.noteUrlname ? (
          <section className="member-active-card">
            <MemberAvatar member={payload.member} />
            <div>
              <span>{payload.member.role === "owner" ? "管理者" : "承認済み会員"}</span>
              <h2>{payload.member.noteNickname}</h2>
              <p>@{payload.member.noteUrlname}</p>
            </div>
            <a href="#dashboard">自分のダッシュボードを開く →</a>
          </section>
        ) : null}

        {!loading && payload?.member.status === "removed" ? (
          <section className="member-removed-card">
            <span>脱退済み</span>
            <h2>この会員では利用できません。</h2>
            <p>再参加については管理者へ確認してください。</p>
          </section>
        ) : null}

        {payload ? (
          <section className="member-list-panel">
            <div className="member-panel-heading">
              <div>
                <p className="lime-eyebrow">ACTIVE MEMBERS</p>
                <h2>参加メンバー</h2>
              </div>
              <strong>{activeMembers.length}人</strong>
            </div>
            <div className="member-list">
              {activeMembers.map((member) => (
                <article key={member.id}>
                  <MemberAvatar member={member} />
                  <div>
                    <strong>{member.noteNickname ?? "会員"}</strong>
                    <small>{member.noteUrlname ? `@${member.noteUrlname}` : "note ID登録前"}</small>
                  </div>
                  <span>{member.role === "owner" ? "OWNER" : "ACTIVE"}</span>
                  <time>最終利用 {formatDate(member.lastSeenAt)}</time>
                  {payload.isOwner && member.role !== "owner" ? (
                    <button
                      className="member-remove-button"
                      disabled={actionId === member.id}
                      onClick={() => void adminAction(member, "remove")}
                    >
                      脱退
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {payload?.isOwner ? (
          <section className="member-list-panel pending-list-panel">
            <div className="member-panel-heading">
              <div>
                <p className="lime-eyebrow">APPROVAL QUEUE</p>
                <h2>承認待ち</h2>
              </div>
              <strong>{pendingMembers.length}人</strong>
            </div>
            {pendingMembers.length ? (
              <div className="member-list">
                {pendingMembers.map((member) => (
                  <article key={member.id}>
                    <MemberAvatar member={member} />
                    <div>
                      <strong>{member.noteNickname ?? "ID登録待ち"}</strong>
                      <small>{member.noteUrlname ? `@${member.noteUrlname}` : "本人がnote IDを登録中"}</small>
                    </div>
                    <span>PENDING</span>
                    <time>参加 {formatDate(member.joinedAt)}</time>
                    <div className="member-admin-actions">
                      <button
                        disabled={actionId === member.id || !member.noteUrlname}
                        onClick={() => void adminAction(member, "approve")}
                      >
                        承認
                      </button>
                      <button
                        disabled={actionId === member.id}
                        onClick={() => void adminAction(member, "remove")}
                      >
                        却下
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="member-empty">現在、承認待ちの会員はいません。</p>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
