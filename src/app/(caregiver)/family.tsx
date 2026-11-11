import { Body, Button, NotBuiltYet, Screen, Title } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function Family() {
  const { session, signOut } = useSession();
  return (
    <Screen>
      <Title>Family</Title>
      <Body muted>Who is in the circle, their roles, and what each person can do.</Body>
      <NotBuiltYet what="Flow 3 · Family circle with roles and permissions. Built in the Build phase." />
      <Body muted>Signed in as {session?.user.email}</Body>
      <Button variant="secondary" label="Sign out" onPress={signOut} />
    </Screen>
  );
}
