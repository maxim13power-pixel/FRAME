// backend/src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ⭐ Сводный список участников по всем объектам, к которым у юзера есть доступ.
  // Управление (приглашение/роли/отзыв) — в access.service.ts (модалка объекта),
  // здесь только чтение для страницы «Участники».
  async getTeam(userId: number) {
    // 1. Мои записи доступа (объектный уровень) — это и есть «мои» объекты.
    const myAccesses = await this.prisma.objectAccess.findMany({
      where: { userId, projectId: null },
      include: {
        object: {
          select: { id: true, name: true, address: true, isArchived: true, createdAt: true },
        },
      },
    });

    const objectIds = myAccesses.map((a) => a.objectId);
    if (objectIds.length === 0) return [];

    // 2. Все участники этих объектов (объектный уровень).
    const members = await this.prisma.objectAccess.findMany({
      where: { objectId: { in: objectIds }, projectId: null },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 3. Группируем по объекту (новые объекты сверху).
    return myAccesses
      .sort(
        (a, b) =>
          (b.object.createdAt?.getTime() ?? 0) - (a.object.createdAt?.getTime() ?? 0),
      )
      .map((my) => ({
        id: my.object.id,
        name: my.object.name,
        address: my.object.address,
        isArchived: my.object.isArchived,
        myRole: my.role,
        members: members
          .filter((m) => m.objectId === my.objectId)
          .map((m) => ({
            id: m.id,
            userId: m.userId,
            fullName: m.user.fullName,
            email: m.user.email,
            phone: m.user.phone,
            role: m.role,
            hidePrices: m.hidePrices,
            invitedBy: m.invitedBy,
            createdAt: m.createdAt,
          })),
      }));
  }
}
