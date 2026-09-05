// backend/src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

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

  // ⭐ Регистрация: email ИЛИ телефон + пароль + имя.
  // Возвращаем JWT сразу — пользователь попадает в приложение без повторного логина.
  async register(dto: RegisterDto) {
    // 1. Валидация: нужно хотя бы одно из двух
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Укажите email или телефон');
    }

    // 2-4. Проверка занятости + создание юзера.
    // ⭐ Race condition protection: если два параллельных запроса с одинаковым email/phone
    // пройдут проверку findUnique одновременно — БД выбросит P2002 (unique constraint).
    // Перехватываем и возвращаем человекоразумую ошибку вместо 500.
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prismaService.user.create({
        data: {
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          password: hashedPassword,
          fullName: dto.fullName,
          // По умолчанию — Прораб. Заказчики обычно приходят через приглашение.
          role: 'FOREMAN',
        },
      });

      // 5. Сразу логиним — возвращаем JWT + данные пользователя
      return this.login(user, false);
    } catch (e: any) {
      // P2002 = Unique constraint failed → email или телефон уже занят
      if (e.code === 'P2002') {
        const field = e.meta?.target?.includes('email') ? 'email' : 'телефон';
        throw new ConflictException(`Этот ${field} уже зарегистрирован`);
      }
      throw e;
    }

    // 5. Сразу логиним — возвращаем JWT + данные пользователя
    //return this.login(user, false);
  }
}