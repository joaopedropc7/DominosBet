import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

// ─── Types ────────────────────────────────────────────────────

type ApiLog = {
  id:            string;
  type:          string;
  withdrawal_id: string | null;
  external_ref:  string | null;
  status_code:   number | null;
  request_body:  Record<string, any> | null;
  response_body: Record<string, any> | null;
  error:         string | null;
  created_at:    string;
};

type TypeFilter = null | 'pix-out' | 'pix-out-affiliate' | 'webhook-withdrawal';

// ─── Constants ────────────────────────────────────────────────

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: null,                  label: 'Todos'           },
  { key: 'pix-out',             label: 'PIX Jogadores'   },
  { key: 'pix-out-affiliate',   label: 'PIX Afiliados'   },
  { key: 'webhook-withdrawal',  label: 'Webhook Saque'   },
];

const TYPE_LABEL: Record<string, string> = {
  'pix-out':            'PIX Jogadores',
  'pix-out-affiliate':  'PIX Afiliados',
  'webhook-withdrawal': 'Webhook Saque',
};

const TYPE_COLOR: Record<string, string> = {
  'pix-out':            '#60A5FA',
  'pix-out-affiliate':  '#A78BFA',
  'webhook-withdrawal': '#34D399',
};

function statusColor(code: number | null): string {
  if (code === null) return theme.colors.textFaint;
  if (code >= 200 && code < 300) return '#10B981';
  if (code >= 400 && code < 500) return '#F59E0B';
  return '#EF4444';
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────

export function AdminLogsView() {
  const [logs,    setLogs]    = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<TypeFilter>(null);
  const [detail,  setDetail]  = useState<ApiLog | null>(null);
  const [detailTab, setDetailTab] = useState<'request' | 'response'>('response');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc('admin_list_api_logs', {
      p_type:   filter,
      p_limit:  200,
      p_offset: 0,
    });
    if (data) setLogs(data as ApiLog[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function openDetail(log: ApiLog) {
    setDetail(log);
    setDetailTab('response');
  }

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Logs de API</Text>
          <Text style={styles.subtitle}>Requisições ao gateway OramaPay e webhooks recebidos</Text>
        </View>
        <Pressable onPress={load} style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}>
          <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.primary} />
          <Text style={styles.refreshText}>Atualizar</Text>
        </Pressable>
      </View>

      {/* ── Filters ── */}
      <View style={styles.filterRow}>
        {TYPE_FILTERS.map((f) => (
          <Pressable
            key={String(f.key)}
            onPress={() => setFilter(f.key)}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── List ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="text-box-outline" size={40} color={theme.colors.textFaint} />
          <Text style={styles.emptyText}>Nenhum log encontrado</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openDetail(item)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
            >
              {/* Type badge */}
              <View style={[styles.typeBadge, { backgroundColor: (TYPE_COLOR[item.type] ?? '#6B7280') + '22' }]}>
                <Text style={[styles.typeBadgeText, { color: TYPE_COLOR[item.type] ?? '#6B7280' }]}>
                  {TYPE_LABEL[item.type] ?? item.type}
                </Text>
              </View>

              {/* Main info */}
              <View style={styles.rowMain}>
                <Text style={styles.rowRef} numberOfLines={1}>
                  {item.external_ref ?? item.withdrawal_id ?? '—'}
                </Text>
                <Text style={styles.rowDate}>{fmtDate(item.created_at)}</Text>
              </View>

              {/* Status code */}
              <View style={[styles.statusBadge, { borderColor: statusColor(item.status_code) }]}>
                <Text style={[styles.statusText, { color: statusColor(item.status_code) }]}>
                  {item.status_code ?? '—'}
                </Text>
              </View>

              {/* Error pill */}
              {item.error && (
                <View style={styles.errorPill}>
                  <MaterialCommunityIcons name="alert-circle" size={12} color="#EF4444" />
                  <Text style={styles.errorPillText} numberOfLines={1}>{item.error}</Text>
                </View>
              )}

              <MaterialCommunityIcons name="chevron-right" size={16} color={theme.colors.textFaint} />
            </Pressable>
          )}
        />
      )}

      {/* ── Detail Modal ── */}
      <Modal
        visible={!!detail}
        transparent
        animationType="fade"
        onRequestClose={() => setDetail(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Detalhes do Log</Text>
                {detail && (
                  <Text style={styles.modalSub}>
                    {TYPE_LABEL[detail.type] ?? detail.type}
                    {detail.external_ref ? ` · ${detail.external_ref}` : ''}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => setDetail(null)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            {/* Meta row */}
            {detail && (
              <View style={styles.metaRow}>
                <Text style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Data: </Text>
                  {fmtDate(detail.created_at)}
                </Text>
                <Text style={[styles.metaItem, { color: statusColor(detail.status_code) }]}>
                  HTTP {detail.status_code ?? '—'}
                </Text>
                {detail.error && (
                  <Text style={[styles.metaItem, { color: '#EF4444', flex: 1 }]}>
                    Erro: {detail.error}
                  </Text>
                )}
              </View>
            )}

            {/* Tab toggle */}
            <View style={styles.tabRow}>
              {(['response', 'request'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setDetailTab(tab)}
                  style={[styles.tabBtn, detailTab === tab && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabText, detailTab === tab && styles.tabTextActive]}>
                    {tab === 'response' ? 'Resposta OramaPay' : 'Payload Enviado'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* JSON content */}
            <ScrollView style={styles.jsonScroll}>
              <Text style={styles.jsonText}>
                {detail
                  ? JSON.stringify(
                      detailTab === 'response' ? detail.response_body : detail.request_body,
                      null, 2
                    ) ?? 'null'
                  : ''}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
  },
  subtitle: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 13,
    marginTop: 2,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  refreshText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    backgroundColor: theme.colors.surface,
  },
  filterChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  filterText: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  filterTextActive: {
    color: theme.colors.primary,
  },

  // List
  list: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    minWidth: 110,
    alignItems: 'center',
  },
  typeBadgeText: {
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowRef: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  rowDate: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    minWidth: 48,
    alignItems: 'center',
  },
  statusText: {
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 12,
  },
  errorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF444422',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    maxWidth: 200,
  },
  errorPillText: {
    color: '#EF4444',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 11,
    flex: 1,
  },

  // Empty / Loading
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  emptyText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 15,
  },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  modal: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '85%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  modalTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 16,
  },
  modalSub: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: theme.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceHigh,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    flexWrap: 'wrap',
  },
  metaLabel: {
    color: theme.colors.textFaint,
  },
  metaItem: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  tabTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodySemiBold,
  },
  jsonScroll: {
    flex: 1,
    padding: theme.spacing.lg,
    backgroundColor: '#0D1117',
  },
  jsonText: {
    color: '#E6EDF3',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 20,
  },
});
