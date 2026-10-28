// backend/src/snapshots/snapshots.service.ts
// ⭐ №194 (F1 шаг 2): «Снимок доступа» — только чтение своего слепка.
// Никаких update/delete: снимок неизменяем по определению.
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SnapshotsService {
  constructor(private prisma: PrismaService) {}

  /** Список моих снимков: без тяжёлого payload — только summary */
  async listMine(userId: number) {
    return this.prisma.accessSnapshot.findMany({
      where: { userId },
      orderBy: { takenAt: 'desc' },
      select: {
        id: true,
        objectId: true,
        objectName: true,
        projectId: true,
        projectName: true,
        role: true,
        hidePrices: true,
        takenAt: true,
        summary: true,
      },
    });
  }

  /**
   * Один снимок. Чужой = 404, как несуществующий: id чужого снимка
   * не подтверждаем (тот же принцип, что в №191 для расценок).
   */
  async getMine(userId: number, id: number) {
    const snapshot = await this.prisma.accessSnapshot.findFirst({
      where: { id, userId },
    });
    if (!snapshot) {
      throw new NotFoundException('Снимок не найден');
    }
    return snapshot;
  }
}
