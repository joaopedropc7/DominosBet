import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabase';
import {
  abandonMatch,
  fetchRoom,
  makeOnlineMove,
  resolveOnlineMatch,
  startOnlineMatch,
} from '@/services/online-match';
import {
  applyOnlineDraw,
  applyOnlineMove,
  applyOnlinePass,
  createOnlineMatch,
  finishGame,
  opponent,
} from '@/game-engine/online-game';
import type { MatchRoomRow, OnlineGameState, OnlinePlayerId } from '@/types/database';

export type OnlineMatchPhase =
  | 'loading'    // fetching initial room state
  | 'waiting'    // p1 waiting for p2 to join
  | 'starting'   // p2 just joined, initialising game
  | 'playing'    // in progress
  | 'finished'   // game over
  | 'error';

export interface MatchRewards {
  winnerReward: number;
  loserReward: number;
  iWon: boolean;
  isDraw: boolean;
  myReward: number;
}

interface UseOnlineMatchOptions {
  roomId: string;
  role: 'p1' | 'p2';
  myUserId: string;
  myName: string;
}

export interface OnlineMatchHandle {
  phase: OnlineMatchPhase;
  game: OnlineGameState | null;
  room: MatchRoomRow | null;
  myRole: OnlinePlayerId;
  isMyturn: boolean;
  error: string;
  rewards: MatchRewards | null;
  matchStartedAt: number | null;   // Date.now() when game entered 'playing'
  playTile: (tileId: string, side: 'left' | 'right') => Promise<void>;
  drawTile: () => Promise<void>;
  passTurn: () => Promise<void>;
  abandonGame: () => Promise<void>;
}

export function useOnlineMatch({
  roomId,
  role,
  myUserId,
  myName,
}: UseOnlineMatchOptions): OnlineMatchHandle {
  const [phase, setPhase] = useState<OnlineMatchPhase>('loading');
  const [room, setRoom] = useState<MatchRoomRow | null>(null);
  const [game, setGame] = useState<OnlineGameState | null>(null);
  const [error, setError] = useState('');
  const [rewards, setRewards] = useState<MatchRewards | null>(null);
  const [matchStartedAt, setMatchStartedAt] = useState<number | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const actingRef = useRef(false);
  const resolvedRef = useRef(false);   // prevent double-resolve
  const startedAtRef = useRef<number | null>(null);

  const myRole: OnlinePlayerId = role === 'p1' ? 'p1' : 'p2';
  const isMyturn = game?.currentTurn === myRole && phase === 'playing';

  // ── Resolve match payout ──────────────────────────────────────────────────
  const resolveMatch = useCallback(
    async (finishedGame: OnlineGameState, currentRoom: MatchRoomRow) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;

      const result = finishedGame.result;
      if (!result) return;

      const durationSeconds = startedAtRef.current
        ? Math.round((Date.now() - startedAtRef.current) / 1000)
        : 0;

      const winnerId =
        result.winner === 'p1' ? currentRoom.player1_id
        : result.winner === 'p2' ? currentRoom.player2_id
        : null; // draw

      try {
        const { winnerReward, loserReward } = await resolveOnlineMatch(
          roomId,
          winnerId,
          durationSeconds,
          result.p1Pips,
          result.p2Pips,
        );

        const iWon = winnerId === myUserId;
        const isDraw = winnerId === null;

        setRewards({
          winnerReward,
          loserReward,
          iWon,
          isDraw,
          myReward: isDraw ? loserReward : iWon ? winnerReward : loserReward,
        });
      } catch {
        // Already resolved by opponent — fetch rewards from existing data
        const iWon = winnerId === myUserId;
        const isDraw = winnerId === null;
        setRewards({
          winnerReward: currentRoom.pot ? Math.round(currentRoom.pot * 0.9) : 0,
          loserReward: 0,
          iWon,
          isDraw,
          myReward: iWon ? Math.round((currentRoom.pot ?? 0) * 0.9) : 0,
        });
      }
    },
    [roomId, myUserId],
  );

  // ── Handle incoming room updates ──────────────────────────────────────────
  const applyRoomUpdate = useCallback(
    async (updatedRoom: MatchRoomRow) => {
      setRoom(updatedRoom);

      if (updatedRoom.status === 'waiting') {
        setPhase('waiting');
        return;
      }

      if (updatedRoom.status === 'finished') {
        const gs = updatedRoom.game_state as OnlineGameState;
        if (gs && gs.status !== 'finished') {
          const winnerRole: OnlinePlayerId | 'draw' =
            updatedRoom.winner_id === updatedRoom.player1_id ? 'p1'
            : updatedRoom.winner_id === updatedRoom.player2_id ? 'p2'
            : 'draw';
          const terminated = finishGame(gs, {
            winner: winnerRole,
            reason: 'abandoned',
            p1Pips: 0,
            p2Pips: 0,
          });
          setGame(terminated);
          await resolveMatch(terminated, updatedRoom);
        } else if (gs) {
          setGame(gs);
          await resolveMatch(gs, updatedRoom);
        }
        setPhase('finished');
        return;
      }

      if (updatedRoom.status === 'playing') {
        const gs = updatedRoom.game_state as OnlineGameState | Record<string, never>;

        if (!gs || !('p1Id' in gs)) {
          if (role === 'p2') {
            setPhase('starting');
            await initGame(updatedRoom);
          } else {
            setPhase('waiting');
          }
          return;
        }

        const typedGs = gs as OnlineGameState;

        if (typedGs.status === 'finished') {
          setGame(typedGs);
          await resolveMatch(typedGs, updatedRoom);
          setPhase('finished');
          return;
        }

        // First time entering 'playing' — record start time
        if (!startedAtRef.current) {
          const t = Date.now();
          startedAtRef.current = t;
          setMatchStartedAt(t);
        }

        setGame(typedGs);
        setPhase('playing');
      }
    },
    [role, resolveMatch],
  );

  // ── Initialise game (called by p2 when they join) ─────────────────────────
  async function initGame(currentRoom: MatchRoomRow) {
    try {
      const p1Id = currentRoom.player1_id;
      const p2Id = currentRoom.player2_id!;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', [p1Id, p2Id]);

      const p1Name = profiles?.find((p) => p.id === p1Id)?.display_name ?? 'Jogador 1';
      const p2Name = profiles?.find((p) => p.id === p2Id)?.display_name ?? 'Jogador 2';

      const initialState = createOnlineMatch(p1Id, p2Id, p1Name, p2Name);
      const firstTurnUserId = initialState.currentTurn === 'p1' ? p1Id : p2Id;

      // start_online_match now deducts entry fees atomically
      await startOnlineMatch(roomId, initialState, firstTurnUserId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar partida.');
      setPhase('error');
    }
  }

  // ── Subscribe to Realtime ─────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const initialRoom = await fetchRoom(roomId);
        if (!mounted) return;
        await applyRoomUpdate(initialRoom);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Erro ao carregar sala.');
        setPhase('error');
      }
    }

    bootstrap();

    const channel = supabase
      .channel(`match_room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'match_rooms',
          filter: `id=eq.${roomId}`,
        },
        async (payload) => {
          if (!mounted) return;
          await applyRoomUpdate(payload.new as MatchRoomRow);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      mounted = false;
      channel.unsubscribe();
    };
  }, [roomId, applyRoomUpdate]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const playTile = useCallback(
    async (tileId: string, side: 'left' | 'right') => {
      if (!game || !isMyturn || actingRef.current) return;
      actingRef.current = true;
      try {
        const next = applyOnlineMove(game, myRole, tileId, side);
        setGame(next);
        await makeOnlineMove(roomId, next, true);
        if (next.status === 'finished') {
          setPhase('finished');
          await resolveMatch(next, room!);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao jogar.');
        setGame(game);
      } finally {
        actingRef.current = false;
      }
    },
    [game, isMyturn, myRole, roomId, resolveMatch, room],
  );

  const drawTile = useCallback(async () => {
    if (!game || !isMyturn || actingRef.current) return;
    actingRef.current = true;
    try {
      const next = applyOnlineDraw(game, myRole);
      setGame(next);
      await makeOnlineMove(roomId, next, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao comprar.');
      setGame(game);
    } finally {
      actingRef.current = false;
    }
  }, [game, isMyturn, myRole, roomId]);

  const passTurn = useCallback(async () => {
    if (!game || !isMyturn || actingRef.current) return;
    actingRef.current = true;
    try {
      const next = applyOnlinePass(game, myRole);
      setGame(next);
      await makeOnlineMove(roomId, next, true);
      if (next.status === 'finished') {
        setPhase('finished');
        await resolveMatch(next, room!);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao passar.');
      setGame(game);
    } finally {
      actingRef.current = false;
    }
  }, [game, isMyturn, myRole, roomId, resolveMatch, room]);

  const abandonGame = useCallback(async () => {
    try {
      await abandonMatch(roomId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao abandonar.');
    }
  }, [roomId]);

  return {
    phase,
    game,
    room,
    myRole,
    isMyturn,
    error,
    rewards,
    matchStartedAt,
    playTile,
    drawTile,
    passTurn,
    abandonGame,
  };
}
