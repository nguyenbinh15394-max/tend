// Runs the Supabase migrations and RLS tests on an in-memory Postgres (PGlite).
// No Docker, no Supabase project, no keys. Usage: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, '..', 'migrations');
const read = (p) => readFileSync(p, 'utf8');

const db = new PGlite();

async function run(label, sql) {
  try {
    await db.exec(sql);
  } catch (err) {
    console.error(`\n✗ ${label}\n  ${err.message}`);
    process.exit(1);
  }
}

await run('auth stub', read(join(here, 'auth_stub.sql')));

for (const file of readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort()) {
  await run(`migration ${file}`, read(join(migrations, file)));
  console.log(`✓ migration ${file}`);
}

await run('seed.sql', read(join(here, '..', 'seed.sql')));
console.log('✓ seed.sql');

// Tests start from a clean slate, without the seed data.
await run('reset', 'truncate public.families, auth.users cascade;');
await run('rls_test.sql', read(join(here, 'rls_test.sql')));

const { rows } = await db.query('select label, refused_with from tests.results order by n');
for (const { label, refused_with } of rows) {
  console.log(`✓ ${label}${refused_with ? `\n    refused: ${refused_with}` : ''}`);
}
console.log(`\n${rows.length} checks passed`);
