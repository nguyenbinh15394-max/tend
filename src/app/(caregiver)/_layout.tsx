import { Tabs } from 'expo-router/js-tabs';
import { ActivityIndicator, View } from 'react-native';

import { Onboarding } from '@/components/onboarding';
import { FamilyProvider, useFamily } from '@/lib/family';
import { TopNav } from '@/components/top-nav';
import { color } from '@/theme/tokens';

export default function CaregiverLayout() {
  return (
    <FamilyProvider>
      <Gate />
    </FamilyProvider>
  );
}

/** No family or no parent yet → onboarding. Otherwise the six modules from the hi-fi. */
function Gate() {
  const { loading, family, parent } = useFamily();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg }}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }

  if (!family || !parent) return <Onboarding />;

  return (
    <Tabs tabBar={(props) => <TopNav {...props} />} screenOptions={{ headerShown: false, tabBarPosition: 'top' }}>
      <Tabs.Screen name="overview" options={{ title: 'Overview' }} />
      <Tabs.Screen name="supplies" options={{ title: 'Supplies' }} />
      <Tabs.Screen name="appointments" options={{ title: 'Appointments' }} />
      <Tabs.Screen name="health" options={{ title: 'Health log' }} />
      <Tabs.Screen name="medicines" options={{ title: 'Medicines' }} />
      <Tabs.Screen name="family" options={{ title: 'Family' }} />
    </Tabs>
  );
}
