// backend/src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prismaService: PrismaService,
  ) {}

  async validateUser(login: string, pass: string): Promise<any> {
    // ⭐ Фича: принимаем и email и телефон (удобно для пользователей)
    const isEmail = login.includes('@');
    const user = await this.prismaService.user.findFirst({
      where: isEmail ? { email: login } : { phone: login },
    });
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any, rememberMe: boolean = false) {
    // ⭐ Новая модель: в JWT только userId, email, phone, role (глобальная роль User).
    //    Доступ к объектам определяется через ObjectAccess (в object-access.guard.ts).
    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
    const expiresIn = rememberMe ? '30d' : '1d';
    console.log('rememberMe:', rememberMe, 'expiresIn:', expiresIn);
    const access_token = this.jwtService.sign(payload, { expiresIn });

    return {
      access_token,
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  }
}