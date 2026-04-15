import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '@/components/base/Screen';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';
import { theme } from '@/theme';

const STORAGE_KEY_SOUND    = '@xdomino:sound_enabled';
const STORAGE_KEY_HAPTICS  = '@xdomino:haptics_enabled';
const APP_VERSION          = '0.1.0';

export function SettingsScreenView() {
  const { user, signOut } = useAuth();
  const { profile } = useUserData();
  const isAdmin = profile?.is_admin ?? false;
  const [soundEnabled,   setSoundEnabled]   = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_SOUND),
      AsyncStorage.getItem(STORAGE_KEY_HAPTICS),
    ]).then(([sound, haptics]) => {
      if (sound   !== null) setSoundEnabled(sound   === 'true');
      if (haptics !== null) setHapticsEnabled(haptics === 'true');
    });
  }, []);

  function toggleSound(value: boolean) {
    setSoundEnabled(value);
    AsyncStorage.setItem(STORAGE_KEY_SOUND, String(value));
  }

  function toggleHaptics(value: boolean) {
    setHapticsEnabled(value);
    AsyncStorage.setItem(STORAGE_KEY_HAPTICS, String(value));
  }

  return (
    <Screen>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.textMuted} />
        </Pressable>
        <Text style={styles.title}>Configurações</Text>
        <View style={styles.backBtn} pointerEvents="none" />
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Conta</Text>
        <View style={styles.card}>
          <SettingRow
            icon="account-outline"
            label="Nickname"
            value={profile?.display_name ?? user?.email ?? '—'}
            onPress={() => router.push('/(main)/editar-perfil')}
            chevron
          />
          <Separator />
          <SettingRow
            icon="email-outline"
            label="E-mail"
            value={user?.email ?? '—'}
          />
        </View>
      </View>

      {/* Gameplay */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Jogabilidade</Text>
        <View style={styles.card}>
          <SettingRow
            icon="volume-high"
            label="Sons"
            right={
              <Switch
                value={soundEnabled}
                onValueChange={toggleSound}
                trackColor={{ false: theme.colors.surfaceHighest, true: theme.colors.primary }}
                thumbColor={soundEnabled ? theme.colors.background : theme.colors.textFaint}
              />
            }
          />
          <Separator />
          <SettingRow
            icon="vibrate"
            label="Vibração (haptics)"
            right={
              <Switch
                value={hapticsEnabled}
                onValueChange={toggleHaptics}
                trackColor={{ false: theme.colors.surfaceHighest, true: theme.colors.primary }}
                thumbColor={hapticsEnabled ? theme.colors.background : theme.colors.textFaint}
              />
            }
          />
        </View>
      </View>

      {/* Modos de jogo */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Modos de jogo</Text>
        <View style={styles.card}>
          <SettingRow
            icon="robot-outline"
            label="1v1 vs Bot"
            onPress={() => router.push('/(main)/jogo-bot')}
            chevron
          />
          <Separator />
          <SettingRow
            icon="account-group-outline"
            label="4 Jogadores"
            onPress={() => router.push('/(main)/jogo-4p')}
            chevron
          />
          <Separator />
          <SettingRow
            icon="account-multiple-outline"
            label="Amigos"
            onPress={() => router.push('/(main)/amigos')}
            chevron
          />
        </View>
      </View>

      {/* Sobre */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Sobre</Text>
        <View style={styles.card}>
          <SettingRow icon="information-outline" label="Versão" value={APP_VERSION} />
          <Separator />
          <SettingRow icon="shield-outline" label="Política de Privacidade" chevron />
          <Separator />
          <SettingRow icon="file-document-outline" label="Termos de Uso" chevron />
        </View>
      </View>

      {/* Admin */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Administração</Text>
          <View style={styles.card}>
            <SettingRow
              icon="shield-crown-outline"
              label="Painel Admin"
              onPress={() => router.push('/admin')}
              chevron
            />
          </View>
        </View>
      )}

      {/* Sair */}
      <View style={styles.section}>
        <View style={styles.card}>
          <SettingRow
            icon="logout"
            label="Sair da conta"
            danger
            onPress={signOut}
          />
        </View>
      </View>
    </Screen>
  );
}

function SettingRow({
  icon,
  label,
  value,
  danger = false,
  chevron = false,
  onPress,
  right,
}: {
  icon: string;
  label: string;
  value?: string;
  danger?: boolean;
  chevron?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const color = danger ? theme.colors.danger : theme.colors.text;
  const row = (
    <View style={styles.row}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={danger ? theme.colors.danger : theme.colors.textMuted} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: theme.colors.danger }]}>{label}</Text>
      <View style={styles.rowRight}>
        {right ?? (
          <>
            {value !== undefined && <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>}
            {chevron && <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textFaint} />}
          </>
        )}
      </View>
    </View>
  );

  if (!onPress) return row;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.rowPressed]}>
      {row}
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: theme.spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnPressed: { opacity: 0.7 },
  title: {
    color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 20,
  },
  section: { gap: theme.spacing.sm },
  sectionLabel: {
    color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.outline, overflow: 'hidden',
  },
  separator: {
    height: 1, backgroundColor: theme.colors.outline, marginHorizontal: theme.spacing.md,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md, paddingVertical: 14,
  },
  rowPressed: { opacity: 0.7 },
  rowIcon: {
    width: 32, height: 32, borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceHigh, alignItems: 'center', justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: 'rgba(255,139,135,0.12)' },
  rowLabel: {
    flex: 1, color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 15,
  },
  rowRight: {
    flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, maxWidth: '40%',
  },
  rowValue: {
    color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13, textAlign: 'right', flexShrink: 1,
  },
});
