import React, { useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';

const formatNumber = (value: number) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

const RebarCalculator: React.FC = () => {
  const [length, setLength] = useState('');
  const [weightPerMeter, setWeightPerMeter] = useState('');

  const weight = (Number(length) || 0) * (Number(weightPerMeter) || 0);

  const reset = () => {
    setLength('');
    setWeightPerMeter('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
        <TextField label="Длина, м" type="number" value={length} onChange={(event) => setLength(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
        <TextField label="Вес 1 метра, кг" type="number" value={weightPerMeter} onChange={(event) => setWeightPerMeter(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
      </Box>
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary">Общий вес арматуры</Typography>
        <Typography variant="h5" sx={{ mt: 0.5, color: '#c62828', fontWeight: 700 }}>
          {formatNumber(weight)} кг
        </Typography>
      </Paper>
      <Button variant="outlined" onClick={reset} disabled={!length && !weightPerMeter}>Сброс</Button>
    </Box>
  );
};

export default RebarCalculator;