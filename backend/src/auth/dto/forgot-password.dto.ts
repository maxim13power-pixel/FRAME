// backend/src/auth/dto/forgot-password.dto.ts
// ⭐ P0-4: DTO для запроса восстановления пароля
import { IsEmail, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Укажите корректный email' })
  email!: string;
}