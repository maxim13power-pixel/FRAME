import { useEffect, useRef, useState } from 'react';

export type ScrollDirection = 'up' | 'down' | 'none';

/**
 * Отслеживает направление вертикального скролла страницы.
 * - слушатель scroll — passive;
 * - троттлинг через requestAnimationFrame (не чаще одного кадра);
 * - скролл вниз более threshold px → 'down', вверх более threshold px → 'up';
 * - 'none' — страница не скроллится (контент короче экрана);
 * - cleanup при unmount (снятие слушателей + отмена pending rAF).
 */
export function useScrollDirection(threshold = 8): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>('up');
  const lastYRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    lastYRef.current = window.scrollY;

    // Есть ли вертикальный скролл: документ выше вьюпорта.
    const canScroll = () =>
      document.documentElement.scrollHeight > window.innerHeight;

    // Нет скролла → 'none'; контент «вырос» → возвращаемся в 'up'.
    const syncScrollability = () => {
      setDirection((prev) => {
        if (!canScroll()) return 'none';
        return prev === 'none' ? 'up' : prev;
      });
    };

    syncScrollability();

    const handleScroll = () => {
      if (rafRef.current !== null) return;

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;

        if (!canScroll()) {
          setDirection('none');
          return;
        }

        const currentY = window.scrollY;
        const delta = currentY - lastYRef.current;

        if (Math.abs(delta) > threshold) {
          setDirection(delta > 0 ? 'down' : 'up');
          lastYRef.current = currentY;
        }
      });
    };

    const handleResize = () => syncScrollability();

    // Реактивно ловим рост контента (асинхронная подгрузка материалов).
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && document.body) {
      resizeObserver = new ResizeObserver(() => syncScrollability());
      resizeObserver.observe(document.body);
    }

    // Страховка: повторная проверка через 1 секунду после отрисовки контента.
    const timerId = window.setTimeout(syncScrollability, 1000);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
      window.clearTimeout(timerId);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [threshold]);

  return direction;
}
