import React from 'react';
import { Button, Typography } from '@mui/material';

interface DashboardButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const DashboardButton: React.FC<DashboardButtonProps> = ({ label, icon, onClick }) => {
  return (
    <Button
      variant="contained"
      fullWidth
      onClick={onClick}
      sx={(_theme) => ({
        py: 3,
        borderRadius: 2,
        bgcolor: '#1976d2',
        color: '#fff',
        fontWeight: 'bold',
        fontSize: {
          xs: '0.9rem',
          sm: '1rem',
          md: '1.1rem',
        },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        minHeight: 120,
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          bgcolor: '#1565C0',
          transform: 'translateY(-3px)',
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
        },
        '& .MuiSvgIcon-root': {
          fontSize: {
            xs: 30,
            sm: 36,
            md: 40,
          },
        },
      } as const)}
    >
      {icon}
      <Typography variant="button" sx={{ mt: 1, fontSize: 'inherit' }}>
        {label}
      </Typography>
    </Button>
  );
};

export default DashboardButton;