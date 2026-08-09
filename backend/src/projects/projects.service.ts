import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { BadRequestException } from '@nestjs/common';
@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

async create(dto: CreateProjectDto) {
  // Дополнительная проверка дат на уровне сервиса
  const startDate = new Date(dto.startDate);
  const endDate = new Date(dto.endDate);

  if (isNaN(startDate.getTime())) {
    throw new BadRequestException('Невалидная дата начала');
  }
  if (isNaN(endDate.getTime())) {
    throw new BadRequestException('Невалидная дата окончания');
  }
  if (endDate < startDate) {
    throw new BadRequestException('Дата окончания не может быть раньше даты начала');
  }

  return this.prisma.project.create({
    data: {
      name: dto.name.trim(),
      startDate,
      endDate,
      objectId: dto.objectId,
    },
  });
}

  async findAllByObject(objectId: number) {
    return this.prisma.project.findMany({
      where: { objectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    return this.prisma.project.findUnique({ where: { id } });
  }

  async update(id: number, dto: Partial<CreateProjectDto>) {
    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.project.delete({ where: { id } });
  }
}