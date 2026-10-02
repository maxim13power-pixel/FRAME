import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper } from '@mui/material';
import { useMobileHeader } from '../contexts/MobileHeaderContext';

const Brigades: React.FC = () => {
  const navigate = useNavigate();
  useMobileHeader({ title: 'Бригады', onBack: () => navigate(-1) });

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ display: { xs: 'none', md: 'block' } }}>
        Бригады
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Здесь будет учёт выхода бригад.</Typography>
      </Paper>
    </Box>
  );
};

export default Brigades;