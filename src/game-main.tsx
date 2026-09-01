import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BattleArenaPage } from "./battle-arena-page";
import "./game-standalone.css";

function StandaloneGameApp() {
  return <div className="standalone-game-app">
    <header className="standalone-game-bar">
      <a href="./" aria-label="INSIGHTへ戻る">← INSIGHT</a>
      <div><small>無名S note</small><strong>CREATOR WORLD</strong></div>
      <span>6 GAME ARENA</span>
    </header>
    <BattleArenaPage />
  </div>;
}

const root = document.getElementById("game-root");
if (!root) throw new Error("GAME_ROOT_NOT_FOUND");
createRoot(root).render(<StrictMode><StandaloneGameApp /></StrictMode>);
