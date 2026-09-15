import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  ValidationPipe,
  Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto'; // ⭐ P0-4
import { ResetPasswordDto } from './dto/reset-password.dto'; // ⭐ P0-4
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: LoginDto,
  ) {
    // ⭐ Поддерживаем и phone, и email (согласно PROJECT_STATUS_v9.md)
    const identifier = dto.phone || dto.email;
    if (!identifier) {
      throw new UnauthorizedException('Укажите телефон или email');
    }

    const user = await this.authService.validateUser(identifier, dto.password);
    if (!user) {
      throw new UnauthorizedException('Неверный телефон/email или пароль');
    }
    return this.authService.login(user, dto.rememberMe);
  }

  // ⭐ Регистрация нового пользователя
  @Post('register')
  async register(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: RegisterDto,
    @Request() request: ExpressRequest,
  ) {
    // ⭐ Шаг 77: извлекаем IP из x-forwarded-for (Yandex SmartCaptcha требует реальный IP)
    // Формат: "ip1, ip2, ip3" — берём первый (самый левый) элемент
    const forwardedFor = request.headers['x-forwarded-for'] as
      | string
      | undefined;
    const ip = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : (request.connection as any)?.remoteAddress;

    return this.authService.register(dto, ip);
  }
  // ⭐ P0-4: Запрос ссылки на восстановление пароля
  @Post('forgot-password')
  async forgotPassword(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(dto);
  }

  // ⭐ P0-4: Сброс пароля по токену из письма
  @Post('reset-password')
  async resetPassword(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(dto);
  }
}
