// backend/src/warehouse/warehouse.service.ts
// ⭐ Раздел «Склад»: учёт материалов/оборудования прораба.
// Позиция может быть привязана к объекту (objectId) или «общей» (objectId = null).
// Доступ: только к своим объектам (ObjectAccess, object-уровень projectId = null).
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseItemDto } from './dto/create-warehouse-item.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateWarehouseItemDto } from './dto/update-warehouse-item.dto';

const TRANSACTION_TYPES = ['income', 'expense', 'write-off'] as const;

const ITEM_INCLUDE = {
  object: { select: { id: true, name: true } },
} satisfies Prisma.WarehouseItemInclude;

@Injectable()
export class WarehouseService {
  constructor(private prisma: PrismaService) {}

  // ─── Доступ к ОБЪЕКТУ (object-уровень, projectId = null — как в access.service) ───
  private async checkObjectAccess(objectId: number, userId: number) {
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId, projectId: null },
    });
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    return access;
  }

  // ─── Доступ к ПРОЕКТУ (проектный или объектный уровень) ───
  private async checkProjectAccess(projectId: number, userId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    const access =
      (await this.prisma.objectAccess.findFirst({
        where: { userId, objectId: project.objectId, projectId },
      })) ??
      (await this.prisma.objectAccess.findFirst({
        where: { userId, objectId: project.objectId, projectId: null },
      }));
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому проекту');
    }
    return access;
  }

  // ─── Доступ к ПОЗИЦИИ склада (objectId = null — общая; иначе проверяем объект) ───
  private async checkItemAccess(itemId: number, userId: number) {
    const item = await this.prisma.warehouseItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException('Позиция склада не найдена');
    }
    if (item.objectId != null) {
      await this.checkObjectAccess(item.objectId, userId);
    }
    return item;
  }

  // ─── Список позиций (фильтр ?objectId=X, ?search=Y) ───
  async list(userId: number, objectId?: number, search?: string) {
    const where: Prisma.WarehouseItemWhereInput = {};

    if (objectId != null && !Number.isNaN(objectId)) {
      await this.checkObjectAccess(objectId, userId);
      where.objectId = objectId;
    } else {
      const accesses = await this.prisma.objectAccess.findMany({
        where: { userId, projectId: null },
        select: { objectId: true },
      });
      const ids = accesses.map((a) => a.objectId);
      where.OR = [{ objectId: null }, { objectId: { in: ids } }];
    }

    if (search && search.trim()) {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    return this.prisma.warehouseItem.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: ITEM_INCLUDE,
    });
  }

  // ─── Детальная позиция + последние 20 операций ───
  async detail(userId: number, id: number) {
    const item = await this.checkItemAccess(id, userId);
    const transactions = await this.prisma.warehouseTransaction.findMany({
      where: { warehouseItemId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { project: { select: { id: true, name: true } } },
    });
    return { ...item, transactions };
  }

  // ─── Создать позицию ───
  async create(userId: number, dto: CreateWarehouseItemDto) {
    if (dto.objectId != null) {
      await this.checkObjectAccess(dto.objectId, userId);
    }
    return this.prisma.warehouseItem.create({
      data: {
        name: dto.name.trim(),
        unit: dto.unit?.trim() || 'шт',
        category: dto.category?.trim() || null,
        quantity: dto.quantity ?? 0,
        price: dto.price ?? null,
        comment: dto.comment?.trim() || null,
        objectId: dto.objectId ?? null,
      },
      include: ITEM_INCLUDE,
    });
  }

  // ─── Редактировать (name/unit/category/comment; quantity — только операциями) ───
  async update(userId: number, id: number, dto: UpdateWarehouseItemDto) {
    await this.checkItemAccess(id, userId);
    return this.prisma.warehouseItem.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        unit: dto.unit !== undefined ? dto.unit.trim() : undefined,
        category:
          dto.category !== undefined ? dto.category.trim() || null : undefined,
        comment:
          dto.comment !== undefined ? dto.comment.trim() || null : undefined,
      },
      include: ITEM_INCLUDE,
    });
  }

  // ─── Удалить позицию (реально; операции каскадно onDelete: Cascade) ───
  async remove(userId: number, id: number) {
    await this.checkItemAccess(id, userId);
    await this.prisma.warehouseItem.delete({ where: { id } });
    return { success: true };
  }

  // ─── Операция (приход/расход/списание) — атомарно меняет quantity ───
  async createTransaction(userId: number, dto: CreateTransactionDto) {
    const type = dto.type;
    if (
      !TRANSACTION_TYPES.includes(type as (typeof TRANSACTION_TYPES)[number])
    ) {
      throw new BadRequestException('type: income / expense / write-off');
    }
    if (dto.quantity <= 0) {
      throw new BadRequestException('quantity: должно быть больше 0');
    }

    const isOutcome = type === 'expense' || type === 'write-off';
    if (isOutcome && dto.projectId == null) {
      throw new BadRequestException('projectId: обязателен для списания');
    }

    // Проверка доступа к позиции и (для списания) к проекту
    await this.checkItemAccess(dto.warehouseItemId, userId);
    if (isOutcome) {
      await this.checkProjectAccess(dto.projectId as number, userId);
    }

    const delta = type === 'income' ? dto.quantity : -dto.quantity;

    // ⭐ $transaction: перечитываем остаток и списываем атомарно
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.warehouseItem.findUnique({
        where: { id: dto.warehouseItemId },
      });
      if (!current) {
        throw new NotFoundException('Позиция склада не найдена');
      }
      if (isOutcome && Number(current.quantity) < dto.quantity) {
        throw new BadRequestException(
          'Нельзя списать больше, чем есть на складе',
        );
      }

      await tx.warehouseItem.update({
        where: { id: dto.warehouseItemId },
        data: { quantity: { increment: delta } },
      });

      return tx.warehouseTransaction.create({
        data: {
          warehouseItemId: dto.warehouseItemId,
          type,
          quantity: dto.quantity,
          price: dto.price ?? null,
          projectId: isOutcome ? (dto.projectId as number) : null,
          comment: dto.comment?.trim() || null,
          createdBy: userId,
        },
      });
    });
  }

  // ─── История операций (?itemId=X) ───
  async listTransactions(userId: number, itemId?: number) {
    const where: Prisma.WarehouseTransactionWhereInput = {};

    if (itemId != null && !Number.isNaN(itemId)) {
      await this.checkItemAccess(itemId, userId);
      where.warehouseItemId = itemId;
    } else {
      const accesses = await this.prisma.objectAccess.findMany({
        where: { userId, projectId: null },
        select: { objectId: true },
      });
      const ids = accesses.map((a) => a.objectId);
      const items = await this.prisma.warehouseItem.findMany({
        where: { OR: [{ objectId: null }, { objectId: { in: ids } }] },
        select: { id: true },
      });
      where.warehouseItemId = { in: items.map((i) => i.id) };
    }

    return this.prisma.warehouseTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        warehouseItem: { select: { id: true, name: true, unit: true } },
        project: { select: { id: true, name: true } },
      },
    });
  }
}
