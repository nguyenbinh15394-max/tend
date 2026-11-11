import { Tabs } from 'expo-router/js-tabs';

import { color, font } from '@/theme/tokens';

/** The six caregiver modules from the hi-fi. */
export default function CaregiverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.accentStrong,
        tabBarInactiveTintColor: color.inkMuted,
        tabBarActiveBackgroundColor: color.accentSoft,
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.line },
        tabBarLabelStyle: { fontFamily: font.bold, fontSize: 13 },
        tabBarIcon: () => null,
      }}>
      <Tabs.Screen name="overview" options={{ title: 'Overview' }} />
      <Tabs.Screen name="supplies" options={{ title: 'Supplies' }} />
      <Tabs.Screen name="appointments" options={{ title: 'Appointments' }} />
      <Tabs.Screen name="health" options={{ title: 'Health log' }} />
      <Tabs.Screen name="medicines" options={{ title: 'Medicines' }} />
      <Tabs.Screen name="family" options={{ title: 'Family' }} />
    </Tabs>
  );
}
