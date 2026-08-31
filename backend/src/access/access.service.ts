// backend/src/access/access.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AddAccessDto } from './dto/add-access.dto';
import { UpdateAccessDto } from './dto/update-access.dto';

@Injectable()
export class AccessService {
  constructor(private prisma: PrismaService) {}

  // ⭐ Хелпер: получить запись доступа юзера к объекту (или кинуть 403)
  private async getMyAccess(objectId: number, userId: number) {
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId },
    });
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    return access;
  }

  // ⭐ Хелпер: найти приглашаемого юзера (по userId / email / телефону)
  private async resolveUser(dto: AddAccessDto) {
    if (dto.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
      if (!user) throw new NotFoundException('Пользователь не найден');
      return user;
    }
    if (dto.email) {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
      });
      if (!user) throw new NotFoundException('Пользователь с таким email не найден');
      return user;
    }
    if (dto.phone) {
      const user = await this.prisma.user.findUnique({
        where: { phone: dto.phone.trim() },
      });
      if (!user) throw new NotFoundException('Пользователь с таким телефоном не найден');
      return user;
    }
    throw new BadRequestException('Укажите userId, email или телефон');
  }

  // 1. Список участников объекта (для модалки «Управление доступом»)
  async getAccessList(objectId: number, userId: number) {
    await this.getMyAccess(objectId, userId); // проверка доступа
    return this.prisma.objectAccess.findMany({
      where: { objectId },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // 2. Пригласить пользователя (ТЗ 3.5)
  async addAccess(objectId: number, dto: AddAccessDto, actorUserId: number) {
    const myAccess = await this.getMyAccess(objectId, actorUserId);

    // ⭐ Кто может приглашать: наблюдатель — нет; прораб — только прорабов/наблюдателей
    if (myAccess.role === AccessRole.VIEWER) {
      throw new ForbiddenException('Наблюдатель не может приглашать пользователей');
    }
    if (myAccess.role === AccessRole.FOREMAN && dto.role === AccessRole.CUSTOMER) {
      throw new ForbiddenException('Прораб не может добавлять заказчика');
    }

    // Найти приглашаемого юзера
    const invitedUser = await this.resolveUser(dto);

    // ⭐ Нельзя пригласить самого себя
    if (invitedUser.id === actorUserId) {
      throw new BadRequestException('Нельзя пригласить самого себя');
    }

    // ⭐ Проверка что юзер ещё не добавлен (уникальный индекс [userId, objectId, projectId])
    const existing = await this.prisma.objectAccess.findFirst({
      where: {
        userId: invitedUser.id,
        objectId,
        projectId: dto.projectId ?? null,
      },
    });
    if (existing) {
      throw new ConflictException('Пользователь уже имеет доступ к этому объекту/проекту');
    }

    return this.prisma.objectAccess.create({
      data: {
        userId: invitedUser.id,
        objectId,
        projectId: dto.projectId ?? null, // null = весь объект
        role: dto.role,
        invitedBy: actorUserId,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });
  }

  // 3. Сменить роль участника
  async updateAccess(objectId: number, accessId: number, dto: UpdateAccessDto, actorUserId: number) {
    const myAccess = await this.getMyAccess(objectId, actorUserId);

    // Найти изменяемую запись доступа
    const target = await this.prisma.objectAccess.findFirst({
      where: { id: accessId, objectId },
    });
    if (!target) {
      throw new NotFoundException('Запись доступа не найдена');
    }

    // ⭐ Менять роли может ТОЛЬКО заказчик
    if (myAccess.role !== AccessRole.CUSTOMER) {
      throw new ForbiddenException('Только заказчик может менять роли участников');
    }

    // ⭐ Нельзя менять собственную роль
    if (target.userId === actorUserId) {
      throw new BadRequestException('Нельзя менять собственную роль');
    }

    return this.prisma.objectAccess.update({
      where: { id: accessId },
      data: { role: dto.role },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });
  }

  // 4. Отозвать доступ (кейс «уволить воригу» 🚪)
  async removeAccess(objectId: number, accessId: number, actorUserId: number) {
    const myAccess = await this.getMyAccess(objectId, actorUserId);

    // Найти удаляемую запись доступа
    const target = await this.prisma.objectAccess.findFirst({
      where: { id: accessId, objectId },
    });
    if (!target) {
      throw new NotFoundException('Запись доступа не найдена');
    }

    // ⭐ Нельзя отозвать собственный доступ
    if (target.userId === actorUserId) {
      throw new BadRequestException('Нельзя отозвать собственный доступ');
    }

    // ⭐ Наблюдатель не может отзывать; прораб не может отозвать заказчика
    if (myAccess.role === AccessRole.VIEWER) {
      throw new ForbiddenException('Наблюдатель не может отзывать доступ');
    }
    if (myAccess.role === AccessRole.FOREMAN && target.role === AccessRole.CUSTOMER) {
      throw new ForbiddenException('Прораб не может отозвать доступ заказчика');
    }

    return this.prisma.objectAccess.delete({ where: { id: accessId } });
  }
}