import { router } from 'expo-router';

import { Body, Button, Screen, Title } from '@/components/ui';

export default function Welcome() {
  return (
    <Screen>
      <Title>Tend</Title>
      <Body>Care for your parents, shared across the family.</Body>
      <Button label="I help care for someone" onPress={() => router.push('/sign-in')} />
      <Button
        variant="secondary"
        label="Set up this phone for my parent"
        hint="Opens parent mode. No account needed on the parent's phone."
        onPress={() => router.push('/pair')}
      />
    </Screen>
  );
}
