import { Body, NotBuiltYet, Screen, Title } from '@/components/ui';

export default function Overview() {
  return (
    <Screen>
      <Title>Overview</Title>
      <Body muted>Your parent's week: what needs a person, and who owns each item.</Body>
      <NotBuiltYet what="Needs a person, supplies, blood pressure, next check-up and today's medicines appear here." />
    </Screen>
  );
}
