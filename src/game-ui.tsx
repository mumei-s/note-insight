import { useEffect, useRef, useState } from "react";
import type { CardStats } from "./game-card-engine";
import { vibrate } from "./game-card-engine";
import type { GameMode } from "./game-types";

export type GameResult = "win" | "draw" | "lose";
export type SaveState = "saving" | "saved" | "error" | "demo";

export type GameSessionProps = {
  playerArt: string;
  enemyArt: string | null;
  playerName: string;
  enemyName: string;
  playerCardPosition: number;
  playerStats: CardStats;
  enemyStats: CardStats;
  ranked: boolean;
  onComplete: (result: GameResult, score: number) => Promise<unknown>;
};

const openingTitles: Record<GameMode, string> = {
  choice: "COMMAND",
  tap: "TAP RUSH",
  puzzle: "ARCANE PUZZLE",
  shoot: "STAR SHOOTER",
  quest: "CREATOR QUEST",
  race: "STAR CIRCUIT",
};

export function useBattlePrelude() {
  const [seed, setSeed] = useState(0);
  const [phase, setPhase] = useState<"start" | "versus" | "live">("start");
  const [manualPaused, setManualPaused] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== "hidden");

  useEffect(() => {
    setPhase("start");
    const versus = window.setTimeout(() => setPhase("versus"), 1120);
    const live = window.setTimeout(() => setPhase("live"), 2850);
    return () => {
      window.clearTimeout(versus);
      window.clearTimeout(live);
    };
  }, [seed]);

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const paused = phase === "live" && (manualPaused || !pageVisible);
  return {
    phase,
    paused,
    togglePause: () => setManualPaused((value) => !value),
    restartPrelude: () => {
      setManualPaused(false);
      setSeed((value) => value + 1);
    },
  };
}

function resolveOpeningArt(root: HTMLDivElement | null) {
  const game = root?.closest(".g4-game");
  const playerInGame = game?.querySelector<HTMLImageElement>(".g4-card.player img");
  const enemyInGame = game?.querySelector<HTMLImageElement>(".g4-card.enemy img");
  const playerSelected = document.querySelector<HTMLImageElement>(".g4-player-deck button.active img");
  const enemySelected = document.querySelector<HTMLImageElement>(".g5-rival-deck button.active img") || document.querySelector<HTMLImageElement>(".enemy-strip button.active img");
  return {
    player: playerInGame?.src || playerSelected?.src || "",
    enemy: enemyInGame?.src || enemySelected?.src || "",
  };
}

function OpeningPortrait({ side, src }: { side: "player" | "enemy"; src: string }) {
  return <div className={`g8-opening-portrait ${side} ${src ? "has-image" : "fallback"}`}>
    {src ? <img src={src} alt="" /> : <span aria-hidden="true" />}
    <i aria-hidden="true" />
  </div>;
}

export function PreludeOverlay({
  phase,
  playerName,
  enemyName,
  playerArt,
  enemyArt,
  mode = "choice",
}: {
  phase: "start" | "versus" | "live";
  playerName: string;
  enemyName: string;
  playerArt?: string | null;
  enemyArt?: string | null;
  mode?: GameMode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [art, setArt] = useState({ player: playerArt || "", enemy: enemyArt || "" });
  const displayPlayer = playerName === "TRIAL CREATOR" ? "無名S note" : playerName;
  const displayEnemy = enemyName === "TRAINING CORE" ? "ちびS" : enemyName;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const resolved = resolveOpeningArt(rootRef.current);
      setArt({ player: playerArt || resolved.player, enemy: enemyArt || resolved.enemy });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [playerName, enemyName, playerArt, enemyArt]);

  if (phase === "live") return null;
  if (phase === "start") {
    return <div ref={rootRef} className={`g4-prelude g8-opening g9-opening mode-${mode} is-start`} aria-live="polite">
      <div className="g8-opening-bg" aria-hidden="true" />
      <OpeningPortrait side="player" src={art.player} />
      <div className="g8-opening-copy">
        <small>CREATOR WORLD ORIGINAL</small>
        <strong className="g8-mode-name">{openingTitles[mode]}</strong>
        <b>{displayPlayer}</b>
        <span>ILLUSTRATION OPENING</span>
      </div>
      <div className="g8-opening-light" aria-hidden="true" />
      <div className="g9-opening-particles" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
      <div className="g8-opening-progress" aria-hidden="true"><i /></div>
    </div>;
  }
  return <div ref={rootRef} className={`g4-prelude g8-opening g9-opening mode-${mode} is-versus`} aria-live="polite">
    <div className="g8-opening-bg" aria-hidden="true" />
    <OpeningPortrait side="player" src={art.player} />
    <OpeningPortrait side="enemy" src={art.enemy} />
    <div className="g8-vs-copy"><span>{displayPlayer}</span><strong>VS</strong><span>{displayEnemy}</span></div>
    <div className="g8-vs-cut" aria-hidden="true" />
    <div className="g9-battle-start"><b>BATTLE<br />START</b></div>
    <div className="g9-opening-particles" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
    <div className="g8-opening-progress" aria-hidden="true"><i /></div>
  </div>;
}

export function GameAtmosphere({ mode, playerArt, enemyArt }: { mode: GameMode; playerArt: string | null; enemyArt: string | null }) {
  return <div className={`g9-atmosphere mode-${mode}`} aria-hidden="true">
    <div className="g9-illustrated-depth player">{playerArt ? <img src={playerArt} alt="" /> : <span />}</div>
    <div className="g9-illustrated-depth enemy">{enemyArt ? <img src={enemyArt} alt="" /> : <span />}</div>
    <i className="g9-parallax-layer far" />
    <i className="g9-parallax-layer near" />
    <div className="g9-particles">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
    <div className="g9-light-sweep" />
  </div>;
}

export function SkillCutIn({ active, art, title, kicker = "SPECIAL ARTS", tone = "cyan" }: { active: boolean; art: string | null; title: string; kicker?: string; tone?: "cyan" | "violet" | "gold" | "red" }) {
  if (!active) return null;
  return <div className={`g9-cut-in tone-${tone}`} aria-live="polite">
    <div className={`g9-cut-portrait ${art ? "has-image" : "fallback"}`}>{art ? <img src={art} alt="" /> : <span />}</div>
    <div className="g9-cut-copy"><small>{kicker}</small><strong>{title}</strong><span>CREATOR DRIVE</span></div>
    <i className="g9-cut-flash" />
  </div>;
}

export function PauseOverlay({ paused, onResume }: { paused: boolean; onResume: () => void }) {
  if (!paused) return null;
  return (
    <div className="g5-pause" role="dialog" aria-label="ゲーム一時停止">
      <small>MATCH SUSPENDED</small>
      <strong>PAUSED</strong>
      <p>画面を閉じてもカウントは進みません。</p>
      <button onClick={onResume}>RESUME</button>
    </div>
  );
}

export function GameTopControls({ paused, onPause }: { paused: boolean; onPause: () => void }) {
  return <button className="g5-pause-button" onClick={onPause} aria-label={paused ? "ゲームを再開" : "ゲームを一時停止"}>{paused ? "▶" : "Ⅱ"}</button>;
}

export function GameCard({
  src,
  name,
  side,
  compact = false,
  stats,
}: {
  src: string | null;
  name: string;
  side: "player" | "enemy";
  compact?: boolean;
  stats?: CardStats;
}) {
  return (
    <article className={`g4-card ${side} ${compact ? "compact" : ""}`}>
      <div className="g4-card-art">
        {src ? <img src={src} alt={`${name}のカード`} /> : <span className="g5-sealed-art"><b>{side === "player" ? "P" : "R"}</b><small>TRIAL CARD</small></span>}
        <i className="g4-card-shine" />
        <i className="g4-card-scan" />
      </div>
      <footer><small>{side === "player" ? "YOU" : "RIVAL"}</small><strong>{name}</strong>{stats && !compact ? <em>{stats.signature}</em> : null}</footer>
    </article>
  );
}

export function CardStatsStrip({ stats, enemy = false }: { stats: CardStats; enemy?: boolean }) {
  return (
    <div className={`g5-card-stats ${enemy ? "enemy" : "player"}`} aria-label={`攻撃${stats.power} 防御${stats.guard} 速度${stats.speed} 集中${stats.focus}`}>
      <span><small>ATK</small><b>{stats.power}</b></span>
      <span><small>DEF</small><b>{stats.guard}</b></span>
      <span><small>SPD</small><b>{stats.speed}</b></span>
      <span><small>FOC</small><b>{stats.focus}</b></span>
    </div>
  );
}

export function HpBar({ value, enemy = false }: { value: number; enemy?: boolean }) {
  return (
    <div className={`g4-hp ${enemy ? "enemy" : "player"}`}>
      <span><b>HP</b><strong>{Math.max(0, Math.round(value))}</strong></span>
      <i><b style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></i>
    </div>
  );
}

export function GameResultOverlay({
  result,
  score,
  exp,
  onComplete,
  onRetry,
  ranked = true,
  playerArt = null,
  enemyArt = null,
  playerName = "CREATOR",
  enemyName = "RIVAL",
  mode = "choice",
}: {
  result: GameResult;
  score: number;
  exp: number;
  onComplete: (result: GameResult, score: number) => Promise<unknown>;
  onRetry: () => void;
  ranked?: boolean;
  playerArt?: string | null;
  enemyArt?: string | null;
  playerName?: string;
  enemyName?: string;
  mode?: GameMode;
}) {
  const [save, setSave] = useState<SaveState>(ranked ? "saving" : "demo");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    vibrate(result === "win" ? [45, 35, 90] : result === "draw" ? [35, 35, 35] : 70);
    if (!ranked) return;
    void onComplete(result, score).then(
      () => setSave("saved"),
      () => setSave("error"),
    );
  }, [onComplete, ranked, result, score]);

  const title = result === "win" ? "WIN" : result === "draw" ? "DRAW" : "LOSE";
  return (
    <div className={`g4-result g9-result mode-${mode} result-${result}`} role="status">
      <div className="g4-result-rays" />
      <div className="g9-result-cast" aria-hidden="true">
        <div className={`player ${playerArt ? "has-image" : "fallback"}`}>{playerArt ? <img src={playerArt} alt="" /> : <span />}</div>
        <div className={`enemy ${enemyArt ? "has-image" : "fallback"}`}>{enemyArt ? <img src={enemyArt} alt="" /> : <span />}</div>
      </div>
      <small>BATTLE RESULT</small>
      <strong>{title}</strong>
      <div className="g9-result-names"><span>{playerName}</span><b>{openingTitles[mode]}</b><span>{enemyName}</span></div>
      <div className="g4-result-rewards">
        <span><small>SCORE</small><b>{Math.round(score).toLocaleString()}</b></span>
        <span><small>EXP</small><b>+{exp}</b></span>
      </div>
      <p className={`g4-save-state is-${save}`}>
        {save === "demo" ? "TRIAL MODE · 戦績には保存されません" : save === "saving" ? "戦績を保存中…" : save === "saved" ? "戦績・EXPを保存しました" : "戦績保存に失敗しました（結果は端末に表示中）"}
      </p>
      <button onClick={onRetry}>PLAY AGAIN</button>
    </div>
  );
}

export function resultExp(result: GameResult, score: number) {
  const base = result === "win" ? 120 : result === "draw" ? 70 : 40;
  return Math.min(999, base + Math.floor(Math.max(0, score) / 2500));
}
