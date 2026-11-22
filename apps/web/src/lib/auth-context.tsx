'use client';

import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, refreshSession, setAccessToken } from './api';

export type User = {
  id: string;
  email: string | null;
  emailVerifiedAt: string | null;
  nickname: string;
  tag: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  hasPassword: boolean;
  providers: 'DISCORD'[];
};

export type Session = {
  user: User;
  accessToken: string;
};

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  signIn: (session: Session) => void;
  signOut: () => Promise<void>;
  reloadUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let active = true;

    async function restore() {
      const token = await refreshSession();

      if (!token) {
        if (active) setStatus('anonymous');
        return;
      }

      try {
        const restored = await api<User>('/auth/me');

        if (!active) return;

        setUser(restored);
        setStatus('authenticated');
      } catch {
        if (!active) return;

        setAccessToken(null);
        setStatus('anonymous');
      }
    }

    void restore();

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback((session: Session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api<{ success: boolean }>('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const reloadUser = useCallback(async () => {
    setUser(await api<User>('/auth/me'));
  }, []);

  const value = useMemo(
    () => ({ user, status, signIn, signOut, reloadUser }),
    [user, status, signIn, signOut, reloadUser],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }

  return context;
}
