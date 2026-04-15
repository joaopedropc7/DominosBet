import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/base/Card';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  listNotifications,
  markNotificationsRead,
  type AppNotification,
} from '@/services/notifications';
import { theme } from '@/theme';
import { formatTimelineLabel } from '@/utils/date';
import { formatCoins } from '@/utils/format';

export function NotificationsScreenView() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await listNotifications();
      setNotifications(data);
      // Mark all as read after loading
      const unread = data.filter(n => !n.read).map(n => n.id);
      if (unread.length > 0) await markNotificationsRead(unread);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen>
      <AppHeader
        title="Notificações"
        rightIcon="arrow-left"
        onRightPress={() => router.back()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="bell-outline" size={48} color={theme.colors.textFaint} />
          <Text style={styles.emptyTitle}>Sem notificações</Text>
          <Text style={styles.emptySub}>Convites de sala e outras novidades aparecerão aqui.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {notifications.map(n => (
            <NotificationCard key={n.id} notification={n} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function NotificationCard({ notification }: { notification: AppNotification }) {
  const p = notification.payload;

  if (notification.type === 'room_invite') {
    const modeName = p.mode === 'express' ? 'Expresso' : 'Clássico';
    const roomLabel = p.room_name ? String(p.room_name) : 'Sala Privada';
    return (
      <Card variant="low">
        <View style={[styles.notifCard, !notification.read && styles.notifCardUnread]}>
          {/* Icon */}
          <View style={styles.notifIcon}>
            <MaterialCommunityIcons name="door-open" size={22} color={theme.colors.primary} />
          </View>
          {/* Text */}
          <View style={styles.notifBody}>
            <Text style={styles.notifTitle}>
              <Text style={styles.notifName}>{String(p.sender_name)}</Text>
              {' convidou você para uma sala'}
            </Text>
            <Text style={styles.notifDetail}>
              {roomLabel} · {modeName} · Entrada: {formatCoins(Number(p.entry_fee))}
            </Text>
            <Text style={styles.notifTime}>{formatTimelineLabel(notification.created_at)}</Text>
          </View>
        </View>
        {/* CTA */}
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(main)/entrar/[code]',
              params: { code: String(p.invite_code) },
            } as any)
          }
          style={({ pressed }) => [styles.joinBtn, pressed && { opacity: 0.8 }]}
        >
          <MaterialCommunityIcons name="arrow-right-circle-outline" size={16} color="#241A00" />
          <Text style={styles.joinBtnText}>Entrar na sala</Text>
        </Pressable>
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
  notifCard: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  notifCardUnread: {},
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBody: { flex: 1, gap: 2 },
  notifTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  notifName: { fontFamily: theme.typography.fontFamily.bodyBold },
  notifDetail: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  notifTime: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 11,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
  },
  joinBtnText: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },
});
