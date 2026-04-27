import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

type Withdrawal = {
  id: string;
  affiliate_id: string;
  affiliate_name: string;
  affiliate_email: string;
  destination_name: string;
  destination_doc: string;
  amount: number;
  pix_key_type: string;
  pix_key: string;
  status: string;
  external_ref: string;
  orama_id: string | null;
  admin_notes: string | null;
  created_at: string;
};

type StatusFilter = 'all' | 'pending' | 'processing' | 'approved' | 'paid' | 'rejected';

const STATUS_OPTS: { key: StatusFilter; label: string }[] = [
  { key: 'all',        label: 'Todos'       },
  { key: 'pending',    label: 'Em análise'  },
  { key: 'processing', label: 'Processando' },
  { key: 'approved',   label: 'Aprovados'   },
  { key: 'paid',       label: 'Pagos'       },
  { key: 'rejected',   label: 'Recusados'   },
];

const STATUS_COLOR: Record<string, string> = {
  pending:    '#F59E0B',
  processing: '#60A5FA',
  paid:       '#10B981',
  approved:   '#10B981',
  rejected:   '#EF4444',
};

const STATUS_LABEL: Record<string, string> = {
  pending:    'Em análise',
  processing: 'Processando',
  paid:       'Pago',
  approved:   'Aprovado',
  rejected:   'Recusado',
};

const fmt = (n: number) =>
  `R$ ${Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export function AdminAffiliateSaquesView() {
  const [items,         setItems]         = useState<Withdrawal[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState<StatusFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal de rejeição
  const [rejectId,   setRejectId]   = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('admin_list_affiliate_withdrawals', {
      p_status: filter === 'all' ? null : filter,
    });
    if (data) setItems(data as Withdrawal[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function handleApprove(wd: Withdrawal) {
    setActionLoading(wd.id);
    try {
      const { data: { session } } = await supabase.auth.refreshSession();
      const token = session?.access_token ?? '';
      const res = await fetch('/api/pix-out-affiliate', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ withdrawalId: wd.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(`Erro ao enviar PIX: ${json.error ?? res.status}`);
      } else {
        await load();
      }
    } catch (e: any) {
      alert(`Erro: ${e?.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (!rejectId) return;
    setActionLoading(rejectId);
    const { error } = await supabase.rpc('admin_reject_affiliate_withdrawal', {
      p_withdrawal_id: rejectId,
      p_notes:         rejectNote.trim() || null,
    });
    setActionLoading(null);
    setRejectId(null);
    setRejectNote('');
    if (error) {
      alert(`Erro: ${error.message}`);
    } else {
      await load();
    }
  }

  const pendingItems = items.filter(i => i.status === 'pending');
  const pendingTotal = pendingItems.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Saques de Afiliados</Text>
          <Text style={styles.pageSubtitle}>Aprovar e enviar via PIX-out OramaPay</Text>
        </View>
        <View style={styles.headerRight}>
          {filter === 'pending' && pendingItems.length > 0 && (
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryLabel}>{pendingItems.length} pendentes</Text>
              <Text style={styles.summaryValue}>{fmt(pendingTotal)}</Text>
            </View>
          )}
          <Pressable
            onPress={load}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filters}>
        {STATUS_OPTS.map(opt => (
          <Pressable
            key={opt.key}
            onPress={() => setFilter(opt.key)}
            style={[styles.chip, filter === opt.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === opt.key && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="account-cash-outline" size={40} color={theme.colors.textFaint} />
              <Text style={styles.emptyText}>Nenhum saque encontrado.</Text>
            </View>
          ) : items.map(wd => {
            const color = STATUS_COLOR[wd.status] ?? theme.colors.textFaint;
            const label = STATUS_LABEL[wd.status] ?? wd.status;
            const isLoading = actionLoading === wd.id;

            return (
              <View key={wd.id} style={styles.card}>
                {/* Top row: name + status + amount */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeft}>
                    <View style={styles.avatarCircle}>
                      <MaterialCommunityIcons name="account-cash-outline" size={18} color={theme.colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.cardName}>{wd.affiliate_name}</Text>
                      <Text style={styles.cardEmail}>{wd.affiliate_email}</Text>
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.cardAmount}>{fmt(wd.amount)}</Text>
                    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
                      <Text style={[styles.badgeText, { color }]}>{label}</Text>
                    </View>
                  </View>
                </View>

                {/* PIX details */}
                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Chave PIX</Text>
                    <Text style={styles.detailValue}>{wd.pix_key}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Tipo</Text>
                    <Text style={styles.detailValue}>{wd.pix_key_type}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Titular</Text>
                    <Text style={styles.detailValue}>{wd.destination_name}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>CPF/CNPJ</Text>
                    <Text style={styles.detailValue}>
                      {wd.destination_doc ? wd.destination_doc : '—'}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Pedido em</Text>
                    <Text style={styles.detailValue}>
                      {new Date(wd.created_at).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  {wd.orama_id && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>OramaPay ID</Text>
                      <Text style={styles.detailValue}>#{wd.orama_id.slice(-8)}</Text>
                    </View>
                  )}
                </View>

                {wd.admin_notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesText}>{wd.admin_notes}</Text>
                  </View>
                ) : null}

                {/* Rollback — TEMPORÁRIO, apenas para testes */}
                {(wd.status === 'paid' || wd.status === 'approved') && (
                  <Pressable
                    style={({ pressed }) => [styles.rollbackBtn, pressed && { opacity: 0.7 }]}
                    onPress={async () => {
                      setActionLoading(wd.id);
                      const { error } = await supabase.rpc('admin_rollback_affiliate_withdrawal', {
                        p_withdrawal_id: wd.id,
                      });
                      setActionLoading(null);
                      if (error) alert(`Erro: ${error.message}`);
                      else await load();
                    }}
                    disabled={isLoading}
                  >
                    {isLoading
                      ? <ActivityIndicator size="small" color="#8B5CF6" />
                      : <>
                          <MaterialCommunityIcons name="undo" size={14} color="#8B5CF6" />
                          <Text style={styles.rollbackBtnText}>Rollback (teste)</Text>
                        </>
                    }
                  </Pressable>
                )}

                {/* Actions — pending: approve + reject | processing: retry */}
                {(wd.status === 'pending' || wd.status === 'processing') && (
                  <View style={styles.actions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn, styles.approveBtn,
                        (pressed || isLoading) && { opacity: 0.75 },
                      ]}
                      onPress={() => handleApprove(wd)}
                      disabled={isLoading}
                    >
                      {isLoading
                        ? <ActivityIndicator size="small" color="#241A00" />
                        : <>
                            <MaterialCommunityIcons
                              name={wd.status === 'processing' ? 'refresh' : 'send'}
                              size={15}
                              color="#241A00"
                            />
                            <Text style={styles.approveBtnText}>
                              {wd.status === 'processing' ? 'Retentar PIX' : 'Aprovar e Enviar PIX'}
                            </Text>
                          </>
                      }
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn, styles.rejectBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => { setRejectId(wd.id); setRejectNote(''); }}
                      disabled={isLoading}
                    >
                      <MaterialCommunityIcons name="close" size={15} color={theme.colors.danger} />
                      <Text style={styles.rejectBtnText}>Recusar</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Reject modal */}
      <Modal visible={!!rejectId} transparent animationType="fade" onRequestClose={() => setRejectId(null)}>
        <Pressable style={styles.overlay} onPress={() => setRejectId(null)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Recusar saque</Text>
            <Text style={styles.modalSub}>
              O saldo será devolvido ao afiliado automaticamente.
            </Text>
            <Text style={styles.fieldLabel}>Motivo (opcional)</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputMulti]}
              value={rejectNote}
              onChangeText={setRejectNote}
              multiline
              numberOfLines={3}
              placeholder="Ex: dados bancários incorretos"
              placeholderTextColor={theme.colors.textFaint}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setRejectId(null)}
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnCancel, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleReject}
                disabled={!!actionLoading}
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnReject, pressed && { opacity: 0.8 }]}
              >
                {actionLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={[styles.modalBtnText, { color: '#fff' }]}>Confirmar recusa</Text>}
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: theme.spacing.xl,
    borderBottomWidth: 1, borderBottomColor: theme.colors.outline,
  },
  pageTitle:    { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 26 },
  pageSubtitle: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13, marginTop: 2 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  summaryBadge: {
    backgroundColor: '#F59E0B22', borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, paddingVertical: 8, alignItems: 'flex-end',
  },
  summaryLabel: { color: '#F59E0B', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryValue: { color: '#F59E0B', fontFamily: theme.typography.fontFamily.display, fontSize: 18 },
  iconBtn: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },

  filters: {
    flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: theme.colors.outline,
  },
  chip:         { paddingHorizontal: theme.spacing.md, paddingVertical: 7, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.outline },
  chipActive:   { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  chipText:     { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  chipTextActive: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyBold },

  list: { padding: theme.spacing.xl, gap: theme.spacing.md, paddingBottom: 60 },
  empty: { alignItems: 'center', gap: theme.spacing.md, marginTop: 80 },
  emptyText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14 },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.outline,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft:   { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, flex: 1 },
  cardRight:  { alignItems: 'flex-end', gap: 4 },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  cardName:   { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 15 },
  cardEmail:  { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 12 },
  cardAmount: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.display, fontSize: 20 },

  badge:     { alignSelf: 'flex-end', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11 },

  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  detailItem: { minWidth: 140, flex: 1 },
  detailLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  detailValue: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13, marginTop: 2 },

  notesBox: {
    backgroundColor: theme.colors.surfaceInset, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, paddingVertical: 8,
  },
  notesText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 12 },

  rollbackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: '#8B5CF6', borderStyle: 'dashed' as any,
  },
  rollbackBtnText: { color: '#8B5CF6', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 12 },

  actions:    { flexDirection: 'row', gap: theme.spacing.sm },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: theme.radius.lg, borderWidth: 1,
  },
  approveBtn:     { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  approveBtnText: { color: '#241A00', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },
  rejectBtn:      { backgroundColor: 'transparent', borderColor: theme.colors.danger },
  rejectBtnText:  { color: theme.colors.danger, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modal: {
    width: 440, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.outline,
    padding: theme.spacing.xl, gap: theme.spacing.sm,
  },
  modalTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 20 },
  modalSub:   { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  fieldLabel: {
    color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4,
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
  modalBtnReject: { backgroundColor: theme.colors.danger },
  modalBtnText:   { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 14 },
});
