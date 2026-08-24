import React from 'react';
import { Box, Typography, Paper, Stack, LinearProgress, Chip, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import DescriptionIcon from '@mui/icons-material/Description';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EventIcon from '@mui/icons-material/Event';
import AddIcon from '@mui/icons-material/Add';

// ============================================================
// ⚠️ MOCK-ДАННЫЕ (захардкожены для визуализации)
// Завтра заменим на реальный GET /dashboard/summary (после мульти-тенантности)
// ============================================================
const MOCK = {
  kpi: {
    objects: 3,
    projectsActive: 5,
    projectsOverdue: 1,
    positions: 147,
    fixesWeek: 34,
    totalEstimate: 4250000,
    totalFact: 2180000,
  },
  week: [
    { day: 'Пн', count: 4 },
    { day: 'Вт', count: 7 },
    { day: 'Ср', count: 3 },
    { day: 'Чт', count: 8 },
    { day: 'Пт', count: 6 },
    { day: 'Сб', count: 4 },
    { day: 'Вс', count: 2 },
  ],
  deadlines: [
    { id: 1, project: 'Штукатурные работы', object: 'Склад 300×800', days: 3, progress: 78 },
    { id: 2, project: 'Электрика', object: 'Квартира на Ленина', days: 6, progress: 45 },
  ],
  overdue: [
    { id: 3, project: 'Стяжка', object: 'Склад 300×800', days: -2, progress: 91 },
  ],
  noPrice: [
    { id: 10, name: 'Грунтовка глубокого проникновения', project: 'Электрика' },
    { id: 11, name: 'Маячок 6мм', project: 'Штукатурные работы' },
  ],
  feed: [
    { id: 1, text: 'Штукатурка стен — +12 м²', project: 'Склад • Штукатурные работы', time: '25 мин назад' },
    { id: 2, text: 'Цемент М500 — +8 мешков', project: 'Склад • Стяжка', time: '2 ч назад' },
    { id: 3, text: 'Проводка — +30 м', project: 'Квартира • Электрика', time: 'вчера' },
  ],
};

const fmtMoney = (v: number) => v.toLocaleString('ru-RU');

const Home: React.FC = () => {
  const navigate = useNavigate();

  // Мобильный хэдер v2
  useMobileHeader({ title: 'Главная' });

  const { kpi } = MOCK;
  const percent = Math.round((kpi.totalFact / kpi.totalEstimate) * 100);
  const maxWeek = Math.max(...MOCK.week.map(w => w.count));

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {/* Приветствие */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
        Привет, прораб! 👋
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
        {' '}• вот что происходит на твоих объектах
      </Typography>

      {/* Баннер демо-данных */}
      <Paper sx={{ p: 1.5, mb: 2, bgcolor: '#fff8e1', border: '1px dashed #f9a825', borderRadius: 2 }}>
        <Typography variant="body2" color="#8d6e00">
          🧪 Это заглушка: цифры демонстрационные. Реальная агрегация приедет после мульти-тенантности.
        </Typography>
      </Paper>

      {/* KPI-карточки */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, overflowX: 'auto' }}>
        	
<Paper sx={{ p: 1.5, borderRadius: 2, borderLeft: '4px solid #1976d2', minWidth: 140, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <HomeWorkIcon sx={{ fontSize: 18, color: '#1976d2' }} />
            <Typography variant="caption" color="text.secondary">Объекты</Typography>
          </Box>
          <Typography variant="h5" fontWeight={700}>{kpi.objects}</Typography>
        </Paper>
        	
<Paper sx={{ p: 1.5, borderRadius: 2, borderLeft: '4px solid #2e7d32', minWidth: 140, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <DescriptionIcon sx={{ fontSize: 18, color: '#2e7d32' }} />
            <Typography variant="caption" color="text.secondary">Проекты в работе</Typography>
          </Box>
          <Typography variant="h5" fontWeight={700}>{kpi.projectsActive}</Typography>
          {kpi.projectsOverdue > 0 && (
            <Typography variant="caption" color="error">просрочено: {kpi.projectsOverdue}</Typography>
          )}
        </Paper>
        <Paper sx={{ p: 1.5, borderRadius: 2, borderLeft: '4px solid #7b1fa2', minWidth: 140, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <ReceiptLongIcon sx={{ fontSize: 18, color: '#7b1fa2' }} />
            <Typography variant="caption" color="text.secondary">Позиций в сметах</Typography>
          </Box>
          <Typography variant="h5" fontWeight={700}>{kpi.positions}</Typography>
        </Paper>
        <Paper sx={{ p: 1.5, borderRadius: 2, borderLeft: '4px solid #ef6c00', minWidth: 140, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <LocalFireDepartmentIcon sx={{ fontSize: 18, color: '#ef6c00' }} />
            <Typography variant="caption" color="text.secondary">Фиксаций за 7 дней</Typography>
          </Box>
          <Typography variant="h5" fontWeight={700}>{kpi.fixesWeek}</Typography>
        </Paper>
      </Stack>

      {/* Деньги: смета / факт */}
      <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <AccountBalanceWalletIcon sx={{ fontSize: 20, color: '#1976d2' }} />
          <Typography variant="subtitle1" fontWeight={700}>Деньги по всем объектам</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ textAlign: 'center', mb: 1.5, justifyContent: 'space-around' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Смета</Typography>
            <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>{fmtMoney(kpi.totalEstimate)} ₽</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Факт</Typography>
            <Typography variant="h6" fontWeight={700} color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>{fmtMoney(kpi.totalFact)} ₽</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Освоено</Typography>
            <Typography variant="h6" fontWeight={700} color={percent >= 100 ? 'success.main' : 'primary'} sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>{percent}%</Typography>
          </Box>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={Math.min(percent, 100)}
          sx={{
            height: 10, borderRadius: 5, bgcolor: '#e0e0e0',
            '& .MuiLinearProgress-bar': { backgroundColor: '#1976d2', borderRadius: 5 },
          }}
        />
      </Paper>

      {/* Неделя прораба */}
      <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Неделя прораба 🔥 {kpi.fixesWeek} фиксаций
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 0.5, height: 90 }}>
          {MOCK.week.map(d => (
            <Box key={d.day} sx={{ textAlign: 'center', flexGrow: 1 }}>
              <Box
                sx={{
                  height: Math.max((d.count / maxWeek) * 70, 6),
                  bgcolor: d.count === maxWeek ? '#ef6c00' : '#90caf9',
                  borderRadius: 1,
                  mb: 0.5,
                }}
              />
              <Typography variant="caption" color="text.secondary">{d.day}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Горит */}
      <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          ⏰ Горит на этой неделе
        </Typography>
        <Stack spacing={1}>
          {MOCK.overdue.map(p => (
            <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" color="error" label={`Просрочено ${Math.abs(p.days)} дн.`} />
              <Typography variant="body2" fontWeight={600}>{p.project}</Typography>
              <Typography variant="caption" color="text.secondary">• {p.object}</Typography>
            </Box>
          ))}
          {MOCK.deadlines.map(p => (
            <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" color="warning" icon={<EventIcon />} label={`${p.days} дн.`} />
              <Typography variant="body2" fontWeight={600}>{p.project}</Typography>
              <Typography variant="caption" color="text.secondary">• {p.object} • {p.progress}%</Typography>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* Без расценки — смета занижена */}
      <Paper sx={{ p: 2, borderRadius: 2, mb: 2, border: '1px solid #ffe0b2' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <WarningAmberIcon sx={{ fontSize: 20, color: '#ef6c00' }} />
          <Typography variant="subtitle1" fontWeight={700}>Без расценки — смета занижена</Typography>
        </Box>
        <Stack spacing={0.5} sx={{ mb: 1 }}>
          {MOCK.noPrice.map(m => (
            <Typography key={m.id} variant="body2">
              • <b>{m.name}</b> <Typography component="span" variant="caption" color="text.secondary">({m.project})</Typography>
            </Typography>
          ))}
        </Stack>
        <Button size="small" variant="outlined" onClick={() => navigate('/objects')}>
          Открыть сметы
        </Button>
      </Paper>

      {/* Лента активности */}
      <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Последние фиксации</Typography>
        <Stack spacing={1}>
          {MOCK.feed.map(f => (
            <Box key={f.id}>
              <Typography variant="body2" fontWeight={600}>{f.text}</Typography>
              <Typography variant="caption" color="text.secondary">{f.project} • {f.time}</Typography>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* Быстрые действия */}
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => navigate('/objects')}
        sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' }, mb: 2 }}
      >
        Создать объект
      </Button>
    </Box>
  );
};

export default Home;