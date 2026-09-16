// backend/src/change/change.service.ts
// ⭐ P0-6: розовые согласования. Контракт по РЕАЛЬНОЙ схеме:
// ChangeRequest { projectId, materialId?, type: String, payload: Json,
// status, proposedBy, reviewedBy?, reviewComment? } + связи proposer/reviewer.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole, ChangeStatus, Prisma, Unit } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangeTypeEnum, CreateChangeDto } from './dto/create-change.dto';
import { ReviewActionEnum, ReviewChangeDto } from './dto/review-change.dto';

// ⭐ N7: политика одна — предлагать и согласовывать могут прораб и заказчик
const MONEY_ROLES: AccessRole[] = [AccessRole.FOREMAN, AccessRole.CUSTOMER];
// ⭐ Ценовые ключи payload — вырезаются для VIEWER и hidePrices
const PRICE_KEYS = [
  'unitPrice',
  'materialUnitPrice',
  'newUnitPrice',
  'newMaterialUnitPrice',
  'price',
  'totalCost',
  'materialTotalCost',
];
// ⭐ N2: не дублируем enum — единицы берём прямо из Prisma
const UNITS: string[] = Object.values(Unit);

@Injectable()
export class ChangeService {
  constructor(private prisma: PrismaService) {}

  // ─── Доступ с учётом проектного scope (access.projectId) ───
  private async getAccess(userId: number, projectId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    // ⭐ R1: детерминированный выбор строки доступа:
    // сначала проектная (scope), потом общая на объект. Никакого «первого попавшегося».
    const access =
      (await this.prisma.objectAccess.findFirst({
        where: { userId, objectId: project.objectId, projectId },
      })) ??
      (await this.prisma.objectAccess.findFirst({
        where: { userId, objectId: project.objectId, projectId: null },
      }));
    if (!access) {
      // ⭐ W1: 404 вместо 403 — не раскрываем существование чужих проектов
      throw new NotFoundException('Проект не найден');
    }
    return access;
  }

  // ─── Предложить изменение (FOREMAN/CUSTOMER) ───
  async create(userId: number, dto: CreateChangeDto) {
    const access = await this.getAccess(userId, dto.projectId);
    if (!MONEY_ROLES.includes(access.role)) {
      throw new ForbiddenException(
        'Предлагать изменения могут прораб и заказчик',
      );
    }
    // ⭐ IDOR-защита: materialId обязан принадлежать этому проекту
    if (dto.materialId !== undefined) {
      const material = await this.prisma.material.findUnique({
        where: { id: dto.materialId },
        select: { projectId: true },
      });
      if (!material || material.projectId !== dto.projectId) {
        throw new BadRequestException(
          'materialId: материал не найден в этом проекте',
        );
      }
    }
    // ⭐ payload чистим через whitelist: лишние ключи не проскочат
    const payload = this.validatePayload(dto.type, dto.payload, dto.materialId);

    // ⭐ W2+A4: fail-fast — позиции справочника существуют, активны, правильного kind и доступны юзеру
    const itemChecks: Array<{
      key: 'priceItemId' | 'materialItemId';
      kind: 'WORK' | 'MATERIAL';
      label: string;
    }> = [
      { key: 'priceItemId', kind: 'WORK', label: 'работ' },
      { key: 'materialItemId', kind: 'MATERIAL', label: 'материалов' },
    ];
    for (const { key, kind, label } of itemChecks) {
      const itemId = payload[key] as number | undefined;
      if (itemId !== undefined) {
        const item = await this.prisma.priceItem.findFirst({
          where: {
            id: itemId,
            isActive: true,
            kind,
            OR: [{ ownerId: null }, { ownerId: userId }],
          },
          select: { id: true },
        });
        if (!item) {
          throw new BadRequestException(
            `payload.${key}: позиция справочника ${label} не найдена, неактивна или недоступна`,
          );
        }
      }
    }

    return this.prisma.changeRequest.create({
      data: {
        projectId: dto.projectId,
        materialId: dto.materialId ?? null,
        type: dto.type,
        payload: payload as Prisma.InputJsonValue,
        proposedBy: userId,
      },
      include: { proposer: { select: { id: true, fullName: true } } },
    });
  }

  // ─── Список заявок проекта (цены скрыты от VIEWER/hidePrices) ───
  async list(userId: number, projectId: number) {
    const access = await this.getAccess(userId, projectId);
    const hideMoney = access.role === AccessRole.VIEWER || access.hidePrices;

    const rows = await this.prisma.changeRequest.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 200, // ⭐ лимит от переполнения ответа
      include: {
        proposer: { select: { id: true, fullName: true } },
        reviewer: { select: { id: true, fullName: true } },
      },
    });

    if (!hideMoney) {
      return rows;
    }
    return rows.map((row) => ({
      ...row,
      payload: this.stripPrices(row.payload as Record<string, any>),
    }));
  }

  // ─── Согласовать / отклонить (атомарно, в транзакции) ───
  async review(userId: number, changeId: number, dto: ReviewChangeDto) {
    const change = await this.prisma.changeRequest.findUnique({
      where: { id: changeId },
      select: {
        id: true,
        projectId: true,
        materialId: true,
        type: true,
        payload: true,
        status: true,
        proposedBy: true,
      },
    });
    if (!change) {
      throw new NotFoundException('Заявка не найдена');
    }

    // ⭐ Доступ ПЕРЕД проверкой статуса — не утекают состояния чужих заявок
    const access = await this.getAccess(userId, change.projectId);
    if (!MONEY_ROLES.includes(access.role)) {
      throw new ForbiddenException(
        'Согласовывать могут только прораб и заказчик',
      );
    }
    if (change.proposedBy === userId) {
      throw new ForbiddenException('Нельзя согласовать собственную заявку');
    }
    if (change.status !== ChangeStatus.PENDING) {
      throw new BadRequestException('Заявка уже обработана');
    }

    const status =
      dto.action === ReviewActionEnum.APPROVE
        ? ChangeStatus.APPROVED
        : ChangeStatus.REJECTED;

    return this.prisma.$transaction(async (tx) => {
      // ⭐ Атомарно занимаем PENDING→status: гонка двух review невозможна
      const claim = await tx.changeRequest.updateMany({
        where: { id: changeId, status: ChangeStatus.PENDING },
        data: {
          status,
          reviewedBy: userId,
          reviewComment: dto.reviewComment ?? null,
        },
      });
      if (claim.count === 0) {
        throw new BadRequestException('Заявка уже обработана');
      }

      if (status === ChangeStatus.APPROVED) {
        await this.applyPayload(tx, change, userId);
      }

      return tx.changeRequest.findUnique({
        where: { id: changeId },
        include: {
          proposer: { select: { id: true, fullName: true } },
          reviewer: { select: { id: true, fullName: true } },
        },
      });
    });
  }

  // ─── Применение payload при APPROVE (внутри транзакции) ───
  private async applyPayload(
    tx: Prisma.TransactionClient,
    change: {
      projectId: number;
      materialId: number | null;
      type: string;
      payload: Prisma.JsonValue;
      proposedBy: number;
    },
    userId: number,
  ) {
    const payload = (change.payload ?? {}) as Record<string, any>;

    switch (change.type) {
      case ChangeTypeEnum.ADD_ROW: {
        // ⭐ W2+A4: SNAPSHOT цены берём ТОЛЬКО ИЗ СПРАВОЧНИКА + проверяем kind и ownerId.
        // priceItemId (без ownerId) = 0, как в materials.service.create.
        let unitPrice = 0;
        if (payload.priceItemId !== undefined) {
          const workItem = await tx.priceItem.findFirst({
            where: {
              id: payload.priceItemId,
              isActive: true,
              kind: 'WORK',
              OR: [{ ownerId: null }, { ownerId: userId }, { ownerId: change.proposedBy }],
            },
            select: { price: true },
          });
          if (!workItem) {
            throw new BadRequestException(
              'Позиция справочника работ не найдена, неактивна или недоступна',
            );
          }
          unitPrice = workItem.price;
        }
        let materialUnitPrice = 0;
        if (payload.materialItemId !== undefined) {
          const matItem = await tx.priceItem.findFirst({
            where: {
              id: payload.materialItemId,
              isActive: true,
              kind: 'MATERIAL',
              OR: [{ ownerId: null }, { ownerId: userId }, { ownerId: change.proposedBy }],
            },
            select: { price: true },
          });
          if (!matItem) {
            throw new BadRequestException(
              'Позиция справочника материалов не найдена, неактивна или недоступна',
            );
          }
          materialUnitPrice = matItem.price;
        }
        await tx.material.create({
          data: {
            projectId: change.projectId,
            name: payload.name,
            article: payload.article ?? null,
            unit: payload.unit as Unit,
            specQuantity: payload.specQuantity,
            note: payload.note ?? null,
            priceItemId: payload.priceItemId ?? null,
            unitPrice,
            materialItemId: payload.materialItemId ?? null,
            materialUnitPrice,
          },
        });
        break;
      }
      case ChangeTypeEnum.CHANGE_QTY: {
        if (change.materialId === null) {
          throw new BadRequestException('В заявке нет материала');
        }
        // ⭐ W3+W4: блокируем строку (FOR UPDATE) и пересчитываем прогресс
        const rows = await tx.$queryRaw<Array<{ totalUsed: number }>>`
          SELECT "totalUsed" FROM "materials" WHERE id = ${change.materialId} FOR UPDATE
        `;
        if (rows.length === 0) {
          throw new BadRequestException('Материал не найден');
        }
        const totalUsed = Number(rows[0].totalUsed);
        const specQuantity = Number(payload.newSpecQuantity);
        await tx.material.update({
          where: { id: change.materialId },
          data: {
            specQuantity,
            progressPercent:
              specQuantity > 0
                ? Math.round((totalUsed / specQuantity) * 100)
                : 0,
          },
        });
        break;
      }
      case ChangeTypeEnum.CHANGE_PRICE: {
        if (change.materialId === null) {
          throw new BadRequestException('В заявке нет материала');
        }
        // ⭐ W4: SELECT ... FOR UPDATE — параллельная фиксация не собьёт totalCost
        const rows = await tx.$queryRaw<Array<{ totalUsed: number }>>`
          SELECT "totalUsed" FROM "materials" WHERE id = ${change.materialId} FOR UPDATE
        `;
        if (rows.length === 0) {
          throw new BadRequestException('Материал не найден');
        }
        const totalUsed = Number(rows[0].totalUsed);
        const unitPrice: number | undefined = payload.newUnitPrice;
        const materialUnitPrice: number | undefined =
          payload.newMaterialUnitPrice;
        await tx.material.update({
          where: { id: change.materialId },
          data: {
            ...(unitPrice !== undefined
              ? { unitPrice, totalCost: totalUsed * unitPrice }
              : {}),
            ...(materialUnitPrice !== undefined
              ? {
                  materialUnitPrice,
                  materialTotalCost: totalUsed * materialUnitPrice,
                }
              : {}),
          },
        });
        break;
      }
      default:
        throw new BadRequestException('Неизвестный тип заявки');
    }
  }

  // ─── Whitelist-валидация payload: возвращает ТОЛЬКО разрешённые ключи ───
  private validatePayload(
    type: ChangeTypeEnum,
    payload: Record<string, any>,
    materialId?: number,
  ): Record<string, any> {
    const clean: Record<string, any> = {};

    const needNumber = (
      key: string,
      opts: { required?: boolean; min?: number } = {},
    ) => {
      const value = payload[key];
      if (value === undefined) {
        if (opts.required)
          throw new BadRequestException(`payload: не хватает "${key}"`);
        return;
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new BadRequestException(
          `payload.${key}: должно быть конечным числом`,
        );
      }
      if (opts.min !== undefined && value < opts.min) {
        throw new BadRequestException(
          `payload.${key}: число не меньше ${opts.min}`,
        );
      }
      clean[key] = value;
    };

    const needString = (
      key: string,
      opts: { required?: boolean; max?: number } = {},
    ) => {
      const value = payload[key];
      if (value === undefined) {
        if (opts.required)
          throw new BadRequestException(`payload: не хватает "${key}"`);
        return;
      }
      if (typeof value !== 'string' || value.trim() === '') {
        throw new BadRequestException(`payload.${key}: непустая строка`);
      }
      // ⭐ W5: лимит длины, чтобы в Json/Material не уехал мегабайт текста
      if (opts.max !== undefined && value.trim().length > opts.max) {
        throw new BadRequestException(
          `payload.${key}: максимум ${opts.max} символов`,
        );
      }
      clean[key] = value.trim();
    };

    const needInt = (key: string) => {
      const value = payload[key];
      if (value === undefined) return;
      if (!Number.isInteger(value) || value <= 0) {
        throw new BadRequestException(`payload.${key}: целое число больше 0`);
      }
      clean[key] = value;
    };

    switch (type) {
      case ChangeTypeEnum.ADD_ROW:
        needString('name', { required: true, max: 200 });
        needString('unit', { required: true });
        if (!UNITS.includes(clean.unit)) {
          throw new BadRequestException(
            `payload.unit: допустимые значения ${UNITS.join(', ')}`,
          );
        }
        needNumber('specQuantity', { required: true, min: 0 });
        needString('article', { max: 100 });
        needString('note', { max: 500 });
        // ⭐ Только id из справочника — цены НЕ из payload, а из PriceItem.price
        needInt('priceItemId');
        needInt('materialItemId');
        break;
      case ChangeTypeEnum.CHANGE_QTY:
        if (materialId === undefined) {
          throw new BadRequestException('Для CHANGE_QTY обязателен materialId');
        }
        needNumber('newSpecQuantity', { required: true, min: 0 });
        break;
      case ChangeTypeEnum.CHANGE_PRICE:
        if (materialId === undefined) {
          throw new BadRequestException(
            'Для CHANGE_PRICE обязателен materialId',
          );
        }
        needNumber('newUnitPrice', { min: 0 });
        needNumber('newMaterialUnitPrice', { min: 0 });
        if (
          clean.newUnitPrice === undefined &&
          clean.newMaterialUnitPrice === undefined
        ) {
          throw new BadRequestException(
            'payload: нужен newUnitPrice или newMaterialUnitPrice',
          );
        }
        break;
      default:
        throw new BadRequestException('Неизвестный тип заявки');
    }
    return clean;
  }

  // ─── Вырезание цен для VIEWER / hidePrices ───
  private stripPrices(payload: Record<string, any>) {
    const copy = { ...payload };
    for (const key of PRICE_KEYS) {
      delete copy[key];
    }
    return copy;
  }
}
