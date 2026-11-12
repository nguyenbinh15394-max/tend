-- Tend · supply details for hi-fi 2a
-- The Supplies screen shows what each item costs, who pays for it, how long
-- a pack lasts and where it goes, so the family can see the month's spend
-- and the split, and Tend can suggest a shorter cycle when a pack runs out
-- before the next delivery. Paused items stay listed but need no one.
--
-- Same rules as the rest of the row: the existing policies and the table
-- grant (select, insert, update, delete for authenticated) cover the new
-- columns, so only people with the Order permission can change them.

alter table public.supplies
  add column price_vnd          integer check (price_vnd between 0 and 100000000),
  add column pack_size          integer check (pack_size between 1 and 10000),
  add column per_day            numeric(6,2) check (per_day > 0 and per_day <= 1000),
  add column paid_by_member_id  uuid,
  add column deliver_to         text check (char_length(deliver_to) <= 200),
  add column paused             boolean not null default false,
  add foreign key (paid_by_member_id, family_id)
    references public.members (id, family_id) on delete set null (paid_by_member_id);
