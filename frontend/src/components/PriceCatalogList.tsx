// frontend/src/components/PriceCatalogList.tsx
// ⭐ №151: список справочников цен — оформление как «Объекты → Проекты»:
// карточки, внутри справочника — привычный вид с категориями и расценками.
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Modal,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveIcon from '@mui/icons-material/Archive';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListAltIcon from '@mui/icons-material/ListAlt';
import {
  archivePriceCatalog,
  createPriceCatalog,
  fetchPriceCatalogs,
  renamePriceCatalog,
} from '../services/priceListService';
import type { PriceCatalogData } from '../services/priceListService';
import { useFeedback } from '../contexts/FeedbackContext';
import { getApiErrorText } from '../utils/errors';

interface PriceCatalogListProps {
  /** Предзаполненное название для нового справочника (например, имя объекта) */
  defaultNewName?: string;
}

const PriceCatalogList: React.FC<PriceCatalogListProps> = ({ defaultNewName }) => {
  const navigate = useNavigate();
  const { notify, success, error: notifyError, confirm } = useFeedback();

  const [catalogs, setCatalogs] = useState<PriceCatalogData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PriceCatalogData | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setCatalogs(await fetchPriceCatalogs());
    } catch (err) {
      notifyError('Не удалось загрузить справочники: ' + getApiErrorText(err, 'неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenCreate = () => {
    setEditing(null);
    setName(defaultNewName ?? '');
    setModalOpen(true);
  };

  const handleOpenRename = (catalog: PriceCatalogData) => {
    setEditing(catalog);
    setName(catalog.name);
    setModalOpen(true);
  };


  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      notify('Введите название справочника', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await renamePriceCatalog(editing.id, trimmed);
        success(`Справочник переименован в «${trimmed}»`);
      } else {
        const created = await createPriceCatalog(trimmed);
        success(`Справочник «${created.name}» создан`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось сохранить справочник'));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (catalog: PriceCatalogData) => {
    const ok = await confirm({
      title: 'Архивировать справочник?',
      text: `«${catalog.name}» (${catalog.itemsCount} расценок) уйдёт из списка. Данные и уже созданные сметы сохранятся — справочник можно будет вернуть.`,
      confirmText: 'Архивировать',
      danger: true,
    });
    if (!ok) return;
    try {
      await archivePriceCatalog(catalog.id);
      success('Справочник архивирован');
      await load();
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось архивировать справочник'));
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <ListAltIcon sx={{ color: '#1976d2' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#04164b', flexGrow: 1 }}>
          Справочники цен
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          Создать
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Справочник — это отдельный набор расценок под конкретный объект или тип работ
        (например «Квартиры/Коттеджи» или «Склад X5»). Внутри справочника — свои категории,
        работы и материалы.
      </Typography>

      <Stack spacing={1}>
        {catalogs.map((catalog) => (
          <Paper
            key={catalog.id}
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid #e0e0e0',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: '#1976d2', boxShadow: '0 2px 8px rgba(25,118,210,0.12)' },
            }}
            onClick={() => navigate(`/price-list/${catalog.id}`)}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#04164b' }} noWrap>
                  {catalog.name}
                </Typography>
                {catalog.isSystem && (
                  <Chip label="системный" size="small" sx={{ bgcolor: '#e3f2fd', color: '#1565c0' }} />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                расценок: {catalog.itemsCount} · проектов: {catalog.projectsCount}
              </Typography>
            </Box>

            <IconButton
              size="small"
              title="Переименовать"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenRename(catalog);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              title="Архивировать"
              onClick={(e) => {
                e.stopPropagation();
                void handleArchive(catalog);
              }}
            >
              <ArchiveIcon fontSize="small" />
            </IconButton>
            <ChevronRightIcon sx={{ color: '#90a4ae' }} />
          </Paper>
        ))}

        {catalogs.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Справочников пока нет — создайте первый.
          </Typography>
        )}
      </Stack>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} disableRestoreFocus>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '92%', sm: 420 },
            p: 3,
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            {editing ? 'Переименовать справочник' : 'Новый справочник цен'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {editing
              ? 'Название видно только вам.'
              : 'Например: «Квартиры/Коттеджи», «Склад X5 Новосемейкино». Название можно изменить позже.'}
          </Typography>
          <TextField
            fullWidth
            autoFocus
            label="Название справочника"
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 80 }}
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
            <Button onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button variant="contained" onClick={() => { void handleSave(); }} disabled={saving}>
              {saving ? <CircularProgress size={18} /> : 'Сохранить'}
            </Button>
          </Stack>
        </Paper>
      </Modal>
    </Box>
  );
};

export default PriceCatalogList;
