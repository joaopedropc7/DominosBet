import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { bottomNavItems } from '@/constants/app';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { useResponsive } from '@/hooks/useResponsive';
import { theme } from '@/theme';

export function AppBottomNav() {
  const pathname   = usePathname();
  const unread     = useUnreadNotifications();
  const { contentMaxWidth, horizontalPadding, isCompact, isPhone } = useResponsive();

  return (
    <View style={[styles.shell, { paddingHorizontal: horizontalPadding, paddingBottom: isPhone ? theme.spacing.sm : theme.spacing.md }]}>
      <View
        style={[
          styles.bar,
          {
            maxWidth: contentMaxWidth,
            minHeight: isPhone ? 64 : theme.layout.bottomNavHeight - theme.spacing.md,
            paddingHorizontal: isCompact ? 4 : theme.spacing.sm,
          },
        ]}
      >
        {bottomNavItems.map((item) => {
          const isActive   = item.matchers.includes(pathname);
          const badgeCount = item.label === 'Alertas' ? unread : 0;

          return (
            <NavItem
              key={item.href}
              isActive={isActive}
              isCompact={isCompact}
              icon={item.icon}
              label={item.label}
              badgeCount={badgeCount}
              onPress={() => { if (!isActive) router.replace(item.href); }}
            />
          );
        })}
      </View>
    </View>
  );
}

function NavItem({
  isActive,
  isCompact,
  icon,
  label,
  badgeCount = 0,
  onPress,
}: {
  isActive: boolean;
  isCompact: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  badgeCount?: number;
  onPress: () => void;
}) {
  const progress = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isActive ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isActive, progress]);

  const backgroundStyle = {
    opacity: progress,
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      },
    ],
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.link,
        pressed && styles.pressed,
        isCompact && styles.linkCompact,
      ]}
    >
      <Animated.View pointerEvents="none" style={[styles.itemBackground, backgroundStyle]} />

      {/* Icon + badge */}
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons
          name={icon}
          size={isCompact ? 18 : 20}
          color={isActive ? '#241A00' : theme.colors.textFaint}
        />
        {badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
          </View>
        )}
      </View>

      <Text
        numberOfLines={1}
        style={[
          styles.label,
          isCompact && styles.labelCompact,
          isActive && styles.activeLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    width: '100%', maxWidth: '100%',
    alignItems: 'center',
  },
  bar: {
    width: '100%', maxWidth: '100%',
    minHeight: theme.layout.bottomNavHeight - theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: 'rgba(28, 27, 27, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(77, 70, 53, 0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  itemBackground: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0, left: 0,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  link: {
    flex: 1,
    minWidth: 0, maxWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    zIndex: 1,
  },
  linkCompact: { paddingHorizontal: 2, gap: 3 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },

  iconWrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.bodyBold,
    lineHeight: 10,
  },

  label: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  labelCompact: { fontSize: 9, letterSpacing: 0.6 },
  activeLabel: { color: '#241A00' },
});
