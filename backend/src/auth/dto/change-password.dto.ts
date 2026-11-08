// backend/src/auth/dto/change-password.dto.ts
// ⭐ №215: смена пароля из «Настроек» — подтверждаем текущим паролем,
// новый проверяется общей политикой (мин. 8 символов, буква + цифра).
import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from './is-strong-password.decorator';

export class ChangePasswordDto {
  @IsString({ message: 'Укажите текущий пароль' })
  @MinLength(1, { message: 'Укажите текущий пароль' })
  currentPassword!: string;

  @IsString({ message: 'Укажите новый пароль' })
  @IsStrongPassword()
  newPassword!: string;
}
