// backend/src/auth/dto/reset-password.dto.ts
// ⭐ P0-4: DTO для сброса пароля по токену
import { IsString, MinLength, Length } from 'class-validator';
import { IsStrongPassword } from './is-strong-password.decorator';


export class ResetPasswordDto {
  @IsString({ message: 'Токен обязателен' })
  @Length(64, 64, { message: 'Некорректный токен (64 символа)' })
  token!: string;

  @IsString({ message: 'Пароль обязателен' })
  @IsStrongPassword()
  newPassword!: string;
}
