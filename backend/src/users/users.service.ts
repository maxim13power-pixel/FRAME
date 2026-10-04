// backend/src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
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

  // ⭐ №130 (152-ФЗ): выгрузка персональных данных текущего пользователя.
  async exportMyData(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    // ⭐ Хэш пароля НЕ отдаём.
    const { password: _password, ...profile } = user;

    const objectAccesses = await this.prisma.objectAccess.findMany({
      where: { userId },
    });
    const objectIds = objectAccesses
      .filter((a) => a.projectId === null)
      .map((a) => a.objectId);

    const objects = objectIds.length
      ? await this.prisma.object.findMany({ where: { id: { in: objectIds } } })
      : [];
    const projects = objectIds.length
      ? await this.prisma.project.findMany({ where: { objectId: { in: objectIds } } })
      : [];
    const projectIds = projects.map((p) => p.id);
    const materials = projectIds.length
      ? await this.prisma.material.findMany({ where: { projectId: { in: projectIds } } })
      : [];
    const warehouseItems = objectIds.length
      ? await this.prisma.warehouseItem.findMany({ where: { objectId: { in: objectIds } } })
      : [];
    const warehouseTransactions = await this.prisma.warehouseTransaction.findMany({
      where: { createdBy: userId },
    });
    const reports = await this.prisma.report.findMany({ where: { createdBy: userId } });
    const brigades = objectIds.length
      ? await this.prisma.brigade.findMany({ where: { objectId: { in: objectIds } } })
      : [];
    const brigadeShifts = await this.prisma.brigadeShift.findMany({
      where: { createdBy: userId },
    });
    const estimateTemplates = await this.prisma.estimateTemplate.findMany({
      where: { ownerId: userId },
    });
    const priceItems = await this.prisma.priceItem.findMany({
      where: { ownerId: userId },
    });
    const rentals = await this.prisma.rental.findMany({ where: { userId } });

    return {
      exportedAt: new Date().toISOString(),
      profile,
      objectAccesses,
      objects,
      projects,
      materials,
      warehouseItems,
      warehouseTransactions,
      reports,
      brigades,
      brigadeShifts,
      estimateTemplates,
      priceItems,
      rentals,
    };
  }

  // ⭐ №130 (152-ФЗ): удаление аккаунта и связанных данных.
  async deleteMe(userId: number) {
    await this.prisma.$transaction(async (tx) => {
      // 1. Объекты, где юзер — единственный владелец (CUSTOMER + нет других доступов).
      const myAccesses = await tx.objectAccess.findMany({
        where: { userId, projectId: null },
      });
      const soleOwnedObjectIds: number[] = [];
      for (const acc of myAccesses) {
        if (acc.role !== 'CUSTOMER') continue;
        const others = await tx.objectAccess.count({
          where: { objectId: acc.objectId, projectId: null, userId: { not: userId } },
        });
        if (others === 0) soleOwnedObjectIds.push(acc.objectId);
      }

      // 2. Скалярные связи (createdBy/ownerId) — удаляем явно (нет FK-каскада).
      await tx.warehouseTransaction.deleteMany({ where: { createdBy: userId } });
      await tx.report.deleteMany({ where: { createdBy: userId } });
      await tx.brigadeShift.deleteMany({ where: { createdBy: userId } });
      await tx.estimateTemplate.deleteMany({ where: { ownerId: userId } });
      await tx.priceItem.deleteMany({ where: { ownerId: userId } });

      // 3. Объекты-одиночки: удаляем связанные склады/бригады + сам объект (каскадно).
      for (const objectId of soleOwnedObjectIds) {
        await tx.warehouseItem.deleteMany({ where: { objectId } });
        await tx.brigade.deleteMany({ where: { objectId } });
        await tx.object.delete({ where: { id: objectId } });
      }

      // 4. Пользователь (каскадно ObjectAccess/ChangeRequest/InviteToken/PasswordResetToken/Rental;
      //    SetNull — PriceItem.owner и ChangeRequest.reviewer).
      await tx.user.delete({ where: { id: userId } });
    });

    return { success: true, message: 'Аккаунт удалён' };
  }
}
