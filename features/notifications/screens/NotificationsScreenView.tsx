import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/base/Card';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useAuth } from '@/hooks/useAuth';
import { acceptFriendRequest, removeFriendship } from '@/services/friends';
import {
  listNotifications,
  markNotificationsRead,
  type AppNotification,
} from '@/services/notifications';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';
import { formatTimelineLabel } from '@/utils/date';
import { formatCoins } from '@/utils/format';

export function NotificationsScreenView() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [loadError, setLoadError]         = useState('');
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const instanceId  = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`).current;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const data = await listNotifications();
      setNotifications(data);
      const infoIds = data
        .filter(n => !n.read && n.type === 'friend_accepted')
        .map(n => n.id);
      if (infoIds.length > 0) await markNotificationsRead(infoIds);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erro ao carregar notificações.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to real-time inserts on the notifications table
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Silent reload — no spinner, just refresh the list
          load(true);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id, load]);

  // Full reload every time the tab comes into focus
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function dismiss(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  return (
    <Screen withBottomNav>
      <AppHeader title="Notificações" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : loadError !== '' ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color={theme.colors.danger} />
          <Text style={styles.emptyTitle}>Erro ao carregar</Text>
          <Text style={styles.emptySub}>{loadError}</Text>
          <Pressable onPress={load} style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="bell-outline" size={48} color={theme.colors.textFaint} />
          <Text style={styles.emptyTitle}>Sem notificações</Text>
          <Text style={styles.emptySub}>Pedidos de amizade e convites de sala aparecerão aqui.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {notifications.map(n => (
            <NotificationCard key={n.id} notification={n} onDismiss={() => dismiss(n.id)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function NotificationCard({
  notification,
  onDismiss,
}: {
  notification: AppNotification;
  onDismiss: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  if (notification.type === 'room_invite') {
    const p = notification.payload;
    const modeName = p.mode === 'express' ? 'Expresso' : 'Clássico';
    const roomLabel = p.room_name ?? 'Sala Privada';

    return (
      <Card variant="low">
        <View style={styles.row}>
          <View style={[styles.iconWrap, styles.iconInvite]}>
            <MaterialCommunityIcons name="door-open" size={22} color={theme.colors.primary} />
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>
              <Text style={styles.bold}>{p.sender_name}</Text>
              {' convidou você para jogar'}
            </Text>
            <Text style={styles.detail}>
              {roomLabel} · {modeName} · Entrada: {formatCoins(p.entry_fee)}
            </Text>
            <Text style={styles.time}>{formatTimelineLabel(notification.created_at)}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push({ pathname: '/(main)/entrar/[code]', params: { code: p.invite_code } } as any)}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
        >
          <MaterialCommunityIcons name="arrow-right-circle-outline" size={16} color="#241A00" />
          <Text style={styles.primaryBtnText}>Entrar na sala</Text>
        </Pressable>
      </Card>
    );
  }

  if (notification.type === 'friend_request') {
    const p = notification.payload;

    async function handleAccept() {
      setActing(true);
      setError(null);
      try {
        await acceptFriendRequest(p.friendship_id);
        onDismiss();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao aceitar.');
      } finally {
        setActing(false);
      }
    }

    async function handleDecline() {
      setActing(true);
      setError(null);
      try {
        await removeFriendship(p.friendship_id);
        onDismiss();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao recusar.');
      } finally {
        setActing(false);
      }
    }

    return (
      <Card variant="low">
        <View style={styles.row}>
          <View style={[styles.iconWrap, styles.iconFriend]}>
            <MaterialCommunityIcons name="account-plus-outline" size={22} color={theme.colors.accent} />
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>
              <Text style={styles.bold}>{p.requester_name}</Text>
              {' quer ser seu amigo'}
            </Text>
            <Text style={styles.time}>{formatTimelineLabel(notification.created_at)}</Text>
          </View>
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <View style={styles.twoBtn}>
          <Pressable
            onPress={handleAccept}
            disabled={acting}
            style={({ pressed }) => [styles.primaryBtn, { flex: 1 }, pressed && { opacity: 0.8 }]}
          >
            {acting
              ? <ActivityIndicator size="small" color="#241A00" />
              : <>
                  <MaterialCommunityIcons name="check" size={16} color="#241A00" />
                  <Text style={styles.primaryBtnText}>Aceitar</Text>
                </>}
          </Pressable>
          <Pressable
            onPress={handleDecline}
            disabled={acting}
            style={({ pressed }) => [styles.ghostBtn, { flex: 1 }, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.ghostBtnText}>Recusar</Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  if (notification.type === 'friend_accepted') {
    const p = notification.payload;
    return (
      <Card variant="low">
        <View style={styles.row}>
          <View style={[styles.iconWrap, styles.iconAccepted]}>
            <MaterialCommunityIcons name="account-check-outline" size={22} color={theme.colors.primary} />
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>
              {'Você e '}
              <Text style={styles.bold}>{p.friend_name}</Text>
              {' agora são amigos!'}
            </Text>
            <Text style={styles.time}>{formatTimelineLabel(notification.created_at)}</Text>
          </View>
        </View>
      </Card>
    );
  }

  return null;
}

const styles = StyleSheet.create({
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
  emptySub: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  list: { gap: theme.spacing.sm },
  retryBtn: {
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  retryText: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
  },

  row: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  iconWrap: {
    width: 44, height: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInvite:   { backgroundColor: theme.colors.primarySoft },
  iconFriend:   { backgroundColor: 'rgba(100,200,255,0.12)' },
  iconAccepted: { backgroundColor: theme.colors.primarySoft },

  errorText: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
    marginBottom: theme.spacing.xs,
  },

  body: { flex: 1, gap: 2 },
  title: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14 },
  bold: { fontFamily: theme.typography.fontFamily.bodyBold },
  detail: { color: theme.colors.textSoft, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  time: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 11 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
  },
  primaryBtnText: { color: '#241A00', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },

  twoBtn: { flexDirection: 'row', gap: theme.spacing.sm },
  ghostBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  ghostBtnText: { color: theme.colors.textSoft, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },
});
