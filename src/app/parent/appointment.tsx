import { router } from 'expo-router';
import { Phone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { BigAction } from '@/components/parent';
import { Body, Button, Screen, Title } from '@/components/ui';
import { useCallList, useParentRecord } from '@/lib/parent-data';
import { parentStrings } from '@/lib/parent-strings';
import { supabase } from '@/lib/supabase';
import type { Appointment } from '@/lib/types';
import { color, font, parent as scale, radius, space } from '@/theme/tokens';

/** Hi-fi 1b · Next check-up: when, where, who takes you, and a button to call them. */
export default function NextAppointment() {
  const t = parentStrings('vi');
  const { parent } = useParentRecord();
  const callList = useCallList();
  const [appt, setAppt] = useState<Appointment | null | undefined>(undefined);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!supabase || !parent) return;
    supabase
      .from('appointments')
      .select('*')
      .eq('parent_id', parent.id)
      .eq('status', 'scheduled')
      .gte('starts_at', new Date(Date.now() - 3 * 3600_000).toISOString())
      .order('starts_at')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setAppt((data ?? null) as Appointment | null));
    supabase.rpc('my_family_names').then(({ data }) => {
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as { member_id: string; display_name: string }[]) map[row.member_id] = row.display_name;
      setNames(map);
    });
  }, [parent]);

  const when = appt ? new Date(appt.starts_at) : null;
  const driver = appt?.driver_member_id ? names[appt.driver_member_id] : null;
  const driverPhone = driver ? callList.find((c) => c.display_name === driver)?.phone : null;

  return (
    <Screen surface="parent">
      <Button surface="parent" variant="secondary" label={`← ${t.back}`} onPress={() => router.back()} />
      <Title surface="parent">{t.appointment}</Title>

      {appt === null ? (
        <Body surface="parent" muted>
          {t.noAppointment}
        </Body>
      ) : appt && when ? (
        <>
          <View style={styles.card}>
            <Text style={styles.day}>
              {new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(when)}
            </Text>
            <Text style={styles.time}>{`${when.getHours()}:${String(when.getMinutes()).padStart(2, '0')}`}</Text>
            {appt.place ? <Text style={styles.place}>{appt.place}</Text> : null}
            <Text style={styles.what}>{appt.title}</Text>
          </View>
          <Body surface="parent">{driver ? t.driver(driver) : t.noDriver}</Body>
          {appt.notes ? <Body surface="parent" muted>{appt.notes}</Body> : null}
          {driver && driverPhone ? (
            <BigAction
              icon={Phone}
              label={t.callPerson(driver)}
              onPress={() => Linking.openURL(`tel:${driverPhone.replace(/\s+/g, '')}`)}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: color.line,
    padding: 20,
    gap: space.xs,
  },
  day: { fontFamily: font.regular, fontSize: scale.small, color: color.inkMuted },
  time: { fontFamily: font.bold, fontSize: 48, lineHeight: 56, color: color.ink },
  place: { fontFamily: font.bold, fontSize: scale.text, color: color.ink },
  what: { fontFamily: font.regular, fontSize: scale.small, color: color.inkMuted },
});
