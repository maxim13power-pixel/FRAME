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
import { RegisterDto } from './/dto/register.dto';

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

  // ⭐ Регистрация: email ИЛИ телефон + пароль + имя.
  // Возвращаем JWT сразу — пользователь попадает в приложение без повторного логина.
  async register(dto: RegisterDto) {
    // 1. Валидация: нужно хотя бы одно из двух
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Укажите email или телефон');
    }

    // 2. Проверка занятости email
    if (dto.email) {
      const exists = await this.prismaService.user.findUnique({
        where: { email: dto.email },
      });
      if (exists) {
        throw new ConflictException('Этот email уже зарегистрирован');
      }
    }

    // 3. Проверка занятости телефона
    if (dto.phone) {
      const exists = await this.prismaService.user.findUnique({
        where: { phone: dto.phone },
      });
      if (exists) {
        throw new ConflictException('Этот телефон уже зарегистрирован');
      }
    }

    // 4. Хэшируем пароль и создаём юзера
    const hashedPassword = await bcrypt.hash(dto.password, 10);
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
  }
}