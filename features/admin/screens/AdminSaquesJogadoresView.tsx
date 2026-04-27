import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

type Withdrawal = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  pix_key_type: string;
  pix_key: string;
  destination_name: string;
  destination_doc: string;
  status: string;
  external_ref: string;
  orama_id: string | null;
  admin_notes: string | null;
  created_at: string;
};

type StatusFilter = 'all' | 'pending' | 'processing' | 'paid' | 'rejected';

const STATUS_OPTS: { key: StatusFilter; label: string }[] = [
  { key: 'all',        label: 'Todos'       },
  { key: 'pending',    label: 'Em análise'  },
  { key: 'processing', label: 'Processando' },
  { key: 'paid',       label: 'Pagos'       },
  { key: 'rejected',   label: 'Recusados'   },
];

const STATUS_COLOR: Record<string, string> = {
  pending:    '#F59E0B',
  processing: '#60A5FA',
  paid:       '#10B981',
  rejected:   '#EF4444',
  failed:     '#EF4444',
};

const STATUS_LABEL: Record<string, string> = {
  pending:    'Em análise',
  processing: 'Processando',
  paid:       'Pago',
  rejected:   'Recusado',
  failed:     'Falhou',
};

export function AdminSaquesJogadoresView() {
  const [items,        setItems]        = useState<Withdrawal[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState<StatusFilter>('pending');
  const [actionLoading,setActionLoading]= useState<string | null>(null);

  // Modal de rejeição
  const [rejectId,     setRejectId]     = useState<string | null>(null);
  const [rejectNote,   setRejectNote]   = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('admin_list_player_withdrawals', {
      p_status: filter === 'all' ? null : filter,
    });
    if (data) setItems(data as Withdrawal[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function handleApprove(wd: Withdrawal) {
    setActionLoading(wd.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/pix-out', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ withdrawalId: wd.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert('Erro ao aprovar: ' + (json.error ?? res.status));
      } else {
        await load();
      }
    } catch (e: any) {
      alert('Erro: ' + e?.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (!rejectId) return;
    setActionLoading(rejectId);
    const { error } = await supabase.rpc('admin_reject_withdrawal', {
      p_withdrawal_id: rejectId,
      p_notes:         rejectNote.trim(),
    });
    setActionLoading(null);
    setRejectId(null);
    setRejectNote('');
    if (error) { alert('Erro: ' + error.message); return; }
    await load();
  }

  const pending  = items.filter(w => w.status === 'pending').length;
  const totalPending = items.reduce((s, w) => w.status === 'pending' ? s + w.amount : s, 0);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Saques de Jogadores</Text>
          <Text style={styles.pageSubtitle}>Aprove ou rejeite solicitações de saque</Text>
        </View>
        <Pressable
          onPress={load}
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.primary} />
        </Pressable>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Em análise</Text>
          <Text style={styles.summaryValue}>{pending}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Volume pendente</Text>
          <Text style={styles.summaryValue}>R$ {totalPending.toLocaleString('pt-BR')}</Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filterRow}>
        {STATUS_OPTS.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => setFilter(o.key)}
            style={[styles.filterChip, filter === o.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === o.key && styles.filterTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Lista */}
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="check-all" size={32} color={theme.colors.textFaint} />
          <Text style={styles.emptyText}>Nenhum saque neste filtro</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((wd) => {
            const color = STATUS_COLOR[wd.status] ?? theme.colors.textFaint;
            const label = STATUS_LABEL[wd.status]  ?? wd.status;
            const isActing = actionLoading === wd.id;

            return (
              <View key={wd.id} style={styles.card}>
                {/* Top row */}
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardName}>{wd.user_name}</Text>
                    <Text style={styles.cardEmail}>{wd.user_email}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: color + '22' }]}>
                    <Text style={[styles.statusText, { color }]}>{label}</Text>
                  </View>
                </View>

                {/* Amounts */}
                <View style={styles.amountsRow}>
                  <View style={styles.amountItem}>
                    <Text style={styles.amountLabel}>Solicitado</Text>
                    <Text style={styles.amountValue}>R$ {wd.amount.toLocaleString('pt-BR')}</Text>
                  </View>
                  {wd.fee_amount > 0 && (
                    <View style={styles.amountItem}>
                      <Text style={styles.amountLabel}>Taxa</Text>
                      <Text style={[styles.amountValue, { color: '#EF4444' }]}>
                        − R$ {wd.fee_amount.toLocaleString('pt-BR')}
                      </Text>
                    </View>
                  )}
                  <View style={styles.amountItem}>
                    <Text style={styles.amountLabel}>Líquido (enviar)</Text>
                    <Text style={[styles.amountValue, { color: '#10B981' }]}>
                      R$ {wd.net_amount.toLocaleString('pt-BR')}
                    </Text>
                  </View>
                </View>

                {/* PIX info */}
                <View style={styles.pixRow}>
                  <MaterialCommunityIcons name="bank-outline" size={14} color={theme.colors.textFaint} />
                  <Text style={styles.pixText}>
                    {wd.pix_key_type} · {wd.pix_key}
                  </Text>
                </View>
                <View style={styles.pixRow}>
                  <MaterialCommunityIcons name="account-outline" size={14} color={theme.colors.textFaint} />
                  <Text style={styles.pixText}>
                    {wd.destination_name} · {wd.destination_doc}
                  </Text>
                </View>

                <Text style={styles.cardDate}>
                  Solicitado em {new Date(wd.created_at).toLocaleString('pt-BR')}
                </Text>

                {wd.admin_notes ? (
                  <Text style={styles.cardNote}>Obs: {wd.admin_notes}</Text>
                ) : null}

                {/* Rollback — TEMPORÁRIO, apenas para testes */}
                {wd.status === 'paid' && (
                  <Pressable
                    onPress={async () => {
                      setActionLoading(wd.id);
                      const { error } = await supabase.rpc('admin_rollback_player_withdrawal', {
                        p_withdrawal_id: wd.id,
                      });
                      setActionLoading(null);
                      if (error) alert(`Erro: ${error.message}`);
                      else await load();
                    }}
                    disabled={isActing}
                    style={({ pressed }) => [styles.rollbackBtn, pressed && { opacity: 0.7 }]}
                  >
                    {isActing
                      ? <ActivityIndicator size="small" color="#8B5CF6" />
                      : <>
                          <MaterialCommunityIcons name="undo" size={14} color="#8B5CF6" />
                          <Text style={styles.rollbackBtnText}>Rollback (teste)</Text>
                        </>
                    }
                  </Pressable>
                )}

                {/* Actions — pending: approve | processing: retry */}
                {(wd.status === 'pending' || wd.status === 'processing') && (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => handleApprove(wd)}
                      disabled={isActing}
                      style={({ pressed }) => [
                        styles.actionBtn, styles.approveBtn,
                        (isActing || pressed) && { opacity: 0.7 },
                      ]}
                    >
                      {isActing
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <>
                            <MaterialCommunityIcons
                              name={wd.status === 'processing' ? 'refresh' : 'check'}
                              size={16}
                              color="#fff"
                            />
                            <Text style={styles.approveBtnText}>
                              {wd.status === 'processing' ? 'Retentar PIX' : 'Aprovar e Enviar PIX'}
                            </Text>
                          </>
                      }
                    </Pressable>
                    <Pressable
                      onPress={() => { setRejectId(wd.id); setRejectNote(''); }}
                      disabled={isActing}
                      style={({ pressed }) => [
                        styles.actionBtn, styles.rejectBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <MaterialCommunityIcons name="close" size={16} color="#EF4444" />
                      <Text style={styles.rejectBtnText}>Recusar</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Modal de rejeição */}
      <Modal visible={!!rejectId} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Recusar saque</Text>
            <Text style={styles.modalDesc}>
              O valor será devolvido ao jogador automaticamente.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={rejectNote}
              onChangeText={setRejectNote}
              placeholder="Motivo (opcional)"
              placeholderTextColor={theme.colors.textFaint}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setRejectId(null)}
                style={[styles.actionBtn, styles.rejectBtn, { flex: 1 }]}
              >
                <Text style={styles.rejectBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleReject}
                disabled={!!actionLoading}
                style={[styles.actionBtn, { flex: 1, backgroundColor: '#EF4444', justifyContent: 'center' }]}
              >
                {actionLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[styles.approveBtnText]}>Confirmar recusa</Text>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: theme.spacing.xl, gap: theme.spacing.lg },

  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: theme.colors.outline, paddingBottom: theme.spacing.lg,
  },
  pageTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 26 },
  pageSubtitle: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13, marginTop: 2 },
  refreshBtn: {
    width: 38, height: 38, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceHigh, alignItems: 'center', justifyContent: 'center',
  },

  summaryRow: { flexDirection: 'row', gap: theme.spacing.md },
  summaryCard: {
    flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.outline, padding: theme.spacing.md, gap: 4,
  },
  summaryLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  summaryValue: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 22 },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  filterChip: {
    paddingHorizontal: theme.spacing.sm, paddingVertical: 6,
    borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.outline,
  },
  filterChipActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  filterText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  filterTextActive: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodySemiBold },

  empty: { alignItems: 'center', gap: theme.spacing.sm, paddingVertical: 48 },
  emptyText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14 },

  list: { gap: theme.spacing.md },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.outline,
    padding: theme.spacing.lg, gap: theme.spacing.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { gap: 2 },
  cardName: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 14 },
  cardEmail: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  statusText: { fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11 },

  amountsRow: { flexDirection: 'row', gap: theme.spacing.lg, flexWrap: 'wrap' },
  amountItem: { gap: 2 },
  amountLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  amountValue: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 16 },

  pixRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pixText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  cardDate: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 11 },
  cardNote: { color: '#F59E0B', fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },

  actions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  approveBtn: { flex: 1, backgroundColor: '#10B981' },
  approveBtnText: { color: '#fff', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },
  rejectBtn: { borderWidth: 1, borderColor: '#EF4444', paddingHorizontal: theme.spacing.lg },
  rejectBtnText: { color: '#EF4444', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },
  rollbackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: '#8B5CF6', borderStyle: 'dashed' as any,
  },
  rollbackBtnText: { color: '#8B5CF6', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 12 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl,
  },
  modalBox: {
    width: '100%', maxWidth: 400, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl, padding: theme.spacing.xl,
    gap: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.outline,
  },
  modalTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 22 },
  modalDesc: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  modalInput: {
    backgroundColor: theme.colors.surfaceHigh, borderWidth: 1, borderColor: theme.colors.outline,
    borderRadius: theme.radius.md, padding: theme.spacing.md,
    color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13,
    minHeight: 72, textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: theme.spacing.sm },
});
