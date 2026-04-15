import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Input } from '@/components/base/Input';
import { Screen } from '@/components/base/Screen';
import { BrandMark } from '@/components/layout/BrandMark';
import { useAuth } from '@/hooks/useAuth';
import { theme } from '@/theme';

export function LoginScreenView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn } = useAuth();

  async function handleSignIn() {
    try {
      setErrorMessage('');
      setIsSubmitting(true);
      await signIn(email.trim(), password);
      router.replace('/(main)/home');
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Não foi possível entrar agora.';
      if (message.toLowerCase().includes('email not confirmed')) {
        message = 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
      }
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen centered>
      <View style={styles.wrapper}>
        <BrandMark center compact />
        <Card variant="low">
          <View style={styles.cardContent}>
            <Text style={styles.title}>Entrar na Arena</Text>
            <Input label="Email" value={email} onChangeText={setEmail} placeholder="seu@email.com" />
            <Input
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              helperAction={{ label: 'Esqueceu?' }}
            />
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            <Button
              title={isSubmitting ? 'Entrando...' : 'Entrar e Jogar'}
              onPress={handleSignIn}
              icon={isSubmitting ? <ActivityIndicator color="#241A00" /> : undefined}
            />
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>Ou continue com</Text>
              <View style={styles.divider} />
            </View>
            <View style={styles.socialRow}>
              <Button title="Google" variant="secondary" />
              <Button title="Apple" variant="secondary" />
            </View>
          </View>
        </Card>
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Ainda não tem conta?{' '}
            <Text style={styles.footerLink} onPress={() => router.push('/cadastro')}>
              Criar Conta
            </Text>
          </Text>
          <Text style={styles.legal}>Termos • Privacidade</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    maxWidth: theme.layout.maxCardWidth,
    alignSelf: 'center',
    paddingTop: theme.spacing.xxl,
    gap: theme.spacing.xl,
  },
  cardContent: {
    gap: theme.spacing.lg,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 34,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 20,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(77, 70, 53, 0.22)',
  },
  dividerText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  socialRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  footer: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  footerText: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  footerLink: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodyBold,
  },
  legal: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
