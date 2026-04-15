import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Avatar } from '@/components/base/Avatar';
import { Card } from '@/components/base/Card';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  cancelPrivateRoom,
  getMyActiveRooms,
  listAvailableRooms,
} from '@/services/private-room';
import type { ActiveRoomData, AvailableRoomData } from '@/services/private-room';
import { theme } from '@/theme';
import { formatCoins } from '@/utils/format';

export function RoomsScreenView() {
  const [myRooms, setMyRooms]           = useState<ActiveRoomData[]>([]);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoomData[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [joinCode, setJoinCode]         = useState('');
  const [cancelingId, setCancelingId]   = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [mine, available] = await Promise.all([
        getMyActiveRooms(),
        listAvailableRooms(),
      ]);
      setMyRooms(mine);
      setAvailableRooms(available);
    } catch {
      // ignore — individual sections will show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleCancel(roomId: string) {
    setCancelLoading(true);
    try {
      await cancelPrivateRoom(roomId);
      setMyRooms((prev) => prev.filter((r) => r.room_id !== roomId));
    } catch {
      // ignore — room stays in list
    } finally {
      setCancelLoading(false);
      setCancelingId(null);
    }
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

  function handleJoinRoom(inviteCode: string) {
    router.push({ pathname: '/(main)/entrar/[code]', params: { code: inviteCode } } as any);
  }

  return (
    <Screen withBottomNav>
      <AppHeader
        title="Salas"
        subtitle="Jogue com quem você quiser."
        rightIcon="bell-outline"
        onRightPress={() => router.push('/(main)/notificacoes')}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadAll(true); }}
            tintColor={theme.colors.primary}
          />
        }
      >

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
                style={({ pressed }) => [styles.joinBtn, pressed && { opacity: 0.8 }]}
              >
                <MaterialCommunityIcons name="arrow-right" size={20} color="#241A00" />
              </Pressable>
            </View>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
        ) : (
          <>
            {/* Available rooms lobby */}
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Salas abertas</Text>
                <Text style={styles.sectionCount}>{availableRooms.length}</Text>
              </View>

              {availableRooms.length === 0 ? (
                <Card variant="low">
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="door-open" size={32} color={theme.colors.textFaint} />
                    <Text style={styles.emptyText}>Nenhuma sala aguardando jogadores.</Text>
                    <Text style={styles.emptySubText}>Crie uma sala e convide seus amigos!</Text>
                  </View>
                </Card>
              ) : (
                <View style={styles.roomList}>
                  {availableRooms.map((room) => (
                    <AvailableRoomCard
                      key={room.room_id}
                      room={room}
                      onJoin={() => handleJoinRoom(room.invite_code)}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* My waiting rooms */}
            {myRooms.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Minhas salas abertas</Text>
                <View style={styles.roomList}>
                  {myRooms.map((room) => {
                    const confirming = cancelingId === room.room_id;
                    return (
                      <Card key={room.room_id} variant="low">
                        <View style={styles.roomRow}>
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
                          <View style={styles.roomRight}>
                            <View style={styles.codeBadge}>
                              <Text style={styles.codeText}>{room.invite_code}</Text>
                            </View>
                            <View style={styles.roomBtns}>
                              {!confirming && (
                                <Pressable
                                  onPress={() => router.push({ pathname: '/(main)/sala-privada', params: { roomId: room.room_id, inviteCode: room.invite_code, entryFee: String(room.entry_fee), roomName: room.room_name ?? '' } } as any)}
                                  style={({ pressed }) => [styles.roomBtn, pressed && { opacity: 0.7 }]}
                                >
                                  <MaterialCommunityIcons name="eye-outline" size={15} color={theme.colors.accent} />
                                </Pressable>
                              )}
                              {confirming ? (
                                <>
                                  <Pressable
                                    onPress={() => handleCancel(room.room_id)}
                                    disabled={cancelLoading}
                                    style={({ pressed }) => [styles.roomBtn, styles.roomBtnDanger, pressed && { opacity: 0.7 }]}
                                  >
                                    {cancelLoading
                                      ? <ActivityIndicator size="small" color={theme.colors.danger} />
                                      : <MaterialCommunityIcons name="check" size={15} color={theme.colors.danger} />}
                                  </Pressable>
                                  <Pressable
                                    onPress={() => setCancelingId(null)}
                                    style={({ pressed }) => [styles.roomBtn, pressed && { opacity: 0.7 }]}
                                  >
                                    <MaterialCommunityIcons name="close" size={15} color={theme.colors.textFaint} />
                                  </Pressable>
                                </>
                              ) : (
                                <Pressable
                                  onPress={() => setCancelingId(room.room_id)}
                                  style={({ pressed }) => [styles.roomBtn, pressed && { opacity: 0.7 }]}
                                >
                                  <MaterialCommunityIcons name="delete-outline" size={15} color={theme.colors.danger} />
                                </Pressable>
                              )}
                            </View>
                          </View>
                        </View>
                        {confirming && (
                          <Text style={styles.confirmText}>Excluir esta sala permanentemente?</Text>
                        )}
                      </Card>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function AvailableRoomCard({
  room,
  onJoin,
}: {
  room: AvailableRoomData;
  onJoin: () => void;
}) {
  const prize    = Math.round(room.entry_fee * 2 * 0.9);
  const modeName = room.mode === 'express' ? 'Expresso' : 'Clássico';

  return (
    <Card variant="low">
      <View style={styles.availRow}>
        {/* Creator avatar */}
        <Avatar avatarId={room.creator_avatar_id} size={42} />

        {/* Info */}
        <View style={styles.availInfo}>
          <View style={styles.availTitleRow}>
            <Text style={styles.availName} numberOfLines={1}>
              {room.room_name ?? `Sala de ${room.creator_name}`}
            </Text>
            {room.has_password && (
              <MaterialCommunityIcons name="lock" size={14} color={theme.colors.textFaint} />
            )}
          </View>
          <Text style={styles.availMeta}>
            {room.creator_name} · {modeName}
          </Text>
          <View style={styles.availFeeRow}>
            <MaterialCommunityIcons name="trophy-outline" size={11} color={theme.colors.primary} />
            <Text style={styles.availFee}>
              {formatCoins(room.entry_fee)} entrada · {formatCoins(prize)} prêmio
            </Text>
          </View>
        </View>

        {/* Join button */}
        <Pressable
          onPress={onJoin}
          style={({ pressed }) => [styles.joinRoomBtn, pressed && { opacity: 0.8 }]}
        >
          {room.has_password
            ? <MaterialCommunityIcons name="lock-outline" size={16} color="#241A00" />
            : <MaterialCommunityIcons name="arrow-right" size={16} color="#241A00" />}
          <Text style={styles.joinRoomBtnText}>
            {room.has_password ? 'Senha' : 'Entrar'}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  loader: { marginTop: theme.spacing.xl },

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
  actionTitle: { color: '#241A00', fontFamily: theme.typography.fontFamily.display, fontSize: 22 },
  actionSub: { color: 'rgba(36,26,0,0.65)', fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },

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
    width: 48, height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  section: { gap: theme.spacing.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  sectionTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 22 },
  sectionCount: {
    backgroundColor: theme.colors.primarySoft,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },

  emptyState: { alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg },
  emptyText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14, textAlign: 'center' },
  emptySubText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 12, textAlign: 'center' },

  roomList: { gap: theme.spacing.sm },

  // My rooms
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  roomInfo: { flex: 1, gap: 3 },
  roomTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  roomName: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 15 },
  roomMeta: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  roomRight: { alignItems: 'flex-end', gap: theme.spacing.xs },
  codeBadge: {
    backgroundColor: theme.colors.surfaceHigh,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  codeText: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.display, fontSize: 15, letterSpacing: 2 },
  roomBtns: { flexDirection: 'row', gap: theme.spacing.xs },
  roomBtn: {
    width: 32, height: 32,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceHigh,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.outline,
  },
  roomBtnDanger: { borderColor: theme.colors.danger },
  confirmText: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
    marginTop: theme.spacing.xs,
    textAlign: 'right',
  },

  // Available rooms
  availRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  availInfo: { flex: 1, gap: 2 },
  availTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  availName: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 14, flex: 1 },
  availMeta: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  availFeeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  availFee: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11 },
  joinRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  joinRoomBtnText: { color: '#241A00', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },
});
