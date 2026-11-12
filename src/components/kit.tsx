import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, type ViewStyle } from 'react-native';

import { caregiver, color, font, radius, space } from '@/theme/tokens';

/** Caregiver building blocks, following the hi-fi web screens. */

type Tone = 'neutral' | 'accent' | 'coral' | 'amber' | 'green';

const toneColors: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: color.surfaceMuted, fg: color.inkMuted },
  accent: { bg: color.accentSoft, fg: color.accentStrong },
  coral: { bg: color.coralSoft, fg: color.coral },
  amber: { bg: color.amberSoft, fg: color.amberStrong },
  green: { bg: color.greenSoft, fg: color.green },
};

export function Card({ children, highlight, style }: { children: ReactNode; highlight?: boolean; style?: ViewStyle }) {
  return <View style={[styles.card, highlight && { backgroundColor: '#FFFAF1' }, style]}>{children}</View>;
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

export function Small({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return <Text style={[styles.small, tone && tone !== 'neutral' && { color: toneColors[tone].fg }]}>{children}</Text>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <Text style={styles.strong}>{children}</Text>;
}

export function Row({ children, gap = space.sm, wrap = true }: { children: ReactNode; gap?: number; wrap?: boolean }) {
  return <View style={{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: 'center', gap }}>{children}</View>;
}

export function Spread({ children }: { children: ReactNode }) {
  return <View style={styles.spread}>{children}</View>;
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, tone = 'accent' }: { name: string; tone?: Tone }) {
  const t = toneColors[tone];
  return (
    <View style={[styles.avatar, { backgroundColor: t.bg }]} aria-hidden>
      <Text style={[styles.avatarText, { color: t.fg }]}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: color.accent, borderColor: color.accent }
          : { backgroundColor: color.surface, borderColor: color.border },
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
      ]}>
      <Text style={[styles.chipText, { color: selected ? color.accentInk : color.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Toggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggle}>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled || !onChange}
        trackColor={{ true: color.accent, false: color.border }}
        thumbColor="#FFFFFF"
        {...({ activeThumbColor: '#FFFFFF' } as object)}
      />
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

/** A big, copyable code (invite or pairing code). */
export function CodeBox({ code, caption }: { code: string; caption: string }) {
  return (
    <View style={styles.codeBox}>
      <Text selectable style={styles.code} accessibilityLabel={code.split('').join(' ')}>
        {code}
      </Text>
      <Small>{caption}</Small>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.md,
    gap: space.sm,
  },
  heading: { fontFamily: font.bold, fontSize: 18, color: color.ink },
  small: { fontFamily: font.regular, fontSize: caregiver.small, lineHeight: caregiver.small * 1.4, color: color.inkMuted },
  strong: { fontFamily: font.bold, fontSize: caregiver.text, color: color.ink },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontFamily: font.bold, fontSize: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 15 },
  chip: {
    minHeight: caregiver.touch,
    minWidth: caregiver.touch,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: font.bold, fontSize: caregiver.small },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: caregiver.touch },
  codeBox: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    backgroundColor: color.accentSoft,
    borderRadius: radius.lg,
  },
  code: { fontFamily: font.bold, fontSize: 36, letterSpacing: 6, color: color.accentStrong },
});
