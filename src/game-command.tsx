import { useState } from "react";
import {
  GameCard,
  GameResultOverlay,
  HpBar,
  PreludeOverlay,
  resultExp,
  useBattlePrelude,
  type GameResult,
  type GameSessionProps,
} from "./game-ui";
import { randomInt } from "./game-types";

type ElementKey = "flare" | "aqua" | "volt";
type Action = "attack" | "defend" | "skill";
const elements: { key: ElementKey; icon: string; label: string }[] = [
  { key: "flare", icon: "炎", label: "FLARE" },
  { key: "aqua", icon: "水", label: "AQUA" },
  { key: "volt", icon: "雷", label: "VOLT" },
];
const beats: Record<ElementKey, ElementKey> = { flare: "volt", volt: "aqua", aqua: "flare" };
const nextElement = () => elements[randomInt(0, elements.length - 1)].key;

export function CommandBattle(props: GameSessionProps) {
  const { phase, restartPrelude } = useBattlePrelude();
  const [playerHp, setPlayerHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(100);
  const [energy, setEnergy] = useState(38);
  const [round, setRound] = useState(1);
  const [element, setElement] = useState<ElementKey>("flare");
  const [enemyElement, setEnemyElement] = useState<ElementKey>(nextElement);
  const [log, setLog] = useState("属性を選び、コマンドを決定");
  const [impact, setImpact] = useState("");
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState(0);
  const [outcome, setOutcome] = useState<GameResult | null>(null);

  function finish(nextPlayer: number, nextEnemy: number, nextRound: number, nextScore: number) {
    if (nextEnemy <= 0 && nextPlayer <= 0) setOutcome("draw");
    else if (nextEnemy <= 0) setOutcome("win");
    else if (nextPlayer <= 0) setOutcome("lose");
    else if (nextRound > 7) setOutcome(nextPlayer === nextEnemy ? "draw" : nextPlayer > nextEnemy ? "win" : "lose");
    setScore(nextScore);
  }

  function act(kind: Action) {
    if (phase !== "live" || busy || outcome) return;
    if (kind === "skill" && energy < 100) {
      setLog("ULTIMATEゲージが足りない");
      return;
    }
    setBusy(true);
    const enemyAction: Action = Math.random() < 0.22 ? "defend" : "attack";
    const advantage = beats[element] === enemyElement;
    const disadvantage = beats[enemyElement] === element;
    let hit = kind === "skill" ? randomInt(31, 42) : kind === "defend" ? randomInt(5, 9) : randomInt(15, 23);
    let retaliation = enemyAction === "defend" ? randomInt(3, 7) : randomInt(11, 18);
    let critical = false;
    let counter = false;

    if (advantage) hit = Math.round(hit * 1.35);
    if (disadvantage && kind !== "skill") hit = Math.round(hit * 0.76);
    if (enemyAction === "defend" && kind === "attack") hit = Math.round(hit * 0.58);
    if (kind === "defend") {
      retaliation = Math.round(retaliation * 0.28);
      counter = advantage || Math.random() < 0.36;
      if (counter) hit += randomInt(9, 15);
    }
    if ((kind === "attack" || kind === "skill") && Math.random() < (advantage ? 0.34 : 0.18)) {
      critical = true;
      hit = Math.round(hit * 1.65);
    }
    if (kind === "skill") retaliation = Math.round(retaliation * 0.55);

    const nextEnemy = Math.max(0, enemyHp - hit);
    const nextPlayer = nextEnemy <= 0 ? playerHp : Math.max(0, playerHp - retaliation);
    const nextRound = round + 1;
    const nextScore = score + hit * 140 + (critical ? 1800 : 0) + (counter ? 1200 : 0);
    const nextEnergy = kind === "skill" ? 8 : Math.min(100, energy + (kind === "defend" ? 36 : 27));
    const headline = kind === "skill" ? "ULTIMATE BREAK" : critical ? "CRITICAL" : counter ? "COUNTER" : advantage ? "ELEMENT BURST" : "HIT";

    setImpact(headline.toLowerCase().replaceAll(" ", "-"));
    setLog(`${headline}  ${hit} DAMAGE${retaliation ? ` / 反撃 ${retaliation}` : ""}`);
    window.setTimeout(() => {
      setEnemyHp(nextEnemy);
      setPlayerHp(nextPlayer);
      setEnergy(nextEnergy);
      setRound(nextRound);
      setEnemyElement(nextElement());
      setImpact("");
      setBusy(false);
      finish(nextPlayer, nextEnemy, nextRound, nextScore);
    }, 520);
  }

  function reset() {
    setPlayerHp(100);
    setEnemyHp(100);
    setEnergy(38);
    setRound(1);
    setElement("flare");
    setEnemyElement(nextElement());
    setLog("属性を選び、コマンドを決定");
    setImpact("");
    setBusy(false);
    setScore(0);
    setOutcome(null);
    restartPrelude();
  }

  return (
    <div className={`g4-game g4-command ${impact ? `impact-${impact}` : ""}`}>
      <PreludeOverlay phase={phase} playerName={props.playerName} enemyName={props.enemyName} />
      <div className="g4-command-top">
        <span>ROUND <b>{Math.min(round, 7)}</b> / 7</span>
        <strong>COMMAND BATTLE</strong>
        <span>ULTIMATE <b>{energy}%</b></span>
      </div>
      <div className="g4-command-stage">
        <section>
          <HpBar value={playerHp} />
          <GameCard src={props.playerArt} name={props.playerName} side="player" />
        </section>
        <div className="g4-command-clash">
          <span className={`element-orb is-${element}`}>{elements.find((x) => x.key === element)?.icon}</span>
          <b>VS</b>
          <span className={`element-orb is-${enemyElement}`}>{elements.find((x) => x.key === enemyElement)?.icon}</span>
          {impact ? <strong>{impact.replaceAll("-", " ")}</strong> : null}
        </div>
        <section>
          <HpBar value={enemyHp} enemy />
          <GameCard src={props.enemyArt} name={props.enemyName} side="enemy" />
        </section>
      </div>
      <div className="g4-battle-log" aria-live="polite">{log}</div>
      <div className="g4-element-picker" aria-label="攻撃属性">
        {elements.map((item) => (
          <button key={item.key} className={element === item.key ? "active" : ""} onClick={() => setElement(item.key)} disabled={busy || Boolean(outcome)}>
            <b>{item.icon}</b><span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="g4-command-dock">
        <button onClick={() => act("attack")} disabled={busy || Boolean(outcome)}><b>⚔</b><span>ATTACK</span><small>属性攻撃</small></button>
        <button onClick={() => act("defend")} disabled={busy || Boolean(outcome)}><b>⬡</b><span>DEFEND</span><small>軽減・反撃</small></button>
        <button className={energy >= 100 ? "ready" : ""} onClick={() => act("skill")} disabled={busy || energy < 100 || Boolean(outcome)}><b>✦</b><span>SKILL</span><small>{energy >= 100 ? "必殺技 READY" : `${energy}%`}</small></button>
      </div>
      {outcome ? <GameResultOverlay result={outcome} score={score} exp={resultExp(outcome, score)} onComplete={props.onComplete} onRetry={reset} /> : null}
    </div>
  );
}
