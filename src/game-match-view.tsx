import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { balanceRatio, vibrate } from "./game-card-engine";
import {
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

const W = 6, H = 6, SECONDS = 45;
const runes = ["✦", "◆", "✧", "⬢", "✹", "◈"];
type Cell = { id: string; rune: string };
type Drag = { index: number; x: number; y: number };
const make = (): Cell => ({ id: crypto.randomUUID(), rune: runes[Math.floor(Math.random() * runes.length)] });
const fresh = () => Array.from({ length: W * H }, make);
const adjacent = (a: number, b: number) => Math.abs(a - b) === W || (Math.abs(a - b) === 1 && Math.floor(a / W) === Math.floor(b / W));
function matches(board: Cell[]) { const hit = new Set<number>(); for (let y = 0; y < H; y++) { let s = 0; for (let x = 1; x <= W; x++) { const same = x < W && board[y * W + x].rune === board[y * W + s].rune; if (!same) { if (x - s >= 3) for (let k = s; k < x; k++) hit.add(y * W + k); s = x; } } } for (let x = 0; x < W; x++) { let s = 0; for (let y = 1; y <= H; y++) { const same = y < H && board[y * W + x].rune === board[s * W + x].rune; if (!same) { if (y - s >= 3) for (let k = s; k < y; k++) hit.add(k * W + x); s = y; } } } return hit; }
function collapse(board: Cell[], hit: Set<number>) { const next = [...board]; for (let x = 0; x < W; x++) { const keep: Cell[] = []; for (let y = H - 1; y >= 0; y--) { const i = y * W + x; if (!hit.has(i)) keep.push(next[i]); } while (keep.length < H) keep.push(make()); for (let y = H - 1, k = 0; y >= 0; y--, k++) next[y * W + x] = keep[k]; } return next; }
function settle(input: Cell[]) { let board = input, removed = 0, chain = 0; for (let guard = 0; guard < 12; guard++) { const hit = matches(board); if (!hit.size) break; chain += 1; removed += hit.size; board = collapse(board, hit); } return { board, removed, chain }; }
const cleanBoard = () => settle(fresh()).board;

export function MatchBattle(props: GameSessionProps) {
  const { phase, paused, togglePause, restartPrelude } = useBattlePrelude();
  const ratio = useMemo(() => balanceRatio(props.playerStats, props.enemyStats, "puzzle"), [props.enemyStats, props.playerStats]);
  const [board, setBoard] = useState<Cell[]>(() => cleanBoard());
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(SECONDS);
  const [chain, setChain] = useState(0);
  const [playerHp, setPlayerHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(100);
  const [shield, setShield] = useState(0);
  const [threat, setThreat] = useState(3);
  const [skill, setSkill] = useState(0);
  const [flash, setFlash] = useState("");
  const [burst, setBurst] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<GameResult | null>(null);
  const refs = useRef({ player: 100, enemy: 100, shield: 0, score: 0, ended: false });
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false);
  const running = phase === "live" && !paused && !outcome;
  const active = running && !busy;

  function conclude(player = refs.current.player, enemy = refs.current.enemy) {
    if (refs.current.ended) return;
    refs.current.ended = true;
    setOutcome(enemy <= 0 ? "win" : player <= 0 ? "lose" : player === enemy ? "draw" : player > enemy ? "win" : "lose");
  }

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTime((value) => {
      const next = Math.max(0, +(value - 0.1).toFixed(1));
      if (next === 0) conclude();
      return next;
    }), 100);
    return () => window.clearInterval(id);
  }, [running]);

  function resolveDamage(removed: number, linked: number, shieldRunes: number, ultimate = false) {
    const damage = ultimate ? Math.round(32 * ratio) : Math.max(7, Math.round((removed * 1.8 + linked * 5) * ratio));
    const enemy = Math.max(0, refs.current.enemy - damage);
    const nextThreat = ultimate ? threat : threat - 1;
    const enemyAttacks = !ultimate && nextThreat <= 0 && enemy > 0;
    const incoming = enemyAttacks ? Math.round(randomInt(13, 20) * (props.enemyStats.power / 86) * (86 / props.playerStats.guard)) : 0;
    const shieldGain = Math.round(shieldRunes * 2.4 + (props.playerStats.guard - 72) / 6);
    const availableShield = Math.min(50, refs.current.shield + shieldGain);
    const absorbed = Math.min(availableShield, incoming);
    const nextShield = Math.max(0, availableShield - incoming);
    const player = Math.max(0, refs.current.player - Math.max(0, incoming - absorbed));
    const gain = ultimate ? 5600 : removed * 170 + Math.max(0, linked - 1) * 1250 + shieldRunes * 120;
    refs.current = { ...refs.current, player, enemy, shield: nextShield, score: refs.current.score + gain };
    setEnemyHp(enemy); setPlayerHp(player); setShield(nextShield); setScore(refs.current.score);
    setThreat(ultimate ? threat : nextThreat <= 0 ? 3 : nextThreat);
    setFlash(ultimate ? `ARCANE NOVA · ${damage}` : linked > 1 ? `${linked} CHAIN · ${damage}` : enemyAttacks ? `${damage} DAMAGE / RIVAL -${Math.max(0, incoming - absorbed)}` : `${damage} DAMAGE`);
    setBurst(true);
    vibrate(ultimate ? [40, 25, 75] : linked >= 2 ? [22, 15, 36] : 14);
    window.setTimeout(() => { setFlash(""); setBurst(false); setBusy(false); }, 520);
    if (enemy <= 0 || player <= 0) conclude(player, enemy);
  }

  function exchange(from: number, to: number) {
    if (!active || !adjacent(from, to)) return;
    const swap = [...board], temp = swap[from];
    swap[from] = swap[to]; swap[to] = temp;
    const first = matches(swap);
    if (!first.size) {
      setSelected(null); setFlash("NO MATCH"); vibrate(20);
      window.setTimeout(() => setFlash(""), 360);
      return;
    }
    setBusy(true);
    const shieldRunes = [...first].filter((index) => swap[index].rune === "◈").length;
    const result = settle(swap);
    setBoard(result.board); setSelected(null); setChain(result.chain);
    setSkill((value) => Math.min(100, value + result.removed * 5 + result.chain * 9));
    resolveDamage(result.removed, result.chain, shieldRunes);
  }

  function choose(index: number) {
    if (!active || dragged.current) { dragged.current = false; return; }
    if (selected === null) { setSelected(index); return; }
    if (selected === index) { setSelected(null); return; }
    if (!adjacent(selected, index)) { setSelected(index); return; }
    exchange(selected, index);
  }

  function dragStart(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
    if (!active) return;
    drag.current = { index, x: event.clientX, y: event.clientY };
    dragged.current = false;
  }

  function dragEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    drag.current = null;
    if (!start || !active) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    dragged.current = true;
    let target = start.index;
    if (Math.abs(dx) > Math.abs(dy)) target += dx > 0 ? 1 : -1;
    else target += dy > 0 ? W : -W;
    if (target >= 0 && target < W * H && adjacent(start.index, target)) exchange(start.index, target);
  }

  function ultimate() {
    if (skill < 100 || !active) return;
    setBusy(true);
    const hit = new Set<number>();
    while (hit.size < 12) hit.add(randomInt(0, W * H - 1));
    const result = settle(collapse(board, hit));
    setBoard(result.board); setSelected(null); setChain(Math.max(1, result.chain)); setSkill(0);
    resolveDamage(12 + result.removed, Math.max(1, result.chain), 0, true);
  }

  function reset() {
    refs.current = { player: 100, enemy: 100, shield: 0, score: 0, ended: false };
    setBoard(cleanBoard()); setSelected(null); setScore(0); setTime(SECONDS); setChain(0);
    setPlayerHp(100); setEnemyHp(100); setShield(0); setThreat(3); setSkill(0);
    setFlash(""); setBurst(false); setBusy(false); setOutcome(null); restartPrelude();
  }

  return (
    <div className={`g4-game g4-puzzle g5-puzzle ${burst ? "is-burst" : ""}`}>
      <PreludeOverlay phase={phase} playerName={props.playerName} enemyName={props.enemyName} />
      <PauseOverlay paused={paused} onResume={togglePause} />
      <GameTopControls paused={paused} onPause={togglePause} />
      <div className="g4-puzzle-top"><span>TIME <b>{time.toFixed(1)}</b></span><strong>ARCANE PUZZLE</strong><span>CHAIN <b>×{chain}</b></span></div>
      <div className="g4-puzzle-duel">
        <section><GameCard src={props.playerArt} name={props.playerName} side="player" compact /><HpBar value={playerHp} /><div className="g5-shield"><span>SHIELD</span><i><b style={{ width: `${shield * 2}%` }} /></i><strong>{shield}</strong></div></section>
        <div className="g4-arcane-core"><i /><b>{flash || "MATCH 3"}</b><small>SCORE {score.toLocaleString()}</small><em>RIVAL ATTACK {threat}</em></div>
        <section><GameCard src={props.enemyArt} name={props.enemyName} side="enemy" compact /><HpBar value={enemyHp} enemy /></section>
      </div>
      <div className="g4-rune-board" aria-label="6×6ルーン盤面">
        {board.map((cell, index) => <button key={cell.id} className={selected === index ? "selected" : ""} data-rune={runes.indexOf(cell.rune)} onPointerDown={(event) => dragStart(event, index)} onPointerUp={dragEnd} onClick={() => choose(index)} disabled={!active}><span>{cell.rune}</span></button>)}
      </div>
      <div className="g4-skill-row"><div><span>SKILL GAUGE</span><i><b style={{ width: `${skill}%` }} /></i><strong>{skill}%</strong></div><button className={skill >= 100 ? "ready" : ""} disabled={skill < 100 || !active} onClick={ultimate}>✦ ARCANE NOVA</button></div>
      <p className="g4-help">タップ交換 / スワイプ対応。◈でSHIELD、連鎖でSKILLを加速。3手ごとに相手が攻撃。</p>
      {outcome ? <GameResultOverlay result={outcome} score={score} exp={resultExp(outcome, score)} onComplete={props.onComplete} onRetry={reset} ranked={props.ranked} /> : null}
    </div>
  );
}
