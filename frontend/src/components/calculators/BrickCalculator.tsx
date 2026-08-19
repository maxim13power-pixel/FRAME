import React, { useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';

const BrickCalculator: React.FC = () => {
  const [wallArea, setWallArea] = useState('');
  const [bricksPerSquareMeter, setBricksPerSquareMeter] = useState('');

  const bricks = Math.ceil((Number(wallArea) || 0) * (Number(bricksPerSquareMeter) || 0));

  const reset = () => {
    setWallArea('');
    setBricksPerSquareMeter('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
        <TextField label="Площадь стены, м²" type="number" value={wallArea} onChange={(event) => setWallArea(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
        <TextField label="Штук на 1 м²" type="number" value={bricksPerSquareMeter} onChange={(event) => setBricksPerSquareMeter(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
      </Box>
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#efebe9', border: '1px solid #bcaaa4', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary">Необходимое количество кирпича</Typography>
        <Typography variant="h5" sx={{ mt: 0.5, color: '#5d4037', fontWeight: 700 }}>
          {bricks} шт.
        </Typography>
      </Paper>
      <Button variant="outlined" onClick={reset} disabled={!wallArea && !bricksPerSquareMeter}>Сброс</Button>
    </Box>
  );
};

export default BrickCalculator;