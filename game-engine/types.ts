export type EnginePlayerId = 'human' | 'bot';
export type PlacementSide = 'left' | 'right';
export type MatchWinner = EnginePlayerId | 'draw';

export interface DominoTile {
  id: string;
  left: number;
  right: number;
}

export interface PlayedTile extends DominoTile {
  sourceId: string;
}

export interface EnginePlayer {
  id: EnginePlayerId;
  name: string;
  hand: DominoTile[];
}

export interface LegalMove {
  tileId: string;
  side: PlacementSide;
}

export interface TurnLogEntry {
  id: string;
  message: string;
}

export interface MatchResult {
  winner: MatchWinner;
  reason: 'empty-hand' | 'blocked';
  humanPips: number;
  botPips: number;
}

export interface DominoMatchState {
  players: Record<EnginePlayerId, EnginePlayer>;
  board: PlayedTile[];
  boneyard: DominoTile[];
  currentPlayer: EnginePlayerId;
  consecutivePasses: number;
  status: 'playing' | 'finished';
  result: MatchResult | null;
  turn: number;
  log: TurnLogEntry[];
}
