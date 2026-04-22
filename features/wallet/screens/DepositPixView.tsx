import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useUserData } from '@/hooks/useUserData';
import { supabase } from '@/services/supabase';
import { generatePix } from '@/services/payments';
import { theme } from '@/theme';

type Step = 'form' | 'qr';

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

function maskCpf(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

function isValidCpf(cpf: string) {
  return cpf.replace(/\D/g, '').length === 11;
}

function maskPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
}

export function DepositPixView() {
  const { profile } = useUserData();

  const hasPhone = !!(profile?.phone?.replace(/\D/g, ''));

  // ── form state ──────────────────────────────────────────
  const [amount, setAmount] = useState('');
  const [cpf, setCpf]       = useState('');
  const [phone, setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // ── QR state ────────────────────────────────────────────
  const [step, setStep] = useState<Step>('form');
  const [qrcode, setQrcode] = useState('');
  const [qrcodeImage, setQrcodeImage] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Pré-preenche CPF do perfil
  useEffect(() => {
    if (profile?.cpf) setCpf(maskCpf(profile.cpf));
  }, [profile?.cpf]);

  // ── handlers ────────────────────────────────────────────
  function handleAmountChange(text: string) {
    const clean = text.replace(/[^0-9.]/g, '');
    setAmount(clean);
    setErr('');
  }

  function handleCpfChange(text: string) {
    setCpf(maskCpf(text));
    setErr('');
  }

  function handleQuick(value: number) {
    setAmount(String(value));
    setErr('');
  }

  async function handleGenerate() {
    const parsed = parseFloat(amount);
    if (!parsed || parsed < 1) {
      setErr('Valor mínimo: R$ 1,00');
      return;
    }
    if (!isValidCpf(cpf)) {
      setErr('Informe um CPF válido (11 dígitos).');
      return;
    }

    if (!hasPhone && phone.replace(/\D/g, '').length < 10) {
      setErr('Informe um telefone válido com DDD.');
      return;
    }

    setLoading(true);
    setErr('');
    try {
      // Salva CPF (e telefone se necessário) no perfil
      const rawCpf   = cpf.replace(/\D/g, '');
      const rawPhone = hasPhone ? undefined : phone.replace(/\D/g, '');
      if (profile?.cpf !== rawCpf || rawPhone) {
        const { error: docErr } = await supabase.rpc('update_profile_document', {
          p_cpf:   rawCpf,
          p_phone: rawPhone ?? null,
        });
        if (docErr) throw new Error('Erro ao salvar dados: ' + docErr.message);
      }

      const res = await generatePix(parsed);
      setQrcode(res.pix?.qrcode ?? '');
      setQrcodeImage(res.pix?.qrcodeImage ?? '');
      setExpiresAt(res.pix?.expiresAt ?? null);
      setStep('qr');
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao gerar PIX.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    Clipboard.setString(qrcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleNewDeposit() {
    setStep('form');
    setAmount('');
    setQrcode('');
    setQrcodeImage('');
    setExpiresAt(null);
    setCopied(false);
    setErr('');
  }

  function expiresLabel() {
    if (!expiresAt) return null;
    return new Date(expiresAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ── render ──────────────────────────────────────────────
  return (
    <Screen withBottomNav={false}>
      <AppHeader
        compactBrand
        onRightPress={() => router.push('/(main)/configuracoes')}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {step === 'form' ? (
          <>
            <View style={styles.heading}>
              <Text style={styles.title}>Depositar via PIX</Text>
              <Text style={styles.subtitle}>
                Escolha ou digite o valor e receba o QR Code instantaneamente.
              </Text>
            </View>

            {/* Valores rápidos */}
            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map((v) => (
                <Pressable
                  key={v}
                  style={[
                    styles.quickChip,
                    amount === String(v) && styles.quickChipActive,
                  ]}
                  onPress={() => handleQuick(v)}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      amount === String(v) && styles.quickChipTextActive,
                    ]}
                  >
                    R$ {v}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Campo de valor */}
            <Card variant="low">
              <View style={styles.amountField}>
                <Text style={styles.amountPrefix}>R$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0,00"
                  placeholderTextColor={theme.colors.textFaint}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            </Card>

            {/* Campo de CPF */}
            <Card variant="low">
              <View style={styles.cpfField}>
                <Text style={styles.fieldLabel}>CPF do titular</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={cpf}
                  onChangeText={handleCpfChange}
                  placeholder="000.000.000-00"
                  placeholderTextColor={theme.colors.textFaint}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  maxLength={14}
                />
              </View>
            </Card>

            {/* Campo de telefone — apenas se não estiver salvo */}
            {!hasPhone && (
              <Card variant="low">
                <View style={styles.cpfField}>
                  <Text style={styles.fieldLabel}>Telefone (com DDD)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={phone}
                    onChangeText={(t) => { setPhone(maskPhone(t)); setErr(''); }}
                    placeholder="(11) 99999-9999"
                    placeholderTextColor={theme.colors.textFaint}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    maxLength={15}
                  />
                </View>
              </Card>
            )}

            {err ? <Text style={styles.errorText}>{err}</Text> : null}

            <Button
              title={loading ? 'Gerando...' : 'Gerar QR Code PIX'}
              onPress={handleGenerate}
              disabled={loading || !amount || !cpf || (!hasPhone && !phone)}
              icon={
                loading ? (
                  <ActivityIndicator size="small" color="#241A00" />
                ) : (
                  <MaterialCommunityIcons
                    name="qrcode"
                    size={20}
                    color="#241A00"
                  />
                )
              }
            />

            <Card variant="low">
              <View style={styles.infoBox}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={16}
                  color={theme.colors.textFaint}
                />
                <Text style={styles.infoText}>
                  O saldo é creditado automaticamente após a confirmação do
                  pagamento PIX, normalmente em segundos.
                </Text>
              </View>
            </Card>
          </>
        ) : (
          /* ══════════ ETAPA 2 — QR Code ══════════ */
          <>
            <View style={styles.heading}>
              <Text style={styles.title}>Pague com PIX</Text>
              {expiresLabel() && (
                <View style={styles.expiresRow}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={14}
                    color={theme.colors.textFaint}
                  />
                  <Text style={styles.expiresText}>
                    Expira às {expiresLabel()}
                  </Text>
                </View>
              )}
            </View>

            {/* QR Code image */}
            <Card variant="high">
              <View style={styles.qrContainer}>
                {qrcodeImage ? (
                  <Image
                    source={{ uri: qrcodeImage }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <MaterialCommunityIcons
                      name="qrcode"
                      size={120}
                      color={theme.colors.textFaint}
                    />
                  </View>
                )}
              </View>
            </Card>

            {/* Passos */}
            <View style={styles.steps}>
              {[
                'Abra o app do seu banco',
                'Vá em PIX → Pagar com QR Code',
                'Escaneie o código ou use o copia-e-cola',
              ].map((s, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{s}</Text>
                </View>
              ))}
            </View>

            {/* Copia-e-cola */}
            <Card variant="low">
              <View style={styles.copyBox}>
                <Text style={styles.copyLabel}>PIX Copia e Cola</Text>
                <Text style={styles.copyCode} numberOfLines={3}>
                  {qrcode}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.copyBtn,
                    copied && styles.copyBtnDone,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={handleCopy}
                >
                  <MaterialCommunityIcons
                    name={copied ? 'check' : 'content-copy'}
                    size={16}
                    color={
                      copied
                        ? theme.colors.background
                        : theme.colors.primary
                    }
                  />
                  <Text
                    style={[
                      styles.copyBtnText,
                      copied && styles.copyBtnTextDone,
                    ]}
                  >
                    {copied ? 'Copiado!' : 'Copiar código'}
                  </Text>
                </Pressable>
              </View>
            </Card>

            <Button
              title="Fazer outro depósito"
              variant="ghost"
              onPress={handleNewDeposit}
              icon={
                <MaterialCommunityIcons
                  name="plus-circle-outline"
                  size={18}
                  color={theme.colors.primary}
                />
              }
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  heading: {
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 28,
  },
  subtitle: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
  },

  // ── Chips ──────────────────────────────────────────────
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  quickChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    backgroundColor: theme.colors.surface,
  },
  quickChipActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  quickChipText: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  quickChipTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodySemiBold,
  },

  // ── Valor ──────────────────────────────────────────────
  amountField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  amountPrefix: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.displayMedium,
    fontSize: 28,
  },
  amountInput: {
    flex: 1,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 42,
    padding: 0,
  },

  // ── CPF ────────────────────────────────────────────────
  cpfField: {
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  fieldInput: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 18,
    padding: 0,
  },

  errorText: {
    color: '#FF5A5A',
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
    textAlign: 'center',
  },

  // ── Info ───────────────────────────────────────────────
  infoBox: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
  },

  // ── Expiração ──────────────────────────────────────────
  expiresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expiresText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },

  // ── QR ─────────────────────────────────────────────────
  qrContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: theme.radius.md,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceInset,
  },

  // ── Passos ─────────────────────────────────────────────
  steps: {
    gap: theme.spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },
  stepText: {
    flex: 1,
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
  },

  // ── Copia-e-cola ───────────────────────────────────────
  copyBox: {
    gap: theme.spacing.sm,
  },
  copyLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  copyCode: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
    lineHeight: 16,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  copyBtnDone: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  copyBtnText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodySemiBold,
    fontSize: 13,
  },
  copyBtnTextDone: {
    color: theme.colors.background,
  },
});
