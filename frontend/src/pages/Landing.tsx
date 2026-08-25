import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SpeedIcon from '@mui/icons-material/Speed';
import LinkIcon from '@mui/icons-material/Link';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import HomeWorkIcon from '@mui/icons-material/HomeWork';

const benefits = [
  {
    title: 'Закрываешь акт за 5 минут',
    description: 'фиксация одним тапом, фотофиксации как доказательство скрытых работ.',
    icon: <SpeedIcon />,
  },
  {
    title: 'Заказчик видит прогресс по ссылке',
    description: 'портал заказчика без установки приложения.',
    icon: <LinkIcon />,
  },
  {
    title: 'Смета пересчитывается сама',
    description: 'цены меняются, смета не плывёт.',
    icon: <AutoGraphIcon />,
  },
];

const steps = [
  { title: 'Создай объект', icon: <AddBusinessIcon /> },
  { title: 'Добавь смету', icon: <ReceiptLongIcon /> },
  { title: 'Фиксируй объёмы', icon: <TouchAppIcon /> },
];

const tariffs = [
  {
    name: 'Free',
    price: 'Free',
    details: ['1 объект', '30 позиций', '2 проекта'],
  },
  {
    name: 'Pro',
    price: '499 ₽/мес',
    details: ['без лимитов', 'PDF-сметы', 'фотофиксации'],
    popular: true,
  },
  {
    name: 'Team',
    price: '1490 ₽/мес',
    details: ['5 пользователей', 'портал заказчика'],
  },
];

const faq = [
  {
    question: 'Работает без интернета?',
    answer: 'да, синк при появлении сети.',
  },
  {
    question: 'Можно импортировать смету из Excel?',
    answer: 'да, Pro.',
  },
  {
    question: 'Дать доступ заказчику?',
    answer: 'да, Team.',
  },
];

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fa', color: '#172033', overflowX: 'hidden' }}>
      <Container
        maxWidth={false}
        sx={{
          maxWidth: 1000,
          px: { xs: 2, sm: 3 },
          py: { xs: 2, md: 3 },
        }}
      >
        <Box
          component="header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 48,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HomeWorkIcon sx={{ color: '#1565c0', fontSize: 30 }} />
            <Typography variant="h6" sx={{ color: '#0d2d5c', fontWeight: 800, letterSpacing: 1 }}>
              FRAME
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={() => navigate('/login')}
            sx={{ minHeight: 48, borderColor: '#1565c0', color: '#1565c0', px: 2.5 }}
          >
            Войти
          </Button>
        </Box>
      </Container>

      <Box
        component="main"
        sx={{
          background: 'linear-gradient(145deg, #f5f7fa 0%, #eaf2fc 100%)',
          borderTop: '1px solid rgba(21, 101, 192, 0.08)',
          borderBottom: '1px solid rgba(21, 101, 192, 0.08)',
        }}
      >
        <Container
          maxWidth={false}
          sx={{
            maxWidth: 1000,
            px: { xs: 2, sm: 3 },
            py: { xs: 7, md: 11 },
            textAlign: 'center',
          }}
        >
          <Typography
            component="h1"
            sx={{
              color: '#0d2d5c',
              fontSize: { xs: '2.4rem', sm: '3.5rem', md: '4.25rem' },
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.05,
              maxWidth: 760,
              mx: 'auto',
            }}
          >
            Смета стройки без бумаги
          </Typography>
          <Typography
            sx={{
              mt: 2.5,
              color: '#53657c',
              fontSize: { xs: '1.05rem', md: '1.25rem' },
              lineHeight: 1.55,
              maxWidth: 620,
              mx: 'auto',
            }}
          >
            Фиксация объёма за 8 секунд. Смета и материалы прораба — онлайн.
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            justifyContent="center"
            sx={{ mt: 4 }}
          >
            <Button
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{ minHeight: 52, px: 4, bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' } }}
            >
              Войти
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/login')}
              sx={{ minHeight: 52, px: 4, borderColor: '#1565c0', color: '#1565c0' }}
            >
              Регистрация
            </Button>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth={false} sx={{ maxWidth: 1000, px: { xs: 2, sm: 3 }, py: { xs: 7, md: 10 } }}>
        <Box component="section" aria-label="Три выгоды">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: 2,
            }}
          >
            {benefits.map((benefit) => (
              <Paper
                key={benefit.title}
                elevation={0}
                sx={{
                  p: { xs: 2.5, md: 3 },
                  minHeight: 190,
                  bgcolor: '#fff',
                  borderRadius: 3,
                  border: '1px solid #e2e8f0',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 2, bgcolor: '#e8f1fc', color: '#1565c0', mb: 2 }}>
                  {benefit.icon}
                </Box>
                <Typography variant="h6" sx={{ color: '#0d2d5c', fontWeight: 700, lineHeight: 1.25 }}>
                  {benefit.title}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, color: '#53657c', lineHeight: 1.6 }}>
                  {benefit.description}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Box>

        <Box component="section" sx={{ mt: { xs: 8, md: 11 } }}>
          <Typography component="h2" variant="h4" sx={{ color: '#0d2d5c', fontWeight: 800, textAlign: 'center', mb: 4 }}>
            КАК ЭТО РАБОТАЕТ
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: { xs: 2, md: 3 },
            }}
          >
            {steps.map((step, index) => (
              <Box key={step.title} sx={{ position: 'relative', textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, mx: 'auto', borderRadius: '50%', bgcolor: '#1565c0', color: '#fff' }}>
                  {step.icon}
                </Box>
                <Typography variant="h6" sx={{ mt: 1.5, color: '#0d2d5c', fontWeight: 700 }}>
                  {step.title}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: '#1565c0', fontWeight: 700 }}>
                  {index + 1}.
                </Typography>
                {!isMobile && index < steps.length - 1 && (
                  <Divider sx={{ position: 'absolute', top: 32, left: '66%', width: '68%', borderColor: '#b8d0ed' }} />
                )}
              </Box>
            ))}
          </Box>
        </Box>

        <Box component="section" sx={{ mt: { xs: 8, md: 11 } }}>
          <Typography component="h2" variant="h4" sx={{ color: '#0d2d5c', fontWeight: 800, textAlign: 'center', mb: 4 }}>
            ТАРИФЫ
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: 2,
              alignItems: 'stretch',
            }}
          >
            {tariffs.map((tariff) => (
              <Paper
                key={tariff.name}
                elevation={tariff.popular ? 3 : 0}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  p: { xs: 2.5, md: 3 },
                  bgcolor: '#fff',
                  borderRadius: 3,
                  border: tariff.popular ? '2px solid #1565c0' : '1px solid #e2e8f0',
                }}
              >
                {tariff.popular && (
                  <Box sx={{ position: 'absolute', top: 0, right: 20, px: 1.5, py: 0.5, bgcolor: '#1565c0', color: '#fff', borderRadius: '0 0 8px 8px', fontSize: '0.75rem', fontWeight: 700 }}>
                    Популярный
                  </Box>
                )}
                <Typography variant="h5" sx={{ color: '#0d2d5c', fontWeight: 800 }}>
                  {tariff.name}
                </Typography>
                <Typography sx={{ mt: 1, color: '#1565c0', fontSize: '1.55rem', fontWeight: 800 }}>
                  {tariff.price}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {tariff.details.map((detail) => (
                    <Box key={detail} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <CheckCircleOutlineIcon sx={{ color: '#2e7d32', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ color: '#53657c' }}>{detail}</Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>

        <Box component="section" sx={{ mt: { xs: 8, md: 11 }, maxWidth: 760, mx: 'auto' }}>
          <Typography component="h2" variant="h4" sx={{ color: '#0d2d5c', fontWeight: 800, textAlign: 'center', mb: 4 }}>
            FAQ
          </Typography>
          {faq.map((item) => (
            <Accordion key={item.question} disableGutters elevation={0} sx={{ bgcolor: 'transparent', borderBottom: '1px solid #d9e2ed', '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 56, px: 0, '& .MuiAccordionSummary-content': { my: 1.5 } }}>
                <Typography sx={{ color: '#0d2d5c', fontWeight: 700 }}>{item.question}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 0, pt: 0, pb: 2 }}>
                <Typography sx={{ color: '#53657c' }}>{item.answer}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>

        <Box sx={{ mt: { xs: 7, md: 9 }, p: { xs: 3, md: 5 }, textAlign: 'center', bgcolor: '#e8f1fc', borderRadius: 3 }}>
          <Button
            variant="contained"
            onClick={() => navigate('/login')}
            sx={{ minHeight: 52, px: 4, bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' } }}
          >
            Начать бесплатно
          </Button>
        </Box>
      </Container>

      <Box component="footer" sx={{ py: 3, px: 2, bgcolor: '#0d2d5c', color: '#fff', textAlign: 'center' }}>
        <Typography variant="body2">
          FRAME © 2026 •{' '}
          <Box component="a" href="https://t.me/frame_inf" target="_blank" rel="noopener noreferrer" sx={{ color: '#fff', textDecorationColor: 'rgba(255,255,255,0.6)' }}>
            Telegram https://t.me/frame_inf
          </Box>
        </Typography>
      </Box>
    </Box>
  );
};

export default Landing;