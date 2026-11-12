# Tend

Tend — family care for ageing parents. Caregiver web + parent mobile, built with Expo, Supabase and Claude Code.

Caring for an ageing parent is usually shared across siblings, partners and neighbours, and it falls apart in group chats: nobody is sure who ordered the pills, who is driving to the cardiologist, or whether Mum's blood pressure was taken this week. Tend gives the family one shared record and makes sure every task has a named owner.

## Two surfaces, one record

- **Caregiver web app** — for the adult children. Recurring supplies, appointments (book one and assign a driver), a health log, and the family circle with roles and permissions.
- **Parent mobile mode** — a separate, radically simple product for the parent. No login, three actions, large type (Lexend, 19px+), touch targets of 64px or more.

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

## App structure

One Expo app, two products. Which one opens depends on who is holding it:

- `src/app/(caregiver)/`: the caregiver app (Overview, Supplies, Appointments, Health log, Medicines, Family). Email sign-in with a magic link.
- `src/app/parent/`: parent mode. The phone signs in anonymously and is paired once with a code from a caregiver.
- `src/app/_layout.tsx`: protected routes switch between the two based on the session.
- `src/theme/tokens.ts`: design tokens from the hi-fi. Parent mode never goes below 19px type or 64px touch targets. Type is Lexend: Atkinson Hyperlegible, used in the hi-fi, has no Vietnamese glyphs.

## Local setup

```bash
npm install
cp .env.example .env   # add your Supabase project URL and anon key
npm run web            # caregiver web app in the browser
npm start              # Expo dev server for phones
```

Never commit `.env` or the `service_role` key.

## Deploy (web)

The web build is a static single-page app, so any static host works. The live demo runs on Netlify ([`netlify.toml`](netlify.toml)); [`vercel.json`](vercel.json) does the same for Vercel.

1. Import the GitHub repo in Netlify (or Vercel). The build command, output folder and SPA rewrites come from the config file.
2. Add two environment variables: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the publishable key). They are baked into the public bundle, so never use the secret / `service_role` key; the app refuses to start with one.
3. In Supabase, **Authentication → URL Configuration**: set Site URL to the deployed URL and add `https://<your-domain>/**` to Redirect URLs.
4. For people outside your Supabase organization to receive sign-in emails, set up custom SMTP (**Authentication → Emails → Set up SMTP**).

Parent mode works from the same link in a phone's browser ("Set up this phone for my parent").
