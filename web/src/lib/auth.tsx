'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '@/types';
import { api } from './api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  signIn: (user: User, token: string) => void;
  signOut: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadFromStorage(): { user: User | null; token: string | null } {
  if (typeof window === 'undefined') return { user: null, token: null };
  const savedToken = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  if (savedToken && savedUser) {
    try {
      return { user: JSON.parse(savedUser) as User, token: savedToken };
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
  return { user: null, token: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load auth state client-side only to avoid SSR/hydration mismatch
    const { user: savedUser, token: savedToken } = loadFromStorage();
    if (savedUser && savedToken) {
      setUser(savedUser);
      setToken(savedToken);
      api.setToken(savedToken);
    }
    setIsLoading(false);
  }, []);

  const signIn = useCallback((u: User, t: string) => {
    setUser(u);
    setToken(t);
    api.setToken(t);
    document.cookie = `role=${u.role}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    localStorage.setItem('user', JSON.stringify(u));
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setToken(null);
    api.clearToken();
    document.cookie = 'role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, signIn, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

export function getRoleHome(role: string): string {
  switch (role) {
    case 'super_admin':
    case 'admin':
    case 'dispatch':
    case 'support':
      return '/admin';
    case 'provider':
    case 'tow_operator':
      return '/provider/dashboard';
    default:
      return '/customer/dashboard';
  }
}

export function getUserFullName(user: User): string {
  return `${user.first_name} ${user.last_name}`.trim();
}
