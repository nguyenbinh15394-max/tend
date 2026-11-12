import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useSession } from './session';
import { supabase } from './supabase';
import type { Family, Member, Parent } from './types';

/**
 * The caregiver's current family circle: the family, the signed-in member,
 * everyone in the circle and the parent being cared for. One family and one
 * parent for now (the case study's scope).
 */
type FamilyState = {
  loading: boolean;
  family: Family | null;
  me: Member | null;
  members: Member[];
  parent: Parent | null;
  reload: () => Promise<void>;
};

const FamilyContext = createContext<FamilyState | null>(null);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id;
  const [state, setState] = useState<Omit<FamilyState, 'reload'>>({
    loading: true,
    family: null,
    me: null,
    members: [],
    parent: null,
  });

  const reload = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data: mine } = await supabase
      .from('members')
      .select('*, families(id, name)')
      .eq('user_id', userId)
      .order('created_at')
      .limit(1)
      .maybeSingle();

    if (!mine) {
      setState({ loading: false, family: null, me: null, members: [], parent: null });
      return;
    }

    const { families, ...me } = mine as Member & { families: Family };
    const [{ data: members }, { data: parent }] = await Promise.all([
      supabase.from('members').select('*').eq('family_id', me.family_id).order('created_at'),
      supabase.from('parents').select('*').eq('family_id', me.family_id).order('created_at').limit(1).maybeSingle(),
    ]);

    setState({
      loading: false,
      family: families,
      me,
      members: (members ?? []) as Member[],
      parent: (parent ?? null) as Parent | null,
    });
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Everyone in the circle sees changes to the circle and the parent live.
  const familyId = state.family?.id;
  useEffect(() => {
    if (!supabase || !familyId) return;
    const client = supabase;
    const channel = client
      .channel(`family-${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `family_id=eq.${familyId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parents', filter: `family_id=eq.${familyId}` }, reload)
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [familyId, reload]);

  return <FamilyContext.Provider value={{ ...state, reload }}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const value = useContext(FamilyContext);
  if (!value) throw new Error('useFamily must be used inside <FamilyProvider>');
  return value;
}

/** Runs a query now, again whenever `deps` change, and when `table` changes for this family. */
export function useLive<T>(
  table: string,
  familyId: string | undefined,
  load: () => PromiseLike<{ data: T[] | null }>,
  deps: unknown[] = []
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!familyId) return;
    const { data } = await load();
    setRows(data ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, ...deps]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supabase || !familyId) return;
    const client = supabase;
    const channel = client
      .channel(`${table}-${familyId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` }, refresh)
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [table, familyId, refresh]);

  return { rows, loading, refresh };
}
