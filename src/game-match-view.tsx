import { useEffect, useMemo, useRef, useState } from "react";
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

const W = 6, H = 6, SECONDS = 45;
const runes = ["✦", "◆", "✧", "⬢", "✹", "◈"];
type Cell = { id: string; rune: string };
const make = (): Cell => ({ id: crypto.randomUUID(), rune: runes[Math.floor(Math.random() * runes.length)] });
const fresh = () => Array.from({ length: W * H }, make);
const adjacent = (a: number, b: number) => Math.abs(a - b) === W || (Math.abs(a - b) === 1 && Math.floor(a / W) === Math.floor(b / W));
function matches(board: Cell[]) { const hit = new Set<number>(); for (let y = 0; y < H; y++) { let s = 0; for (let x = 1; x <= W; x++) { const same = x < W && board[y * W + x].rune === board[y * W + s].rune; if (!same) { if (x - s >= 3) for (let k = s; k < x; k++) hit.add(y * W + k); s = x; } } } for (let x = 0; x < W; x++) { let s = 0; for (let y = 1; y <= H; y++) { const same = y < H && board[y * W + x].rune === board[s * W + x].rune; if (!same) { if (y - s >= 3) for (let k = s; k < y; k++) hit.add(k * W + x); s = y; } } } return hit; }
function collapse(board: Cell[], hit: Set<number>) { const next = [...board]; for (let x = 0; x < W; x++) { const keep: Cell[] = []; for (let y = H - 1; y >= 0; y--) { const i = y * W + x; if (!hit.has(i)) keep.push(next[i]); } while (keep.length < H) keep.push(make()); for (let y = H - 1, k = 0; y >= 0; y--, k++) next[y * W + x] = keep[k]; } return next; }
function settle(input: Cell[]) { let board = input, removed = 0, chain = 0; for (let guard = 0; guard < 12; guard++) { const hit = matches(board); if (!hit.size) break; chain++; removed += hit.size; board = collapse(board, hit); } return { board, removed, chain }; }
const cleanBoard = () => settle(fresh()).board;

export function MatchBattle(props: GameSessionProps) {
  const seed = useMemo(cleanBoard, []);
  const { phase, restartPrelude } = useBattlePrelude();
  const [board, setBoard] = useState(seed);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(SECONDS);
  const [chain, setChain] = useState(0);
  const [playerHp, setPlayerHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(100);
  const [skill, setSkill] = useState(0);
  const [flash, setFlash] = useState("");
  const [burst, setBurst] = useState(false);
  const [outcome, setOutcome] = useState<GameResult | null>(null);
  const hpRef = useRef({ player: 100, enemy: 100 });
  const scoreRef = useRef(0);

  function conclude(player = hpRef.current.player, enemy = hpRef.current.enemy) {
    setOutcome(enemy <= 0 ? "win" : player <= 0 ? "lose" : player === enemy ? "draw" : player > enemy ? "win" : "lose");
  }

  useEffect(() => {
    if (phase !== "live" || outcome) return;
    const id = window.setInterval(() => setTime((value) => {
      const next = Math.max(0, +(value - 0.1).toFixed(1));
      if (next === 0) conclude();
      return next;
    }), 100);
    return () => window.clearInterval(id);
  }, [phase, outcome]);

  function resolveDamage(removed: number, linked: number, ultimate = false) {
    const damage = ultimate ? 34 : Math.max(7, removed * 2 + linked * 5);
    const retaliation = ultimate ? 0 : Math.max(3, randomInt(7, 13) - linked * 2);
    const enemy = Math.max(0, hpRef.current.enemy - damage);
    const player = enemy <= 0 ? hpRef.current.player : Math.max(0, hpRef.current.player - retaliation);
    const gain = ultimate ? 5200 : removed * 150 + Math.max(0, linked - 1) * 1100;
    hpRef.current = { player, enemy };
    scoreRef.current += gain;
    setEnemyHp(enemy);
    setPlayerHp(player);
    setScore(scoreRef.current);
    setFlash(ultimate ? `ARCANE NOVA  ${damage} DAMAGE` : linked > 1 ? `${linked} CHAIN  ${damage} DAMAGE` : `${damage} DAMAGE`);
    setBurst(true);
    window.setTimeout(() => { setFlash(""); setBurst(false); }, 620);
    if (enemy <= 0 || player <= 0) conclude(player, enemy);
  }

  function choose(index: number) {
    if (phase !== "live" || outcome) return;
    if (selected === null) { setSelected(index); return; }
    if (selected === index) { setSelected(null); return; }
    if (!adjacent(selected, index)) { setSelected(index); return; }
    const swap = [...board], temp = swap[selected];
    swap[selected] = swap[index]; swap[index] = temp;
    const first = matches(swap);
    if (!first.size) {
      setSelected(null);
      setFlash("NO MATCH");
      window.setTimeout(() => setFlash(""), 360);
      return;
    }
    const result = settle(swap);
    setBoard(result.board);
    setSelected(null);
    setChain(result.chain);
    setSkill((value) => Math.min(100, value + result.removed * 6 + result.chain * 8));
    resolveDamage(result.removed, result.chain);
  }

  function ultimate() {
    if (skill < 100 || phase !== "live" || outcome) return;
    const hit = new Set<number>();
    while (hit.size < 12) hit.add(randomInt(0, W * H - 1));
    const result = settle(collapse(board, hit));
    setBoard(result.board);
    setSelected(null);
    setChain(Math.max(1, result.chain));
    setSkill(0);
    resolveDamage(12 + result.removed, Math.max(1, result.chain), true);
  }

  function reset() {
    hpRef.current = { player: 100, enemy: 100 };
    scoreRef.current = 0;
    setBoard(cleanBoard());
    setSelected(null);
    setScore(0);
    setTime(SECONDS);
    setChain(0);
    setPlayerHp(100);
    setEnemyHp(100);
    setSkill(0);
    setFlash("");
    setBurst(false);
    setOutcome(null);
    restartPrelude();
  }

  return (
    <div className={`g4-game g4-puzzle ${burst ? "is-burst" : ""}`}>
      <PreludeOverlay phase={phase} playerName={props.playerName} enemyName={props.enemyName} />
      <div className="g4-puzzle-top"><span>TIME <b>{time.toFixed(1)}</b></span><strong>ARCANE PUZZLE</strong><span>CHAIN <b>×{chain}</b></span></div>
      <div className="g4-puzzle-duel">
        <section><GameCard src={props.playerArt} name={props.playerName} side="player" compact /><HpBar value={playerHp} /></section>
        <div className="g4-arcane-core"><i /><b>{flash || "MATCH 3"}</b><small>SCORE {score.toLocaleString()}</small></div>
        <section><GameCard src={props.enemyArt} name={props.enemyName} side="enemy" compact /><HpBar value={enemyHp} enemy /></section>
      </div>
      <div className="g4-rune-board">
        {board.map((cell, index) => (
          <button key={cell.id} className={selected === index ? "selected" : ""} data-rune={runes.indexOf(cell.rune)} onClick={() => choose(index)} disabled={phase !== "live" || Boolean(outcome)}>
            <span>{cell.rune}</span>
          </button>
        ))}
      </div>
      <div className="g4-skill-row"><div><span>SKILL GAUGE</span><i><b style={{ width: `${skill}%` }} /></i><strong>{skill}%</strong></div><button className={skill >= 100 ? "ready" : ""} disabled={skill < 100 || Boolean(outcome)} onClick={ultimate}>✦ ARCANE NOVA</button></div>
      <p className="g4-help">1つ選択 → 隣のルーンと交換。連鎖でダメージとスキルが上昇。</p>
      {outcome ? <GameResultOverlay result={outcome} score={score} exp={resultExp(outcome, score)} onComplete={props.onComplete} onRetry={reset} /> : null}
    </div>
  );
}
