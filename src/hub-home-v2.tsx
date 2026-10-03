import { useVisibleMotion } from "./insight-visible-motion";
import "./hub-home-intro.css";
import { ParticipantShowcase } from "./hub-participant-showcase";
import { CreatorAvatar } from "./creator-avatar";
import { useEffect, useMemo, useState } from "react";
import {
  EXPLICIT_LOGOUT_KEY_PREFIX,
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
import "./hub-home-v2.css";

const ACCESS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
const SELF = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-self-account";
const OWNER_NOTE_ID = "ss_yr";
type RailPerson = { id: string; noteId: string; name: string; image: string | null; profileUrl: string };
type ConfirmAction = "logout" | "leave" | null;

async function post(endpoint: string, action: string, headers: Record<string, string> = {}) {
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ action }), cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "ACCESS_ERROR");
  return payload;
}

function ParticipantRail({ people, loading, activeNoteId }: { people: RailPerson[]; loading: boolean; activeNoteId: string }) {
  const ordered = useMemo(() => {
    if (!people.length) return [] as RailPerson[];
    const primary = people.find((p) => p.noteId.toLowerCase() === OWNER_NOTE_ID)
      || people.find((p) => p.noteId.toLowerCase() === activeNoteId.toLowerCase())
      || people[0];
    return [primary, ...people.filter((p) => p.id !== primary.id)];
  }, [people, activeNoteId]);
  return <section className="hub-participants hub-participants-v2 is-insight" aria-label="INSIGHT参加クリエイター">
    <div className="hub-participant-heading hub-participant-heading-v2"><strong>参加クリエイター <b>{loading ? "—" : people.length}名</b></strong><small>タップで本人noteへ</small></div>
    {loading ? <div className="hub-participant-loading" role="status"><i /><i /><i /><span>参加クリエイターを確認中</span></div> : !ordered.length ? <p className="hub-participant-empty">本人認証済みの参加クリエイターがここに並びます。</p> : <ParticipantShowcase people={ordered}/>}
  </section>;
}

function AccountBadge({ account, count }: { account: StoredInsightAccount | null; count: number }) {
  return <div className="hub-account-state">{account ? <><CreatorAvatar person={account} name={account.displayName || account.noteId} eager/><div><small>ログイン中</small><b>{account.displayName || `@${account.noteId}`}</b>{count > 1 ? <em>保存済み {count}アカウント</em> : null}</div></> : <div><small>INSIGHT</small><b>未ログイン</b>{count ? <em>保存済み {count}アカウント</em> : null}</div>}</div>;
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
  const heroScene = useVisibleMotion<HTMLElement>();
  const stepsScene = useVisibleMotion<HTMLElement>(), crossScene = useVisibleMotion<HTMLElement>();
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
    void post(ACCESS, "session", { "X-Insight-Token": token }).then(async (payload) => {
      rememberMemberSession(payload.application, token, stored?.passcode); refreshAccounts();
      setAccountMessage("");
      try { await post(SELF, "touch", { "X-Insight-Token": token }); } catch { /* keep persistent login */ }
    }).catch(() => {
      // TOP表示・URL直アクセス・一時通信失敗ではログイン情報を絶対に削除しない。
      // 保存ログインを消すのは、下の明示的なログアウト／退会操作だけ。
      refreshAccounts();
      setAccountMessage("ログイン情報は保持しています。通信確認できない場合は次回自動で再確認します。");
    });
  }, []);

  async function confirmAction() {
    if (!confirm || !activeAccount) { setConfirm(null); return; }
    const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || activeAccount.memberToken || "";
    setBusy(true); setAccountMessage("");
    try {
      if (confirm === "leave") {
        await post(SELF, "leave", { "X-Insight-Token": token });
        forgetInsightAccount(activeAccount.noteId);
        setAccountMessage(`@${activeAccount.noteId} は退会しました。`);
      } else {
        try { await post(SELF, "logout", { "X-Insight-Token": token }); } catch { /* local logout still completes */ }
        localStorage.setItem(EXPLICIT_LOGOUT_KEY_PREFIX + activeAccount.noteId, "1");
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

    <section ref={heroScene.ref} className="hub-hero hub-wrap hub-hero-scene" data-motion={heroScene.motion?"on":"off"}><div className="hub-hero-depth" aria-hidden="true"><i/><i/><i/><i/></div><div className="hub-hero-streaks" aria-hidden="true"><i/><i/><i/></div><div className="hub-hero-sparks" aria-hidden="true">{Array.from({length:9},(_,i)=><i key={i} style={{"--spark":i} as React.CSSProperties}/>)}</div><p>NOTE CREATOR ANALYTICS</p><h1><span>無名S note</span><strong>INSIGHT</strong></h1><span>noteの反応を「誰が・どの記事に・どれだけ応援しているか」まで蓄積して見る、参加制のクリエイター分析ツール。</span></section>

    <section className="hub-wrap hub-members"><article className="hub-entrance" style={{ maxWidth: 900, margin: "0 auto", minHeight: 0, borderColor: "#486522" }}><h2>メンバー紹介</h2><p>参加申請・承認・noteでの本人確認後、自分のINSIGHTを利用できます。ログイン状態はこの端末に保存されます。</p><ParticipantRail people={people} loading={loading} activeNoteId={activeAccount?.noteId || ""}/><a className="hub-open" href={primaryHref} style={{ background: "#b6ff38" }} onClick={(event) => { if (!memberReady) { event.preventDefault(); openAccess("login"); } }}>{primaryLabel}</a></article></section>

    <section ref={stepsScene.ref} className="hub-wrap hub-steps" data-motion={stepsScene.motion ? "on" : "off"}>
      {[["01","参加申請","自分のnote IDで申請。"],["02","OWNER承認","運営者が内容を確認・承認。"],["03","noteで本人確認","発行コードを自己紹介欄へ一時掲載。"],["04","利用開始","自己紹介を戻し、本人アイコンをTOPへ。"]].map(([no,title,copy],i) => <article key={no} style={{ "--step": i } as React.CSSProperties}><small>{no}</small><strong>{title}</strong><p>{copy}</p></article>)}
    </section>

    <section ref={crossScene.ref} className="hub-wrap hub-cross" data-motion={crossScene.motion ? "on" : "off"}><article><small>CROSS PLATFORM</small><h2>どの端末・ブラウザからも</h2><p>同じnote IDで、PC2台でもスマホでも利用できます。新しい端末は「機種変更・再ログイン」から本人確認。保存した履歴は共通で、他の端末もログインしたまま使えます。</p></article></section>
  </main><ConfirmDialog action={confirm} account={activeAccount} busy={busy} onCancel={() => setConfirm(null)} onYes={() => void confirmAction()} /></div>;
}
