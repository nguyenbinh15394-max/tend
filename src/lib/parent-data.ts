import { useCallback, useEffect, useState } from 'react';

import { useSession } from './session';
import { supabase } from './supabase';
import type { Parent } from './types';

/** The parent this phone is paired to (parent mode only). */
export function useParentRecord() {
  const { parentId } = useSession();
  const [parent, setParent] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!supabase || !parentId) return;
    const { data } = await supabase.from('parents').select('*').eq('id', parentId).maybeSingle();
    setParent((data ?? null) as Parent | null);
    setLoading(false);
  }, [parentId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { parent, loading, reload };
}

export type CallEntry = { display_name: string; phone: string; call_order: number };

/** Who "Call my children" rings, in order. Names and numbers only. */
export function useCallList() {
  const [list, setList] = useState<CallEntry[]>([]);
  useEffect(() => {
    supabase?.rpc('my_call_list').then(({ data }) => setList((data ?? []) as CallEntry[]));
  }, []);
  return list;
}
