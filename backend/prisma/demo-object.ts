// backend/prisma/demo-object.ts
// ⭐ №167: `npm run db:demo` — демонстрационные данные для ручного тестирования:
//   • демо-объект «Коттедж 180 м² (демо)» — 5 проектов по инженерным системам и отделке;
//   • «реальный» объект «ЖК «Северный парк», корпус 2» — 3 проекта;
//   • 5 пользователей с разными ролями и разными скоупами доступа (№163):
//     объектный доступ vs доступ только к одному проекту, заказчик/прораб/наблюдатель.
//
// Идемпотентность: объекты с такими именами удаляются вместе с проектами,
// материалами, фиксациями, складом, отчётами и бригадами, затем создаются заново.
// Пользователи пересоздаются по email (пароль сбрасывается на DEMO_PASSWORD).
//
// Запуск: npm run db:demo
import { AccessRole, PrismaClient, Role, Unit } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo1234!';
const DEMO_OBJECT_NAME = 'Коттедж 180 м² (демо)';
const REAL_OBJECT_NAME = 'ЖК «Северный парк», корпус 2';

// ─────────────────────────────────────────────────────────────────────────────
// Пользователи демо-стенда
// ─────────────────────────────────────────────────────────────────────────────
interface DemoUser {
  email: string;
  phone: string;
  fullName: string;
  role: Role; // роль в приложении (ADMIN/STORE_MANAGER/FOREMAN/CUSTOMER)
  demoAccess: { role: AccessRole; hidePrices?: boolean; projectIndex?: number };
  realAccess: { role: AccessRole; hidePrices?: boolean; projectIndex?: number };
}

const DEMO_USERS: DemoUser[] = [
  {
    email: 'admin@frame.app',
    phone: '+79990000010',
    fullName: 'Администратор (полный доступ)',
    role: Role.ADMIN,
    demoAccess: { role: AccessRole.CUSTOMER },
    realAccess: { role: AccessRole.CUSTOMER },
  },
  {
    email: 'owner@frame.app',
    phone: '+79990000011',
    fullName: 'Иванов Пётр — Заказчик',
    role: Role.CUSTOMER,
    demoAccess: { role: AccessRole.CUSTOMER },
    realAccess: { role: AccessRole.CUSTOMER },
  },
  {
    email: 'prorab@frame.app',
    phone: '+79990000012',
    fullName: 'Кузнецов Сергей — Прораб',
    role: Role.FOREMAN,
    // Демо-объект: весь объект. Реальный: ТОЛЬКО первый проект (проверка №163)
    demoAccess: { role: AccessRole.FOREMAN },
    realAccess: { role: AccessRole.FOREMAN, projectIndex: 0 },
  },
  {
    email: 'prorab2@frame.app',
    phone: '+79990000013',
    fullName: 'Орлов Дмитрий — Прораб (ЭОМ)',
    role: Role.FOREMAN,
    // Демо-объект: ТОЛЬКО проект «ЭОМ». Реальный: весь объект
    demoAccess: { role: AccessRole.FOREMAN, projectIndex: 0 },
    realAccess: { role: AccessRole.FOREMAN },
  },
  {
    email: 'viewer@frame.app',
    phone: '+79990000014',
    fullName: 'Сидорова Анна — Наблюдатель (без цен)',
    role: Role.STORE_MANAGER,
    demoAccess: { role: AccessRole.VIEWER, hidePrices: true },
    realAccess: { role: AccessRole.VIEWER, hidePrices: true, projectIndex: 2 },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Строки смет: [название, единица, объём по спецификации, цена работы, цена материала, факт]
// ─────────────────────────────────────────────────────────────────────────────
interface Line {
  name: string;
  unit: Unit;
  qty: number;
  work: number;
  mat: number;
  used: number;
  note?: string;
}
interface ProjectSeed {
  name: string;
  start: string;
  end: string;
  note: string;
  lines: Line[];
}

const l = (
  name: string,
  unit: Unit,
  qty: number,
  work: number,
  mat: number,
  used: number,
  note?: string,
): Line => ({ name, unit, qty, work, mat, used, note });

const SM = Unit.SQUARE_METER;
const M = Unit.METER;
const PCS = Unit.PIECE;
const CM = Unit.CUBIC_METER;
const T = Unit.TON;

const DEMO_PROJECTS: ProjectSeed[] = [
  {
    name: 'ЭОМ — электромонтажные работы',
    start: '2026-06-10',
    end: '2026-09-30',
    note: 'Демо-проект: розетки, освещение, щит, кабельные трассы.',
    lines: [
      l('Штробление стен под кабель', M, 320, 420, 0, 260),
      l('Монтаж кабеля ВВГнг 3×2,5', M, 850, 180, 95, 640),
      l('Монтаж кабеля ВВГнг 3×4', M, 260, 220, 165, 180),
      l('Установка подрозетников', PCS, 96, 180, 45, 84),
      l('Установка розеток Schneider', PCS, 96, 320, 480, 80),
      l('Установка выключателей', PCS, 42, 300, 390, 36),
      l('Монтаж распределительного щита', PCS, 4, 4500, 12800, 3),
      l('Сборка щита (автоматы, УЗО)', PCS, 4, 6800, 9400, 3),
      l('Монтаж светильников точечных', PCS, 148, 380, 620, 110),
      l('Монтаж люстр', PCS, 12, 1200, 4200, 9),
      l('Монтаж кабель-канала', M, 180, 260, 120, 140),
      l('Установка уличного светильника', PCS, 8, 900, 3400, 6),
      l('Заземление контура (полоса)', M, 60, 650, 280, 60),
      l('Монтаж временного освещения', PCS, 6, 700, 900, 6),
      l('Прозвонка и маркировка линий', PCS, 96, 120, 0, 64),
      l('Пусконаладка электрощита', PCS, 4, 3800, 0, 2),
    ],
  },
  {
    name: 'АПС — пожарная сигнализация и оповещение',
    start: '2026-07-01',
    end: '2026-10-15',
    note: 'Демо-проект: извещатели, приборы, оповещатели.',
    lines: [
      l('Монтаж дымовых извещателей ИП-212', PCS, 38, 420, 890, 34),
      l('Монтаж тепловых извещателей', PCS, 8, 420, 760, 6),
      l('Монтаж ручных извещателей ИПР', PCS, 10, 450, 620, 10),
      l('Прокладка кабеля КСПВ 2×0,5', M, 640, 120, 28, 520),
      l('Прокладка кабеля огнестойкого 2×1,5', M, 220, 260, 96, 180),
      l('Монтаж прибора С2000-М', PCS, 2, 5400, 14800, 2),
      l('Монтаж прибора С2000-СП1', PCS, 4, 2200, 4900, 3),
      l('Монтаж оповещателей световых', PCS, 18, 380, 740, 14),
      l('Монтаж звуковых оповещателей', PCS, 8, 420, 980, 6),
      l('Установка аккумуляторных батарей', PCS, 4, 600, 2800, 4),
      l('Прокладка лотка металлического', M, 120, 480, 360, 96),
      l('Пусконаладка АПС', PCS, 1, 18500, 0, 1, 'Требуется акт от МЧС'),
    ],
  },
  {
    name: 'АОВ — вентиляция и кондиционирование',
    start: '2026-07-15',
    end: '2026-11-15',
    note: 'Демо-проект: воздуховоды, диффузоры, канальные вентиляторы.',
    lines: [
      l('Монтаж воздуховодов круглых Ø160', M, 86, 890, 240, 68),
      l('Монтаж воздуховодов Ø200', M, 54, 980, 310, 40),
      l('Установка диффузоров', PCS, 26, 420, 680, 22),
      l('Установка регулируемых решёток', PCS, 18, 460, 890, 12),
      l('Монтаж канального вентилятора', PCS, 6, 2600, 8900, 4),
      l('Монтаж приточной установки', PCS, 1, 14500, 86000, 1),
      l('Изоляция воздуховодов фольгированной', SM, 64, 320, 180, 52),
      l('Монтаж гибких воздуховодов', M, 46, 380, 260, 38),
      l('Установка обратных клапанов', PCS, 8, 520, 1240, 7),
      l('Монтаж дренажа кондиционеров', M, 38, 260, 95, 30),
      l('Установка наружного блока', PCS, 4, 4800, 42000, 3),
      l('Пусконаладка вентиляции', PCS, 1, 12500, 0, 0),
    ],
  },
  {
    name: 'ВК — водоснабжение и канализация',
    start: '2026-06-20',
    end: '2026-10-31',
    note: 'Демо-проект: разводка PPR, радиаторы, канализация, сантехника.',
    lines: [
      l('Монтаж труб PPR Ø25', M, 240, 460, 130, 210),
      l('Монтаж труб PPR Ø32', M, 120, 520, 170, 96),
      l('Установка тройников и фитингов', PCS, 86, 180, 70, 74),
      l('Опрессовка системы водоснабжения', PCS, 1, 8900, 0, 1),
      l('Монтаж радиаторов RIFAR 500', PCS, 14, 2200, 7600, 12),
      l('Монтаж полотенцесушителей', PCS, 3, 1800, 5900, 3),
      l('Монтаж канализационных труб Ø110', M, 76, 490, 210, 70),
      l('Монтаж канализационных труб Ø50', M, 58, 380, 120, 50),
      l('Установка унитазов', PCS, 4, 1500, 12800, 3),
      l('Установка раковин с тумбой', PCS, 5, 1600, 9400, 4),
      l('Установка душевых кабин', PCS, 3, 3800, 24500, 2),
      l('Монтаж коллектора тёплого пола', PCS, 2, 6200, 18400, 2),
      l('Монтаж труб тёплого пола', M, 320, 260, 95, 280),
      l('Пусконаладка котельной', PCS, 1, 16500, 0, 0),
    ],
  },
];

const FINISH_PROJECT: ProjectSeed = {
  name: 'Отделка по помещениям',
  start: '2026-08-01',
  end: '2026-12-20',
  note: 'Демо-проект: штукатурка, стяжка, плитка, покраска, двери, ламинат.',
  lines: [
    l('Штукатурка стен по маякам (1 этаж)', SM, 180, 620, 210, 150),
    l('Штукатурка стен по маякам (2 этаж)', SM, 160, 620, 210, 96),
    l('Стяжка пола 60 мм (1 этаж)', SM, 120, 880, 420, 120),
    l('Стяжка пола 60 мм (2 этаж)', SM, 110, 880, 420, 80),
    l('Грунтовка стен', SM, 340, 90, 35, 300),
    l('Шпаклёвка стен под покраску', SM, 210, 480, 120, 160),
    l('Покраска стен водоэмульсионной', SM, 210, 320, 90, 140),
    l('Покраска потолков', SM, 180, 380, 110, 120),
    l('Укладка плитки на стены санузлов', SM, 46, 1100, 780, 38),
    l('Укладка плитки на пол санузлов', SM, 22, 1050, 820, 18),
    l('Укладка ламината 33 класс', SM, 74, 520, 1150, 52),
    l('Монтаж плинтуса MDF', M, 120, 260, 180, 84),
    l('Установка межкомнатных дверей', PCS, 9, 2600, 12400, 6),
    l('Установка входной двери', PCS, 1, 4800, 38000, 1),
    l('Монтаж натяжного потолка', SM, 32, 560, 690, 32),
    l('Устройство тёплого пола (плитка)', SM, 18, 700, 1200, 12),
    l('Установка подоконников', PCS, 10, 900, 2400, 8),
    l('Откосы оконные (пластик)', PCS, 10, 1100, 1800, 7),
    l('Монтаж лестничных перил', M, 14, 1800, 4200, 10),
    l('Финишная уборка помещений', SM, 340, 120, 0, 180),
  ],
};

const DEMO_ALL_PROJECTS: ProjectSeed[] = [...DEMO_PROJECTS, FINISH_PROJECT];

const REAL_PROJECTS: ProjectSeed[] = [
  {
    name: 'Монолитные работы (1 очередь)',
    start: '2026-08-01',
    end: '2027-01-31',
    note: 'Реальный объект: фундамент и плиты перекрытия.',
    lines: [
      l('Разработка грунта экскаватором', CM, 420, 450, 0, 420),
      l('Устройство бетонной подготовки', CM, 64, 1850, 3200, 64),
      l('Устройство ленточного фундамента', CM, 180, 4200, 5200, 170),
      l('Установка арматурного каркаса', T, 24, 28500, 62000, 22),
      l('Монтаж опалубки щитовой', SM, 620, 480, 210, 580),
      l('Бетонирование плиты перекрытия', SM, 820, 1180, 4200, 700),
      l('Уход за бетоном', SM, 1440, 45, 15, 1300),
      l('Демонтаж опалубки', SM, 620, 95, 0, 560),
      l('Бетонирование колонн', CM, 42, 5400, 4800, 36),
      l('Заливка стяжки пола', SM, 240, 320, 420, 180),
      l('Гидроизоляция фундамента', SM, 260, 380, 240, 240),
      l('Устройство температурных швов', M, 86, 240, 120, 72),
      l('Засыпка грунта с уплотнением', CM, 310, 380, 0, 240),
      l('Вывоз грунта самосвалом', CM, 240, 280, 0, 240),
    ],
  },
  {
    name: 'Кровля и водосток',
    start: '2026-09-01',
    end: '2026-12-31',
    note: 'Реальный объект: металлочерепица, утепление, водосток.',
    lines: [
      l('Монтаж стропильной системы', CM, 18, 4200, 8400, 16),
      l('Укладка пароизоляции', SM, 320, 180, 95, 300),
      l('Утепление кровли минватой 200 мм', SM, 320, 420, 780, 300),
      l('Монтаж металлочерепицы', SM, 340, 620, 690, 320),
      l('Монтаж доборных элементов', M, 96, 380, 420, 84),
      l('Монтаж водостока', M, 74, 460, 380, 60),
      l('Установка снегозадержателей', M, 62, 320, 540, 48),
      l('Монтаж мансардных окон', PCS, 4, 3800, 24500, 3),
      l('Установка вентиляционных выходов', PCS, 6, 1200, 2400, 5),
      l('Монтаж подшивки свесов', M, 86, 380, 290, 70),
    ],
  },
  {
    name: 'Отделка мест общего пользования',
    start: '2026-09-15',
    end: '2027-03-31',
    note: 'Реальный объект: подъезды, лестницы, крыльцо.',
    lines: [
      l('Штукатурка стен лестничных клеток', SM, 260, 620, 210, 240),
      l('Шпаклёвка и покраска стен', SM, 260, 480, 120, 200),
      l('Облицовка плиткой крыльца', SM, 32, 1100, 820, 32),
      l('Укладка керамогранита в холле', SM, 48, 1050, 980, 40),
      l('Монтаж перил и ограждений', M, 64, 1800, 3200, 56),
      l('Краска лестничных маршей', SM, 120, 320, 90, 96),
      l('Установка почтовых ящиков', PCS, 12, 380, 1200, 12),
      l('Монтаж указателей этажей', PCS, 10, 260, 680, 8),
      l('Установка противопожарных дверей', PCS, 8, 2600, 14500, 6),
      l('Монтаж поручней', M, 48, 900, 1400, 40),
      l('Уборка после отделки', SM, 320, 120, 0, 300),
      l('Герметизация швов', M, 180, 220, 140, 160),
      l('Монтаж тактильной плитки', PCS, 24, 380, 640, 24),
      l('Установка домофона', PCS, 2, 2400, 18500, 2),
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Хелперы
// ─────────────────────────────────────────────────────────────────────────────
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** 2–3 фиксации на строку, чтобы в истории была динамика */
function buildFixes(used: number, userId: number) {
  const parts = used >= 20 ? [0.5, 0.3, 0.2] : [0.6, 0.4];
  return parts.map((part, index) => ({
    amount: round3(used * part),
    note: index === 0 ? 'Первичная фиксация объёма' : undefined,
    fixedAt: new Date(Date.UTC(2026, 7 + index, 12 + index * 9)),
    userId,
  }));
}

/** Удаляем прошлые демо-данные (объекты с нашими именами + демо-пользователей) */
async function cleanup() {
  const objects = await prisma.object.findMany({
    where: { name: { in: [DEMO_OBJECT_NAME, REAL_OBJECT_NAME] } },
    select: { id: true },
  });
  const objectIds = objects.map((o) => o.id);
  if (objectIds.length) {
    // Склад и бригады объекта не удаляются каскадом — чистим руками
    await prisma.warehouseTransaction.deleteMany({
      where: { warehouseItem: { objectId: { in: objectIds } } },
    });
    await prisma.warehouseItem.deleteMany({
      where: { objectId: { in: objectIds } },
    });
    await prisma.brigadeShift.deleteMany({
      where: { brigade: { objectId: { in: objectIds } } },
    });
    await prisma.brigadeMember.deleteMany({
      where: { brigade: { objectId: { in: objectIds } } },
    });
    await prisma.brigade.deleteMany({ where: { objectId: { in: objectIds } } });
    await prisma.object.deleteMany({ where: { id: { in: objectIds } } });
  }
  await prisma.user.deleteMany({
    where: { email: { in: DEMO_USERS.map((u) => u.email) } },
  });
  console.log(
    `  ✓ Очищено: объектов ${objectIds.length}, пользователей ${DEMO_USERS.length}`,
  );
}

/** Проект + строки сметы + фиксации */
async function seedProject(
  objectId: number,
  seed: ProjectSeed,
  catalogId: number | null,
  foremanId: number,
) {
  const project = await prisma.project.create({
    data: {
      name: seed.name,
      objectId,
      startDate: new Date(seed.start),
      endDate: new Date(seed.end),
      note: seed.note,
      catalogId,
    },
  });

  for (const line of seed.lines) {
    const used = line.used;
    await prisma.material.create({
      data: {
        name: line.name,
        unit: line.unit,
        specQuantity: line.qty,
        totalUsed: used,
        lastEntry: used > 0 ? used : null,
        lastEntryDate: used > 0 ? new Date(Date.UTC(2026, 9, 15)) : null,
        progressPercent:
          line.qty > 0 ? Math.round((used / line.qty) * 100) : 0,
        unitPrice: line.work,
        materialUnitPrice: line.mat,
        totalCost: round2(used * line.work),
        materialTotalCost: round2(used * line.mat),
        note: line.note ?? null,
        projectId: project.id,
        fixes: used > 0 ? { create: buildFixes(used, foremanId) } : undefined,
      },
    });
  }
  return project;
}

/** Складское имущество объекта + движения (приход и списание на проект) */
async function seedWarehouse(
  objectId: number,
  projectId: number,
  userId: number,
) {
  const items = [
    { name: 'Перфоратор Bosch GBH 2-26', unit: 'шт', category: 'инструмент', quantity: 2, price: 24900 },
    { name: 'Диск отрезной 125 мм', unit: 'шт', category: 'расходник', quantity: 40, price: 85 },
    { name: 'Саморез 4,2×75 (упак. 200 шт)', unit: 'упак', category: 'расходник', quantity: 12, price: 640 },
    { name: 'Кабель ВВГнг 3×2,5 (бухта 100 м)', unit: 'бухта', category: 'материал', quantity: 3, price: 8900 },
    { name: 'Строительный пылесос Karcher', unit: 'шт', category: 'оборудование', quantity: 1, price: 31900 },
  ];
  for (const item of items) {
    const created = await prisma.warehouseItem.create({
      data: { ...item, objectId, comment: 'Демо-склад объекта' },
    });
    await prisma.warehouseTransaction.create({
      data: {
        warehouseItemId: created.id,
        type: 'income',
        quantity: item.quantity,
        price: item.price,
        comment: 'Поступление (демо)',
        createdBy: userId,
      },
    });
    if (item.quantity > 1) {
      await prisma.warehouseTransaction.create({
        data: {
          warehouseItemId: created.id,
          type: 'expense',
          quantity: Math.max(1, Math.round(item.quantity * 0.2)),
          price: item.price,
          projectId,
          comment: 'Списание на проект (демо)',
          createdBy: userId,
        },
      });
    }
  }
}

/** Бригада с выходами на первые проекты объекта */
async function seedBrigade(
  objectId: number,
  projectIds: number[],
  userId: number,
) {
  const brigade = await prisma.brigade.create({
    data: {
      name: 'Бригада №1 (демо)',
      objectId,
      comment: 'Отделочники, 4 человека',
      members: {
        create: [
          { fullName: 'Кузнецов Сергей', role: 'бригадир', phone: '+79990000012' },
          { fullName: 'Орлов Дмитрий', role: 'мастер', phone: '+79990000013' },
          { fullName: 'Мамедов Али', role: 'рабочий' },
          { fullName: 'Петров Иван', role: 'рабочий' },
        ],
      },
    },
  });
  let day = 1;
  for (const projectId of projectIds.slice(0, 2)) {
    for (let i = 0; i < 3; i++) {
      await prisma.brigadeShift.create({
        data: {
          brigadeId: brigade.id,
          projectId,
          date: new Date(Date.UTC(2026, 9, day)),
          hoursWorked: 8,
          outputValue: 12000 + i * 1500,
          outputArea: 18 + i * 4,
          comment: 'Демо-выход бригады',
          createdBy: userId,
        },
      });
      day++;
    }
  }
}

/** Отчёт (смета/акт) по первым строкам проекта */
async function seedReport(
  objectId: number,
  projectId: number,
  type: 'estimate' | 'act',
  title: string,
  createdBy: number,
) {
  const materials = await prisma.material.findMany({
    where: { projectId },
    orderBy: { id: 'asc' },
    take: 6,
  });
  if (!materials.length) return;
  const items = materials.map((m, index) => {
    const quantity = Number(m.totalUsed) || Number(m.specQuantity) / 2;
    const price = Number(m.unitPrice) + Number(m.materialUnitPrice);
    return {
      name: m.name,
      unit: String(m.unit),
      quantity: round2(quantity),
      price: round2(price),
      total: round2(quantity * price),
      sortOrder: index,
    };
  });
  await prisma.report.create({
    data: {
      type,
      title,
      projectId,
      objectId,
      totalAmount: round2(items.reduce((sum, item) => sum + item.total, 0)),
      status: type === 'act' ? 'approved' : 'draft',
      createdBy,
      items: { create: items },
    },
  });
}

/** Выдать доступ: projectIndex задан → только этот проект, иначе весь объект */
async function grantAccess(
  userId: number,
  objectId: number,
  access: DemoUser['demoAccess'],
  projectIds: number[],
) {
  const projectId =
    access.projectIndex != null ? projectIds[access.projectIndex] ?? null : null;
  await prisma.objectAccess.create({
    data: {
      userId,
      objectId,
      projectId,
      role: access.role,
      hidePrices: access.hidePrices ?? false,
    },
  });
}

async function main() {
  console.log('→ db:demo: демо-объект + «реальный» объект + 5 пользователей');
  await cleanup();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds: Record<string, number> = {};
  for (const user of DEMO_USERS) {
    const created = await prisma.user.create({
      data: {
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        password: passwordHash,
      },
    });
    userIds[user.email] = created.id;
  }
  console.log(`  ✓ Пользователи: ${DEMO_USERS.length} (пароль ${DEMO_PASSWORD})`);

  // Совместимость: старые тестовые аккаунты (созданы до №160) получают тот же
  // пароль — иначе их логины/пароли из ранних срезов неизвестны.
  const legacy = await prisma.user.updateMany({
    where: {
      email: {
        in: ['foreman@frame.app', 'customer@frame.app', 'sub@frame.app'],
      },
    },
    data: { password: passwordHash },
  });
  if (legacy.count > 0) {
    console.log(
      `  ✓ Пароль старых тестовых пользователей сброшен на ${DEMO_PASSWORD}: ${legacy.count}`,
    );
  }

  const catalog =
    (await prisma.priceCatalog.findFirst({
      where: { ownerId: null },
      orderBy: { id: 'asc' },
    })) ??
    (await prisma.priceCatalog.create({
      data: { name: 'Демо-справочник', ownerId: null },
    }));

  const foremanId = userIds['prorab@frame.app'];
  const customerId = userIds['owner@frame.app'];

  // ── Демо-объект ────────────────────────────────────────────────────────────
  const demoObject = await prisma.object.create({
    data: {
      name: DEMO_OBJECT_NAME,
      address: 'Московская обл., КП «Лесная поляна», участок 14',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-12-31'),
      plannedEndDate: new Date('2026-12-31'),
      isDemo: true,
      note: 'Демонстрационный объект: 5 проектов, фиксации, склад, отчёты, бригада.',
    },
  });
  const demoProjects: number[] = [];
  for (const seed of DEMO_ALL_PROJECTS) {
    const project = await seedProject(demoObject.id, seed, catalog.id, foremanId);
    demoProjects.push(project.id);
  }
  await seedWarehouse(demoObject.id, demoProjects[0], foremanId);
  await seedBrigade(demoObject.id, demoProjects, foremanId);
  await seedReport(demoObject.id, demoProjects[0], 'estimate', 'Смета: ЭОМ (демо)', customerId);
  await seedReport(demoObject.id, demoProjects[4], 'act', 'Акт: отделка, этап 1 (демо)', customerId);
  console.log(`  ✓ ${DEMO_OBJECT_NAME}: ${demoProjects.length} проектов`);

  // ── «Реальный» объект ──────────────────────────────────────────────────────
  const realObject = await prisma.object.create({
    data: {
      name: REAL_OBJECT_NAME,
      address: 'г. Москва, ул. Северная, вл. 12, корп. 2',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2027-06-30'),
      plannedEndDate: new Date('2027-06-30'),
      isDemo: false,
      note: '«Реальный» объект для проверки ролей и проектного доступа (№163).',
    },
  });
  const realProjects: number[] = [];
  for (const seed of REAL_PROJECTS) {
    const project = await seedProject(realObject.id, seed, catalog.id, foremanId);
    realProjects.push(project.id);
  }
  await seedReport(realObject.id, realProjects[0], 'estimate', 'Смета: монолит (демо)', customerId);
  console.log(`  ✓ ${REAL_OBJECT_NAME}: ${realProjects.length} проектов`);

  // ── Доступы: объектные и проектные ─────────────────────────────────────────
  for (const user of DEMO_USERS) {
    await grantAccess(userIds[user.email], demoObject.id, user.demoAccess, demoProjects);
    await grantAccess(userIds[user.email], realObject.id, user.realAccess, realProjects);
  }
  console.log('  ✓ Доступы выданы (объектные и проектные)');

  const rows = DEMO_USERS.map((u) => ({
    Email: u.email,
    'Пароль': DEMO_PASSWORD,
    'Роль в системе': u.role,
    'Демо-объект': u.demoAccess.projectIndex != null
      ? `только проект #${u.demoAccess.projectIndex + 1}`
      : 'весь объект',
    'Реальный объект': u.realAccess.projectIndex != null
      ? `только проект #${u.realAccess.projectIndex + 1}`
      : 'весь объект',
    'Цены': u.demoAccess.hidePrices ? 'скрыты' : 'видны',
  }));
  console.table(rows);
  console.log('\n⚠ Пароль всех демо-пользователей: ' + DEMO_PASSWORD);
  console.log('⚠ Повторный запуск пересоздаёт пользователей и объекты (пароль сбрасывается).');
}

main()
  .catch((e) => {
    console.error('Demo seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });





