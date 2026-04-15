import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { getAvatarOption } from '@/constants/avatars';
import { theme } from '@/theme';

interface AvatarProps {
  avatarId?: string | null;
  size?: number;
  highlighted?: boolean;
}

export function Avatar({ avatarId, size = 96, highlighted = false }: AvatarProps) {
  const avatar = getAvatarOption(avatarId);
  const iconSize = Math.round(size * 0.48);

  return (
    <LinearGradient colors={avatar.colors} style={[styles.shell, { width: size, height: size, borderRadius: size / 2 }, highlighted && styles.highlighted]}>
      <View style={[styles.inner, { borderRadius: (size - 8) / 2 }]}>
        <MaterialCommunityIcons name={avatar.icon} size={iconSize} color={theme.colors.text} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  inner: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(16,16,16,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  highlighted: {
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
});
