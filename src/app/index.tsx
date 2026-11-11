import { Redirect } from 'expo-router';

import { useSession } from '@/lib/session';

/** Sends each person to their own product. */
export default function Index() {
  const { mode } = useSession();
  switch (mode) {
    case 'setup':
      return <Redirect href="/setup" />;
    case 'caregiver':
      return <Redirect href="/overview" />;
    case 'parent':
      return <Redirect href="/parent" />;
    case 'pairing':
      return <Redirect href="/pair" />;
    default:
      return <Redirect href="/welcome" />;
  }
}
