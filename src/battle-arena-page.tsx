import { useCallback, useEffect, useMemo, useState } from "react";
import { CommandBattle } from "./game-command";
import { loadCreatorGame } from "./game-data-client";
import { loadMyBattleData, loadPublicRanking, recordBattle } from "./game-ledger-client";
import type { BattleHistoryRow, BattleRanking } from "./game-ledger-client";
import { MatchBattle } from "./game-match-view";
import { TapRushBattle } from "./game-tap";
import { TargetRushBattle } from "./game-target-view";
import type { GameResult, GameSessionProps } from "./game-ui";
import type { CreatorGameData, GameCard, GameCreator, GameMode } from "./game-types";

const games = [
  ["choice", "COMMAND", "属性を読み、攻撃・防御・必殺技で7ラウンドを戦う"],
  ["tap", "TAP RUSH", "移動ターゲットを追い、コンボからFEVERへつなぐ"],
  ["puzzle", "ARCANE PUZZLE", "6×6実盤面を連鎖させ、カード同士でダメージ交換"],
  ["shoot", "STAR SHOOTER", "照準を動かし、星を撃ち抜いてボスカードを攻略"],
] as const;

type Foe = { id: string; type: "official" | "creator"; name: string; rarity: string; image_url: string | null; cards: GameCard[] };
function resultJa(value: GameResult) { return value === "win" ? "勝利" : value === "draw" ? "引分" : "敗北"; }
function dateJa(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "日時不明" : new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function Art({ src, label }: { src?: string | null; label: string }) {
  return src ? <img src={src} alt="" /> : <span className="premium-art-fallback">{label}</span>;
}
function Hp({ enemy = false }: { enemy?: boolean }) { return <span className={`premium-hp ${enemy ? "enemy" : ""}`}><i /></span>; }
function CommandPreview({ playerArt, enemyArt }: { playerArt?: string | null; enemyArt?: string | null }) {
  return <div className="premium-screen command-premium"><div className="premium-topline"><span>ROUND 03 / 07</span><b>COMMAND</b><span>ULTIMATE 100%</span></div><div className="command-stage"><section className="command-side enemy"><div className="hud-name"><small>OPPONENT</small><strong>ENEMY</strong><Hp enemy /></div><div className="premium-card tilt-enemy"><Art src={enemyArt} label="ENEMY CARD" /><span className="card-glass" /></div></section><div className="battle-center"><i className="battle-ray" /><strong>SKILL<br />ACTIVATED</strong><b>VS</b><em>CRITICAL!</em></div><section className="command-side you"><div className="premium-card tilt-you"><Art src={playerArt} label="YOUR CARD" /><span className="card-glass" /></div><div className="hud-name"><small>YOU</small><strong>CREATOR</strong><Hp /></div></section></div><div className="command-dock"><button><b>⚔</b><span>ATTACK</span><small>属性攻撃</small></button><button><b>⬡</b><span>DEFEND</span><small>軽減・反撃</small></button><button><b>✦</b><span>SKILL</span><small>必殺技</small></button></div></div>;
}
function TapPreview({ art }: { art?: string | null }) {
  return <div className="premium-screen tap-premium"><div className="premium-topline"><span>TIME 06.42</span><b>TAP RUSH</b><span>SCORE 28,640</span></div><div className="tap-battlefield"><div className="tap-card-bg"><Art src={art} label="BATTLE CARD" /><span /></div><div className="combo-readout"><small>COMBO</small><strong>×48</strong><em>FEVER!</em></div><div className="tap-core-premium"><i /><i /><i /><b>TAP!</b><span>PERFECT</span></div><div className="tap-impact i1" /><div className="tap-impact i2" /><div className="tap-impact i3" /></div><div className="fever-meter"><span>FEVER GAUGE</span><i><b /></i><strong>86%</strong></div></div>;
}
function PuzzlePreview({ playerArt, enemyArt }: { playerArt?: string | null; enemyArt?: string | null }) {
  const gems = [0, 1, 2, 3, 4, 1, 3, 0, 2, 4, 2, 2, 4, 1, 0, 3, 4, 1, 3, 0, 1, 0, 2, 4, 3, 4, 3, 1, 0, 2];
  return <div className="premium-screen puzzle-premium"><div className="premium-topline"><span>CHAIN 12</span><b>ARCANE PUZZLE</b><span>SKILL 92%</span></div><div className="puzzle-duel"><div className="puzzle-fighter"><div className="premium-card mini"><Art src={playerArt} label="YOU" /></div><Hp /></div><div className="puzzle-burst"><small>12 CHAIN</small><strong>ARCANE<br />BURST</strong><em>4,820</em></div><div className="puzzle-fighter"><div className="premium-card mini enemy"><Art src={enemyArt} label="ENEMY" /></div><Hp enemy /></div></div><div className="premium-board">{gems.map((gem, index) => <i key={index} className={`gem gem-${gem}`}><span /></i>)}</div><div className="skill-gauge"><span>ULTIMATE</span><i><b /></i><strong>READY</strong></div></div>;
}
function ShootPreview({ art }: { art?: string | null }) {
  return <div className="premium-screen shoot-premium"><div className="premium-topline"><span>SCORE 124,800</span><b>STAR SHOOTER</b><span>COMBO ×19</span></div><div className="shoot-arena"><div className="boss-card"><Art src={art} label="BOSS CARD" /><span /></div><div className="boss-hud"><small>BOSS</small><strong>PHASE 2</strong><Hp enemy /></div><i className="shoot-target t1" /><i className="shoot-target t2" /><i className="shoot-target t3" /><div className="premium-crosshair"><span /><span /><b /></div><strong className="shoot-critical">CRITICAL<br /><em>9,640</em></strong><div className="shot-trail st1" /><div className="shot-trail st2" /></div><div className="shoot-footer"><span>BOOST ◆◆◆◇</span><strong>LOCK ON</strong><span>ULTIMATE 74%</span></div></div>;
}

function GameModeCard({ mode, title, desc, playerArt, enemyArt, onPlay, canPlay }: { mode: GameMode; title: string; desc: string; playerArt?: string | null; enemyArt?: string | null; onPlay: () => void; canPlay: boolean }) {
  return <article className={`game-concept premium-concept concept-${mode}`}><header className="concept-caption"><small>PLAYABLE GAME MODE</small><strong>{title}</strong><span>{desc}</span></header>{mode === "choice" ? <CommandPreview playerArt={playerArt} enemyArt={enemyArt} /> : mode === "tap" ? <TapPreview art={enemyArt} /> : mode === "puzzle" ? <PuzzlePreview playerArt={playerArt} enemyArt={enemyArt} /> : <ShootPreview art={enemyArt} />}<button className="concept-enter" disabled={!canPlay} onClick={onPlay}>{canPlay ? "PLAY NOW  →" : "承認済みカード登録後に参加"}</button></article>;
}

function GameLoading({ error }: { error: string }) {
  return <section className={`g4-game-gate ${error ? "error" : ""}`}><span className="g4-gate-orb">✦</span><h2>{error ? "ゲームデータを開けません" : "カードデッキを接続中"}</h2><p>{error ? (error.includes("CARD") ? "本人の名鑑でカードを登録し、ゲーム参加をONにしてください。" : "INSIGHT本人認証と名鑑の承認状態を確認してください。") : "プロフィール画像ではなく、名鑑へ登録した本人カードだけを読み込みます。"}</p>{error ? <a href={`${import.meta.env.BASE_URL}directory-member.html?v=8`}>自分のカード管理を開く →</a> : <i />}</section>;
}

export function BattleArenaPage() {
  const [data, setData] = useState<CreatorGameData>({ opponents: [], creators: [] });
  const [player, setPlayer] = useState<GameCreator | null>(null);
  const [mode, setMode] = useState<GameMode | null>(null);
  const [enemy, setEnemy] = useState(0);
  const [cardPosition, setCardPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ranking, setRanking] = useState<BattleRanking | null>(null);
  const [history, setHistory] = useState<BattleHistoryRow[]>([]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const game = await loadCreatorGame();
        if (!live) return;
        setData(game.data);
        setPlayer(game.playerCreator);
        setError(game.error || "");
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
        try { const publicRanking = await loadPublicRanking(); if (live) setRanking(publicRanking); } catch { /* Keep games usable if rankings are temporarily unavailable. */ }
      }
    })();
    return () => { live = false; };
  }, []);

  const foes = useMemo<Foe[]>(() => {
    const creators = data.creators
      .filter((creator) => creator.id !== player?.id && creator.images.some((card) => card.url))
      .map((creator) => ({ id: creator.id, type: "creator" as const, name: creator.display_name || creator.note_id, rarity: creator.rarity || "CREATOR", image_url: creator.images.find((card) => card.url)?.url || null, cards: creator.images.filter((card) => card.url) }));
    const officials = data.opponents.map((opponent) => ({ id: opponent.id, type: "official" as const, name: opponent.name, rarity: opponent.rarity || "OFFICIAL", image_url: opponent.image_url, cards: (opponent.cards?.length ? opponent.cards : [{ position: 0, url: opponent.image_url }]).filter((card) => card.url) }));
    return [...creators, ...officials];
  }, [data, player]);
  useEffect(() => { if (enemy >= foes.length) setEnemy(0); }, [enemy, foes.length]);

  const foe = foes[Math.min(enemy, Math.max(0, foes.length - 1))] || null;
  const playerCards = useMemo(() => (player?.images ?? []).filter((item) => item.url).sort((a, b) => a.position - b.position), [player]);
  useEffect(() => { if (playerCards.length && !playerCards.some((item) => item.position === cardPosition)) setCardPosition(playerCards[0].position); }, [cardPosition, playerCards]);
  const playerCard = playerCards.find((item) => item.position === cardPosition) || playerCards[0] || null;
  const enemyCard = foe?.cards.find((card) => card.url) || null;
  const canPlay = Boolean(playerCard?.url && foe && enemyCard?.url);

  const complete = useCallback(async (gameMode: GameMode, result: GameResult, score: number) => {
    if (!foe || !playerCard || !enemyCard) throw new Error("OPPONENT_NOT_AVAILABLE");
    const saved = await recordBattle({ gameMode, result, score, opponentType: foe.type, opponentId: foe.id, playerCardPosition: playerCard.position, opponentCardPosition: foe.type === "official" ? 0 : enemyCard.position });
    if (Array.isArray(saved.history)) setHistory(saved.history);
    if (saved.ranking) setRanking(saved.ranking);
    return saved;
  }, [enemyCard, foe, playerCard]);

  const session = useMemo<Omit<GameSessionProps, "onComplete"> | null>(() => playerCard?.url && foe && enemyCard?.url ? {
    playerArt: playerCard.url,
    enemyArt: enemyCard.url,
    playerName: player?.display_name || player?.note_id || "CREATOR",
    enemyName: foe.name,
    playerCardPosition: playerCard.position,
  } : null, [enemyCard, foe, player, playerCard]);

  return <div className="creator-world"><link rel="stylesheet" href={`${import.meta.env.BASE_URL}creator-world.css`} /><link rel="stylesheet" href={`${import.meta.env.BASE_URL}creator-world-premium.css`} /><link rel="stylesheet" href={`${import.meta.env.BASE_URL}creator-world-concept-v2.css`} /><link rel="stylesheet" href={`${import.meta.env.BASE_URL}creator-world-game-v4.css?v=4`} /><main>
    <header className="world-hero"><small>BATTLE ARENA · LIVE GAME</small><h1>CREATOR <span>WORLD</span></h1><p>名鑑へ本人が登録した承認済みカードだけで戦う、4つの現代スマホゲーム。操作・勝ち方・必殺技はすべて別物です。</p></header>
    {loading || error ? <GameLoading error={error} /> : <>
      <section className="g4-deck-section"><div className="world-heading"><div><small>SELECT YOUR CARD</small><h2>使用カード</h2><p>本人が登録した最大3枚から、今回使う1枚を選択。</p></div></div><div className="g4-player-deck">{playerCards.map((card) => <button key={card.position} className={cardPosition === card.position ? "active" : ""} onClick={() => { setCardPosition(card.position); setMode(null); }}>{card.url ? <img src={card.url} alt={`カード${card.position + 1}`} /> : null}<span>CARD {card.position + 1}</span></button>)}</div></section>
      <section><div className="world-heading"><div><small>SELECT RIVAL CARD</small><h2>対戦カード</h2></div></div><div className="enemy-strip">{foes.map((item, index) => <button key={`${item.type}-${item.id}`} className={enemy === index ? "active" : ""} onClick={() => { setEnemy(index); setMode(null); }}>{item.image_url ? <img src={item.image_url} alt="" /> : <span />}<b>{item.name}</b><small>{item.type === "creator" ? "参加者" : "公式"} · {item.rarity}</small></button>)}</div></section>
      {!mode ? <section className="mode-select"><div className="world-heading"><div><small>CHOOSE GAME MODE</small><h2>4つのゲーム</h2><p>BATTLE STARTから勝敗・EXP・公開戦績まで、実際に動作します。</p></div></div><div className="concept-grid premium-grid">{games.map((game) => <GameModeCard key={game[0]} mode={game[0]} title={game[1]} desc={game[2]} playerArt={playerCard?.url} enemyArt={enemyCard?.url} onPlay={() => setMode(game[0])} canPlay={canPlay} />)}</div></section> : null}
      {mode && session ? <section className="active-game g4-active"><button className="mode-back" onClick={() => setMode(null)}>← ゲーム選択へ</button><div className="g4-match-label"><span>{session.playerName}</span><b>VS</b><span>{session.enemyName}</span></div><div className="game-console g4-console" key={`${mode}-${foe?.type}-${foe?.id}-${playerCard?.position}`}>{mode === "choice" ? <CommandBattle {...session} onComplete={(result, score) => complete("choice", result, score)} /> : mode === "tap" ? <TapRushBattle {...session} onComplete={(result, score) => complete("tap", result, score)} /> : mode === "puzzle" ? <MatchBattle {...session} onComplete={(result, score) => complete("puzzle", result, score)} /> : <TargetRushBattle {...session} onComplete={(result, score) => complete("shoot", result, score)} />}</div></section> : null}
    </>}
    <section className="g4-stats-zone"><article className="g4-stats-panel"><h3>公開ランキング</h3><small>勝利3点・引分1点。対戦相手の詳細は公開しません。</small>{ranking?.rows?.length ? ranking.rows.slice(0, 10).map((row) => <div className="g4-rank-row" key={row.participantId}><b>#{row.rank}</b>{row.mainCardUrl ? <img src={row.mainCardUrl} alt="" /> : <span />}<strong>{row.displayName}</strong><small>{row.wins}勝 {row.losses}敗 · 勝率{row.winRate}%</small></div>) : <p>戦績はまだありません。</p>}</article><article className="g4-stats-panel"><div className="g4-stats-title"><h3>自分の対戦履歴</h3><span>本人だけ</span></div><small>相手・使用カード・日時は本人画面だけに表示。</small>{history.length ? history.slice(0, 12).map((row) => <div className="g4-history-row" key={row.id}>{row.opponent.cardUrl ? <img src={row.opponent.cardUrl} alt="" /> : <span />}<div><strong>{row.opponent.name}</strong><small>{row.gameMode.toUpperCase()} · {dateJa(row.createdAt)}</small></div><b>{resultJa(row.result)}</b></div>) : <p>保存済みの対戦履歴はありません。</p>}</article></section>
  </main></div>;
}
