/**
 * Online 1v1 game engine
 * Pure functions — no side effects, no Supabase calls.
 * Uses 'p1' / 'p2' player IDs instead of 'human' / 'bot'.
 */

import type {
  OnlineGameState,
  OnlineLogEntry,
  OnlinePlayedTile,
  OnlinePlayerId,
  OnlineResult,
  OnlineTile,
} from '@/types/database';

// ── Tile helpers ──────────────────────────────────────────────────────────────

function createFullSet(): OnlineTile[] {
  const tiles: OnlineTile[] = [];
  for (let l = 0; l <= 6; l++) {
    for (let r = l; r <= 6; r++) {
      tiles.push({ id: `${l}-${r}`, left: l, right: r });
    }
  }
  return tiles;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function tileScore(tile: OnlineTile): number {
  return tile.left + tile.right + (tile.left === tile.right ? 8 : 0);
}

export function tileLabel(tile: OnlineTile | undefined): string {
  if (!tile) return '--';
  return `[${tile.left}|${tile.right}]`;
}

function sortHand(hand: OnlineTile[]): OnlineTile[] {
  return [...hand].sort((a, b) => tileScore(b) - tileScore(a));
}

export function getHandPips(hand: OnlineTile[]): number {
  return hand.reduce((sum, t) => sum + t.left + t.right, 0);
}

// ── State creation ────────────────────────────────────────────────────────────

export function createOnlineMatch(
  p1Id: string,
  p2Id: string,
  p1Name: string,
  p2Name: string,
  mode: 'classic' | 'express' = 'classic',
): OnlineGameState {
  const shuffled = shuffle(createFullSet());
  const p1Hand = sortHand(shuffled.slice(0, 7));
  const p2Hand = sortHand(shuffled.slice(7, 14));
  // Express mode: no boneyard — all remaining tiles are discarded
  const boneyard = mode === 'classic' ? shuffled.slice(14) : [];

  // Opening move: whoever holds the highest double goes first
  const opener = findOpener(p1Hand, p2Hand, p1Id, p2Id);

  let state: OnlineGameState = {
    p1Id,
    p2Id,
    p1Name,
    p2Name,
    p1Hand,
    p2Hand,
    board: [],
    boneyard,
    currentTurn: opener.role,
    consecutivePasses: 0,
    status: 'playing',
    result: null,
    turn: 1,
    log: [],
    mode,
  };

  // Play opening tile
  state = applyPlay(state, opener.role, opener.tileId, 'right');
  const openerName = opener.role === 'p1' ? p1Name : p2Name;
  const openerTile = shuffled.find((t) => t.id === opener.tileId);

  state = {
    ...state,
    currentTurn: opponent(opener.role),
    log: appendLog(state.log, `${openerName} abriu a mesa com ${tileLabel(openerTile)}.`),
    turn: 2,
  };

  return state;
}

// ── Legal moves ───────────────────────────────────────────────────────────────

export interface OnlineLegalMove {
  tileId: string;
  side: 'left' | 'right';
}

export function getOnlineLegalMoves(
  state: OnlineGameState,
  role: OnlinePlayerId,
): OnlineLegalMove[] {
  const hand = role === 'p1' ? state.p1Hand : state.p2Hand;

  if (state.board.length === 0) {
    return hand.map((t) => ({ tileId: t.id, side: 'right' as const }));
  }

  const leftVal = state.board[0].left;
  const rightVal = state.board[state.board.length - 1].right;
  const moves: OnlineLegalMove[] = [];

  for (const tile of hand) {
    if (tile.left === leftVal || tile.right === leftVal) {
      moves.push({ tileId: tile.id, side: 'left' });
    }
    if (tile.left === rightVal || tile.right === rightVal) {
      moves.push({ tileId: tile.id, side: 'right' });
    }
  }

  return dedupe(moves);
}

export function canOnlinePlayerMove(
  state: OnlineGameState,
  role: OnlinePlayerId,
): boolean {
  return getOnlineLegalMoves(state, role).length > 0;
}

// ── Move application ──────────────────────────────────────────────────────────

export function applyOnlineMove(
  state: OnlineGameState,
  role: OnlinePlayerId,
  tileId: string,
  side: 'left' | 'right',
): OnlineGameState {
  if (state.status === 'finished') return state;
  if (state.currentTurn !== role) throw new Error('Não é o turno deste jogador.');

  const legalMoves = getOnlineLegalMoves(state, role);
  if (!legalMoves.find((m) => m.tileId === tileId && m.side === side)) {
    throw new Error('Jogada inválida.');
  }

  const hand = role === 'p1' ? state.p1Hand : state.p2Hand;
  const tile = hand.find((t) => t.id === tileId);
  let next = applyPlay(state, role, tileId, side);
  const playerName = role === 'p1' ? state.p1Name : state.p2Name;

  next = {
    ...next,
    log: appendLog(next.log, `${playerName} jogou ${tileLabel(tile)}.`),
  };

  return resolveAfterAction(next, role);
}

export function applyOnlineDraw(
  state: OnlineGameState,
  role: OnlinePlayerId,
): OnlineGameState {
  if (state.status === 'finished') return state;
  if (state.currentTurn !== role) throw new Error('Não é o turno deste jogador.');
  if (state.mode !== 'classic') throw new Error('Compra não disponível neste modo.');

  if (state.boneyard.length === 0) {
    return applyOnlinePass(state, role);
  }

  const [drawn, ...rest] = state.boneyard;
  const hand = role === 'p1' ? state.p1Hand : state.p2Hand;
  const newHand = sortHand([...hand, drawn]);
  const playerName = role === 'p1' ? state.p1Name : state.p2Name;

  return {
    ...state,
    boneyard: rest,
    p1Hand: role === 'p1' ? newHand : state.p1Hand,
    p2Hand: role === 'p2' ? newHand : state.p2Hand,
    log: appendLog(state.log, `${playerName} comprou uma peça.`),
    // Turn does NOT flip — player gets to try again
  };
}

export function applyOnlinePass(
  state: OnlineGameState,
  role: OnlinePlayerId,
): OnlineGameState {
  if (state.status === 'finished') return state;

  const playerName = role === 'p1' ? state.p1Name : state.p2Name;
  const next: OnlineGameState = {
    ...state,
    currentTurn: opponent(role),
    consecutivePasses: state.consecutivePasses + 1,
    turn: state.turn + 1,
    log: appendLog(state.log, `${playerName} ficou sem jogadas.`),
  };

  // Game ends only when both players pass consecutively (regardless of mode)
  if (next.consecutivePasses >= 2) {
    return finishBlocked(next);
  }

  return next;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function applyPlay(
  state: OnlineGameState,
  role: OnlinePlayerId,
  tileId: string,
  side: 'left' | 'right',
): OnlineGameState {
  const hand = role === 'p1' ? state.p1Hand : state.p2Hand;
  const tile = hand.find((t) => t.id === tileId);
  if (!tile) throw new Error('Peça não encontrada.');

  const remaining = sortHand(hand.filter((t) => t.id !== tileId));
  const played = orientTile(state.board, tile, side);
  const nextBoard = side === 'left'
    ? [played, ...state.board]
    : [...state.board, played];

  return {
    ...state,
    board: nextBoard,
    p1Hand: role === 'p1' ? remaining : state.p1Hand,
    p2Hand: role === 'p2' ? remaining : state.p2Hand,
  };
}

function orientTile(
  board: OnlinePlayedTile[],
  tile: OnlineTile,
  side: 'left' | 'right',
): OnlinePlayedTile {
  if (board.length === 0) {
    return { ...tile, sourceId: tile.id };
  }

  if (side === 'left') {
    const match = board[0].left;
    if (tile.right === match) {
      return { id: `${tile.id}-l`, left: tile.left, right: tile.right, sourceId: tile.id };
    }
    return { id: `${tile.id}-l`, left: tile.right, right: tile.left, sourceId: tile.id };
  }

  const match = board[board.length - 1].right;
  if (tile.left === match) {
    return { id: `${tile.id}-r`, left: tile.left, right: tile.right, sourceId: tile.id };
  }
  return { id: `${tile.id}-r`, left: tile.right, right: tile.left, sourceId: tile.id };
}

function resolveAfterAction(
  state: OnlineGameState,
  role: OnlinePlayerId,
): OnlineGameState {
  const hand = role === 'p1' ? state.p1Hand : state.p2Hand;

  if (hand.length === 0) {
    const p1Pips = getHandPips(state.p1Hand);
    const p2Pips = getHandPips(state.p2Hand);
    return finishGame(state, {
      winner: role,
      reason: 'empty-hand',
      p1Pips,
      p2Pips,
    });
  }

  return {
    ...state,
    currentTurn: opponent(role),
    consecutivePasses: 0,
    turn: state.turn + 1,
  };
}

function finishBlocked(state: OnlineGameState): OnlineGameState {
  const p1Pips = getHandPips(state.p1Hand);
  const p2Pips = getHandPips(state.p2Hand);
  const winner: OnlinePlayerId | 'draw' =
    p1Pips === p2Pips ? 'draw' : p1Pips < p2Pips ? 'p1' : 'p2';

  return finishGame(state, { winner, reason: 'blocked', p1Pips, p2Pips });
}

export function finishGame(
  state: OnlineGameState,
  result: OnlineResult,
): OnlineGameState {
  const winnerName =
    result.winner === 'p1' ? state.p1Name
    : result.winner === 'p2' ? state.p2Name
    : null;

  const message =
    result.winner === 'draw'
      ? 'A partida terminou empatada.'
      : result.reason === 'blocked'
        ? `${winnerName} venceu por bloqueio.`
        : result.reason === 'abandoned'
          ? `${winnerName} venceu (adversário desistiu).`
          : `${winnerName} fechou a mão e venceu.`;

  return {
    ...state,
    status: 'finished',
    result,
    log: appendLog(state.log, message),
  };
}

function findOpener(
  p1Hand: OnlineTile[],
  p2Hand: OnlineTile[],
  p1Id: string,
  p2Id: string,
): { role: OnlinePlayerId; tileId: string } {
  const candidates = [
    ...p1Hand.map((t) => ({ role: 'p1' as OnlinePlayerId, tileId: t.id, tile: t })),
    ...p2Hand.map((t) => ({ role: 'p2' as OnlinePlayerId, tileId: t.id, tile: t })),
  ];

  return candidates.sort((a, b) => {
    const aD = a.tile.left === a.tile.right ? 1 : 0;
    const bD = b.tile.left === b.tile.right ? 1 : 0;
    if (aD !== bD) return bD - aD;
    return tileScore(b.tile) - tileScore(a.tile);
  })[0];
}

export function opponent(role: OnlinePlayerId): OnlinePlayerId {
  return role === 'p1' ? 'p2' : 'p1';
}

function appendLog(log: OnlineLogEntry[], message: string): OnlineLogEntry[] {
  return [{ id: `${Date.now()}-${log.length}`, message }, ...log].slice(0, 6);
}

function dedupe(moves: OnlineLegalMove[]): OnlineLegalMove[] {
  const seen = new Set<string>();
  return moves.filter((m) => {
    const key = `${m.tileId}:${m.side}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
