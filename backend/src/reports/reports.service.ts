// backend/src/reports/reports.service.ts
// ⭐ Раздел «Отчёты»: сметы и акты выполненных работ.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service'; // ⭐ №131
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { AddReportItemDto } from './dto/add-report-item.dto';
import { UpdateReportItemDto } from './dto/update-report-item.dto';

const REPORT_TYPES = ['estimate', 'act'];
const REPORT_STATUSES = ['draft', 'sent', 'approved', 'rejected'];

const UNIT_LABELS: Record<string, string> = {
  PIECE: 'шт',
  METER: 'м',
  SQUARE_METER: 'м²',
  CUBIC_METER: 'м³',
  KILOGRAM: 'кг',
  LITER: 'л',
  TON: 'т',
  BAG: 'мешок',
  PACKAGE: 'упак',
  SET: 'компл',
};

const round2 = (v: number) => Math.round(v * 100) / 100;

const REPORT_INCLUDE = {
  project: { select: { id: true, name: true } },
  object: { select: { id: true, name: true } },
} satisfies Prisma.ReportInclude;

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService, // ⭐ №131
  ) {}

  // ⭐ СКРЫТИЕ ЦЕН (флаг hidePrices + роль VIEWER) — как в materials.service.ts
  private mustHidePrices(
    access?: { role?: string; hidePrices?: boolean } | null,
  ): boolean {
    if (!access) return false;
    // Наблюдатель не видит деньги по определению роли
    if (access.role === 'VIEWER') return true;
    return access.hidePrices ?? false;
  }

  /** Обнулить денежные поля отчёта и его позиций (для ответа клиенту) */
  private stripPrices<T>(report: T): T {
    const r = report as any;
    if (!r) return report;
    const items = Array.isArray(r.items)
      ? r.items.map((it: any) => ({
          ...it,
          price: 0,
          total: 0,
          material: it.material ? { ...it.material, price: 0 } : null,
        }))
      : r.items;
    return { ...r, totalAmount: 0, items } as T;
  }

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

  private async checkReportAccess(reportId: number, userId: number) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('Отчёт не найден');
    }
    // ⭐ Возвращаем и отчёт, и запись доступа (role/hidePrices) — для скрытия цен.
    const access = await this.checkProjectAccess(report.projectId, userId);
    return { report, access };
  }

  private async resolvePriceItem(materialId: number) {
    const item = await this.prisma.priceItem.findUnique({ where: { id: materialId } });
    if (!item) {
      throw new BadRequestException('Позиция справочника цен не найдена');
    }
    return {
      name: item.name,
      unit: UNIT_LABELS[item.unit] ?? 'шт',
      price: Number(item.price),
    };
  }

  async list(
    userId: number,
    filters: { projectId?: number; objectId?: number; type?: string; status?: string },
  ) {
    const where: Prisma.ReportWhereInput = {};

    if (filters.projectId != null && !Number.isNaN(filters.projectId)) {
      await this.checkProjectAccess(filters.projectId, userId);
      where.projectId = filters.projectId;
    } else if (filters.objectId != null && !Number.isNaN(filters.objectId)) {
      const acc = await this.prisma.objectAccess.findFirst({
        where: { userId, objectId: filters.objectId, projectId: null },
      });
      if (!acc) {
        throw new ForbiddenException('Нет доступа к этому объекту');
      }
      where.objectId = filters.objectId;
    } else {
      const accesses = await this.prisma.objectAccess.findMany({
        where: { userId },
        select: { objectId: true, projectId: true },
      });
      const objectLevelIds = accesses
        .filter((a) => a.projectId == null)
        .map((a) => a.objectId);
      const projectLevelIds = accesses
        .filter((a) => a.projectId != null)
        .map((a) => a.projectId as number);
      where.OR = [
        { objectId: { in: objectLevelIds } },
        { projectId: { in: projectLevelIds } },
      ];
    }

    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    return this.prisma.report.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: REPORT_INCLUDE,
    });
  }

  async detail(userId: number, id: number) {
    const { report, access } = await this.checkReportAccess(id, userId);
    const items = await this.prisma.reportItem.findMany({
      where: { reportId: id },
      orderBy: { sortOrder: 'asc' },
      include: {
        material: { select: { id: true, name: true, unit: true, price: true } },
      },
    });
    const result = { ...report, items };
    // ⭐ VIEWER / hidePrices — скрываем цены и в JSON, и в PDF/XLSX (контроллер
    // вызывает detail() перед генерацией экспорта, поэтому обнуление работает везде).
    return this.mustHidePrices(access) ? this.stripPrices(result) : result;
  }

  async create(userId: number, dto: CreateReportDto) {
    if (!REPORT_TYPES.includes(dto.type)) {
      throw new BadRequestException('type: estimate / act');
    }
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { objectId: true },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    if (project.objectId !== dto.objectId) {
      throw new BadRequestException('objectId: проект не принадлежит этому объекту');
    }
    await this.checkProjectAccess(dto.projectId, userId);

    return this.prisma.report.create({
      data: {
        type: dto.type,
        title: dto.title.trim(),
        projectId: dto.projectId,
        objectId: dto.objectId,
        status: 'draft',
        comment: dto.comment?.trim() || null,
        createdBy: userId,
      },
      include: REPORT_INCLUDE,
    });
  }

  async update(userId: number, id: number, dto: UpdateReportDto) {
    const { report } = await this.checkReportAccess(id, userId);
    if (dto.status && !REPORT_STATUSES.includes(dto.status)) {
      throw new BadRequestException('status: draft / sent / approved / rejected');
    }
    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        status: dto.status,
        comment: dto.comment !== undefined ? dto.comment.trim() || null : undefined,
      },
      include: REPORT_INCLUDE,
    });

    // ⭐ №131: журнал смены статуса отчёта
    if (dto.status !== undefined && dto.status !== report.status) {
      await this.audit.log(
        userId,
        'report',
        id,
        'status_change',
        { status: report.status },
        { status: updated.status },
      );
    }

    return updated;
  }

  async remove(userId: number, id: number) {
    await this.checkReportAccess(id, userId);
    await this.prisma.report.delete({ where: { id } });
    return { success: true };
  }

  private async recalcTotal(tx: Prisma.TransactionClient, reportId: number) {
    const agg = await tx.reportItem.aggregate({
      where: { reportId },
      _sum: { total: true },
    });
    await tx.report.update({
      where: { id: reportId },
      data: { totalAmount: agg._sum.total ?? 0 },
    });
  }

  async addItem(userId: number, reportId: number, dto: AddReportItemDto) {
    await this.checkReportAccess(reportId, userId);
    const quantity = dto.quantity;
    let name: string;
    let unit: string;
    let price: number;

    if (dto.materialId != null) {
      const pi = await this.resolvePriceItem(dto.materialId);
      name = pi.name;
      unit = pi.unit;
      price = pi.price;
    } else {
      if (!dto.name || !dto.name.trim()) {
        throw new BadRequestException('name: обязателен без materialId');
      }
      name = dto.name.trim();
      unit = dto.unit?.trim() || 'шт';
      price = dto.price ?? 0;
    }

    const total = round2(quantity * price);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.reportItem.create({
        data: {
          reportId,
          materialId: dto.materialId ?? null,
          name,
          unit,
          quantity,
          price,
          total,
        },
      });
      await this.recalcTotal(tx, reportId);
      return item;
    });
  }

  async updateItem(
    userId: number,
    reportId: number,
    itemId: number,
    dto: UpdateReportItemDto,
  ) {
    await this.checkReportAccess(reportId, userId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.reportItem.findFirst({
        where: { id: itemId, reportId },
      });
      if (!existing) {
        throw new NotFoundException('Позиция отчёта не найдена');
      }

      let name = existing.name;
      let unit = existing.unit;
      let price = Number(existing.price);

      if (dto.materialId != null) {
        const pi = await this.resolvePriceItem(dto.materialId);
        name = pi.name;
        unit = pi.unit;
        price = pi.price;
      } else {
        if (dto.name !== undefined) name = dto.name.trim();
        if (dto.unit !== undefined) unit = dto.unit.trim() || 'шт';
        if (dto.price !== undefined) price = dto.price;
      }

      const quantity = dto.quantity ?? Number(existing.quantity);
      const total = dto.total ?? round2(quantity * price);

      const item = await tx.reportItem.update({
        where: { id: itemId },
        data: {
          materialId: dto.materialId !== undefined ? dto.materialId : undefined,
          name,
          unit,
          quantity,
          price,
          total,
        },
      });
      await this.recalcTotal(tx, reportId);
      return item;
    });
  }

  async removeItem(userId: number, reportId: number, itemId: number) {
    await this.checkReportAccess(reportId, userId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.reportItem.findFirst({
        where: { id: itemId, reportId },
      });
      if (!existing) {
        throw new NotFoundException('Позиция отчёта не найдена');
      }
      await tx.reportItem.delete({ where: { id: itemId } });
      await this.recalcTotal(tx, reportId);
      return { success: true };
    });
  }
}
