import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip,
  Container, LinearProgress, Link, Paper, Stack, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { keyframes } from '@mui/material/styles';

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const PhoneDemo: React.FC = () => (
  <Box sx={{ width: 300, maxWidth: '100%', mx: 'auto', bgcolor: '#04164b', borderRadius: '28px', p: '10px', boxShadow: '0 32px 64px rgba(0,0,0,0.45)' }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 0.5 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>9:41</Typography>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Box sx={{ width: 14, height: 8, borderRadius: 0.5, border: '1px solid rgba(255,255,255,0.6)' }} />
        <Box sx={{ width: 20, height: 10, borderRadius: 1, border: '1px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', px: '1px' }}>
          <Box sx={{ width: '70%', height: '100%', bgcolor: 'rgba(255,255,255,0.8)', borderRadius: 0.5 }} />
        </Box>
      </Stack>
    </Stack>
    <Box sx={{ bgcolor: '#f5f7fa', borderRadius: '18px', p: 1.5 }}>
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: '#4a5a6a' }}>ДЕНЬГИ • ВСЕ ОБЪЕКТЫ</Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#04164b', mt: 0.5 }}>1 664 309 ₽</Typography>
        <Typography sx={{ fontSize: 11, color: '#4a5a6a' }}>из 8 547 240 ₽ по смете</Typography>
        <Box sx={{ mt: 1 }}>
          <LinearProgress variant="determinate" value={29} sx={{ height: 8, borderRadius: 4, bgcolor: '#dbe3ee', '& .MuiLinearProgress-bar': { bgcolor: '#1565c0', borderRadius: 4 } }} />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
            <Typography sx={{ fontSize: 10, color: '#4a5a6a' }}>Освоено</Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#1565c0' }}>29%</Typography>
          </Stack>
        </Box>
      </Paper>
      <Chip size="small" label="🔥 Просрочено 2 дн • Крыша" sx={{ mt: 1.5, height: 24, bgcolor: '#c62828', color: '#fff', fontWeight: 700, fontSize: 11 }} />
      <Stack spacing={1} sx={{ mt: 1.5 }}>
        {[{ text: '+12 м² штукатурки', meta: '5 мин назад' }, { text: '+8 мешков цемента М500', meta: '1 ч назад' }, { text: '+30 м проводки', meta: 'вчера' }].map((f) => (
          <Stack key={f.text} direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#04164b' }}>{f.text}</Typography>
            <Typography sx={{ fontSize: 10, color: '#4a5a6a' }}>{f.meta}</Typography>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" justifyContent="space-around" sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        {[0, 1, 2, 3].map((i) => <Box key={i} sx={{ width: 28, height: 5, borderRadius: 2.5, bgcolor: i === 0 ? '#1565c0' : '#c6d3e3' }} />)}
      </Stack>
    </Box>
  </Box>
);

const FixButtonMockup: React.FC<{ onCta: () => void }> = ({ onCta }) => (
  <Box sx={{ maxWidth: 360, width: '100%', mx: 'auto' }}>
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#04164b' }}>Штукатурка стен</Typography>
          <Typography sx={{ fontSize: 12, color: '#4a5a6a' }}>Склад 300×800 • стены</Typography>
        </Box>
        <Chip label="78%" size="small" sx={{ bgcolor: '#e8f0fb', color: '#1565c0', fontWeight: 700 }} />
      </Stack>
      <Box sx={{ mt: 2, p: 1.5, borderRadius: '12px', bgcolor: '#f5f7fa', border: '1px dashed', borderColor: '#b9c6d9' }}>
        <Typography sx={{ fontSize: 13, color: '#4a5a6a' }}>Сегодня, +12 м²</Typography>
      </Box>
      <Button fullWidth size="large" disableElevation onClick={onCta} sx={{ mt: 2, minHeight: 48, borderRadius: '8px', fontWeight: 700, bgcolor: '#2e7d32', color: '#fff', '&:hover': { bgcolor: '#1b5e20' } }}>+ Зафиксировать</Button>
      <Typography sx={{ mt: 1.5, textAlign: 'center', fontSize: 12, color: '#4a5a6a' }}>Тап — и объём уже в акте и смете</Typography>
    </Paper>
  </Box>
);

const PortalMockup: React.FC = () => (
  <Box sx={{ maxWidth: 360, width: '100%', mx: 'auto' }}>
    <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, bgcolor: '#f5f7fa', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={0.5}>{[0, 1, 2].map((i) => <Box key={i} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#c6d3e3' }} />)}</Stack>
        <Box sx={{ flex: 1, bgcolor: '#fff', borderRadius: 2, border: '1px solid', borderColor: 'divider', px: 1, py: 0.25 }}>
          <Typography sx={{ fontSize: 11, color: '#4a5a6a' }}>frame.app/p/8xk2</Typography>
        </Box>
      </Stack>
      <Box sx={{ p: 2 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#04164b' }}>Объект: Склад 300×800</Typography>
        {[{ name: 'Крыша', value: 78, color: '#ef6c00' }, { name: 'Электрика', value: 45, color: '#1565c0' }, { name: 'Стяжка', value: 91, color: '#2e7d32' }].map((row) => (
          <Box key={row.name} sx={{ mt: 1.5 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ fontSize: 12, color: '#4a5a6a' }}>{row.name}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#04164b' }}>{row.value}%</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={row.value} sx={{ mt: 0.5, height: 6, borderRadius: 3, bgcolor: '#e2e8f2', '& .MuiLinearProgress-bar': { bgcolor: row.color, borderRadius: 3 } }} />
          </Box>
        ))}
        <Typography sx={{ mt: 2, fontSize: 11, textAlign: 'center', color: '#4a5a6a' }}>Видно без регистрации • Цены скрыты</Typography>
      </Box>
    </Paper>
  </Box>
);

const RecalcMockup: React.FC = () => (
  <Box sx={{ maxWidth: 360, width: '100%', mx: 'auto' }}>
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" justifyContent="space-between" sx={{ pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: '#4a5a6a' }}>ПОЗИЦИЯ</Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: '#4a5a6a' }}>СУММА</Typography>
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#04164b' }}>Штукатурка стен</Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
            <Typography sx={{ fontSize: 12, color: '#4a5a6a' }}>120 м²</Typography>
            <Typography sx={{ fontSize: 12, color: '#5a6a7d', textDecoration: 'line-through' }}>450 ₽/м²</Typography>
            <Chip label="480 ₽/м²" size="small" sx={{ height: 20, fontSize: 11, bgcolor: '#fff3e0', color: '#a34700', fontWeight: 700 }} />
          </Stack>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
          <Typography sx={{ fontSize: 12, color: '#5a6a7d', textDecoration: 'line-through' }}>54 000</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#2e7d32' }}>57 600 ₽</Typography>
        </Stack>
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 1.5 }}>
        <Typography sx={{ fontSize: 12, color: '#4a5a6a' }}>Смета пересчитана автоматически</Typography>
        <Chip label="готово" size="small" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 700 }} />
      </Stack>
    </Paper>
  </Box>
);

const FeatureRow: React.FC<{ label: string }> = ({ label }) => (
  <Stack direction="row" spacing={1} alignItems="center">
    <CheckCircleOutlineIcon sx={{ fontSize: 18, color: '#2e7d32' }} />
    <Typography sx={{ fontSize: 14, color: '#04164b' }}>{label}</Typography>
  </Stack>
);

const pains = [
  { title: 'Бумаги и Excel', text: 'Смета — в тетради, акт — в Word. Каждая правка — переписывать заново.', accent: '#c62828' },
  { title: '«Сколько я уже потратил?»', text: 'Цемент, арматура, работа бригад — итоги держатся в голове прораба.', accent: '#ef6c00' },
  { title: 'Звонки заказчика', text: '«Ну и на каком этапе?» — и ты ищешь последние фото в переписке.', accent: '#1565c0' },
];
const steps = [
  { title: 'Создай объект', text: 'Название, адрес, сроки работ.' },
  { title: 'Добавь смету', text: 'Работы и материалы — из справочника бригады.' },
  { title: 'Фиксируй объёмы', text: 'Один тап на объекте — акт и смета растут сами.' },
];
const faq = [
  { q: 'А если на объекте нет интернета?', a: 'Фиксации сохраняются и отправляются, когда связь появляется. Смета и история всегда под рукой в телефоне.' },
  { q: 'Можно импортировать смету из Excel?', a: 'Импорт из Excel в разработке. Пока позиции добавляются из справочника бригады — расценки уже под рукой, смета на 20 позиций собирается за 10 минут.' },
  { q: 'Как заказчик увидит прогресс?', a: 'В тарифе Team — по ссылке, без установки приложения. Заказчик видит только прогресс и фото, ваши цены и себестоимость скрыты.' },
];

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => setShowSticky(!entries[0].isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const goLogin = () => navigate('/login');
  const scrollToTariffs = () => document.getElementById('tariffs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const benefits = [
    { title: 'Закрываешь акт за 5 минут', description: 'Фиксация одним тапом, фотофиксации — как доказательство скрытых работ.', mockup: <FixButtonMockup onCta={goLogin} /> },
    { title: 'Заказчик видит прогресс по ссылке', description: 'Портал заказчика без установки приложения.', mockup: <PortalMockup /> },
    { title: 'Смета пересчитывается сама', description: 'Цены меняются — смета не плывёт.', mockup: <RecalcMockup /> },
  ];

  return (
    <Box sx={{ bgcolor: '#fff' }}>
      {/* 1. HERO */}
      <Box ref={heroRef} sx={{ background: 'linear-gradient(135deg, #04164b 0%, #1565c0 100%)', color: '#fff' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 5, md: 8 }} alignItems="center">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography component="h1" sx={{ fontSize: { xs: '2.1rem', md: '3.4rem' }, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.5px', animation: `${fadeInUp} 0.6s ease-out both` }}>Смета стройки без бумаги</Typography>
              <Typography sx={{ mt: 2, fontSize: { xs: '1.05rem', md: '1.3rem' }, color: 'rgba(255,255,255,0.92)', lineHeight: 1.5, maxWidth: 480, animation: `${fadeInUp} 0.6s ease-out 0.15s both` }}>Фиксация объёма за 8 секунд. Смета и материалы прораба — онлайн.</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
                <Button variant="contained" disableElevation onClick={goLogin} sx={{ minHeight: 48, px: 4, fontSize: '1rem', fontWeight: 700, borderRadius: '8px', bgcolor: '#fff', color: '#04164b', '&:hover': { bgcolor: '#e8eefc' } }}>Начать бесплатно</Button>
                <Button variant="outlined" onClick={scrollToTariffs} sx={{ minHeight: 48, px: 4, fontSize: '1rem', fontWeight: 700, borderRadius: '8px', color: '#fff', borderColor: 'rgba(255,255,255,0.7)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>Посмотреть цены</Button>
              </Stack>
              <Typography sx={{ mt: 3, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>Бесплатный тариф • Без карты</Typography>
            </Box>
            <Box sx={{ flex: { md: '0 0 340px' }, width: '100%', animation: `${fadeInUp} 0.7s ease-out 0.25s both` }}><PhoneDemo /></Box>
          </Stack>
        </Container>
      </Box>

      {/* 2. БОЛЬ */}
      <Box sx={{ bgcolor: '#f5f7fa', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Typography sx={{ textAlign: 'center', fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 800, color: '#04164b' }}>Устал от…?</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }} alignItems="stretch">
            {pains.map((p) => (
              <Paper key={p.title} elevation={0} sx={{ flex: 1, p: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider', borderTop: `4px solid ${p.accent}`, height: '100%' }}>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#04164b' }}>{p.title}</Typography>
                <Typography sx={{ mt: 1, fontSize: 15, lineHeight: 1.55, color: '#4a5a6a' }}>{p.text}</Typography>
              </Paper>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* 3. ВЫГОДЫ */}
      <Box sx={{ py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          {benefits.map((b, i) => (
            <Stack key={b.title} direction={{ xs: 'column', md: i % 2 === 0 ? 'row' : 'row-reverse' }} spacing={{ xs: 3, md: 8 }} alignItems="center" sx={{ py: { xs: 3, md: 5 } }}>
              <Box sx={{ flex: 1, minWidth: 0, textAlign: { xs: 'left', md: i % 2 === 0 ? 'left' : 'right' } }}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: '#1565c0' }}>0{i + 1}</Typography>
                <Typography sx={{ mt: 0.5, fontSize: { xs: '1.35rem', md: '1.7rem' }, fontWeight: 800, color: '#04164b' }}>{b.title}</Typography>
                <Typography sx={{ mt: 1.5, fontSize: 16, lineHeight: 1.6, color: '#4a5a6a' }}>{b.description}</Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>{b.mockup}</Box>
            </Stack>
          ))}
        </Container>
      </Box>

      {/* 4. КАК ЭТО РАБОТАЕТ */}
      <Box sx={{ bgcolor: '#f5f7fa', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Typography sx={{ textAlign: 'center', fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 800, color: '#04164b' }}>Как это работает</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 4, md: 4 }} sx={{ mt: 4 }}>
            {steps.map((s, i) => (
              <Box key={s.title} sx={{ flex: 1, textAlign: 'center' }}>
                <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#1565c0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', fontWeight: 800, fontSize: 18, boxShadow: '0 8px 20px rgba(21,101,192,0.35)' }}>{i + 1}</Box>
                <Typography sx={{ mt: 2, fontSize: '1.15rem', fontWeight: 700, color: '#04164b' }}>{s.title}</Typography>
                <Typography sx={{ mt: 0.5, fontSize: 14, color: '#4a5a6a', maxWidth: 260, mx: 'auto', lineHeight: 1.55 }}>{s.text}</Typography>
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* 5. ТАРИФЫ */}
      <Box id="tariffs" sx={{ py: { xs: 6, md: 8 }, scrollMarginTop: 16 }}>
        <Container maxWidth="lg">
          <Typography sx={{ textAlign: 'center', fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 800, color: '#04164b' }}>Тарифы</Typography>
          <Typography sx={{ textAlign: 'center', mt: 1, fontSize: 15, color: '#4a5a6a', maxWidth: 520, mx: 'auto' }}>Начни бесплатно — плати, когда объектов станет больше.</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mt: 5 }} alignItems="center">
            <Paper elevation={0} sx={{ flex: 1, width: '100%', p: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#04164b' }}>Free</Typography>
              <Typography sx={{ mt: 1, fontSize: 32, fontWeight: 800, color: '#04164b' }}>0 ₽</Typography>
              <Stack spacing={1} sx={{ mt: 2 }}>
                <FeatureRow label="1 объект" />
                <FeatureRow label="30 позиций в смете" />
                <FeatureRow label="Фиксации объёмов" />
              </Stack>
              <Button fullWidth variant="outlined" onClick={goLogin} sx={{ mt: 3, minHeight: 48, borderRadius: '8px', fontWeight: 700, color: '#1565c0', borderColor: '#1565c0', '&:hover': { borderColor: '#0d47a1', bgcolor: 'rgba(21,101,192,0.04)' } }}>Начать бесплатно</Button>
            </Paper>
            <Paper elevation={0} sx={{ flex: 1.15, width: '100%', p: 3, borderRadius: '12px', border: '2px solid #1565c0', position: 'relative', boxShadow: '0 24px 48px rgba(21,101,192,0.18)' }}>
              <Chip label="Популярный" sx={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', bgcolor: '#ef6c00', color: '#04164b', fontWeight: 800 }} />
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#1565c0' }}>Pro</Typography>
              <Stack direction="row" alignItems="baseline" spacing={0.5}>
                <Typography sx={{ fontSize: 32, fontWeight: 800, color: '#04164b' }}>499 ₽</Typography>
                <Typography sx={{ fontSize: 14, color: '#4a5a6a' }}>/мес</Typography>
              </Stack>
              <Stack spacing={1} sx={{ mt: 2 }}>
                <FeatureRow label="Неограниченно объектов" />
                <FeatureRow label="Неограниченно позиций в смете" />
                <FeatureRow label="Экспорт актов и отчётов" />
                <FeatureRow label="Поддержка в Telegram" />
              </Stack>
              <Button fullWidth variant="contained" disableElevation onClick={goLogin} sx={{ mt: 3, minHeight: 48, borderRadius: '8px', fontWeight: 700, bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' } }}>Выбрать Pro</Button>
            </Paper>
            <Paper elevation={0} sx={{ flex: 1, width: '100%', p: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#04164b' }}>Team</Typography>
              <Stack direction="row" alignItems="baseline" spacing={0.5}>
                <Typography sx={{ fontSize: 32, fontWeight: 800, color: '#04164b' }}>1490 ₽</Typography>
                <Typography sx={{ fontSize: 14, color: '#4a5a6a' }}>/мес</Typography>
              </Stack>
              <Stack spacing={1} sx={{ mt: 2 }}>
                <FeatureRow label="5 пользователей" />
                <FeatureRow label="Портал заказчика по ссылке" />
                <FeatureRow label="Общий справочник цен бригады" />
                <FeatureRow label="Роли: прораб и кладовщик" />
              </Stack>
              <Button fullWidth variant="outlined" onClick={goLogin} sx={{ mt: 3, minHeight: 48, borderRadius: '8px', fontWeight: 700, color: '#1565c0', borderColor: '#1565c0', '&:hover': { borderColor: '#0d47a1', bgcolor: 'rgba(21,101,192,0.04)' } }}>Выбрать Team</Button>
            </Paper>
          </Stack>
        </Container>
      </Box>

      {/* 6. FAQ */}
      <Box sx={{ bgcolor: '#f5f7fa', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="md">
          <Typography sx={{ textAlign: 'center', fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 800, color: '#04164b' }}>Частые вопросы</Typography>
          <Box sx={{ mt: 4 }}>
            {faq.map((f, i) => (
              <Accordion key={f.q} elevation={0} defaultExpanded={i === 0} sx={{ mb: 1.5, borderRadius: '12px !important', border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0 } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 56 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#04164b' }}>{f.q}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography sx={{ fontSize: 14.5, lineHeight: 1.6, color: '#4a5a6a' }}>{f.a}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Container>
      </Box>

      {/* 7. ФИНАЛЬНЫЙ CTA */}
      <Box sx={{ background: 'linear-gradient(135deg, #04164b 0%, #1565c0 100%)', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
          <Typography sx={{ color: '#fff', fontSize: { xs: '1.6rem', md: '2.2rem' }, fontWeight: 800 }}>Смета стройки без бумаги</Typography>
          <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,0.92)', fontSize: 16 }}>Начни бесплатно — первый объект заведёшь за 10 минут.</Typography>
          <Button variant="contained" disableElevation onClick={goLogin} sx={{ mt: 3, minHeight: 48, px: 5, borderRadius: '8px', fontWeight: 700, fontSize: '1rem', bgcolor: '#fff', color: '#04164b', '&:hover': { bgcolor: '#e8eefc' } }}>Начать бесплатно</Button>
        </Container>
      </Box>

      {/* 8. FOOTER */}
      <Box sx={{ bgcolor: '#04164b', py: 3, pb: { xs: 11, md: 3 } }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" justifyContent="space-between">
            <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 700 }}>FRAME © 2026</Typography>
            <Link href="https://t.me/frame_inf" target="_blank" rel="noopener" underline="hover" sx={{ color: '#fff', fontSize: 14 }}>t.me/frame_inf</Link>
          </Stack>
        </Container>
      </Box>

      {/* 9. STICKY CTA (мобилка) */}
      <Box sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1300, display: { xs: 'block', md: 'none' }, transform: showSticky ? 'translateY(0)' : 'translateY(110%)', transition: 'transform 0.3s ease', pointerEvents: showSticky ? 'auto' : 'none' }}>
        <Box sx={{ p: 1.5, pb: 'calc(12px + env(safe-area-inset-bottom))', bgcolor: '#fff', borderTop: '1px solid', borderColor: 'divider', boxShadow: '0 -8px 24px rgba(4,22,75,0.14)' }}>
          <Button fullWidth disableElevation onClick={goLogin} sx={{ minHeight: 48, borderRadius: '8px', fontWeight: 700, fontSize: '1rem', bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' } }}>Начать бесплатно</Button>
        </Box>
      </Box>
    </Box>
  );
};

export default Landing;