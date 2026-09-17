import React, { createContext, useContext, useState } from 'react';
import { clearAuthStorage, getToken, safeParse, USER_KEY } from '../utils/storage';

interface AuthContextType {
  token: string | null;
  user: any | null;
  login: (token: string, user: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ⭐ Шаг 99 (P1-6): читаем сессию через безопасные хелперы —
  // битый JSON в 'user' больше не роняет приложение при старте.
  const [token, setToken] = useState<string | null>(getToken());
  const [user, setUser] = useState<any | null>(safeParse(USER_KEY));

  const login = (newToken: string, newUser: any) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    // ⭐ Шаг 99: ключи чистятся в одном месте (utils/storage.ts)
    clearAuthStorage();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};