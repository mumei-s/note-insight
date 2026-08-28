export type GameMode = "choice" | "tap" | "puzzle" | "shoot";
export type BattleResult = "win" | "draw" | "lose";

export type GameCard = { position: number; url: string | null };

export type GameOpponent = {
  id: string;
  type?: "official";
  name: string;
  job: string;
  rarity: string;
  image_url: string | null;
  cards?: GameCard[];
  version: number;
};

export type GameCreator = {
  id: string;
  type?: "creator";
  note_id: string;
  display_name: string;
  job?: string;
  rarity?: string;
  status?: string;
  battle_opt_in?: boolean;
  images: GameCard[];
};

export type CreatorGameData = {
  opponents: GameOpponent[];
  creators: GameCreator[];
};

export type PlayerDirectoryCard = {
  id: string;
  note_id: string;
  display_name: string;
  status: string;
  cards: GameCard[];
};

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function percent(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}
