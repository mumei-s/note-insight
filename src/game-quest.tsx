import { useMemo, useRef, useState } from "react";
import { balanceRatio, vibrate } from "./game-card-engine";
import {
  GameAtmosphere,
  GameCard,
  GameResultOverlay,
  GameTopControls,
  HpBar,
  PauseOverlay,
  PreludeOverlay,
  SkillCutIn,
  resultExp,
  useBattlePrelude,
  type GameResult,
  type GameSessionProps,
} from "./game-ui";
import { randomInt } from "./game-types";

type QuestAction = "attack" | "guard" | "skill";
const WAVE_HP = [58, 82, 120] as const;

function waveTitle(wave: number, rival: string) {
  if (wave === 0) return "SHADOW SCOUT";
  if (wave === 1) return "VOID KNIGHT";
  return rival;
}

export function CreatorQuestBattle(props: GameSessionProps) {
  const { phase, paused, togglePause, restartPrelude } = useBattlePrelude();
  const ratio = useMemo(() => balanceRatio(props.playerStats, props.enemyStats, "quest"), [props.enemyStats, props.playerStats]);
  const [wave, setWave] = useState(0);
  const [turn, setTurn] = useState(1);
  const [playerHp, setPlayerHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState<number>(WAVE_HP[0]);
  const [sp, setSp] = useState(20);
  const [score, setScore] = useState(0);
  const [guard, setGuard] = useState(0);
  const [log, setLog] = useState("遺跡へ侵入。コマンドを選択してください");
  const [impact, setImpact] = useState<"" | "player" | "enemy" | "skill" | "wave">("");
  const [cutIn, setCutIn] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<GameResult | null>(null);
  const ended = useRef(false);
  const active = phase === "live" && !paused && !busy && !outcome;

  function conclude(result: GameResult) {
    if (ended.current) return;
    ended.current = true;
    setOutcome(result);
  }

  function act(action: QuestAction) {
    if (!active) return;
    if (action === "skill" && sp < 100) {
      setLog(`SPが足りません · ${sp}/100`);
      vibrate(18);
      return;
    }

    setBusy(true);
    const critical = action === "attack" && Math.random() < 0.12 + props.playerStats.focus / 520;
    const playerDamage = action === "guard"
      ? 0
      : Math.max(6, Math.round((action === "skill" ? randomInt(39, 48) : randomInt(14, 20)) * ratio * (critical ? 1.58 : 1)));
    const nextEnemy = Math.max(0, enemyHp - playerDamage);
    const nextSp = action === "skill" ? 0 : Math.min(100, sp + (action === "guard" ? 34 : critical ? 30 : 23));
    const nextGuard = action === "guard" ? Math.min(60, guard + 28 + Math.round((props.playerStats.guard - 72) / 3)) : Math.max(0, guard - 8);
    const actionScore = playerDamage * 170 + (critical ? 1200 : 0) + (action === "skill" ? 3200 : 0);
    const nextScore = score + actionScore;

    setSp(nextSp);
    setGuard(nextGuard);
    setImpact(action === "skill" ? "skill" : "enemy");
    setLog(action === "guard" ? "AEGIS GUARD · 次の攻撃を軽減" : `${action === "skill" ? props.playerStats.signature : critical ? "CRITICAL SLASH" : "CREATOR SLASH"} · ${playerDamage} DAMAGE`);
    if (action === "skill") {
      setCutIn(props.playerStats.signature);
      window.setTimeout(() => setCutIn(""), 820);
      vibrate([42, 24, 86]);
    } else {
      vibrate(critical ? [24, 16, 38] : action === "guard" ? 18 : 16);
    }

    window.setTimeout(() => {
      setEnemyHp(nextEnemy);
      setScore(nextScore);
      if (nextEnemy <= 0) {
        if (wave >= WAVE_HP.length - 1) {
          setLog(`BOSS BREAK · ${props.enemyName}を撃破`);
          setImpact("wave");
          setBusy(false);
          conclude("win");
          return;
        }
        const nextWave = wave + 1;
        setImpact("wave");
        setLog(`WAVE ${wave + 1} CLEAR · 次の敵が接近`);
        window.setTimeout(() => {
          setWave(nextWave);
          setEnemyHp(WAVE_HP[nextWave]);
          setTurn((value) => value + 1);
          setLog(nextWave === 2 ? `BOSS WAVE · ${props.enemyName} 出現` : "VOID KNIGHT 出現");
          setImpact("");
          setBusy(false);
        }, 720);
        return;
      }

      const rawIncoming = Math.round(randomInt(12 + wave * 3, 18 + wave * 5) * (props.enemyStats.power / 86) * (86 / props.playerStats.guard));
      const block = action === "guard" ? Math.max(nextGuard, Math.round(rawIncoming * 0.72)) : nextGuard;
      const absorbed = Math.min(block, rawIncoming);
      const incoming = Math.max(0, rawIncoming - absorbed);
      const nextPlayer = Math.max(0, playerHp - incoming);
      setPlayerHp(nextPlayer);
      setGuard(Math.max(0, nextGuard - absorbed));
      setTurn((value) => value + 1);
      setImpact("player");
      setLog(incoming ? `RIVAL ATTACK · ${incoming} DAMAGE${absorbed ? ` / GUARD ${absorbed}` : ""}` : `PERFECT GUARD · ${absorbed} BLOCK`);
      vibrate(incoming ? [26, 16, 34] : 16);
      window.setTimeout(() => setImpact(""), 280);
      setBusy(false);
      if (nextPlayer <= 0) conclude("lose");
    }, action === "skill" ? 620 : 420);
  }

  function reset() {
    ended.current = false;
    setWave(0); setTurn(1); setPlayerHp(100); setEnemyHp(WAVE_HP[0]); setSp(20);
    setScore(0); setGuard(0); setLog("遺跡へ侵入。コマンドを選択してください");
    setImpact(""); setCutIn(""); setBusy(false); setOutcome(null); restartPrelude();
  }

  const enemyMax = WAVE_HP[wave];
  const normalizedEnemyHp = enemyMax ? enemyHp / enemyMax * 100 : 0;
  return <div className={`g4-game g9-game g9-quest g5-quest impact-${impact || "idle"}`}>
    <GameAtmosphere mode="quest" playerArt={props.playerArt} enemyArt={props.enemyArt} />
    <PreludeOverlay phase={phase} playerName={props.playerName} enemyName={props.enemyName} playerArt={props.playerArt} enemyArt={props.enemyArt} mode="quest" />
    <PauseOverlay paused={paused} onResume={togglePause} />
    <GameTopControls paused={paused} onPause={togglePause} />
    <SkillCutIn active={Boolean(cutIn)} art={props.playerArt} title={cutIn || props.playerStats.signature} kicker="SP 100 · LIMIT ARTS" tone="gold" />

    <header className="g9-game-top"><span>WAVE <b>{wave + 1}/3</b></span><strong>CREATOR QUEST</strong><span>TURN <b>{turn}</b></span></header>
    <div className="g9-quest-route" aria-label="3ウェーブ進行状況">
      {[0, 1, 2].map((step) => <span key={step} className={step < wave ? "clear" : step === wave ? "active" : ""}><i />{step === 2 ? "BOSS" : `W${step + 1}`}</span>)}
    </div>
    <section className="g9-quest-stage">
      <div className="g9-quest-hero">
        <HpBar value={playerHp} />
        <GameCard src={props.playerArt} name={props.playerName} side="player" stats={props.playerStats} />
        <div className="g9-aegis"><small>AEGIS</small><i><b style={{ width: `${Math.min(100, guard * 1.7)}%` }} /></i><strong>{guard}</strong></div>
      </div>
      <div className="g9-quest-center"><i className="g9-ground-ring" /><b>{impact === "wave" ? "WAVE CLEAR" : impact === "skill" ? "LIMIT BREAK" : "⚔"}</b><span>{log}</span></div>
      <div className={`g9-quest-enemy wave-${wave}`}>
        <div className="g9-enemy-title"><small>{wave === 2 ? "BOSS" : `WAVE ${wave + 1}`}</small><strong>{waveTitle(wave, props.enemyName)}</strong></div>
        <HpBar value={normalizedEnemyHp} enemy />
        <div className="g9-enemy-shell">{props.enemyArt ? <img src={props.enemyArt} alt={`${props.enemyName}の敵カード`} /> : <span />}<i /><b>{wave === 0 ? "✦" : wave === 1 ? "◆" : "✹"}</b></div>
      </div>
    </section>
    <div className="g9-quest-log" aria-live="polite">{log}</div>
    <div className="g9-sp-gauge"><span>SP</span><i><b style={{ width: `${sp}%` }} /></i><strong>{sp}%</strong></div>
    <div className="g9-quest-dock">
      <button onClick={() => act("attack")} disabled={!active}><b>⚔</b><span>ATTACK</span><small>SP +23</small></button>
      <button onClick={() => act("guard")} disabled={!active}><b>⬡</b><span>GUARD</span><small>SP +34</small></button>
      <button className={sp >= 100 ? "ready" : ""} onClick={() => act("skill")} disabled={!active || sp < 100}><b>✦</b><span>SKILL</span><small>{sp >= 100 ? props.playerStats.signature : "SP 100"}</small></button>
    </div>
    <p className="g4-help">ATTACK / GUARDでSPをため、SKILLで突破。3WAVE目のBOSSを倒せば勝利。</p>
    {outcome ? <GameResultOverlay result={outcome} score={score} exp={resultExp(outcome, score)} onComplete={props.onComplete} onRetry={reset} ranked={props.ranked} playerArt={props.playerArt} enemyArt={props.enemyArt} playerName={props.playerName} enemyName={props.enemyName} mode="quest" /> : null}
  </div>;
}
