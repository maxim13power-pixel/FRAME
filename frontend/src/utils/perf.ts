// frontend/src/utils/perf.ts
// ⭐ №393: dev-счётчики рендеров — чтобы замер «до/после» был воспроизводимым,
// а не «на глаз». В production-сборке вызовы схлопываются в `if (false) return`
// (Vite подставляет false), сам модуль остаётся пустым.

type PerfStore = Map<string, number>;

const store: PerfStore = new Map();

/**
 * Считает рендер компонента. Вызывается из самих компонентов, имена — точки замера:
 * `materials.page`, `materials.row`, `materials.card`, `materials.scrollChrome`.
 */
export const countRender = (key: string): void => {
  if (!import.meta.env.DEV) return;
  store.set(key, (store.get(key) ?? 0) + 1);
};

/** Сбросить счётчики перед замером: `window.__framePerf.reset()`. */
export const resetRenderCounters = (): void => {
  store.clear();
};

/** Снимок счётчиков: `window.__framePerf.snapshot()` → { 'materials.row': 25, … }. */
export const snapshotRenderCounters = (): Record<string, number> => {
  const out: Record<string, number> = {};
  store.forEach((value, key) => {
    out[key] = value;
  });
  return out;
};

// В dev-сборке вешаем хелперы на window, чтобы замер шёл из headless Chrome
// без правок кода страницы.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__framePerf = {
    reset: resetRenderCounters,
    snapshot: snapshotRenderCounters,
    dev: true,
  };
}
