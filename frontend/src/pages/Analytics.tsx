import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Stack, CircularProgress, Alert, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, FormControl, InputLabel,
  Select, MenuItem, useMediaQuery, useTheme,
} from '@mui/material';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import {
  fetchAnalyticsSummary, fetchBudgetVsActual, fetchMonthlyTrend, fetchTopOverrun,
} from '../services/analyticsService';
import type {
  AnalyticsSummary, BudgetVsActualItem, MonthlyTrendItem, TopOverrunItem,
} from '../services/analyticsService';
import { fetchObjects } from '../services/objectService';
import type { ObjectData } from '../services/objectService';
import { getApiErrorMessage } from '../utils/errors';

const fmtMoney = (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
const shortName = (name: string, max: number) =>
  name.length > max ? name.slice(0, max - 1) + '…' : name;

const Analytics: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { token } = useAuth();

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [budgetVsActual, setBudgetVsActual] = useState<BudgetVsActualItem[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendItem[]>([]);
  const [topOverrun, setTopOverrun] = useState<TopOverrunItem[]>([]);
  const [objects, setObjects] = useState<ObjectData[]>([]);
  const [objectFilter, setObjectFilter] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useMobileHeader({ title: 'Аналитика', onBack: () => navigate(-1) });

  const loadObjects = useCallback(async () => {
    try {
      setObjects(await fetchObjects());
    } catch {
      /* объекты не критичны */
    }
  }, []);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [s, bva, mt, to] = await Promise.all([
        fetchAnalyticsSummary(),
        fetchBudgetVsActual(objectFilter === '' ? undefined : objectFilter),
        fetchMonthlyTrend(),
        fetchTopOverrun(),
      ]);
      setSummary(s);
      setBudgetVsActual(bva);
      setMonthlyTrend(mt);
      setTopOverrun(to);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось загрузить аналитику'));
    } finally {
      setLoading(false);
    }
  }, [token, objectFilter]);

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAll]);

  const summaryCards = summary
    ? [
        { label: 'Общий бюджет', value: `${fmtMoney(summary.totalBudget)} ₽`, color: '#1976d2' },
        { label: 'Потрачено', value: `${fmtMoney(summary.totalSpent)} ₽`, color: '#ef6c00' },
        { label: 'На складе', value: `${fmtMoney(summary.totalWarehouseValue)} ₽`, color: '#2e7d32' },
        { label: 'Перерасход', value: `${summary.overrunCount} / ${summary.totalProjects}`, color: '#d32f2f' },
      ]
    : [];

  const bvaData = budgetVsActual.map((d) => ({
    name: shortName(d.projectName, isMobile ? 12 : 20),
    Бюджет: d.budget,
    Факт: d.actual,
    over: d.status === 'over',
  }));

  const trendData = monthlyTrend.map((m) => ({
    name: `${m.month.slice(5)}.${m.month.slice(0, 4)}`,
    Потрачено: m.spent,
  }));

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', width: '100%' }}>
      <Stack spacing={2}>
        <FormControl size="small" sx={{ minWidth: 200, alignSelf: 'flex-start' }}>
          <InputLabel>Объект</InputLabel>
          <Select
            value={objectFilter}
            label="Объект"
            onChange={(e) => setObjectFilter(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <MenuItem value="">Все объекты</MenuItem>
            {objects.map((o) => (
              <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          {summaryCards.map((c) => (
            <Paper key={c.label} sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">{c.label}</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: c.color }}>{c.value}</Typography>
            </Paper>
          ))}
        </Box>

        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Бюджет vs Факт</Typography>
          {bvaData.length === 0 ? (
            <Typography color="text.secondary">Нет данных по проектам.</Typography>
          ) : (
            <ResponsiveContainer width="100%" height={isMobile ? 340 : 280}>
              <BarChart
                data={bvaData}
                layout={isMobile ? 'vertical' : 'horizontal'}
                margin={isMobile ? { left: 8, right: 8 } : undefined}
              >
                <CartesianGrid strokeDasharray="3 3" />
                {isMobile ? (
                  <>
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="name" width={110} fontSize={11} />
                  </>
                ) : (
                  <>
                    <XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis fontSize={11} />
                  </>
                )}
                <RechartsTooltip formatter={(v) => `${fmtMoney(Number(v))} ₽`} />
                <Bar dataKey="Бюджет" fill="#1976d2" />
                <Bar dataKey="Факт">
                  {bvaData.map((d, i) => (
                    <Cell key={i} fill={d.over ? '#d32f2f' : '#4caf50'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Paper>

        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Динамика расходов (6 месяцев)</Typography>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <RechartsTooltip formatter={(v) => `${fmtMoney(Number(v))} ₽`} />
              <Area type="monotone" dataKey="Потрачено" stroke="#1976d2" fill="#1976d2" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </Paper>

        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Топ-5 перерасходов</Typography>
          {topOverrun.length === 0 ? (
            <Typography color="text.secondary">Перерасходов нет 🎉</Typography>
          ) : isMobile ? (
            <Stack spacing={1}>
              {topOverrun.map((t) => (
                <Paper
                  key={t.projectName}
                  variant="outlined"
                  sx={{ p: 1.5, borderRadius: 2, bgcolor: t.percent > 50 ? 'error.light' : 'transparent' }}
                >
                  <Typography variant="body2" fontWeight={600}>{t.projectName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Бюджет {fmtMoney(t.budget)} ₽ • Факт {fmtMoney(t.actual)} ₽ • +{fmtMoney(t.overrun)} ₽ ({t.percent}%)
                  </Typography>
                </Paper>
              ))}
            </Stack>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Проект</TableCell>
                    <TableCell align="right">Бюджет</TableCell>
                    <TableCell align="right">Факт</TableCell>
                    <TableCell align="right">Перерасход</TableCell>
                    <TableCell align="right">%</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topOverrun.map((t) => (
                    <TableRow key={t.projectName} sx={{ bgcolor: t.percent > 50 ? 'error.light' : 'transparent' }}>
                      <TableCell>{t.projectName}</TableCell>
                      <TableCell align="right">{fmtMoney(t.budget)} ₽</TableCell>
                      <TableCell align="right">{fmtMoney(t.actual)} ₽</TableCell>
                      <TableCell align="right" sx={{ color: '#d32f2f', fontWeight: 600 }}>+{fmtMoney(t.overrun)} ₽</TableCell>
                      <TableCell align="right" sx={{ color: '#d32f2f', fontWeight: 600 }}>{t.percent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}

export default Analytics;