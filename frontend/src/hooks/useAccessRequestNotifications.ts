// frontend/src/hooks/useAccessRequestNotifications.ts
// ⭐ №309: всплывающее уведомление о новой заявке на доступ (право создавать проекты).
// WebSocket-канала в проекте нет, поэтому:
//   • опрашиваем входящие заявки сразу при входе;
//   • повторяем раз в минуту;
//   • дополнительно проверяем при возврате в окно (useRefreshOnFocus).
// На ПЕРВОМ опросе не «спамим» каждой заявкой: показываем одну сводку
// (заявки могли прийти, пока приложение было закрыто).
import { useCallback, useEffect, useRef } from 'react';
import { useFeedback } from '../contexts/FeedbackContext';
import { fetchIncomingAccessRequests } from '../services/accessRequestService';
import type { AccessRequestData } from '../services/accessRequestService';
import { useRefreshOnFocus } from './useRefreshOnFocus';

const POLL_MS = 60_000;

const whoName = (request: AccessRequestData): string =>
  request.requester?.fullName || request.requester?.email || 'Участник';

const objectName = (request: AccessRequestData): string =>
  request.object?.name ?? 'объект';

export function useAccessRequestNotifications(enabled: boolean): void {
  const { notify } = useFeedback();
  // null — первый опрос ещё не прошёл
  const seenRef = useRef<Set<number> | null>(null);

  const check = useCallback(async () => {
    try {
      const list = await fetchIncomingAccessRequests('PENDING');
      const seen = seenRef.current;
      if (seen === null) {
        seenRef.current = new Set(list.map((r) => r.id));
        if (list.length === 1) {
          notify(
            `📨 Заявка на доступ: ${whoName(list[0])} — объект «${objectName(list[0])}»`,
            'warning',
          );
        } else if (list.length > 1) {
          notify(`📨 Заявок на доступ: ${list.length}. Подробности — на Главной.`, 'warning');
        }
        return;
      }
      const fresh = list.filter((r) => !seen.has(r.id));
      fresh.forEach((r) => seen.add(r.id));
      if (fresh.length === 1) {
        notify(
          `📨 ${whoName(fresh[0])} просит право создавать проекты в объекте «${objectName(fresh[0])}»`,
          'warning',
        );
      } else if (fresh.length > 1) {
        notify(`📨 Новых заявок на доступ: ${fresh.length}. Подробности — на Главной.`, 'warning');
      }
    } catch {
      // нет сети или прав — молча: это фоновая подсказка, страницу не трогаем
    }
  }, [notify]);

  useEffect(() => {
    if (!enabled) {
      seenRef.current = null;
      return;
    }
    void check();
    const timer = window.setInterval(() => void check(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, check]);

  useRefreshOnFocus(
    () => {
      if (enabled) void check();
    },
    { minIntervalMs: 20_000 },
  );
}

export default useAccessRequestNotifications;
