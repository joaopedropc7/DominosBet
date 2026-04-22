import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

type SubAfiliado = {
  id: string;
  name: string;
  email: string;
  status: string;
  own_code: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pendente',  color: '#F59E0B' },
  approved: { label: 'Aprovado',  color: '#10B981' },
  rejected: { label: 'Recusado', color: '#EF4444' },
};

export function AffiliateSubAfiliadosView() {
  const [items,   setItems]   = useState<SubAfiliado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc('get_affiliate_sub_affiliates').then(({ data }) => {
      if (data) setItems(data as SubAfiliado[]);
      setLoading(false);
    });
  }, []);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Text style={styles.breadcrumbText}>Sub-Afiliados</Text>
        <MaterialCommunityIcons name="chevron-right" size={14} color={theme.colors.textFaint} />
        <Text style={styles.breadcrumbActive}>Listar</Text>
      </View>
      <Text style={styles.pageTitle}>Sub-Afiliados</Text>

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
            {/* Table header */}
            <View style={[styles.row, styles.rowHeader]}>
              <Text style={[styles.col, styles.colHeader, { flex: 2 }]}>Nome</Text>
              <Text style={[styles.col, styles.colHeader]}>Código</Text>
              <Text style={[styles.col, styles.colHeader]}>Status</Text>
              <Text style={[styles.col, styles.colHeader]}>Cadastro</Text>
            </View>
            {items.map((item, i) => {
              const s = STATUS_LABEL[item.status] ?? { label: item.status, color: theme.colors.textFaint };
              return (
                <View key={item.id} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
                  <View style={[styles.col, { flex: 2 }]}>
                    <Text style={styles.cellName}>{item.name}</Text>
                    <Text style={styles.cellEmail}>{item.email}</Text>
                  </View>
                  <Text style={[styles.col, styles.cellMono]}>{item.own_code ?? '—'}</Text>
                  <View style={styles.col}>
                    <View style={[styles.badge, { backgroundColor: s.color + '22' }]}>
                      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
                    </View>
                  </View>
                  <Text style={[styles.col, styles.cellDate]}>
                    {new Date(item.created_at).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              );
            })}
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
  pageTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 26, marginBottom: 4 },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    overflow: 'hidden',
  },
  empty: { padding: 48, alignItems: 'center', gap: theme.spacing.sm },
  emptyIcon: {
    width: 44, height: 44, borderRadius: 999,
    backgroundColor: theme.colors.surfaceHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14 },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: 12 },
  rowHeader: { borderBottomWidth: 1, borderBottomColor: theme.colors.outline },
  rowAlt: { backgroundColor: theme.colors.surfaceInset },
  col: { flex: 1 },
  colHeader: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },

  cellName: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  cellEmail: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 11 },
  cellMono: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 12 },
  cellDate: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 12 },

  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11 },
});
