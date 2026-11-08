// backend/src/auth/dto/verify.dto.ts
// ⭐ №122b: подтверждение email 6-значным кодом.
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { IsStrongPassword } from './is-strong-password.decorator';


export class VerifyEmailDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @IsString({ message: 'code: обязательная строка' })
  @Matches(/^\d{6}$/, { message: 'code: ровно 6 цифр' })
  code!: string;

  @IsOptional()
  @IsString({ message: 'fullName: строка или ничего' })
  @MinLength(2, { message: 'fullName: минимум 2 символа' })
  fullName?: string;

  @IsOptional()
  @IsString({ message: 'password: строка или ничего' })
  @IsStrongPassword()
  password?: string;
}
