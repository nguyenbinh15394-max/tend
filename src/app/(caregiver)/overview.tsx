import { Body, NotBuiltYet, Screen, Title } from '@/components/ui';

export default function Today() {
  return (
    <Screen>
      <Title>Today</Title>
      <Body muted>What needs doing for Mum and Dad, and who is on it.</Body>
      <NotBuiltYet what="Due supplies and upcoming appointments, each with its owner, appear here." />
    </Screen>
  );
}
