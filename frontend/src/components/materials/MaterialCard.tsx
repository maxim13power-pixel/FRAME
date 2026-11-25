// frontend/src/components/materials/MaterialCard.tsx
// ⭐ №393: карточка мобильного списка сметы — вынесена из страницы и обёрнута
// в React.memo по тем же причинам, что и строка таблицы: на телефоне 25–200
// карточек перерисовывались на каждый скролл/модалку.
import React from 'react';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  IconButton,
  LinearProgress,
  Paper,
  Typography,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import InventoryIcon from '@mui/icons-material/Inventory';
import SettingsIcon from '@mui/icons-material/Settings';
import type { MaterialData } from '../../services/materialService';
import { countRender } from '../../utils/perf';
import { rub, unitLabelOf } from './estimateFormat';

export interface MaterialCardProps {
  material: MaterialData;
  selected: boolean;
  highlighted: boolean;
  /** включён режим выделения (выбрана хотя бы одна строка) — показываем чекбокс */
  selectionMode: boolean;
  hidePrices: boolean;
  canWrite: boolean;
  onTouchStart: (material: MaterialData, event: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onCardClick: (material: MaterialData, event: React.MouseEvent) => void;
  onToggle: (id: number) => void;
  onOpenPhotos: (material: MaterialData) => void;
  onOpenFix: (material: MaterialData) => void;
  onOpenSettings: (material: MaterialData) => void;
}

const MaterialCardInner: React.FC<MaterialCardProps> = ({
  material: m,
  selected,
  highlighted,
  selectionMode,
  hidePrices,
  canWrite,
  onTouchStart,
  onTouchEnd,
  onCardClick,
  onToggle,
  onOpenPhotos,
  onOpenFix,
  onOpenSettings,
}) => {
  countRender('materials.card'); // ⭐ №393: точка замера рендеров карточки

  return (
    <Paper
      id={`material-row-${m.id}`}
      onTouchStart={(e) => onTouchStart(m, e)}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onTouchMove={onTouchEnd}
      onClick={(e) => onCardClick(m, e)}
      sx={{
        p: 1.5,
        borderRadius: 2,
        // ⭐ №294: на iOS долгое нажатие не должно вызывать меню/выделение текста
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        ...(highlighted
          ? { bgcolor: '#fff8e1', transition: 'background-color 0.3s' }
          : {}),
        ...(selected
          ? { border: '2px solid #1976d2', bgcolor: 'rgba(25, 118, 210, 0.06)' }
          : {}),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        {/* ⭐ №294: в режиме выделения у карточек появляются чекбоксы */}
        {selectionMode && (
          <Checkbox
            size="small"
            checked={selected}
            onChange={() => onToggle(m.id)}
            inputProps={{ 'aria-label': `Выбрать ${m.name}` }}
            sx={{ p: 0.25, ml: -0.75, mr: 0.5 }}
          />
        )}
        <InventoryIcon sx={{ color: '#1976d2', mr: 1, fontSize: 22 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
          {m.name}
        </Typography>
        {/* ⭐ №390: шестерёнка — по праву записи, не по видимости цен */}
        {canWrite && (
          <IconButton size="small" onClick={() => onOpenSettings(m)} sx={{ bgcolor: 'action.hover' }}>
            <SettingsIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {m.article || 'Без артикула'} • {unitLabelOf(m.unit)}
      </Typography>
      {/* Прогресс-бар с процентом справа */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <LinearProgress
          variant="determinate"
          value={Math.min(m.progressPercent, 100)}
          sx={{
            height: 8, borderRadius: 4, flexGrow: 1, bgcolor: '#e0e0e0',
            '& .MuiLinearProgress-bar': {
              backgroundColor: m.progressPercent >= 100 ? '#4caf50' : '#1976d2',
              borderRadius: 4,
            },
          }}
        />
        <Typography variant="body2" fontWeight={700} sx={{ color: m.progressPercent >= 100 ? '#4caf50' : '#1976d2', minWidth: 40, textAlign: 'right' }}>
          {m.progressPercent}%
        </Typography>
      </Box>
      {/* Ключевые цифры в одну строку */}
      <Typography variant="body2" sx={{ mb: 1 }}>
        <Box component="span" color="text.secondary">Спец:</Box> <b>{m.specQuantity}</b>
        {' • '}<Box component="span" color="text.secondary">Итого:</Box> <b>{m.totalUsed}</b>
        {' • '}<Box component="span" color="text.secondary">Посл.:</Box> <b>{m.lastEntry ?? '—'}</b>
      </Typography>
      {/* ⭐ Блок "На текущий момент" — полностью скрыт при hidePrices */}
      {!hidePrices && (
        <Box sx={{ bgcolor: '#f5f9ff', borderRadius: 1.5, p: 1, mb: 1, border: '1px solid #e3edf8' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
            <Typography variant="caption" color="text.secondary">Работы:</Typography>
            <Typography variant="caption" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>{m.totalCost > 0 ? rub(m.totalCost) : '—'}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
            <Typography variant="caption" color="text.secondary">Материалы:</Typography>
            <Typography variant="caption" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>{m.materialTotalCost > 0 ? rub(m.materialTotalCost) : '—'}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" fontWeight={700}>Итого:</Typography>
            <Typography variant="body2" fontWeight={700} color="#1976d2" sx={{ whiteSpace: 'nowrap' }}>
              {(m.totalCost + m.materialTotalCost) > 0 ? rub(m.totalCost + m.materialTotalCost) : '—'}
            </Typography>
          </Box>
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Badge
          badgeContent={m.photosCount ?? 0}
          color="primary"
          invisible={!m.photosCount}
          overlap="rectangular"
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16, px: 0.5 } }}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={() => onOpenPhotos(m)}
            aria-label="Фотофиксация"
            sx={{
              // ⭐ №240: шире на ~30 % (48 → 64), чтобы бейдж не перекрывал иконку
              minWidth: 64,
              px: 2,
              py: 0.75,
              borderRadius: 2,
              color: m.photosCount ? '#1976d2' : '#757575',
              borderColor: m.photosCount ? '#90caf9' : '#bdbdbd',
              '&:hover': { borderColor: '#1976d2', bgcolor: 'rgba(25,118,210,0.04)' },
            }}
          >
            <CameraAltIcon fontSize="small" />
          </Button>
        </Badge>
        {/* ⭐ №390: фиксация — право роли, а не цен */}
        {canWrite && (
          <Button
            fullWidth
            variant="contained"
            size="small"
            onClick={() => onOpenFix(m)}
            sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
          >
            + Зафиксировать объём
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export const MaterialCard = React.memo(MaterialCardInner);
export default MaterialCard;
