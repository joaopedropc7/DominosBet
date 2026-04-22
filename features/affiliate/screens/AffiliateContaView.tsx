import { useState } from 'react';
import { ActivityIndicator, Clipboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';
import { useAffiliateGuard } from '../hooks/useAffiliateGuard';

const PIX_TYPES = ['CPF', 'CNPJ', 'E-mail', 'Telefone', 'Chave aleatória'];

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.readonlyInput}>
        <Text style={styles.readonlyText}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const SITE = 'https://dominosbet.com.br';

export function AffiliateContaView() {
  const { affiliate, refreshAffiliate } = useAffiliateGuard();

  const [pixType, setPixType]         = useState('');
  const [pixKey, setPixKey]           = useState('');
  const [savingPix, setSavingPix]     = useState(false);
  const [pixMsg, setPixMsg]           = useState('');
  const [pixTypeOpen, setPixTypeOpen] = useState(false);
  const [codeCopied, setCodeCopied]   = useState(false);

  if (!affiliate) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  function handleCopyCode() {
    if (!affiliate?.own_code) return;
    Clipboard.setString(`${SITE}/cadastro?ref=${affiliate.own_code}`);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function handleSavePix() {
    if (!pixType) { setPixMsg('Selecione o tipo de chave'); return; }
    if (!pixKey.trim()) { setPixMsg('Informe a chave PIX'); return; }
    setPixMsg('');
    setSavingPix(true);
    const { error } = await supabase.rpc('update_affiliate_pix', {
      p_pix_key_type: pixType,
      p_pix_key:      pixKey.trim(),
    });
    setSavingPix(false);
    if (error) {
      setPixMsg(error.message);
    } else {
      setPixMsg('Chave PIX salva com sucesso!');
      refreshAffiliate();
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Text style={styles.breadcrumbText}>Conta</Text>
        <MaterialCommunityIcons name="chevron-right" size={14} color={theme.colors.textFaint} />
        <Text style={styles.breadcrumbActive}>Configurações</Text>
      </View>
      <Text style={styles.pageTitle}>Conta</Text>

      {/* ── Detalhes da conta ────────────────────────────────── */}
      <View style={styles.card}>
        <SectionHeader title="Detalhes da Conta" />
        <View style={styles.cardBody}>
          <ReadonlyField label="Nome" value={affiliate.name} />
          <ReadonlyField label="E-mail" value={affiliate.email} />
          <ReadonlyField label="Telefone" value={affiliate.phone} />
          <ReadonlyField label="CPF" value={affiliate.cpf} />
        </View>
      </View>

      {/* ── Acordo ───────────────────────────────────────────── */}
      <View style={styles.card}>
        <SectionHeader title="Acordo de Comissões" />
        <View style={styles.cardBody}>
          <View style={styles.dealGrid}>
            <View style={styles.dealItem}>
              <Text style={styles.dealValue}>{affiliate.revshare_percent}%</Text>
              <Text style={styles.dealLabel}>RevShare</Text>
            </View>
            <View style={styles.dealDivider} />
            <View style={styles.dealItem}>
              <Text style={styles.dealValue}>
                R$ {(affiliate.cpa_amount ?? 0).toFixed(2).replace('.', ',')}
              </Text>
              <Text style={styles.dealLabel}>CPA por FTD</Text>
            </View>
            <View style={styles.dealDivider} />
            <View style={styles.dealItem}>
              <Text style={styles.dealValue}>{affiliate.sub_affiliate_percent}%</Text>
              <Text style={styles.dealLabel}>Sub-Afiliado</Text>
            </View>
          </View>
          <Text style={styles.dealNote}>
            Esses valores são definidos pela administração e não podem ser alterados aqui.
          </Text>
        </View>
      </View>

      {/* ── Código de Indicação ──────────────────────────────── */}
      <View style={styles.card}>
        <SectionHeader title="Código de Indicação" />
        <View style={styles.cardBody}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Seu código único</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeValue}>{affiliate.own_code ?? '—'}</Text>
              <TouchableOpacity onPress={handleCopyCode} style={styles.codeCopyBtn}>
                <MaterialCommunityIcons
                  name={codeCopied ? 'check' : 'content-copy'}
                  size={16}
                  color={codeCopied ? '#10B981' : theme.colors.textMuted}
                />
                <Text style={[styles.codeCopyText, codeCopied && { color: '#10B981' }]}>
                  {codeCopied ? 'Copiado!' : 'Copiar link'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.codeHint}>
              {affiliate.own_code
                ? `dominosbet.com.br/cadastro?ref=${affiliate.own_code}`
                : 'Código gerado automaticamente no cadastro'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Método de Recebimento (PIX) ──────────────────────── */}
      <View style={styles.card}>
        <SectionHeader title="Método de Recebimento" />
        <View style={styles.cardBody}>
          <ReadonlyField label="Tipo Atual" value={affiliate.pix_key_type ?? '(não cadastrado)'} />
          <ReadonlyField label="Chave PIX Atual" value={affiliate.pix_key ?? '(não cadastrado)'} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Tipo de Chave</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setPixTypeOpen(v => !v)}
            >
              <Text style={pixType ? styles.dropdownValue : styles.dropdownPlaceholder}>
                {pixType || 'Selecionar…'}
              </Text>
              <MaterialCommunityIcons
                name={pixTypeOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colors.textFaint}
              />
            </TouchableOpacity>
            {pixTypeOpen && (
              <View style={styles.dropdownList}>
                {PIX_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={styles.dropdownItem}
                    onPress={() => { setPixType(t); setPixTypeOpen(false); setPixMsg(''); }}
                  >
                    <Text style={[styles.dropdownItemText, t === pixType && styles.dropdownItemActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Chave PIX</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Informe a chave PIX"
                placeholderTextColor={theme.colors.textFaint}
                autoCapitalize="none"
                value={pixKey}
                onChangeText={v => { setPixKey(v); setPixMsg(''); }}
              />
              <TouchableOpacity
                style={[styles.saveBtn, savingPix && { opacity: 0.6 }]}
                onPress={handleSavePix}
                disabled={savingPix}
              >
                {savingPix
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={styles.saveBtnText}>Salvar</Text>
                }
              </TouchableOpacity>
            </View>
            {pixMsg ? (
              <Text style={[styles.feedbackText, pixMsg.includes('sucesso') && styles.successText]}>
                {pixMsg}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  sectionHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },
  cardBody: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },

  field: { gap: 6 },
  fieldLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  readonlyInput: {
    backgroundColor: theme.colors.surfaceInset,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
  },
  readonlyText: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },

  inputRow: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  saveBtnText: { color: '#241A00', fontFamily: theme.typography.fontFamily.display, fontSize: 13 },

  feedbackText: { color: '#EF4444', fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  successText: { color: '#10B981' },

  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceInset,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 12,
  },
  codeValue: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
    letterSpacing: 2,
  },
  codeCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceHigh,
  },
  codeCopyText: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  codeHint: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 11,
    marginTop: 4,
  },

  dealGrid: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceInset,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    overflow: 'hidden',
  },
  dealItem: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.md, gap: 4 },
  dealDivider: { width: 1, backgroundColor: theme.colors.outline },
  dealValue: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
  },
  dealLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
  },
  dealNote: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
    fontStyle: 'italic',
  },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
  },
  dropdownValue: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  dropdownPlaceholder: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  dropdownList: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    marginTop: -4,
  },
  dropdownItem: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  dropdownItemText: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  dropdownItemActive: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyBold },
});
