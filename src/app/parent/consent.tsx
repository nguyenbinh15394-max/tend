import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, ErrorText, Screen, Title } from '@/components/ui';
import { honorific, parentStrings } from '@/lib/parent-strings';
import { useParentRecord } from '@/lib/parent-data';
import { supabase } from '@/lib/supabase';
import type { ConsentArea } from '@/lib/types';
import { color, font, parent as scale, radius, space } from '@/theme/tokens';

const AREAS: ConsentArea[] = ['medicines', 'appointments', 'health', 'emergency_location'];

/**
 * Hi-fi 2f · First setup consent. The parent decides what the family sees.
 * Only this phone can change it (set_consent() in the database).
 */
export default function Consent() {
  const t = parentStrings('vi');
  const { parent } = useParentRecord();
  const [choice, setChoice] = useState<Record<ConsentArea, boolean> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (parent && !choice) setChoice(parent.consent);
  }, [parent, choice]);

  async function agree() {
    if (!supabase || !choice) return;
    setBusy(true);
    setError(null);
    for (const area of AREAS) {
      const { error } = await supabase.rpc('set_consent', { area, allowed: choice[area] });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    router.replace('/parent');
  }

  const h = honorific(parent?.display_name);

  return (
    <Screen surface="parent">
      <Title surface="parent">{t.consentTitle(h)}</Title>
      <Body surface="parent" muted>
        {t.consentSub(h)}
      </Body>
      {choice
        ? AREAS.map((area) => (
            <Pressable
              key={area}
              accessibilityRole="switch"
              accessibilityState={{ checked: choice[area] }}
              accessibilityLabel={t.consentAreas[area]}
              onPress={() => setChoice({ ...choice, [area]: !choice[area] })}
              style={styles.row}>
              <Text style={styles.label}>{t.consentAreas[area]}</Text>
              <View style={[styles.track, { backgroundColor: choice[area] ? color.accent : color.border }]}>
                <View style={[styles.thumb, choice[area] ? { right: 4 } : { left: 4 }]} />
              </View>
            </Pressable>
          ))
        : null}
      <ErrorText surface="parent">{error}</ErrorText>
      <Button surface="parent" label={t.agree} onPress={agree} busy={busy} disabled={!choice} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 80,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: color.line,
    paddingHorizontal: 20,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  label: { flex: 1, fontFamily: font.bold, fontSize: scale.text, lineHeight: scale.text * 1.3, color: color.ink },
  track: { width: 64, height: 38, borderRadius: 19, justifyContent: 'center' },
  thumb: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF' },
});
