// backend/src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }

  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: any) {
    // ⭐ №160: проверка версии сессий. Инкремент tokenVersion (logout-all или
    // сброс пароля) мгновенно отзывает все ранее выданные токены.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true },
    });
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }
    if ((payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Сессия завершена. Войдите снова.');
    }
    // ⭐ Новая модель: возвращаем только userId, email, phone, role.
    //    Доступ к объектам проверяется отдельно в object-access.guard.ts.
    return {
      userId: payload.sub,
      email: payload.email,
      phone: payload.phone,
      role: payload.role,
    };
  }
}
