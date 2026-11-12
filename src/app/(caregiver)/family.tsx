import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Avatar, Badge, Card, Chip, CodeBox, Heading, Row, Small, Spread, Strong, Toggle } from '@/components/kit';
import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { useFamily, useLive } from '@/lib/family';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { ConsentArea, Invite, Member, ParentDevice, Role } from '@/lib/types';
import { space } from '@/theme/tokens';

const PERMS = [
  { key: 'can_order', label: 'Order' },
  { key: 'can_book', label: 'Book' },
  { key: 'can_health', label: 'Health' },
] as const;

const CONSENT: { key: ConsentArea; label: string }[] = [
  { key: 'medicines', label: "Today's medicines" },
  { key: 'appointments', label: 'Appointments' },
  { key: 'health', label: 'Blood pressure readings' },
  { key: 'emergency_location', label: 'Location, emergencies only' },
];

/** Flow 3 · Family circle: roles enforced by row-level security (hi-fi 2e). */
export default function Family() {
  const { family, me, members, parent, reload } = useFamily();
  const { signOut, session } = useSession();
  const isOwner = me?.role === 'owner';
  const canManage = me?.role === 'owner' || me?.role === 'caregiver';

  if (!family || !me || !parent) return null;

  return (
    <Screen>
      <View>
        <Small>
          {parent.display_name} · {family.name}
        </Small>
        <Title>Family circle</Title>
      </View>

      <Card>
        <Heading>Members</Heading>
        <Small>Owners can do everything. Everyone else gets only what is switched on. The database enforces this.</Small>
        {members.map((m) => (
          <MemberRow key={m.id} member={m} isMe={m.id === me.id} editable={isOwner && m.id !== me.id} onChange={reload} />
        ))}
      </Card>

      <MyContact familyId={family.id} me={me} email={session?.user.email} onChange={reload} />

      {isOwner ? <Invites familyId={family.id} /> : null}

      <Card>
        <Heading>What {parent.display_name} agreed to share</Heading>
        <Small>Set on {parent.display_name}'s phone. Only they can change these, from parent mode.</Small>
        {parent.consent_updated_at ? (
          CONSENT.map((c) => (
            <Spread key={c.key}>
              <Body>{c.label}</Body>
              <Badge label={parent.consent[c.key] ? 'Shared' : 'Not shared'} tone={parent.consent[c.key] ? 'green' : 'neutral'} />
            </Spread>
          ))
        ) : (
          <Small tone="amber">Not chosen yet. {parent.display_name} chooses on their phone, right after it's set up.</Small>
        )}
      </Card>

      {canManage ? <ParentPhone parentId={parent.id} parentName={parent.display_name} /> : null}

      <Button variant="secondary" label="Sign out" onPress={signOut} />
    </Screen>
  );
}

function MemberRow({
  member: m,
  isMe,
  editable,
  onChange,
}: {
  member: Member;
  isMe: boolean;
  editable: boolean;
  onChange: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  async function update(patch: Partial<Member>) {
    if (!supabase) return;
    setError(null);
    const { error } = await supabase.from('members').update(patch).eq('id', m.id);
    if (error) setError(error.message);
    await onChange();
  }

  async function remove() {
    if (!supabase) return;
    const { error } = await supabase.from('members').delete().eq('id', m.id);
    if (error) setError(error.message);
    await onChange();
  }

  const setRole = (role: Role) =>
    update(role === 'viewer' ? { role, can_order: false, can_book: false, can_health: false } : { role });

  return (
    <View style={{ gap: space.sm, paddingVertical: space.sm }}>
      <Row>
        <Avatar name={m.display_name} tone={m.role === 'owner' ? 'accent' : 'neutral'} />
        <View style={{ flex: 1, minWidth: 160 }}>
          <Strong>
            {m.display_name}
            {isMe ? ' (you)' : ''}
          </Strong>
          <Small>
            {m.phone ? m.phone : 'No phone yet'}
            {m.call_order ? ` · called #${m.call_order}` : ''}
          </Small>
        </View>
        <Badge label={m.role} tone={m.role === 'owner' ? 'accent' : 'neutral'} />
      </Row>

      {editable ? (
        <>
          <Row>
            {(['owner', 'caregiver', 'viewer'] as Role[]).map((r) => (
              <Chip key={r} label={r} selected={m.role === r} onPress={() => setRole(r)} />
            ))}
          </Row>
          {m.role !== 'owner' ? (
            <Row gap={space.md}>
              {PERMS.map((p) => (
                <Toggle
                  key={p.key}
                  label={p.label}
                  value={m[p.key]}
                  disabled={m.role === 'viewer'}
                  onChange={(v) => update({ [p.key]: v })}
                />
              ))}
            </Row>
          ) : null}
          <Row>
            <Small>Call order for the parent:</Small>
            {[null, 1, 2, 3].map((n) => (
              <Chip key={String(n)} label={n ? `#${n}` : 'Not called'} selected={m.call_order === n} onPress={() => update({ call_order: n })} />
            ))}
          </Row>
          <Row>
            <Button variant="secondary" label={`Remove ${m.display_name}`} onPress={remove} />
          </Row>
        </>
      ) : (
        <Row gap={space.md}>
          {PERMS.map((p) => (
            <Badge
              key={p.key}
              label={`${p.label}: ${m.role === 'owner' || m[p.key] ? 'yes' : 'no'}`}
              tone={m.role === 'owner' || m[p.key] ? 'green' : 'neutral'}
            />
          ))}
        </Row>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

function MyContact({
  familyId,
  me,
  email,
  onChange,
}: {
  familyId: string;
  me: Member;
  email?: string;
  onChange: () => Promise<void>;
}) {
  const [name, setName] = useState(me.display_name);
  const [phone, setPhone] = useState(me.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const { error } = await supabase.rpc('update_my_contact', {
      in_family: familyId,
      new_name: name.trim(),
      new_phone: phone.trim() || null,
    });
    setBusy(false);
    if (error) setError(error.message.includes('phone') ? 'Use digits only, e.g. +84 905 123 456.' : error.message);
    else {
      setSaved(true);
      await onChange();
    }
  }

  return (
    <Card>
      <Heading>Your details</Heading>
      <Small>Signed in as {email}. Your phone number is what the parent's "Call my children" button dials.</Small>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Phone" value={phone} onChangeText={setPhone} inputMode="tel" placeholder="+84 905 123 456" />
      <ErrorText>{error}</ErrorText>
      {saved ? <Small tone="green">Saved.</Small> : null}
      <Row>
        <Button label="Save" onPress={save} busy={busy} disabled={!name.trim()} />
      </Row>
    </Card>
  );
}

function Invites({ familyId }: { familyId: string }) {
  const [role, setRole] = useState<Role>('caregiver');
  const [perms, setPerms] = useState({ can_order: false, can_book: false, can_health: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invites = useLive<Invite>('invites', familyId, () =>
    supabase!.from('invites').select('*').eq('family_id', familyId).is('accepted_at', null).order('created_at', { ascending: false })
  );

  async function create() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const p = role === 'caregiver' ? perms : { can_order: false, can_book: false, can_health: false };
    const { error } = await supabase.from('invites').insert({ family_id: familyId, role, ...p });
    setBusy(false);
    if (error) setError(error.message);
    await invites.refresh();
  }

  async function revoke(id: string) {
    await supabase?.from('invites').delete().eq('id', id);
    await invites.refresh();
  }

  const live = invites.rows.filter((i) => new Date(i.expires_at) > new Date());

  return (
    <Card>
      <Heading>Invite someone</Heading>
      <Small>They sign in to Tend with their email, then enter the code. Codes work once and expire in 7 days.</Small>
      <Row>
        {(['caregiver', 'viewer', 'owner'] as Role[]).map((r) => (
          <Chip key={r} label={r} selected={role === r} onPress={() => setRole(r)} />
        ))}
      </Row>
      {role === 'caregiver' ? (
        <Row gap={space.md}>
          {PERMS.map((p) => (
            <Toggle key={p.key} label={p.label} value={perms[p.key]} onChange={(v) => setPerms({ ...perms, [p.key]: v })} />
          ))}
        </Row>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Row>
        <Button label="Create invite code" onPress={create} busy={busy} />
      </Row>
      {live.map((i) => (
        <View key={i.id} style={{ gap: space.sm }}>
          <CodeBox
            code={i.code}
            caption={`${i.role}${i.role === 'caregiver' ? ` · ${PERMS.filter((p) => i[p.key]).map((p) => p.label).join(', ') || 'view only'}` : ''} · expires ${new Date(i.expires_at).toLocaleDateString('en-GB')}`}
          />
          <Row>
            <Button variant="secondary" label="Revoke" onPress={() => revoke(i.id)} />
          </Row>
        </View>
      ))}
    </Card>
  );
}

function ParentPhone({ parentId, parentName }: { parentId: string; parentName: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<ParentDevice[]>([]);

  // parent_devices has no family_id column, so it is loaded by parent and
  // refreshed by hand (after pairing on the phone, tap Refresh).
  const load = useCallback(async () => {
    const { data } = await supabase!.from('parent_devices').select('*').eq('parent_id', parentId).order('paired_at');
    setList((data ?? []) as ParentDevice[]);
  }, [parentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function makeCode() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc('create_pairing_code', { for_parent: parentId });
    setBusy(false);
    if (error) setError(error.message);
    else setCode(data as string);
  }

  async function unpair(userId: string) {
    await supabase?.from('parent_devices').delete().eq('user_id', userId);
    await load();
  }

  return (
    <Card>
      <Heading>{parentName}'s phone</Heading>
      <Small>
        Parent mode needs no account. On {parentName}'s phone, open Tend, tap "Set up this phone for my parent" and enter the
        code. Codes last 15 minutes and work once.
      </Small>
      {list.map((d) => (
        <Spread key={d.user_id}>
          <Body>
            {d.label || 'Phone'} · paired {new Date(d.paired_at).toLocaleDateString('en-GB')}
          </Body>
          <Button variant="secondary" label="Unpair" onPress={() => unpair(d.user_id)} />
        </Spread>
      ))}
      {code ? <CodeBox code={code} caption="Valid for 15 minutes" /> : null}
      <ErrorText>{error}</ErrorText>
      <Row>
        <Button label={code ? 'New code' : `Set up ${parentName}'s phone`} onPress={makeCode} busy={busy} />
        <Button variant="secondary" label="Refresh" onPress={load} />
      </Row>
    </Card>
  );
}
