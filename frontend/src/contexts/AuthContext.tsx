import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuthStorage, getToken, safeParse, TOKEN_KEY, USER_KEY } from '../utils/storage';

// ⭐ Шаг 100 (P1-8): `user` — сырой ответ бэкенда (id, fullName, email, phone, role, hidePrices…),
// его читают десятки страниц. Строгая типизация — отдельный шаг (P2): мгновенно сломает пол-проекта.
// Поэтому any разрешён ТОЧЕЧНО здесь (тип-алиас), а не по всему файлу.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BackendUser = any;

interface AuthContextType {
  token: string | null;
  user: BackendUser | null;
  login: (token: string, user: BackendUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  // ⭐ Шаг 99 (P1-6): читаем сессию через безопасные хелперы —
  // битый JSON в 'user' больше не роняет приложение при старте.
  const [token, setToken] = useState<string | null>(getToken());
  const [user, setUser] = useState<BackendUser | null>(safeParse(USER_KEY));

  const login = (newToken: string, newUser: BackendUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = useCallback(() => {
    // ⭐ Шаг 99: ключи чистятся в одном месте (utils/storage.ts)
    clearAuthStorage();
    setToken(null);
    setUser(null);
  }, []);

  // ⭐ Шаг 100 (P1-8): SOFT LOGOUT.
  // api.ts на 401 чистит токен и диспатчит 'auth:logout'; ловим событие здесь и
  // уводим на /login через роутер — без перезагрузки страницы и потери SPA-состояния.
  useEffect(() => {
    const handleSoftLogout = () => {
      logout();
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:logout', handleSoftLogout);
    return () => window.removeEventListener('auth:logout', handleSoftLogout);
  }, [logout, navigate]);

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