import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FoundationIcon from '@mui/icons-material/Foundation';
import LayersIcon from '@mui/icons-material/Layers';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import GridViewIcon from '@mui/icons-material/GridView';
import TextureIcon from '@mui/icons-material/Texture';
import StraightenIcon from '@mui/icons-material/Straighten';
import ConstructionIcon from '@mui/icons-material/Construction';
import PaletteIcon from '@mui/icons-material/Palette';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import SquareFootIcon from '@mui/icons-material/SquareFoot';
import RoofingIcon from '@mui/icons-material/Roofing';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ConcreteCalculator from '../components/calculators/ConcreteCalculator';
import ScreedCalculator from '../components/calculators/ScreedCalculator';
import WallpaperCalculator from '../components/calculators/WallpaperCalculator';
import PaintCalculator from '../components/calculators/PaintCalculator';
import BrickCalculator from '../components/calculators/BrickCalculator';
import TileCalculator from '../components/calculators/TileCalculator';
import PlasterCalculator from '../components/calculators/PlasterCalculator';
import RebarCalculator from '../components/calculators/RebarCalculator';
import DrywallCalculator from '../components/calculators/DrywallCalculator';
import PuttyCalculator from '../components/calculators/PuttyCalculator';
import DecorativePlasterCalculator from '../components/calculators/DecorativePlasterCalculator';
import DecorativeStoneCalculator from '../components/calculators/DecorativeStoneCalculator';
import Panel3DCalculator from '../components/calculators/Panel3DCalculator';
import MdfPvcPanelCalculator from '../components/calculators/MdfPvcPanelCalculator';
import LiningCalculator from '../components/calculators/LiningCalculator';
import LinoleumCalculator from '../components/calculators/LinoleumCalculator';
import SelfLevelingFloorCalculator from '../components/calculators/SelfLevelingFloorCalculator';
import PorcelainTileCalculator from '../components/calculators/PorcelainTileCalculator';
import GroutCalculator from '../components/calculators/GroutCalculator';
import StretchCeilingCalculator from '../components/calculators/StretchCeilingCalculator';
import CeilingInsulationCalculator from '../components/calculators/CeilingInsulationCalculator';
import FoamBlockCalculator from '../components/calculators/FoamBlockCalculator';

interface CalculatorDefinition {
  title: string;
  description: string;
  keywords: string[];
  icon: React.ReactNode;
  component: React.ReactNode;
}

interface CalculatorSection {
  title: string;
  calculators: CalculatorDefinition[];
}

const calculatorSections: CalculatorSection[] = [
  {
    title: 'Полы',
    calculators: [
      { title: 'Стяжка', description: 'Объём стяжки и ориентировочный вес цемента с песком.', keywords: ['стяжка', 'цемент', 'песок', 'пол'], icon: <LayersIcon />, component: <ScreedCalculator /> },
      { title: 'Ламинат / плитка', description: 'Количество элементов с запасом на подрезку.', keywords: ['ламинат', 'плитка', 'пол', 'запас'], icon: <GridViewIcon />, component: <TileCalculator /> },
      { title: 'Линолеум', description: 'Площадь покрытия с запасом 5%.', keywords: ['линолеум', 'пол', 'покрытие'], icon: <SquareFootIcon />, component: <LinoleumCalculator /> },
      { title: 'Наливной пол', description: 'Вес смеси по площади, толщине слоя и расходу.', keywords: ['наливной пол', 'смесь', 'толщина', 'расход'], icon: <ConstructionIcon />, component: <SelfLevelingFloorCalculator /> },
      { title: 'Керамогранит / плитка', description: 'Количество плитки с запасом 10%.', keywords: ['керамогранит', 'плитка', 'пол', 'запас'], icon: <ViewInArIcon />, component: <PorcelainTileCalculator /> },
      { title: 'Затирка для кафеля', description: 'Ориентировочный вес затирки по размеру плитки и шву.', keywords: ['затирка', 'кафель', 'шов', 'плитка'], icon: <PaletteIcon />, component: <GroutCalculator /> },
    ],
  },
  {
    title: 'Стены и отделка',
    calculators: [
      { title: 'Обои', description: 'Количество рулонов по площади стен и покрытию рулона.', keywords: ['обои', 'стены', 'рулон'], icon: <WallpaperIcon />, component: <WallpaperCalculator /> },
      { title: 'Краска', description: 'Необходимый объём краски по площади и расходу.', keywords: ['краска', 'стены', 'отделка'], icon: <FormatColorFillIcon />, component: <PaintCalculator /> },
      { title: 'Штукатурка', description: 'Вес смеси по площади, толщине слоя и расходу.', keywords: ['штукатурка', 'стены', 'смесь'], icon: <TextureIcon />, component: <PlasterCalculator /> },
      { title: 'Шпатлёвка старт / финиш', description: 'Количество стартовой и финишной шпатлёвки.', keywords: ['шпатлёвка', 'шпаклёвка', 'старт', 'финиш'], icon: <ConstructionIcon />, component: <PuttyCalculator /> },
      { title: 'Декоративная штукатурка', description: 'Вес декоративной штукатурки по площади и расходу.', keywords: ['декоративная штукатурка', 'отделка', 'стены'], icon: <PaletteIcon />, component: <DecorativePlasterCalculator /> },
      { title: 'Декоративный камень', description: 'Площадь камня с запасом 10%.', keywords: ['камень', 'декоративный камень', 'стены'], icon: <ViewModuleIcon />, component: <DecorativeStoneCalculator /> },
      { title: 'Гипсокартон (ГКЛ)', description: 'Листы, профиль и саморезы по площади.', keywords: ['гкл', 'гипсокартон', 'профиль', 'саморезы'], icon: <ViewInArIcon />, component: <DrywallCalculator /> },
      { title: '3D-панели', description: 'Количество панелей по площади поверхности.', keywords: ['3d панели', 'панели', 'стены'], icon: <ViewInArIcon />, component: <Panel3DCalculator /> },
      { title: 'Панели МДФ / ПВХ', description: 'Количество панелей с запасом 10%.', keywords: ['мдф', 'пвх', 'панели', 'отделка'], icon: <GridViewIcon />, component: <MdfPvcPanelCalculator /> },
      { title: 'Вагонка / брус', description: 'Количество досок с запасом 10%.', keywords: ['вагонка', 'брус', 'доска', 'отделка'], icon: <AccountTreeIcon />, component: <LiningCalculator /> },
      { title: 'Кирпич', description: 'Количество кирпичей для площади стены.', keywords: ['кирпич', 'стена', 'кладка'], icon: <ViewModuleIcon />, component: <BrickCalculator /> },
    ],
  },
  {
    title: 'Потолки',
    calculators: [
      { title: 'Натяжной потолок', description: 'Площадь полотна по площади комнаты.', keywords: ['натяжной потолок', 'потолок', 'полотно'], icon: <RoofingIcon />, component: <StretchCeilingCalculator /> },
      { title: 'Утепление потолка', description: 'Площадь утеплителя с запасом 5%.', keywords: ['утепление', 'потолок', 'утеплитель'], icon: <AcUnitIcon />, component: <CeilingInsulationCalculator /> },
    ],
  },
  {
    title: 'Фундамент и блоки',
    calculators: [
      { title: 'Бетон (фундамент)', description: 'Рассчитайте объём бетона по размерам фундамента.', keywords: ['бетон', 'фундамент', 'объём'], icon: <FoundationIcon />, component: <ConcreteCalculator /> },
      { title: 'Арматура', description: 'Общий вес арматуры по длине и весу метра.', keywords: ['арматура', 'фундамент', 'вес'], icon: <StraightenIcon />, component: <RebarCalculator /> },
      { title: 'Пеноблоки', description: 'Количество блоков по объёму стены и блока.', keywords: ['пеноблоки', 'блоки', 'стена', 'объём'], icon: <AccountTreeIcon />, component: <FoamBlockCalculator /> },
    ],
  },
];

const Calculators: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSearch && isMobile) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isMobile, showSearch]);

  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ru-RU');

    if (!query) {
      return calculatorSections;
    }

    return calculatorSections
      .map((section) => ({
        ...section,
        calculators: section.calculators.filter((calculator) =>
          [calculator.title, calculator.description, ...calculator.keywords]
            .join(' ')
            .toLocaleLowerCase('ru-RU')
            .includes(query),
        ),
      }))
      .filter((section) => section.calculators.length > 0);
  }, [searchQuery]);

  const closeMobileSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: { xs: 2, md: 3 } }}>
        <Typography variant="h4" component="h1" sx={{ color: '#04164b', fontWeight: 700, mb: 0.75 }}>
          Калькуляторы
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Быстрые расчёты для строительных материалов и работ
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'stretch' }, mb: { xs: 2.5, md: 3 } }}>
        {isMobile && !showSearch ? (
          <IconButton
            aria-label="Открыть поиск"
            onClick={() => setShowSearch(true)}
            sx={{ bgcolor: '#e3f2fd', color: '#1976d2', '&:hover': { bgcolor: '#bbdefb' } }}
          >
            <SearchIcon />
          </IconButton>
        ) : (
          <TextField
            fullWidth
            inputRef={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            label="Поиск калькулятора"
            placeholder="Например, бетон или плитка"
            sx={{ maxWidth: { md: 520 }, '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: 2 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              ...(isMobile
                ? {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton aria-label="Закрыть поиск" edge="end" onClick={closeMobileSearch}>
                          <CloseIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }
                : {}),
            }}
          />
        )}
      </Box>

      {filteredSections.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 4 } }}>
          {filteredSections.map((section) => (
            <Box key={section.title}>
              <Typography
                component="h2"
                variant="h5"
                sx={{ color: '#04164b', fontWeight: 700, mb: 1.5, pb: 1, borderBottom: '2px solid #e3f2fd' }}
              >
                {section.title}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : { sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
                  gap: { xs: 2, md: 2.5 },
                }}
              >
                {section.calculators.map((calculator) => (
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
                        <Typography variant="h6" component="h3" sx={{ color: '#04164b', fontWeight: 700, lineHeight: 1.25 }}>
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
            </Box>
          ))}
        </Box>
      ) : (
        <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, textAlign: 'center', bgcolor: '#fff', border: '1px dashed #90caf9', borderRadius: 3 }}>
          <SearchIcon sx={{ fontSize: 42, color: '#90caf9', mb: 1 }} />
          <Typography variant="h6" sx={{ color: '#173b6c', fontWeight: 700 }}>
            Калькуляторы не найдены
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Попробуйте изменить поисковый запрос.
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default Calculators;