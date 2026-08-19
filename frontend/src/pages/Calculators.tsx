import React from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FoundationIcon from '@mui/icons-material/Foundation';
import LayersIcon from '@mui/icons-material/Layers';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import GridViewIcon from '@mui/icons-material/GridView';
import TextureIcon from '@mui/icons-material/Texture';
import StraightenIcon from '@mui/icons-material/Straighten';
import ConcreteCalculator from '../components/calculators/ConcreteCalculator';
import ScreedCalculator from '../components/calculators/ScreedCalculator';
import WallpaperCalculator from '../components/calculators/WallpaperCalculator';
import PaintCalculator from '../components/calculators/PaintCalculator';
import BrickCalculator from '../components/calculators/BrickCalculator';
import TileCalculator from '../components/calculators/TileCalculator';
import PlasterCalculator from '../components/calculators/PlasterCalculator';
import RebarCalculator from '../components/calculators/RebarCalculator';

const calculators = [
  { title: 'Бетон (фундамент)', description: 'Рассчитайте объём бетона по размерам фундамента.', icon: <FoundationIcon />, component: <ConcreteCalculator /> },
  { title: 'Стяжка', description: 'Объём стяжки и ориентировочный вес цемента с песком.', icon: <LayersIcon />, component: <ScreedCalculator /> },
  { title: 'Обои', description: 'Количество рулонов по площади стен и покрытию рулона.', icon: <WallpaperIcon />, component: <WallpaperCalculator /> },
  { title: 'Краска', description: 'Необходимый объём краски по площади и расходу.', icon: <FormatColorFillIcon />, component: <PaintCalculator /> },
  { title: 'Кирпич', description: 'Количество кирпичей для площади стены.', icon: <ViewModuleIcon />, component: <BrickCalculator /> },
  { title: 'Ламинат / плитка', description: 'Количество элементов с запасом на подрезку.', icon: <GridViewIcon />, component: <TileCalculator /> },
  { title: 'Штукатурка', description: 'Вес смеси по площади, толщине слоя и расходу.', icon: <TextureIcon />, component: <PlasterCalculator /> },
  { title: 'Арматура', description: 'Общий вес арматуры по длине и весу метра.', icon: <StraightenIcon />, component: <RebarCalculator /> },
];

const Calculators: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ color: '#04164b', fontWeight: 700, mb: 0.75 }}>
          Калькуляторы
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Быстрые расчёты для строительных материалов и работ
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : { sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
          gap: { xs: 2, md: 2.5 },
        }}
      >
        {calculators.map((calculator) => (
          <Paper
            key={calculator.title}
            elevation={2}
            sx={{
              p: { xs: 2, md: 2.5 },
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              border: '1px solid #e3edf8',
              transition: 'box-shadow 0.2s ease, transform 0.2s ease',
              '&:hover': { boxShadow: 5, transform: { md: 'translateY(-2px)' } },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, flexShrink: 0, borderRadius: 2, bgcolor: '#e3f2fd', color: '#1976d2' }}>
                {calculator.icon}
              </Box>
              <Box>
                <Typography variant="h6" component="h2" sx={{ color: '#04164b', fontWeight: 700, lineHeight: 1.25 }}>
                  {calculator.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {calculator.description}
                </Typography>
              </Box>
            </Box>
            {calculator.component}
          </Paper>
        ))}
      </Box>
    </Container>
  );
};

export default Calculators;