-- Tend · row-level security
-- Rules, in plain words:
--   1. A family only ever sees its own rows.
--   2. Writing needs the matching permission: can_order for supplies,
--      can_book for appointments, can_health for readings. Owners have all three.
--   3. The parent's consent is checked here, in the database, on every read and
--      write. If the parent turns health off, no caregiver can read or log
--      readings, whatever the app does.
--   4. The parent's paired phone always sees its own parent's record.
--
-- Helper functions live in a `private` schema that the API does not expose.
-- They are security definer so policies can look up membership without
-- recursing into the members table's own policies.

create schema if not exists private;
grant usage on schema private to authenticated;

-- Parent devices: a phone in "parent mode" is an anonymous Supabase user,
-- paired to exactly one parent (see the pairing migration).

create table public.parent_devices (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  parent_id  uuid not null references public.parents (id) on delete cascade,
  label      text check (char_length(label) <= 60),
  paired_at  timestamptz not null default now()
);

create index parent_devices_parent_id_idx on public.parent_devices (parent_id);

-- Helpers ----------------------------------------------------------------------

create function private.my_role(fid uuid)
returns public.member_role
language sql stable security definer set search_path = ''
as $$
  select m.role from public.members m
  where m.family_id = fid and m.user_id = (select auth.uid())
$$;

create function private.is_member(fid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.my_role(fid) is not null
$$;

create function private.is_owner(fid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.my_role(fid) = 'owner', false)
$$;

-- Owners and caregivers manage the circle's parents; viewers only read.
create function private.can_manage(fid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.my_role(fid) in ('owner', 'caregiver'), false)
$$;

create function private.member_can(fid uuid, perm text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
      when m.role = 'owner' then true
      when perm = 'order'  then m.can_order
      when perm = 'book'   then m.can_book
      when perm = 'health' then m.can_health
      else false
    end
    from public.members m
    where m.family_id = fid and m.user_id = (select auth.uid())
  ), false)
$$;

-- The parent's consent for one area: 'supplies' | 'appointments' | 'health'.
-- Anything missing or unknown counts as "no".
create function private.parent_allows(pid uuid, area text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select (p.consent ->> area)::boolean from public.parents p where p.id = pid), false)
$$;

create function private.parent_family(pid uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.family_id from public.parents p where p.id = pid
$$;

-- The parent this phone is paired to, or null for everyone else.
create function private.my_parent_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select d.parent_id from public.parent_devices d where d.user_id = (select auth.uid())
$$;

revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- Grants -----------------------------------------------------------------------
-- Nothing is readable without signing in (parent phones sign in anonymously,
-- which still makes them `authenticated`).

revoke all on all tables in schema public from anon;

-- Members: only these columns can change after joining.
revoke update on public.members from authenticated;
grant update (display_name, role, can_order, can_book, can_health) on public.members to authenticated;

-- Parents: consent is NOT updatable directly. It only changes through
-- public.set_consent(), which only the parent's own phone can call.
revoke update on public.parents from authenticated;
grant update (display_name) on public.parents to authenticated;

-- Enable RLS -------------------------------------------------------------------

alter table public.families       enable row level security;
alter table public.members        enable row level security;
alter table public.parents        enable row level security;
alter table public.parent_devices enable row level security;
alter table public.supplies       enable row level security;
alter table public.appointments   enable row level security;
alter table public.readings       enable row level security;

-- Families (created through public.create_family) -------------------------------

create policy "members read their family" on public.families
  for select to authenticated using (private.is_member(id));

create policy "owners rename their family" on public.families
  for update to authenticated using (private.is_owner(id)) with check (private.is_owner(id));

create policy "owners delete their family" on public.families
  for delete to authenticated using (private.is_owner(id));

-- Members (joined through public.accept_invite) ----------------------------------

create policy "members see their circle" on public.members
  for select to authenticated using (private.is_member(family_id));

create policy "owners edit roles and permissions" on public.members
  for update to authenticated
  using (private.is_owner(family_id)) with check (private.is_owner(family_id));

create policy "owners remove members, anyone can leave" on public.members
  for delete to authenticated
  using (private.is_owner(family_id) or user_id = (select auth.uid()));

-- A family always keeps at least one owner (unless the family itself, or the
-- owner's account, is being deleted).
create function private.keep_an_owner()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.families f where f.id = old.family_id)
     and exists (select 1 from auth.users u where u.id = old.user_id)
     and not exists (
       select 1 from public.members m
       where m.family_id = old.family_id and m.role = 'owner' and m.id <> old.id
     )
  then
    raise exception 'A family needs at least one owner. Make someone else owner first.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger members_keep_an_owner
  before update or delete on public.members
  for each row execute function private.keep_an_owner();

-- Parents ----------------------------------------------------------------------

create policy "family and the parent's phone read the parent" on public.parents
  for select to authenticated
  using (private.is_member(family_id) or id = private.my_parent_id());

create policy "owners and caregivers add a parent" on public.parents
  for insert to authenticated with check (private.can_manage(family_id));

create policy "owners and caregivers rename a parent" on public.parents
  for update to authenticated
  using (private.can_manage(family_id)) with check (private.can_manage(family_id));

create policy "owners remove a parent" on public.parents
  for delete to authenticated using (private.is_owner(family_id));

-- Parent devices (paired through public.pair_device) -----------------------------

create policy "a phone and its family see the pairing" on public.parent_devices
  for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage(private.parent_family(parent_id)));

create policy "a phone or its family can unpair" on public.parent_devices
  for delete to authenticated
  using (user_id = (select auth.uid()) or private.can_manage(private.parent_family(parent_id)));

-- Supplies ---------------------------------------------------------------------

create policy "read supplies the parent shares" on public.supplies
  for select to authenticated
  using (
    (private.is_member(family_id) and private.parent_allows(parent_id, 'supplies'))
    or parent_id = private.my_parent_id()
  );

create policy "orderers add supplies" on public.supplies
  for insert to authenticated
  with check (private.member_can(family_id, 'order') and private.parent_allows(parent_id, 'supplies'));

create policy "orderers update supplies" on public.supplies
  for update to authenticated
  using (private.member_can(family_id, 'order') and private.parent_allows(parent_id, 'supplies'))
  with check (private.member_can(family_id, 'order') and private.parent_allows(parent_id, 'supplies'));

create policy "orderers remove supplies" on public.supplies
  for delete to authenticated
  using (private.member_can(family_id, 'order') and private.parent_allows(parent_id, 'supplies'));

-- Appointments -----------------------------------------------------------------

create policy "read appointments the parent shares" on public.appointments
  for select to authenticated
  using (
    (private.is_member(family_id) and private.parent_allows(parent_id, 'appointments'))
    or parent_id = private.my_parent_id()
  );

create policy "bookers add appointments" on public.appointments
  for insert to authenticated
  with check (private.member_can(family_id, 'book') and private.parent_allows(parent_id, 'appointments'));

create policy "bookers update appointments" on public.appointments
  for update to authenticated
  using (private.member_can(family_id, 'book') and private.parent_allows(parent_id, 'appointments'))
  with check (private.member_can(family_id, 'book') and private.parent_allows(parent_id, 'appointments'));

create policy "bookers remove appointments" on public.appointments
  for delete to authenticated
  using (private.member_can(family_id, 'book') and private.parent_allows(parent_id, 'appointments'));

-- Readings ---------------------------------------------------------------------
-- Caregivers need can_health AND the parent's health consent. The parent's own
-- phone can always read and log its own readings.

create policy "read readings with health consent" on public.readings
  for select to authenticated
  using (
    (private.member_can(family_id, 'health') and private.parent_allows(parent_id, 'health'))
    or parent_id = private.my_parent_id()
  );

create policy "log readings" on public.readings
  for insert to authenticated
  with check (
    recorded_by = (select auth.uid())
    and (
      (source = 'parent' and parent_id = private.my_parent_id())
      or (
        source = 'caregiver'
        and private.member_can(family_id, 'health')
        and private.parent_allows(parent_id, 'health')
      )
    )
  );

create policy "fix your own readings" on public.readings
  for update to authenticated
  using (
    recorded_by = (select auth.uid())
    and (
      parent_id = private.my_parent_id()
      or (private.member_can(family_id, 'health') and private.parent_allows(parent_id, 'health'))
    )
  )
  with check (
    recorded_by = (select auth.uid())
    and (
      (source = 'parent' and parent_id = private.my_parent_id())
      or (
        source = 'caregiver'
        and private.member_can(family_id, 'health')
        and private.parent_allows(parent_id, 'health')
      )
    )
  );

create policy "remove your own readings" on public.readings
  for delete to authenticated
  using (
    recorded_by = (select auth.uid())
    and (
      parent_id = private.my_parent_id()
      or (private.member_can(family_id, 'health') and private.parent_allows(parent_id, 'health'))
    )
  );
