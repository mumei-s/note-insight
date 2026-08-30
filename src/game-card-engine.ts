import type { GameMode } from "./game-types";

export type CardStats = {
  power: number;
  guard: number;
  speed: number;
  focus: number;
  total: number;
  affinity: "flare" | "aqua" | "volt";
  signature: string;
};

const signatures = [
  "NOVA DRIVE",
  "AURORA EDGE",
  "PULSE SHIFT",
  "ARCANE LINK",
  "ZERO VECTOR",
  "PRISM BURST",
] as const;

function hash(value: string) {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}

function stat(seed: number, shift: number) {
  return 72 + ((seed >>> shift) % 25);
}

export function deriveCardStats(url: string | null | undefined, position: number, name: string): CardStats {
  const seed = hash(`${url || "sealed-card"}|${position}|${name}`);
  const power = stat(seed, 0);
  const guard = stat(seed, 6);
  const speed = stat(seed, 12);
  const focus = stat(seed, 18);
  return {
    power,
    guard,
    speed,
    focus,
    total: power + guard + speed + focus,
    affinity: (["flare", "aqua", "volt"] as const)[seed % 3],
    signature: signatures[(seed >>> 8) % signatures.length],
  };
}

export function modePower(stats: CardStats, mode: GameMode) {
  if (mode === "choice") return stats.power * 0.44 + stats.guard * 0.34 + stats.focus * 0.22;
  if (mode === "tap") return stats.speed * 0.58 + stats.focus * 0.42;
  if (mode === "puzzle") return stats.focus * 0.56 + stats.guard * 0.44;
  return stats.speed * 0.44 + stats.power * 0.34 + stats.focus * 0.22;
}

export function balanceRatio(player: CardStats, enemy: CardStats, mode: GameMode) {
  const delta = modePower(player, mode) - modePower(enemy, mode);
  return Math.max(0.9, Math.min(1.1, 1 + delta / 240));
}

export function vibrate(pattern: number | number[]) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // Vibration is an optional enhancement and must never block a match.
  }
}
