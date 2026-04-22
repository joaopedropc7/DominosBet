import { useEffect, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator, FlatList, Modal, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

type AffiliateRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  status: 'pending' | 'approved' | 'rejected';
  own_code: string | null;
  referral_code: string | null;
  revshare_percent: number;
  cpa_amount: number;
  sub_affiliate_percent: number;
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  referrals_count: number;
  deposits_total: number;
  admin_notes: string | null;
  created_at: string;
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Em análise', color: '#F59E0B' },
  approved: { label: 'Aprovado',   color: '#10B981' },
  rejected: { label: 'Recusado',   color: '#EF4444' },
};

const FILTER_TABS = [
  { key: 'pending',  label: 'Em análise' },
  { key: 'approved', label: 'Aprovados'  },
  { key: 'rejected', label: 'Recusados'  },
  { key: '',         label: 'Todos'      },
] as const;

const fmt = (n: number | null | undefined) =>
  `R$ ${(n ?? 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export function AdminAffiliateCadastrosView() {
  const [items,   setItems]   = useState<AffiliateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<string>('pending');
  const [search,  setSearch]  = useState('');
  const [error,   setError]   = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selected,  setSelected]  = useState<AffiliateRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving,    setSaving]    = useState(false);

  // Modal editable fields
  const [ownCode,    setOwnCode]    = useState('');
  const [revshare,   setRevshare]   = useState('');
  const [cpa,        setCpa]        = useState('');
  const [subPct,     setSubPct]     = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus,  setNewStatus]  = useState<'approved' | 'rejected' | 'pending'>('pending');

  async function load(searchVal = search) {
    setLoading(true);
    setError('');
    const { data, error: rpcErr } = await supabase.rpc('admin_list_affiliates', {
      p_status: filter || null,
      p_search: searchVal.trim() || null,
    });
    if (rpcErr) setError(rpcErr.message);
    else setItems((data ?? []) as AffiliateRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  function handleSearchChange(val: string) {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(val), 400);
  }

  function openModal(item: AffiliateRow) {
    setSelected(item);
    setOwnCode(item.own_code ?? '');
    setRevshare(String(item.revshare_percent ?? 40));
    setCpa((item.cpa_amount ?? 5).toFixed(2));
    setSubPct(String(item.sub_affiliate_percent ?? 10));
    setAdminNotes(item.admin_notes ?? '');
    setNewStatus(item.status);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    const { error: rpcErr } = await supabase.rpc('admin_update_affiliate', {
      p_affiliate_id:          selected.id,
      p_status:                newStatus,
      p_own_code:              ownCode.trim().toUpperCase() || null,
      p_notes:                 adminNotes.trim() || null,
      p_revshare_percent:      parseInt(revshare, 10) || 40,
      p_cpa_amount:            parseFloat(cpa) || 5,
      p_sub_affiliate_percent: parseInt(subPct, 10) || 10,
    });
    setSaving(false);
    if (rpcErr) setError(rpcErr.message);
    else { setModalOpen(false); load(); }
  }

  const pendingCount = items.filter(i => i.status === 'pending').length;

  return (
    <View style={styles.root}>
      {/* ── Header ────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Afiliados</Text>
          <Text style={styles.pageSubtitle}>Cadastros, comissões e desempenho</Text>
        </View>
        <View style={styles.headerRight}>
          {pendingCount > 0 && filter !== 'pending' && (
            <Pressable
              onPress={() => setFilter('pending')}
              style={styles.alertBadge}
            >
              <MaterialCommunityIcons name="clock-alert-outline" size={14} color="#F59E0B" />
              <Text style={styles.alertBadgeText}>{pendingCount} em análise</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => load()}
            style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* ── Search + Filter ───────────────────────────────── */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome ou e-mail…"
            placeholderTextColor={theme.colors.textFaint}
            value={search}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => { setSearch(''); load(''); }}>
              <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.textFaint} />
            </Pressable>
          )}
        </View>

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
      </View>

      {/* ── Table header ──────────────────────────────────── */}
      <View style={styles.tableHeader}>
        <Text style={[styles.colAfil,    styles.colHead]}>Afiliado</Text>
        <Text style={[styles.col,        styles.colHead]}>Código</Text>
        <Text style={[styles.col,        styles.colHead]}>Cadastros</Text>
        <Text style={[styles.col,        styles.colHead]}>Dep. trazidos</Text>
        <Text style={[styles.col,        styles.colHead]}>Total ganho</Text>
        <Text style={[styles.col,        styles.colHead]}>Saldo</Text>
        <Text style={[styles.col,        styles.colHead]}>Status</Text>
        <View style={styles.colAction} />
      </View>

      {/* ── List ──────────────────────────────────────────── */}
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
                  <Text style={styles.cellName}>{item.name}</Text>
                  <Text style={styles.cellSub}>{item.email}</Text>
                  <Text style={styles.cellSub}>{item.phone}</Text>
                </View>
                <Text style={[styles.col, styles.cellMono]}>{item.own_code ?? '—'}</Text>
                <View style={styles.col}>
                  <Text style={styles.cellNumber}>{item.referrals_count ?? 0}</Text>
                  <Text style={styles.cellSub}>jogadores</Text>
                </View>
                <Text style={[styles.col, styles.cellMoney]}>{fmt(item.deposits_total)}</Text>
                <Text style={[styles.col, styles.cellMoney]}>{fmt(item.total_earned)}</Text>
                <Text style={[styles.col, styles.cellBalance]}>{fmt(item.balance)}</Text>
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
              <MaterialCommunityIcons name="account-off-outline" size={36} color={theme.colors.textFaint} />
              <Text style={styles.emptyText}>
                {search ? 'Nenhum afiliado encontrado para esta busca.' : 'Nenhum afiliado nesta categoria.'}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Edit modal ────────────────────────────────────── */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>{selected?.name}</Text>
            <Text style={styles.modalSub}>{selected?.email} · CPF: {selected?.cpf}</Text>

            {/* Metrics summary */}
            {selected && (
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{selected.referrals_count ?? 0}</Text>
                  <Text style={styles.metricLabel}>Cadastros</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{fmt(selected.deposits_total)}</Text>
                  <Text style={styles.metricLabel}>Dep. trazidos</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{fmt(selected.total_earned)}</Text>
                  <Text style={styles.metricLabel}>Total ganho</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
                    {fmt(selected.balance)}
                  </Text>
                  <Text style={styles.metricLabel}>Saldo</Text>
                </View>
              </View>
            )}

            {/* Status */}
            <Text style={styles.fieldLabel}>Status</Text>
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

            {/* Commission fields */}
            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Código próprio</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={ownCode}
                  onChangeText={v => setOwnCode(v.toUpperCase())}
                  autoCapitalize="characters"
                  placeholder="Ex: MEUCODIGO"
                  placeholderTextColor={theme.colors.textFaint}
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>RevShare %</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={revshare}
                  onChangeText={setRevshare}
                  keyboardType="number-pad"
                  placeholder="40"
                  placeholderTextColor={theme.colors.textFaint}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>CPA (R$)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={cpa}
                  onChangeText={setCpa}
                  keyboardType="decimal-pad"
                  placeholder="5.00"
                  placeholderTextColor={theme.colors.textFaint}
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Sub-Afiliado %</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={subPct}
                  onChangeText={setSubPct}
                  keyboardType="number-pad"
                  placeholder="10"
                  placeholderTextColor={theme.colors.textFaint}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Notas internas</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputMulti]}
              value={adminNotes}
              onChangeText={setAdminNotes}
              multiline
              numberOfLines={3}
              placeholder="Observações sobre este afiliado…"
              placeholderTextColor={theme.colors.textFaint}
            />

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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  alertBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F59E0B22', borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: '#F59E0B44',
  },
  alertBadgeText: { color: '#F59E0B', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 12 },
  refreshBtn: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },

  toolbar: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    outlineStyle: 'none',
  } as any,

  tabs: { flexDirection: 'row', gap: theme.spacing.xs },
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
  colAction: { width: 40, alignItems: 'center' },
  colHead: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },

  cellName: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  cellSub: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 11 },
  cellMono: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 12 },
  cellNumber: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 18 },
  cellMoney: { color: theme.colors.textSoft, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 12 },
  cellBalance: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 12 },

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
    width: 540,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  modalTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 20 },
  modalSub: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12, marginBottom: 4 },

  metricsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceInset,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    marginBottom: theme.spacing.xs,
    overflow: 'hidden',
  },
  metricItem: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  metricDivider: { width: 1, backgroundColor: theme.colors.outline },
  metricValue: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 15 },
  metricLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 10 },

  statusRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
  statusBtn: { flex: 1, borderWidth: 1, borderRadius: theme.radius.md, paddingVertical: 8, alignItems: 'center' },
  statusBtnText: { fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },

  formRow: { flexDirection: 'row', gap: theme.spacing.sm },
  formField: { flex: 1, gap: 4 },
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
