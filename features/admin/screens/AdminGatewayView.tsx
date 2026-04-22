import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

type GatewaySettings = {
  api_key: string;
  public_key: string;
  is_live: boolean;
  updated_at: string | null;
};

function Field({
  label, value, onChangeText, placeholder, secure, hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textFaint}
          secureTextEntry={secure && !show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {secure && (
          <Pressable onPress={() => setShow(v => !v)} style={styles.eyeBtn}>
            <MaterialCommunityIcons
              name={show ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={theme.colors.textFaint}
            />
          </Pressable>
        )}
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function AdminGatewayView() {
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  const [apiKey,    setApiKey]    = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [isLive,    setIsLive]    = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('admin_get_gateway_settings').then(({ data, error: rpcErr }) => {
      if (rpcErr) { setError(rpcErr.message); }
      else if (data) {
        const s = data as GatewaySettings;
        setApiKey(s.api_key ?? '');
        setPublicKey(s.public_key ?? '');
        setIsLive(s.is_live ?? false);
        setUpdatedAt(s.updated_at ?? null);
      }
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    if (!apiKey.trim())    { setError('Informe a API Key');    return; }
    if (!publicKey.trim()) { setError('Informe a Public Key'); return; }
    setError('');
    setSuccess('');
    setSaving(true);
    const { error: rpcErr } = await supabase.rpc('admin_update_gateway_settings', {
      p_api_key:    apiKey.trim(),
      p_public_key: publicKey.trim(),
      p_is_live:    isLive,
    });
    setSaving(false);
    if (rpcErr) {
      setError(rpcErr.message);
    } else {
      setSuccess('Configurações salvas com sucesso!');
      setUpdatedAt(new Date().toISOString());
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Gateway de Pagamento</Text>
          <Text style={styles.pageSubtitle}>Credenciais OramaPay para geração de PIX</Text>
        </View>
        {updatedAt && (
          <Text style={styles.updatedAt}>
            Atualizado em {new Date(updatedAt).toLocaleString('pt-BR')}
          </Text>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <View style={styles.body}>

          {/* Ambiente */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="cloud-outline" size={16} color={theme.colors.textFaint} />
              <Text style={styles.cardTitle}>Ambiente</Text>
            </View>
            <View style={styles.envRow}>
              <Pressable
                onPress={() => setIsLive(false)}
                style={[styles.envBtn, !isLive && styles.envBtnActive]}
              >
                <MaterialCommunityIcons
                  name="test-tube"
                  size={16}
                  color={!isLive ? theme.colors.primary : theme.colors.textFaint}
                />
                <Text style={[styles.envBtnText, !isLive && styles.envBtnTextActive]}>
                  Sandbox / Teste
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setIsLive(true)}
                style={[styles.envBtn, isLive && styles.envBtnLive]}
              >
                <MaterialCommunityIcons
                  name="lightning-bolt"
                  size={16}
                  color={isLive ? '#10B981' : theme.colors.textFaint}
                />
                <Text style={[styles.envBtnText, isLive && styles.envBtnTextLive]}>
                  Produção (live_)
                </Text>
              </Pressable>
            </View>
            {isLive && (
              <View style={styles.liveWarning}>
                <MaterialCommunityIcons name="alert-outline" size={14} color="#F59E0B" />
                <Text style={styles.liveWarningText}>
                  Modo produção ativo — transações reais serão processadas.
                </Text>
              </View>
            )}
          </View>

          {/* Credenciais */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="key-outline" size={16} color={theme.colors.textFaint} />
              <Text style={styles.cardTitle}>Credenciais OramaPay</Text>
            </View>
            <Text style={styles.cardDesc}>
              Encontre suas chaves em: app.oramapay.com → Configurações → API
            </Text>
            <Field
              label="API Key"
              value={apiKey}
              onChangeText={setApiKey}
              placeholder={isLive ? 'live_xxxxxxxxxxxxxxxx' : 'test_xxxxxxxxxxxxxxxx'}
              secure
              hint="Prefixo live_ para produção ou test_ para sandbox"
            />
            <Field
              label="Public Key"
              value={publicKey}
              onChangeText={setPublicKey}
              placeholder="pk_xxxxxxxxxxxxxxxx"
              secure
              hint="Public Key da sua conta OramaPay"
            />
          </View>

          {/* Webhook */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="webhook" size={16} color={theme.colors.textFaint} />
              <Text style={styles.cardTitle}>Webhook (Postback URL)</Text>
            </View>
            <Text style={styles.cardDesc}>
              URL que receberá as notificações de mudança de status dos pagamentos.
            </Text>
            <Field
              label="Postback URL"
              value={postbackUrl}
              onChangeText={setPostbackUrl}
              placeholder="https://dominosbet.com.br/api/webhooks/oramapay"
              hint="Configure também no painel OramaPay em Configurações → Webhooks"
            />
          </View>

          {/* Auth preview */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="shield-lock-outline" size={16} color={theme.colors.textFaint} />
              <Text style={styles.cardTitle}>Autenticação</Text>
            </View>
            <View style={styles.authBox}>
              <Text style={styles.authLabel}>Formato usado nas requisições:</Text>
              <Text style={styles.authCode}>
                Authorization: Basic base64(apiKey:publicKey)
              </Text>
              <Text style={styles.authNote}>
                As credenciais ficam armazenadas no servidor e nunca são expostas ao cliente.
                A geração de PIX ocorre via Edge Function segura.
              </Text>
            </View>
          </View>

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
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: theme.spacing.xl, gap: theme.spacing.lg },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    paddingBottom: theme.spacing.lg,
  },
  pageTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 26 },
  pageSubtitle: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13, marginTop: 2 },
  updatedAt: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 11 },

  body: { gap: theme.spacing.lg },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 14 },
  cardDesc: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },

  envRow: { flexDirection: 'row', gap: theme.spacing.sm },
  envBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 10, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.outline,
    backgroundColor: theme.colors.surfaceInset,
  },
  envBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  envBtnLive: {
    borderColor: '#10B981',
    backgroundColor: '#10B98122',
  },
  envBtnText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },
  envBtnTextActive: { color: theme.colors.primary },
  envBtnTextLive: { color: '#10B981' },

  liveWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F59E0B18', borderRadius: theme.radius.md,
    padding: theme.spacing.sm, borderWidth: 1, borderColor: '#F59E0B44',
  },
  liveWarningText: { color: '#F59E0B', fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12, flex: 1 },

  field: { gap: 6 },
  fieldLabel: {
    color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surfaceHigh,
    borderWidth: 1, borderColor: theme.colors.outline,
    borderRadius: theme.radius.md,
  },
  input: {
    flex: 1,
    color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14, paddingHorizontal: theme.spacing.md, paddingVertical: 11,
    outlineStyle: 'none',
  } as any,
  eyeBtn: { paddingHorizontal: theme.spacing.sm },
  fieldHint: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 11 },

  authBox: {
    backgroundColor: theme.colors.surfaceInset,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.md,
    gap: 8,
  },
  authLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  authCode: {
    color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 12, letterSpacing: 0.3,
  },
  authNote: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 11, lineHeight: 17 },

  errorText: { color: '#EF4444', fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
  successText: { color: '#10B981', fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg, paddingVertical: 14,
  },
  saveBtnText: { color: '#241A00', fontFamily: theme.typography.fontFamily.display, fontSize: 15 },
});
