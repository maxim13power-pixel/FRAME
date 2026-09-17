// frontend/src/services/api.ts
//  Шаг 99 (P1-6): единый axios-инстанс для ВСЕХ запросов к бэкенду.
// - baseURL берётся из .env (VITE_API_URL) с fallback на API_BASE_URL из config.ts
// - request-interceptor сам цепляет Authorization: Bearer <token> из localStorage
// - response-interceptor на 401 (кроме публичных auth-ручек) чистит сессию и уводит на /login
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { clearAuthStorage, getToken } from '../utils/storage';

/** Итоговый базовый URL API (expose для отладки/обратной совместимости) */
export const API_URL = (import.meta.env.VITE_API_URL as string) || API_BASE_URL;

// ⭐ Публичные ручки авторизации: 401 здесь означает «неверные данные»,
// а не «истёк токен». Их нельзя выкидывать на /login и затирать введённую форму.
const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const isPublicAuthRequest = (url?: string): boolean =>
  !!url && PUBLIC_AUTH_PATHS.some((path) => url.includes(path));

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ⭐ Request: автоматический Bearer из localStorage.
// Убирает ~44 ручных заголовка `headers: { Authorization: `Bearer ${token}` }` в сервисах.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ⭐ Response: централизованный обработчик ошибок
// (перенос логики из services/axiosInterceptor.ts, который больше не нужен).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status: number | undefined = error?.response?.status;
    const url: string | undefined = error?.config?.url;

    if (status === 401 && !isPublicAuthRequest(url)) {
      clearAuthStorage();
      // AuthContext подписан на это событие → обновит состояние без «жёсткой» перезагрузки
      window.dispatchEvent(new Event('auth:logout'));
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    // 403 и 500 тоже ловим — раньше молча проглатывались
    if (status === 403) {
      console.warn('⚠️ Доступ запрещён:', error?.response?.data?.message);
    }
    if (status && status >= 500) {
      console.error(' Ошибка сервера:', error?.response?.data?.message || error?.message);
    }

    return Promise.reject(error);
  },
);

export default api;