import { clock, daysUntil, relativeDays, shortDay } from './dates';
import { useFamily, useLive } from './family';
import { supabase } from './supabase';
import type { Appointment, Reading, Supply } from './types';

/**
 * "Needs a person": the things nobody owns yet, or that are due soon.
 * Shared by Overview and the sidebar badges so both always agree.
 */
export type Need = {
  key: string;
  module: 'supplies' | 'appointments' | 'health';
  kind: 'supply-owner' | 'supply-due' | 'appt-driver' | 'bp-high';
  id: string;
  tone: 'coral' | 'amber';
  title: string;
  sub: string;
  ownerId: string | null;
};

export const SOON_DAYS = 5;
export const DRIVER_WINDOW_DAYS = 14;
export const BP_LIMIT = { sys: 140, dia: 90 };

export function computeNeeds(supplies: Supply[], appts: Appointment[], readings: Reading[] = []): Need[] {
  const out: Need[] = [];
  for (const s of supplies) {
    if (s.paused) continue;
    const d = daysUntil(s.next_due);
    if (!s.owner_member_id) {
      out.push({ key: `so-${s.id}`, module: 'supplies', kind: 'supply-owner', id: s.id, tone: 'coral', title: `${s.name} has no owner`, sub: `Next delivery ${relativeDays(d)}`, ownerId: null });
    } else if (d <= SOON_DAYS) {
      out.push({ key: `sd-${s.id}`, module: 'supplies', kind: 'supply-due', id: s.id, tone: d < 0 ? 'coral' : 'amber', title: `${s.name} run out ${relativeDays(d)}`, sub: `${s.details ? `${s.details} · ` : ''}every ${s.every_days} days`, ownerId: s.owner_member_id });
    }
  }
  const now = Date.now();
  for (const a of appts) {
    const when = new Date(a.starts_at);
    if (a.status === 'scheduled' && !a.driver_member_id && when.getTime() > now && when.getTime() - now < DRIVER_WINDOW_DAYS * 86_400_000) {
      out.push({ key: `ad-${a.id}`, module: 'appointments', kind: 'appt-driver', id: a.id, tone: 'coral', title: `${new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(when)} check-up has no driver`, sub: `${a.title}${a.place ? ` · ${a.place}` : ''} · ${shortDay(when)}, ${clock(when)}`, ownerId: null });
    }
  }
  const latest = readings.find((r) => r.kind === 'blood_pressure');
  if (latest && isHigh(latest) && now - new Date(latest.taken_at).getTime() < 36 * 3600_000) {
    out.push({ key: `bp-${latest.id}`, module: 'health', kind: 'bp-high', id: latest.id, tone: 'amber', title: 'Blood pressure above range', sub: `${bp(latest)} at ${clock(new Date(latest.taken_at))}`, ownerId: null });
  }
  return out;
}

export const isHigh = (r: Reading) => r.value >= BP_LIMIT.sys || (r.value_secondary ?? 0) >= BP_LIMIT.dia;
export const bp = (r: Reading) => `${Math.round(r.value)}/${Math.round(r.value_secondary ?? 0)}`;

/** Live needs for the current family's parent. */
export function useNeeds() {
  const { family, parent } = useFamily();
  const pid = parent?.id;
  const supplies = useLive<Supply>('supplies', family?.id, () => supabase!.from('supplies').select('*').eq('parent_id', pid!).order('next_due'), [pid]);
  const appts = useLive<Appointment>(
    'appointments',
    family?.id,
    () => supabase!.from('appointments').select('*').eq('parent_id', pid!).eq('status', 'scheduled').gte('starts_at', new Date().toISOString()).order('starts_at'),
    [pid]
  );
  const readings = useLive<Reading>(
    'readings',
    family?.id,
    () => supabase!.from('readings').select('*').eq('parent_id', pid!).eq('kind', 'blood_pressure').order('taken_at', { ascending: false }).limit(30),
    [pid]
  );
  return {
    supplies,
    appts,
    readings,
    needs: computeNeeds(supplies.rows, appts.rows, readings.rows),
  };
}
