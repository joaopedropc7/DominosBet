import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/base/Avatar';
import { Button } from '@/components/base/Button';
import { Screen } from '@/components/base/Screen';
import { useAuth } from '@/hooks/useAuth';
import { acceptFriendRequest, listFriends, removeFriendship } from '@/services/friends';
import { theme } from '@/theme';
import type { FriendEntry } from '@/types/database';

export function FriendsScreenView() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => { load(); }, [load]);

  async function handleAccept(friendshipId: string) {
    await acceptFriendRequest(friendshipId);
    load();
  }

  async function handleRemove(friendshipId: string) {
    await removeFriendship(friendshipId);
    load();
  }

  const accepted  = friends.filter(f => f.status === 'accepted');
  const received  = friends.filter(f => f.status === 'pending_received');
  const sent      = friends.filter(f => f.status === 'pending_sent');

  return (
    <Screen>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.textMuted} />
        </Pressable>
        <Text style={styles.title}>Amigos</Text>
        <Pressable
          onPress={() => router.push('/(main)/adicionar-amigo')}
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}>
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
              <Text style={styles.sectionLabel}>
                Solicitações recebidas · {received.length}
              </Text>
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

          {/* Accepted */}
          {accepted.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Amigos · {accepted.length}</Text>
              {accepted.map(entry => (
                <FriendCard
                  key={entry.friendshipId}
                  entry={entry}
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
    </Screen>
  );
}

function FriendCard({
  entry,
  onAccept,
  onRemove,
}: {
  entry: FriendEntry;
  onAccept?: () => void;
  onRemove: () => void;
}) {
  const { profile, status } = entry;

  return (
    <View style={styles.card}>
      <Avatar avatarId={profile.avatar_id} size={44} />
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{profile.display_name}</Text>
        <Text style={styles.cardRank}>{profile.rank_label}</Text>
      </View>
      <View style={styles.cardActions}>
        {status === 'pending_received' && onAccept && (
          <Pressable onPress={onAccept} style={({ pressed }) => [styles.actionBtn, styles.acceptBtn, pressed && styles.actionBtnPressed]}>
            <MaterialCommunityIcons name="check" size={16} color={theme.colors.background} />
          </Pressable>
        )}
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
  backBtn: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnPressed: { opacity: 0.7 },
  title: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
  },
  addBtn: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1, borderColor: theme.colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnPressed: { opacity: 0.7 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 22,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  sections: {
    gap: theme.spacing.xl,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
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
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 15,
  },
  cardRank: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  actionBtn: {
    width: 32, height: 32, borderRadius: theme.radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  acceptBtn: {
    backgroundColor: theme.colors.primary,
  },
  removeBtn: {
    backgroundColor: theme.colors.surfaceHigh,
  },
});
