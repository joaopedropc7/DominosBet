import { useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '@/components/base/Avatar';
import { Screen } from '@/components/base/Screen';
import { findProfileByNickname, sendFriendRequest } from '@/services/friends';
import { theme } from '@/theme';
import type { ProfileRow } from '@/types/database';

type SearchState = 'idle' | 'searching' | 'found' | 'not_found' | 'sending' | 'sent' | 'error';

export function AddFriendScreenView() {
  const [nickname, setNickname] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const [result, setResult] = useState<ProfileRow | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSearch() {
    if (!nickname.trim()) return;
    setState('searching');
    setResult(null);
    setErrorMsg('');
    try {
      const profile = await findProfileByNickname(nickname.trim());
      if (profile) {
        setResult(profile);
        setState('found');
      } else {
        setState('not_found');
      }
    } catch {
      setErrorMsg('Erro ao buscar. Tente novamente.');
      setState('error');
    }
  }

  async function handleSendRequest() {
    if (!result) return;
    setState('sending');
    try {
      await sendFriendRequest(result.id);
      setState('sent');
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Erro ao enviar solicitação.');
      setState('error');
    }
  }

  function reset() {
    setNickname('');
    setState('idle');
    setResult(null);
    setErrorMsg('');
  }

  return (
    <Screen>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.textMuted} />
        </Pressable>
        <Text style={styles.title}>Adicionar amigo</Text>
        <View style={styles.backBtn} pointerEvents="none" />
      </View>

      <Text style={styles.subtitle}>
        Digite o nickname exato do jogador para enviar uma solicitação de amizade.
      </Text>

      {/* Search input */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Nickname do jogador"
          placeholderTextColor={theme.colors.textFaint}
          value={nickname}
          onChangeText={text => { setNickname(text); setState('idle'); }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          editable={state !== 'searching' && state !== 'sending'}
        />
        <Pressable
          onPress={handleSearch}
          disabled={!nickname.trim() || state === 'searching'}
          style={({ pressed }) => [
            styles.searchBtn,
            (!nickname.trim() || state === 'searching') && styles.searchBtnDisabled,
            pressed && styles.searchBtnPressed,
          ]}>
          {state === 'searching'
            ? <ActivityIndicator size="small" color={theme.colors.background} />
            : <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.background} />
          }
        </Pressable>
      </View>

      {/* States */}
      {state === 'not_found' && (
        <View style={styles.feedbackBox}>
          <MaterialCommunityIcons name="account-question-outline" size={36} color={theme.colors.textFaint} />
          <Text style={styles.feedbackTitle}>Nenhum jogador encontrado</Text>
          <Text style={styles.feedbackSubtitle}>Verifique o nickname e tente novamente.</Text>
        </View>
      )}

      {(state === 'error') && (
        <View style={styles.feedbackBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {state === 'sent' && (
        <View style={styles.feedbackBox}>
          <MaterialCommunityIcons name="check-circle-outline" size={40} color={theme.colors.primary} />
          <Text style={styles.feedbackTitle}>Solicitação enviada!</Text>
          <Text style={styles.feedbackSubtitle}>
            Aguarde {result?.display_name} aceitar o convite.
          </Text>
          <Pressable onPress={reset} style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.ghostBtnText}>Buscar outro jogador</Text>
          </Pressable>
        </View>
      )}

      {(state === 'found') && result && (
        <View style={styles.resultCard}>
          <Avatar avatarId={result.avatar_id} size={56} />
          <View style={styles.resultInfo}>
            <Text style={styles.resultName}>{result.display_name}</Text>
            <Text style={styles.resultRank}>{result.rank_label}</Text>
            <View style={styles.resultStats}>
              <Text style={styles.resultStat}>{result.matches_count} partidas</Text>
              <Text style={styles.resultStatDot}>·</Text>
              <Text style={styles.resultStat}>{result.win_rate}% vitórias</Text>
            </View>
          </View>
          <Pressable
            onPress={handleSendRequest}
            disabled={state === 'sending'}
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}>
            {state === 'sending'
              ? <ActivityIndicator size="small" color={theme.colors.background} />
              : <MaterialCommunityIcons name="account-plus" size={18} color={theme.colors.background} />
            }
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnPressed: { opacity: 0.7 },
  title: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
  },
  subtitle: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 15,
  },
  searchBtn: {
    width: 48, height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnDisabled: { opacity: 0.45 },
  searchBtnPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  feedbackBox: {
    marginTop: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  feedbackTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
    textAlign: 'center',
  },
  feedbackSubtitle: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  ghostBtn: {
    marginTop: theme.spacing.sm,
  },
  ghostBtnText: {
    color: theme.colors.accent,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 16,
  },
  resultRank: {
    color: theme.colors.accent,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  resultStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: 2,
  },
  resultStat: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  resultStatDot: {
    color: theme.colors.textFaint,
    fontSize: 12,
  },
  addBtn: {
    width: 40, height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnPressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
});
