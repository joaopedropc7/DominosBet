import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/base/Avatar';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useAuth } from '@/hooks/useAuth';
import { listFriends } from '@/services/friends';
import { sendRoomInvite } from '@/services/notifications';
import { theme } from '@/theme';
import type { FriendEntry } from '@/types/database';

interface Props {
  roomId: string;
  inviteCode: string;
}

export function InviteFriendsScreenView({ roomId, inviteCode }: Props) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await listFriends(user.id);
      setFriends(data.filter(f => f.status === 'accepted'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleInvite(friendId: string) {
    if (sent.has(friendId) || sending) return;
    try {
      setSending(friendId);
      await sendRoomInvite(friendId, roomId, inviteCode);
      setSent(prev => new Set(prev).add(friendId));
    } catch (e) {
      // silently ignore — friend may already have an invite
    } finally {
      setSending(null);
    }
  }

  return (
    <Screen>
      <AppHeader
        title="Convidar Amigos"
        subtitle="Selecione amigos para enviar o convite"
        rightIcon="arrow-left"
        onRightPress={() => router.back()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : friends.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="account-group-outline" size={48} color={theme.colors.textFaint} />
          <Text style={styles.emptyTitle}>Sem amigos ainda</Text>
          <Text style={styles.emptySub}>Adicione amigos na aba de perfil para convidá-los aqui.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {friends.map(entry => {
            const isSent    = sent.has(entry.profile.id);
            const isSending = sending === entry.profile.id;
            return (
              <View key={entry.friendshipId} style={styles.card}>
                <Avatar avatarId={entry.profile.avatar_id} size={44} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{entry.profile.display_name}</Text>
                  <Text style={styles.cardRank}>{entry.profile.rank_label}</Text>
                </View>
                <Pressable
                  onPress={() => handleInvite(entry.profile.id)}
                  disabled={isSent || !!sending}
                  style={({ pressed }) => [
                    styles.inviteBtn,
                    isSent ? styles.inviteBtnSent : styles.inviteBtnDefault,
                    pressed && !isSent && { opacity: 0.75 },
                  ]}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name={isSent ? 'check' : 'send-outline'}
                        size={15}
                        color={isSent ? theme.colors.primary : '#241A00'}
                      />
                      <Text style={[styles.inviteBtnText, isSent && styles.inviteBtnTextSent]}>
                        {isSent ? 'Enviado' : 'Convidar'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.xl },
  emptyTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 22, textAlign: 'center' },
  emptySub: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14, textAlign: 'center' },
  list: { gap: theme.spacing.sm },
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
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    minWidth: 90,
    justifyContent: 'center',
  },
  inviteBtnDefault: { backgroundColor: theme.colors.primary },
  inviteBtnSent: { backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primary },
  inviteBtnText: { color: '#241A00', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },
  inviteBtnTextSent: { color: theme.colors.primary },
});
