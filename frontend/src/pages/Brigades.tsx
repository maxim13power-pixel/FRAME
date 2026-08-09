import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const Brigades: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Бригады
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Здесь будет учёт выхода бригад.</Typography>
      </Paper>
    </Box>
  );
};

export default Brigades;