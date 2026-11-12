import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip, Row } from '@/components/kit';
import { Page, PageHeader, Panel, Pill, t } from '@/components/layout';
import { ErrorText, Field } from '@/components/ui';
import { addDays, clock, isoDay, longDay, shortDay, today } from '@/lib/dates';
import { useFamily, useLive } from '@/lib/family';
import { supabase } from '@/lib/supabase';
import { can, type Appointment, type Member } from '@/lib/types';
import { color, font } from '@/theme/tokens';

const SLOTS = ['7:30', '8:30', '9:00', '13:30', '15:30'];

/** Flow 2 · Appointments: the list, and booking on one page (hi-fi 2b). */
export default function Appointments() {
  const { family, parent, me, members } = useFamily();
  const params = useLocalSearchParams<{ book?: string }>();
  const [booking, setBooking] = useState(params.book === '1');
  const [open, setOpen] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const appts = useLive<Appointment>('appointments', family?.id, () => supabase!.from('appointments').select('*').eq('parent_id', parent!.id).order('starts_at'), [parent?.id]);

  if (!family || !parent || !me) return null;

  const canBook = can(me, 'book');
  const drivers = members.filter((m) => m.role !== 'viewer');
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? null;
  const now = Date.now();
  const upcoming = appts.rows.filter((a) => a.status === 'scheduled' && new Date(a.starts_at).getTime() > now - 3 * 3600_000);
  const past = appts.rows.filter((a) => !upcoming.includes(a)).reverse();
  const shared = parent.consent.appointments;

  if (booking && shared && canBook) {
    return (
      <Book
        familyId={family.id}
        parentId={parent.id}
        parentName={parent.display_name}
        me={me}
        drivers={drivers}
        history={appts.rows}
        onDone={() => {
          setBooking(false);
          router.setParams({ book: undefined });
          appts.refresh();
        }}
      />
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow={`${parent.display_name} · ${family.name}`}
        title="Appointments"
        actions={shared && canBook ? <Pill label="Book appointment" onPress={() => setBooking(true)} /> : null}
      />

      {!shared ? (
        <Panel>
          <Text style={[t.muted, { color: color.amberStrong }]}>
            {parent.display_name} isn&apos;t sharing appointments right now. Only they can turn it back on, from their phone.
          </Text>
        </Panel>
      ) : !canBook ? (
        <Text style={t.muted}>You can see appointments. Booking needs the Book permission from the family owner.</Text>
      ) : null}

      {shared ? (
        <Panel title="Upcoming" right={<Text style={t.muted}>{upcoming.length} booked</Text>}>
          {upcoming.length === 0 && !appts.loading ? <Text style={t.muted}>No upcoming appointments.</Text> : null}
          {upcoming.map((a) => (
            <AppointmentRow
              key={a.id}
              appt={a}
              driver={nameOf(a.driver_member_id)}
              bookedBy={nameOf(a.booked_by_member_id)}
              open={open === a.id}
              onToggle={() => setOpen(open === a.id ? null : a.id)}
              canEdit={canBook}
              drivers={drivers}
              onChange={appts.refresh}
            />
          ))}
        </Panel>
      ) : null}

      {shared && past.length ? (
        <Panel title="Past and cancelled" right={<Text style={styles.link} onPress={() => setShowPast(!showPast)}>{showPast ? 'Hide' : `Show ${past.length}`}</Text>}>
          {showPast
            ? past.map((a) => (
                <View key={a.id} style={styles.pastRow}>
                  <Text style={[t.body, { flex: 1 }]}>
                    {shortDay(new Date(a.starts_at))} · {clock(new Date(a.starts_at))} · {a.title}
                    {a.place ? ` · ${a.place}` : ''}
                  </Text>
                  <Text style={[styles.state, a.status === 'done' ? styles.done : styles.cancelled]}>{a.status === 'done' ? 'Done' : 'Cancelled'}</Text>
                </View>
              ))
            : null}
        </Panel>
      ) : null}
    </Page>
  );
}

function AppointmentRow({
  appt: a,
  driver,
  bookedBy,
  open,
  onToggle,
  canEdit,
  drivers,
  onChange,
}: {
  appt: Appointment;
  driver: string | null;
  bookedBy: string | null;
  open: boolean;
  onToggle: () => void;
  canEdit: boolean;
  drivers: Member[];
  onChange: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const when = new Date(a.starts_at);

  async function update(patch: Partial<Appointment>) {
    if (!supabase) return;
    setError(null);
    const { error } = await supabase.from('appointments').update(patch).eq('id', a.id);
    if (error) setError(error.message);
    await onChange();
  }

  return (
    <View style={styles.apptRow}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.apptMain}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateDay}>{new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(when)}</Text>
          <Text style={styles.dateNum}>{when.getDate()}</Text>
          <Text style={styles.dateDay}>{new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(when)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 180, gap: 2 }}>
          <Text style={t.strong}>
            {clock(when)} · {a.title}
          </Text>
          <Text style={t.muted}>
            {a.place ?? 'No place yet'}
            {a.notes ? ` · Bring: ${a.notes}` : ''}
          </Text>
          {bookedBy ? <Text style={t.small}>Booked by {bookedBy}</Text> : null}
        </View>
        <Text style={[styles.state, driver ? styles.driver : styles.noDriver]}>{driver ? `${driver} drives` : 'No driver'}</Text>
      </Pressable>

      {open && canEdit ? (
        <View style={styles.drawer}>
          <Text style={t.label}>Who takes them</Text>
          <Row>
            {drivers.map((m) => (
              <Chip key={m.id} label={m.display_name} selected={a.driver_member_id === m.id} onPress={() => update({ driver_member_id: m.id })} />
            ))}
            <Chip label="No one yet" selected={!a.driver_member_id} onPress={() => update({ driver_member_id: null })} />
          </Row>
          <Row>
            <Pill small label="Mark as done" onPress={() => update({ status: 'done' })} />
            <Pill small variant="outline" label="Cancel appointment" onPress={() => update({ status: 'cancelled' })} />
          </Row>
        </View>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

/** Hi-fi 2b: where, when, who takes them, with a live summary on the right. */
function Book({
  familyId,
  parentId,
  parentName,
  me,
  drivers,
  history,
  onDone,
}: {
  familyId: string;
  parentId: string;
  parentName: string;
  me: Member;
  drivers: Member[];
  history: Appointment[];
  onDone: () => void;
}) {
  // Places the family has used before, newest first.
  const places = dedupe(
    [...history].reverse().map((a) => ({ title: a.title, place: a.place ?? '', last: a.starts_at })),
    (p) => `${p.title}|${p.place}`
  ).slice(0, 3);

  const [title, setTitle] = useState(places[0]?.title ?? '');
  const [place, setPlace] = useState(places[0]?.place ?? '');
  const [custom, setCustom] = useState(places.length === 0);
  const [week, setWeek] = useState(0);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [driver, setDriver] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = weekdays(week);
  const startsAt = day && time ? atTime(day, time) : null;
  const driverName = drivers.find((d) => d.id === driver)?.display_name;

  async function confirm() {
    if (!supabase || !startsAt) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('appointments').insert({
      family_id: familyId,
      parent_id: parentId,
      title: title.trim(),
      place: place.trim() || null,
      starts_at: startsAt.toISOString(),
      notes: notes.trim() || null,
      booked_by_member_id: me.id,
      driver_member_id: driver,
    });
    setBusy(false);
    if (error) setError(error.message);
    else onDone();
  }

  const summary = (
    <View style={{ gap: 16, flexGrow: 1 }}>
      <Text style={styles.asideTitle}>Summary</Text>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryDay}>{day ? longDay(atTime(day, '0:00')) : 'Pick a day'}</Text>
        <Text style={styles.summaryTime}>{time ?? '–:–'}</Text>
        <Text style={styles.summaryPlace}>{[place.trim(), title.trim()].filter(Boolean).join(' · ') || 'Pick a place'}</Text>
      </View>
      <Text style={[t.body, { lineHeight: 23 }]}>
        <Text style={{ fontFamily: font.bold }}>Driver: </Text>
        {driverName ?? 'not decided yet'}
        {'\n'}
        <Text style={{ fontFamily: font.bold }}>Bring: </Text>
        {notes.trim() || '–'}
      </Text>
      <View style={styles.willSee}>
        <Text style={[t.body, { color: '#3B4744', lineHeight: 21 }]}>
          <Text style={{ fontFamily: font.bold }}>{parentName} will see: </Text>
          {day && time
            ? `"${new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(atTime(day, '0:00'))} ${time} · ${place.trim() || title.trim() || 'check-up'}${driverName ? ` · ${driverName} will take you.` : '.'}"`
            : 'the day, time and place once you pick them.'}
        </Text>
      </View>
      {!driverName ? <Text style={[t.muted, { color: color.coral }]}>Without a driver this shows on Overview as needing a person.</Text> : null}
      <ErrorText>{error}</ErrorText>
      <View style={{ marginTop: 'auto', gap: 10 }}>
        <Pill full label={driverName ? `Confirm · ${driverName} drives` : 'Confirm'} onPress={confirm} busy={busy} disabled={!title.trim() || !startsAt} />
        <Pill full variant="outline" label="Cancel" onPress={onDone} />
      </View>
    </View>
  );

  return (
    <Page aside={summary}>
      <PageHeader eyebrow="Appointments › New" title={`Book a check-up for ${parentName}`} />

      <Panel>
        <Text style={styles.step}>1 · Where</Text>
        <View style={styles.cards}>
          {places.map((p) => {
            const selected = !custom && p.title === title && p.place === place;
            return (
              <Pressable
                key={`${p.title}|${p.place}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  setCustom(false);
                  setTitle(p.title);
                  setPlace(p.place);
                }}
                style={[styles.option, selected && styles.optionOn]}>
                <Text style={styles.optionTitle}>{[p.place, p.title].filter(Boolean).join(' · ')}</Text>
                <Text style={t.muted}>
                  {new Date(p.last).getTime() < Date.now() ? 'Last visit' : 'Booked for'} {shortDay(new Date(p.last))}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: custom }}
            onPress={() => {
              setCustom(true);
              setTitle('');
              setPlace('');
            }}
            style={[styles.option, custom && styles.optionOn]}>
            <Text style={styles.optionTitle}>+ Somewhere new</Text>
            <Text style={t.muted}>Type the clinic and what it&apos;s for</Text>
          </Pressable>
        </View>
        {custom ? (
          <View style={styles.cards}>
            <View style={{ flex: 1, minWidth: 220 }}>
              <Field label="What" value={title} onChangeText={setTitle} placeholder="Endocrinology check-up" />
            </View>
            <View style={{ flex: 1, minWidth: 220 }}>
              <Field label="Place" value={place} onChangeText={setPlace} placeholder="Hospital C · 2nd floor" />
            </View>
          </View>
        ) : null}
      </Panel>

      <Panel>
        <View style={styles.whenHead}>
          <Text style={styles.step}>2 · When</Text>
          <Row>
            <Pill small variant="outline" label="‹ Earlier" disabled={week === 0} onPress={() => setWeek(week - 1)} />
            <Pill small variant="outline" label="Later ›" disabled={week >= 5} onPress={() => setWeek(week + 1)} />
          </Row>
        </View>
        <View style={styles.slotGrid}>
          {days.map((d) => {
            const key = isoDay(d);
            return (
              <View key={key} style={styles.slotCol}>
                <Text style={styles.slotDay}>{new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' }).format(d)}</Text>
                {SLOTS.map((s) => {
                  const past = atTime(key, s).getTime() < Date.now() + 3600_000;
                  const on = day === key && time === s;
                  return (
                    <Pressable
                      key={s}
                      disabled={past}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on, disabled: past }}
                      accessibilityLabel={`${shortDay(d)} ${s}`}
                      onPress={() => {
                        setDay(key);
                        setTime(s);
                      }}
                      style={({ hovered }) => [styles.slot, past && styles.slotPast, on && styles.slotOn, hovered && !on && !past && { borderColor: color.accent }]}>
                      <Text style={[styles.slotText, past && { color: color.inkSubtle }, on && { color: '#fff', fontFamily: font.bold }]}>{past ? '–' : s}</Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      </Panel>

      <Panel>
        <Text style={styles.step}>3 · Who takes {parentName}</Text>
        <View style={styles.cards}>
          {drivers.map((m) => {
            const on = driver === m.id;
            return (
              <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setDriver(m.id)} style={[styles.person, on && styles.optionOn]}>
                <View style={[styles.personDot, on && { backgroundColor: color.accent }]}>
                  <Text style={[styles.personInitial, on && { color: '#fff' }]}>{m.display_name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flexShrink: 1 }}>
                  <Text style={styles.personName}>
                    {m.display_name}
                    {m.id === me.id ? ' (you)' : ''}
                  </Text>
                  <Text style={t.small}>{m.phone ?? 'No phone yet'}</Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="radio" accessibilityState={{ selected: driver === null }} onPress={() => setDriver(null)} style={[styles.person, driver === null && styles.optionOn]}>
            <View style={styles.personDot}>
              <Text style={styles.personInitial}>?</Text>
            </View>
            <View>
              <Text style={styles.personName}>Decide later</Text>
              <Text style={t.small}>Shows as needing a person</Text>
            </View>
          </Pressable>
        </View>
        <Field label="Bring" value={notes} onChangeText={setNotes} placeholder="BP notebook, health card" />
      </Panel>
    </Page>
  );
}

function weekdays(week: number) {
  const out: Date[] = [];
  let d = addDays(today(), week * 7);
  // Start on the next weekday from today (or from the start of that week).
  while (out.length < 5) {
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

function atTime(day: string, time: string) {
  const [y, mo, d] = day.split('-').map(Number);
  const [h, m] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

function dedupe<T>(list: T[], key: (x: T) => string) {
  const seen = new Set<string>();
  return list.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)));
}

const styles = StyleSheet.create({
  step: { fontFamily: font.bold, fontSize: 14, color: color.inkMuted },
  link: { fontFamily: font.bold, fontSize: 14, color: color.accent },
  apptRow: { borderTopWidth: 1, borderTopColor: color.surfaceMuted },
  apptMain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, paddingVertical: 14 },
  dateBlock: { width: 58, alignItems: 'center', backgroundColor: color.bg, borderRadius: 12, paddingVertical: 8 },
  dateDay: { fontFamily: font.regular, fontSize: 12, color: color.inkMuted },
  dateNum: { fontFamily: font.bold, fontSize: 22, color: color.ink, lineHeight: 26 },
  state: { fontFamily: font.bold, fontSize: 13, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, overflow: 'hidden' },
  driver: { backgroundColor: color.accentSoft, color: color.accentStrong },
  noDriver: { backgroundColor: color.coralSoft, color: color.coral },
  done: { backgroundColor: color.greenSoft, color: color.green },
  cancelled: { backgroundColor: color.surfaceMuted, color: color.inkMuted },
  pastRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: color.surfaceMuted },
  drawer: { gap: 10, paddingBottom: 14, paddingLeft: 74 },
  asideTitle: { fontFamily: font.bold, fontSize: 18, color: color.ink },
  summaryCard: { backgroundColor: color.accent, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 18 },
  summaryDay: { fontFamily: font.regular, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  summaryTime: { fontFamily: font.bold, fontSize: 30, color: '#fff', marginTop: 2 },
  summaryPlace: { fontFamily: font.regular, fontSize: 15, color: '#fff', marginTop: 6 },
  willSee: { backgroundColor: color.bg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  option: { flexGrow: 1, flexBasis: 220, borderWidth: 1, borderColor: color.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, gap: 3 },
  optionOn: { borderWidth: 2, borderColor: color.accent, backgroundColor: color.accentSoft },
  optionTitle: { fontFamily: font.bold, fontSize: 16, color: color.ink },
  whenHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  slotGrid: { flexDirection: 'row', gap: 10 },
  slotCol: { flex: 1, gap: 8 },
  slotDay: { fontFamily: font.bold, fontSize: 14, color: color.ink, textAlign: 'center' },
  slot: { borderWidth: 1, borderColor: color.border, borderRadius: 10, paddingVertical: 9, alignItems: 'center', backgroundColor: color.surface },
  slotPast: { backgroundColor: color.bg, borderColor: color.line },
  slotOn: { backgroundColor: color.accent, borderColor: color.accent },
  slotText: { fontFamily: font.regular, fontSize: 14.5, color: color.ink },
  person: { flexGrow: 1, flexBasis: 170, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: color.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  personDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  personInitial: { fontFamily: font.bold, fontSize: 14, color: color.accentStrong },
  personName: { fontFamily: font.bold, fontSize: 15, color: color.ink },
});
