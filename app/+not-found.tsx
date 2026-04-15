import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/base/Button';
import { Screen } from '@/components/base/Screen';
import { theme } from '@/theme';

export default function NotFoundScreen() {
  return (
    <Screen centered>
      <View style={styles.wrapper}>
        <Text style={styles.title}>Tela não encontrada</Text>
        <Text style={styles.description}>
          Essa rota ainda não existe na arena atual. Você pode voltar para o lobby e seguir o fluxo principal.
        </Text>
        <Button title="Voltar ao início" onPress={() => router.replace('/(main)/home')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    maxWidth: 480,
    gap: theme.spacing.lg,
    alignItems: 'center',
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 32,
    textAlign: 'center',
  },
  description: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
});
