import { Body, Screen, Title } from '@/components/ui';

export default function Setup() {
  return (
    <Screen>
      <Title>Connect Supabase</Title>
      <Body>
        Tend needs a Supabase project. Copy .env.example to .env, add the project URL and anon key, then
        restart the dev server.
      </Body>
      <Body muted>Step-by-step instructions are in supabase/README.md.</Body>
    </Screen>
  );
}
