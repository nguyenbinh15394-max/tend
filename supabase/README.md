# Tend · database

Postgres schema and row-level security for Tend, as Supabase migrations.

| File | What it does |
| --- | --- |
| `migrations/…_core_schema.sql` | families, members (role + `can_order` / `can_book` / `can_health`), parents (with `consent`), supplies, appointments, readings |
| `migrations/…_rls.sql` | Row-level security: each family sees only its own rows, writes need the matching permission, and the parent's consent is checked on every read and write |
| `migrations/…_circle_and_pairing.sql` | `create_family`, invites + `accept_invite`, parent-phone pairing (`create_pairing_code`, `pair_device`), `set_consent`, Realtime |
| `migrations/…_match_hifi.sql` | Matches the hi-fi: consent as asked on first setup, medicines + doses, phone numbers and call order (`my_call_list`, `update_my_contact`) |
| `migrations/…_explicit_grants.sql` | Every table privilege the app needs, written out (the project does not expose new tables automatically). A caregiver can add a parent by name only, never with consent pre-set |
| `config.toml` | Supabase CLI config for the local stack (anonymous sign-ins on) |
| `seed.sql` | The hi-fi's demo family (Mr. Hòa, Linh, Nam, Mrs. Lan, Cousin Tú) for local development |
| `tests/` | RLS tests that play the family story as real users |

## How the permissions work

- **Owner**: everything, including inviting and editing the circle.
- **Caregiver**: reads everything the parent shares; writes only where they hold `can_order` (supplies), `can_book` (appointments) or `can_health` (readings, medicines, marking doses).
- **Viewer**: read only.
- **Parent's phone**: no login. It signs in anonymously and is paired once with a 6-character code a caregiver generates (valid 15 minutes, single use). It always sees its own parent's record, can log readings and mark doses taken, and gets only the call list (names, phones, order) from the circle.
- **Consent**: `parents.consent` has `medicines`, `appointments`, `health` (blood pressure readings) and `emergency_location`, the four questions on the parent's first setup. Health and location are off by default. Supplies are not gated: they are the family's logistics. Only the parent's paired phone can change it, through `set_consent()`. The column cannot be updated directly by anyone, owners included.

## Run the tests

No Docker or Supabase project needed. The tests run on an in-memory Postgres (PGlite):

```bash
npm install
npm run test:db
```

## Set up a Supabase project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Keep the database password in a password manager. Under Security, keep the Data API on, turn **off** "Automatically expose new tables" (the grants migration covers it) and turn **on** "Enable automatic RLS".
2. **Authentication → Sign In / Providers**: keep Email on, and turn on **Allow anonymous sign-ins** (parent mode uses it).
   **Authentication → URL Configuration**: set Site URL to where the caregiver app runs (`http://localhost:8081` while developing) and add it to Redirect URLs. Caregivers sign in with the default magic-link email, which sends them back there.
   The default email sender only delivers to members of your Supabase organization, a few emails an hour. Inviting real families needs custom SMTP (Authentication → Emails → Set up SMTP).
3. Apply the migrations from this folder:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push --remote
   ```
   `db push` does not run `seed.sql`, so the hosted database starts empty.
4. **Project Settings → API**: copy the project URL and the anon / publishable key into `.env` (see `.env.example`). Never copy the `service_role` / secret key into this repo.
