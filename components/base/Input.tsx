import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ReactNode } from 'react';
import { theme } from '@/theme';

interface InputProps {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'number-pad' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  helperAction?: { label: string; onPress?: () => void };
  rightElement?: ReactNode;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  helperAction,
  rightElement,
}: InputProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {helperAction ? (
          <Pressable onPress={helperAction.onPress}>
            <Text style={styles.helper}>{helperAction.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.field}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textFaint}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
        {rightElement}
      </View>
      <View style={styles.focusLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: theme.colors.textFaint,
    fontSize: theme.typography.size.label,
    fontFamily: theme.typography.fontFamily.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  helper: {
    color: theme.colors.accent,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bodyBold,
    textTransform: 'uppercase',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceInset,
    borderWidth: 1,
    borderColor: 'rgba(77, 70, 53, 0.28)',
    paddingHorizontal: theme.spacing.md,
    minHeight: 54,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 15,
  },
  focusLine: {
    height: 2,
    marginHorizontal: theme.spacing.xs,
    backgroundColor: 'rgba(0, 228, 241, 0.45)',
    borderRadius: theme.radius.pill,
  },
});
