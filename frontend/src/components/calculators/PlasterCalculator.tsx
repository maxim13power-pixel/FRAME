import React, { useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';

const formatNumber = (value: number) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

const PlasterCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [thickness, setThickness] = useState('');
  const [consumption, setConsumption] = useState('');

  const plasterWeight =
    (Number(area) || 0) * (Number(thickness) || 0) * (Number(consumption) || 0);

  const reset = () => {
    setArea('');
    setThickness('');
    setConsumption('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
        <TextField label="Площадь, м²" type="number" value={area} onChange={(event) => setArea(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
        <TextField label="Толщина, мм" type="number" value={thickness} onChange={(event) => setThickness(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
        <TextField label="Расход, кг/м² на 1 мм" type="number" value={consumption} onChange={(event) => setConsumption(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
      </Box>
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary">Необходимый объём штукатурки</Typography>
        <Typography variant="h5" sx={{ mt: 0.5, color: '#6a1b9a', fontWeight: 700 }}>
          {formatNumber(plasterWeight)} кг
        </Typography>
      </Paper>
      <Button variant="outlined" onClick={reset} disabled={!area && !thickness && !consumption}>Сброс</Button>
    </Box>
  );
};

export default PlasterCalculator;