import { useState } from 'react';

import { Card, Heading, Small } from '@/components/kit';
import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { useFamily } from '@/lib/family';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** First run for a caregiver: start or join a family circle, then add the parent. */
export function Onboarding() {
  const { family, me, reload } = useFamily();
  const { signOut } = useSession();
  return (
    <Screen>
      <Title>Welcome to Tend</Title>
      {!family ? <StartOrJoin onDone={reload} /> : <AddParent familyId={family.id} canAdd={me?.role !== 'viewer'} onDone={reload} />}
      <Button variant="secondary" label="Sign out" onPress={signOut} />
    </Screen>
  );
}

function StartOrJoin({ onDone }: { onDone: () => Promise<void> }) {
  const [familyName, setFamilyName] = useState('');
  const [myName, setMyName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'start' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'start' | 'join') {
    if (!supabase) return;
    setBusy(kind);
    setError(null);
    const { error } =
      kind === 'start'
        ? await supabase.rpc('create_family', { family_name: familyName.trim(), my_name: myName.trim() })
        : await supabase.rpc('accept_invite', { invite_code: code.trim(), my_name: myName.trim() });
    setBusy(null);
    if (error) setError(error.message);
    else await onDone();
  }

  return (
    <>
      <Body muted>Tend keeps one shared record for the family, and every task gets a named owner.</Body>
      <Field label="Your name" value={myName} onChangeText={setMyName} placeholder="Linh" autoComplete="name" />
      <Card>
        <Heading>Start a family circle</Heading>
        <Small>You'll be the owner: you invite the others and decide what each person can do.</Small>
        <Field label="Family name" value={familyName} onChangeText={setFamilyName} placeholder="Gia đình ông Hòa" />
        <Button
          label="Start the circle"
          onPress={() => run('start')}
          busy={busy === 'start'}
          disabled={!familyName.trim() || !myName.trim()}
        />
      </Card>
      <Card>
        <Heading>Join with an invite code</Heading>
        <Small>Someone in your family sent you an 8-character code.</Small>
        <Field label="Invite code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" maxLength={8} />
        <Button
          variant="secondary"
          label="Join the family"
          onPress={() => run('join')}
          busy={busy === 'join'}
          disabled={code.trim().length !== 8 || !myName.trim()}
        />
      </Card>
      <ErrorText>{error}</ErrorText>
    </>
  );
}

function AddParent({ familyId, canAdd, onDone }: { familyId: string; canAdd: boolean; onDone: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('parents').insert({ family_id: familyId, display_name: name.trim() });
    setBusy(false);
    if (error) setError(error.message);
    else await onDone();
  }

  if (!canAdd) {
    return <Body muted>You're in the circle as a viewer. The owner will add the parent you're caring for.</Body>;
  }

  return (
    <Card>
      <Heading>Who are you caring for?</Heading>
      <Small>The name they'll see in parent mode, the way the family says it, e.g. "ông Hòa" or "Mum".</Small>
      <Field label="Name" value={name} onChangeText={setName} placeholder="ông Hòa" />
      <Small>
        What the family can see is up to them: they choose on their own phone, the first time it's set up.
      </Small>
      <ErrorText>{error}</ErrorText>
      <Button label="Add" onPress={add} busy={busy} disabled={!name.trim()} />
    </Card>
  );
}
