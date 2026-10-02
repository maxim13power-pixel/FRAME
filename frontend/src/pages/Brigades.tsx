import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, InputAdornment, Button, Modal, Stack,
  Fab, useMediaQuery, useTheme, CircularProgress, Alert, Chip, IconButton,
  MenuItem, Select, FormControl, InputLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, Tab,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupsIcon from '@mui/icons-material/Groups';
import PhoneIcon from '@mui/icons-material/Phone';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import { FAB_STYLE } from '../theme';
import {
  fetchBrigades, fetchBrigade, createBrigade, updateBrigade, deleteBrigade,
  addBrigadeMember, deleteBrigadeMember, fetchBrigadeShifts, logBrigadeShift,
  updateBrigadeShift, deleteBrigadeShift, fetchBrigadeStats,
} from '../services/brigadesService';
import type { BrigadeData, BrigadeShiftData, BrigadeStats } from '../services/brigadesService';
import { fetchObjects } from '../services/objectService';
import type { ObjectData } from '../services/objectService';
import { fetchProjectsByObject } from '../services/projectService';
import type { ProjectData } from '../services/projectService';
import { getApiErrorMessage } from '../utils/errors';
import { parseDecimal } from '../utils/decimal';

const fmtNum = (v: number | string) => parseDecimal(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const Brigades: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { token } = useAuth();

  const [brigades, setBrigades] = useState<BrigadeData[]>([]);
  const [objects, setObjects] = useState<ObjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [objectFilter, setObjectFilter] = useState<number | ''>('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedBrigade, setSelectedBrigade] = useState<BrigadeData | null>(null);
  const [tab, setTab] = useState<'members' | 'shifts' | 'stats'>('members');
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bName, setBName] = useState('');
  const [bSpecialty, setBSpecialty] = useState('');
  const [bForeman, setBForeman] = useState('');
  const [bPhone, setBPhone] = useState('');
  const [bObjectId, setBObjectId] = useState<number | ''>('');
  const [bComment, setBComment] = useState('');
  const [deletingBrigade, setDeletingBrigade] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // ─── Члены ───
  const [memberOpen, setMemberOpen] = useState(false);
  const [mFullName, setMFullName] = useState('');
  const [mRole, setMRole] = useState('');
  const [mPhone, setMPhone] = useState('');
  const [deletingMemberId, setDeletingMemberId] = useState<number | null>(null);

  // ─── Выходы ───
  const [shifts, setShifts] = useState<BrigadeShiftData[]>([]);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<BrigadeShiftData | null>(null);
  const [deletingShift, setDeletingShift] = useState<BrigadeShiftData | null>(null);
  const [sDate, setSDate] = useState(todayStr());
  const [sHours, setSHours] = useState('');
  const [sProjectId, setSProjectId] = useState<number | ''>('');
  const [sOutputValue, setSOutputValue] = useState('');
  const [sOutputArea, setSOutputArea] = useState('');
  const [sComment, setSComment] = useState('');
  const [sProjects, setSProjects] = useState<ProjectData[]>([]);
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [fProjectId, setFProjectId] = useState<number | ''>('');

  // ─── Статистика ───
  const [stats, setStats] = useState<BrigadeStats | null>(null);
  const [chartData, setChartData] = useState<{ name: string; Часы: number }[]>([]);

  useMobileHeader({ title: 'Бригады', onBack: () => { if (viewRef.current === 'detail') { setView('list'); setSelectedBrigade(null); } else { navigate(-1); } }, searchOpen: mobileSearchOpen, searchValue: searchQuery, searchPlaceholder: 'Поиск бригад...', onSearchOpen: () => setMobileSearchOpen(true), onSearchClose: () => { setSearchQuery(''); setMobileSearchOpen(false); }, onSearchChange: (v) => setSearchQuery(v) });

  const loadObjects = useCallback(async () => {
    try {
      setObjects(await fetchObjects());
    } catch {
      /* не критично */
    }
  }, []);

  const loadBrigades = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params: { objectId?: number; search?: string } = {};
      if (objectFilter !== '') params.objectId = objectFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      setBrigades(await fetchBrigades(params));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось загрузить бригады'));
    } finally {
      setLoading(false);
    }
  }, [token, objectFilter, searchQuery]);

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  useEffect(() => {
    loadBrigades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadBrigades]);

  const loadTabData = async (id: number) => {
    try {
      const [sh, st] = await Promise.all([
        fetchBrigadeShifts(id),
        fetchBrigadeStats(id),
      ]);
      setShifts(sh);
      setStats(st);
      const map = new Map<string, number>();
      sh.forEach((s) => map.set(s.date, (map.get(s.date) ?? 0) + s.hoursWorked));
      const arr: { name: string; Часы: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = daysAgoStr(i);
        arr.push({ name: `${d.slice(8)}.${d.slice(5, 7)}`, Часы: map.get(d) ?? 0 });
      }
      setChartData(arr);
    } catch {
      /* не критично */
    }
  };

  const loadProjectsForBrigade = async (objectId: number) => {
    try {
      setSProjects(await fetchProjectsByObject(objectId));
    } catch {
      setSProjects([]);
    }
  };

  const openDetail = async (b: BrigadeData) => {
    try {
      const d = await fetchBrigade(b.id);
      setSelectedBrigade(d);
      setView('detail');
      setTab('members');
      loadTabData(d.id);
      if (d.objectId != null) loadProjectsForBrigade(d.objectId);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось открыть бригаду'));
    }
  };

  // ─── CRUD бригады ───
  const openCreate = () => {
    setBName(''); setBSpecialty(''); setBForeman(''); setBPhone('');
    setBObjectId(objectFilter); setBComment(''); setFormError('');
    setCreateOpen(true);
  };

  const openEdit = (b: BrigadeData) => {
    setBName(b.name); setBSpecialty(b.specialty || ''); setBForeman(b.foremanName || '');
    setBPhone(b.phone || ''); setBObjectId(b.objectId ?? ''); setBComment(b.comment || '');
    setFormError(''); setEditOpen(true);
  };

  const handleCreate = async () => {
    if (!bName.trim()) {
      setFormError('Введите название бригады');
      return;
    }
    setSaving(true); setFormError('');
    try {
      await createBrigade({
        name: bName.trim(),
        specialty: bSpecialty || undefined,
        foremanName: bForeman || undefined,
        phone: bPhone || undefined,
        objectId: bObjectId === '' ? undefined : bObjectId,
        comment: bComment || undefined,
      });
      setCreateOpen(false);
      loadBrigades();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Не удалось создать бригаду'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedBrigade || !bName.trim()) {
      setFormError('Введите название бригады');
      return;
    }
    setSaving(true); setFormError('');
    try {
      await updateBrigade(selectedBrigade.id, {
        name: bName.trim(),
        specialty: bSpecialty || undefined,
        foremanName: bForeman || undefined,
        phone: bPhone || undefined,
        objectId: bObjectId === '' ? undefined : bObjectId,
        comment: bComment || undefined,
      });
      setEditOpen(false);
      setSelectedBrigade(await fetchBrigade(selectedBrigade.id));
      loadBrigades();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Не удалось сохранить'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBrigade = async () => {
    if (!selectedBrigade) return;
    try {
      await deleteBrigade(selectedBrigade.id);
      setDeletingBrigade(false);
      setSelectedBrigade(null);
      setView('list');
      loadBrigades();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось удалить бригаду'));
    }
  };

  // ─── Члены ───
  const handleAddMember = async () => {
    if (!selectedBrigade || !mFullName.trim()) {
      setFormError('Введите ФИО рабочего');
      return;
    }
    setSaving(true); setFormError('');
    try {
      await addBrigadeMember(selectedBrigade.id, {
        fullName: mFullName.trim(),
        role: mRole || undefined,
        phone: mPhone || undefined,
      });
      setMemberOpen(false);
      setMFullName(''); setMRole(''); setMPhone('');
      setSelectedBrigade(await fetchBrigade(selectedBrigade.id));
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Не удалось добавить рабочего'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!selectedBrigade || deletingMemberId == null) return;
    try {
      await deleteBrigadeMember(selectedBrigade.id, deletingMemberId);
      setDeletingMemberId(null);
      setSelectedBrigade(await fetchBrigade(selectedBrigade.id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось удалить рабочего'));
    }
  };

  // ─── Выходы ───
  const openShiftModal = async (shift?: BrigadeShiftData) => {
    setEditingShift(shift ?? null);
    setSDate(shift ? shift.date : todayStr());
    setSHours(shift ? String(shift.hoursWorked) : '');
    setSProjectId(shift?.projectId ?? '');
    setSOutputValue(shift?.outputValue != null ? String(shift.outputValue) : '');
    setSOutputArea(shift?.outputArea != null ? String(shift.outputArea) : '');
    setSComment(shift?.comment ?? '');
    setFormError('');
    setSProjects([]);
    if (selectedBrigade?.objectId != null) {
      try {
        setSProjects(await fetchProjectsByObject(selectedBrigade.objectId));
      } catch {
        setSProjects([]);
      }
    }
    setShiftOpen(true);
  };

  const handleSaveShift = async () => {
    if (!selectedBrigade) return;
    const hours = parseDecimal(sHours);
    if (hours <= 0 || hours > 24) {
      setFormError('Часы: от 0.5 до 24');
      return;
    }
    if (!sDate || sDate > todayStr()) {
      setFormError('Дата не может быть в будущем');
      return;
    }
    setSaving(true); setFormError('');
    try {
      const data = {
        date: sDate,
        hoursWorked: hours,
        outputValue: sOutputValue === '' ? undefined : parseDecimal(sOutputValue),
        outputArea: sOutputArea === '' ? undefined : parseDecimal(sOutputArea),
        projectId: sProjectId === '' ? undefined : sProjectId,
        comment: sComment || undefined,
      };
      if (editingShift) {
        await updateBrigadeShift(selectedBrigade.id, editingShift.id, data);
      } else {
        await logBrigadeShift(selectedBrigade.id, data);
      }
      setShiftOpen(false);
      loadTabData(selectedBrigade.id);
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Не удалось сохранить выход'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!selectedBrigade || !deletingShift) return;
    try {
      await deleteBrigadeShift(selectedBrigade.id, deletingShift.id);
      setDeletingShift(null);
      loadTabData(selectedBrigade.id);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось удалить выход'));
    }
  };

  const loadFilteredShifts = async () => {
    if (!selectedBrigade) return;
    try {
      setShifts(await fetchBrigadeShifts(selectedBrigade.id, {
        ...(fFrom ? { from: fFrom } : {}),
        ...(fTo ? { to: fTo } : {}),
        ...(fProjectId !== '' ? { projectId: fProjectId } : {}),
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось загрузить выходы'));
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {view === 'detail' && selectedBrigade ? (
        <>
          <Stack spacing={2}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <GroupsIcon sx={{ color: '#1976d2' }} />
                <Typography variant="h5" sx={{ flexGrow: 1 }}>{selectedBrigade.name}</Typography>
                {selectedBrigade.specialty && <Chip size="small" label={selectedBrigade.specialty} />}
                <IconButton size="small" onClick={() => openEdit(selectedBrigade)} sx={{ bgcolor: 'action.hover' }}>
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Бригадир: {selectedBrigade.foremanName || '—'}
                {selectedBrigade.phone && (
                  <>
                    {' • '}
                    <a href={`tel:${selectedBrigade.phone}`} style={{ color: '#1976d2' }}>
                      <PhoneIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} /> {selectedBrigade.phone}
                    </a>
                  </>
                )}
                {selectedBrigade.object ? ` • ${selectedBrigade.object.name}` : ' • Мобильная бригада'}
              </Typography>
            </Paper>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
              <Tab value="members" label="Состав" />
              <Tab value="shifts" label="Выходы" />
              <Tab value="stats" label="Статистика" />
            </Tabs>

            {tab === 'members' && (
              <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Состав бригады</Typography>
                  <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setMFullName(''); setMRole(''); setMPhone(''); setFormError(''); setMemberOpen(true); }}>
                    Добавить рабочего
                  </Button>
                </Box>
                {selectedBrigade.members && selectedBrigade.members.length > 0 ? (
                  <Stack spacing={0.5}>
                    {selectedBrigade.members.map((m) => (
                      <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                        <Typography variant="body2" sx={{ flexGrow: 1 }}>{m.fullName}</Typography>
                        {m.role && <Chip size="small" variant="outlined" label={m.role} />}
                        {m.phone && (
                          <a href={`tel:${m.phone}`} style={{ color: '#1976d2', textDecoration: 'none' }}>
                            <Typography variant="caption">{m.phone}</Typography>
                          </a>
                        )}
                        <IconButton size="small" color="error" onClick={() => setDeletingMemberId(m.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary">Рабочих пока нет.</Typography>
                )}
              </Paper>
            )}

            {tab === 'shifts' && (
              <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
                  <TextField size="small" type="date" label="С" InputLabelProps={{ shrink: true }} value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
                  <TextField size="small" type="date" label="По" InputLabelProps={{ shrink: true }} value={fTo} onChange={(e) => setFTo(e.target.value)} />
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Проект</InputLabel>
                    <Select value={fProjectId} label="Проект" onChange={(e) => setFProjectId(e.target.value === '' ? '' : Number(e.target.value))}>
                      <MenuItem value="">Все проекты</MenuItem>
                      {sProjects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Button size="small" variant="outlined" onClick={loadFilteredShifts}>Применить</Button>
                  <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => openShiftModal()} sx={{ ml: 'auto' }}>
                    Зафиксировать выход
                  </Button>
                </Box>
                {shifts.length === 0 ? (
                  <Typography color="text.secondary">Выходов пока нет.</Typography>
                ) : isMobile ? (
                  <Stack spacing={1}>
                    {shifts.map((s) => (
                      <Paper key={s.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
                            {s.date} • {fmtNum(s.hoursWorked)} ч
                          </Typography>
                          <IconButton size="small" onClick={() => openShiftModal(s)} sx={{ bgcolor: 'action.hover' }}>
                            <SettingsIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => setDeletingShift(s)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {s.project?.name || 'Без проекта'}
                          {s.outputValue != null ? ` • ${fmtNum(s.outputValue)} ₽` : ''}
                          {s.outputArea != null ? ` • ${fmtNum(s.outputArea)} м²` : ''}
                          {s.comment ? ` • ${s.comment}` : ''}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Дата</TableCell>
                          <TableCell align="right">Часы</TableCell>
                          <TableCell>Проект</TableCell>
                          <TableCell align="right">Выработка ₽</TableCell>
                          <TableCell align="right">м²</TableCell>
                          <TableCell align="center"></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {shifts.map((s) => (
                          <TableRow key={s.id} hover>
                            <TableCell>{s.date}</TableCell>
                            <TableCell align="right">{fmtNum(s.hoursWorked)}</TableCell>
                            <TableCell>{s.project?.name || '—'}</TableCell>
                            <TableCell align="right">{s.outputValue != null ? `${fmtNum(s.outputValue)} ₽` : '—'}</TableCell>
                            <TableCell align="right">{s.outputArea != null ? fmtNum(s.outputArea) : '—'}</TableCell>
                            <TableCell align="center">
                              <IconButton size="small" onClick={() => openShiftModal(s)} sx={{ bgcolor: 'action.hover' }}>
                                <SettingsIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={() => setDeletingShift(s)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            )}

            {tab === 'stats' && (
              <Stack spacing={2}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Всего часов</Typography>
                    <Typography variant="h6" fontWeight={700} color="#1976d2">{fmtNum(stats?.totalHours ?? 0)}</Typography>
                  </Paper>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Выработка ₽</Typography>
                    <Typography variant="h6" fontWeight={700} color="#2e7d32">{fmtNum(stats?.totalOutputValue ?? 0)}</Typography>
                  </Paper>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Всего м²</Typography>
                    <Typography variant="h6" fontWeight={700} color="#ef6c00">{fmtNum(stats?.totalOutputArea ?? 0)}</Typography>
                  </Paper>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Средние часы/смену</Typography>
                    <Typography variant="h6" fontWeight={700} color="#7b1fa2">{fmtNum(stats?.avgHoursPerShift ?? 0)}</Typography>
                  </Paper>
                </Box>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Часы по дням (30 дней)</Typography>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={10} interval={4} />
                      <YAxis fontSize={11} />
                      <RTooltip formatter={(v) => `${fmtNum(Number(v))} ч`} />
                      <Area type="monotone" dataKey="Часы" stroke="#1976d2" fill="#1976d2" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Paper>
              </Stack>
            )}
          </Stack>
        </>
      ) : (
        <>
          <Stack spacing={2}>
            {!isMobile && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  placeholder="Поиск бригад..."
                  variant="outlined"
                  size="small"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  sx={{ flexGrow: 1 }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
                />
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Объект</InputLabel>
                  <Select value={objectFilter} label="Объект" onChange={(e) => setObjectFilter(e.target.value === '' ? '' : Number(e.target.value))}>
                    <MenuItem value="">Все объекты</MenuItem>
                    {objects.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
            )}
            {isMobile && (
              <FormControl size="small" fullWidth>
                <InputLabel>Объект</InputLabel>
                <Select value={objectFilter} label="Объект" onChange={(e) => setObjectFilter(e.target.value === '' ? '' : Number(e.target.value))}>
                  <MenuItem value="">Все объекты</MenuItem>
                  {objects.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            {brigades.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">Бригад пока нет. Создайте первую бригаду.</Typography>
              </Paper>
            ) : isMobile ? (
              <Stack spacing={1}>
                {brigades.map((b) => (
                  <Paper key={b.id} sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer' }} onClick={() => openDetail(b)}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <GroupsIcon sx={{ color: '#1976d2', fontSize: 22 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>{b.name}</Typography>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(b); }} sx={{ bgcolor: 'action.hover' }}>
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {b.specialty || 'Без специализации'} • {b._count?.members ?? 0} чел.
                      {b.shifts && b.shifts.length > 0 ? ` • Последний выход: ${b.shifts[0].date}` : ''}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Название</TableCell>
                      <TableCell>Специальность</TableCell>
                      <TableCell>Бригадир</TableCell>
                      <TableCell align="center">Чел.</TableCell>
                      <TableCell>Последний выход</TableCell>
                      <TableCell align="center"></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {brigades.map((b) => (
                      <TableRow key={b.id} hover onClick={() => openDetail(b)} sx={{ cursor: 'pointer' }}>
                        <TableCell>{b.name}</TableCell>
                        <TableCell>{b.specialty || '—'}</TableCell>
                        <TableCell>{b.foremanName || '—'}</TableCell>
                        <TableCell align="center">{b._count?.members ?? 0}</TableCell>
                        <TableCell>{b.shifts && b.shifts.length > 0 ? b.shifts[0].date : '—'}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(b); }} sx={{ bgcolor: 'action.hover' }}>
                            <SettingsIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </>
      )}

      <Modal open={createOpen || editOpen} onClose={() => { setCreateOpen(false); setEditOpen(false); }}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 460 }, maxWidth: 460, p: 3, borderRadius: 2, outline: 'none', maxHeight: '90vh', overflowY: 'auto' }}>
          <Typography variant="h6" gutterBottom>{editOpen ? 'Редактировать бригаду' : 'Новая бригада'}</Typography>
          <Stack spacing={2}>
            <TextField fullWidth label="Название" value={bName} onChange={(e) => setBName(e.target.value)} required />
            <TextField fullWidth label="Специальность" value={bSpecialty} onChange={(e) => setBSpecialty(e.target.value)} />
            <Stack direction="row" spacing={2}>
              <TextField fullWidth label="Бригадир" value={bForeman} onChange={(e) => setBForeman(e.target.value)} />
              <TextField fullWidth label="Телефон" value={bPhone} onChange={(e) => setBPhone(e.target.value)} />
            </Stack>
            <FormControl fullWidth size="small">
              <InputLabel>Объект</InputLabel>
              <Select value={bObjectId} label="Объект" onChange={(e) => setBObjectId(e.target.value === '' ? '' : Number(e.target.value))}>
                <MenuItem value="">Мобильная бригада (без объекта)</MenuItem>
                {objects.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth label="Комментарий" multiline rows={2} value={bComment} onChange={(e) => setBComment(e.target.value)} />
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button variant="outlined" onClick={() => { setCreateOpen(false); setEditOpen(false); }}>Отмена</Button>
              <Button variant="contained" onClick={editOpen ? handleUpdate : handleCreate} disabled={saving}>Сохранить</Button>
              {editOpen && (
                <IconButton color="error" aria-label="Удалить бригаду" onClick={() => { setEditOpen(false); setDeletingBrigade(true); }}>
                  <DeleteIcon />
                </IconButton>
              )}
            </Stack>
          </Stack>
        </Paper>
      </Modal>

      <Modal open={memberOpen} onClose={() => setMemberOpen(false)}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 420 }, maxWidth: 420, p: 3, borderRadius: 2, outline: 'none' }}>
          <Typography variant="h6" gutterBottom>Добавить рабочего</Typography>
          <Stack spacing={2}>
            <TextField fullWidth label="ФИО" value={mFullName} onChange={(e) => setMFullName(e.target.value)} required />
            <TextField fullWidth label="Роль (бригадир/мастер/рабочий)" value={mRole} onChange={(e) => setMRole(e.target.value)} />
            <TextField fullWidth label="Телефон" value={mPhone} onChange={(e) => setMPhone(e.target.value)} />
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button variant="outlined" onClick={() => setMemberOpen(false)}>Отмена</Button>
              <Button variant="contained" onClick={handleAddMember} disabled={saving}>Добавить</Button>
            </Stack>
          </Stack>
        </Paper>
      </Modal>

      <Modal open={shiftOpen} onClose={() => setShiftOpen(false)}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 460 }, maxWidth: 460, p: 3, borderRadius: 2, outline: 'none', maxHeight: '90vh', overflowY: 'auto' }}>
          <Typography variant="h6" gutterBottom>{editingShift ? 'Редактировать выход' : 'Зафиксировать выход'}</Typography>
          <Stack spacing={2}>
            <TextField fullWidth type="date" label="Дата" InputLabelProps={{ shrink: true }} inputProps={{ max: todayStr() }} value={sDate} onChange={(e) => setSDate(e.target.value)} />
            <TextField fullWidth label="Часы (0.5–24)" type="number" inputProps={{ min: 0.5, max: 24, step: 0.5 }} value={sHours} onChange={(e) => setSHours(e.target.value)} />
            {selectedBrigade?.objectId != null && (
              <FormControl fullWidth size="small">
                <InputLabel>Проект</InputLabel>
                <Select value={sProjectId} label="Проект" onChange={(e) => setSProjectId(e.target.value === '' ? '' : Number(e.target.value))}>
                  <MenuItem value="">Без проекта</MenuItem>
                  {sProjects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <Stack direction="row" spacing={2}>
              <TextField fullWidth label="Выработка, ₽" type="number" value={sOutputValue} onChange={(e) => setSOutputValue(e.target.value)} />
              <TextField fullWidth label="Выработка, м²" type="number" value={sOutputArea} onChange={(e) => setSOutputArea(e.target.value)} />
            </Stack>
            <TextField fullWidth label="Комментарий" multiline rows={2} value={sComment} onChange={(e) => setSComment(e.target.value)} />
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button variant="outlined" onClick={() => setShiftOpen(false)}>Отмена</Button>
              <Button variant="contained" onClick={handleSaveShift} disabled={saving}>Сохранить</Button>
              {editingShift && (
                <IconButton color="error" aria-label="Удалить выход" onClick={() => { setShiftOpen(false); setDeletingShift(editingShift); }}>
                  <DeleteIcon />
                </IconButton>
              )}
            </Stack>
          </Stack>
        </Paper>
      </Modal>

      <Modal open={deletingBrigade} onClose={() => setDeletingBrigade(false)}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 360 }, p: 3, borderRadius: 2, outline: 'none' }}>
          <Typography variant="h6" gutterBottom>Удалить бригаду</Typography>
          <Typography sx={{ mb: 2 }}>Удалить «{selectedBrigade?.name}» вместе с составом и выходами? Это необратимо.</Typography>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="outlined" onClick={() => setDeletingBrigade(false)}>Отмена</Button>
            <Button variant="contained" color="error" onClick={handleDeleteBrigade}>Удалить</Button>
          </Stack>
        </Paper>
      </Modal>

      <Modal open={deletingMemberId != null} onClose={() => setDeletingMemberId(null)}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 360 }, p: 3, borderRadius: 2, outline: 'none' }}>
          <Typography variant="h6" gutterBottom>Удалить рабочего</Typography>
          <Typography sx={{ mb: 2 }}>Удалить рабочего из бригады?</Typography>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="outlined" onClick={() => setDeletingMemberId(null)}>Отмена</Button>
            <Button variant="contained" color="error" onClick={handleDeleteMember}>Удалить</Button>
          </Stack>
        </Paper>
      </Modal>

      <Modal open={!!deletingShift} onClose={() => setDeletingShift(null)}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 360 }, p: 3, borderRadius: 2, outline: 'none' }}>
          <Typography variant="h6" gutterBottom>Удалить выход</Typography>
          <Typography sx={{ mb: 2 }}>Удалить выход от {deletingShift?.date}?</Typography>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="outlined" onClick={() => setDeletingShift(null)}>Отмена</Button>
            <Button variant="contained" color="error" onClick={handleDeleteShift}>Удалить</Button>
          </Stack>
        </Paper>
      </Modal>

      {isMobile && view === 'list' && (
        <Fab color="primary" sx={{ ...FAB_STYLE, bottom: 80 }} onClick={openCreate}>
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
}

export default Brigades;