import React, { useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';

const formatNumber = (value: number) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

const PaintCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [consumption, setConsumption] = useState('');

  const liters = (Number(area) || 0) * (Number(consumption) || 0);

  const reset = () => {
    setArea('');
    setConsumption('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
        <TextField label="Площадь, м²" type="number" value={area} onChange={(event) => setArea(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
        <TextField label="Расход, л/м²" type="number" value={consumption} onChange={(event) => setConsumption(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
      </Box>
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#fce4ec', border: '1px solid #f48fb1', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary">Необходимый объём краски</Typography>
        <Typography variant="h5" sx={{ mt: 0.5, color: '#ad1457', fontWeight: 700 }}>
          {formatNumber(liters)} л
        </Typography>
      </Paper>
      <Button variant="outlined" onClick={reset} disabled={!area && !consumption}>Сброс</Button>
    </Box>
  );
};

export default PaintCalculator;