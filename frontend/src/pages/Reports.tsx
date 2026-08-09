import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const Reports: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Отчёты
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Здесь можно сформировать отчёты.</Typography>
      </Paper>
    </Box>
  );
};

export default Reports;