import { router } from 'expo-router';
import { View } from 'react-native';

import { Avatar, Badge, Card, Heading, Row, Small, Spread, Strong } from '@/components/kit';
import { Body, Button, Screen, Title } from '@/components/ui';
import { clock, daysUntil, longDay, relativeDays } from '@/lib/dates';
import { useFamily, useLive } from '@/lib/family';
import { supabase } from '@/lib/supabase';
import type { Appointment, Supply } from '@/lib/types';
import { space } from '@/theme/tokens';

type Need = { key: string; title: string; sub: string; owner: string | null; tone: 'coral' | 'amber'; go: '/supplies' | '/appointments' };

/** Hi-fi 1a · Overview: what needs a person this week, and who owns it. */
export default function Overview() {
  const { family, parent, members } = useFamily();
  const supplies = useLive<Supply>('supplies', family?.id, () =>
    supabase!.from('supplies').select('*').eq('parent_id', parent!.id).order('next_due')
  );
  const appts = useLive<Appointment>('appointments', family?.id, () =>
    supabase!
      .from('appointments')
      .select('*')
      .eq('parent_id', parent!.id)
      .eq('status', 'scheduled')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
  );

  if (!family || !parent) return null;

  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? null;

  const needs: Need[] = [];
  for (const s of supplies.rows) {
    const d = daysUntil(s.next_due);
    if (!s.owner_member_id) {
      needs.push({ key: `so-${s.id}`, title: `${s.name} has no owner`, sub: `Next delivery ${relativeDays(d)}`, owner: null, tone: 'coral', go: '/supplies' });
    } else if (d <= 5) {
      needs.push({ key: `sd-${s.id}`, title: `${s.name}: next delivery ${relativeDays(d)}`, sub: s.details ?? `Every ${s.every_days} days`, owner: nameOf(s.owner_member_id), tone: d < 0 ? 'coral' : 'amber', go: '/supplies' });
    }
  }
  for (const a of appts.rows) {
    const when = new Date(a.starts_at);
    if (!a.driver_member_id && when.getTime() - Date.now() < 14 * 86_400_000) {
      needs.push({ key: `ad-${a.id}`, title: `${a.title} has no driver`, sub: `${longDay(when)} · ${clock(when)}${a.place ? ` · ${a.place}` : ''}`, owner: null, tone: 'coral', go: '/appointments' });
    }
  }

  const next = appts.rows[0];

  return (
    <Screen>
      <View>
        <Small>
          {parent.display_name} · {family.name}
        </Small>
        <Title>{longDay(new Date())}</Title>
      </View>

      {!parent.consent_updated_at ? (
        <Card>
          <Small tone="amber">
            Parent mode isn't set up yet. Go to Family → "Set up {parent.display_name}'s phone" to pair it.
          </Small>
        </Card>
      ) : null}

      <Card>
        <Spread>
          <Heading>Needs a person</Heading>
          <Small>
            {needs.length} open{needs.length ? '' : ' · every item has an owner'}
          </Small>
        </Spread>
        {needs.length === 0 ? <Body muted>Nothing waiting. Every supply and check-up has someone on it.</Body> : null}
        {needs.map((n) => (
          <View key={n.key} style={{ gap: space.xs, paddingVertical: space.xs }}>
            <Spread>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Strong>{n.title}</Strong>
                <Small>{n.sub}</Small>
              </View>
              <Row>
                {n.owner ? (
                  <>
                    <Avatar name={n.owner} />
                    <Small>{n.owner}</Small>
                  </>
                ) : (
                  <Badge label="Unassigned" tone="coral" />
                )}
                <Button variant="secondary" label="Open" onPress={() => router.push(n.go)} />
              </Row>
            </Spread>
          </View>
        ))}
      </Card>

      <Row gap={space.md}>
        <Card style={{ flexGrow: 1, minWidth: 220 }}>
          <Heading>Next check-up</Heading>
          {next ? (
            <>
              <Strong>
                {longDay(new Date(next.starts_at))} · {clock(new Date(next.starts_at))}
              </Strong>
              <Small>
                {next.title}
                {next.place ? ` · ${next.place}` : ''}
              </Small>
              {next.driver_member_id ? (
                <Badge label={`${nameOf(next.driver_member_id)} is driving`} tone="accent" />
              ) : (
                <Badge label="No driver yet" tone="coral" />
              )}
            </>
          ) : (
            <Small>Nothing booked.</Small>
          )}
        </Card>
        <Card style={{ flexGrow: 1, minWidth: 220 }}>
          <Heading>Supplies</Heading>
          {supplies.rows.slice(0, 3).map((s) => (
            <Spread key={s.id}>
              <Body>{s.name}</Body>
              <Small tone={daysUntil(s.next_due) <= 5 ? 'amber' : undefined}>{relativeDays(daysUntil(s.next_due))}</Small>
            </Spread>
          ))}
          {supplies.rows.length === 0 ? <Small>No supplies yet.</Small> : null}
        </Card>
      </Row>
    </Screen>
  );
}
