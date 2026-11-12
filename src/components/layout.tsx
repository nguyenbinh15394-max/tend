import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { caregiver, color, font, space } from '@/theme/tokens';

/**
 * Caregiver page layout from the hi-fi (1a, 2a–2e): a main column with a
 * header, white panels and stat tiles, and on wide screens an optional
 * detail panel docked to the right edge.
 */

export const WIDE = 1100;
export const useWide = (min = WIDE) => useWindowDimensions().width >= min;

export function Page({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const wide = useWide();
  const phone = !useWide(600);
  const main = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.main, phone && { paddingHorizontal: 16, paddingVertical: 20 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.mainInner}>
        {children}
        {!wide && aside ? <View style={styles.asideStacked}>{aside}</View> : null}
      </View>
    </ScrollView>
  );
  if (!wide || !aside) return <View style={styles.page}>{main}</View>;
  return (
    <View style={[styles.page, { flexDirection: 'row' }]}>
      {main}
      <ScrollView style={styles.aside} contentContainerStyle={styles.asideInner} keyboardShouldPersistTaps="handled">
        {aside}
      </ScrollView>
    </View>
  );
}

export function PageHeader({ eyebrow, title, actions }: { eyebrow?: string; title: string; actions?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flexShrink: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

export function Panel({ children, style, title, right }: { children?: ReactNode; style?: ViewStyle; title?: string; right?: ReactNode }) {
  return (
    <View style={[styles.panel, style]}>
      {title ? (
        <View style={styles.panelHead}>
          <Text accessibilityRole="header" style={styles.panelTitle}>
            {title}
          </Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Responsive grid: children sit side by side when there is room. */
export function Grid({ children, min = 260, gap = 18 }: { children: ReactNode; min?: number; gap?: number }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>{wrapCells(children, min)}</View>;
}

function wrapCells(children: ReactNode, min: number) {
  const list = Array.isArray(children) ? children : [children];
  return list.filter(Boolean).map((c, i) => (
    <View key={i} style={{ flexGrow: 1, flexBasis: min, minWidth: Math.min(min, 240) }}>
      {c}
    </View>
  ));
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'coral' | 'accent' }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone === 'coral' && { color: color.coral }, tone === 'accent' && { color: color.accent }]}>{value}</Text>
    </View>
  );
}

/** Rounded pill button, as in the hi-fi. */
export function Pill({
  label,
  onPress,
  variant = 'primary',
  busy,
  disabled,
  small,
  full,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'coral' | 'soft';
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
  full?: boolean;
}) {
  const v = pillColors[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.pill,
        small && styles.pillSmall,
        full && { alignSelf: 'stretch' },
        { backgroundColor: hovered && v.hover ? v.hover : v.bg, borderColor: v.border },
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
      ]}>
      {busy ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.pillText, small && { fontSize: 14 }, { color: v.fg }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const pillColors = {
  primary: { bg: color.accent, fg: color.accentInk, border: color.accent, hover: color.accentStrong },
  outline: { bg: color.surface, fg: color.ink, border: color.border, hover: color.surfaceMuted },
  coral: { bg: color.coral, fg: '#FFFFFF', border: color.coral, hover: '#A93A24' },
  soft: { bg: color.accentSoft, fg: color.accentStrong, border: color.accentSoft, hover: '#D5EAE6' },
};

export function Dot({ tone }: { tone: 'coral' | 'amber' | 'green' | 'accent' }) {
  const bg = { coral: color.coral, amber: color.amber, green: color.green, accent: color.accent }[tone];
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: bg }} />;
}

export function Bar({ pct, tone = 'accent' }: { pct: number; tone?: 'accent' | 'amber' | 'coral' }) {
  const fg = { accent: color.accent, amber: color.amber, coral: color.coral }[tone];
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.max(4, Math.min(100, pct))}%`, backgroundColor: fg }]} />
    </View>
  );
}

/** Table header and rows used on Supplies, Health log and Family. */
export function TableHead({ cols }: { cols: { label: string; flex?: number; width?: number; align?: 'center' | 'right' }[] }) {
  return (
    <View style={styles.thead}>
      {cols.map((c) => (
        <Text
          key={c.label}
          style={[styles.th, c.width ? { width: c.width } : { flex: c.flex ?? 1 }, c.align && { textAlign: c.align }]}
          numberOfLines={1}>
          {c.label}
        </Text>
      ))}
    </View>
  );
}

export function TableRow({ children, onPress, highlight }: { children: ReactNode; onPress?: () => void; highlight?: boolean }) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ hovered }) => [styles.tr, highlight && { backgroundColor: '#FFFAF1' }, hovered && onPress && !highlight && { backgroundColor: '#FAFBFB' }]}>
      {children}
    </Pressable>
  );
}

export const t = StyleSheet.create({
  muted: { fontFamily: font.regular, fontSize: 14, color: color.inkMuted },
  small: { fontFamily: font.regular, fontSize: 13, color: color.inkMuted },
  body: { fontFamily: font.regular, fontSize: 15, color: color.ink },
  strong: { fontFamily: font.bold, fontSize: 16, color: color.ink },
  label: { fontFamily: font.bold, fontSize: 13, letterSpacing: 0.3, color: color.inkMuted, textTransform: 'uppercase' },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.bg },
  main: { flexGrow: 1, paddingHorizontal: 32, paddingVertical: 28 },
  mainInner: { width: '100%', maxWidth: 1180, gap: 22 },
  asideStacked: { gap: 18 },
  aside: { width: 380, flexGrow: 0, backgroundColor: color.surface, borderLeftWidth: 1, borderLeftColor: color.line },
  asideInner: { padding: 24, gap: 18, flexGrow: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' },
  eyebrow: { fontFamily: font.regular, fontSize: 15, color: color.inkMuted },
  title: { fontFamily: font.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: color.ink, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  panel: {
    backgroundColor: color.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 12,
  },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  panelTitle: { fontFamily: font.bold, fontSize: 18, color: color.ink },
  stat: { flexGrow: 1, flexBasis: 160, backgroundColor: color.surface, borderRadius: 14, borderWidth: 1, borderColor: color.line, paddingHorizontal: 18, paddingVertical: 14, gap: 4 },
  statLabel: { fontFamily: font.regular, fontSize: 13, color: color.inkMuted },
  statValue: { fontFamily: font.bold, fontSize: 22, color: color.ink, letterSpacing: -0.3 },
  pill: {
    minHeight: caregiver.touch,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  pillSmall: { minHeight: 36, paddingHorizontal: 14 },
  pillText: { fontFamily: font.bold, fontSize: 15 },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: color.surfaceMuted, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  thead: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: color.line },
  th: { fontFamily: font.bold, fontSize: 13, color: color.inkMuted },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: color.surfaceMuted },
});

export { space };
