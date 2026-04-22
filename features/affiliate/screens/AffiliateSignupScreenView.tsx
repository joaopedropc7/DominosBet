import { useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

// ── Masks ─────────────────────────────────────────────────────
function maskCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ── Field ─────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  secureTextEntry = false,
  optional = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  secureTextEntry?: boolean;
  optional?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional && <Text style={styles.optional}>Opcional</Text>}
      </View>
      <View style={styles.fieldBox}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textFaint}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry && !show}
          autoCorrect={false}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setShow(s => !s)} style={styles.eyeBtn}>
            <MaterialCommunityIcons
              name={show ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={theme.colors.textFaint}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────
export function AffiliateSignupScreenView() {
  const [name,         setName]         = useState('');
  const [phone,        setPhone]        = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [cpf,          setCpf]          = useState('');
  const [referralCode, setReferralCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setError('');

    // Basic validation
    if (!name.trim())                           return setError('Informe seu nome completo.');
    if (!email.trim() || !email.includes('@'))  return setError('Informe um e-mail válido.');
    if (password.length < 6)                    return setError('A senha precisa ter pelo menos 6 caracteres.');
    if (phone.replace(/\D/g, '').length < 10)   return setError('Informe um telefone válido com DDD.');
    if (cpf.replace(/\D/g, '').length !== 11)   return setError('Informe um CPF válido.');

    setLoading(true);
    try {
      // 1. Criar conta no Supabase Auth
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() } },
      });
      if (signUpError) throw new Error(signUpError.message);

      // 2. Salvar dados extras do afiliado
      const { error: rpcError } = await supabase.rpc('register_affiliate', {
        p_name:          name.trim(),
        p_phone:         phone,
        p_cpf:           cpf,
        p_referral_code: referralCode.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);

      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // ── Success state ─────────────────────────────────────────
  if (success) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="check-decagram" size={64} color={theme.colors.primary} />
          </View>
          <Text style={styles.successTitle}>Cadastro enviado!</Text>
          <Text style={styles.successBody}>
            Recebemos seu cadastro. Nossa equipe irá analisar seus dados e entrará em contato pelo e-mail informado em até 48 horas.
          </Text>
          <Pressable
            onPress={() => router.replace('/login')}
            style={({ pressed }) => [styles.successBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.successBtnText}>Ir para o login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Form ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logo}>
              <MaterialCommunityIcons name="domino-mask" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>Seja um Afiliado</Text>
            <Text style={styles.subtitle}>
              Indique jogadores, acompanhe seus ganhos e receba comissões por cada novo usuário que entrar pela sua indicação.
            </Text>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            <Field
              label="Nome completo"
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              autoCapitalize="words"
            />
            <Field
              label="Código de indicação"
              value={referralCode}
              onChangeText={setReferralCode}
              placeholder="Ex: AMIGO2024"
              autoCapitalize="characters"
              optional
            />
            <Field
              label="Telefone / WhatsApp"
              value={phone}
              onChangeText={(v) => setPhone(maskPhone(v))}
              placeholder="(11) 99999-9999"
              keyboardType="phone-pad"
            />
            <Field
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@exemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
            />
            <Field
              label="CPF"
              value={cpf}
              onChangeText={(v) => setCpf(maskCPF(v))}
              placeholder="000.000.000-00"
              keyboardType="numeric"
            />

            {error !== '' && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }, loading && { opacity: 0.6 }]}
            >
              {loading
                ? <ActivityIndicator color="#241A00" />
                : <Text style={styles.submitBtnText}>Enviar cadastro</Text>}
            </Pressable>

            <Pressable onPress={() => router.replace('/login')} style={styles.loginLink}>
              <Text style={styles.loginLinkText}>Já tem conta? Entrar</Text>
            </Pressable>
          </View>

          {/* Footer note */}
          <Text style={styles.footer}>
            Ao se cadastrar, você concorda com nossos termos de parceria de afiliados. Análise sujeita a aprovação da equipe.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.xl,
    paddingBottom: 40,
  },

  // Header
  header: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 28,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },

  // Field
  fieldWrap: { gap: theme.spacing.xs },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  optional: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
    fontStyle: 'italic',
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceInset,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(77, 70, 53, 0.28)',
    paddingHorizontal: theme.spacing.md,
    minHeight: 54,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 15,
  },
  eyeBtn: {
    padding: 4,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    backgroundColor: 'rgba(255,80,80,0.08)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  errorText: {
    flex: 1,
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
  },

  // Submit
  submitBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 15,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  loginLinkText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },

  // Footer
  footer: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },

  // Success
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  successTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 26,
    textAlign: 'center',
  },
  successBody: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  successBtn: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    paddingVertical: 13,
    paddingHorizontal: theme.spacing.xxl,
  },
  successBtnText: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 15,
  },
});
