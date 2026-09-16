// backend/src/auth/dto/reset-password.dto.ts
// ⭐ P0-4: DTO для сброса пароля по токену
import { IsString, MinLength, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsString({ message: 'Токен обязателен' })
  @Length(64, 64, { message: 'Некорректный токен (64 символа)' })
  token!: string;

  @IsString({ message: 'Пароль обязателен' })
  @MinLength(6, { message: 'Пароль минимум 6 символов' })
  newPassword!: string;
}
