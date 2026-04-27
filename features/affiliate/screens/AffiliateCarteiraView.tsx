import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';
import { useAffiliateGuard } from '../hooks/useAffiliateGuard';

type Withdrawal = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type AffiliateSettings = {
  aff_min_withdrawal: number;
  aff_max_withdrawal: number;
  aff_daily_withdrawals: number;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pendente',  color: '#F59E0B' },
  approved: { label: 'Aprovado',  color: '#10B981' },
  rejected: { label: 'Recusado', color: '#EF4444' },
};

const fmt = (n: number) =>
  `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export function AffiliateCarteiraView() {
  const { affiliate, refreshAffiliate } = useAffiliateGuard();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [settings, setSettings]       = useState<AffiliateSettings>({ aff_min_withdrawal: 50, aff_max_withdrawal: 10000, aff_daily_withdrawals: 1 });
  const [loading, setLoading]         = useState(true);
  const [requesting, setRequesting]   = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  useEffect(() => {
    Promise.all([
      supabase.rpc('get_affiliate_withdrawals'),
      supabase.rpc('get_affiliate_settings'),
    ]).then(([wdRes, settingsRes]) => {
      if (wdRes.data) setWithdrawals(wdRes.data as Withdrawal[]);
      if (settingsRes.data) setSettings(settingsRes.data as AffiliateSettings);
      setLoading(false);
    });
  }, []);

  async function handleRequestWithdrawal() {
    if (!affiliate) return;
    const minWd  = Number(settings.aff_min_withdrawal);
    const maxWd  = Number(settings.aff_max_withdrawal);
    const amount = parseFloat(amountInput.replace(',', '.'));

    if (!amountInput || isNaN(amount) || amount <= 0) {
      setError('Informe o valor do saque.');
      return;
    }
    if (amount < minWd) {
      setError(`Valor mínimo para saque é R$ ${minWd.toFixed(2).replace('.', ',')}`);
      return;
    }
    if (amount > maxWd) {
      setError(`Valor máximo para saque é R$ ${maxWd.toFixed(2).replace('.', ',')}`);
      return;
    }
    if (amount > affiliate.balance) {
      setError('Valor maior que o saldo disponível.');
      return;
    }
    if (!affiliate.pix_key) {
      setError('Cadastre uma chave PIX na aba Conta antes de solicitar saque');
      return;
    }
    setError('');
    setSuccess('');
    setRequesting(true);
    const { error: rpcError } = await supabase.rpc('request_affiliate_withdrawal', {
      p_amount: amount,
    });
    setRequesting(false);
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setSuccess('Saque solicitado com sucesso! Nossa equipe processará em até 48h.');
      setAmountInput('');
      refreshAffiliate();
      supabase.rpc('get_affiliate_withdrawals').then(({ data }) => {
        if (data) setWithdrawals(data as Withdrawal[]);
      });
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Text style={styles.breadcrumbText}>Carteira</Text>
        <MaterialCommunityIcons name="chevron-right" size={14} color={theme.colors.textFaint} />
        <Text style={styles.breadcrumbActive}>Saldo & Saques</Text>
      </View>
      <Text style={styles.pageTitle}>Carteira</Text>

      {/* Balance cards */}
      <View style={styles.balanceRow}>
        <View style={[styles.balanceCard, { borderTopColor: theme.colors.primary }]}>
          <View style={styles.balanceCardHeader}>
            <MaterialCommunityIcons name="wallet-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.balanceCardTitle}>Saldo Disponível</Text>
          </View>
          <Text style={styles.balanceCardValue}>
            {affiliate ? fmt(affiliate.balance) : '—'}
          </Text>
          <Text style={styles.balanceCardSub}>Disponível para saque</Text>
        </View>

        <View style={[styles.balanceCard, { borderTopColor: '#10B981' }]}>
          <View style={styles.balanceCardHeader}>
            <MaterialCommunityIcons name="currency-usd" size={16} color="#10B981" />
            <Text style={styles.balanceCardTitle}>Total Ganho</Text>
          </View>
          <Text style={styles.balanceCardValue}>
            {affiliate ? fmt(affiliate.total_earned) : '—'}
          </Text>
          <Text style={styles.balanceCardSub}>Comissões acumuladas</Text>
        </View>

        <View style={[styles.balanceCard, { borderTopColor: '#60A5FA' }]}>
          <View style={styles.balanceCardHeader}>
            <MaterialCommunityIcons name="bank-transfer-out" size={16} color="#60A5FA" />
            <Text style={styles.balanceCardTitle}>Total Sacado</Text>
          </View>
          <Text style={styles.balanceCardValue}>
            {affiliate ? fmt(affiliate.total_withdrawn) : '—'}
          </Text>
          <Text style={styles.balanceCardSub}>Pagamentos realizados</Text>
        </View>
      </View>

      {/* Withdraw action */}
      <View style={styles.actionCard}>
        <Text style={styles.actionCardTitle}>Solicitar Saque</Text>
        <Text style={styles.actionCardBody}>
          Mínimo: R$ {Number(settings.aff_min_withdrawal).toFixed(2).replace('.', ',')} · Máximo: R$ {Number(settings.aff_max_withdrawal).toFixed(2).replace('.', ',')} · Processamento em até 48h via PIX
        </Text>

        <View style={styles.amountRow}>
          <View style={styles.amountInputWrap}>
            <Text style={styles.amountPrefix}>R$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0,00"
              placeholderTextColor={theme.colors.textFaint}
              keyboardType="decimal-pad"
              value={amountInput}
              onChangeText={v => { setAmountInput(v); setError(''); setSuccess(''); }}
            />
          </View>
          <TouchableOpacity
            style={styles.maxBtn}
            onPress={() => {
              setAmountInput(affiliate ? affiliate.balance.toFixed(2).replace('.', ',') : '');
              setError('');
              setSuccess('');
            }}
          >
            <Text style={styles.maxBtnText}>Máximo</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}

        <TouchableOpacity
          style={[styles.withdrawBtn, requesting && { opacity: 0.6 }]}
          onPress={handleRequestWithdrawal}
          disabled={requesting}
        >
          {requesting
            ? <ActivityIndicator size="small" color="#000" />
            : <Text style={styles.withdrawBtnText}>Solicitar saque</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Withdrawal history */}
      <Text style={styles.sectionTitle}>Histórico de Saques</Text>
      <View style={styles.card}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : withdrawals.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="close" size={20} color={theme.colors.textFaint} />
            </View>
            <Text style={styles.emptyText}>Sem saques realizados</Text>
          </View>
        ) : (
          <>
            <View style={[styles.row, styles.rowHeader]}>
              <Text style={[styles.col, styles.colHeader]}>Data</Text>
              <Text style={[styles.col, styles.colHeader]}>Valor</Text>
              <Text style={[styles.col, styles.colHeader]}>Status</Text>
              <Text style={[styles.col, styles.colHeader]}>Processado em</Text>
            </View>
            {withdrawals.map((w, i) => {
              const s = STATUS_LABEL[w.status] ?? { label: w.status, color: theme.colors.textFaint };
              return (
                <View key={w.id} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
                  <Text style={[styles.col, styles.cellDate]}>
                    {new Date(w.created_at).toLocaleDateString('pt-BR')}
                  </Text>
                  <Text style={[styles.col, styles.cellAmount]}>{fmt(w.amount)}</Text>
                  <View style={styles.col}>
                    <View style={[styles.badge, { backgroundColor: s.color + '22' }]}>
                      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
                    </View>
                  </View>
                  <Text style={[styles.col, styles.cellDate]}>
                    {w.status !== 'pending'
                      ? new Date(w.updated_at).toLocaleDateString('pt-BR')
                      : '—'}
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

  balanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  balanceCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderTopWidth: 3,
    padding: theme.spacing.md,
    gap: 4,
  },
  balanceCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceCardTitle: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  balanceCardValue: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 24, marginTop: 2 },
  balanceCardSub: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 11 },

  actionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  actionCardTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 15 },
  actionCardBody: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },

  amountRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    marginTop: 4,
  },
  amountInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceInset,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
  },
  amountPrefix: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 16,
    paddingVertical: 10,
  },
  maxBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  maxBtnText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },

  errorText: { color: '#EF4444', fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  successText: { color: '#10B981', fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },

  withdrawBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  withdrawBtnText: { color: '#241A00', fontFamily: theme.typography.fontFamily.display, fontSize: 14 },

  sectionTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 15 },

  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.outline, overflow: 'hidden' },
  empty: { padding: 48, alignItems: 'center', gap: theme.spacing.sm },
  emptyIcon: { width: 44, height: 44, borderRadius: 999, backgroundColor: theme.colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14 },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: 12 },
  rowHeader: { borderBottomWidth: 1, borderBottomColor: theme.colors.outline },
  rowAlt: { backgroundColor: theme.colors.surfaceInset },
  col: { flex: 1 },
  colHeader: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },

  cellDate: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 12 },
  cellAmount: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },

  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11 },
});
