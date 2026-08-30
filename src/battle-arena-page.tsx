import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandBattle } from "./game-command";
import { deriveCardStats } from "./game-card-engine";
import { loadCreatorGame } from "./game-data-client";
import { loadMyBattleData, loadPublicRanking, recordBattle } from "./game-ledger-client";
import type { BattleHistoryRow, BattleRanking, RankingRow } from "./game-ledger-client";
import { MatchBattle } from "./game-match-view";
import { TapRushBattle } from "./game-tap";
import { TargetRushBattle } from "./game-target-view";
import type { GameResult, GameSessionProps } from "./game-ui";
import type { CreatorGameData, GameCard, GameCreator, GameMode } from "./game-types";

const games = [
  ["choice", "COMMAND", "TACTICAL", "予告された攻撃を読み、属性・ガード・SIGNATUREで7ラウンドを制圧"],
  ["tap", "TAP RUSH", "REFLEX", "収縮するビートをPERFECTでつなぎ、FEVER中にコアを破壊"],
  ["puzzle", "ARCANE PUZZLE", "MATCH 3", "6×6盤面をタップ/スワイプ。連鎖・シールド・NOVAで攻防"],
  ["shoot", "STAR SHOOTER", "AIM", "動く星をロックオン。命中率とコンボを守り、ボスを撃破"],
] as const;

type Foe = { id: string; type: "official" | "creator"; name: string; rarity: string; image_url: string | null; cards: GameCard[] };
const modeName: Record<GameMode, string> = { choice: "COMMAND", tap: "TAP RUSH", puzzle: "ARCANE PUZZLE", shoot: "STAR SHOOTER" };
function resultJa(value: GameResult) { return value === "win" ? "勝利" : value === "draw" ? "引分" : "敗北"; }
function dateJa(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "日時不明" : new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function Art({ src, label }: { src?: string | null; label: string }) {
  return src ? <img src={src} alt="" /> : <span className="premium-art-fallback"><b>{label.slice(0, 1)}</b><small>{label}</small></span>;
}
function Hp({ enemy = false }: { enemy?: boolean }) { return <span className={`premium-hp ${enemy ? "enemy" : ""}`}><i /></span>; }
function CommandPreview({ playerArt, enemyArt }: { playerArt?: string | null; enemyArt?: string | null }) {
  return <div className="premium-screen command-premium"><div className="premium-topline"><span>ROUND 03 / 07</span><b>COMMAND</b><span>SIGNATURE 100%</span></div><div className="command-stage"><section className="command-side enemy"><div className="hud-name"><small>RIVAL INTENT</small><strong>STRIKE · VOLT</strong><Hp enemy /></div><div className="premium-card tilt-enemy"><Art src={enemyArt} label="RIVAL" /><span className="card-glass" /></div></section><div className="battle-center"><i className="battle-ray" /><strong>PERFECT<br />COUNTER</strong><b>VS</b><em>CRITICAL!</em></div><section className="command-side you"><div className="premium-card tilt-you"><Art src={playerArt} label="TRIAL" /><span className="card-glass" /></div><div className="hud-name"><small>LINK ×3</small><strong>CREATOR</strong><Hp /></div></section></div><div className="command-dock"><button><b>⚔</b><span>ATTACK</span><small>属性攻撃</small></button><button><b>⬡</b><span>GUARD</span><small>軽減・反撃</small></button><button><b>✦</b><span>SIGNATURE</span><small>必殺技</small></button></div></div>;
}
function TapPreview({ art }: { art?: string | null }) {
  return <div className="premium-screen tap-premium"><div className="premium-topline"><span>TIME 12.42</span><b>TAP RUSH</b><span>ACC 96%</span></div><div className="tap-battlefield"><div className="tap-card-bg"><Art src={art} label="CORE" /><span /></div><div className="combo-readout"><small>COMBO</small><strong>×48</strong><em>FEVER!</em></div><div className="tap-core-premium"><i /><i /><i /><b>TAP!</b><span>PERFECT</span></div><div className="tap-impact i1" /><div className="tap-impact i2" /><div className="tap-impact i3" /></div><div className="fever-meter"><span>FEVER GAUGE</span><i><b /></i><strong>86%</strong></div></div>;
}
function PuzzlePreview({ playerArt, enemyArt }: { playerArt?: string | null; enemyArt?: string | null }) {
  const gems = [0, 1, 2, 3, 4, 1, 3, 0, 2, 4, 2, 2, 4, 1, 0, 3, 4, 1, 3, 0, 1, 0, 2, 4, 3, 4, 3, 1, 0, 2];
  return <div className="premium-screen puzzle-premium"><div className="premium-topline"><span>CHAIN 12</span><b>ARCANE PUZZLE</b><span>SHIELD 38</span></div><div className="puzzle-duel"><div className="puzzle-fighter"><div className="premium-card mini"><Art src={playerArt} label="YOU" /></div><Hp /></div><div className="puzzle-burst"><small>12 CHAIN</small><strong>ARCANE<br />NOVA</strong><em>4,820</em></div><div className="puzzle-fighter"><div className="premium-card mini enemy"><Art src={enemyArt} label="RIVAL" /></div><Hp enemy /></div></div><div className="premium-board">{gems.map((gem, index) => <i key={index} className={`gem gem-${gem}`}><span /></i>)}</div><div className="skill-gauge"><span>ULTIMATE</span><i><b /></i><strong>READY</strong></div></div>;
}
function ShootPreview({ art }: { art?: string | null }) {
  return <div className="premium-screen shoot-premium"><div className="premium-topline"><span>SCORE 124,800</span><b>STAR SHOOTER</b><span>ACC 94%</span></div><div className="shoot-arena"><div className="boss-card"><Art src={art} label="BOSS" /><span /></div><div className="boss-hud"><small>PILOT SHIELD 72</small><strong>PHASE 2</strong><Hp enemy /></div><i className="shoot-target t1" /><i className="shoot-target t2" /><i className="shoot-target t3" /><div className="premium-crosshair"><span /><span /><b /></div><strong className="shoot-critical">CRITICAL<br /><em>9,640</em></strong><div className="shot-trail st1" /><div className="shot-trail st2" /></div><div className="shoot-footer"><span>COMBO ×19</span><strong>LOCK ON</strong><span>NOVA 74%</span></div></div>;
}

function GameModeCard({ mode, title, tag, desc, playerArt, enemyArt, onPlay, ranked }: { mode: GameMode; title: string; tag: string; desc: string; playerArt?: string | null; enemyArt?: string | null; onPlay: () => void; ranked: boolean }) {
  return <article className={`game-concept premium-concept concept-${mode}`}><header className="concept-caption"><small>{tag} · PLAYABLE</small><strong>{title}</strong><span>{desc}</span></header>{mode === "choice" ? <CommandPreview playerArt={playerArt} enemyArt={enemyArt} /> : mode === "tap" ? <TapPreview art={enemyArt} /> : mode === "puzzle" ? <PuzzlePreview playerArt={playerArt} enemyArt={enemyArt} /> : <ShootPreview art={enemyArt} />}<button className="concept-enter" onClick={onPlay}>{ranked ? "RANKED MATCH  →" : "TRIAL PLAY  →"}</button></article>;
}

function AccessGate({ error, loading, onRetry }: { error: string; loading: boolean; onRetry: () => void }) {
  const card = /CARD|OPT_IN/.test(error);
  const invite = /INVITE|APPROVAL/.test(error);
  const title = loading ? "カードデッキを接続中" : card ? "カード登録を完了してください" : invite ? "名鑑の承認が必要です" : "RANKED MATCHは参加者限定";
  const message = loading ? "プロフィール画像ではなく、名鑑へ登録した本人カードだけを確認しています。" : card ? "本人の名鑑でカードを1〜3枚登録し、ゲーム対戦をONにすると戦績付き対戦が開きます。" : "下の4ゲームはTRIALで今すぐ操作できます。TRIALは参加者データを取得せず、戦績にも保存しません。";
  return <section className={`g4-game-gate g5-access-gate ${error ? "error" : ""}`}><span className="g4-gate-orb">✦</span><div><small>SECURE PLAYER GATE</small><h2>{title}</h2><p>{message}</p><div className="g5-gate-actions">{!loading ? <button onClick={onRetry}>状態を再確認</button> : null}<a href={`${import.meta.env.BASE_URL}directory-member.html?v=8`}>自分のカード管理 →</a></div></div>{loading ? <i /> : null}</section>;
}

function Stats({ row }: { row: RankingRow }) {
  return <div className="g5-game-splits">{(Object.keys(modeName) as GameMode[]).map((mode) => { const value = row.byGame?.[mode]; return <span key={mode}><small>{modeName[mode]}</small><b>{value?.wins || 0}W</b><em>{value?.losses || 0}L · {value?.winRate || 0}%</em></span>; })}</div>;
}

export function BattleArenaPage() {
  const [data, setData] = useState<CreatorGameData>({ opponents: [], creators: [] });
  const [player, setPlayer] = useState<GameCreator | null>(null);
  const [mode, setMode] = useState<GameMode | null>(null);
  const [demo, setDemo] = useState(false);
  const [enemy, setEnemy] = useState(0);
  const [cardPosition, setCardPosition] = useState(0);
  const [enemyCardPosition, setEnemyCardPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ranking, setRanking] = useState<BattleRanking | null>(null);
  const [history, setHistory] = useState<BattleHistoryRow[]>([]);
  const [reload, setReload] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const gameFrame = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void (async () => {
      try {
        const game = await loadCreatorGame();
        if (!live) return;
        setData(game.data); setPlayer(game.playerCreator); setError(game.error || "");
        const first = game.playerCreator?.images.find((card) => card.url);
        if (first) setCardPosition(first.position);
      } catch (reason) {
        if (live) setError(reason instanceof Error ? reason.message : "GAME_DATA_ERROR");
      } finally {
        if (live) setLoading(false);
      }
      try {
        const mine = await loadMyBattleData();
        if (live) { setRanking(mine.ranking); setHistory(mine.history); }
      } catch {
        try { const publicRanking = await loadPublicRanking(); if (live) setRanking(publicRanking); } catch { /* Ranking outage must not block games. */ }
      }
    })();
    return () => { live = false; };
  }, [reload]);

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const foes = useMemo<Foe[]>(() => {
    const creators = data.creators.filter((creator) => creator.id !== player?.id && creator.images.some((card) => card.url)).map((creator) => ({ id: creator.id, type: "creator" as const, name: creator.display_name || creator.note_id, rarity: creator.rarity || "CREATOR", image_url: creator.images.find((card) => card.url)?.url || null, cards: creator.images.filter((card) => card.url).sort((a, b) => a.position - b.position) }));
    const officials = data.opponents.map((opponent) => ({ id: opponent.id, type: "official" as const, name: opponent.name, rarity: opponent.rarity || "OFFICIAL", image_url: opponent.image_url, cards: (opponent.cards?.length ? opponent.cards : [{ position: 0, url: opponent.image_url }]).filter((card) => card.url) }));
    return [...creators, ...officials];
  }, [data, player]);
  useEffect(() => { if (enemy >= foes.length) setEnemy(0); }, [enemy, foes.length]);

  const foe = foes[Math.min(enemy, Math.max(0, foes.length - 1))] || null;
  const playerCards = useMemo(() => (player?.images ?? []).filter((item) => item.url).sort((a, b) => a.position - b.position), [player]);
  useEffect(() => { if (playerCards.length && !playerCards.some((item) => item.position === cardPosition)) setCardPosition(playerCards[0].position); }, [cardPosition, playerCards]);
  useEffect(() => {
    const first = foe?.cards.find((card) => card.url);
    setEnemyCardPosition(first?.position ?? 0);
  }, [foe?.id, foe?.type]);
  const playerCard = playerCards.find((item) => item.position === cardPosition) || playerCards[0] || null;
  const enemyCard = foe?.cards.find((card) => card.position === enemyCardPosition && card.url) || foe?.cards.find((card) => card.url) || null;
  const canPlay = Boolean(!error && playerCard?.url && foe && enemyCard?.url);
  const playerName = player?.display_name || player?.note_id || "CREATOR";
  const playerStats = useMemo(() => deriveCardStats(playerCard?.url, playerCard?.position ?? 0, playerName), [playerCard, playerName]);
  const enemyStats = useMemo(() => deriveCardStats(enemyCard?.url, enemyCard?.position ?? 0, foe?.name || "RIVAL"), [enemyCard, foe?.name]);

  const complete = useCallback(async (gameMode: GameMode, result: GameResult, score: number) => {
    if (!foe || !playerCard || !enemyCard) throw new Error("OPPONENT_NOT_AVAILABLE");
    const saved = await recordBattle({ gameMode, result, score, opponentType: foe.type, opponentId: foe.id, playerCardPosition: playerCard.position, opponentCardPosition: foe.type === "official" ? 0 : enemyCard.position });
    if (Array.isArray(saved.history)) setHistory(saved.history);
    if (saved.ranking) setRanking(saved.ranking);
    return saved;
  }, [enemyCard, foe, playerCard]);

  const rankedSession = useMemo<Omit<GameSessionProps, "onComplete"> | null>(() => playerCard?.url && foe && enemyCard?.url ? {
    playerArt: playerCard.url, enemyArt: enemyCard.url, playerName, enemyName: foe.name,
    playerCardPosition: playerCard.position, playerStats, enemyStats, ranked: true,
  } : null, [enemyCard, enemyStats, foe, playerCard, playerName, playerStats]);
  const trialSession = useMemo<Omit<GameSessionProps, "onComplete">>(() => ({
    playerArt: "", enemyArt: null, playerName: "TRIAL CREATOR", enemyName: "TRAINING CORE",
    playerCardPosition: 0, playerStats: deriveCardStats("trial-player", 0, "TRIAL CREATOR"), enemyStats: deriveCardStats("trial-rival", 0, "TRAINING CORE"), ranked: false,
  }), []);
  const session = demo ? trialSession : rankedSession;
  const totals = useMemo(() => (ranking?.rows || []).reduce((sum, row) => ({ wins: sum.wins + row.wins, draws: sum.draws + row.draws, losses: sum.losses + row.losses, games: sum.games + row.games }), { wins: 0, draws: 0, losses: 0, games: 0 }), [ranking]);

  function start(gameMode: GameMode) {
    setDemo(!canPlay); setMode(gameMode);
    window.setTimeout(() => gameFrame.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await gameFrame.current?.requestFullscreen();
    } catch { /* Fullscreen is optional on browsers that do not expose it. */ }
  }

  return <div className="creator-world"><link rel="stylesheet" href={`${import.meta.env.BASE_URL}creator-world.css`} /><link rel="stylesheet" href={`${import.meta.env.BASE_URL}creator-world-premium.css`} /><link rel="stylesheet" href={`${import.meta.env.BASE_URL}creator-world-concept-v2.css`} /><link rel="stylesheet" href={`${import.meta.env.BASE_URL}creator-world-game-v4.css?v=4`} /><link rel="stylesheet" href={`${import.meta.env.BASE_URL}creator-world-game-v5.css?v=5`} /><main>
    <header className="world-hero g5-world-hero"><small>CREATOR BATTLE SYSTEM · SEASON 01</small><h1>CREATOR <span>WORLD</span></h1><p>名鑑へ本人が登録したカードだけで戦う、4つの現代スマホゲーム。全モードを公開TRIALで試せます。参加者のRANKED MATCHだけが戦績へ記録されます。</p><div className="g5-hero-tags"><span>4 LIVE GAMES</span><span>3 CARD DECK</span><span>PRIVATE MATCH LOG</span></div></header>
    {loading || error ? <AccessGate error={error} loading={loading} onRetry={() => setReload((value) => value + 1)} /> : <section className="g5-player-ready"><small>PLAYER VERIFIED</small><strong>{playerName}</strong><span>{playerCards.length} CARD DECK · RANKED READY</span></section>}
    {!loading && canPlay ? <>
      <section className="g4-deck-section g5-deck-section"><div className="world-heading"><div><small>SELECT YOUR CARD · MAX 3</small><h2>自分のカード</h2><p>名鑑へ登録した1〜3枚から使用カードを選択。プロフィール画像は代用しません。</p></div></div><div className="g4-player-deck">{playerCards.map((card) => <button key={card.position} className={cardPosition === card.position ? "active" : ""} onClick={() => { setCardPosition(card.position); setMode(null); }}>{card.url ? <img src={card.url} alt={`カード${card.position + 1}`} /> : null}<span>CARD {card.position + 1}</span></button>)}</div><div className="g5-selected-stats">{([["ATK", playerStats.power], ["DEF", playerStats.guard], ["SPD", playerStats.speed], ["FOC", playerStats.focus]] as const).map(([label, value]) => <span key={label}><small>{label}</small><b>{value}</b><i><em style={{ width: `${value}%` }} /></i></span>)}<strong>{playerStats.signature}</strong></div></section>
      <section className="g5-rival-section"><div className="world-heading"><div><small>SELECT RIVAL</small><h2>対戦相手とカード</h2><p>参加者同士、または無名S note公式カードと対戦。</p></div></div><div className="enemy-strip">{foes.map((item, index) => <button key={`${item.type}-${item.id}`} className={enemy === index ? "active" : ""} onClick={() => { setEnemy(index); setMode(null); }}>{item.image_url ? <img src={item.image_url} alt="" /> : <span />}<b>{item.name}</b><small>{item.type === "creator" ? "参加者" : "公式"} · {item.rarity}</small></button>)}</div>{foe && foe.cards.length > 1 ? <div className="g5-rival-deck"><small>{foe.name} · 使用カードを選択</small><div>{foe.cards.map((card) => <button key={card.position} className={enemyCard?.position === card.position ? "active" : ""} onClick={() => { setEnemyCardPosition(card.position); setMode(null); }}>{card.url ? <img src={card.url} alt={`相手カード${card.position + 1}`} /> : null}<span>CARD {card.position + 1}</span></button>)}</div></div> : null}</section>
    </> : null}
    {!mode ? <section className="mode-select g5-mode-select"><div className="world-heading"><div><small>CHOOSE GAME MODE</small><h2>4つのゲーム</h2><p>{canPlay ? "選択カードでRANKED MATCH。勝敗・スコア・カード履歴を保存します。" : "参加前でも全ゲームをTRIAL操作できます。参加者情報・戦績保存は使いません。"}</p></div></div><div className="concept-grid premium-grid">{games.map((game) => <GameModeCard key={game[0]} mode={game[0]} title={game[1]} tag={game[2]} desc={game[3]} playerArt={canPlay ? playerCard?.url : null} enemyArt={canPlay ? enemyCard?.url : null} onPlay={() => start(game[0])} ranked={canPlay} />)}</div></section> : null}
    {mode && session ? <section className="active-game g4-active g5-active" ref={gameFrame}><div className="g5-game-toolbar"><button className="mode-back" onClick={() => setMode(null)}>← 4ゲームへ</button><div><small>{demo ? "TRIAL · NO RECORD" : "RANKED MATCH"}</small><strong>{modeName[mode]}</strong></div><button onClick={toggleFullscreen}>{fullscreen ? "全画面終了" : "全画面"}</button></div><div className="g4-match-label"><span>{session.playerName}</span><b>VS</b><span>{session.enemyName}</span></div><div className="game-console g4-console" key={`${demo ? "demo" : "ranked"}-${mode}-${foe?.type}-${foe?.id}-${playerCard?.position}-${enemyCard?.position}`}>{mode === "choice" ? <CommandBattle {...session} onComplete={(result, score) => demo ? Promise.resolve() : complete("choice", result, score)} /> : mode === "tap" ? <TapRushBattle {...session} onComplete={(result, score) => demo ? Promise.resolve() : complete("tap", result, score)} /> : mode === "puzzle" ? <MatchBattle {...session} onComplete={(result, score) => demo ? Promise.resolve() : complete("puzzle", result, score)} /> : <TargetRushBattle {...session} onComplete={(result, score) => demo ? Promise.resolve() : complete("shoot", result, score)} />}</div></section> : null}
    <section className="g5-public-summary"><header><small>PUBLIC SEASON RECORD</small><h2>全体戦績</h2><p>特定相手との詳細は公開しません。</p></header><div><span><small>WIN</small><b>{totals.wins}</b></span><span><small>LOSE</small><b>{totals.losses}</b></span><span><small>DRAW</small><b>{totals.draws}</b></span><span><small>WIN RATE</small><b>{totals.games ? Math.round(totals.wins / totals.games * 1000) / 10 : 0}%</b></span></div></section>
    <section className="g4-stats-zone g5-stats-zone"><article className="g4-stats-panel"><h3>公開ランキング</h3><small>勝利3点・引分1点。総合とゲーム別成績だけを公開。</small>{ranking?.rows?.length ? ranking.rows.slice(0, 20).map((row) => <details className="g5-rank-card" key={row.participantId}><summary><b>#{row.rank}</b>{row.mainCardUrl ? <img src={row.mainCardUrl} alt="" /> : <span />}<strong>{row.displayName}</strong><small>{row.wins}勝 {row.losses}敗 · {row.winRate}%</small><em>{row.points} PT</em></summary><Stats row={row} /></details>) : <p>戦績はまだありません。</p>}</article><article className="g4-stats-panel"><div className="g4-stats-title"><h3>自分の対戦履歴</h3><span>本人だけ</span></div><small>相手・ゲーム・勝敗・日時・両カード・スコアは本人画面だけに表示。</small>{history.length ? history.slice(0, 20).map((row) => <div className="g5-history-card" key={row.id}><div className="g5-history-cards">{row.playerCard.url ? <img src={row.playerCard.url} alt="自分の使用カード" /> : <span>YOU</span>}<b>VS</b>{row.opponent.cardUrl ? <img src={row.opponent.cardUrl} alt="相手の使用カード" /> : <span>RIVAL</span>}</div><div><strong>{row.opponent.name}</strong><small>{modeName[row.gameMode]} · {dateJa(row.createdAt)}</small><em>自分 CARD {row.playerCard.position + 1} / 相手 CARD {row.opponent.cardPosition + 1} · SCORE {row.score.toLocaleString()}</em></div><b className={`is-${row.result}`}>{resultJa(row.result)}</b></div>) : <p>{error ? "ログイン後、本人だけに表示されます。" : "保存済みの対戦履歴はありません。"}</p>}</article></section>
  </main></div>;
}
