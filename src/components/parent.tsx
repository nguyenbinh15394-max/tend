import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, font, parent, radius, space } from '@/theme/tokens';

type Tone = 'primary' | 'secondary' | 'urgent';

const tones: Record<Tone, { bg: string; fg: string; icon: string; border: string }> = {
  primary: { bg: color.accent, fg: color.accentInk, icon: color.accentInk, border: color.accent },
  secondary: { bg: color.surface, fg: color.ink, icon: color.accent, border: color.border },
  urgent: { bg: color.coral, fg: color.accentInk, icon: color.accentInk, border: color.coral },
};

/** One of parent mode's big actions: 96px tall, 40px icon, 26px label. */
export function BigAction({
  icon: Icon,
  label,
  sub,
  tone = 'secondary',
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  sub?: string;
  tone?: Tone;
  onPress?: () => void;
}) {
  const t = tones[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: t.bg, borderColor: t.border, opacity: pressed ? 0.88 : 1 },
      ]}>
      <Icon size={40} color={t.icon} strokeWidth={2.4} aria-hidden />
      <View style={styles.actionText}>
        <Text style={[styles.actionLabel, { color: t.fg }]}>{label}</Text>
        {sub ? <Text style={[styles.actionSub, { color: t.fg }]}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

/** The "Today" summary card at the top of parent mode. */
export function TodayCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    minHeight: parent.action,
    borderRadius: radius.xl,
    borderWidth: 2,
    paddingVertical: 20,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  actionText: { flexShrink: 1 },
  actionLabel: { fontFamily: font.bold, fontSize: parent.actionLabel, lineHeight: parent.actionLabel * 1.15 },
  // The hi-fi draws this at 16px; parent mode never goes below 19px.
  actionSub: { fontFamily: font.regular, fontSize: parent.small, marginTop: 2, opacity: 0.92 },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: color.line,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  cardLabel: { fontFamily: font.regular, fontSize: parent.small, color: color.inkMuted },
  cardText: { fontFamily: font.bold, fontSize: 24, lineHeight: 30, color: color.ink, marginTop: space.xs },
});
