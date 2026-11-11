import { Body, NotBuiltYet, Screen, Title } from '@/components/ui';

export default function HealthLog() {
  return (
    <Screen>
      <Title>Health log</Title>
      <Body muted>30 days of readings, with ranges set with the doctor. Visible only if your parent shares it.</Body>
      <NotBuiltYet what="Blood pressure, glucose and weight readings appear here." />
    </Screen>
  );
}
