/** Row shapes for the tables in supabase/migrations (hand-written for now). */

export type Role = 'owner' | 'caregiver' | 'viewer';
export type Permission = 'order' | 'book' | 'health';
export type ConsentArea = 'medicines' | 'appointments' | 'health' | 'emergency_location';

export type Family = { id: string; name: string };

export type Member = {
  id: string;
  family_id: string;
  user_id: string;
  display_name: string;
  role: Role;
  can_order: boolean;
  can_book: boolean;
  can_health: boolean;
  phone: string | null;
  call_order: number | null;
};

export type Parent = {
  id: string;
  family_id: string;
  display_name: string;
  consent: Record<ConsentArea, boolean>;
  consent_updated_at: string | null;
};

export type Invite = {
  id: string;
  family_id: string;
  code: string;
  role: Role;
  can_order: boolean;
  can_book: boolean;
  can_health: boolean;
  expires_at: string;
  accepted_at: string | null;
};

export type ParentDevice = { user_id: string; parent_id: string; label: string | null; paired_at: string };

export type Supply = {
  id: string;
  family_id: string;
  parent_id: string;
  name: string;
  details: string | null;
  every_days: number;
  next_due: string; // yyyy-mm-dd
  owner_member_id: string | null;
  last_ordered_at: string | null;
  price_vnd: number | null;
  pack_size: number | null;
  per_day: number | null;
  paid_by_member_id: string | null;
  deliver_to: string | null;
  paused: boolean;
};

export type AppointmentStatus = 'scheduled' | 'done' | 'cancelled';

export type Appointment = {
  id: string;
  family_id: string;
  parent_id: string;
  title: string;
  place: string | null;
  starts_at: string;
  notes: string | null;
  status: AppointmentStatus;
  booked_by_member_id: string | null;
  driver_member_id: string | null;
};

export type Reading = {
  id: string;
  family_id: string;
  parent_id: string;
  kind: 'blood_pressure' | 'glucose' | 'weight' | 'heart_rate' | 'temperature';
  value: number;
  value_secondary: number | null;
  unit: string;
  taken_at: string;
  source: 'parent' | 'caregiver';
  recorded_by: string | null;
  note: string | null;
};

export type Medicine = {
  id: string;
  family_id: string;
  parent_id: string;
  name: string;
  instructions: string | null;
  times: string[]; // 'HH:MM:SS'
  active: boolean;
};

export type Dose = {
  id: string;
  family_id: string;
  parent_id: string;
  medicine_id: string;
  scheduled_for: string;
  taken_at: string;
};

export const can =(m: Member | null, p: Permission) =>
  !!m && (m.role === 'owner' || (p === 'order' ? m.can_order : p === 'book' ? m.can_book : m.can_health));
