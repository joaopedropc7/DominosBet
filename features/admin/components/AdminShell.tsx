import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { useUserData } from '@/hooks/useUserData';
import { theme } from '@/theme';

const NAV_SECTIONS = [
  {
    label: 'Geral',
    items: [
      { label: 'Dashboard',      icon: 'view-dashboard-outline', href: '/admin'                  },
      { label: 'Usuários',       icon: 'account-group-outline',  href: '/admin/usuarios'         },
      { label: 'Transações',     icon: 'swap-horizontal',        href: '/admin/transacoes'       },
      { label: 'Gateway',        icon: 'credit-card-outline',    href: '/admin/gateway'          },
      { label: 'Configurações',  icon: 'cog-outline',            href: '/admin/configuracoes'    },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { label: 'Saques Jogadores', icon: 'bank-transfer-out',    href: '/admin/saques-jogadores'    },
      { label: 'Saques Afiliados', icon: 'account-cash-outline', href: '/admin/afiliados-saques'    },
    ],
  },
  {
    label: 'Programa de Afiliados',
    items: [
      { label: 'Afiliados', icon: 'account-plus-outline', href: '/admin/afiliados-cadastros' },
    ],
  },
] as const;

export function AdminShell({ children }: PropsWithChildren) {
  const { isAdmin, isLoading } = useAdminGuard();
  const { profile } = useUserData();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) return null; // guard already redirected

  return (
    <SafeAreaView style={styles.root}>
      {/* ── Sidebar ─────────────────────────────── */}
      <View style={styles.sidebar}>
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <MaterialCommunityIcons name="shield-crown" size={20} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={styles.brandTitle}>Admin</Text>
            <Text style={styles.brandSub}>Dominos Bet</Text>
          </View>
        </View>

        {/* Nav */}
        <View style={styles.nav}>
          {NAV_SECTIONS.map((section) => (
            <View key={section.label} style={styles.navSection}>
              <Text style={styles.navLabel}>{section.label}</Text>
              {section.items.map((item) => {
                const active =
                  item.href === '/admin'
                    ? pathname === '/admin' || pathname === '/admin/'
                    : pathname.startsWith(item.href);
                return (
                  <Pressable
                    key={item.href}
                    onPress={() => router.push(item.href as any)}
                    style={({ pressed }) => [
                      styles.navItem,
                      active && styles.navItemActive,
                      pressed && !active && styles.navItemPressed,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={18}
                      color={active ? theme.colors.primary : theme.colors.textMuted}
                    />
                    <Text style={[styles.navItemText, active && styles.navItemTextActive]}>
                      {item.label}
                    </Text>
                    {active && <View style={styles.activeIndicator} />}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.sidebarFooter}>
          <View style={styles.userRow}>
            <View style={styles.userAvatar}>
              <MaterialCommunityIcons name="account" size={16} color={theme.colors.textMuted} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {profile?.display_name ?? '—'}
              </Text>
              <Text style={styles.userRole}>Administrador</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.replace('/(main)/home')}
            style={({ pressed }) => [styles.exitBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="exit-to-app" size={16} color={theme.colors.textFaint} />
            <Text style={styles.exitText}>Sair do painel</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Content ─────────────────────────────── */}
      <View style={styles.content}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const SIDEBAR_W = 230;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Sidebar ──────────────────────────────────
  sidebar: {
    width: SIDEBAR_W,
    backgroundColor: theme.colors.surface,
    borderRightWidth: 1,
    borderRightColor: theme.colors.outline,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xl,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 16,
    lineHeight: 20,
  },
  brandSub: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  // ── Navigation ───────────────────────────────
  nav: {
    flex: 1,
    gap: theme.spacing.md,
  },
  navSection: {
    gap: theme.spacing.xs,
  },
  navLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: theme.colors.primarySoft,
  },
  navItemPressed: {
    backgroundColor: theme.colors.surfaceHigh,
  },
  navItemText: {
    flex: 1,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  navItemTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodySemiBold,
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },

  // ── Footer ───────────────────────────────────
  sidebarFooter: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    gap: 1,
  },
  userName: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  userRole: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  exitText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },

  // ── Content area ─────────────────────────────
  content: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
