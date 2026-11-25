// frontend/src/utils/errorReporter.ts
// ⭐ №396: ошибки браузера → backend → Telegram. Решение владельца: без Sentry, алерты в канал.
//
// Правила:
//   • работает только в production-сборке или если явно включено VITE_ERROR_REPORT=1 (для проверки);
//   • не больше 3 сообщений в минуту и одна и та же ошибка не чаще раза в минуту;
//   • отправка не должна ломать приложение: все ошибки сети/JSON глушим;
//   • в запрос не уходят персональные данные — только текст ошибки, стек, путь и user-agent.
import { API_URL } from '../services/api';

const MAX_PER_MINUTE = 3;
const DEDUPE_MS = 60_000;
const sentAt: number[] = [];
const lastSeen = new Map<string, number>();

const shouldSend = (message: string): boolean => {
  const now = Date.now();
  while (sentAt.length > 0 && now - sentAt[0] > 60_000) sentAt.shift();
  if (sentAt.length >= MAX_PER_MINUTE) return false;
  const previous = lastSeen.get(message);
  if (previous !== undefined && now - previous < DEDUPE_MS) return false;
  lastSeen.set(message, now);
  if (lastSeen.size > 200) lastSeen.clear();
  sentAt.push(now);
  return true;
};

const report = (message: string, stack?: string, context?: string): void => {
  try {
    const text = (message || 'Unknown error').slice(0, 500);
    if (!shouldSend(text)) return;
    void fetch(`${API_URL}/telemetry/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message: text,
        stack: stack ? stack.slice(0, 4000) : undefined,
        // query-строку не отправляем: там могут быть id и токены
        url: `${window.location.pathname}`.slice(0, 300),
        userAgent: navigator.userAgent.slice(0, 300),
        context,
      }),
    }).catch(() => undefined);
  } catch {
    // приёмник ошибок сам не должен падать
  }
};

/** Подключает перехват ошибок окна и необработанных промисов. Вызывается один раз из main.tsx. */
export const initErrorReporter = (): void => {
  if (typeof window === 'undefined') return;
  if (!(import.meta.env.PROD || import.meta.env.VITE_ERROR_REPORT === '1')) return;

  window.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : null;
    report(event.message || error?.message || 'Unknown error', error?.stack, 'window.error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    const message = reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'Unhandled rejection';
    report(message, reason instanceof Error ? reason.stack : undefined, 'unhandledrejection');
  });
};
