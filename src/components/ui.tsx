import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { caregiver, color, font, parent, radius, space, type Scale } from '@/theme/tokens';

type Surface = 'caregiver' | 'parent';
const scaleFor = (surface: Surface): Scale => (surface === 'parent' ? parent : caregiver);

export function Screen({ surface = 'caregiver', children }: { surface?: Surface; children: ReactNode }) {
  const scale = scaleFor(surface);
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.column, { maxWidth: scale.maxWidth }]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ surface = 'caregiver', children }: { surface?: Surface; children: ReactNode }) {
  const scale = scaleFor(surface);
  return (
    <Text accessibilityRole="header" style={[styles.title, { fontSize: scale.title, lineHeight: scale.title * 1.2 }]}>
      {children}
    </Text>
  );
}

export function Body({
  surface = 'caregiver',
  muted,
  children,
}: {
  surface?: Surface;
  muted?: boolean;
  children: ReactNode;
}) {
  const scale = scaleFor(surface);
  return (
    <Text
      style={[
        styles.body,
        { fontSize: scale.text, lineHeight: scale.text * 1.45 },
        muted && { color: color.inkMuted },
      ]}>
      {children}
    </Text>
  );
}

export function ErrorText({ surface = 'caregiver', children }: { surface?: Surface; children: ReactNode }) {
  if (!children) return null;
  const scale = scaleFor(surface);
  return (
    <Text accessibilityRole="alert" style={[styles.body, { fontSize: scale.small, color: color.danger }]}>
      {children}
    </Text>
  );
}

export function Button({
  surface = 'caregiver',
  variant = 'primary',
  label,
  hint,
  onPress,
  busy,
  disabled,
}: {
  surface?: Surface;
  variant?: 'primary' | 'secondary';
  label: string;
  hint?: string;
  onPress?: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const scale = scaleFor(surface);
  const primary = variant === 'primary';
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: scale.touch,
          paddingHorizontal: surface === 'parent' ? space.lg : space.md,
          backgroundColor: primary ? color.accent : color.surface,
          borderColor: primary ? color.accent : color.line,
          opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}>
      {busy ? (
        <ActivityIndicator color={primary ? color.accentInk : color.accent} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            { fontSize: surface === 'parent' ? parent.text : caregiver.text },
            { color: primary ? color.accentInk : color.ink },
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  surface = 'caregiver',
  label,
  ...input
}: TextInputProps & { surface?: Surface; label: string }) {
  const scale = scaleFor(surface);
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[styles.label, { fontSize: scale.small }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color.inkMuted}
        {...input}
        style={[styles.input, { minHeight: scale.touch, fontSize: scale.text }]}
      />
    </View>
  );
}

/** Marks a screen that is laid out but not built yet (Build phase). */
export function NotBuiltYet({ what }: { what: string }) {
  return (
    <View style={styles.placeholder}>
      <Body muted>{what}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  scroll: { flexGrow: 1, padding: space.md },
  column: { width: '100%', alignSelf: 'center', gap: space.md, paddingVertical: space.lg },
  title: { fontFamily: font.bold, color: color.ink },
  body: { fontFamily: font.regular, color: color.ink },
  label: { fontFamily: font.bold, color: color.ink },
  input: {
    fontFamily: font.regular,
    color: color.ink,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  button: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
  },
  buttonLabel: { fontFamily: font.bold, textAlign: 'center' },
  placeholder: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.line,
    borderRadius: radius.lg,
    padding: space.lg,
  },
});
