import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Clipboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useAffiliateGuard } from '../hooks/useAffiliateGuard';
import { theme } from '@/theme';

const NAV = [
  { label: 'Dashboard',      icon: 'view-dashboard-outline', href: '/afiliado'              },
  { label: 'Sub-Afiliados',  icon: 'account-group-outline',  href: '/afiliado/sub-afiliados'},
  { label: 'Registros',      icon: 'account-multiple-plus-outline', href: '/afiliado/registros' },
  { label: 'Carteira',       icon: 'wallet-outline',          href: '/afiliado/carteira'    },
  { label: 'Conta',          icon: 'account-cog-outline',     href: '/afiliado/conta'       },
] as const;

const SITE = 'https://dominosbet.com.br';

export function AffiliateShell({ children }: PropsWithChildren) {
  const { affiliate, isLoading } = useAffiliateGuard();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!affiliate) return null;

  const isPending  = affiliate.status === 'pending';
  const isApproved = affiliate.status === 'approved';
  const refLink    = affiliate.own_code ? `${SITE}/cadastro?ref=${affiliate.own_code}` : '—';

  function copyLink() {
    if (affiliate?.own_code) Clipboard.setString(refLink);
  }

  if (isPending) {
    return (
      <SafeAreaView style={styles.centered}>
        <View style={styles.pendingWrap}>
          <MaterialCommunityIcons name="clock-outline" size={56} color={theme.colors.accent} />
          <Text style={styles.pendingTitle}>Cadastro em análise</Text>
          <Text style={styles.pendingBody}>
            Nossa equipe está analisando seu cadastro. Você receberá um e-mail assim que for aprovado.
          </Text>
          <Pressable
            onPress={() => router.replace('/login')}
            style={({ pressed }) => [styles.pendingBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.pendingBtnText}>Voltar ao início</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <View style={styles.sidebar}>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <MaterialCommunityIcons name="account-circle" size={44} color={theme.colors.textMuted} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>{affiliate.name}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{affiliate.email}</Text>
            <View style={styles.badges}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{affiliate.revshare_percent}% RevShare</Text>
              </View>
              <View style={[styles.badge, styles.badgeCpa]}>
                <Text style={styles.badgeText}>
                  R$ {affiliate.cpa_amount.toFixed(0)} CPA
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Balance */}
        <Pressable style={styles.balanceBox} onPress={() => router.push('/afiliado/carteira' as any)}>
          <MaterialCommunityIcons name="wallet-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.balanceText}>
            R$ {affiliate.balance.toFixed(2).replace('.', ',')}
          </Text>
        </Pressable>

        {/* Referral link */}
        <View style={styles.linkBox}>
          <View style={styles.linkTop}>
            <MaterialCommunityIcons name="link-variant" size={14} color={theme.colors.textFaint} />
            <Text style={styles.linkLabel}>Link de indicação</Text>
          </View>
          <View style={styles.linkRow}>
            <Text style={styles.linkCode} numberOfLines={1}>
              {affiliate.own_code
                ? `dominosbet.com.br/cadastro?ref=${affiliate.own_code}`
                : '(sem código)'}
            </Text>
            <Pressable onPress={copyLink} style={styles.copyBtn}>
              <MaterialCommunityIcons name="content-copy" size={14} color={theme.colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Navigation */}
        <View style={styles.nav}>
          {NAV.map((item) => {
            const active = item.href === '/afiliado'
              ? pathname === '/afiliado' || pathname === '/afiliado/'
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
              </Pressable>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.sidebarFooter}>
          <Pressable
            onPress={() => router.replace('/(main)/home')}
            style={({ pressed }) => [styles.exitBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="exit-to-app" size={15} color={theme.colors.textFaint} />
            <Text style={styles.exitText}>Sair do painel</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Content ─────────────────────────────────────────── */}
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const SIDEBAR_W = 200;

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

  // ── Sidebar ──────────────────────────────────────────────
  sidebar: {
    width: SIDEBAR_W,
    backgroundColor: theme.colors.surface,
    borderRightWidth: 1,
    borderRightColor: theme.colors.outline,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    gap: theme.spacing.sm,
  },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    alignItems: 'flex-start',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileInfo: { flex: 1, gap: 2 },
  profileName: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },
  profileEmail: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 10,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 3 },
  badge: {
    backgroundColor: '#1D4ED8',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeCpa: { backgroundColor: '#0369A1' },
  badgeText: {
    color: '#fff',
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 9,
  },

  // Balance
  balanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceInset,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
  },
  balanceText: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
  },

  // Referral link
  linkBox: {
    backgroundColor: theme.colors.surfaceInset,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.sm,
    gap: 4,
  },
  linkTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 10,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkCode: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },
  copyBtn: { padding: 4 },

  // Navigation
  nav: { flex: 1, gap: 2, paddingTop: theme.spacing.xs },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 9,
    borderRadius: theme.radius.md,
  },
  navItemActive: { backgroundColor: theme.colors.primarySoft },
  navItemPressed: { backgroundColor: theme.colors.surfaceHigh },
  navItemText: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  navItemTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodySemiBold,
  },

  // Footer
  sidebarFooter: {
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
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
    fontSize: 12,
  },

  // Content
  content: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // Pending state
  pendingWrap: {
    alignItems: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.xl,
    maxWidth: 380,
  },
  pendingTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 22,
    textAlign: 'center',
  },
  pendingBody: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  pendingBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  pendingBtnText: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 14,
  },
});
