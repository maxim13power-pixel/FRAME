// backend/src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ⭐ Сводный список участников по всем объектам, к которым у юзера есть доступ.
  // Управление (приглашение/роли/отзыв) — в access.service.ts (модалка объекта),
  // здесь только чтение для страницы «Участники».
  // ⭐ №184: «Моя команда» — ВСЕ объекты, где у меня есть активный доступ,
  // включая доступ «только проект» (раньше фильтр projectId=null прятал такие объекты:
  // прораб, приглашённый на один проект, видел пустую страницу).
  async getTeam(userId: number) {
    // 1. Мои активные записи доступа — объектные и проектные.
    const myAccesses = await this.prisma.objectAccess.findMany({
      where: { userId, revokedAt: null },
      include: {
        object: {
          select: {
            id: true,
            name: true,
            address: true,
            isArchived: true,
            createdAt: true,
          },
        },
      },
    });
    if (myAccesses.length === 0) return [];

    const objectIds = [...new Set(myAccesses.map((a) => a.objectId))];
    // Объекты, где доступ выдан на весь объект
    const fullObjectIds = [
      ...new Set(
        myAccesses.filter((a) => a.projectId == null).map((a) => a.objectId),
      ),
    ];
    // Проекты, куда меня пригласили точечно
    const myProjectIds = [
      ...new Set(
        myAccesses
          .filter((a) => a.projectId != null)
          .map((a) => a.projectId as number),
      ),
    ];

    // 2. Участники: для «полного» объекта — все, для проектного доступа — только мои
    //    проекты (контакты чужой команды не показываем).
    const members = await this.prisma.objectAccess.findMany({
      where: {
        revokedAt: null,
        OR: [
          { objectId: { in: fullObjectIds } },
          { projectId: { in: myProjectIds } },
        ],
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 3. Названия моих проектов — для подписи области доступа.
    const projects = myProjectIds.length
      ? await this.prisma.project.findMany({
          where: { id: { in: myProjectIds } },
          select: { id: true, name: true },
        })
      : [];
    const projectName = new Map(projects.map((p) => [p.id, p.name]));

    const ROLE_PRIORITY: Record<string, number> = {
      CUSTOMER: 3,
      FOREMAN: 2,
      VIEWER: 1,
    };

    // 4. Группируем по объекту (новые объекты сверху).
    return objectIds
      .map((objectId) => {
        const mine = myAccesses.filter((a) => a.objectId === objectId);
        const full = mine.find((a) => a.projectId == null);
        const source =
          full ??
          mine.reduce((a, b) =>
            ROLE_PRIORITY[b.role] > ROLE_PRIORITY[a.role] ? b : a,
          );
        const scopes = full
          ? ['Весь объект']
          : [
              ...new Set(
                mine.map(
                  (a) => projectName.get(a.projectId as number) ?? 'Проект',
                ),
              ),
            ];
        const obj = mine[0].object;
        return {
          id: obj.id,
          name: obj.name,
          address: obj.address,
          isArchived: obj.isArchived,
          myRole: source.role,
          scopes,
          members: members
            .filter((m) => m.objectId === objectId)
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
          createdAt: obj.createdAt,
        };
      })
      .sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      )
      .map(({ createdAt: _createdAt, ...rest }) => rest);
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
    // ⭐ №193 (A₂ F1): данные объектов выгружаем только по АКТИВНЫМ доступам —
    // отозванный доступ живых данных не отдаёт (сами записи об отзыве остаются).
    const objectIds = objectAccesses
      .filter((a) => a.projectId === null && !a.revokedAt)
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

  // ⭐ №168 (152-ФЗ): удаление аккаунта БЕЗ потери общих данных.
  // Раньше deleteMe сносил объекты-«одиночки» и все отчёты/склад/выходы автора —
  // это уничтожало данные других участников. Теперь аккаунт обезличивается:
  //  • профиль теряет email/телефон/имя, вход невозможен (случайный пароль + tokenVersion++);
  //  • личное (шаблоны, личные справочники, аренды) удаляется;
  //  • участие в объектах удаляется;
  //  • авторство в отчётах/складе/выходах обнуляется (createdBy = NULL);
  //  • объекты/проекты/материалы остаются у остальных участников.
  async deleteMe(userId: number) {
    const anonPassword = await bcrypt.hash(randomUUID(), 10);

    await this.prisma.$transaction(async (tx) => {
      // 1. Личные справочники: удаляем ЦЕЛИКОМ.
      //    Нельзя просто обнулить ownerId — справочник стал бы системным (ownerId=null).
      await tx.priceItem.deleteMany({ where: { ownerId: userId } });
      await tx.priceCatalog.deleteMany({ where: { ownerId: userId } });

      // 2. Личные шаблоны смет и аренды оборудования
      await tx.estimateTemplate.deleteMany({ where: { ownerId: userId } });
      await tx.rental.deleteMany({ where: { userId } });

      // 3. Он больше не участник объектов (каскадом ушли бы при удалении user)
      await tx.objectAccess.deleteMany({ where: { userId } });

      // 4. Авторство обезличиваем, данные остаются
      await tx.report.updateMany({
        where: { createdBy: userId },
        data: { createdBy: null },
      });
      await tx.warehouseTransaction.updateMany({
        where: { createdBy: userId },
        data: { createdBy: null },
      });
      await tx.brigadeShift.updateMany({
        where: { createdBy: userId },
        data: { createdBy: null },
      });
      await tx.object.updateMany({
        where: { createdById: userId },
        data: { createdById: null },
      });

      // 5. Профиль: персональные данные стираем, запись оставляем
      //    (на неё ссылаются MaterialFix.userId, AuditLog.actorId и т.п.).
      await tx.user.update({
        where: { id: userId },
        data: {
          email: null,
          phone: null,
          fullName: 'Удалённый пользователь',
          password: anonPassword,
          tokenVersion: { increment: 1 }, // ⭐ №160: все сессии невалидны
        },
      });
    });

    return {
      success: true,
      message: 'Аккаунт удалён, общие данные объекта сохранены',
    };
  }
}
