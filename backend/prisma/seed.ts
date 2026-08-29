// backend/prisma/seed.ts
// Идемпотентный seed демо-данных FRAME.
// Запуск: npx prisma db seed  (или  npx ts-node prisma/seed.ts)
//
// Стратегия идемпотентности:
//  • User — upsert по email (email @unique).
//  • Все демо-данные помечаются префиксом [SEED] в name/note или SEED- в article.
//    Перед повторной заливкой старые seed-записи удаляются в одной транзакции.
//    Несидовые (боевые) данные не затрагиваются.
//
// TODO: orgId после мульти-тенантности — добавлять orgId на каждую запись.

import { PrismaClient, Role, PriceKind, Unit, OrgRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SEED_TAG = '[SEED]';
const SEED_ART = 'SEED-';

// ─────────────────────────────────────────────────────────────────────────────
// СПРАВОЧНИК: КАТЕГОРИИ РАБОТ (10 шт × 18-20 расценок)
// ─────────────────────────────────────────────────────────────────────────────
type WorkItem = [name: string, unit: Unit, price: number];

const WORK_CATEGORIES: { name: string; items: WorkItem[] }[] = [
  {
    name: 'Земляные работы',
    items: [
      ['Срезка грунта растительного слоя', Unit.CUBIC_METER, 180],
      ['Разработка грунта экскаватором', Unit.CUBIC_METER, 450],
      ['Разработка грунта вручную', Unit.CUBIC_METER, 920],
      ['Засыпка грунта с уплотнением', Unit.CUBIC_METER, 380],
      ['Вертикальная планировка площадки', Unit.SQUARE_METER, 95],
      ['Устройство щебёночного основания', Unit.SQUARE_METER, 320],
      ['Устройство песчаного основания', Unit.SQUARE_METER, 280],
      ['Бетонная подготовка тощим бетоном', Unit.CUBIC_METER, 1850],
      ['Копка траншеи под фундамент', Unit.CUBIC_METER, 720],
      ['Обратная засыпка пазух', Unit.CUBIC_METER, 340],
      ['Уплотнение грунта виброплитой', Unit.SQUARE_METER, 110],
      ['Вывоз грунта самосвалом', Unit.CUBIC_METER, 280],
      ['Устройство дренажа пристенного', Unit.METER, 690],
      ['Бурение скважин под сваи', Unit.METER, 1450],
      ['Устройство фундаментной подушки', Unit.SQUARE_METER, 410],
      ['Планировка дна котлована', Unit.SQUARE_METER, 65],
      ['Устройство водоотводных канав', Unit.METER, 220],
      ['Откачка воды из котлована', Unit.PIECE, 480],
    ],
  },
  {
    name: 'Бетонные и железобетонные работы',
    items: [
      ['Устройство ленточного фундамента', Unit.CUBIC_METER, 4200],
      ['Устройство монолитной плиты', Unit.CUBIC_METER, 4850],
      ['Установка арматурного каркаса', Unit.TON, 28500],
      ['Бетонирование колонн', Unit.CUBIC_METER, 5400],
      ['Бетонирование стен', Unit.CUBIC_METER, 5200],
      ['Бетонирование перекрытий', Unit.SQUARE_METER, 1180],
      ['Установка фундаментных блоков ФБС', Unit.PIECE, 1850],
      ['Монтаж плит перекрытия ПК', Unit.PIECE, 2150],
      ['Монтаж лестничных маршей', Unit.PIECE, 3400],
      ['Заливка стяжки пола', Unit.SQUARE_METER, 320],
      ['Устройство монолитной лестницы', Unit.SQUARE_METER, 1450],
      ['Установка закладных деталей', Unit.PIECE, 280],
      ['Вибрирование бетона глубинное', Unit.CUBIC_METER, 120],
      ['Уход за бетоном (поливка)', Unit.SQUARE_METER, 45],
      ['Демонтаж опалубки', Unit.SQUARE_METER, 95],
      ['Установка опалубки щитовой', Unit.SQUARE_METER, 480],
      ['Армирование сеткой', Unit.SQUARE_METER, 180],
      ['Бетонирование ростверка', Unit.CUBIC_METER, 4950],
      ['Устройство температурных швов', Unit.METER, 240],
      ['Ремонт бетонных конструкций', Unit.SQUARE_METER, 880],
    ],
  },
  {
    name: 'Кирпичная кладка',
    items: [
      ['Кладка стен из кирпича в 1 кирпич', Unit.SQUARE_METER, 1480],
      ['Кладка стен из кирпича в 1,5 кирпича', Unit.SQUARE_METER, 1850],
      ['Кладка стен из кирпича в 2 кирпича', Unit.SQUARE_METER, 2280],
      ['Кладка перегородок в полкирпича', Unit.SQUARE_METER, 980],
      ['Кладка столбов из кирпича', Unit.CUBIC_METER, 3950],
      ['Кладка армированная', Unit.SQUARE_METER, 1680],
      ['Кладка из газобетонных блоков', Unit.SQUARE_METER, 720],
      ['Кладка из пенобетонных блоков', Unit.SQUARE_METER, 680],
      ['Кладка из керамических блоков', Unit.SQUARE_METER, 950],
      ['Кладка вентиляционных каналов', Unit.METER, 1450],
      ['Устройство армопояса', Unit.METER, 620],
      ['Кладка дымохода кирпичная', Unit.METER, 1850],
      ['Расшивка швов', Unit.SQUARE_METER, 95],
      ['Подрезка швов', Unit.SQUARE_METER, 65],
      ['Установка перемычек', Unit.PIECE, 380],
      ['Кладка облицовочная лицевая', Unit.SQUARE_METER, 1650],
      ['Укладка кирпича на ребро', Unit.SQUARE_METER, 1280],
      ['Демонтаж кирпичной кладки', Unit.SQUARE_METER, 480],
    ],
  },
  {
    name: 'Кровельные работы',
    items: [
      ['Устройство стропильной системы', Unit.SQUARE_METER, 850],
      ['Монтаж обрешётки', Unit.SQUARE_METER, 180],
      ['Укладка металлочерепицы', Unit.SQUARE_METER, 520],
      ['Укладка мягкой черепицы', Unit.SQUARE_METER, 680],
      ['Укладка профнастила', Unit.SQUARE_METER, 420],
      ['Устройство фальцевой кровли', Unit.SQUARE_METER, 920],
      ['Устройство ендовы', Unit.METER, 380],
      ['Устройство конька', Unit.METER, 280],
      ['Монтаж водосточной системы', Unit.METER, 320],
      ['Установка снегозадержателей', Unit.METER, 480],
      ['Устройство кровельного пирога', Unit.SQUARE_METER, 680],
      ['Укладка рубероида в 2 слоя', Unit.SQUARE_METER, 220],
      ['Устройство примыканий', Unit.METER, 420],
      ['Монтаж мансардных окон', Unit.PIECE, 4800],
      ['Установка труб вентиляции кровли', Unit.PIECE, 1850],
      ['Устройство пароизоляции', Unit.SQUARE_METER, 95],
      ['Устройство гидроизоляции', Unit.SQUARE_METER, 120],
      ['Утепление кровли минватой', Unit.SQUARE_METER, 280],
    ],
  },
  {
    name: 'Отделочные работы',
    items: [
      ['Штукатурка стен по маякам', Unit.SQUARE_METER, 380],
      ['Шпаклёвка стен', Unit.SQUARE_METER, 180],
      ['Шпаклёвка потолка', Unit.SQUARE_METER, 220],
      ['Покраска стен', Unit.SQUARE_METER, 145],
      ['Покраска потолка', Unit.SQUARE_METER, 165],
      ['Оклейка обоев флизелиновых', Unit.SQUARE_METER, 195],
      ['Укладка керамической плитки', Unit.SQUARE_METER, 720],
      ['Укладка керамогранита', Unit.SQUARE_METER, 880],
      ['Затирка швов плитки', Unit.SQUARE_METER, 95],
      ['Укладка ламината', Unit.SQUARE_METER, 280],
      ['Укладка линолеума', Unit.SQUARE_METER, 220],
      ['Укладка паркета штучного', Unit.SQUARE_METER, 980],
      ['Устройство наливного пола', Unit.SQUARE_METER, 320],
      ['Монтаж натяжного потолка', Unit.SQUARE_METER, 480],
      ['Монтаж подвесного потолка ГКЛ', Unit.SQUARE_METER, 540],
      ['Установка плинтуса', Unit.METER, 65],
      ['Установка дверных наличников', Unit.METER, 75],
      ['Демонтаж старой отделки', Unit.SQUARE_METER, 95],
      ['Грунтовка стен', Unit.SQUARE_METER, 45],
      ['Декоративная штукатурка', Unit.SQUARE_METER, 680],
    ],
  },
  {
    name: 'Сантехнические работы',
    items: [
      ['Монтаж труб водоснабжения полипропилен', Unit.METER, 280],
      ['Монтаж труб канализации ПВХ', Unit.METER, 320],
      ['Монтаж труб отопления металлопластик', Unit.METER, 380],
      ['Установка радиатора отопления', Unit.PIECE, 1850],
      ['Монтаж котла отопления', Unit.PIECE, 6800],
      ['Установка водонагревателя', Unit.PIECE, 2400],
      ['Монтаж коллекторного узла', Unit.PIECE, 3200],
      ['Установка счётчика воды', Unit.PIECE, 950],
      ['Установка смесителя', Unit.PIECE, 580],
      ['Установка ванны акриловой', Unit.PIECE, 2400],
      ['Установка душевой кабины', Unit.PIECE, 3200],
      ['Установка унитаза-компакт', Unit.PIECE, 1450],
      ['Установка раковины', Unit.PIECE, 980],
      ['Установка инсталляции подвесного унитаза', Unit.PIECE, 2800],
      ['Монтаж тёплого пола водяного', Unit.SQUARE_METER, 680],
      ['Установка фильтра воды', Unit.PIECE, 1200],
      ['Установка полотенцесушителя', Unit.PIECE, 980],
      ['Опрессовка системы отопления', Unit.PIECE, 2800],
    ],
  },
  {
    name: 'Электромонтажные работы',
    items: [
      ['Прокладка кабеля открытым способом', Unit.METER, 65],
      ['Прокладка кабеля в штробе', Unit.METER, 145],
      ['Установка розетки встроенной', Unit.PIECE, 280],
      ['Установка выключателя встроенного', Unit.PIECE, 280],
      ['Установка распределительной коробки', Unit.PIECE, 220],
      ['Сборка электрощита', Unit.PIECE, 4800],
      ['Установка автоматического выключателя', Unit.PIECE, 280],
      ['Установка УЗО', Unit.PIECE, 480],
      ['Монтаж осветительного прибора', Unit.PIECE, 580],
      ['Установка точечного светильника LED', Unit.PIECE, 220],
      ['Установка люстры', Unit.PIECE, 720],
      ['Прокладка СКС интернет-кабеля', Unit.METER, 95],
      ['Установка ТВ-розетки', Unit.PIECE, 280],
      ['Установка звонка', Unit.PIECE, 380],
      ['Монтаж тёплого пола электрического', Unit.SQUARE_METER, 580],
      ['Устройство заземления контура', Unit.PIECE, 4800],
      ['Монтаж электрического конвектора', Unit.PIECE, 1200],
      ['Подключение варочной панели', Unit.PIECE, 980],
      ['Подключение вытяжки', Unit.PIECE, 680],
      ['Монтаж генератора резервного', Unit.PIECE, 6800],
    ],
  },
  {
    name: 'Плотницкие работы',
    items: [
      ['Установка дверного блока межкомнатного', Unit.PIECE, 1850],
      ['Установка оконного блока деревянного', Unit.PIECE, 2400],
      ['Сборка лестницы деревянной', Unit.METER, 4800],
      ['Укладка деревянного пола из доски', Unit.SQUARE_METER, 720],
      ['Монтаж плинтуса деревянного', Unit.METER, 95],
      ['Сборка перегородки каркасной', Unit.SQUARE_METER, 480],
      ['Устройство чернового пола из доски', Unit.SQUARE_METER, 380],
      ['Монтаж обрешётки дощатой', Unit.SQUARE_METER, 145],
      ['Обшивка вагонкой', Unit.SQUARE_METER, 380],
      ['Обшивка имитацией бруса', Unit.SQUARE_METER, 420],
      ['Устройство террасы деревянной', Unit.SQUARE_METER, 980],
      ['Сборка стропил деревянных', Unit.SQUARE_METER, 540],
      ['Изготовление деревянной арки', Unit.PIECE, 3200],
      ['Сборка шкафа-купе деревянного', Unit.PIECE, 6800],
      ['Установка деревянных наличников', Unit.METER, 95],
      ['Монтаж балясин деревянных', Unit.PIECE, 220],
      ['Сборка лаговой конструкции пола', Unit.SQUARE_METER, 280],
      ['Обшивка фронтона доской', Unit.SQUARE_METER, 320],
    ],
  },
  {
    name: 'Установка окон и дверей',
    items: [
      ['Установка окна ПВХ двухстворчатого', Unit.PIECE, 3200],
      ['Установка окна ПВХ трёхстворчатого', Unit.PIECE, 4200],
      ['Установка балконного блока ПВХ', Unit.PIECE, 5400],
      ['Установка входной двери металлической', Unit.PIECE, 4800],
      ['Установка межкомнатной двери', Unit.PIECE, 1850],
      ['Установка раздвижной двери-купе', Unit.PIECE, 3200],
      ['Монтаж откосов пластиковых', Unit.METER, 280],
      ['Установка подоконника ПВХ', Unit.METER, 320],
      ['Установка отлива оконного', Unit.METER, 220],
      ['Монтаж москитной сетки', Unit.PIECE, 380],
      ['Установка доводчика дверного', Unit.PIECE, 980],
      ['Установка арочной двери', Unit.PIECE, 5800],
      ['Демонтаж старого окна ПВХ', Unit.PIECE, 680],
      ['Установка французского окна', Unit.PIECE, 6800],
      ['Монтаж тёплого остекления балкона', Unit.SQUARE_METER, 1850],
      ['Установка рольставней алюминиевых', Unit.SQUARE_METER, 1450],
      ['Установка жалюзи горизонтальных', Unit.SQUARE_METER, 580],
      ['Регулировка фурнитуры окна', Unit.PIECE, 320],
    ],
  },
  {
    name: 'Демонтажные работы',
    items: [
      ['Демонтаж кирпичной стены', Unit.SQUARE_METER, 480],
      ['Демонтаж бетонной стены', Unit.SQUARE_METER, 980],
      ['Демонтаж стяжки цементной', Unit.SQUARE_METER, 220],
      ['Демонтаж штукатурки', Unit.SQUARE_METER, 145],
      ['Демонтаж керамической плитки', Unit.SQUARE_METER, 195],
      ['Демонтаж обоев', Unit.SQUARE_METER, 65],
      ['Демонтаж линолеума', Unit.SQUARE_METER, 75],
      ['Демонтаж ламината', Unit.SQUARE_METER, 95],
      ['Демонтаж дверного блока', Unit.PIECE, 380],
      ['Демонтаж оконного блока', Unit.PIECE, 580],
      ['Демонтаж унитаза', Unit.PIECE, 480],
      ['Демонтаж радиатора отопления', Unit.PIECE, 580],
      ['Демонтаж труб водоснабжения', Unit.METER, 95],
      ['Демонтаж труб канализации', Unit.METER, 120],
      ['Демонтаж электропроводки', Unit.METER, 65],
      ['Демонтаж потолка ГКЛ', Unit.SQUARE_METER, 145],
      ['Демонтаж металлочерепицы', Unit.SQUARE_METER, 220],
      ['Демонтаж перекрытия', Unit.SQUARE_METER, 680],
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// СПРАВОЧНИК: КАТЕГОРИИ МАТЕРИАЛОВ (8 шт × 15 расценок)
// ─────────────────────────────────────────────────────────────────────────────
const MATERIAL_CATEGORIES: { name: string; items: WorkItem[] }[] = [
  {
    name: 'Цемент и сухие смеси',
    items: [
      ['Цемент М500 Д0 50кг', Unit.BAG, 480],
      ['Песок строительный мытый', Unit.CUBIC_METER, 980],
      ['Щебень фракции 5-20 мм', Unit.CUBIC_METER, 1450],
      ['Раствор кладочный М200', Unit.CUBIC_METER, 3200],
      ['Бетон М300 B22.5', Unit.CUBIC_METER, 4250],
      ['Гипс строительный Г-7 30кг', Unit.BAG, 380],
      ['Штукатурка гипсовая Knauf 30кг', Unit.BAG, 520],
      ['Шпаклёвка финишная Vetonit 25кг', Unit.BAG, 680],
      ['Клей для плитки Ceresit CM11 25кг', Unit.BAG, 580],
      ['Клей для гипсокартона Perlfix 25кг', Unit.BAG, 520],
      ['Самовыравнивающийся пол Bergauf 25кг', Unit.BAG, 720],
      ['Пескобетон М300 Русеан 40кг', Unit.BAG, 280],
      ['Затирка для плитки Ceresit CE40 2кг', Unit.PACKAGE, 280],
      ['Грунтовка глубокого проникновения 10л', Unit.LITER, 680],
      ['Сухая смесь монтажная 25кг', Unit.BAG, 450],
    ],
  },
  {
    name: 'Металлопрокат',
    items: [
      ['Арматура А500С Ø10 мм', Unit.TON, 58500],
      ['Арматура А500С Ø12 мм', Unit.TON, 58200],
      ['Арматура А500С Ø14 мм', Unit.TON, 58000],
      ['Арматура А500С Ø16 мм', Unit.TON, 57800],
      ['Арматура А500С Ø20 мм', Unit.TON, 57500],
      ['Прокат листовой горячекатаный 3мм', Unit.SQUARE_METER, 1450],
      ['Прокат листовой горячекатаный 4мм', Unit.SQUARE_METER, 1850],
      ['Уголок стальной 50×50×5', Unit.METER, 380],
      ['Уголок стальной 75×75×6', Unit.METER, 580],
      ['Швеллер 12П стальной', Unit.METER, 880],
      ['Швеллер 16П стальной', Unit.METER, 1280],
      ['Труба профильная 40×20×2', Unit.METER, 280],
      ['Труба профильная 60×40×2', Unit.METER, 380],
      ['Труба профильная 100×100×3', Unit.METER, 880],
      ['Сетка кладочная 50×50 Ø4', Unit.SQUARE_METER, 145],
    ],
  },
  {
    name: 'Пиломатериалы',
    items: [
      ['Брус 100×100×6м сосна', Unit.PIECE, 980],
      ['Брус 150×150×6м сосна', Unit.PIECE, 1850],
      ['Брус 200×200×6м сосна', Unit.PIECE, 3200],
      ['Доска 50×150×6м обрезная', Unit.PIECE, 1450],
      ['Доска 40×150×6м обрезная', Unit.PIECE, 1180],
      ['Доска 25×150×6м обрезная', Unit.PIECE, 780],
      ['Доска 50×200×6м обрезная', Unit.PIECE, 1850],
      ['Вагонка сосновая 14×90', Unit.SQUARE_METER, 380],
      ['Имитация бруса 18×145', Unit.SQUARE_METER, 520],
      ['Блок-хаус 36×190', Unit.SQUARE_METER, 680],
      ['Плита ОСП-3 9мм 2500×1250', Unit.PIECE, 980],
      ['Плита ОСП-3 12мм 2500×1250', Unit.PIECE, 1280],
      ['Фанера ФК 1525×1525 9мм', Unit.PIECE, 980],
      ['Рейка 20×40×3м сосна', Unit.METER, 65],
      ['Брусок 50×50×3м сосна', Unit.METER, 95],
    ],
  },
  {
    name: 'Кровельные материалы',
    items: [
      ['Металлочерепица Montecristo 0.5мм', Unit.SQUARE_METER, 580],
      ['Профнастил С21 0.5мм', Unit.SQUARE_METER, 480],
      ['Гибкая черепица Shinglas', Unit.SQUARE_METER, 380],
      ['Фальцевая кровля 0.5мм', Unit.SQUARE_METER, 720],
      ['Рубероид РКП-350', Unit.PACKAGE, 380],
      ['Ондулин 1.95×0.95', Unit.PIECE, 480],
      ['Конёк кровельный 2м', Unit.METER, 320],
      ['Ендова нижняя 2м', Unit.METER, 380],
      ['Ендова верхняя 2м', Unit.METER, 420],
      ['Планка торцевая 2м', Unit.METER, 280],
      ['Планка карнизная 2м', Unit.METER, 280],
      ['Капельник 2м', Unit.METER, 220],
      ['Снегозадержатель трубчатый 3м', Unit.METER, 680],
      ['Плёнка пароизоляционная Изоспан D', Unit.SQUARE_METER, 45],
      ['Мембрана ветрозащитная Изоспан A', Unit.SQUARE_METER, 52],
    ],
  },
  {
    name: 'Утеплители и изоляция',
    items: [
      ['Минвата Rockwool Лайт Баттс 50мм', Unit.SQUARE_METER, 220],
      ['Минвата Rockwool Лайт Баттс 100мм', Unit.SQUARE_METER, 380],
      ['Пенопласт ПСБ-С-25 50мм', Unit.SQUARE_METER, 145],
      ['Экструдированный пенополистирол 50мм', Unit.SQUARE_METER, 320],
      ['Экструдированный пенополистирол 100мм', Unit.SQUARE_METER, 580],
      ['Пеноплэкс Комфорт 50мм', Unit.SQUARE_METER, 320],
      ['Стекловата Isover Теплый Дом 50мм', Unit.SQUARE_METER, 145],
      ['Фольгированный пенофол 5мм', Unit.SQUARE_METER, 95],
      ['Лента демпферная 100мм', Unit.METER, 65],
      ['Теплоизоляция для труб Energoflex 18мм', Unit.METER, 45],
      ['Гидроизоляция мембрана Техноэласт', Unit.SQUARE_METER, 280],
      ['Плёнка гидроизоляционная Изоспан B', Unit.SQUARE_METER, 48],
      ['Лента пароизоляционная двусторонняя', Unit.METER, 65],
      ['Праймер битумный 20л', Unit.LITER, 1450],
      ['Мастика битумная кровельная 20кг', Unit.KILOGRAM, 1280],
    ],
  },
  {
    name: 'Сантехника',
    items: [
      ['Труба полипропилен PN20 20мм', Unit.METER, 65],
      ['Труба полипропилен PN20 25мм', Unit.METER, 95],
      ['Труба ПВХ канализационная 110мм', Unit.METER, 280],
      ['Труба ПВХ канализационная 50мм', Unit.METER, 145],
      ['Труба металлопластиковая 16мм', Unit.METER, 75],
      ['Радиатор алюминиевый 10 секций', Unit.PIECE, 2800],
      ['Котёл газовый настенный 24кВт', Unit.PIECE, 28500],
      ['Водонагреватель накопительный 80л', Unit.PIECE, 9800],
      ['Коллектор распределительный на 3 выхода', Unit.PIECE, 1850],
      ['Смеситель для раковины однорычажный', Unit.PIECE, 1450],
      ['Ванна акриловая 170см', Unit.PIECE, 8500],
      ['Душевая кабина 90×90', Unit.PIECE, 18500],
      ['Унитаз-компакт Roca', Unit.PIECE, 5800],
      ['Раковина керамическая 60см', Unit.PIECE, 1850],
      ['Фильтр для воды 3-ступенчатый', Unit.PIECE, 2400],
    ],
  },
  {
    name: 'Электрика',
    items: [
      ['Кабель ВВГнг-LS 3×1.5', Unit.METER, 38],
      ['Кабель ВВГнг-LS 3×2.5', Unit.METER, 58],
      ['Кабель ВВГнг-LS 3×4', Unit.METER, 95],
      ['Кабель ВВГнг-LS 3×6', Unit.METER, 145],
      ['Кабель ВВГнг-LS 5×2.5', Unit.METER, 95],
      ['Розетка встроенная Legrand', Unit.PIECE, 280],
      ['Выключатель встроенный Legrand', Unit.PIECE, 220],
      ['Коробка распределительная 100×100', Unit.PIECE, 65],
      ['Автомат ABB 16А 1P', Unit.PIECE, 280],
      ['Автомат ABB 25А 1P', Unit.PIECE, 320],
      ['УЗО ABB 25А 30mA 2P', Unit.PIECE, 980],
      ['Светильник точечный LED Gauss', Unit.PIECE, 280],
      ['Труба гофрированная ПВХ 20мм', Unit.METER, 28],
      ['Дифавтомат ABB 16А 30mA 1P+N', Unit.PIECE, 1280],
      ['Силовой щит IEK 12 групп', Unit.PIECE, 1850],
    ],
  },
  {
    name: 'Крепёж и метизы',
    items: [
      ['Саморез по дереву 3.5×35 200шт', Unit.PACKAGE, 220],
      ['Саморез по металлу 3.5×25 200шт', Unit.PACKAGE, 240],
      ['Саморез кровельный 4.8×35 250шт', Unit.PACKAGE, 580],
      ['Дюбель-гвоздь 6×40 200шт', Unit.PACKAGE, 180],
      ['Анкер клиновой 10×100', Unit.PIECE, 38],
      ['Анкер химический Fischer 300мл', Unit.PIECE, 980],
      ['Болт М8 DIN933 гайка+шайба', Unit.PIECE, 28],
      ['Болт М10 DIN933 гайка+шайба', Unit.PIECE, 38],
      ['Гвозди строительные 90мм', Unit.KILOGRAM, 145],
      ['Гвозди строительные 120мм', Unit.KILOGRAM, 145],
      ['Перфорированная лента оцинкованная 20м', Unit.METER, 38],
      ['Уголок крепёжный 40×40', Unit.PIECE, 28],
      ['Пластина монтажная 80×40', Unit.PIECE, 22],
      ['Шпилька резьбовая М10 1м', Unit.METER, 145],
      ['Шуруп универсальный 5×60 100шт', Unit.PACKAGE, 220],
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('→ Seed started');

  // 1. Пользователь foreman@frame.app / frame123 (хэш как в auth.service: bcrypt@10)
  const passwordHash = await bcrypt.hash('frame123', 10);
  await prisma.user.upsert({
    where: { email: 'foreman@frame.app' },
    update: { password: passwordHash },
    create: {
      email: 'foreman@frame.app',
      phone: '+79990000000',
      password: passwordHash,
      fullName: 'Прораб Демо',
      role: Role.FOREMAN,
    },
  });
  console.log('  ✓ User foreman@frame.app');

  // 1.5. Организация и membership (мульти-тенантность)
  // findFirst вместо upsert: Organization.name НЕ @unique в схеме
  let org = await prisma.organization.findFirst({
    where: { name: `${SEED_TAG} Demo Org` },
  });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: `${SEED_TAG} Demo Org` },
    });
  }
  const foreman = await prisma.user.findUnique({ where: { email: 'foreman@frame.app' } });
  await prisma.orgMembership.upsert({
    where: { userId_orgId: { userId: foreman!.id, orgId: org.id } },
    update: { role: OrgRole.OWNER },
    create: {
      userId: foreman!.id,
      orgId: org.id,
      role: OrgRole.OWNER,
    },
  });
  console.log(`  ✓ Org id=${org.id}, membership OWNER`);

  // 2. Очистка старых seed-данных (идемпотентность). Сначала фиксации, потом

  // 2. Очистка старых seed-данных (идемпотентность). Сначала фиксации, потом
  //    материалы (FK), затем проекты/объекты/расценки/категории.
  await prisma.$transaction([
    prisma.materialFix.deleteMany({}),
    prisma.material.deleteMany({ where: { note: { startsWith: SEED_TAG } } }),
    prisma.project.deleteMany({ where: { name: { startsWith: SEED_TAG } } }),
    prisma.object.deleteMany({ where: { name: { startsWith: SEED_TAG } } }),
    prisma.priceItem.deleteMany({ where: { article: { startsWith: SEED_ART } } }),
    prisma.priceCategory.deleteMany({ where: { name: { startsWith: SEED_TAG } } }),
  ]);
  console.log('  ✓ Old seed data cleared');

  // 3. Категории работ + расценки (10 категорий × 18-20)
  const workCategoryIds: number[] = [];
  for (let i = 0; i < WORK_CATEGORIES.length; i++) {
    const cat = WORK_CATEGORIES[i];
      const created = await prisma.priceCategory.create({
        data: {
          name: `${SEED_TAG} ${cat.name}`,
          kind: PriceKind.WORK,
          sortOrder: i,
          orgId: org.id,
        },
      });
      workCategoryIds.push(created.id);

    for (let j = 0; j < cat.items.length; j++) {
      const [name, unit, price] = cat.items[j];
      await prisma.priceItem.create({
        data: {
          name,
          kind: PriceKind.WORK,
          unit,
          price,
          categoryId: created.id,
          article: `${SEED_ART}W-${String(i + 1).padStart(2, '0')}-${String(j + 1).padStart(3, '0')}`,
          isActive: true,
          orgId: org.id,
        },
      });
    }
  }
  console.log(
    `  ✓ WORK: ${WORK_CATEGORIES.length} categories, ${WORK_CATEGORIES.reduce((s, c) => s + c.items.length, 0)} items`,
  );

  // 4. Категории материалов + расценки (8 × 15)
  const materialCategoryIds: number[] = [];
  for (let i = 0; i < MATERIAL_CATEGORIES.length; i++) {
    const cat = MATERIAL_CATEGORIES[i];
      const created = await prisma.priceCategory.create({
        data: {
          name: `${SEED_TAG} ${cat.name}`,
          kind: PriceKind.MATERIAL,
          sortOrder: i,
          orgId: org.id,
        },
      });
      materialCategoryIds.push(created.id);

    for (let j = 0; j < cat.items.length; j++) {
      const [name, unit, price] = cat.items[j];
      await prisma.priceItem.create({
        data: {
          name,
          kind: PriceKind.MATERIAL,
          unit,
          price,
          categoryId: created.id,
          article: `${SEED_ART}M-${String(i + 1).padStart(2, '0')}-${String(j + 1).padStart(3, '0')}`,
          isActive: true,
          orgId: org.id,
        },
      });
    }
  }
  console.log(
    `  ✓ MATERIAL: ${MATERIAL_CATEGORIES.length} categories, ${MATERIAL_CATEGORIES.reduce((s, c) => s + c.items.length, 0)} items`,
  );

  // 5. Один объект. today-based даты — стабильны при повторных запусках.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const plus = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d;
  };

  const obj = await prisma.object.create({
    data: {
      name: `${SEED_TAG} Жилой комплекс «Лесная поляна»`,
      address: 'г. Самара, ул. Лесная, д. 12',
      startDate: plus(-30),
      endDate: plus(120),
      note: 'Демо-объект для проверки дашборда',
      orgId: org.id,
    },
  });
  console.log(`  ✓ Object id=${obj.id}`);

  // 6. Два проекта. Project #1 — hot (endDate = сегодня+5, ≤ +7).
  const project1 = await prisma.project.create({
    data: {
      name: `${SEED_TAG} Секция А — монолит`,
      startDate: plus(-20),
      endDate: plus(5), // hot: попадёт в hotProjects
      objectId: obj.id,
      note: 'Монолитные работы, закрытие через 5 дней',
    },
  });
  const project2 = await prisma.project.create({
    data: {
      name: `${SEED_TAG} Секция Б — отделка`,
      startDate: plus(-10),
      endDate: plus(60), // не hot
      objectId: obj.id,
      note: 'Отделочные работы, не срочный',
    },
  });
  console.log(`  ✓ Projects id=${project1.id} (hot), id=${project2.id}`);

  // 7. Достаём по 6 расценок каждого вида — на них повесим 12 материалов.
  const workItems = await prisma.priceItem.findMany({
    where: { kind: PriceKind.WORK, article: { startsWith: `${SEED_ART}W-` } },
    orderBy: { id: 'asc' },
    take: 6,
  });
  const matItems = await prisma.priceItem.findMany({
    where: { kind: PriceKind.MATERIAL, article: { startsWith: `${SEED_ART}M-` } },
    orderBy: { id: 'asc' },
    take: 6,
  });
  if (workItems.length < 6 || matItems.length < 6) {
    throw new Error('Недостаточно расценок для создания материалов');
  }

  // 8. 12 материалов. Каждый с work-price И material-price.
  //    specQuantity, unitPrice/materialUnitPrice — snapshot из расценок.
  //    У первых 6 будут фиксации (см. ниже).
  const materialsData: {
    name: string;
    projectId: number;
    workItem: (typeof workItems)[number];
    materialItem: (typeof matItems)[number];
    specQuantity: number;
  }[] = [
    { name: `${SEED_TAG} Фундаментная плита`, projectId: project1.id, workItem: workItems[0], materialItem: matItems[0], specQuantity: 120 },
    { name: `${SEED_TAG} Армирование ленты`, projectId: project1.id, workItem: workItems[1], materialItem: matItems[1], specQuantity: 45 },
    { name: `${SEED_TAG} Бетонирование колонн`, projectId: project1.id, workItem: workItems[2], materialItem: matItems[2], specQuantity: 18 },
    { name: `${SEED_TAG} Кладка несущих стен`, projectId: project1.id, workItem: workItems[3], materialItem: matItems[3], specQuantity: 320 },
    { name: `${SEED_TAG} Перегородки газобетон`, projectId: project1.id, workItem: workItems[4], materialItem: matItems[4], specQuantity: 480 },
    { name: `${SEED_TAG} Армопояс монолитный`, projectId: project1.id, workItem: workItems[5], materialItem: matItems[5], specQuantity: 65 },
    { name: `${SEED_TAG} Стяжка пола`, projectId: project2.id, workItem: workItems[0], materialItem: matItems[0], specQuantity: 240 },
    { name: `${SEED_TAG} Штукатурка стен`, projectId: project2.id, workItem: workItems[1], materialItem: matItems[1], specQuantity: 540 },
    { name: `${SEED_TAG} Керамическая плитка`, projectId: project2.id, workItem: workItems[2], materialItem: matItems[2], specQuantity: 180 },
    { name: `${SEED_TAG} Ламинат на пол`, projectId: project2.id, workItem: workItems[3], materialItem: matItems[3], specQuantity: 220 },
    { name: `${SEED_TAG} Покраска стен`, projectId: project2.id, workItem: workItems[4], materialItem: matItems[4], specQuantity: 360 },
    { name: `${SEED_TAG} Натяжной потолок`, projectId: project2.id, workItem: workItems[5], materialItem: matItems[5], specQuantity: 280 },
  ];

  // 9. Создаём материалы; для первых 6 — суммарно и фиксации за последние 7 дней.
  //    Каждый материал в своей транзакции, чтобы при ошибке один не ломал всех.
  for (let i = 0; i < materialsData.length; i++) {
    const md = materialsData[i];
    const unitPrice = md.workItem.price;
    const materialUnitPrice = md.materialItem.price;

    const willHaveFixes = i < 6; // первые 6 с фиксациями
    let totalUsed = 0;

    // Список фиксаций для этого материала
    const fixes: { amount: number; fixedAt: Date; note: string }[] = [];
    if (willHaveFixes) {
      const plan = [
        { amount: md.specQuantity * 0.15, offset: -6, note: 'Первая фиксация (бригада 1)' },
        { amount: md.specQuantity * 0.20, offset: -4, note: 'Вторая фиксация (бригада 2)' },
        { amount: md.specQuantity * 0.10, offset: -2, note: 'Третья фиксация (контроль)' },
      ];
      for (const p of plan) {
        const fixedAt = plus(p.offset);
        fixedAt.setHours(9 + (i % 8), (i * 13) % 60, 0, 0); // разнообразим время
        fixes.push({ amount: Math.round(p.amount * 100) / 100, fixedAt, note: p.note });
        totalUsed += Math.round(p.amount * 100) / 100;
      }
      totalUsed = Math.round(totalUsed * 100) / 100;
    }

    const totalCost = Math.round(totalUsed * unitPrice * 100) / 100;
    const materialTotalCost = Math.round(totalUsed * materialUnitPrice * 100) / 100;
    const progressPercent = md.specQuantity > 0 ? Math.round((totalUsed / md.specQuantity) * 10000) / 100 : 0;
    const lastEntryDate = fixes.length ? fixes[fixes.length - 1].fixedAt : null;
    const lastEntry = fixes.length ? fixes[fixes.length - 1].amount : null;

    const material = await prisma.material.create({
      data: {
        name: md.name,
        unit: md.workItem.unit,
        specQuantity: md.specQuantity,
        totalUsed,
        lastEntry,
        lastEntryDate,
        note: `${SEED_TAG} demo material`,
        progressPercent,
        isSpecLocked: true,
        priceItemId: md.workItem.id,
        unitPrice,
        totalCost,
        materialItemId: md.materialItem.id,
        materialUnitPrice,
        materialTotalCost,
        projectId: md.projectId,
      },
    });

    if (fixes.length) {
      await prisma.materialFix.createMany({
        data: fixes.map((f) => ({
          materialId: material.id,
          amount: f.amount,
          note: f.note,
          fixedAt: f.fixedAt,
          isEdited: false,
        })),
      });
    }
  }
  console.log(`  ✓ 12 materials created (6 with fixes in last 7 days)`);

  console.log('→ Seed done');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
