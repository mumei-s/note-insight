import { useEffect, useRef, useState } from "react";

export type GameResult = "win" | "draw" | "lose";
export type SaveState = "saving" | "saved" | "error";

export type GameSessionProps = {
  playerArt: string;
  enemyArt: string | null;
  playerName: string;
  enemyName: string;
  playerCardPosition: number;
  onComplete: (result: GameResult, score: number) => Promise<unknown>;
};

export function useBattlePrelude() {
  const [seed, setSeed] = useState(0);
  const [phase, setPhase] = useState<"start" | "versus" | "live">("start");

  useEffect(() => {
    setPhase("start");
    const versus = window.setTimeout(() => setPhase("versus"), 620);
    const live = window.setTimeout(() => setPhase("live"), 1320);
    return () => {
      window.clearTimeout(versus);
      window.clearTimeout(live);
    };
  }, [seed]);

  return { phase, restartPrelude: () => setSeed((value) => value + 1) };
}

export function PreludeOverlay({
  phase,
  playerName,
  enemyName,
}: {
  phase: "start" | "versus" | "live";
  playerName: string;
  enemyName: string;
}) {
  if (phase === "live") return null;
  return (
    <div className={`g4-prelude is-${phase}`} aria-live="polite">
      {phase === "start" ? (
        <>
          <small>READY FOR COMBAT</small>
          <strong>BATTLE<br />START</strong>
        </>
      ) : (
        <>
          <span>{playerName}</span>
          <strong>VS</strong>
          <span>{enemyName}</span>
        </>
      )}
    </div>
  );
}

export function GameCard({
  src,
  name,
  side,
  compact = false,
}: {
  src: string | null;
  name: string;
  side: "player" | "enemy";
  compact?: boolean;
}) {
  return (
    <article className={`g4-card ${side} ${compact ? "compact" : ""}`}>
      <div className="g4-card-art">
        {src ? <img src={src} alt={`${name}のカード`} /> : <span>NO CARD</span>}
        <i className="g4-card-shine" />
        <i className="g4-card-scan" />
      </div>
      <footer><small>{side === "player" ? "YOU" : "RIVAL"}</small><strong>{name}</strong></footer>
    </article>
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
}: {
  result: GameResult;
  score: number;
  exp: number;
  onComplete: (result: GameResult, score: number) => Promise<unknown>;
  onRetry: () => void;
}) {
  const [save, setSave] = useState<SaveState>("saving");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void onComplete(result, score).then(
      () => setSave("saved"),
      () => setSave("error"),
    );
  }, [onComplete, result, score]);

  const title = result === "win" ? "WIN" : result === "draw" ? "DRAW" : "LOSE";
  return (
    <div className={`g4-result result-${result}`} role="status">
      <div className="g4-result-rays" />
      <small>BATTLE RESULT</small>
      <strong>{title}</strong>
      <div className="g4-result-rewards">
        <span><small>SCORE</small><b>{Math.round(score).toLocaleString()}</b></span>
        <span><small>EXP</small><b>+{exp}</b></span>
      </div>
      <p className={`g4-save-state is-${save}`}>
        {save === "saving" ? "戦績を保存中…" : save === "saved" ? "戦績・EXPを保存しました" : "戦績保存に失敗しました（結果は端末に表示中）"}
      </p>
      <button onClick={onRetry}>PLAY AGAIN</button>
    </div>
  );
}

export function resultExp(result: GameResult, score: number) {
  const base = result === "win" ? 120 : result === "draw" ? 70 : 40;
  return Math.min(999, base + Math.floor(Math.max(0, score) / 2500));
}
