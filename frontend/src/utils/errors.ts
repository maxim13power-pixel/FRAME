// frontend/src/utils/errors.ts
// ⭐ Шаг 100 (P1-8): единый разбор ошибок API — вместо `catch (err: any)` по всему проекту.
// NestJS/class-validator может прислать message строкой ИЛИ массивом строк — приводим к строке.

interface ApiErrorLike {
  message?: unknown;
  response?: { data?: { message?: unknown } };
}

/**
 * Сообщение из ответа бэкенда (или fallback).
 * Строка → как есть; массив (class-validator) → первый непустой элемент; иначе fallback.
 */
export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const raw = (err as ApiErrorLike | null)?.response?.data?.message;

  if (Array.isArray(raw)) {
    const first = raw.find((item) => typeof item === 'string' && item.length > 0);
    return typeof first === 'string' ? first : fallback;
  }

  if (typeof raw === 'string' && raw.trim()) return raw;
  return fallback;
};

/**
 * То же, но с дополнительным fallback на текст ошибки axios ('Network Error', 'timeout…').
 * Используется там, где раньше было `err.response?.data?.message || err.message`.
 */
export const getApiErrorText = (err: unknown, fallback: string): string => {
  const fromResponse = getApiErrorMessage(err, '');
  if (fromResponse) return fromResponse;

  const message = (err as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
};