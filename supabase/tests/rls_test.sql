-- Tend · RLS tests
-- Plays out the family-circle story as real users and checks that the
-- database, not the app, enforces who sees what. Any failed check raises an
-- error and stops the run.
--
-- Cast:
--   Anna  owner of the Nguyen family
--   Ben   caregiver, can order and book, no health access
--   Chi   viewer
--   Dan   owner of a different family
--   Mum's phone        anonymous sign-in, paired to Mum
--   A stranger's phone anonymous sign-in, not paired

create schema tests;
grant usage on schema tests to authenticated, anon;

create table tests.results (n serial primary key, label text not null, refused_with text);
grant insert on tests.results to authenticated, anon;
grant usage on sequence tests.results_n_seq to authenticated, anon;

create function tests.ok(passed boolean, label text) returns void
language plpgsql as $$
begin
  if passed is not true then
    raise exception 'FAILED: %', label;
  end if;
  insert into tests.results (label) values (label);
end;
$$;

-- Runs a statement as the current user and checks that it is refused.
create function tests.refused(stmt text, label text) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    insert into tests.results (label, refused_with) values (label, sqlerrm);
    return;
  end;
  raise exception 'FAILED (was allowed): %', label;
end;
$$;

create function tests.login(uid text, anonymous boolean default false) returns void
language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anonymous)::text, false);
$$;

grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'anna@example.com', false),
  ('00000000-0000-0000-0000-00000000000b', 'ben@example.com',  false),
  ('00000000-0000-0000-0000-00000000000c', 'chi@example.com',  false),
  ('00000000-0000-0000-0000-00000000000d', 'dan@example.com',  false),
  ('00000000-0000-0000-0000-0000000000f1', null, true),
  ('00000000-0000-0000-0000-0000000000f2', null, true);

-- Anna starts the family ---------------------------------------------------------

select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;

select set_config('test.fid', public.create_family('Nguyen family', 'Anna')::text, false);

with p as (
  insert into public.parents (family_id, display_name)
  values (current_setting('test.fid')::uuid, 'Mum')
  returning id
)
select set_config('test.pid', (select id::text from p), false);

select tests.ok(
  (select consent ->> 'health' from public.parents where id = current_setting('test.pid')::uuid) = 'false',
  'health sharing is off until the parent turns it on');

with i as (
  insert into public.invites (family_id, role, can_order, can_book)
  values (current_setting('test.fid')::uuid, 'caregiver', true, true)
  returning code
)
select set_config('test.ben_code', (select code from i), false);

with i as (
  insert into public.invites (family_id, role)
  values (current_setting('test.fid')::uuid, 'viewer')
  returning code
)
select set_config('test.chi_code', (select code from i), false);

select tests.refused(
  $$insert into public.invites (family_id, role, can_health) values (current_setting('test.fid')::uuid, 'viewer', true)$$,
  'a viewer invite cannot carry permissions');

select tests.refused(
  $$insert into public.invites (family_id, code) values (current_setting('test.fid')::uuid, 'AAAAAAAA')$$,
  'the client cannot choose its own invite code');

insert into public.supplies (family_id, parent_id, name, every_days, next_due)
values (current_setting('test.fid')::uuid, current_setting('test.pid')::uuid, 'Blood pressure tablets', 30, current_date + 5);

insert into public.appointments (family_id, parent_id, title, starts_at)
values (current_setting('test.fid')::uuid, current_setting('test.pid')::uuid, 'Cardiologist', now() + interval '3 days');

select tests.refused(
  $$insert into public.readings (family_id, parent_id, kind, value, value_secondary, unit, source)
    values (current_setting('test.fid')::uuid, current_setting('test.pid')::uuid, 'blood_pressure', 130, 85, 'mmHg', 'caregiver')$$,
  'even the owner cannot log health readings without the parent''s consent');

select tests.refused(
  $$update public.parents set consent = '{"supplies": true, "appointments": true, "health": true}' where id = current_setting('test.pid')::uuid$$,
  'the owner cannot change consent directly');

select tests.refused(
  $$select public.set_consent('health', true)$$,
  'the owner cannot change consent through the function either');

select set_config('test.pair_code', public.create_pairing_code(current_setting('test.pid')::uuid), false);

select tests.refused(
  $$select public.pair_device(current_setting('test.pair_code'))$$,
  'a caregiver account cannot pair itself as the parent''s phone');

select tests.refused(
  $$delete from public.members where user_id = auth.uid()$$,
  'the last owner cannot leave the family');

reset role;

-- Ben joins as a caregiver -----------------------------------------------------------

select tests.login('00000000-0000-0000-0000-00000000000b');
set role authenticated;

select tests.ok(public.accept_invite(lower(current_setting('test.ben_code')), 'Ben') = current_setting('test.fid')::uuid,
  'Ben joins with the invite code (case-insensitive)');

select tests.ok((select count(*) from public.supplies) = 1, 'Ben sees the family''s supplies');
select tests.ok((select count(*) from public.appointments) = 1, 'Ben sees the family''s appointments');

insert into public.supplies (family_id, parent_id, name, every_days, next_due, owner_member_id)
select current_setting('test.fid')::uuid, current_setting('test.pid')::uuid, 'Test strips', 14, current_date + 2, m.id
from public.members m where m.user_id = auth.uid();

select tests.ok((select count(*) from public.supplies) = 2, 'Ben (can_order) adds a supply he owns');

update public.members set can_health = true where user_id = auth.uid();
select tests.ok(not (select can_health from public.members where user_id = auth.uid()),
  'Ben cannot grant himself health access');

select tests.ok((select count(*) from public.invites) = 0, 'only owners can see pending invites');

reset role;

-- Chi joins as a viewer ----------------------------------------------------------------

select tests.login('00000000-0000-0000-0000-00000000000c');
set role authenticated;

select public.accept_invite(current_setting('test.chi_code'), 'Chi');

select tests.ok((select count(*) from public.supplies) = 2, 'Chi (viewer) can read supplies');

select tests.refused(
  $$insert into public.appointments (family_id, parent_id, title, starts_at)
    values (current_setting('test.fid')::uuid, current_setting('test.pid')::uuid, 'Dentist', now() + interval '1 day')$$,
  'Chi (viewer) cannot book an appointment');

select tests.refused(
  $$select public.accept_invite(current_setting('test.chi_code'), 'Chi again')$$,
  'an invite code works only once');

reset role;

-- Dan, from another family, sees nothing -----------------------------------------------

select tests.login('00000000-0000-0000-0000-00000000000d');
set role authenticated;

select public.create_family('Tran family', 'Dan');

select tests.ok((select count(*) from public.parents) = 0, 'Dan cannot see another family''s parent');
select tests.ok((select count(*) from public.supplies) = 0, 'Dan cannot see another family''s supplies');
select tests.ok((select count(*) from public.members where family_id = current_setting('test.fid')::uuid) = 0,
  'Dan cannot see another family''s members');

select tests.refused(
  $$insert into public.supplies (family_id, parent_id, name, every_days, next_due)
    values (current_setting('test.fid')::uuid, current_setting('test.pid')::uuid, 'Sneaky', 7, current_date)$$,
  'Dan cannot write into another family');

select tests.refused(
  $$select public.create_pairing_code(current_setting('test.pid')::uuid)$$,
  'Dan cannot pair a phone to another family''s parent');

reset role;

-- Mum's phone: no login, paired with the code ------------------------------------------

select tests.login('00000000-0000-0000-0000-0000000000f1', true);
set role authenticated;

select tests.refused(
  $$select public.accept_invite(current_setting('test.ben_code'), 'Phone')$$,
  'a parent phone cannot join the family circle as a member');

select tests.ok(public.pair_device(current_setting('test.pair_code'), 'Mum''s phone') = current_setting('test.pid')::uuid,
  'Mum''s phone pairs with the code');

select tests.ok((select count(*) from public.parents) = 1, 'Mum''s phone sees Mum');
select tests.ok((select count(*) from public.appointments) = 1, 'Mum''s phone sees her appointments');

insert into public.readings (family_id, parent_id, kind, value, value_secondary, unit, source)
values (current_setting('test.fid')::uuid, current_setting('test.pid')::uuid, 'blood_pressure', 128, 82, 'mmHg', 'parent');

select tests.ok((select count(*) from public.readings) = 1, 'Mum logs and sees her own reading');

select tests.refused(
  $$insert into public.supplies (family_id, parent_id, name, every_days, next_due)
    values (current_setting('test.fid')::uuid, current_setting('test.pid')::uuid, 'Biscuits', 7, current_date)$$,
  'parent mode cannot add supplies');

reset role;

select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select tests.ok((select count(*) from public.readings) = 0, 'Anna cannot see Mum''s reading while health is off');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000f1', true);
set role authenticated;
select tests.ok((public.set_consent('health', true) ->> 'health') = 'true', 'Mum turns health sharing on');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select tests.ok((select count(*) from public.readings) = 1, 'Anna (owner) now sees Mum''s reading');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select tests.ok((select count(*) from public.readings) = 0, 'Ben still cannot: he has no can_health');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000f1', true);
set role authenticated;
select public.set_consent('supplies', false);
select tests.ok((select count(*) from public.supplies) = 2, 'Mum still sees her supplies after hiding them');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select tests.ok((select count(*) from public.supplies) = 0, 'Ben no longer sees supplies once Mum hides them');
select tests.refused(
  $$insert into public.supplies (family_id, parent_id, name, every_days, next_due)
    values (current_setting('test.fid')::uuid, current_setting('test.pid')::uuid, 'Vitamins', 30, current_date)$$,
  'Ben cannot add supplies Mum has chosen not to share');
reset role;

-- A stranger's phone ---------------------------------------------------------------------

select tests.login('00000000-0000-0000-0000-0000000000f2', true);
set role authenticated;

select tests.refused(
  $$select public.pair_device(current_setting('test.pair_code'))$$,
  'a used pairing code cannot pair a second phone');
select tests.ok((select count(*) from public.parents) = 0, 'an unpaired phone sees nothing');
select tests.refused($$select public.set_consent('health', false)$$, 'an unpaired phone cannot change consent');

reset role;

-- Not signed in at all ---------------------------------------------------------------------

select set_config('request.jwt.claims', '', false);
set role anon;
select tests.refused($$select count(*) from public.parents$$, 'signed-out visitors cannot read anything');
select tests.refused($$select public.create_family('x', 'y')$$, 'signed-out visitors cannot call functions');
reset role;
