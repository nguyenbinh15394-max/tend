-- Tend · demo data for LOCAL development only (supabase db reset).
-- The family from the hi-fi: Mr. Hòa (72, Đà Nẵng) and the people who help.
-- No passwords: sign in with the email code, which the local Supabase stack
-- catches in its mail inbox (Mailpit, http://localhost:54324).
--
--   linh@example.com  Linh · daughter · owner, 300 km away
--   nam@example.com   Nam · son · order, book, health · same city
--   lan@example.com   Mrs. Lan · Mum, lives with Dad · book, health
--   tu@example.com    Cousin Tú · nurse · health only
--
-- Phone numbers are fictional.

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
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'linh@example.com', 'Linh'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'nam@example.com',  'Nam'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'lan@example.com',  'Lan'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'tu@example.com',   'Tú')
) as u (id, email, name);

insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select id, id::text, 'email', jsonb_build_object('sub', id::text, 'email', email), now(), now(), now()
from auth.users
where email in ('linh@example.com', 'nam@example.com', 'lan@example.com', 'tu@example.com');

insert into public.families (id, name, created_by) values
  ('f0000000-0000-4000-8000-000000000001', 'Gia đình ông Hòa', 'a0000000-0000-4000-8000-000000000001');

insert into public.members
  (id, family_id, user_id, display_name, role, can_order, can_book, can_health, phone, call_order)
values
  ('b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'Linh', 'owner', true, true, true, '+84 000 000 001', 1),
  ('b0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'Nam', 'caregiver', true, true, true, '+84 000 000 002', 2),
  ('b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003', 'Bà Lan', 'caregiver', false, true, true, null, null),
  ('b0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000004', 'Tú', 'caregiver', false, false, true, null, null);

insert into public.parents (id, family_id, display_name, consent, consent_updated_at) values
  ('c0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'ông Hòa',
   '{"medicines": true, "appointments": true, "health": true, "emergency_location": true}', now());

insert into public.supplies (family_id, parent_id, name, details, every_days, next_due, owner_member_id) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Glucose test strips', 'Accu-Chek Guide · 50', 30, current_date + 4, 'b0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Lancets', 'Accu-Chek FastClix · 100', 60, current_date + 21, 'b0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Adult diapers (M)', 'Caryn · 20', 14, current_date + 12, 'b0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Wound dressings', 'Urgo · 10', 45, current_date + 35, 'b0000000-0000-4000-8000-000000000002');

-- The Thursday check-up has no driver yet: the "needs a person" moment.
insert into public.appointments (family_id, parent_id, title, place, starts_at, notes, booked_by_member_id, driver_member_id) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Endocrinology check-up', 'Hospital C · Endocrinology, 2nd floor',
   date_trunc('day', now()) + interval '3 days 9 hours',
   'Bring: BP notebook, health card', 'b0000000-0000-4000-8000-000000000001', null);

insert into public.readings (family_id, parent_id, kind, value, value_secondary, unit, taken_at, source, recorded_by, note)
select 'f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
       'blood_pressure', r.sys, r.dia, 'mmHg', date_trunc('day', now()) - (r.days_ago || ' days')::interval + interval '6 hours 45 minutes',
       'parent', null, r.note
from (values
  (0, 152, 95, 'a bit tired'),
  (1, 138, 86, 'good'),
  (2, 149, 92, null),
  (3, 137, 85, null),
  (4, 131, 82, null),
  (5, 146, 90, null),
  (6, 134, 84, null)
) as r (days_ago, sys, dia, note);

insert into public.medicines (id, family_id, parent_id, name, instructions, times) values
  ('d0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Metformin 500mg', '1 viên, sau ăn sáng và tối', array['07:00', '19:00']::time[]),
  ('d0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Amlodipine 5mg', '1 viên, sau ăn trưa', array['12:00']::time[]);

-- Last week's doses, with the 7:00 dose missed now and then.
insert into public.doses (family_id, parent_id, medicine_id, scheduled_for, taken_at, marked_by)
select 'f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', m.id,
       date_trunc('day', now()) - (d || ' days')::interval + t::interval,
       date_trunc('day', now()) - (d || ' days')::interval + t::interval + interval '20 minutes',
       null
from public.medicines m
cross join lateral unnest(m.times) as t
cross join generate_series(1, 6) as d
where not (t = '07:00' and d in (2, 5));
