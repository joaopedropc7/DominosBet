import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

// ─── types ───────────────────────────────────────────────────
type SiteSettings = {
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  aff_cpa: number;
  aff_baseline: number;
  aff_chance_cpa: number;
  aff_revshare: number;
  aff_revshare_fake: number;
  aff_min_withdrawal: number;
  aff_max_withdrawal: number;
  aff_daily_withdrawals: number;
  aff_withdrawal_fee: number;
  player_min_deposit: number;
  player_min_withdrawal: number;
  player_rollover: number;
  player_max_withdrawal: number;
  player_withdrawal_fee: number;
  player_first_deposit_bonus: number;
  player_daily_withdrawals: number;
};

type Tab = 'seo' | 'afiliados' | 'financeiro';

// ─── sub-components ───────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, hint, multiline, suffix,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  suffix?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={[styles.input, multiline && styles.inputMulti]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textFaint}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.sectionTitle}>
      <MaterialCommunityIcons name={icon as any} size={15} color={theme.colors.primary} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}

// ─── main component ───────────────────────────────────────────
export function AdminConfiguracoesView() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [tab,     setTab]     = useState<Tab>('seo');

  // SEO
  const [seoTitle, setSeoTitle]           = useState('');
  const [seoDesc,  setSeoDesc]            = useState('');
  const [seoKeys,  setSeoKeys]            = useState('');

  // Afiliados › Registro
  const [affCpa,          setAffCpa]          = useState('');
  const [affBaseline,     setAffBaseline]     = useState('');
  const [affChanceCpa,    setAffChanceCpa]    = useState('');
  const [affRevshare,     setAffRevshare]     = useState('');
  const [affRevshareFake, setAffRevshareFake] = useState('');

  // Afiliados › Financeiro
  const [affMinWithdrawal,    setAffMinWithdrawal]    = useState('');
  const [affMaxWithdrawal,    setAffMaxWithdrawal]    = useState('');
  const [affDailyWithdrawals, setAffDailyWithdrawals] = useState('');
  const [affWithdrawalFee,    setAffWithdrawalFee]    = useState('');

  // Financeiro jogadores
  const [playerMinDeposit,       setPlayerMinDeposit]       = useState('');
  const [playerMinWithdrawal,    setPlayerMinWithdrawal]    = useState('');
  const [playerRollover,         setPlayerRollover]         = useState('');
  const [playerMaxWithdrawal,    setPlayerMaxWithdrawal]    = useState('');
  const [playerWithdrawalFee,    setPlayerWithdrawalFee]    = useState('');
  const [playerFirstDepBonus,    setPlayerFirstDepBonus]    = useState('');
  const [playerDailyWithdrawals, setPlayerDailyWithdrawals] = useState('');

  useEffect(() => {
    supabase.rpc('admin_get_site_settings').then(({ data, error: rpcErr }) => {
      if (rpcErr) { setError(rpcErr.message); }
      else if (data) {
        const s = data as SiteSettings;
        setSeoTitle(s.seo_title ?? '');
        setSeoDesc(s.seo_description ?? '');
        setSeoKeys(s.seo_keywords ?? '');
        setAffCpa(String(s.aff_cpa ?? '5'));
        setAffBaseline(String(s.aff_baseline ?? '0'));
        setAffChanceCpa(String(s.aff_chance_cpa ?? '100'));
        setAffRevshare(String(s.aff_revshare ?? '40'));
        setAffRevshareFake(String(s.aff_revshare_fake ?? '0'));
        setAffMinWithdrawal(String(s.aff_min_withdrawal ?? '50'));
        setAffMaxWithdrawal(String(s.aff_max_withdrawal ?? '10000'));
        setAffDailyWithdrawals(String(s.aff_daily_withdrawals ?? '1'));
        setAffWithdrawalFee(String(s.aff_withdrawal_fee ?? '0'));
        setPlayerMinDeposit(String(s.player_min_deposit ?? '1'));
        setPlayerMinWithdrawal(String(s.player_min_withdrawal ?? '20'));
        setPlayerRollover(String(s.player_rollover ?? '1'));
        setPlayerMaxWithdrawal(String(s.player_max_withdrawal ?? '5000'));
        setPlayerWithdrawalFee(String(s.player_withdrawal_fee ?? '0'));
        setPlayerFirstDepBonus(String(s.player_first_deposit_bonus ?? '0'));
        setPlayerDailyWithdrawals(String(s.player_daily_withdrawals ?? '3'));
      }
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setError('');
    setSuccess('');
    setSaving(true);

    // n(): converte string para número; retorna null se inválido
    // null faz o COALESCE no banco preservar o valor antigo
    const n  = (s: string) => { const v = parseFloat(s); return isNaN(v) ? null : v; };
    const ni = (s: string) => { const v = parseInt(s);   return isNaN(v) ? null : v; };

    const { error: rpcErr } = await supabase.rpc('admin_update_site_settings', {
      p_seo_title:                  seoTitle.trim()    || null,
      p_seo_description:            seoDesc.trim()     || null,
      p_seo_keywords:               seoKeys.trim()     || null,
      p_aff_cpa:                    n(affCpa),
      p_aff_baseline:               n(affBaseline),
      p_aff_chance_cpa:             ni(affChanceCpa),
      p_aff_revshare:               ni(affRevshare),
      p_aff_revshare_fake:          ni(affRevshareFake),
      p_aff_min_withdrawal:         n(affMinWithdrawal),
      p_aff_max_withdrawal:         n(affMaxWithdrawal),
      p_aff_daily_withdrawals:      ni(affDailyWithdrawals),
      p_aff_withdrawal_fee:         n(affWithdrawalFee),
      p_player_min_deposit:         n(playerMinDeposit),
      p_player_min_withdrawal:      n(playerMinWithdrawal),
      p_player_rollover:            ni(playerRollover),
      p_player_max_withdrawal:      n(playerMaxWithdrawal),
      p_player_withdrawal_fee:      n(playerWithdrawalFee),
      p_player_first_deposit_bonus: ni(playerFirstDepBonus),
      p_player_daily_withdrawals:   ni(playerDailyWithdrawals),
    });

    setSaving(false);
    if (rpcErr) {
      setError(rpcErr.message);
    } else {
      setSuccess('Configurações salvas com sucesso!');
      // Recarrega os valores salvos para confirmar que persistiram
      const { data } = await supabase.rpc('admin_get_site_settings');
      if (data) {
        const s = data as SiteSettings;
        setAffCpa(String(s.aff_cpa));
        setAffBaseline(String(s.aff_baseline));
        setAffChanceCpa(String(s.aff_chance_cpa));
        setAffRevshare(String(s.aff_revshare));
        setAffRevshareFake(String(s.aff_revshare_fake));
        setAffMinWithdrawal(String(s.aff_min_withdrawal));
        setAffMaxWithdrawal(String(s.aff_max_withdrawal));
        setAffDailyWithdrawals(String(s.aff_daily_withdrawals));
        setAffWithdrawalFee(String(s.aff_withdrawal_fee ?? '0'));
        setPlayerMinDeposit(String(s.player_min_deposit));
        setPlayerMinWithdrawal(String(s.player_min_withdrawal));
        setPlayerRollover(String(s.player_rollover));
        setPlayerMaxWithdrawal(String(s.player_max_withdrawal));
        setPlayerWithdrawalFee(String(s.player_withdrawal_fee));
        setPlayerFirstDepBonus(String(s.player_first_deposit_bonus));
        setPlayerDailyWithdrawals(String(s.player_daily_withdrawals));
        setSeoTitle(s.seo_title ?? '');
        setSeoDesc(s.seo_description ?? '');
        setSeoKeys(s.seo_keywords ?? '');
      }
    }
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'seo',        label: 'SEO',        icon: 'magnify'               },
    { key: 'afiliados',  label: 'Afiliados',  icon: 'account-network-outline' },
    { key: 'financeiro', label: 'Financeiro', icon: 'cash-multiple'         },
  ];

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Configurações</Text>
          <Text style={styles.pageSubtitle}>SEO, afiliados e regras financeiras da plataforma</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <>
          {/* Tab bar */}
          <View style={styles.tabBar}>
            {TABS.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
              >
                <MaterialCommunityIcons
                  name={t.icon as any}
                  size={16}
                  color={tab === t.key ? theme.colors.primary : theme.colors.textFaint}
                />
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.body}>
            {/* ── SEO ─────────────────────────────────── */}
            {tab === 'seo' && (
              <View style={styles.card}>
                <SectionTitle icon="web" title="Otimização para motores de busca" />
                <Field
                  label="Título do site"
                  value={seoTitle}
                  onChangeText={setSeoTitle}
                  placeholder="DominosBet — Jogue e Ganhe"
                  hint="Aparece na aba do navegador e nos resultados de busca (recomendado: até 60 caracteres)"
                />
                <Field
                  label="Descrição do site"
                  value={seoDesc}
                  onChangeText={setSeoDesc}
                  placeholder="A melhor plataforma de dominó online do Brasil."
                  hint="Exibida nos snippets de busca (recomendado: até 160 caracteres)"
                  multiline
                />
                <Field
                  label="Keywords"
                  value={seoKeys}
                  onChangeText={setSeoKeys}
                  placeholder="dominó, apostas, jogo online, pix"
                  hint="Palavras-chave separadas por vírgula"
                />
              </View>
            )}

            {/* ── AFILIADOS ────────────────────────────── */}
            {tab === 'afiliados' && (
              <>
                {/* Registro */}
                <View style={styles.card}>
                  <SectionTitle icon="account-plus-outline" title="Registro" />
                  <View style={styles.row2}>
                    <Field
                      label="CPA (R$)"
                      value={affCpa}
                      onChangeText={setAffCpa}
                      placeholder="5.00"
                      hint="Valor pago ao afiliado por cada FTD"
                      suffix="R$"
                    />
                    <Field
                      label="Baseline (R$)"
                      value={affBaseline}
                      onChangeText={setAffBaseline}
                      placeholder="0.00"
                      hint="Depósito mínimo do indicado para liberar CPA"
                      suffix="R$"
                    />
                  </View>
                  <View style={styles.row2}>
                    <Field
                      label="Chance CPA (%)"
                      value={affChanceCpa}
                      onChangeText={setAffChanceCpa}
                      placeholder="100"
                      hint="% de probabilidade de o CPA ser pago"
                      suffix="%"
                    />
                    <Field
                      label="Revenue Share (%)"
                      value={affRevshare}
                      onChangeText={setAffRevshare}
                      placeholder="40"
                      hint="% das perdas do jogador repassado ao afiliado"
                      suffix="%"
                    />
                  </View>
                  <Field
                    label="Revenue Share Fake (%)"
                    value={affRevshareFake}
                    onChangeText={setAffRevshareFake}
                    placeholder="0"
                    hint="% exibido no painel do afiliado (pode diferir do real)"
                    suffix="%"
                  />
                </View>

                {/* Configuração Financeira */}
                <View style={styles.card}>
                  <SectionTitle icon="bank-outline" title="Configuração financeira" />
                  <View style={styles.row2}>
                    <Field
                      label="Saque mínimo (R$)"
                      value={affMinWithdrawal}
                      onChangeText={setAffMinWithdrawal}
                      placeholder="50.00"
                      suffix="R$"
                    />
                    <Field
                      label="Saque máximo (R$)"
                      value={affMaxWithdrawal}
                      onChangeText={setAffMaxWithdrawal}
                      placeholder="10000.00"
                      suffix="R$"
                    />
                  </View>
                  <View style={styles.row2}>
                    <Field
                      label="Taxa de saque (%)"
                      value={affWithdrawalFee}
                      onChangeText={setAffWithdrawalFee}
                      placeholder="0"
                      hint="Percentual descontado no saque do afiliado"
                      suffix="%"
                    />
                    <Field
                      label="Saques diários (qtd)"
                      value={affDailyWithdrawals}
                      onChangeText={setAffDailyWithdrawals}
                      placeholder="1"
                      hint="Número máximo de saques por dia por afiliado"
                    />
                  </View>
                </View>
              </>
            )}

            {/* ── FINANCEIRO ───────────────────────────── */}
            {tab === 'financeiro' && (
              <View style={styles.card}>
                <SectionTitle icon="cash-multiple" title="Configurações para jogadores" />
                <View style={styles.row2}>
                  <Field
                    label="Depósito mínimo (R$)"
                    value={playerMinDeposit}
                    onChangeText={setPlayerMinDeposit}
                    placeholder="1.00"
                    suffix="R$"
                  />
                  <Field
                    label="Saque mínimo (R$)"
                    value={playerMinWithdrawal}
                    onChangeText={setPlayerMinWithdrawal}
                    placeholder="20.00"
                    suffix="R$"
                  />
                </View>
                <View style={styles.row2}>
                  <Field
                    label="Saque máximo (R$)"
                    value={playerMaxWithdrawal}
                    onChangeText={setPlayerMaxWithdrawal}
                    placeholder="5000.00"
                    suffix="R$"
                  />
                  <Field
                    label="Rollover (multiplicador)"
                    value={playerRollover}
                    onChangeText={setPlayerRollover}
                    placeholder="1"
                    hint="Quantas vezes o depósito deve ser apostado"
                    suffix="×"
                  />
                </View>
                <View style={styles.row2}>
                  <Field
                    label="Taxa de saque (%)"
                    value={playerWithdrawalFee}
                    onChangeText={setPlayerWithdrawalFee}
                    placeholder="0"
                    suffix="%"
                  />
                  <Field
                    label="Bônus 1º depósito (%)"
                    value={playerFirstDepBonus}
                    onChangeText={setPlayerFirstDepBonus}
                    placeholder="0"
                    hint="% de bônus creditado no primeiro depósito"
                    suffix="%"
                  />
                </View>
                <Field
                  label="Saques diários (quantidade)"
                  value={playerDailyWithdrawals}
                  onChangeText={setPlayerDailyWithdrawals}
                  placeholder="3"
                  hint="Número máximo de saques por dia por jogador"
                />
              </View>
            )}

            {/* Feedback */}
            {error   ? <Text style={styles.errorText}>{error}</Text>   : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}

            {/* Save */}
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }, saving && { opacity: 0.6 }]}
            >
              {saving
                ? <ActivityIndicator color="#241A00" />
                : <>
                    <MaterialCommunityIcons name="content-save-outline" size={18} color="#241A00" />
                    <Text style={styles.saveBtnText}>Salvar configurações</Text>
                  </>
              }
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: theme.spacing.xl, gap: theme.spacing.lg },

  pageHeader: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    paddingBottom: theme.spacing.lg,
  },
  pageTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 26,
  },
  pageSubtitle: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
    marginTop: 2,
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceInset,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: theme.radius.md,
  },
  tabItemActive: {
    backgroundColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  tabText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  tabTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodySemiBold,
  },

  body: { gap: theme.spacing.lg },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },

  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    marginBottom: 4,
  },
  sectionTitleText: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
  },

  row2: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },

  field: { gap: 6, flex: 1 },
  fieldLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHigh,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.radius.md,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 11,
    outlineStyle: 'none',
  } as any,
  inputMulti: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 11,
  },
  suffix: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 12,
    paddingRight: theme.spacing.sm,
  },
  fieldHint: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 11,
  },

  errorText:   { color: '#EF4444', fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  successText: { color: '#10B981', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
  },
  saveBtnText: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 15,
  },
});
