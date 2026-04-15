import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Input } from '@/components/base/Input';
import { Screen } from '@/components/base/Screen';
import { BrandMark } from '@/components/layout/BrandMark';
import { useAuth } from '@/hooks/useAuth';
import { theme } from '@/theme';

export function CadastroScreenView() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signUp } = useAuth();

  async function handleSignUp() {
    try {
      setErrorMessage('');
      setIsSubmitting(true);
      await signUp(email.trim(), password, name.trim());
      Alert.alert(
        'Confirme seu e-mail',
        `Enviamos um link de confirmação para ${email.trim()}. Verifique sua caixa de entrada antes de entrar.`,
        [{ text: 'OK', onPress: () => router.replace('/login') }],
      );
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
            <Text style={styles.subtitle}>Monte sua identidade na arena e deixe a base pronta para ranking, carteira e partidas ao vivo.</Text>
            <Input label="Nome de jogador" value={name} onChangeText={setName} placeholder="Seu apelido" />
            <Input label="Email" value={email} onChangeText={setEmail} placeholder="voce@dominio.com" />
            <Input label="Senha" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
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
});
