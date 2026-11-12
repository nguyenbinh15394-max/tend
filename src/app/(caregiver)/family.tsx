import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Chip, CodeBox, Row } from '@/components/kit';
import { Grid, Page, PageHeader, Panel, Pill, t, useWide } from '@/components/layout';
import { ErrorText, Field } from '@/components/ui';
import { useFamily, useLive } from '@/lib/family';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { ConsentArea, Invite, Member, ParentDevice, Role } from '@/lib/types';
import { color, font } from '@/theme/tokens';

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

const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', caregiver: 'Caregiver', viewer: 'View only' };

/** Flow 3 · Family circle, hi-fi 2e: who can do what, and what the parent shares. */
export default function Family() {
  const { family, me, members, parent, reload } = useFamily();
  const { signOut, session } = useSession();
  const [inviting, setInviting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const roomy = useWide(640);
  const isOwner = me?.role === 'owner';
  const canManage = me?.role === 'owner' || me?.role === 'caregiver';

  if (!family || !me || !parent) return null;

  return (
    <Page aside={<ConsentPanel parentName={parent.display_name} consent={parent.consent} chosen={!!parent.consent_updated_at} />}>
      <PageHeader
        eyebrow={`${parent.display_name} · ${family.name}`}
        title="Family circle"
        actions={isOwner ? <Pill label={inviting ? 'Close' : 'Invite someone'} variant={inviting ? 'outline' : 'primary'} onPress={() => setInviting(!inviting)} /> : null}
      />

      {inviting ? <InviteForm familyId={family.id} onDone={() => setInviting(false)} /> : null}

      <View style={styles.table}>
        <View style={[styles.thead, !roomy && { display: 'none' }]}>
          <Text style={[styles.th, { flex: 1 }]}>Member</Text>
          {['Order', 'Book', 'Health', 'Admin'].map((h) => (
            <Text key={h} style={[styles.th, styles.cell]}>
              {h}
            </Text>
          ))}
        </View>
        {members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            isMe={m.id === me.id}
            editable={isOwner && m.id !== me.id}
            roomy={roomy}
            open={open === m.id}
            onToggle={() => setOpen(open === m.id ? null : m.id)}
            onChange={reload}
          />
        ))}
      </View>

      {isOwner ? <PendingInvites familyId={family.id} /> : null}

      <Grid min={320}>
        <MyContact familyId={family.id} me={me} email={session?.user.email} onChange={reload} onSignOut={signOut} />
        {canManage ? <ParentPhone parentId={parent.id} parentName={parent.display_name} /> : null}
      </Grid>
    </Page>
  );
}

function ConsentPanel({ parentName, consent, chosen }: { parentName: string; consent: Record<ConsentArea, boolean>; chosen: boolean }) {
  return (
    <View style={{ gap: 16, flexGrow: 1 }}>
      <Text style={styles.kicker}>{parentName}&apos;s consent</Text>
      <Text style={styles.asideTitle}>What {parentName} agreed to share</Text>
      <Text style={[t.muted, { lineHeight: 21 }]}>Set on {parentName}&apos;s phone during setup. Only they can change these, from parent mode.</Text>
      {chosen ? (
        CONSENT.map((c) => (
          <View key={c.key} style={styles.consentRow}>
            <Text style={t.body}>{c.label}</Text>
            <Text style={[styles.state, consent[c.key] ? styles.shared : styles.notShared]}>{consent[c.key] ? 'Shared' : 'Not shared'}</Text>
          </View>
        ))
      ) : (
        <Text style={[t.muted, { color: color.amberStrong }]}>Not chosen yet. {parentName} chooses on their phone, right after it&apos;s set up.</Text>
      )}
      <View style={styles.policy}>
        <Text style={styles.code}>{'policy "read readings with health consent"\nusing (is_member(family_id)\n  and parent_allows(parent_id, \'health\'))'}</Text>
      </View>
    </View>
  );
}

function MemberRow({
  member: m,
  isMe,
  editable,
  roomy,
  open,
  onToggle,
  onChange,
}: {
  member: Member;
  isMe: boolean;
  editable: boolean;
  roomy: boolean;
  open: boolean;
  onToggle: () => void;
  onChange: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const owner = m.role === 'owner';

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

  const setRole = (role: Role) => update(role === 'viewer' ? { role, can_order: false, can_book: false, can_health: false } : { role });
  const sub = [ROLE_LABEL[m.role], m.phone, m.call_order ? `called #${m.call_order}` : null].filter(Boolean).join(' · ');

  const switches = (
    <>
        {PERMS.map((p) => (
          <View key={p.key} style={styles.cell}>
            <Switch
              accessibilityLabel={`${m.display_name} can ${p.label.toLowerCase()}`}
              value={owner || m[p.key]}
              disabled={!editable || owner || m.role === 'viewer'}
              onValueChange={(v) => update({ [p.key]: v })}
              trackColor={{ true: color.accent, false: color.border }}
              thumbColor="#fff"
              {...({ activeThumbColor: '#fff' } as object)}
            />
            {!roomy ? <Text style={styles.permLabel}>{p.label}</Text> : null}
          </View>
        ))}
        <View style={styles.cell}>
          <Switch
            accessibilityLabel={`${m.display_name} is an owner`}
            value={owner}
            disabled={!editable}
            onValueChange={(v) => setRole(v ? 'owner' : 'caregiver')}
            trackColor={{ true: color.accent, false: color.border }}
            thumbColor="#fff"
            {...({ activeThumbColor: '#fff' } as object)}
          />
          {!roomy ? <Text style={styles.permLabel}>Admin</Text> : null}
        </View>
    </>
  );

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Pressable onPress={editable ? onToggle : undefined} disabled={!editable} accessibilityRole={editable ? 'button' : undefined} accessibilityState={{ expanded: open }} style={styles.who}>
          <View style={[styles.avatar, owner ? { backgroundColor: color.accent } : null]}>
            <Text style={[styles.avatarText, owner ? { color: '#fff' } : null]}>{m.display_name.trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {m.display_name}
              {isMe ? ' (you)' : ''}
            </Text>
            <Text style={t.small} numberOfLines={1}>
              {sub}
            </Text>
          </View>
        </Pressable>
        {roomy ? switches : null}
      </View>
      {!roomy ? <View style={styles.permsNarrow}>{switches}</View> : null}

      {open && editable ? (
        <View style={[styles.drawer, !roomy && { paddingLeft: 20 }]}>
          <Row>
            <Text style={t.muted}>Role</Text>
            {(['caregiver', 'viewer'] as Role[]).map((r) => (
              <Chip key={r} label={ROLE_LABEL[r]} selected={m.role === r} onPress={() => setRole(r)} />
            ))}
          </Row>
          <Row>
            <Text style={t.muted}>{`Call order on the parent's phone`}</Text>
            {[null, 1, 2, 3].map((n) => (
              <Chip key={String(n)} label={n ? `#${n}` : 'Not called'} selected={m.call_order === n} onPress={() => update({ call_order: n })} />
            ))}
          </Row>
          <Pill small variant="outline" label={`Remove ${m.display_name}`} onPress={remove} />
        </View>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

function InviteForm({ familyId, onDone }: { familyId: string; onDone: () => void }) {
  const [role, setRole] = useState<Role>('caregiver');
  const [perms, setPerms] = useState({ can_order: true, can_book: true, can_health: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const p = role === 'caregiver' ? perms : { can_order: false, can_book: false, can_health: false };
    const { error } = await supabase.from('invites').insert({ family_id: familyId, role, ...p });
    setBusy(false);
    if (error) setError(error.message);
    else onDone();
  }

  return (
    <Panel title="Invite someone">
      <Text style={t.muted}>They sign in to Tend with their email, then enter the code. Codes work once and expire in 7 days.</Text>
      <Row>
        {(['caregiver', 'viewer', 'owner'] as Role[]).map((r) => (
          <Chip key={r} label={ROLE_LABEL[r]} selected={role === r} onPress={() => setRole(r)} />
        ))}
      </Row>
      {role === 'caregiver' ? (
        <Row gap={20}>
          {PERMS.map((p) => (
            <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Switch
                accessibilityLabel={p.label}
                value={perms[p.key]}
                onValueChange={(v) => setPerms({ ...perms, [p.key]: v })}
                trackColor={{ true: color.accent, false: color.border }}
                thumbColor="#fff"
                {...({ activeThumbColor: '#fff' } as object)}
              />
              <Text style={t.body}>{p.label}</Text>
            </View>
          ))}
        </Row>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Pill label="Create invite code" onPress={create} busy={busy} />
    </Panel>
  );
}

function PendingInvites({ familyId }: { familyId: string }) {
  const invites = useLive<Invite>('invites', familyId, () =>
    supabase!.from('invites').select('*').eq('family_id', familyId).is('accepted_at', null).order('created_at', { ascending: false })
  );
  const live = invites.rows.filter((i) => new Date(i.expires_at) > new Date());

  async function revoke(id: string) {
    await supabase?.from('invites').delete().eq('id', id);
    await invites.refresh();
  }

  return (
    <>
      {live.map((i) => {
        const days = Math.max(1, Math.ceil((new Date(i.expires_at).getTime() - Date.now()) / 86_400_000));
        const perms = i.role === 'caregiver' ? PERMS.filter((p) => i[p.key]).map((p) => p.label.toLowerCase()).join(', ') || 'view only' : ROLE_LABEL[i.role].toLowerCase();
        return (
          <View key={i.id} style={styles.pending}>
            <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
              <Text style={styles.name}>Pending · code {i.code}</Text>
              <Text style={t.muted}>
                {perms} · expires in {days} {days === 1 ? 'day' : 'days'}
              </Text>
            </View>
            <Text style={styles.link} onPress={() => revoke(i.id)}>
              Revoke
            </Text>
          </View>
        );
      })}
    </>
  );
}

function MyContact({ familyId, me, email, onChange, onSignOut }: { familyId: string; me: Member; email?: string; onChange: () => Promise<void>; onSignOut: () => void }) {
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
    const { error } = await supabase.rpc('update_my_contact', { in_family: familyId, new_name: name.trim(), new_phone: phone.trim() || null });
    setBusy(false);
    if (error) setError(error.message.includes('phone') ? 'Use digits only, e.g. +84 905 123 456.' : error.message);
    else {
      setSaved(true);
      await onChange();
    }
  }

  const dirty = name.trim() !== me.display_name || (phone.trim() || null) !== me.phone;

  return (
    <Panel title="Your details" style={{ height: '100%' }}>
      <Text style={t.muted}>{email ? `Signed in as ${email}. ` : ''}Your phone is what the parent&apos;s &quot;Call my children&quot; button dials.</Text>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Phone" value={phone} onChangeText={setPhone} inputMode="tel" placeholder="+84 905 123 456" />
      <ErrorText>{error}</ErrorText>
      {saved && !dirty ? <Text style={[t.muted, { color: color.green }]}>Saved.</Text> : null}
      {dirty ? <Text style={[t.muted, { color: color.amberStrong }]}>Not saved yet.</Text> : null}
      <Row>
        <Pill label="Save" onPress={save} busy={busy} disabled={!name.trim() || !dirty} />
        <Pill variant="outline" label="Sign out" onPress={onSignOut} />
      </Row>
    </Panel>
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
    if (!supabase) return;
    const { data } = await supabase.from('parent_devices').select('*').eq('parent_id', parentId).order('paired_at');
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
    <Panel title={`${parentName}'s phone`} style={{ height: '100%' }}>
      <Text style={t.muted}>
        Parent mode needs no account. On {parentName}&apos;s phone, open Tend, tap &quot;Set up this phone for my parent&quot; and enter the code. Codes last 15 minutes and work once.
      </Text>
      {list.map((d) => (
        <View key={d.user_id} style={styles.consentRow}>
          <Text style={t.body}>
            {d.label || 'Phone'} · paired {new Date(d.paired_at).toLocaleDateString('en-GB')}
          </Text>
          <Text style={styles.link} onPress={() => unpair(d.user_id)}>
            Unpair
          </Text>
        </View>
      ))}
      {code ? <CodeBox code={code} caption="Valid for 15 minutes" /> : null}
      <ErrorText>{error}</ErrorText>
      <Row>
        <Pill label={code ? 'New code' : list.length ? 'Pair another phone' : `Set up ${parentName}'s phone`} onPress={makeCode} busy={busy} />
        <Pill variant="outline" label="Refresh" onPress={load} />
      </Row>
    </Panel>
  );
}

const styles = StyleSheet.create({
  table: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, borderRadius: 16, overflow: 'hidden' },
  thead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FAFBFB', borderBottomWidth: 1, borderBottomColor: color.line },
  th: { fontFamily: font.bold, fontSize: 13, color: color.inkMuted },
  cell: { width: 76, alignItems: 'center', textAlign: 'center' },
  row: { borderBottomWidth: 1, borderBottomColor: color.surfaceMuted },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 15, color: color.accentStrong },
  name: { fontFamily: font.bold, fontSize: 15.5, color: color.ink },
  permsNarrow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 14 },
  permLabel: { fontFamily: font.regular, fontSize: 12.5, color: color.inkMuted, marginTop: 4 },
  drawer: { paddingHorizontal: 20, paddingBottom: 16, paddingLeft: 70, gap: 10 },
  pending: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, backgroundColor: color.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: '#B9C4C0', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16 },
  link: { fontFamily: font.bold, fontSize: 14, color: color.accent },
  kicker: { fontFamily: font.bold, fontSize: 13, color: color.accent, textTransform: 'uppercase', letterSpacing: 0.8 },
  asideTitle: { fontFamily: font.bold, fontSize: 22, lineHeight: 27, color: color.ink },
  consentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: color.surfaceMuted },
  state: { fontFamily: font.bold, fontSize: 13, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  shared: { backgroundColor: color.greenSoft, color: color.green },
  notShared: { backgroundColor: color.surfaceMuted, color: color.inkMuted },
  policy: { marginTop: 'auto', backgroundColor: color.bg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  code: { fontFamily: 'monospace', fontSize: 12.5, lineHeight: 20, color: '#3B4744' },
});
