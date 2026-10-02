import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper } from '@mui/material';
import { useMobileHeader } from '../contexts/MobileHeaderContext';

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  useMobileHeader({ title: 'Аналитика', onBack: () => navigate(-1) });

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ display: { xs: 'none', md: 'block' } }}>
        Аналитика
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Здесь будут графики и отчёты.</Typography>
      </Paper>
    </Box>
  );
};

export default Analytics;