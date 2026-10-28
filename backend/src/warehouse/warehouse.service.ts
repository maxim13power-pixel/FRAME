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
import { AccessRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertAccessActive,
  findLiveAccess,
  findProjectAccess,
} from '../auth/access-scope'; // ⭐ №193 (A₂ F1)
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
    const access = await findLiveAccess(this.prisma, {
      userId,
      objectId,
      projectId: null,
    });
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    assertAccessActive(access); // ⭐ №193 (A₂ F1): отозванный доступ живых данных не читает
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
    const access = await findProjectAccess(
      this.prisma,
      userId,
      project.objectId,
      projectId,
    );
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому проекту');
    }
    assertAccessActive(access); // ⭐ №193 (A₂ F1)
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

  // ─── ⭐ №180: наблюдатель и отозванный доступ — только чтение ───
  // Та же логика, что в projects/brigades: без неё VIEWER и отозванный
  // создавали/правили/удаляли складские позиции и проводили списания.
  private assertWritable(
    access: { role?: AccessRole | string; revokedAt?: Date | null },
    action: string,
  ) {
    if (access.revokedAt) {
      throw new ForbiddenException(
        `Доступ отозван: ${action} недоступно. Склад открыт только на чтение.`,
      );
    }
    if (access.role === AccessRole.VIEWER) {
      throw new ForbiddenException(`Наблюдатель не может ${action}`);
    }
  }

  // «Общая» позиция (objectId = null) не имеет записи доступа: писать может тот,
  // у кого есть хотя бы один активный объектный доступ с правами записи.
  private async assertAnyWritable(userId: number, action: string) {
    const grants = await this.prisma.objectAccess.findMany({
      where: { userId, projectId: null, revokedAt: null },
      select: { role: true },
    });
    if (!grants.some((g) => g.role !== AccessRole.VIEWER)) {
      throw new ForbiddenException(
        `Наблюдатель не может ${action}: нужен доступ к объекту с правами записи`,
      );
    }
  }

  private async assertItemWritable(
    item: { objectId: number | null },
    userId: number,
    action: string,
  ) {
    if (item.objectId == null) {
      await this.assertAnyWritable(userId, action);
      return;
    }
    this.assertWritable(
      await this.checkObjectAccess(item.objectId, userId),
      action,
    );
  }

  // ─── Список позиций (фильтр ?objectId=X, ?search=Y) ───
  async list(userId: number, objectId?: number, search?: string) {
    const where: Prisma.WarehouseItemWhereInput = {};

    if (objectId != null && !Number.isNaN(objectId)) {
      await this.checkObjectAccess(objectId, userId);
      where.objectId = objectId;
    } else {
      // ⭐ №193 (A₂ F1): отозванные объекты в склад не попадают.
      const accesses = await this.prisma.objectAccess.findMany({
        where: { userId, projectId: null, revokedAt: null },
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
      this.assertWritable(
        await this.checkObjectAccess(dto.objectId, userId),
        'создавать позицию склада',
      );
    } else {
      await this.assertAnyWritable(userId, 'создавать общую позицию склада');
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
    const item = await this.checkItemAccess(id, userId);
    await this.assertItemWritable(item, userId, 'изменять позицию склада');
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
    const item = await this.checkItemAccess(id, userId);
    await this.assertItemWritable(item, userId, 'удалять позицию склада');
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
    const item = await this.checkItemAccess(dto.warehouseItemId, userId);
    await this.assertItemWritable(item, userId, 'проводить операции по складу');
    if (isOutcome) {
      this.assertWritable(
        await this.checkProjectAccess(dto.projectId as number, userId),
        'списывать материалы',
      );
    }

    // ⭐ $transaction: атомарное изменение остатка (гонка исключена).
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.warehouseItem.findUnique({
        where: { id: dto.warehouseItemId },
        select: { id: true },
      });
      if (!current) {
        throw new NotFoundException('Позиция склада не найдена');
      }

      if (isOutcome) {
        // ⭐ Условный декремент: списываем ТОЛЬКО если остатка хватает.
        // updateMany с WHERE quantity >= dto.quantity атомарен — под ReadCommitted
        // два параллельных списания не уйдут в минус (второй получит count = 0).
        const res = await tx.warehouseItem.updateMany({
          where: { id: dto.warehouseItemId, quantity: { gte: dto.quantity } },
          data: { quantity: { decrement: dto.quantity } },
        });
        if (res.count !== 1) {
          throw new BadRequestException(
            'Нельзя списать больше, чем есть на складе',
          );
        }
      } else {
        await tx.warehouseItem.update({
          where: { id: dto.warehouseItemId },
          data: { quantity: { increment: dto.quantity } },
        });
      }

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
      // ⭐ №193 (A₂ F1): история операций — только по активным объектам.
      const accesses = await this.prisma.objectAccess.findMany({
        where: { userId, projectId: null, revokedAt: null },
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
