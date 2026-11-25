// frontend/src/components/materials/InlinePriceEditor.tsx
// ⭐ №275/№301: инлайн-правка «За ед.» с явными кнопками сохранения и отмены —
// по Enter ориентироваться было неочевидно. Enter/Esc по-прежнему работают.
// ⭐ №393: вынесен из страницы, чтобы memo-строка могла его использовать без цикла.
import React from 'react';
import { Box, IconButton, TextField } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

export interface InlinePriceEditorProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

export const InlinePriceEditor: React.FC<InlinePriceEditorProps> = ({
  value,
  onChange,
  onCommit,
  onCancel,
}) => (
  <Box
    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
    onClick={(e) => e.stopPropagation()}
  >
    <TextField
      size="small"
      autoFocus
      value={value}
      placeholder="0"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit();
        if (e.key === 'Escape') onCancel();
      }}
      onFocus={(e) => e.target.select()}
      inputProps={{
        inputMode: 'decimal',
        style: { textAlign: 'right', width: 64, padding: '4px 6px' },
      }}
    />
    <IconButton
      size="small"
      color="success"
      aria-label="Сохранить цену"
      title="Сохранить (Enter)"
      onClick={onCommit}
      sx={{ p: 0.25 }}
    >
      <CheckCircleIcon fontSize="small" />
    </IconButton>
    <IconButton
      size="small"
      color="error"
      aria-label="Отменить правку цены"
      title="Отмена (Esc)"
      onClick={onCancel}
      sx={{ p: 0.25 }}
    >
      <CancelIcon fontSize="small" />
    </IconButton>
  </Box>
);

export default InlinePriceEditor;
