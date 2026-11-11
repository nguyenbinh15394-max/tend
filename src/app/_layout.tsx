import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Routes />
    </SessionProvider>
  );
}

/**
 * One app, two products. Which screens exist depends on who is holding it:
 * a caregiver account gets the caregiver app, a paired phone gets parent mode.
 */
function Routes() {
  const { mode } = useSession();
  const [fontsLoaded] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  const ready = fontsLoaded && mode !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Always reachable, and where a guard sends you when access changes. */}
      <Stack.Screen name="index" />

      <Stack.Protected guard={mode === 'setup'}>
        <Stack.Screen name="setup" />
      </Stack.Protected>

      <Stack.Protected guard={mode === 'signed-out'}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      <Stack.Protected guard={mode === 'signed-out' || mode === 'pairing'}>
        <Stack.Screen name="pair" />
      </Stack.Protected>

      <Stack.Protected guard={mode === 'caregiver'}>
        <Stack.Screen name="(caregiver)" />
      </Stack.Protected>

      <Stack.Protected guard={mode === 'parent'}>
        <Stack.Screen name="parent" />
      </Stack.Protected>
    </Stack>
  );
}
