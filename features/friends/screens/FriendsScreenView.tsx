import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Avatar } from '@/components/base/Avatar';
import { Button } from '@/components/base/Button';
import { Screen } from '@/components/base/Screen';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';
import { acceptFriendRequest, listFriends, removeFriendship } from '@/services/friends';
import { createPrivateRoom } from '@/services/private-room';
import { sendRoomInvite } from '@/services/notifications';
import { theme } from '@/theme';
import { formatCoins } from '@/utils/format';
import type { FriendEntry } from '@/types/database';

const QUICK_FEES = [10, 20, 50, 100, 200];

interface InviteTarget {
  friendId: string;
  friendName: string;
}

export function FriendsScreenView() {
  const { user } = useAuth();
  const { profile } = useUserData();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite modal state
  const [inviteTarget, setInviteTarget] = useState<InviteTarget | null>(null);
  const [inviteMode, setInviteMode] = useState<'classic' | 'express'>('classic');
  const [inviteFee, setInviteFee] = useState(20);
  const [creating, setCreating] = useState(false);

  const balance = profile?.balance ?? 0;

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setError('');
      const data = await listFriends(user.id);
      setFriends(data);
    } catch {
      setError('Erro ao carregar amigos.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleAccept(friendshipId: string) {
    await acceptFriendRequest(friendshipId);
    load();
  }

  async function handleRemove(friendshipId: string) {
    await removeFriendship(friendshipId);
    load();
  }

  async function handleSendInvite() {
    if (!inviteTarget) return;
    if (balance < inviteFee) return;
    try {
      setCreating(true);
      const { roomId, inviteCode } = await createPrivateRoom(inviteFee, inviteMode);
      await sendRoomInvite(inviteTarget.friendId, roomId, inviteCode);
      setInviteTarget(null);
      router.push({
        pathname: '/(main)/sala-privada',
        params: { roomId, inviteCode, entryFee: String(inviteFee), roomName: '' },
      } as any);
    } catch (e: any) {
      // Close modal and let the lobby handle errors
      setInviteTarget(null);
    } finally {
      setCreating(false);
    }
  }

  const accepted = friends.filter(f => f.status === 'accepted');
  const received = friends.filter(f => f.status === 'pending_received');
  const sent     = friends.filter(f => f.status === 'pending_sent');

  return (
    <Screen>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.textMuted} />
        </Pressable>
        <Text style={styles.title}>Amigos</Text>
        <Pressable
          onPress={() => router.push('/(main)/adicionar-amigo')}
          style={({ pressed }) => [styles.iconBtn, styles.iconBtnAccent, pressed && styles.iconBtnPressed]}
        >
          <MaterialCommunityIcons name="account-plus-outline" size={20} color={theme.colors.primary} />
        </Pressable>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      {!loading && error !== '' && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Tentar novamente" variant="ghost" onPress={load} />
        </View>
      )}

      {!loading && error === '' && friends.length === 0 && (
        <View style={styles.center}>
          <MaterialCommunityIcons name="account-group-outline" size={48} color={theme.colors.textFaint} />
          <Text style={styles.emptyTitle}>Nenhum amigo ainda</Text>
          <Text style={styles.emptySubtitle}>Adicione amigos pelo nickname para jogar juntos.</Text>
          <Button title="Adicionar amigo" onPress={() => router.push('/(main)/adicionar-amigo')} />
        </View>
      )}

      {!loading && error === '' && friends.length > 0 && (
        <View style={styles.sections}>

          {/* Pending received */}
          {received.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Solicitações recebidas · {received.length}</Text>
              {received.map(entry => (
                <FriendCard
                  key={entry.friendshipId}
                  entry={entry}
                  onAccept={() => handleAccept(entry.friendshipId)}
                  onRemove={() => handleRemove(entry.friendshipId)}
                />
              ))}
            </View>
          )}

          {/* Accepted friends */}
          {accepted.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Amigos · {accepted.length}</Text>
              {accepted.map(entry => (
                <FriendCard
                  key={entry.friendshipId}
                  entry={entry}
                  onInvite={() => setInviteTarget({ friendId: entry.profile.id, friendName: entry.profile.display_name })}
                  onRemove={() => handleRemove(entry.friendshipId)}
                />
              ))}
            </View>
          )}

          {/* Pending sent */}
          {sent.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Solicitações enviadas · {sent.length}</Text>
              {sent.map(entry => (
                <FriendCard
                  key={entry.friendshipId}
                  entry={entry}
                  onRemove={() => handleRemove(entry.friendshipId)}
                />
              ))}
            </View>
          )}

        </View>
      )}

      {/* Invite to match modal */}
      <Modal
        visible={inviteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteTarget(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => !creating && setInviteTarget(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Convidar {inviteTarget?.friendName}</Text>
            <Text style={styles.modalSub}>Escolha o modo e o valor da aposta</Text>

            {/* Mode selector */}
            <View style={styles.modeRow}>
              {(['classic', 'express'] as const).map(m => (
                <Pressable
                  key={m}
                  onPress={() => setInviteMode(m)}
                  style={[styles.modeBtn, inviteMode === m && styles.modeBtnActive]}
                >
                  <MaterialCommunityIcons
                    name={m === 'classic' ? 'shield-outline' : 'lightning-bolt'}
                    size={14}
                    color={inviteMode === m ? theme.colors.primary : theme.colors.textFaint}
                  />
                  <Text style={[styles.modeBtnText, inviteMode === m && styles.modeBtnTextActive]}>
                    {m === 'classic' ? 'Clássico' : 'Expresso'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Fee selector */}
            <View style={styles.feeRow}>
              {QUICK_FEES.map(fee => {
                const canAfford = balance >= fee;
                return (
                  <Pressable
                    key={fee}
                    onPress={() => canAfford && setInviteFee(fee)}
                    style={[
                      styles.feeBtn,
                      inviteFee === fee && styles.feeBtnActive,
                      !canAfford && styles.feeBtnDisabled,
                    ]}
                  >
                    <Text style={[styles.feeBtnText, inviteFee === fee && styles.feeBtnTextActive]}>
                      {formatCoins(fee)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Prize preview */}
            <View style={styles.prizeRow}>
              <MaterialCommunityIcons name="trophy-outline" size={13} color={theme.colors.primary} />
              <Text style={styles.prizeText}>
                Prêmio: {formatCoins(Math.round(inviteFee * 2 * 0.9))} moedas
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <Pressable
                onPress={handleSendInvite}
                disabled={creating || balance < inviteFee}
                style={({ pressed }) => [
                  styles.sendBtn,
                  (creating || balance < inviteFee) && styles.sendBtnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {creating
                  ? <ActivityIndicator color="#241A00" />
                  : <MaterialCommunityIcons name="send-outline" size={16} color="#241A00" />}
                <Text style={styles.sendBtnText}>
                  {creating ? 'Criando sala…' : 'Criar sala e enviar convite'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setInviteTarget(null)} disabled={creating}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function FriendCard({
  entry,
  onInvite,
  onAccept,
  onRemove,
}: {
  entry: FriendEntry;
  onInvite?: () => void;
  onAccept?: () => void;
  onRemove: () => void;
}) {
  const { profile, status } = entry;
  if (!profile) return null;
  return (
    <View style={styles.card}>
      <Avatar avatarId={profile.avatar_id} size={44} />
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{profile.display_name}</Text>
        <Text style={styles.cardRank}>{profile.rank_label}</Text>
      </View>
      <View style={styles.cardActions}>
        {/* Invite to match (accepted friends only) */}
        {status === 'accepted' && onInvite && (
          <Pressable onPress={onInvite} style={({ pressed }) => [styles.actionBtn, styles.inviteBtn, pressed && styles.actionBtnPressed]}>
            <MaterialCommunityIcons name="gamepad-variant-outline" size={16} color="#241A00" />
          </Pressable>
        )}
        {/* Accept friend request */}
        {status === 'pending_received' && onAccept && (
          <Pressable onPress={onAccept} style={({ pressed }) => [styles.actionBtn, styles.acceptBtn, pressed && styles.actionBtnPressed]}>
            <MaterialCommunityIcons name="check" size={16} color={theme.colors.background} />
          </Pressable>
        )}
        {/* Remove / cancel */}
        <Pressable onPress={onRemove} style={({ pressed }) => [styles.actionBtn, styles.removeBtn, pressed && styles.actionBtnPressed]}>
          <MaterialCommunityIcons
            name={status === 'pending_sent' ? 'clock-outline' : 'account-remove-outline'}
            size={16}
            color={status === 'pending_sent' ? theme.colors.textFaint : theme.colors.danger}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.md,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnAccent: { backgroundColor: theme.colors.primarySoft },
  iconBtnPressed: { opacity: 0.7 },
  title: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 20 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.xl },
  emptyTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 22, textAlign: 'center' },
  emptySubtitle: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14, textAlign: 'center' },
  errorText: { color: theme.colors.danger, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14 },

  sections: { gap: theme.spacing.xl },
  section: { gap: theme.spacing.sm },
  sectionLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 15 },
  cardRank: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  cardActions: { flexDirection: 'row', gap: theme.spacing.xs },
  actionBtn: { width: 32, height: 32, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  actionBtnPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  inviteBtn: { backgroundColor: theme.colors.primary },
  acceptBtn: { backgroundColor: theme.colors.primary },
  removeBtn: { backgroundColor: theme.colors.surfaceHigh },

  // Invite modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  modalTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 22 },
  modalSub: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13, marginTop: -theme.spacing.sm },

  modeRow: { flexDirection: 'row', gap: theme.spacing.sm },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceHigh,
    borderWidth: 1, borderColor: theme.colors.outline,
  },
  modeBtnActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  modeBtnText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },
  modeBtnTextActive: { color: theme.colors.primary },

  feeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  feeBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceHigh,
    borderWidth: 1, borderColor: theme.colors.outline,
  },
  feeBtnActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  feeBtnDisabled: { opacity: 0.35 },
  feeBtnText: { color: theme.colors.textSoft, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 12 },
  feeBtnTextActive: { color: theme.colors.primary },

  prizeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  prizeText: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },

  modalActions: { gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnText: { color: '#241A00', fontFamily: theme.typography.fontFamily.display, fontSize: 16 },
  cancelText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13, textAlign: 'center', paddingVertical: 6 },
});
