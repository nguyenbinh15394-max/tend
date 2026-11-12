-- Tend · explicit table privileges
-- The Supabase project does not expose new tables automatically, so every
-- privilege the app needs is written here. Privileges say which operations
-- and columns are possible at all; RLS then decides which rows.
--
-- Signed-out visitors (anon) get nothing. Parent phones sign in anonymously
-- and are `authenticated`, like caregivers; RLS tells them apart.

revoke all on
  public.families, public.members, public.parents, public.parent_devices,
  public.supplies, public.appointments, public.readings,
  public.invites, public.pairing_codes, public.medicines, public.doses
from anon, authenticated;

grant usage on schema public to authenticated;

-- Created through create_family(); owners rename or delete.
grant select, delete on public.families to authenticated;
grant update (name) on public.families to authenticated;

-- Joined through accept_invite(); owners edit roles, permissions and the call
-- order; everyone edits their own contact through update_my_contact().
grant select, delete on public.members to authenticated;
grant update (display_name, role, can_order, can_book, can_health, phone, call_order)
  on public.members to authenticated;

-- A caregiver adds a parent by name only. Consent always starts from the
-- default and only the parent's phone can change it (set_consent()).
grant select, delete on public.parents to authenticated;
grant insert (family_id, display_name) on public.parents to authenticated;
grant update (display_name) on public.parents to authenticated;

-- Paired through pair_device(); a phone or its family can unpair.
grant select, delete on public.parent_devices to authenticated;

grant select, insert, update, delete on
  public.supplies, public.appointments, public.readings, public.medicines
to authenticated;

-- A dose is marked or unmarked, never edited.
grant select, insert, delete on public.doses to authenticated;

-- Owners create invites; the code, expiry and author come from the database.
grant select, delete on public.invites to authenticated;
grant insert (family_id, role, can_order, can_book, can_health) on public.invites to authenticated;

-- public.pairing_codes: no client access at all, only through the functions.

-- Server-side code (Edge Functions with the service role) bypasses RLS and
-- needs plain table access.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
