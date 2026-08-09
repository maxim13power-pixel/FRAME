import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const Rentals: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Аренда
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Здесь будет учёт аренды.</Typography>
      </Paper>
    </Box>
  );
};

export default Rentals;