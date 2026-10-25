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
import { loadAccessGrants, resolveObjectRole } from '../auth/access-scope'; // ⭐ №163

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
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId, projectId: null },
    });
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
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
    const access =
      (await this.prisma.objectAccess.findFirst({
        where: { userId, objectId: project.objectId, projectId },
      })) ??
      (await this.prisma.objectAccess.findFirst({
        where: { userId, objectId: project.objectId, projectId: null },
      }));
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    return access;
  }

  // ⭐ Нужно ли скрывать цены для этой записи доступа
  private mustHidePrices(
    access?: { role?: string; hidePrices?: boolean; revokedAt?: Date | null } | null,
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

    // ⭐ №158: справочник проекта (если передан)
    const catalogId =
      dto.catalogId != null ? await this.resolveCatalogId(dto.catalogId, userId) : null;

    return this.prisma.project.create({
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
  }

  async findAllByObject(objectId: number, userId: number, includeHidden = false) {
    // ⭐ №163: участник, приглашённый в один проект, получает только его
    // (раньше checkObjectAccess требовал projectId=null и отдавал 403).
    const grants = await loadAccessGrants(this.prisma, userId);
    const my = resolveObjectRole(grants, objectId);
    if (!my.role) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    // ⭐ №169: объект в ЛИЧНОМ архиве → его проекты не предлагаем в выборах.
    // Иначе демо-объект, убранный в архив, продолжал подсовывать свои проекты
    // в «Зафиксировать выход» и фильтры.
    // ⭐ №172: но из карточки бригады проекты нужны — там выбор идёт строго
    // внутри объекта бригады, поэтому фронт просит includeHidden=1.
    if (!includeHidden && grants.some((g) => g.objectId === objectId && g.isHidden)) {
      return [];
    }
    const hidePrices = my.hidePrices;

    // Проекты, доступные юзеру внутри объекта
    const allowedProjectIds = grants
      .filter((g) => g.objectId === objectId && g.projectId != null)
      .map((g) => g.projectId as number);
    const projectFilter = my.hasObjectAccess
      ? {}
      : { id: { in: allowedProjectIds } };

    const projects = await this.prisma.project.findMany({
      where: { objectId, ...projectFilter },
      orderBy: { createdAt: 'desc' },
      include: {
        materials: {
          select: { specQuantity: true, totalUsed: true, totalCost: true },
        },
        catalog: { select: { id: true, name: true } },
        // ⭐ №164: справочник объекта — фолбэк, если у проекта свой не выбран
        object: {
          select: {
            catalogId: true,
            catalog: { select: { id: true, name: true } },
          },
        },
      },
    });

    // ⭐ Честный процент: Σ Итого / Σ По спец × 100 по материалам проекта
    return projects.map((p) => {
      // 🔒 P1-3: Decimal-поля приводим к number (иначе reduce склеивает строки)
      const sumSpec = p.materials.reduce(
        (a, m) => a + Number(m.specQuantity || 0),
        0,
      );
      const sumUsed = p.materials.reduce(
        (a, m) => a + Number(m.totalUsed || 0),
        0,
      );
      const sumCost = p.materials.reduce(
        (a, m) => a + Number(m.totalCost || 0),
        0,
      );
      const { materials, object, ...rest } = p;
      return {
        ...rest,
        materialsCount: p.materials.length,
        progressPercent:
          sumSpec > 0 ? Math.round((sumUsed / sumSpec) * 100) : 0,
        // ⭐ Скрываем стоимость, если у юзера скрыты цены
        totalCost: hidePrices ? 0 : sumCost,
        // ⭐ №164: действующий справочник проекта (свой → объекта → нет)
        effectiveCatalogId: p.catalog?.id ?? object.catalog?.id ?? null,
        effectiveCatalogName: p.catalog?.name ?? object.catalog?.name ?? null,
        catalogSource: p.catalog ? 'project' : object.catalog ? 'object' : null,
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
        materials: {
          select: { specQuantity: true, totalUsed: true, totalCost: true },
        },
        catalog: { select: { id: true, name: true } },
        // ⭐ №164: справочник объекта — фолбэк для сметы
        object: {
          select: {
            catalogId: true,
            catalog: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!project) return null;

    const sumSpec = project.materials.reduce(
      (a, m) => a + Number(m.specQuantity || 0),
      0,
    );
    const sumUsed = project.materials.reduce(
      (a, m) => a + Number(m.totalUsed || 0),
      0,
    );
    const sumCost = project.materials.reduce(
      (a, m) => a + Number(m.totalCost || 0),
      0,
    );
    const { materials, object, ...rest } = project;
    return {
      ...rest,
      materialsCount: project.materials.length,

      progressPercent: sumSpec > 0 ? Math.round((sumUsed / sumSpec) * 100) : 0,
      // ⭐ Скрываем стоимость, если у юзера скрыты цены
      totalCost: hidePrices ? 0 : sumCost,
      // ⭐ №164: действующий справочник проекта (свой → объекта → нет)
      effectiveCatalogId: project.catalog?.id ?? object.catalog?.id ?? null,
      effectiveCatalogName:
        project.catalog?.name ?? object.catalog?.name ?? null,
      catalogSource: project.catalog
        ? 'project'
        : object.catalog
          ? 'object'
          : null,
    };
  }

  async update(id: number, dto: Partial<CreateProjectDto>, userId?: number) {
    if (userId) {
      const access = await this.checkProjectAccess(id, userId);
      this.assertWritable(access, 'редактировать проекты');
    }
    // ⭐ №158: смена справочника проекта (undefined = не трогаем, null = отвязать)
    const nextCatalogId =
      dto.catalogId === undefined
        ? undefined
        : dto.catalogId === null
          ? null
          : await this.resolveCatalogId(dto.catalogId, userId);
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

  // ⚠️ №168: жёсткое удаление разрешено только для ПУСТОГО проекта (создан по ошибке).
  // Всё остальное — это чужие данные (материалы, акты, склад, выходы бригад),
  // поэтому проект с данными удалить нельзя: его просто убирают из своего архива.
  async remove(id: number, userId?: number) {
    if (userId) {
      const access = await this.checkProjectAccess(id, userId);
      this.assertWritable(access, 'удалять проекты');
    }

    const [materials, changeRequests, reports, transactions, shifts] =
      await Promise.all([
        this.prisma.material.count({ where: { projectId: id } }),
        this.prisma.changeRequest.count({ where: { projectId: id } }),
        this.prisma.report.count({ where: { projectId: id } }),
        this.prisma.warehouseTransaction.count({ where: { projectId: id } }),
        this.prisma.brigadeShift.count({ where: { projectId: id } }),
      ]);
    if (materials + changeRequests + reports + transactions + shifts > 0) {
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
