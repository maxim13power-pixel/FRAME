import React, { useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';

const WallpaperCalculator: React.FC = () => {
  const [wallArea, setWallArea] = useState('');
  const [rollCoverage, setRollCoverage] = useState('');

  const rolls = Math.ceil((Number(wallArea) || 0) / (Number(rollCoverage) || 1));

  const reset = () => {
    setWallArea('');
    setRollCoverage('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
        <TextField label="Площадь стен, м²" type="number" value={wallArea} onChange={(event) => setWallArea(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
        <TextField label="Покрытие рулона, м²" type="number" value={rollCoverage} onChange={(event) => setRollCoverage(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
      </Box>
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary">Необходимое количество</Typography>
        <Typography variant="h5" sx={{ mt: 0.5, color: '#e65100', fontWeight: 700 }}>
          {rolls} шт. рулонов
        </Typography>
      </Paper>
      <Button variant="outlined" onClick={reset} disabled={!wallArea && !rollCoverage}>Сброс</Button>
    </Box>
  );
};

export default WallpaperCalculator;