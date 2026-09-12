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
import { CaptchaService } from '../captcha';
@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prismaService: PrismaService,
    private captchaService: CaptchaService,
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
async register(dto: RegisterDto, ip: string) {
  // 1. Валидация: нужно хотя бы одно из двух
  if (!dto.email && !dto.phone) {
    throw new BadRequestException('Укажите email или телефон');
  }

  // ⭐ Шаг 77: проверка капчи (в dev опциональна для удобства)
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !dto.captchaToken) {
    throw new BadRequestException('Капча обязательна');
  }
  if (dto.captchaToken) {
    const isValid = await this.captchaService.validate(dto.captchaToken, ip);
    if (!isValid) {
      throw new BadRequestException('Капча не пройдена. Попробуйте ещё раз.');
    }
  }

  // 2. Создание юзера (P2002 = email/phone занят)
  const hashedPassword = await bcrypt.hash(dto.password, 10);
  try {
    const user = await this.prismaService.user.create({
      data: {
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        password: hashedPassword,
        fullName: dto.fullName,
        role: 'FOREMAN',
      },
    });
    return this.login(user, false);
  } catch (e: any) {
    if (e.code === 'P2002') {
      const target: string[] = e.meta?.target ?? [];
      const isEmailConflict = target.includes('email');
      throw new ConflictException(
        isEmailConflict ? 'Этот email уже зарегистрирован' : 'Этот телефон уже зарегистрирован',
      );
    }
    throw e;
  }
}
}