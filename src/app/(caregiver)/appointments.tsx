import { Body, NotBuiltYet, Screen, Title } from '@/components/ui';

export default function Appointments() {
  return (
    <Screen>
      <Title>Appointments</Title>
      <Body muted>Book an appointment and assign who drives.</Body>
      <NotBuiltYet what="Flow 2 · Appointments (book + assign a driver). Built in the Build phase." />
    </Screen>
  );
}
