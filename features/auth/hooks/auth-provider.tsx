'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import { authApi, type Me } from '../api/auth.api';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: Me }
  | { status: 'unavailable'; user: null };

interface AuthContextValue {
  auth: AuthState;
  /** Reload the account (after a profile change). */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  /** Called by pages when Core answers 401: the session is gone. */
  expire: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadAuth(): Promise<AuthState> {
  try {
    return { status: 'authenticated', user: await authApi.me() };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { status: 'anonymous', user: null };
    return { status: 'unavailable', user: null };
  }
}

/** Knows who is signed in. One /me call on load; everything else reads this. */
export function AuthProvider({ children, initial }: { children: React.ReactNode; initial?: AuthState }) {
  const [auth, setAuth] = useState<AuthState>(initial ?? { status: 'loading', user: null });

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    loadAuth().then((next) => {
      if (!cancelled) setAuth(next);
    });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const refresh = useCallback(async () => setAuth(await loadAuth()), []);
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAuth({ status: 'anonymous', user: null });
    }
  }, []);
  const expire = useCallback(() => setAuth({ status: 'anonymous', user: null }), []);

  const value = useMemo(() => ({ auth, refresh, logout, expire }), [auth, refresh, logout, expire]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

export type { AuthState };
