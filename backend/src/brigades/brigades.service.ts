// backend/src/brigades/brigades.service.ts
// ⭐ Срез 4: бригады — учёт выходов и выработки.
// Бригада без объекта (objectId = null) — «мобильная», видна всем авторизованным.
import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrigadeDto } from './dto/create-brigade.dto';
import { UpdateBrigadeDto } from './dto/update-brigade.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { LogShiftDto } from './dto/log-shift.dto';

const BRIGADE_INCLUDE = {
  object: { select: { id: true, name: true } },
  _count: { select: { members: true } },
} satisfies Prisma.BrigadeInclude;

@Injectable()
export class BrigadesService {
  constructor(private prisma: PrismaService) {}

  private async checkObjectAccess(objectId: number, userId: number) {
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId, projectId: null },
    });
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    return access;
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

  private async checkBrigadeAccess(brigadeId: number, userId: number) {
    const brigade = await this.prisma.brigade.findUnique({
      where: { id: brigadeId },
    });
    if (!brigade) {
      throw new NotFoundException('Бригада не найдена');
    }
    if (brigade.objectId != null) {
      await this.checkObjectAccess(brigade.objectId, userId);
    }
    return brigade;
  }

  async list(userId: number, objectId?: number, search?: string) {
    const where: Prisma.BrigadeWhereInput = {};

    if (objectId != null && !Number.isNaN(objectId)) {
      await this.checkObjectAccess(objectId, userId);
      where.objectId = objectId;
    } else {
      const accesses = await this.prisma.objectAccess.findMany({
        where: { userId, projectId: null },
        select: { objectId: true },
      });
      const ids = accesses.map((a) => a.objectId);
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
    const brigade = await this.checkBrigadeAccess(id, userId);
    const [members, shifts] = await Promise.all([
      this.prisma.brigadeMember.findMany({
        where: { brigadeId: id },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.brigadeShift.findMany({
        where: { brigadeId: id },
        orderBy: { date: 'desc' },
        take: 20,
        include: { project: { select: { id: true, name: true } } },
      }),
    ]);
    return { ...brigade, members, shifts };
  }

  async create(userId: number, dto: CreateBrigadeDto) {
    if (dto.objectId != null) {
      await this.checkObjectAccess(dto.objectId, userId);
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
    const brigade = await this.checkBrigadeAccess(id, userId);
    if (dto.objectId !== undefined && dto.objectId !== brigade.objectId) {
      await this.checkObjectAccess(dto.objectId, userId);
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
    await this.checkBrigadeAccess(id, userId);
    await this.prisma.brigade.delete({ where: { id } });
    return { success: true };
  }

  // ─── Состав ───
  async addMember(userId: number, brigadeId: number, dto: AddMemberDto) {
    await this.checkBrigadeAccess(brigadeId, userId);
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
    await this.checkBrigadeAccess(brigadeId, userId);
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
    return this.prisma.brigadeShift.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async logShift(userId: number, brigadeId: number, dto: LogShiftDto) {
    await this.checkBrigadeAccess(brigadeId, userId);
    // ⭐ date не в будущем
    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('date: некорректная дата');
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date.getTime() > today.getTime()) {
      throw new BadRequestException('date: нельзя фиксировать выход в будущем');
    }
    if (dto.projectId != null) {
      await this.checkProjectAccess(dto.projectId, userId);
    }
    return this.prisma.brigadeShift.create({
      data: {
        brigadeId,
        projectId: dto.projectId ?? null,
        date,
        hoursWorked: dto.hoursWorked,
        outputValue: dto.outputValue ?? null,
        outputArea: dto.outputArea ?? null,
        comment: dto.comment?.trim() || null,
        createdBy: userId,
      },
    });
  }

  async updateShift(userId: number, brigadeId: number, shiftId: number, dto: LogShiftDto) {
    await this.checkBrigadeAccess(brigadeId, userId);
    const shift = await this.prisma.brigadeShift.findFirst({
      where: { id: shiftId, brigadeId },
    });
    if (!shift) {
      throw new NotFoundException('Выход не найден');
    }
    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('date: некорректная дата');
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date.getTime() > today.getTime()) {
      throw new BadRequestException('date: нельзя фиксировать выход в будущем');
    }
    if (dto.projectId != null) {
      await this.checkProjectAccess(dto.projectId, userId);
    }
    return this.prisma.brigadeShift.update({
      where: { id: shiftId },
      data: {
        projectId: dto.projectId !== undefined ? dto.projectId : undefined,
        date,
        hoursWorked: dto.hoursWorked,
        outputValue: dto.outputValue !== undefined ? dto.outputValue : undefined,
        outputArea: dto.outputArea !== undefined ? dto.outputArea : undefined,
        comment: dto.comment !== undefined ? dto.comment.trim() || null : undefined,
      },
    });
  }

  async removeShift(userId: number, brigadeId: number, shiftId: number) {
    await this.checkBrigadeAccess(brigadeId, userId);
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
