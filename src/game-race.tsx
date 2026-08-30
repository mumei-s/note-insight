import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { balanceRatio, vibrate } from "./game-card-engine";
import {
  GameAtmosphere,
  GameResultOverlay,
  GameTopControls,
  PauseOverlay,
  PreludeOverlay,
  SkillCutIn,
  resultExp,
  useBattlePrelude,
  type GameResult,
  type GameSessionProps,
} from "./game-ui";

type CourseItem = { id: number; lane: number; distance: number; kind: "energy" | "hazard" };
const FINISH = 1000;
const course: CourseItem[] = Array.from({ length: 27 }, (_, index) => ({
  id: index,
  lane: (index * 2 + (index % 4)) % 3,
  distance: 75 + index * 34,
  kind: index % 3 === 0 || index % 7 === 0 ? "energy" : "hazard",
}));

export function StarCircuitBattle(props: GameSessionProps) {
  const { phase, paused, togglePause, restartPrelude } = useBattlePrelude();
  const ratio = useMemo(() => balanceRatio(props.playerStats, props.enemyStats, "race"), [props.enemyStats, props.playerStats]);
  const [lane, setLane] = useState(1);
  const [distance, setDistance] = useState(0);
  const [rivalDistance, setRivalDistance] = useState(0);
  const [energy, setEnergy] = useState(28);
  const [integrity, setIntegrity] = useState(100);
  const [speed, setSpeed] = useState(0);
  const [time, setTime] = useState(0);
  const [score, setScore] = useState(0);
  const [boosting, setBoosting] = useState(false);
  const [boostCut, setBoostCut] = useState(false);
  const [crash, setCrash] = useState(false);
  const [message, setMessage] = useState("LANEを選び、ENERGYを集めてBOOST");
  const [used, setUsed] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<GameResult | null>(null);
  const laneRef = useRef(1);
  const swipe = useRef<number | null>(null);
  const usedRef = useRef(new Set<number>());
  const race = useRef({ distance: 0, rival: 0, energy: 28, integrity: 100, score: 0, time: 0, boost: 0, ended: false });
  const active = phase === "live" && !paused && !outcome;

  function conclude(player: number, rival: number, integrityValue: number) {
    if (race.current.ended) return;
    race.current.ended = true;
    const result: GameResult = integrityValue <= 0 ? "lose" : Math.abs(player - rival) <= 8 ? "draw" : player > rival ? "win" : "lose";
    setOutcome(result);
    setMessage(result === "win" ? "FINISH · STAR CIRCUIT CHAMPION" : result === "draw" ? "PHOTO FINISH" : "RIVAL FINISH");
  }

  useEffect(() => {
    if (!active) return;
    const tick = 0.05;
    const timer = window.setInterval(() => {
      const current = race.current;
      if (current.ended) return;
      current.time += tick;
      current.boost = Math.max(0, current.boost - tick);
      const isBoosting = current.boost > 0;
      const baseSpeed = 41 + (props.playerStats.speed - 72) * 0.38;
      const rivalSpeed = 40.5 + (props.enemyStats.speed - 72) * 0.35 + Math.sin(current.time * 1.3) * 2.4;
      const roadSpeed = Math.max(20, (baseSpeed + (isBoosting ? 31 : 0)) * ratio);
      const previous = current.distance;
      let nextDistance = Math.min(FINISH, previous + roadSpeed * tick);
      const nextRival = Math.min(FINISH, current.rival + rivalSpeed * tick);
      let nextIntegrity = current.integrity;
      let nextEnergy = current.energy;
      let nextScore = current.score + Math.round(roadSpeed * tick * (isBoosting ? 19 : 10));

      for (const item of course) {
        if (usedRef.current.has(item.id) || item.lane !== laneRef.current || item.distance <= previous || item.distance > nextDistance + 2) continue;
        usedRef.current.add(item.id);
        if (item.kind === "energy") {
          nextEnergy = Math.min(100, nextEnergy + 30);
          nextScore += 850;
          setMessage("STAR ENERGY +30");
          vibrate([12, 10, 18]);
        } else {
          nextIntegrity = Math.max(0, nextIntegrity - 22);
          nextEnergy = Math.max(0, nextEnergy - 12);
          nextDistance = Math.max(0, nextDistance - 16);
          setCrash(true);
          setMessage("HAZARD HIT · MACHINE DAMAGE");
          vibrate([38, 20, 52]);
          window.setTimeout(() => setCrash(false), 340);
        }
      }

      current.distance = nextDistance;
      current.rival = nextRival;
      current.energy = nextEnergy;
      current.integrity = nextIntegrity;
      current.score = nextScore;
      setDistance(nextDistance); setRivalDistance(nextRival); setEnergy(nextEnergy); setIntegrity(nextIntegrity);
      setSpeed(Math.round(roadSpeed * 6.2)); setTime(current.time); setScore(nextScore);
      setBoosting(isBoosting); setUsed([...usedRef.current]);
      if (nextIntegrity <= 0 || nextDistance >= FINISH || nextRival >= FINISH) conclude(nextDistance, nextRival, nextIntegrity);
    }, 50);
    return () => window.clearInterval(timer);
  }, [active, props.enemyStats.speed, props.playerStats.speed, ratio]);

  function moveLane(delta: number) {
    if (!active) return;
    const next = Math.max(0, Math.min(2, laneRef.current + delta));
    if (next === laneRef.current) return;
    laneRef.current = next;
    setLane(next);
    setMessage(next === 0 ? "LEFT LANE" : next === 2 ? "RIGHT LANE" : "CENTER LANE");
    vibrate(10);
  }

  function boost() {
    if (!active || race.current.energy < 35 || race.current.boost > 0.15) return;
    race.current.energy -= 35;
    race.current.boost = 2.25;
    setEnergy(race.current.energy);
    setBoosting(true);
    setBoostCut(true);
    setMessage("STAR BOOST · MAXIMUM SPEED");
    vibrate([28, 18, 62]);
    window.setTimeout(() => setBoostCut(false), 760);
  }

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    swipe.current = event.clientX;
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (swipe.current === null) return;
    const dx = event.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) >= 30) moveLane(dx > 0 ? 1 : -1);
  }

  function reset() {
    race.current = { distance: 0, rival: 0, energy: 28, integrity: 100, score: 0, time: 0, boost: 0, ended: false };
    usedRef.current = new Set(); laneRef.current = 1;
    setLane(1); setDistance(0); setRivalDistance(0); setEnergy(28); setIntegrity(100);
    setSpeed(0); setTime(0); setScore(0); setBoosting(false); setBoostCut(false); setCrash(false);
    setMessage("LANEを選び、ENERGYを集めてBOOST"); setUsed([]); setOutcome(null); restartPrelude();
  }

  const position = distance >= rivalDistance ? "1ST" : "2ND";
  const rivalLane = Math.floor(rivalDistance / 145) % 2 === 0 ? 0 : 2;
  return <div className={`g4-game g9-game g9-race g5-race ${boosting ? "is-boost" : ""} ${crash ? "is-crash" : ""}`}>
    <GameAtmosphere mode="race" playerArt={props.playerArt} enemyArt={props.enemyArt} />
    <PreludeOverlay phase={phase} playerName={props.playerName} enemyName={props.enemyName} playerArt={props.playerArt} enemyArt={props.enemyArt} mode="race" />
    <PauseOverlay paused={paused} onResume={togglePause} />
    <GameTopControls paused={paused} onPause={togglePause} />
    <SkillCutIn active={boostCut} art={props.playerArt} title="STAR BOOST" kicker="ENERGY RELEASE" tone="cyan" />

    <header className="g9-game-top"><span>POS <b>{position}</b></span><strong>STAR CIRCUIT</strong><span>SPEED <b>{speed}</b></span></header>
    <div className="g9-race-hud">
      <div className="g9-driver player">{props.playerArt ? <img src={props.playerArt} alt={`${props.playerName}のドライバーカード`} /> : <span />}<b>{props.playerName}</b></div>
      <div className="g9-race-progress"><i><b style={{ width: `${distance / FINISH * 100}%` }} /><em style={{ left: `${rivalDistance / FINISH * 100}%` }} /></i><span>{Math.round(distance)} / {FINISH}m</span></div>
      <div className="g9-driver enemy">{props.enemyArt ? <img src={props.enemyArt} alt={`${props.enemyName}のライバルカード`} /> : <span />}<b>{props.enemyName}</b></div>
    </div>
    <div className="g9-track" onPointerDown={pointerDown} onPointerUp={pointerUp}>
      <div className="g9-track-sky"><i /><i /><i /></div>
      <div className="g9-road"><i className="left" /><i className="right" /><b className="finish" style={{ top: `${Math.max(-12, Math.min(110, 92 - (FINISH - distance) / 2.15))}%` }} /></div>
      <div className={`g9-machine rival lane-${rivalLane}`} style={{ bottom: `${Math.max(37, Math.min(72, 50 + (rivalDistance - distance) * 0.12))}%` }}><span /><i /><b>RIVAL</b></div>
      {course.filter((item) => !used.includes(item.id) && item.distance >= distance - 8 && item.distance <= distance + 220).map((item) => {
        const ahead = item.distance - distance;
        return <div key={item.id} className={`g9-course-item ${item.kind} lane-${item.lane}`} style={{ "--road-y": `${Math.max(3, Math.min(92, 88 - ahead / 2.55))}%` } as CSSProperties}><i>{item.kind === "energy" ? "✦" : "▲"}</i><span>{item.kind === "energy" ? "ENERGY" : "HAZARD"}</span></div>;
      })}
      <div className={`g9-machine player lane-${lane}`}><span /><i /><b>{boosting ? "BOOST" : "YOU"}</b><em /></div>
      <div className="g9-speed-fx" />
      <strong className="g9-position-flash">{crash ? "CRASH!" : boosting ? "BOOST!" : position}</strong>
    </div>
    <div className="g9-race-status"><span><small>TIME</small><b>{time.toFixed(1)}</b></span><span><small>MACHINE</small><b>{integrity}%</b></span><span><small>ENERGY</small><b>{energy}%</b></span><span><small>SCORE</small><b>{score.toLocaleString()}</b></span></div>
    <div className="g9-race-message" aria-live="polite">{message}</div>
    <div className="g9-race-controls">
      <button onClick={() => moveLane(-1)} disabled={!active || lane === 0}><b>‹</b><span>LEFT</span></button>
      <button className={energy >= 35 ? "ready" : ""} onClick={boost} disabled={!active || energy < 35 || boosting}><b>✦</b><span>BOOST</span><small>35 ENERGY</small></button>
      <button onClick={() => moveLane(1)} disabled={!active || lane === 2}><b>›</b><span>RIGHT</span></button>
    </div>
    <p className="g4-help">左右ボタンまたはスワイプでLANE変更。HAZARDを避け、ENERGYを集めてBOOSTし、先に1000mへ。</p>
    {outcome ? <GameResultOverlay result={outcome} score={score} exp={resultExp(outcome, score)} onComplete={props.onComplete} onRetry={reset} ranked={props.ranked} playerArt={props.playerArt} enemyArt={props.enemyArt} playerName={props.playerName} enemyName={props.enemyName} mode="race" /> : null}
  </div>;
}
