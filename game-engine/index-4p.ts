import type { DominoTile, LegalMove, PlacementSide, PlayedTile, TurnLogEntry } from './types';
import type { FourPlayerId, FourPlayerMatchState, FourPlayerResult, TeamId } from './types-4p';

const TURN_ORDER: FourPlayerId[] = ['p1', 'p2', 'p3', 'p4'];
const TEAM: Record<FourPlayerId, TeamId> = {
  p1: 'team_a', p2: 'team_b', p3: 'team_a', p4: 'team_b',
};
const PLAYER_NAMES: Record<FourPlayerId, string> = {
  p1: 'Você', p2: 'Bot Noir', p3: 'Bot Ally', p4: 'Bot Sombra',
};

// ── Factory ────────────────────────────────────────────────────────────────

export function createFourPlayerMatch(): FourPlayerMatchState {
  const shuffled = shuffle(createFullSet());

  let state: FourPlayerMatchState = {
    players: {
      p1: { id: 'p1', name: PLAYER_NAMES.p1, hand: sortHand(shuffled.slice(0, 7)),  isBot: false, teamId: 'team_a' },
      p2: { id: 'p2', name: PLAYER_NAMES.p2, hand: sortHand(shuffled.slice(7, 14)), isBot: true,  teamId: 'team_b' },
      p3: { id: 'p3', name: PLAYER_NAMES.p3, hand: sortHand(shuffled.slice(14, 21)),isBot: true,  teamId: 'team_a' },
      p4: { id: 'p4', name: PLAYER_NAMES.p4, hand: sortHand(shuffled.slice(21, 28)),isBot: true,  teamId: 'team_b' },
    },
    board: [],
    boneyard: shuffled.slice(28), // remaining tiles (0 in standard 4P — full 28 tile set)
    turnOrder: TURN_ORDER,
    currentPlayer: 'p1',
    consecutivePasses: 0,
    status: 'playing',
    result: null,
    turn: 1,
    log: [],
  };

  // Find who opens (highest double or highest tile)
  const opener = findOpeningMove(state);
  state = applyPlay(state, opener.playerId, opener.tileId, 'right');
  state = {
    ...state,
    currentPlayer: nextPlayer(opener.playerId),
    log: appendLog(state.log, `${PLAYER_NAMES[opener.playerId]} abriu com ${tileLabel(opener.tile)}.`),
  };

  return state;
}

// ── Queries ────────────────────────────────────────────────────────────────

export function getLegalMoves4P(state: FourPlayerMatchState, playerId: FourPlayerId): LegalMove[] {
  const hand = state.players[playerId].hand;
  if (state.board.length === 0) return hand.map(t => ({ tileId: t.id, side: 'right' as PlacementSide }));

  const leftTarget  = state.board[0].left;
  const rightTarget = state.board[state.board.length - 1].right;
  const moves: LegalMove[] = [];

  hand.forEach(tile => {
    if (tile.left === leftTarget  || tile.right === leftTarget)  moves.push({ tileId: tile.id, side: 'left' });
    if (tile.left === rightTarget || tile.right === rightTarget) moves.push({ tileId: tile.id, side: 'right' });
  });

  return dedupeMoves(moves);
}

// ── Actions ────────────────────────────────────────────────────────────────

export function playMove4P(
  state: FourPlayerMatchState,
  playerId: FourPlayerId,
  tileId: string,
  side: PlacementSide,
): FourPlayerMatchState {
  if (state.status === 'finished') return state;
  if (state.currentPlayer !== playerId) throw new Error('Não é o turno deste jogador.');

  const legal = getLegalMoves4P(state, playerId).find(m => m.tileId === tileId && m.side === side);
  if (!legal) throw new Error('Jogada inválida.');

  const tile = state.players[playerId].hand.find(t => t.id === tileId);
  let next = applyPlay(state, playerId, tileId, side);
  next = { ...next, log: appendLog(next.log, `${PLAYER_NAMES[playerId]} jogou ${tileLabel(tile)}.`) };
  return resolveAfterPlay(next, playerId);
}

export function passTurn4P(
  state: FourPlayerMatchState,
  playerId: FourPlayerId,
  customMessage?: string,
): FourPlayerMatchState {
  if (state.status === 'finished') return state;

  const next: FourPlayerMatchState = {
    ...state,
    currentPlayer: nextPlayer(playerId),
    consecutivePasses: state.consecutivePasses + 1,
    turn: state.turn + 1,
    log: appendLog(state.log, customMessage ?? `${PLAYER_NAMES[playerId]} passou a vez.`),
  };

  // All 4 players passed consecutively = blocked
  if (next.consecutivePasses >= 4) return finishBlocked(next);
  return next;
}

export function chooseBotMove4P(state: FourPlayerMatchState, playerId: FourPlayerId): LegalMove | null {
  const moves = getLegalMoves4P(state, playerId);
  if (!moves.length) return null;

  return [...moves].sort((a, b) => {
    const tA = state.players[playerId].hand.find(t => t.id === a.tileId)!;
    const tB = state.players[playerId].hand.find(t => t.id === b.tileId)!;
    return tileScore(tB) - tileScore(tA);
  })[0];
}

export function runBotTurn4P(state: FourPlayerMatchState): FourPlayerMatchState {
  const playerId = state.currentPlayer;
  if (state.status !== 'playing' || !state.players[playerId].isBot) return state;

  const move = chooseBotMove4P(state, playerId);
  if (move) return playMove4P(state, playerId, move.tileId, move.side);
  return passTurn4P(state, playerId);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveAfterPlay(state: FourPlayerMatchState, playerId: FourPlayerId): FourPlayerMatchState {
  if (state.players[playerId].hand.length === 0) return finishEmptyHand(state, playerId);
  return { ...state, currentPlayer: nextPlayer(playerId), consecutivePasses: 0, turn: state.turn + 1 };
}

function finishEmptyHand(state: FourPlayerMatchState, winnerId: FourPlayerId): FourPlayerMatchState {
  const pips = pipsByPlayer(state);
  const teamPips = pipsByTeam(pips);
  return finishGame(state, {
    winner: winnerId,
    winnerTeam: TEAM[winnerId],
    reason: 'empty-hand',
    pipsByPlayer: pips,
    pipsByTeam: teamPips,
  });
}

function finishBlocked(state: FourPlayerMatchState): FourPlayerMatchState {
  const pips = pipsByPlayer(state);
  const teamPips = pipsByTeam(pips);
  const winnerTeam: TeamId | 'draw' =
    teamPips.team_a < teamPips.team_b ? 'team_a' :
    teamPips.team_b < teamPips.team_a ? 'team_b' : 'draw';

  // Winner player = lowest pip count among winners' team (or 'draw')
  let winner: FourPlayerId | 'draw' = 'draw';
  if (winnerTeam !== 'draw') {
    const teamPlayers = TURN_ORDER.filter(id => TEAM[id] === winnerTeam);
    winner = teamPlayers.reduce((best, id) => pips[id] < pips[best] ? id : best, teamPlayers[0]);
  }

  return finishGame(state, { winner, winnerTeam, reason: 'blocked', pipsByPlayer: pips, pipsByTeam: teamPips });
}

function finishGame(state: FourPlayerMatchState, result: FourPlayerResult): FourPlayerMatchState {
  const msg = result.reason === 'blocked'
    ? result.winnerTeam === 'draw'
      ? 'Jogo bloqueado — empate!'
      : `Time ${result.winnerTeam === 'team_a' ? 'A (Você+Ally)' : 'B (Noirs)'} venceu por bloqueio.`
    : `${PLAYER_NAMES[result.winner as FourPlayerId]} fechou a mão!`;

  return { ...state, status: 'finished', result, log: appendLog(state.log, msg) };
}

function applyPlay(state: FourPlayerMatchState, playerId: FourPlayerId, tileId: string, side: PlacementSide): FourPlayerMatchState {
  const hand = state.players[playerId].hand;
  const tile = hand.find(t => t.id === tileId);
  if (!tile) throw new Error('Peça não encontrada.');

  const remainingHand = sortHand(hand.filter(t => t.id !== tileId));
  const playedTile = orientTile(state.board, tile, side);
  const nextBoard = side === 'left' ? [playedTile, ...state.board] : [...state.board, playedTile];

  return { ...state, board: nextBoard, players: { ...state.players, [playerId]: { ...state.players[playerId], hand: remainingHand } } };
}

function orientTile(board: PlayedTile[], tile: DominoTile, side: PlacementSide): PlayedTile {
  if (board.length === 0) return { ...tile, sourceId: tile.id };
  if (side === 'left') {
    const match = board[0].left;
    return tile.right === match
      ? { id: `${tile.id}-l`, left: tile.left,  right: tile.right, sourceId: tile.id }
      : { id: `${tile.id}-l`, left: tile.right, right: tile.left,  sourceId: tile.id };
  }
  const match = board[board.length - 1].right;
  return tile.left === match
    ? { id: `${tile.id}-r`, left: tile.left,  right: tile.right, sourceId: tile.id }
    : { id: `${tile.id}-r`, left: tile.right, right: tile.left,  sourceId: tile.id };
}

function nextPlayer(current: FourPlayerId): FourPlayerId {
  const idx = TURN_ORDER.indexOf(current);
  return TURN_ORDER[(idx + 1) % 4];
}

function findOpeningMove(state: FourPlayerMatchState) {
  const candidates = TURN_ORDER.flatMap(playerId =>
    state.players[playerId].hand.map(tile => ({ playerId, tileId: tile.id, tile })),
  );
  return candidates.sort((a, b) => {
    const aD = a.tile.left === a.tile.right ? 1 : 0;
    const bD = b.tile.left === b.tile.right ? 1 : 0;
    if (aD !== bD) return bD - aD;
    return tileScore(b.tile) - tileScore(a.tile);
  })[0];
}

function pipsByPlayer(state: FourPlayerMatchState): Record<FourPlayerId, number> {
  return {
    p1: getHandPips(state.players.p1.hand),
    p2: getHandPips(state.players.p2.hand),
    p3: getHandPips(state.players.p3.hand),
    p4: getHandPips(state.players.p4.hand),
  };
}

function pipsByTeam(pips: Record<FourPlayerId, number>): Record<TeamId, number> {
  return { team_a: pips.p1 + pips.p3, team_b: pips.p2 + pips.p4 };
}

export function getHandPips(hand: DominoTile[]) {
  return hand.reduce((s, t) => s + t.left + t.right, 0);
}

export function tileScore(tile: DominoTile) {
  return tile.left + tile.right + (tile.left === tile.right ? 8 : 0);
}

export function tileLabel(tile: DominoTile | undefined) {
  if (!tile) return '--';
  return `[${tile.left}|${tile.right}]`;
}

function appendLog(log: TurnLogEntry[], message: string): TurnLogEntry[] {
  return [{ id: `${Date.now()}-${log.length}`, message }, ...log].slice(0, 8);
}

function dedupeMoves(moves: LegalMove[]) {
  const seen = new Set<string>();
  return moves.filter(m => { const k = `${m.tileId}:${m.side}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

function createFullSet(): DominoTile[] {
  const set: DominoTile[] = [];
  for (let l = 0; l <= 6; l++) for (let r = l; r <= 6; r++) set.push({ id: `${l}-${r}`, left: l, right: r });
  return set;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sortHand(hand: DominoTile[]) {
  return [...hand].sort((a, b) => tileScore(b) - tileScore(a));
}
