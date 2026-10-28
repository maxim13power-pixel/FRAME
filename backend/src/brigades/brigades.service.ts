// backend/src/brigades/brigades.service.ts
// ⭐ Срез 4: бригады — учёт выходов и выработки.
// Бригада без объекта (objectId = null) — «мобильная», видна всем авторизованным.
import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
// ⭐ №172: доступ к бригадам считается по тем же правилам, что и к проектам
// (№163): общая запись объекта ИЛИ запись на конкретный проект.
import {
  buildAccessScope, loadAccessGrants, REVOKED_ACCESS_MESSAGE,
  resolveObjectRole, resolveProjectAccess,
  type RoleResolution,
} from '../auth/access-scope';
import { CreateBrigadeDto } from './dto/create-brigade.dto';
import { UpdateBrigadeDto } from './dto/update-brigade.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { LogShiftDto } from './dto/log-shift.dto';

const BRIGADE_INCLUDE = {
  object: { select: { id: true, name: true } },
  _count: { select: { members: true } },
} satisfies Prisma.BrigadeInclude;

// ⭐ №169: выход всегда отдаётся вместе с составом (кто был + часы каждого).
const SHIFT_INCLUDE = {
  project: { select: { id: true, name: true } },
  members: { orderBy: { id: 'asc' } },
} satisfies Prisma.BrigadeShiftInclude;

@Injectable()
export class BrigadesService {
  constructor(private prisma: PrismaService) {}

  /**
   * ⭐ №169: Prisma отдаёт `@db.Date` как Date → в JSON «2026-10-25T00:00:00.000Z».
   * Из-за этого не работал график статистики (ключ дня не совпадал с YYYY-MM-DD)
   * и в списке выходов была ISO-строка. Отдаём чистый YYYY-MM-DD.
   */
  private mapShift<T extends { date: Date }>(shift: T) {
    return { ...shift, date: shift.date.toISOString().slice(0, 10) };
  }

  /**
   * ⭐ №169: состав выхода → строки brigade_shift_members.
   * ФИО сохраняем снимком: уберут рабочего из бригады — история выходов не рассыпется.
   */
  private async resolveShiftMembers(
    brigadeId: number,
    members?: { memberId?: number; hours: number }[],
  ): Promise<{ memberId: number; fullName: string; hours: number }[] | null> {
    if (!members || members.length === 0) return null;
    for (const m of members) {
      if (m.memberId == null) {
        throw new BadRequestException('members.memberId: обязателен для каждой строки');
      }
    }
    const ids = members.map((m) => m.memberId as number);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('members: рабочий указан дважды');
    }
    const found = await this.prisma.brigadeMember.findMany({
      where: { brigadeId, id: { in: ids } },
      select: { id: true, fullName: true },
    });
    const byId = new Map(found.map((m) => [m.id, m]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `members: рабочие ${missing.join(', ')} не из этой бригады`,
      );
    }
    return ids.map((id) => ({
      memberId: id,
      fullName: byId.get(id)!.fullName,
      hours: Math.round((members.find((m) => m.memberId === id)!.hours) * 100) / 100,
    }));
  }

  /** ⭐ №169: дата выхода — валидная и не в будущем */
  private parseShiftDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('date: некорректная дата');
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date.getTime() > today.getTime()) {
      throw new BadRequestException('date: нельзя фиксировать выход в будущем');
    }
    return date;
  }

  /** ⭐ №169: сумма часов состава — она и уходит в brigade_shifts.hoursWorked */
  private totalHours(
    rows: { hours: number }[] | null,
    fallback?: number,
  ): number {
    const total = rows
      ? rows.reduce((a, r) => a + r.hours, 0)
      : Number(fallback ?? 0);
    const rounded = Math.round(total * 100) / 100;
    if (!(rounded > 0)) {
      throw new BadRequestException(
        'Часы: отметьте в составе хотя бы одного рабочего или укажите часы',
      );
    }
    return rounded;
  }

  /**
   * ⭐ №172: наблюдатель пишет только на чтение — та же логика, что в проектах.
   * Отозванный доступ сюда не доходит: его режет checkObjectAccess/checkProjectAccess (№193).
   */
  private assertWritable(my: RoleResolution, action: string) {
    if (!my.canWrite) {
      throw new ForbiddenException(`Наблюдатель не может ${action}`);
    }
  }

  /**
   * ⭐ №172: доступ к объекту бригады.
   * Раньше требовалась запись `projectId = null`, из-за чего прораб, приглашённый
   * на проект, не мог ни создать бригаду, ни зафиксировать выход (403).
   * Теперь — как в проектах: хватает любой записи (объект или проект).
   * action передан → операция пишущая → нужны права на запись.
   */
  private async checkObjectAccess(objectId: number, userId: number, action?: string) {
    const grants = await loadAccessGrants(this.prisma, userId);
    const my = resolveObjectRole(grants, objectId);
    if (!my.role) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    // ⭐ №193 (A₂ F1): отозванный доступ живых данных не читает (в т.ч. выходы).
    if (my.revoked) {
      throw new ForbiddenException(REVOKED_ACCESS_MESSAGE);
    }
    if (action) this.assertWritable(my, action);
    return my;
  }

  /** ⭐ №172: доступ к проекту выхода (общая запись объекта или запись на проект) */
  private async checkProjectAccess(projectId: number, userId: number, action?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    const grants = await loadAccessGrants(this.prisma, userId);
    const my = resolveProjectAccess(grants, project.objectId, projectId);
    if (!my.role) {
      throw new ForbiddenException('Нет доступа к этому проекту');
    }
    if (my.revoked) {
      throw new ForbiddenException(REVOKED_ACCESS_MESSAGE); // ⭐ №193 (A₂ F1)
    }
    if (action) this.assertWritable(my, action);
    return my;
  }

  private async checkBrigadeAccess(brigadeId: number, userId: number, action?: string) {
    const brigade = await this.prisma.brigade.findUnique({
      where: { id: brigadeId },
    });
    if (!brigade) {
      throw new NotFoundException('Бригада не найдена');
    }
    if (brigade.objectId != null) {
      await this.checkObjectAccess(brigade.objectId, userId, action);
    }
    return brigade;
  }

  async list(userId: number, objectId?: number, search?: string) {
    const where: Prisma.BrigadeWhereInput = {};

    if (objectId != null && !Number.isNaN(objectId)) {
      await this.checkObjectAccess(objectId, userId);
      where.objectId = objectId;
    } else {
      // ⭐ №172: видим бригады всех объектов, где есть хоть какой-то доступ
      // (раньше — только общая запись объекта, поэтому прораб с проектом не видел бригад)
      const grants = await loadAccessGrants(this.prisma, userId);
      const ids = buildAccessScope(grants).objectIds;
      where.OR = [{ objectId: null }, { objectId: { in: ids } }];
    }

    if (search && search.trim()) {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    return this.prisma.brigade.findMany({
      where,
      orderBy: { name: 'asc' },
      include: BRIGADE_INCLUDE,
    });
  }

  async detail(userId: number, id: number) {
    await this.checkBrigadeAccess(id, userId);
    const [full, members, shifts] = await Promise.all([
      // ⭐ №169: без include object карточка объекта показывала «Мобильная бригада»
      this.prisma.brigade.findUniqueOrThrow({ where: { id }, include: BRIGADE_INCLUDE }),
      this.prisma.brigadeMember.findMany({
        where: { brigadeId: id },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.brigadeShift.findMany({
        where: { brigadeId: id },
        orderBy: { date: 'desc' },
        take: 20,
        include: SHIFT_INCLUDE,
      }),
    ]);
    return {
      ...full,
      members,
      shifts: shifts.map((s) => this.mapShift(s)),
    };
  }

  async create(userId: number, dto: CreateBrigadeDto) {
    if (dto.objectId != null) {
      await this.checkObjectAccess(dto.objectId, userId, 'создавать бригады на объекте');
    }
    return this.prisma.brigade.create({
      data: {
        name: dto.name.trim(),
        specialty: dto.specialty?.trim() || null,
        foremanName: dto.foremanName?.trim() || null,
        phone: dto.phone?.trim() || null,
        comment: dto.comment?.trim() || null,
        objectId: dto.objectId ?? null,
      },
      include: BRIGADE_INCLUDE,
    });
  }

  async update(userId: number, id: number, dto: UpdateBrigadeDto) {
    const brigade = await this.checkBrigadeAccess(id, userId, 'изменять бригаду');
    if (dto.objectId !== undefined && dto.objectId !== brigade.objectId) {
      await this.checkObjectAccess(dto.objectId, userId, 'переносить бригаду на объект');
    }
    return this.prisma.brigade.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        specialty: dto.specialty !== undefined ? dto.specialty.trim() || null : undefined,
        foremanName: dto.foremanName !== undefined ? dto.foremanName.trim() || null : undefined,
        phone: dto.phone !== undefined ? dto.phone.trim() || null : undefined,
        comment: dto.comment !== undefined ? dto.comment.trim() || null : undefined,
        objectId: dto.objectId !== undefined ? dto.objectId : undefined,
      },
      include: BRIGADE_INCLUDE,
    });
  }

  async remove(userId: number, id: number) {
    await this.checkBrigadeAccess(id, userId, 'удалять бригады');
    await this.prisma.brigade.delete({ where: { id } });
    return { success: true };
  }

  // ─── Состав ───
  async addMember(userId: number, brigadeId: number, dto: AddMemberDto) {
    await this.checkBrigadeAccess(brigadeId, userId, 'изменять состав бригады');
    return this.prisma.brigadeMember.create({
      data: {
        brigadeId,
        fullName: dto.fullName.trim(),
        role: dto.role?.trim() || null,
        phone: dto.phone?.trim() || null,
      },
    });
  }

  async removeMember(userId: number, brigadeId: number, memberId: number) {
    await this.checkBrigadeAccess(brigadeId, userId, 'изменять состав бригады');
    const member = await this.prisma.brigadeMember.findFirst({
      where: { id: memberId, brigadeId },
    });
    if (!member) {
      throw new NotFoundException('Рабочий не найден');
    }
    await this.prisma.brigadeMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  // ─── Выходы ───
  async listShifts(
    userId: number,
    brigadeId: number,
    from?: string,
    to?: string,
    projectId?: number,
  ) {
    await this.checkBrigadeAccess(brigadeId, userId);
    const where: Prisma.BrigadeShiftWhereInput = { brigadeId };
    if (from || to) {
      where.date = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }
    if (projectId != null && !Number.isNaN(projectId)) {
      where.projectId = projectId;
    }
    return this.prisma.brigadeShift
      .findMany({
        where,
        orderBy: { date: 'desc' },
        include: SHIFT_INCLUDE,
      })
      // ⭐ №169: дата — строка YYYY-MM-DD (фильтры и график сравнивают именно её)
      .then((rows) => rows.map((s) => this.mapShift(s)));
  }

  async logShift(userId: number, brigadeId: number, dto: LogShiftDto) {
    // ⭐ №172: прораб, приглашённый на проект, теперь может фиксировать выходы
    await this.checkBrigadeAccess(brigadeId, userId, 'фиксировать выходы бригады');
    const date = this.parseShiftDate(dto.date);
    if (dto.projectId != null) {
      await this.checkProjectAccess(dto.projectId, userId, 'фиксировать выход по этому проекту');
    }
    // ⭐ №169: состав бригады — источник истины по часам (сумма считается здесь)
    const memberRows = await this.resolveShiftMembers(brigadeId, dto.members);
    const hoursWorked = this.totalHours(memberRows, dto.hoursWorked);
    const shift = await this.prisma.brigadeShift.create({
      data: {
        brigadeId,
        projectId: dto.projectId ?? null,
        date,
        hoursWorked,
        outputValue: dto.outputValue ?? null,
        outputArea: dto.outputArea ?? null,
        comment: dto.comment?.trim() || null,
        createdBy: userId,
        ...(memberRows ? { members: { create: memberRows } } : {}),
      },
      include: SHIFT_INCLUDE,
    });
    return this.mapShift(shift);
  }

  async updateShift(userId: number, brigadeId: number, shiftId: number, dto: LogShiftDto) {
    await this.checkBrigadeAccess(brigadeId, userId, 'изменять выходы бригады');
    const shift = await this.prisma.brigadeShift.findFirst({
      where: { id: shiftId, brigadeId },
    });
    if (!shift) {
      throw new NotFoundException('Выход не найден');
    }
    const date = this.parseShiftDate(dto.date);
    if (dto.projectId != null) {
      await this.checkProjectAccess(dto.projectId, userId, 'фиксировать выход по этому проекту');
    }
    // ⭐ №169: новый состав заменяет старый; без состава — прежние часы/из DTO
    const memberRows = await this.resolveShiftMembers(brigadeId, dto.members);
    const hoursWorked = memberRows
      ? this.totalHours(memberRows, dto.hoursWorked)
      : dto.hoursWorked != null
        ? this.totalHours(null, dto.hoursWorked)
        : Number(shift.hoursWorked);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (memberRows) {
        await tx.brigadeShiftMember.deleteMany({ where: { shiftId } });
        await tx.brigadeShiftMember.createMany({
          data: memberRows.map((r) => ({ ...r, shiftId })),
        });
      }
      return tx.brigadeShift.update({
        where: { id: shiftId },
        data: {
          projectId: dto.projectId !== undefined ? dto.projectId : undefined,
          date,
          hoursWorked,
          outputValue: dto.outputValue !== undefined ? dto.outputValue : undefined,
          outputArea: dto.outputArea !== undefined ? dto.outputArea : undefined,
          comment: dto.comment !== undefined ? dto.comment.trim() || null : undefined,
        },
        include: SHIFT_INCLUDE,
      });
    });
    return this.mapShift(updated);
  }

  async removeShift(userId: number, brigadeId: number, shiftId: number) {
    await this.checkBrigadeAccess(brigadeId, userId, 'удалять выходы бригады');
    const shift = await this.prisma.brigadeShift.findFirst({
      where: { id: shiftId, brigadeId },
    });
    if (!shift) {
      throw new NotFoundException('Выход не найден');
    }
    await this.prisma.brigadeShift.delete({ where: { id: shiftId } });
    return { success: true };
  }

  // ─── Статистика ───
  async stats(userId: number, brigadeId: number) {
    await this.checkBrigadeAccess(brigadeId, userId);
    const agg = await this.prisma.brigadeShift.aggregate({
      where: { brigadeId },
      _sum: { hoursWorked: true, outputValue: true, outputArea: true },
      _count: { id: true },
    });
    const shiftsCount = agg._count.id;
    const totalHours = Number(agg._sum.hoursWorked ?? 0);
    return {
      totalHours: Math.round(totalHours * 100) / 100,
      totalOutputValue: Number(agg._sum.outputValue ?? 0),
      totalOutputArea: Number(agg._sum.outputArea ?? 0),
      shiftsCount,
      avgHoursPerShift: shiftsCount > 0 ? Math.round((totalHours / shiftsCount) * 100) / 100 : 0,
    };
  }
}
