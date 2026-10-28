// backend/src/materials/materials.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PriceKind, Unit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service'; // ⭐ №131
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateFixDto } from './dto/create-fix.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { CreatePriceItemDto } from '../price-list/dto/create-price-item.dto';
import { loadCatalogAccess, findVisiblePriceItem } from '../price-list/catalog-access'; // ⭐ №164, №191
import { assertAccessActive, findProjectAccess } from '../auth/access-scope'; // ⭐ №193 (A₂ F1)
import {
  FIX_EDIT_WINDOW_MS,
  FIX_WINDOW_DAYS,
  isFixDateAllowed,
  isValidDateKey,
  normalizeTzOffset,
  resolveFixInstant,
} from './fix-window'; // ⭐ №174

// ⭐ Общий include: расценка работы + расценка материала (с категориями)
const MATERIAL_INCLUDE = {
  priceItem: { include: { category: true } },
  materialItem: { include: { category: true } },
};

/**
 * ⭐ №174: запись доступа к объекту — ровно те поля, которые нужны для скрытия цен.
 * Раньше в методах стояло `let access: any`, из-за чего терялась типизация.
 */
type MaterialAccess = {
  role: string;
  hidePrices: boolean;
  revokedAt: Date | null;
};

@Injectable()
export class MaterialsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService, // ⭐ №131
  ) {}

  // ============================================================
  // ⭐ СКРЫТИЕ ЦЕН (флаг hidePrices + роль VIEWER)
  // ============================================================

  /** Нужно ли скрывать цены для этой записи доступа (без лишнего запроса к БД) */
  private mustHidePrices(
    access?: {
      role?: string;
      hidePrices?: boolean;
      revokedAt?: Date | null;
    } | null,
  ): boolean {
    if (!access) return false;
    // ⭐ №168: отозванный доступ видит только снимок в шаблонах — живые цены скрыты
    if (access.revokedAt) return true;
    // Наблюдатель не видит деньги по определению роли
    if (access.role === 'VIEWER') return true;
    return access.hidePrices ?? false;
  }

  /** Обнулить все ценовые поля материала (для ответа клиенту) */
  private stripPrices<T>(material: T): T {
    const m = material as {
      priceItem?: Record<string, unknown> | null;
      materialItem?: Record<string, unknown> | null;
    } & Record<string, unknown>;
    if (!m) return material;
    return {
      ...m,
      unitPrice: 0,
      totalCost: 0,
      materialUnitPrice: 0,
      materialTotalCost: 0,
      priceItem: m.priceItem ? { ...m.priceItem, price: 0 } : null,
      materialItem: m.materialItem ? { ...m.materialItem, price: 0 } : null,
    } as T;
  }

  /** Проверка: пользователь имеет доступ к объекту проекта */

  // ⭐ Хелпер: проверяет доступ юзера к ОБЪЕКТУ проекта. Кидает 403 если нет.
  private async checkProjectAccess(projectId: number, userId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    // ⭐ №193 (A₂ F1): активная запись приоритетнее отозванной, отозванная — 403.
    const access = await findProjectAccess(
      this.prisma,
      userId,
      project.objectId,
      projectId,
    );
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому проекту');
    }
    assertAccessActive(access);
    return access;
  }

  // ⭐ Хелпер: проверяет доступ юзера к ОБЪЕКТУ материала. Кидает 403 если нет.
  private async checkMaterialAccess(materialId: number, userId: number) {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: {
        projectId: true,
        project: { select: { objectId: true } },
      },
    });
    if (!material) {
      throw new NotFoundException('Материал не найден');
    }
    // ⭐ №193 (A₂ F1): тот же резолв, что у проекта, — с приоритетом активной записи.
    const access = await findProjectAccess(
      this.prisma,
      userId,
      material.project.objectId,
      material.projectId,
    );
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому материалу');
    }
    assertAccessActive(access);
    return access;
  }

  // Все материалы проекта (с обеими расценками)
  async findAllByProject(projectId: number, userId: number) {
    // ⭐ Проверяем доступ к проекту (заодно получаем запись доступа)
    const access = await this.checkProjectAccess(projectId, userId);
    const materials = await this.prisma.material.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
      include: MATERIAL_INCLUDE,
    });
    // ⭐ Скрываем цены для VIEWER и юзеров с флагом hidePrices
    if (this.mustHidePrices(access)) {
      return materials.map((m) => this.stripPrices(m));
    }
    return materials;
  }

  // История фиксаций одного материала
  async findFixes(materialId: number, userId: number) {
    // ⭐ Проверяем доступ к материалу
    await this.checkMaterialAccess(materialId, userId);
    // 🔒 P1-2: tie-break по id — две фиксации могут получить одинаковый fixedAt,
    // без второго ключа порядок на клиенте «прыгает» между запросами.
    return this.prisma.materialFix.findMany({
      where: { materialId },
      orderBy: [{ fixedAt: 'desc' }, { id: 'desc' }],
    });
  }

  // ⭐ №191 (F6): id расценки приходит из body — проверяем, что её справочник доступен.
  // Без этого участник чужого проекта подставлял id закрытой расценки и получал её цену
  // в снапшоте материала (unitPrice / materialUnitPrice).
  private async assertPriceItemsVisible(
    userId: number | undefined,
    ids: (number | undefined)[],
  ) {
    if (!userId) return; // внутренние вызовы без пользователя (seed/demo)
    for (const id of ids) {
      if (id == null) continue;
      const item = await findVisiblePriceItem(this.prisma, id, userId);
      if (!item) throw new NotFoundException('Расценка не найдена');
    }
  }

  // Создание материала (+ snapshot цен работы и материала)
  async create(dto: CreateMaterialDto, userId: number) {
    // ⭐ Проверяем доступ к проекту (заодно получаем запись доступа)
    const access = await this.checkProjectAccess(dto.projectId, userId);
    // 🔒 VIEWER не имеет права создавать материалы
    if (access.role === 'VIEWER') {
      throw new ForbiddenException('Наблюдатель не может создавать материалы');
    }
    let unitPrice = 0;
    if (dto.priceItemId) {
      // ⭐ №191 (F6): расценка берётся только из справочника, который пользователь видит
      const priceItem = await findVisiblePriceItem(
        this.prisma,
        dto.priceItemId,
        userId,
      );
      if (!priceItem) throw new NotFoundException('Расценка не найдена');
      if (!priceItem.isActive)
        throw new BadRequestException('Выбранная расценка неактивна');
      // ⭐ №205: работа и материал не взаимозаменяемы — сверяем PriceKind
      if (priceItem.kind !== 'WORK')
        throw new BadRequestException(
          'В поле «работа» выбрана расценка материала — выберите работу',
        );
      unitPrice = Number(priceItem.price);
    }
    let materialUnitPrice = 0;
    if (dto.materialItemId) {
      const materialItem = await findVisiblePriceItem(
        this.prisma,
        dto.materialItemId,
        userId,
      );
      if (!materialItem)
        throw new NotFoundException('Расценка материала не найдена');
      if (!materialItem.isActive)
        throw new BadRequestException('Расценка материала неактивна');
      // ⭐ №205: в поле материала должна быть расценка материала
      if (materialItem.kind !== 'MATERIAL')
        throw new BadRequestException(
          'В поле «материал» выбрана расценка работы — выберите материал',
        );
      materialUnitPrice = Number(materialItem.price);
    }
    const created = await this.prisma.material.create({
      data: {
        name: dto.name.trim(),
        article: dto.article?.trim() || null,
        unit: (dto.unit ?? 'PIECE') as Unit,
        specQuantity: dto.specQuantity,
        note: dto.note ?? null,
        projectId: dto.projectId,
        priceItemId: dto.priceItemId ?? null,
        unitPrice,
        totalCost: 0,
        materialItemId: dto.materialItemId ?? null,
        materialUnitPrice,
        materialTotalCost: 0,
      },
      include: MATERIAL_INCLUDE,
    });
    // ⭐ Скрываем цены в ответе, если нужно
    return this.mustHidePrices(access) ? this.stripPrices(created) : created;
  }

  // ⭐ Фиксация объёма + пересчёт ОБЕИХ стоимостей
  // 🔒 Race condition fix (аудит 3.2): SELECT ... FOR UPDATE внутри транзакции —
  // две параллельные фиксации сериализуются на строке материала и больше не теряют апдейт.
  // ⭐ №174: в будущее фиксировать нельзя; назад — «сегодня + 3 предыдущих дня».
  async addFix(materialId: number, dto: CreateFixDto, userId?: number | null) {
    // Валидация ДО транзакции: заведомо битый запрос не должен занимать блокировку
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Объём фиксации должен быть больше нуля');
    }
    // ⭐ №174: окно фиксации по календарю устройства клиента
    const now = new Date();
    const tzOffset = normalizeTzOffset(dto.tzOffset);
    if (dto.fixedDate && !isValidDateKey(dto.fixedDate)) {
      throw new BadRequestException(
        'Дата фиксации должна быть в формате ГГГГ-ММ-ДД',
      );
    }
    if (dto.fixedDate && !isFixDateAllowed(dto.fixedDate, now, tzOffset)) {
      throw new BadRequestException(
        `Фиксацию можно внести за сегодня и ${FIX_WINDOW_DAYS} предыдущих дня; в будущее — нельзя`,
      );
    }
    const fixedAt = resolveFixInstant(dto.fixedDate, now, tzOffset);
    // ⭐ Проверка доступа через ObjectAccess (запоминаем access для проверки скрытия цен)
    let access: MaterialAccess | null = null;
    if (userId) {
      access = await this.checkMaterialAccess(materialId, userId);
      // 🔒 VIEWER не имеет права фиксировать объёмы (только смотреть)
      if (access.role === 'VIEWER') {
        throw new ForbiddenException('Наблюдатель не может фиксировать объёмы');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Блокируем строку материала: конкурентный addFix/editLastFix ждёт здесь, а не перезаписывает результат.
      // numeric-колонки Postgres приходят как Prisma.Decimal — поэтому ниже везде Number(...).
      const [material] = await tx.$queryRaw<
        {
          id: number;
          totalUsed: number;
          specQuantity: number;
          unitPrice: number;
          materialUnitPrice: number;
          lastEntryDate: Date | null;
        }[]
      >`SELECT id, "totalUsed", "specQuantity", "unitPrice", "materialUnitPrice", "lastEntryDate" FROM "materials" WHERE id = ${materialId} FOR UPDATE`;

      if (!material) throw new NotFoundException('Материал не найден');

      const newTotal = Number(material.totalUsed) + dto.amount;
      const progress =
        Number(material.specQuantity) > 0
          ? Math.round((newTotal / Number(material.specQuantity)) * 100)
          : 0;

      await tx.materialFix.create({
        data: {
          materialId,
          amount: dto.amount,
          note: dto.note ?? null,
          userId: userId ?? null,
          fixedAt, // ⭐ №174: дата фиксации (сейчас или «задним числом»)
        },
      });

      // ⭐ №174: подпись «последняя фиксация» обновляем только если внесённая
      // действительно самая свежая — иначе фиксация задним числом откатила бы
      // карточку материала на более старую дату.
      const isNewestFix =
        !material.lastEntryDate ||
        fixedAt.getTime() >= new Date(material.lastEntryDate).getTime();

      return tx.material.update({
        where: { id: materialId },
        data: {
          totalUsed: newTotal,
          ...(isNewestFix
            ? { lastEntry: dto.amount, lastEntryDate: fixedAt }
            : {}),
          progressPercent: progress,
          totalCost: newTotal * Number(material.unitPrice),
          materialTotalCost: newTotal * Number(material.materialUnitPrice),
        },
        include: MATERIAL_INCLUDE,
      });
    });

    // ⭐ №131: журнал фиксации объёма
    if (userId) {
      await this.audit.log(
        userId,
        'material_fix',
        materialId,
        'create',
        undefined,
        {
          amount: dto.amount,
          note: dto.note ?? null,
          // ⭐ №174: видно, если фиксация внесена задним числом
          fixedAt: fixedAt.toISOString(),
          ...(dto.fixedDate ? { fixedDate: dto.fixedDate } : {}),
        },
      );
    }

    // ⭐ Скрываем цены для VIEWER / юзеров с hidePrices
    return this.mustHidePrices(access) ? this.stripPrices(updated) : updated;
  }

  // Обновление спеки + пересчёт процента
  async updateSpecQty(id: number, specQuantity: number, userId?: number) {
    // ⭐ Проверка доступа через ObjectAccess (запоминаем access)
    let access: MaterialAccess | null = null;
    if (userId) {
      access = await this.checkMaterialAccess(id, userId);
      // 🔒 VIEWER не имеет права менять спецификацию
      if (access.role === 'VIEWER') {
        throw new ForbiddenException(
          'Наблюдатель не может менять спецификацию',
        );
      }
    }
    // 🔒 P1-2 (гонки): транзакция + SELECT ... FOR UPDATE на строку материала —
    // сериализуемся с addFix / editLastFix / update. Прогресс считаем от
    // ЗАБЛОКИРОВАННОГО totalUsed, а не от значения, прочитанного до транзакции
    // (иначе параллельная фиксация теряется в расчёте — lost update).
    // numeric-колонки Postgres приходят как Prisma.Decimal → ниже везде Number(...).
    const updated = await this.prisma.$transaction(async (tx) => {
      const [material] = await tx.$queryRaw<
        {
          id: number;
          totalUsed: number;
          specQuantity: number;
          isSpecLocked: boolean;
        }[]
      >`SELECT id, "totalUsed", "specQuantity", "isSpecLocked" FROM "materials" WHERE id = ${id} FOR UPDATE`;

      if (!material) throw new NotFoundException('Материал не найден');

      // 🔒 Спецификация заблокирована — менять объём по спеке нельзя (409 Conflict)
      if (material.isSpecLocked) {
        throw new ConflictException('Спецификация заблокирована');
      }

      // ⭐ Пересчёт прогресса от ЗАБЛОКИРОВАННОГО totalUsed
      const totalUsed = Number(material.totalUsed);
      const progress =
        specQuantity > 0 ? Math.round((totalUsed / specQuantity) * 100) : 0;

      return tx.material.update({
        where: { id },
        data: { specQuantity, progressPercent: progress },
        include: MATERIAL_INCLUDE,
      });
    });
    return this.mustHidePrices(access) ? this.stripPrices(updated) : updated;
  }
  // 🔒 Переключение защиты спецификации
  async toggleSpecLock(id: number, userId?: number) {
    // ⭐ Проверка доступа через ObjectAccess (запоминаем access)
    let access: MaterialAccess | null = null;
    if (userId) {
      access = await this.checkMaterialAccess(id, userId);
      // 🔒 VIEWER не имеет права менять защиту спецификации
      if (access.role === 'VIEWER') {
        throw new ForbiddenException(
          'Наблюдатель не может менять защиту спецификации',
        );
      }
    }
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');
    const updated = await this.prisma.material.update({
      where: { id },
      data: { isSpecLocked: !material.isSpecLocked },
      include: MATERIAL_INCLUDE,
    });
    return this.mustHidePrices(access) ? this.stripPrices(updated) : updated;
  }

  // ✏️ Исправление последней фиксации (72 часа)
  // 🔒 Race condition fix (аудит 3.2): «последность» фиксации перепроверяется
  // ВНУТРИ транзакции под блокировкой материала — бригадир не может вклиниться
  // новой фиксацией, пока прораб сохраняет правку.
  async editLastFix(id: number, dto: CreateFixDto, userId?: number | null) {
    // Валидация ДО транзакции
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Объём должен быть больше нуля');
    }

    // ⭐ Проверка доступа через ObjectAccess (запоминаем access)
    let access: MaterialAccess | null = null;
    if (userId) {
      access = await this.checkMaterialAccess(id, userId);
      // 🔒 VIEWER не имеет права редактировать фиксации
      if (access.role === 'VIEWER') {
        throw new ForbiddenException(
          'Наблюдатель не может редактировать фиксации',
        );
      }
    }

    // ⭐ №176: целью правки считаем Последнюю ВНЕСЁННУЮ фиксацию (createdAt),
    // а не с самой поздней датой работ: фиксация задним числом, внесённая только что,
    // раньше не попадала под правку («прошло 8 дней» считалось по fixedAt старой строки).
    const expectedLastFix = await this.prisma.materialFix.findFirst({
      where: { materialId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (!expectedLastFix)
      throw new BadRequestException('У материала ещё нет фиксаций');

    // ⭐ №174: правим по моменту ВНЕСЕНИЯ (createdAt), а не по дате работы:
    // фиксацию за пятницу, внесённую в понедельник, можно исправить до четверга.
    const fixCreatedAt = expectedLastFix.createdAt ?? expectedLastFix.fixedAt;
    const ageMs = Date.now() - fixCreatedAt.getTime();
    if (ageMs > FIX_EDIT_WINDOW_MS) {
      throw new BadRequestException(
        'Исправить можно только фиксацию, внесённую не позже 72 часов назад',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1) Блокируем строку материала — сериализуемся с addFix и параллельным editLastFix
      const [material] = await tx.$queryRaw<
        {
          id: number;
          totalUsed: number;
          specQuantity: number;
          unitPrice: number;
          materialUnitPrice: number;
        }[]
      >`SELECT id, "totalUsed", "specQuantity", "unitPrice", "materialUnitPrice"
          FROM "materials" WHERE id = ${id} FOR UPDATE`;

      if (!material) throw new NotFoundException('Материал не найден');

      // 2) Перепроверяем «последность» уже под блокировкой
      // ⭐ №176: «последняя» = последняя внесённая (createdAt), как и при выборе цели
      const lastFix = await tx.materialFix.findFirst({
        where: { materialId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      if (!lastFix)
        throw new BadRequestException('У материала ещё нет фиксаций');
      if (lastFix.id !== expectedLastFix.id) {
        throw new ConflictException('Появилась более свежая фиксация');
      }

      const newTotal =
        Number(material.totalUsed) - Number(lastFix.amount) + dto.amount;
      const progress =
        Number(material.specQuantity) > 0
          ? Math.round((newTotal / Number(material.specQuantity)) * 100)
          : 0;

      await tx.materialFix.update({
        where: { id: lastFix.id },
        data: {
          amount: dto.amount,
          note: dto.note ?? null,
          userId: userId ?? null,
          isEdited: true,
          editedAt: new Date(),
        },
      });

      // ⭐ №176: правкой теперь может быть фиксация задним числом, поэтому
      // «последнее поступление» на карточке берём из самой поздней ПО ДАТЕ РАБОТ
      // фиксации, а не из только что отредактированной.
      const newestByDate = await tx.materialFix.findFirst({
        where: { materialId: id },
        orderBy: [{ fixedAt: 'desc' }, { id: 'desc' }],
      });

      return tx.material.update({
        where: { id },
        data: {
          totalUsed: newTotal,
          lastEntry: newestByDate ? Number(newestByDate.amount) : dto.amount,
          // 🔒 P1-2: правка фиксации должна обновлять и «когда последняя
          // фиксация» — раньше lastEntry/lastEntryDate оставались от старого значения.
          lastEntryDate: newestByDate?.fixedAt ?? lastFix.fixedAt,
          progressPercent: progress,
          totalCost: newTotal * Number(material.unitPrice),
          materialTotalCost: newTotal * Number(material.materialUnitPrice),
        },
        include: MATERIAL_INCLUDE,
      });
    });
    // ⭐ №131: журнал правки фиксации
    if (userId) {
      await this.audit.log(
        userId,
        'material_fix',
        id,
        'update',
        { amount: Number(expectedLastFix.amount), note: expectedLastFix.note },
        { amount: dto.amount, note: dto.note ?? null },
      );
    }

    // ⭐ Скрываем цены для VIEWER / юзеров с hidePrices
    return this.mustHidePrices(access) ? this.stripPrices(updated) : updated;
  }

  // ✏️ Полное редактирование (смена расценок работы и материала)
  async update(id: number, dto: UpdateMaterialDto, userId?: number) {
    // ⭐ Проверка доступа через ObjectAccess (запоминаем access)
    let access: MaterialAccess | null = null;
    if (userId) {
      access = await this.checkMaterialAccess(id, userId);
      // 🔒 VIEWER не имеет права редактировать материалы
      if (access.role === 'VIEWER') {
        throw new ForbiddenException(
          'Наблюдатель не может редактировать материалы',
        );
      }
      // ⭐ №191 (F6): сменить расценку можно только на видимую в справочнике
      await this.assertPriceItemsVisible(userId, [
        dto.priceItemId === null ? undefined : dto.priceItemId,
        dto.materialItemId === null ? undefined : dto.materialItemId,
      ]);
    }

    // 🔒 P1-2 (гонки): вся логика внутри транзакции с SELECT ... FOR UPDATE на
    // строку материала — сериализуемся с addFix / editLastFix / updateSpecQty.
    // totalCost и materialTotalCost считаем от ЗАБЛОКИРОВАННОГО totalUsed, а не от
    // значения, прочитанного до транзакции (иначе параллельная фиксация «теряется»).
    // numeric-колонки Postgres приходят как Prisma.Decimal → ниже везде Number(...).
    const updated = await this.prisma.$transaction(async (tx) => {
      const [material] = await tx.$queryRaw<
        {
          id: number;
          totalUsed: number;
          specQuantity: number;
          isSpecLocked: boolean;
          priceItemId: number | null;
          unitPrice: number;
          materialItemId: number | null;
          materialUnitPrice: number;
        }[]
      >`SELECT id, "totalUsed", "specQuantity", "isSpecLocked", "priceItemId", "unitPrice", "materialItemId", "materialUnitPrice"
          FROM "materials" WHERE id = ${id} FOR UPDATE`;

      if (!material) throw new NotFoundException('Материал не найден');

      // 🔒 Спецификация заблокирована — менять specQuantity нельзя (409 Conflict).
      // Если клиент прислал то же значение — это не изменение, блокировать не нужно.
      if (
        material.isSpecLocked &&
        dto.specQuantity !== undefined &&
        Number(dto.specQuantity) !== Number(material.specQuantity)
      ) {
        throw new ConflictException('Спецификация заблокирована');
      }

      // Смена расценки РАБОТЫ (сравниваем с заблокированной строкой)
      let unitPrice = Number(material.unitPrice);
      let priceItemId: number | null = material.priceItemId;
      if (
        dto.priceItemId !== undefined &&
        dto.priceItemId !== material.priceItemId
      ) {
        if (dto.priceItemId === null) {
          unitPrice = 0;
          priceItemId = null;
        } else {
          const priceItem = await tx.priceItem.findUnique({
            where: { id: dto.priceItemId },
          });
          if (!priceItem) throw new NotFoundException('Расценка не найдена');
          if (!priceItem.isActive)
            throw new BadRequestException('Расценка неактивна');
          // ⭐ №205: сверяем PriceKind и при правке строки
          if (priceItem.kind !== 'WORK')
            throw new BadRequestException(
              'В поле «работа» выбрана расценка материала — выберите работу',
            );
          unitPrice = Number(priceItem.price);
          priceItemId = priceItem.id;
        }
      }

      // ⭐ Смена расценки МАТЕРИАЛА
      let materialUnitPrice = Number(material.materialUnitPrice);
      let materialItemId: number | null = material.materialItemId;
      if (
        dto.materialItemId !== undefined &&
        dto.materialItemId !== material.materialItemId
      ) {
        if (dto.materialItemId === null) {
          materialUnitPrice = 0;
          materialItemId = null;
        } else {
          const materialItem = await tx.priceItem.findUnique({
            where: { id: dto.materialItemId },
          });
          if (!materialItem)
            throw new NotFoundException('Расценка материала не найдена');
          if (!materialItem.isActive)
            throw new BadRequestException('Расценка материала неактивна');
          // ⭐ №205: в поле материала — только материал
          if (materialItem.kind !== 'MATERIAL')
            throw new BadRequestException(
              'В поле «материал» выбрана расценка работы — выберите материал',
            );
          materialUnitPrice = Number(materialItem.price);
          materialItemId = materialItem.id;
        }
      }

      // ⭐ totalCost / materialTotalCost — от ЗАБЛОКИРОВАННОГО totalUsed
      const totalUsed = Number(material.totalUsed);
      const newSpecQty = dto.specQuantity ?? Number(material.specQuantity);
      const progress =
        newSpecQty > 0 ? Math.round((totalUsed / newSpecQty) * 100) : 0;

      return tx.material.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          article:
            dto.article !== undefined ? dto.article.trim() || null : undefined,
          unit: dto.unit ? (dto.unit as Unit) : undefined,
          note: dto.note !== undefined ? dto.note.trim() || null : undefined,
          specQuantity: dto.specQuantity,
          progressPercent: progress,
          priceItemId,
          unitPrice,
          totalCost: totalUsed * unitPrice,
          materialItemId,
          materialUnitPrice,
          materialTotalCost: totalUsed * materialUnitPrice,
        },
        include: MATERIAL_INCLUDE,
      });
    });
    return this.mustHidePrices(access) ? this.stripPrices(updated) : updated;
  }

  // ⭐ №159/№164: справочник для новой расценки — доступный пользователю
  // (системный, свой, объектный/проектный) и не архивный; писать можно только туда,
  // где есть права (администратор объекта/прораб объекта, владелец, ADMIN).
  private async resolvePriceCatalog(catalogId: number, userId?: number) {
    const access = await loadCatalogAccess(this.prisma, catalogId, userId);
    if (!access || !access.canRead) {
      throw new NotFoundException('Справочник не найден или нет доступа');
    }
    if (access.catalog.isArchived) {
      throw new BadRequestException('Справочник в архиве — выберите активный');
    }
    if (!access.canWrite) {
      throw new ForbiddenException('Нет прав на изменение этого справочника');
    }
    return access.catalog;
  }

  // ✨ Создать расценку (+ опционально новую категорию) в одном запросе
  // ⭐ Новая модель: категории общие (без orgId), расценка → личный справочник (ownerId)
  async createPriceItemWithCategory(
    itemDto: CreatePriceItemDto,
    newCategoryName?: string,
    kind?: string,
    userId?: number,
    catalogId?: number,
  ) {
    // 🔒 Защита от VIEWER: один запрос вместо двух (фикс аудита №60, п.2).
    // Читаем ВСЕ записи доступа юзера: если они есть и ВСЕ роль VIEWER →
    // блокируем. Если записей нет (новый юзер) или есть не-VIEWER → разрешаем.
    if (userId) {
      const accesses = await this.prisma.objectAccess.findMany({
        where: { userId },
        select: { role: true },
      });
      if (accesses.length > 0 && accesses.every((a) => a.role === 'VIEWER')) {
        throw new ForbiddenException('Наблюдатель не может создавать расценки');
      }
    }

    let categoryId = itemDto.categoryId;

    // ⭐ Тип расценки: из параметра, из DTO, или WORK по умолчанию
    const kindValue: PriceKind =
      ((kind ?? itemDto.kind) as PriceKind) || 'WORK';

    if (newCategoryName && newCategoryName.trim()) {
      const existing = await this.prisma.priceCategory.findFirst({
        where: { name: newCategoryName.trim(), kind: kindValue },
      });
      if (existing) {
        categoryId = existing.id; // категория уже есть — используем её
      } else {
        try {
          const created = await this.prisma.priceCategory.create({
            data: {
              name: newCategoryName.trim(),
              sortOrder: 0,
              kind: kindValue,
            },
          });
          categoryId = created.id;
        } catch (e) {
          // 🔒 P2002-retry: два пользователя одновременно создали категорию —
          // второй ловит unique-конфликт, перечитываем и переиспользуем чужую категорию
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            const raced = await this.prisma.priceCategory.findFirst({
              where: { name: newCategoryName.trim(), kind: kindValue },
            });
            if (!raced) throw e;
            categoryId = raced.id;
          } else {
            throw e;
          }
        }
      }
    }

    const category = await this.prisma.priceCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Категория не найдена');

    // ⭐ №151: расценка живёт в справочнике.
    // ⭐ №159: явный catalogId (смета проекта) — пишем в справочник проекта, с проверкой доступа/архива.
    // Без catalogId — прежнее поведение: личный справочник юзера (или системный для внутренних вызовов/сидов).
    const catalog = catalogId
      ? await this.resolvePriceCatalog(catalogId, userId)
      : userId
        ? ((await this.prisma.priceCatalog.findFirst({
            where: { ownerId: userId },
            orderBy: { id: 'asc' },
          })) ??
          (await this.prisma.priceCatalog.create({
            data: { name: 'Личный справочник', ownerId: userId },
          })))
        : ((await this.prisma.priceCatalog.findFirst({
            where: { ownerId: null },
            orderBy: { id: 'asc' },
          })) ??
          (await this.prisma.priceCatalog.create({
            data: { name: 'Демо-справочник', ownerId: null },
          })));

    return this.prisma.priceItem.create({
      data: {
        name: itemDto.name.trim(),
        article: itemDto.article?.trim() || null,
        unit: (itemDto.unit ?? 'PIECE') as Unit,
        price: itemDto.price,
        categoryId,
        kind: kindValue,
        catalogId: catalog.id, // ⭐ №151
        ownerId: catalog.ownerId, // ⭐ владелец = владелец справочника
      },
      include: { category: true },
    });
  }

  // ⭐ №162: копирование строки материала.
  // Копируем только «план» (название, объём, расценки и их снапшоты);
  // факт и фиксации НЕ переносим — новая строка всегда totalUsed = 0.
  async duplicate(id: number, userId: number) {
    const access = await this.checkMaterialAccess(id, userId);
    // 🔒 VIEWER не имеет права создавать материалы
    if (access.role === 'VIEWER') {
      throw new ForbiddenException('Наблюдатель не может копировать материалы');
    }
    const source = await this.prisma.material.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Материал не найден');

    const copy = await this.prisma.material.create({
      data: {
        name: await this.buildCopyName(source.projectId, source.name),
        article: source.article,
        unit: source.unit,
        specQuantity: source.specQuantity,
        note: source.note,
        projectId: source.projectId,
        // снапшоты цен берём из источника: справочник мог измениться с момента создания
        priceItemId: source.priceItemId,
        unitPrice: source.unitPrice,
        totalUsed: 0,
        totalCost: 0,
        materialItemId: source.materialItemId,
        materialUnitPrice: source.materialUnitPrice,
        materialTotalCost: 0,
        isSpecLocked: source.isSpecLocked,
      },
      include: MATERIAL_INCLUDE,
    });
    await this.audit.log(userId, 'material', copy.id, 'create', undefined, {
      name: copy.name,
      copiedFrom: source.id,
    });
    return this.mustHidePrices(access) ? this.stripPrices(copy) : copy;
  }

  /**
   * «Стяжка пола» → «Стяжка пола (копия)», «… (копия)» → «… (копия 2)».
   * ⭐ №174 (б): номер подбираем по уже существующим строкам проекта — иначе двойной
   * клик «Дублировать» давал две строки с одинаковым именем «(копия)».
   */
  private async buildCopyName(
    projectId: number,
    name: string,
  ): Promise<string> {
    const match = name.match(/^(.*) \(копия(?: (\d+))?\)$/);
    const base = match ? match[1] : name;
    const siblings = await this.prisma.material.findMany({
      where: { projectId, name: { startsWith: `${base} (копия` } },
      select: { name: true },
    });
    const taken = new Set(siblings.map((s) => s.name));
    let candidate = `${base} (копия)`;
    let next = 2;
    while (taken.has(candidate)) {
      candidate = `${base} (копия ${next})`;
      next += 1;
    }
    return candidate;
  }

  // Удаление (фиксации удалятся каскадно)
  async remove(id: number, userId?: number) {
    // ⭐ Проверка доступа через ObjectAccess (запоминаем access)
    let access: MaterialAccess | null = null;
    if (userId) {
      access = await this.checkMaterialAccess(id, userId);
      // 🔒 VIEWER не имеет права удалять материалы
      if (access.role === 'VIEWER') {
        throw new ForbiddenException('Наблюдатель не может удалять материалы');
      }
    }

    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');
    const deleted = await this.prisma.material.delete({ where: { id } });
    return this.mustHidePrices(access) ? this.stripPrices(deleted) : deleted;
  }
}
