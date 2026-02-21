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
        transition: 'transform 0.2s',
        '&:hover': onClick ? { transform: 'scale(1.02)' } : {},
      }}
    >
      <Avatar
        src="/images/frame-logo2.svg"
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