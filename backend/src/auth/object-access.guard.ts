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

    // ⭐ Определяем контроллер: в ObjectsController параметр :id — это objectId,
    // а в ProjectsController :id — это projectId (его проверяет сервис, не guard).
    const controllerName = context.getClass().name;

    let raw: unknown;
    if (request.params?.objectId) {
      // Явный objectId в пути (например, /projects/object/:objectId)
      raw = request.params.objectId;
    } else if (controllerName === 'ObjectsController' && request.params?.id) {
      // Только для объектов :id означает objectId
      raw = request.params.id;
    }

    const objectId = Number(raw);
    // ⭐ Если objectId не определён (создание, списки, /projects/:id и т.п.) — пропускаем.
    // Для таких маршрутов проверка доступа остаётся в сервисах.
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