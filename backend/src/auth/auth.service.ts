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
import { EmailService } from './email.service'; // ⭐ P0-4
import { ForgotPasswordDto } from './dto/forgot-password.dto'; // ⭐ P0-4
import { ResetPasswordDto } from './dto/reset-password.dto'; // ⭐ P0-4
import * as crypto from 'crypto'; // ⭐ P0-4
@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prismaService: PrismaService,
    private captchaService: CaptchaService,
    private emailService: EmailService, // ⭐ P0-4
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
  // ⭐ P0-4: Запрос восстановления пароля
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prismaService.user.findUnique({
      where: { email: dto.email },
    });

    // ⭐ Безопасность: ВСЕГДА возвращаем одинаковый ответ,
    // чтобы злоумышленник не мог узнать, зарегистрирован ли email в системе.
    const successMessage = 'Если аккаунт с этим email существует, мы отправили ссылку для восстановления.';

    if (!user || !user.email) {
      return { message: successMessage };
    }

    // 1. Генерируем безопасный токен (64 hex символа = 256 бит энтропии)
    const plainToken = crypto.randomBytes(32).toString('hex');

    // 2. Аннулируем все предыдущие активные токены для этого юзера
    await this.prismaService.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // 3. Создаём новый токен (действителен 1 час)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.prismaService.passwordResetToken.create({
      data: {
        token: plainToken,
        userId: user.id,
        expiresAt,
      },
    });

    // 4. Формируем ссылку и отправляем письмо
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    const resetLink = `${frontendUrl}/reset-password?token=${plainToken}`;
    
    await this.emailService.sendPasswordResetEmail(user.email, resetLink);

    return { message: successMessage };
  }

  // ⭐ P0-4: Сброс пароля по токену из письма
  async resetPassword(dto: ResetPasswordDto) {
    // Ищем активный и неистёкший токен
    const resetToken = await this.prismaService.passwordResetToken.findUnique({
      where: { token: dto.token },
    });

    const errorMessage = 'Неверная или истёкшая ссылка для восстановления.';

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException(errorMessage);
    }

    // Хэшируем новый пароль
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    // Транзакция: обновляем пароль и помечаем токен как использованный
    await this.prismaService.$transaction([
      this.prismaService.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      this.prismaService.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Пароль успешно изменён. Теперь вы можете войти.' };
  }
}