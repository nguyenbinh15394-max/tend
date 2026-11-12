import { router } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';

/**
 * Caregivers sign in with a magic link sent by email (no passwords). The
 * caregiver app is web first: the link opens the app and signs you in.
 *
 * A 6-digit code would also work on phones, but editing Supabase's email
 * template needs custom SMTP; until then the default template only has a link.
 */
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: Platform.OS === 'web' ? window.location.origin : undefined,
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <Screen>
      <Title>Sign in</Title>
      {!sent ? (
        <>
          <Body muted>We'll email you a sign-in link. No password needed.</Body>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            onSubmitEditing={sendLink}
          />
          <ErrorText>{error}</ErrorText>
          <Button label="Email me a link" onPress={sendLink} busy={busy} disabled={!email.includes('@')} />
        </>
      ) : (
        <>
          <Body>Check {email.trim()} and open the link on this device. It works once and expires soon.</Body>
          <Button variant="secondary" label="Use a different email" onPress={() => setSent(false)} />
        </>
      )}
      <Button variant="secondary" label="Back" onPress={() => router.back()} />
    </Screen>
  );
}
