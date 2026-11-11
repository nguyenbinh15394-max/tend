-- Minimal stand-in for what Supabase provides, so the migrations and RLS tests
-- can run on a plain Postgres (PGlite) with no Docker and no Supabase project.
-- NOT a migration: never run this against a real Supabase database.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  instance_id             uuid,
  id                      uuid primary key,
  aud                     text,
  role                    text,
  email                   text,
  encrypted_password      text,
  email_confirmed_at      timestamptz,
  raw_app_meta_data       jsonb,
  raw_user_meta_data      jsonb,
  is_anonymous            boolean not null default false,
  confirmation_token      text,
  recovery_token          text,
  email_change_token_new  text,
  email_change            text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create table auth.identities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  provider_id      text not null,
  provider         text not null,
  identity_data    jsonb not null,
  last_sign_in_at  timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create function auth.jwt() returns jsonb
language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;

grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Supabase grants table access to these roles by default; RLS does the rest.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
