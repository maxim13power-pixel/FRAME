// backend/src/objects/object-copy.service.ts
// ⭐ Копирование объекта: новый объект, выбранные проекты и позиции смет.
// Фактический расход и цены — две независимые оси:
//  • copyFacts=false — прогресс/расход в копии нулевые;
//  • pricingMode='keep' — цены и ссылки копируются как есть;
//  • pricingMode='existing'|'copy' — цены пересчитываются по целевому
//    справочнику, ВКЛЮЧАЯ строки с фактическим расходом.
// Команда, склад, бригады, отчёты, фото и история фиксаций не копируются.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole, PriceCatalog, PriceItem, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ObjectsService } from './objects.service';
import {
  loadAccessGrants,
  resolveObjectRole,
  REVOKED_ACCESS_MESSAGE,
} from '../auth/access-scope';
import { loadCatalogAccess } from '../price-list/catalog-access';
import { markupPrice, normalizeMarkup } from '../price-list/catalog-copy';
import { copyCatalogWithMap } from '../price-list/project-catalog';
import { roundMoney, RecalcPriceRef } from '../estimate-recalc/recalc-plan';
import { CopyObjectDto } from './dto/copy-object.dto';
import {
  buildObjectCopyPlan,
  CopyPricePlan,
  CopyPricePlanRow,
  CopyPriceRow,
} from './object-copy-plan';

type SourceProject = Prisma.ProjectGetPayload<{
  include: { materials: true };
}>;
type SourceObject = Prisma.ObjectGetPayload<{
  include: {
    catalog: { select: { id: true; name: true } };
    projects: { include: { materials: true } };
  };
}>;

type CatalogSource = 'source' | 'selected' | 'copy';

interface TargetCatalog {
  /** null — предпросмотр будущей копии справочника (ещё не создана) */
  id: number | null;
  name: string;
  source: CatalogSource;
  items: PriceItem[];
}

interface CopyContext {
  source: SourceObject;
  projects: SourceProject[];
  target: TargetCatalog | null;
  plan: CopyPricePlan | null;
  sourceRefs: Map<number, RecalcPriceRef>;
  warnings: string[];
}

export interface ObjectCopyPreview {
  pricingMode: CopyObjectDto['pricingMode'];
  catalog: { id: number | null; name: string; source: CatalogSource } | null;
  summary: CopyPricePlan['summary'];
  /** Всего несовпадений (issues может быть обрезан для ответа) */
  issueTotal: number;
  issues: CopyPricePlan['issues'];
  warnings: string[];
}

@Injectable()
export class ObjectCopyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objects: ObjectsService,
    private readonly audit: AuditService,
  ) {}

  private async assertCanCopy(objectId: number, userId: number) {
    const grants = await loadAccessGrants(this.prisma, userId);
    const my = resolveObjectRole(grants, objectId);
    if (!my.role) throw new NotFoundException('Объект не найден');
    if (!my.hasObjectAccess) {
      throw new ForbiddenException(
        'Копировать можно только объект целиком, а не отдельный проект',
      );
    }
    if (my.revoked) throw new ForbiddenException(REVOKED_ACCESS_MESSAGE);
    if (!my.canWrite) {
      throw new ForbiddenException('Наблюдатель не может копировать объект');
    }
    if (my.hidePrices || my.role === AccessRole.VIEWER) {
      throw new ForbiddenException(
        'Вам скрыты цены — копировать объект нельзя. Попросите администратора открыть цены.',
      );
    }
    return my;
  }

  /**
   * Объект + выбранные проекты. Если projectIds не передан — копируем все.
   * Чужие/несуществующие id — 400, чтобы не копировать «половину» молча.
   */
  private async loadSource(
    objectId: number,
    userId: number,
    projectIds?: number[],
  ): Promise<{ source: SourceObject; projects: SourceProject[] }> {
    await this.assertCanCopy(objectId, userId);

    const source = await this.prisma.object.findUnique({
      where: { id: objectId },
      include: {
        catalog: { select: { id: true, name: true } },
        projects: {
          orderBy: { createdAt: 'asc' },
          include: { materials: { orderBy: { id: 'asc' } } },
        },
      },
    });
    if (!source) throw new NotFoundException('Объект не найден');

    const allIds = new Set(source.projects.map((p) => p.id));
    const requested = projectIds == null ? null : [...new Set(projectIds)];
    if (requested) {
      const bad = requested.filter((id) => !allIds.has(id));
      if (bad.length) {
        throw new BadRequestException(
          `Проект(ы) не принадлежат объекту: ${bad.join(', ')}`,
        );
      }
    }
    const selected =
      requested == null
        ? source.projects
        : source.projects.filter((p) => requested.includes(p.id));
    return { source, projects: selected };
  }

  private toRef(
    item: Pick<PriceItem, 'id' | 'name' | 'article' | 'unit'> & {
      price: unknown;
    },
  ) {
    return {
      id: item.id,
      name: item.name,
      article: item.article,
      unit: item.unit,
      price: Number(item.price),
    };
  }

  private async loadCatalog(
    catalogId: number,
    userId: number,
    opts: { allowArchived?: boolean } = {},
  ): Promise<{ catalog: PriceCatalog; items: PriceItem[] }> {
    const access = await loadCatalogAccess(this.prisma, catalogId, userId);
    if (!access?.canRead) {
      throw new NotFoundException('Справочник не найден или нет доступа');
    }
    if (!opts.allowArchived && access.catalog.isArchived) {
      throw new BadRequestException('Справочник в архиве — выберите активный');
    }
    const catalog = await this.prisma.priceCatalog.findUnique({
      where: { id: catalogId },
    });
    if (!catalog) throw new NotFoundException('Справочник не найден');
    const items = await this.prisma.priceItem.findMany({
      where: { catalogId, isActive: true },
      orderBy: { id: 'asc' },
    });
    return { catalog, items };
  }

  private async resolveTarget(
    source: SourceObject,
    dto: CopyObjectDto,
    userId: number,
    warnings: string[],
  ): Promise<TargetCatalog | null> {
    if (dto.pricingMode === 'keep') {
      if (!source.catalogId) return null;
      const access = await loadCatalogAccess(
        this.prisma,
        source.catalogId,
        userId,
      );
      if (!access?.canRead) {
        warnings.push(
          'Справочник оригинала недоступен: цены скопируются снимком, но новый объект останется без справочника.',
        );
        return null;
      }
      return {
        id: source.catalogId,
        name: source.catalog?.name ?? access.catalog.name,
        source: 'source',
        items: [],
      };
    }

    if (dto.pricingMode === 'existing') {
      if (!dto.catalogId) {
        throw new BadRequestException('Выберите справочник для пересчёта');
      }
      const { catalog, items } = await this.loadCatalog(
        dto.catalogId,
        userId,
      );
      return {
        id: catalog.id,
        name: catalog.name,
        source: 'selected',
        items,
      };
    }

    // pricingMode === 'copy'
    const sourceCatalogId = dto.sourceCatalogId ?? source.catalogId ?? null;
    if (!sourceCatalogId) {
      throw new BadRequestException(
        'У объекта нет справочника — выберите исходный справочник для копии',
      );
    }
    const { catalog, items } = await this.loadCatalog(
      sourceCatalogId,
      userId,
      { allowArchived: true },
    );
    const markup = {
      workPercent: normalizeMarkup(dto.workMarkupPercent),
      materialPercent: normalizeMarkup(dto.materialMarkupPercent),
    };
    const suffix =
      markup.workPercent || markup.materialPercent
        ? ` (работы ${markup.workPercent > 0 ? '+' : ''}${markup.workPercent}%, материалы ${
            markup.materialPercent > 0 ? '+' : ''
          }${markup.materialPercent}%)`
        : '';
    return {
      id: null,
      name: dto.catalogName?.trim() || `Копия «${catalog.name}»${suffix}`,
      source: 'copy',
      // Базовые цены источника. Наценка применяется один раз — в prepare
      // (для превью) или при создании позиций новой копии справочника.
      items,
    };
  }

  /** Исходные расценки строк — запасной ключ, если название строки не совпало. */
  private async loadSourceRefs(
    rows: CopyPriceRow[],
  ): Promise<Map<number, RecalcPriceRef>> {
    const ids = [
      ...new Set(
        rows.flatMap((r) =>
          [r.priceItemId, r.materialItemId].filter(
            (id): id is number => id != null,
          ),
        ),
      ),
    ];
    if (!ids.length) return new Map();
    const items = await this.prisma.priceItem.findMany({
      where: { id: { in: ids } },
    });
    return new Map(items.map((item) => [item.id, this.toRef(item)]));
  }

  private async prepare(
    objectId: number,
    userId: number,
    dto: CopyObjectDto,
  ): Promise<CopyContext> {
    const warnings: string[] = [];
    const { source, projects } = await this.loadSource(
      objectId,
      userId,
      dto.projectIds,
    );
    const target = await this.resolveTarget(source, dto, userId, warnings);
    const rows: CopyPriceRow[] = projects.flatMap((p) =>
      p.materials.map((m) => ({
        id: m.id,
        name: m.name,
        article: m.article,
        unit: m.unit,
        specQuantity: Number(m.specQuantity),
        totalUsed: Number(m.totalUsed),
        priceItemId: m.priceItemId,
        unitPrice: Number(m.unitPrice),
        materialItemId: m.materialItemId,
        materialUnitPrice: Number(m.materialUnitPrice),
      })),
    );

    let plan: CopyPricePlan | null = null;
    if (dto.pricingMode !== 'keep' && target) {
      const targetItems =
        dto.pricingMode === 'copy'
          ? target.items.map((item) => ({
              ...item,
              price: markupPrice(item.price, item.kind, {
                workPercent: normalizeMarkup(dto.workMarkupPercent),
                materialPercent: normalizeMarkup(dto.materialMarkupPercent),
              }),
            }))
          : target.items;
      const refs = targetItems.map((i) => this.toRef(i));
      const kindById = new Map<number, PriceItem['kind']>(
        target.items.map((i) => [i.id, i.kind] as [number, PriceItem['kind']]),
      );
      const sourceRefs = await this.loadSourceRefs(rows);
      plan = buildObjectCopyPlan(
        rows,
        refs.filter((r) => kindById.get(r.id) === 'WORK'),
        refs.filter((r) => kindById.get(r.id) === 'MATERIAL'),
        undefined,
        sourceRefs,
      );
      return { source, projects, target, plan, sourceRefs, warnings };
    }
    return { source, projects, target, plan, sourceRefs: new Map(), warnings };
  }

  private assertStrict(plan: CopyPricePlan | null, strict?: boolean) {
    if (strict === false || !plan) return;
    if (plan.summary.unmatchedRows === 0) return;
    const sample = plan.issues
      .slice(0, 5)
      .map(
        (i) =>
          `${i.name} (${i.side === 'work' ? 'работа' : 'материал'}: ${
            i.reason === 'ambiguous' ? 'неоднозначно' : 'не найдено'
          })`,
      )
      .join('; ');
    throw new BadRequestException(
      `Не все позиции сопоставлены со справочником: ${plan.summary.unmatchedRows} из ${plan.summary.rows}. ${sample}. Снимите «Требовать полное соответствие», чтобы оставить у них старые цены.`,
    );
  }

  async preview(
    objectId: number,
    userId: number,
    dto: CopyObjectDto,
  ): Promise<ObjectCopyPreview> {
    const ctx = await this.prepare(objectId, userId, dto);
    const rows = ctx.projects.reduce((n, p) => n + p.materials.length, 0);
    return {
      pricingMode: dto.pricingMode,
      catalog: ctx.target
        ? {
            id: ctx.target.id,
            name: ctx.target.name,
            source: ctx.target.source,
          }
        : null,
      summary: ctx.plan?.summary ?? {
        rows,
        matchedRows: rows,
        unmatchedRows: 0,
        workUnmatched: 0,
        materialUnmatched: 0,
        priceChanges: 0,
        factsRows: ctx.projects.reduce(
          (n, p) =>
            n + p.materials.filter((m) => Number(m.totalUsed) > 0).length,
          0,
        ),
      },
      issueTotal: ctx.plan?.issues.length ?? 0,
      issues: ctx.plan?.issues.slice(0, 50) ?? [],
      warnings: ctx.warnings,
    };
  }

  private parseDate(value: string | undefined, fallback: Date, label: string) {
    const date = value ? new Date(value) : fallback;
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${label}: неверная дата`);
    }
    return date;
  }

  private async uniqueCatalogName(
    tx: Prisma.TransactionClient,
    userId: number,
    base: string,
  ): Promise<string> {
    const trimmed = base.trim() || 'Копия справочника';
    let name = trimmed;
    let i = 2;
    while (
      await tx.priceCatalog.findFirst({
        where: { ownerId: userId, name, isArchived: false },
        select: { id: true },
      })
    ) {
      name = `${trimmed} (${i++})`;
    }
    return name;
  }

  private async createCatalogCopy(
    tx: Prisma.TransactionClient,
    userId: number,
    target: TargetCatalog,
    dto: CopyObjectDto,
  ): Promise<{ catalog: PriceCatalog; idMap: Map<number, number> }> {
    const name = await this.uniqueCatalogName(tx, userId, target.name);
    const catalog = await tx.priceCatalog.create({
      data: { name, ownerId: userId },
    });
    const idMap = new Map<number, number>();
    for (const item of target.items) {
      const created = await tx.priceItem.create({
        data: {
          name: item.name,
          article: item.article,
          unit: item.unit,
          price: markupPrice(item.price, item.kind, {
            workPercent: normalizeMarkup(dto.workMarkupPercent),
            materialPercent: normalizeMarkup(dto.materialMarkupPercent),
          }),
          categoryId: item.categoryId,
          kind: item.kind,
          isActive: true,
          catalogId: catalog.id,
          ownerId: userId,
        },
      });
      idMap.set(item.id, created.id);
    }
    return { catalog, idMap };
  }

  async copy(objectId: number, userId: number, dto: CopyObjectDto) {
    const ctx = await this.prepare(objectId, userId, dto);
    this.assertStrict(ctx.plan, dto.strictMatch);

    const startDate = this.parseDate(
      dto.startDate,
      ctx.source.startDate,
      'Дата начала',
    );
    const endDate = this.parseDate(
      dto.endDate,
      ctx.source.endDate,
      'Дата окончания',
    );
    if (endDate < startDate) {
      throw new BadRequestException(
        'Дата окончания не может быть раньше даты начала',
      );
    }
    const name = (dto.name ?? ctx.source.name).trim();
    const address = (dto.address ?? ctx.source.address).trim();
    if (!name) throw new BadRequestException('Название объекта обязательно');
    if (!address) throw new BadRequestException('Адрес обязателен');

    const result = await this.prisma.$transaction(
      async (tx) => {
        let targetCatalogId = ctx.target?.id ?? null;
        let plan = ctx.plan;
        let catalogName = ctx.target?.name ?? null;

        // Копию справочника создаём в той же транзакции: если объект не
        // скопировался, справочник-сирота не останется.
        if (dto.pricingMode === 'copy' && ctx.target) {
          const createdCatalog = await this.createCatalogCopy(
            tx,
            userId,
            ctx.target,
            dto,
          );
          targetCatalogId = createdCatalog.catalog.id;
          catalogName = createdCatalog.catalog.name;
          const createdItems = await tx.priceItem.findMany({
            where: { catalogId: createdCatalog.catalog.id, isActive: true },
            orderBy: { id: 'asc' },
          });
          const refs = createdItems.map((i) => this.toRef(i));
          const itemById = new Map(createdItems.map((i) => [i.id, i]));
          plan = buildObjectCopyPlan(
            ctx.projects.flatMap((p) =>
              p.materials.map((m) => ({
                id: m.id,
                name: m.name,
                article: m.article,
                unit: m.unit,
                specQuantity: Number(m.specQuantity),
                totalUsed: Number(m.totalUsed),
                priceItemId: m.priceItemId,
                unitPrice: Number(m.unitPrice),
                materialItemId: m.materialItemId,
                materialUnitPrice: Number(m.materialUnitPrice),
              })),
            ),
            refs.filter((r) => itemById.get(r.id)?.kind === 'WORK'),
            refs.filter((r) => itemById.get(r.id)?.kind === 'MATERIAL'),
            createdCatalog.idMap,
            ctx.sourceRefs,
          );
          this.assertStrict(plan, dto.strictMatch);
        }

        const plannedByMaterial = new Map<number, CopyPricePlanRow>(
          (plan?.rows ?? []).map((r) => [r.materialId, r]),
        );

        const created = await tx.object.create({
          data: {
            name,
            address,
            startDate,
            endDate,
            plannedEndDate:
              dto.startDate || dto.endDate
                ? endDate
                : (ctx.source.plannedEndDate ?? endDate),
            note:
              dto.note !== undefined
                ? dto.note.trim() || null
                : ctx.source.note,
            isArchived: false,
            isDemo: false,
            createdById: userId,
            catalogId: targetCatalogId,
            accesses: {
              create: {
                userId,
                role: AccessRole.CUSTOMER,
                canCreateProjects: true,
                hidePrices: false,
              },
            },
          },
          select: { id: true },
        });

        let materialCount = 0;
        let sumSpec = 0;
        let sumUsed = 0;
        let sumCost = 0;

        for (const project of ctx.projects) {
          // ⭐ №271: у копии каждого проекта — свой справочник.
          const sourceCatalogId =
            dto.pricingMode === 'keep'
              ? (project.catalogId ?? ctx.source.catalogId)
              : targetCatalogId;
          const projectCatalog = await copyCatalogWithMap(tx, {
            projectName: project.name,
            ownerId: userId,
            sourceCatalogId,
          });
          const createdProject = await tx.project.create({
            data: {
              name: project.name,
              note: project.note,
              objectId: created.id,
              startDate: project.startDate,
              endDate: project.endDate,
              catalogId: projectCatalog.catalog.id,
            },
            select: { id: true },
          });

          for (const material of project.materials) {
            const planned = plannedByMaterial.get(material.id);
            const used = dto.copyFacts ? Number(material.totalUsed) : 0;
            const unitPrice = planned
              ? planned.work.itemId != null
                ? planned.work.newPrice
                : planned.work.oldPrice
              : Number(material.unitPrice);
            const materialUnitPrice = planned
              ? planned.material.itemId != null
                ? planned.material.newPrice
                : planned.material.oldPrice
              : Number(material.materialUnitPrice);
            const targetWorkId = planned
              ? planned.work.itemId
              : material.priceItemId;
            const targetMaterialId = planned
              ? planned.material.itemId
              : material.materialItemId;
            const priceItemId =
              targetWorkId != null
                ? (projectCatalog.idMap.get(targetWorkId) ?? null)
                : null;
            const materialItemId =
              targetMaterialId != null
                ? (projectCatalog.idMap.get(targetMaterialId) ?? null)
                : null;
            const specQuantity = Number(material.specQuantity);
            const progress =
              dto.copyFacts && specQuantity > 0
                ? Math.round((used / specQuantity) * 100)
                : 0;
            const totalCost = roundMoney(used * unitPrice);
            const materialTotalCost = roundMoney(
              used * materialUnitPrice,
            );

            await tx.material.create({
              data: {
                name: material.name,
                article: material.article,
                unit: material.unit,
                specQuantity,
                totalUsed: used,
                lastEntry: dto.copyFacts ? material.lastEntry : null,
                lastEntryDate: dto.copyFacts
                  ? material.lastEntryDate
                  : null,
                note: material.note,
                progressPercent: progress,
                isSpecLocked: material.isSpecLocked,
                priceItemId,
                unitPrice,
                totalCost,
                materialItemId,
                materialUnitPrice,
                materialTotalCost,
                projectId: createdProject.id,
              },
            });
            materialCount += 1;
            sumSpec += specQuantity;
            sumUsed += used;
            sumCost += totalCost + materialTotalCost;
          }
        }

        return {
          objectId: created.id,
          materialCount,
          progressPercent:
            sumSpec > 0 ? Math.round((sumUsed / sumSpec) * 100) : 0,
          totalCost: roundMoney(sumCost),
          catalogId: targetCatalogId,
          catalogName,
          summary: plan?.summary ?? null,
        };
      },
      { timeout: 30_000, maxWait: 10_000 },
    );

    await this.audit.log(
      userId,
      'object',
      result.objectId,
      'copy',
      { sourceObjectId: objectId },
      {
        projectIds: ctx.projects.map((p) => p.id),
        copyFacts: dto.copyFacts === true,
        pricingMode: dto.pricingMode,
        catalogId: result.catalogId,
        materials: result.materialCount,
        matchedRows: result.summary?.matchedRows ?? null,
        unmatchedRows: result.summary?.unmatchedRows ?? null,
      },
    );

    const created = await this.objects.findOne(result.objectId, userId);
    return {
      ...created,
      projectsCount: ctx.projects.length,
      progressPercent: result.progressPercent,
      totalCost: result.totalCost,
      catalog:
        result.catalogId != null
          ? { id: result.catalogId, name: result.catalogName ?? 'Справочник' }
          : null,
      copyStats: {
        projects: ctx.projects.length,
        materials: result.materialCount,
        factsCopied: dto.copyFacts === true,
        pricingMode: dto.pricingMode,
        catalogId: result.catalogId,
        catalogName: result.catalogName,
        summary: result.summary,
        warnings: ctx.warnings,
      },
    };
  }
}
