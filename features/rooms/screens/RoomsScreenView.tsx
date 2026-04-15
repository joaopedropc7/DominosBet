import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { cancelPrivateRoom, getMyActiveRooms } from '@/services/private-room';
import type { ActiveRoomData } from '@/services/private-room';
import { countUnreadNotifications } from '@/services/notifications';
import { theme } from '@/theme';
import { formatCoins } from '@/utils/format';

export function RoomsScreenView() {
  const [myRooms, setMyRooms]         = useState<ActiveRoomData[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [joinCode, setJoinCode]       = useState('');
  const [joining, setJoining]         = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadRooms = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rooms = await getMyActiveRooms();
      setMyRooms(rooms);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);
  useEffect(() => {
    countUnreadNotifications().then(setUnreadCount).catch(() => {});
  }, []);

  async function handleCancel(roomId: string) {
    Alert.alert('Cancelar sala', 'Tem certeza que deseja cancelar esta sala?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Cancelar sala',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelPrivateRoom(roomId);
            setMyRooms((prev) => prev.filter((r) => r.room_id !== roomId));
          } catch (e) {
            Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível cancelar.');
          }
        },
      },
    ]);
  }

  function handleJoinByCode() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      Alert.alert('Código inválido', 'Digite o código de 6 caracteres da sala.');
      return;
    }
    router.push({ pathname: '/(main)/entrar/[code]', params: { code } } as any);
    setJoinCode('');
  }

  return (
    <Screen withBottomNav>
      <AppHeader
        title="Salas"
        subtitle="Crie ou entre em uma sala privada."
        rightIcon="bell-outline"
        badgeCount={unreadCount}
        onRightPress={() => router.push('/(main)/notificacoes')}
      />

      {/* Primary actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/(main)/criar-sala')}
          style={({ pressed }) => [styles.actionCard, styles.actionCardPrimary, pressed && styles.actionCardPressed]}
        >
          <MaterialCommunityIcons name="plus-circle-outline" size={28} color="#241A00" />
          <Text style={styles.actionTitle}>Criar Sala</Text>
          <Text style={styles.actionSub}>Defina aposta, senha e compartilhe o link</Text>
        </Pressable>

        <View style={styles.joinCard}>
          <Text style={styles.joinLabel}>Entrar com código</Text>
          <View style={styles.joinRow}>
            <TextInput
              style={styles.joinInput}
              value={joinCode}
              onChangeText={(v) => setJoinCode(v.toUpperCase())}
              placeholder="ABC123"
              placeholderTextColor={theme.colors.textFaint}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Pressable
              onPress={handleJoinByCode}
              disabled={joining}
              style={({ pressed }) => [styles.joinBtn, pressed && { opacity: 0.8 }]}
            >
              {joining
                ? <ActivityIndicator color="#241A00" size="small" />
                : <MaterialCommunityIcons name="arrow-right" size={20} color="#241A00" />}
            </Pressable>
          </View>
        </View>
      </View>

      {/* My active rooms */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Minhas salas abertas</Text>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : myRooms.length === 0 ? (
          <Card variant="low">
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="door-closed-lock" size={32} color={theme.colors.textFaint} />
              <Text style={styles.emptyText}>Nenhuma sala aguardando adversário.</Text>
            </View>
          </Card>
        ) : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRooms(true); }} tintColor={theme.colors.primary} />}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.roomList}>
              {myRooms.map((room) => (
                <Card key={room.room_id} variant="low">
                  <View style={styles.roomRow}>
                    {/* Info */}
                    <View style={styles.roomInfo}>
                      <View style={styles.roomTitleRow}>
                        <Text style={styles.roomName}>
                          {room.room_name ?? `Sala ${room.invite_code}`}
                        </Text>
                        {room.has_password && (
                          <MaterialCommunityIcons name="lock" size={13} color={theme.colors.textFaint} />
                        )}
                      </View>
                      <Text style={styles.roomMeta}>
                        Entrada: {formatCoins(room.entry_fee)} · Prêmio: {formatCoins(Math.round(room.entry_fee * 2 * 0.9))}
                      </Text>
                    </View>

                    {/* Code + actions */}
                    <View style={styles.roomRight}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeText}>{room.invite_code}</Text>
                      </View>
                      <View style={styles.roomBtns}>
                        <Pressable
                          onPress={() => router.push({ pathname: '/(main)/sala-privada', params: { roomId: room.room_id, inviteCode: room.invite_code, entryFee: String(room.entry_fee), roomName: room.room_name ?? '' } } as any)}
                          style={({ pressed }) => [styles.roomBtn, pressed && { opacity: 0.7 }]}
                        >
                          <MaterialCommunityIcons name="eye-outline" size={15} color={theme.colors.accent} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleCancel(room.room_id)}
                          style={({ pressed }) => [styles.roomBtn, pressed && { opacity: 0.7 }]}
                        >
                          <MaterialCommunityIcons name="close" size={15} color={theme.colors.danger} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: theme.spacing.md },

  actionCard: {
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    backgroundColor: theme.colors.surface,
  },
  actionCardPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: 'transparent',
  },
  actionCardPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  actionTitle: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 22,
  },
  actionSub: {
    color: 'rgba(36,26,0,0.65)',
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },

  joinCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  joinLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  joinRow: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  joinInput: {
    flex: 1,
    backgroundColor: theme.colors.surfaceHigh,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
    letterSpacing: 4,
    textAlign: 'center',
  },
  joinBtn: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: { gap: theme.spacing.md },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 22,
  },

  emptyState: { alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg },
  emptyText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },

  roomList: { gap: theme.spacing.sm },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  roomInfo: { flex: 1, gap: 3 },
  roomTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  roomName: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 15,
  },
  roomMeta: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  roomRight: { alignItems: 'flex-end', gap: theme.spacing.xs },
  codeBadge: {
    backgroundColor: theme.colors.surfaceHigh,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  codeText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 15,
    letterSpacing: 2,
  },
  roomBtns: { flexDirection: 'row', gap: theme.spacing.xs },
  roomBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
});
