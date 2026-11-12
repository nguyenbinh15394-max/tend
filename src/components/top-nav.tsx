import type { BottomTabBarProps } from 'expo-router/js-tabs';
import {
  CalendarDays,
  HeartPulse,
  LayoutDashboard,
  Package,
  Pill,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { Fragment, useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFamily } from '@/lib/family';
import { caregiver, color, font, space } from '@/theme/tokens';

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  supplies: Package,
  appointments: CalendarDays,
  health: HeartPulse,
  medicines: Pill,
  family: Users,
};

/**
 * Caregiver navigation as a stepper across the top: one node per module,
 * joined by a line. The active module is a filled teal node. Scrolls
 * sideways on narrow screens instead of squeezing the labels.
 */
export function TopNav({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { family, parent } = useFamily();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const xs = useRef<Record<number, number>>({});

  // Keep the active module in view on narrow screens.
  useEffect(() => {
    const x = xs.current[state.index];
    if (x !== undefined) scroller.current?.scrollTo({ x: Math.max(0, x - space.xl), animated: true });
  }, [state.index]);

  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.inner}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Tend</Text>
          {parent && family ? (
            <Text style={styles.context} numberOfLines={1}>
              {parent.display_name} · {family.name}
            </Text>
          ) : null}
        </View>

        <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.steps}>
          {state.routes.map((route, i) => {
            const focused = state.index === i;
            const label = descriptors[route.key]?.options.title ?? route.name;
            const Icon = ICONS[route.name] ?? LayoutDashboard;
            const onPress = () => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            };

            return (
              <Fragment key={route.key}>
                {i > 0 ? <View style={[styles.line, i <= state.index && styles.lineDone]} /> : null}
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={label}
                  onPress={onPress}
                  onLayout={(e) => {
                    xs.current[i] = e.nativeEvent.layout.x;
                    if (focused) scroller.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - space.xl), animated: false });
                  }}
                  style={({ hovered }) => [styles.step, hovered && !focused && styles.stepHover]}>
                  <View style={[styles.node, focused && styles.nodeActive]}>
                    <Icon size={18} color={focused ? color.accentInk : color.inkMuted} strokeWidth={2} />
                  </View>
                  <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              </Fragment>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const NODE = 36;

const styles = StyleSheet.create({
  bar: {
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    paddingBottom: space.sm,
  },
  inner: {
    width: '100%',
    maxWidth: caregiver.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  brandRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  brand: { fontFamily: font.bold, fontSize: 20, color: color.accent },
  context: { fontFamily: font.regular, fontSize: caregiver.small, color: color.inkMuted, flexShrink: 1 },
  steps: { flexGrow: 1, alignItems: 'flex-start', justifyContent: 'space-between' },
  step: {
    alignItems: 'center',
    gap: space.xs,
    minWidth: 84,
    minHeight: caregiver.touch,
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
    borderRadius: 12,
  },
  stepHover: { backgroundColor: color.surfaceMuted },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.border,
  },
  nodeActive: { backgroundColor: color.accent, borderColor: color.accent },
  line: {
    flexGrow: 1,
    minWidth: 12,
    height: 2,
    marginTop: space.xs + NODE / 2 - 1,
    backgroundColor: color.line,
  },
  lineDone: { backgroundColor: color.accentSoft },
  label: { fontFamily: font.regular, fontSize: 13, color: color.inkMuted },
  labelActive: { fontFamily: font.bold, color: color.accentStrong },
});
