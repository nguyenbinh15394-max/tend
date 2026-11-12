import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Row } from '@/components/kit';
import { Page, PageHeader, Panel, Pill, Stat, t } from '@/components/layout';
import { ErrorText, Field } from '@/components/ui';
import { addDays, clock, isoDay, shortDay, today } from '@/lib/dates';
import { useFamily, useLive } from '@/lib/family';
import { BP_LIMIT, bp, isHigh } from '@/lib/needs';
import { supabase } from '@/lib/supabase';
import { can, type Member, type Reading } from '@/lib/types';
import { color, font } from '@/theme/tokens';

type Kind = 'blood_pressure' | 'glucose' | 'weight';
const KINDS: { key: Kind; label: string; unit: string }[] = [
  { key: 'blood_pressure', label: 'Blood pressure', unit: 'mmHg' },
  { key: 'glucose', label: 'Glucose', unit: 'mmol/L' },
  { key: 'weight', label: 'Weight', unit: 'kg' },
];
const DAYS = 30;

/** Hi-fi 2c · Health log: 30 days of readings, with the range set with the doctor. */
export default function Health() {
  const { family, parent, me, members } = useFamily();
  const [kind, setKind] = useState<Kind>('blood_pressure');
  const [logging, setLogging] = useState(false);
  const since = addDays(today(), -(DAYS - 1));
  const readings = useLive<Reading>(
    'readings',
    family?.id,
    () => supabase!.from('readings').select('*').eq('parent_id', parent!.id).gte('taken_at', since.toISOString()).order('taken_at', { ascending: false }),
    [parent?.id]
  );

  if (!family || !parent || !me) return null;

  const allowed = can(me, 'health');
  const shared = parent.consent.health;
  const k = KINDS.find((x) => x.key === kind)!;
  const rows = readings.rows.filter((r) => r.kind === kind);

  const header = (
    <PageHeader
      eyebrow={`${parent.display_name} · ${family.name}`}
      title="Health log"
      actions={
        allowed && shared ? (
          <>
            <View style={styles.segment}>
              {KINDS.map((x) => (
                <Pressable key={x.key} accessibilityRole="tab" accessibilityState={{ selected: kind === x.key }} onPress={() => setKind(x.key)} style={[styles.seg, kind === x.key && styles.segOn]}>
                  <Text style={[styles.segText, kind === x.key && styles.segTextOn]}>{x.label}</Text>
                </Pressable>
              ))}
            </View>
            {!logging ? <Pill label="+ Log reading" onPress={() => setLogging(true)} /> : null}
          </>
        ) : null
      }
    />
  );

  if (!shared || !allowed) {
    return (
      <Page>
        {header}
        <Panel>
          <Text style={[t.muted, { color: color.amberStrong }]}>
            {!shared
              ? `${parent.display_name} isn't sharing health readings right now. Only they can turn it on, from their phone.`
              : 'Health readings need the Health permission. Ask the family owner to switch it on for you in Family.'}
          </Text>
        </Panel>
      </Page>
    );
  }

  const values = rows.map((r) => r.value);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const fromPhone = new Set(rows.filter((r) => r.source === 'parent').map((r) => isoDay(new Date(r.taken_at)))).size;
  const daysLogged = new Set(rows.map((r) => isoDay(new Date(r.taken_at)))).size;
  const high = kind === 'blood_pressure' ? rows.filter(isHigh).length : 0;
  const fmt = (r: Reading) => (kind === 'blood_pressure' ? bp(r) : `${Number(r.value)}`);

  // One bar a day: that day's first reading.
  const days = Array.from({ length: DAYS }, (_, i) => addDays(since, i));
  const byDay = days.map((d) => {
    const key = isoDay(d);
    const same = rows.filter((r) => isoDay(new Date(r.taken_at)) === key);
    return same[same.length - 1];
  });
  const lo = kind === 'blood_pressure' ? 90 : Math.min(...values, Infinity) * 0.9 || 0;
  const hi = kind === 'blood_pressure' ? 180 : Math.max(...values, 0) * 1.05 || 1;
  const h = (v: number) => `${Math.max(4, Math.min(100, ((v - lo) / (hi - lo || 1)) * 100))}%` as const;

  return (
    <Page>
      {header}

      {logging ? <LogReading kind={k} familyId={family.id} parentId={parent.id} onDone={() => { setLogging(false); readings.refresh(); }} /> : null}

      <View style={styles.stats}>
        <Stat
          label={`${DAYS}-day average`}
          value={rows.length ? (kind === 'blood_pressure' ? `${Math.round(avg(values))}/${Math.round(avg(rows.map((r) => r.value_secondary ?? 0)))}` : `${avg(values).toFixed(1)} ${k.unit}`) : '–'}
        />
        {kind === 'blood_pressure' ? <Stat label="Above range" value={`${high} ${high === 1 ? 'time' : 'times'}`} tone={high ? 'coral' : undefined} /> : <Stat label="Readings" value={String(rows.length)} />}
        <Stat label={`Logged on ${parent.display_name}'s phone`} value={`${fromPhone} / ${daysLogged || 0} days`} />
        <Stat label="Target" value={kind === 'blood_pressure' ? `< ${BP_LIMIT.sys}/${BP_LIMIT.dia}` : '–'} />
      </View>

      <Panel>
        <View style={styles.chartHead}>
          <Text style={t.muted}>{kind === 'blood_pressure' ? 'Systolic · morning readings' : `${k.label} · first reading of the day`}</Text>
          <Text style={t.muted}>
            {shortDay(since)} – {shortDay(today())}
          </Text>
        </View>
        {rows.length === 0 ? (
          <Text style={t.muted}>No {k.label.toLowerCase()} readings in the last {DAYS} days.</Text>
        ) : (
          <View style={styles.chart}>
            {kind === 'blood_pressure' ? <View style={[styles.limit, { bottom: h(BP_LIMIT.sys) }]} /> : null}
            {byDay.map((r, i) => (
              <View key={i} style={styles.col}>
                {r ? <View style={[styles.bar, { height: h(r.value), backgroundColor: kind === 'blood_pressure' && isHigh(r) ? color.coral : '#9CCBC4' }]} /> : null}
              </View>
            ))}
          </View>
        )}
      </Panel>

      <View style={styles.table}>
        <View style={styles.thead}>
          <Text style={[styles.th, { width: 150 }]}>When</Text>
          <Text style={[styles.th, { width: 110 }]}>Reading</Text>
          <Text style={[styles.th, { flex: 1 }]}>Note</Text>
          <Text style={[styles.th, { width: 130 }]}>Source</Text>
        </View>
        {rows.slice(0, 20).map((r) => (
          <View key={r.id} style={styles.tr}>
            <Text style={[styles.cell, { width: 150 }]}>
              {shortDay(new Date(r.taken_at))} · {clock(new Date(r.taken_at))}
            </Text>
            <Text style={[styles.cell, { width: 110, fontFamily: font.bold, color: kind === 'blood_pressure' && isHigh(r) ? color.coral : color.ink }]}>{fmt(r)}</Text>
            <Text style={[styles.cell, { flex: 1, color: color.inkMuted }]} numberOfLines={1}>
              {r.note ? `"${r.note}"` : '–'}
            </Text>
            <Text style={[styles.cell, { width: 130 }]} numberOfLines={1}>
              {source(r, parent.display_name, members)}
            </Text>
          </View>
        ))}
      </View>
    </Page>
  );
}

function source(r: Reading, parentName: string, members: Member[]) {
  if (r.source === 'parent') return `${parentName}'s phone`;
  return members.find((m) => m.user_id === r.recorded_by)?.display_name ?? 'Family';
}

function LogReading({ kind, familyId, parentId, onDone }: { kind: { key: Kind; label: string; unit: string }; familyId: string; parentId: string; onDone: () => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bpKind = kind.key === 'blood_pressure';
  const valid = Number(a) > 0 && (!bpKind || Number(b) > 0);

  async function save() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('readings').insert({
      family_id: familyId,
      parent_id: parentId,
      kind: kind.key,
      value: Number(a),
      value_secondary: bpKind ? Number(b) : null,
      unit: kind.unit,
      source: 'caregiver',
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) setError(error.message);
    else onDone();
  }

  return (
    <Panel title={`Log ${kind.label.toLowerCase()}`}>
      <Text style={t.muted}>For a reading taken at the clinic or by hand. Readings from {"the parent's"} phone arrive by themselves.</Text>
      <Row gap={12}>
        <View style={{ width: 140 }}>
          <Field label={bpKind ? 'Systolic' : kind.unit} value={a} onChangeText={setA} inputMode="decimal" placeholder={bpKind ? '138' : ''} />
        </View>
        {bpKind ? (
          <View style={{ width: 140 }}>
            <Field label="Diastolic" value={b} onChangeText={setB} inputMode="decimal" placeholder="86" />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 200 }}>
          <Field label="Note" value={note} onChangeText={setNote} placeholder="At Hospital C, after the walk" />
        </View>
      </Row>
      <ErrorText>{error}</ErrorText>
      <Row>
        <Pill label="Save reading" onPress={save} busy={busy} disabled={!valid} />
        <Pill variant="outline" label="Cancel" onPress={onDone} />
      </Row>
    </Panel>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', gap: 6, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, borderRadius: 999, padding: 4 },
  seg: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, justifyContent: 'center' },
  segOn: { backgroundColor: color.accent },
  segText: { fontFamily: font.regular, fontSize: 14, color: color.ink },
  segTextOn: { fontFamily: font.bold, color: '#fff' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  chart: { height: 180, flexDirection: 'row', alignItems: 'flex-end', gap: 5, position: 'relative' },
  limit: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderTopColor: '#E3B2A6' },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 4 },
  table: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, borderRadius: 16, overflow: 'hidden' },
  thead: { flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: '#FAFBFB', borderBottomWidth: 1, borderBottomColor: color.line },
  th: { fontFamily: font.bold, fontSize: 13, color: color.inkMuted },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: color.surfaceMuted },
  cell: { fontFamily: font.regular, fontSize: 14.5, color: color.ink },
});
