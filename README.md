# Tend

Tend — family care for ageing parents. Caregiver web + parent mobile, built with Expo, Supabase and Claude Code.

Caring for an ageing parent is usually shared across siblings, partners and neighbours, and it falls apart in group chats: nobody is sure who ordered the pills, who is driving to the cardiologist, or whether Mum's blood pressure was taken this week. Tend gives the family one shared record and makes sure every task has a named owner.

## Two surfaces, one record

- **Caregiver web app** — for the adult children. Recurring supplies, appointments (book one and assign a driver), a health log, and the family circle with roles and permissions.
- **Parent mobile mode** — a separate, radically simple product for the parent. No login, three actions, large type (Atkinson Hyperlegible, 19px+), touch targets of 64px or more.

## Principles

1. **One shared record** — everyone sees the same supplies, appointments and readings.
2. **Parent mode is a separate product**, not a shrunken caregiver app.
3. **Every task has a named owner.**
4. **Help, don't surveil** — what the family can see is governed by the parent's consent, enforced in the database.

## Scope

Six flows designed; three built end to end:

- Recurring supplies
- Appointments (book + assign a driver)
- Family circle with roles, enforced with row-level security

## Stack

- [Expo](https://expo.dev) / React Native — one codebase for caregiver web and parent mobile
- [Supabase](https://supabase.com) — Auth, Postgres with row-level security, Realtime, Edge Functions
- Built with [Claude Code](https://claude.com/claude-code)

## Build log

Progress is tracked in [`buildlog.json`](buildlog.json) and shown live on the case study at [thuybinh.me/tend](https://www.thuybinh.me/tend).

## Database

Schema, row-level security and tests live in [`supabase/`](supabase/README.md). Run the RLS tests with `npm run test:db`.

## Local setup

Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key. Never commit `.env` or the `service_role` key.
