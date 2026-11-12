import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip, Row } from '@/components/kit';
import { Bar, Page, PageHeader, Pill, Stat, t, useWide } from '@/components/layout';
import { DayPicker } from '@/components/pickers';
import { ErrorText, Field } from '@/components/ui';
import { addDays, daysUntil, fromIsoDay, isoDay, shortDay, today } from '@/lib/dates';
import { useFamily, useLive } from '@/lib/family';
import { supabase } from '@/lib/supabase';
import { can, type Member, type Supply } from '@/lib/types';
import { color, font } from '@/theme/tokens';

const CYCLES = [7, 14, 20, 25, 30, 45, 60, 90];
const vnd = (n: number) => `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;
const shortVnd = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

/** Flow 1 · Recurring supplies, hi-fi 2a: the table on the left, the selected item on the right. */
export default function Supplies() {
  const { family, parent, me, members } = useFamily();
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const roomy = useWide(640);
  const supplies = useLive<Supply>('supplies', family?.id, () => supabase!.from('supplies').select('*').eq('parent_id', parent!.id).order('next_due'), [parent?.id]);

  if (!family || !parent || !me) return null;

  const canEdit = can(me, 'order');
  const orderers = members.filter((m) => can(m, 'order'));
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? null;
  const rows = [...supplies.rows].sort((a, b) => Number(a.paused) - Number(b.paused) || a.next_due.localeCompare(b.next_due));
  const active = rows.filter((s) => !s.paused);
  const current = rows.find((s) => s.id === selected) ?? active[0] ?? rows[0];

  // This month: every delivery that falls in the current calendar month.
  const month = monthTotals(active);
  const split = Object.entries(month.byPayer)
    .sort((a, b) => b[1] - a[1])
    .map(([id, v]) => `${nameOf(id === '-' ? null : id) ?? 'Unpaid'} ${Math.round((v / (month.total || 1)) * 100)}`)
    .join(' · ');

  const aside = adding ? (
    <AddSupply
      familyId={family.id}
      parentId={parent.id}
      me={me}
      orderers={orderers}
      onDone={(id) => {
        setAdding(false);
        if (id) setSelected(id);
        supplies.refresh();
      }}
    />
  ) : current ? (
    <SupplyDetail key={current.id} supply={current} parentName={parent.display_name} canEdit={canEdit} orderers={orderers} members={members} onChange={supplies.refresh} />
  ) : (
    <Text style={t.muted}>Add the things {parent.display_name} runs out of: test strips, diapers, dressings.</Text>
  );

  return (
    <Page aside={aside}>
      <PageHeader
        eyebrow={`${parent.display_name} · ${family.name}`}
        title="Supplies"
        actions={canEdit && !adding ? <Pill label="+ Add supply" onPress={() => setAdding(true)} /> : null}
      />

      {!canEdit ? <Text style={t.muted}>You can see supplies. Ordering needs the Order permission from the family owner.</Text> : null}

      <View style={styles.stats}>
        <Stat label="This month" value={month.total ? vnd(month.total) : '–'} />
        <Stat label="Next delivery" value={active[0] ? shortDay(fromIsoDay(active[0].next_due)) : '–'} />
        <Stat label="Split" value={split || '–'} />
      </View>

      <View style={styles.table}>
        <View style={styles.thead}>
          <Text style={[styles.th, { flex: 1.6 }]}>Item</Text>
          <Text style={[styles.th, { flex: 1 }]}>Stock</Text>
          {roomy ? <Text style={[styles.th, { flex: 1 }]}>Cycle</Text> : null}
          {roomy ? <Text style={[styles.th, styles.payer]}>Paid by</Text> : null}
          <Text style={[styles.th, styles.price]}>Price</Text>
        </View>
        {rows.length === 0 && !supplies.loading ? (
          <Text style={[t.muted, { padding: 20 }]}>No supplies yet.</Text>
        ) : null}
        {rows.map((s) => {
          const d = daysUntil(s.next_due);
          const tone = d < 0 ? 'coral' : d <= 5 ? 'amber' : 'accent';
          const fg = { coral: color.coral, amber: color.amber, accent: color.accent }[tone];
          const on = current?.id === s.id && !adding;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                setAdding(false);
                setSelected(s.id);
              }}
              style={({ hovered }) => [styles.tr, !s.paused && d <= 5 && styles.soon, on && styles.on, hovered && !on && { backgroundColor: '#FAFBFB' }]}>
              <View style={{ flex: 1.6, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={t.small} numberOfLines={1}>
                  {[s.details, s.owner_member_id ? `ordered by ${nameOf(s.owner_member_id)}` : 'no owner'].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                {s.paused ? (
                  <Text style={[styles.cellStrong, { color: color.inkMuted }]}>Paused</Text>
                ) : (
                  <>
                    <Text style={[styles.cellStrong, { color: fg }]}>{d < 0 ? `${-d} days late` : `${d} days`}</Text>
                    <Bar pct={(Math.max(d, 0) / s.every_days) * 100} tone={tone} />
                  </>
                )}
              </View>
              {roomy ? <Text style={[styles.cell, { flex: 1 }]}>{s.every_days} days</Text> : null}
              {roomy ? (
                <Text style={[styles.cell, styles.payer]} numberOfLines={1}>
                  {nameOf(s.paid_by_member_id) ?? '–'}
                </Text>
              ) : null}
              <Text style={[styles.cellStrong, styles.price]}>{s.price_vnd != null ? shortVnd(s.price_vnd) : '–'}</Text>
            </Pressable>
          );
        })}
      </View>
    </Page>
  );
}

function monthTotals(list: Supply[]) {
  const now = today();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const byPayer: Record<string, number> = {};
  let total = 0;
  for (const s of list) {
    if (!s.price_vnd) continue;
    // Walk the cycle back to the first delivery of the month, then forward.
    let d = fromIsoDay(s.next_due);
    while (d >= start) d = addDays(d, -s.every_days);
    for (d = addDays(d, s.every_days); d < end; d = addDays(d, s.every_days)) {
      if (d >= start) {
        total += s.price_vnd;
        const k = s.paid_by_member_id ?? '-';
        byPayer[k] = (byPayer[k] ?? 0) + s.price_vnd;
      }
    }
  }
  return { total, byPayer };
}

/** Right panel: one supply, with Tend's cycle suggestion and the details people edit. */
function SupplyDetail({
  supply: s,
  parentName,
  canEdit,
  orderers,
  members,
  onChange,
}: {
  supply: Supply;
  parentName: string;
  canEdit: boolean;
  orderers: Member[];
  members: Member[];
  onChange: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState(s.price_vnd != null ? String(s.price_vnd) : '');
  const [pack, setPack] = useState(s.pack_size != null ? String(s.pack_size) : '');
  const [perDay, setPerDay] = useState(s.per_day != null ? String(s.per_day) : '');
  const [deliverTo, setDeliverTo] = useState(s.deliver_to ?? '');
  const [editingDate, setEditingDate] = useState(false);

  const d = daysUntil(s.next_due);
  const lasts = s.pack_size && s.per_day ? Math.floor(s.pack_size / Number(s.per_day)) : null;
  const suggest = lasts && lasts < s.every_days - 1 ? lasts : null;
  const kicker = s.paused ? 'Paused' : d < 0 ? `${-d} days overdue` : d <= 5 ? `Runs out in ${d} ${d === 1 ? 'day' : 'days'}` : `Next delivery in ${d} days`;
  const kickerColor = s.paused ? color.inkMuted : d < 0 ? color.coral : d <= 5 ? color.amber : color.accent;
  const cycles = Array.from(new Set([...(suggest ? [suggest] : []), ...CYCLES.filter((c) => Math.abs(c - s.every_days) <= 15), s.every_days])).sort((a, b) => a - b).slice(0, 4);

  async function update(patch: Partial<Supply>) {
    if (!supabase) return;
    setError(null);
    const { error } = await supabase.from('supplies').update(patch).eq('id', s.id);
    if (error) setError(error.message.includes('check') ? 'That value is out of range.' : error.message);
    await onChange();
  }

  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[^\d.]/g, '')));

  async function remove() {
    if (!supabase) return;
    const { error } = await supabase.from('supplies').delete().eq('id', s.id);
    if (error) setError(error.message);
    await onChange();
  }

  return (
    <View style={{ gap: 18, flexGrow: 1 }}>
      <Text style={[styles.kicker, { color: kickerColor }]}>{kicker}</Text>
      <Text style={styles.asideTitle}>{s.name}</Text>
      <Text style={[t.muted, { lineHeight: 21 }]}>
        {lasts
          ? `${parentName} uses ${Number(s.per_day)} a day: a pack of ${s.pack_size} lasts about ${lasts} days, and the cycle is ${s.every_days}.${suggest ? ' Tend suggests shortening it.' : ''}`
          : `${s.details ? `${s.details}. ` : ''}Add the pack size and daily use below and Tend will check the cycle for you.`}
      </Text>
      {suggest && canEdit ? (
        <View style={styles.suggest}>
          <Text style={styles.suggestText}>
            <Text style={{ fontFamily: font.bold }}>Suggested: </Text>every {suggest} days, so {parentName} never runs out before the next delivery.
          </Text>
          <Pill small variant="outline" label={`Use ${suggest} days`} onPress={() => update({ every_days: suggest })} />
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={styles.fieldLabel}>Delivery cycle</Text>
        <View style={styles.segment}>
          {cycles.map((c) => {
            const on = s.every_days === c;
            return (
              <Pressable key={c} disabled={!canEdit} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => update({ every_days: c })} style={[styles.seg, on && styles.segOn]}>
                <Text style={[styles.segText, on && { color: '#fff', fontFamily: font.bold }]}>{c} d</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <View style={styles.inline}>
          <Text style={styles.fieldLabel}>Next delivery · {shortDay(fromIsoDay(s.next_due))}</Text>
          {canEdit ? (
            <Text style={styles.link} onPress={() => setEditingDate(!editingDate)}>
              {editingDate ? 'Done' : 'Change'}
            </Text>
          ) : null}
        </View>
        {editingDate ? <DayPicker value={s.next_due} onChange={(day) => update({ next_due: day })} count={21} /> : null}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={styles.fieldLabel}>Who orders it</Text>
        <Row>
          {orderers.map((m) => (
            <Chip key={m.id} label={m.display_name} selected={s.owner_member_id === m.id} disabled={!canEdit} onPress={() => update({ owner_member_id: m.id })} />
          ))}
          <Chip label="No one" selected={!s.owner_member_id} disabled={!canEdit} onPress={() => update({ owner_member_id: null })} />
        </Row>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={styles.fieldLabel}>Who pays</Text>
        <Row>
          {members
            .filter((m) => m.role !== 'viewer')
            .map((m) => (
              <Chip key={m.id} label={m.display_name} selected={s.paid_by_member_id === m.id} disabled={!canEdit} onPress={() => update({ paid_by_member_id: m.id })} />
            ))}
        </Row>
      </View>

      <View style={styles.inline}>
        <View style={{ flex: 1 }}>
          <Field label="Price (₫)" value={price} onChangeText={setPrice} inputMode="numeric" editable={canEdit} onBlur={() => num(price) !== s.price_vnd && update({ price_vnd: num(price) })} placeholder="390000" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Per pack" value={pack} onChangeText={setPack} inputMode="numeric" editable={canEdit} onBlur={() => num(pack) !== s.pack_size && update({ pack_size: num(pack) })} placeholder="50" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Used a day" value={perDay} onChangeText={setPerDay} inputMode="decimal" editable={canEdit} onBlur={() => num(perDay) !== (s.per_day == null ? null : Number(s.per_day)) && update({ per_day: num(perDay) })} placeholder="2" />
        </View>
      </View>

      <Field label="Deliver to" value={deliverTo} onChangeText={setDeliverTo} editable={canEdit} onBlur={() => (deliverTo.trim() || null) !== s.deliver_to && update({ deliver_to: deliverTo.trim() || null })} placeholder={`${parentName}'s home · call before arriving`} />

      <ErrorText>{error}</ErrorText>

      {canEdit ? (
        <View style={{ marginTop: 'auto', gap: 10 }}>
          {!s.paused ? (
            <Pill full label={`Ordered today · next ${shortDay(addDays(today(), s.every_days))}`} onPress={() => update({ next_due: isoDay(addDays(today(), s.every_days)), last_ordered_at: new Date().toISOString() })} />
          ) : null}
          <Pill full variant="outline" label={s.paused ? 'Resume this item' : 'Pause this item'} onPress={() => update({ paused: !s.paused })} />
          <Text style={[styles.link, { color: color.coral, textAlign: 'center' }]} onPress={remove}>
            Delete item
          </Text>
          <Text style={[t.small, { textAlign: 'center' }]}>
            {s.last_ordered_at ? `Last ordered ${new Date(s.last_ordered_at).toLocaleDateString('en-GB')}` : 'Not ordered through Tend yet'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function AddSupply({ familyId, parentId, me, orderers, onDone }: { familyId: string; parentId: string; me: Member; orderers: Member[]; onDone: (id?: string) => void }) {
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [every, setEvery] = useState(30);
  const [first, setFirst] = useState<string>(isoDay(addDays(today(), 3)));
  const [owner, setOwner] = useState<string | null>(me.id);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from('supplies')
      .insert({
        family_id: familyId,
        parent_id: parentId,
        name: name.trim(),
        details: details.trim() || null,
        every_days: every,
        next_due: first,
        owner_member_id: owner,
        paid_by_member_id: owner,
        price_vnd: price.trim() ? Number(price.replace(/\D/g, '')) : null,
      })
      .select('id')
      .single();
    setBusy(false);
    if (error) setError(error.message);
    else onDone((data as { id: string }).id);
  }

  return (
    <View style={{ gap: 16, flexGrow: 1 }}>
      <Text style={styles.kicker}>New supply</Text>
      <Text style={styles.asideTitle}>Add a supply</Text>
      <Field label="Item" value={name} onChangeText={setName} placeholder="Glucose test strips" />
      <Field label="Details" value={details} onChangeText={setDetails} placeholder="Accu-Chek Guide · 50" />
      <Field label="Price (₫)" value={price} onChangeText={setPrice} inputMode="numeric" placeholder="390000" />
      <View style={{ gap: 8 }}>
        <Text style={styles.fieldLabel}>Every</Text>
        <Row>
          {CYCLES.map((c) => (
            <Chip key={c} label={`${c} d`} selected={every === c} onPress={() => setEvery(c)} />
          ))}
        </Row>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={styles.fieldLabel}>First delivery</Text>
        <DayPicker value={first} onChange={setFirst} />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={styles.fieldLabel}>Who orders it</Text>
        <Row>
          {orderers.map((m) => (
            <Chip key={m.id} label={m.display_name} selected={owner === m.id} onPress={() => setOwner(m.id)} />
          ))}
          <Chip label="No one yet" selected={!owner} onPress={() => setOwner(null)} />
        </Row>
      </View>
      <ErrorText>{error}</ErrorText>
      <View style={{ marginTop: 'auto', gap: 10 }}>
        <Pill full label="Add supply" onPress={save} busy={busy} disabled={!name.trim()} />
        <Pill full variant="outline" label="Cancel" onPress={() => onDone()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  table: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, borderRadius: 16, overflow: 'hidden' },
  thead: { flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FAFBFB', borderBottomWidth: 1, borderBottomColor: color.line },
  th: { fontFamily: font.bold, fontSize: 13, color: color.inkMuted },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: color.surfaceMuted },
  soon: { backgroundColor: '#FFFAF1' },
  on: { backgroundColor: color.accentSoft },
  name: { fontFamily: font.bold, fontSize: 15.5, color: color.ink },
  cell: { fontFamily: font.regular, fontSize: 14, color: color.ink },
  cellStrong: { fontFamily: font.bold, fontSize: 14, color: color.ink },
  payer: { width: 90 },
  price: { width: 70, textAlign: 'right' },
  kicker: { fontFamily: font.bold, fontSize: 13, color: color.accent, textTransform: 'uppercase', letterSpacing: 0.8 },
  asideTitle: { fontFamily: font.bold, fontSize: 22, lineHeight: 27, color: color.ink },
  suggest: { backgroundColor: color.amberSoft, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  suggestText: { fontFamily: font.regular, fontSize: 14.5, lineHeight: 21, color: color.amberStrong },
  fieldLabel: { fontFamily: font.bold, fontSize: 13.5, color: color.ink },
  segment: { flexDirection: 'row', gap: 6, backgroundColor: color.bg, borderRadius: 999, padding: 4 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  segOn: { backgroundColor: color.accent },
  segText: { fontFamily: font.regular, fontSize: 14, color: color.ink },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  link: { fontFamily: font.bold, fontSize: 14, color: color.accent },
});
