// frontend/src/hooks/useBackNavigation.ts
// ⭐ №248: кнопка «назад» возвращает на ПРЕДЫДУЩУЮ страницу в истории приложения,
// а не всегда на Главную. Если истории нет (прямой заход, обновление страницы,
// переход с другого сайта) — ведём на логический родительский раздел (fallback).
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useBackNavigation(fallback: string = '/'): () => void {
  const navigate = useNavigate();

  return useCallback(() => {
    // React Router хранит номер записи истории в history.state.idx:
    // 0 — первая страница этой вкладки (назад вести некуда).
    const state = window.history.state as { idx?: number } | null;
    const idx = state?.idx;
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
