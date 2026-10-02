// backend/src/auth/auth.service.ts
import {
  HttpException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { CaptchaService } from '../captcha';
import { EmailService } from './email.service'; // ⭐ P0-4
import { ForgotPasswordDto } from './dto/forgot-password.dto'; // ⭐ P0-4
import { ResetPasswordDto } from './dto/reset-password.dto'; // ⭐ P0-4
import { RequestCodeDto } from './dto/request-code.dto'; // ⭐ №122b
import { VerifyEmailDto } from './dto/verify.dto'; // ⭐ №122b
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
    // 1. Валидация: верификация по email
    if (!dto.email) {
      throw new BadRequestException('Укажите email для регистрации');
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

    // 2. ⭐ №122b: НЕ создаём пользователя — проверяем занятость и отправляем код
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prismaService.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Этот email уже зарегистрирован');
    }

    const recent = await this.countRecentCodes(email);
    if (recent >= 3) {
      throw new HttpException('Слишком много запросов. Попробуйте через час.', 429);
    }

    await this.sendCode(email);
    return { message: 'Код отправлен на email' };
  }
  // ⭐ P0-4: Запрос восстановления пароля
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prismaService.user.findUnique({
      where: { email: dto.email },
    });

    // ⭐ Безопасность: ВСЕГДА возвращаем одинаковый ответ,
    // чтобы злоумышленник не мог узнать, зарегистрирован ли email в системе.
    const successMessage =
      'Если аккаунт с этим email существует, мы отправили ссылку для восстановления.';

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

  // ═══════ №122b: ВЕРИФИКАЦИЯ EMAIL ═══════

  private generateCode(): string {
    return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  }

  private async countRecentCodes(email: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.prismaService.verificationToken.count({
      where: { email, createdAt: { gte: oneHourAgo } },
    });
  }

  private async sendCode(email: string): Promise<void> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prismaService.verificationToken.create({
      data: { email, code, expiresAt },
    });
    await this.emailService.sendVerificationCode(email, code);
  }

  async requestCode(dto: RequestCodeDto) {
    const email = dto.email.trim().toLowerCase();
    const recent = await this.countRecentCodes(email);
    if (recent >= 3) {
      throw new HttpException('Слишком много запросов. Попробуйте через час.', 429);
    }
    await this.sendCode(email);
    return { message: 'Код отправлен на email' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = dto.email.trim().toLowerCase();
    // Rate limit: максимум 5 попыток в час на email
    const recent = await this.countRecentCodes(email);
    if (recent >= 5) {
      throw new HttpException('Слишком много попыток. Попробуйте через час.', 429);
    }

    const token = await this.prismaService.verificationToken.findFirst({
      where: {
        email,
        code: dto.code,
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) {
      throw new BadRequestException('Неверный или просроченный код');
    }

    await this.prismaService.verificationToken.update({
      where: { id: token.id },
      data: { used: true },
    });

    // ⭐ Создаём пользователя, если ещё нет
    let user = await this.prismaService.user.findUnique({ where: { email } });
    if (!user) {
      const hashedPassword = await bcrypt.hash(
        dto.password || crypto.randomBytes(8).toString('hex'),
        10,
      );
      try {
        user = await this.prismaService.user.create({
          data: {
            email,
            password: hashedPassword,
            fullName: dto.fullName?.trim() || email.split('@')[0] || 'Пользователь',
            role: 'FOREMAN',
          },
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          user = await this.prismaService.user.findUnique({ where: { email } });
        } else {
          throw e;
        }
      }
    }

    if (!user) {
      throw new ConflictException('Не удалось создать пользователя');
    }
    return this.login(user, false);
  }
}
