// backend/src/objects/objects.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // убедитесь, что путь правильный
import { CreateObjectDto } from './dto/create-object.dto';

@Injectable()
export class ObjectsService {
  constructor(private prisma: PrismaService) {}

  // Создание объекта
  async create(dto: CreateObjectDto) {
    return this.prisma.object.create({
      data: {
        name: dto.name,
        address: dto.address,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        plannedEndDate: dto.plannedEndDate 
          ? new Date(dto.plannedEndDate) 
          : new Date(dto.endDate),
        note: dto.note || null,
      },
    });
  }

  // Получение всех объектов
  async findAll() {
    return this.prisma.object.findMany({
      orderBy: { createdAt: 'desc' }, // сортировка по дате создания (новые сверху)
    });
  }
  async update(id: number, dto: Partial<CreateObjectDto>) {
    return this.prisma.object.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        note: dto.note !== undefined ? dto.note : undefined,
      },
    });
  }

async remove(id: number) {
  return this.prisma.object.delete({ where: { id } });
}
async findOne(id: number) {
  return this.prisma.object.findUnique({ where: { id } });
}

async updateEndDate(id: number, newEndDate: string) {
  return this.prisma.object.update({
    where: { id },
    data: {
      endDate: new Date(newEndDate),
    },
  });
}
}