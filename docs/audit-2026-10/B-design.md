# Аудит B: дизайн-система фронтенда (READ-ONLY)

- **Коммит:** `1e8ca1329d8ebcebbfa4eb5cc89270ef3bc4891f` (main, 27.10.2026)
- **Дата аудита:** 27.10.2026
- **Модель:** GLM 5.3
- **Режим:** READ-ONLY. Ничего не исправлял, не собирал, dev-сервер не трогал.
- **Ссылочная система:** `.clinerules\project.md` → раздел «Дизайн-система» (строки 30–33).
- **Стек:** React 19 + TS 5.9 + MUI 6.5 + Vite 7. Единственный файл темы: `frontend\src\theme.ts` (153 строки).

---

## 1. Инвентарь токенов theme.ts

### 1.1. Что реально объявлено

| Группа | Токен | Значение | Строка | Комментарий |
|---|---|---|---|---|
| palette.primary | main / light / dark / contrastText | `#1976d2` / `#42a5f5` / `#1565c0` / `#fff` | theme.ts:13–18 | совпадает с доками |
| palette.secondary | main / light / dark / contrastText | `#29b6f6` / `#4fc3f7` / `#0288d1` / `#000` | theme.ts:19–24 | в доках не зафиксирован; в страницах почти не используется |
| palette.background | default / paper | `#f5f9ff` / `#ffffff` | theme.ts:25–28 | ⚠️ расходится: доки и `index.css:34` + `Dashboard.tsx:87` дают `#f0f4fa` |
| palette.error | main | `#d32f2f` | theme.ts:29–31 | совпадает с доками |
| palette.warning | main | `#ed6c02` | theme.ts:32–34 | ⚠️ страницы используют `#ef6c00` (Materials.tsx:1893, Brigades.tsx:766) |
| palette.success | main | `#2e7d32` | theme.ts:35–37 | ⚠️ доки и страницы используют `#4caf50` (Materials.tsx:1464, Brigades.tsx:824, Objects.tsx:1034 и ~12 др.) — в приложении два зелёных |
| palette.text | — | **не задан** | — | фирменный `#04164b` хардкодом в ~20 местах (AppHeader.tsx:139, Login.tsx, Register.tsx:191, Settings.tsx:191, Dashboard.tsx:168 и т.д.) |
| typography | fontFamily | Roboto/Helvetica/Arial | theme.ts:40 | |
| typography | fontSize | 14 | theme.ts:41 | базы 14px — меньше MUI-дефолта 16, решение владельца |
| typography | button | textTransform none, 600 | theme.ts:42–45 | |
| typography | h1–h6, body, subtitle | **не переопределены** | — | размеры заголовков разделов живут хардкодом (см. п.3.1) |
| shape | borderRadius | **8** | theme.ts:47–49 | ⚠️ доки говорят 2; фактически страницы хардкодят 1/2/3/4/16px/'28px' |
| exports | `FAB_STYLE` | fixed, right 16, zIndex 1000 (bottom задаётся на месте) | theme.ts:5–9 | DRY-токен для FAB, но обходит его (PriceList.tsx:788) |
| components | MuiButtonBase / MuiIconButton | focus-visible: серый 2px `rgba(0,0,0,0.12)` | theme.ts:51–71 | ⚠️ доки: фокус `#1976d2` 2px + заливка `#e3f2fd` |
| components | MuiButton | borderWidth 2; contained: boxShadow none | theme.ts:72–91 | |
| components | MuiTableCell | border `#e0e0e0`; head bg `#e3f2fd`, 700 | theme.ts:92–102 | единственное место, где `#e3f2fd` из доков реально живёт |
| components | MuiOutlinedInput | на ≤599.95px: padding 13.5px, fontSize `0.95rem` | theme.ts:110–140 | ⚠️ 0.95rem ≈ 15.2px < 16px → iOS Safari зумит поле при фокусе |
| components | MuiInputLabel | на ≤599.95px: `0.95rem` | theme.ts:141–149 | |

### 1.2. Чего не хватает для повседневной работы

| Не хватает | Почему нужно | Где сейчас живёт хардкодом |
|---|---|---|
| `palette.text.primary = #04164b` (и secondary) | фирменный цвет текста | ~20 мест: AppHeader.tsx:139, Register.tsx:191, Settings.tsx:191, Dashboard.tsx:168, Calculators.tsx:253 |
| Один зелёный (success) | сейчас #2e7d32 (theme) и #4caf50/#388e3c (страницы) | 15+ кнопок (см. п.2, группа A) |
| Единый warning | #ed6c02 vs #ef6c00 | Materials.tsx:1893, Brigades.tsx:766 |
| `background.default = #f0f4fa` (по докам) | тема ≠ доки ≠ index.css | index.css:34, Dashboard.tsx:87 vs theme.ts:26 |
| Шкала радиусов (sm/md/lg) | карточки 1–4, шиты 16, лендинг 12/28 | см. п.2, группа D |
| Тени-токены (lift, sticky) | hover-lift и sticky-плашки повторяются | см. п.2, группа E |
| zIndex-шкала (nav / fab / sheet) | 10, 1000, 1500, 1300, 9, 2 — магия | см. п.2, группа F |
| Высоты шапок (header 56, SIDEBAR_HEADER_H) | AppHeader.tsx:87 `minHeight: 56`, Dashboard.tsx:60 комментарий с формулой высоты | |
| Типографика заголовка раздела | h4 в 10 страницах повторяется с `flexGrow: 1` | п.3.1 |
| Спейсинг-шкала | дефолт MUI 8px — менять не предлагаю, но зафиксировать как решение | |
| Hover-цвета (primary.hover и т.п.) | `&:hover: bgcolor #1565c0` повторяется | ForgotPassword.tsx:98, Login.tsx:325, Register.tsx:296/335, ResetPassword.tsx:151 |

Плюс: `frontend\src\App.css` — мёртвый файл шаблона Vite (`#646cff` и пр.), **не импортируется** (main.tsx подключает только `index.css`). `index.css:31` (`button { border-radius: 8px; background: #1a1a1a }`) — остатки шаблона, конфликтуют с MUI.

---

## 2. Хардкод в страницах и компонентах

Объём: hex-цветов в `pages/*.tsx` + `components/*.tsx` — **~460 упоминаний в 31 файле** (Landing 86, Materials 58, Objects 18, Projects 18, Settings 16, PriceCatalogList 15, Login/Register/Brigades по 14, Rentals 12…). Сгруппировано по типам, в каждой группе — самые частые примеры.

### A. Hex-цвета вместо токенов палитры (~460)

| Файл:строка | Значение | Чем заменить |
|---|---|---|
| Brigades.tsx:824; Objects.tsx:1034; Projects.tsx:866; Rentals.tsx:472; Warehouse.tsx:454; Materials.tsx:1464; PriceList.tsx:599; Reports.tsx:600; PriceCatalogList.tsx:398; Home.tsx:352; ConfirmDialog.tsx:106 | `bgcolor: '#4caf50'` + `'#388e3c'` (hover) | `color="success"` / `success.main` + `success.dark` (после выбора одного зелёного, п.7) |
| Brigades.tsx:758; Calculators.tsx:249; Help.tsx:629; Dashboard.tsx:161/240; Settings.tsx:187; Users.tsx:100; DrawerMenu.tsx:99; Login.tsx:325; Home.tsx:134 | `color/bgcolor: '#1976d2'` | `primary.main` |
| AppHeader.tsx:139; ForgotPassword.tsx:58; Register.tsx:191; ResetPassword.tsx:70; Settings.tsx:191; Calculators.tsx:253/271; Help.tsx:632; Dashboard.tsx:168 | `color: '#04164b'` | `text.primary` (токен нужно добавить) |
| Materials.tsx:1893; Brigades.tsx:766 | `color: '#ef6c00'` | `warning.main` (унифицировать #ed6c02 vs #ef6c00) |
| Brigades.tsx:758–770 (4 плашки статистики) | `#2e7d32`, `#1976d2`, `#ef6c00`, `#7b1fa2` | `success.main`, `primary.main`, `warning.main`, `#7b1fa2` → согласовать (вне палитры) |
| Materials.tsx:1471/1487/1500; Brigades.tsx:824; Objects.tsx:1036; Projects.tsx:869; Rentals.tsx:474; PriceList.tsx:607; Warehouse.tsx:454; PriceCatalogList.tsx:405; DashboardButton.tsx:37 | `boxShadow: '0 8px 16px rgba(0,0,0,0.2)'` (hover-lift) | токен `shadows.lift` (группа E) |
| Landing.tsx (86 упоминаний) | своя маркетинговая палитра | **не трогать сейчас** (п.6.3) |

### B. Клей-код модалок: `position absolute, top 50%, translate(-50%,-50%), width {xs:'90%', sm:360..460}, p:3/4, borderRadius:2, outline:'none'` (~30 блоков)

| Файл:строка | Ширина (sm) | Чем заменить |
|---|---|---|
| Brigades.tsx:889/921/937/1054/1065/1076 | 460/420/460/360/360/360 | общий `AppModal` (п.6.2); свести к 2 размерам |
| Warehouse.tsx:541/582/615/626 | 460/460/360/420 | там же |
| Reports.tsx:665/697 | 460 | там же |
| Projects.tsx:1022/1158 | 450 | там же |
| Materials.tsx:1507/1518/1914/2171/2561 | 320/440/450/400/360 | там же |
| Rentals.tsx:646/743/811 | 400 | там же |
| Objects.tsx:1322/1405/1519 | 400/400/500 | там же |
| Brigades.tsx:889; Warehouse.tsx:541; Materials.tsx:1914 | + `maxHeight:'90vh', overflowY:'auto'` | входит в AppModal; у Brigades:921/1054, Projects:1022 и др. **отсутствует** → риск (п.4.6) |

### C. Обёртка списка `mt:-1.5, maxWidth:1000, mx:'auto'` (хак против margin контейнера Dashboard)

| Файл:строка | Примечание |
|---|---|
| Analytics.tsx:131; Brigades.tsx:504; Calculators.tsx:178; Help.tsx:589; Home.tsx:113; Objects.tsx:942; PriceList.tsx:466; PriceCatalogList.tsx:321; Rentals.tsx:402; Reports.tsx:399; Settings.tsx:173; Warehouse.tsx:339 | 12 копий подряд |
| Projects.tsx:780 | `maxWidth:1000` **без** `mt:-1.5` — единственный «отклеившийся» |
| → замена | компонент `PageContainer` (п.6.2) |

### D. Произвольные borderRadius (~120 упоминаний)

| Файл:строка | Значение | Чем заменить |
|---|---|---|
| Brigades.tsx:558/588/619/671/756–773/837/889; Warehouse.tsx:361/391/482/541; Analytics.tsx:137/184/191/226/239; Settings.tsx:254/304/367 | `borderRadius: 2` (~60 мест) | фактический стандарт карточек → `radius.md` |
| Objects.tsx:1067; AcceptInvite.tsx:130; Terms.tsx:31; Privacy.tsx:32; ConfirmDialog.tsx:46; Calculators.tsx:239/269; Help.tsx:664 | `borderRadius: 3` | `radius.lg` (карточки «Объектов») |
| Settings.tsx:406–427; PriceCatalogList.tsx:371; SmartCaptcha.tsx:155 | `borderRadius: 1` | `radius.sm` |
| ForgotPassword.tsx:39; ResetPassword.tsx:53 | `borderRadius: 4` (по докам!) | доки говорят 4, theme.ts:48 — 8, факт — 2. Решение владельца (п.7) |
| Materials.tsx:265–266, 2160 | `16px` (bottom-sheet) | `radius.sheet` |
| Landing.tsx:17/258 | `'28px'` / `'12px'` | лендинг — не трогать |

### E. Тени

| Файл:строка | Значение | Чем заменить |
|---|---|---|
| Materials.tsx:1471/1487/1500; Brigades.tsx:824; Objects.tsx:1036; Projects.tsx:869; Rentals.tsx:474; Warehouse.tsx:454; PriceList.tsx:607; PriceCatalogList.tsx:405; DashboardButton.tsx:37 | `'0 8px 16px rgba(0,0,0,0.2)'` (hover-lift, ~11 кнопок) | токен `lift` |
| Materials.tsx:2159/2543 | `'0 -6px 12px rgba(0,0,0,0.08)'` (sticky-плашки) | токен `stickyTop` |
| AppHeader.tsx:82 | `'0 2px 8px rgba(0,0,0,0.05)'` | override MuiAppBar |
| Objects.tsx:1064/1071 (elevation 2→6); Home.tsx:137 (4); Calculators.tsx:245 (5) | elevation-числами | единый «lift»-рецепт |

### F. zIndex и «магические» breakpoint'ы

| Файл:строка | Значение | Чем заменить |
|---|---|---|
| theme.ts:8 (FAB_STYLE) | 1000 | `zIndex.fab` |
| BottomNav.tsx:76 | 10 | `zIndex.nav` |
| Materials.tsx:1854 | 9 (комментарий: «< zIndex BottomNav (10)») | `zIndex.nav - 1` |
| Materials.tsx:2156/2540 | 2 (sticky внутри модалки) | локально, ок |
| Materials.tsx:262 | ModalProps zIndex **1500** (чтобы bottom-sheet не уезжал под модалку) | `zIndex.sheet` |
| Landing.tsx:330 | 1300 | лендинг |
| Materials.tsx:140 | `isPhone = useMediaQuery('(max-width: 599.95px)')` | второе определение «мобильности»: везде `down('md')`, в Materials оба → риск рассинхрона на 600–900px |
| theme.ts:113/125/135 | `@media (max-width: 599.95px)` | дублирует isPhone; закрепить как breakpoint 'xs-' |

### G. fontSize числа/строки вместо вариантов

| Файл:строка | Значение | Чем заменить |
|---|---|---|
| Home.tsx:150/156/162 | `fontSize: {xs:'1.1rem', sm:'1.25rem'}` ×3 | вариант `statTitle` |
| Objects.tsx:1131; Rentals.tsx:532 | `fontSize: {xs:'1.05rem', md:'1.15rem'}` (заголовок карточки) | вариант `cardTitle` |
| BottomNav.tsx:93 | `0.62rem`/`0.75rem` (crowded) | override BottomNavigationAction |
| Landing.tsx:183/235/246 | rem/px вперемешку | лендинг |

---

## 3. Один элемент — разное исполнение

Все ссылки — код на коммите `1e8ca13`.

| # | Элемент | Где и как сделано (файл:строка) | Эталон (предложение) |
|---|---|---|---|
| 1 | **Заголовок раздела** | `variant="h4" sx={{flexGrow:1}}` — Objects:969, Brigades:522, Analytics:157, Rentals:429, Reports:409, Warehouse:349, Settings:180, Calculators:185, Help:596, PriceCatalogList:349. Иначе: Users:56 — `h4 gutterBottom` (титр из fallback-списка AppHeader:19); Reports:427 — `h5`; детальные шапки: Brigades:561 `h5`, Warehouse:364 `h5`, Objects:1131 `h6` с ручным fontSize | `h4` + `PageHeader`; под-заголовок — `h5`; Users подключить к useMobileHeader |
| 2 | **Шапка раздела (useMobileHeader)** | Подключено в 16 файлах (Materials:1303, Objects:926, PriceList:152, Brigades:137, Rentals:226, Analytics:59, Settings:27 и др.). **Не подключено:** Users.tsx (fallback-титры AppHeader:13–26). Набор фич разный: с поиском (Brigades:137, PriceList:152, Materials:1303, Objects:926, Help:562), без поиска (Analytics:59), с onBack (Brigades:137, PriceList:154, Analytics:59) | конфиг вынести в `PageHeader`; Users — подключить |
| 3 | **Кнопка «Создать/Добавить» (десктоп)** | Зелёная с рамкой + hover-lift: Brigades:824, Objects:1034, Projects:866, Rentals:472, Warehouse:454, Materials:1464, PriceList:599, PriceCatalogList:398, Reports:600 (у всех `bgcolor #4caf50, border 2px #388e3c, hover #388e3c, translateY(-3px), shadow` — 9 копипаст). Иначе: Brigades:591 — синяя `contained size="small"`. Иконки: AddIcon (7 мест), AddHomeIcon (Objects:1031) | `CreateButton`, цвет — success-токен |
| 4 | **FAB на мобилке** | FAB_STYLE + bottom 80: Brigades:1087, Projects:1612, Rentals:632, Reports:769, Warehouse:674, PriceCatalogList:551. Отклонения: Objects:1302–1305 — bottom 80, **но зелёный** `#4caf50`; Materials:1905 — bottom **130** (выше плашки итогов); PriceList:788 — **не использует FAB_STYLE** (инлайн fixed/bottom 80/right 16/zIndex 1000). Иконки: AddIcon (Materials:1908, Reports:769, Warehouse:674), AddHomeIcon (Objects:1309), GroupAddIcon (Brigades:1088), NoteAddIcon (Projects:1615, Rentals:632), LibraryAddIcon (PriceCatalogList:552). aria-label есть только у PriceCatalogList:551 | `CreateFab {icon?, bottom?}` поверх FAB_STYLE; иконка по умолчанию Add, override осознанно |
| 5 | **Поиск** | Мобилка — в шапке (search*): Materials:1308, Objects:926, PriceList:157, Brigades:137, Help:562. Десктоп — свой TextField в контенте: Materials:1424, Objects:990, Brigades:800–808, Help:601, PriceList:552–554 (комментарий: «на мобилке поиск теперь в шапке — скрываем здесь»). Analytics — поиска нет вообще. Прецедент бага от дублирования: PriceList:462 (шапка дублировала поиск и показывала нерабочую сортировку). Dashboard:287 — комментарий о десктоп-поиске в shell | поиск всегда через `PageHeader` (search-пропы) + один `SearchField` для десктопа |
| 6 | **Контейнер списка + карточка** | Обёртка `mt:-1.5, maxWidth:1000, mx:auto` — 12 страниц (п.2C), Projects:780 — без mt. Карточки: Objects:1058–1067 — `elevation 2, borderRadius 3, p {xs:1.5, md:3}`, hover scale+shadow 6; Projects:903–904 — `radius 2, p {xs:1.5, md:2}`; Brigades:837 / Warehouse:482 — `radius 2, p 1.5`; доки — «elevation 0, radius 4, p 4». Три плотности, три радиуса | `PageContainer` + `SectionCard {density}`; плотность — решение владельца (п.7) |
| 7 | **Пустое состояние** | «Нет проектов. Создайте первый проект.» — Projects:1014; «Материалы не добавлены»/«Ничего не найдено» — Materials:1704/1838; «Склад пуст. Нажмите + …» — Warehouse:476; «Оборудование не найдено» — Rentals:625; «Ничего не найдено» — PriceList:779, Help:667; «Нет данных по проектам.» — Analytics:194; 3 варианта — PriceCatalogList:541–543 (пусто/поиск/архив); Home:95 — Alert «Нет данных» | `EmptyState {title, hint, action?}`; тексты «нет данных» ≠ «ничего не найдено» — развести осознанно |
| 8 | **Подтверждение удаления** | 4 способа: (а) `FeedbackContext.confirm({danger})` — Promise-диалог FeedbackContext.tsx:59, 92–107 (Projects, Objects); (б) `ConfirmDialog.tsx` (Projects:1467, Rentals:909) — зелёная кнопка «Да, заменить», иконка `#ff9800` вне палитры, дефолт confirmText не про удаление; (в) самописные Modal: Materials:2561–2589, Warehouse:614–623, Brigades:1053/1064/1075; (г) инлайн-защита + свой диалог — PriceList:426, 862 | единый `ConfirmDelete` поверх `useFeedback().confirm({danger:true})`; ConfirmDialog.tsx — кандидат на миграцию |
| 9 | **Боттомшит на мобилке** | Только Materials:256–278: `Drawer anchor="bottom"` + `ModalProps zIndex 1500` + радиус 16 + `maxHeight 70vh` (№179: шит поднят выше модалки, чтобы не уезжал под неё). Все формы остальных разделов на мобилке — центрированный Modal (Brigades:889, Warehouse:541, Projects:1022, Materials:1914) | `AppModal {variant:'sheet'\|'dialog'}` — на xs рендерит шит с zIndex 1500 |
| 10 | **Сообщения об ошибках API** | `getApiErrorText/getApiErrorMessage` (utils\errors.ts:14/30) — Materials (11), Projects (10), PriceList (6), Objects (3), Warehouse:101, Reports:134, Rentals:157 — единообразно. Отклонение: Brigades — свои строки в setError. **Каналы показа различаются сильнее текстов:** FeedbackContext-снекбар (Objects, Projects, PriceList, PriceCatalogList, PriceRecalcModal, Settings, Materials) vs инлайн `<Alert>` в контенте (Warehouse, Reports, Rentals, Brigades, Analytics:194, Home:95) | текст — всегда `getApiErrorText`; канал — `useFeedback().error` |
| 11 | **Тосты/снекбары** | Центральный: FeedbackContext.tsx:74–90 (bottom-center, mb xs:9 — учтён BottomNav, ошибки 8с/прочее 4с). Локальный дубль в Materials:2592–2601 — свой Snackbar **без** отступа → на мобилке перекрывается BottomNav. Brigades/Warehouse/Reports/Rentals — вообще без тостов (только Alert) | убрать локальный Snackbar в Materials; везде `useFeedback()` |

---

## 4. Мобилка vs десктоп — где ломается

| # | Проблема | Файл:строка | На какой ширине |
|---|---|---|---|
| 1 | **Таблицы**: (а) `Table sx={{minWidth: 1500}}` в модалке предпросмотра — горизонтальный скролл внутри модалки, кнопки «Скачать» уезжают за экран — Materials.tsx:1599–1600; (б) таблицы **без** minWidth сжимаются в нечитаемое — Analytics.tsx:259–265, Brigades.tsx:853, Reports.tsx:541, Warehouse.tsx:499, PriceList.tsx:686, PriceRecalcModal.tsx:421 | (а) и (б) < 600px |
| 2 | **Перекрытие контента FAB**: контейнер даёт `mb {xs: 8}` = 64px (Dashboard.tsx:282), а FAB сидит на `bottom: 80` + 56px высоты → верх FAB на ~136px от низа: последняя карточка/строка уходит под кнопку в Objects, Brigades, Warehouse, Rentals, PriceCatalogList, Reports | xs (< 600px), на экранах < ~700px по высоте |
| 3 | **Safe-area iPhone**: `env(safe-area-inset-bottom)` используется только на лендинге (Landing.tsx:331). BottomNav (BottomNav.tsx:76) и FAB_STYLE (theme.ts:5–9) считаются от края окна → на iPhone с «домашней полоской» табы/FAB прижаты к жесту | xs на устройствах с safe-area |
| 4 | **iOS-зум полей**: на ≤599.95px поля ввода получают `fontSize: '0.95rem'` ≈ 15.2px (theme.ts:113–116) — меньше 16px → iOS Safari зумит страницу при фокусе в каждом поле. Метки тоже (theme.ts:144–146) | < 600px, iPhone/Safari |
| 5 | **Тап-зоны < 44px**: `IconButton size="small"` (MUI ≈ 34×34px): Brigades ×8, Objects ×5, Reports ×4, Warehouse ×3, Materials ×3, PriceList ×3, AppHeader.tsx:113 (закрыть поиск) | везде, критично на тач-устройствах |
| 6 | **Модалки выше экрана**: без `maxHeight/overflowY`: Brigades:921, 1054/1065/1076, Warehouse:626, Projects:1022/1158, Reports:665, Materials:2171 (модалка фиксации). С открытой клавиатурой кнопки внизу недоступны. Эталон: Materials:1914–1924 (maxHeight 90vh + sticky-кнопки 2154–2164) | xs < 600px, особенно < 570px по высоте |
| 7 | **Длинные названия без ellipsis**: заголовок карточки объекта — `h6 flexGrow` без `noWrap/minWidth: 0` (Objects.tsx:1131–1133), переносы на 3–4 строки ломают сетку карточки; для сравнения AppHeader.tsx:139 — `noWrap` есть | xs, названия > ~25 символов |
| 8 | **Autocomplete + клавиатура**: 4 автокомплита в Materials (2013, 2104, 2411, 2490) живут внутри **центрированной** модалки (1914): popup списка уходит под/над клавиатуру, вместе с п.6 форма «Добавить позицию» — самое хрупкое место на мобилке | xs < 600px |
| 9 | **Две «мобильности»**: `isPhone = '(max-width: 599.95px)'` (Materials.tsx:140) против `isMobile = down('md')` (все страницы). В Materials на 600–900px шапка уже десктопная (isMobile=false), а мобильные плашки/FAB уже скрыты — граница проходится дважды | 600–900px (планшет) |
| 10 | **Sticky-плашки и слои**: плашка итогов `zIndex: 9` «под BottomNav (10)» с комментарием-хаком (Materials.tsx:1854); sticky-кнопки в модалке `zIndex: 2` (Materials.tsx:2156, 2540) — слои собраны вручную под каждый случай | xs |

---

## 5. A11y-минимум (критичное, 10 пунктов)

1. **Иконочные кнопки без имени**: в pages+components 92 `<IconButton>` и лишь ~37 `aria-label` — большинство иконочных кнопок (удалить/редактировать/меню в карточках) не имеют доступного имени. Эталон: PriceCatalogList.tsx:551 (FAB с aria-label), AppHeader.tsx:88.
2. **Контраст зелёных кнопок**: белый текст на `#4caf50` ≈ 2.8:1 (Brigades.tsx:824 и все зелёные «Создать», ConfirmDialog.tsx:106, Home.tsx:352) — ниже WCAG AA 4.5:1. Если зелёный утверждён — рассмотреть `#2e7d32` (theme) для текстовых кнопок или тёмный текст.
3. **Контраст warning-текста**: `#ef6c00` на белом ≈ 3:1 мелким кеглем (Materials.tsx:1893, Brigades.tsx:766) — ниже AA; у Brigades:766 цвет — единственный носитель смысла.
4. **Фокус-видимость**: theme.ts:55–58/65–68/79–82 подменяют focus-ring на серый `rgba(0,0,0,0.12)` 2px — на светлых плашках (AppHeader.tsx:95/150) почти невидим; спецификация проекта требует `#1976d2` 2px + заливку `#e3f2fd` (theme.ts:98 — фон шапок таблиц, единственное место соответствия).
5. **Кликабельные карточки — не кнопки**: Paper с onClick без `role="button"`, `tabIndex`, `onKeyDown` (Objects.tsx:1058–1063, Projects.tsx:895–900, Warehouse.tsx:482, Brigades.tsx:837) — недоступны с клавиатуры/скринридера.
6. **Семантика заголовков**: титр приложения — `Typography variant="h6"` без `component="h1"` (AppHeader.tsx:139); на десктопе заголовок раздела — h4 в контенте → скринридер получает два заголовка без иерархии h1.
7. **FAB без aria-label**: Materials.tsx:1903, Projects.tsx:1610, Brigades.tsx:1087, Rentals.tsx:632, Reports.tsx:769, Warehouse.tsx:674, Objects.tsx:1299 (для сравнения PriceCatalogList.tsx:551 — с меткой).
8. **Кнопки-«иконки» без Tooltip**: Export/Template в Materials.tsx:1481–1503 — иконка без текста и без подписи (есть только `title` у одной).
9. **`console.log` в проде**: Projects.tsx:899 (клик по карточке) — шум в консоли; минор, вне темы a11y, отмечено попутно.
10. **Landing**: анимации (fadeInUp, Landing.tsx:183) без `prefers-reduced-motion` — минор, в бэклог.

---

## 6. Предложение (без кода): минимальные токены + общие компоненты

### 6.1. Токены в theme.ts (одна итерация, без смены палитры)

| Токен | Что фиксирует |
|---|---|
| `palette.text: { primary: '#04164b' }` | фирменный цвет текста (сейчас ~20 хардкодов) |
| `success.main` — один зелёный (какой — п.7) | сейчас два: #2e7d32 (theme) и #4caf50 (страницы) |
| `warning.main` — один оранжевый (#ed6c02) | сейчас #ef6c00 в двух местах |
| `background.default: '#f0f4fa'` (по докам) + убрать дубли из index.css:34 и Dashboard.tsx:87 | сейчас три источника фона |
| `shadows: lift / stickyTop` (через theme.vars) | hover-lift и sticky-плашки |
| `zIndex: { nav: 10, fab: 1000, sheet: 1500 }` | FAB_STYLE, BottomNav, шит Materials |
| `typography: cardTitle, statTitle` (h6 с адаптивным кеглем) | ручные fontSize в Objects:1131, Rentals:532, Home:150–162 |
| экспорт `HEADER_H = 56`, `SIDEBAR_HEADER_H` | AppHeader.tsx:87, Dashboard.tsx:60 |
| borderRadius — **не** менять глобально (см. п.6.3): только расчистить 1/3/4/16px до фактического 2 (карточки) и 16 (шиты) | |

### 6.2. Компоненты (4–6), убирающие копипасту

| Компонент | Зачем | Псевдо-сигнатура | Где заменит | Объём |
|---|---|---|---|---|
| **PageHeader** | одна точка заголовка раздела + моб. шапки + поиска | `{title, sub?, back?, search?{value,placeholder,onChange}, actions?}` — сам вызывает useMobileHeader и рендерит h4 на десктопе | 12 страниц (п.3.1–3.2, 3.5); подключит Users.tsx | **M** |
| **PageContainer** | убрать `mt:-1.5, maxWidth:1000, mx:auto` ×13 | `{children, maxWidth=1000}` | 13 мест (п.2C) | **S** |
| **CreateButton / CreateFab** | зелёная кнопка «Создать» и FAB — 9+9 копипаст, 5 разных иконок, 3 разных позиции | `{label?, icon?=Add, onClick, bottom?=80, ariaLabel}` | Brigades, Objects, Projects, Rentals, Warehouse, Materials, PriceList, Reports, PriceCatalogList | **S** |
| **EmptyState** | 8 разных текстов и структур «пусто» | `{title, hint?, action?, mode:'empty'\|'no-results'}` | Projects:1014, Materials:1704/1838, Warehouse:476, Rentals:625, PriceList:779, Help:667, Analytics:194, PriceCatalogList:541 | **S** |
| **AppModal** (dialog + bottom-sheet в одном) | ~30 блоков клей-кода Modal/Paper; на xs — шит как в Materials (zIndex 1500, maxHeight, sticky-кнопки) | `{title, children, actions?, size='sm'\|'md', sheet='auto'\|'always'\|'never'}` | все модалки Brigades/Warehouse/Reports/Projects/Rentals/Objects/Materials | **L** (делать постранично, см. 6.3) |
| **ConfirmDelete** | 4 способа подтверждения удаления → один | `{name, what, onConfirm}` — обёртка над `useFeedback().confirm({danger:true})` | Materials:2561, Warehouse:614, Brigades:1053/1064/1075, PriceList:862 + миграция ConfirmDialog.tsx | **S** |

### 6.3. Что НЕ трогать сейчас (иначе рефактор съест релиз)

- **Landing.tsx** — 86 hex, своя маркетинговая палитра и анимации; отдельная задача, не «дизайн-система».
- **Login / Register / ForgotPassword / ResetPassword** — уже соответствуют докам (maxWidth 400, Paper elevation 0); не трогать.
- **Планшетный layout (600–900px)** — сначала зафиксировать одну «мобильность» (isPhone vs isMobile), потом менять страницы; сейчас — только фиксация в доке.
- **theme.ts:110–149 (высоты полей №174/№176)** — тонкие отрегулированные фиксы; трогать только вместе с пунктом iOS-зум (16px) и регресс-тестом формы «Добавить позицию».
- **Dashboard desktop shell** (rail/сайдбар, SIDEBAR_HEADER_H, полоса-разделитель) — работает, косвенные зависимости.
- **BottomNav и его настройки юзера** (localStorage-конфиг табов №169) — несовместимо с переделкой без миграции.
- **Палитру** — утверждена; **тёмную тему** — бэклог §10.3; **App.css** (мёртвый файл) — удалить отдельным мелким PR, не вместе с дизайном.
- **Reports.tsx** — раздел временно скрыт (App.tsx:110): править только попутно.
- **Массовую замену borderRadius** — только после решения владельца (п.7), иначе визуальная регрессия по всем карточкам.

---

## 7. Топ-5 правок с максимальным визуальным эффектом за минимум работы (по возрастанию цены)

| # | Правка | Цена | Эффект |
|---|---|---|---|
| 1 | Один зелёный + один оранжевый в theme.ts и замена ~15 хардкодов `#4caf50/#388e3c/#ef6c00` на токены (п.2A) | ~0.5 дня | вся система «создания/успеха» перестаёт двоиться; правится механически |
| 2 | `palette.text.primary = #04164b` + замена ~20 хардкодов; `background.default = #f0f4fa` + убрать фон из index.css:34 и Dashboard.tsx:87 | ~0.5 дня | единый текст и фон, три источника фона → один |
| 3 | EmptyState + CreateButton/CreateFab + ConfirmDelete (3 маленьких компонента, п.6.2) | ~1.5 дня | убирают самые частые копипасты (9 кнопок, 9 FAB, 8 пустых состояний, 6 диалогов удаления) |
| 4 | FAB/BottomNav: safe-area (`env(safe-area-inset-bottom)`) + `paddingBottom` списка, чтобы карточки не уходили под FAB; aria-label на все иконочные кнопки/FAB | ~1 день | «владелец с телефона» сразу почувствует: ничего не перекрыто, iPhone-жест не мешает |
| 5 | AppModal (bottom-sheet на xs по образцу Materials:256–278 + maxHeight 90vh + sticky-кнопки) для форм Бригады/Склад/Проекты/Аренда | ~2–3 дня постранично | самый большой мобильный UX-скачок: формы перестанут «не влезать» под клавиатуру |

## 8. Требует решения владельца (вкусовое — не решаю вместо вас)

1. **Какой зелёный утверждаем как success**: `#4caf50` (доки `.clinerules`, все кнопки «Создать», но контраст белого текста 2.8:1) или `#2e7d32` (theme.ts:36, проходит контраст, темнее). Влияет на ~15 кнопок.
2. **Фон приложения**: `#f0f4fa` (доки, index.css, Dashboard) или `#f5f9ff` (theme.ts:26) — сейчас побеждают доки фактически, но тема врёт.
3. **borderRadius**: доки говорят 2 (поля) и 4 (карточки), theme.ts:48 — 8, факт — 2 у карточек и 3 у «Объектов». Зафиксировать фактический (2/3) или доковский (4)?
4. **Плотность карточек**: сейчас три плотности (Objects p 1.5–3, Projects p 1.5–2, Brigades/Warehouse p 1.5). Одна? Какая?
5. **FAB: иконка и место** — единая `Add` (как Reports/Warehouse/Materials) или контекстные (GroupAdd/NoteAdd/AddHome/LibraryAdd)? Оставить ли Materials bottom 130 (под плашкой итогов) как осознанное исключение?
6. **Где Create на мобилке** — FAB у всех (сейчас) или кнопка в шапке (trailing) в отдельных разделах?
7. **Базовый кегль 14px** (theme.ts:41) — устраивает? (Меньше 16px в полях на мобилке iOS зумит — если оставить 0.95rem, зум останется.)
8. **Тосты для Brigades/Warehouse/Reports/Rentals** — включить центральный снекбар (useFeedback) вместо инлайн-Alert'ов? (меняется поведение, юзер привык).

---

*Отчёт собран статическим анализом кода (grep + чтение файлов) на коммите `1e8ca1329d8ebcebbfa4eb5cc89270ef3bc4891f`. Номера строк актуальны для этого коммита. Ничего в коде не изменено; создан только этот файл: `docs\audit-2026-10\B-design.md`.*






