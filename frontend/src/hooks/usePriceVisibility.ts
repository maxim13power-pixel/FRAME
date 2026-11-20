// frontend/src/hooks/usePriceVisibility.ts
// ⭐ №356: один запрос на приложение — «вижу ли я цены».
// Если нет (наблюдатель или участник со скрытыми ценами), прячем «Справочник цен».
import { useEffect, useState } from 'react';
import { fetchPriceVisibility } from '../services/accessService';

let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;

/** Сбросить кэш (например, после смены доступа) */
export const invalidatePriceVisibility = () => {
  cached = null;
  pending = null;
};

const load = (): Promise<boolean> => {
  if (cached != null) return Promise.resolve(cached);
  if (!pending) {
    pending = fetchPriceVisibility()
      .then((r) => Boolean(r.canSeeMoney))
      .catch(() => true)
      .then((value) => {
        cached = value;
        return value;
      });
  }
  return pending;
};

/** `true`, пока не загрузилось — не мигаем скрытием у тех, кому можно */
export const usePriceVisibility = (): boolean => {
  const [visible, setVisible] = useState<boolean>(cached ?? true);

  useEffect(() => {
    let alive = true;
    void load().then((value) => {
      if (alive) setVisible(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  return visible;
};
