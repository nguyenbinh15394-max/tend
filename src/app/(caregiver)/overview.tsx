import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Bar, Dot, Grid, Page, PageHeader, Panel, Pill, t } from '@/components/layout';
import { addDays, clock, daysUntil, fromIsoDay, isoDay, longDay, shortDay, today } from '@/lib/dates';
import { useFamily, useLive } from '@/lib/family';
import { BP_LIMIT, bp, isHigh, useNeeds, type Need } from '@/lib/needs';
import { supabase } from '@/lib/supabase';
import { can, type Dose, type Medicine, type Member, type Reading, type Supply } from '@/lib/types';
import { color, font } from '@/theme/tokens';

/** Hi-fi 1a · Overview: the parent's week, and what needs a person. */
export default function Overview() {
  const { family, parent, members, me } = useFamily();
  const { needs, supplies, appts, readings } = useNeeds();

  if (!family || !parent || !me) return null;

  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? null;
  const next = appts.rows[0];

  return (
    <Page>
      <PageHeader
        eyebrow={longDay(new Date())}
        title={`${parent.display_name}'s week`}
        actions={can(me, 'book') ? <Pill label="Book appointment" onPress={() => router.navigate({ pathname: '/appointments', params: { book: '1' } })} /> : null}
      />

      <Panel
        title="Needs a person"
        right={<Text style={t.muted}>{needs.length ? `${needs.length} open` : 'Nothing open · every item has an owner'}</Text>}>
        {needs.length === 0 ? <Text style={t.muted}>Every supply and check-up has someone on it.</Text> : null}
        {needs.map((n) => (
          <NeedRow key={n.key} need={n} me={me} owner={nameOf(n.ownerId)} supplies={supplies.rows} onDone={() => (n.module === 'supplies' ? supplies.refresh() : appts.refresh())} />
        ))}
      </Panel>

      <Grid min={280}>
        <SuppliesCard rows={supplies.rows} nameOf={nameOf} />
        <BloodPressureCard rows={readings.rows} shared={parent.consent.health} parentName={parent.display_name} />
        <View style={{ gap: 18 }}>
          <View style={styles.next}>
            <Text style={styles.nextLabel}>Next check-up</Text>
            {next ? (
              <>
                <Text style={styles.nextWhen}>
                  {shortDay(new Date(next.starts_at))} · {clock(new Date(next.starts_at))}
                </Text>
                <Text style={styles.nextWhat}>
                  {next.title}
                  {next.place ? ` · ${next.place}` : ''}
                </Text>
                <View style={styles.driver}>
                  <View style={styles.driverDot}>
                    <Text style={styles.driverInitial}>{(nameOf(next.driver_member_id) ?? '?').charAt(0)}</Text>
                  </View>
                  <Text style={styles.driverText}>{next.driver_member_id ? `${nameOf(next.driver_member_id)} is driving` : 'No driver yet'}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.nextWhat}>{parent.consent.appointments ? 'Nothing booked.' : `${parent.display_name} isn't sharing appointments.`}</Text>
            )}
          </View>
          <TodaysMedicines shared={parent.consent.medicines} parentName={parent.display_name} />
        </View>
      </Grid>
    </Page>
  );
}

function NeedRow({ need: n, me, owner, supplies, onDone }: { need: Need; me: Member; owner: string | null; supplies: Supply[]; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function run(patch: () => PromiseLike<unknown>) {
    setBusy(true);
    await patch();
    setBusy(false);
    onDone();
  }

  let action = <Pill small variant="outline" label="Open" onPress={() => router.navigate(`/${n.module}`)} />;
  if (n.kind === 'supply-owner' && can(me, 'order')) {
    action = <Pill small variant="coral" label="I'll take it" busy={busy} onPress={() => run(() => supabase!.from('supplies').update({ owner_member_id: me.id }).eq('id', n.id))} />;
  } else if (n.kind === 'supply-due' && can(me, 'order')) {
    const s = supplies.find((x) => x.id === n.id);
    if (s)
      action = (
        <Pill
          small
          label="Ordered"
          busy={busy}
          onPress={() => run(() => supabase!.from('supplies').update({ next_due: isoDay(addDays(today(), s.every_days)), last_ordered_at: new Date().toISOString() }).eq('id', s.id))}
        />
      );
  } else if (n.kind === 'appt-driver' && can(me, 'book') && me.role !== 'viewer') {
    action = <Pill small variant="coral" label="I'll drive" busy={busy} onPress={() => run(() => supabase!.from('appointments').update({ driver_member_id: me.id }).eq('id', n.id))} />;
  } else if (n.kind === 'bp-high') {
    action = <Pill small variant="soft" label="See log" onPress={() => router.navigate('/health')} />;
  }

  return (
    <View style={styles.need}>
      <Dot tone={n.tone} />
      <View style={{ flex: 1, minWidth: 180 }}>
        <Text style={t.strong}>{n.title}</Text>
        <Text style={[t.muted, { marginTop: 2 }]}>{n.sub}</Text>
      </View>
      <View style={styles.owner}>
        {n.kind === 'bp-high' ? null : (
          <>
        <View style={[styles.ownerDot, !owner && { backgroundColor: color.coralSoft }]}>
          <Text style={[styles.ownerInitial, !owner && { color: color.coral }]}>{owner ? owner.charAt(0).toUpperCase() : '?'}</Text>
        </View>
        <Text style={t.muted} numberOfLines={1}>
          {owner ?? 'Unassigned'}
        </Text>
          </>
        )}
      </View>
      <View style={styles.action}>{action}</View>
    </View>
  );
}

function SuppliesCard({ rows, nameOf }: { rows: Supply[]; nameOf: (id: string | null) => string | null }) {
  return (
    <Panel title="Supplies" right={<Text style={styles.link} onPress={() => router.navigate('/supplies')}>Manage</Text>} style={{ height: '100%' }}>
      {rows.length === 0 ? <Text style={t.muted}>No supplies yet.</Text> : null}
      {rows.filter((s) => !s.paused).slice(0, 4).map((s) => {
        const d = daysUntil(s.next_due);
        const tone = d < 0 ? 'coral' : d <= 5 ? 'amber' : 'accent';
        const fg = { coral: color.coral, amber: color.amber, accent: color.accent }[tone];
        const owner = nameOf(s.owner_member_id);
        return (
          <View key={s.id} style={{ gap: 6 }}>
            <View style={styles.spread}>
              <Text style={[t.body, { fontFamily: font.bold, flexShrink: 1 }]} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={[t.body, { fontFamily: font.bold, color: fg }]}>{d < 0 ? `${-d} days late` : d === 0 ? 'today' : `${d} days left`}</Text>
            </View>
            <Bar pct={(Math.max(d, 0) / s.every_days) * 100} tone={tone} />
            <Text style={t.small}>
              Every {s.every_days} days · next {shortDay(fromIsoDay(s.next_due))}
              {owner ? ` · ${owner}` : ''}
            </Text>
          </View>
        );
      })}
    </Panel>
  );
}

function BloodPressureCard({ rows, shared, parentName }: { rows: Reading[]; shared: boolean; parentName: string }) {
  // One bar per day for the last 7 days: that day's first (morning) reading.
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  const byDay = days.map((d) => {
    const key = isoDay(d);
    const dayRows = rows.filter((r) => isoDay(new Date(r.taken_at)) === key);
    return { d, r: dayRows[dayRows.length - 1] };
  });
  const latest = rows[0];
  const lo = 90;
  const hi = 180;
  const h = (v: number) => `${Math.max(6, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%` as const;

  return (
    <Panel title="Blood pressure" right={<Text style={t.small}>7 days · systolic</Text>} style={{ height: '100%' }}>
      {!shared ? (
        <Text style={t.muted}>{parentName} isn&apos;t sharing blood pressure. Only they can turn it on, from their phone.</Text>
      ) : !latest ? (
        <Text style={t.muted}>No readings yet.</Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={[styles.bpValue, isHigh(latest) && { color: color.coral }]}>{bp(latest)}</Text>
            <Text style={t.muted}>{isoDay(new Date(latest.taken_at)) === isoDay(today()) ? 'this morning' : shortDay(new Date(latest.taken_at))}</Text>
          </View>
          <View style={styles.chart}>
            <View style={[styles.limit, { bottom: h(BP_LIMIT.sys) }]} />
            <Text style={[styles.limitLabel, { bottom: h(BP_LIMIT.sys) }]}>{BP_LIMIT.sys}</Text>
            {byDay.map(({ d, r }) => (
              <View key={isoDay(d)} style={styles.col}>
                {r ? <View style={[styles.bar, { height: h(r.value), backgroundColor: isHigh(r) ? color.coral : '#9CCBC4' }]} /> : null}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {byDay.map(({ d }) => (
              <Text key={isoDay(d)} style={[t.small, { flex: 1, textAlign: 'center' }]}>
                {new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(d).slice(0, 2)}
              </Text>
            ))}
          </View>
        </>
      )}
    </Panel>
  );
}

function TodaysMedicines({ shared, parentName }: { shared: boolean; parentName: string }) {
  const { family, parent } = useFamily();
  const pid = parent?.id;
  const meds = useLive<Medicine>('medicines', family?.id, () => supabase!.from('medicines').select('*').eq('parent_id', pid!).eq('active', true), [pid]);
  const start = today();
  const doses = useLive<Dose>(
    'doses',
    family?.id,
    () => supabase!.from('doses').select('*').eq('parent_id', pid!).gte('scheduled_for', start.toISOString()).lt('scheduled_for', addDays(start, 1).toISOString()),
    [pid]
  );

  const slots = meds.rows
    .flatMap((m) => m.times.map((time) => ({ m, time: time.slice(0, 5) })))
    .sort((a, b) => a.time.localeCompare(b.time));
  const now = new Date();

  return (
    <Panel title="Today's medicines" style={{ flexGrow: 1 }}>
      {!shared ? <Text style={t.muted}>{parentName} isn&apos;t sharing medicines.</Text> : null}
      {shared && slots.length === 0 ? <Text style={t.muted}>No medicines added yet.</Text> : null}
      {shared &&
        slots.map(({ m, time }) => {
          const [hh, mm] = time.split(':').map(Number);
          const at = new Date(start);
          at.setHours(hh, mm);
          const taken = doses.rows.some((d) => d.medicine_id === m.id && new Date(d.scheduled_for).getTime() === at.getTime());
          const state = taken ? 'Taken' : at.getTime() + 2 * 3600_000 < now.getTime() ? 'Missed' : 'Later';
          const tone = { Taken: [color.greenSoft, color.green], Missed: [color.coralSoft, color.coral], Later: [color.surfaceMuted, color.inkMuted] }[state];
          return (
            <View key={`${m.id}-${time}`} style={styles.spread}>
              <Text style={t.body} numberOfLines={1}>
                <Text style={styles.time}>{time} </Text>
                {m.name}
              </Text>
              <Text style={[styles.state, { backgroundColor: tone[0], color: tone[1] }]}>{state}</Text>
            </View>
          );
        })}
    </Panel>
  );
}

const styles = StyleSheet.create({
  need: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, paddingVertical: 13, borderTopWidth: 1, borderTopColor: color.surfaceMuted },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 150 },
  ownerDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  ownerInitial: { fontFamily: font.bold, fontSize: 12, color: color.accentStrong },
  action: { width: 150, alignItems: 'flex-end' },
  link: { fontFamily: font.bold, fontSize: 14, color: color.accent },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  next: { backgroundColor: color.accent, borderRadius: 16, paddingHorizontal: 22, paddingVertical: 20, gap: 4 },
  nextLabel: { fontFamily: font.regular, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  nextWhen: { fontFamily: font.bold, fontSize: 24, color: '#fff' },
  nextWhat: { fontFamily: font.regular, fontSize: 15, color: 'rgba(255,255,255,0.9)' },
  driver: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  driverDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  driverInitial: { fontFamily: font.bold, fontSize: 12, color: color.accent },
  driverText: { fontFamily: font.regular, fontSize: 14.5, color: '#fff' },
  bpValue: { fontFamily: font.bold, fontSize: 34, letterSpacing: -0.6, color: color.ink },
  chart: { height: 130, flexDirection: 'row', alignItems: 'flex-end', gap: 10, position: 'relative', marginTop: 8 },
  limit: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderTopColor: '#E3B2A6' },
  limitLabel: { position: 'absolute', right: 0, marginBottom: 4, fontFamily: font.regular, fontSize: 11.5, color: color.coral },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6 },
  time: { fontFamily: font.regular, fontSize: 13.5, color: color.inkMuted },
  state: { fontFamily: font.bold, fontSize: 13, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
});
