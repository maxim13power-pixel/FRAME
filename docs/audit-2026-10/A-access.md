# Аудит A — Модель доступа и прав (READ-ONLY)

- **Коммит:** `1e8ca13` (`git rev-parse --short HEAD`)
- **Дата:** 2026-10-27
- **Модель аудитора:** DeepSeek V4.1 Pro
- **Режим:** read-only; ничего не исправлялось; создан только этот файл.
- **Стек:** NestJS 11 + Prisma 5.22 + PostgreSQL 15 + React 19 + TS 5.9 + MUI 6.

---

## 1. Инвентаризация механизмов доступа

| # | Механизм | Что решает | Где реализован (файл:строка) | Нужен ли |
|---|----------|-----------|------------------------------|----------|
| 1 | `ObjectAccess` (userId, objectId, projectId, role) — ядро: `projectId=null` → весь объект, `projectId=X` → только проект | Кто и к чему имеет доступ | `backend\prisma\schema.prisma:241-270`; семантика — `backend\src\auth\access-scope.ts:3-5,70-84` | **Да** — единственный источник истины |
| 2 | `AccessRole` (CUSTOMER/FOREMAN/VIEWER) | Роль внутри объекта: запись/управление/только чтение | `schema.prisma:235-239`; приоритет — `access-scope.ts:152-156,168-173` | **Да** |
| 3 | `ObjectAccess.hidePrices` | Скрывать деньги у участника | `schema.prisma:247`; сводится в `access-scope.ts:187-191`; локальные копии `mustHidePrices`: `materials.service.ts:54-67`, `projects.service.ts:72-80`, `reports.service.ts:48-57`, `estimate-recalc.service.ts:76-87` | **Да**, но 4 дубля логики |
| 4 | `ObjectAccess.isManager` (№168) | Прораб-менеджер: управление командой | `schema.prisma:249-251`; `access-scope.ts:196-199`; дубли: `access.service.ts:43-45`, `access-request.service.ts:50-53` | **Да**, но выводим из роли (см. §6) |
| 5 | `ObjectAccess.isHidden` (№168/169) | Личный архив участника | `schema.prisma:252-253`; `access-scope.ts:87-98,106-150`; `access.service.ts:435-448`; `me-access.controller.ts:36-43` | **Да** |
| 6 | `ObjectAccess.revokedAt/revokedById` (№168) | Мягкий отзыв: read-only + снимок в шаблоны | `schema.prisma:254-258`; `access-scope.ts:185-200`; `access.service.ts:256-300` (revoke + createSnapshot:464-552); guard `object-access.guard.ts:115-123` | **Да** |
| 7 | Глобальный `User.role` (ADMIN/STORE_MANAGER/FOREMAN/CUSTOMER) | Фактически — только ADMIN (системный справочник, заявки, шаблоны) | `schema.prisma:97-102`; проверки: `catalog-access.ts:84-91`, `access-request.service.ts:36-42`, `object-templates.service.ts:41-47`, `price-list.service.ts:60-67`. В JWT кладётся (`jwt.strategy.ts:46`), но из JWT **не проверяется нигде** | **Частично**: свести к `isAdmin`; STORE_MANAGER/FOREMAN/CUSTOMER мертвы |
| 8 | `AccessRequest` (№178) | Заявка «дать право создавать проекты» → approve выдаёт объектную запись FOREMAN+isManager | `schema.prisma:318-338`; `access-request.service.ts:57-131 (create), 178-251 (approve)` | **Да** (UI есть: `frontend\src\services\accessRequestService.ts`, Objects.tsx, Projects.tsx) |
| 9 | `ChangeRequest` (P0-6) | Согласования изменений сметы (3 эндпоинта) | `schema.prisma:278-297`; `change.controller.ts:23-55`; `change.service.ts` (436 строк) | **Нет — мёртвое**: frontend 0 ссылок (grep по `frontend/src` — пусто). См. §5 |
| 10 | `InviteToken` | Приглашение ссылкой: роль+hidePrices+лимиты | `schema.prisma:408-425`; `invite.service.ts:29-212` | **Да**, но дыра в выдаче роли (находка 3) |
| 11 | `ObjectAccessGuard` | Централизованная проверка «доступ к объекту» + read-only для отозванных | `object-access.guard.ts:19-130`; подключён ТОЛЬКО к 3 контроллерам: `objects.controller.ts:21`, `projects.controller.ts:21`, `materials.controller.ts:25` | **Да**, но покрытие 3/20 контроллеров |
| 12 | `access-scope.ts` (№163/168) — слой `RoleResolution`/скоупов | Единая логика «что видит пользователь» | `access-scope.ts:29-39 (RoleResolution), 51-98, 106-150, 207-268` | **Да** — это и есть зародыш capability-слоя |
| 13 | `AuditLog` (№131) | Append-only журнал | `schema.prisma:670-683`; `audit.service.ts:16-34 (log), 109-141 (list)` | **Да**, но чтение дырявое (находка 5) |
| 14 | `Object.isArchived` | «Глобальный архив» — объявлен легаси | `schema.prisma:51` («сброшено миграцией»), НО фильтры живы: `analytics.service.ts:47,74,175`, `dashboard.service.ts:139,160`, `objects.service.ts:106`, `frontend\src\services\objectService.ts` (fetchObjects) | **Полумёртвое** — источник путаницы |
| 15 | `Object.createdById` | Метка автора, «прав не даёт» | `schema.prisma:54-56`; `objects.service.ts:84` | Да (метаданные) |
| 16 | `PriceCatalog.ownerId` + `catalog-access.ts` (№151/164) | Доступ к справочникам: системный/личный/объектный/проектный | `catalog-access.ts:67-111`; `price-list.service.ts:144-152,201-213,575-585` | **Да** — самый дисциплинированный модуль |
| 17 | «Общие» сущности без владельца: `WarehouseItem.objectId=null`, `Brigade.objectId=null` | Формально «общий склад»/«мобильная бригада» | `schema.prisma:468-484,565-581`; `warehouse.service.ts:75-99`, `brigades.service.ts:184-186` | **Нет в текущем виде** — кросс-тенантная дыра (находка 2) |
| 18 | `ObjectTemplate.isPublic` (№175), `EstimateTemplate.ownerId` (№129), `Rental.userId` | Личные/публичные шаблоны, личные аренды | `object-templates.service.ts:173-201`, `estimate-templates.service.ts:55-61,109-119`, `rentals.service.ts:42-44` | **Да** — владельческая модель простая и рабочая |

**Итог инвентаризации:** 2 источника ролей (глобальная `Role` + `AccessRole`), 5 флагов на `ObjectAccess`, 4 дубля `mustHidePrices`, 3 дубля `canManage`-формулы, guard на 3 контроллера из 20, один полностью мёртвый механизм (ChangeRequest) и один полумёртвый (Object.isArchived).

---

## 2. Таблица находок

Обозначения: 🔴 блокер / 🟡 средне / 🟢 мелочь. «Первый платёж» = блокирует ли демо/продажу первому клиенту.

| № | Уровень | Файл:строка | Суть | Почему это проблема | Как исправить | Размер | Блокирует первый платёж |
|---|---------|-------------|------|---------------------|---------------|--------|--------------------------|
| 1 | 🔴 | `warehouse.service.ts:114-130,133-147,150-154,157-221`; `reports.service.ts:176-204,206-234,236-240,253-357` | Запись на склад и в отчёты/акты **не проверяет ни VIEWER, ни revokedAt**: check*Access проверяют только НАЛИЧИЕ записи. Контроллеры только с JwtAuthGuard (`warehouse.controller.ts:24`, `reports.controller.ts:29`); ObjectAccessGuard подключён лишь к objects/projects/materials | Наблюдатель создаёт/правит акты и складские операции; отозванный прораб продолжает списывать материалы — нарушение семантики №168 («отозван = read-only») и роли VIEWER | Добавить `assertWritable` (готовые образцы: `brigades.service.ts:115-124`, `projects.service.ts:22-34`): revokedAt → 403, VIEWER → 403 на всех пишущих методах | S | **Да** |
| 2 | 🔴 | `warehouse.service.ts:75-99,61-72`; `brigades.service.ts:161-172,184-186`; `schema.prisma:468-484,565-581`; `analytics.service.ts:87-100` | «Общие» позиции склада (objectId=null) и «мобильные» бригады видны/редактируемы/**удаляемы любым авторизованным**; стоимость ВСЕХ общих позиций всех пользователей суммируется в `totalWarehouseValue` каждого | Кросс-тенантная утечка и порча данных: клиент A видит/удаляет склад и бригады клиента B (createdBy/ownerId у моделей нет) | Ввести владельца (createdBy) на WarehouseItem/Brigade (миграция); до неё — закрыть чужим запись/удаление objectId=null | M (миграция) / S (закрыть запись) | **Да** для мульти-клиента; для одного демо — нет |
| 3 | 🔴 | `invite.service.ts:29-71,180-198`; `create-invite.dto.ts:11-13` | **Эскалация через ссылку**: прораб (даже не менеджер) создаёт ссылку с `role=CUSTOMER`, любой принимает — становится заказчиком объекта. В addAccess тот же запрет есть (`access.service.ts:103-110`) | Обход правила выдачи ролей: управление объектом/доступами/ценами получает кто угодно | В createInviteLink запретить role=CUSTOMER не-заказчику (симметрично access.service); FOREMAN-не-менеджеру — только VIEWER/FOREMAN | S | Нет (нужен злой умысел), но до мульти-клиента обязателен |
| 4 | 🔴 | `change.service.ts:36-58,61-67,149-178,199-201,214-330`; `change.controller.ts:24` | Живой API согласований **не проверяет revokedAt**: отозванный прораб/заказчик предлагает и APPROVE'ит изменения, атомарно меняющие Material. Frontend не использует API (0 ссылок) | Мёртвая для UI поверхность — живая дыра: запись после отзыва; плюс нарушение «мёртвый код не оставляем» | Выключить модуль (§5 вариант б) либо добавить в getAccess revokedAt-проверку и в review — canWrite | S | Нет |
| 5 | 🔴 | `audit.service.ts:109-121`; `audit.controller.ts:11-22` | `GET /audit` **без параметров** = последние 100 записей журнала ВСЕХ объектов/пользователей (before/after: цены, отзывы доступов); `?entity=object_access` — то же по всем объектам | Межтенантная утечка чувствительных данных любому авторизованному | Сделать entity+entityId обязательными или строить where от доступных objectId (access-scope) | S | Нет для одного клиента; да для мульти-клиента |

| 6 | 🟡 | `reports.service.ts:117-158` (list без stripPrices; mustHidePrices только в detail:161-174); фронт: `Reports.tsx:624,649` | В **списке** отчётов VIEWER/hidePrices/отозванный видит `totalAmount` каждого акта; скрытие работает только в карточке и в PDF/XLSX (идут через detail) | Деньги утекают там, где hidePrices обязан работать; «в карточке 0, в списке — сумма» | Применить mustHidePrices+обнуление totalAmount в list | S | **Да** (демо «наблюдатель без денег» ломается на глазах) |
| 7 | 🟡 | `object-access.guard.ts:100-110` (findFirst без orderBy), `117-123` | Guard выбирает запись доступа **недетерминированно**: при двух записях (объектная живая + проектная отозванная) revoked-блок срабатывает по «не той» записи; приоритет «объектная важнее» (`access-scope.ts:249-268`) не воспроизведён | Один запрос то проходит, то 403 — зависит от порядка строк в БД; guard ↔ слой расходятся | В guard читать все grants и резолвить через resolveObjectRole/resolveProjectAccess | S | Нет |
| 8 | 🟡 | `projects.service.ts:38-46,50-69`; `materials.service.ts:90-110,113-140`; слой: `access-scope.ts:220-242` | Локальные проверки дублируют access-scope с **обратным приоритетом** (проектная запись важнее объектной, в слое — наоборот). Кейсы: проектная отозвана + объектная жива → запись заблокирована; VIEWER в проектной + FOREMAN в объектной → materials блокирует, objects разрешает | Две правды об одном пользователе — самый дорогой класс багов поддержки | Заменить raw-хелперы на resolveProjectAccess (образец — `brigades.service.ts:144-159`, №172) | M | Нет |
| 9 | 🟡 | `price-list.service.ts:123-152` (grants без revokedAt/isManager/isHidden) | В списке справочников **отозванный участник получает canWrite:true** (кнопки видны), операции падают 403 (`catalog-access.ts:94-107` считает правильно) | Бэк↔фронт рассинхрон: UI обещает, API отказывает | Использовать loadAccessGrants (полный select) | S | Нет |
| 10 | 🟡 | `projects.service.ts:317-346 (remove), 288-312 (update)` против `135-137 (create)` | Участник **только одного проекта** может переименовать/менять даты/удалить (пустой) ЭТОТ проект, но не может создать новый: создание — объектное право (projectId=null), правка/удаление — проектное | Несимметричная семантика: «гость проекта» меняет карточку, влияющую на всех; правило невозможно объяснить клиенту | Определить правило (правка карточки = объектное canWrite/canManage) и привести update/remove к нему | S | Нет |
| 11 | 🟡 | `warehouse.service.ts:28-36` против `brigades.service.ts:133-141` | Склад видит только «объектный» участник (projectId=null), бригады — любой проектный участник (№172). Один объект — два правила | Прораб «на проекте» фиксирует выходы, но не видит склад — непоследовательный продукт | Унифицировать по №172 или задокументировать разницу | S | Нет |
| 12 | 🟡 | `Materials.tsx:422,1661,1681,1687,1902`; бэк отдаёт canWrite (`objects.service.ts:165,227`) — в Materials.tsx 0 употреблений | Фронт гейтит кнопки ЗАПИСИ флагом «скрыты цены»: прораб с hidePrices=true теряет «+ фикс»/шестерёнку/дублирование, хотя бэк разрешает; revoked скрыт лишь потому, что бэк сворачивает его в hidePrices | Смешение осей «деньги» и «запись»; кнопка исчезает у того, кому разрешено писать | Гейтить запись на canWrite (+revoked), деньги — на hidePrices | S | Нет |
| 13 | 🟡 | `Reports.tsx`, `Warehouse.tsx`, `Brigades.tsx`, `Dashboard.tsx`, `Analytics.tsx` — 0 употреблений canWrite/revoked/VIEWER/hidePrices (grep) | Бригады: бэк запрещает запись VIEWER/отозванным (`brigades.service.ts:115-124`), UI кнопки показывает → «кнопка видна, API 403». Отчёты/склад: и UI, и бэк разрешают (находка 1) → VIEWER управляет актами | Два разных рассинхрона; пользователь ловит 403 без объяснения или делает недозволенное | После находки 1 прокинуть флаги объекта в страницы и гейтить кнопки (образец: `Objects.tsx:414,1158-1202`) | M | Частично (через находку 1) |
| 14 | 🟢 | `invite.service.ts:91 и 101`; `getInviteLinks:74-87` | Дубль checkObjectAccess в revokeInviteLink; любой не-VIEWER видит все ссылки-приглашения вместе с токенами | Мелочь + поверхность для находки 3 | Убрать второй вызов; список ссылок — только canManage | S | Нет |
| 15 | 🟢 | `schema.prisma:51` vs `analytics.service.ts:47,74,175`, `dashboard.service.ts:139,160`, `objects.service.ts:106`, `objectService.ts (fetchObjects)` | `Object.isArchived` объявлен легаси («сброшено миграцией»), но живёт в SQL-фильтрах и фронтовом фильтре | Следующий разработчик не поймёт, архив есть или нет | Добить официально (drop + убрать фильтры) или вернуть смысл | S | Нет |
| 16 | 🟢 | `schema.prisma:97-102`; `Settings.tsx:44-45` | Глобальная `User.role` мертва на 3/4 значений (STORE_MANAGER — только лейбл); используется лишь ADMIN в 4 местах бэка (прямым запросом, не из JWT) | «Роль» значит две разные вещи в двух местах | Свести к isAdmin при первой миграции | S | Нет |
| 17 | 🟢 | `projects.controller.ts:22-25` | Устаревший TODO «guard пропускает :id» — guard резолвит ProjectsController :id (`object-access.guard.ts:39-51`) | Комментарий вводит в заблуждение | Обновить комментарий | S | Нет |
| 18 | 🟢 | `add-access.dto.ts` (нет hidePrices) против `create-invite.dto.ts:15-17` | Пригласить через модалку с «скрыть цены» нельзя, через ссылку — можно | Асимметрия возможностей | Добавить hidePrices в AddAccessDto/updateAccess | S | Нет |
| 19 | 🟢 | `users.service.ts:14-35` | Страница «Участники» (getTeam) не показывает объекты, где пользователь участник только проекта | Проектный участник видит пустую страницу | Включать проектные записи или задокументировать | S | Нет |

---



## 2A. Полный обход: где права проверяются В ОБХОД access-scope.ts

Формат: локальная проверка → дублирует ли слой → совпадает ли семантика («только проект» vs «весь объект») → есть ли hidePrices/VIEWER → обход через id в URL.

| Модуль (файл:строка) | Локальная проверка | Дубль слоя? | Семантика | hidePrices / VIEWER | Обход через id в URL |
|---|---|---|---|---|---|
| `access.service.ts:24-32` getMyAccess | raw findFirst `{projectId: null}` | Да (частично — только объектный контекст) | Строго объектная; проектные участники не управляют командой — **верно** | нет (не нужно: управление) | Нет: accessId проверяется на принадлежность объекту (`:195-197,259-261`) |
| `objects.service.ts:21-35` assertCanEdit | через `resolveObjectRole` — **слой** | Нет (использует слой) | Совпадает | canWrite/revoked ✔ | Нет (guard + сервис) |
| `projects.service.ts:38-46,50-69` | raw findFirst, проектная запись приоритетнее | **Да, с обратным приоритетом** | Расхождение (находка 8) | mustHidePrices:72-80 ✔ (только чтение) | Нет: :id резолвит guard (`object-access.guard.ts:39-51`) + сервис |
| `materials.service.ts:90-110,113-140` | raw findFirst (проектная → объектная) | **Да, с обратным приоритетом** | Расхождение (находка 8) | mustHidePrices:54-67 ✔; VIEWER-блоки на каждом методе (175,248,336,384,415,533,773,838) | Нет: materialId резолвит guard (`:52-82`) + checkMaterialAccess; `POST /materials` — projectId из body проверяется (`:173`) |
| `price-list/catalog-access.ts:67-111` | через resolveObjectRole/resolveProjectAccess — **слой** | Нет | Совпадает; revoked ✔ (`:96-99`) | canWrite из слоя ✔ | Нет: catalogId → привязки → grants |
| `price-list.service.ts:123-152` listCatalogs | raw findMany grants БЕЗ revokedAt/isManager | Да, **обрезанный** | canWrite врёт для отозванных (находка 9) | — | Нет |
| `warehouse.service.ts:28-36,39-58,61-72` | raw findFirst (объектная / проектная→объектная) | Да | Только projectId=null для объекта (находка 11) | **нет ни hidePrices, ни VIEWER, ни revoked** | **Да для objectId=null**: checkItemAccess пропускает проверку (`:68-70`) — чужие «общие» позиции (находка 2) |
| `brigades.service.ts:133-141,144-159,161-172` | через loadAccessGrants+resolve* — **слой** (№172) | Нет | Совпадает; canWrite ✔ | canWrite ✔; цены (outputValue) VIEWER не скрываются — мелочь | **Да для objectId=null**: мобильные бригады без проверки (находка 2); shiftId проверяется на принадлежность бригаде (`:347-352,390-395`) ✔ |
| `access-request.service.ts:36-54,57-131,164-175,178-251` | raw findFirst + isAdmin (User.role) | Да (собственная формула менеджера, 3-й дубль) | Объектная запись для менеджера — верно; заявитель — любая запись | VIEWER-блок ✔ (`:72-76`), revoked ✔ (`:69-71`) | Нет: approve/reject проверяют admin/objectManager (`:183-186,259-264`) |
| `invite.service.ts:18-26,29-71,74-87,90-112` | raw findFirst `{projectId:null}` | Да | Объектная — верно | VIEWER-блок на создание ✔; **роль ссылки не ограничена** (находка 3) | Нет: inviteId проверяется на принадлежность объекту (`:93-95`) |
| `object-templates.service.ts:50-68,173-201` | raw findFirst `{projectId:null}` + isAdmin | Да | Требует объектный доступ — строже №163 (проектный участник не сохранит шаблон) | VIEWER ✔, revoked ✔ | Нет: автор/админ (`:173-184`); публичный шаблон — всем (by design) |
| `estimate-recalc.service.ts:59-74,93-111` | raw findFirst + assertCanRecalc | Да ( но **самый строгий**: revoked+VIEWER+hidePrices) | Проектная→объектная (как materials) | ✔ все три | Нет: rollback фильтрует строки проектом (`:447-451`) |
| `estimate-templates.service.ts:18-37,41-52` | raw findFirst + assertCanApply | Да | Проектная→объектная | create — намеренно читательский (№168, `:70-71`); apply — revoked/VIEWER ✔ | Нет: шаблон только свой (`:110-113,123-126`); projectId проверяется |
| `reports.service.ts:74-93,95-103` | raw findFirst (проектная→объектная) | Да | Совпадает с materials | **VIEWER/revoked на запись — НЕТ** (находка 1); hidePrices только detail | Нет: reportId→projectId→доступ; objectId/projectId сверяются (`:187-190`); itemId проверяется на принадлежность отчёту (`:302-307,347-352`) |
| `rentals.service.ts:15-107` | владельческая (userId из JWT) | Не дубль — другая модель | Личные данные | не нужно | Нет: `where {id, userId}` везде ✔ |
| `analytics.service.ts:38-61,67-115,162-188` | **SQL EXISTS по object_access** (4-я копия правил денег: revokedAt/isHidden/hidePrices/role<>'VIEWER') | **Да — копия buildMoneyScope в сыром SQL** | Совпадает (projectId NULL OR = p.id) | ✔ в деньгах; НО «общий склад» без фильтров (`:90`) | Нет (всё от userId) |
| `dashboard.service.ts:93-97,130-171` | через buildWorkScope/buildMoneyScope — **слой**; но money-запросы дублируют правила в SQL (`:140-147,161-170`) | Частично | Совпадает | ✔ | Нет |
| `users.service.ts:14-63` | raw findMany `{projectId:null}` | Да | Только объектные (находка 19) | не нужно (чтение) | Нет |
| `audit.service.ts:37-52,55-106,109-121` | raw findFirst (проектная→объектная) + per-entity | Да | Совпадает | не нужно | **Да**: без entity+entityId проверка пропускается (находка 5) |
| `change.service.ts:36-58` | raw findFirst (проектная→объектная) | Да | Совпадает | VIEWER ✔ (MONEY_ROLES); **revoked — НЕТ** (находка 4) | Нет: materialId проверяется на принадлежность проекту (`:69-79`) ✔ |

**Вывод по §2:** access-scope.ts используют целиком только objects, brigades, dashboard, catalog-access и (частично) price-list/projects-списки. Остальные ~10 сервисов держат собственные копии с расхождениями в приоритете записей, revoked и VIEWER. Правило «доступы не должны расползаться по сервисам» (`access-scope.ts:6-7`) фактически нарушено.

---


## 3. Расхождения бэк ↔ фронт

Флаги, которые отдаёт `objects.service.findOne` (`objects.service.ts:212-229`): `role, hidePrices, hasObjectAccess, accessId, hiddenForMe, revoked, isManager, canWrite, canManage` (в findAll — те же, `:142-167`).

| Кейс | Бэк | Фронт | Вердикт |
|---|---|---|---|
| `hasObjectAccess=false` (участник только по проекту) | findOne отдаёт флаг; объекты в списке видны (findAll:100-125, №163) | `Objects.tsx:1158,1164,1202` — кнопки объекта скрыты, «Запросить право» показан; `Projects.tsx:150-154` — canCreateProjects строгая; `Projects.tsx:499` — 403 мапится в подсказку | ✔ Согласовано (образец для остальных) |
| Отозванный доступ (revokedAt) | Guard блокирует не-GET для objects/projects/materials (`object-access.guard.ts:117-123`); сервисы: objects ✔, projects ✔, materials ✔, brigades ✔; **warehouse/reports/change — НЕТ** | Глобальный AccessRevokedModal (`App.tsx:135`); `Objects.tsx:1118` бейдж; `Projects.tsx:153` ✔; Materials.tsx не проверяет revoked напрямую (спасает сворачивание revoked в hidePrices на бэке); Reports/Warehouse/Brigades — 0 проверок | ⚠️ Два мира: где-то строго, на складе/в отчётах отозванный продолжает писать, и UI это показывает (находки 1, 13) |
| VIEWER | Смета/проекты/объект/бригады/шаблоны — блоки записи ✔; **склад/отчёты — нет** (находка 1); список отчётов показывает суммы (находка 6) | Materials.tsx гейтит запись через hidePrices (находка 12); Reports/Warehouse кнопок не прячут | 🔴 VIEWER управляет актами и складом — согласованно с обоих концов, но неправильно |
| hidePrices (деньги) | materials ✔ (stripPrices:70-85), projects ✔ (:275), dashboard ✔ (buildMoneyScope), analytics ✔ (SQL), reports — только detail (находка 6), warehouse — цены не скрываются вообще, brigades — outputValue не скрывается | Materials ✔ (45 мест), Projects ✔ (:157), Users бейдж ✔; Reports/Warehouse/Dashboard/Analytics — не нужны (бэк обнуляет), кроме списка отчётов | ⚠️ Цены склада и суммы в списке отчётов видны тем, кому деньги скрыты |
| canWrite/canManage | Отдаются в findOne/findAll | Используются только в `Objects.tsx:414` (canManage, модалка доступа); Projects.tsx собирает canCreateProjects вручную из role/revoked/hasObjectAccess вместо canWrite | ⚠️ Флаги доставлены, но consumers почти нет — UI пересобирает правила руками |
| Глобальная роль (AuthContext) | user.role в JWT/localStorage (`jwt.strategy.ts:46`) | Только лейбл `Settings.tsx:44-45`; для прав не используется | ✔ Не мешает, но мертво (находка 16) |

**Опаснее всего** (кнопка видна → API отвечает, но не должно): находки 1, 2, 6. **Кнопка видна → 403**: находки 9, 13 (бригады). **Кнопка скрыта → API разрешает**: находка 12.

---


## 4. IDOR: эндпоинты, где объект доступа берётся из body/query

Проверено на принадлежность (✔) / не проверено (✘):

| Эндпоинт | Поле | Принадлежность | Комментарий (файл:строка) |
|---|---|---|---|
| `POST /warehouse/transactions` | warehouseItemId, projectId | ✘ / ✔ | «Общая» позиция (objectId=null) — без проверки (`warehouse.service.ts:174`); проект списания проверяется (`:176`) |
| `DELETE/PATCH /warehouse/items/:id` | id | ✘ для objectId=null | checkItemAccess:61-72 — проверка только при objectId != null |
| `GET /warehouse/transactions?itemId` | itemId | ✘ для objectId=null | `warehouse.service.ts:227-229` |
| `POST/PATCH /brigades/:id/shifts` | projectId, members[].memberId | ✔ / ✔ | Проект (`brigades.service.ts:322-324,354-356`); рабочие — из своей бригады (`:62-72`); НО бригада objectId=null — без проверки |
| `GET /brigades/:id/shifts?projectId` | projectId | ✘ | Фильтр без проверки доступа к проекту (`:305-307`); данные в рамках доступной бригады — 🟢 |
| `POST /reports` | projectId, objectId | ✔ | Сверка соответствия (`reports.service.ts:187-190`) |
| `POST/PATCH/DELETE /reports/:id/items/:itemId` | itemId | ✔ | `where {id, reportId}` (`:302-307,347-352`) |
| `POST /reports/:id/items` | materialId (=PriceItem) | ✘ | resolvePriceItem:105-115 — ЛЮБАЯ позиция справочника по id, включая чужие личные (цена подтягивается в акт) |
| `POST /materials` | projectId / priceItemId, materialItemId | ✔ / ✘ | Проект ✔ (`materials.service.ts:173`); расценки — любые активные по id без проверки доступа к справочнику (`:179-196`): snapshot цены чужого личного справочника |
| `POST /materials/price-item` | catalogId | ✔ | resolvePriceCatalog→loadCatalogAccess (`:649-661,734-735`) |
| `POST /change` | projectId, materialId, payload.priceItemId/materialItemId | ✔ | Материал — принадлежность проекту (`change.service.ts:69-79`); позиции — ownerId null/self (`:92-110`) |
| `POST /estimate-templates/:id/apply` | projectId | ✔ | `estimate-templates.service.ts:130`; шаблон только свой |
| `POST /object-templates/:id/create-object` | id шаблона | ✔ (публичные — всем, by design) | `object-templates.service.ts:198-201` |
| `PATCH /projects/:id`, `POST /objects` | catalogId | ✔ | resolveCatalogId — только доступные (`projects.service.ts:83-116`, `objects.service.ts:38-56`) |
| `POST/PATCH/DELETE /objects/:objectId/access/:accessId` | accessId | ✔ | `where {id, objectId}` (`access.service.ts:195-197,259-261,306-308,348-350`) |
| `PATCH /me/access/:id` | id | ✔ | `where {id, userId}` (`access.service.ts:436-439`) |
| `POST /access-requests/:id/approve\|reject\|cancel` | id | ✔ | admin/objectManager / автор (`access-request.service.ts:180-186,256-264,294-296`) |
| `GET /audit?entity&entityId` | entityId | ✘ при отсутствии пары | `audit.service.ts:110-112` (находка 5) |
| `POST /projects/:id/price-recalc`, `.../rollback` | catalogId, auditId | ✔ | Каталог — loadCatalogAccess; версии — `where {entity:'project', entityId:projectId}` (`estimate-recalc.service.ts:429-435`) |
| Экспорты `GET /reports/:id/export/pdf\|xlsx` | id | ✔ | Через detail() со stripPrices (`reports.controller.ts:65,82`) |

**Массовые операции:** apply шаблона сметы (createMany) — проект проверяется ✔; создание объекта из шаблона — свой новый объект ✔; recalc/rollback — строки фильтруются проектом ✔; setHidden — updateMany по `{userId, objectId}` ✔ (`access.service.ts:443-446`). Системных «массовых» дыр нет.

**Реальные IDOR-дыры** (свод): общие склад/бригады (находка 2), аудит без фильтра (находка 5), priceItemId/materialItemId из чужих личных справочников в материал/акт (строки выше — 🟡, цена «утекает» snapshot'ом).

---


## Матрица прав: роль × действие × где проверяется

Роли: **C**=CUSTOMER, **F**=FOREMAN, **Fm**=FOREMAN+isManager, **V**=VIEWER, «объектная запись»=projectId=null, «проектная»=projectId=X. ✅=разрешено, ❌=запрещено, ⚠️=проверка отсутствует/некорректна.

| Действие | C | F | Fm | V | Где проверяется (файл:строка) | Revoked блокирует? | Дефект |
|---|---|---|---|---|---|---|---|
| Создать объект | ✅ (любой авторизованный; создателю авто-доступ) | ✅ | ✅ | ✅ | `objects.service.ts:60-96` | — | — |
| Редактировать объект | ✅ | ✅ | ✅ | ❌ | guard `object-access.guard.ts:117-123` + `objects.service.ts:21-35` | ✅ | — |
| Создать проект | ✅ | ✅ (объектная запись) | ✅ | ❌ | `projects.service.ts:135-137` (raw projectId=null) | ✅ | обходной путь №178 |
| Править/удалить проект | ✅ | ✅ | ✅ | ❌ | `projects.service.ts:288-292,317-321` (checkProjectAccess) | ✅ (по найденной записи) | проектный участник тоже может (находка 10) |
| Смотреть список объектов/проектов | ✅ | ✅ | ✅ | ✅ | `objects.service.ts:101-125`, `projects.service.ts:156-198` (access-scope) | нет (замороженные видны — by design №168) | — |
| Создать материал | ✅ | ✅ | ✅ | ❌ | `materials.service.ts:171-177` | ✅ (guard) | priceItemId без проверки справочника |
| Зафиксировать объём (fix) | ✅ | ✅ | ✅ | ❌ | `materials.service.ts:244-251` + guard | ✅ (guard) | — |
| Править/удалить материал, spec, lock | ✅ | ✅ | ✅ | ❌ | `materials.service.ts:527-538,832-841,330-341,378-389` | ✅ (guard) | — |
| Пересчитать смету (recalc/rollback) | ✅ | ✅ | ✅ | ❌ | `estimate-recalc.service.ts:93-111` | ✅ | — (эталон строгости) |
| Сохранить/применить шаблон сметы | ✅ (сохранить — любой читатель, №168) | ✅ | ✅ | сохранить ✅ / применить ❌ | `estimate-templates.service.ts:64-71,122-131` | сохранить ✅ / применить ✅-блок | — (by design) |
| Сохранить шаблон объекта | ✅ | ✅ (объектная) | ✅ | ❌ | `object-templates.service.ts:50-68` | ✅ | строже №163 (проектный не может) |
| Создать/править отчёт, акт, позиции | ✅ | ✅ | ✅ | **⚠️ ✅ (должно быть ❌)** | `reports.service.ts:176-357` — только наличие доступа | **⚠️ нет** | находка 1 |
| Экспорт PDF/XLSX | ✅ (strip при hidePrices) | ✅ | ✅ | ✅ (0 ₽) | `reports.controller.ts:59-93` → detail | — | — |
| Склад: позиция/операция | ✅ | ✅ | ✅ | **⚠️ ✅ (должно быть ❌)** | `warehouse.service.ts:114-221` — только наличие/объектная | **⚠️ нет** | находки 1, 2 |
| Бригада: создать/править/состав | ✅ | ✅ (любая запись, №172) | ✅ | ❌ | `brigades.service.ts:133-141,222-287` | ✅ | objectId=null — всем (находка 2) |
| Бригада: фиксировать выход | ✅ | ✅ | ✅ | ❌ | `brigades.service.ts:318-324` + проект `:144-159` | ✅ | — |
| Справочник: читать | ✅ участники | ✅ | ✅ | ✅ | `catalog-access.ts:67-111` | ✅ (`:96-99`) | — |
| Справочник: писать | ✅ | ✅ | ✅ | ❌ | `catalog-access.ts:18-25,94-107`; `price-list.service.ts:201-213,547-557,575-585` | ✅ | canWrite в listCatalogs врёт (находка 9) |
| Управление командой (add/update/revoke/restore/purge) | ✅ | ❌ | ✅ | ❌ | `access.service.ts:36-52` + ограничения `:103-110,211-225,271-276,357-362` | ✅ | — |
| Ссылка-приглашение: создать | ✅ | ✅ **любую роль** | ✅ | ❌ | `invite.service.ts:29-41` | ⚠️ нет (revoked не проверяется) | находка 3 |
| Принять приглашение | любой авторизованный | — | — | — | `invite.service.ts:155-212` | — | — |
| Заявка №178: подать | ❌ (не нужна) | ✅ (проектный) | ❌ | ❌ | `access-request.service.ts:57-131` | ✅ | — |
| Заявка №178: одобрить/отклонить | ✅ ( менеджер объекта) | Fm ✅ | ✅ | ❌; ADMIN (глоб.) ✅ | `access-request.service.ts:178-289` | ✅ (isObjectManager:49) | — |
| ChangeRequest: предложить/согласовать | ✅ | ✅ | ✅ | ❌ | `change.service.ts:61-67,149-178` | **⚠️ нет** | находка 4, UI мёртв |
| Дашборд/KPI | объёмы — все; деньги — только «денежно-видимые» | — | — | — | `dashboard.service.ts:93-97,130-171` | ✅ (buildWorkScope) | — |
| Аналитика | деньги — hidePrices-фильтр; склад — ⚠️ общие позиции всем | — | — | — | `analytics.service.ts:38-115` | ✅ | находка 2 (склад) |
| Аудит-журнал | ⚠️ любой авторизованный (без фильтра) | — | — | — | `audit.service.ts:109-121` | — | находка 5 |

---


## 5. Мёртвое: ChangeRequest — факты и 3 варианта

**Факт (grep):**
- API жив: `change.controller.ts:29-54` — `GET /change/project/:projectId`, `POST /change`, `PATCH /change/:id/review`; сервис 436 строк (`change.service.ts`), DTO×2, модуль зарегистрирован.
- Frontend: `git grep "change"` по `frontend/src` с фильтром api/fetch//change/ChangeRequest — **0 ссылок**. Ни сервиса, ни страницы «Согласования», ни маршрута в App.tsx.
- Модель: `schema.prisma:278-297` + связи на User (`:30-31`), Project (`:84`), Material (`:150`).
- Косвенные использования: `projects.service.ts:326,331` (count changeRequests блокирует удаление непустого проекта), `users.service.ts:174` (комментарий про FK).
- API при этом дырявый (находка 4): живой эндпоинт без revoked-проверки, которого нет в UI.

Это нарушение правила «мёртвый код не оставляем»: 500+ строк бэка + модель + миграционная история обслуживают фичу, которой нет в продукте.

| Вариант | Содержание | Цена | Плюсы | Минусы |
|---|---|---|---|---|
| (а) Доделать UI «Согласования» | Страница/панель в проекте: список заявок, создание (ADD_ROW/CHANGE_QTY/CHANGE_PRICE), ревью заказчиком; бэкенд уже готов (payload-валидация, applyPayload, аудит) | **L** (экран + состояние + тесты + починка revoked; ~3-5 дней) | Превращает в продуктовую фишку «прораб предлагает — заказчик утверждает»; бэк не пропадает | Новая фича перед первым платежом = распыление; меняет процесс клиента (не факт, что нужен); всё равно чинить находку 4 |
| (б) Выключить и удалить | Убрать модуль change/ (controller/service/dto/module), из app.module; миграция: drop table change_requests + связи в schema (User.proposedChanges/reviewedChanges, Project.changeRequests, Material.changeRequests); поправить projects.service.remove (убрать count) | **S-M** (~0.5-1 день: код S + миграция M из-за FK) | Закрывает находку 4 бесплатно; минус 500 строк и целая сущность из головы; соответствует правилу «мёртвый код не оставляем» | Если согласования когда-нибудь понадобятся — писать заново (но git-история сохранит) |
| (в) Оставить как есть | Ничего не делать | 0 | 0 усилий | Дыра (находка 4) остаётся живой; сущность продолжает_tax-ить сложность ( schema, count в remove, путаница «есть API — нет UI») |

**Рекомендация: (б) выключить и удалить.** Обоснование: (1) единственный вариант, который одновременно закрывает 🔴-находку 4 и соблюдает правило владельца о мёртвом коде; (2) согласования дублируют уже работающий механизм №178 (AccessRequest) по паттерну «заявка→ревью», т.е. продуктовой уникальности нет; (3) перед первым платежом L-работа над фичей, которой никто не пользовался, — худшая инвестиция; (4) данные в `change_requests` при пустом UI заведомо пусты/тестовы — потеря нулевая (подтвердить запросом владельца, см. последний раздел). Порядок: сначала отключить роуты (S, немедленно), миграция drop — следующим релизом.

---


## 6. Оценка сложности для владельца (главный вопрос аудита)

### 6.1. «Кто может создать проект на объекте X?» — что надо держать в голове

**Число: 6 сущностей/механизмов и 5 флагов.**

1. `ObjectAccess.projectId` (null vs X) — право объектное или проектное (`projects.service.ts:38-46`);
2. `ObjectAccess.role` (≠VIEWER) — `projects.service.ts:31-33`;
3. `ObjectAccess.revokedAt` — `projects.service.ts:26-30`;
4. Обходной путь: `AccessRequest.status=APPROVED` → approve создаёт/чинит объектную запись FOREMAN+isManager (`access-request.service.ts:205-236`);
5. `InviteToken.role` — какая запись появится при принятии (`invite.service.ts:180-191`);
6. `ObjectAccess.isManager` — в создании НЕ участвует, но участвует в смежном «кто одобрит заявку» (`access-request.service.ts:50-53`) — это тоже нужно держать в голове.

Плюс глобальный ADMIN, который одобряет заявку на любом объекте (`access-request.service.ts:36-42`). Итого честный ответ на вопрос требует **3 мест в коде и 5 флагов**; для сравнения, в целевой модели (§6.4) — 1 функция и 2 уровня.

### 6.2. Сколько файлов править, чтобы добавить новую роль или новый флаг

**Число: ~21 файл бэкенда + ~6 файлов фронта ≈ 27.**

Бэкенд (литералы VIEWER/hidePrices/revokedAt/isManager и собственные check-хелперы): `access-scope.ts`, `object-access.guard.ts`, `access.service.ts`, `objects.service.ts`, `projects.service.ts`, `materials.service.ts`, `warehouse.service.ts`, `reports.service.ts`, `brigades.service.ts`, `change.service.ts` (если жив), `estimate-recalc.service.ts`, `estimate-templates.service.ts`, `invite.service.ts`, `access-request.service.ts`, `object-templates.service.ts`, `price-list.service.ts`, `catalog-access.ts`, `analytics.service.ts` (сырой SQL), `dashboard.service.ts` (SQL), `users.service.ts`, `audit.service.ts` (если флаг влияет на чтение).
Фронт: `Objects.tsx`, `Projects.tsx`, `Materials.tsx`, `objectService.ts` (тип ObjectData), `accessService.ts`, `Users.tsx` (+ точечно Settings/PriceList).
Для нового флага добавляется ещё `schema.prisma` + миграция + `loadAccessGrants` select + DTO.

### 6.3. Какие флаги дублируют друг друга (и что схлопнуть без потери поведения)

| Дубли | Где | Как схлопнуть |
|---|---|---|
| 1. `role=VIEWER` ↔ `hidePrices` | VIEWER всегда без денег: 4 копии формулы (`access-scope.ts:187-191`, `materials.service.ts:54-67`, `projects.service.ts:72-80`, `reports.service.ts:48-57`, `estimate-recalc.service.ts:76-87`) | Оставить одну ось «видит деньги» = `hidePrices OR role=VIEWER OR revoked` в ОДНОЙ функции слоя; роль отвечает только за запись |
| 2. `isManager` ↔ `role=CUSTOMER` | canManage = `CUSTOMER OR (FOREMAN && isManager)` — 3 копии (`access-scope.ts:196-199`, `access.service.ts:43-45`, `access-request.service.ts:50-53`) | Ввести роль MANAGER (=FOREMAN+isManager) и OWNER (=CUSTOMER): canManage = role ∈ {OWNER, MANAGER}, флаг isManager исчезает |
| 3. `revokedAt` ↔ canWrite/hidePrices | revoked ⇒ canWrite=false, hidePrices=true — пересчитывается в каждом сервисе | Держать в RoleResolution (уже есть), удалить локальные пересчёты |
| 4. `Object.isArchived` ↔ `ObjectAccess.isHidden` | Глобальный архив мёртв (`schema.prisma:51`), но фильтры живы (находка 15) | Добить isArchived: drop column + убрать 6 SQL-фильтров; архив = только isHidden |
| 5. `User.role` (4 значения) ↔ фактический ADMIN | 3 значения мертвы (находка 16) | `isAdmin: Boolean` (или enum ADMIN/USER); JWT-поле role убрать из проверок |

Итого: 5 флагов ObjectAccess (role, hidePrices, isManager, isHidden, revokedAt) + 2 глобальных (User.role, Object.isArchived) = 7 → **схлопываются до 4** (role 4 уровней, showPrices, archivedAt, isHidden) без изменения наблюдаемого поведения.

---


### 6.4. Целевая модель (НЕ реализовывать в рамках аудита — предложение)

**Два уровня:**

1. **Роль на объекте** (уровень объекта, одна запись на пользователя): `ObjectRole ∈ {OWNER, MANAGER, FOREMAN, VIEWER}` + состояния `archivedAt` (бывший revokedAt) + `showPrices` (инверсия hidePrices) + `hiddenForMe` (бывший isHidden — можно вынести в отдельную таблицу предпочтений, чтобы не дублировать на каждой записи).
   - OWNER = нынешний CUSTOMER (canWrite + canManage + выдача ролей);
   - MANAGER = FOREMAN+isManager (canWrite + canManage командой, не трогает OWNER);
   - FOREMAN = canWrite без управления;
   - VIEWER = только чтение, showPrices=false принудительно.
2. **Сужение до проектов** (уровень «грант»): `ProjectGrant {objectId, projectId, role}` — то же, что нынешняя запись с projectId=X. Правило: роль на объекте покрывает все проекты (включая будущие); грант даёт роль только в своём проекте. При конфликте — объектная запись приоритетнее (как в `resolveProjectAccess:231-233`, но зафиксировано ЕДИНОЖДЫ).

**Capability-слой поверх access-scope.ts** (эволюция, не переписывание):
`can(user, action, {objectId?, projectId?, resourceId?})` → boolean (+ причина для UI). Действия — плоский список: `object.update, project.create, project.update, project.delete, material.write, fix.write, spec.lock, estimate.recalc, report.write, report.read.money, warehouse.write, brigade.write, catalog.write, team.manage, invite.create, access-request.review, template.save, template.apply`. Внутри — один вызов `loadAccessGrants` + `resolveObjectRole/resolveProjectAccess` (уже существуют, `access-scope.ts:207-268`) + таблица «действие → требуемый уровень». Все сервисы заменяют локальные check-хелперы на `can(...)`; guard вызывает ту же функцию. `mustHidePrices` заменяется на `can(user,'*.read.money',ctx)===false`.

**Миграция данных без потери (mapping 1:1):**
- `ObjectAccess{projectId=null, role=CUSTOMER}` → ObjectRole=OWNER; `{FOREMAN, isManager=true}` → MANAGER; `{FOREMAN, isManager=false}` → FOREMAN; `{VIEWER}` → VIEWER.
- `ObjectAccess{projectId=X}` → ProjectGrant{objectId, projectId, role} (те же значения роли; isManager для проектных записей и сегодня не применяется — `access.service.ts:166` ставит его только при объектной выдаче).
- `revokedAt/revokedById` → `archivedAt/archivedById` на той же записи (семантика «снимок + read-only» сохраняется; createSnapshot не трогаем).
- `hidePrices` → `showPrices = !hidePrices` (VIEWER — принудительно false).
- `isHidden` → переезжает в `UserObjectPreference{userId,objectId,isHidden}` одна строка на объект (сегодня `setHidden:443-446` и так пишет флаг во ВСЕ записи объекта — дубль устраняется).
- `AccessRequest` — без изменений (approve выдаёт MANAGER вместо FOREMAN+isManager — поведение то же).
- `InviteToken.role` — mapping при принятии (CUSTOMER→OWNER и т.д.); ограничение находки 3 добавляется сразу.
- Архив объектов: `Object.isArchived` — drop (уже «сброшено миграцией», фильтры убираются).
- Частичный unique-индекс `(userId, objectId, COALESCE(projectId,0))` (`schema.prisma:263-266`) переносится на обе таблицы.
- ChangeRequest — удаляется (§5б), FK чистятся.

**Обратная совместимость API:** контракт `objects.findAll/findOne` НЕ меняется: адаптер собирает нынешний JSON (`role: 'CUSTOMER'|'FOREMAN'|'VIEWER'` = OWNER→CUSTOMER, MANAGER/FOREMAN→FOREMAN; `hidePrices, hasObjectAccess, isManager (=role===MANAGER), revoked, canWrite, canManage, accessId, hiddenForMe`) из новой модели. Фронт не переписывается синхронно; страницы переводятся на `canWrite/canManage` постепенно (находки 12-13). Эндпоинты access/me-access/access-requests/invite сохраняют URL и DTO (в AddAccessDto роль OWNER доступна только OWNER — как сегодня CUSTOMER).

**Объём работ по файлам (S/M/L):**

| Блок | Файлы | Размер |
|---|---|---|
| Capability-слой `can()` | `access-scope.ts` (+новый `capabilities.ts`, спеки) | M |
| Схема + миграция | `schema.prisma`, 1-2 миграции, `loadAccessGrants` | M |
| Замена локальных check-хелперов | projects, materials, warehouse, reports, estimate-recalc, estimate-templates, audit, change(если жив), object-templates, invite, access-request (11 сервисов) | L (механически, но много) |
| Guard | `object-access.guard.ts` | S |
| access.service + DTO | access.service.ts, add/update-access.dto | M |
| price-list/catalog-access | price-list.service.ts, catalog-access.ts | S (уже на слое) |
| SQL-копии правил | analytics.service.ts, dashboard.service.ts | M |
| Адаптер API-контракта | objects.service.ts (findAll/findOne) | S |
| Фронт: гейтинг по canWrite/canManage | Materials.tsx, Reports.tsx, Warehouse.tsx, Brigades.tsx, Projects.tsx | M |
| Удаление мёртвого | change/*, isArchived-фильтры, STORE_MANAGER | S |

Итого: **~25-30 файлов, реальная оценка 5-8 рабочих дней** (без нахождения 1-5 — их чинить отдельно и раньше, S-размер).

---

## План работ по шагам (без кода)

1. **Sprint 0 (1-2 дня, до первого платежа):** находки 1, 3, 5, 6 (+4 как «отключить роуты change»). Все — S, локальные, без миграций. Находка 2 — временно запретить запись/удаление objectId=null не-создателю (createdBy придётся добавить — мини-миграция S/M).
2. **Шаг 1:** §5(б) — полная удаление ChangeRequest (код + миграция drop).
3. **Шаг 2:** добить `Object.isArchived` (drop + чистка 6 фильтров) и `User.role`→isAdmin.
4. **Шаг 3:** ввести `capabilities.ts` c `can(user, action, ctx)` поверх access-scope; покрыть спеками матрицу из §«Матрица прав».
5. **Шаг 4:** механически переводить сервисы на `can()` по одному модулю за PR (порядок: warehouse → reports → projects/materials → остальные); каждый PR = поведение без изменений + спеки.
6. **Шаг 5:** миграция схемы (OwnerRole/ProjectGrant/preferences) + адаптер контракта objects.*; фронт переводим на canWrite/canManage (Materials/Reports/Warehouse/Brigades).
7. **Шаг 6:** удалить локальные mustHidePrices/stripPrices-дубли, оставив один в слое; SQL analytics/dashboard перевести на параметризуемый scope.

---


## 7. Ответ на открытый пункт владельца (роли, §24 п.1)

Сравниваем: **(а)** оставить роли как есть, переименовать в UI «Владелец / Прораб / Наблюдатель»; **(б)** доделать экран «Согласования»; **(в)** официально выключить согласования.

| Критерий | (а) Переименовать в UI | (б) Доделать «Согласования» | (в) Выключить согласования |
|---|---|---|---|
| Стоимость | S (0.5 дня: лейблы `Users.tsx:14-21`, `Objects.tsx`, `AcceptInvite.tsx`, тексты модалок; enum в БД не трогаем) | L (3-5 дней: экран, состояния, тесты + обязательная починка находки 4) | S-M (0.5-1 день: код S + миграция drop M) |
| Риск для демо | Нулевой; «Владелец» понятнее «Заказчика» прорабу-создателю (он создаёт объект в роли CUSTOMER — `objects.service.ts:63-64` — и feels не в своей тарелке) | Средний: новая фича в нестабильной зоне (436 строк без единого UI-теста); меняет рабочий процесс клиента, который ещё не сформулирован | Нулевой для UI (нечего ломать); риск только если в `change_requests` есть живые данные (проверить перед drop) |
| Риск для первого платежа | Положительный (яснее роли) | Отрицательный: время уходит на фичу, не участвующую в продаже; дыра находки 4 живёт до починки | Положительный: минус одна сущность в голове и минус 🔴-дыра |
| Продуктовый смысл | Косметика, но снимает путаницу двух «ролей» (глобальной и объектной) для пользователя | Согласования = «прораб предлагает, заказчик утверждает» — потенциально сильная фича, но НЕ запрошена ни одним сценарием демо; паттерн «заявка→ревью» уже закрыт №178 для прав | Мёртвый код не оставляем (правило владельца); git-история сохранит реализацию |
| Обратимость | Полная | — | Полная (git + можно вернуть модель) |

**Рекомендация (одна): (в) официально выключить согласования** — и в том же релизе сделать (а) как бесплатную косметику (это не взаимоисключающие пункты; «одна рекомендация» относится к судьбе согласований). Аргументы: (б) стоит L и отнимает неделю у первого платежа ради фичи с нулевым текущим использованием и незакрытой дырой; (в) стоит S-M, закрывает находку 4, уменьшает число сущностей в голове владельца с 6 до 5 (§6.1) и соблюдает правило «мёртвый код не оставляем». Если через 2-3 месяца клиенты попросят «утверждение изменений заказчиком» — восстановить из git и доделать уже осознанно, поверх capability-слоя (§6.4), а не поверх текущих 10 локальных проверок.

---

## Что я НЕ проверил и почему

1. **БД и данные** — режим аудита запрещает подключение; наличие частичного unique-индекса `object_access_user_object_project_key` (`schema.prisma:263-266`) и фактическое состояние `Object.isArchived` («сброшено миграцией») приняты на веру из комментариев и миграций.
2. **Запуск тестов/сборки** (`access-scope.spec.ts`, `materials.service.spec.ts`, `warehouse.service.spec.ts` и др. существуют) — запрещён режимом; выводы только по чтению кода.
3. **auth-поток** (регистрация/верификация/сброс пароля, captcha, email) — вне рамок задания (доступ к объектам); `auth.service.ts` читался только в части выдачи роли в JWT.
4. **Содержимое PDF/XLSX** (`pdf.service.ts`, `xlsx.service.ts`) — проверен только факт, что экспорт идёт через `detail()` со stripPrices; верстка/поля не аудировались.
5. **Полный текст крупных фронтовых страниц** (Materials.tsx 2526, Objects.tsx 2159, Projects.tsx 1559, Brigades.tsx 1048, Rentals.tsx, PriceList.tsx) — читались точечно (флаги/гейтинг через grep + ключевые диапазоны); отсутствие флагов в Reports/Warehouse/Dashboard/Analytics/Brigades подтверждено grep'ом (0 совпадений), а не полным чтением.
6. **object-templates.service.ts:103-151** (findAll/findOne) — прочитано частично; предполагаю доступ публичных шаблонов всем (by design `:199`), требует подтверждения при правках.
7. **Миграции Prisma** (каталог `backend\prisma\migrations`) — не перечитывались; история согласована со схемой точечно (индекс №168).
8. **Rentals/Calculators/Help/Landing** — личных данных не касаются (rentals — владельческая модель, проверена выборочно).

## Требует подтверждения владельца

1. **«Общий склад» и «мобильная бригада» (objectId=null)** — задуманы как глобальные для всех пользователей системы (текущий код) или как общие в рамках одного владельца/объекта? От ответа зависит-fix находки 2 (S или M с миграцией).
2. **VIEWER на складе и в отчётах**: «наблюдатель видит прогресс» включает ли право СОЗДАВАТЬ акты и складские операции? Текущий код разрешает (находка 1) — предполагаю, что это баг, а не фича.
3. **Суммы в списке отчётов** при hidePrices: показывать (текущее поведение) или обнулять, как в карточке? (находка 6).
4. **`change_requests`**: есть ли в живой БД строки, созданные не тестами? (нужно для решения о drop в §5б).
5. **`Object.isArchived`**: добивать окончательно (drop) или вернуть смысл глобального архива? (находка 15).
6. **Проектный участник и карточка проекта**: может ли он переименовывать/менять даты проекта, в который приглашён (находка 10)? Текущий код разрешает.
7. **Переименование ролей в UI** («Владелец/Прораб/Наблюдатель»): согласовать формулировки, особенно для создателя-прораба объекта (роль OWNER vs «Владелец»).

---

*Конец отчёта. Единственный созданный файл: `docs\audit-2026-10\A-access.md`. Правки кода не производились.*

