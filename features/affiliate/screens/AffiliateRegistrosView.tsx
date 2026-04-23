import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

type Registro = {
  id: string;
  user_name: string;
  user_email: string;
  has_deposited: boolean;
  deposit_total: number;
  cpa_paid: boolean;
  created_at: string;
};

export function AffiliateRegistrosView() {
  const [items,   setItems]   = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc('get_affiliate_registros').then(({ data }) => {
      if (data) setItems(data as Registro[]);
      setLoading(false);
    });
  }, []);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <View style={styles.breadcrumb}>
        <Text style={styles.breadcrumbText}>Registros</Text>
        <MaterialCommunityIcons name="chevron-right" size={14} color={theme.colors.textFaint} />
        <Text style={styles.breadcrumbActive}>Listar</Text>
      </View>
      <Text style={styles.pageTitle}>Registros</Text>
      <Text style={styles.pageSubtitle}>Usuários que usaram seu código</Text>

      <View style={styles.card}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="close" size={20} color={theme.colors.textFaint} />
            </View>
            <Text style={styles.emptyText}>Sem registros</Text>
          </View>
        ) : (
          <>
            <View style={[styles.row, styles.rowHeader]}>
              <Text style={[styles.col, styles.colHeader, { flex: 2 }]}>Usuário</Text>
              <Text style={[styles.col, styles.colHeader]}>Depositou</Text>
              <Text style={[styles.col, styles.colHeader]}>Total dep.</Text>
              <Text style={[styles.col, styles.colHeader]}>CPA pago</Text>
              <Text style={[styles.col, styles.colHeader]}>Cadastro</Text>
            </View>
            {items.map((item, i) => (
              <View key={item.id} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
                <View style={[styles.col, { flex: 2 }]}>
                  <Text style={styles.cellName}>{item.user_name || '—'}</Text>
                  <Text style={styles.cellEmail}>{item.user_email}</Text>
                </View>
                <View style={styles.col}>
                  <MaterialCommunityIcons
                    name={item.has_deposited ? 'check-circle' : 'circle-outline'}
                    size={16}
                    color={item.has_deposited ? '#10B981' : theme.colors.textFaint}
                  />
                </View>
                <Text style={[styles.col, styles.cellAmount]}>
                  {item.has_deposited
                    ? `R$ ${Number(item.deposit_total).toFixed(2).replace('.', ',')}`
                    : '—'}
                </Text>
                <View style={styles.col}>
                  <MaterialCommunityIcons
                    name={item.cpa_paid ? 'check-circle' : 'circle-outline'}
                    size={16}
                    color={item.cpa_paid ? theme.colors.primary : theme.colors.textFaint}
                  />
                </View>
                <Text style={[styles.col, styles.cellDate]}>
                  {new Date(item.created_at).toLocaleDateString('pt-BR')}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md },
  center: { padding: 40, alignItems: 'center' },

  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  breadcrumbText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  breadcrumbActive: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  pageTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 26 },
  pageSubtitle: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13, marginBottom: 4 },

  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.outline, overflow: 'hidden' },
  empty: { padding: 48, alignItems: 'center', gap: theme.spacing.sm },
  emptyIcon: { width: 44, height: 44, borderRadius: 999, backgroundColor: theme.colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14 },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: 12 },
  rowHeader: { borderBottomWidth: 1, borderBottomColor: theme.colors.outline },
  rowAlt: { backgroundColor: theme.colors.surfaceInset },
  col: { flex: 1 },
  colHeader: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },

  cellName: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  cellEmail: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 11 },
  cellAmount: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 12 },
  cellDate: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 12 },
});
