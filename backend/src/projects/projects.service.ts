// backend/src/projects/projects.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service'; // ⭐ №168: журнал удалений
import { CreateProjectDto } from './dto/create-project.dto';
import { CopyEstimateDto } from './dto/copy-estimate.dto'; // ⭐ №286
import { CopyProjectDto } from './dto/copy-project.dto'; // ⭐ №307
import { roundMoney } from '../estimate-recalc/recalc-plan'; // ⭐ №307: суммы копии
import {
  REVOKED_ACCESS_MESSAGE,
  assertAccessActive,
  accessibleProjectWhere, // ⭐ №286: список доступных проектов
  buildAccessScope, // ⭐ №286: список доступных проектов
  findLiveAccess,
  findProjectAccess,
  loadAccessGrants,
  resolveObjectRole,
  resolveProjectAccess,
} from '../auth/access-scope'; // ⭐ №163, №193, №204
import { ensureWorkingCatalog } from '../price-list/working-catalog'; // ⭐ №274
import { loadCatalogAccess } from '../price-list/catalog-access';
import {
  emptyMaterialTotals,
  loadMaterialTotals,
  loadMaterialTotalsForProject,
  materialsProgressPercent,
} from '../materials/material-totals'; // ⭐ №380: итоги сметы в SQL

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService, // ⭐ №168
  ) {}

  // ⭐ №168: отозванный доступ и наблюдатель — только чтение.
  private assertWritable(
    access: { role?: string; revokedAt?: Date | null },
    action: string,
  ) {
    if (access.revokedAt) {
      throw new ForbiddenException(
        `Доступ отозван: ${action} недоступно. Снимок данных сохранён в ваших шаблонах.`,
      );
    }
    if (access.role === AccessRole.VIEWER) {
      throw new ForbiddenException(`Наблюдатель не может ${action}`);
    }
  }

  // ⭐ Хелпер: проверяет доступ к объекту. Кидает 403 если доступа нет.
  // Детерминированный резолв: объектный контекст требует общую запись (projectId: null).
  private async checkObjectAccess(objectId: number, userId: number) {
    const access = await findLiveAccess(this.prisma, {
      userId,
      objectId,
      projectId: null,
    });
    if (!access) {
      throw new NotFoundException('Объект не найден');
    }
    assertAccessActive(access); // ⭐ №193 (A₂ F1): отозванный доступ живых данных не читает
    return access;
  }

  // ⭐ Хелпер: проверяет доступ к объекту ЧЕРЕЗ проект (находит objectId проекта).
  // Детерминированный резолв: сначала проектная запись (projectId), потом общая (null).
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
      throw new NotFoundException('Объект не найден');
    }
    assertAccessActive(access); // ⭐ №193 (A₂ F1)
    return access;
  }

  // ⭐ Нужно ли скрывать цены для этой записи доступа
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
    if (access.role === 'VIEWER') return true;
    return access.hidePrices ?? false;
  }

  // ⭐ №158/№164: справочник, доступный пользователю (системный, свой, объектный/проектный) и не в архиве
  private async resolveCatalogId(
    catalogId: number,
    userId?: number,
  ): Promise<number> {
    const catalog = await this.prisma.priceCatalog.findFirst({
      where: {
        id: catalogId,
        ...(userId
          ? {
              OR: [
                { ownerId: null },
                { ownerId: userId },
                { objects: { some: { accesses: { some: { userId } } } } },
                {
                  projects: {
                    some: { object: { accesses: { some: { userId } } } },
                  },
                },
              ],
            }
          : { ownerId: null }),
      },
      select: { id: true, isArchived: true },
    });
    if (!catalog) {
      throw new NotFoundException('Справочник цен не найден или нет доступа');
    }
    if (catalog.isArchived) {
      throw new BadRequestException(
        'Справочник цен в архиве — выберите активный',
      );
    }
    return catalog.id;
  }

  async create(dto: CreateProjectDto, userId: number) {
    // Валидация дат на уровне сервиса
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (isNaN(startDate.getTime())) {
      throw new BadRequestException('Невалидная дата начала');
    }
    if (isNaN(endDate.getTime())) {
      throw new BadRequestException('Невалидная дата окончания');
    }
    if (endDate < startDate) {
      throw new BadRequestException(
        'Дата окончания не может быть раньше даты начала',
      );
    }

    // ⭐ Проверяем доступ к объекту (вместо старой проверки по организации)
    const access = await this.checkObjectAccess(dto.objectId, userId);
    // Наблюдатель не может создавать проекты (и отозванный — тоже)
    this.assertWritable(access, 'создавать проекты');
    // ⭐ №207: создавать проекты может администратор объекта (CUSTOMER) или прораб,
    // которому это право выдал админ объекта / одобрил его заявку (canCreateProjects).
    if (
      access.role !== AccessRole.CUSTOMER &&
      access.canCreateProjects !== true
    ) {
      throw new ForbiddenException(
        'Создавать проекты может администратор объекта. Отправьте заявку — администратор объекта её одобрит.',
      );
    }

    // ⭐ №274 (§117): выбранный справочник — это ПРИВЯЗКА проекта, а не источник копии.
    // Не выбран → рабочая база создателя. Копий позиций нет: цены общие.
    const explicitCatalogId =
      dto.catalogId != null
        ? await this.resolveCatalogId(dto.catalogId, userId)
        : null;
    if (explicitCatalogId != null) {
      const catalogAccess = await loadCatalogAccess(
        this.prisma,
        explicitCatalogId,
        userId,
      );
      if (!catalogAccess?.canWrite) {
        throw new ForbiddenException(
          'Нет прав на изменение цен выбранного справочника — выберите свою базу',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const catalogId =
        explicitCatalogId ?? (await ensureWorkingCatalog(tx, userId)).id;
      return tx.project.create({
        data: {
          name: dto.name.trim(),
          startDate,
          endDate,
          objectId: dto.objectId,
          catalogId,
          note: dto.note || null,
        },
        include: { catalog: { select: { id: true, name: true } } },
      });
    });
  }

  /**
   * ⭐ №286: проекты, из которых можно взять смету при создании нового.
   * Отдаём всё, что видит пользователь (объектный или точечный доступ), кроме объектов
   * в личном архиве и пустых смет — копировать из них нечего.
   */
  async listAvailableForCopy(userId: number) {
    const grants = await loadAccessGrants(this.prisma, userId);
    const scope = buildAccessScope(grants);
    const hiddenObjectIds = new Set(
      grants
        .filter((g) => g.projectId == null && g.isHidden)
        .map((g) => g.objectId),
    );
    const rows = await this.prisma.project.findMany({
      // ⭐ общий where «доступные проекты» — правила доступа не дублируем
      where: accessibleProjectWhere(scope),
      select: {
        id: true,
        name: true,
        objectId: true,
        object: { select: { name: true } },
        _count: { select: { materials: true } },
      },
      orderBy: [{ objectId: 'asc' }, { createdAt: 'desc' }],
    });
    return rows
      .filter((p) => !hiddenObjectIds.has(p.objectId) && p._count.materials > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        objectId: p.objectId,
        objectName: p.object.name,
        materialsCount: p._count.materials,
      }));
  }

  /**
   * ⭐ №286: скопировать смету из другого проекта в ПУСТОЙ проект.
   * Переносим только спецификацию и цены (снимок): название, артикул, единицу, количество,
   * цену работы/материала и ссылки на позиции справочника. Прогресс, факт, фиксации и фото
   * не переносятся — новый проект начинается с 0 %.
   * `zeroQuantities` = true → количества обнуляем (остаются названия и единицы).
   */
  async copyEstimate(
    targetProjectId: number,
    dto: CopyEstimateDto,
    userId: number,
  ) {
    if (dto.sourceProjectId === targetProjectId) {
      throw new BadRequestException(
        'Нельзя скопировать смету проекта в него же',
      );
    }
    // Цель: право записи (наблюдатель и отозванный доступ — нельзя)
    const targetAccess = await this.checkProjectAccess(targetProjectId, userId);
    this.assertWritable(targetAccess, 'копировать смету в проект');
    // Источник: должен быть виден пользователю, а цены — не скрыты его ролью
    const sourceAccess = await this.checkProjectAccess(
      dto.sourceProjectId,
      userId,
    );
    if (this.mustHidePrices(sourceAccess)) {
      throw new ForbiddenException(
        'Цены проекта-источника скрыты для вашей роли — смету скопировать нельзя',
      );
    }

    // ⭐ №377: проверка «проект пуст» и вставка — в одной транзакции с блокировкой
    // проекта, иначе два параллельных copy-estimate дублируют смету.
    return this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM "Project" WHERE id = ${targetProjectId} FOR UPDATE
      `;
      if (!locked) {
        throw new NotFoundException('Проект не найден');
      }
      const existing = await tx.material.count({
        where: { projectId: targetProjectId },
      });
      // ⭐ №290: при создании проекта копируем только в пустой проект (защита от дублей),
      // а кнопка «Добавить из шаблона» в смете дополняет непустую смету (append = true).
      if (existing > 0 && dto.append !== true) {
        throw new BadRequestException(
          'В проекте уже есть позиции — смету можно копировать только в пустой проект',
        );
      }

      const rows = await tx.material.findMany({
        where: { projectId: dto.sourceProjectId },
        orderBy: { id: 'asc' },
        select: {
          name: true,
          article: true,
          unit: true,
          specQuantity: true,
          unitPrice: true,
          materialUnitPrice: true,
          priceItemId: true,
          materialItemId: true,
        },
      });
      if (rows.length === 0) return { created: 0 };

      await tx.material.createMany({
        data: rows.map((m) => ({
          name: m.name,
          article: m.article,
          unit: m.unit,
          specQuantity: dto.zeroQuantities ? 0 : m.specQuantity,
          unitPrice: m.unitPrice,
          materialUnitPrice: m.materialUnitPrice,
          priceItemId: m.priceItemId,
          materialItemId: m.materialItemId,
          projectId: targetProjectId,
          isSpecLocked: true, // защита спецификации, как у обычных позиций
        })),
      });
      return { created: rows.length };
    });
  }

  /**
   * ⭐ №307: копия проекта внутри того же объекта — как «Копировать объект», только проще.
   * Переносим карточку (название/даты/заметку) и смету: позиции, единицы, количества,
   * цены-снимки и ссылки на расценки. Факт (расход/прогресс/последнюю фиксацию) —
   * только по галочке copyFacts. Фото, история фиксаций, скрытие и участники НЕ копируются.
   */
  async copyProject(sourceId: number, dto: CopyProjectDto, userId: number) {
    // Источник: должен быть виден, доступ не отозван, и цены не должны быть скрыты —
    // иначе копия молча открыла бы деньги, которых пользователь не видит.
    const sourceAccess = await this.checkProjectAccess(sourceId, userId);
    this.assertWritable(sourceAccess, 'копировать проект');
    if (this.mustHidePrices(sourceAccess)) {
      throw new ForbiddenException(
        'Цены проекта скрыты для вашей роли — копию создать нельзя',
      );
    }

    const source = await this.prisma.project.findUnique({
      where: { id: sourceId },
      include: { materials: { orderBy: { id: 'asc' } } },
    });
    if (!source) throw new NotFoundException('Проект не найден');

    // Новый проект создаём по тем же правилам, что обычное создание: админ объекта
    // или прораб с правом создания проектов.
    const objectAccess = await this.checkObjectAccess(source.objectId, userId);
    if (
      objectAccess.role !== AccessRole.CUSTOMER &&
      objectAccess.canCreateProjects !== true
    ) {
      throw new ForbiddenException(
        'Создавать проекты может администратор объекта. Отправьте заявку — администратор объекта её одобрит.',
      );
    }

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : source.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : source.endDate;
    if (isNaN(startDate.getTime())) {
      throw new BadRequestException('Невалидная дата начала');
    }
    if (isNaN(endDate.getTime())) {
      throw new BadRequestException('Невалидная дата окончания');
    }
    if (endDate < startDate) {
      throw new BadRequestException(
        'Дата окончания не может быть раньше даты начала',
      );
    }

    const name = dto.name?.trim() || `${source.name} (копия)`;
    const note = dto.note !== undefined ? dto.note.trim() || null : source.note;
    const copyFacts = dto.copyFacts === true;

    const created = await this.prisma.$transaction(
      async (tx) => {
        const project = await tx.project.create({
          data: {
            name,
            startDate,
            endDate,
            objectId: source.objectId,
            // ⭐ №274: справочник-привязку переносим как есть (может быть null)
            catalogId: source.catalogId,
            note,
          },
        });
        if (source.materials.length > 0) {
          await tx.material.createMany({
            data: source.materials.map((m) => {
              const specQuantity = Number(m.specQuantity);
              const unitPrice = Number(m.unitPrice);
              const materialUnitPrice = Number(m.materialUnitPrice);
              // Без факта копия «чистая»: расход 0, суммы 0, прогресс 0
              const used = copyFacts ? Number(m.totalUsed) : 0;
              return {
                name: m.name,
                article: m.article,
                unit: m.unit,
                specQuantity,
                totalUsed: used,
                lastEntry: copyFacts ? m.lastEntry : null,
                lastEntryDate: copyFacts ? m.lastEntryDate : null,
                note: m.note,
                progressPercent:
                  copyFacts && specQuantity > 0
                    ? Math.round((used / specQuantity) * 100)
                    : 0,
                isSpecLocked: m.isSpecLocked,
                priceItemId: m.priceItemId,
                unitPrice,
                totalCost: roundMoney(used * unitPrice),
                materialItemId: m.materialItemId,
                materialUnitPrice,
                materialTotalCost: roundMoney(used * materialUnitPrice),
                projectId: project.id,
              };
            }),
          });
        }
        return project;
      },
      { timeout: 30_000, maxWait: 10_000 },
    );

    // ⭐ №131: журнал копирования
    await this.audit.log(userId, 'project', created.id, 'copy', {
      sourceProjectId: sourceId,
      name,
      copyFacts,
      materials: source.materials.length,
    });

    const card = await this.findOne(created.id, userId);
    return {
      ...card,
      copyStats: {
        sourceProjectId: sourceId,
        materials: source.materials.length,
        factsCopied: copyFacts,
      },
    };
  }

  async findAllByObject(
    objectId: number,
    userId: number,
    includeHidden = false,
  ) {
    // ⭐ №163: участник, приглашённый в один проект, получает только его
    // (раньше checkObjectAccess требовал projectId=null и отдавал 403).
    const grants = await loadAccessGrants(this.prisma, userId);
    const my = resolveObjectRole(grants, objectId);
    if (!my.role) {
      throw new NotFoundException('Объект не найден');
    }
    // ⭐ №169: объект в ЛИЧНОМ архиве → его проекты не предлагаем в выборах.
    // Иначе демо-объект, убранный в архив, продолжал подсовывать свои проекты
    // в «Зафиксировать выход» и фильтры.
    // ⭐ №172: но из карточки бригады проекты нужны — там выбор идёт строго
    // внутри объекта бригады, поэтому фронт просит includeHidden=1.
    if (
      !includeHidden &&
      grants.some((g) => g.objectId === objectId && g.isHidden)
    ) {
      return [];
    }
    const hidePrices = my.hidePrices;

    // ⭐ №306: команда проекта — для подписи кнопки «Участники проекта · N».
    // Считаем людей, которые видят проект: участники всего объекта (они видны
    // во всех проектах) + точечно приглашённые в этот проект. Отозванные не в счёте.
    // Счётчик отдаём только администратору объекта — как participantsCount у объектов.
    const objectWideUsers = new Set<number>();
    const projectOnlyUsers = new Map<number, Set<number>>();
    if (my.canManage) {
      const rows = await this.prisma.objectAccess.findMany({
        where: { objectId, revokedAt: null },
        select: { userId: true, projectId: true },
      });
      for (const row of rows) {
        if (row.userId == null) continue;
        if (row.projectId == null) {
          objectWideUsers.add(row.userId);
        } else {
          const set = projectOnlyUsers.get(row.projectId) ?? new Set<number>();
          set.add(row.userId);
          projectOnlyUsers.set(row.projectId, set);
        }
      }
    }

    // ⭐ №249: личный архив проектов — скрываем только у этого пользователя.
    // includeHidden=1 нужен странице «Проекты» (режим «Архив») и карточке бригады.
    const hiddenRows = await this.prisma.projectHidden.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const hiddenIds = hiddenRows.map((r) => r.projectId);
    const hiddenSet = new Set(hiddenIds);

    // Проекты, доступные юзеру внутри объекта
    const allowedProjectIds = grants
      .filter(
        (g) =>
          g.objectId === objectId &&
          g.projectId != null &&
          // ⭐ №372 (P1): отозванный проектный грант не должен открывать проект
          !g.revokedAt,
      )
      .map((g) => g.projectId as number);
    const projectFilter = my.hasObjectAccess
      ? {}
      : { id: { in: allowedProjectIds } };

    // ⭐ №380: строки материалов больше не выгружаем — суммы считает SQL.
    // RepeatableRead держит счётчик и суммы в одном снапшоте, иначе между
    // двумя запросами может прилететь фиксация («позиций 12, сумма как у 13»).
    const [projects, totalsByProject] = await this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.project.findMany({
          where: {
            objectId,
            ...projectFilter,
            ...(includeHidden || hiddenIds.length === 0
              ? {}
              : { id: { notIn: hiddenIds } }),
          },
          orderBy: { createdAt: 'desc' },
          // ⭐ №380: object-справочник в списке не использовался (фронт читает
          // effectiveCatalog*), поэтому лишний join убран вместе с materials.
          include: { catalog: { select: { id: true, name: true } } },
        });
        const totals = await loadMaterialTotals(
          tx,
          rows.map((row) => row.id),
        );
        return [rows, totals] as const;
      },
      { isolationLevel: 'RepeatableRead' },
    );

    // ⭐ Честный процент: Σ Итого / Σ По спец × 100 по материалам проекта
    return projects.map((p) => {
      // 🔒 Проект без строк остаётся в списке: groupBy его не возвращает.
      const totals = totalsByProject.get(p.id) ?? emptyMaterialTotals();
      return {
        ...p,
        materialsCount: totals.count,
        progressPercent: materialsProgressPercent(totals),
        // ⭐ Скрываем стоимость, если у юзера скрыты цены
        totalCost: hidePrices ? 0 : totals.sumCost,
        // ⭐ №271: справочник проекта — собственный, без наследования объекта
        effectiveCatalogId: p.catalog?.id ?? null,
        effectiveCatalogName: p.catalog?.name ?? null,
        catalogSource: p.catalog ? 'project' : null,
        // ⭐ №188: права на проект — для серых кнопок в меню действий на фронте
        canWrite: my.canWrite,
        canManage: my.canManage,
        // ⭐ №204 (A#10): карточку проекта правит/удаляет только участник ВСЕГО объекта.
        // Участник одного проекта работает со сметой, но не с карточкой проекта.
        canEditCard: my.hasObjectAccess && my.canWrite,
        canDeleteCard: my.canManage,
        // ⭐ №249: личный архив проекта + срок удаления
        hiddenForMe: hiddenSet.has(p.id),
        // ⭐ №306: сколько людей видит проект (подпись кнопки «Участники проекта»)
        participantsCount: my.canManage
          ? new Set<number>([
              ...objectWideUsers,
              ...(projectOnlyUsers.get(p.id) ?? []),
            ]).size
          : null,
      };
    });
  }

  async findOne(id: number, userId?: number) {
    // Если пришёл userId — проверяем доступ (запоминаем access для скрытия цен)
    let access: any = null;
    if (userId) {
      access = await this.checkProjectAccess(id, userId);
    }
    const hidePrices = this.mustHidePrices(access);
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        catalog: { select: { id: true, name: true } },
      },
    });
    if (!project) return null;

    // ⭐ №204 (A#10): права на САМ ОБЪЕКТ — от них зависит, можно ли менять карточку проекта
    const grants = userId ? await loadAccessGrants(this.prisma, userId) : [];
    const objectRole = userId
      ? resolveObjectRole(grants, project.objectId)
      : null;
    // ⭐ №252: права на проект и личный архив — чтобы после PATCH карточка
    // не теряла кнопки/прогресс (фронт получает полный объект)
    const projectRole = userId
      ? resolveProjectAccess(grants, project.objectId, id)
      : null;
    const hidden = userId
      ? await this.prisma.projectHidden.findUnique({
          where: { userId_projectId: { userId, projectId: id } },
          select: { id: true },
        })
      : null;

    // ⭐ №380: суммы — одним groupBy, без выгрузки строк проекта.
    const totals = await loadMaterialTotalsForProject(this.prisma, id);
    return {
      ...project,
      materialsCount: totals.count,
      progressPercent: materialsProgressPercent(totals),
      // ⭐ Скрываем стоимость, если у юзера скрыты цены
      totalCost: hidePrices ? 0 : totals.sumCost,
      // ⭐ №271: справочник проекта — собственный, без наследования объекта
      effectiveCatalogId: project.catalog?.id ?? null,
      effectiveCatalogName: project.catalog?.name ?? null,
      catalogSource: project.catalog ? 'project' : null,
      // ⭐ №204 (A#10): карточку проекта правит/удаляет только участник всего объекта
      // ⭐ №252: полный набор UI-полей — чтобы PATCH не обнулял прогресс/права
      canWrite: projectRole ? projectRole.canWrite : false,
      canManage: projectRole ? projectRole.canManage : false,
      hiddenForMe: !!hidden,
      canEditCard: objectRole
        ? objectRole.hasObjectAccess && objectRole.canWrite
        : false,
      canDeleteCard: objectRole ? objectRole.canManage : false,
    };
  }

  // ⭐ №204 (A#10): карточка проекта — объектное право, а не проектное.
  // «Гость» одного проекта работает со сметой, но не переименовывает проект и не меняет даты.
  private async assertObjectCardAccess(
    projectId: number,
    userId: number,
    mode: 'write' | 'manage',
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) throw new NotFoundException('Проект не найден');
    const grants = await loadAccessGrants(this.prisma, userId);
    const my = resolveObjectRole(grants, project.objectId);
    if (!my.role) throw new NotFoundException('Объект не найден');
    if (my.revoked) throw new ForbiddenException(REVOKED_ACCESS_MESSAGE);
    const allowed =
      mode === 'write' ? my.hasObjectAccess && my.canWrite : my.canManage;
    if (!allowed) {
      throw new ForbiddenException(
        mode === 'write'
          ? 'Карточку проекта меняет участник всего объекта с правом записи'
          : 'Удалить проект может администратор объекта',
      );
    }
  }

  async update(id: number, dto: Partial<CreateProjectDto>, userId?: number) {
    if (userId) {
      await this.assertObjectCardAccess(id, userId, 'write');
    }
    // ⭐ №274: смена справочника проекта. `null` → рабочая база автора изменения:
    // отвязывать проект от цен нельзя, у сметы всегда должен быть источник.
    let nextCatalogId: number | undefined;
    if (dto.catalogId !== undefined) {
      if (dto.catalogId === null) {
        nextCatalogId = userId
          ? (await ensureWorkingCatalog(this.prisma, userId)).id
          : undefined;
      } else {
        const resolved = await this.resolveCatalogId(dto.catalogId, userId);
        const access = userId
          ? await loadCatalogAccess(this.prisma, resolved, userId)
          : null;
        if (!access?.canWrite) {
          throw new ForbiddenException(
            'Нет прав на изменение цен выбранного справочника — выберите свою базу',
          );
        }
        nextCatalogId = resolved;
      }
    }
    await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        note: dto.note !== undefined ? dto.note : undefined,
        catalogId: nextCatalogId,
      },
    });
    // ⭐ Возвращаем проект с честным процентом (та же форма, что в списке)
    return this.findOne(id, userId);
  }

  // ⭐ №249: личный архив проекта (скрыт только у меня). Остальные участники
  // продолжают видеть проект; объект и его данные не меняются.
  async setHidden(projectId: number, userId: number, isHidden: boolean) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) throw new NotFoundException('Проект не найден');
    const grants = await loadAccessGrants(this.prisma, userId);
    const my = resolveProjectAccess(grants, project.objectId, projectId);
    if (!my.role) throw new NotFoundException('Проект не найден');
    if (my.revoked) throw new ForbiddenException(REVOKED_ACCESS_MESSAGE);

    if (isHidden) {
      await this.prisma.projectHidden.upsert({
        where: { userId_projectId: { userId, projectId } },
        create: { userId, projectId },
        update: {},
      });
    } else {
      await this.prisma.projectHidden.deleteMany({
        where: { userId, projectId },
      });
      // ⭐ №249: «Вернуть» снимает срок удаления, если его назначал этот же юзер
      await this.prisma.project.updateMany({
        where: { id: projectId, deleteRequestedBy: userId },
        data: {
          deleteRequestedAt: null,
          deleteAfter: null,
          deleteRequestedBy: null,
        },
      });
    }
    return { success: true, isHidden, projectId };
  }

  // ⚠️ №168: жёсткое удаление разрешено только для ПУСТОГО проекта (создан по ошибке).
  // Всё остальное — это чужие данные (материалы, акты, склад, выходы бригад),
  // поэтому проект с данными удалить нельзя: его просто убирают из своего архива.
  async remove(id: number, userId?: number) {
    if (userId) {
      await this.assertObjectCardAccess(id, userId, 'manage');
    }

    const [materials, reports, transactions, shifts] = await Promise.all([
      this.prisma.material.count({ where: { projectId: id } }),
      this.prisma.report.count({ where: { projectId: id } }),
      this.prisma.warehouseTransaction.count({ where: { projectId: id } }),
      this.prisma.brigadeShift.count({ where: { projectId: id } }),
    ]);
    if (materials + reports + transactions + shifts > 0) {
      throw new BadRequestException(
        `Проект не пуст: ${materials} материалов, ${reports} отчётов, ${transactions} складских операций. ` +
          'Удаление запрещено — данные принадлежат всем участникам. Уберите проект в личный архив.',
      );
    }

    const deleted = await this.prisma.project.delete({ where: { id } });
    if (userId) {
      await this.audit.log(userId, 'project', id, 'delete', {
        name: deleted.name,
        objectId: deleted.objectId,
      });
    }
    return deleted;
  }
}
