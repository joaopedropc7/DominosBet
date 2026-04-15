import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cancelPrivateRoom } from '@/services/private-room';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';
import { formatCoins } from '@/utils/format';
import type { MatchRoomRow } from '@/types/database';

const APP_URL = 'https://dominos-bet-sooty.vercel.app';

interface RoomLobbyScreenViewProps {
  roomId: string;
  inviteCode: string;
  entryFee: number;
  roomName?: string;
}

export function RoomLobbyScreenView({
  roomId,
  inviteCode,
  entryFee,
  roomName,
}: RoomLobbyScreenViewProps) {
  const prize      = Math.round(entryFee * 2 * 0.9);
  const inviteLink = `${APP_URL}/entrar/${inviteCode}`;

  // Pulse animation for the waiting indicator
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.sine) }),
      -1,
      true,
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // Realtime: wait for player2 to join
  useEffect(() => {
    const channel = supabase
      .channel(`private_room_lobby:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'match_rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new as MatchRoomRow;
          if (updated.status === 'playing' && updated.player2_id) {
            channel.unsubscribe();
            router.replace({
              pathname: '/(main)/jogo-online',
              params: { roomId, role: 'p1' },
            } as any);
          }
        },
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [roomId]);

  async function handleShare() {
    try {
      await Share.share({
        message: `Vamos jogar dominó? Entre na minha sala com o código **${inviteCode}** ou pelo link:\n${inviteLink}`,
        url: inviteLink,
      });
    } catch {}
  }

  async function handleCancel() {
    Alert.alert('Cancelar sala', 'Tem certeza? A sala será encerrada.', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Cancelar sala',
        style: 'destructive',
        onPress: async () => {
          try { await cancelPrivateRoom(roomId); } catch {}
          router.replace('/(main)/salas');
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{roomName || 'Sala Privada'}</Text>
          <Text style={styles.headerSub}>
            Entrada: {formatCoins(entryFee)} · Prêmio: {formatCoins(prize)} moedas
          </Text>
        </View>

        {/* Waiting animation */}
        <View style={styles.waitZone}>
          <Animated.View style={[styles.pulseRing, pulseStyle]} />
          <View style={styles.waitCore}>
            <MaterialCommunityIcons name="timer-sand" size={40} color={theme.colors.primary} />
          </View>
          <Text style={styles.waitTitle}>Aguardando adversário…</Text>
          <Text style={styles.waitSub}>Compartilhe o código ou link para convidar alguém</Text>
        </View>

        {/* Invite code */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Código da sala</Text>
          <Text style={styles.codeValue}>{inviteCode}</Text>
          <Text style={styles.codeLinkHint}>{inviteLink}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}
          >
            <MaterialCommunityIcons name="share-variant-outline" size={18} color="#241A00" />
            <Text style={styles.shareBtnText}>Compartilhar convite</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push({
              pathname: '/(main)/convidar/[roomId]',
              params: { roomId, inviteCode },
            } as any)}
            style={({ pressed }) => [styles.inviteFriendsBtn, pressed && { opacity: 0.85 }]}
          >
            <MaterialCommunityIcons name="account-plus-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.inviteFriendsBtnText}>Convidar amigos</Text>
          </Pressable>

          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.cancelBtnText}>Cancelar sala</Text>
          </Pressable>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  root: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: { alignItems: 'center', gap: theme.spacing.xs },
  headerTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 28,
    textAlign: 'center',
  },
  headerSub: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
    textAlign: 'center',
  },

  waitZone: { alignItems: 'center', gap: theme.spacing.md },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: `${theme.colors.primary}40`,
  },
  waitCore: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.surfaceHigh,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  waitSub: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
    textAlign: 'center',
  },

  codeCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  codeLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  codeValue: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 48,
    letterSpacing: 10,
  },
  codeLinkHint: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
    textAlign: 'center',
  },

  actions: { width: '100%', gap: theme.spacing.sm },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
  },
  shareBtnText: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 16,
  },
  inviteFriendsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  inviteFriendsBtnText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 16,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelBtnText: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },
});
