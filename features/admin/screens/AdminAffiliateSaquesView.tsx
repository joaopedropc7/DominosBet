import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator, FlatList, Modal, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

type WithdrawalRow = {
  id: string;
  affiliate_name: string;
  affiliate_email: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  pix_key_type: string;
  pix_key: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pendente',  color: '#F59E0B' },
  approved: { label: 'Aprovado',  color: '#10B981' },
  rejected: { label: 'Recusado', color: '#EF4444' },
};

const FILTER_TABS = [
  { key: 'pending',  label: 'Pendentes' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'rejected', label: 'Recusados' },
  { key: '',         label: 'Todos'     },
] as const;

const fmt = (n: number) =>
  `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export function AdminAffiliateSaquesView() {
  const [items,   setItems]   = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<string>('pending');
  const [error,   setError]   = useState('');

  const [selected,  setSelected]  = useState<WithdrawalRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [newStatus, setNewStatus] = useState<'approved' | 'rejected' | 'pending'>('pending');
  const [notes,     setNotes]     = useState('');

  async function load() {
    setLoading(true);
    setError('');
    const { data, error: rpcErr } = await supabase.rpc('admin_list_withdrawals', {
      p_status: filter || null,
    });
    if (rpcErr) {
      setError(rpcErr.message);
    } else {
      setItems((data ?? []) as WithdrawalRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  function openModal(item: WithdrawalRow) {
    setSelected(item);
    setNewStatus(item.status);
    setNotes(item.admin_notes ?? '');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    const { error: rpcErr } = await supabase.rpc('admin_process_withdrawal', {
      p_withdrawal_id: selected.id,
      p_status:        newStatus,
      p_notes:         notes.trim() || null,
    });
    setSaving(false);
    if (rpcErr) {
      setError(rpcErr.message);
    } else {
      setModalOpen(false);
      load();
    }
  }

  const pendingTotal = items
    .filter(i => i.status === 'pending')
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Saques de Afiliados</Text>
          <Text style={styles.pageSubtitle}>Processar pedidos de saque via PIX</Text>
        </View>
        <View style={styles.headerRight}>
          {filter === 'pending' && items.length > 0 && (
            <View style={styles.totalPending}>
              <Text style={styles.totalPendingLabel}>Total pendente</Text>
              <Text style={styles.totalPendingValue}>{fmt(pendingTotal)}</Text>
            </View>
          )}
          <Pressable
            onPress={load}
            style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.tabs}>
        {FILTER_TABS.map(tab => (
          <Pressable
            key={tab.key}
            onPress={() => setFilter(tab.key)}
            style={[styles.tab, filter === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, filter === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.colAfil, styles.colHead]}>Afiliado</Text>
        <Text style={[styles.col, styles.colHead]}>Valor</Text>
        <Text style={[styles.colPix, styles.colHead]}>Chave PIX</Text>
        <Text style={[styles.col, styles.colHead]}>Pedido em</Text>
        <Text style={[styles.col, styles.colHead]}>Status</Text>
        <View style={styles.colAction} />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color={theme.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const s = STATUS_CFG[item.status] ?? { label: item.status, color: theme.colors.textFaint };
            return (
              <View style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                <View style={styles.colAfil}>
                  <Text style={styles.cellName}>{item.affiliate_name}</Text>
                  <Text style={styles.cellEmail}>{item.affiliate_email}</Text>
                </View>
                <Text style={[styles.col, styles.cellAmount]}>{fmt(item.amount)}</Text>
                <View style={styles.colPix}>
                  <Text style={styles.cellText}>{item.pix_key}</Text>
                  <Text style={styles.cellEmail}>{item.pix_key_type}</Text>
                </View>
                <Text style={[styles.col, styles.cellDate]}>
                  {new Date(item.created_at).toLocaleDateString('pt-BR')}
                </Text>
                <View style={styles.col}>
                  <View style={[styles.badge, { backgroundColor: s.color + '22' }]}>
                    <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
                  </View>
                </View>
                <View style={styles.colAction}>
                  <Pressable
                    onPress={() => openModal(item)}
                    style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="bank-transfer-out" size={36} color={theme.colors.textFaint} />
              <Text style={styles.emptyText}>Nenhum saque encontrado.</Text>
            </View>
          }
        />
      )}

      {/* Process modal */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Processar Saque</Text>

            {selected && (
              <>
                <View style={styles.detailBox}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Afiliado</Text>
                    <Text style={styles.detailValue}>{selected.affiliate_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Valor</Text>
                    <Text style={[styles.detailValue, { color: theme.colors.primary }]}>
                      {fmt(selected.amount)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Chave PIX</Text>
                    <Text style={styles.detailValue}>{selected.pix_key}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tipo</Text>
                    <Text style={styles.detailValue}>{selected.pix_key_type}</Text>
                  </View>
                </View>

                {/* Status selector */}
                <Text style={styles.fieldLabel}>Decisão</Text>
                <View style={styles.statusRow}>
                  {(['approved', 'pending', 'rejected'] as const).map(s => (
                    <Pressable
                      key={s}
                      onPress={() => setNewStatus(s)}
                      style={[
                        styles.statusBtn,
                        { borderColor: STATUS_CFG[s].color },
                        newStatus === s && { backgroundColor: STATUS_CFG[s].color + '33' },
                      ]}
                    >
                      <Text style={[styles.statusBtnText, { color: STATUS_CFG[s].color }]}>
                        {STATUS_CFG[s].label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Notas internas</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldInputMulti]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  placeholder="Ex: PIX enviado, comprovante #12345…"
                  placeholderTextColor={theme.colors.textFaint}
                />
              </>
            )}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setModalOpen(false)}
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnCancel, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnConfirm, pressed && { opacity: 0.8 }]}
              >
                {saving
                  ? <ActivityIndicator color="#241A00" size="small" />
                  : <Text style={[styles.modalBtnText, { color: '#241A00' }]}>Salvar</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  pageTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 26 },
  pageSubtitle: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  totalPending: {
    backgroundColor: '#F59E0B22',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  totalPendingLabel: { color: '#F59E0B', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  totalPendingValue: { color: '#F59E0B', fontFamily: theme.typography.fontFamily.display, fontSize: 18 },
  refreshBtn: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },

  tabs: {
    flexDirection: 'row', gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: theme.colors.outline,
  },
  tab: {
    paddingHorizontal: theme.spacing.md, paddingVertical: 7,
    borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.outline,
  },
  tabActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  tabText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  tabTextActive: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyBold },

  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: theme.colors.outline,
    backgroundColor: theme.colors.surface,
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.xl, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.outline,
  },
  tableRowEven: { backgroundColor: 'rgba(255,255,255,0.015)' },

  col: { flex: 1 },
  colAfil: { flex: 2 },
  colPix: { flex: 2 },
  colAction: { width: 40, alignItems: 'center' },
  colHead: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },

  cellName: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  cellEmail: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 11 },
  cellAmount: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 14 },
  cellText: { color: theme.colors.textSoft, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  cellDate: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 12 },

  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11 },

  editBtn: {
    width: 32, height: 32, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceHigh, alignItems: 'center', justifyContent: 'center',
  },

  list: { paddingBottom: 60 },
  empty: { alignItems: 'center', gap: theme.spacing.md, marginTop: 80 },
  emptyText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    margin: theme.spacing.xl, backgroundColor: 'rgba(255,139,135,0.10)',
    borderRadius: theme.radius.md, padding: theme.spacing.md,
  },
  errorText: { color: theme.colors.danger, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14, flex: 1 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modal: {
    width: 480,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  modalTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 20, marginBottom: 4 },

  detailBox: {
    backgroundColor: theme.colors.surfaceInset,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.md,
    gap: 8,
    marginBottom: theme.spacing.xs,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  detailValue: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },

  statusRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
  statusBtn: { flex: 1, borderWidth: 1, borderRadius: theme.radius.md, paddingVertical: 8, alignItems: 'center' },
  statusBtnText: { fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },

  fieldLabel: {
    color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  fieldInput: {
    backgroundColor: theme.colors.surfaceHigh, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.outline,
    color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14, paddingHorizontal: theme.spacing.md, paddingVertical: 10,
    outlineStyle: 'none',
  } as any,
  fieldInputMulti: { minHeight: 70, textAlignVertical: 'top' },

  modalActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  modalBtn: { flex: 1, borderRadius: theme.radius.lg, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancel: { backgroundColor: theme.colors.surfaceHigh, borderWidth: 1, borderColor: theme.colors.outline },
  modalBtnConfirm: { backgroundColor: theme.colors.primary },
  modalBtnText: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 14 },
});
