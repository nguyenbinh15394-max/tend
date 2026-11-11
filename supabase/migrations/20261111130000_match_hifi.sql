-- Tend · match the hi-fi (Round 2)
--   1. Consent becomes what the parent is asked on first setup (screen 2f):
--      medicines, appointments, health (blood pressure readings) and
--      emergency_location. Supplies leave consent: they are the family's
--      logistics, not information about the parent.
--   2. Medicines and doses: "Today's medicines" in parent mode, and the
--      caregiver's week-at-a-glance. A dose row means "taken".
--   3. Who to call: members get a phone number and a place in the call order,
--      and the parent's phone can read only that list ("Call my children").

-- 1 · Consent ----------------------------------------------------------------------

alter table public.parents drop constraint consent_shape;

update public.parents set consent = jsonb_build_object(
  'medicines', true,
  'appointments', coalesce(consent -> 'appointments', 'true'::jsonb),
  'health', coalesce(consent -> 'health', 'false'::jsonb),
  'emergency_location', false
);

alter table public.parents
  alter column consent set default
    '{"medicines": true, "appointments": true, "health": false, "emergency_location": false}',
  add constraint consent_shape check (
    jsonb_typeof(consent) = 'object'
    and consent ?& array['medicines', 'appointments', 'health', 'emergency_location']
    and jsonb_typeof(consent -> 'medicines') = 'boolean'
    and jsonb_typeof(consent -> 'appointments') = 'boolean'
    and jsonb_typeof(consent -> 'health') = 'boolean'
    and jsonb_typeof(consent -> 'emergency_location') = 'boolean'
  );

create or replace function public.set_consent(area text, allowed boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid := private.my_parent_id();
  result jsonb;
begin
  if pid is null then
    raise exception 'Only the parent can change what the family sees.';
  end if;

  if area not in ('medicines', 'appointments', 'health', 'emergency_location') or allowed is null then
    raise exception 'Unknown consent setting.';
  end if;

  update public.parents
  set consent = jsonb_set(consent, array[area], to_jsonb(allowed)),
      consent_updated_at = now()
  where id = pid
  returning consent into result;

  return result;
end;
$$;

-- Supplies: the whole circle sees them; can_order still decides who edits.
drop policy "read supplies the parent shares" on public.supplies;
drop policy "orderers add supplies" on public.supplies;
drop policy "orderers update supplies" on public.supplies;
drop policy "orderers remove supplies" on public.supplies;

create policy "family and the parent's phone read supplies" on public.supplies
  for select to authenticated
  using (private.is_member(family_id) or parent_id = private.my_parent_id());

create policy "orderers add supplies" on public.supplies
  for insert to authenticated with check (private.member_can(family_id, 'order'));

create policy "orderers update supplies" on public.supplies
  for update to authenticated
  using (private.member_can(family_id, 'order')) with check (private.member_can(family_id, 'order'));

create policy "orderers remove supplies" on public.supplies
  for delete to authenticated using (private.member_can(family_id, 'order'));

-- 2 · Medicines and doses ------------------------------------------------------------

create table public.medicines (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null,
  parent_id     uuid not null,
  name          text not null check (char_length(name) between 1 and 80),
  instructions  text check (char_length(instructions) <= 140),
  times         time[] not null check (cardinality(times) between 1 and 8),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, family_id, parent_id),
  foreign key (parent_id, family_id)
    references public.parents (id, family_id) on delete cascade
);

create index medicines_parent_idx on public.medicines (parent_id) where active;

create trigger medicines_touch before update on public.medicines
  for each row execute function public.touch_updated_at();

-- One row per dose taken. No row after its time = missed; before = upcoming.
create table public.doses (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null,
  parent_id      uuid not null,
  medicine_id    uuid not null,
  scheduled_for  timestamptz not null,
  taken_at       timestamptz not null default now(),
  marked_by      uuid references auth.users (id) on delete set null default auth.uid(),
  unique (medicine_id, scheduled_for),
  foreign key (medicine_id, family_id, parent_id)
    references public.medicines (id, family_id, parent_id) on delete cascade
);

create index doses_parent_scheduled_idx on public.doses (parent_id, scheduled_for desc);

alter table public.medicines enable row level security;
alter table public.doses enable row level security;
revoke all on public.medicines, public.doses from anon;

-- Medicines follow the parent's "medicines" consent. Editing the list needs
-- can_health; the parent's phone reads it.
create policy "read medicines the parent shares" on public.medicines
  for select to authenticated
  using (
    (private.is_member(family_id) and private.parent_allows(parent_id, 'medicines'))
    or parent_id = private.my_parent_id()
  );

create policy "health carers add medicines" on public.medicines
  for insert to authenticated
  with check (private.member_can(family_id, 'health') and private.parent_allows(parent_id, 'medicines'));

create policy "health carers update medicines" on public.medicines
  for update to authenticated
  using (private.member_can(family_id, 'health') and private.parent_allows(parent_id, 'medicines'))
  with check (private.member_can(family_id, 'health') and private.parent_allows(parent_id, 'medicines'));

create policy "health carers remove medicines" on public.medicines
  for delete to authenticated
  using (private.member_can(family_id, 'health') and private.parent_allows(parent_id, 'medicines'));

-- Doses: the parent marks "I've taken it"; someone with can_health (Mum, at
-- home) can mark it for them. Anyone who marked a dose can undo their mark,
-- and the parent can undo any mark on their own doses.
create policy "read doses the parent shares" on public.doses
  for select to authenticated
  using (
    (private.is_member(family_id) and private.parent_allows(parent_id, 'medicines'))
    or parent_id = private.my_parent_id()
  );

create policy "mark a dose taken" on public.doses
  for insert to authenticated
  with check (
    marked_by = (select auth.uid())
    and (
      parent_id = private.my_parent_id()
      or (private.member_can(family_id, 'health') and private.parent_allows(parent_id, 'medicines'))
    )
  );

create policy "undo a dose mark" on public.doses
  for delete to authenticated
  using (
    parent_id = private.my_parent_id()
    or (
      marked_by = (select auth.uid())
      and private.member_can(family_id, 'health')
      and private.parent_allows(parent_id, 'medicines')
    )
  );

-- 3 · Who to call ----------------------------------------------------------------------

alter table public.members
  add column phone text check (phone ~ '^\+?[0-9 ]{6,20}$'),
  add column call_order smallint check (call_order between 1 and 9);

-- Owners set anyone's phone and call order (the owner update policy applies).
grant update (phone, call_order) on public.members to authenticated;

-- Everyone can keep their own name and phone up to date, without being able
-- to touch their own role or permissions.
create function public.update_my_contact(in_family uuid, new_name text, new_phone text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.members
  set display_name = coalesce(new_name, display_name),
      phone = new_phone
  where family_id = in_family and user_id = auth.uid();

  if not found then
    raise exception 'You are not in this family.';
  end if;
end;
$$;

-- The parent's phone sees only who to call and in what order: never roles,
-- permissions or anything else about the circle.
create function public.my_call_list()
returns table (display_name text, phone text, call_order smallint)
language sql stable security definer set search_path = ''
as $$
  select m.display_name, m.phone, m.call_order
  from public.members m
  join public.parents p on p.family_id = m.family_id
  where p.id = private.my_parent_id()
    and m.call_order is not null
    and m.phone is not null
  order by m.call_order
$$;

revoke execute on function public.update_my_contact(uuid, text, text), public.my_call_list() from public, anon;
grant execute on function public.update_my_contact(uuid, text, text), public.my_call_list() to authenticated;

-- Realtime ----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.medicines, public.doses;
  end if;
end;
$$;
