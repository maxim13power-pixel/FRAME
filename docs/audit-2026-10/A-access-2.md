# A13 — доступ, роли и цены (независимый аудит)

| | |
|---|---|
| Коммит | `89fc1ed` (`git rev-parse --short HEAD`) |
| Дата | 27.10.2026 |
| Модель | Kimi (Moonshot AI), Cline agent. Точная внутренняя версия сборки runtime не раскрыта — не выдумываю её. |
| Режим | READ-ONLY: файлы проекта не менялись, команды сборки/тестов/Prisma/БД/dev-серверов не запускались |
| Отчёт | `docs/audit-2026-10/A-access-2.md`, потому что `A-access.md` уже существовал; чужой отчёт не открывался |

## Вердикт

Механизм доступа нельзя считать единым: `access-scope.ts` — хороший вычислитель для списков и KPI, но он **не является точкой принуждения**. Принуждение размазано минимум по 31 backend-файлу и 14 frontend-файлам, причём часть маршрутов вообще не проверяет роль/отзыв. Найдены блокирующие утечки: отозванный участник читает живые данные, хотя UI обещает «снимок на момент отзыва»; прораб может выпустить приглашение с ролью `CUSTOMER`; `GET /audit` без фильтра отдаёт журнал всей системы; склад и отчёты разрешают записи `VIEWER`/отозванным; `GET /reports` показывает суммы в обход `hidePrices`; `priceItemId` принимается по глобальному id без проверки справочника.

Это **блокирует первый платёж** не из-за косметики, а из-за конфиденциальности денег и доверия к отзыву доступа. Исправление «точечно по сервисам» закрепит проблему, поэтому рекомендация — сначала закрыть P0 fail-closed, затем ввести один capability-слой и только после этого упрощать модель.

## 1. Инвентаризация механизмов

| Механизм | Что решает | Где реализован | Нужен? |
|---|---|---|---|
| JWT + `tokenVersion` | Кто пользователь; отзыв всех сессий | `backend/src/auth/jwt.strategy.ts:27-47`, `auth.service.ts:43-83` | Да, оставить |
| Глобальная `User.role` (`Role`) | Заявлена как глобальная роль администратора/кладовщика | `schema.prisma:15-42`, enum `:97-102`; используются только `ADMIN` в `access-request.service.ts:36-42`, `object-templates.service.ts:41-47`, `price-list/catalog-access.ts:83-91`, `price-list.service.ts:60-67` | Только `ADMIN`; `STORE_MANAGER` не используется в backend, `FOREMAN/CUSTOMER` не влияют на доступ. Кандидат на схлопывание |
| `ObjectAccess` | Грант пользователя на объект/проект | `schema.prisma:241-269`; чтение/резолв `auth/access-scope.ts:51-268` | Да, но модель перегружена |
| `projectId = null` | «Весь объект», включая будущие проекты | `schema.prisma:245`, `access-scope.ts:70-84`, `:220-268` | Да; это уровень 1 |
| `projectId = X` | Доступ только к одному проекту | `schema.prisma:245`, `access-scope.ts:220-242`, `projects.service.ts:156-198` | Да; это уровень 2 (сужение) |
| `AccessRole` | `CUSTOMER/FOREMAN/VIEWER` | `schema.prisma:235-239`; приоритет `access-scope.ts:152-156` | Да, 3 роли. В UI `CUSTOMER` фактически «владелец» |
| `hidePrices` | Прячет деньги, не запрещает объёмы/работы | `schema.prisma:247`; `access-scope.ts:187-191`; `materials.service.ts:54-67`; `reports.service.ts:48-57` | Да для не-`VIEWER`; для `VIEWER` и `revoked` избыточен, выводится |
| `isManager` | Право прораба управлять командой | `schema.prisma:251`; `access-scope.ts:196-199`; `access.service.ts:36-52` | Только для `FOREMAN`; лучше capability `team.manage` |
| `isHidden` (личный архив) | Скрыть объект только у себя, не отзывая доступ | `schema.prisma:253`; `access-scope.ts:90-94`; `access.service.ts:431-447` | Да, но это **не** право доступа — это пользовательская настройка |
| `revokedAt` | Мягкий отзыв: read-only и «снимок» | `schema.prisma:254-257`; guard `object-access.guard.ts:115-123`; `access.service.ts:254-300` | Да, но текущая реализация не обеспечивает заявленный снимок |
| `AccessRequest` | Заявка «дайте право создавать проекты» | `schema.prisma:299-338`; `access-request.service.ts`; `access-request.controller.ts:26-95` | Да, оставить; это отдельный workflow, не роль |
| `ChangeRequest` | Согласование изменений сметы | `schema.prisma:272-297`; `change.controller.ts` (3 маршрута); `change.service.ts` | **Нет в текущем продукте**: UI-ссылок 0, политика спорная |
| `InviteToken` | Ссылка-приглашение на объект | `schema.prisma:408-425`; `invite.service.ts`; `invite.controller.ts` | Да, но выдача роли не ограничена ролью приглашающего |
| `AuditLog` | Append-only журнал действий | `schema.prisma:670-683`; `audit.service.ts`; `audit.controller.ts` | Да как журнал; чтение требует scope, сейчас дыра |
| `Object.isArchived` | Глобальный архив объектов | `schema.prisma:51` | Легаси: сеттера нет, `ObjectsService.update` его не меняет; личный архив — `ObjectAccess.isHidden`. Удалять после проверки данных |

Ключевой вывод: «кто имеет доступ» определяется **двумя** системами ролей и **пятью** независимыми флагами, а при ответе на конкретный вопрос приходится помнить ещё и уровень (`object`/`project`), личный архив и глобального админа.

## 2. Находки

Приоритет: 🔴 блокер / 🟡 средне / 🟢 мелочь. «Платёж» = блокирует ли первый платёж.

| # | Уровень | Файл:строка | Суть | Почему проблема | Как исправить | S/M/L | Платёж |
|---|---|---|---|---|---|---|---|
| F1 | 🔴 | `backend/src/auth/access-scope.ts:70-84`, `auth/object-access.guard.ts:115-123`, `access/access.service.ts:281-299` | `buildAccessScope()` включает отозванные гранты; guard разрешает `GET` при `revokedAt`; сервисы читают живые таблицы | Заявлено «доступ отозван — только снимок», но отозванный видит **текущие** материалы, цены, отчёты, склад, участников. Снимок создаётся только при отзыве; живое чтение его обходит | В capability-слое: `revoked` разрешает только `snapshot.read`; все live-чтения deny. Снимок должен быть отдельной неизменяемой сущностью, а не шаблоном, который можно пересоздать | M | Да |
| F2 | 🔴 | `backend/src/invite/invite.service.ts:34-41`, `invite/dto/create-invite.dto.ts:11-13`, `schema.prisma:413`, сравнить `access/access.service.ts:102-110` | Создать ссылку может любой объектный не-`VIEWER`; `role` принимает **любое** `AccessRole`; `revokedAt`, `isManager` не проверяются | Прораб (и отозванный прораб) выпускает ссылку `CUSTOMER`, принимает её вторым аккаунтом — получает права владельца. `AccessService` такое запрещает, `InviteService` — нет | Проверять активный грант, `isManager`/`CUSTOMER`; запретить выдавать роль выше своей; `CUSTOMER` — только `CUSTOMER`; отозванный не создаёт ссылки; тест на эскалацию | S | Да |
| F3 | 🔴 | `backend/src/audit/audit.controller.ts:11-21`, `audit/audit.service.ts:109-121` | Если `entity` и `entityId` не переданы, возвращаются последние 100 логов **всей системы**; при одном `entityId` без `entity` фильтр тоже неполный | Любой авторизованный читает чужие действия, e-mail акторов и `before/after` с ценами. Это cross-tenant IDOR | Требовать scope (`objectId/projectId`) либо `entity+entityId`; глобальное чтение — только `ADMIN`; фильтровать `where` по доступным объектам; тест «чужой аудит → 403/404» | S | Да |
| F4 | 🔴 | `backend/src/warehouse/warehouse.controller.ts:23-25`; `warehouse/warehouse.service.ts:28-35,61-71,114-152,157-219` | Контроллер только JWT; `checkObjectAccess`/`checkItemAccess` не смотрят роль и `revokedAt`; позиция `objectId=null` доступна всем | `VIEWER` и отозванный меняют/удаляют склад и проводят списания. Любой пользователь меняет «общие» позиции. Нет проверки, что `projectId` списания принадлежит объекту позиции | Подключить `ObjectAccessGuard`/capability `warehouse.write`; `VIEWER`/`revoked` — 403; общие позиции — владелец/админ; проверять `warehouseItem.objectId === project.objectId` для расхода | M | Да |
| F5 | 🔴 | `backend/src/reports/reports.controller.ts:28-30`; `reports/reports.service.ts:154-158,176-240,253-357` | `list()` не вызывает `stripPrices`; `create/update/remove/addItem/updateItem/removeItem` проверяют только наличие гранта, не роль/отзыв | `VIEWER`/`hidePrices` получает `totalAmount` списком; `VIEWER`/отозванный создаёт, утверждает и удаляет акты. `addItem` берёт цену из глобального `PriceItem` | Один capability `report.write`; `report.read` + `money.view`; `list()` маппить через `stripPrices`; `PriceItem` проверять через `loadCatalogAccess`; интеграционные тесты на каждую роль | M | Да |
| F6 | 🔴 | `backend/src/materials/materials.service.ts:179-198,583-614`; `reports/reports.service.ts:105-115,260-264,313-317` | `priceItemId`/`materialItemId`/`materialId` принимаются как глобальный id; проверяются только `exists/isActive`, без `catalogId` и доступа | Участник чужого проекта подставляет id закрытой расценки, получает её `price` в snapshot материала/отчёта. Горизонтальная утечка цен и подмена сметы | Резолвить `PriceItem` через `loadCatalogAccess(catalogId,userId).canRead`; проверять `kind`, привязку справочника к объекту/проекту; иначе 404. Не доверять id из body | M | Да |
| F7 | 🔴 | `backend/src/estimate-templates/estimate-templates.service.ts:18-36,64-105`; комментарий-обещание `access-scope.ts:216-219` | `create()` разрешён любому читателю, включая отозванного, и **в момент вызова** читает живые `Material` с ценами | «Снимок при отзыве» можно обновлять сколько угодно после отзыва: `POST /estimate-templates` → свежие цены → `GET /estimate-templates`. Это обходит и `revokedAt`, и `hidePrices` | Разрешить `create` только активному гранту; для отозванного — только серверный снимок, созданный в транзакции отзыва; `hidePrices` — либо deny, либо вырезать цены | M | Да |
| F8 | 🔴 | `backend/src/object-templates/object-templates.service.ts:55-67,95-103` | Сохранить объект как шаблон может не-`VIEWER`, но `hidePrices` не проверяется; в шаблон копируются `unitPrice/materialUnitPrice` | Пользователь с `hidePrices` не видит деньги в UI, но одним действием сохраняет шаблон и читает все цены через `GET /object-templates/:id` | Требовать `money.view` для копирования цен; иначе сохранять шаблон без ценовых полей; тест | S | Да |
| F9 | 🟡 | `backend/src/change/change.service.ts:36-57,61-67,149-175`; `change.controller.ts:23-54` | `getAccess` не проверяет `revokedAt`; создать/согласовать может отозванный `FOREMAN/CUSTOMER`; согласовать может **любой второй** `FOREMAN`, не только заказчик | Если включить UI, обещание «прораб предлагает — заказчик утверждает» ложно; отозванный меняет смету через approval. Сейчас API живой, UI нет | Не чинить точечно: по п.5 либо выключить/удалить, либо переписать политику (`CUSTOMER` approves, `FOREMAN` only own proposal, `revoked` deny) | M | Нет (пока UI нет) |
| F10 | 🟡 | `backend/src/price-list/price-list.service.ts:492-534`; `price-list.controller.ts:118-137` | Категории цен глобальные: `createCategory/updateCategory/removeCategory` доступны любому JWT, без `ADMIN` и без scope | Любой пользователь переименовывает/удаляет общую категорию, ломая справочники других объектов; удаление возможно, если нет активных расценок | `category.write` только `ADMIN` или владелец/скоуп; лучше привязать категорию к каталогу, а не делать глобальной | S/M | Нет |
| F11 | 🟡 | `backend/src/access/access.service.ts:24-31,83-93` | `getAccessList` требует любой объектный грант, но не `canManage` и не активность; отозванный `VIEWER` видит всех участников, e-mail и телефон | Утечка контактов после отзыва/наблюдателю; UI-модалка открывается по `hasObjectAccess`, а API список отдаёт | Для полного списка — `access.manage`; остальным — минимальный публичный профиль (имя/роль) или 403; `revoked` — 403 | S | Нет |
| F12 | 🟡 | `backend/src/auth/access-scope.ts:187-191`; `backend/src/analytics/analytics.service.ts:48-56,75-84,172-184`; `dashboard/dashboard.service.ts:149-170` | Резолвер скрывает деньги, если **любой** собственный грант имеет `hidePrices`, а SQL `EXISTS` показывает, если **хотя бы один** грант видим | Один и тот же пользователь видит `totalCost=0` в списке проектов, но ненулевую аналитику/дашборд (или наоборот). Разные ответы на один вопрос | Один money-scope: либо «любой hide скрывает всё», либо «видимый грант раскрывает проект», зафиксировать и применять в resolver и SQL; тест с двумя грантами | M | Нет (но подрывает доверие к цифрам) |
| F13 | 🟡 | `backend/src/auth/object-access.guard.ts:100-110` против `access-scope.ts:225-241` | Guard берёт проектную запись **раньше** объектной, даже если проектная отозвана; resolver отдаёт приоритет объектной | Активный объектный `CUSTOMER` с отозванным проектным грантом получает ложный 403 на изменение материала/склада. Семантика guard и resolver расходится | Guard должен вызывать `resolveProjectAccess()` и не выбирать вручную; один resolver для всех | S | Нет |
| F14 | 🟡 | `schema.prisma:21,97-102`; `auth/auth.service.ts:46-68`; `auth/jwt.strategy.ts:40-47`; `frontend/src/pages/Settings.tsx:45` | Глобальная `Role` почти мертва: `ADMIN` используется в 3 местах, `STORE_MANAGER` — только подпись в UI, глобальные `FOREMAN/CUSTOMER` не дают прав | Две роли с одинаковыми названиями (`User.role` и `AccessRole`) путают; ADMIN не даёт доступа к объектам, но даёт аудит/шаблоны/справочники — неочевидная частичная сила | Оставить `ADMIN` как платформенную роль, убрать остальные из авторизационных решений; UI-подписи не считать правами; зафиксировать в контракте | S/M | Нет |
| F15 | 🟡 | 31 backend-файл + 14 frontend-файлов с упоминаниями доступа/ролей/флагов (перечень в разделе 6); примеры: `projects.service.ts:38-69`, `materials.service.ts:90-140`, `warehouse.service.ts:28-58`, `brigades.service.ts:133-171`, `reports.service.ts:74-103` | Каждый сервис заново реализует «проект → объект → грант», часть — только object-wide, часть — project-or-object, часть не смотрит роль | Любая новая роль/флаг требует правок в десятках мест; уже есть расхождения (F4-F8, F13). Это корневая причина, а не отдельный баг | Capability-слой `can(user, action, ctx)` + единый guard; сервисы не делают `objectAccess.findFirst` вручную | L | Да (косвенно) |
| F16 | 🟡 | `frontend/src/pages/Objects.tsx:1158-1198`; `Materials.tsx:1680-1688,1901-1909`; `Reports.tsx:451,624,649`; API: `objects.service.ts:21-35`, `materials.service.ts:171-177`, `reports.service.ts:154-158` | UI и API считают права по разным флагам: «Настройки/Люди/Шаблон» видны всем с объектным доступом; действия в смете скрыты по `hidePrices`, а не по `canWrite`; отчёты показывают суммы без проверки | Кнопка видна → 403 (VIEWER/revoked у объектов); у `FOREMAN` с `hidePrices` API разрешает писать, UI запрещает; в отчётах сумма видна, хотя должна быть скрыта | Один `useCapabilities(objectId, projectId)` на фронте; UI только по capability, не по `hidePrices`/`role`; backend-ответы не маскировать под права | M | Нет (после P0) |
| F17 | 🟡 | `backend/src/users/users.service.ts:16-35`; `access/access.service.ts:83-93` | `getTeam` и список участников не фильтруют `revokedAt`/`isHidden`, отдают e-mail/телефон всем объектным участникам | Отозванный сохраняет доступ к контактам команды; это противоречит «после отзыва только снимок» | Скрывать контакты при `revoked`; для `VIEWER` — минимальный профиль; либо явное решение владельца, что контакты — не приватные | S | Нет |
| F18 | 🟢 | `schema.prisma:51`; `analytics.service.ts:47,74`; `dashboard.service.ts:139,160`; `access-scope.ts:129,147` | `Object.isArchived` — легаси-флаг, сеттера в API нет; при этом он фильтрует аналитику/дашборд и списки | Если в данных останется `true`, объект «исчезнет» из отчётов без возможности вернуть через UI. Личный архив уже реализован через `isHidden` | Проверить `count(isArchived=true)` (read-only), обнулить/удалить поле после подтверждения; не смешивать с личным архивом | S | Нет |

## 3. Расхождения бэк ↔ фронт

| Сценарий | UI | API | Итог |
|---|---|---|---|
| Участник только проекта (`hasObjectAccess=false`) | `Projects.tsx:150-154` не показывает создание; `:855-885` показывает «Запросить право»; `Objects.tsx:1158-1202` скрывает настройки/людей, оставляет архив | `projects.service.ts:38-46` требует объектную запись; `objects.service.ts:199-229` отдаёт объект для шапки; `projects.service.ts:174-198` отдаёт только разрешённые проекты | В основном согласовано. Исключение: настройки объекта скрыты, но API всё равно 403 — это ожидаемо |
| Отозванный доступ (`revokedAt`) | `Objects.tsx:1118-1127` обещает «только чтение, копия сметы в шаблонах»; `Projects.tsx:150-154` запрещает создание; `Materials.tsx:422` скрывает деньги | `object-access.guard.ts:115-123` разрешает любые `GET`; `estimate-templates.service.ts:64-105` позволяет **заново** снять живой снимок; `warehouse/reports` разрешают запись | 🔴 UI обещает заморозку, API отдаёт живые данные и иногда разрешает запись |
| `VIEWER` | `Materials.tsx` скрывает денежные колонки и действия через `hidePrices`; `Projects.tsx:157` скрывает финансы; в `Objects.tsx:1164-1198` видны «Люди», «Настройки», «Шаблон» | `objects.service.ts:21-35` запрещает правку; `access.service.ts:36-51` запрещает управление; `warehouse/reports` роль не смотрят | Частично: кнопки объекта ведут в 403; склад/отчёты опаснее — API разрешает запись |
| `hidePrices` у не-`VIEWER` (например, прораб без доступа к деньгам) | `Materials.tsx:1680-1688,1901-1909` скрывает настройки, дублирование и FAB добавления; `Projects.tsx:157` скрывает справочник | `materials.service.ts:171-177` проверяет только `VIEWER`, не `hidePrices`; писать можно; `object-templates.service.ts:55-67` тоже разрешает | Несогласовано: UI запрещает работу, API разрешает; при этом шаблон объекта раскрывает цены (F8) |
| Отчёты | `Reports.tsx:451,624,649` всегда показывает `totalAmount`; кнопки статуса/экспорта без проверки роли | `reports.service.ts:154-158` не скрывает сумму в списке; `:176-357` не проверяет роль на запись | 🔴 Суммы и действия видны всем с доступом к проекту |
| Страница «Участники» | `Users.tsx:81-119` показывает объекты только с участниками, контакты и роли | `users.service.ts:16-35` берёт только `projectId=null`, включая отозванных | Участник проекта не видит страницу; отозванный продолжает видеть контакты |
| Глобальный `ADMIN` | В `Settings.tsx:45` есть подпись «Кладовщик», но ролевого экрана/проверок нет | `ADMIN` не обходит ObjectAccess, используется только в заявках/шаблонах/справочниках | Нет единого представления, что может администратор |

## 4. IDOR и проверки объекта из body/query

Объект доступа берётся из URL/body и проверяется недостаточно в:

- `POST /objects/:objectId/invite-link` — `objectId` из URL, роль из body без ограничения (`invite.service.ts:29-63`);
- `POST /warehouse/items`, `PATCH/DELETE /warehouse/items/:id`, `POST /warehouse/transactions` — `objectId/projectId/warehouseItemId` из body/URL, роль и отзыв не проверяются (`warehouse.service.ts:114-219`);
- `POST /reports`, `PATCH/DELETE /reports/:id`, `POST/PATCH/DELETE /reports/:id/items...` — `projectId/objectId/reportId/itemId`; только наличие гранта (`reports.service.ts:176-357`);
- `POST /materials`, `PATCH /materials/:id` — `priceItemId/materialItemId` глобальные (`materials.service.ts:179-198,583-614`);
- `POST /reports/:id/items` — `materialId` трактуется как `PriceItem.id` глобально (`reports.service.ts:105-115,260-264`);
- `POST /estimate-templates` — `projectId` из body, отозванный читает живые материалы (`estimate-templates.service.ts:64-105`);
- `POST /object-templates` — `objectId` из body, `hidePrices` не проверяется (`object-templates.service.ts:50-111`);
- `GET /audit` — без `entity/entityId` весь журнал (`audit.service.ts:109-121`);
- `GET/POST /access-requests/:id/approve|reject|cancel` — `id` из URL; проверка менеджера есть, но область заявки — только `objectId` (`access-request.service.ts:178-308`);
- `GET /change/project/:projectId`, `POST /change`, `PATCH /change/:id/review` — `projectId/changeId` из URL/body; `materialId` проверяется, `revokedAt` — нет (`change.service.ts:61-178`);
- `GET /reports/:id/export/pdf|xlsx` — `id` из URL; использует `detail()`, поэтому пока защищено лучше списка, но зависит от F5;
- массовых операций/импорта в контроллерах не найдено; экспорт — только PDF/XLSX по одному отчёту (`reports.controller.ts:58-93`).

Проверено отрицательно: `rentals` строго фильтрует `where: { id, userId }` (`rentals.service.ts:42-46,68-72,99-104`); `price-list` каталоги/расценки проверяет через `catalog-access.ts`; `estimate-recalc` блокирует `VIEWER`, `hidePrices` и отзыв на записи (`estimate-recalc.service.ts:93-110,260-266,424-426`); `projects.findAllByObject` не отдаёт чужие проекты при `hasObjectAccess=false` (`projects.service.ts:174-198`).

## 5. Мёртвое: `ChangeRequest`

**Факт, а не ожидание.**

- API живой и смонтирован: `backend/src/app.module.ts:12-13,38-39`; контроллер `@Controller('change')` — `change.controller.ts:23`; ровно **3** маршрута: `GET change/project/:projectId` (`:29-35`), `POST change` (`:38-44`), `PATCH change/:id/review` (`:47-54`).
- Frontend: **0** ссылок на `ChangeRequest`, `/change`, `changeService`, `change-request`. Поиск по `frontend/src/**/*.{ts,tsx}` дал 0; два совпадения `handleChangeStatus` в `Reports.tsx:257,461` относятся к статусу отчёта, не к согласованиям.
- Backend-упоминаний 12: 3 endpoints, 5 обращений к `changeRequest` в `change.service.ts:112,129,150,187,203`, подсчёт в `projects.service.ts:323-331` (удаление проекта) и комментарий в `users.service.ts:174`.
- Модель и enum живые: `schema.prisma:272-297`; миграции/БД не читались, поэтому **число строк `change_requests` неизвестно** — это нужно проверить владельцу read-only запросом.
- Политика уже противоречит продуктовому тексту UI: подсказка обещает «прораб предлагает — заказчик утверждает» (`Objects.tsx:2197`), а `change.service.ts:17,63-67,168-171` разрешает создавать обоим и согласовывать **любому** `FOREMAN/CUSTOMER`, кроме автора. `revokedAt` не проверяется (`:36-57`). Это не «недоделанный UI», а неверная политика.

**Три варианта.**

| Вариант | Что делаем | Цена | Риск для демо | Риск для первого платежа |
|---|---|---|---|---|
| (а) Оставить API, переименовать роли в UI «Владелец / Прораб / Наблюдатель» | Только тексты/подписи; `ChangeRequest` остаётся мёртвым API | **S** (0.5–1 день): `Objects.tsx`, `Users.tsx`, `AcceptInvite.tsx`, `Settings.tsx`, документация | Низкий: демо не меняется | Средний: ложное обещание «согласования» остаётся в подсказке `Objects.tsx:2197`; баг-репорт от заказчика вероятен |
| (б) Доделать экран «Согласования» | UI списка/карточки/approve-reject + уведомления; сначала переписать политику (`CUSTOMER` утверждает, `FOREMAN` — только своя заявка, `revoked` deny) | **M/L** (5–10 дней + тесты): frontend 3–5 экранов, backend policy, e2e, миграции не нужны | Высокий: новый незавершённый workflow перед демо | Высокий: задерживает платёж; функция не проверена в бою; требует продукт-решения о партиях, а не строках |
| (в) Официально выключить согласования | Убрать 3 endpoint из модуля, удалить `ChangeModule`, сервис, DTO, модель/enum миграцией; удалить ложную подсказку; изменения применяются напрямую с `AuditLog`, как фактически сейчас | **M** (1–3 дня с миграцией и тестами); если только feature flag + тексты — **S** | Низкий: поведение не меняется, становится честным | Низкий, если в договоре нет требования approval; выше, если sales уже обещал «согласование» |

**Рекомендация: (в).** Причина: фактическое поведение продукта — прямые изменения с аудитом; UI-ссылок нет; API-политика неверна и создаёт ложное чувство контроля. Доделывать (б) перед первым платежом — scope creep с высоким риском. Переименование (а) полезно как косметика, но само по себе не убирает мёртвый API и ложную подсказку, поэтому делается **внутри (в)**, а не вместо него. Перед удалением: экспортировать `change_requests` в JSON/архивную таблицу, обновить `projects.service.ts:323-331` (счётчик при удалении проекта), удалить пункт из `AppModule`, прогнать сборку и e2e.

## 6. Матрица прав: роль × действие × где проверяется

Одна строка = одно действие. «Project grant» = `ObjectAccess.projectId != null`; «object grant» = `projectId = null`. «Active» = `revokedAt = null`.

| Действие | CUSTOMER | FOREMAN | VIEWER | Где реально проверяется |
|---|---|---|---|---|
| Создать объект | Да, любой JWT | Да, любой JWT | Да, любой JWT | `objects.controller.ts:25-28`; `objects.service.ts:60-94` — проверки роли нет, создатель получает `CUSTOMER` по умолчанию |
| Читать карточку объекта | Да, object/project grant | Да, object/project grant | Да, object/project grant | `objects.service.ts:199-229`; `resolveObjectRole`; `revoked` не блокирует чтение |
| Редактировать объект/дату | Да, active object grant | Да, active object grant | Нет | `objects.service.ts:21-35`; `update` `:172-193`, `updateEndDate` `:232-238` |
| Создать проект | Да, active object grant | Да, active object grant | Нет | `projects.service.ts:118-137`; требуется **object grant**, `isManager` не нужен |
| Читать список проектов | Все проекты объекта | Все проекты объекта | Все проекты объекта | `projects.service.ts:156-198`; при project-only — только `allowedProjectIds` |
| Редактировать/удалить проект | Да, active project/object | Да, active project/object | Нет | `projects.service.ts:288-321`; `assertWritable`; `remove` `:317-345` |
| Читать материалы/фиксации | Да, active; деньги по `hidePrices` | Да; деньги по `hidePrices` | Да; деньги всегда 0 | `materials.service.ts:90-169`; `findAllByProject` `:143-157`; `stripPrices` |
| Создать/изменить материал | Да, active | Да, active | Нет | `materials.service.ts:171-217,527-643`; guard блокирует non-GET при `revoked` |
| Добавить/править фиксацию | Да, active | Да, active | Нет | `materials.service.ts:224-326,404-523`; 72-часовое окно; guard |
| Смотреть цены/деньги | Да, если `hidePrices=false` | Да, если `hidePrices=false` | Нет | `access-scope.ts:187-191`; `materials/reports/projects/dashboard`; расхождения F12 |
| Управлять командой/доступом | Да, active object | Только `isManager=true` | Нет | `access.service.ts:36-52`; `assertManager`; `access.controller.ts` без guard, проверка в сервисе |
| Смотреть список участников | Да, active object | Да, active object | Да, active object | `access.service.ts:24-31,83-93`; **отозванный тоже проходит** |
| Создать invite-ссылку | Да | Да, независимо от `isManager` | Нет | `invite.service.ts:29-41`; **не проверяет `revokedAt`; роль из body любая** |
| Подать AccessRequest | Да, active project/object, non-VIEWER | Да, active project/object, non-VIEWER | Нет | `access-request.service.ts:57-90`; `findFirst` — риск неверной записи при нескольких грантах |
| Одобрить/отклонить AccessRequest | Да, object manager | Да, `isManager=true` object | Нет | `access-request.service.ts:44-54,178-186,254-264`; `ADMIN` — глобальный обход |
| Склад: читать/писать | Да, active object; общие — все | Да, active object; общие — все | Да (ошибка) | `warehouse.service.ts:28-71`; **роль/revoked не проверяются**, контроллер только JWT |
| Бригады: читать/писать | Да, active object/project | Да, active object/project | Читать — да, писать — нет | `brigades.service.ts:133-171`; для `objectId=null` проверка отсутствует — любой JWT |
| Отчёты: читать | Да; суммы по `hidePrices` | Да; суммы по `hidePrices` | Да, но деньги должны быть 0 | `reports.service.ts:74-174`; detail скрывает, **list — нет** |
| Отчёты: создавать/править/удалять | Да, active | Да, active | **Да (ошибка)** | `reports.service.ts:176-357`; роль/revoked не проверяются |
| Пересчёт сметы | Да, active, `hidePrices=false` | Да, active, `hidePrices=false` | Нет | `estimate-recalc.service.ts:93-110,260-266,424-426`; один из лучших примеров |
| Справочник: читать | Системный + свой + object/project bindings | То же | То же | `catalog-access.ts:67-110`; `price-list.service.ts:91-166` |
| Справочник: писать | Системный — `ADMIN`; свой; object/project при `canWrite` | Свой; object/project при `canWrite` | Нет | `catalog-access.ts:78-108`; `price-list.service.ts:176-330,537-654` |
| Категории цен: править | **Да (ошибка)** | **Да (ошибка)** | **Да (ошибка)** | `price-list.service.ts:492-534`; `ADMIN`/scope не проверяются |
| Шаблон объекта: создать | Да, active object non-VIEWER | Да, active object non-VIEWER | Нет | `object-templates.service.ts:50-111`; `hidePrices` не проверяется, цены копируются |
| Шаблон сметы: создать | Да, любой грант, включая revoked | Да, любой грант, включая revoked | Да, включая revoked | `estimate-templates.service.ts:64-105`; комментарий `:70-71` прямо разрешает |
| Шаблон сметы: применить | Да, active non-VIEWER | Да, active non-VIEWER | Нет | `estimate-templates.service.ts:122-152`; `assertCanApply` |
| Аудит: читать | Любой JWT, без scope | Любой JWT, без scope | Любой JWT, без scope | `audit.controller.ts:11-21`; `audit.service.ts:109-121` — глобальная утечка |
| Согласования (`/change`) | Создать/согласовать, включая revoked | Создать/согласовать, включая revoked | Нет | `change.service.ts:61-67,149-175`; `MONEY_ROLES`, `revokedAt` не проверяется; UI 0 |
| Аренда | Только свои | Только свои | Только свои | `rentals.service.ts:15-107`; `where userId` |
| Дашборд/аналитика | Свои объекты; деньги по money-scope | То же | Объёмы, деньги 0 | `dashboard.service.ts:93-97,149-170`; `analytics.service.ts:33-61,65-132` |
| `ADMIN` | Не даёт объектных прав | Не даёт объектных прав | Не даёт объектных прав | Только `access-request`, `object-templates`, `price-list`; объекты — через `ObjectAccess` |

## 7. Оценка сложности для владельца

### 7.1. Сколько надо держать в голове

**Чтобы точно ответить «кто может создать проект на объекте X»: 4 проверки одной строки + 1 исключение.**

1. Есть ли `ObjectAccess` с `userId`, `objectId=X`, `projectId=null` (`projects.service.ts:38-46`);
2. `role !== VIEWER` (`:31-33`);
3. `revokedAt == null` (`:26-30`);
4. `objectId` существует и проект создаётся в нём (`:118-137`);
5. Исключение: глобальный `ADMIN` **не помогает** — объектного обхода нет. Если объектной строки нет, участник подаёт `AccessRequest`, и одобрение создаёт `FOREMAN + isManager` (`access-request.service.ts:206-235`).

**Чтобы рассуждать о доступе в целом: примерно 12 измерений:** 2 системы ролей (`User.role`, `AccessRole`), 3 значения `AccessRole`, 5 флагов (`hidePrices`, `isManager`, `isHidden`, `revokedAt`, `projectId`), 2 уровня (`object`/`project`), глобальный `ADMIN`, плюс личный архив и `Object.isArchived`. Именно поэтому владельцу трудно ответить на простой вопрос без чтения кода.

### 7.2. Сколько файлов править

- В коде **31 backend-файл** и **14 frontend-файлов** содержат проверки/упоминания ролей, грантов или флагов. Это не значит, что все надо менять при каждом релизе, но это карта сопровождения.
- **Новая роль:** схема + миграция + `access-scope.ts` + `object-access.guard.ts` + DTO/валидация + `access.service.ts` + `invite.service.ts` + `projects.service.ts` + минимум 6 сервисов, где есть `role ===` + UI-подписи и условия. Минимум **12–16 файлов**, реалистично **20–25** с тестами. Без capability-слоя — **L**.
- **Новый флаг:** `schema.prisma`, `access-scope.ts`, guard, выдача/обновление доступа, invite, каждый сервис, который отдаёт данные, и 4–6 UI-страниц. Минимум **12–18 файлов**, риск забыть один — высокий. С capability-слоем — **S/M**: политика в одном месте + UI-проекция.
- **Исправление одной найденной дыры:** S/M, но если чинить только её, следующая останется. Поэтому рекомендуемая последовательность — не «25 патчей», а P0 fail-closed + один слой.

### 7.3. Флаги, которые дублируют друг друга

| Дублирование | Можно ли схлопнуть без потери поведения |
|---|---|
| `hasObjectAccess` ← `projectId == null` | Да, это вычисляемый флаг ответа; не хранить как отдельное решение |
| `canWrite` ← `role != VIEWER && !revokedAt` | Да, вычислять в capability; не передавать как самостоятельный источник истины |
| `canManage` ← `role == CUSTOMER \|\| (role == FOREMAN && isManager)`, плюс `!revokedAt` | Да, вычислять; `isManager` оставить как данные только для `FOREMAN` |
| `revoked`, `hiddenForMe` ← `revokedAt`, агрегированный `isHidden` | Да, это проекции БД; вычислять один раз |
| Глобальный `Role` (`STORE_MANAGER`, `FOREMAN`, `CUSTOMER`) ← `AccessRole` | Почти да: `ADMIN` нужен как платформенная роль, `STORE_MANAGER` мёртв, остальные глобальные значения не участвуют в авторизации. Удалять после grep-проверки |
| `hidePrices` + `VIEWER` + `revoked` | **Не полный дубль.** Для `VIEWER` и `revoked` деньги всегда скрыты, но `hidePrices` нужен для `CUSTOMER/FOREMAN`. Схлопывать в `money.view` capability, а не удалять поле |
| `isManager` | Не дубль `role`, но дубль capability `team.manage`. Хранить как грант/флаг, наружу отдавать одну capability |

Итог: **5 вычисляемых флагов** (`hasObjectAccess`, `canWrite`, `canManage`, `revoked`, `hiddenForMe`) можно перестать считать независимыми; **1 глобальную роль** (`STORE_MANAGER` и не-ADMIN значения) можно убрать из авторизации; **`hidePrices` и `isManager` оставить как данные**, но спрятать за capability.

### 7.4. Предлагаемая упрощённая модель (не реализовывать сейчас)

Два уровня:

1. **ObjectMembership** — `userId + objectId`, уникально. Поля: `role` (`OWNER|FOREMAN|VIEWER`; в API можно сохранить имена `CUSTOMER|FOREMAN|VIEWER`), `moneyVisible` (инверсия `hidePrices`), `canManageTeam`, `status` (`ACTIVE|REVOKED`) + `revokedAt`, `archive` (личный архив). Одна строка = один человек на объекте.
2. **ProjectScope** — `membershipId + projectId`, уникально. Это **сужение**, а не вторая роль. Для обратной совместимости допускается `roleOverride`/`moneyOverride`/`revokedAt`, но UI показывает только роль на объекте и список доступных проектов; исключения — временное наследие миграции, не новый UX.

Поверх — **capability-слой** с единственной функцией вида `can(user, action, { objectId?, projectId? })`. Не новый endpoint, не UI-фича; внутренний контракт. Действия: `object.view`, `object.edit`, `project.create`, `project.edit`, `project.delete`, `material.write`, `fix.write`, `money.view`, `team.manage`, `access.manage`, `warehouse.write`, `brigade.write`, `report.read`, `report.write`, `estimate.recalc`, `catalog.read`, `catalog.write`, `template.create`, `snapshot.read`, `audit.read`, `change.review`.

Правила вычисления (одни для API и UI):

- нет membership → deny, кроме `object.create` и собственных `rentals`;
- `status=REVOKED` → разрешён только `snapshot.read` (неизменяемый снимок) и собственные шаблоны; все live-read/write deny;
- `VIEWER` → `money.view=false`, все `*.write=false`;
- `moneyVisible=false` → `money.view=false`, но `material.write` может быть true, если владелец явно разрешил работу без цен (это продуктовое решение, сейчас UI и API расходятся);
- `ProjectScope` сужает `object.view/project.*` до перечисленных проектов; `projectId=null` — все проекты объекта, включая будущие;
- `team.manage` = `OWNER` или `FOREMAN && canManageTeam`; `access.manage` — то же, но выдавать роль выше своей нельзя;
- `ADMIN` — только платформенные capability (`audit.read`, `catalog.system.write`), без неявного доступа к объектам; если нужен break-glass — отдельный явный флаг и аудит.

Кэш: один запрос membership+scopes на HTTP-запрос, передавать в `req.accessContext`; не делать `findFirst` в каждом сервисе. Guard — только транспорт: резолвит `objectId/projectId` из route/body и вызывает `can()`. Deny-by-default: защищённый маршрут без capability-метаданных не должен монтироваться.

Оценка объёма:

| Работа | S/M/L | Файлы |
|---|---|---|
| P0 fail-closed (F1–F8) | M, 3–5 дней | 10–14 backend + 6–8 тестов |
| Capability-слой + guard | M, 3–5 дней | 3 новых/изменённых ядра + 12–15 сервисов |
| Схема + миграция данных | L, 4–7 дней | `schema.prisma`, 2 миграции, backfill-скрипт, тесты |
| Фронт: один `useCapabilities` вместо локальных условий | M, 2–4 дня | `AuthContext.tsx`, `Objects/Projects/Materials/Reports/Users`, сервисы |
| Удаление `ChangeRequest` (вариант в) | M, 1–3 дня | `change/*`, `app.module.ts`, `schema.prisma`, миграция, `projects.service.ts` |
| Итого до устойчивого MVP | **L, 15–20 рабочих дней** одного senior с тестами | без новых фич |

## 8. Миграция данных без потери и обратная совместимость

Данные БД не читались, поэтому ниже — **план**, а не фактические counts. Перед миграцией владелец выполняет read-only запросы: число строк `ObjectAccess` по `projectId IS NULL`/`IS NOT NULL`, дубли `(userId,objectId)`, противоречия `hidePrices`, `revokedAt`, `isHidden`, `isManager`, число `AccessRequest` по статусам, `ChangeRequest`, активных `InviteToken`, `Object.isArchived=true`.

| Сейчас | Куда переносим | Как не потерять поведение |
|---|---|---|
| `ObjectAccess.projectId = null` | `ObjectMembership` (`userId,objectId`) | 1:1; роль/`hidePrices`/`isManager`/`revokedAt`/`isHidden` переносятся |
| `ObjectAccess.projectId = X` | `ProjectScope` под membership | Если membership ещё нет — создать; `role`/`hidePrices`/`revokedAt` строки сохранить в `roleOverride`/`moneyOverride`/`revokedAt`; иначе потеряется разная роль на разных проектах |
| Несколько project-строк без object-строки | Одна membership + N scope | Базовая роль membership = сильнейшая по `ROLE_PRIORITY`; каждая проектная роль остаётся в override. UI показывает одну роль, resolver — override |
| `isManager = true` | `canManageTeam` в membership; project-scope — `canManageTeamOverride` | `isManager` имеет смысл только для `FOREMAN`; для `CUSTOMER` дублирует `access.manage`, сохранить безвредно |
| `revokedAt != null` у object-строки | `status=REVOKED`, `revokedAt` | Все live-read/write deny; доступен только снимок. Если у пользователя есть другая активная строка на тот же объект — **не** сохранять баг «одна отозванная строка блокирует всё»; активный scope должен работать |
| `revokedAt != null` у project-строки | `ProjectScope.status=REVOKED` | Отзывается только проект; object-level активность сохраняется. Это устраняет F13 |
| `hidePrices = true` | `moneyVisible=false` | Для `VIEWER/revoked` всегда false; для `CUSTOMER/FOREMAN` сохраняется. Правило «любой hide скрывает всё» зафиксировать один раз и применить в backfill |
| `isHidden = true` в любой строке | `Membership.archive=true` | Сейчас `setHidden` пишет флаг во все строки объекта (`access.service.ts:443-446`), поэтому агрегируем `OR`; архив не отзывает доступ |
| `AccessRequest` | Оставить таблицу | Статусы/комментарии не трогать; при approve писать membership/scope. Pending-заявки остаются pending; повторный approve идемпотентен |
| `InviteToken` | Оставить, добавить `maxRole`/`issuedByRole` | Активные ссылки не ломать; при следующем использовании проверить, что роль ссылки ≤ роли создателя; ссылки с `CUSTOMER` от не-`CUSTOMER` отозвать с аудитом |
| `ChangeRequest` | Экспорт JSON + архивная таблица (если (в)) | Сначала `SELECT`/export, затем миграция drop; `projects.remove` перестаёт считать таблицу. Без экспорта удалять нельзя |
| `AuditLog` | Оставить append-only, добавить nullable `objectId/projectId` | Backfill только там, где выводимо из `entity/entityId` (`material`, `report`, `object_access`); остальное null. Чтение без scope — запрещено |
| `Object.isArchived` | Проверить count; `false` → удалить поле, `true` → сначала решение владельца | Никакого автоудаления данных; если `true` есть, показать список объектов |
| `User.role` | Оставить `ADMIN`; остальные значения не использовать в auth | Колонку не удалять в первом релизе (обратная совместимость JWT/API); `STORE_MANAGER` убрать из enum после проверки |

**Обратная совместимость API.** Все существующие маршруты и поля ответа сохраняются: `role`, `hidePrices`, `hasObjectAccess`, `accessId`, `revoked`, `isManager`, `canWrite`, `canManage` продолжают приходить, но вычисляются capability-слоем из membership/scope. `ObjectAccess` DTO (`addAccess`: `projectId`, `role`, `isManager`, `hidePrices`) принимается как раньше и транслируется в новую модель. Ошибки: 404 для чужих приватных сущностей (не раскрывать существование), 403 для известного объекта без права. Никаких новых публичных endpoint’ов в рамках упрощения.

**Совместимость фронта.** `AuthContext` хранит только глобального пользователя (`AuthContext.tsx:20-57`), поэтому права объекта надо получать из `GET /objects/:id` и передавать в один hook; ответы не меняются. Страницы продолжают работать, пока hook не заменён.

**Rollout без простоя.** Expand → backfill → dual-read shadow (сравнивать старый `resolve*` и новый `can()` в логах, не в ответах) → переключить чтение → переключить запись → contract (удалить старые поля/флаги). Feature flag `ACCESS_V2`; при расхождении — возврат на старый resolver. Для миграции — транзакция + резервная копия; тест на копии БД, не на живых данных.

## 9. План работ по шагам (без кода)

1. **Заморозить контракт и снять факты.** Резервная копия; read-only counts из раздела 8; список всех маршрутов с метаданными «какой objectId/projectId берёт». Не менять данные.
2. **P0-1: отзыв.** Ввести один `AccessContext`; при `revoked` разрешить только снимок. Закрыть `estimate-templates.create` для отозванных; live-чтения — deny. Тесты: отозванный читает материалы/отчёт/склад/участников → 403/404; снимок доступен.
3. **P0-2: приглашения.** Ограничить роль ссылки ролью создателя; `CUSTOMER` выдаёт только `CUSTOMER`; `FOREMAN` без `canManageTeam` не создаёт; `revoked` не создаёт; отозвать/пометить старые эскалирующие ссылки.
4. **P0-3: аудит и склад.** `audit` — обязательный scope или `ADMIN`; `warehouse` — capability `warehouse.write`, проверка `project.objectId == item.objectId`, общие позиции только владелец/админ.
5. **P0-4: отчёты и деньги.** `report.write`; `list()` пропускать через `stripPrices`; `PriceItem` резолвить через `loadCatalogAccess`; `template.create` требует `money.view` либо не копирует цены.
6. **Контрактные тесты матрицы.** Для каждой строки таблицы §6: разрешённый и запрещённый кейс на уровне HTTP, не только unit. CI-гард: защищённый контроллер без capability-метаданных не проходит тест.
7. **Capability-слой в shadow.** `can()` рядом со старым resolver; сравнение решений в логах без влияния на ответы 3–5 дней; расхождения — блокер переключения.
8. **Expand/backfill.** Добавить `ObjectMembership`/`ProjectScope`/`archive`; заполнить; старые таблицы оставить read-only. Проверить counts до/после; сделать rollback-скрипт.
9. **Переключить чтение, затем запись.** Все списки/детали/аналитика через один scope; затем мутации. Feature flag `ACCESS_V2`, мгновенный откат.
10. **Фронт.** Один `useCapabilities`; убрать локальные `hidePrices`/`role` условия; кнопки только по capability; скрыть/показать действия по одному источнику. Не менять API-поля.
11. **Contract и упрощение.** Удалить `hasObjectAccess`-хранилище (оставить вычисление), `STORE_MANAGER` из auth, `Object.isArchived` после проверки, `ChangeRequest` по варианту (в). Только после зелёных тестов.
12. **Приёмка.** Матрица ролей × действий × объектов; сценарии: project-only, revoked, hidden, hidePrices, VIEWER, ADMIN, invite escalation, audit leak; демо на копии данных. Затем — решение о первом платеже.

## 10. Что я НЕ проверил и почему

- **Не читал БД и не запускал миграции/сборку/тесты/dev-серверы** — прямой запрет задания. Поэтому counts, фактическое наличие `isArchived=true`, строк `ChangeRequest`, битых/дублирующихся грантов неизвестны.
- **Не открывал `docs/audit-2026-10/A-access.md`** — требование независимого вердикта; не сверял выводы с другим аудитором.
- **Не проверял все frontend-страницы в браузере.** Прочитаны целевые `Objects.tsx`, `Projects.tsx`, `Materials.tsx`, `Users.tsx`, `AuthContext.tsx`, `Reports.tsx` точечно; визуальные состояния, роутинг и реальные ответы API не воспроизводились.
- **Не проверял PDF/XLSX-генерацию** (`pdf.service.ts`, `xlsx.service.ts`) на утечки: они получают уже сформированный `detail()`, но содержимое шаблонов и метаданные не аудировались.
- **Не проверял auth-часть целиком:** rate limit, captcha, email-токены, reset-password, CORS, secure headers, JWT rotation — вне области доступа, кроме `tokenVersion`.
- **Не проверял производительность** `loadAccessGrants`/capability-слоя, N+1 и поведение при сотнях объектов; не тестировал конкурентные `revoke`/`restore`/`approve`.
- **Не проверял фактическую маршрутизацию** (global prefix, порядок маршрутов, Swagger) — цитаты даны по контроллерам; runtime-поведение 403/404 не воспроизводилось.
- **Не проверял реальные роли пользователей** и наличие `ADMIN` в продакшене; вывод «ADMIN не обходит ObjectAccess» сделан по коду.

## 11. Требует подтверждения владельца

1. **Смысл отзыва:** после `revokedAt` пользователь должен видеть **неизменяемый снимок** или **ничего**? Сейчас UI обещает снимок, код отдаёт live. Без ответа нельзя правильно закрыть F1/F7.
2. **Кто вправе приглашать:** только `CUSTOMER`, или `FOREMAN` тоже? Может ли `FOREMAN` выдавать `CUSTOMER`? Рекомендация: только `CUSTOMER` выдаёт `CUSTOMER`; `FOREMAN` — не выше `FOREMAN` и только с `canManageTeam`.
3. **`ADMIN`:** должен ли он видеть все объекты/аудиты без `ObjectAccess`? Сейчас — нет, кроме трёх сервисов. Это продуктовое решение, не баг.
4. **`hidePrices` и запись:** может ли прораб с `hidePrices=true` добавлять материалы/фиксации? API сейчас может, UI — нет. Нужно одно правило.
5. **Project-only участник:** должен ли он видеть склад/отчёты/бригады только своего проекта? Сейчас склад требует object-wide, отчёты — project-or-object, бригады — object-or-project; единой семантики нет.
6. **Контакты участников:** могут ли `VIEWER`/отозванный видеть e-mail/телефон команды? Если да — F11/F17 не баг, а политика; если нет — нужно скрывать.
7. **Личный архив:** скрытый объект исключается из KPI/аналитики (сейчас да). Подтвердить, что это ожидаемо для владельца, а не потеря данных.
8. **Согласования:** нужны ли они в v1 юридически/по договору? Если да — вариант (б) становится обязательным, но политику всё равно надо переписать.
9. **`Object.isArchived`:** есть ли в живых данных `true`? Если да — какие объекты и почему; удалять поле нельзя до решения.
10. **Названия ролей:** «Заказчик/Прораб/Наблюдатель» или «Владелец/Прораб/Наблюдатель»? Влияет на UI и документы, не на код доступа.

## 12. Ответ на открытый пункт §24 п.1 (роли)

Сравнение уже приведено в §5: (а) переименование — S, но оставляет мёртвый `ChangeRequest` и ложную подсказку; (б) экран согласований — M/L, высокий риск для демо и первого платежа, требует сначала исправить политику; (в) официально выключить — M, убирает мёртвый код и ложное обещание, соответствует фактическому поведению.

**Одна рекомендация: (в) официально выключить согласования в v1, а переименование ролей сделать косметикой внутри этого же изменения.** Если владелец юридически обязан иметь approvals — тогда и только тогда (б), но отдельным этапом после P0 и с переписанной политикой (`CUSTOMER` утверждает, `FOREMAN` — только своя заявка, `revoked` — deny). Вариант (а) как самостоятельное решение не рекомендую: он дешёвый, но не устраняет главный риск — продукт обещает функцию, которой нет, и оставляет API с неверными правами.

