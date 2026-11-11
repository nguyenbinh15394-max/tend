import { Body, Button, Screen, Title } from '@/components/ui';

/**
 * Parent mode home: no login, three actions, large type, 64px+ targets.
 * The three actions below are placeholders until they are matched to the
 * hi-fi parent screens.
 */
export default function ParentHome() {
  return (
    <Screen surface="parent">
      <Title surface="parent">Good morning</Title>
      <Body surface="parent" muted>
        Your family is here to help.
      </Body>
      <Button surface="parent" label="Action one" disabled />
      <Button surface="parent" label="Action two" disabled />
      <Button surface="parent" label="Action three" disabled />
    </Screen>
  );
}
