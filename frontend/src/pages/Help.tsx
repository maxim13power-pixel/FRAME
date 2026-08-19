import React, { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Container,
  InputAdornment,
  List,
  ListItem,
  Paper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PriceChangeIcon from '@mui/icons-material/PriceChange';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

interface Guide {
  title: string;
  keywords: string[];
  steps: string[];
}

interface HelpSection {
  title: string;
  icon: React.ReactNode;
  guides: Guide[];
}

const helpSections: HelpSection[] = [
  {
    title: 'Быстрый старт',
    icon: <RocketLaunchIcon />,
    guides: [
      {
        title: 'Как создать объект',
        keywords: ['объект', 'создание', 'адрес', 'даты'],
        steps: [
          'Откройте раздел «Объекты» и нажмите кнопку добавления.',
          'Укажите название объекта, адрес, дату начала и дату окончания работ.',
          'Нажмите «Сохранить» — объект появится в общем списке.',
        ],
      },
      {
        title: 'Как создать проект (вид работ)',
        keywords: ['проект', 'вид работ', 'объект'],
        steps: [
          'Откройте нужный объект и перейдите к списку проектов.',
          'Нажмите «Добавить проект» и выберите название вида работ.',
          'Заполните даты проекта и сохраните карточку.',
        ],
      },
      {
        title: 'Как добавить материал/работу',
        keywords: ['материал', 'работа', 'спецификация', 'добавить'],
        steps: [
          'Откройте проект, в котором нужно вести спецификацию.',
          'Выберите «Добавить материал» или добавьте работу из справочника цен.',
          'Укажите количество по спецификации и сохраните строку.',
        ],
      },
    ],
  },
  {
    title: 'Работа с материалами',
    icon: <Inventory2Icon />,
    guides: [
      {
        title: 'Как зафиксировать объём',
        keywords: ['материал', 'фиксировать', 'объём', 'расход'],
        steps: [
          'Откройте таблицу материалов нужного проекта.',
          'В строке материала нажмите «Зафиксировать объём» и введите фактически использованное количество.',
          'Подтвердите запись — итог и процент выполнения пересчитаются автоматически.',
        ],
      },
      {
        title: 'Что значит замок на спецификации и как его снять',
        keywords: ['замок', 'спецификация', 'редактирование', 'защита'],
        steps: [
          'Замок означает, что плановое количество материала защищено от случайного изменения.',
          'Нажмите на значок замка в строке материала.',
          'После снятия замка измените количество и снова включите защиту при необходимости.',
        ],
      },
      {
        title: 'Как изменить количество по спецификации',
        keywords: ['количество', 'спецификация', 'изменить', 'план'],
        steps: [
          'Убедитесь, что замок спецификации снят.',
          'Откройте редактирование планового количества и введите новое значение.',
          'Сохраните изменение — процент выполнения обновится относительно нового плана.',
        ],
      },
      {
        title: 'Как удалить материал',
        keywords: ['удалить', 'материал', 'удаление'],
        steps: [
          'Найдите нужный материал в таблице проекта.',
          'Нажмите кнопку удаления и внимательно проверьте выбранную строку.',
          'Подтвердите действие. Материал и связанные с ним фиксации будут удалены из проекта.',
        ],
      },
    ],
  },
  {
    title: 'Справочник цен',
    icon: <PriceChangeIcon />,
    guides: [
      {
        title: 'Как создать категорию и расценку',
        keywords: ['справочник', 'цена', 'категория', 'расценка', 'создать'],
        steps: [
          'Откройте «Справочник цен» и добавьте новую категорию.',
          'Внутри категории создайте расценку, укажите название, единицу измерения и цену.',
          'Сохраните запись — её можно будет выбрать при добавлении работы в проект.',
        ],
      },
      {
        title: 'Как привязать расценку к материалу',
        keywords: ['расценка', 'материал', 'привязать', 'цена'],
        steps: [
          'Откройте материал или строку работы, для которой нужно назначить цену.',
          'Выберите расценку из справочника цен.',
          'Подтвердите выбор — текущая цена сохранится в строке сметы.',
        ],
      },
      {
        title: 'Что такое snapshot цены (почему старые сметы не меняются)',
        keywords: ['snapshot', 'снимок', 'цена', 'смета', 'старая'],
        steps: [
          'При добавлении расценки в смету приложение сохраняет snapshot — копию её цены на этот момент.',
          'Изменение цены в справочнике влияет только на новые сметы и новые привязки.',
          'Старые сметы сохраняют исходную стоимость, поэтому исторические итоги не меняются.',
        ],
      },
      {
        title: 'Почему нельзя удалить категорию с расценками',
        keywords: ['удалить', 'категория', 'расценка', 'защита'],
        steps: [
          'Категория не удаляется, пока внутри неё остаются расценки.',
          'Сначала удалите или перенесите все расценки из этой категории.',
          'После очистки категорию можно удалить без риска потерять связанные записи.',
        ],
      },
    ],
  },
  {
    title: 'Цифры и итоги',
    icon: <AssessmentIcon />,
    guides: [
      {
        title: 'Как считается % выполнения',
        keywords: ['процент', '%', 'выполнение', 'итого', 'спецификация'],
        steps: [
          'Приложение берёт фактически использованное количество в поле «Итого».',
          'Полученное значение делится на плановое количество «По спец».',
          'Результат умножается на 100: Итого / По спец × 100.',
        ],
      },
      {
        title: 'Что показывает итоговая строка таблицы',
        keywords: ['итог', 'строка', 'таблица', 'сумма'],
        steps: [
          'Итоговая строка суммирует значения по видимым материалам и работам.',
          'Она показывает общий план, фактический расход и рассчитанный результат.',
          'При использовании фильтров итог пересчитывается для текущего набора строк.',
        ],
      },
      {
        title: 'Что означают колонки Цена и Стоимость',
        keywords: ['цена', 'стоимость', 'колонки', 'смета'],
        steps: [
          '«Цена» — стоимость одной единицы материала или работы.',
          '«Количество» — объём по спецификации или фактический расход, в зависимости от колонки.',
          '«Стоимость» — цена, умноженная на соответствующее количество.',
        ],
      },
    ],
  },
  {
    title: 'Вопросы и ответы',
    icon: <HelpOutlineIcon />,
    guides: [
      {
        title: 'Ошибся при фиксации — что делать?',
        keywords: ['ошибка', 'фиксация', 'исправить', 'объём'],
        steps: [
          'Проверьте строку материала и историю фиксаций.',
          'Если в интерфейсе доступно редактирование, исправьте ошибочную запись или добавьте корректирующий объём.',
          'Если удалить фиксацию нельзя, обратитесь к администратору проекта с указанием материала и даты.',
        ],
      },
      {
        title: 'Можно ли переименовать категорию?',
        keywords: ['переименовать', 'категория', 'название'],
        steps: [
          'Откройте справочник цен и найдите нужную категорию.',
          'Нажмите редактирование рядом с её названием.',
          'Введите новое название и сохраните — расценки внутри категории останутся без изменений.',
        ],
      },
      {
        title: 'Куда пропадают удалённые расценки?',
        keywords: ['удалённые', 'расценки', 'удаление', 'справочник'],
        steps: [
          'Удалённая расценка исчезает из текущего справочника и больше не предлагается для новых привязок.',
          'Её snapshot в уже созданных сметах сохраняется, поэтому старые расчёты не меняются.',
          'Если расценка была удалена по ошибке, создайте её заново с нужными параметрами.',
        ],
      },
      {
        title: 'Почему процент выполнения может быть больше 100%?',
        keywords: ['процент', '100', 'выполнение', 'перерасход'],
        steps: [
          'Процент показывает фактический расход относительно планового количества.',
          'Если фактически использовано больше плана, значение закономерно превысит 100%.',
          'Проверьте количество по спецификации и при необходимости обновите план после снятия замка.',
        ],
      },
      {
        title: 'Как понять, какая цена используется в смете?',
        keywords: ['цена', 'смета', 'стоимость', 'snapshot'],
        steps: [
          'Откройте строку материала или работы в нужном проекте.',
          'Посмотрите значение в колонке «Цена» — это цена, сохранённая в момент привязки.',
          'Текущая цена в справочнике может отличаться, но историческая смета останется неизменной.',
        ],
      },
      {
        title: 'Можно ли пользоваться справочником с телефона?',
        keywords: ['телефон', 'мобильный', 'справочник', 'адаптивность'],
        steps: [
          'Откройте приложение в мобильном браузере и перейдите в нужный раздел.',
          'Карточки и таблицы адаптируются под ширину экрана, а основные действия доступны через мобильное меню.',
          'Для точного редактирования больших таблиц при необходимости используйте горизонтальную прокрутку.',
        ],
      },
    ],
  },
];

const Help: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [search, setSearch] = useState('');

  const filteredSections = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru-RU');

    if (!query) {
      return helpSections;
    }

    return helpSections
      .map((section) => ({
        ...section,
        guides: section.guides.filter((guide) => {
          const searchableText = [guide.title, ...guide.keywords, ...guide.steps]
            .join(' ')
            .toLocaleLowerCase('ru-RU');
          return searchableText.includes(query);
        }),
      }))
      .filter((section) => section.guides.length > 0);
  }, [search]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, px: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: { xs: 2.5, md: 4 } }}>
        <Typography component="h1" variant={isMobile ? 'h5' : 'h4'} sx={{ color: '#04164b', fontWeight: 700, mb: 0.75 }}>
          Помощь
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Пошаговые инструкции и ответы на частые вопросы
        </Typography>
      </Box>

      <TextField
        fullWidth
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Поиск по инструкциям"
        label="Найти ответ"
        sx={{ mb: { xs: 2.5, md: 3 }, '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: 2 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
        }}
      />

      {filteredSections.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filteredSections.map((section) => (
            <Accordion
              key={section.title}
              defaultExpanded={!isMobile}
              disableGutters
              elevation={1}
              sx={{
                overflow: 'hidden',
                border: '1px solid #e3edf8',
                borderRadius: '10px !important',
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: 64, px: { xs: 2, md: 2.5 }, '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5, my: 1.5 } }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, flexShrink: 0, borderRadius: 2, bgcolor: '#e3f2fd', color: '#1976d2' }}>
                  {section.icon}
                </Box>
                <Typography variant="h6" sx={{ color: '#04164b', fontWeight: 700 }}>
                  {section.title}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: { xs: 1.5, md: 2.5 }, pb: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {section.guides.map((guide) => (
                    <Accordion key={guide.title} disableGutters elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: { xs: 1.5, md: 2 }, '& .MuiAccordionSummary-content': { my: 1.25 } }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#173b6c' }}>
                          {guide.title}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ bgcolor: '#f8fbff', px: { xs: 1.5, md: 2.5 }, py: 1.5 }}>
                        <List component="ol" disablePadding sx={{ listStyleType: 'decimal', pl: 2.5 }}>
                          {guide.steps.map((step) => (
                            <ListItem key={step} component="li" disableGutters sx={{ display: 'list-item', pl: 0.75, py: 0.5 }}>
                              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                                {step}
                              </Typography>
                            </ListItem>
                          ))}
                        </List>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ) : (
        <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, textAlign: 'center', bgcolor: '#fff', border: '1px dashed #90caf9', borderRadius: 3 }}>
          <HelpOutlineIcon sx={{ fontSize: 42, color: '#90caf9', mb: 1 }} />
          <Typography variant="h6" sx={{ color: '#173b6c', fontWeight: 700 }}>
            Ничего не найдено
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Попробуйте изменить запрос или поискать по другому слову.
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default Help;