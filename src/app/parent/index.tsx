import { Redirect, router } from 'expo-router';
import { Calendar, Phone, Pill } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigAction, TodayCard } from '@/components/parent';
import { useCallList, useParentRecord } from '@/lib/parent-data';
import { greeting, longDate, parentStrings, type ParentLang } from '@/lib/parent-strings';
import { supabase } from '@/lib/supabase';
import { color, font, parent, space } from '@/theme/tokens';

const lang: ParentLang = 'vi';

/**
 * Parent mode home (hi-fi 1b): no login, no menus, three things.
 * Today's medicines · Next check-up · Call my children.
 */
export default function ParentHome() {
  const t = parentStrings(lang);
  const { parent: me, loading } = useParentRecord();
  const callList = useCallList();
  const [nextVisit, setNextVisit] = useState<Date | null>(null);

  useEffect(() => {
    if (!supabase || !me) return;
    supabase
      .from('appointments')
      .select('starts_at')
      .eq('parent_id', me.id)
      .eq('status', 'scheduled')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setNextVisit(data ? new Date(data.starts_at) : null));
  }, [me]);

  // First time on this phone: the parent chooses what to share (hi-fi 2f).
  if (!loading && me && !me.consent_updated_at) return <Redirect href="/parent/consent" />;

  const today = nextVisit ? visitSummary(nextVisit) : null;
  const names = callList.map((c) => c.display_name);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View>
          <Text style={styles.date}>{longDate(lang)}</Text>
          <Text accessibilityRole="header" style={styles.hello}>
            {me ? `${greeting(lang)}, ${me.display_name}` : greeting(lang)}
          </Text>
        </View>

        {today ? <TodayCard label={t.todayLabel}>{today}</TodayCard> : null}

        <BigAction tone="primary" icon={Pill} label={t.medicines} onPress={() => router.push('/parent/medicines')} />
        <BigAction icon={Calendar} label={t.appointment} onPress={() => router.push('/parent/appointment')} />

        <View style={styles.spacer} />

        <BigAction
          tone="urgent"
          icon={Phone}
          label={t.call}
          sub={names.length ? t.callThen(names) : undefined}
          onPress={() => router.push('/parent/call')}
        />
        <Pressable accessibilityRole="button" onPress={() => router.push('/parent/consent')} style={styles.sharing}>
          <Text style={styles.sharingText}>{t.sharing}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function visitSummary(when: Date) {
  const days = Math.round((startOfDay(when) - startOfDay(new Date())) / 86_400_000);
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(when);
  if (days === 0) return `Hôm nay đi khám lúc ${when.getHours()}:${String(when.getMinutes()).padStart(2, '0')}.`;
  if (days === 1) return 'Ngày mai đi khám.';
  if (days < 7) return `${weekday} đi khám.`;
  return `Đi khám ngày ${when.getDate()}/${when.getMonth() + 1}.`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: parent.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingTop: 14,
    paddingBottom: space.sm,
    gap: space.md,
  },
  date: { fontFamily: font.regular, fontSize: parent.small, color: color.inkMuted },
  hello: {
    fontFamily: font.bold,
    fontSize: parent.title,
    lineHeight: parent.title * 1.1,
    color: color.ink,
    marginTop: space.xs,
  },
  spacer: { flex: 1 },
  sharing: { minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  sharingText: { fontFamily: font.regular, fontSize: parent.small, color: color.inkMuted, textDecorationLine: 'underline' },
});
