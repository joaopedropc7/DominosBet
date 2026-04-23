import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useUserData } from '@/hooks/useUserData';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

type PlayerSettings = {
  player_min_withdrawal: number;
  player_max_withdrawal: number;
  player_withdrawal_fee: number;
  player_daily_withdrawals: number;
};

type Withdrawal = {
  id: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  pix_key_type: string;
  pix_key: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

const PIX_TYPES = [
  { label: 'CPF',            value: 'CPF'   },
  { label: 'CNPJ',           value: 'CNPJ'  },
  { label: 'E-mail',         value: 'EMAIL' },
  { label: 'Telefone',       value: 'PHONE' },
  { label: 'Chave aleatória',value: 'EVP'   },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Em análise',  color: '#F59E0B' },
  processing: { label: 'Processando', color: '#60A5FA' },
  paid:       { label: 'Pago',        color: '#10B981' },
  rejected:   { label: 'Recusado',    color: '#EF4444' },
  failed:     { label: 'Falhou',      color: '#EF4444' },
};

function maskCpfCnpj(v: string) {
  const d = v.replace(/\D/g, '');
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }
  return d.replace(/(\d{2})(\d)/, '$1.$2')
          .replace(/(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
          .replace(/(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
          .replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

export function SaqueView() {
  const { profile } = useUserData();

  const [settings,    setSettings]    = useState<PlayerSettings | null>(null);
  const [history,     setHistory]     = useState<Withdrawal[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  // form
  const [amount,     setAmount]     = useState('');
  const [pixType,    setPixType]    = useState('CPF');
  const [pixKey,     setPixKey]     = useState('');
  const [destName,   setDestName]   = useState('');
  const [destDoc,    setDestDoc]    = useState('');
  const [err,        setErr]        = useState('');
  const [success,    setSuccess]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      const [settingsRes, historyRes] = await Promise.all([
        supabase.rpc('get_player_settings'),
        supabase.rpc('get_my_withdrawals'),
      ]);
      if (settingsRes.data) setSettings(settingsRes.data as PlayerSettings);
      if (historyRes.data) setHistory(historyRes.data as Withdrawal[]);

      // Pré-preenche nome do perfil
      if (profile?.display_name) setDestName(profile.display_name);
      if (profile?.cpf)          setDestDoc(maskCpfCnpj(profile.cpf));

      setLoadingInit(false);
    }
    init();
  }, [profile?.display_name, profile?.cpf]);

  const parsedAmount  = parseInt(amount) || 0;
  const feePercent    = settings?.player_withdrawal_fee ?? 0;
  const feeAmount     = Math.floor(parsedAmount * feePercent / 100);
  const netAmount     = parsedAmount - feeAmount;
  const balance       = profile?.balance ?? 0;

  async function handleSubmit() {
    setErr('');
    setSuccess('');
    if (!parsedAmount || parsedAmount <= 0) { setErr('Informe um valor.'); return; }
    if (!pixKey.trim())                      { setErr('Informe a chave PIX.'); return; }
    if (!destName.trim())                    { setErr('Informe o nome do titular.'); return; }
    if (!destDoc.trim())                     { setErr('Informe o CPF/CNPJ do titular.'); return; }

    setSubmitting(true);
    const { error } = await supabase.rpc('request_player_withdrawal', {
      p_amount:       parsedAmount,
      p_pix_key_type: pixType,
      p_pix_key:      pixKey.trim(),
      p_dest_name:    destName.trim(),
      p_dest_doc:     destDoc.replace(/\D/g, ''),
    });
    setSubmitting(false);

    if (error) {
      setErr(error.message);
    } else {
      setSuccess('Saque solicitado! Ficará em análise até a aprovação do administrador.');
      setAmount('');
      setPixKey('');
      // Recarrega histórico
      const { data } = await supabase.rpc('get_my_withdrawals');
      if (data) setHistory(data as Withdrawal[]);
    }
  }

  if (loadingInit) {
    return (
      <Screen withBottomNav={false}>
        <AppHeader compactBrand onRightPress={() => router.push('/(main)/configuracoes')} />
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen withBottomNav={false}>
      <AppHeader compactBrand onRightPress={() => router.push('/(main)/configuracoes')} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View>
          <Text style={styles.title}>Sacar via PIX</Text>
          <Text style={styles.subtitle}>
            Saldo disponível:{' '}
            <Text style={styles.balance}>R$ {balance.toLocaleString('pt-BR')}</Text>
          </Text>
        </View>

        {/* Limites info */}
        {settings && (
          <Card variant="low">
            <View style={styles.limitsRow}>
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>Mínimo</Text>
                <Text style={styles.limitValue}>R$ {settings.player_min_withdrawal}</Text>
              </View>
              <View style={styles.limitDivider} />
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>Máximo</Text>
                <Text style={styles.limitValue}>R$ {settings.player_max_withdrawal.toLocaleString('pt-BR')}</Text>
              </View>
              <View style={styles.limitDivider} />
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>Taxa</Text>
                <Text style={styles.limitValue}>{feePercent}%</Text>
              </View>
              <View style={styles.limitDivider} />
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>Limite/dia</Text>
                <Text style={styles.limitValue}>{settings.player_daily_withdrawals}x</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Formulário */}
        <Card variant="low">
          {/* Valor */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Valor (R$)</Text>
            <View style={styles.amountRow}>
              <Text style={styles.amountPrefix}>R$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(v) => { setAmount(v.replace(/\D/g, '')); setErr(''); }}
                placeholder="0"
                placeholderTextColor={theme.colors.textFaint}
                keyboardType="number-pad"
              />
            </View>
            {parsedAmount > 0 && feePercent > 0 && (
              <Text style={styles.netAmountHint}>
                Você receberá R$ {netAmount.toLocaleString('pt-BR')} após taxa de {feePercent}%
              </Text>
            )}
          </View>

          {/* Tipo de chave PIX */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Tipo de chave PIX</Text>
            <View style={styles.typeRow}>
              {PIX_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  onPress={() => { setPixType(t.value); setPixKey(''); setErr(''); }}
                  style={[styles.typeChip, pixType === t.value && styles.typeChipActive]}
                >
                  <Text style={[styles.typeChipText, pixType === t.value && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Chave PIX */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Chave PIX</Text>
            <TextInput
              style={styles.input}
              value={pixKey}
              onChangeText={(v) => { setPixKey(v); setErr(''); }}
              placeholder={
                pixType === 'CPF'   ? '000.000.000-00' :
                pixType === 'CNPJ'  ? '00.000.000/0000-00' :
                pixType === 'EMAIL' ? 'email@exemplo.com' :
                pixType === 'PHONE' ? '(11) 99999-9999' :
                'Chave aleatória (UUID)'
              }
              placeholderTextColor={theme.colors.textFaint}
              autoCapitalize="none"
              keyboardType={pixType === 'EMAIL' ? 'email-address' : pixType === 'PHONE' ? 'phone-pad' : 'default'}
            />
          </View>

          {/* Nome do titular */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nome do titular da conta</Text>
            <TextInput
              style={styles.input}
              value={destName}
              onChangeText={(v) => { setDestName(v); setErr(''); }}
              placeholder="Nome completo"
              placeholderTextColor={theme.colors.textFaint}
            />
          </View>

          {/* CPF/CNPJ do titular */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>CPF / CNPJ do titular</Text>
            <TextInput
              style={styles.input}
              value={destDoc}
              onChangeText={(v) => { setDestDoc(maskCpfCnpj(v)); setErr(''); }}
              placeholder="000.000.000-00"
              placeholderTextColor={theme.colors.textFaint}
              keyboardType="number-pad"
              maxLength={18}
            />
          </View>
        </Card>

        {err     ? <Text style={styles.errorText}>{err}</Text>     : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}

        <Button
          title={submitting ? 'Solicitando...' : 'Solicitar saque'}
          onPress={handleSubmit}
          disabled={submitting || !amount || !pixKey}
          icon={
            submitting
              ? <ActivityIndicator size="small" color="#241A00" />
              : <MaterialCommunityIcons name="bank-transfer-out" size={20} color="#241A00" />
          }
        />

        {/* Histórico de saques */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Histórico de saques</Text>
            {history.map((w) => {
              const st = STATUS_LABEL[w.status] ?? { label: w.status, color: theme.colors.textFaint };
              return (
                <Card key={w.id} variant="low">
                  <View style={styles.historyRow}>
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyAmount}>R$ {w.amount.toLocaleString('pt-BR')}</Text>
                      <Text style={styles.historyKey}>{w.pix_key_type} · {w.pix_key}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(w.created_at).toLocaleDateString('pt-BR')}
                      </Text>
                    </View>
                    <View style={styles.historyRight}>
                      <View style={[styles.statusBadge, { backgroundColor: st.color + '22' }]}>
                        <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                      </View>
                      {w.admin_notes ? (
                        <Text style={styles.historyNote}>{w.admin_notes}</Text>
                      ) : null}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  title: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 28 },
  subtitle: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13, marginTop: 4 },
  balance: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyBold },

  limitsRow: { flexDirection: 'row', alignItems: 'center' },
  limitItem: { flex: 1, alignItems: 'center', gap: 2 },
  limitDivider: { width: 1, height: 28, backgroundColor: theme.colors.outline },
  limitLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  limitValue: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },

  field: { gap: 6 },
  fieldLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountPrefix: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.displayMedium, fontSize: 24 },
  amountInput: {
    flex: 1, color: theme.colors.primary, fontFamily: theme.typography.fontFamily.display,
    fontSize: 40, padding: 0, outlineStyle: 'none',
  } as any,
  netAmountHint: { color: theme.colors.accent, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  typeChip: {
    paddingHorizontal: theme.spacing.sm, paddingVertical: 6,
    borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.outline,
    backgroundColor: theme.colors.surface,
  },
  typeChipActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  typeChipText: { color: theme.colors.textMuted, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  typeChipTextActive: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodySemiBold },

  input: {
    backgroundColor: theme.colors.surfaceHigh, borderWidth: 1, borderColor: theme.colors.outline,
    borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: 11,
    color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14,
    outlineStyle: 'none',
  } as any,

  errorText:   { color: '#EF4444', fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13, textAlign: 'center' },
  successText: { color: '#10B981', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  historySection: { gap: theme.spacing.sm },
  historyTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 15 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.md },
  historyLeft: { flex: 1, gap: 2 },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyAmount: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 15 },
  historyKey: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  historyDate: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 11 },
  historyNote: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 11, maxWidth: 140, textAlign: 'right' },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  statusText: { fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11 },
});
