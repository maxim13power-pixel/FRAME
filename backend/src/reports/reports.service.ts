// backend/src/reports/reports.service.ts
// ⭐ Раздел «Отчёты»: сметы и акты выполненных работ.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service'; // ⭐ №131
import { findVisiblePriceItem } from '../price-list/catalog-access'; // ⭐ №191 (F6)
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
    access?: { role?: string; hidePrices?: boolean; revokedAt?: Date | null } | null,
  ): boolean {
    if (!access) return false;
    // ⭐ №168: отозванный доступ видит только снимок в шаблонах — живые цены скрыты
    if (access.revokedAt) return true;
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

  // ⭐ №180: наблюдатель и отозванный доступ — только чтение (как в projects/brigades).
  private assertWritable(
    access: { role?: AccessRole | string; revokedAt?: Date | null },
    action: string,
  ) {
    if (access.revokedAt) {
      throw new ForbiddenException(
        `Доступ отозван: ${action} недоступно. Отчёты открыты только на чтение.`,
      );
    }
    if (access.role === AccessRole.VIEWER) {
      throw new ForbiddenException(`Наблюдатель не может ${action}`);
    }
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

  private async resolvePriceItem(materialId: number, userId: number) {
    // ⭐ №191 (F6): расценка должна быть из справочника, который пользователь видит.
    // «Не найдено» — тот же ответ, что и для несуществующего id (не подтверждаем чужой id).
    const item = await findVisiblePriceItem(this.prisma, materialId, userId);
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
    // ⭐ №180: суммы скрываем и в списке — раньше hidePrices работал только в карточке.
    let hideAll = false;
    let grants: Array<{
      objectId: number;
      projectId: number | null;
      role?: string;
      hidePrices?: boolean;
      revokedAt?: Date | null;
    }> = [];

    if (filters.projectId != null && !Number.isNaN(filters.projectId)) {
      hideAll = this.mustHidePrices(
        await this.checkProjectAccess(filters.projectId, userId),
      );
      where.projectId = filters.projectId;
    } else if (filters.objectId != null && !Number.isNaN(filters.objectId)) {
      const acc = await this.prisma.objectAccess.findFirst({
        where: { userId, objectId: filters.objectId, projectId: null },
      });
      if (!acc) {
        throw new ForbiddenException('Нет доступа к этому объекту');
      }
      hideAll = this.mustHidePrices(acc);
      where.objectId = filters.objectId;
    } else {
      grants = await this.prisma.objectAccess.findMany({
        where: { userId },
        select: {
          objectId: true,
          projectId: true,
          role: true,
          hidePrices: true,
          revokedAt: true,
        },
      });
      const objectLevelIds = grants
        .filter((a) => a.projectId == null)
        .map((a) => a.objectId);
      const projectLevelIds = grants
        .filter((a) => a.projectId != null)
        .map((a) => a.projectId as number);
      where.OR = [
        { objectId: { in: objectLevelIds } },
        { projectId: { in: projectLevelIds } },
      ];
    }

    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    const reports = await this.prisma.report.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: REPORT_INCLUDE,
    });

    if (hideAll) return reports.map((r) => this.stripPrices(r));
    if (grants.length === 0) return reports;

    // Скрываем суммы там, где хотя бы одна выданная запись требует скрытия.
    return reports.map((r) => {
      const own = grants.filter(
        (g) =>
          g.objectId === r.objectId &&
          (g.projectId == null || g.projectId === r.projectId),
      );
      return own.some((g) => this.mustHidePrices(g))
        ? this.stripPrices(r)
        : r;
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
    this.assertWritable(
      await this.checkProjectAccess(dto.projectId, userId),
      'создавать отчёт',
    );

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
    const { report, access } = await this.checkReportAccess(id, userId);
    this.assertWritable(access, 'изменять отчёт');
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
    const { access } = await this.checkReportAccess(id, userId);
    this.assertWritable(access, 'удалять отчёт');
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
    const { access } = await this.checkReportAccess(reportId, userId);
    this.assertWritable(access, 'добавлять позиции в отчёт');
    const quantity = dto.quantity;
    let name: string;
    let unit: string;
    let price: number;

    if (dto.materialId != null) {
      const pi = await this.resolvePriceItem(dto.materialId, userId);
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
    const { access } = await this.checkReportAccess(reportId, userId);
    this.assertWritable(access, 'изменять позиции отчёта');

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
        const pi = await this.resolvePriceItem(dto.materialId, userId);
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
    const { access } = await this.checkReportAccess(reportId, userId);
    this.assertWritable(access, 'удалять позиции отчёта');

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
