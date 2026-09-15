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

// ⭐ Whitelist ролей (не «по отрицанию»): новая роль в схеме не откроет доступ сама
const PROPOSER_ROLES: AccessRole[] = [AccessRole.FOREMAN, AccessRole.CUSTOMER];
const REVIEWER_ROLES: AccessRole[] = [AccessRole.FOREMAN, AccessRole.CUSTOMER];
// ⭐ Ценовые ключи payload — вырезаются для VIEWER и hidePrices
const PRICE_KEYS = [
  'unitPrice', 'materialUnitPrice', 'newUnitPrice', 'newMaterialUnitPrice',
  'price', 'totalCost', 'materialTotalCost',
];
const UNITS: string[] = [
  'PIECE', 'METER', 'SQUARE_METER', 'CUBIC_METER', 'KILOGRAM',
  'LITER', 'TON', 'BAG', 'PACKAGE', 'SET',
];

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
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId: project.objectId },
    });
    if (!access) {
      // ⭐ 404 вместо 403 — не раскрываем существование чужих проектов
      throw new NotFoundException('Проект не найден');
    }
    if (access.projectId !== null && access.projectId !== projectId) {
      throw new ForbiddenException('Нет доступа к этому проекту');
    }
    return access;
  }

  // ─── Предложить изменение (FOREMAN/CUSTOMER) ───
  async create(userId: number, dto: CreateChangeDto) {
    const access = await this.getAccess(userId, dto.projectId);
    if (!PROPOSER_ROLES.includes(access.role)) {
      throw new ForbiddenException('Предлагать изменения могут прораб и заказчик');
    }
    // ⭐ IDOR-защита: materialId обязан принадлежать этому проекту
    if (dto.materialId !== undefined) {
      const material = await this.prisma.material.findUnique({
        where: { id: dto.materialId },
        select: { projectId: true },
      });
      if (!material || material.projectId !== dto.projectId) {
        throw new BadRequestException('materialId: материал не найден в этом проекте');
      }
    }
    // ⭐ payload чистим через whitelist: лишние ключи не проскочат
    const payload = this.validatePayload(dto.type, dto.payload, dto.materialId);

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
        id: true, projectId: true, materialId: true,
        type: true, payload: true, status: true, proposedBy: true,
      },
    });
    if (!change) {
      throw new NotFoundException('Заявка не найдена');
    }

    // ⭐ Доступ ПЕРЕД проверкой статуса — не утекают состояния чужих заявок
    const access = await this.getAccess(userId, change.projectId);
    if (!REVIEWER_ROLES.includes(access.role)) {
      throw new ForbiddenException('Согласовывать могут только прораб и заказчик');
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
        await this.applyPayload(tx, change);
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
    change: { projectId: number; materialId: number | null; type: string; payload: Prisma.JsonValue },
  ) {
    const payload = (change.payload ?? {}) as Record<string, any>;

    switch (change.type) {
      case ChangeTypeEnum.ADD_ROW: {
        await tx.material.create({
          data: {
            projectId: change.projectId,
            name: payload.name,
            article: payload.article ?? null,
            unit: payload.unit as Unit,
            specQuantity: payload.specQuantity,
            note: payload.note ?? null,
            priceItemId: payload.priceItemId ?? null,
            unitPrice: payload.unitPrice ?? 0,
            materialItemId: payload.materialItemId ?? null,
            materialUnitPrice: payload.materialUnitPrice ?? 0,
          },
        });
        break;
      }
      case ChangeTypeEnum.CHANGE_QTY: {
        if (change.materialId === null) {
          throw new BadRequestException('В заявке нет материала');
        }
        await tx.material.update({
          where: { id: change.materialId },
          data: { specQuantity: payload.newSpecQuantity },
        });
        break;
      }
      case ChangeTypeEnum.CHANGE_PRICE: {
        if (change.materialId === null) {
          throw new BadRequestException('В заявке нет материала');
        }
        const material = await tx.material.findUnique({
          where: { id: change.materialId },
          select: { totalUsed: true },
        });
        if (!material) {
          throw new BadRequestException('Материал не найден');
        }
        const unitPrice: number | undefined = payload.newUnitPrice;
        const materialUnitPrice: number | undefined = payload.newMaterialUnitPrice;
        await tx.material.update({
          where: { id: change.materialId },
          data: {
            ...(unitPrice !== undefined
              ? { unitPrice, totalCost: material.totalUsed * unitPrice }
              : {}),
            ...(materialUnitPrice !== undefined
              ? { materialUnitPrice, materialTotalCost: material.totalUsed * materialUnitPrice }
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

    const needNumber = (key: string, opts: { required?: boolean; min?: number } = {}) => {
      const value = payload[key];
      if (value === undefined) {
        if (opts.required) throw new BadRequestException(`payload: не хватает "${key}"`);
        return;
      }
      if (typeof value !== 'number' || !Number.isFinite(value) || (opts.min !== undefined && value < opts.min)) {
        throw new BadRequestException(`payload.${key}: число не меньше ${opts.min ?? 0}`);
      }
      clean[key] = value;
    };

    const needString = (key: string, required = false) => {
      const value = payload[key];
      if (value === undefined) {
        if (required) throw new BadRequestException(`payload: не хватает "${key}"`);
        return;
      }
      if (typeof value !== 'string' || value.trim() === '') {
        throw new BadRequestException(`payload.${key}: непустая строка`);
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
        needString('name', true);
        needString('unit', true);
        if (!UNITS.includes(clean.unit)) {
          throw new BadRequestException(`payload.unit: допустимые значения ${UNITS.join(', ')}`);
        }
        needNumber('specQuantity', { required: true, min: 0 });
        needString('article');
        needString('note');
        needInt('priceItemId');
        needNumber('unitPrice', { min: 0 });
        needInt('materialItemId');
        needNumber('materialUnitPrice', { min: 0 });
        break;
      case ChangeTypeEnum.CHANGE_QTY:
        if (materialId === undefined) {
          throw new BadRequestException('Для CHANGE_QTY обязателен materialId');
        }
        needNumber('newSpecQuantity', { required: true, min: 0 });
        break;
      case ChangeTypeEnum.CHANGE_PRICE:
        if (materialId === undefined) {
          throw new BadRequestException('Для CHANGE_PRICE обязателен materialId');
        }
        needNumber('newUnitPrice', { min: 0 });
        needNumber('newMaterialUnitPrice', { min: 0 });
        if (clean.newUnitPrice === undefined && clean.newMaterialUnitPrice === undefined) {
          throw new BadRequestException('payload: нужен newUnitPrice или newMaterialUnitPrice');
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