import { useEffect, useRef, useState } from 'react';

export type ScrollDirection = 'up' | 'down';

/**
 * Отслеживает направление вертикального скролла страницы.
 * - слушатель scroll — passive;
 * - троттлинг через requestAnimationFrame (не чаще одного кадра);
 * - скролл вниз более threshold px → 'down', вверх более threshold px → 'up';
 * - cleanup при unmount (снятие слушателя + отмена pending rAF).
 */
export function useScrollDirection(threshold = 8): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>('up');
  const lastYRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    lastYRef.current = window.scrollY;

    const handleScroll = () => {
      if (rafRef.current !== null) return;

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;

        const currentY = window.scrollY;
        const delta = currentY - lastYRef.current;

        if (Math.abs(delta) > threshold) {
          setDirection(delta > 0 ? 'down' : 'up');
          lastYRef.current = currentY;
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [threshold]);

  return direction;
}
