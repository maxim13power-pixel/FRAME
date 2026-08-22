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
  // Все объекты + честный % из материалов всех проектов
  async findAll() {
    const objects = await this.prisma.object.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        projects: {
          include: {
            materials: {
              select: { specQuantity: true, totalUsed: true, totalCost: true, materialTotalCost: true },
            },
          },
        },
      },
    });
    return objects.map(o => {
      let sumSpec = 0;
      let sumUsed = 0;
      let sumCost = 0;
      o.projects.forEach(p =>
        p.materials.forEach(m => {
          sumSpec += m.specQuantity || 0;
          sumUsed += m.totalUsed || 0;
          sumCost += (m.totalCost || 0) + (m.materialTotalCost || 0);
        })
      );
      const { projects, ...rest } = o;
      return {
        ...rest,
        progressPercent: sumSpec > 0 ? Math.round((sumUsed / sumSpec) * 100) : 0,
        totalCost: sumCost,
      };
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