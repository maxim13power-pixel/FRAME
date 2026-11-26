// frontend/src/components/materials/EstimateScrollChrome.tsx
// ⭐ №393: «прокруточная обвязка» сметы — плашка итогов, FAB «+» и кнопка «вниз».
// Раньше направление скролла и «долистали до низа» жили в состоянии СТРАНИЦЫ,
// поэтому каждый жест скролла перерисовывал всю смету (на 400 строках — 50 строк
// таблицы за кадр). Теперь состояние внутри этого компонента: страница и строки
// о прокрутке ничего не знают, отступ списка задаётся через ref (CSS), а не props.
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Box, Fab, IconButton, Paper, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import { FAB_STYLE } from '../../theme';
import { countRender } from '../../utils/perf';
import { rub } from './estimateFormat';
import { SUMMARY_BAR_BOTTOM, SUMMARY_LIST_CLEARANCE_BOTTOM_PX } from './estimateLayout';

export interface EstimateTotalsView {
  sumEstimate: number;
  sumCurrentTotal: number;
  weightedPercent: number;
}

export interface EstimateScrollChromeProps {
  isMobile: boolean;
  hidePrices: boolean;
  canWrite: boolean;
  /** включён режим выделения: плашка итогов и FAB уступают место панели действий */
  selectionMode: boolean;
  totals: EstimateTotalsView;
  hasWindowBar: boolean;
  /** контейнер мобильного списка — ему задаём отступ под фиксированную плашку */
  listRef: React.RefObject<HTMLDivElement | null>;
  onAddClick: () => void;
  onScrollToFooter: () => void;
}

const EstimateScrollChromeInner: React.FC<EstimateScrollChromeProps> = ({
  isMobile,
  hidePrices,
  canWrite,
  selectionMode,
  totals,
  hasWindowBar,
  listRef,
  onAddClick,
  onScrollToFooter,
}) => {
  countRender('materials.scrollChrome'); // ⭐ №393: замер рендеров обвязки
  const direction = useScrollDirection();
  const [footerVisible, setFooterVisible] = useState(false);
  // ⭐ «Наверх»: кнопка нужна, когда страница прокручена (у самого верха она лишняя)
  const [topButtonVisible, setTopButtonVisible] = useState(false);

  // ⭐ №384: видимость кнопки «вниз» — по расстоянию до низа страницы.
  // Меряем после отрисовки (rAF) и при изменении высоты контента (ResizeObserver),
  // иначе на первом кадре таблица ещё не отрисована и кнопка «прячется» зря.
  useEffect(() => {
    const measure = () => {
      const doc = document.documentElement;
      const distance = doc.scrollHeight - (window.scrollY + window.innerHeight);
      setFooterVisible(distance <= 160);
      setTopButtonVisible(window.scrollY > 200);
    };
    const raf = window.requestAnimationFrame(measure);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(measure)
        : null;
    observer?.observe(document.body);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);

  const barActive = isMobile && !selectionMode;

  // ⭐ №393: отступ списка под фиксированную плашку — через ref, а не через props,
  // чтобы смена направления скролла не перерисовывала ни страницу, ни строки.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.style.paddingBottom =
      barActive && direction !== 'none' ? `${SUMMARY_LIST_CLEARANCE_BOTTOM_PX}px` : '';
  }, [barActive, direction, listRef]);

  const showBar = barActive;
  // FAB «+» поднят выше плашки итогов; ⭐ №294: в режиме выделения прячем
  const showFab = barActive && canWrite && (direction !== 'down' || footerVisible);

  return (
    <>
      {showBar && (
        <Paper
          className="no-print"
          elevation={8}
          sx={{
            position: direction === 'none' ? 'static' : 'fixed',
            bottom: SUMMARY_BAR_BOTTOM,
            left: 8,
            right: 8,
            zIndex: 9, // < zIndex BottomNav (10) — при скролле плашка уезжает ПОД меню
            borderRadius: 2,
            bgcolor: '#fff',
            px: 2,
            py: 1,
            border: '1px solid #e0e0e0',
            mt: direction === 'none' ? 1 : 0,
            transform:
              direction === 'down' && !footerVisible
                ? `translateY(calc(100% + ${SUMMARY_BAR_BOTTOM}px))`
                : 'translateY(0)',
            transition: 'transform 0.2s ease',
          }}
        >
          {hidePrices ? (
            // Для VIEWER показываем только процент
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Освоено</Typography>
              <Typography variant="body2" fontWeight={700} color={totals.weightedPercent >= 100 ? '#4caf50' : '#ef6c00'}>
                {totals.weightedPercent}%
              </Typography>
            </Box>
          ) : (
            // Для остальных показываем всё
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 1, rowGap: 0.5 }}>
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Смета</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
                  {rub(totals.sumEstimate)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Факт</Typography>
                <Typography variant="body2" fontWeight={700} color="#1976d2" sx={{ whiteSpace: 'nowrap' }}>
                  {rub(totals.sumCurrentTotal)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Освоено</Typography>
                <Typography variant="body2" fontWeight={700} color={totals.weightedPercent >= 100 ? '#4caf50' : '#ef6c00'}>
                  {totals.weightedPercent}%
                </Typography>
              </Box>
            </Box>
          )}
        </Paper>
      )}
      {showFab && (
        <Fab
          className="no-print"
          color="primary"
          sx={{ ...FAB_STYLE, bottom: 130 }}
          onClick={onAddClick}
        >
          <AddIcon />
        </Fab>
      )}
      {/* ⭐ №384: «вниз» к ИТОГО и переключателю страниц.
          ⭐ №386: кнопку не скрываем при скролле вниз — именно тогда она и нужна. */}
      {hasWindowBar && !footerVisible && (
        <IconButton
          className="no-print"
          aria-label="К итогам и страницам"
          title="К итогам и страницам"
          onClick={onScrollToFooter}
          sx={{
            position: 'fixed',
            right: isMobile ? 16 : 24,
            bottom: isMobile ? SUMMARY_BAR_BOTTOM + 132 : 24,
            zIndex: 8,
            width: 40,
            height: 40,
            bgcolor: 'background.paper',
            border: '1px solid #e0e0e0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
            '&:hover': { bgcolor: '#fff' },
          }}
        >
          <KeyboardArrowDownIcon />
        </IconButton>
      )}
      {/* ⭐ «Наверх» — такая же кнопка над «К итогам и страницам»; появляется, когда страница
          прокручена, и возвращает к началу сметы (шапка, поиск, фильтры). */}
      {topButtonVisible && (
        <IconButton
          className="no-print"
          aria-label="Наверх"
          title="Наверх"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          sx={{
            position: 'fixed',
            right: isMobile ? 16 : 24,
            bottom: isMobile ? SUMMARY_BAR_BOTTOM + 180 : 72,
            zIndex: 8,
            width: 40,
            height: 40,
            bgcolor: 'background.paper',
            border: '1px solid #e0e0e0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
            '&:hover': { bgcolor: '#fff' },
          }}
        >
          <KeyboardArrowUpIcon />
        </IconButton>
      )}
    </>
  );
};

export const EstimateScrollChrome = React.memo(EstimateScrollChromeInner);
export default EstimateScrollChrome;
