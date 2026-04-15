import type { DominoTile, PlayedTile, TurnLogEntry } from './types';

export type FourPlayerId = 'p1' | 'p2' | 'p3' | 'p4';
// Teams: A = p1 + p3  |  B = p2 + p4
export type TeamId = 'team_a' | 'team_b';

export interface FourPlayer {
  id: FourPlayerId;
  name: string;
  hand: DominoTile[];
  isBot: boolean;
  teamId: TeamId;
}

export interface FourPlayerResult {
  /** Player who emptied the hand, or winning team on block */
  winner: FourPlayerId | 'draw';
  winnerTeam: TeamId | 'draw';
  reason: 'empty-hand' | 'blocked';
  pipsByPlayer: Record<FourPlayerId, number>;
  pipsByTeam: Record<TeamId, number>;
}

export interface FourPlayerMatchState {
  players: Record<FourPlayerId, FourPlayer>;
  board: PlayedTile[];
  boneyard: DominoTile[];
  turnOrder: FourPlayerId[];   // always ['p1','p2','p3','p4']
  currentPlayer: FourPlayerId;
  consecutivePasses: number;   // blocked when >= 4 (all passed)
  status: 'playing' | 'finished';
  result: FourPlayerResult | null;
  turn: number;
  log: TurnLogEntry[];
}
