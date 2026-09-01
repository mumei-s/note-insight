import { useEffect, useMemo, useState } from "react";
import {
  INSIGHT_TOKEN_KEY,
  activateStoredInsightAccount,
  currentStoredInsightAccount,
  forgetInsightAccount,
  forgetMemberSession,
  readStoredInsightAccounts,
  rememberMemberSession,
  setAccessIntent,
} from "./insight-account-store";
import type { StoredInsightAccount } from "./insight-account-store";
import "./hub-home.css";

const ACCESS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
type RailPerson = { id: string; noteId: string; name: string; image: string | null; profileUrl: string };
type ConfirmAction = "logout" | "leave" | null;

async function accessCall(action: string, headers: Record<string, string> = {}) {
  const response = await fetch(ACCESS, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ action }), cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "ACCESS_ERROR");
  return payload;
}

function Initial({ name }: { name: string }) { return <span className="hub-person-fallback">{[...name].slice(0, 1).join("") || "n"}</span>; }

function ParticipantRail({ people, loading }: { people: RailPerson[]; loading: boolean }) {
  return <section className="hub-participants is-insight" aria-label="INSIGHT参加クリエイター">
    <div className="hub-participant-heading"><strong>INSIGHT参加クリエイター <b>{loading ? "—" : people.length}名</b></strong><small>タップ→本人note</small></div>
    {loading ? <div className="hub-participant-loading"><i /><i /><i /></div> : people.length ? <div className="hub-participant-rail">{people.map((person) => <a className="hub-person" key={person.id} href={person.profileUrl} target="_blank" rel="noreferrer" title={`${person.name}のnote`}>{person.image ? <img src={person.image} alt="" referrerPolicy="no-referrer" /> : <Initial name={person.name} />}<span>{person.name}</span></a>)}</div> : <p className="hub-participant-empty">本人認証済みの参加クリエイターがここに並びます。</p>}
  </section>;
}

function AccountBadge({ account, count }: { account: StoredInsightAccount | null; count: number }) {
  return <div className="hub-account-state">{account ? <>{account.imageUrl ? <img src={account.imageUrl} alt="" referrerPolicy="no-referrer" /> : <span>{[...(account.displayName || account.noteId)][0]}</span>}<div><small>ログイン中</small><b>{account.displayName || `@${account.noteId}`}</b>{count > 1 ? <em>保存済み {count}アカウント</em> : null}</div></> : <div><small>INSIGHT</small><b>未ログイン</b>{count ? <em>保存済み {count}アカウント</em> : null}</div>}</div>;
}

function ConfirmDialog({ action, account, busy, onCancel, onYes }: { action: ConfirmAction; account: StoredInsightAccount | null; busy: boolean; onCancel: () => void; onYes: () => void }) {
  if (!action) return null;
  const leave = action === "leave";
  return <div className="hub-confirm-backdrop" role="presentation"><section className="hub-confirm" role="dialog" aria-modal="true" aria-label={leave ? "退会確認" : "ログアウト確認"}>
    <small>{leave ? "LEAVE INSIGHT" : "LOG OUT"}</small><h2>{leave ? "本当に退会しますか？" : "本当にログアウトしますか？"}</h2>
    <p>{leave ? `@${account?.noteId || "現在のアカウント"} の参加権を停止し、この端末を含むログインを失効します。` : `@${account?.noteId || "現在のアカウント"} だけログアウトします。ほかの保存済みアカウントは維持します。`}</p>
    <div><button disabled={busy} onClick={onCancel}>いいえ</button><button className={leave ? "danger" : "yes"} disabled={busy} onClick={onYes}>{busy ? "処理中…" : "はい"}</button></div>
  </section></div>;
}

export function HubHome() {
  const [people, setPeople] = useState<RailPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountVersion, setAccountVersion] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [busy, setBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const accounts = useMemo(() => readStoredInsightAccounts(), [accountVersion]);
  const activeAccount = useMemo(() => currentStoredInsightAccount(), [accountVersion]);
  const memberToken = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
  const memberReady = Boolean(memberToken);

  function refreshAccounts() { setAccountVersion((value) => value + 1); }
  function openAccess(intent: "login" | "apply" | "switch") { setAccessIntent(intent); window.location.hash = "access/insight"; }

  useEffect(() => {
    const refresh = () => refreshAccounts();
    window.addEventListener("mumei-insight-accounts", refresh);
    return () => window.removeEventListener("mumei-insight-accounts", refresh);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch(ACCESS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "public-participants" }), cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        const rows = response.ok && Array.isArray(payload?.participants) ? payload.participants : [];
        if (live) setPeople(rows.map((person: any) => ({ id: String(person.member_id || person.id), noteId: String(person.note_id || ""), name: String(person.display_name || `@${person.note_id}`), image: typeof person.image_url === "string" ? person.image_url : null, profileUrl: `https://note.com/${person.note_id}` })));
      } catch { if (live) setPeople([]); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
    if (!token) return;
    const stored = readStoredInsightAccounts().find((item) => item.memberToken === token);
    void accessCall("session", { "X-Insight-Token": token }).then((payload) => {
      rememberMemberSession(payload.application, token, stored?.passcode); refreshAccounts();
    }).catch((reason) => {
      const code = reason instanceof Error ? reason.message : "";
      if (/INSIGHT_SESSION_INVALID|INSIGHT_MEMBER_INACTIVE|INSIGHT_LOGIN_REQUIRED/.test(code)) {
        if (stored) forgetMemberSession(stored.noteId); else localStorage.removeItem(INSIGHT_TOKEN_KEY);
        refreshAccounts(); setAccountMessage("ログインが失効しています。ログインから再接続してください。");
      } else setAccountMessage("通信確認ができませんでした。保存済みログイン情報は保持しています。");
    });
  }, []);

  async function confirmAction() {
    if (!confirm || !activeAccount) { setConfirm(null); return; }
    const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || activeAccount.memberToken || "";
    setBusy(true); setAccountMessage("");
    try {
      if (confirm === "leave") {
        await accessCall("leave", { "X-Insight-Token": token });
        forgetInsightAccount(activeAccount.noteId);
        setAccountMessage(`@${activeAccount.noteId} は退会しました。`);
      } else {
        try { await accessCall("logout", { "X-Insight-Token": token }); } catch { /* local logout still completes */ }
        forgetMemberSession(activeAccount.noteId);
        setAccountMessage(`@${activeAccount.noteId} をログアウトしました。`);
      }
      const next = readStoredInsightAccounts().find((item) => item.memberToken);
      if (next) activateStoredInsightAccount(next.noteId);
      refreshAccounts();
    } catch (reason) {
      setAccountMessage(reason instanceof Error && reason.message === "INSIGHT_MEMBER_INACTIVE" ? "この参加権はすでに停止されています。" : "処理できませんでした。通信状態を確認してもう一度お試しください。");
    } finally { setBusy(false); setConfirm(null); }
  }

  const primaryHref = memberReady ? "#dashboard" : "#access/insight";
  const primaryLabel = memberReady ? "自分のINSIGHTを開く →" : "ログインしてINSIGHTを開く →";

  return <div className="hub-page"><main>
    <section className="hub-accountbar hub-wrap"><AccountBadge account={memberReady ? activeAccount : null} count={accounts.length} /><div className="hub-account-actions"><button className="login" onClick={() => openAccess(accounts.length ? "switch" : "login")}>ログイン</button><button className="join" onClick={() => openAccess("apply")}>参加</button><button className="minor" disabled={!memberReady} onClick={() => setConfirm("logout")}>ログアウト</button><button className="minor danger" disabled={!memberReady} onClick={() => setConfirm("leave")}>退会</button></div></section>
    {accountMessage ? <div className="hub-account-message hub-wrap">{accountMessage}</div> : null}

    <section className="hub-hero hub-wrap"><p>NOTE CREATOR ANALYTICS</p><h1>無名S note<br />INSIGHT</h1><span>noteの反応を「誰が・どの記事に・どれだけ応援しているか」まで蓄積して見る、参加制のクリエイター分析ツール。</span></section>

    <section className="hub-wrap" style={{ paddingBottom: 16 }}><article className="hub-entrance" style={{ maxWidth: 900, margin: "0 auto", minHeight: 0, borderColor: "#486522" }}><small style={{ color: "#b6ff38" }}>MEMBER ACCESS</small><h2>INSIGHT</h2><p>参加申請後、OWNER承認とnote自己紹介欄を使った本人確認を行います。認証後は本人専用INSIGHTを利用でき、同じ端末ではログイン状態を長期保持します。</p><ParticipantRail people={people} loading={loading}/><a className="hub-open" href={primaryHref} style={{ background: "#b6ff38" }} onClick={(event) => { if (!memberReady) { event.preventDefault(); openAccess("login"); } }}>{primaryLabel}</a></article></section>

    <section className="hub-wrap hub-steps">
      {[["01","参加申請","固定URLから、自分のnote IDで参加申請します。"],["02","OWNER承認","申請はOWNER専用管理ページに届き、確認後に承認します。"],["03","noteで本人確認","発行コードを自己紹介欄へ一時掲載し、本人確認します。"],["04","利用開始","確認後は自己紹介を元に戻せます。本人アイコンがTOP参加者一覧へ追加されます。"]].map(([no,title,copy]) => <article key={no}><small>{no}</small><strong>{title}</strong><p>{copy}</p></article>)}
    </section>

    <section className="hub-wrap hub-cross"><article><small>CROSS PLATFORM</small><h2>端末・ブラウザを固定しない</h2><p>本人確認後のnote ID＋個別パスコードで、別のスマホ・PC・ブラウザからもログインできます。この端末では複数アカウントを保存し、ログアウトせず切り替えられます。</p></article></section>
  </main><ConfirmDialog action={confirm} account={activeAccount} busy={busy} onCancel={() => setConfirm(null)} onYes={() => void confirmAction()} /></div>;
}
