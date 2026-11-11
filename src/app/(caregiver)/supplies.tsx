import { Body, NotBuiltYet, Screen, Title } from '@/components/ui';

export default function Supplies() {
  return (
    <Screen>
      <Title>Supplies</Title>
      <Body muted>Recurring things to reorder, each with a named owner.</Body>
      <NotBuiltYet what="Flow 1 · Recurring supplies. Built in the Build phase." />
    </Screen>
  );
}
