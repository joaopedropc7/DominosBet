import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Input } from '@/components/base/Input';
import { Screen } from '@/components/base/Screen';
import { BrandMark } from '@/components/layout/BrandMark';
import { useAuth } from '@/hooks/useAuth';
import { theme } from '@/theme';

export function CadastroScreenView() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const refCode = (params.ref ?? '').trim().toUpperCase();

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signUp } = useAuth();

  async function handleSignUp() {
    try {
      setErrorMessage('');
      setIsSubmitting(true);
      await signUp(email.trim(), password, name.trim(), refCode || undefined);
      router.replace('/(main)/home');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível criar sua conta agora.';
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
            <Text style={styles.title}>Criar conta competitiva</Text>
            <Text style={styles.subtitle}>
              Monte sua identidade na arena e deixe a base pronta para ranking, carteira e partidas ao vivo.
            </Text>
            <Input label="Nome de jogador" value={name} onChangeText={setName} placeholder="Seu apelido" />
            <Input label="Email" value={email} onChangeText={setEmail} placeholder="voce@dominio.com" autoCapitalize="none" />
            <Input label="Senha" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
            {refCode ? (
              <View style={styles.refField}>
                <Text style={styles.refLabel}>Código de indicação</Text>
                <View style={styles.refBox}>
                  <Text style={styles.refCode}>{refCode}</Text>
                  <View style={styles.refLock}>
                    <Text style={styles.refLockText}>Bloqueado</Text>
                  </View>
                </View>
              </View>
            ) : null}
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            <Button
              title={isSubmitting ? 'Criando conta...' : 'Criar e entrar'}
              onPress={handleSignUp}
              icon={isSubmitting ? <ActivityIndicator color="#241A00" /> : undefined}
            />
            <Button title="Voltar para login" variant="ghost" onPress={() => router.back()} />
          </View>
        </Card>
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
    fontSize: 32,
  },
  subtitle: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 20,
  },

  refField: { gap: 6 },
  refLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  refBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceInset,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
    gap: theme.spacing.sm,
  },
  refCode: {
    flex: 1,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
    letterSpacing: 1,
  },
  refLock: {
    backgroundColor: theme.colors.surfaceHigh,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  refLockText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 10,
  },
});
