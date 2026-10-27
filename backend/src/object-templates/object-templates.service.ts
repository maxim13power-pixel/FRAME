// backend/src/object-templates/object-templates.service.ts
// ⭐ №175: шаблоны объектов. Отдельная сущность: снимок структуры объекта
// (проекты + позиции смет). Автосинхронизации нет — создание объекта из шаблона
// это разовая копия. sourceObjectId — только подпись, без каскадов.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ObjectsService } from '../objects/objects.service';
import { CreateObjectTemplateDto } from './dto/create-object-template.dto';
import { UpdateObjectTemplateDto } from './dto/update-object-template.dto';
import { CreateObjectFromTemplateDto } from './dto/create-object-from-template.dto';

const TEMPLATE_INCLUDE = {
  author: { select: { id: true, fullName: true, email: true } },
  projects: {
    select: {
      id: true,
      name: true,
      note: true,
      sortOrder: true,
      _count: { select: { materials: true } },
    },
    orderBy: { sortOrder: 'asc' },
  },
} as const;

@Injectable()
export class ObjectTemplatesService {
  constructor(
    private prisma: PrismaService,
    private objects: ObjectsService,
    private audit: AuditService,
  ) {}

  private async isAdmin(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === Role.ADMIN;
  }

  // ─── Сохранить объект как шаблон ───
  async createFromObject(
    objectId: number,
    dto: CreateObjectTemplateDto,
    userId: number,
  ) {
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId, projectId: null },
    });
    if (!access) {
      throw new ForbiddenException(
        'Сохранить шаблон может участник объекта (доступ на весь объект)',
      );
    }
    if (access.revokedAt) {
      throw new ForbiddenException('Доступ отозван: шаблон сохранить нельзя');
    }
    if (access.role === AccessRole.VIEWER) {
      throw new ForbiddenException('Наблюдатель не может сохранять шаблоны');
    }

    const object = await this.prisma.object.findUnique({
      where: { id: objectId },
      include: {
        projects: {
          orderBy: { createdAt: 'asc' },
          include: { materials: { orderBy: { createdAt: 'asc' } } },
        },
      },
    });
    if (!object) throw new NotFoundException('Объект не найден');

    return this.prisma.objectTemplate.create({
      data: {
        name: dto.name?.trim() || object.name,
        note: dto.note ?? object.note ?? null,
        authorId: userId,
        isPublic: dto.isPublic ?? false,
        sourceObjectId: object.id,
        sourceObjectName: object.name,
        projects: {
          create: object.projects.map((p, index) => ({
            name: p.name,
            note: p.note ?? null,
            sortOrder: index,
            materials: {
              create: p.materials.map((m) => ({
                name: m.name,
                article: m.article,
                unit: m.unit,
                specQuantity: m.specQuantity,
                note: m.note,
                priceItemId: m.priceItemId,
                materialItemId: m.materialItemId,
                unitPrice: m.unitPrice,
                materialUnitPrice: m.materialUnitPrice,
              })),
            },
          })),
        },
      },
      include: TEMPLATE_INCLUDE,
    });
  }

  // ─── Список: scope=mine — только свои, all — свои + общие ───
  async findAll(userId: number, scope: 'mine' | 'all' = 'all') {
    return this.prisma.objectTemplate.findMany({
      where:
        scope === 'mine'
          ? { authorId: userId }
          : { OR: [{ authorId: userId }, { isPublic: true }] },
      include: TEMPLATE_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  // ─── Один шаблон (с позициями) ───
  async findOne(id: number, userId: number) {
    const template = await this.prisma.objectTemplate.findUnique({
      where: { id },
      include: {
        ...TEMPLATE_INCLUDE,
        projects: {
          orderBy: { sortOrder: 'asc' },
          include: { materials: { orderBy: { id: 'asc' } } },
        },
      },
    });
    if (!template) throw new NotFoundException('Шаблон не найден');
    const admin = await this.isAdmin(userId);
    if (!template.isPublic && template.authorId !== userId && !admin) {
      throw new NotFoundException('Шаблон не найден');
    }
    return template;
  }

  // ─── Переименовать / опубликовать ───
  async update(id: number, dto: UpdateObjectTemplateDto, userId: number) {
    await this.assertOwner(id, userId, 'изменять');
    const data: Prisma.ObjectTemplateUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Название шаблона обязательно');
      data.name = name;
    }
    if (dto.note !== undefined) data.note = dto.note;
    if (dto.isPublic !== undefined) data.isPublic = dto.isPublic;
    return this.prisma.objectTemplate.update({
      where: { id },
      data,
      include: TEMPLATE_INCLUDE,
    });
  }

  // ─── Удалить (автор или админ) ───
  async remove(id: number, userId: number) {
    await this.assertOwner(id, userId, 'удалять');
    await this.prisma.objectTemplate.delete({ where: { id } });
    await this.audit.log(userId, 'object_template', id, 'delete');
    return { success: true };
  }

  private async assertOwner(id: number, userId: number, action: string) {
    const template = await this.prisma.objectTemplate.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!template) throw new NotFoundException('Шаблон не найден');
    if (template.authorId === userId) return;
    if (await this.isAdmin(userId)) return;
    throw new ForbiddenException(
      `Шаблон может ${action} только автор или администратор`,
    );
  }

  // ─── Создать объект из шаблона (разовая копия, без sync) ───
  async createObject(id: number, dto: CreateObjectFromTemplateDto, userId: number) {
    const template = await this.prisma.objectTemplate.findUnique({
      where: { id },
      include: {
        projects: {
          orderBy: { sortOrder: 'asc' },
          include: { materials: { orderBy: { id: 'asc' } } },
        },
      },
    });
    if (!template) throw new NotFoundException('Шаблон не найден');
    const admin = await this.isAdmin(userId);
    if (!template.isPublic && template.authorId !== userId && !admin) {
      throw new NotFoundException('Шаблон не найден');
    }

    // Объект создаём через ObjectsService — он же выдаёт доступ создателю
    const object = await this.objects.create(
      {
        name: dto.name,
        address: dto.address,
        startDate: dto.startDate,
        endDate: dto.endDate,
        note: dto.note ?? template.note ?? undefined,
      } as any,
      userId,
    );

    // Копируем проекты и позиции смет (фиксации и фактический расход не переносим)
    for (const p of template.projects) {
      const project = await this.prisma.project.create({
        data: {
          name: p.name,
          note: p.note ?? null,
          objectId: object.id,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
        },
      });
      if (p.materials.length > 0) {
        await this.prisma.material.createMany({
          data: p.materials.map((m) => ({
            projectId: project.id,
            name: m.name,
            article: m.article,
            unit: m.unit,
            specQuantity: m.specQuantity,
            note: m.note,
            priceItemId: m.priceItemId,
            materialItemId: m.materialItemId,
            unitPrice: m.unitPrice ?? 0,
            materialUnitPrice: m.materialUnitPrice ?? 0,
          })),
        });
      }
    }

    await this.audit.log(
      userId,
      'object_template',
      id,
      'create',
      undefined,
      { createdObjectId: object.id },
    );

    return this.objects.findOne(object.id, userId);
  }
}
