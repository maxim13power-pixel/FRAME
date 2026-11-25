// backend/src/reports/reports.service.ts
// в­ђ Р Р°Р·РґРµР» В«РћС‚С‡С‘С‚С‹В»: СЃРјРµС‚С‹ Рё Р°РєС‚С‹ РІС‹РїРѕР»РЅРµРЅРЅС‹С… СЂР°Р±РѕС‚.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildKeysetPage,
  keysetWhere,
  parseCursor,
  parseLimit,
} from '../common/keyset'; // ⭐ №391: keyset-пагинация списка
import { assertAccessActive, findLiveAccess, findProjectAccess } from '../auth/access-scope'; // в­ђ в„–193 (Aв‚‚ F1)
import { AuditService } from '../audit/audit.service'; // в­ђ в„–131
import { findVisiblePriceItem } from '../price-list/catalog-access'; // в­ђ в„–191 (F6)
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { AddReportItemDto } from './dto/add-report-item.dto';
import { UpdateReportItemDto } from './dto/update-report-item.dto';

const REPORT_TYPES = ['estimate', 'act'];
const REPORT_STATUSES = ['draft', 'sent', 'approved', 'rejected'];

const UNIT_LABELS: Record<string, string> = {
  PIECE: 'С€С‚',
  METER: 'Рј',
  LINEAR_METER: 'РїРѕРі. Рј',
  SQUARE_METER: 'РјВІ',
  CUBIC_METER: 'РјВі',
  KILOGRAM: 'РєРі',
  LITER: 'Р»',
  TON: 'С‚',
  BAG: 'РјРµС€РѕРє',
  PACKAGE: 'СѓРїР°Рє',
  SET: 'РєРѕРјРїР»',
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
    private audit: AuditService, // в­ђ в„–131
  ) {}

  // в­ђ РЎРљР Р«РўРР• Р¦Р•Рќ (С„Р»Р°Рі hidePrices + СЂРѕР»СЊ VIEWER) вЂ” РєР°Рє РІ materials.service.ts
  private mustHidePrices(
    access?: { role?: string; hidePrices?: boolean; revokedAt?: Date | null } | null,
  ): boolean {
    if (!access) return false;
    // в­ђ в„–168: РѕС‚РѕР·РІР°РЅРЅС‹Р№ РґРѕСЃС‚СѓРї РІРёРґРёС‚ С‚РѕР»СЊРєРѕ СЃРЅРёРјРѕРє РІ С€Р°Р±Р»РѕРЅР°С… вЂ” Р¶РёРІС‹Рµ С†РµРЅС‹ СЃРєСЂС‹С‚С‹
    if (access.revokedAt) return true;
    // РќР°Р±Р»СЋРґР°С‚РµР»СЊ РЅРµ РІРёРґРёС‚ РґРµРЅСЊРіРё РїРѕ РѕРїСЂРµРґРµР»РµРЅРёСЋ СЂРѕР»Рё
    if (access.role === 'VIEWER') return true;
    return access.hidePrices ?? false;
  }

  /** РћР±РЅСѓР»РёС‚СЊ РґРµРЅРµР¶РЅС‹Рµ РїРѕР»СЏ РѕС‚С‡С‘С‚Р° Рё РµРіРѕ РїРѕР·РёС†РёР№ (РґР»СЏ РѕС‚РІРµС‚Р° РєР»РёРµРЅС‚Сѓ) */
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

  // в­ђ в„–180: РЅР°Р±Р»СЋРґР°С‚РµР»СЊ Рё РѕС‚РѕР·РІР°РЅРЅС‹Р№ РґРѕСЃС‚СѓРї вЂ” С‚РѕР»СЊРєРѕ С‡С‚РµРЅРёРµ (РєР°Рє РІ projects/brigades).
  private assertWritable(
    access: { role?: AccessRole | string; revokedAt?: Date | null },
    action: string,
  ) {
    if (access.revokedAt) {
      throw new ForbiddenException(
        `Р”РѕСЃС‚СѓРї РѕС‚РѕР·РІР°РЅ: ${action} РЅРµРґРѕСЃС‚СѓРїРЅРѕ. РћС‚С‡С‘С‚С‹ РѕС‚РєСЂС‹С‚С‹ С‚РѕР»СЊРєРѕ РЅР° С‡С‚РµРЅРёРµ.`,
      );
    }
    if (access.role === AccessRole.VIEWER) {
      throw new ForbiddenException(`РќР°Р±Р»СЋРґР°С‚РµР»СЊ РЅРµ РјРѕР¶РµС‚ ${action}`);
    }
  }

  private async checkProjectAccess(projectId: number, userId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) {
      throw new NotFoundException('РџСЂРѕРµРєС‚ РЅРµ РЅР°Р№РґРµРЅ');
    }
    const access = await findProjectAccess(
      this.prisma,
      userId,
      project.objectId,
      projectId,
    );
    if (!access) {
      throw new NotFoundException('РџСЂРѕРµРєС‚ РЅРµ РЅР°Р№РґРµРЅ');
    }
    assertAccessActive(access); // в­ђ в„–193 (Aв‚‚ F1): РѕС‚РѕР·РІР°РЅРЅС‹Р№ РґРѕСЃС‚СѓРї Р¶РёРІС‹С… РґР°РЅРЅС‹С… РЅРµ С‡РёС‚Р°РµС‚
    return access;
  }

  private async checkReportAccess(reportId: number, userId: number) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('РћС‚С‡С‘С‚ РЅРµ РЅР°Р№РґРµРЅ');
    }
    // в­ђ Р’РѕР·РІСЂР°С‰Р°РµРј Рё РѕС‚С‡С‘С‚, Рё Р·Р°РїРёСЃСЊ РґРѕСЃС‚СѓРїР° (role/hidePrices) вЂ” РґР»СЏ СЃРєСЂС‹С‚РёСЏ С†РµРЅ.
    const access = await this.checkProjectAccess(report.projectId, userId);
    return { report, access };
  }

  private async resolvePriceItem(materialId: number, userId: number) {
    // в­ђ в„–191 (F6): СЂР°СЃС†РµРЅРєР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РёР· СЃРїСЂР°РІРѕС‡РЅРёРєР°, РєРѕС‚РѕСЂС‹Р№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РІРёРґРёС‚.
    // В«РќРµ РЅР°Р№РґРµРЅРѕВ» вЂ” С‚РѕС‚ Р¶Рµ РѕС‚РІРµС‚, С‡С‚Рѕ Рё РґР»СЏ РЅРµСЃСѓС‰РµСЃС‚РІСѓСЋС‰РµРіРѕ id (РЅРµ РїРѕРґС‚РІРµСЂР¶РґР°РµРј С‡СѓР¶РѕР№ id).
    const item = await findVisiblePriceItem(this.prisma, materialId, userId);
    if (!item) {
      throw new BadRequestException('РџРѕР·РёС†РёСЏ СЃРїСЂР°РІРѕС‡РЅРёРєР° С†РµРЅ РЅРµ РЅР°Р№РґРµРЅР°');
    }
    return {
      name: item.name,
      unit: UNIT_LABELS[item.unit] ?? 'С€С‚',
      price: Number(item.price),
    };
  }

  async list(
    userId: number,
    filters: { projectId?: number; objectId?: number; type?: string; status?: string },
    page?: { limit?: unknown; cursor?: unknown },
  ) {
    const where: Prisma.ReportWhereInput = {};
    // ⭐ №391: пагинация включается только при ?limit=; без него — прежний массив.
    const limit = parseLimit(page?.limit);
    const cursor = parseCursor(page?.cursor);
    // в­ђ в„–180: СЃСѓРјРјС‹ СЃРєСЂС‹РІР°РµРј Рё РІ СЃРїРёСЃРєРµ вЂ” СЂР°РЅСЊС€Рµ hidePrices СЂР°Р±РѕС‚Р°Р» С‚РѕР»СЊРєРѕ РІ РєР°СЂС‚РѕС‡РєРµ.
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
      // в­ђ в„–193 (Aв‚‚ F1): РѕС‚РѕР·РІР°РЅРЅС‹Р№ РґРѕСЃС‚СѓРї РѕС‚С‡С‘С‚С‹ РѕР±СЉРµРєС‚Р° РЅРµ С‡РёС‚Р°РµС‚.
      const acc = await findLiveAccess(this.prisma, {
        userId,
        objectId: filters.objectId,
        projectId: null,
      });
      if (!acc) {
        throw new NotFoundException('РћР±СЉРµРєС‚ РЅРµ РЅР°Р№РґРµРЅ');
      }
      assertAccessActive(acc);
      hideAll = this.mustHidePrices(acc);
      where.objectId = filters.objectId;
    } else {
      // в­ђ в„–193 (Aв‚‚ F1): РѕС‚РѕР·РІР°РЅРЅС‹Рµ Р·Р°РїРёСЃРё РІ РІС‹Р±РѕСЂРєСѓ РЅРµ РїРѕРїР°РґР°СЋС‚.
      grants = await this.prisma.objectAccess.findMany({
        where: { userId, revokedAt: null },
        select: {
          objectId: true,
          projectId: true,
          role: true,
          hidePrices: true,
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
      where: limit
        ? ({
            AND: [where, ...(cursor ? [keysetWhere(cursor, 'updatedAt')] : [])],
          } as Prisma.ReportWhereInput)
        : where,
      // ⭐ №391: id — tie-break, иначе одинаковые updatedAt «прыгают» между страницами
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: REPORT_INCLUDE,
      ...(limit ? { take: limit + 1 } : {}),
    });
    const total = limit ? await this.prisma.report.count({ where }) : 0;
    const finish = (rows: typeof reports) =>
      limit ? buildKeysetPage(rows, limit, total, (r) => r.updatedAt) : rows;

    if (hideAll) return finish(reports.map((r) => this.stripPrices(r)));
    if (grants.length === 0) return finish(reports);

    // РЎРєСЂС‹РІР°РµРј СЃСѓРјРјС‹ С‚Р°Рј, РіРґРµ С…РѕС‚СЏ Р±С‹ РѕРґРЅР° РІС‹РґР°РЅРЅР°СЏ Р·Р°РїРёСЃСЊ С‚СЂРµР±СѓРµС‚ СЃРєСЂС‹С‚РёСЏ.
    return finish(
      reports.map((r) => {
        const own = grants.filter(
          (g) =>
            g.objectId === r.objectId &&
            (g.projectId == null || g.projectId === r.projectId),
        );
        return own.some((g) => this.mustHidePrices(g))
          ? this.stripPrices(r)
          : r;
      }),
    );
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
    // в­ђ VIEWER / hidePrices вЂ” СЃРєСЂС‹РІР°РµРј С†РµРЅС‹ Рё РІ JSON, Рё РІ PDF/XLSX (РєРѕРЅС‚СЂРѕР»Р»РµСЂ
    // РІС‹Р·С‹РІР°РµС‚ detail() РїРµСЂРµРґ РіРµРЅРµСЂР°С†РёРµР№ СЌРєСЃРїРѕСЂС‚Р°, РїРѕСЌС‚РѕРјСѓ РѕР±РЅСѓР»РµРЅРёРµ СЂР°Р±РѕС‚Р°РµС‚ РІРµР·РґРµ).
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
      throw new NotFoundException('РџСЂРѕРµРєС‚ РЅРµ РЅР°Р№РґРµРЅ');
    }
    if (project.objectId !== dto.objectId) {
      throw new BadRequestException('objectId: РїСЂРѕРµРєС‚ РЅРµ РїСЂРёРЅР°РґР»РµР¶РёС‚ СЌС‚РѕРјСѓ РѕР±СЉРµРєС‚Сѓ');
    }
    this.assertWritable(
      await this.checkProjectAccess(dto.projectId, userId),
      'СЃРѕР·РґР°РІР°С‚СЊ РѕС‚С‡С‘С‚',
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
    this.assertWritable(access, 'РёР·РјРµРЅСЏС‚СЊ РѕС‚С‡С‘С‚');
    const hideMoney = this.mustHidePrices(access);
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

    // в­ђ в„–131: Р¶СѓСЂРЅР°Р» СЃРјРµРЅС‹ СЃС‚Р°С‚СѓСЃР° РѕС‚С‡С‘С‚Р°
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

    return hideMoney ? this.stripPrices(updated) : updated;
  }

  async remove(userId: number, id: number) {
    const { access } = await this.checkReportAccess(id, userId);
    this.assertWritable(access, 'СѓРґР°Р»СЏС‚СЊ РѕС‚С‡С‘С‚');
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
    this.assertWritable(access, 'РґРѕР±Р°РІР»СЏС‚СЊ РїРѕР·РёС†РёРё РІ РѕС‚С‡С‘С‚');
    const hideMoney = this.mustHidePrices(access);
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
        throw new BadRequestException('name: РѕР±СЏР·Р°С‚РµР»РµРЅ Р±РµР· materialId');
      }
      name = dto.name.trim();
      unit = dto.unit?.trim() || 'С€С‚';
      price = dto.price ?? 0;
    }

    const total = round2(quantity * price);

    return this.prisma.$transaction(async (tx) => {
      // в­ђ в„–374: СЃРµСЂРёР°Р»РёР·СѓРµРј РјСѓС‚Р°С†РёРё РїРѕР·РёС†РёР№ РѕРґРЅРѕРіРѕ РѕС‚С‡С‘С‚Р° вЂ”
      // РёРЅР°С‡Рµ РїР°СЂР°Р»Р»РµР»СЊРЅС‹Рµ addItem/updateItem С‚РµСЂСЏСЋС‚ С‡Р°СЃС‚СЊ СЃСѓРјРјС‹.
      await tx.$queryRaw`SELECT id FROM "reports" WHERE id = ${reportId} FOR UPDATE`;
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
      // в­ђ в„–372 (P0): РѕС‚РІРµС‚ РјСѓС‚Р°С†РёРё вЂ” С‚РѕР¶Рµ РґРµРЅСЊРіРё, РјР°СЃРєРёСЂСѓРµРј
      return hideMoney ? { ...item, price: 0, total: 0 } : item;
    });
  }

  async updateItem(
    userId: number,
    reportId: number,
    itemId: number,
    dto: UpdateReportItemDto,
  ) {
    const { access } = await this.checkReportAccess(reportId, userId);
    this.assertWritable(access, 'РёР·РјРµРЅСЏС‚СЊ РїРѕР·РёС†РёРё РѕС‚С‡С‘С‚Р°');
    const hideMoney = this.mustHidePrices(access);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "reports" WHERE id = ${reportId} FOR UPDATE`;
      const existing = await tx.reportItem.findFirst({
        where: { id: itemId, reportId },
      });
      if (!existing) {
        throw new NotFoundException('РџРѕР·РёС†РёСЏ РѕС‚С‡С‘С‚Р° РЅРµ РЅР°Р№РґРµРЅР°');
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
        if (dto.unit !== undefined) unit = dto.unit.trim() || 'С€С‚';
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
      return hideMoney ? { ...item, price: 0, total: 0 } : item;
    });
  }

  async removeItem(userId: number, reportId: number, itemId: number) {
    const { access } = await this.checkReportAccess(reportId, userId);
    this.assertWritable(access, 'СѓРґР°Р»СЏС‚СЊ РїРѕР·РёС†РёРё РѕС‚С‡С‘С‚Р°');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "reports" WHERE id = ${reportId} FOR UPDATE`;
      const existing = await tx.reportItem.findFirst({
        where: { id: itemId, reportId },
      });
      if (!existing) {
        throw new NotFoundException('РџРѕР·РёС†РёСЏ РѕС‚С‡С‘С‚Р° РЅРµ РЅР°Р№РґРµРЅР°');
      }
      await tx.reportItem.delete({ where: { id: itemId } });
      await this.recalcTotal(tx, reportId);
      return { success: true };
    });
  }
}

