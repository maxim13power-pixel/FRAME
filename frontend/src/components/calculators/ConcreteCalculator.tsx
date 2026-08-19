import React, { useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';

const formatNumber = (value: number) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

const ConcreteCalculator: React.FC = () => {
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');

  const volume = (Number(length) || 0) * (Number(width) || 0) * (Number(height) || 0);

  const reset = () => {
    setLength('');
    setWidth('');
    setHeight('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
        <TextField label="Длина, м" type="number" value={length} onChange={(event) => setLength(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
        <TextField label="Ширина, м" type="number" value={width} onChange={(event) => setWidth(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
        <TextField label="Высота, м" type="number" value={height} onChange={(event) => setHeight(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
      </Box>
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary">Объём бетона</Typography>
        <Typography variant="h5" sx={{ mt: 0.5, color: '#0d47a1', fontWeight: 700 }}>
          {formatNumber(volume)} м³
        </Typography>
      </Paper>
      <Button variant="outlined" onClick={reset} disabled={!length && !width && !height}>Сброс</Button>
    </Box>
  );
};

export default ConcreteCalculator;