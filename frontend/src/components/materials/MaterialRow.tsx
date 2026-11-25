// frontend/src/components/materials/MaterialRow.tsx
// ⭐ №393: строка сметы вынесена из страницы и обёрнута в React.memo.
// Зачем: на 400+ позициях раньше любое изменение состояния страницы (скролл,
// открытие модалки, выделение) перерисовывало все видимые строки. Теперь строка
// перерисовывается только когда меняются ЕЁ данные (`material`), её флаги
// (выбрана/подсвечена/открыт редактор цены) или права — а колбэки стабильные.
import React from 'react';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  IconButton,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsIcon from '@mui/icons-material/Settings';
import type { MaterialData } from '../../services/materialService';
import { countRender } from '../../utils/perf';
import InlinePriceEditor from './InlinePriceEditor';
import { rub, unitLabelOf } from './estimateFormat';

export interface MaterialRowProps {
  material: MaterialData;
  /** сквозной номер строки в смете (не в окне) — нумерация и Shift-диапазон */
  index: number;
  selected: boolean;
  /** подсветка deep-link (?materialId=) или только что созданной копии */
  highlighted: boolean;
  hidePrices: boolean;
  canWrite: boolean;
  /** открытый редактор цены ИМЕННО этой строки (иначе null) */
  inlineSide: 'work' | 'material' | null;
  inlineValue: string;
  onHoverRow: (index: number) => void;
  onNumberMouseDown: (event: React.MouseEvent, index: number, id: number) => void;
  onToggleRow: (event: React.ChangeEvent<HTMLInputElement>, index: number, id: number) => void;
  onOpenPhotos: (material: MaterialData) => void;
  onOpenFix: (material: MaterialData) => void;
  onOpenSettings: (material: MaterialData) => void;
  onDuplicate: (material: MaterialData) => void;
  onInlinePriceStart: (material: MaterialData, side: 'work' | 'material') => void;
  onInlinePriceChange: (value: string) => void;
  onInlinePriceCommit: () => void;
  onInlinePriceCancel: () => void;
}

const MaterialRowInner: React.FC<MaterialRowProps> = ({
  material: m,
  index,
  selected,
  highlighted,
  hidePrices,
  canWrite,
  inlineSide,
  inlineValue,
  onHoverRow,
  onNumberMouseDown,
  onToggleRow,
  onOpenPhotos,
  onOpenFix,
  onOpenSettings,
  onDuplicate,
  onInlinePriceStart,
  onInlinePriceChange,
  onInlinePriceCommit,
  onInlinePriceCancel,
}) => {
  countRender('materials.row'); // ⭐ №393: точка замера рендеров строки

  return (
    <TableRow
      hover
      id={`material-row-${m.id}`}
      // ⭐ №297: тянем мышь по строкам — выделяется диапазон от нажатой строки
      onMouseEnter={() => onHoverRow(index)}
      sx={highlighted
        ? { bgcolor: '#fff8e1', transition: 'background-color 0.3s' }
        : selected
          ? { bgcolor: 'rgba(25, 118, 210, 0.08)' }
          : undefined}
    >
      {/* ⭐ №292/№297: чекбокс + номер — клик, Shift+Click и «протяжка» мышью */}
      <TableCell
        onMouseDown={(e) => onNumberMouseDown(e, index, m.id)}
        title="Клик — выбрать, Shift+Click — диапазон, зажать и провести — несколько подряд"
        sx={{ textAlign: 'center', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Checkbox
            size="small"
            checked={selected}
            onChange={(e) => onToggleRow(e, index, m.id)}
            inputProps={{ 'aria-label': `Выбрать строку ${index + 1}` }}
            // ⭐ №297: мышь обрабатывает ячейка (иначе браузер переключит чекбокс дважды),
            // клавиатура (Tab + пробел) работает как обычно
            sx={{ p: 0.25, pointerEvents: 'none' }}
          />
          {index + 1}
        </Box>
      </TableCell>
      <TableCell>{m.name}</TableCell>
      <TableCell sx={{ textAlign: 'center' }}>{m.article || '-'}</TableCell>
      <TableCell sx={{ textAlign: 'center' }}>{unitLabelOf(m.unit)}</TableCell>
      <TableCell sx={{ textAlign: 'center' }}>{m.specQuantity}</TableCell>
      <TableCell sx={{ textAlign: 'center', fontWeight: 600 }}>{m.totalUsed}</TableCell>
      <TableCell sx={{ textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>{m.lastEntry ?? '—'}</Typography>
          {/* ⭐ №240: кнопка-прямоугольник со скруглением; бейдж — на углу КНОПКИ,
              а не поверх иконки */}
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
              aria-label="Фото материала"
              title="Фото материала"
              sx={{
                minWidth: 40,
                px: 1,
                py: 0.5,
                borderRadius: 2,
                color: m.photosCount ? '#1976d2' : '#757575',
                borderColor: m.photosCount ? '#90caf9' : '#bdbdbd',
                '&:hover': { borderColor: '#1976d2', bgcolor: 'rgba(25,118,210,0.04)' },
              }}
            >
              <CameraAltIcon sx={{ fontSize: 18 }} />
            </Button>
          </Badge>
        </Box>
        {/* ⭐ №390: фиксация — право роли, а не цен (диалог и так без денег) */}
        {canWrite && (
          <Button size="small" variant="outlined" onClick={() => onOpenFix(m)} sx={{ textTransform: 'none', fontSize: 11, mt: 0.5 }}>
            + фикс
          </Button>
        )}
      </TableCell>
      <TableCell sx={{ textAlign: 'center', fontWeight: 600, color: m.progressPercent >= 100 ? '#4caf50' : '#1976d2' }}>{m.progressPercent}%</TableCell>
      {/* ⭐ Денежные ячейки скрываем при hidePrices */}
      {!hidePrices && <TableCell sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{m.totalCost > 0 ? rub(m.totalCost) : '—'}</TableCell>}
      {!hidePrices && <TableCell sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{m.materialTotalCost > 0 ? rub(m.materialTotalCost) : '—'}</TableCell>}
      {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{(m.totalCost + m.materialTotalCost) > 0 ? rub(m.totalCost + m.materialTotalCost) : '—'}</TableCell>}
      {!hidePrices && (
        <TableCell
          sx={{ textAlign: 'right', whiteSpace: 'nowrap', borderLeft: '2px solid #90caf9', cursor: 'pointer' }}
          onClick={() => onInlinePriceStart(m, 'work')}
          title="Изменить цену работы (только в этой смете)"
        >
          {inlineSide === 'work' ? (
            <InlinePriceEditor
              value={inlineValue}
              onChange={onInlinePriceChange}
              onCommit={onInlinePriceCommit}
              onCancel={onInlinePriceCancel}
            />
          ) : m.unitPrice > 0 ? (
            rub(m.unitPrice)
          ) : (
            '—'
          )}
        </TableCell>
      )}
      {!hidePrices && <TableCell sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{(m.unitPrice * m.specQuantity) > 0 ? rub(m.unitPrice * m.specQuantity) : '—'}</TableCell>}
      {!hidePrices && (
        <TableCell
          sx={{ textAlign: 'right', whiteSpace: 'nowrap', borderLeft: '2px solid #90caf9', cursor: 'pointer' }}
          onClick={() => onInlinePriceStart(m, 'material')}
          title="Изменить цену материала (только в этой смете)"
        >
          {inlineSide === 'material' ? (
            <InlinePriceEditor
              value={inlineValue}
              onChange={onInlinePriceChange}
              onCommit={onInlinePriceCommit}
              onCancel={onInlinePriceCancel}
            />
          ) : m.materialUnitPrice > 0 ? (
            rub(m.materialUnitPrice)
          ) : (
            '—'
          )}
        </TableCell>
      )}
      {!hidePrices && <TableCell sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{(m.materialUnitPrice * m.specQuantity) > 0 ? rub(m.materialUnitPrice * m.specQuantity) : '—'}</TableCell>}
      {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', borderLeft: '2px solid #90caf9' }}>
        {((m.unitPrice + m.materialUnitPrice) * m.specQuantity) > 0 ? rub((m.unitPrice + m.materialUnitPrice) * m.specQuantity) : '—'}
      </TableCell>}
      <TableCell sx={{ textAlign: 'center' }}>
        {/* ⭐ Шестерёнка настроек — по праву записи (не по видимости цен) */}
        {canWrite && (
          <IconButton size="small" onClick={() => onOpenSettings(m)} sx={{ bgcolor: 'action.hover' }}>
            <SettingsIcon fontSize="small" />
          </IconButton>
        )}
        {/* ⭐ №162: быстрое копирование строки (десктоп) */}
        {!hidePrices && (
          <IconButton
            size="small"
            onClick={() => onDuplicate(m)}
            sx={{ bgcolor: 'action.hover', ml: 0.5 }}
            aria-label="Дублировать строку"
            title="Дублировать строку"
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        )}
      </TableCell>
    </TableRow>
  );
};

/**
 * Сравнение по мелким props: `material` меняется только у изменённой строки
 * (страница обновляет её из ответа API), остальные получают прежний объект.
 */
export const MaterialRow = React.memo(MaterialRowInner);
export default MaterialRow;
