'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'buyer' | 'merchant';

export interface UserSession {
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: UserSession;
  setRole: (role: UserRole) => void;
  login: (email: string, role: UserRole) => void;
  logout: () => void;
}

const defaultUser: UserSession = {
  email: 'akash@buyer.agent',
  role: 'buyer',
};

const AuthContext = createContext<AuthContextType>({
  user: defaultUser,
  setRole: () => {},
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession>(defaultUser);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('dealflow_user_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.email && (parsed.role === 'buyer' || parsed.role === 'merchant')) {
          setUser(parsed);
        }
      }
    } catch {}
  }, []);

  const setRole = (role: UserRole) => {
    const updated = { ...user, role };
    setUser(updated);
    try {
      localStorage.setItem('dealflow_user_session', JSON.stringify(updated));
    } catch {}
  };

  const login = (email: string, role: UserRole) => {
    const updated = { email, role };
    setUser(updated);
    try {
      localStorage.setItem('dealflow_user_session', JSON.stringify(updated));
    } catch {}
  };

  const logout = () => {
    setUser(defaultUser);
    try {
      localStorage.removeItem('dealflow_user_session');
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, setRole, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
