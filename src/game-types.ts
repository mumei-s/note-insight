export type GameMode = "choice" | "tap" | "puzzle" | "shoot";

export type GameOpponent = {
  id: string;
  name: string;
  job: string;
  rarity: string;
  image_url: string | null;
  version: number;
};

export type GameCreator = {
  id: string;
  note_id: string;
  display_name: string;
  images: { position: number; url: string | null }[];
};

export type CreatorGameData = {
  opponents: GameOpponent[];
  creators: GameCreator[];
};

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function percent(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}
