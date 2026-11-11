import { Body, NotBuiltYet, Screen, Title } from '@/components/ui';

export default function Medicines() {
  return (
    <Screen>
      <Title>Medicines</Title>
      <Body muted>The week at a glance. Gaps show patterns.</Body>
      <NotBuiltYet what="Each dose for the week, taken or missed, appears here." />
    </Screen>
  );
}
