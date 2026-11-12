import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Card, Heading, Row, Small, Spread, Strong } from '@/components/kit';
import { DayPicker, MemberPicker, NumberPicker } from '@/components/pickers';
import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { addDays, daysUntil, fromIsoDay, isoDay, relativeDays, shortDay, today } from '@/lib/dates';
import { useFamily, useLive } from '@/lib/family';
import { supabase } from '@/lib/supabase';
import { can, type Member, type Supply } from '@/lib/types';
import { space } from '@/theme/tokens';

const CYCLES = [7, 14, 20, 25, 30, 45, 60, 90];

/** Flow 1 · Recurring supplies, each with a named owner (hi-fi 2a). */
export default function Supplies() {
  const { family, parent, me, members } = useFamily();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const supplies = useLive<Supply>('supplies', family?.id, () =>
    supabase!.from('supplies').select('*').eq('parent_id', parent!.id).order('next_due')
  );

  if (!family || !parent || !me) return null;

  const canEdit = can(me, 'order');
  const orderers = members.filter((m) => can(m, 'order'));
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? null;
  const soonest = supplies.rows[0];

  return (
    <Screen>
      <View>
        <Small>{parent.display_name} · Supplies</Small>
        <Title>Supplies</Title>
      </View>

      <Row gap={space.md}>
        <Card style={{ flexGrow: 1, minWidth: 180 }}>
          <Small>Next delivery</Small>
          <Strong>{soonest ? `${shortDay(fromIsoDay(soonest.next_due))} · ${soonest.name}` : 'Nothing scheduled'}</Strong>
        </Card>
        <Card style={{ flexGrow: 1, minWidth: 180 }}>
          <Small>Recurring items</Small>
          <Strong>
            {supplies.rows.length} · {supplies.rows.filter((s) => !s.owner_member_id).length} without an owner
          </Strong>
        </Card>
      </Row>

      {canEdit ? (
        adding ? (
          <AddSupply familyId={family.id} parentId={parent.id} me={me} orderers={orderers} onDone={() => { setAdding(false); supplies.refresh(); }} />
        ) : (
          <Row>
            <Button label="+ Add supply" onPress={() => setAdding(true)} />
          </Row>
        )
      ) : (
        <Small>You can see supplies. Ordering needs the Order permission from the family owner.</Small>
      )}

      {supplies.rows.length === 0 && !supplies.loading ? (
        <Body muted>No supplies yet. Add the things {parent.display_name} runs out of: test strips, diapers, dressings.</Body>
      ) : null}

      {supplies.rows.map((s) => (
        <SupplyRow
          key={s.id}
          supply={s}
          owner={nameOf(s.owner_member_id)}
          open={open === s.id}
          onToggle={() => setOpen(open === s.id ? null : s.id)}
          canEdit={canEdit}
          orderers={orderers}
          onChange={supplies.refresh}
        />
      ))}
    </Screen>
  );
}

function SupplyRow({
  supply: s,
  owner,
  open,
  onToggle,
  canEdit,
  orderers,
  onChange,
}: {
  supply: Supply;
  owner: string | null;
  open: boolean;
  onToggle: () => void;
  canEdit: boolean;
  orderers: Member[];
  onChange: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const days = daysUntil(s.next_due);
  const tone = days < 0 ? 'coral' : days <= 5 ? 'amber' : 'green';

  async function update(patch: Partial<Supply>) {
    if (!supabase) return;
    setError(null);
    const { error } = await supabase.from('supplies').update(patch).eq('id', s.id);
    if (error) setError(error.message);
    await onChange();
  }

  async function remove() {
    if (!supabase) return;
    const { error } = await supabase.from('supplies').delete().eq('id', s.id);
    if (error) setError(error.message);
    await onChange();
  }

  return (
    <Card highlight={days <= 5}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle}>
        <Spread>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Strong>{s.name}</Strong>
            {s.details ? <Small>{s.details}</Small> : null}
          </View>
          <Badge label={`Next ${relativeDays(days)}`} tone={tone} />
        </Spread>
        <Row>
          <Small>Every {s.every_days} days</Small>
          <Small>·</Small>
          {owner ? <Small>Owner: {owner}</Small> : <Badge label="No owner" tone="coral" />}
        </Row>
      </Pressable>

      {open && canEdit ? (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Row>
            <Button
              label="Ordered today"
              onPress={() =>
                update({ next_due: isoDay(addDays(today(), s.every_days)), last_ordered_at: new Date().toISOString() })
              }
            />
          </Row>
          <Small>
            {s.last_ordered_at ? `Last ordered ${new Date(s.last_ordered_at).toLocaleDateString('en-GB')}.` : 'Not ordered through Tend yet.'}
          </Small>
          <Heading>Delivery cycle</Heading>
          <NumberPicker options={CYCLES} value={s.every_days} suffix="d" onChange={(n) => update({ every_days: n })} />
          <Heading>Next delivery</Heading>
          <DayPicker value={s.next_due} onChange={(day) => update({ next_due: day })} />
          <Heading>Owner</Heading>
          <MemberPicker
            members={orderers}
            value={s.owner_member_id}
            emptyLabel="No owner"
            onChange={(id) => update({ owner_member_id: id })}
            note="Only people with the Order permission can own a supply."
          />
          <Row>
            <Button variant="secondary" label="Delete item" onPress={remove} />
          </Row>
        </View>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function AddSupply({
  familyId,
  parentId,
  me,
  orderers,
  onDone,
}: {
  familyId: string;
  parentId: string;
  me: Member;
  orderers: Member[];
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [every, setEvery] = useState(30);
  const [first, setFirst] = useState<string>(isoDay(addDays(today(), 3)));
  const [owner, setOwner] = useState<string | null>(me.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('supplies').insert({
      family_id: familyId,
      parent_id: parentId,
      name: name.trim(),
      details: details.trim() || null,
      every_days: every,
      next_due: first,
      owner_member_id: owner,
    });
    setBusy(false);
    if (error) setError(error.message);
    else onDone();
  }

  return (
    <Card>
      <Heading>Add a supply</Heading>
      <Field label="Item" value={name} onChangeText={setName} placeholder="Glucose test strips" />
      <Field label="Details" value={details} onChangeText={setDetails} placeholder="Accu-Chek Guide · 50" />
      <Heading>Every</Heading>
      <NumberPicker options={CYCLES} value={every} suffix="d" onChange={setEvery} />
      <Heading>First delivery</Heading>
      <DayPicker value={first} onChange={setFirst} />
      <Heading>Who owns it</Heading>
      <MemberPicker members={orderers} value={owner} onChange={setOwner} emptyLabel="No owner yet" />
      <ErrorText>{error}</ErrorText>
      <Row>
        <Button label="Add supply" onPress={save} busy={busy} disabled={!name.trim()} />
        <Button variant="secondary" label="Cancel" onPress={onDone} />
      </Row>
    </Card>
  );
}
