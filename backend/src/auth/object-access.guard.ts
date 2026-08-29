// backend/src/auth/object-access.guard.ts
// Проверяет что у пользователя есть доступ к конкретному объекту через таблицу ObjectAccess.
// Используется в контроллерах ПОСЛЕ JwtAuthGuard:
// @UseGuards(JwtAuthGuard, ObjectAccessGuard)
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ObjectAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Не авторизован');
    }

    // Ищем objectId: params.objectId → params.id → body.objectId → query.objectId
    const raw =
      request.params?.objectId ??
      request.params?.id ??
      request.body?.objectId ??
      request.query?.objectId;
    const objectId = Number(raw);
    if (!objectId || Number.isNaN(objectId)) {
      throw new BadRequestException('objectId не указан');
    }

    // Проверяем что у юзера есть доступ к объекту
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId },
    });
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }

    // Кладём в request для использования в контроллерах/сервисах
    request.accessRole = access.role;
    request.accessObjectId = objectId;
    return true;
  }
}