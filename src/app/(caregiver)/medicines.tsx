import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip, Row } from '@/components/kit';
import { Page, PageHeader, Panel, Pill, t } from '@/components/layout';
import { ErrorText, Field } from '@/components/ui';
import { addDays, isoDay, today } from '@/lib/dates';
import { useFamily, useLive } from '@/lib/family';
import { supabase } from '@/lib/supabase';
import { can, type Dose, type Medicine } from '@/lib/types';
import { color, font } from '@/theme/tokens';

const TIMES = ['6:00', '7:00', '8:00', '9:00', '12:00', '13:00', '17:00', '19:00', '21:00', '22:00'];
const GRACE_MS = 2 * 3600_000; // a dose counts as missed two hours after its time

type Cell = { at: Date; state: 'taken' | 'missed' | 'upcoming'; dose?: Dose };

/** Hi-fi 2d · Medicines: the week at a glance, where gaps show patterns. */
export default function Medicines() {
  const { family, parent, me } = useFamily();
  const [adding, setAdding] = useState(false);
  const pid = parent?.id;
  const start = addDays(today(), -6);
  const meds = useLive<Medicine>('medicines', family?.id, () => supabase!.from('medicines').select('*').eq('parent_id', pid!).eq('active', true).order('created_at'), [pid]);
  const doses = useLive<Dose>('doses', family?.id, () => supabase!.from('doses').select('*').eq('parent_id', pid!).gte('scheduled_for', start.toISOString()), [pid]);

  if (!family || !parent || !me) return null;

  const allowed = can(me, 'health');
  const shared = parent.consent.medicines;
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const now = Date.now();

  // One row per medicine and time of day.
  const rows = meds.rows
    .flatMap((m) => m.times.map((time) => ({ m, time: time.slice(0, 5).replace(/^0/, '') })))
    .sort((a, b) => toMin(a.time) - toMin(b.time));
  const grid = rows.map(({ m, time }) => ({
    m,
    time,
    cells: days.map((d): Cell => {
      const at = atTime(d, time);
      const dose = doses.rows.find((x) => x.medicine_id === m.id && new Date(x.scheduled_for).getTime() === at.getTime());
      return { at, dose, state: dose ? 'taken' : at.getTime() + GRACE_MS < now ? 'missed' : 'upcoming' };
    }),
  }));

  // The slot missed most often this week, if it was missed at least twice.
  const worst = grid
    .map((r) => ({ ...r, missed: r.cells.filter((c) => c.state === 'missed').length }))
    .filter((r) => r.missed >= 2)
    .sort((a, b) => b.missed - a.missed)[0];
  const later = worst ? `${toMin(worst.time) / 60 + 1}:00` : null;

  async function toggle(m: Medicine, c: Cell) {
    if (!supabase || !allowed || c.state === 'upcoming') return;
    if (c.dose) await supabase.from('doses').delete().eq('id', c.dose.id);
    else await supabase.from('doses').insert({ family_id: family!.id, parent_id: parent!.id, medicine_id: m.id, scheduled_for: c.at.toISOString() });
    await doses.refresh();
  }

  async function moveSlot(m: Medicine, from: string, to: string) {
    if (!supabase) return;
    const times = m.times.map((x) => (x.slice(0, 5).replace(/^0/, '') === from ? `${to.padStart(5, '0')}:00` : x));
    await supabase.from('medicines').update({ times }).eq('id', m.id);
    await meds.refresh();
  }

  async function stop(m: Medicine) {
    if (!supabase) return;
    await supabase.from('medicines').update({ active: false }).eq('id', m.id);
    await meds.refresh();
  }

  return (
    <Page>
      <PageHeader
        eyebrow={`${parent.display_name} · ${family.name}`}
        title="Medicines"
        actions={allowed && shared && !adding ? <Pill label="+ Add medicine" onPress={() => setAdding(true)} /> : null}
      />

      {!shared ? (
        <Panel>
          <Text style={[t.muted, { color: color.amberStrong }]}>
            {parent.display_name} isn&apos;t sharing medicines right now. Only they can turn it on, from their phone.
          </Text>
        </Panel>
      ) : (
        <>
          {adding ? <AddMedicine familyId={family.id} parentId={parent.id} onDone={() => { setAdding(false); meds.refresh(); }} /> : null}

          {worst ? (
            <View style={styles.pattern}>
              <Text style={styles.patternText}>
                <Text style={{ fontFamily: font.bold }}>Pattern: </Text>
                the {worst.time} {worst.m.name} was missed on {worst.missed} of the last 7 days.
              </Text>
              {allowed && later && !worst.m.times.some((x) => x.startsWith(later.padStart(5, '0'))) ? (
                <Pill small variant="coral" label={`Move to ${later}?`} onPress={() => moveSlot(worst.m, worst.time, later)} />
              ) : null}
            </View>
          ) : null}

          <Panel>
            <View style={styles.gridRow}>
              <View style={styles.nameCol} />
              {days.map((d) => {
                const isToday = isoDay(d) === isoDay(today());
                return (
                  <Text key={isoDay(d)} style={[styles.dayHead, isToday && { color: color.accent }]}>
                    {isToday ? 'Today' : new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(d)}
                  </Text>
                );
              })}
            </View>
            {grid.length === 0 && !meds.loading ? <Text style={t.muted}>No medicines yet. Add them from the prescription.</Text> : null}
            {grid.map(({ m, time, cells }) => (
              <View key={`${m.id}-${time}`} style={[styles.gridRow, styles.medRow]}>
                <View style={styles.nameCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={[styles.medName, { flexShrink: 1 }]} numberOfLines={1}>
                      {m.name}
                    </Text>
                    {allowed ? (
                      <Text style={styles.stop} onPress={() => stop(m)} accessibilityRole="button" accessibilityLabel={`Stop ${m.name}`}>
                        Stop
                      </Text>
                    ) : null}
                  </View>
                  <Text style={t.small} numberOfLines={1}>
                    {time}
                    {m.instructions ? ` · ${m.instructions}` : ''}
                  </Text>
                </View>
                {cells.map((c) => (
                  <Pressable
                    key={c.at.toISOString()}
                    disabled={!allowed || c.state === 'upcoming'}
                    onPress={() => toggle(m, c)}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.name} ${time} ${c.at.toDateString()}: ${c.state}`}
                    style={[styles.cell, cellStyle[c.state]]}>
                    <Text style={[styles.cellText, { color: cellText[c.state] }]}>{c.state === 'taken' ? '✓' : c.state === 'missed' ? 'Missed' : '–'}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
            <View style={styles.legend}>
              {(['taken', 'missed', 'upcoming'] as const).map((s) => (
                <View key={s} style={styles.legendItem}>
                  <View style={[styles.swatch, cellStyle[s]]} />
                  <Text style={t.muted}>{s === 'taken' ? 'Taken' : s === 'missed' ? 'Missed' : 'Upcoming'}</Text>
                </View>
              ))}
              {allowed ? <Text style={t.muted}>Tap a day to mark it taken for {parent.display_name}.</Text> : null}
            </View>
          </Panel>
        </>
      )}
    </Page>
  );
}

function AddMedicine({ familyId, parentId, onDone }: { familyId: string; parentId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [times, setTimes] = useState<string[]>(['7:00']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('medicines').insert({
      family_id: familyId,
      parent_id: parentId,
      name: name.trim(),
      instructions: instructions.trim() || null,
      times: [...times].sort((a, b) => toMin(a) - toMin(b)).map((x) => `${x.padStart(5, '0')}:00`),
    });
    setBusy(false);
    if (error) setError(error.message);
    else onDone();
  }

  return (
    <Panel title="Add a medicine">
      <Row gap={12}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Field label="Medicine and dose" value={name} onChangeText={setName} placeholder="Metformin 500mg" />
        </View>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Field label="How to take it" value={instructions} onChangeText={setInstructions} placeholder="1 tablet after breakfast" />
        </View>
      </Row>
      <Text style={styles.fieldLabel}>Times of day</Text>
      <Row>
        {TIMES.map((x) => (
          <Chip key={x} label={x} selected={times.includes(x)} onPress={() => setTimes(times.includes(x) ? times.filter((y) => y !== x) : [...times, x])} />
        ))}
      </Row>
      <ErrorText>{error}</ErrorText>
      <Row>
        <Pill label="Add medicine" onPress={save} busy={busy} disabled={!name.trim() || times.length === 0} />
        <Pill variant="outline" label="Cancel" onPress={onDone} />
      </Row>
    </Panel>
  );
}

const toMin = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};

function atTime(d: Date, hm: string) {
  const out = new Date(d);
  const [h, m] = hm.split(':').map(Number);
  out.setHours(h, m, 0, 0);
  return out;
}

const cellStyle = StyleSheet.create({
  taken: { backgroundColor: color.greenSoft },
  missed: { backgroundColor: color.coralSoft },
  upcoming: { backgroundColor: color.bg, borderWidth: 1, borderColor: color.line },
});
const cellText = { taken: color.green, missed: color.coral, upcoming: color.inkSubtle };

const styles = StyleSheet.create({
  pattern: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, backgroundColor: color.coralSoft, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 16 },
  patternText: { flex: 1, minWidth: 240, fontFamily: font.regular, fontSize: 15.5, lineHeight: 22, color: '#7A2A18' },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medRow: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: color.surfaceMuted },
  nameCol: { width: 220, gap: 2 },
  dayHead: { flex: 1, textAlign: 'center', fontFamily: font.bold, fontSize: 14, color: color.ink },
  medName: { fontFamily: font.bold, fontSize: 16, color: color.ink },
  stop: { fontFamily: font.bold, fontSize: 12.5, color: color.inkSubtle },
  cell: { flex: 1, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontFamily: font.bold, fontSize: 13.5 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  fieldLabel: { fontFamily: font.bold, fontSize: 13.5, color: color.ink },
});
