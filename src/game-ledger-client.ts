import { gameAuthHeaders } from "./game-data-client";
import type { BattleResult, GameMode } from "./game-types";

const LEDGER="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-battle-ledger";

export type RankingRow={rank:number;participantId:string;noteId:string;displayName:string;mainCardUrl:string|null;wins:number;draws:number;losses:number;games:number;winRate:number;points:number;bestScore:number;lastBattleAt:string|null;byGame:Record<GameMode,{wins:number;draws:number;losses:number;games:number;winRate:number}>};
export type BattleHistoryRow={id:string;gameMode:GameMode;result:BattleResult;score:number;createdAt:string;opponentType:"official"|"creator";playerCard:{position:number;url:string|null};opponent:{id:string|null;noteId:string|null;name:string;cardPosition:number;cardUrl:string|null}};
export type BattleRanking={total:number;rows:RankingRow[];rule:string;detailedHistoryPublic:boolean};

async function call(body:Record<string,unknown>,auth=false){
 const headers=auth?gameAuthHeaders():{"Content-Type":"application/json"};
 const r=await fetch(LEDGER,{method:"POST",headers,body:JSON.stringify(body),cache:"no-store"});
 const p=await r.json().catch(()=>({}));
 if(!r.ok||!p?.ok)throw new Error(String(p?.error||"BATTLE_LEDGER_ERROR"));
 return p;
}

export async function loadPublicRanking():Promise<BattleRanking>{const p=await call({action:"ranking"});return p.ranking as BattleRanking}
export async function loadMyBattleData():Promise<{history:BattleHistoryRow[];ranking:BattleRanking}>{const p=await call({action:"me"},true);return{history:Array.isArray(p.history)?p.history:[],ranking:p.ranking as BattleRanking}}
export async function recordBattle(input:{gameMode:GameMode;result:BattleResult;score:number;opponentType:"official"|"creator";opponentId:string;playerCardPosition:number;opponentCardPosition:number}){
 const matchKey=`mumei_${crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g,"")}`;
 return call({action:"record",matchKey,...input},true);
}
