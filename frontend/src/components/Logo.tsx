import React from 'react';
import { Box, Avatar, Typography } from '@mui/material';

interface LogoProps {
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
}

const Logo: React.FC<LogoProps> = ({ onClick, size = 'medium' }) => {
  const avatarSize = size === 'small' ? 40 : size === 'medium' ? 60 : 80;
  const fontSize = size === 'small' ? '1.2rem' : size === 'medium' ? '1.5rem' : '2rem';

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        cursor: onClick ? 'pointer' : 'default',
        // ⭐ Hover как у пунктов меню: только затемнение фона, без масштаба.
        // Отрицательные margin компенсируют padding — шапка не «прыгает».
        mx: onClick ? -0.5 : 0,
        my: onClick ? -0.5 : 0,
        px: onClick ? 0.5 : 0,
        py: onClick ? 0.5 : 0,
        borderRadius: '8px',
        transition: onClick ? 'background-color 250ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        '&:hover': onClick ? { bgcolor: 'rgba(0, 0, 0, 0.06)' } : {},
      }}
    >
      <Avatar
        src="/images/frame-logo2.svg?v=2"
        alt="FRAME"
        sx={{ width: avatarSize, height: avatarSize }}
      />
      <Typography
        variant="h6"
        sx={{
          fontWeight: 780,
          color: '#04164b',
          fontSize,
        }}
      >
        FRAME
      </Typography>
    </Box>
  );
};

export default Logo;