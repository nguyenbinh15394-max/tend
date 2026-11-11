import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

/**
 * Which product the person is in:
 *   setup      .env is missing the Supabase keys
 *   loading    restoring the session
 *   signed-out choose: caregiver sign-in, or set up a parent's phone
 *   caregiver  signed in with an email account → caregiver app
 *   pairing    a phone signed in anonymously but not yet paired to a parent
 *   parent     a paired phone → parent mode (no login, three actions)
 */
export type Mode = 'setup' | 'loading' | 'signed-out' | 'caregiver' | 'pairing' | 'parent';

type SessionState = {
  mode: Mode;
  session: Session | null;
  parentId: string | null;
  refreshPairing: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [parentId, setParentId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const isAnonymous = session?.user.is_anonymous ?? false;

  const refreshPairing = useCallback(async () => {
    if (!supabase || !userId || !isAnonymous) {
      setParentId(null);
      return;
    }
    const { data } = await supabase
      .from('parent_devices')
      .select('parent_id')
      .eq('user_id', userId)
      .maybeSingle();
    setParentId(data?.parent_id ?? null);
  }, [userId, isAnonymous]);

  useEffect(() => {
    setParentId(undefined);
    refreshPairing();
  }, [refreshPairing]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  let mode: Mode;
  if (!supabase) mode = 'setup';
  else if (session === undefined) mode = 'loading';
  else if (!session) mode = 'signed-out';
  else if (!isAnonymous) mode = 'caregiver';
  else if (parentId === undefined) mode = 'loading';
  else mode = parentId ? 'parent' : 'pairing';

  return (
    <SessionContext.Provider
      value={{ mode, session: session ?? null, parentId: parentId ?? null, refreshPairing, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
