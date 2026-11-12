import { createContext, useContext, type ReactNode } from 'react';

/**
 * Sample rows for design previews. Inside a <FixtureProvider>, useLive()
 * returns these rows instead of querying Supabase, so a screen can be
 * rendered with the hi-fi's family without signing in.
 */
type Tables = Record<string, unknown[]>;

const FixtureContext = createContext<Tables | null>(null);

export function FixtureProvider({ tables, children }: { tables: Tables; children: ReactNode }) {
  return <FixtureContext.Provider value={tables}>{children}</FixtureContext.Provider>;
}

export function useFixture<T>(table: string): T[] | null {
  const tables = useContext(FixtureContext);
  if (!tables) return null;
  return (tables[table] ?? []) as T[];
}
