import { Body, Controller, Post, UnauthorizedException, ValidationPipe, Request } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: LoginDto,
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
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: RegisterDto,
    @Request() request: ExpressRequest,
  ) {
    // ⭐ Шаг 77: извлекаем IP из x-forwarded-for (Yandex SmartCaptcha требует реальный IP)
    // Формат: "ip1, ip2, ip3" — берём первый (самый левый) элемент
    const forwardedFor = request.headers['x-forwarded-for'] as string | undefined;
    const ip = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : (request.connection as any)?.remoteAddress;

    return this.authService.register(dto, ip);
  }
}