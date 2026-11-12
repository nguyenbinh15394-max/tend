import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Card, Chip, Heading, Row, Small, Spread, Strong } from '@/components/kit';
import { DayPicker, MemberPicker } from '@/components/pickers';
import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { clock, fromIsoDay, longDay, shortDay } from '@/lib/dates';
import { useFamily, useLive } from '@/lib/family';
import { supabase } from '@/lib/supabase';
import { can, type Appointment, type Member } from '@/lib/types';
import { space } from '@/theme/tokens';

const TIMES = ['7:00', '7:30', '8:00', '8:30', '9:00', '9:30', '10:00', '10:30', '11:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'];

/** Flow 2 · Book a check-up and assign who takes the parent (hi-fi 2b). */
export default function Appointments() {
  const { family, parent, me, members } = useFamily();
  const [booking, setBooking] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const appts = useLive<Appointment>('appointments', family?.id, () =>
    supabase!.from('appointments').select('*').eq('parent_id', parent!.id).order('starts_at')
  );

  if (!family || !parent || !me) return null;

  const canBook = can(me, 'book');
  const drivers = members.filter((m) => m.role !== 'viewer');
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? null;
  const now = Date.now();
  const upcoming = appts.rows.filter((a) => a.status === 'scheduled' && new Date(a.starts_at).getTime() > now - 3 * 3600_000);
  const past = appts.rows.filter((a) => !upcoming.includes(a)).reverse();
  const shared = parent.consent.appointments;

  return (
    <Screen>
      <View>
        <Small>{parent.display_name} · Appointments</Small>
        <Title>Appointments</Title>
      </View>

      {!shared ? (
        <Card>
          <Small tone="amber">
            {parent.display_name} isn't sharing appointments right now. Only they can turn it back on, from their phone.
          </Small>
        </Card>
      ) : canBook ? (
        booking ? (
          <Book
            familyId={family.id}
            parentId={parent.id}
            parentName={parent.display_name}
            me={me}
            drivers={drivers}
            onDone={() => {
              setBooking(false);
              appts.refresh();
            }}
          />
        ) : (
          <Row>
            <Button label="Book appointment" onPress={() => setBooking(true)} />
          </Row>
        )
      ) : (
        <Small>You can see appointments. Booking needs the Book permission from the family owner.</Small>
      )}

      {shared && upcoming.length === 0 && !appts.loading ? <Body muted>No upcoming appointments.</Body> : null}

      {upcoming.map((a) => (
        <AppointmentCard
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

      {past.length ? (
        <>
          <Row>
            <Button variant="secondary" label={showPast ? 'Hide past' : `Past and cancelled (${past.length})`} onPress={() => setShowPast(!showPast)} />
          </Row>
          {showPast
            ? past.map((a) => (
                <Card key={a.id}>
                  <Spread>
                    <Strong>{a.title}</Strong>
                    <Badge label={a.status} tone={a.status === 'done' ? 'green' : 'neutral'} />
                  </Spread>
                  <Small>
                    {shortDay(new Date(a.starts_at))} · {clock(new Date(a.starts_at))}
                    {a.place ? ` · ${a.place}` : ''}
                  </Small>
                </Card>
              ))
            : null}
        </>
      ) : null}
    </Screen>
  );
}

function AppointmentCard({
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
    <Card highlight={!driver}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle}>
        <Spread>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Strong>
              {longDay(when)} · {clock(when)}
            </Strong>
            <Small>
              {a.title}
              {a.place ? ` · ${a.place}` : ''}
            </Small>
          </View>
          {driver ? <Badge label={`Driver: ${driver}`} tone="accent" /> : <Badge label="No driver" tone="coral" />}
        </Spread>
        {a.notes ? <Small>{a.notes}</Small> : null}
        {bookedBy ? <Small>Booked by {bookedBy}</Small> : null}
      </Pressable>

      {open && canEdit ? (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Heading>Who takes them</Heading>
          <MemberPicker members={drivers} value={a.driver_member_id} emptyLabel="No one yet" onChange={(id) => update({ driver_member_id: id })} />
          <Row>
            <Button label="Mark as done" onPress={() => update({ status: 'done' })} />
            <Button variant="secondary" label="Cancel appointment" onPress={() => update({ status: 'cancelled' })} />
          </Row>
        </View>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function Book({
  familyId,
  parentId,
  parentName,
  me,
  drivers,
  onDone,
}: {
  familyId: string;
  parentId: string;
  parentName: string;
  me: Member;
  drivers: Member[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [driver, setDriver] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Card>
      <Heading>Book a check-up for {parentName}</Heading>

      <Strong>1 · Where</Strong>
      <Field label="What" value={title} onChangeText={setTitle} placeholder="Endocrinology check-up" />
      <Field label="Place" value={place} onChangeText={setPlace} placeholder="Hospital C · 2nd floor" />

      <Strong>2 · When</Strong>
      <DayPicker value={day} onChange={setDay} count={21} />
      <Row>
        {TIMES.map((t) => (
          <Chip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />
        ))}
      </Row>

      <Strong>3 · Who takes {parentName}</Strong>
      <MemberPicker
        members={drivers}
        value={driver}
        emptyLabel="Decide later"
        onChange={setDriver}
        note="Every task has a named owner: without a driver, this shows up in Overview as needing a person."
      />

      <Field label="Bring" value={notes} onChangeText={setNotes} placeholder="BP notebook, health card" />

      {startsAt ? (
        <Card>
          <Small>Summary</Small>
          <Strong>
            {longDay(fromIsoDay(day!))} · {time}
            {place.trim() ? ` · ${place.trim()}` : ''}
          </Strong>
          <Small>
            {parentName} will see: "{title.trim() || 'Check-up'}, {time}
            {driverName ? `. ${driverName} will take you.` : '.'}"
          </Small>
        </Card>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Row>
        <Button
          label={driverName ? `Confirm · ${driverName} drives` : 'Confirm'}
          onPress={confirm}
          busy={busy}
          disabled={!title.trim() || !startsAt}
        />
        <Button variant="secondary" label="Cancel" onPress={onDone} />
      </Row>
    </Card>
  );
}

function atTime(day: string, time: string) {
  const d = fromIsoDay(day);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}
