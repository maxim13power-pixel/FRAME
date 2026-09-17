// frontend/src/utils/storage.ts
// ⭐ Шаг 99 (P1-6): безопасная работа с localStorage.
// localStorage может быть недоступен (приватный режим / отключённые cookies),
// а значения — содержать битый JSON. Приложение не должно падать из-за этого.

/** Ключи хранилища в одном месте — без «магических строк» по проекту */
export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';
export const PENDING_INVITE_KEY = 'pendingInviteToken';

/**
 * Безопасно парсит JSON из localStorage.
 * Возвращает null, если ключа нет, JSON битый или хранилище недоступно.
 */
export const safeParse = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    // битый JSON или localStorage недоступен — не роняем приложение
    return null;
  }
};

/**
 * Безопасно читает СТРОКУ (не JSON).
 * Возвращает fallback, если ключа нет или хранилище недоступно.
 */
export const safeGetString = (key: string, fallback = ''): string => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

/** Текущий токен сессии (или null) — используется request-интерцептором api.ts */
export const getToken = (): string | null => safeGetString(TOKEN_KEY, '') || null;

/** Полная очистка сессии — при logout и при ответе 401 от бэкенда */
export const clearAuthStorage = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // хранилище недоступно — чистить нечего
  }
};
