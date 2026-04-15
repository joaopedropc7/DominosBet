import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabase';
import {
  abandonMatch,
  fetchRoom,
  makeOnlineMove,
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const actingRef = useRef(false); // prevent double-sends

  // ── Derive myRole as OnlinePlayerId ───────────────────────────────────────
  const myRole: OnlinePlayerId = role === 'p1' ? 'p1' : 'p2';
  const isMyturn = game?.currentTurn === myRole && phase === 'playing';

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
          // abandoned — derive result from winner_id
          const winnerRole: OnlinePlayerId | 'draw' | null =
            updatedRoom.winner_id === updatedRoom.player1_id
              ? 'p1'
              : updatedRoom.winner_id === updatedRoom.player2_id
                ? 'p2'
                : 'draw';
          const terminated = finishGame(gs, {
            winner: winnerRole ?? 'draw',
            reason: 'abandoned',
            p1Pips: 0,
            p2Pips: 0,
          });
          setGame(terminated);
        } else if (gs) {
          setGame(gs);
        }
        setPhase('finished');
        return;
      }

      if (updatedRoom.status === 'playing') {
        const gs = updatedRoom.game_state as OnlineGameState | Record<string, never>;

        // p2 joined but game_state is empty → p2 must initialise
        if (!gs || !('p1Id' in gs)) {
          if (role === 'p2') {
            setPhase('starting');
            await initGame(updatedRoom);
          } else {
            // p1 waiting for p2 to push initial state
            setPhase('waiting');
          }
          return;
        }

        setGame(gs as OnlineGameState);
        setPhase((gs as OnlineGameState).status === 'finished' ? 'finished' : 'playing');
      }
    },
    [role],
  );

  // ── Initialise game (called by p2 when they join) ─────────────────────────
  async function initGame(currentRoom: MatchRoomRow) {
    try {
      const p1Id = currentRoom.player1_id;
      const p2Id = currentRoom.player2_id!;

      // Fetch opponent name
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', [p1Id, p2Id]);

      const p1Name = profiles?.find((p) => p.id === p1Id)?.display_name ?? 'Jogador 1';
      const p2Name = profiles?.find((p) => p.id === p2Id)?.display_name ?? 'Jogador 2';

      const initialState = createOnlineMatch(p1Id, p2Id, p1Name, p2Name);
      // first turn is determined by opener selection inside createOnlineMatch
      const firstTurnUserId =
        initialState.currentTurn === 'p1' ? p1Id : p2Id;

      await startOnlineMatch(roomId, initialState, firstTurnUserId);
      // Realtime will fire and update state for both players
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
          const updated = payload.new as MatchRoomRow;
          await applyRoomUpdate(updated);
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
        setGame(next); // optimistic update
        await makeOnlineMove(roomId, next, true);
        if (next.status === 'finished') setPhase('finished');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao jogar.');
        // Revert optimistic update
        setGame(game);
      } finally {
        actingRef.current = false;
      }
    },
    [game, isMyturn, myRole, roomId],
  );

  const drawTile = useCallback(async () => {
    if (!game || !isMyturn || actingRef.current) return;
    actingRef.current = true;
    try {
      const next = applyOnlineDraw(game, myRole);
      setGame(next);
      await makeOnlineMove(roomId, next, false); // don't flip turn
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
      if (next.status === 'finished') setPhase('finished');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao passar.');
      setGame(game);
    } finally {
      actingRef.current = false;
    }
  }, [game, isMyturn, myRole, roomId]);

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
    playTile,
    drawTile,
    passTurn,
    abandonGame,
  };
}
