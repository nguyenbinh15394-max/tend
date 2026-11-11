-- Tend · demo data for LOCAL development only (supabase db reset).
-- Three demo caregivers with no passwords: sign in with a magic link, which the
-- local Supabase stack catches in its mail inbox (Mailpit, http://localhost:54324).
--
--   anna@example.com  owner
--   ben@example.com   caregiver · can order + book
--   chi@example.com   viewer

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, now(),
  '{"provider": "email", "providers": ["email"]}', jsonb_build_object('name', u.name),
  '', '', '', '',
  now(), now()
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'anna@example.com', 'Anna'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'ben@example.com',  'Ben'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'chi@example.com',  'Chi')
) as u (id, email, name);

insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select id, id::text, 'email', jsonb_build_object('sub', id::text, 'email', email), now(), now(), now()
from auth.users
where email in ('anna@example.com', 'ben@example.com', 'chi@example.com');

insert into public.families (id, name, created_by) values
  ('f0000000-0000-4000-8000-000000000001', 'Nguyen family', 'a0000000-0000-4000-8000-000000000001');

insert into public.members (id, family_id, user_id, display_name, role, can_order, can_book, can_health) values
  ('b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'Anna', 'owner', true, true, true),
  ('b0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'Ben', 'caregiver', true, true, false),
  ('b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003', 'Chi', 'viewer', false, false, false);

insert into public.parents (id, family_id, display_name, consent, consent_updated_at) values
  ('c0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Mẹ',
   '{"supplies": true, "appointments": true, "health": true}', now());

insert into public.supplies (family_id, parent_id, name, details, every_days, next_due, owner_member_id) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Blood pressure tablets', 'Amlodipine 5mg, 30 tablets', 30, current_date + 4, 'b0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Glucose test strips', '50 strips', 21, current_date + 11, 'b0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Adult diapers', 'Size M, 2 packs', 14, current_date + 1, 'b0000000-0000-4000-8000-000000000002');

insert into public.appointments (family_id, parent_id, title, place, starts_at, booked_by_member_id, driver_member_id) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Cardiology check-up', 'City Heart Clinic', date_trunc('day', now()) + interval '3 days 9 hours',
   'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Eye test', 'Optician on Main St', date_trunc('day', now()) + interval '12 days 14 hours',
   'b0000000-0000-4000-8000-000000000002', null);

insert into public.readings (family_id, parent_id, kind, value, value_secondary, unit, taken_at, source, recorded_by) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'blood_pressure', 132, 84, 'mmHg', now() - interval '2 days', 'parent', null),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'blood_pressure', 127, 80, 'mmHg', now() - interval '1 day', 'parent', null),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'glucose', 6.1, null, 'mmol/L', now() - interval '6 hours', 'caregiver', 'a0000000-0000-4000-8000-000000000001');
