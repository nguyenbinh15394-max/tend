-- Tend · family circle and parent pairing
--   create_family()        a signed-in caregiver starts a family and becomes owner
--   invites + accept_invite() owners invite siblings with a role and permissions
--   create_pairing_code()  a caregiver shows a short code on their screen
--   pair_device()          the parent's phone (anonymous sign-in, no login)
--                          enters the code once and is paired to that parent
--   set_consent()          only the parent's paired phone can change consent

-- Codes ------------------------------------------------------------------------
-- Random codes without look-alike characters (no 0/O, 1/I/L).

create function private.new_code(len integer)
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  code text := '';
begin
  for i in 0 .. len - 1 loop
    code := code || substr(alphabet, 1 + get_byte(bytes, i) % length(alphabet), 1);
  end loop;
  return code;
end;
$$;

create function private.is_anonymous()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- Start a family ---------------------------------------------------------------

create function public.create_family(family_name text, my_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  fid uuid;
begin
  if auth.uid() is null or private.is_anonymous() then
    raise exception 'Sign in with an account to start a family.';
  end if;

  insert into public.families (name, created_by)
  values (family_name, auth.uid())
  returning id into fid;

  insert into public.members (family_id, user_id, display_name, role)
  values (fid, auth.uid(), my_name, 'owner');

  return fid;
end;
$$;

-- Invites ------------------------------------------------------------------------

create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  code         text not null unique default private.new_code(8),
  role         public.member_role not null default 'caregiver',
  can_order    boolean not null default false,
  can_book     boolean not null default false,
  can_health   boolean not null default false,
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_by  uuid references auth.users (id) on delete set null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint viewer_has_no_permissions
    check (role <> 'viewer' or not (can_order or can_book or can_health))
);

alter table public.invites enable row level security;

-- Owners create invites directly; the code, expiry and author are set by the
-- database, never by the client.
revoke all on public.invites from anon, authenticated;
grant select, delete on public.invites to authenticated;
grant insert (family_id, role, can_order, can_book, can_health) on public.invites to authenticated;

create policy "owners see invites" on public.invites
  for select to authenticated using (private.is_owner(family_id));

create policy "owners create invites" on public.invites
  for insert to authenticated with check (private.is_owner(family_id));

create policy "owners revoke invites" on public.invites
  for delete to authenticated using (private.is_owner(family_id));

create function public.accept_invite(invite_code text, my_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.invites;
begin
  if auth.uid() is null or private.is_anonymous() then
    raise exception 'Sign in with an account to join a family.';
  end if;

  select * into inv from public.invites
  where code = upper(trim(invite_code))
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'This invite code is not valid or has expired.';
  end if;

  if exists (select 1 from public.members m
             where m.family_id = inv.family_id and m.user_id = auth.uid()) then
    raise exception 'You are already in this family.';
  end if;

  insert into public.members (family_id, user_id, display_name, role, can_order, can_book, can_health)
  values (inv.family_id, auth.uid(), my_name, inv.role, inv.can_order, inv.can_book, inv.can_health);

  update public.invites
  set accepted_by = auth.uid(), accepted_at = now()
  where id = inv.id;

  return inv.family_id;
end;
$$;

-- Pairing the parent's phone -----------------------------------------------------

create table public.pairing_codes (
  code        text primary key default private.new_code(6),
  parent_id   uuid not null references public.parents (id) on delete cascade,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  expires_at  timestamptz not null default now() + interval '15 minutes',
  used_at     timestamptz
);

-- No policies: codes are only touched through the functions below.
alter table public.pairing_codes enable row level security;
revoke all on public.pairing_codes from anon, authenticated;

create function public.create_pairing_code(for_parent uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  new_code text;
begin
  if not private.can_manage(private.parent_family(for_parent)) then
    raise exception 'Only owners and caregivers in this family can pair a phone.';
  end if;

  -- One live code per parent at a time.
  delete from public.pairing_codes where parent_id = for_parent and used_at is null;

  insert into public.pairing_codes (parent_id) values (for_parent)
  returning code into new_code;

  return new_code;
end;
$$;

create function public.pair_device(pairing_code text, device_label text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  pc public.pairing_codes;
begin
  -- Parent mode has no login: the phone signs in anonymously first.
  if auth.uid() is null or not private.is_anonymous() then
    raise exception 'Pair from the parent''s phone in parent mode.';
  end if;

  select * into pc from public.pairing_codes
  where code = upper(trim(pairing_code))
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'This code is not valid or has expired. Ask your family for a new one.';
  end if;

  insert into public.parent_devices (user_id, parent_id, label)
  values (auth.uid(), pc.parent_id, device_label)
  on conflict (user_id) do update
    set parent_id = excluded.parent_id, label = excluded.label, paired_at = now();

  update public.pairing_codes set used_at = now() where code = pc.code;

  return pc.parent_id;
end;
$$;

-- Consent ------------------------------------------------------------------------
-- The only way consent changes. Caregivers, owners included, cannot call this
-- successfully: it only acts on the parent paired to the calling phone.

create function public.set_consent(area text, allowed boolean)
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

  if area not in ('supplies', 'appointments', 'health') or allowed is null then
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

-- Function grants ------------------------------------------------------------------

revoke execute on function
  public.create_family(text, text),
  public.accept_invite(text, text),
  public.create_pairing_code(uuid),
  public.pair_device(text, text),
  public.set_consent(text, boolean)
from public, anon;

grant execute on function
  public.create_family(text, text),
  public.accept_invite(text, text),
  public.create_pairing_code(uuid),
  public.pair_device(text, text),
  public.set_consent(text, boolean)
to authenticated;

revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- Realtime -------------------------------------------------------------------------
-- Everyone in the circle sees changes live. Realtime still applies RLS.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime
      add table public.members, public.parents, public.supplies, public.appointments, public.readings;
  end if;
end;
$$;
