import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrgAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const orgId = request.user?.orgId;

    if (!userId || !orgId) {
      throw new UnauthorizedException('Нет доступа к организации');
    }

    // Проверяем что пользователь действительно состоит в этой организации
    const membership = await this.prisma.orgMembership.findFirst({
      where: { userId, orgId },
    });

    if (!membership) {
      throw new UnauthorizedException('Нет доступа к этой организации');
    }

    return true;
  }
}