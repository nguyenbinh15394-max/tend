import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// EXPO_PUBLIC_ values are bundled into the app for anyone to read. A secret /
// service_role key there would bypass every RLS policy, so refuse to start.
if (anonKey && (anonKey.startsWith('sb_secret_') || /service_role/.test(decodeJwtRole(anonKey)))) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY is a secret key. Use the publishable (anon) key from Project Settings → API Keys.'
  );
}

function decodeJwtRole(key: string) {
  try {
    const payload = key.split('.')[1];
    return payload ? (JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role ?? '') : '';
  } catch {
    return '';
  }
}

/**
 * The Supabase client, or null until `.env` has the project URL and anon key
 * (the app then shows a setup screen instead of crashing).
 *
 * Only the anon / publishable key belongs in the app. Row-level security in
 * supabase/migrations decides what each user can read and write.
 */
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          // Caregivers sign in with an email magic link; on web the link
          // lands back on the app with the session in the URL.
          detectSessionInUrl: Platform.OS === 'web',
          lock: processLock,
        },
      })
    : null;

// On phones, only refresh the session while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
