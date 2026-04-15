import type {
  DominoMatchState,
  DominoTile,
  EnginePlayerId,
  LegalMove,
  MatchResult,
  PlacementSide,
  PlayedTile,
  TurnLogEntry,
} from './types';

const PLAYER_NAMES: Record<EnginePlayerId, string> = {
  human: 'Você',
  bot: 'Bot Noir',
};

export function createBotMatch(): DominoMatchState {
  const shuffled = shuffle(createFullSet());
  const humanHand = shuffled.slice(0, 7);
  const botHand = shuffled.slice(7, 14);
  const boneyard = shuffled.slice(14);

  let state: DominoMatchState = {
    players: {
      human: { id: 'human', name: PLAYER_NAMES.human, hand: sortHand(humanHand) },
      bot: { id: 'bot', name: PLAYER_NAMES.bot, hand: sortHand(botHand) },
    },
    board: [],
    boneyard,
    currentPlayer: 'human',
    consecutivePasses: 0,
    status: 'playing',
    result: null,
    turn: 1,
    log: [],
  };

  const opener = findOpeningMove(state);
  state = applyPlay(state, opener.playerId, opener.tileId, 'right');
  state = {
    ...state,
    currentPlayer: opener.playerId === 'human' ? 'bot' : 'human',
    log: appendLog(
      state.log,
      `${PLAYER_NAMES[opener.playerId]} abriu a mesa com ${tileLabel(opener.tile)}.`,
    ),
  };

  return state;
}

export function getLegalMoves(state: DominoMatchState, playerId: EnginePlayerId): LegalMove[] {
  const hand = state.players[playerId].hand;

  if (state.board.length === 0) {
    return hand.map((tile) => ({ tileId: tile.id, side: 'right' }));
  }

  const leftTarget = state.board[0].left;
  const rightTarget = state.board[state.board.length - 1].right;
  const moves: LegalMove[] = [];

  hand.forEach((tile) => {
    if (tile.left === leftTarget || tile.right === leftTarget) {
      moves.push({ tileId: tile.id, side: 'left' });
    }

    if (tile.left === rightTarget || tile.right === rightTarget) {
      moves.push({ tileId: tile.id, side: 'right' });
    }
  });

  return dedupeMoves(moves);
}

export function canPlayerMove(state: DominoMatchState, playerId: EnginePlayerId) {
  return getLegalMoves(state, playerId).length > 0;
}

export function playMove(
  state: DominoMatchState,
  playerId: EnginePlayerId,
  tileId: string,
  side: PlacementSide,
): DominoMatchState {
  if (state.status === 'finished') return state;
  if (state.currentPlayer !== playerId) {
    throw new Error('Não é o turno deste jogador.');
  }

  const legalMove = getLegalMoves(state, playerId).find((move) => move.tileId === tileId && move.side === side);
  if (!legalMove) {
    throw new Error('Essa jogada não é válida agora.');
  }

  let next = applyPlay(state, playerId, tileId, side);
  const tile = state.players[playerId].hand.find((item) => item.id === tileId);

  next = {
    ...next,
    log: appendLog(next.log, `${PLAYER_NAMES[playerId]} jogou ${tileLabel(tile)}.`),
  };

  return resolveAfterAction(next, playerId);
}

export function drawForPlayer(state: DominoMatchState, playerId: EnginePlayerId): DominoMatchState {
  if (state.status === 'finished') return state;
  if (state.currentPlayer !== playerId) {
    throw new Error('Não é o turno deste jogador.');
  }

  if (state.boneyard.length === 0) {
    return passTurn(state, playerId, `${PLAYER_NAMES[playerId]} passou a vez.`);
  }

  const [drawnTile, ...rest] = state.boneyard;
  const updatedHand = sortHand([...state.players[playerId].hand, drawnTile]);

  return {
    ...state,
    boneyard: rest,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        hand: updatedHand,
      },
    },
    log: appendLog(state.log, `${PLAYER_NAMES[playerId]} comprou uma peça.`),
  };
}

export function passTurn(state: DominoMatchState, playerId: EnginePlayerId, customMessage?: string): DominoMatchState {
  if (state.status === 'finished') return state;

  const nextPlayer = otherPlayer(playerId);
  const nextState: DominoMatchState = {
    ...state,
    currentPlayer: nextPlayer,
    consecutivePasses: state.consecutivePasses + 1,
    turn: state.turn + 1,
    log: appendLog(state.log, customMessage ?? `${PLAYER_NAMES[playerId]} passou a vez.`),
  };

  // Finish when both players pass consecutively — blocked regardless of boneyard
  // (the UI has no draw mechanic, so the boneyard check is omitted)
  if (nextState.consecutivePasses >= 2) {
    return finishBlockedGame(nextState);
  }

  return nextState;
}

export function chooseBotMove(state: DominoMatchState): LegalMove | null {
  const moves = getLegalMoves(state, 'bot');
  if (!moves.length) return null;

  return [...moves].sort((a, b) => {
    const tileA = state.players.bot.hand.find((item) => item.id === a.tileId)!;
    const tileB = state.players.bot.hand.find((item) => item.id === b.tileId)!;
    return tileScore(tileB) - tileScore(tileA);
  })[0];
}

export function tileScore(tile: DominoTile) {
  return tile.left + tile.right + (tile.left === tile.right ? 8 : 0);
}

export function tileLabel(tile: DominoTile | undefined) {
  if (!tile) return '--';
  return `[${tile.left}|${tile.right}]`;
}

export function getHandPips(hand: DominoTile[]) {
  return hand.reduce((total, tile) => total + tile.left + tile.right, 0);
}

function resolveAfterAction(state: DominoMatchState, playerId: EnginePlayerId): DominoMatchState {
  const hand = state.players[playerId].hand;
  if (hand.length === 0) {
    return finishGame(state, {
      winner: playerId,
      reason: 'empty-hand',
      humanPips: getHandPips(state.players.human.hand),
      botPips: getHandPips(state.players.bot.hand),
    });
  }

  return {
    ...state,
    currentPlayer: otherPlayer(playerId),
    consecutivePasses: 0,
    turn: state.turn + 1,
  };
}

function finishBlockedGame(state: DominoMatchState): DominoMatchState {
  const humanPips = getHandPips(state.players.human.hand);
  const botPips = getHandPips(state.players.bot.hand);

  const result: MatchResult = {
    winner: humanPips === botPips ? 'draw' : humanPips < botPips ? 'human' : 'bot',
    reason: 'blocked',
    humanPips,
    botPips,
  };

  return finishGame(state, result);
}

function finishGame(state: DominoMatchState, result: MatchResult): DominoMatchState {
  return {
    ...state,
    status: 'finished',
    result,
    log: appendLog(state.log, finishMessage(result)),
  };
}

function finishMessage(result: MatchResult) {
  if (result.winner === 'draw') {
    return 'A partida terminou empatada.';
  }

  if (result.reason === 'blocked') {
    return `${PLAYER_NAMES[result.winner]} venceu por bloqueio.`;
  }

  return `${PLAYER_NAMES[result.winner]} fechou a mão e venceu a rodada.`;
}

function applyPlay(
  state: DominoMatchState,
  playerId: EnginePlayerId,
  tileId: string,
  side: PlacementSide,
): DominoMatchState {
  const hand = state.players[playerId].hand;
  const tile = hand.find((item) => item.id === tileId);

  if (!tile) {
    throw new Error('Peça não encontrada na mão.');
  }

  const remainingHand = sortHand(hand.filter((item) => item.id !== tileId));
  const playedTile = orientTileForBoard(state.board, tile, side);
  const nextBoard = side === 'left' ? [playedTile, ...state.board] : [...state.board, playedTile];

  return {
    ...state,
    board: nextBoard,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        hand: remainingHand,
      },
    },
  };
}

function orientTileForBoard(board: PlayedTile[], tile: DominoTile, side: PlacementSide): PlayedTile {
  if (board.length === 0) {
    return { ...tile, sourceId: tile.id };
  }

  if (side === 'left') {
    const matchValue = board[0].left;
    if (tile.right === matchValue) {
      return { id: `${tile.id}-l`, left: tile.left, right: tile.right, sourceId: tile.id };
    }

    return { id: `${tile.id}-l`, left: tile.right, right: tile.left, sourceId: tile.id };
  }

  const matchValue = board[board.length - 1].right;
  if (tile.left === matchValue) {
    return { id: `${tile.id}-r`, left: tile.left, right: tile.right, sourceId: tile.id };
  }

  return { id: `${tile.id}-r`, left: tile.right, right: tile.left, sourceId: tile.id };
}

function findOpeningMove(state: DominoMatchState) {
  const candidates = (['human', 'bot'] as EnginePlayerId[]).flatMap((playerId) =>
    state.players[playerId].hand.map((tile) => ({ playerId, tileId: tile.id, tile })),
  );

  return candidates.sort((a, b) => {
    const aDouble = a.tile.left === a.tile.right ? 1 : 0;
    const bDouble = b.tile.left === b.tile.right ? 1 : 0;
    if (aDouble !== bDouble) return bDouble - aDouble;
    return tileScore(b.tile) - tileScore(a.tile);
  })[0];
}

function otherPlayer(playerId: EnginePlayerId): EnginePlayerId {
  return playerId === 'human' ? 'bot' : 'human';
}

function appendLog(log: TurnLogEntry[], message: string): TurnLogEntry[] {
  return [{ id: `${Date.now()}-${log.length}`, message }, ...log].slice(0, 6);
}

function dedupeMoves(moves: LegalMove[]) {
  const seen = new Set<string>();
  return moves.filter((move) => {
    const key = `${move.tileId}:${move.side}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createFullSet(): DominoTile[] {
  const set: DominoTile[] = [];
  for (let left = 0; left <= 6; left += 1) {
    for (let right = left; right <= 6; right += 1) {
      set.push({
        id: `${left}-${right}`,
        left,
        right,
      });
    }
  }
  return set;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function sortHand(hand: DominoTile[]) {
  return [...hand].sort((a, b) => tileScore(b) - tileScore(a));
}
