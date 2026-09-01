import { Body, Controller, Post, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

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
}