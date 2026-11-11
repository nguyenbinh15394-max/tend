-- Tend · core schema
-- One shared record per family: the family circle, the parent(s) being cared
-- for, and the three things the family coordinates around them.
--
-- Every child table carries family_id and uses composite foreign keys, so a
-- row can never point at a parent or member from another family, and RLS can
-- check family membership without joins.

create type public.member_role as enum ('owner', 'caregiver', 'viewer');
create type public.appointment_status as enum ('scheduled', 'done', 'cancelled');
create type public.reading_source as enum ('parent', 'caregiver');

-- Families -------------------------------------------------------------------

create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

-- Members: the adult children (and others) in the family circle --------------
-- Owners can do everything. Caregivers get explicit permissions. Viewers only
-- read, so a viewer can never carry a permission flag.

create table public.members (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 60),
  role          public.member_role not null default 'caregiver',
  can_order     boolean not null default false,
  can_book      boolean not null default false,
  can_health    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (family_id, user_id),
  unique (id, family_id),
  constraint viewer_has_no_permissions
    check (role <> 'viewer' or not (can_order or can_book or can_health))
);

create index members_user_id_idx on public.members (user_id);

-- Parents: the person being cared for ------------------------------------------
-- consent is the parent's own say over what the family can see. Health is off
-- until the parent turns it on ("help, don't surveil").

create table public.parents (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references public.families (id) on delete cascade,
  display_name        text not null check (char_length(display_name) between 1 and 60),
  consent             jsonb not null
                        default '{"supplies": true, "appointments": true, "health": false}',
  consent_updated_at  timestamptz,
  created_at          timestamptz not null default now(),
  unique (id, family_id),
  constraint consent_shape check (
    jsonb_typeof(consent) = 'object'
    and consent ?& array['supplies', 'appointments', 'health']
    and jsonb_typeof(consent -> 'supplies') = 'boolean'
    and jsonb_typeof(consent -> 'appointments') = 'boolean'
    and jsonb_typeof(consent -> 'health') = 'boolean'
  )
);

create index parents_family_id_idx on public.parents (family_id);

-- Supplies: recurring things to reorder, each with a named owner ---------------

create table public.supplies (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null,
  parent_id        uuid not null,
  name             text not null check (char_length(name) between 1 and 80),
  details          text check (char_length(details) <= 280),
  every_days       integer not null check (every_days between 1 and 365),
  next_due         date not null,
  owner_member_id  uuid,
  last_ordered_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (parent_id, family_id)
    references public.parents (id, family_id) on delete cascade,
  foreign key (owner_member_id, family_id)
    references public.members (id, family_id) on delete set null (owner_member_id)
);

create index supplies_parent_due_idx on public.supplies (parent_id, next_due);

-- Appointments: booked by someone, with a named driver -------------------------

create table public.appointments (
  id                   uuid primary key default gen_random_uuid(),
  family_id            uuid not null,
  parent_id            uuid not null,
  title                text not null check (char_length(title) between 1 and 80),
  place                text check (char_length(place) <= 160),
  starts_at            timestamptz not null,
  ends_at              timestamptz,
  notes                text check (char_length(notes) <= 500),
  status               public.appointment_status not null default 'scheduled',
  booked_by_member_id  uuid,
  driver_member_id     uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  foreign key (parent_id, family_id)
    references public.parents (id, family_id) on delete cascade,
  foreign key (booked_by_member_id, family_id)
    references public.members (id, family_id) on delete set null (booked_by_member_id),
  foreign key (driver_member_id, family_id)
    references public.members (id, family_id) on delete set null (driver_member_id)
);

create index appointments_parent_starts_idx on public.appointments (parent_id, starts_at);

-- Readings: the health log -----------------------------------------------------
-- value_secondary holds the diastolic value for blood pressure.

create table public.readings (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null,
  parent_id        uuid not null,
  kind             text not null
                     check (kind in ('blood_pressure', 'glucose', 'weight', 'heart_rate', 'temperature')),
  value            numeric not null,
  value_secondary  numeric,
  unit             text not null check (char_length(unit) <= 16),
  taken_at         timestamptz not null default now(),
  source           public.reading_source not null,
  recorded_by      uuid references auth.users (id) on delete set null default auth.uid(),
  note             text check (char_length(note) <= 280),
  created_at       timestamptz not null default now(),
  check (kind = 'blood_pressure' or value_secondary is null),
  foreign key (parent_id, family_id)
    references public.parents (id, family_id) on delete cascade
);

create index readings_parent_taken_idx on public.readings (parent_id, taken_at desc);

-- updated_at -------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger supplies_touch before update on public.supplies
  for each row execute function public.touch_updated_at();
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();
