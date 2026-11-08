import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Stack, LinearProgress, Chip, Button,
  CircularProgress, Alert, Divider,
} from '@mui/material';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useAuth } from '../contexts/AuthContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import { fetchDashboardSummary } from '../services/dashboardService';
import type { DashboardSummary } from '../services/dashboardService';
import { fetchPhotoBlob, fetchRecentPhotos } from '../services/photoService'; // ⭐ №230
import type { MaterialPhotoData, PhotoFeedItem } from '../services/photoService';
import PhotoViewerDialog from '../components/PhotoViewerDialog'; // ⭐ №230
import { parseDecimal } from '../utils/decimal'; // 🔒 P1-3: бэкенд отдаёт Decimal строкой

// 🔒 Шаг 103 (P1-3): принимаем number | string — Decimal с бэкенда приходит строкой
const fmtMoney = (v: number | string) =>
  Math.round(parseDecimal(v)).toLocaleString('ru-RU');
const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
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
  const [viewerPhoto, setViewerPhoto] = useState<MaterialPhotoData | null>(null);
  const feedUrlsRef = useRef<Record<number, string>>({});

  useMobileHeader({ title: 'Главная' });

  // Лента не критична для Главной: ошибки глотаем, дашборд показываем в любом случае
  const loadFeed = async () => {
    try {
      const list = await fetchRecentPhotos(12);
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
    }
  };

  const load = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [summary] = await Promise.all([fetchDashboardSummary(), loadFeed()]);
      setData(summary);
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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ textAlign: 'center', my: 1.5, justifyContent: 'space-around' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Смета</Typography>
            <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {fmtMoney(data.money.estimate)} ₽
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Факт</Typography>
            <Typography variant="h6" fontWeight={700} color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {fmtMoney(data.money.actual)} ₽
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Факт vs смета</Typography>
            {/* ⭐ №225: деньги показываем только сравнением факта со сметой */}
            <Typography
              variant="h6"
              fontWeight={700}
              color={moneyOverBudget ? 'error.main' : 'success.main'}
              sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}
            >
              {moneyOverBudget
                ? `Факт больше сметы на ${fmtMoney(moneyDiff)} ₽${data.money.overPercent != null ? ` (${data.money.overPercent} %)` : ''}`
                : 'В пределах сметы'}
            </Typography>
          </Box>
        </Stack>
        {/* ⭐ №225: прогресс ОБЪЁМОВ — не деньги, красным не красим */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Объём работ</Typography>
          <Typography variant="caption" fontWeight={600}>{volumePercentRaw} %</Typography>
          {volumeOverrun !== null && (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={`Объём перевыполнен на ${volumeOverrun} %`}
              sx={{ fontWeight: 600 }}
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
        <Button
          size="small"
          variant="text"
          onClick={(e) => {
            e.stopPropagation();
            navigate('/analytics');
          }}
          sx={{ mt: 1, textTransform: 'none', color: '#1976d2', fontWeight: 600, alignSelf: 'flex-end' }}
        >
          Подробнее в Аналитике →
        </Button>
      </Paper>

      {/* ⭐ №230: последние фото по объектам — горизонтальная лента */}
      {feedPhotos.length > 0 && (
        <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>Фото с объектов</Typography>
            <Typography variant="caption" color="text.secondary">последние {feedPhotos.length}</Typography>
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
                title={p.comment || p.materialName}
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
                    alt={p.comment || p.materialName}
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
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <LocalFireDepartmentIcon color="error" />
            <Typography variant="subtitle1" fontWeight={700}>
              Горит на неделе • просрочено: {overdueCount}
            </Typography>
          </Stack>
          <Stack spacing={1}>
            {data.hotProjects.map(p => {
              const d = daysLeft(p.endDate);
              return (
                <Paper
                  key={p.id}
                  onClick={() => navigate(`/objects/${p.objectId}/projects/${p.id}/materials`)}
                  sx={{
                    p: 1.5, borderRadius: 2, cursor: 'pointer',
                    border: '1px solid',
                    borderColor: d < 0 ? 'error.main' : d < 7 ? 'warning.main' : 'transparent',
                    '&:hover': { bgcolor: '#f5f9ff' },
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
                  </Box>
                  <Typography variant="caption" color="text.secondary">{p.objectName}</Typography>
                </Paper>
              );
            })}
          </Stack>
        </Box>
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
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: isToday ? 'primary.main' : 'inherit' }}>
                  {w.count > 0 ? w.count : ''}
                </Typography>
                <Box
                  sx={{
                    height: Math.max((w.count / maxWeek) * 60, 4),
                    bgcolor: w.count > 0 ? (w.count === maxWeek ? '#ef6c00' : '#90caf9') : '#e0e0e0',
                    borderRadius: 1,
                    mb: 0.5,
                    // ⭐ №173: сегодняшний столбец выделяем кольцом
                    boxShadow: isToday ? '0 0 0 2px rgba(25,118,210,0.35)' : 'none',
                  }}
                />
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
      {data.noPrice.count > 0 && (
        <Paper sx={{ p: 2, borderRadius: 2, mb: 2, border: '1px solid #ffe0b2' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <WarningAmberIcon sx={{ fontSize: 20, color: '#ef6c00' }} />
            <Typography variant="subtitle1" fontWeight={700}>
              Без расценки — смета занижена • {data.noPrice.count}
            </Typography>
          </Box>
          <Stack spacing={0.5} sx={{ mb: 1 }}>
            {data.noPrice.items.map(m => (
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
            {data.noPrice.count > data.noPrice.items.length && (
            <Typography variant="caption" color="text.secondary">
              + ещё {data.noPrice.count - data.noPrice.items.length}… Нажмите на позицию, чтобы открыть строку сметы.
            </Typography>
          )}
        </Paper>
      )}

      {/* ─── 5. ЛЕНТА ФИКСАЦИЙ ─── */}
      <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Последние фиксации</Typography>
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
        variant="contained"
        startIcon={<HomeWorkIcon />}
        onClick={() => navigate('/objects')}
        sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' }, mb: 2 }}
      >
        Открыть объекты
      </Button>

      {/* ⭐ №230: просмотр фото из ленты (удаление здесь не нужно — только просмотр) */}
      <PhotoViewerDialog photo={viewerPhoto} onClose={() => setViewerPhoto(null)} />
    </Box>
  );
};

export default Home;