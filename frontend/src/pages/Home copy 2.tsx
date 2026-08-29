import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Stack, LinearProgress, Chip, Button,
  CircularProgress, Alert, Divider, Grid, alpha, useTheme,
} from '@mui/material';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useAuth } from '../contexts/AuthContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import { fetchDashboardSummary } from '../services/dashboardService';
import type { DashboardSummary } from '../services/dashboardService';

const fmtMoney = (v: number) => Math.round(v).toLocaleString('ru-RU');
const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const dayLabel = (iso: string) => DAY_LABELS[new Date(iso).getDay()];
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

const Home: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { token } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useMobileHeader({ title: 'Главная' });

  const load = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setData(await fetchDashboardSummary(token));
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 10, gap: 2 }}>
        <CircularProgress size={48} thickness={4} />
        <Typography variant="body2" color="text.secondary">Загрузка сводки…</Typography>
      </Box>
    );
  }
  if (error || !data) {
    return (
      <Stack spacing={2} sx={{ mt: 2 }}>
        <Alert severity="error">{error || 'Нет данных'}</Alert>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load}>Повторить</Button>
      </Stack>
    );
  }

  const percent = Math.round(data.money.percent * 100);
  const maxWeek = Math.max(...data.weekChart.map(w => w.count), 1);
  const overdueCount = data.hotProjects.filter(p => daysLeft(p.endDate) < 0).length;
  const todayIndex = new Date().getDay();

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
      {/* ═══════════════════════════════════════════════
          1. HERO: ДЕНЬГИ — Градиентная карточка
         ═══════════════════════════════════════════════ */}
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 3,
          mb: 3,
          background: 'linear-gradient(135deg, #1e88e5 0%, #1565c0 50%, #0d47a1 100%)',
          color: '#fff',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -80, right: -80,
            width: 260, height: 260,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -60, left: -60,
            width: 180, height: 180,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          },
        }}
      >
        <Box sx={{ position: 'relative', p: { xs: 2.5, md: 3.5 } }}>
          {/* Заголовок */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <AccountBalanceWalletIcon sx={{ fontSize: 24 }} />
            <Typography variant="h6" fontWeight={800} letterSpacing="-0.3px">
              Деньги по всем объектам
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.85, mb: 3 }}>
            В работе: {data.kpi.projectsCount} проектов · {data.kpi.objectsCount} объекта · {data.kpi.materialsCount} позиций
          </Typography>

          {/* Три метрики */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Box sx={{
                bgcolor: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                p: 1.5,
                backdropFilter: 'blur(10px)',
              }}>
                <Typography variant="caption" sx={{ opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Смета
                </Typography>
                <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: '1.3rem', sm: '1.5rem' } }}>
                  {fmtMoney(data.money.estimate)} ₽
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{
                bgcolor: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                p: 1.5,
                backdropFilter: 'blur(10px)',
              }}>
                <Typography variant="caption" sx={{ opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Факт
                </Typography>
                <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: '1.3rem', sm: '1.5rem' } }}>
                  {fmtMoney(data.money.actual)} ₽
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{
                bgcolor: percent >= 100 ? 'rgba(76,175,80,0.25)' : 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                p: 1.5,
                backdropFilter: 'blur(10px)',
              }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <TrendingUpIcon sx={{ fontSize: 16, opacity: 0.8 }} />
                  <Typography variant="caption" sx={{ opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Освоено
                  </Typography>
                </Stack>
                <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: '1.3rem', sm: '1.5rem' } }}>
                  {percent}%
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Прогресс-бар */}
          <Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>Прогресс освоения бюджета</Typography>
              <Typography variant="caption" fontWeight={700}>{percent}%</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(percent, 100)}
              sx={{
                height: 10,
                borderRadius: 5,
                bgcolor: 'rgba(255,255,255,0.2)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 5,
                  background: percent >= 100
                    ? 'linear-gradient(90deg, #4caf50, #81c784)'
                    : 'linear-gradient(90deg, #64b5f6, #bbdefb)',
                },
              }}
            />
          </Box>
        </Box>
      </Paper>

      {/* ═══════════════════════════════════════════════
          2. Сетка: Горит + Неделя
         ═══════════════════════════════════════════════ */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Горит на неделе */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 0,
              borderRadius: 3,
              height: '100%',
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
            }}
          >
            {/* Заголовок с градиентом */}
            <Box sx={{
              background: 'linear-gradient(135deg, #ff5722 0%, #e64a19 100%)',
              color: '#fff',
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <LocalFireDepartmentIcon />
                <Typography variant="subtitle1" fontWeight={700}>Горит на неделе</Typography>
              </Stack>
              {overdueCount > 0 && (
                <Chip
                  size="small"
                  label={`Просрочено: ${overdueCount}`}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.25)',
                    color: '#fff',
                    fontWeight: 700,
                  }}
                />
              )}
            </Box>

            {/* Список проектов */}
            <Box sx={{ p: 1.5 }}>
              {data.hotProjects.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Всё под контролем 🎉
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1}>
                  {data.hotProjects.map(p => {
                    const d = daysLeft(p.endDate);
                    const isOverdue = d < 0;
                    const isUrgent = d >= 0 && d < 7;
                    return (
                      <Box
                        key={p.id}
                        onClick={() => navigate(`/objects/${p.objectId}/projects/${p.id}/materials`)}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          cursor: 'pointer',
                          bgcolor: isOverdue
                            ? alpha(theme.palette.error.main, 0.06)
                            : isUrgent
                              ? alpha(theme.palette.warning.main, 0.06)
                              : 'background.paper',
                          border: '1px solid',
                          borderColor: isOverdue
                            ? alpha(theme.palette.error.main, 0.3)
                            : isUrgent
                              ? alpha(theme.palette.warning.main, 0.3)
                              : 'divider',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: theme.shadows[4],
                            borderColor: isOverdue
                              ? theme.palette.error.main
                              : isUrgent
                                ? theme.palette.warning.main
                                : theme.palette.primary.main,
                          },
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Typography variant="body2" fontWeight={700} noWrap>
                              {p.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {p.objectName}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            color={isOverdue ? 'error' : isUrgent ? 'warning' : 'success'}
                            label={isOverdue ? `−${Math.abs(d)} дн` : `${d} дн`}
                            sx={{
                              fontWeight: 700,
                              flexShrink: 0,
                              minWidth: 60,
                            }}
                          />
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Неделя прораба */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              height: '100%',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{
                  width: 36, height: 36, borderRadius: 1.5,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ScheduleIcon color="primary" />
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>Неделя прораба</Typography>
                  <Typography variant="caption" color="text.secondary">За последние 7 дней</Typography>
                </Box>
              </Stack>
              <Chip
                icon={<LocalFireDepartmentIcon sx={{ fontSize: 16 }} />}
                label={`${data.kpi.fixesLast7dCount} фиксаций`}
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 700 }}
              />
            </Stack>

            {/* График-столбцы */}
            <Box sx={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 1,
              height: 140,
              pt: 2,
            }}>
              {data.weekChart.map(w => {
                const isToday = dayLabel(w.day) === DAY_LABELS[todayIndex];
                const isMax = w.count === maxWeek && w.count > 0;
                const height = Math.max((w.count / maxWeek) * 100, 6);
                return (
                  <Box key={w.day} sx={{ textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" fontWeight={700} sx={{ color: isMax ? 'primary.main' : 'text.primary' }}>
                      {w.count > 0 ? w.count : ''}
                    </Typography>
                    <Box sx={{
                      width: '100%',
                      maxWidth: 36,
                      height,
                      borderRadius: '8px 8px 4px 4px',
                      background: w.count === 0
                        ? alpha('#000', 0.06)
                        : isMax
                          ? 'linear-gradient(180deg, #ef6c00 0%, #e65100 100%)'
                          : isToday
                            ? 'linear-gradient(180deg, #42a5f5 0%, #1976d2 100%)'
                            : 'linear-gradient(180deg, #90caf9 0%, #64b5f6 100%)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'scaleY(1.05)',
                        filter: 'brightness(1.1)',
                      },
                    }} />
                    <Typography
                      variant="caption"
                      fontWeight={isToday ? 800 : 500}
                      sx={{
                        color: isToday ? 'primary.main' : 'text.secondary',
                        borderBottom: isToday ? '2px solid' : 'none',
                        borderColor: 'primary.main',
                        pb: 0.25,
                      }}
                    >
                      {dayLabel(w.day)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* ═══════════════════════════════════════════════
          3. Без расценки + Последние фиксации
         ═══════════════════════════════════════════════ */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Без расценки */}
        {data.noPrice.count > 0 && (
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 0,
                borderRadius: 3,
                height: '100%',
                border: '1px solid',
                borderColor: alpha('#ef6c00', 0.3),
                overflow: 'hidden',
                bgcolor: alpha('#fff3e0', 0.4),
              }}
            >
              <Box sx={{
                p: 2,
                background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <WarningAmberIcon />
                  <Typography variant="subtitle1" fontWeight={700}>Без расценки</Typography>
                </Stack>
                <Chip
                  size="small"
                  label={data.noPrice.count}
                  sx={{ bgcolor: 'rgba(255,255,255,0.3)', color: '#fff', fontWeight: 800 }}
                />
              </Box>
              <Box sx={{ p: 1.5 }}>
                <Stack spacing={0.5}>
                  {data.noPrice.items.map(m => (
                    <Box
                      key={m.id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        borderRadius: 1,
                        '&:hover': { bgcolor: alpha('#ef6c00', 0.06) },
                      }}
                    >
                      <Typography variant="body2" sx={{ minWidth: 0 }}>
                        <b>{m.name}</b>{' '}
                        <Typography component="span" variant="caption" color="text.secondary">
                          ({m.project.name})
                        </Typography>
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        color="warning"
                        label={m.unitPrice === 0 && m.materialUnitPrice === 0 ? 'нет цен' : m.materialUnitPrice === 0 ? 'нет материала' : 'нет работы'}
                        sx={{ flexShrink: 0, fontWeight: 600 }}
                      />
                    </Box>
                  ))}
                </Stack>
                {data.noPrice.count > data.noPrice.items.length && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                    + ещё {data.noPrice.count - data.noPrice.items.length}…
                  </Typography>
                )}
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Последние фиксации */}
        <Grid item xs={12} md={data.noPrice.count > 0 ? 6 : 12}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              height: '100%',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Последние фиксации</Typography>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/objects')}
                sx={{ textTransform: 'none' }}
              >
                Все
              </Button>
            </Stack>
            <Stack divider={<Divider />} spacing={0}>
              {data.recentFixes.map(f => (
                <Box
                  key={f.id}
                  onClick={() => navigate(`/objects/${f.material.project.object.id}/projects/${f.material.project.id}/materials`)}
                  sx={{
                    cursor: 'pointer',
                    py: 1.5,
                    px: 1,
                    borderRadius: 1,
                    transition: 'background 0.2s',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {f.material.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {f.material.project.name} · {f.material.project.object.name}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                      <Chip
                        size="small"
                        label={`+${f.amount}`}
                        color="success"
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {timeAgo(f.fixedAt)}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* ═══════════════════════════════════════════════
          4. Быстрые действия
         ═══════════════════════════════════════════════ */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<HomeWorkIcon />}
          onClick={() => navigate('/objects')}
          sx={{
            bgcolor: '#4caf50',
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 2,
            px: 3,
            '&:hover': { bgcolor: '#388e3c', transform: 'translateY(-2px)' },
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
          }}
        >
          Открыть объекты
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<RefreshIcon />}
          onClick={load}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 2,
            px: 3,
            borderColor: 'divider',
            '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.04) },
          }}
        >
          Обновить
        </Button>
      </Box>
    </Box>
  );
};

export default Home;
