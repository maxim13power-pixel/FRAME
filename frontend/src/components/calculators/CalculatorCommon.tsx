import React from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';

export const formatNumber = (value: number) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export const NumberField: React.FC<NumberFieldProps> = ({ label, value, onChange }) => (
  <TextField
    fullWidth
    label={label}
    type="number"
    value={value}
    onChange={(event) => onChange(event.target.value)}
    inputProps={{ min: 0, step: 'any' }}
  />
);

interface ResultPaperProps {
  label: string;
  value: React.ReactNode;
  color?: string;
  background?: string;
  borderColor?: string;
  children?: React.ReactNode;
}

export const ResultPaper: React.FC<ResultPaperProps> = ({
  label,
  value,
  color = '#0d47a1',
  background = '#e3f2fd',
  borderColor = '#90caf9',
  children,
}) => (
  <Paper elevation={0} sx={{ p: 2, bgcolor: background, border: `1px solid ${borderColor}`, borderRadius: 2 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="h5" sx={{ mt: 0.5, color, fontWeight: 700 }}>{value}</Typography>
    {children}
  </Paper>
);

interface ResetButtonProps {
  onClick: () => void;
  disabled: boolean;
}

export const ResetButton: React.FC<ResetButtonProps> = ({ onClick, disabled }) => (
  <Button variant="outlined" onClick={onClick} disabled={disabled}>Сброс</Button>
);

export const FieldGrid: React.FC<{ children: React.ReactNode; columns?: number }> = ({ children, columns = 2 }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${columns}, 1fr)` }, gap: 1.5 }}>
    {children}
  </Box>
);