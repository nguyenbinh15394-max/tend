import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useFamily } from '@/lib/family';
import { useNeeds, type Need } from '@/lib/needs';
import { color, font } from '@/theme/tokens';

import { TopNav } from './top-nav';
import { useWide } from './layout';

/** Picks the hi-fi sidebar on wide screens and the top stepper on narrow ones. */
export function CaregiverNav(props: BottomTabBarProps) {
  const wide = useWide(1000);
  return wide ? <Sidebar {...props} /> : <TopNav {...props} />;
}

const AREA_NAMES: Record<string, string> = {
  medicines: 'medicines',
  appointments: 'appointments',
  health: 'blood pressure',
  emergency_location: 'location in emergencies',
};

/** Hi-fi 1a sidebar: logo, the parent, the six modules with open counts, parent-mode status. */
export function Sidebar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { family, parent } = useFamily();
  const { needs } = useNeeds();
  const count = (module: Need['module']) => needs.filter((n) => n.module === module).length;

  const shared = parent ? (Object.keys(AREA_NAMES) as (keyof typeof AREA_NAMES)[]).filter((k) => parent.consent[k as keyof typeof parent.consent]) : [];

  return (
    <View style={styles.bar}>
      <View style={styles.logoRow}>
        <View style={styles.logo}>
          <Text style={styles.logoT}>t</Text>
        </View>
        <Text style={styles.brand}>Tend</Text>
      </View>

      {parent ? (
        <View style={styles.parentCard}>
          <View style={styles.parentAvatar}>
            <Text style={styles.parentInitial}>{parent.display_name.trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.parentName} numberOfLines={1}>
              {parent.display_name}
            </Text>
            <Text style={styles.parentSub} numberOfLines={1}>
              {family?.name}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ gap: 2 }} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const label = descriptors[route.key]?.options.title ?? route.name;
          const badge = route.name === 'supplies' || route.name === 'appointments' || route.name === 'health' ? count(route.name) : 0;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${label}, ${badge} need a person` : label}
              onPress={onPress}
              style={({ hovered }) => [styles.item, focused ? styles.itemActive : hovered && styles.itemHover]}>
              <Text style={[styles.itemText, focused && styles.itemTextActive]}>{label}</Text>
              {badge ? <Text style={styles.badge}>{badge}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {parent ? (
        <Pressable onPress={() => router.navigate('/family')} style={[styles.status, !parent.consent_updated_at && styles.statusOff]}>
          {parent.consent_updated_at ? (
            <>
              <Text style={styles.statusTitle}>Parent mode is on</Text>
              <Text style={styles.statusText}>
                {shared.length
                  ? `${parent.display_name} chose to share ${joinList(shared.map((k) => AREA_NAMES[k]))}.`
                  : `${parent.display_name} isn't sharing anything right now.`}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.statusTitle, { color: color.amberStrong }]}>Parent mode is off</Text>
              <Text style={[styles.statusText, { color: color.amberStrong }]}>Set up {parent.display_name}&apos;s phone in Family.</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

function joinList(items: string[]) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const styles = StyleSheet.create({
  bar: {
    width: 248,
    backgroundColor: color.surface,
    borderRightWidth: 1,
    borderRightColor: color.line,
    paddingVertical: 24,
    paddingHorizontal: 18,
    gap: 26,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6 },
  logo: { width: 30, height: 30, borderRadius: 9, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  logoT: { fontFamily: font.bold, fontSize: 17, color: '#fff', marginTop: -2 },
  brand: { fontFamily: font.bold, fontSize: 21, color: color.ink, letterSpacing: -0.2 },
  parentCard: { backgroundColor: color.bg, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  parentAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#CFE6E2', alignItems: 'center', justifyContent: 'center' },
  parentInitial: { fontFamily: font.bold, fontSize: 16, color: color.accentStrong },
  parentName: { fontFamily: font.bold, fontSize: 15, color: color.ink },
  parentSub: { fontFamily: font.regular, fontSize: 13, color: color.inkMuted },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10 },
  itemActive: { backgroundColor: color.accentSoft },
  itemHover: { backgroundColor: color.bg },
  itemText: { fontFamily: font.regular, fontSize: 15.5, color: color.ink },
  itemTextActive: { fontFamily: font.bold, color: color.accentStrong },
  badge: { fontFamily: font.bold, fontSize: 12.5, color: color.coral },
  status: { marginTop: 'auto', backgroundColor: color.accentSoft, borderRadius: 12, padding: 14, gap: 4 },
  statusOff: { backgroundColor: color.amberSoft },
  statusTitle: { fontFamily: font.bold, fontSize: 14, color: color.accentStrong },
  statusText: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: color.accentStrong },
});
