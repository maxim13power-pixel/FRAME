import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Stack, LinearProgress, Chip, Button, ButtonBase,
  CircularProgress, Alert, Divider,
} from '@mui/material';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'; // ⭐ №231
import EditIcon from '@mui/icons-material/Edit'; // ⭐ №231
import { useAuth } from '../contexts/AuthContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import { fetchDashboardSummary, fetchNoPriceItems } from '../services/dashboardService';
import type { DashboardSummary } from '../services/dashboardService';
import { fetchPhotoBlob, fetchPhotoLibrary } from '../services/photoService'; // ⭐ №230 / №256
import type { MaterialPhotoData, PhotoFeedItem } from '../services/photoService';
import PhotoViewerDialog from '../components/PhotoViewerDialog'; // ⭐ №230
import PhotoFeedGalleryDialog from '../components/PhotoFeedGalleryDialog'; // ⭐ №256
import { parseDecimal } from '../utils/decimal'; // 🔒 P1-3: бэкенд отдаёт Decimal строкой

// 🔒 Шаг 103 (P1-3): принимаем number | string — Decimal с бэкенда приходит строкой
const fmtMoney = (v: number | string) =>
  Math.round(parseDecimal(v)).toLocaleString('ru-RU');
/** ⭐ №244: «1 740 ₽» — валюта не переносится (разряды ru-RU уже с NBSP) */
const rub = (v: number | string) => `${fmtMoney(v)}\u00A0₽`;
/** ⭐ №244: большие проценты с разрядами: 110866.3 → «110 866,3» */
const pct = (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
/** ⭐ №231: сколько последних фото показываем на Главной */
const FEED_LIMIT = 12;
// ⭐ №173: дату из API («YYYY-MM-DD») разбираем как UTC-полночь и берём UTC-день:
// new Date('2026-10-19') в западных зонах даёт 18-е число и подпись «съезжает».
const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return DAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};
/** «19 окт.» по ISO-дате без сдвига часового пояса */
const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
};
/** Подпись диапазона недели: «19 окт. — 25 окт.» */
const weekRange = (days: string[]) =>
  days.length ? `${shortDate(days[0])} — ${shortDate(days[days.length - 1])}` : '';
/** Русские склонения: 1 фиксация / 2 фиксации / 5 фиксаций */
const plural = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};
const daysLeft = (iso: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(iso); end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
};
const timeAgo = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
};
/** ⭐ №230: подпись даты в ленте фото («8 нояб.») */
const photoDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // ⭐ №230: лента последних фото по доступным объектам
  const [feedPhotos, setFeedPhotos] = useState<PhotoFeedItem[]>([]);
  const [feedThumbs, setFeedThumbs] = useState<Record<number, string>>({});
  const [photoTotal, setPhotoTotal] = useState(0);
  const [photoLibraryOpen, setPhotoLibraryOpen] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<MaterialPhotoData | null>(null);
  const feedUrlsRef = useRef<Record<number, string>>({});
  // ⭐ №231: полный список «Без расценки» (в сводке только 5 позиций)
  const [noPriceAll, setNoPriceAll] = useState<DashboardSummary['noPrice'] | null>(null);
  const [noPriceLoading, setNoPriceLoading] = useState(false);

  useMobileHeader({ title: 'Главная' });

  // Лента не критична для Главной: ошибки глотаем, дашборд показываем в любом случае
  const loadFeed = async () => {
    try {
      const page = await fetchPhotoLibrary(FEED_LIMIT);
      const list = page.items;
      setPhotoTotal(page.total);
      const pairs = await Promise.all(
        list.map(async (p) => {
          try {
            const blob = await fetchPhotoBlob(p.id, p.hasThumb ? 'thumb' : 'full');
            return [p.id, URL.createObjectURL(blob)] as const;
          } catch {
            return null;
          }
        }),
      );
      const next: Record<number, string> = {};
      pairs.forEach((pair) => {
        if (pair) next[pair[0]] = pair[1];
      });
      Object.values(feedUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      feedUrlsRef.current = next;
      setFeedPhotos(list);
      setFeedThumbs(next);
    } catch {
      setFeedPhotos([]);
      setPhotoTotal(0);
    }
  };

  // ⭐ №231: раскрыть/свернуть все позиции «Без расценки»
  const toggleNoPrice = async () => {
    if (noPriceAll) {
      setNoPriceAll(null);
      return;
    }
    try {
      setNoPriceLoading(true);
      setNoPriceAll(await fetchNoPriceItems(200));
    } catch (e) {
      console.error(e);
    } finally {
      setNoPriceLoading(false);
    }
  };

  const load = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [summary] = await Promise.all([fetchDashboardSummary(), loadFeed()]);
      setData(summary);
      setNoPriceAll(null);
      setError('');
    } catch (e) {
      console.error(e);
      setError('Не удалось загрузить сводку');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ⭐ №230: освобождаем objectURL миниатюр ленты при уходе со страницы
  useEffect(
    () => () => {
      Object.values(feedUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      feedUrlsRef.current = {};
    },
    [],
  );

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }
  if (error || !data) {
    return (
      <Stack spacing={2} sx={{ mt: 2 }}>
        <Alert severity="error">{error || 'Нет данных'}</Alert>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load}>Повторить</Button>
      </Stack>
    );
  }

  // ⭐ №225 (§71, №118): объёмы и деньги — РАЗНЫЕ сущности.
  // Раньше `data.money.percent` (это был прогресс ОБЪЁМОВ) подписывался как
  // «+864 % перерасход». Теперь:
  //   • объём — свой бар + бейдж «объём перевыполнен на N %» (не красный);
  //   • деньги — отдельно «факт больше сметы на X ₽ (Y %)» / «в пределах сметы».
  const volumePercentRaw = Math.round(data.volume.percent * 100);
  const volumePercent = Math.min(Math.max(volumePercentRaw, 0), 100); // кламп для бара
  const volumeOverrun = data.volume.overrunPercent; // null — перевыполнения нет
  const moneyOverBudget = data.money.overBudget;
  const moneyDiff = data.money.difference;
  // ⭐ №231: «Без расценки» — 5 из сводки или полный список после раскрытия
  const noPriceItems = noPriceAll?.items ?? data.noPrice.items;
  const noPriceCount = noPriceAll?.count ?? data.noPrice.count;
  const maxWeek = Math.max(...data.weekChart.map(w => w.count), 1);
  // ⭐ №173: неделя Пн→Вс — сегодняшнюю колонку подсвечиваем (локальная дата)
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const overdueCount = data.hotProjects.filter(p => daysLeft(p.endDate) < 0).length;

  return (
    <Box sx={{ mt: -1.5, maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {/* ⭐ №169: демо-объект в расчётах → цифры неточные, клик ведёт в «Объекты» */}
      {data.demoObjects > 0 && (
        <Alert
          severity="warning"
          onClick={() => navigate('/objects')}
          sx={{ mb: 2, borderRadius: 2, cursor: 'pointer', alignItems: 'flex-start' }}
        >
          <Typography variant="body2" fontWeight={600}>
            В расчёты входит демо-объект{data.demoObjects > 1 ? `ы (${data.demoObjects})` : ''}
          </Typography>
          <Typography variant="caption">
            Для точных цифр перенесите демо-объект в архив или удалите его — нажмите,
            чтобы открыть «Объекты».
          </Typography>
        </Alert>
      )}
     {/* ─── 1. HERO: ДЕНЬГИ (кликабельный → в Объекты) ─── */}
    <Paper
      onClick={() => navigate('/objects')}
      sx={{
        p: 2, borderRadius: 2, mb: 2, borderLeft: '4px solid #1976d2',
        cursor: 'pointer',
        transition: 'box-shadow 0.3s, transform 0.3s',
        '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <AccountBalanceWalletIcon sx={{ fontSize: 20, color: '#1976d2' }} />
          <Typography variant="subtitle1" fontWeight={700}>Расчёт по всем объектам</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          В работе: {data.kpi.projectsCount} проектов • {data.kpi.objectsCount} объекта • {data.kpi.materialsCount} позиций
        </Typography>
        {/* ⭐ №244: суммы — в сетке (на узком экране 2 колонки, не в одну кашу),
            сравнение — отдельной строкой на всю ширину */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1,
            my: 1.5,
            textAlign: 'center',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">Смета</Typography>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, whiteSpace: 'nowrap' }}
            >
              {rub(data.money.estimate)}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">Факт</Typography>
            <Typography
              variant="h6"
              fontWeight={700}
              color="primary"
              sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, whiteSpace: 'nowrap' }}
            >
              {rub(data.money.actual)}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ mb: 1.5, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">Факт vs смета</Typography>
          {/* ⭐ №225: деньги показываем только сравнением факта со сметой */}
          <Typography
            variant="h6"
            fontWeight={700}
            color={moneyOverBudget ? 'error.main' : 'success.main'}
            sx={{ fontSize: { xs: '0.95rem', sm: '1.15rem' }, lineHeight: 1.3 }}
          >
            {moneyOverBudget
              ? `Факт больше сметы на ${rub(moneyDiff)}${data.money.overPercent != null ? ` (${pct(data.money.overPercent)}\u00A0%)` : ''}`
              : 'В пределах сметы'}
          </Typography>
        </Box>
        {/* ⭐ №225: прогресс ОБЪЁМОВ — не деньги, красным не красим */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Объём работ</Typography>
          <Typography variant="caption" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>{pct(volumePercentRaw)}&nbsp;%</Typography>
          {volumeOverrun !== null && (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={`Объём перевыполнен на ${pct(volumeOverrun)}\u00A0%`}
              sx={{ fontWeight: 600, maxWidth: '100%' }}
            />
          )}
        </Box>
        <LinearProgress
          variant="determinate"
          value={volumePercent}
          color="info"
          aria-label="Объём работ"
          sx={{ height: 10, borderRadius: 5, bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': { borderRadius: 5 } }}
        />
        {/* ⭐ Срез 3: ссылка в Аналитику (не перекрываем клик по карточке → Объекты) */}
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="small"
            variant="text"
            endIcon={<ChevronRightIcon sx={{ fontSize: 20 }} />}
            onClick={(e) => {
              e.stopPropagation();
              navigate('/analytics');
            }}
            sx={{ textTransform: 'none', color: '#1976d2', fontWeight: 600 }}
          >
            Подробнее в Аналитике
          </Button>
        </Box>
      </Paper>

      {/* ⭐ №230: последние фото по объектам — горизонтальная лента */}
      {feedPhotos.length > 0 && (
        <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <PhotoLibraryIcon sx={{ fontSize: 20, color: '#1976d2' }} />
              <Typography variant="subtitle1" fontWeight={700}>Фото с объектов</Typography>
            </Stack>
            <ButtonBase
              onClick={() => setPhotoLibraryOpen(true)}
              aria-label="Открыть все фото"
              sx={{
                color: '#1976d2',
                borderRadius: 1,
                px: 0.75,
                py: 0.25,
                '&:hover': { bgcolor: '#eaf4ff' },
              }}
            >
              <Typography
                sx={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.4 }}
              >
                Все фото · {photoTotal}
              </Typography>
              <ChevronRightIcon sx={{ fontSize: 20 }} />
            </ButtonBase>
          </Box>
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              overflowX: 'auto',
              pb: 1,
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              '&::-webkit-scrollbar': { height: 6 },
              '&::-webkit-scrollbar-thumb': { bgcolor: '#cfd8dc', borderRadius: 3 },
            }}
          >
            {feedPhotos.map((p) => (
              <Box
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => setViewerPhoto(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setViewerPhoto(p);
                  }
                }}
                title={p.materialName}
                sx={{
                  flex: '0 0 auto',
                  width: { xs: 112, sm: 132 },
                  cursor: 'pointer',
                  scrollSnapAlign: 'start',
                }}
              >
                {feedThumbs[p.id] ? (
                  <Box
                    component="img"
                    src={feedThumbs[p.id]}
                    alt={p.materialName}
                    loading="lazy"
                    sx={{
                      width: '100%',
                      height: { xs: 112, sm: 132 },
                      objectFit: 'cover',
                      borderRadius: 2,
                      display: 'block',
                      bgcolor: '#eceff1',
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: { xs: 112, sm: 132 },
                      borderRadius: 2,
                      bgcolor: '#eceff1',
                    }}
                  />
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }} noWrap>
                  {photoDate(p.createdAt)}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }} noWrap>
                  {p.materialName}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                  {p.objectName}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {/* ─── 2. ГОРИТ НА НЕДЕЛЕ ─── */}
      {data.hotProjects.length > 0 && (
        <Paper
          sx={{
            p: 2,
            borderRadius: 2,
            mb: 2,
            // ⭐ №232: как «Без расценки» — выделяем ВСЮ карточку,
            // строки внутри без отдельных обводок. Просрочка → красноватая рамка.
            border: '1px solid',
            borderColor: overdueCount > 0 ? '#ffcdd2' : '#ffe0b2',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <LocalFireDepartmentIcon color="error" />
            <Typography variant="subtitle1" fontWeight={700}>
              Горит на неделе • просрочено: {overdueCount}
            </Typography>
          </Stack>
          <Stack spacing={0.5}>
            {data.hotProjects.map(p => {
              const d = daysLeft(p.endDate);
              const openProject = () =>
                navigate(`/objects/${p.objectId}/projects/${p.id}/materials`);
              return (
                <Box
                  key={p.id}
                  onClick={openProject}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openProject();
                    }
                  }}
                  sx={{
                    p: 0.75,
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(25,118,210,0.06)' },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600} noWrap sx={{ flexGrow: 1 }}>{p.name}</Typography>
                    <Chip
                      size="small"
                      color={d < 0 ? 'error' : d < 7 ? 'warning' : 'success'}
                      variant="outlined"
                      label={d < 0 ? `Просрочено ${Math.abs(d)} дн` : `${d} дн`}
                    />
                    <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">{p.objectName}</Typography>
                </Box>
              );
            })}
          </Stack>
        </Paper>
      )}

      {/* ─── 3. НЕДЕЛЯ ПРОРАБА (Пн→Вс) ─── */}
      <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Неделя прораба 🔥 {data.kpi.fixesWeekCount} {plural(data.kpi.fixesWeekCount, 'фиксация', 'фиксации', 'фиксаций')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {weekRange(data.weekChart.map(w => w.day))} • Пн → Вс
          </Typography>
        </Box>
        {data.kpi.fixesWeekCount === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            На этой неделе фиксаций пока нет — они появятся здесь, как только вы зафиксируете объём на смете.
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 0.5, height: 90 }}>
          {data.weekChart.map(w => {
            const isToday = w.day === todayIso;
            return (
              <Box key={w.day} sx={{ textAlign: 'center', flexGrow: 1 }}>
                <Box
                  sx={{
                    height: w.count > 0 ? Math.max((w.count / maxWeek) * 60, 22) : 4,
                    bgcolor: w.count > 0 ? (w.count === maxWeek ? '#ef6c00' : '#90caf9') : '#e0e0e0',
                    borderRadius: 1,
                    mb: 0.5,
                    // ⭐ №173: сегодняшний столбец выделяем кольцом
                    boxShadow: isToday ? '0 0 0 2px rgba(25,118,210,0.35)' : 'none',
                    // ⭐ №260: число — внутри столбика, по центру
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: w.count === maxWeek ? '#fff' : '#0d47a1',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {w.count > 0 ? w.count : ''}
                </Box>
                <Typography
                  variant="caption"
                  color={isToday ? 'primary' : 'text.secondary'}
                  fontWeight={isToday ? 700 : 400}
                >
                  {dayLabel(w.day)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* ─── 4. БЕЗ РАСЦЕНКИ ─── */}
      {noPriceCount > 0 && (
        <Paper sx={{ p: 2, borderRadius: 2, mb: 2, border: '1px solid #ffe0b2' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <WarningAmberIcon sx={{ fontSize: 20, color: '#ef6c00' }} />
            <Typography variant="subtitle1" fontWeight={700}>
              Без расценки • {noPriceCount}
            </Typography>
          </Box>
          <Stack spacing={0.5} sx={{ mb: 1 }}>
            {noPriceItems.map(m => (
              <Box
                key={m.id}
                onClick={() => navigate(`/objects/${m.project.objectId}/projects/${m.project.id}/materials?materialId=${m.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/objects/${m.project.objectId}/projects/${m.project.id}/materials?materialId=${m.id}`);
                  }
                }}
                sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1,
                  cursor: 'pointer', borderRadius: 1, px: 0.5, py: 0.25,
                  '&:hover': { bgcolor: 'rgba(25,118,210,0.06)' },
                }}
              >
                <Typography variant="body2">
                  • <b>{m.name}</b>{' '}
                  <Typography component="span" variant="caption" color="text.secondary">({m.project.name})</Typography>
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Chip
                    size="small" variant="outlined" color="warning"
                    label={m.unitPrice === 0 && m.materialUnitPrice === 0 ? 'нет цен' : m.materialUnitPrice === 0 ? 'нет материала' : 'нет работы'}
                  />
                  <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </Box>
              </Box>
            ))}
          </Stack>
          {noPriceCount > data.noPrice.items.length && (
            <>
              <Button
                size="small"
                variant="text"
                disabled={noPriceLoading}
                onClick={() => void toggleNoPrice()}
                sx={{ textTransform: 'none', color: '#1976d2', fontWeight: 600, p: 0.5, minWidth: 0 }}
              >
                {noPriceAll
                  ? 'Свернуть ↑'
                  : noPriceLoading
                    ? 'Загружаем…'
                    : `+ ещё ${noPriceCount - data.noPrice.items.length}… (показать все) →`}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Нажмите на позицию, чтобы открыть строку сметы.
              </Typography>
            </>
          )}
        </Paper>
      )}

      {/* ─── 5. ЛЕНТА ФИКСАЦИЙ ─── */}
      <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <EditIcon sx={{ fontSize: 20, color: '#1976d2' }} />
          <Typography variant="subtitle1" fontWeight={700}>Последние фиксации</Typography>
        </Stack>
        <Stack divider={<Divider />} spacing={1}>
          {data.recentFixes.map(f => (
            <Box
              key={f.id}
              onClick={() => navigate(`/objects/${f.material.project.object.id}/projects/${f.material.project.id}/materials`)}
              sx={{ cursor: 'pointer' }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight={600}>
                  {f.material.name} • +{f.amount}
                </Typography>
                <Typography variant="caption" color="text.secondary">{timeAgo(f.fixedAt)}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {f.material.project.name} • {f.material.project.object.name}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* ─── Быстрое действие ─── */}
      <Button
        variant="outlined"
        fullWidth
        startIcon={<HomeWorkIcon />}
        onClick={() => navigate('/objects')}
        sx={{ textTransform: 'none', mb: 2 }}
      >
        Открыть объекты
      </Button>

      {/* ⭐ №230: просмотр фото из ленты (удаление здесь не нужно — только просмотр) */}
      <PhotoViewerDialog
        photo={viewerPhoto}
        materialName={(viewerPhoto as PhotoFeedItem | null)?.materialName ?? null}
        objectName={(viewerPhoto as PhotoFeedItem | null)?.objectName ?? null}
        projectName={(viewerPhoto as PhotoFeedItem | null)?.projectName ?? null}
        objectId={(viewerPhoto as PhotoFeedItem | null)?.objectId ?? null}
        projectId={(viewerPhoto as PhotoFeedItem | null)?.projectId ?? null}
        materialId={(viewerPhoto as PhotoFeedItem | null)?.materialId ?? null}
        onClose={() => setViewerPhoto(null)}
      />

      {/* ⭐ №256: все доступные фото — галерея по клику на «Все фото · N» */}
      <PhotoFeedGalleryDialog
        open={photoLibraryOpen}
        onClose={() => setPhotoLibraryOpen(false)}
      />
    </Box>
  );
};

export default Home;