import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { joinPrivateRoom, previewPrivateRoom } from '@/services/private-room';
import type { RoomPreviewData } from '@/services/private-room';
import { useUserData } from '@/hooks/useUserData';
import { theme } from '@/theme';
import { formatCoins } from '@/utils/format';

interface JoinRoomScreenViewProps {
  code: string;
}

export function JoinRoomScreenView({ code }: JoinRoomScreenViewProps) {
  const { profile } = useUserData();
  const balance = profile?.balance ?? 0;

  const [preview, setPreview]       = useState<RoomPreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError]     = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [joining, setJoining]       = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoadingPreview(true);
        const data = await previewPrivateRoom(code);
        setPreview(data);
      } catch (e) {
        setPreviewError(e instanceof Error ? e.message : 'Sala não encontrada.');
      } finally {
        setLoadingPreview(false);
      }
    }
    if (code) load();
  }, [code]);

  async function handleJoin() {
    if (!preview) return;

    if (preview.has_password && password.trim().length === 0) {
      Alert.alert('Senha necessária', 'Esta sala requer senha para entrar.');
      return;
    }

    if (balance < preview.entry_fee) {
      Alert.alert('Saldo insuficiente', `Você precisa de ${formatCoins(preview.entry_fee)} moedas.`);
      return;
    }

    try {
      setJoining(true);
      const { roomId } = await joinPrivateRoom(code, preview.has_password ? password.trim() : undefined);
      router.replace({
        pathname: '/(main)/jogo-online',
        params: { roomId, role: 'p2' },
      } as any);
    } catch (e) {
      Alert.alert('Erro ao entrar', e instanceof Error ? e.message : 'Não foi possível entrar na sala.');
    } finally {
      setJoining(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────
  if (loadingPreview) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text style={styles.loadingText}>Buscando sala…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ─────────────────────────────────────────────────
  if (previewError || !preview) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <MaterialCommunityIcons name="door-closed-lock" size={48} color={theme.colors.danger} />
          <Text style={styles.errorTitle}>Sala não encontrada</Text>
          <Text style={styles.errorSub}>{previewError}</Text>
          <Pressable
            onPress={() => router.replace('/(main)/salas')}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.backBtnText}>Voltar às Salas</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const prize      = Math.round(preview.entry_fee * 2 * 0.9);
  const canAfford  = balance >= preview.entry_fee;

  // ── Preview + join form ───────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>

        {/* Back */}
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.textSoft} />
          <Text style={styles.backRowText}>Voltar</Text>
        </Pressable>

        {/* Room card */}
        <View style={styles.roomCard}>
          <View style={styles.roomCardTop}>
            <MaterialCommunityIcons name="door-open" size={36} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.roomName}>
                {preview.room_name || `Sala ${code}`}
              </Text>
              <Text style={styles.roomCode}>{code}</Text>
            </View>
            {preview.has_password && (
              <MaterialCommunityIcons name="lock" size={18} color={theme.colors.textFaint} />
            )}
          </View>

          <View style={styles.roomDetails}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Entrada</Text>
              <Text style={styles.detailValue}>{formatCoins(preview.entry_fee)} moedas</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Prêmio</Text>
              <Text style={[styles.detailValue, styles.detailValueGold]}>{formatCoins(prize)} moedas</Text>
            </View>
          </View>

          {/* Balance */}
          <View style={[styles.balanceRow, !canAfford && styles.balanceRowDanger]}>
            <MaterialCommunityIcons
              name={canAfford ? 'check-circle-outline' : 'alert-circle-outline'}
              size={14}
              color={canAfford ? theme.colors.accent : theme.colors.danger}
            />
            <Text style={[styles.balanceText, !canAfford && styles.balanceTextDanger]}>
              Seu saldo: {formatCoins(balance)} moedas{!canAfford ? ' — insuficiente' : ''}
            </Text>
          </View>
        </View>

        {/* Password field */}
        {preview.has_password && (
          <View style={styles.passwordBox}>
            <Text style={styles.passwordLabel}>Senha da sala</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.passwordInput, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Digite a senha"
                placeholderTextColor={theme.colors.textFaint}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={theme.colors.textFaint}
                />
              </Pressable>
            </View>
          </View>
        )}

        {/* Join button */}
        <Pressable
          onPress={handleJoin}
          disabled={joining || !canAfford}
          style={({ pressed }) => [
            styles.joinBtn,
            !canAfford && styles.joinBtnDisabled,
            pressed && canAfford && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
        >
          {joining
            ? <ActivityIndicator color="#241A00" />
            : <MaterialCommunityIcons name="door-open" size={20} color="#241A00" />}
          <Text style={styles.joinBtnText}>
            {joining ? 'Entrando…' : 'Entrar na Sala'}
          </Text>
        </Pressable>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  root: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  loadingText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  errorTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 24,
    textAlign: 'center',
  },
  errorSub: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHigh,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  backBtnText: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
  },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: theme.spacing.xs },
  backRowText: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
  },

  roomCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  roomCardTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  roomName: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 22,
  },
  roomCode: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  roomDetails: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceHigh,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  detailItem: { flex: 1, alignItems: 'center', gap: 3 },
  detailDivider: { width: 1, backgroundColor: theme.colors.outline },
  detailLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailValue: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 18,
  },
  detailValueGold: { color: theme.colors.primary },

  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  balanceRowDanger: {},
  balanceText: {
    color: theme.colors.accent,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  balanceTextDanger: { color: theme.colors.danger },

  passwordBox: { gap: theme.spacing.sm },
  passwordLabel: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  passwordInput: {
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
  eyeBtn: { padding: 8 },

  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    marginTop: 'auto',
  },
  joinBtnDisabled: { opacity: 0.45 },
  joinBtnText: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 17,
  },
});
