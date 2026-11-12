import { router } from 'expo-router';
import { Phone } from 'lucide-react-native';
import { Linking } from 'react-native';

import { BigAction } from '@/components/parent';
import { Body, Button, Screen, Title } from '@/components/ui';
import { useCallList } from '@/lib/parent-data';
import { parentStrings } from '@/lib/parent-strings';

/**
 * "Call my children": the family's call order, first person on top.
 * The phone's own dialer places the call.
 */
export default function CallFamily() {
  const t = parentStrings('vi');
  const list = useCallList();

  return (
    <Screen surface="parent">
      <Button surface="parent" variant="secondary" label={`← ${t.back}`} onPress={() => router.back()} />
      <Title surface="parent">{t.call}</Title>
      {list.length === 0 ? (
        <Body surface="parent" muted>
          {t.noOneToCall}
        </Body>
      ) : (
        list.map((p, i) => (
          <BigAction
            key={p.call_order}
            tone={i === 0 ? 'urgent' : 'secondary'}
            icon={Phone}
            label={t.callPerson(p.display_name)}
            sub={p.phone}
            onPress={() => Linking.openURL(`tel:${p.phone.replace(/\s+/g, '')}`)}
          />
        ))
      )}
    </Screen>
  );
}
