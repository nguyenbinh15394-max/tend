-- Tend · names for parent mode
-- The parent's phone shows "Nam will take you" on the next check-up, so it
-- needs the names of the people in the circle. Only names: never roles,
-- permissions or contact details (those stay in members, which the phone
-- cannot read).

create function public.my_family_names()
returns table (member_id uuid, display_name text)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.display_name
  from public.members m
  join public.parents p on p.family_id = m.family_id
  where p.id = private.my_parent_id()
  order by m.created_at
$$;

revoke execute on function public.my_family_names() from public, anon;
grant execute on function public.my_family_names() to authenticated;
