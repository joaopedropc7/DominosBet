import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/base/Avatar';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Input } from '@/components/base/Input';
import { Screen } from '@/components/base/Screen';
import { avatarOptions } from '@/constants/avatars';
import { useUserData } from '@/hooks/useUserData';
import { theme } from '@/theme';

export function EditProfileScreenView() {
  const { profile, isLoading, updateProfile } = useUserData();
  const [displayName, setDisplayName] = useState('');
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
    setAvatarId(profile?.avatar_id ?? avatarOptions[0].id);
  }, [profile?.avatar_id, profile?.display_name]);

  async function handleSave() {
    try {
      setIsSubmitting(true);
      setErrorMessage('');
      await updateProfile({
        display_name: displayName.trim(),
        avatar_id: avatarId ?? avatarOptions[0].id,
      });
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível salvar o perfil.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const cooldownText =
    profile?.display_name_updated_at
      ? 'Depois de alterar o nome, a próxima mudança só será liberada após 7 dias.'
      : 'Você pode definir seu nome agora. Depois disso, novas mudanças só serão liberadas a cada 7 dias.';

  return (
    <Screen>
      {/* Top bar with back button */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.textMuted} />
        </Pressable>
        <Text style={styles.topBarTitle}>Editar perfil</Text>
        <View style={styles.backBtn} pointerEvents="none" />
      </View>

      <View style={styles.header}>
        <Text style={styles.subtitle}>Atualize seu nome público e escolha um avatar para representar sua mesa.</Text>
      </View>

      <Card variant="low">
        <View style={styles.form}>
          <Input
            label="Nome de jogador"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Seu nome competitivo"
          />
          <Text style={styles.helperText}>{cooldownText}</Text>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Avatar</Text>
            <View style={styles.avatarGrid}>
              {avatarOptions.map((option) => {
                const selected = option.id === avatarId;

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setAvatarId(option.id)}
                    style={[styles.avatarOption, selected && styles.avatarOptionSelected]}>
                    <Avatar avatarId={option.id} size={72} highlighted={selected} />
                    <Text style={[styles.avatarName, selected && styles.avatarNameSelected]}>{option.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <Button
            title={isSubmitting ? 'Salvando...' : 'Salvar alterações'}
            onPress={handleSave}
            icon={isSubmitting ? <ActivityIndicator color="#241A00" /> : undefined}
          />
          <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
        </View>
      </Card>

      {isLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}
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
    width: 36, height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
  },
  header: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
  subtitle: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
  },
  form: {
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: theme.spacing.md,
  },
  avatarOption: {
    width: '30.5%',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceHigh,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  helperText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
  },
  avatarOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceHighest,
  },
  avatarName: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textAlign: 'center',
  },
  avatarNameSelected: {
    color: theme.colors.primary,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
});
