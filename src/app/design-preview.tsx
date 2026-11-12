import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { View } from 'react-native';

import { CaregiverNav } from '@/components/sidebar';
import { useWide } from '@/components/layout';
import { isoDay, addDays, today } from '@/lib/dates';
import { FamilyContext } from '@/lib/family';
import { FixtureProvider } from '@/lib/fixtures';
import type { Member, Parent } from '@/lib/types';

import Appointments from './(caregiver)/appointments';
import FamilyScreen from './(caregiver)/family';
import Health from './(caregiver)/health';
import Medicines from './(caregiver)/medicines';
import Overview from './(caregiver)/overview';
import Supplies from './(caregiver)/supplies';

/**
 * Dev only: the caregiver screens with the hi-fi's sample family, so the
 * layout can be checked against the design without signing in.
 * /design-preview?screen=overview|supplies|appointments|health|medicines|family
 */
const SCREENS: Record<string, [string, ComponentType]> = {
  overview: ['Overview', Overview],
  supplies: ['Supplies', Supplies],
  appointments: ['Appointments', Appointments],
  health: ['Health log', Health],
  medicines: ['Medicines', Medicines],
  family: ['Family', FamilyScreen],
};

export default function DesignPreview() {
  const params = useLocalSearchParams<{ screen?: string }>();
  const [screen, setScreen] = useState(params.screen && SCREENS[params.screen] ? params.screen : 'overview');
  const wide = useWide(1000);
  if (!__DEV__) return <Redirect href="/" />;

  const names = Object.keys(SCREENS);
  const Screen = SCREENS[screen][1];
  const navProps = {
    state: { index: names.indexOf(screen), routes: names.map((n) => ({ key: n, name: n, params: undefined })) },
    descriptors: Object.fromEntries(names.map((n) => [n, { options: { title: SCREENS[n][0] } }])),
    emitter: { emit: () => ({ defaultPrevented: false }) },
    navigateToTab: (k: string) => setScreen(k),
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as Parameters<typeof CaregiverNav>[0];

  return (
    <FamilyContext.Provider value={{ loading: false, family, me: members[0], members, parent, reload: async () => {} }}>
      <FixtureProvider tables={tables()}>
        <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
          <CaregiverNav {...navProps} />
          <View style={{ flex: 1 }}>
            <Screen />
          </View>
        </View>
      </FixtureProvider>
    </FamilyContext.Provider>
  );
}

const F = 'fam';
const P = 'par';
const family = { id: F, name: 'Nguyễn family' };
const m = (id: string, display_name: string, role: Member['role'], o: boolean, b: boolean, h: boolean, phone: string | null, call_order: number | null): Member => ({
  id,
  family_id: F,
  user_id: id,
  display_name,
  role,
  can_order: o,
  can_book: b,
  can_health: h,
  phone,
  call_order,
});
const members: Member[] = [
  m('linh', 'Linh', 'owner', true, true, true, '+84 905 123 456', 1),
  m('nam', 'Nam', 'caregiver', true, true, true, '+84 913 222 111', 2),
  m('lan', 'Bà Lan', 'caregiver', false, true, true, null, 3),
  m('tu', 'Tú', 'viewer', false, false, true, null, null),
];
const parent: Parent = {
  id: P,
  family_id: F,
  display_name: 'ông Hòa',
  consent: { medicines: true, appointments: true, health: true, emergency_location: false },
  consent_updated_at: new Date().toISOString(),
};

function tables() {
  const day = (n: number) => isoDay(addDays(today(), n));
  const at = (n: number, h: number, min = 0) => {
    const d = addDays(today(), n);
    d.setHours(h, min, 0, 0);
    return d.toISOString();
  };
  const base = { family_id: F, parent_id: P };
  const bp = [134, 141, 129, 138, 136, 144, 131, 128, 139, 137, 142, 133, 130, 135, 146, 138, 132, 129, 140, 134, 137, 131, 148, 136, 142, 131, 138, 149, 152, 0];
  return {
    supplies: [
      { ...base, id: 's1', name: 'Glucose test strips', details: 'Accu-Chek Guide · 50', every_days: 30, next_due: day(4), owner_member_id: 'linh', last_ordered_at: null, price_vnd: 390000, pack_size: 50, per_day: 2, paid_by_member_id: 'linh', deliver_to: '24 Lê Lợi, Hải Châu, Đà Nẵng · call before arriving', paused: false },
      { ...base, id: 's2', name: 'Wound dressings', details: 'Urgo · 10', every_days: 45, next_due: day(9), owner_member_id: null, last_ordered_at: null, price_vnd: 95000, pack_size: null, per_day: null, paid_by_member_id: 'nam', deliver_to: null, paused: false },
      { ...base, id: 's3', name: 'Adult diapers (M)', details: 'Caryn · 20', every_days: 14, next_due: day(12), owner_member_id: 'nam', last_ordered_at: null, price_vnd: 245000, pack_size: 20, per_day: 1.5, paid_by_member_id: 'nam', deliver_to: null, paused: false },
      { ...base, id: 's4', name: 'Lancets', details: 'Accu-Chek FastClix · 100', every_days: 60, next_due: day(21), owner_member_id: 'linh', last_ordered_at: null, price_vnd: 180000, pack_size: 100, per_day: 2, paid_by_member_id: 'linh', deliver_to: null, paused: false },
      { ...base, id: 's5', name: 'BP cuff batteries', details: 'AA · 4', every_days: 90, next_due: day(40), owner_member_id: 'linh', last_ordered_at: null, price_vnd: 40000, pack_size: null, per_day: null, paid_by_member_id: 'linh', deliver_to: null, paused: true },
    ],
    appointments: [
      { ...base, id: 'a1', title: 'Endocrinology', place: 'Hospital C', starts_at: at(3, 9), notes: 'BP notebook, health card', status: 'scheduled', booked_by_member_id: 'linh', driver_member_id: null },
      { ...base, id: 'a2', title: 'Eye check', place: 'Family Clinic Hải Châu', starts_at: at(18, 14, 30), notes: null, status: 'scheduled', booked_by_member_id: 'nam', driver_member_id: 'nam' },
      { ...base, id: 'a0', title: 'General check-up', place: 'Family Clinic Hải Châu', starts_at: at(-12, 8), notes: null, status: 'done', booked_by_member_id: 'linh', driver_member_id: 'linh' },
    ],
    readings: bp
      .map((v, i) => ({ ...base, id: `r${i}`, kind: 'blood_pressure', value: v || 152, value_secondary: Math.round((v || 152) * 0.63), unit: 'mmHg', taken_at: at(i - 29, 6, 40), source: i % 9 === 4 ? 'caregiver' : 'parent', recorded_by: 'linh', note: i === 29 ? 'a bit tired' : i === 27 ? 'missed 7:00 Amlodipine' : null }))
      .reverse(),
    medicines: [
      { ...base, id: 'md1', name: 'Metformin 500mg', instructions: 'After breakfast and dinner', times: ['07:00:00', '19:00:00'], active: true },
      { ...base, id: 'md2', name: 'Amlodipine 5mg', instructions: 'After lunch', times: ['12:00:00'], active: true },
    ],
    doses: [0, -1, -2, -3, -4, -5, -6].flatMap((n) => [
      ...(n === -2 || n === -5 ? [] : [{ ...base, id: `d7${n}`, medicine_id: 'md1', scheduled_for: at(n, 7), taken_at: at(n, 7, 10) }]),
      ...(n === 0 ? [] : [{ ...base, id: `d12${n}`, medicine_id: 'md2', scheduled_for: at(n, 12), taken_at: at(n, 12, 20) }]),
      ...(n === 0 ? [] : [{ ...base, id: `d19${n}`, medicine_id: 'md1', scheduled_for: at(n, 19), taken_at: at(n, 19, 5) }]),
    ]),
    invites: [],
    parent_devices: [],
  };
}
