import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/base/Button';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useResponsive } from '@/hooks/useResponsive';
import { useUserData } from '@/hooks/useUserData';
import { joinMatchmaking, leaveMatchmaking } from '@/services/online-match';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';
import type { MatchRoomRow } from '@/types/database';

type SearchPhase = 'joining' | 'waiting' | 'found' | 'error';

export function MatchSearchScreenView() {
  const { isCompact } = useResponsive();
  const { profile } = useUserData();
  const [phase, setPhase] = useState<SearchPhase>('joining');
  const [errorMsg, setErrorMsg] = useState('');
  const roomIdRef = useRef<string | null>(null);
  const roleRef = useRef<'p1' | 'p2'>('p1');

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function startMatchmaking() {
      try {
        const { roomId, role } = await joinMatchmaking();
        if (!mounted) return;
        roomIdRef.current = roomId;
        roleRef.current = role;

        // If we're p2, the room is already 'playing' — navigate immediately
        if (role === 'p2') {
          setPhase('found');
          setTimeout(() => {
            if (mounted) navigateToMatch(roomId, role);
          }, 800);
          return;
        }

        // p1: wait for p2 to join via Realtime
        setPhase('waiting');

        channel = supabase
          .channel(`matchmaking:${roomId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'match_rooms',
              filter: `id=eq.${roomId}`,
            },
            (payload) => {
              if (!mounted) return;
              const updated = payload.new as MatchRoomRow;
              if (updated.status === 'playing' && updated.player2_id) {
                setPhase('found');
                channel?.unsubscribe();
                setTimeout(() => {
                  if (mounted) navigateToMatch(roomId, 'p1');
                }, 800);
              }
            },
          )
          .subscribe();
      } catch (e) {
        if (!mounted) return;
        setErrorMsg(e instanceof Error ? e.message : 'Erro ao entrar na fila.');
        setPhase('error');
      }
    }

    startMatchmaking();

    return () => {
      mounted = false;
      channel?.unsubscribe();
    };
  }, []);

  function navigateToMatch(roomId: string, role: 'p1' | 'p2') {
    router.replace({
      pathname: '/(main)/jogo-online',
      params: { roomId, role },
    } as any);
  }

  async function handleCancel() {
    if (roomIdRef.current && roleRef.current === 'p1') {
      try {
        await leaveMatchmaking(roomIdRef.current);
      } catch {}
    }
    router.back();
  }

  return (
    <Screen
      withBottomNav
      stickyFooter={
        phase !== 'found'
          ? <Button title="Cancelar" variant="ghost" onPress={handleCancel} />
          : undefined
      }
      centered
    >
      <AppHeader compactBrand onRightPress={() => router.push('/(main)/configuracoes')} />

      <View style={styles.wrapper}>
        {/* Radar animation */}
        <View style={[styles.radar, isCompact && styles.radarCompact]}>
          <View style={[styles.radarRing, isCompact && styles.radarRingCompact]} />
          <View style={[styles.radarInnerRing, isCompact && styles.radarInnerRingCompact]} />
          <View style={[styles.dominoCore, isCompact && styles.dominoCoreCompact]}>
            {phase === 'found' ? (
              <MaterialCommunityIcons name="check-bold" size={isCompact ? 44 : 54} color={theme.colors.primary} />
            ) : phase === 'error' ? (
              <MaterialCommunityIcons name="alert" size={isCompact ? 44 : 54} color={theme.colors.danger} />
            ) : (
              <MaterialCommunityIcons name="domino-mask" size={isCompact ? 44 : 54} color={theme.colors.accent} />
            )}
          </View>
        </View>

        <View style={styles.copy}>
          {phase === 'joining' && (
            <>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={[styles.title, isCompact && styles.titleCompact]}>Entrando na fila…</Text>
            </>
          )}
          {phase === 'waiting' && (
            <>
              <Text style={[styles.title, isCompact && styles.titleCompact]}>Procurando adversário…</Text>
              <Text style={styles.subtitle}>Modo: 1v1 Online</Text>
            </>
          )}
          {phase === 'found' && (
            <>
              <Text style={[styles.title, isCompact && styles.titleCompact]}>Adversário encontrado!</Text>
              <Text style={styles.subtitle}>Iniciando partida…</Text>
            </>
          )}
          {phase === 'error' && (
            <>
              <Text style={[styles.title, styles.titleError, isCompact && styles.titleCompact]}>
                Erro
              </Text>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </>
          )}
        </View>

        {/* Player slots */}
        <View style={styles.players}>
          <View style={styles.playerSlot}>
            <View style={[styles.avatar, styles.avatarActive]}>
              <MaterialCommunityIcons
                name="account-star-outline"
                size={28}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.playerName}>{profile?.display_name ?? 'Você'}</Text>
          </View>

          <View style={styles.vsLabel}>
            <Text style={styles.vsText}>vs</Text>
          </View>

          <View style={styles.playerSlot}>
            <View style={[styles.avatar, phase === 'found' && styles.avatarFound]}>
              <MaterialCommunityIcons
                name={phase === 'found' ? 'account-check-outline' : 'timer-sand-empty'}
                size={28}
                color={phase === 'found' ? theme.colors.accent : theme.colors.textFaint}
              />
            </View>
            <Text style={[styles.playerName, phase === 'found' && styles.playerNameAccent]}>
              {phase === 'found' ? 'Adversário' : 'Aguardando…'}
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    minHeight: '88%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },

  radar: {
    width: 280,
    height: 280,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 228, 241, 0.15)',
  },
  radarCompact: { width: 236, height: 236 },
  radarRing: {
    position: 'absolute',
    inset: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 228, 241, 0.1)',
  },
  radarRingCompact: { inset: 22 },
  radarInnerRing: {
    position: 'absolute',
    inset: 54,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 228, 241, 0.08)',
  },
  radarInnerRingCompact: { inset: 46 },
  dominoCore: {
    width: 108,
    height: 148,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 228, 241, 0.16)',
  },
  dominoCoreCompact: { width: 92, height: 126 },

  copy: { alignItems: 'center', gap: theme.spacing.xs },
  title: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 30,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  titleCompact: { fontSize: 24 },
  titleError: { color: theme.colors.danger },
  subtitle: {
    color: theme.colors.accent,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  errorText: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
    textAlign: 'center',
  },

  players: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },
  vsLabel: {
    width: 32,
    alignItems: 'center',
  },
  vsText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  playerSlot: { alignItems: 'center', gap: theme.spacing.xs },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(77, 70, 53, 0.38)',
  },
  avatarActive: { borderStyle: 'solid', borderColor: theme.colors.primary },
  avatarFound: { borderStyle: 'solid', borderColor: theme.colors.accent },
  playerName: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  playerNameAccent: { color: theme.colors.accent },
});
