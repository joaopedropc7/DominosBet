import { useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '@/components/base/Card';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useUserData } from '@/hooks/useUserData';
import { createPrivateRoom } from '@/services/private-room';
import { theme } from '@/theme';
import { formatCoins } from '@/utils/format';

const QUICK_FEES = [10, 20, 50, 100, 200];

export function CreateRoomScreenView() {
  const { profile } = useUserData();
  const balance = profile?.balance ?? 0;

  const [roomName, setRoomName]       = useState('');
  const [mode, setMode]               = useState<'classic' | 'express'>('classic');
  const [entryFeeStr, setEntryFeeStr] = useState('20');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  const entryFee = Math.max(1, parseInt(entryFeeStr || '0', 10) || 0);
  const prize    = Math.round(entryFee * 2 * 0.9);
  const canAfford = balance >= entryFee;

  async function handleCreate() {
    if (!canAfford) {
      Alert.alert('Saldo insuficiente', `Você precisa de ${formatCoins(entryFee)} moedas.`);
      return;
    }
    if (usePassword && password.trim().length < 4) {
      Alert.alert('Senha muito curta', 'A senha deve ter ao menos 4 caracteres.');
      return;
    }

    try {
      setSubmitting(true);
      const { roomId, inviteCode } = await createPrivateRoom(
        entryFee,
        mode,
        usePassword ? password.trim() : undefined,
        roomName.trim() || undefined,
      );
      router.replace({
        pathname: '/(main)/sala-privada',
        params: {
          roomId,
          inviteCode,
          entryFee: String(entryFee),
          roomName: roomName.trim(),
        },
      } as any);
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível criar a sala.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <AppHeader
        title="Criar Sala"
        subtitle="Configure sua sala privada."
        rightIcon="arrow-left"
        onRightPress={() => router.back()}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Room name */}
        <Card variant="low">
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nome da sala (opcional)</Text>
            <TextInput
              style={styles.input}
              value={roomName}
              onChangeText={setRoomName}
              placeholder="Ex: Duelo dos Mestres"
              placeholderTextColor={theme.colors.textFaint}
              maxLength={40}
            />
          </View>
        </Card>

        {/* Mode */}
        <Card variant="low">
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Modo de jogo</Text>
            <View style={styles.modeRow}>
              {(['classic', 'express'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={({ pressed }) => [
                    styles.modeBtn,
                    mode === m && styles.modeBtnActive,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={m === 'classic' ? 'cards-playing-outline' : 'lightning-bolt'}
                    size={16}
                    color={mode === m ? theme.colors.primary : theme.colors.textFaint}
                  />
                  <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                    {m === 'classic' ? 'Clássico' : 'Expresso'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldSub}>
              {mode === 'classic'
                ? 'Pode comprar peças do estoque quando estiver bloqueado.'
                : 'Sem estoque — passa a vez quando bloqueado.'}
            </Text>
          </View>
        </Card>

        {/* Entry fee */}
        <Card variant="low">
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Valor da aposta por jogador</Text>
            <View style={styles.feeRow}>
              <Text style={styles.feeCurrency}>₡</Text>
              <TextInput
                style={[styles.input, styles.feeInput]}
                value={entryFeeStr}
                onChangeText={(v) => setEntryFeeStr(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                maxLength={6}
                placeholderTextColor={theme.colors.textFaint}
              />
            </View>

            {/* Quick picks */}
            <View style={styles.quickPicks}>
              {QUICK_FEES.map((fee) => (
                <Pressable
                  key={fee}
                  onPress={() => setEntryFeeStr(String(fee))}
                  style={({ pressed }) => [
                    styles.quickBtn,
                    entryFee === fee && styles.quickBtnActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.quickBtnText, entryFee === fee && styles.quickBtnTextActive]}>
                    {formatCoins(fee)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Prize preview */}
            <View style={styles.prizeRow}>
              <MaterialCommunityIcons name="trophy-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.prizeText}>
                Prêmio: {formatCoins(prize)} moedas (90% do pote)
              </Text>
            </View>

            {/* Balance status */}
            <View style={[styles.balanceRow, !canAfford && styles.balanceRowDanger]}>
              <MaterialCommunityIcons
                name={canAfford ? 'check-circle-outline' : 'alert-circle-outline'}
                size={14}
                color={canAfford ? theme.colors.accent : theme.colors.danger}
              />
              <Text style={[styles.balanceText, !canAfford && styles.balanceTextDanger]}>
                Seu saldo: {formatCoins(balance)} moedas
                {!canAfford ? ' — insuficiente' : ''}
              </Text>
            </View>
          </View>
        </Card>

        {/* Password */}
        <Card variant="low">
          <View style={styles.field}>
            <View style={styles.passwordToggleRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.fieldLabel}>Proteger com senha</Text>
                <Text style={styles.fieldSub}>Apenas quem tiver a senha pode entrar</Text>
              </View>
              <Switch
                value={usePassword}
                onValueChange={setUsePassword}
                trackColor={{ false: theme.colors.surfaceHigh, true: theme.colors.primarySoft }}
                thumbColor={usePassword ? theme.colors.primary : theme.colors.textFaint}
              />
            </View>

            {usePassword && (
              <View style={styles.passwordInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mínimo 4 caracteres"
                  placeholderTextColor={theme.colors.textFaint}
                  secureTextEntry={!showPassword}
                  maxLength={32}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={theme.colors.textFaint}
                  />
                </Pressable>
              </View>
            )}
          </View>
        </Card>

        {/* Submit */}
        <Pressable
          onPress={handleCreate}
          disabled={submitting || !canAfford}
          style={({ pressed }) => [
            styles.createBtn,
            (!canAfford) && styles.createBtnDisabled,
            pressed && canAfford && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
        >
          {submitting
            ? <ActivityIndicator color="#241A00" />
            : <MaterialCommunityIcons name="plus-circle" size={20} color="#241A00" />}
          <Text style={styles.createBtnText}>
            {submitting ? 'Criando sala…' : 'Criar Sala'}
          </Text>
        </Pressable>

      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },

  field: { gap: theme.spacing.sm },
  fieldLabel: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  fieldSub: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  input: {
    backgroundColor: theme.colors.surfaceHigh,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 15,
  },

  modeRow: { flexDirection: 'row', gap: theme.spacing.sm },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceHigh,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  modeBtnActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  modeBtnText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },
  modeBtnTextActive: { color: theme.colors.primary },

  feeRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  feeCurrency: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 28,
  },
  feeInput: { flex: 1, fontFamily: theme.typography.fontFamily.display, fontSize: 28 },

  quickPicks: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceHigh,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  quickBtnActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  quickBtnText: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 12,
  },
  quickBtnTextActive: { color: theme.colors.primary },

  prizeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  prizeText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },

  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  balanceRowDanger: {},
  balanceText: {
    color: theme.colors.accent,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  balanceTextDanger: { color: theme.colors.danger },

  passwordToggleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  passwordInputRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  eyeBtn: { padding: 8 },

  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    marginTop: theme.spacing.sm,
  },
  createBtnDisabled: { opacity: 0.45 },
  createBtnText: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 17,
  },
});
