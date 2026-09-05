import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { nanoid } from 'nanoid';

@Injectable()
export class InviteService {
  constructor(private prisma: PrismaService) {}

  // ⭐ Проверка доступа юзера к объекту
  private async checkObjectAccess(objectId: number, userId: number) {
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId },
    });
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    return access;
  }

  // 1. Создать ссылку-приглашение
  async createInviteLink(objectId: number, dto: CreateInviteDto, actorUserId: number) {
    const myAccess = await this.checkObjectAccess(objectId, actorUserId);

    // Только CUSTOMER и FOREMAN могут создавать ссылки
    if (myAccess.role === 'VIEWER') {
      throw new ForbiddenException('Наблюдатель не может создавать ссылки-приглашения');
    }

    // Проверка что объект существует
    const object = await this.prisma.object.findUnique({ where: { id: objectId } });
    if (!object) {
      throw new NotFoundException('Объект не найден');
    }

    // Генерируем URL-safe токен (21 символ)
    const token = nanoid(21);

    return this.prisma.inviteToken.create({
      data: {
        token,
        objectId,
        createdBy: actorUserId,
        role: dto.role,
        hidePrices: dto.hidePrices ?? false,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        maxUses: dto.maxUses ?? null,
      },
      include: {
        creator: { select: { id: true, fullName: true, email: true, phone: true } },
        object: { select: { id: true, name: true, address: true } },
      },
    });
  }

  // 2. Получить список активных ссылок объекта
  async getInviteLinks(objectId: number, userId: number) {
    await this.checkObjectAccess(objectId, userId);

    return this.prisma.inviteToken.findMany({
      where: { objectId, isActive: true },
      include: {
        creator: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 3. Отозвать ссылку (деактивировать)
  async revokeInviteLink(objectId: number, inviteId: number, userId: number) {
    await this.checkObjectAccess(objectId, userId);

    const invite = await this.prisma.inviteToken.findFirst({
      where: { id: inviteId, objectId },
    });
    if (!invite) {
      throw new NotFoundException('Ссылка не найдена');
    }

    // Только создатель или заказчик может отозвать
    const myAccess = await this.checkObjectAccess(objectId, userId);
    if (invite.createdBy !== userId && myAccess.role !== 'CUSTOMER') {
      throw new ForbiddenException('Только создатель ссылки или заказчик может её отозвать');
    }

    return this.prisma.inviteToken.update({
      where: { id: inviteId },
      data: { isActive: false },
    });
  }

  // 4. Публичный эндпоинт: получить информацию о приглашении по токену
  async getInviteByToken(token: string) {
    const invite = await this.prisma.inviteToken.findUnique({
      where: { token },
      include: {
        creator: { select: { id: true, fullName: true, email: true, phone: true } },
        object: { select: { id: true, name: true, address: true } },
      },
    });

    if (!invite || !invite.isActive) {
      throw new NotFoundException('Ссылка не найдена или отозвана');
    }

    // Проверка срока жизни
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Срок действия ссылки истёк');
    }

    // Проверка лимита использований
    if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
      throw new BadRequestException('Лимит использований ссылки исчерпан');
    }

    return {
      token: invite.token,
      role: invite.role,
      hidePrices: invite.hidePrices,
      creator: invite.creator,
      object: invite.object,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      usesCount: invite.usesCount,
    };
  }

  // 5. Принять приглашение (авторизованный юзер)
  // ⭐ Обёрнуто в транзакцию для защиты от race condition (двойной клик, параллельные запросы).
  // Уникальность доступа гарантируется unique constraint @@unique([userId, objectId, projectId]).
  async acceptInvite(token: string, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Читаем invite (с включёнными связями для возврата)
      const invite = await tx.inviteToken.findUnique({
        where: { token },
        include: {
          creator: { select: { id: true, fullName: true } },
          object: { select: { id: true, name: true } },
        },
      });

      if (!invite || !invite.isActive) {
        throw new NotFoundException('Ссылка не найдена или отозвана');
      }

      // 2. Проверка срока жизни
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        throw new BadRequestException('Срок действия ссылки истёк');
      }

      // 3. Проверка лимита использований
      if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
        throw new BadRequestException('Лимит использований ссылки исчерпан');
      }

      // 4. Создаём доступ. Если уже есть — БД выбросит P2002 (unique constraint).
      try {
        await tx.objectAccess.create({
          data: {
            userId,
            objectId: invite.objectId,
            projectId: null,
            role: invite.role,
            hidePrices: invite.hidePrices,
            invitedBy: invite.createdBy,
          },
        });
      } catch (e: any) {
        // P2002 = Unique constraint failed → юзер уже имеет доступ
        if (e.code === 'P2002') {
          throw new ConflictException('У вас уже есть доступ к этому объекту');
        }
        throw e;
      }

      // 5. Инкрементируем счётчик (внутри той же транзакции — атомарно)
      await tx.inviteToken.update({
        where: { token },
        data: { usesCount: { increment: 1 } },
      });

      return {
        message: 'Приглашение принято',
        objectId: invite.objectId,
        role: invite.role,
      };
    });
  }
}