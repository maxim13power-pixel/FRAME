import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const Analytics: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Аналитика
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Здесь будут графики и отчёты.</Typography>
      </Paper>
    </Box>
  );
};

export default Analytics;