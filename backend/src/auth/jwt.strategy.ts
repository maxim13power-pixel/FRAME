// backend/src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'SECRET_KEY',
    });
  }

  async validate(payload: any) {
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