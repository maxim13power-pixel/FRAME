import React, { useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';

const formatNumber = (value: number) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

const ScreedCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [thickness, setThickness] = useState('');

  const volume = (Number(area) || 0) * (Number(thickness) || 0) / 100;
  const cement = volume * 300;
  const sand = volume * 1500;

  const reset = () => {
    setArea('');
    setThickness('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
        <TextField label="Площадь, м²" type="number" value={area} onChange={(event) => setArea(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
        <TextField label="Толщина, см" type="number" value={thickness} onChange={(event) => setThickness(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
      </Box>
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary">Расчёт стяжки</Typography>
        <Typography variant="h6" sx={{ mt: 0.5, color: '#1b5e20', fontWeight: 700 }}>
          {formatNumber(volume)} м³
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>Цемент: <strong>{formatNumber(cement)} кг</strong></Typography>
        <Typography variant="body2">Песок: <strong>{formatNumber(sand)} кг</strong></Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Расчёт по норме 300 кг цемента и 1500 кг песка на 1 м³
        </Typography>
      </Paper>
      <Button variant="outlined" onClick={reset} disabled={!area && !thickness}>Сброс</Button>
    </Box>
  );
};

export default ScreedCalculator;