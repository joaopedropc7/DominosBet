import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandMark } from './BrandMark';
import { theme } from '@/theme';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  compactBrand?: boolean;
  rightIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onRightPress?: () => void;
  /** Optional badge count shown over the right icon (e.g. unread notifications) */
  badgeCount?: number;
}

export function AppHeader({ title, subtitle, compactBrand = true, rightIcon = 'cog-outline', onRightPress, badgeCount }: AppHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.root}>
      {title ? (
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : (
        <Pressable onPress={() => router.push('/(main)/home')}>
          <BrandMark compact={compactBrand} />
        </Pressable>
      )}
      <Pressable onPress={onRightPress} style={styles.action}>
        <MaterialCommunityIcons name={rightIcon} size={22} color={theme.colors.primary} />
        {badgeCount != null && badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  copy: {
    gap: 4,
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 30,
  },
  subtitle: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  action: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceHigh,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bodyBold,
    lineHeight: 11,
  },
});
