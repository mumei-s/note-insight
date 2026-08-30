import { useMemo, useState } from "react";
import { balanceRatio, vibrate } from "./game-card-engine";
import {
  CardStatsStrip,
  GameCard,
  GameResultOverlay,
  GameTopControls,
  HpBar,
  PauseOverlay,
  PreludeOverlay,
  resultExp,
  useBattlePrelude,
  type GameResult,
  type GameSessionProps,
} from "./game-ui";
import { randomInt } from "./game-types";

type ElementKey = "flare" | "aqua" | "volt";
type Action = "attack" | "defend" | "skill";
type Intent = { action: Action; element: ElementKey };

const elements: { key: ElementKey; icon: string; label: string }[] = [
  { key: "flare", icon: "炎", label: "FLARE" },
  { key: "aqua", icon: "水", label: "AQUA" },
  { key: "volt", icon: "雷", label: "VOLT" },
];
const beats: Record<ElementKey, ElementKey> = { flare: "volt", volt: "aqua", aqua: "flare" };
const nextElement = () => elements[randomInt(0, elements.length - 1)].key;
const actionLabel: Record<Action, string> = { attack: "STRIKE", defend: "GUARD", skill: "SIGNATURE" };

function nextIntent(round: number, focus: number): Intent {
  const skillChance = round >= 4 ? 0.12 + (focus - 72) / 180 : 0;
  const roll = Math.random();
  return { action: roll < skillChance ? "skill" : roll < 0.34 ? "defend" : "attack", element: nextElement() };
}

export function CommandBattle(props: GameSessionProps) {
  const { phase, paused, togglePause, restartPrelude } = useBattlePrelude();
  const ratio = useMemo(() => balanceRatio(props.playerStats, props.enemyStats, "choice"), [props.enemyStats, props.playerStats]);
  const [playerHp, setPlayerHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(100);
  const [energy, setEnergy] = useState(32);
  const [round, setRound] = useState(1);
  const [element, setElement] = useState<ElementKey>(props.playerStats.affinity);
  const [intent, setIntent] = useState<Intent>(() => nextIntent(1, props.enemyStats.focus));
  const [log, setLog] = useState("相手の予告を読み、属性とコマンドを決定");
  const [impact, setImpact] = useState("");
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState(0);
  const [momentum, setMomentum] = useState(0);
  const [outcome, setOutcome] = useState<GameResult | null>(null);

  function finish(nextPlayer: number, nextEnemy: number, nextRound: number, nextScore: number) {
    const result = nextEnemy <= 0 && nextPlayer <= 0 ? "draw" : nextEnemy <= 0 ? "win" : nextPlayer <= 0 ? "lose" : nextRound > 7 ? (nextPlayer === nextEnemy ? "draw" : nextPlayer > nextEnemy ? "win" : "lose") : null;
    if (result) setOutcome(result);
    setScore(nextScore);
  }

  function act(kind: Action) {
    if (phase !== "live" || paused || busy || outcome) return;
    if (kind === "skill" && energy < 100) {
      setLog("SIGNATUREゲージが足りない");
      vibrate(22);
      return;
    }
    setBusy(true);
    const advantage = beats[element] === intent.element;
    const disadvantage = beats[intent.element] === element;
    const powerScale = (props.playerStats.power / 84) * ratio;
    const enemyPowerScale = (props.enemyStats.power / 84) / ratio;
    const guardScale = 84 / props.playerStats.guard;
    let hit = Math.round((kind === "skill" ? randomInt(32, 40) : kind === "defend" ? randomInt(3, 7) : randomInt(15, 21)) * powerScale);
    let retaliation = Math.round((intent.action === "skill" ? randomInt(25, 34) : intent.action === "defend" ? randomInt(2, 5) : randomInt(12, 18)) * enemyPowerScale * guardScale);
    let critical = false;
    let counter = false;
    let nextMomentum = momentum;

    if (advantage) hit = Math.round(hit * 1.34);
    if (disadvantage && kind !== "skill") hit = Math.round(hit * 0.74);
    if (intent.action === "defend" && kind === "attack") hit = Math.round(hit * 0.44);
    if (kind === "defend") {
      retaliation = Math.round(retaliation * (intent.action === "skill" ? 0.42 : 0.2));
      counter = intent.action !== "defend" && (advantage || Math.random() < 0.31 + props.playerStats.focus / 500);
      if (counter) {
        hit += Math.round(randomInt(9, 15) * powerScale);
        nextMomentum = Math.min(5, momentum + 1);
      } else if (intent.action === "defend") {
        hit = 0;
        retaliation = 0;
        nextMomentum = Math.min(5, momentum + 1);
      }
    } else if (intent.action === "attack" && disadvantage) {
      nextMomentum = 0;
    }
    const criticalChance = 0.1 + (props.playerStats.focus - 72) / 170 + (advantage ? 0.13 : 0) + momentum * 0.025;
    if ((kind === "attack" || kind === "skill") && Math.random() < criticalChance) {
      critical = true;
      hit = Math.round(hit * 1.62);
    }
    if (kind === "skill") {
      hit += momentum * 3;
      retaliation = Math.round(retaliation * 0.5);
      nextMomentum = 0;
    }

    const nextEnemy = Math.max(0, enemyHp - hit);
    const nextPlayer = nextEnemy <= 0 ? playerHp : Math.max(0, playerHp - retaliation);
    const nextRound = round + 1;
    const nextScore = score + hit * 155 + (critical ? 1900 : 0) + (counter ? 1500 : 0) + nextMomentum * 220;
    const nextEnergy = kind === "skill" ? 10 : Math.min(100, energy + (kind === "defend" ? 34 : 25) + (advantage ? 7 : 0));
    const headline = kind === "skill" ? props.playerStats.signature : critical ? "CRITICAL" : counter ? "PERFECT COUNTER" : advantage ? "ELEMENT BREAK" : hit === 0 ? "TACTICAL HOLD" : "IMPACT";

    setImpact(headline.toLowerCase().replaceAll(" ", "-"));
    setLog(`${headline} · ${hit} DAMAGE${retaliation ? ` / 被弾 ${retaliation}` : " / NO DAMAGE"}`);
    vibrate(critical || kind === "skill" ? [35, 22, 65] : counter ? [24, 18, 38] : 20);
    window.setTimeout(() => {
      setEnemyHp(nextEnemy);
      setPlayerHp(nextPlayer);
      setEnergy(nextEnergy);
      setRound(nextRound);
      setIntent(nextIntent(nextRound, props.enemyStats.focus));
      setMomentum(nextMomentum);
      setImpact("");
      setBusy(false);
      finish(nextPlayer, nextEnemy, nextRound, nextScore);
    }, 560);
  }

  function reset() {
    setPlayerHp(100); setEnemyHp(100); setEnergy(32); setRound(1);
    setElement(props.playerStats.affinity); setIntent(nextIntent(1, props.enemyStats.focus));
    setLog("相手の予告を読み、属性とコマンドを決定"); setImpact("");
    setBusy(false); setScore(0); setMomentum(0); setOutcome(null); restartPrelude();
  }

  return (
    <div className={`g4-game g4-command g5-command ${impact ? `impact-${impact}` : ""}`}>
      <PreludeOverlay phase={phase} playerName={props.playerName} enemyName={props.enemyName} />
      <PauseOverlay paused={paused} onResume={togglePause} />
      <GameTopControls paused={paused} onPause={togglePause} />
      <div className="g4-command-top"><span>ROUND <b>{Math.min(round, 7)}</b> / 7</span><strong>COMMAND</strong><span>SIGNATURE <b>{energy}%</b></span></div>
      <div className="g5-intent"><small>RIVAL INTENT</small><b>{actionLabel[intent.action]}</b><span className={`is-${intent.element}`}>{elements.find((x) => x.key === intent.element)?.icon} {intent.element.toUpperCase()}</span></div>
      <div className="g4-command-stage">
        <section><HpBar value={playerHp} /><GameCard src={props.playerArt} name={props.playerName} side="player" stats={props.playerStats} /><CardStatsStrip stats={props.playerStats} /></section>
        <div className="g4-command-clash"><span className={`element-orb is-${element}`}>{elements.find((x) => x.key === element)?.icon}</span><b>VS</b><span className={`element-orb is-${intent.element}`}>{elements.find((x) => x.key === intent.element)?.icon}</span>{impact ? <strong>{impact.replaceAll("-", " ")}</strong> : null}<em>LINK ×{momentum}</em></div>
        <section><HpBar value={enemyHp} enemy /><GameCard src={props.enemyArt} name={props.enemyName} side="enemy" stats={props.enemyStats} /><CardStatsStrip stats={props.enemyStats} enemy /></section>
      </div>
      <div className="g4-battle-log" aria-live="polite">{log}</div>
      <div className="g4-element-picker" aria-label="攻撃属性">{elements.map((item) => <button key={item.key} className={element === item.key ? "active" : ""} onClick={() => setElement(item.key)} disabled={busy || paused || Boolean(outcome)}><b>{item.icon}</b><span>{item.label}</span></button>)}</div>
      <div className="g4-command-dock">
        <button onClick={() => act("attack")} disabled={busy || paused || Boolean(outcome)}><b>⚔</b><span>ATTACK</span><small>属性攻撃</small></button>
        <button onClick={() => act("defend")} disabled={busy || paused || Boolean(outcome)}><b>⬡</b><span>GUARD</span><small>軽減・反撃</small></button>
        <button className={energy >= 100 ? "ready" : ""} onClick={() => act("skill")} disabled={busy || paused || energy < 100 || Boolean(outcome)}><b>✦</b><span>SIGNATURE</span><small>{energy >= 100 ? props.playerStats.signature : `${energy}%`}</small></button>
      </div>
      {outcome ? <GameResultOverlay result={outcome} score={score} exp={resultExp(outcome, score)} onComplete={props.onComplete} onRetry={reset} ranked={props.ranked} /> : null}
    </div>
  );
}
