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

    // ⭐ Читаем objectId ТОЛЬКО из params (надёжный источник маршрута).
    // body.objectId и query.objectId убраны — они ломали POST /objects и GET /objects?objectId=...
    // params.id здесь — это objectId для /objects/:id (для /projects/:id это projectId, см. projects.controller)
    const raw =
      request.params?.objectId ??
      request.params?.id;
    const objectId = Number(raw);
    // ⭐ Если objectId не указан (GET /objects, POST /objects и т.п.) — пропускаем.
    // Проверка доступа для таких маршрутов остаётся в сервисах.
    if (!objectId || Number.isNaN(objectId)) {
      return true;
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