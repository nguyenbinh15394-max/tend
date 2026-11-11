import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/**
 * Pairs this phone with a parent, once. The phone signs in anonymously (no
 * account, no password for the parent), then exchanges the 6-character code a
 * caregiver generated. After that it opens straight into parent mode.
 */
export default function Pair() {
  const { mode, refreshPairing, signOut } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pair() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signed-out') {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
      }
      const { error } = await supabase.rpc('pair_device', { pairing_code: code.trim() });
      if (error) throw error;
      await refreshPairing();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      const offline = /fetch|network/i.test(message);
      setError(
        offline
          ? "Can't reach Tend right now. Check the internet connection and try again."
          : message || 'Something went wrong. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function back() {
    if (mode === 'pairing') await signOut();
    else router.back();
  }

  return (
    <Screen surface="parent">
      <Title surface="parent">Set up this phone</Title>
      <Body surface="parent">Ask your family for the 6-character code on their screen.</Body>
      <Field
        surface="parent"
        label="Code"
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        onSubmitEditing={pair}
      />
      <ErrorText surface="parent">{error}</ErrorText>
      <Button surface="parent" label="Continue" onPress={pair} busy={busy} disabled={code.trim().length !== 6} />
      <Button surface="parent" variant="secondary" label="Back" onPress={back} />
    </Screen>
  );
}
