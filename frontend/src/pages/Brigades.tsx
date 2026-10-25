import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, InputAdornment, Button, Modal, Stack,
  Fab, useMediaQuery, useTheme, CircularProgress, Alert, Chip, IconButton,
  Menu, MenuItem, Select, FormControl, InputLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, Tab, Checkbox, Collapse, Divider,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupsIcon from '@mui/icons-material/Groups';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import PhoneIcon from '@mui/icons-material/Phone';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import { FAB_STYLE } from '../theme';
import {
  fetchBrigades, fetchBrigade, createBrigade, updateBrigade, deleteBrigade,
  addBrigadeMember, deleteBrigadeMember, fetchBrigadeShifts, logBrigadeShift,
  updateBrigadeShift, deleteBrigadeShift, fetchBrigadeStats,
} from '../services/brigadesService';
import type {
  BrigadeData, BrigadeShiftData, BrigadeShiftPayload, BrigadeStats,
} from '../services/brigadesService';
import { fetchObjects } from '../services/objectService';
import type { ObjectData } from '../services/objectService';
import { fetchProjectsByObject } from '../services/projectService';
import type { ProjectData } from '../services/projectService';
import { getApiErrorMessage } from '../utils/errors';
import { parseDecimal } from '../utils/decimal';

const fmtNum = (v: number | string) => parseDecimal(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
/** ⭐ №169: локальная дата, а не UTC — иначе вечером «сегодня» уезжает на завтра */
const localDay = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const todayStr = () => localDay(new Date());
const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDay(d);
};
/** ⭐ №169: 2026-10-25 → 25.10.2026 (в списке выходов больше не видно ISO-строки) */
const fmtDate = (value?: string | null) => {
  const s = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`
    : value || '—';
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
  // ⭐ №171: при входе в бригаду сразу «Выходы» — там часы, а не список состава
  const [tab, setTab] = useState<'members' | 'shifts' | 'stats'>('shifts');
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
  const [shiftsVersion, setShiftsVersion] = useState(0);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<BrigadeShiftData | null>(null);
  const [deletingShift, setDeletingShift] = useState<BrigadeShiftData | null>(null);
  const [sDate, setSDate] = useState(todayStr());
  const [sHours, setSHours] = useState(''); // мобильная бригада без состава
  const [sProjectId, setSProjectId] = useState<number | ''>('');
  const [sComment, setSComment] = useState('');
  // ⭐ №169: состав выхода — чекбокс «был / не был» + часы у каждого рабочего
  const [sRoster, setSRoster] = useState<Record<number, { checked: boolean; hours: string }>>({});
  const [rosterOpen, setRosterOpen] = useState(true);
  const [sProjects, setSProjects] = useState<ProjectData[]>([]);
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [fProjectId, setFProjectId] = useState<number | ''>('');

  // ─── Статистика ───
  const [stats, setStats] = useState<BrigadeStats | null>(null);
  const [chartData, setChartData] = useState<{ name: string; Часы: number }[]>([]);

  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);

  const headerTrailing = useMemo(() => isMobile ? (
    <IconButton
      onClick={(e) => setFilterAnchorEl(e.currentTarget)}
      sx={{
        bgcolor: objectFilter ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0, 0, 0, 0.06)',
        color: objectFilter ? '#1976d2' : '#424242',
        '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' },
      }}
    >
      <FilterAltIcon />
    </IconButton>
  ) : undefined, [isMobile, objectFilter]);

  useMobileHeader({ title: view === 'detail' && selectedBrigade ? selectedBrigade.name : 'Бригады', onBack: () => { if (viewRef.current === 'detail') { setView('list'); setSelectedBrigade(null); } else { navigate(-1); } }, searchOpen: mobileSearchOpen, searchValue: searchQuery, searchPlaceholder: 'Поиск бригад...', onSearchOpen: () => setMobileSearchOpen(true), onSearchClose: () => { setSearchQuery(''); setMobileSearchOpen(false); }, onSearchChange: (v) => setSearchQuery(v), trailing: headerTrailing });

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
  }, [loadBrigades]);

  const loadTabData = async (id: number) => {
    try {
      const [sh, st] = await Promise.all([
        fetchBrigadeShifts(id),
        fetchBrigadeStats(id),
      ]);
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

  // ⭐ №171: фильтры выходов применяются сами (кнопки «Применить» больше нет).
  // Даты пишутся посимвольно — ждём паузу 300 мс, чтобы не дёргать сервер на каждый символ.
  useEffect(() => {
    if (!selectedBrigade || tab !== 'shifts') return;
    const id = selectedBrigade.id;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchBrigadeShifts(id, {
        ...(fFrom ? { from: fFrom } : {}),
        ...(fTo ? { to: fTo } : {}),
        ...(fProjectId !== '' ? { projectId: fProjectId } : {}),
      })
        .then((rows) => {
          if (!cancelled) setShifts(rows);
        })
        .catch((err) => {
          if (!cancelled) setError(getApiErrorMessage(err, 'Не удалось загрузить выходы'));
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrigade?.id, tab, fFrom, fTo, fProjectId, shiftsVersion]);

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
      setTab('shifts');
      // фильтры выходов не переносим между бригадами
      setFFrom(''); setFTo(''); setFProjectId('');
      setShifts([]);
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
  // ⭐ №169: состав бригады и сумма часов — из чекбоксов, а не из ручного поля
  const brigadeMembers = selectedBrigade?.members ?? [];
  const hasRoster = brigadeMembers.length > 0;
  const rosterRows = useMemo(
    () =>
      Object.entries(sRoster)
        .filter(([, v]) => v.checked)
        .map(([id, v]) => ({ memberId: Number(id), hours: parseDecimal(v.hours) })),
    [sRoster],
  );
  const rosterHours = useMemo(
    () => Math.round(rosterRows.reduce((a, r) => a + r.hours, 0) * 100) / 100,
    [rosterRows],
  );

  const openShiftModal = async (shift?: BrigadeShiftData) => {
    setEditingShift(shift ?? null);
    setSDate(shift ? String(shift.date).slice(0, 10) : todayStr());
    setSHours(shift ? String(shift.hoursWorked) : '');
    setSProjectId(shift?.projectId ?? '');
    setSComment(shift?.comment ?? '');
    // Новый выход: все отмечены, у каждого 8 ч. Правка: отмечены те, кто был,
    // часы — сохранённые (старые записи без состава показываются без галочёк).
    const saved = new Map((shift?.members ?? []).map((m) => [m.memberId ?? -1, m.hours]));
    const roster: Record<number, { checked: boolean; hours: string }> = {};
    for (const m of selectedBrigade?.members ?? []) {
      const savedHours = saved.get(m.id);
      roster[m.id] = {
        checked: shift ? savedHours != null : true,
        hours: savedHours != null ? String(savedHours) : '8',
      };
    }
    setSRoster(roster);
    setRosterOpen(!shift);
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

  const toggleRosterMember = (memberId: number) => {
    setSRoster((prev) => ({
      ...prev,
      [memberId]: {
        checked: !prev[memberId]?.checked,
        hours: prev[memberId]?.hours ?? '8',
      },
    }));
  };

  const setRosterHours = (memberId: number, value: string) => {
    setSRoster((prev) => ({
      ...prev,
      [memberId]: { checked: prev[memberId]?.checked ?? true, hours: value },
    }));
  };

  const handleSaveShift = async () => {
    if (!selectedBrigade) return;
    if (!sDate || sDate > todayStr()) {
      setFormError('Дата не может быть в будущем');
      return;
    }
    let hoursWorked: number;
    let members: { memberId: number; hours: number }[] | undefined;
    if (hasRoster) {
      if (rosterRows.length === 0) {
        setFormError('Отметьте хотя бы одного рабочего в составе бригады');
        return;
      }
      if (rosterRows.some((r) => r.hours <= 0 || r.hours > 24)) {
        setFormError('Часы рабочего: от 0.5 до 24');
        return;
      }
      members = rosterRows;
      hoursWorked = rosterHours;
    } else {
      // мобильная бригада без состава — прежний ручной ввод часов
      hoursWorked = parseDecimal(sHours);
      if (hoursWorked <= 0 || hoursWorked > 24) {
        setFormError('Часы: от 0.5 до 24');
        return;
      }
    }
    setSaving(true); setFormError('');
    try {
      const data: BrigadeShiftPayload = {
        date: sDate,
        hoursWorked,
        members,
        projectId: sProjectId === '' ? undefined : sProjectId,
        comment: sComment.trim() || undefined,
      };
      if (editingShift) {
        await updateBrigadeShift(selectedBrigade.id, editingShift.id, data);
      } else {
        await logBrigadeShift(selectedBrigade.id, data);
      }
      setShiftOpen(false);
      loadTabData(selectedBrigade.id);
      setShiftsVersion((v) => v + 1);
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
      setShiftsVersion((v) => v + 1);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось удалить выход'));
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
    <Box sx={{ mt: -1.5, maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {!isMobile && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: view === 'detail' ? 1 : 2 }}>
          {/* ⭐ №169: назад — на одну ступень (из бригады в список), а не на главную */}
          <IconButton
            onClick={() => {
              if (view === 'detail') {
                setView('list');
                setSelectedBrigade(null);
              } else {
                navigate('/');
              }
            }}
            sx={{ mr: 1, bgcolor: 'rgba(0,0,0,0.06)', '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' } }}
            aria-label={view === 'detail' ? 'К списку бригад' : 'В главное меню'}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>Бригады</Typography>
        </Box>
      )}
      {/* ⭐ №169: хлебные крошки «Бригады › название» — как в «Объекты → Проекты → Сметы» */}
      {view === 'detail' && selectedBrigade && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: isMobile ? 0.5 : 0, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography
            component="button"
            onClick={() => {
              setView('list');
              setSelectedBrigade(null);
            }}
            sx={{
              background: 'none', border: 'none', padding: 0,
              color: '#1976d2', cursor: 'pointer', fontSize: isMobile ? 13 : 14,
              textDecoration: 'underline',
              '&:hover': { color: '#1565c0' },
            }}
          >
            Бригады
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: isMobile ? 13 : 14 }}>›</Typography>
          <Typography sx={{ fontSize: isMobile ? 13 : 14, fontWeight: 600 }} noWrap>
            {selectedBrigade.name}
          </Typography>
        </Box>
      )}
      <Menu anchorEl={filterAnchorEl} open={Boolean(filterAnchorEl)} onClose={() => setFilterAnchorEl(null)}>
        <MenuItem onClick={() => { setObjectFilter(''); setFilterAnchorEl(null); }}>Все объекты</MenuItem>
        {objects.map((o) => (
          <MenuItem key={o.id} onClick={() => { setObjectFilter(o.id); setFilterAnchorEl(null); }}>{o.name}</MenuItem>
        ))}
      </Menu>
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
                {/* ⭐ №171: без кнопки «Применить» — даты и проект фильтруют сразу.
                    На мобилке проект на всю ширину под датами, на десктопе — в одну полку с датами. */}
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1,
                    mb: 1.5,
                    gridTemplateColumns: { xs: '1fr 1fr', md: '170px 170px 1fr' },
                  }}
                >
                  <TextField
                    size="small"
                    type="date"
                    label="С"
                    InputLabelProps={{ shrink: true }}
                    value={fFrom}
                    onChange={(e) => setFFrom(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    type="date"
                    label="По"
                    InputLabelProps={{ shrink: true }}
                    value={fTo}
                    onChange={(e) => setFTo(e.target.value)}
                    fullWidth
                  />
                  <FormControl size="small" sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
                    <InputLabel>Проект</InputLabel>
                    <Select value={fProjectId} label="Проект" onChange={(e) => setFProjectId(e.target.value === '' ? '' : Number(e.target.value))}>
                      <MenuItem value="">Все проекты</MenuItem>
                      {sProjects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Box>
                {/* ⭐ №169: кнопка отдельной строкой — раньше «улетала» при переносе фильтров */}
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => openShiftModal()}
                  fullWidth={isMobile}
                  sx={{ mb: 1.5, ...(isMobile ? {} : { ml: 'auto', display: 'flex', width: 'fit-content' }) }}
                >
                  Зафиксировать выход
                </Button>
                {shifts.length === 0 ? (
                  <Typography color="text.secondary">Выходов пока нет.</Typography>
                ) : isMobile ? (
                  <Stack spacing={1}>
                    {shifts.map((s) => (
                      <Paper key={s.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
                            {fmtDate(s.date)} • {fmtNum(s.hoursWorked)} ч
                          </Typography>
                          <IconButton size="small" onClick={() => openShiftModal(s)} sx={{ bgcolor: 'action.hover' }}>
                            <SettingsIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => setDeletingShift(s)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {s.project?.name || 'Без проекта'}
                          {s.comment ? ` • ${s.comment}` : ''}
                        </Typography>
                        {/* ⭐ №169: кто именно выходил и по сколько часов */}
                        {s.members && s.members.length > 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {s.members.map((m) => `${m.fullName} — ${fmtNum(m.hours)} ч`).join(' · ')}
                          </Typography>
                        )}
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
                          <TableCell>Состав</TableCell>
                          <TableCell>Проект</TableCell>
                          <TableCell>Комментарий</TableCell>
                          <TableCell align="center"></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {shifts.map((s) => (
                          <TableRow key={s.id} hover>
                            <TableCell>{fmtDate(s.date)}</TableCell>
                            <TableCell align="right">{fmtNum(s.hoursWorked)}</TableCell>
                            <TableCell>
                              {s.members && s.members.length > 0 ? (
                                <Tooltip
                                  title={s.members
                                    .map((m) => `${m.fullName} — ${fmtNum(m.hours)} ч`)
                                    .join(', ')}
                                >
                                  <span>{s.members.length} чел.</span>
                                </Tooltip>
                              ) : '—'}
                            </TableCell>
                            <TableCell>{s.project?.name || '—'}</TableCell>
                            <TableCell
                              sx={{
                                maxWidth: 220,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {s.comment || '—'}
                            </TableCell>
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
                    <Typography variant="caption" color="text.secondary">Выходов</Typography>
                    <Typography variant="h6" fontWeight={700} color="#2e7d32">{stats?.shiftsCount ?? 0}</Typography>
                  </Paper>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Последний выход</Typography>
                    <Typography variant="h6" fontWeight={700} color="#ef6c00">{shifts[0] ? fmtDate(shifts[0].date) : '—'}</Typography>
                  </Paper>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Средние часы/смену</Typography>
                    <Typography variant="h6" fontWeight={700} color="#7b1fa2">{fmtNum(stats?.avgHoursPerShift ?? 0)}</Typography>
                  </Paper>
                </Box>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Часы по дням (30 дней)</Typography>
                  {chartData.every((d) => !d['Часы']) ? (
                    <Typography variant="body2" color="text.secondary">
                      За последние 30 дней выходов нет — график появится после первой фиксации.
                    </Typography>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={10} interval={4} />
                        <YAxis fontSize={11} />
                        <RTooltip formatter={(v) => `${fmtNum(Number(v))} ч`} />
                        <Area type="monotone" dataKey="Часы" stroke="#1976d2" fill="#1976d2" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </Paper>
              </Stack>
            )}
          </Stack>
        </>
      ) : (
        <>
          <Stack spacing={2}>
            {!isMobile && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  placeholder="Поиск бригад..."
                  variant="outlined"
                  size="small"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  sx={{ flexGrow: 1 }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
                />
                {objects.length > 0 && (
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Объект</InputLabel>
                    <Select
                      value={objectFilter}
                      label="Объект"
                      onChange={(e) => setObjectFilter(e.target.value === '' ? '' : Number(e.target.value))}
                    >
                      <MenuItem value=""><em>Все объекты</em></MenuItem>
                      {objects.map((o) => (
                        <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ bgcolor: '#4caf50', border: '2px solid #388e3c', '&:hover': { bgcolor: '#388e3c', borderColor: '#388e3c', transform: 'translateY(-3px)', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }, transition: 'all 0.3s ease', whiteSpace: 'nowrap' }}>
                  Добавить
                </Button>
              </Box>
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
            {/* ⭐ №169: состав бригады — раскрывается по клику, чекбоксы + часы (по умолчанию 8 ч) */}
            {hasRoster ? (
              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setRosterOpen((v) => !v)}
                  sx={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 1,
                    p: 1.5, background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', font: 'inherit', color: 'inherit',
                  }}
                >
                  <GroupsIcon fontSize="small" sx={{ color: '#1976d2' }} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={600}>Состав бригады</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Отмечено {rosterRows.length} из {brigadeMembers.length} · {fmtNum(rosterHours)} ч
                    </Typography>
                  </Box>
                  {rosterOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </Box>
                <Collapse in={rosterOpen}>
                  <Divider />
                  <Box sx={{ px: 1.5, py: 1 }}>
                    {brigadeMembers.map((m) => {
                      const row = sRoster[m.id] ?? { checked: false, hours: '8' };
                      return (
                        <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                          <Checkbox
                            size="small"
                            checked={row.checked}
                            onChange={() => toggleRosterMember(m.id)}
                            inputProps={{ 'aria-label': `${m.fullName}: выходил` }}
                          />
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{ flexGrow: 1, color: row.checked ? 'text.primary' : 'text.secondary' }}
                          >
                            {m.fullName}
                          </Typography>
                          <TextField
                            size="small"
                            type="number"
                            value={row.hours}
                            onChange={(e) => setRosterHours(m.id, e.target.value)}
                            disabled={!row.checked}
                            inputProps={{ min: 0.5, max: 24, step: 0.5, 'aria-label': `Часы: ${m.fullName}` }}
                            sx={{ width: 96 }}
                            InputProps={{ endAdornment: <InputAdornment position="end">ч</InputAdornment> }}
                          />
                        </Box>
                      );
                    })}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Снимите галочку у тех, кто не выходил. Часы по умолчанию — 8.
                    </Typography>
                  </Box>
                </Collapse>
              </Paper>
            ) : (
              <TextField
                fullWidth
                label="Часы (0.5–24)"
                type="number"
                inputProps={{ min: 0.5, max: 24, step: 0.5 }}
                value={sHours}
                onChange={(e) => setSHours(e.target.value)}
                helperText="В бригаде нет состава — укажите часы вручную"
              />
            )}
            {selectedBrigade?.objectId != null && (
              <FormControl fullWidth size="small">
                <InputLabel>Проект</InputLabel>
                <Select value={sProjectId} label="Проект" onChange={(e) => setSProjectId(e.target.value === '' ? '' : Number(e.target.value))}>
                  <MenuItem value="">Без проекта</MenuItem>
                  {sProjects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <TextField
              fullWidth
              label="Комментарий"
              multiline
              rows={2}
              value={sComment}
              onChange={(e) => setSComment(e.target.value)}
              helperText="Необязательно. Виден в списке выходов."
            />
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1}>
              {hasRoster && (
                <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                  Итого: {fmtNum(rosterHours)} ч
                </Typography>
              )}
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
          <Typography sx={{ mb: 2 }}>Удалить выход от {fmtDate(deletingShift?.date)}?</Typography>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="outlined" onClick={() => setDeletingShift(null)}>Отмена</Button>
            <Button variant="contained" color="error" onClick={handleDeleteShift}>Удалить</Button>
          </Stack>
        </Paper>
      </Modal>

      {isMobile && view === 'list' && (
        <Fab color="primary" sx={{ ...FAB_STYLE, bottom: 80 }} onClick={openCreate}>
          <GroupAddIcon />
        </Fab>
      )}
    </Box>
  );
}

export default Brigades;