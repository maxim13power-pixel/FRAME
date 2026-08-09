import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const Warehouse: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Склад
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Здесь будет список оборудования.</Typography>
      </Paper>
    </Box>
  );
};

export default Warehouse;