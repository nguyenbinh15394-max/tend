import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';

/**
 * Caregivers sign in with a one-time code sent by email (no passwords).
 * The same flow works on web and phones.
 */
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verify() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(error.message);
    // On success the session changes and the caregiver app takes over.
  }

  return (
    <Screen>
      <Title>Sign in</Title>
      {!sent ? (
        <>
          <Body muted>We'll email you a code. No password needed.</Body>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            onSubmitEditing={sendCode}
          />
          <ErrorText>{error}</ErrorText>
          <Button label="Email me a code" onPress={sendCode} busy={busy} disabled={!email.includes('@')} />
        </>
      ) : (
        <>
          <Body muted>Enter the code we sent to {email.trim()}.</Body>
          <Field
            label="Code"
            value={code}
            onChangeText={setCode}
            autoComplete="one-time-code"
            inputMode="numeric"
            onSubmitEditing={verify}
          />
          <ErrorText>{error}</ErrorText>
          <Button label="Sign in" onPress={verify} busy={busy} disabled={code.trim().length < 6} />
          <Button variant="secondary" label="Use a different email" onPress={() => setSent(false)} />
        </>
      )}
      <Button variant="secondary" label="Back" onPress={() => router.back()} />
    </Screen>
  );
}
