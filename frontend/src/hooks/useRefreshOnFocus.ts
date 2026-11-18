// frontend/src/hooks/useRefreshOnFocus.ts
// ⭐ №305: данные, которые мог изменить кто-то другой (или вы — с другого
// устройства), подтягиваем без F5. Раньше фото и фиксации, сделанные на
// телефоне прораба, появлялись на компьютере администратора только после
// перезагрузки страницы: у приложения нет websocket-канала, а все экраны
// грузят данные один раз при входе.
//
// Слушаем три события и обновляем данные «тихо» (без спиннера):
//   • visibilitychange — вкладку/приложение вернули на экран (телефон);
//   • focus            — окно снова активно (переключение между окнами);
//   • pageshow         — страница восстановлена из bfcache (кнопка «назад»).
import { useEffect, useRef } from 'react';

interface Options {
  /** Не дёргать сервер чаще, чем раз в N мс (по умолчанию 15 с). */
  minIntervalMs?: number;
}

export function useRefreshOnFocus(
  callback: () => void,
  { minIntervalMs = 15_000 }: Options = {},
): void {
  const callbackRef = useRef(callback);
  // Свежий колбэк без переподписки на события: страницы передают обычные
  // функции, которые создаются заново на каждом рендере.
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    // Отсчёт ведём от последнего срабатывания: alt+tab туда-обратно не должен
    // превращаться в пачку запросов.
    let lastRun = Date.now();
    const run = () => {
      if (Date.now() - lastRun < minIntervalMs) return;
      lastRun = Date.now();
      callbackRef.current();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') run();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) run();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', run);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', run);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [minIntervalMs]);
}

export default useRefreshOnFocus;
