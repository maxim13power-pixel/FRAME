// backend/src/materials/materials.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PriceKind, Unit } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateFixDto } from './dto/create-fix.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { CreatePriceItemDto } from '../price-list/dto/create-price-item.dto';

// ⭐ Общий include: расценка работы + расценка материала (с категориями)
const MATERIAL_INCLUDE = {
  priceItem: { include: { category: true } },
  materialItem: { include: { category: true } },
};

@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  // ============================================================
  // ⭐ СКРЫТИЕ ЦЕН (флаг hidePrices + роль VIEWER)
  // ============================================================

  /** Нужно ли скрывать цены для этой записи доступа (без лишнего запроса к БД) */
  private mustHidePrices(access?: { role?: string; hidePrices?: boolean } | null): boolean {
    if (!access) return false;
    // Наблюдатель не видит деньги по определению роли
    if (access.role === 'VIEWER') return true;
    return access.hidePrices ?? false;
  }

  /** Обнулить все ценовые поля материала (для ответа клиенту) */
  private stripPrices<T>(material: T): T {
    const m = material as any;
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
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId: project.objectId },
    });
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому проекту');
    }
    return access;
  }

  // ⭐ Хелпер: проверяет доступ юзера к ОБЪЕКТУ материала. Кидает 403 если нет.
  private async checkMaterialAccess(materialId: number, userId: number) {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { project: { select: { objectId: true } } },
    });
    if (!material) {
      throw new NotFoundException('Материал не найден');
    }
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId: material.project.objectId },
    });
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому материалу');
    }
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
    return this.prisma.materialFix.findMany({
      where: { materialId },
      orderBy: { fixedAt: 'desc' },
    });
  }

  // Создание материала (+ snapshot цен работы и материала)
  async create(dto: CreateMaterialDto, userId: number) {
    // ⭐ Проверяем доступ к проекту (заодно получаем запись доступа)
    const access = await this.checkProjectAccess(dto.projectId, userId);

    let unitPrice = 0;
    if (dto.priceItemId) {
      const priceItem = await this.prisma.priceItem.findUnique({ where: { id: dto.priceItemId } });
      if (!priceItem) throw new NotFoundException('Расценка не найдена');
      if (!priceItem.isActive) throw new BadRequestException('Выбранная расценка неактивна');
      unitPrice = priceItem.price;
    }
    let materialUnitPrice = 0;
    if (dto.materialItemId) {
      const materialItem = await this.prisma.priceItem.findUnique({ where: { id: dto.materialItemId } });
      if (!materialItem) throw new NotFoundException('Расценка материала не найдена');
      if (!materialItem.isActive) throw new BadRequestException('Расценка материала неактивна');
      materialUnitPrice = materialItem.price;
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
  async addFix(materialId: number, dto: CreateFixDto, userId?: number | null) {
    // Валидация ДО транзакции: заведомо битый запрос не должен занимать блокировку
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Объём фиксации должен быть больше нуля');
    }
    // ⭐ Проверка доступа через ObjectAccess (запоминаем access для проверки скрытия цен)
    let access: any = null;
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
        { id: number; totalUsed: number; specQuantity: number; unitPrice: number; materialUnitPrice: number }[]
      >`SELECT id, "totalUsed", "specQuantity", "unitPrice", "materialUnitPrice" FROM "materials" WHERE id = ${materialId} FOR UPDATE`;

      if (!material) throw new NotFoundException('Материал не найден');

      const newTotal = Number(material.totalUsed) + dto.amount;
      const progress = Number(material.specQuantity) > 0
        ? Math.round((newTotal / Number(material.specQuantity)) * 100)
        : 0;

      await tx.materialFix.create({
        data: {
          materialId,
          amount: dto.amount,
          note: dto.note ?? null,
          userId: userId ?? null,
        },
      });

      return tx.material.update({
        where: { id: materialId },
        data: {
          totalUsed: newTotal,
          lastEntry: dto.amount,
          lastEntryDate: new Date(),
          progressPercent: progress,
          totalCost: newTotal * Number(material.unitPrice),
          materialTotalCost: newTotal * Number(material.materialUnitPrice),
        },
        include: MATERIAL_INCLUDE,
      });
    });
    // ⭐ Скрываем цены для VIEWER / юзеров с hidePrices
    return this.mustHidePrices(access) ? this.stripPrices(updated) : updated;
  }

  // Обновление спеки + пересчёт процента
  async updateSpecQty(id: number, specQuantity: number, userId?: number) {
    // ⭐ Проверка доступа через ObjectAccess (запоминаем access)
    let access: any = null;
    if (userId) {
      access = await this.checkMaterialAccess(id, userId);
    }
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');
    const progress = specQuantity > 0
      ? Math.round((material.totalUsed / specQuantity) * 100)
      : 0;
    const updated = await this.prisma.material.update({
      where: { id },
      data: { specQuantity, progressPercent: progress },
      include: MATERIAL_INCLUDE,
    });
    return this.mustHidePrices(access) ? this.stripPrices(updated) : updated;
  }
  // 🔒 Переключение защиты спецификации
  async toggleSpecLock(id: number, userId?: number) {
    // ⭐ Проверка доступа через ObjectAccess (запоминаем access)
    let access: any = null;
    if (userId) {
      access = await this.checkMaterialAccess(id, userId);
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
    let access: any = null;
    if (userId) {
      access = await this.checkMaterialAccess(id, userId);
      // 🔒 VIEWER не имеет права редактировать фиксации
      if (access.role === 'VIEWER') {
        throw new ForbiddenException('Наблюдатель не может редактировать фиксации');
      }
    }

    // Фиксация, которую польрузке формы
    const expectedLastFix = await this.prisma.materialFix.findFirst({
      where: { materialId: id },
      orderBy: { fixedAt: 'desc' },
    });
    if (!expectedLastFix) throw new BadRequestException('У материала ещё нет фиксаций');

    const ageMs = Date.now() - expectedLastFix.fixedAt.getTime();
    if (ageMs > 72 * 60 * 60 * 1000) {
      throw new BadRequestException('Исправить можно только фиксацию младше 72 часов');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1) Блокируем строку материала — сериализуемся с addFix и параллельным editLastFix
      const [material] = await tx.$queryRaw<
        { id: number; totalUsed: number; specQuantity: number; unitPrice: number; materialUnitPrice: number }[]
      >`SELECT id, "totalUsed", "specQuantity", "unitPrice", "materialUnitPrice"
          FROM "materials" WHERE id = ${id} FOR UPDATE`;

      if (!material) throw new NotFoundException('Материал не найден');

      // 2) Перепроверяем «последность» уже под блокировкой
      const lastFix = await tx.materialFix.findFirst({
        where: { materialId: id },
        orderBy: { fixedAt: 'desc' },
      });
      if (!lastFix) throw new BadRequestException('У материала ещё нет фиксаций');
      if (lastFix.id !== expectedLastFix.id) {
        throw new ConflictException('Появилась более свежая фиксация');
      }

      const newTotal = Number(material.totalUsed) - Number(lastFix.amount) + dto.amount;
      const progress = Number(material.specQuantity) > 0
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

      return tx.material.update({
        where: { id },
        data: {
          totalUsed: newTotal,
          lastEntry: dto.amount,
          progressPercent: progress,
          totalCost: newTotal * Number(material.unitPrice),
          materialTotalCost: newTotal * Number(material.materialUnitPrice),
        },
        include: MATERIAL_INCLUDE,
      });
    });
    // ⭐ Скрываем цены для VIEWER / юзеров с hidePrices
    return this.mustHidePrices(access) ? this.stripPrices(updated) : updated;
  }

  // ✏️ Полное редактирование (смена расценок работы и материала)
  async update(id: number, dto: UpdateMaterialDto, userId?: number) {
    // ⭐ Проверка доступа через ObjectAccess (запоминаем access)
    let access: any = null;
    if (userId) {
      access = await this.checkMaterialAccess(id, userId);
      // 🔒 VIEWER не имеет права редактировать материалы
      if (access.role === 'VIEWER') {
        throw new ForbiddenException('Наблюдатель не может редактировать материалы');
      }
    }

    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');

    // Смена расценки РАБОТЫ
    let unitPrice = material.unitPrice;
    let priceItemId: number | null = material.priceItemId;
    if (dto.priceItemId !== undefined && dto.priceItemId !== material.priceItemId) {
      if (dto.priceItemId === null) {
        unitPrice = 0;
        priceItemId = null;
      } else {
        const priceItem = await this.prisma.priceItem.findUnique({ where: { id: dto.priceItemId } });
        if (!priceItem) throw new NotFoundException('Расценка не найдена');
        if (!priceItem.isActive) throw new BadRequestException('Расценка неактивна');
        unitPrice = priceItem.price;
        priceItemId = priceItem.id;
      }
    }

    // ⭐ Смена расценки МАТЕРИАЛА
    let materialUnitPrice = material.materialUnitPrice;
    let materialItemId: number | null = material.materialItemId;
    if (dto.materialItemId !== undefined && dto.materialItemId !== material.materialItemId) {
      if (dto.materialItemId === null) {
        materialUnitPrice = 0;
        materialItemId = null;
      } else {
        const materialItem = await this.prisma.priceItem.findUnique({ where: { id: dto.materialItemId } });
        if (!materialItem) throw new NotFoundException('Расценка материала не найдена');
        if (!materialItem.isActive) throw new BadRequestException('Расценка материала неактивна');
        materialUnitPrice = materialItem.price;
        materialItemId = materialItem.id;
      }
    }

    const newSpecQty = dto.specQuantity ?? material.specQuantity;
    const progress = newSpecQty > 0
      ? Math.round((material.totalUsed / newSpecQty) * 100)
      : 0;

  const updated = await this.prisma.material.update({
    where: { id },
    data: {
      name: dto.name?.trim(),
      article: dto.article !== undefined ? dto.article.trim() || null : undefined,
      unit: dto.unit ? (dto.unit as Unit) : undefined,
      note: dto.note !== undefined ? dto.note.trim() || null : undefined,
      specQuantity: dto.specQuantity,
      progressPercent: progress,
      priceItemId,
      unitPrice,
      totalCost: material.totalUsed * unitPrice,
      materialItemId,
      materialUnitPrice,
      materialTotalCost: material.totalUsed * materialUnitPrice,
    },
    include: MATERIAL_INCLUDE,
  });
  return this.mustHidePrices(access) ? this.stripPrices(updated) : updated;
}

  // ✨ Создать расценку (+ опционально новую категорию) в одном запросе
  // ⭐ Новая модель: категории общие (без orgId), расценка → личный справочник (ownerId)
  async createPriceItemWithCategory(
    itemDto: CreatePriceItemDto,
    newCategoryName?: string,
    kind?: string,
    userId?: number,
  ) {
    let categoryId = itemDto.categoryId;

    // ⭐ Тип расценки: из параметра, из DTO, или WORK по умолчанию
    const kindValue: PriceKind = ((kind ?? itemDto.kind) as PriceKind) || 'WORK';

    if (newCategoryName && newCategoryName.trim()) {
      const existing = await this.prisma.priceCategory.findFirst({
        where: { name: newCategoryName.trim(), kind: kindValue },
      });
      if (existing) {
        categoryId = existing.id; // категория уже есть — используем её
      } else {
        try {
          const created = await this.prisma.priceCategory.create({
            data: { name: newCategoryName.trim(), sortOrder: 0, kind: kindValue },
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

    return this.prisma.priceItem.create({
      data: {
        name: itemDto.name.trim(),
        article: itemDto.article?.trim() || null,
        unit: (itemDto.unit ?? 'PIECE') as Unit,
        price: itemDto.price,
        categoryId,
        kind: kindValue,
        ownerId: userId ?? null, // ⭐ личный справочник (ТЗ 3.7)
      },
      include: { category: true },
    });
  }

  // Удаление (фиксации удалятся каскадно)
  async remove(id: number, userId?: number) {
    // ⭐ Проверка доступа через ObjectAccess (запоминаем access)
    let access: any = null;
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
