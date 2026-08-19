import React, { useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';

const TileCalculator: React.FC = () => {
  const [area, setArea] = useState('');
  const [pieceArea, setPieceArea] = useState('');

  const pieces = Math.ceil(((Number(area) || 0) * 1.05) / (Number(pieceArea) || 1));

  const reset = () => {
    setArea('');
    setPieceArea('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
        <TextField label="Площадь поверхности, м²" type="number" value={area} onChange={(event) => setArea(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
        <TextField label="Площадь одной штуки, м²" type="number" value={pieceArea} onChange={(event) => setPieceArea(event.target.value)} inputProps={{ min: 0, step: 'any' }} />
      </Box>
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#e0f7fa', border: '1px solid #80deea', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary">С запасом 5%</Typography>
        <Typography variant="h5" sx={{ mt: 0.5, color: '#006064', fontWeight: 700 }}>
          {pieces} шт.
        </Typography>
      </Paper>
      <Button variant="outlined" onClick={reset} disabled={!area && !pieceArea}>Сброс</Button>
    </Box>
  );
};

export default TileCalculator;